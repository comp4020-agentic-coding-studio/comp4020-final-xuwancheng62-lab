import { defineConfig } from "vitest/config";

// Every test in spec/ runs against the running app, which spec/global-setup.ts
// finds. Only spec/ runs: a test anywhere else needs adding to `include`.
export default defineConfig({
  test: {
    // Existing timing regressions exercise normal waits; instant mode has its own HTTP test.
    env: { PLAYTEST_INSTANT_EXPLORATION: "0" },
    include: ["spec/**/*.test.ts"],
    globalSetup: ["./spec/global-setup.ts"],
  },
});
