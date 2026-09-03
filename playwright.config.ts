import { defineConfig, devices } from "@playwright/test";
import {
  applyE2ETier3FixtureAliases,
  loadE2EEnvironment,
} from "./scripts/e2e/sdd-0168-fixture";

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
  E2E_GLOBAL_TIMEOUT_MS?: string;
  E2E_PORT?: string;
  E2E_START_WEB_SERVER?: string;
  E2E_ENVIRONMENT_KIND?: string;
  E2E_LOCAL_SUPABASE_DENY_SERVER?: string;
  E2E_SUPABASE_DENY_PORT?: string;
  E2E_SUPABASE_URL?: string;
  E2E_WORKERS?: string;
  E2E_SUPABASE_ANON_KEY?: string;
  E2E_SUPABASE_SERVICE_ROLE_KEY?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

type PlaywrightRuntime = ReturnType<typeof resolvePlaywrightRuntime>;

const LOCAL_SUPABASE_DENY_ANON_KEY =
  "e2e-local-anon-key-not-a-secret";

function isLoopbackUrl(value: string): boolean {
  try {
    const { hostname } = new URL(value);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]"
    );
  } catch {
    return false;
  }
}

export function resolvePlaywrightExecutionLimits(
  env: PlaywrightRuntimeEnvironment,
): { globalTimeout: number; workers: number } {
  const workers = Number(env.E2E_WORKERS ?? (env.CI ? 1 : 8));
  const globalTimeout = Number(env.E2E_GLOBAL_TIMEOUT_MS ?? 8 * 60_000);

  if (!Number.isInteger(workers) || workers < 1 || workers > 32) {
    throw new Error("E2E_WORKERS debe ser un entero entre 1 y 32.");
  }
  if (
    !Number.isInteger(globalTimeout) ||
    globalTimeout < 60_000 ||
    globalTimeout > 60 * 60_000
  ) {
    throw new Error(
      "E2E_GLOBAL_TIMEOUT_MS debe ser un entero entre 60000 y 3600000.",
    );
  }

  return { globalTimeout, workers };
}

export function resolveLocalSupabaseDenyPort(
  env: PlaywrightRuntimeEnvironment,
  appPort: number,
): number {
  const configured = env.E2E_SUPABASE_DENY_PORT?.trim();
  const port = configured
    ? Number(configured)
    : appPort <= 55_535
      ? appPort + 10_000
      : appPort - 10_000;

  if (!Number.isInteger(port) || port < 1_024 || port > 65_535) {
    throw new Error(
      "E2E_SUPABASE_DENY_PORT debe ser un puerto entero entre 1024 y 65535.",
    );
  }
  if (port === appPort) {
    throw new Error(
      "E2E_SUPABASE_DENY_PORT debe ser distinto de E2E_PORT.",
    );
  }
  return port;
}

/**
 * Da al `next dev` de Playwright una configuración coherente sin copiar
 * secretos al worktree. En modo efímero, liga también la clave sólo-servidor.
 *
 * El fallback apunta a un servidor local deny-only levantado por Playwright.
 * Sólo su healthcheck responde 200; toda operación Supabase recibe un error
 * JSON corto. No hay red externa ni backend sintético que acepte escrituras.
 */
