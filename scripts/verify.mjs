#!/usr/bin/env node
/**
 * scripts/verify.mjs — Gate de verificación del harness DTD Cargo.
 *
 * Corre, en orden: lint → rsc-boundary → typecheck → edge-functions → test →
 * docs:check → numbering → components:check → governance:check →
 * migrations-applied → sql-tests → schema-rebuild → e2e.
 * Es el "init.sh real" del proyecto, multiplataforma (Node, cero deps).
 *
 * El paso `e2e` (Playwright) va último y se OMITE con gracia si no hay
 * navegadores instalados o si `VERIFY_SKIP_E2E=1` — nunca rompe el gate por
 * algo ajeno al cambio. Reusa el `next dev` de este worktree si ya está
 * corriendo (lock por-dir de Next); si no, levanta el suyo en E2E_PORT.
 *
 * El e2e corre bajo WATCHDOG (SDD-0454): si pasa `VERIFY_E2E_IDLE_MIN` minutos
 * sin escribir nada (10 por defecto) o supera `VERIFY_E2E_TIMEOUT_MIN` en total
 * (60, reintento incluido), se termina SÓLO su árbol de procesos y el paso queda
 * FALLÓ con motivo COLGADO/TIMEOUT: nunca SKIP ni verde, y no se reintenta. Ya
 * no hace falta buscar ese árbol a mano ni cortarlo con `taskkill`. Ver
 * scripts/verify-watchdog.mjs.
 *
 * Sin Supabase público (SDD-0470): sin NEXT_PUBLIC_SUPABASE_URL y
 * NEXT_PUBLIC_SUPABASE_ANON_KEY, ni en el entorno ni en los `.env*` que carga
 * Next, los specs que lo necesitan se omiten con motivo y el resto corre. Esas
 * pruebas llaman a `requiereSupabase()`. El paso queda con COBERTURA PARCIAL,
 * que para un paso crítico es un cierre INCOMPLETO, nunca TODO VERDE.
 *
 * Supabase sintético (SDD-0479): cuando faltan las DOS variables y Playwright
 * levanta su propio `next dev` local, ese servidor corre contra un Supabase
 * deny-only en 127.0.0.1 y esas pruebas corren en vez de omitirse. Si falta
 * una sola, o se reusa un `next dev` ya levantado, sigue la omisión de 0470.
 *
 * Invoca cada binario con `node <entry>` DIRECTO (no vía `pnpm <script>`) a propósito:
 * en este entorno `pnpm run` dispara un preflight `install` que falla con
 * ERR_PNPM_IGNORED_BUILDS (esbuild). Llamar al entry JS lo esquiva.
 *
 * Uso:  node scripts/verify.mjs   ·   o:  pnpm verify
 * Exit: 0 = ningún check medido falló; el VEREDICTO dice si el cierre quedó
 * completo o con críticos sin medir · 1 = al menos un check falló.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { podarTiposDeRuta, notaDePoda } from "./prune-next-types.mjs";
import { discoverHarnessTests } from "./tests/run-harness.mjs";
import {
  absuelveCorrida,
  candidatosDePuerto,
  candidatosSupabaseSintetico,
  coberturaParcialE2E,
  deteccionEfectiva,
  destinoE2E,
  detectarSupabasePublico,
  envParaSalidaCanalizada,
  motivoSinSupabase,
  planSupabaseE2E,
  primerPuertoLibre,
  PUERTO_BASE,
  PUERTO_RANGO,
} from "./verify-e2e.mjs";
import { C, createReporter, runStep } from "./verify-runner.mjs";
import {
  assertCompleteStepPolicy,
  buildVerifyVerdict,
} from "./verify-step-policy.mjs";
import { resolveWatchdogLimits } from "./verify-watchdog.mjs";

const out = createReporter();
const { ok, fail, warn } = out;

// Reporte JSON del e2e. Corre EN PARALELO al reporter `list` (que es el que se
// ve en pantalla): sirve para distinguir "un test falló" de "el proceso salió
// ≠0 sin ningún test fallado". Ver `e2eAbsolver`.
const E2E_JSON = path.join(os.tmpdir(), `dtd-e2e-${process.pid}.json`);

/**
 * ¿El e2e salió ≠0 SIN que fallara un solo test?
 *
 * Pasa siempre, y siempre por lo mismo: al terminar la corrida, el worker de
 * **WebKit** (`mobile-safari`, iPhone 14) no cierra en Windows. Playwright
 * espera 300 s, lo mata a la fuerza y devuelve 1 con un "1 error was not a part
 * of any test". Medido el 2026-08-09 sobre cinco corridas del gate: los SEIS
 * cuelgues venían precedidos exclusivamente por tests de `mobile-safari`, nunca
 * de chromium ni de mobile-chrome.
 *
 * Sin esto el gate re-corría la suite entera —~7 min— para llegar al mismo
 * verde. Y NO puede tapar una regresión: si un test falla de verdad,
 * `stats.unexpected` es > 0 y el paso se marca rojo igual. Lo único que absuelve
 * es un proceso que se fue mal habiendo pasado todo.
 */
