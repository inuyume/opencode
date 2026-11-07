import { expect, story } from "../../stories/playwright/story"

const chinese = [
  {
    locale: "zh",
    title: "配对",
    pairTitle: "配对设备",
    remoteTitle: "远程访问",
    screenActiveTitle: "保持屏幕常亮",
    pairOpen: "配对设备",
    dialogDescription: "使用另一台设备上的 OpenCode 应用扫描二维码，或复制链接。",
    copyLink: "复制链接",
    refresh: "刷新配对码",
    screenError: "无法更新屏幕常亮设置。请重试。",
    retry: "重试",
  },
  {
    locale: "zht",
    title: "配對",
    pairTitle: "配對裝置",
    remoteTitle: "遠端存取",
    screenActiveTitle: "保持螢幕常亮",
    pairOpen: "配對裝置",
    dialogDescription: "使用另一部裝置上的 OpenCode 應用程式掃描 QR 碼，或複製連結。",
    copyLink: "複製連結",
    refresh: "重新整理配對碼",
    screenError: "無法更新螢幕常亮設定。請再試一次。",
    retry: "再試一次",
  },
]

for (const copy of chinese)
  story(`the pairing settings page and pair dialog use ${copy.locale}`, async ({ mount, page }) => {
    const component = await mount("plugins-pairing--remote-on", { globals: { locale: copy.locale } })

    await expect(component.getByRole("heading", { level: 2, name: copy.title, exact: true })).toBeVisible()
    await expect(component.locator('[data-slot="settings-row-title"]')).toHaveText([
      copy.pairTitle,
      copy.remoteTitle,
      copy.screenActiveTitle,
    ])

    await component.getByRole("button", { name: copy.pairOpen, exact: true }).click()

    const dialog = page.getByRole("dialog", { name: copy.pairTitle, exact: true })

    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(copy.dialogDescription, { exact: true })).toBeVisible()
    await expect(dialog.getByRole("button", { name: copy.copyLink, exact: true })).toBeVisible()
    await expect(dialog.getByRole("button", { name: copy.refresh, exact: true })).toBeVisible()
  })

for (const copy of [
  {
    locale: "en",
    screenActiveTitle: "Keep screen active",
    screenError: "Could not update the screen activity setting. Try again.",
    retry: "Try again",
  },
  ...chinese,
])
  story(
    `a Keep screen active read that fails offers retry and keeps the switch enabled (${copy.locale})`,
    async ({ mount, page }) => {
      // The page reads three more times, 1, 2 and 4 seconds apart, before it shows the failure.
      await page.clock.install()
      const component = await mount("plugins-pairing--screen-setting-fails", { globals: { locale: copy.locale } })
      const toggle = component.getByRole("switch", { name: copy.screenActiveTitle, exact: true })
      const error = component.getByRole("alert").filter({ hasText: copy.screenError })
      const retry = component.getByRole("button", { name: copy.retry, exact: true })

      await expect(toggle).toBeDisabled()
      await page.clock.runFor(8_000)
      await expect(error).toBeVisible()
      await expect(toggle).toBeEnabled()
      await expect(toggle).not.toBeChecked()

      await retry.click()
      await expect(error).toHaveCount(0)
      await expect(retry).toHaveCount(0)
      await expect(toggle).toBeEnabled()

      await toggle.focus()
      await toggle.press("Space")
      await expect(toggle).toBeChecked()
      await expect(toggle).toBeEnabled()
    },
  )
