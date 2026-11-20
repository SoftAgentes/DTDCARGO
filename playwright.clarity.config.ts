import { defineConfig, devices } from "@playwright/test";
import { RUTA_SALUD_SINTETICO, planSupabaseE2E } from "./e2e/_helpers/supabase-publico.cjs";

/**
 * Microsoft Clarity · prueba de no-fuga (fase 1).
 *
 * Levanta su PROPIO `next dev` con un ID sintético de Clarity, GA apagado y una
 * carpeta de salida aparte (no pisa el `.next` del dev ni el del gate). Ninguna
 * petición sale a internet: la prueba sirve una etiqueta de Clarity falsa que
 * late contra `*.clarity.ms` y aborta todo lo demás que no sea local.
 *
 * Sin `.env` con Supabase usa el Supabase sintético de la suite general
 * (deny-only, SDD-0479): sin él, `/portal`, `/entrar` o `/registro` no
 * hidratan y un «0 peticiones» no probaría nada.
 *
 * Ojo: `next dev` con otra carpeta de salida agrega `.next-clarity-e2e/…/types`
 * al `include` de `tsconfig.json`. Es ruido local: no se sube (`git checkout --
 * tsconfig.json` después de correrla).
 *
 * Correr: `pnpm test:e2e:clarity`. No forma parte de `pnpm test:e2e` porque la
 * suite general corre con Clarity apagado (sin ID), que es como se fusiona.
 */
const PORT = Number(process.env.E2E_CLARITY_PORT ?? 3071);
const BASE_URL = `http://localhost:${PORT}`;

const ENV = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
);
const SUPABASE = planSupabaseE2E({ env: ENV, baseURL: BASE_URL, levantaServidor: true, puertoApp: PORT });
const NEXT = {
  command: `node node_modules/next/dist/bin/next dev --webpack --port ${PORT}`,
  url: BASE_URL,
  reuseExistingServer: false,
  timeout: 240_000,
  env: {
    ...ENV,
    NEXT_PUBLIC_CLARITY_ID: "synthetic00",
    NEXT_PUBLIC_GA_ID: "off",
    VERIFY_DIST_DIR: ".next-clarity-e2e",
    // Sin Agentation (solo dev): el Supabase sintético ya se planeó arriba.
    E2E_ENVIRONMENT_KIND: "ephemeral",
  } as Record<string, string>,
};

export default defineConfig({
  testDir: "./e2e",
  testMatch: "clarity-no-fuga.clarity.ts",
  workers: 1,
  retries: 0,
  timeout: 120_000,
  outputDir: "test-results/clarity",
  reporter: [["list"]],
  use: { baseURL: BASE_URL, serviceWorkers: "block" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: SUPABASE.modo === "sintetico"
    ? [
        {
          command: `node scripts/e2e/supabase-deny-server.mjs ${SUPABASE.puerto}`,
          url: `${SUPABASE.url}${RUTA_SALUD_SINTETICO}`,
          reuseExistingServer: false,
          timeout: 30_000,
        },
        { ...NEXT, env: { ...NEXT.env, ...SUPABASE.entorno } },
      ]
    : NEXT,
});