function e2eAbsolver() {
  let reporte;
  try {
    reporte = JSON.parse(fs.readFileSync(E2E_JSON, "utf8"));
  } catch {
    return null; // sin reporte legible no se absuelve nada
  }
  const stats = reporte.stats;
  if (!stats) return null;

  // 🔴 Cero tests NO es verde: ver `absuelveCorrida`. Si el webServer no
  // arrancó, `unexpected` también es 0 y la excusa de abajo describiría un
  // caso que no ocurrió.
  if (absuelveCorrida(stats)) {
    const flaky = stats.flaky ? `, ${stats.flaky} flaky` : "";
    return (
      `e2e: ${stats.expected} tests pasaron${flaky} y ninguno falló, pero el proceso salió ≠0 — ` +
      `es el worker de WebKit que no cierra en Windows, no una regresión. ` +
      `No se re-corre la suite por eso.`
    );
  }

  // Falló al menos un test. ¿Falló el CÓDIGO, o falló el NAVEGADOR en arrancar?
  return navegadorAusente(reporte, stats);
}

// Todos los tests que Playwright marcó como fallo real, con sus mensajes de error.
function testsFallados(nodo, acc = []) {
  for (const spec of nodo.specs ?? []) {
    for (const t of spec.tests ?? []) {
      if (t.status !== "unexpected") continue;
      const msgs = (t.results ?? [])
        .flatMap((r) => [r.error?.message, ...(r.errors ?? []).map((e) => e.message)])
        .filter(Boolean);
      acc.push({ project: t.projectName ?? "?", msgs });
    }
  }
  for (const hijo of nodo.suites ?? []) testsFallados(hijo, acc);
  return acc;
}

/**
 * ¿La suite entera se cayó porque falta un navegador, no porque el código esté mal?
 *
 * El preflight `chromiumInstalled()` sólo mira si existe UNA carpeta que empiece
 * con `chromium`. Es ciego a dos cosas: a los otros motores (el config corre
 * `mobile-safari`, que es **WebKit**) y a la VERSIÓN. Playwright pide una versión
 * exacta —`webkit-2336`, no "algún webkit"—, así que basta actualizar Playwright
 * sin re-correr `playwright install` para que el preflight diga "hay navegadores",
 * la suite arranque igual y los 20 tests de `mobile-safari` fallen en seco.
 * Pasó el 2026-08-11 y mandó a buscar una regresión que no existía: el gate se
 * puso rojo por algo ajeno al cambio, que es exactamente lo que el preflight
 * existe para evitar.
 *
 * No se arregla en el preflight porque para saber qué motor necesita cada
 * proyecto habría que hardcodear el mapa nombre→navegador (`mobile-safari` →
 * webkit), y ese mapa se desincroniza del `playwright.config.ts` en silencio.
 * Acá no hace falta adivinar: se le pregunta al resultado.
 *
 * NO puede tapar una regresión. Absuelve sólo si **TODOS** los fallos son
 * "Executable doesn't exist"; con un solo fallo de aserción mezclado devuelve
 * null y el paso se marca rojo igual. Y nunca calla: nombra los proyectos que
 * se perdieron y el comando que los devuelve.
 */
