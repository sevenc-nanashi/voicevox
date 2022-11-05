import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tsconfigPaths from "vite-tsconfig-paths";
import electron from "vite-plugin-electron";
import path from "path";
import inject from "@rollup/plugin-inject";

// https://vitejs.dev/config/
export default defineConfig(async () => {
  const { default: stdLibBrowser } = await import("node-stdlib-browser");
  return {
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
      {
        ...inject({
          Buffer: [
            require.resolve("node-stdlib-browser/helpers/esbuild/shim"),
            "Buffer",
          ],
        }),
      },
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
  };
});
