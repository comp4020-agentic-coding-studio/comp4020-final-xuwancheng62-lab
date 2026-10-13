import { defineConfig } from "vitest/config";

// Exercise the same app handlers without starting a localhost listener.
export default defineConfig({ test: {
  env: { PLAYTEST_INSTANT_EXPLORATION: "0" },
  include: ["spec/**/*.test.ts"],
  globalSetup: ["./spec/in-process-global.ts"],
  setupFiles: ["./spec/in-process-setup.ts"],
  fileParallelism: false,
} });