function navegadorAusente(reporte, stats) {
  const fallos = testsFallados({ suites: reporte.suites ?? [] });
  if (fallos.length === 0) return null;
  const esFaltaDeNavegador = (f) => f.msgs.some((m) => m.includes("Executable doesn't exist"));
  if (!fallos.every(esFaltaDeNavegador)) return null; // hay fallos de verdad → ROJO

  const proyectos = [...new Set(fallos.map((f) => f.project))].sort();
  return (
    `e2e: ${stats.expected} tests pasaron y los ${fallos.length} fallos son TODOS ` +
    `"Executable doesn't exist" — falta el navegador, no hay regresión. ` +
    `⚠️ NO se ejecutó: ${proyectos.join(", ")}. ` +
    `Recuperas esa cobertura con: pnpm exec playwright install`
  );
}

// ¿Hay navegadores de Playwright instalados? El e2e necesita al menos chromium.
// Sin ellos, el paso e2e se OMITE (no rojo) para no romper el gate por algo
// ajeno al cambio (ej. clone fresco sin `playwright install`).
function chromiumInstalled() {
  const dirHasChromium = (dir) => {
    try {
      return fs.readdirSync(dir).some((n) => n.startsWith("chromium"));
    } catch {
      return false;
    }
  };
  const custom = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (custom && custom !== "0") return dirHasChromium(custom);
  const home = os.homedir();
  return [
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "ms-playwright"),
    path.join(home, "AppData", "Local", "ms-playwright"),
    path.join(home, "Library", "Caches", "ms-playwright"),
    path.join(home, ".cache", "ms-playwright"),
  ]
    .filter(Boolean)
    .some(dirHasChromium);
}

// ¿Está vivo el proceso `pid`? `signal 0` no mata: solo prueba existencia.
// En Windows, EPERM = existe pero sin permiso → cuenta como vivo.
function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
}

// ¿Hay un `next dev` corriendo en ESTE worktree? Next 16 escribe un lock POR
// DIRECTORIO en `.next/dev/lock` con pid + puerto + appUrl. Como el lock es
// por-dir, ese server sirve EXACTAMENTE el código de este worktree → se puede
// reusar sin riesgo (nunca es el de otra ventana, que vive en otro dir/lock).
/**
 * El `next dev` de ESTE worktree, si hay uno vivo — con la hora en que arrancó.
 *
 * La hora NO es adorno. El 2026-08-14 un dev server huérfano —quedó colgado al
 * matar un gate a mitad— hizo que el e2e midiera un ÁRBOL VIEJO: los specs de
 * la calculadora fallaban contra código que ya no existía, y los rojos parecían
 * una regresión. El gate reusa el server (para no chocar con el lock por-dir de
 * Next) y no decía cuál, así que no había forma de sospecharlo.
 *
 * `startedAt` sale del mtime del propio lock, que Next reescribe al arrancar.
 */
function runningDevServer() {
  try {
    const lockPath = path.join(process.cwd(), ".next", "dev", "lock");
    const raw = fs.readFileSync(lockPath, "utf8");
    const lock = JSON.parse(raw);
    if (!lock?.port || !lock?.pid || !pidAlive(lock.pid)) return null;
    let startedAt = null;
    try {
      startedAt = fs.statSync(lockPath).mtime;
    } catch {}
    return {
      pid: lock.pid,
      port: lock.port,
      startedAt,
      // Next puede registrar 127.0.0.1 en el lock, pero su HMR sólo admite
      // localhost por defecto. La URL canónica del harness evita ese cruce.
      appUrl: `http://localhost:${lock.port}`,
    };
  } catch {
    return null;
  }
}

/**
 * ¿El dev server arrancó ANTES que el commit que estamos probando? Si sí, muy
 * probablemente está sirviendo código viejo y el e2e no mide lo que dice medir.
 * Devuelve el aviso listo para imprimir, o `null` si no hay nada que decir.
 */
function devServerDesfasado(startedAt) {
  if (!startedAt) return null;
  const r = spawnSync("git", ["log", "-1", "--format=%cI"], { encoding: "utf8" });
  if (r.status !== 0) return null;
  const commitAt = new Date(String(r.stdout).trim());
  if (Number.isNaN(commitAt.getTime())) return null;
  if (startedAt >= commitAt) return null;
  const mins = Math.round((commitAt - startedAt) / 60000);
  return `el dev server arrancó ${mins} min ANTES del commit bajo prueba — puede estar sirviendo código viejo`;
}

