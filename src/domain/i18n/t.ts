import enTranslations from "./en.yml";

const escapeRegExp = (str: string) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const defaultTemplate = (
  strings: TemplateStringsArray,
  values: Record<string, string>[],
) => {
  return strings.reduce((acc, str, i) => {
    if (i === 0) {
      return `${acc}${str}`;
    }
    return `${acc}${String(Object.values(values[i - 1])[0])}${str}`;
  }, "");
};

type Language = "ja" | "en";
let language: Language = "ja";
const trsnslationMap: Record<Language, Record<string, string>> = {
  ja: {},
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  en: enTranslations,
};
if (typeof location !== "undefined" && typeof location.search === "string") {
  const searchParams = new URLSearchParams(location.search);
  const lang = searchParams.get("lang");
  if (lang === "en") {
    language = "en";
  }
}

/**
 * 翻訳する。
 *
 * Tagged Functionなので、t`Hello, ${name}`のように使う。
 */
export const t = (
  strings: TemplateStringsArray,
  ...values: Record<string, string>[]
) => {
  return translate({
    scope: undefined,
    strings,
    values,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    translations: trsnslationMap[language],
  });
};

/**
 * スコープを指定して翻訳する。
 *
 * Tagged Functionなので、st("hoge")`Hello, ${name}`のように使う。
 */
export const st =
  (scope: string) =>
  (strings: TemplateStringsArray, ...values: Record<string, string>[]) =>
    translate({
      scope,
      strings,
      values,
      translations: trsnslationMap[language],
    });
/** @private テスト用にエクスポート。*/
export const translate = ({
  scope,
  strings,
  values,
  translations,
}: {
  scope: string | undefined;
  strings: TemplateStringsArray;
  values: Record<string, string>[];
  translations?: Record<string, string>;
}) => {
  if (!translations) {
    return defaultTemplate(strings, values);
  }
  const translationKeys = Object.keys(translations);
  const keyPattern = new RegExp(
    strings.reduce(
      (acc, str, i) => {
        if (i === 0) {
          return `${acc}${escapeRegExp(str)}`;
        }
        return `${acc}\\{${escapeRegExp(
          Object.keys(values[i - 1])[0],
        )}\\}${escapeRegExp(str)}`;
      },
      scope ? `^${escapeRegExp(scope)}:` : `^`,
    ) + "$",
  );

  const key = translationKeys.find((key) => keyPattern.test(key));
  if (!key) {
    console.warn(`Translation not found for: ${keyPattern}`);
    return defaultTemplate(strings, values);
  }
  const translation = translations[key];
  if (!translation) {
    console.warn(`Untranslated key: ${key}`);
    return defaultTemplate(strings, values);
  }

  let mapped = translation;
  if (scope) {
    mapped = mapped.replace(`${scope}:`, "");
  }
  for (const valueWithKey of values) {
    const [key, value] = Object.entries(valueWithKey)[0];
    mapped = mapped.replace(new RegExp(`{${key}}`, "g"), value);
  }

  return mapped;
};
