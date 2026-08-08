import { expect, test, type Locator, type Page } from "@playwright/test";

import { gotoHome, navigateToMain } from "../navigators";
import { getQuasarMenu } from "../locators";
import { ensureNotNullish } from "@/type/utility";

test.beforeEach(gotoHome);

async function undo(page: Page) {
  await test.step("操作を元に戻す", async () => {
    await page.getByRole("button", { name: "編集", exact: true }).click();
    const menuItem = getQuasarMenu(page, "元に戻す");
    await expect(menuItem).toBeEnabled();
    await menuItem.click();
  });
}

async function redo(page: Page) {
  await test.step("操作をやり直す", async () => {
    await page.getByRole("button", { name: "編集", exact: true }).click();
    const menuItem = getQuasarMenu(page, "やり直す");
    await expect(menuItem).toBeEnabled();
    await menuItem.click();
  });
}

async function enterText(page: Page, row: number, text: string) {
  await test.step(`${row}行目にテキストを入力する`, async () => {
    const input = page.getByRole("textbox", {
      name: `${row}行目`,
      exact: true,
    });
    await input.fill(text);
    await input.press("Enter");
    await expect(input).toHaveValue(text);
    await expect(page.locator(".accent-phrase")).not.toHaveCount(0);
  });
}

async function moveAudioCell(page: Page, from: number, to: number) {
  await test.step(`${from + 1}行目を${to + 1}行目へ移動する`, async () => {
    const cells = page.locator(".audio-cell");
    const fromHandle = cells.nth(from).getByRole("button", { name: /dummy1/ });
    const toHandle = cells.nth(to).getByRole("button", { name: /dummy1/ });
    const fromBox = ensureNotNullish(await fromHandle.boundingBox());
    const toBox = ensureNotNullish(await toHandle.boundingBox());

    await page.mouse.move(
      fromBox.x + fromBox.width / 2,
      fromBox.y + fromBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      toBox.x + toBox.width / 2,
      toBox.y + toBox.height / 2,
      { steps: 10 },
    );
    await page.mouse.up();
  });
}

async function showDetail(page: Page, tabName: "ｲﾝﾄﾈｰｼｮﾝ" | "長さ") {
  await test.step(`${tabName}欄を表示する`, async () => {
    await page.getByRole("tab", { name: tabName, exact: true }).click();
    if (tabName === "ｲﾝﾄﾈｰｼｮﾝ") {
      const tip = page
        .getByRole("alert")
        .filter({ hasText: "マウスホイールを使って" });
      await expect(tip).toBeVisible();
      await tip.getByRole("button", { name: "OK" }).click();
      await expect(tip).toBeHidden();
    }
    await expect(
      page.getByTestId("audio-detail").locator(".pitch-cell").first(),
    ).toBeVisible();
  });
}

async function changeSlider(slider: Locator, targetName: string) {
  return await test.step(`${targetName}を変更する`, async () => {
    const before = ensureNotNullish(await slider.getAttribute("aria-valuenow"));
    const max = ensureNotNullish(await slider.getAttribute("aria-valuemax"));
    const track = slider.locator(".q-slider__track-container");
    const trackBox = ensureNotNullish(await track.boundingBox());
    await track.click({
      position: {
        x: trackBox.width / 2,
        y: before === max ? trackBox.height - 1 : 1,
      },
      force: true,
    });
    await expect
      .poll(async () => await slider.getAttribute("aria-valuenow"))
      .not.toBe(before);
    const after = ensureNotNullish(await slider.getAttribute("aria-valuenow"));
    return { before, after };
  });
}

async function expectSliderValue(
  slider: Locator,
  expectedValue: string,
  stepName: string,
) {
  await test.step(stepName, async () => {
    await expect(slider).toHaveAttribute("aria-valuenow", expectedValue);
  });
}

