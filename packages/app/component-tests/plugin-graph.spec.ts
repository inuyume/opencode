import { expect, sourceURL, story } from "../../stories/playwright/story"
import type { Entry } from "@opencode/plugin/gui/host"

const source = (path: string) => sourceURL(new URL(path, import.meta.url))

const modules = {
  fixture: source("./plugin-host.fixture.tsx"),
  builtins: source("../../gui-plugins/src/renderer.ts"),
  sdk: source("../../plugin/src/gui/index.ts"),
}

story.beforeEach(async ({ mount }) => {
  // Any story loads the app; the fixture mounts the real host beside it.
  await mount("ui-line-comment--editor")
})

// Built-ins read each other's contracts at runtime with `ctx.use`, so each must keep working without any other. Every
// row boots the real host with one built-in disabled; the first row disables nothing.
story("built-ins: each activates without each other built-in", async ({ page }) => {
  const outcomes = await page.evaluate(async (modules) => {
    const [{ mountPlugins, until }, { builtins }] = await Promise.all([
      import(modules.fixture),
      import(modules.builtins),
    ])

    // The window this host serves has no OS, so OS-specific built-ins are left out as the app leaves them out.
    const composition: readonly Entry[] = builtins
    const definitions = composition.filter((definition) => !definition.os)
    const rows = ["", ...definitions.map((definition) => definition.id)]
    const results = []

    for (const disabled of rows) {
      const host = mountPlugins({ definitions, disabled: disabled ? [disabled] : [] })
      host.release()
      await until(() => host.ready())
      results.push({
        disabled,
        results: definitions.flatMap((definition) =>
          definition.id === disabled
            ? []
            : [
                {
                  id: definition.id,
                  status: host.status(definition.id),
                  failure: host.failure(definition.id)?.error ?? null,
                },
              ],
        ),
      })
      host.unmount()
    }

    return results
  }, modules)

  expect(outcomes).toEqual(
    outcomes.map((outcome) => ({
      ...outcome,
      results: outcome.results.map((item) => ({ id: item.id, status: "active", failure: null })),
    })),
  )
})

// A command contributed only while a session, pane or timeline is mounted would withdraw from Settings > Shortcuts
// before a language change could refresh its remembered title. The visible built-in commands stay contributed and
// disabled instead.
story("built-ins keep their visible commands while no session is active", async ({ page }) => {
  const commands = await page.evaluate(async (modules) => {
    const [{ mountPlugins, until }, { builtins }, sdk] = await Promise.all([
      import(modules.fixture),
      import(modules.builtins),
      import(modules.sdk),
    ])

    const definitions = builtins.filter((definition: Entry) => !definition.os)
    const host = mountPlugins({ definitions })
    host.release()
    await until(() => host.ready())

    const items = host.items(sdk.Command).map((item: { plugin: string; value: { id: string; enabled?: boolean } }) => ({
      plugin: item.plugin,
      id: item.value.id,
      enabled: item.value.enabled !== false,
    }))

    host.unmount()

    return items
  }, modules)

  expect(commands).toEqual(
    expect.arrayContaining([
      { plugin: "browser", id: "open", enabled: false },
      { plugin: "browser", id: "reload", enabled: false },
      { plugin: "browser", id: "address", enabled: false },
      { plugin: "browser", id: "inspect", enabled: false },
      { plugin: "details", id: "toggle", enabled: false },
    ]),
  )
})
