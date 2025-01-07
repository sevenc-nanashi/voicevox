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

type Context = {
  program: ESLintProgram;
  filePath: string;
  fullContent: string;
};

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
  for (const [key, value] of Object.entries(token)) {
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

  const text: string = quasi.quasis
    .flatMap((element, i) => {
      const lineNumber = context.fullContent
        .slice(0, element.range[0])
        .split("\n").length;

      if (i === quasi.quasis.length - 1) {
        const strPart = element.value.cooked;
        if (strPart == null) {
          console.warn(
            `[${context.filePath}:${lineNumber}] No string found for`,
            element,
          );
          return [];
        }
        return [strPart];
      }
      const inner = quasi.expressions[i];

      if (inner.type !== "ObjectExpression") {
        console.warn(
          `[${context.filePath}:${lineNumber}] Expected ObjectExpression, but found ${inner.type}`,
        );
        return [];
      }
      if (inner.properties.length !== 1) {
        console.warn(
          `[${context.filePath}:${lineNumber}] Expected 1 property, but found ${inner.properties.length}`,
        );
        return [];
      }
      const property = inner.properties[0];
      if (property.type !== "Property") {
        console.warn(
          `[${context.filePath}:${lineNumber}] Expected Property, but found ${property.type}`,
        );
        return [];
      }
      if (property.key.type !== "Identifier") {
        console.warn(
          `[${context.filePath}:${lineNumber}] Expected Identifier, but found ${property.key.type}`,
        );
        return [];
      }
      const name = property.key.name;
      const strPart = element.value.cooked;
      if (strPart == null) {
        console.warn(
          `[${context.filePath}:${lineNumber}] No string found for`,
          element,
        );
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

// const vues = await glob("./src/components/Talk/TalkEditor.vue", {});
const files = await glob("./src/**/*.{vue,ts}", {});
console.log(`${files.length} 個のファイルをチェック中...`);
for (const [i, filePath] of files.entries()) {
  if (process.stdout.isTTY) {
    process.stdout.write(`\r\x1b[K[${i + 1}/${files.length}] ${filePath}`);
  } else {
    console.log(filePath);
  }
  const content = await fs.promises.readFile(filePath, "utf-8");
  const parsed = vueParse(content, {
    sourceType: "module",
    parser: "@typescript-eslint/parser",
  });

  for (const token of parsed.body) {
    processToken(token, {
      program: parsed,
      filePath: filePath,
      fullContent: content,
    });
  }
  if (parsed.templateBody) {
    processChild(parsed.templateBody, {
      program: parsed,
      filePath: filePath,
      fullContent: content,
    });
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

if (process.stdout.isTTY) {
  process.stdout.write("\n");
}
console.log(`${textLabels.length} 個のテキストを抽出しました`);
