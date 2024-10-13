import fs from "fs/promises";
import { stories } from "./storyIds.generated";

export type StorybookIndex = {
  v: 5;
  entries: Record<string, StorybookEntry>;
};
export type StorybookEntry = {
  type: string;
  id: string;
  name: string;
  title: string;
  tags: string[];
};

// テスト対象のStory一覧を取得する。
// play-fnが付いているStoryはUnit Test用Storyとみなしてスクリーンショットを撮らない
export const getStoriesToTest = (index: StorybookIndex) =>
  Object.values(index.entries).filter(
    (entry) => entry.type === "story" && !entry.tags.includes("play-fn"),
  );

const main = async () => {
  let index: StorybookIndex | undefined;
  for (let i = 0; i < 15; i++) {
    try {
      index = (await fetch("http://localhost:6006/index.json").then((res) =>
        res.json(),
      )) as StorybookIndex;
    } catch (e) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  if (!index) {
    throw new Error("Storybookのindex.jsonを取得できませんでした。");
  }

  const currentStories = getStoriesToTest(index);

  const storyIds = currentStories.map((entry) => entry.id);
  const newStories = storyIds.filter((id) => !stories.includes(id));

  if (newStories.length === 0) {
    console.log("新規追加されたStoryはありません。");
  } else {
    console.error(`${newStories.length}個のStoryが追加されました。`);
  }

  await fs.writeFile(
    `${__dirname}/storyIds.generated.ts`,
    [
      `/* eslint-disable */`,
      `// generateStoryIds.tsによる自動生成。`,
      `// 更新方法はREADMEを参照してください。`,
      `// 手動で更新はしないこと。`,
      `export const stories = ${JSON.stringify(storyIds, null, 2)};`,
      "",
    ].join("\n"),
  );
};

if (module === require.main) {
  void main();
}