import { cpus } from "node:os";
import { defineConfig, devices } from "@playwright/test";
import { applyE2ETier3FixtureAliases } from "./scripts/e2e/sdd-0168-fixture";

/**
 * Playwright config para tests E2E.
 *
 * - `testDir` apunta a `e2e/` (separado de `__tests__/` que usa Vitest).
 * - `webServer` levanta `next dev` automáticamente antes de los tests
 *   (puerto 3001 para no chocar con el dev server normal en 3000).
 * - `BASE_URL` controla el destino. `E2E_START_WEB_SERVER` permite decidir el
 *   arranque por separado cuando el destino debe declararse explícitamente.
 */
// Puerto configurable vía `E2E_PORT` (default 3001). El gate del harness
// (scripts/verify.mjs) le pasa un puerto propio para no reusar un `next dev` de
// otra ventana en 3001 y terminar testeando el código equivocado (modelo
// multi-ventana). Por compatibilidad, un `BASE_URL` explícito sigue describiendo
// un server ya levantado; `E2E_START_WEB_SERVER=1` desacopla ambas decisiones y
// permite que Playwright levante Next usando ese destino explícito.
type PlaywrightRuntimeEnvironment = Record<string, string | undefined> & {
  BASE_URL?: string;
  CI?: string;
  E2E_ENVIRONMENT_KIND?: string;
  E2E_PORT?: string;
  E2E_START_WEB_SERVER?: string;
  E2E_WORKERS?: string;
};

/** Techo de la corrida local general; nunca se abren más workers que esto. */
export const E2E_LOCAL_WORKERS_CAP = 8;

export function resolvePlaywrightWorkers(
  env: PlaywrightRuntimeEnvironment = process.env,
  cpuCount: number = cpus().length,
): number {
  const configured = env.E2E_WORKERS?.trim();
  if (configured === undefined || configured === "") {
    if (env.CI || env.E2E_ENVIRONMENT_KIND?.trim() === "ephemeral") return 1;
    // Local sin override: mitad de los núcleos lógicos, con tope de ocho.
    // Un 8 fijo no era relativo a nada. Playwright resuelve `workers: "50%"`
    // por defecto (`playwright/lib/common/index.js:587` →
    // `resolveWorkers`, 678-682 = `max(1, floor(cpus * 0.5))`), así que en un
    // equipo de cuatro núcleos el 8 SUBÍA la concurrencia de 2 a 8: lo
    // contrario de acotar la contención que motivó este SDD. Con esta fórmula
    // el harness nunca pide más que ese default histórico ni más de ocho.
    const cores =
      Number.isFinite(cpuCount) && cpuCount >= 1 ? Math.floor(cpuCount) : 1;
    return Math.min(E2E_LOCAL_WORKERS_CAP, Math.max(1, Math.floor(cores / 2)));
  }

  if (!/^\d+$/.test(configured)) {
    throw new Error("E2E_WORKERS debe ser un entero entre 1 y 32.");
  }
  const workers = Number(configured);
  if (workers < 1 || workers > 32) {
    throw new Error("E2E_WORKERS debe estar entre 1 y 32.");
  }
  return workers;
}

/**
 * WebKit móvil se serializa en Windows: su cierre deja el worker colgado y el
 * gate no termina. El límite es por proyecto, no global, así que `chromium` y
 * `mobile-chrome` conservan la concurrencia resuelta arriba.
 *
 * El contrato existe y el motor lo honra (verificado contra el Playwright 1.60
 * instalado): `TestProject.workers?: number|string` en
 * `playwright/types/test.d.ts:744`; `playwright/lib/runner/index.js:5071-5072`
 * registra `_workerLimitPerProjectId` con `project.workers` y la línea 6062 lo
 * aplica al calcular los trabajadores reales
 * (`Math.min(project.workers ?? Number.MAX_SAFE_INTEGER, testGroups.length)`).
 */
export function resolveWebkitProjectWorkers(
  platform: NodeJS.Platform = process.platform,
): 1 | undefined {
  return platform === "win32" ? 1 : undefined;
}

export function resolvePlaywrightRuntime(
  env: PlaywrightRuntimeEnvironment = process.env,
) {
  const port = Number(env.E2E_PORT ?? 3001);
  const baseURL = env.BASE_URL ?? `http://localhost:${port}`;
  const startWebServer =
    env.E2E_START_WEB_SERVER === "1" ||
    (env.E2E_START_WEB_SERVER === undefined && !env.BASE_URL);

  return { port, baseURL, startWebServer };
}

export function preparePlaywrightRuntime(
  env: PlaywrightRuntimeEnvironment = process.env,
) {
  applyE2ETier3FixtureAliases(env);
  return resolvePlaywrightRuntime(env);
}

const {
  port: PORT,
  baseURL: BASE_URL,
  startWebServer: START_WEB_SERVER,
} = preparePlaywrightRuntime();
const WORKERS = resolvePlaywrightWorkers();

export default defineConfig({
  testDir: "./e2e",
  // El primer acceso compila rutas distintas en paralelo. En worktrees que
  // comparten node_modules, Webpack puede superar 30 s bajo carga fría aunque
  // el mismo contrato pase inmediatamente después; el margen no relaja las
  // aserciones ni sus timeouts particulares.
  timeout: 60_000,
  fullyParallel: true,
  // Un branch efímero comparte Auth, PostgREST y fixtures mutables: en ese
  // entorno el harness es una verificación funcional, no una prueba de carga.
  // Fuera de CI/efímero la concurrencia es relativa a la máquina con tope de
  // ocho, y E2E_WORKERS permite fijarla de forma explícita.
  workers: WORKERS,
  forbidOnly: !!process.env.CI,
  // Local con 1 reintento, no 0. Suena al revés —"si falla, que falle"— pero el
  // que corre el gate acá es un equipo con ~38 worktrees vivos, bastante MÁS
  // contendido que CI, y sin reintentos la contención se ve idéntica a una
  // regresión.
  //
  // Medido el 2026-08-05: cinco corridas seguidas del mismo árbol, sin cambiar
  // una línea, fallaron un conjunto DISTINTO cada vez (cbm-ayuda, /tarifas,
  // global-search, redirects 301) repartido entre los tres navegadores. Los
  // mismos tests pasan 3/3 en aislamiento. Eso no es información: es ruido que
  // enseña a ignorar el rojo — y así fue exactamente como se perdió la 0228.
  //
  // El reintento NO tapa un test roto: uno roto de verdad falla las dos veces.
  // Y Playwright reporta aparte los que pasaron al reintentar ("flaky"), así que
  // la inestabilidad sigue siendo visible en vez de desaparecer.
  retries: process.env.CI ? 2 : 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 14"] },
      // WebKit en Windows se serializa para evitar cierres colgados del worker.
      workers: resolveWebkitProjectWorkers(),
    },
  ],
  // El destino y el arranque son decisiones distintas. Sin override se conserva
  // la compatibilidad histórica: BASE_URL describe un server externo/existente.
  webServer: START_WEB_SERVER
    ? {
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
      }
    : undefined,
});
