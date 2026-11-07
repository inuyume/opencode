import { createSignal, lazy, onCleanup, Show, Suspense } from "solid-js"
import { Command, Panel, Slot, Style, usePanel, type Plugin } from "@opencode/plugin/gui"
import type Details from "./index"
import { DetailsHeader, type DetailsMenu, type DetailsMenus } from "./popover"
import { BuiltinSlot, onIdle } from "@opencode/plugin/gui/builtin"
import type { McpControllers } from "./server-panel"
import type { WorkspaceMoveControllers } from "./workspace-menu"

const setup: Plugin.Setup<typeof Details> = (ctx) => {
  const sessions = ctx.sessions

  // Every mounted popover reports itself here, so the command can follow which timeline is on screen.
  const [menuEntries, setMenuEntries] = createSignal<readonly DetailsMenu[]>([])

  const menus: DetailsMenus = {
    entries: menuEntries,
    add: (menu) => setMenuEntries((current) => [...current, menu]),
    remove: (menu) => setMenuEntries((current) => current.filter((item) => item !== menu)),
  }

  // The visible popover whose trigger is mounted. A detached timeline can stay active, so the trigger must be on
  // screen too; the last entry wins when two timelines briefly overlap.
  const currentMenu = () => menus.entries().findLast((menu) => menu.active() && menu.connected())

  // Contributed continuously, so Settings > Shortcuts can refresh its remembered title while no timeline is active.
  ctx.add(
    Command,
    (): Command => ({
      id: "toggle",
      title: ctx.t("command.toggle"),
      group: ctx.t("command.category.view"),
      section: "session",
      bind: "mod+shift+y",
      enabled: !!currentMenu(),
      run: () => currentMenu()?.toggle(),
    }),
  )
  // MCP toggles and error dialogs outlive the popover or drawer that started them.
  const mcp: McpControllers = new Map()
  // Moves and their recovery dialogs outlive the location menu, which closes when the user picks a destination.
  const moves: WorkspaceMoveControllers = new Map()

  const DetailsPanel = lazy(() =>
    Promise.all([import("./panel"), import("./details.css?inline")]).then(([panel, css]) => {
      ctx.add(Style, css.default)

      return panel
    }),
  )

  const LocationMenu = lazy(() => import("./location-menu"))
  const LocationWorkspace = lazy(() => import("./location-workspace"))

  // Compile the panel while the app idles, so the first open renders at once.
  onCleanup(
    onIdle(() => {
      void DetailsPanel.preload()
      void LocationMenu.preload()
      void LocationWorkspace.preload()
    }),
  )

  ctx.add(Slot, {
    at: "session.header",
    order: 20,
    render: (input) => (
      <DetailsHeader menus={menus} session={input.session} active={input.active} panel={DetailsPanel} mcp={mcp} />
    ),
  })

  ctx.add(Slot, {
    at: "session.location.menu",
    render: (input) => (
      <Suspense>
        <LocationMenu session={input.session} screen={input.screen} shown={input.shown} />
      </Suspense>
    ),
  })

  ctx.add(BuiltinSlot, {
    at: "session.location.workspace",
    render: (input) => (
      <Suspense>
        <LocationWorkspace {...input} moves={moves} />
      </Suspense>
    ),
  })

  // The narrow-screen details drawer, offered for sessions of a project, subagents included.
  const panel: Panel = {
    id: "main",
    region: "side",
    mobile: {
      get title() {
        return ctx.t("title")
      },
      order: 50,
      kind: "drawer",
      icon: "info",
    },
    list: () => [],
    render: (props) => {
      const frame = usePanel()

      return (
        <Show when={props.session.project}>
          <Suspense>
            <DetailsPanel mobile shown={frame.visible()} session={props.session} mcp={mcp} />
          </Suspense>
        </Show>
      )
    },
  }

  ctx.add(Panel, () => {
    const session = sessions.current()

    if (!session?.project) return

    return panel
  })
}

export default setup
