import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config para tests E2E.
 *
 * - `testDir` apunta a `e2e/` (separado de `__tests__/` que usa Vitest).
 * - `webServer` levanta `next dev` automáticamente antes de los tests
 *   (puerto 3001 para no chocar con el dev server normal en 3000).
 * - `BASE_URL` env var permite correr contra prod/staging sin levantar dev.
 */
const PORT = 3001;
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Mobile/webkit deshabilitados — para activar:
    //   npx playwright install webkit
    //   y descomentar:
    // { name: "mobile-safari", use: { ...devices["iPhone 14"] } },
  ],
  // Solo levantamos dev server si NO se pasó BASE_URL custom.
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `next dev --port ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
