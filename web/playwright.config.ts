import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL;
if (!baseURL) {
  throw new Error("Lance `make e2e` : ce parcours efface des données, il ne vise qu'une stack jetable (E2E_BASE_URL).");
}

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 240_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    acceptDownloads: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 1000 },
  },
});
