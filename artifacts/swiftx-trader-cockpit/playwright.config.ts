import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command:
      "PORT=4173 BASE_PATH=/ pnpm --filter @workspace/swiftx run dev",
    url: "http://127.0.0.1:4173/p2p/",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});