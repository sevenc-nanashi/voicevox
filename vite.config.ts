import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tsconfigPaths from "vite-tsconfig-paths";
import electron from "vite-plugin-electron";
import path from "path";
import inject from "@rollup/plugin-inject";
import stdLibBrowser from "node-stdlib-browser";

import treeKill from "tree-kill";

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
      },
      onstart: (options: { startup: (args: string[]) => void }) => {
        // @ts-expect-error vite-plugin-electronが追加する
        const pid = process.electronApp?.pid;
        if (pid) {
          treeKill(pid, "SIGINT");
        }
        options.startup([".", "--no-sandbox"]);
      },
    }),
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
