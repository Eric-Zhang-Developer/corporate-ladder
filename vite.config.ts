import { defineConfig } from "vitest/config";
import { viteSingleFile } from "vite-plugin-singlefile";

/**
 * Two build targets:
 *   vite build                   → hashed asset filenames, for web deploys.
 *                                  Immutable assets cache forever; only the
 *                                  small HTML revalidates, so nobody plays a
 *                                  stale build.
 *   vite build --mode singlefile → everything inlined into one index.html,
 *                                  for the zip. Chrome blocks external module
 *                                  scripts on file://, so a zipped multi-file
 *                                  build would not run by double-click.
 *
 * base "./" keeps asset paths relative, so the same output works at a
 * subpath (GitHub Pages) or from the filesystem.
 */
export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: mode === "singlefile" ? [viteSingleFile()] : [],
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
}));
