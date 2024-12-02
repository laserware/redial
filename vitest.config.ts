import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    coverage: {
      provider: "istanbul",
      reporter: ["lcov"],
      include: ["src/**/*.ts"],
      clean: false,
    },
  },
});
