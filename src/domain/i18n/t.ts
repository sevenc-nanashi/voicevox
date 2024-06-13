import enTranslations from "./en.yml";

const lang = "en" as "ja" | "en";

export const t = (strings: TemplateStringsArray, ...values: unknown[]) => {
  if (lang === "ja") {
    return strings.reduce((acc, str, i) => {
      if (i === 0) {
        return `${acc}${str}`;
      }
      return `${acc}{${String(values[i])}}${str}`;
    }, "");
  }
  const translationKeys = Object.keys(enTranslations);
  const keyPattern = new RegExp(
    strings.reduce((acc, str, i) => {
      if (i === 0) {
        return `${acc}${str}`;
      }
      return `${acc}\\{(.+)\\}${str}`;
    }, "^") + "$",
  );

  const key = translationKeys.find((key) => keyPattern.test(key));
  if (!key) {
    console.warn(`Translation not found for: ${keyPattern}`);
    return strings.reduce((acc, str, i) => {
      if (i === 0) {
        return `${acc}${str}`;
      }
      return `${acc}{${String(values[i])}}${str}`;
    }, "");
  }
  const placeholders = key.match(keyPattern)?.slice(1);
  if (!placeholders) {
    throw new Error("Unexpected error");
  }

  const mapped = placeholders.reduce((acc, placeholder, i) => {
    return acc.replaceAll(`{${placeholder}}`, String(values[i]));
  }, enTranslations[key]);

  return mapped;
};
