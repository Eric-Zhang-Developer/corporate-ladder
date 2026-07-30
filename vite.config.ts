import { defineConfig } from "vitest/config";

export default defineConfig({
  // Relative asset paths so a zipped dist/ runs straight from file://
  base: "./",
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
