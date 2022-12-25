import { test, _electron as electron } from "@playwright/test";
import dotenv from "dotenv";

test("起動したら「利用規約に関するお知らせ」が表示される", async () => {
  dotenv.config(); // FIXME: エンジンの設定直読み
  const app = await electron.launch({
    args: ["dist/background.js"],
  });
  const page = await app.firstWindow();

  // エンジンが起動し「利用規約に関するお知らせ」が表示されるのを待つ
  await page.waitForSelector("text=利用規約に関するお知らせ");

  await app.close();
});
