const translations = {
  "${0}番ポートが使用中であるため ${1} は、${2}番ポートで起動しました":
    "${1} is running on port ${2} because port ${0} is already in use",
};

export const t = (strings: TemplateStringsArray, ...values: unknown[]) => {
  const templateName = strings.reduce((acc, str, i) => {
    return `${acc}{${i}}${str}`;
  }, "");
  if (!(templateName in translations)) {
    console.warn(`Translation not found for: ${templateName}`);
    return templateName;
  }

  return translations[templateName as keyof typeof translations].replace(
    /{(\d+)}/g,
    (_, index) => {
      return String(values[index]);
    },
  );
};
