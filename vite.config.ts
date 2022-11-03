import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tsconfigPaths from "vite-tsconfig-paths";
import electron from "vite-plugin-electron";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  root: `src`,
  publicDir: `../public`,
  build: {
    outDir: `../dist`,
  },
  plugins: [
    vue(),
    tsconfigPaths(),
    electron({
      entry: {
        background: "background.ts",
        "electron/preload": "electron/preload.ts",
      },
      vite: {
        root: `src`,
        build: {
          outDir: "../dist",
        },
      },
    }),
  ],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
