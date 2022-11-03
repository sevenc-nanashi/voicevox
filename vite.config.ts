import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tsconfigPaths from "vite-tsconfig-paths";
import electron from "vite-electron-plugin";
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
      include: ["src/background.ts"],
      outDir: "dist_electron",
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
