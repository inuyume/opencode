import { Popover } from "@kobalte/core/popover"
import { Icon } from "@opencode/ui/icon"
import { IconButton } from "@opencode/ui/icon-button"
import { Keybind } from "@opencode/ui/keybind"
import { Tooltip } from "@opencode/ui/tooltip"
import { createSignal, onCleanup, onMount, Show, Suspense, untrack, type Component } from "solid-js"
import { createKeyed, usePlugin, type MountedSession } from "@opencode/plugin/gui"
import type { DetailsPanelProps } from "./panel"
import {
  detailsPopoverFocusesContent,
  detailsPopoverOpen,
  initialDetailsPopoverState,
  transitionDetailsPopover,
  type DetailsPopoverEvent,
  type DetailsPopoverState,
  type DetailsPopoverVia,
} from "./popover-machine"
import type { McpControllers } from "./server-panel"

/** One mounted details popover, so the plugin's command finds the one on screen. */
export type DetailsMenu = {
  /** Its timeline is the one on screen. */
  active: () => boolean
  /** Whether its trigger is attached, including cached timelines being reinserted. */
  connected: () => boolean
  /** Opens or closes it. */
  toggle: () => void
}

/** Every mounted details popover, with membership changes the command follows. */
export type DetailsMenus = {
  entries: () => readonly DetailsMenu[]
  add: (menu: DetailsMenu) => void
  remove: (menu: DetailsMenu) => void
}

type DetailsProps = {
  menus: DetailsMenus
  session: MountedSession
  active: boolean
  panel: Component<DetailsPanelProps>
  mcp: McpControllers
}

/** The session details popover of one timeline header. Cached timelines each keep their own. */
export function DetailsHeader(props: DetailsProps) {
  return (
    <Show when={props.session.project}>
      <DetailsPopover
        menus={props.menus}
        session={props.session}
        active={props.active}
        panel={props.panel}
        mcp={props.mcp}
      />
    </Show>
  )
}

function DetailsPopover(props: DetailsProps) {
  const ctx = usePlugin()
  const keybinds = ctx.keybinds
  const Panel = props.panel
  const [popoverState, setPopoverState] = createSignal<DetailsPopoverState>(initialDetailsPopoverState)
  const open = () => detailsPopoverOpen(popoverState())

  const [trigger, setTrigger] = createSignal<HTMLButtonElement>()
  const [connected, setConnected] = createSignal(false)
  let content: HTMLDivElement | undefined
  let focusTimer: ReturnType<typeof setTimeout> | undefined
  // The trigger's latest click, which Kobalte reports just before it toggles the popover: a click without a pointer
  // (`detail` 0) comes from Enter or Space.
  let clickVia: DetailsPopoverVia = "keyboard"

  const dispatch = (event: DetailsPopoverEvent) => {
    const previous = untrack(popoverState)
    const next = transitionDetailsPopover(previous, event)

    if (next.state !== previous) setPopoverState(next.state)
    next.effects.forEach((effect) => {
      if (effect.type === "schedule-focus") {
        const attempt = effect.attempt
        clearTimeout(focusTimer)
        // Deferred like Kobalte's own autofocus, which runs once the content is in the document.
        focusTimer = setTimeout(() => dispatch({ type: "focus.due", attempt }))

        return
      }

      if (effect.type === "cancel-focus") return clearTimeout(focusTimer)

      content?.focus({ preventScroll: true })
    })
  }

  // Cached timelines stay mounted while hidden; routing away from the session closes its details.
  createKeyed(
    () => (ctx.sessions.current()?.visit === props.session.visit ? props.session.visit : undefined),
    () => onCleanup(() => dispatch({ type: "closed" })),
  )

  // Cached timelines become active before their DOM is reinserted. Follow that insertion instead of caching
  // isConnected during the active change; only the active header needs to observe the document.
  createKeyed(
    () => (props.active ? trigger() : undefined),
    (element) => {
      const read = () => setConnected(element.isConnected)
      const observer = new MutationObserver(read)
      observer.observe(document.body, { childList: true, subtree: true })
      read()
      onCleanup(() => {
        observer.disconnect()
        setConnected(false)
      })
    },
  )

  // Cached timelines remain mounted; only the visible details own the command. The plugin's setup selects the menu
  // whose timeline is active and whose trigger is on screen.
  const self: DetailsMenu = {
    active: () => props.active,
    connected,
    toggle: () => dispatch({ type: "toggled", via: "keyboard" }),
  }

  // Refs run before insertion; publish only once the trigger is connected so enabled is computed after mounting.
  onMount(() => props.menus.add(self))
  onCleanup(() => {
    props.menus.remove(self)
    dispatch({ type: "disposed" })
  })

  const keybind = () => [...keybinds.keybind(`${ctx.id}.toggle`)]

  return (
    <Popover
      placement="bottom-end"
      gutter={8}
      overflowPadding={16}
      open={open()}
      onOpenChange={(next) => dispatch(next ? { type: "opened", via: clickVia } : { type: "closed" })}
    >
      <Popover.Anchor class="pointer-events-none absolute end-3 top-2.5 h-7 w-0" aria-hidden="true" />
      <Tooltip
        placement="bottom"
        value={
          <>
            {ctx.t("tooltip")}
            <Show when={keybind().length > 0}>
              <Keybind keys={keybind()} variant="neutral" />
            </Show>
          </>
        }
      >
        <Popover.Trigger
          ref={setTrigger}
          as={IconButton}
          icon={<Icon name="window-analytics" />}
          variant="ghost-muted"
          size="large"
          state={open() ? "pressed" : undefined}
          aria-label={ctx.t("title")}
          aria-expanded={open()}
          onClick={(event: MouseEvent) => {
            clickVia = event.detail === 0 ? "keyboard" : "pointer"
          }}
        />
      </Tooltip>
      <Popover.Portal>
        {/* Kobalte positions the content relatively, so it places the Extensions flyout. */}
        <Popover.Content
          ref={content}
          class="session-summary-popover z-50 border-0 bg-transparent outline-none"
          aria-label={ctx.t("title")}
          // Keys pressed in the popover, Escape included, stay out of the session view's shortcuts.
          data-prevent-autofocus
          // A pointer open focuses the popover itself, so its first row shows no focus ring beside the pointer.
          // Kobalte calls this inside its focus scope's effect: a tracked read would run the scope again on every
          // change of state, moving focus to the trigger and back.
          onOpenAutoFocus={(event: Event) => {
            if (!detailsPopoverFocusesContent(untrack(popoverState))) return
            event.preventDefault()
            dispatch({ type: "autofocus.intercepted" })
          }}
        >
          <Suspense>
            <Panel
              session={props.session}
              shown={open()}
              mcp={props.mcp}
              onClose={() => dispatch({ type: "closed" })}
            />
          </Suspense>
        </Popover.Content>
      </Popover.Portal>
    </Popover>
  )
}
