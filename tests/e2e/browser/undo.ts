import { expect, test, type Page } from "@playwright/test";

import { getQuasarMenu } from "../locators";

export async function undo(page: Page) {
  await test.step("操作を元に戻す", async () => {
    await page.getByRole("button", { name: "編集", exact: true }).click();
    const menuItem = getQuasarMenu(page, "元に戻す");
    await expect(menuItem).toBeEnabled();
    await menuItem.click();
  });
}

export async function redo(page: Page) {
  await test.step("操作をやり直す", async () => {
    await page.getByRole("button", { name: "編集", exact: true }).click();
    const menuItem = getQuasarMenu(page, "やり直す");
    await expect(menuItem).toBeEnabled();
    await menuItem.click();
  });
}
