import enTranslations from "./en.yml";

const escapeRegExp = (str: string) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const defaultTemplate = (strings: TemplateStringsArray, values: unknown[]) => {
  return strings.reduce((acc, str, i) => {
    if (i === 0) {
      return `${acc}${str}`;
    }
    return `${acc}${String(values[i - 1])}${str}`;
  }, "");
};

/**
 * 翻訳する。
 *
 * Tagged Functionなので、t`Hello, ${name}`のように使う。
 */
export const t = (strings: TemplateStringsArray, ...values: unknown[]) => {
  return translate({
    scope: undefined,
    strings,
    values,
    translations: enTranslations,
  });
};

/**
 * スコープを指定して翻訳する。
 *
 * Tagged Functionなので、st("hoge")`Hello, ${name}`のように使う。
 */
export const st =
  (scope: string) =>
  (strings: TemplateStringsArray, ...values: unknown[]) =>
    translate({ scope, strings, values, translations: enTranslations });
/** @private テスト用にエクスポート。*/
export const translate = ({
  scope,
  strings,
  values,
  translations,
}: {
  scope: string | undefined;
  strings: TemplateStringsArray;
  values: unknown[];
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
        return `${acc}\\{(.+?)\\}${escapeRegExp(str)}`;
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

  const placeholders = key.match(keyPattern)?.slice(1);
  if (!placeholders) {
    throw new Error("Unexpected error");
  }

  const mapped = placeholders.reduce((acc, placeholder, i) => {
    return acc.replaceAll(`{${placeholder}}`, String(values[i]));
  }, translation);

  return mapped;
};