/**
 * Detección de Supabase público que tomó el preflight de ESTA corrida
 * (SDD-0470), ya con el plan aplicado (SDD-0479): con el Supabase sintético,
 * las dos variables existen para el `next dev`. `e2eCoberturaParcial` la usa
 * después del paso junto con el reporte, para decir cuántas pruebas quedaron
 * omitidas.
 */
let e2eSupabase = null;

/**
 * Plan de Supabase del paso e2e y su aviso (SDD-0479). La decisión es la de
 * `playwright.config.ts` (`planSupabaseE2E`), con el mismo entorno que recibe
 * Playwright y la raíz de siempre (`RAIZ_REPO`), la misma que usan los specs:
 * el gate y Playwright nunca pueden mirar `.env*` distintos.
 *
 * En modo sintético el gate fija `E2E_SUPABASE_SINTETICO_PORT` en un puerto que
 * comprobó libre y lo devuelve en `env` para el paso. Sin puerto libre lo dice,
 * y Playwright intentará el suyo por defecto: si está ocupado, falla a la vista.
 */
function planSupabaseDelPaso(pasoEnv, puerto) {
  let env = { ...process.env, ...pasoEnv };
  let plan = planSupabaseE2E({ env, ...destinoE2E(env, puerto) });
  const extra = {};
  let sinPuerto = "";
  if (plan.modo === "sintetico" && !String(process.env.E2E_SUPABASE_SINTETICO_PORT ?? "").trim()) {
    const libre = primerPuertoLibre(candidatosSupabaseSintetico(Number(puerto), process.cwd()));
    if (libre) {
      extra.E2E_SUPABASE_SINTETICO_PORT = String(libre);
      env = { ...env, ...extra };
      plan = planSupabaseE2E({ env, ...destinoE2E(env, puerto) });
    } else {
      sinPuerto = `\n   ⚠️  Sin puerto libre comprobado para el Supabase sintético: Playwright usará ${plan.puerto} y fallará si está ocupado.`;
    }
  }
  e2eSupabase = deteccionEfectiva(plan);
  if (plan.modo === "sintetico") {
    return {
      env: extra,
      aviso:
        `\n   ℹ️  Sin Supabase público: el next dev del e2e corre contra un Supabase sintético deny-only en ${plan.url} (SDD-0479).` +
        "\n   ℹ️  Las pruebas con requiereSupabase() corren; ninguna lee ni escribe datos reales." +
        sinPuerto,
    };
  }
  const motivo = motivoSinSupabase(e2eSupabase);
  if (!motivo) return { env: extra, aviso: "" };
  return {
    env: extra,
    aviso:
      `\n   ⚠️  ${motivo}` +
      "\n   ⚠️  Las pruebas con requiereSupabase() se omiten con ese motivo; el paso quedará con COBERTURA PARCIAL.",
  };
}

/**
 * SDD-0470 · Después del paso: ¿quedó cobertura parcial por falta de Supabase?
 * Lee el reporte JSON de esta corrida. Si no hay reporte legible, igual se
 * declara cuando falta Supabase.
 */
function e2eCoberturaParcial() {
  let reporte = null;
  try {
    reporte = JSON.parse(fs.readFileSync(E2E_JSON, "utf8"));
  } catch {}
  const deteccion = e2eSupabase ?? detectarSupabasePublico();
  return coberturaParcialE2E({ deteccion, reporte });
}

