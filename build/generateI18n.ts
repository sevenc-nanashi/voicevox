import fs from "fs";
import { parse as vueParse } from "vue-eslint-parser";
import {
  Node,
  ESLintLegacySpreadProperty,
  ESLintProgram,
  ESLintStringLiteral,
} from "vue-eslint-parser/ast";
import { glob } from "glob";
import yaml from "js-yaml";

const textLabels: {
  scope: string | undefined;
  text: string;
  filePath: string;
}[] = [];

type Context = { program: ESLintProgram; filePath: string };

const processedTokens = new WeakSet<Node | ESLintLegacySpreadProperty>();
const isChild = (token: unknown): token is Node => {
  return !!token && typeof token === "object" && "type" in token;
};
const processToken = (
  token: Node | ESLintLegacySpreadProperty,
  context: Context,
) => {
  // const depth = new Error().stack!.split("\n").length - 2;
  // console.log(`  `.repeat(depth) + token.type);
  if (processedTokens.has(token)) {
    return;
  }
  processedTokens.add(token);

  findTemplate(token, context);
  for (const key in token) {
    const value = token[key];
    // 属性のそれっぽいものを再帰的に探す
    if (["parent"].includes(key)) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const child of value) {
        if (isChild(child)) {
          processToken(child, context);
        }
      }
    } else if (isChild(value)) {
      processToken(value, context);
    }
  }
};

const findTemplate = (
  token: Node | ESLintLegacySpreadProperty,
  context: Context,
) => {
  if (token.type !== "TaggedTemplateExpression") {
    return;
  }
  const tag = token.tag;
  const isSingleTranslate = tag.type === "Identifier" && tag.name === "t";
  const isScopedTranslate =
    tag.type === "CallExpression" &&
    tag.callee.type === "Identifier" &&
    tag.callee.name === "st" &&
    tag.arguments.length === 1 &&
    tag.arguments[0].type === "Literal";

  if (!isSingleTranslate && !isScopedTranslate) {
    return;
  }
  let scope: string | undefined;
  if (isScopedTranslate) {
    scope = (tag.arguments[0] as ESLintStringLiteral).value;
  }
  const quasi = token.quasi;
  if (quasi.type !== "TemplateLiteral") {
    return;
  }

  const comments = context.program.comments;
  if (!comments) {
    return;
  }
  const text: string = quasi.quasis
    .flatMap((element, i) => {
      if (i === quasi.quasis.length - 1) {
        const strPart = element.value.cooked;
        if (strPart == null) {
          console.warn("No string found for", element);
          return [];
        }
        return [strPart];
      }
      const inner = quasi.expressions[i];

      const comment = comments.find(
        (comment) =>
          element.range[1] <= comment.range[0] &&
          comment.range[1] <= inner.range[0],
      );
      let name = "";
      if (comment) {
        name = comment.value.trim();
      } else {
        if (inner.type === "Identifier") {
          name = inner.name;
        } else {
          console.warn("No comment found for", element, inner);
        }
      }
      const strPart = element.value.cooked;
      if (strPart == null) {
        console.warn("No string found for", element);
        return [];
      }
      return [strPart, `{${name}}`];
    })
    .join("");

  textLabels.push({ scope, text, filePath: context.filePath });
};

const processChild = (token: Node, context: Context) => {
  if ("children" in token) {
    for (const child of token.children) {
      processChild(child, context);
    }
  }
  if (token.type === "VExpressionContainer") {
    if (token.expression) {
      processToken(token.expression, context);
    }
  }
  if (token.type === "VElement") {
    for (const attribute of token.startTag.attributes) {
      if (
        attribute.directive &&
        attribute.value &&
        attribute.value.expression
      ) {
        processToken(attribute.value.expression, context);
      }
    }
  }
};

(async () => {
  // const vues = await glob("./src/components/Talk/TalkEditor.vue", {});
  const vues = await glob("./src/**/*.{vue,ts}", {});
  for (const vue of vues) {
    const parsed = vueParse(await fs.promises.readFile(vue, "utf-8"), {
      sourceType: "module",
      parser: "@typescript-eslint/parser",
    });

    for (const token of parsed.body) {
      processToken(token, { program: parsed, filePath: vue });
    }
    if (parsed.templateBody) {
      processChild(parsed.templateBody, { program: parsed, filePath: vue });
    }
  }

  const existing = yaml.load(
    await fs.promises.readFile("./src/domain/i18n/en.yml", "utf-8"),
  ) as Record<string, string>;
  const keys = [
    ...new Set(
      textLabels.map((label) =>
        label.scope ? `${label.scope}:${label.text}` : label.text,
      ),
    ),
  ];
  const translations = keys.reduce(
    (acc, key) => {
      return {
        ...acc,
        [key]: existing[key] || null,
      };
    },
    {} as Record<string, string | null>,
  );

  await fs.promises.writeFile(
    "./src/domain/i18n/en.yml",
    yaml.dump(translations),
  );

  console.log(`${textLabels.length} 個のテキストを抽出しました`);
})();
