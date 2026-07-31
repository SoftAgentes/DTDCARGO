import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config para tests E2E.
 *
 * - `testDir` apunta a `e2e/` (separado de `__tests__/` que usa Vitest).
 * - `webServer` levanta `next dev` automáticamente antes de los tests
 *   (puerto 3001 para no chocar con el dev server normal en 3000).
 * - `BASE_URL` env var permite correr contra prod/staging sin levantar dev.
 */
// Puerto configurable vía `E2E_PORT` (default 3001). El gate del harness
// (scripts/verify.mjs) le pasa un puerto propio para no reusar un `next dev` de
// otra ventana en 3001 y terminar testeando el código equivocado (modelo
// multi-ventana). `BASE_URL` sigue teniendo prioridad para correr contra un
// server ya levantado (prod/staging o el dev local) sin arrancar uno nuevo.
const PORT = Number(process.env.E2E_PORT ?? 3001);
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // El primer acceso compila rutas distintas en paralelo. En worktrees que
  // comparten node_modules, Webpack puede superar 30 s bajo carga fría aunque
  // el mismo contrato pase inmediatamente después; el margen no relaja las
  // aserciones ni sus timeouts particulares.
  timeout: 60_000,
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
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 14"] } },
  ],
  // Solo levantamos dev server si NO se pasó BASE_URL custom.
  webServer: process.env.BASE_URL
    ? undefined
    : {
        // Invocar el entry JS con `node` directo (no `next` a secas): en este
        // entorno pnpm no linkea los .bin (ERR_PNPM_IGNORED_BUILDS) y `next` no
        // queda en el PATH del shell del webServer → "next no se reconoce".
        // Mismo patrón que scripts/verify.mjs.
        // `node_modules` puede ser un junction compartido entre worktrees.
        // Turbopack rechaza ese destino fuera de la raíz del checkout; Webpack
        // conserva el aislamiento del servidor y permite ejecutar el gate.
        command: `node node_modules/next/dist/bin/next dev --webpack --port ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
