import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL;
if (!baseURL) {
  throw new Error("Lance `make screenshots` : les captures se prennent sur une stack jetable (E2E_BASE_URL).");
}

export default defineConfig({
  testDir: "./screenshots",
  // Même garde-fou que le parcours : refuse une stack qui contient des données.
  globalSetup: "./e2e/global-setup.ts",
  retries: 0,
  workers: 1,
  reporter: "list",
  timeout: 300_000,
  expect: { timeout: 30_000 },
  use: {
    baseURL,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  },
});
