import { defineConfig } from "vize";

export default defineConfig(() => ({
  compiler: {
    templateSyntax: "quirks",
    vapor: false,
  },
}));
