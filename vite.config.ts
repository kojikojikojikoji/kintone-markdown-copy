import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

type EntryName = "desktop" | "mobile" | "config";

const entries: Record<EntryName, { input: string; name: string; file: string }> = {
  desktop: { input: "src/desktop/index.ts", name: "KpMdCopyDesktop", file: "desktop.js" },
  mobile: { input: "src/mobile/index.ts", name: "KpMdCopyMobile", file: "mobile.js" },
  config: { input: "src/config/index.ts", name: "KpMdCopyConfig", file: "config.js" },
};

const entry = (process.env.ENTRY as EntryName) || "desktop";
const target = entries[entry];

export default defineConfig({
  build: {
    outDir: "dist",
    // Only the first entry clears dist so the three IIFE bundles accumulate.
    emptyOutDir: entry === "desktop",
    minify: true,
    lib: {
      entry: resolve(__dirname, target.input),
      name: target.name,
      formats: ["iife"],
      fileName: () => target.file,
    },
    rollupOptions: {
      output: { extend: true },
    },
  },
  test: {
    environment: "jsdom",
    include: ["test/core/**/*.test.ts"],
    coverage: {
      include: ["src/core/**"],
    },
  },
});