// Preflight del paso e2e: decide si correrlo, omitirlo o reusar un server.
function e2ePreflight() {
  if (process.env.VERIFY_SKIP_E2E === "1")
    return { skip: true, reason: "VERIFY_SKIP_E2E=1 (omitido a pedido)" };
  if (!chromiumInstalled())
    return {
      skip: true,
      reason:
        "navegadores Playwright ausentes → `pnpm exec playwright install chromium` (e2e omitido, no bloquea el gate)",
    };
  // Si ya hay un dev server de ESTE worktree, reusarlo y desactivar el
  // webServer de Playwright de forma explícita: evita el choque del lock por-dir
  // al intentar levantar un segundo `next dev` en la misma carpeta.
  const running = runningDevServer();
  if (running) {
    const hora = running.startedAt
      ? running.startedAt.toLocaleString("es-VE")
      : "hora desconocida";
    const desfase = devServerDesfasado(running.startedAt);
    const pasoEnv = {
      BASE_URL: running.appUrl,
      E2E_START_WEB_SERVER: "0",
    };
    // Servidor reusado: su configuración no la controla el gate, así que no hay
    // Supabase sintético (SDD-0479) y rige la omisión con motivo de 0470.
    const supabase = planSupabaseDelPaso(pasoEnv, running.port);
    return {
      env: { ...pasoEnv, ...supabase.env },
      note:
        `reusando el dev server del worktree en ${running.appUrl} ` +
        `(PID ${running.pid} · puerto ${running.port} · arrancado ${hora})` +
        (desfase ? `
   ⚠️  ${desfase}` : "") +
        supabase.aviso,
    };
  }
  // Sin dev acá → Playwright levanta el suyo. El puerto se resuelve ACÁ y no al
  // construir la lista de pasos: sondear puertos es una medición del entorno,
  // no una constante, y el resultado tiene que poder decir "no hay".
  const puerto = e2ePort();
  if (!puerto) {
    return {
      skip: true,
      reason:
        `sin puerto libre en ${PUERTO_BASE}–${PUERTO_BASE + PUERTO_RANGO - 1} — ` +
        `en Windows revisa los rangos reservados con ` +
        `\`netsh interface ipv4 show excludedportrange protocol=tcp\` ` +
        `(e2e omitido; fuerza uno con E2E_PORT=<puerto>)`,
    };
  }
  const pasoEnv = { E2E_PORT: String(puerto) };
  const supabase = planSupabaseDelPaso(pasoEnv, puerto);
  return {
    env: { ...pasoEnv, ...supabase.env },
    note: `dev server propio en el puerto ${puerto}${supabase.aviso}`,
  };
}

/**
 * Puerto para el `next dev` del e2e: determinístico por worktree, pero
 * VERIFICADO — se prueba que el sistema operativo deje escuchar ahí antes de
 * dárselo a Playwright. La lógica y el porqué viven en `verify-e2e.mjs`.
 *
 * `E2E_PORT` del entorno gana: es la salida a mano cuando algo se tuerce.
 * Devuelve `null` si NINGÚN candidato ata — ahí el paso se omite diciéndolo,
 * en vez de arrancar contra un puerto muerto y correr cero tests.
 */
function e2ePort() {
  const forzado = Number(process.env.E2E_PORT);
  if (Number.isInteger(forzado) && forzado > 0) return forzado;
  return primerPuertoLibre(candidatosDePuerto(process.cwd()));
}

// Límites del watchdog del e2e (SDD-0454). Se leen ANTES de correr nada: un
// valor inválido rompe el gate igual que una política de pasos incompleta.
// El contrato de salida de los pasos que degradan con gracia (exit 3 = NO
// CORRIÓ) vive ahora en scripts/verify-runner.mjs, junto a quien lo aplica.
let e2eWatchdog;
try {
  e2eWatchdog = resolveWatchdogLimits(process.env);
} catch (error) {
  fail(`verify-watchdog: ${error.message}`);
  process.exit(1);
}

// Los archivos del paso harness salen del MISMO descubrimiento que
// `pnpm harness:test` (SDD-0464): cada scripts/tests/*.node.mjs entra sin
// editar este archivo, y un directorio sin pruebas rompe el gate al cargar en
// vez de correr vacío. Antes había una lista manual que se quedaba corta.
let harnessTests;
try {
  harnessTests = discoverHarnessTests();
} catch (error) {
  fail(`harness: ${error.message}`);
  process.exit(1);
}

