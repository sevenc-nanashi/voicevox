import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tsconfigPaths from "vite-tsconfig-paths";
import electron from "@sevenc-nanashi/vite-plugin-electron";
import path from "path";
import inject from "@rollup/plugin-inject";
import stdLibBrowser from "node-stdlib-browser";

// https://vitejs.dev/config/
export default defineConfig({
  root: `./src`,
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
        resolve: {
          alias: {
            "@": path.resolve(__dirname, "./src"),
          },
        },
      },
    }),
    // @ts-expect-error 何故かエラーを吐く
    inject({
      Buffer: [
        require.resolve("node-stdlib-browser/helpers/esbuild/shim"),
        "Buffer",
      ],
    }),
  ],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      ...stdLibBrowser,
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
  },
});