export function applyPlaywrightSupabaseEnvironment(
  env: PlaywrightRuntimeEnvironment,
  runtime: PlaywrightRuntime,
): boolean {
  const publicUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publicAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (Boolean(publicUrl) !== Boolean(publicAnonKey)) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY deben declararse juntas.",
    );
  }
  if (env.E2E_ENVIRONMENT_KIND?.trim() === "ephemeral") {
    const fixture = loadE2EEnvironment(env);
    if (publicUrl) {
      let matchesFixture = false;
      try {
        matchesFixture = new URL(publicUrl).href === `${fixture.supabaseUrl}/`;
      } catch {
        // No propagar el input de URL: podría contener credenciales.
      }
      if (!matchesFixture) {
        throw new Error("NEXT_PUBLIC_SUPABASE_URL no coincide con el destino E2E.");
      }
    }
    if (publicAnonKey && publicAnonKey !== fixture.anonKey) {
      throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY no coincide con el entorno E2E.");
    }
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (serviceRoleKey && serviceRoleKey !== fixture.serviceRoleKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY no coincide con el entorno E2E.");
    }
    if (env.E2E_LOCAL_SUPABASE_DENY_SERVER?.trim() === "1") {
      throw new Error("El modo E2E ephemeral no admite un servidor Supabase deny-only.");
    }
    // Un Preview debe configurar su propio Next; sólo se valida lo declarado aquí.
    if (!runtime.startWebServer || !isLoopbackUrl(runtime.baseURL)) return false;
    const nextEnvironment = {
      NEXT_PUBLIC_SUPABASE_URL: fixture.supabaseUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: fixture.anonKey,
      SUPABASE_SERVICE_ROLE_KEY: fixture.serviceRoleKey,
    };
    const changed = Object.entries(nextEnvironment).some(
      ([name, value]) => env[name] !== value,
    );
    Object.assign(env, nextEnvironment);
    return changed;
  }

  if (publicUrl && publicAnonKey) return false;
  if (!runtime.startWebServer || !isLoopbackUrl(runtime.baseURL)) return false;

  const denyPort = resolveLocalSupabaseDenyPort(env, runtime.port);
  env.E2E_LOCAL_SUPABASE_DENY_SERVER = "1";
  env.E2E_SUPABASE_DENY_PORT = String(denyPort);
  env.NEXT_PUBLIC_SUPABASE_URL = `http://127.0.0.1:${denyPort}`;
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY = LOCAL_SUPABASE_DENY_ANON_KEY;
  return true;
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
  const preparedEnvironment = { ...env };
  applyE2ETier3FixtureAliases(preparedEnvironment);
  const runtime = resolvePlaywrightRuntime(preparedEnvironment);
  applyPlaywrightSupabaseEnvironment(preparedEnvironment, runtime);
  // Publicar aliases y claves sólo después de validar el conjunto completo.
  Object.assign(env, preparedEnvironment);
  return runtime;
}

const {
  port: PORT,
  baseURL: BASE_URL,
  startWebServer: START_WEB_SERVER,
} = preparePlaywrightRuntime();
const START_LOCAL_SUPABASE_DENY_SERVER =
  process.env.E2E_LOCAL_SUPABASE_DENY_SERVER === "1";
const LOCAL_SUPABASE_DENY_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const LOCAL_SUPABASE_DENY_PORT = process.env.E2E_SUPABASE_DENY_PORT;
const { globalTimeout: GLOBAL_TIMEOUT, workers: WORKERS } =
  resolvePlaywrightExecutionLimits(process.env);

export default defineConfig({
  testDir: "./e2e",
  // Un límite global impide que un worker de WebKit ya terminado deje el gate
  // vivo indefinidamente durante el teardown.
  globalTimeout: GLOBAL_TIMEOUT,
  // El primer acceso compila rutas distintas en paralelo. En worktrees que
  // comparten node_modules, Webpack puede superar 30 s bajo carga fría aunque
  // el mismo contrato pase inmediatamente después; el margen no relaja las
  // aserciones ni sus timeouts particulares.
  timeout: 60_000,
  fullyParallel: true,
  // La máquina local suele compartir CPU/memoria con múltiples worktrees. El
  // tope evita lanzar 16 navegadores simultáneos; se puede ajustar por entorno.
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
      // SDD-0378: 8 WebKit Windows reprodujeron falta de recursos al crear
      // la página. Serializa sólo este proyecto; conserva tests y sus plazos.
      workers: process.platform === "win32" ? 1 : undefined,
    },
  ],
  // El destino y el arranque son decisiones distintas. Sin override se conserva
  // la compatibilidad histórica: BASE_URL describe un server externo/existente.
  webServer: START_WEB_SERVER
    ? [
        ...(START_LOCAL_SUPABASE_DENY_SERVER
          ? [
              {
                command: `node scripts/e2e/supabase-deny-server.mjs ${LOCAL_SUPABASE_DENY_PORT}`,
                reuseExistingServer: false,
                timeout: 30_000,
                url: `${LOCAL_SUPABASE_DENY_URL}/__health`,
              },
            ]
          : []),
        {
          // Invocar el entry JS con `node` directo (no `next` a secas): en este
          // entorno pnpm no linkea los .bin (ERR_PNPM_IGNORED_BUILDS) y `next`
          // no queda en el PATH del webServer → "next no se reconoce".
          // Mismo patrón que scripts/verify.mjs.
          // `node_modules` puede ser un junction compartido entre worktrees.
          // Turbopack rechaza ese destino fuera de la raíz del checkout;
          // Webpack conserva el aislamiento y permite ejecutar el gate.
          command: `node node_modules/next/dist/bin/next dev --webpack --port ${PORT}`,
          url: BASE_URL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      ]
    : undefined,
});