// Cada check = un binario JS invocado con el mismo node que corre este script.
export const STEPS = [
  // Harness en repos temporales sin red ni credenciales. No se descubre por Vitest.
  {
    name: "harness",
    argv: ["--test", ...harnessTests],
    preflight: () => ({ note: `${harnessTests.length} archivos scripts/tests/*.node.mjs descubiertos` }),
  },
  { name: "lint", argv: ["node_modules/eslint/bin/eslint.js", "."] },
  // Frontera RSC: caza un server module que usa un VALOR de un módulo "use client"
  // (typecheck/vitest no lo ven; explota 500 en runtime — ver SDD-0050). Cero deps, rápido.
  { name: "rsc-boundary", argv: ["scripts/check-rsc-boundary.mjs"] },
  // ⚠️ El preflight NO es cosmético: `tsconfig.json` mete `.next/**/types` en su
  // `include`, y Next genera esos tipos pero nunca los recolecta cuando borras
  // una ruta. El 2026-08-23 `main` salía rojo en typecheck Y en build por un
  // `validator.ts` que seguía importando la página de login que SDD-0276 borró
  // — código sano, gate rojo. Ver scripts/prune-next-types.mjs.
  {
    name: "typecheck",
    argv: ["node_modules/typescript/bin/tsc", "--noEmit"],
    preflight: () => {
      const nota = notaDePoda(podarTiposDeRuta());
      return nota ? { note: nota } : null;
    },
  },
  // Las Edge Functions NO las miraba nadie: `tsconfig.json` tiene
  // `supabase/functions` en `exclude` (→ tsc pasa de largo) y Vitest sólo
  // ejecuta los módulos puros de `_shared/`, transpilando SIN chequear tipos.
  // O sea: `kommo-writeback` (PATCH a Kommo, LIVE) y `kommo-sync` (que PODA
  // embudos y etapas del espejo) viajaban a prod sin verificación estática.
  // Este paso corre `deno check` sobre las 4 entradas; el grafo de imports cubre
  // de rebote los 5 módulos de `_shared/`. DEGRADA CON GRACIA: sin poder obtener
  // Deno (sin red ni caché) → SKIP, nunca rojo. `VERIFY_SKIP_EDGE=1` lo omite.
  // `retry: 1` porque la PRIMERA vez baja Deno por npx y eso toca la red.
  { name: "edge-functions", argv: ["scripts/check-edge-functions.mjs"], retry: 1 },
  // `retry: 1` → el pool de workers de Vitest cae en seco de forma transitoria en
  // Windows ("failed to find the runner" / reading 'config' en TODOS los archivos):
  // es flakiness conocida, no regresión. Reintentar 1 vez auto-sana el gate; un test
  // realmente roto falla las 2 veces y reporta rojo igual (~23s de costo solo si ya falló).
  { name: "test", argv: ["node_modules/vitest/vitest.mjs", "run"], retry: 1 },
  { name: "docs:check", argv: ["scripts/build-docs-index.mjs", "--check"] },
  // ¿Dos cosas llevan el mismo número? El 29-jul hubo CUATRO colisiones entre
  // ventanas paralelas (spec 0172, migr 0268, 0174 esquivada de casualidad, spec
  // 0175 duplicada DESPUÉS de chequear origin/main). Ninguna la cazó el gate:
  // docs:check junta los números en un Set que usa sólo para huecos, y nunca
  // comparaba el `sdd:` contra la carpeta. Salta al MERGEAR, que es cuando
  // todavía se puede renumerar. Puro filesystem → NUNCA hace skip.
  { name: "numbering", argv: ["scripts/check-numbering.mjs"] },
  { name: "feature-constants", argv: ["scripts/check-feature-constants.mjs"] },
  { name: "components:check", argv: ["scripts/validate-component-registry.mjs"] },
  {
    name: "governance:check",
    argv: ["scripts/build-governance-capsule.mjs", "--check"],
  },
  // ¿Hay migraciones en el repo que nunca llegaron a prod? La 0228 estuvo DOS
  // rondas perdida y se construyó encima; se descubrió tarde y con un error que
  // no explicaba nada. Este paso consulta el ledger de prod (RPC 0239) y grita si
  // un archivo del repo no está aplicado. DEGRADA CON GRACIA: sin creds/red/RPC
  // → SKIP (no rojo), igual que el e2e. `retry: 1` porque toca la red.
  { name: "migrations-applied", argv: ["scripts/check-migrations-applied.mjs"], retry: 1 },
  // ¿El código alcanzable desde app depende de un símbolo que sólo nace en una
  // migración declarada pendiente? Repo contra repo: no usa red, credenciales ni SKIP.
  { name: "pending-migration-symbols", argv: ["scripts/check-pending-migration-symbols.mjs"] },
  // Contratos de SQL (supabase/tests/*.test.sql) contra un Postgres desechable en
  // Docker: RLS, GRANTs, triggers de inmutabilidad. Existían pero no los corría
  // nadie — un contrato que nadie verifica se degrada en silencio (basta un GRANT
  // futuro para reabrir una escalada ya cerrada). DEGRADA CON GRACIA: sin Docker
  // → SKIP, nunca rojo. `VERIFY_SKIP_SQL=1` para omitirlo a pedido.
  { name: "sql-tests", argv: ["scripts/run-sql-tests.mjs"] },
  // ¿El schema se reconstruye desde cero con lo que hay en el repo? Aplica las
  // 267 migraciones en orden sobre un Postgres limpio. Caza lo que
  // `migrations-applied` no puede (ese compara NOMBRES contra el ledger): un
  // archivo que nunca se podría aplicar (la 0030 llevaba meses con un error de
  // sintaxis) y objetos que viven SOLO en prod, creados fuera de banda.
  // DEGRADA CON GRACIA: sin Docker → SKIP. ~18s.
  { name: "schema-rebuild", argv: ["scripts/check-schema-rebuild.mjs"] },
  // E2E (Playwright) — captura bugs de interacción cliente que vitest NO ve
  // (ej. el estimado de la calculadora que desaparecía al tocar el panel de
  // medidas). Va ÚLTIMO: los checks rápidos fallan primero. Reusa el dev server
  // de este worktree si está corriendo (ver e2ePreflight); si no, levanta el
  // suyo en un puerto PROPIO por worktree (e2ePort, derivado del hash del cwd)
  // → dos ventanas nunca colisionan. Los specs Tier-3 que piden seed se auto-omiten sin creds.
  // Sin Supabase público, los que lo necesitan se omiten con motivo y el paso
  // declara COBERTURA PARCIAL (SDD-0470, e2eCoberturaParcial).
  {
    name: "e2e",
    // `list` es lo que se ve; `json` va a un archivo y sólo lo lee `e2eAbsolver`
    // cuando el proceso sale ≠0, para saber si de verdad falló un test.
    argv: ["node_modules/@playwright/test/cli.js", "test", "--reporter=list,json"],
    // E2E_PORT NO va acá: lo resuelve `e2ePreflight` en tiempo de ejecución
    // (el runner deja que el env del preflight gane sobre el del paso).
    env: {
      PLAYWRIGHT_JSON_OUTPUT_NAME: E2E_JSON,
      // El watchdog canaliza la salida; en una terminal real se ve como antes.
      ...envParaSalidaCanalizada(process.stdout),
    },
    retry: 1,
    // SDD-0454: el 2026-09-11 este paso calló 30 y 48 min sin terminar. Bajo
    // watchdog, un cuelgue termina su árbol propio (Playwright, next dev,
    // workers, navegadores) y queda FALLÓ con motivo COLGADO/TIMEOUT; no se
    // reintenta ni se absuelve. Un fallo común conserva su `retry`.
    watchdog: e2eWatchdog,
    preflight: e2ePreflight,
    absolver: e2eAbsolver,
    partialCoverage: e2eCoberturaParcial,
  },
  // Build de PRODUCCIÓN (SDD-0280). Va al final por lo mismo que el e2e: es el
  // paso más lento (~110 s) y no tiene sentido construir si el lint ya rompió.
  // `tsc --noEmit` y el e2e (contra `next dev`) NO lo cubren: no ejercitan el
  // prerender estático ni `next/font`. Hasta hoy el gate cerraba 14/14 sin
  // construir nunca, y un build roto sólo se veía en Vercel DESPUÉS del push.
  // Construye aislado en `.next-verify` y limpia — ver scripts/check-build.mjs.
  { name: "build", argv: ["scripts/check-build.mjs"] },
];

