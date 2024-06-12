import fs from "fs";
import { parse as vueParse } from "vue-eslint-parser";
import {
  Node,
  ESLintLegacySpreadProperty,
  ESLintProgram,
} from "vue-eslint-parser/ast";
import { glob } from "glob";
import yaml from "js-yaml";

const textLabels: string[] = [];

const processToken = (
  token: Node | ESLintLegacySpreadProperty,
  program: ESLintProgram,
) => {
  // const depth = new Error().stack!.split("\n").length - 2;
  // console.log(`  `.repeat(depth) + token.type);

  findTemplate(token, program);
  switch (token.type) {
    case "ArrowFunctionExpression":
    case "FunctionDeclaration":
      processToken(token.body, program);
      break;
    case "IfStatement":
      processToken(token.consequent, program);
      if (token.alternate) {
        processToken(token.alternate, program);
      }
      break;
    case "ConditionalExpression":
      processToken(token.consequent, program);
      processToken(token.alternate, program);
      break;
    case "ForStatement":
    case "ForInStatement":
    case "ForOfStatement":
      processToken(token.body, program);
      break;
    case "BlockStatement":
      for (const statement of token.body) {
        processToken(statement, program);
      }
      break;
    case "VariableDeclaration":
      for (const declaration of token.declarations) {
        if (declaration.init) {
          processToken(declaration.init, program);
        }
      }
      break;

    case "ExportNamedDeclaration":
      if (token.declaration) {
        processToken(token.declaration, program);
      }
      break;

    case "CallExpression":
      for (const arg of token.arguments) {
        processToken(arg, program);
      }
      break;
    case "ObjectExpression":
      for (const property of token.properties) {
        processToken(property, program);
      }
      break;
    case "Property":
      processToken(token.value, program);
      break;
    case "ExpressionStatement":
      processToken(token.expression, program);
      break;
  }
};

const findTemplate = (
  token: Node | ESLintLegacySpreadProperty,
  program: ESLintProgram,
) => {
  if (token.type !== "TaggedTemplateExpression") {
    return;
  }
  const tag = token.tag;
  if (tag.type !== "Identifier" || tag.name !== "t") {
    return;
  }
  const quasi = token.quasi;
  if (quasi.type !== "TemplateLiteral") {
    return;
  }

  const comments = program.comments;
  if (!comments) {
    return;
  }
  const nodes: string = quasi.quasis
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

  textLabels.push(nodes);
};

const processChild = (token: Node, program: ESLintProgram) => {
  if ("children" in token) {
    for (const child of token.children) {
      processChild(child, program);
    }
  }
  if (token.type === "VExpressionContainer") {
    if (token.expression) {
      processToken(token.expression, program);
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
      processToken(token, parsed);
    }
    if (parsed.templateBody) {
      processChild(parsed.templateBody, parsed);
    }
  }

  const existing = yaml.load(
    await fs.promises.readFile("./src/domain/i18n/en.yml", "utf-8"),
  ) as Record<string, string>;
  const translations = textLabels
    .map((text) => {
      return `${JSON.stringify(text)}: ${existing[text] ? JSON.stringify(existing[text]) : null}`;
    })
    .join("\n");

  await fs.promises.writeFile("./src/domain/i18n/en.yml", translations);

  console.log(`${textLabels.length} 個のテキストを抽出しました`);
})();
