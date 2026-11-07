import { expect, story } from "../../stories/playwright/story"

const locales = [
  {
    locale: "zh",
    title: "新功能",
    since: "自构建 21012 起 · 18 项更改",
    added: "新增",
    fixed: "修复",
    viewAll: "查看全部",
    done: "知道了",
    pageDescription: "此构建中的所有更改。",
    github: "GitHub 提交历史",
  },
  {
    locale: "zht",
    title: "新功能",
    since: "自組建 21012 起 · 18 項變更",
    added: "新增",
    fixed: "修正",
    viewAll: "檢視全部",
    done: "知道了",
    pageDescription: "此組建中的所有變更。",
    github: "GitHub 提交歷程",
  },
]

for (const copy of locales)
  story(`the What's new beta dialog and page use ${copy.locale}`, async ({ mount, page }) => {
    const component = await mount("plugins-updater-beta-notes--many", { globals: { locale: copy.locale } })
    const dialog = page.getByRole("dialog")

    await expect(dialog.getByRole("heading", { level: 2, name: copy.title, exact: true })).toBeVisible()
    await expect(dialog.getByText(copy.since, { exact: true })).toBeVisible()
    await expect(dialog.getByRole("heading", { level: 2, name: copy.added, exact: true })).toBeVisible()
    await expect(dialog.getByRole("heading", { level: 2, name: copy.fixed, exact: true })).toBeVisible()
    await expect(dialog.getByRole("button", { name: copy.viewAll, exact: true })).toBeVisible()
    await expect(dialog.getByRole("button", { name: copy.done, exact: true })).toBeVisible()

    await dialog.getByRole("button", { name: copy.viewAll, exact: true }).click()

    await expect(dialog).toBeHidden()
    await expect(component.getByRole("heading", { level: 2, name: copy.title, exact: true })).toBeVisible()
    await expect(component.getByText(copy.pageDescription, { exact: true })).toBeVisible()
    await expect(component.getByRole("button", { name: copy.github, exact: true })).toBeVisible()
    await expect(component.getByRole("heading", { level: 3, name: copy.added, exact: true })).toBeVisible()
    await expect(component.getByRole("heading", { level: 3, name: copy.fixed, exact: true })).toBeVisible()
  })
