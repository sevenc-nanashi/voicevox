import { expect, test } from "vitest";
import { translate } from "@/domain/i18n/t";

const createTranslator =
  (translations: Record<string, string> | undefined) =>
  (strings: TemplateStringsArray, ...values: Record<string, string>[]) => {
    return translate({ scope: undefined, strings, values, translations });
  };
const createScopedTranslator =
  (translations: Record<string, string> | undefined) =>
  (scope: string) =>
  (strings: TemplateStringsArray, ...values: Record<string, string>[]) => {
    return translate({ scope, strings, values, translations });
  };

test("翻訳できる", () => {
  const t = createTranslator({
    ほげふが: "hogefuga",
  });
  expect(t`ほげふが`).toBe("hogefuga");
});

test("翻訳が無い時はデフォルトの動作をする", () => {
  const piyo = "piyoValue";
  const t = createTranslator(undefined);
  expect(t`ほげふが ${{ piyo }}`).toBe("ほげふが piyoValue");
});

test("変数を埋め込める", () => {
  const piyo = "piyoValue";
  const t = createTranslator({
    "ほげふが {piyo}": "hogefuga {piyo}",
  });
  expect(t`ほげふが ${{ piyo }}`).toBe("hogefuga piyoValue");
});

test("複数回同じ変数を埋め込める", () => {
  const piyo = "piyoValue";
  const t = createTranslator({
    "ほげふが {piyo}": "hogefuga {piyo} {piyo}",
  });
  expect(t`ほげふが ${{ piyo }}`).toBe("hogefuga piyoValue piyoValue");
});

test("変数の順序を変えられる", () => {
  const foo = "fooValue";
  const bar = "barValue";
  const t = createTranslator({
    "{foo} {bar}": "{bar} {foo}",
  });
  expect(t`${{ foo }} ${{ bar }}`).toBe("barValue fooValue");
});

test("スコープを指定できる", () => {
  const foo = "fooValue";
  const bar = "barValue";
  const st = createScopedTranslator({
    "{foo} {bar}": "Unreachable",
    "other-scope:{foo} {bar}": "Unreachable",
    "scope2:{foo} {bar}": "Unreachable",
    "scope:{foo} {bar}": "scope:{bar} {foo}",
  });
  expect(st("scope")`${{ foo }} ${{ bar }}`).toBe("barValue fooValue");
});