test("テキストと並び順を元に戻してやり直せる", async ({ page }) => {
  await navigateToMain(page);

  const firstInput = page.getByRole("textbox", {
    name: "1行目",
    exact: true,
  });

  await enterText(page, 1, "最初の文章");
  await undo(page);

  await test.step("テキストが空に戻る", async () => {
    await expect(firstInput).toHaveValue("");
  });

  await redo(page);

  await test.step("変更したテキストに戻る", async () => {
    await expect(firstInput).toHaveValue("最初の文章");
  });

  await test.step("2行目を追加する", async () => {
    await page.getByRole("button", { name: "テキストを追加" }).click();
    await expect(page.locator(".audio-cell")).toHaveCount(2);
  });
  await enterText(page, 2, "次の文章");
  await moveAudioCell(page, 0, 1);

  await test.step("テキスト欄の順番が変わる", async () => {
    await expect(firstInput).toHaveValue("次の文章");
  });

  await undo(page);

  await test.step("元の並び順に戻る", async () => {
    await expect(firstInput).toHaveValue("最初の文章");
  });

  await redo(page);

  await test.step("変更後の並び順に戻る", async () => {
    await expect(firstInput).toHaveValue("次の文章");
  });
});

test("アクセント位置を元に戻してやり直せる", async ({ page }) => {
  await navigateToMain(page);
  await enterText(page, 1, "こんにちは");

  const accentSlider = page.locator(".accent-slider-cell").getByRole("slider");
  const before =
    await test.step("変更前のアクセント位置を取得する", async () => {
      const value = ensureNotNullish(
        await accentSlider.getAttribute("aria-valuenow"),
      );
      await expect(accentSlider).toHaveAttribute("aria-valuenow", value);
      return value;
    });
  const after = before === "1" ? "2" : "1";

  await test.step("アクセント位置を変更する", async () => {
    await page
      .locator(".accent-select-cell")
      .nth(Number(after) - 1)
      .click();
    await expect(accentSlider).toHaveAttribute("aria-valuenow", after);
  });

  await undo(page);
  await expectSliderValue(accentSlider, before, "元のアクセント位置に戻る");

  await redo(page);
  await expectSliderValue(accentSlider, after, "変更後のアクセント位置に戻る");
});

test("イントネーションを元に戻してやり直せる", async ({ page }) => {
  await navigateToMain(page);
  await enterText(page, 1, "こんにちは");
  await showDetail(page, "ｲﾝﾄﾈｰｼｮﾝ");

  const slider = page.getByTestId("audio-detail").getByRole("slider").first();
  const { before, after } = await changeSlider(slider, "イントネーション");

  await undo(page);
  await expectSliderValue(slider, before, "元のイントネーションに戻る");

  await redo(page);
  await expectSliderValue(slider, after, "変更後のイントネーションに戻る");
});

test("音の長さを元に戻してやり直せる", async ({ page }) => {
  await navigateToMain(page);
  await enterText(page, 1, "こんにちは");
  await showDetail(page, "長さ");

  const slider = page.getByTestId("audio-detail").getByRole("slider").first();
  const { before, after } = await changeSlider(slider, "音の長さ");

  await undo(page);
  await expectSliderValue(slider, before, "元の長さに戻る");

  await redo(page);
  await expectSliderValue(slider, after, "変更後の長さに戻る");
});

test("音声パラメータを元に戻してやり直せる", async ({ page }) => {
  await navigateToMain(page);
  await enterText(page, 1, "こんにちは");

  const speedScaleInput = page.getByLabel("話速");
  const before = await test.step("変更前の話速を取得する", async () => {
    await expect(speedScaleInput).toBeEnabled();
    return await speedScaleInput.inputValue();
  });
  const after = before === "1.50" ? "0.50" : "1.50";

  await test.step("話速を変更する", async () => {
    await speedScaleInput.fill(after);
    await speedScaleInput.press("Enter");
    await expect(speedScaleInput).toHaveValue(after);
  });

  await undo(page);

  await test.step("元の話速に戻る", async () => {
    await expect(speedScaleInput).toHaveValue(before);
  });

  await redo(page);

  await test.step("変更後の話速に戻る", async () => {
    await expect(speedScaleInput).toHaveValue(after);
  });
});
