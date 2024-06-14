import { expect, test } from "vitest";
import { translate } from "@/domain/i18n/t";

const createTranslator =
  (translations: Record<string, string> | undefined) =>
  (strings: TemplateStringsArray, ...values: unknown[]) => {
    return translate({ scope: undefined, strings, values, translations });
  };

test("翻訳できる", () => {
  const t = createTranslator({
    ほげふが: "hogefuga",
  });
  expect(t`ほげふが`).toBe("hogefuga");
});

test("翻訳が無い時はデフォルトの動作をする", () => {
  const piyo = "piyo";
  const t = createTranslator(undefined);
  expect(t`ほげふが ${piyo}`).toBe("ほげふが piyo");
});

test("変数を埋め込める", () => {
  const piyo = "piyo";
  const t = createTranslator({
    "ほげふが {var}": "hogefuga {var}",
  });
  expect(t`ほげふが ${piyo}`).toBe("hogefuga piyo");
});

test("複数回同じ変数を埋め込める", () => {
  const piyo = "piyo";
  const t = createTranslator({
    "ほげふが {var}": "hogefuga {var} {var}",
  });
  expect(t`ほげふが ${piyo}`).toBe("hogefuga piyo piyo");
});

test("変数の順序を変えられる", () => {
  const foo = "foo";
  const bar = "bar";
  const t = createTranslator({
    "{1} {0}": "{0} {1}",
  });
  expect(t`${foo} ${bar}`).toBe("bar foo");
});
