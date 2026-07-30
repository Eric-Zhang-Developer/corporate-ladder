import { defineConfig } from "vitest/config";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  // Single self-contained index.html: inline module scripts run from
  // file://, so the playtest zip is double-clickable.
  base: "./",
  plugins: [viteSingleFile()],
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