try {
  // Un paso agregado o retirado sin decidir su impacto rompe el gate antes de
  // correr nada: la clasificación nunca puede quedar desfasada en silencio.
  assertCompleteStepPolicy(STEPS.map((step) => step.name));
} catch (error) {
  fail(`verify-policy: ${error.message}`);
  process.exit(1);
}

// El absolvedor lee el reporte de ESTA corrida: si quedó uno viejo, mentiría.
function limpiarReporteE2E() {
  try {
    fs.rmSync(E2E_JSON, { force: true });
  } catch {}
}

/**
 * Corre los pasos en orden y termina el proceso con el veredicto. Vive detrás
 * de una frontera CLI/import (SDD-0464): importar este módulo desde una prueba
 * expone `STEPS` sin lanzar el gate; solo el entry `node scripts/verify.mjs`
 * lo ejecuta. El comportamiento del entry no cambia.
 */
/**
 * SDD-0470 · ¿Dejó `step` cobertura parcial? Devuelve `{ name, reason }` para el
 * veredicto, o `null`, y escribe el aviso con la lista de casos.
 *
 * - Un paso OMITIDO no tiene cobertura parcial: ya cuenta entero como omisión,
 *   y ni siquiera se le pregunta.
 * - Un paso que FALLÓ sí puede tenerla: un e2e con un fallo real y además 15
 *   pruebas omitidas lleva el fallo y la omisión.
 * - Un paso OK con omisiones declaradas es parcial, nunca verde completo.
 */
