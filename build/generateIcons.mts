/**
 * アイコン生成のスクリプト。
 */

import fs from "fs/promises";
import path from "path";
import paper from "paper";
import { PaperOffset } from "paperjs-offset";
import { runCommand, __dirname } from "./utils.mjs";

// 生成するアイコンのレシピ一覧。
// ファイル名: [ベースアイコン, 右下のアイコン]で指定する。
const recipes: Record<string, [string, string]> = {
  saveVoice: ["save", "volume_up"],
};

const clean = (item: paper.Item, color: paper.Color) => {
  const size = Math.max(item.bounds.width, item.bounds.height);
  for (const child of item.children) {
    if (child.bounds.width >= size || child.bounds.height >= size) {
      // child.remove();
      continue;
    }
    child.fillColor = color;
  }
};

const icons: string[] = [];

const findIcon = async (name: string) => {
  const iconPath = path.resolve(
    __dirname,
    "./vendored/material-design-icons",
    "src"
  );
  const dirs = await fs.readdir(iconPath);
  for (const dir of dirs) {
    const p = path.resolve(
      iconPath,
      dir,
      name,
      "materialiconsoutlined",
      "24px.svg"
    );
    if (await fs.stat(p).catch(() => false)) {
      return p;
    }
  }
};
const size = 512;
const subIconScale = 0.5;
paper.setup(new paper.Size(size, size));

const main = async () => {
  if (
    !(await fs
      .stat(path.resolve(__dirname, "./vendored/material-design-icons"))
      .catch(() => false))
  ) {
    // とんでもなく重いので最小限だけcloneする
    const mdi = path.resolve(__dirname, "./vendored/material-design-icons");
    await runCommand(
      "git",
      "clone",
      "https://github.com/google/material-design-icons",
      "--sparse",
      "--filter=blob:none",
      "--depth",
      "1",
      mdi
    );
    await runCommand("git", "-C", mdi, "sparse-checkout", "add", "src");
  }

  for (const [name, [baseIcon, subIcon]] of Object.entries(recipes)) {
    console.log(`${name} : ${baseIcon} + ${subIcon}`);
    const layer = new paper.Layer({ insert: false });
    const svgPath = await findIcon(baseIcon);
    if (!svgPath) {
      throw new Error(`${baseIcon} が見つかりませんでした`);
    }

    const baseSvg = layer.importSVG(await fs.readFile(svgPath, "utf-8"));
    baseSvg.fitBounds(new paper.Rectangle(0, 0, size, size));
    baseSvg.strokeColor = null;
    clean(baseSvg, new paper.Color("#000000"));
    const subSvgPath = await findIcon(subIcon);
    if (!subSvgPath) {
      throw new Error(`${subIcon} が見つかりませんでした`);
    }
    const subSvg = layer.importSVG(await fs.readFile(subSvgPath, "utf-8"));
    subSvg.fitBounds(
      new paper.Rectangle(
        size * (1 - subIconScale),
        size * (1 - subIconScale),
        size * subIconScale,
        size * subIconScale
      )
    );
    clean(subSvg, new paper.Color("#000000"));

    const thickSubSvg = subSvg.clone();
    for (const child of [...thickSubSvg.children]) {
      if (child.className.includes("Path")) {
        const newPath = PaperOffset.offset(child as paper.Path, -2, {
          cap: "round",
        });
        child.remove();
        thickSubSvg.addChild(newPath);
      }
    }
    const corner = new paper.Path.Rectangle(
      new paper.Rectangle(
        size * (1 - subIconScale),
        size * (1 - subIconScale),
        size * subIconScale,
        size * subIconScale
      )
    );

    for (const child of [...baseSvg.children]) {
      if (child.className.includes("Path")) {
        const subtracted = (child as paper.Path).subtract(corner, {
          insert: false,
        });
        child.remove();
        baseSvg.addChild(subtracted);
      }
    }
    paper.project.clear();
    paper.project.activeLayer.addChild(baseSvg);
    paper.project.activeLayer.addChild(thickSubSvg);
    const svg = paper.project.exportSVG({ asString: true });
    if (typeof svg !== "string") {
      throw new Error("SVGの生成に失敗しました");
    }

    icons.push(
      svg
        .replace(/#000000/g, "currentColor")
        .replace(
          /<svg[^>]+>/,
          `<symbol id="${name}" viewBox="0 0 ${size} ${size}">`
        )
        .replace("</svg>", "</symbol>")
    );
  }

  console.log("-> public/icons.svg");
  await fs.writeFile(
    path.resolve(__dirname, "../public/icons.svg"),
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${icons.join(
      ""
    )}</svg>`
  );
};

main();