export function recolectarParcial(step, resultado, reporter = out) {
  if (resultado.skipped || !step.partialCoverage) return null;
  const parcial = step.partialCoverage();
  if (!parcial) return null;
  reporter.warn(`${step.name}: COBERTURA PARCIAL — ${parcial.reason}`);
  for (const caso of parcial.casos) reporter.line(`   omitida: ${caso}`);
  return { name: step.name, reason: parcial.reason };
}

/**
 * Lleva a `acumulado` (`{ skipped, failures, partial }`) lo que el veredicto
 * necesita de un paso ya corrido.
 */
export function recolectarResultado(acumulado, step, resultado, reporter = out) {
  if (resultado.skipped) acumulado.skipped.push(resultado.skipped);
  if (resultado.failure) acumulado.failures.push(resultado.failure);
  const parcial = recolectarParcial(step, resultado, reporter);
  if (parcial) acumulado.partial.push(parcial);
}

/**
 * Corre `steps` en orden, recoge omisiones, fallos y coberturas parciales y
 * devuelve el veredicto. Separado de `main()` (SDD-0470, ronda 2) para probar
 * la recolección con pasos falsos: `correr` reemplaza a `runStep` en las
 * pruebas. `main()` sólo agrega el resumen impreso y el exit.
 *
 * - `skipped`: pasos que NO corrieron. Van aparte de `failures` a propósito: no
 *   son un fallo del cambio, pero tampoco son un verde, y el resumen tiene que
 *   decirlo.
 * - `partial`: pasos que corrieron pero dejaron sin medir una parte declarada
 *   (hoy, el e2e sin Supabase público). El veredicto los clasifica según su
 *   política.
 */
export async function evaluarPasos(steps, { out: reporter = out, correr = null } = {}) {
  const acumulado = { skipped: [], failures: [], partial: [] };
  // Preflight, intentos, absolvedor, watchdog y clasificación de cada paso viven
  // en scripts/verify-runner.mjs, donde se prueban con pasos falsos (SDD-0454).
  for (const step of steps) {
    const resultado = correr
      ? await correr(step)
      : await runStep(step, { out: reporter, beforeAttempt: limpiarReporteE2E });
    recolectarResultado(acumulado, step, resultado, reporter);
  }
  const verdict = buildVerifyVerdict({ stepNames: steps.map((step) => step.name), ...acumulado });
  return { ...acumulado, verdict };
}

export async function main() {
  const { skipped, partial, verdict } = await evaluarPasos(STEPS, { out });

  console.log(`\n${C.dim}── resumen ───────────────────────────────────${C.nc}`);
  // Cuantos de los pasos declarados se MIDIERON de verdad. Este es el numero que
  // hay que citar al cerrar: "13 de 13" no es lo mismo que "11 de 13".
  const corrieron = STEPS.length - skipped.length;
  const parciales = partial.length > 0
    ? ` (con cobertura parcial: ${partial.map((p) => p.name).join(", ")})`
    : "";
  console.log(
    `${C.dim}   ${corrieron} de ${STEPS.length} pasos corrieron de verdad${parciales}${C.nc}`,
  );

  for (const om of skipped) warn(`omitido: ${om.name} — ${om.reason}`);
  for (const p of partial) warn(`parcial: ${p.name} — ${p.reason}`);

  // Una sola línea final. Si faltó medir algo crítico lo nombra acá, aunque además
  // haya fallos, para que el cierre no dependa de encontrar el [SKIP] anterior.
  if (verdict.tone === "fail") fail(verdict.message);
  else if (verdict.tone === "warn") warn(verdict.message);
  else ok(verdict.message);
  process.exit(verdict.exitCode);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
