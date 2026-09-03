#!/usr/bin/env node
/**
 * scripts/verify.mjs — Gate de verificación del harness DTD Cargo.
 *
 * Corre, en orden: lint → rsc-boundary → typecheck → edge-functions → test →
 * docs:check → numbering → components:check → governance:check →
 * migrations-applied → sql-tests → public-verify-concurrency → schema-rebuild → e2e.
 * Es el "init.sh real" del proyecto, multiplataforma (Node, cero deps).
 *
 * El paso `e2e` (Playwright) va último y se OMITE con gracia si no hay
 * navegadores instalados o si `VERIFY_SKIP_E2E=1` — nunca rompe el gate por
 * algo ajeno al cambio. Reusa el `next dev` de este worktree si ya está
 * corriendo (lock por-dir de Next); si no, levanta el suyo en E2E_PORT.
 *
 * Invoca cada binario con `node <entry>` DIRECTO (no vía `pnpm <script>`) a propósito:
 * en este entorno `pnpm run` dispara un preflight `install` que falla con
 * ERR_PNPM_IGNORED_BUILDS (esbuild). Llamar al entry JS lo esquiva.
 *
 * Uso:  node scripts/verify.mjs   ·   o:  pnpm verify
 * Exit: 0 = todo verde · 1 = al menos un check falló (corre TODOS y los lista).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { podarTiposDeRuta, notaDePoda } from "./prune-next-types.mjs";
import {
  classifyE2EReport,
  candidatosDePuerto,
  primerPuertoLibre,
  PUERTO_BASE,
  PUERTO_RANGO,
} from "./verify-e2e.mjs";

const C = { green: "\x1b[32m", red: "\x1b[31m", dim: "\x1b[2m", yellow: "\x1b[33m", nc: "\x1b[0m" };
const ok = (m) => console.log(`${C.green}[OK]${C.nc}   ${m}`);
const fail = (m) => console.log(`${C.red}[FAIL]${C.nc} ${m}`);
const skip = (m) => console.log(`${C.yellow}[SKIP]${C.nc} ${m}`);
const warn = (m) => console.log(`${C.yellow}[AVISO]${C.nc} ${m}`);

// Reporte fresco de E2E: se conserva incluso cuando el build siguiente falla.
const E2E_JSON = path.join(os.tmpdir(), `dtd-e2e-${process.pid}.json`);

function classifyE2E(exitStatus) {
  let report;
  try {
    report = JSON.parse(fs.readFileSync(E2E_JSON, "utf8"));
  } catch {
    return { status: "fail", reason: `E2E: falta un reporte JSON legible en ${E2E_JSON}.` };
  }
  return classifyE2EReport(exitStatus, report);
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
    return {
      env: {
        BASE_URL: running.appUrl,
        E2E_START_WEB_SERVER: "0",
      },
      note:
        `reusando el dev server del worktree en ${running.appUrl} ` +
        `(PID ${running.pid} · puerto ${running.port} · arrancado ${hora})` +
        (desfase ? `
   ⚠️  ${desfase}` : ""),
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
  return { env: { E2E_PORT: String(puerto) }, note: `dev server propio en el puerto ${puerto}` };
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

/**
 * Contrato de salida de los pasos que DEGRADAN CON GRACIA (sql-tests,
 * schema-rebuild, edge-functions, migrations-applied): 0 = corrio y paso ·
 * 1 = fallo · 3 = NO CORRIO. Antes el salto salia 0 y era indistinguible de un
 * verde. Si agregas un paso que puede auto-omitirse, sale con este codigo.
 */
const EXIT_SKIPPED = 3;

// Cada check = un binario JS invocado con el mismo node que corre este script.
const STEPS = [
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
  // Contratos de SQL (supabase/tests/*.test.sql) contra un Postgres desechable en
  // Docker: RLS, GRANTs, triggers de inmutabilidad. Existían pero no los corría
  // nadie — un contrato que nadie verifica se degrada en silencio (basta un GRANT
  // futuro para reabrir una escalada ya cerrada). DEGRADA CON GRACIA: sin Docker
  // → SKIP, nunca rojo. `VERIFY_SKIP_SQL=1` para omitirlo a pedido.
  { name: "sql-tests", argv: ["scripts/run-sql-tests.mjs"] },
  // SDD-0375: dos conexiones PostgreSQL reales; no se absuelve una carrera.
  // Comparte VERIFY_SKIP_SQL=1 y devuelve 3 si no hay Docker/imagen local.
  { name: "public-verify-concurrency", argv: ["scripts/check-public-verify-concurrency.mjs"] },
  { name: "portal-address-concurrency", argv: ["scripts/check-portal-address-concurrency.mjs"] },
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
  {
    name: "e2e",
    // `json` acredita resultados y lifecycle incluso con exit0. Se conserva.
    // El wrapper ejecuta Playwright en `.next-verify-e2e`, restaura tsconfig y
    // limpia la salida aun si la suite falla. La caché normal `.next` no se toca.
    argv: ["scripts/check-e2e.mjs", "--reporter=list,json"],
    // E2E_PORT NO va acá: lo resuelve `e2ePreflight` en tiempo de ejecución
    // (el runner deja que el env del preflight gane sobre el del paso).
    env: { PLAYWRIGHT_JSON_OUTPUT_NAME: E2E_JSON },
    preflight: e2ePreflight,
    classify: classifyE2E,
    beforeRun: () => {
      // Nunca aceptar un JSON viejo; si no puede retirarse, fallar sin arrancar.
      fs.rmSync(E2E_JSON, { force: true });
      console.log(`E2E: reporte de esta corrida en ${E2E_JSON}`);
    },
  },
  // Build de PRODUCCIÓN (SDD-0280). Va al final por lo mismo que el e2e: es el
  // paso más lento (~110 s) y no tiene sentido construir si el lint ya rompió.
  // `tsc --noEmit` y el e2e (contra `next dev`) NO lo cubren: no ejercitan el
  // prerender estático ni `next/font`. Hasta hoy el gate cerraba 14/14 sin
  // construir nunca, y un build roto sólo se veía en Vercel DESPUÉS del push.
  // Construye aislado en `.next-verify` y limpia — ver scripts/check-build.mjs.
  { name: "build", argv: ["scripts/check-build.mjs"] },
];

const failures = [];
/**
 * Pasos que NO corrieron. Se lleva aparte de `failures` a proposito: no son un
 * fallo del cambio, pero tampoco son un verde — y el resumen tiene que decirlo.
 */
const skipped = [];
for (const step of STEPS) {
  console.log(`\n${C.dim}── ${step.name} ──────────────────────────────────${C.nc}`);
  let preflightEnv = null;
  if (step.preflight) {
    const pf = step.preflight();
    if (pf?.skip) {
      skip(`${step.name}: ${pf.reason}`);
      skipped.push({ name: step.name, reason: pf.reason });
      continue;
    }
    if (pf?.note) console.log(`${C.dim}   ${pf.note}${C.nc}`);
    preflightEnv = pf?.env ?? null;
  }
  const env =
    step.env || preflightEnv
      ? { ...process.env, ...step.env, ...preflightEnv }
      : process.env;
  const attempts = (step.retry ?? 0) + 1;
  let r;
  let decision = null;
  for (let i = 1; i <= attempts; i++) {
    try {
      step.beforeRun?.();
    } catch {
      r = { status: 2 };
      decision = { status: "fail", reason: "No se pudo preparar evidencia fresca del paso." };
      break;
    }
    r = spawnSync(process.execPath, step.argv, { stdio: "inherit", cwd: process.cwd(), env });
    // Un SALTO no se reintenta: falta Docker/Deno/credenciales, y eso no cambia
    // por correrlo de nuevo — sólo imprimiría el mismo [SKIP] dos veces.
    if (r.status === EXIT_SKIPPED && !step.classify) break;
    decision = step.classify?.(r.status) ?? null;
    if (decision?.status === "pass" || decision?.status === "skip"
      || (!decision && r.status === 0)) break;
    if (i < attempts) {
      console.log(`${C.dim}   ${step.name} falló (exit ${r.status ?? "señal " + r.signal}) → reintento ${i}/${attempts - 1} (flaky conocido)${C.nc}`);
    }
  }
  if (r.status === EXIT_SKIPPED && !step.classify) {
    // El hijo se auto-omitio (sin Docker, sin Deno, sin credenciales). Antes
    // salia 0 y aca se imprimia [OK]: el gate no podia distinguir "paso" de
    // "no corrio", y un cierre declaraba TODO VERDE con pasos apagados.
    skipped.push({ name: step.name, reason: "no se midio (ver su [SKIP] arriba)" });
    warn(`${step.name}: OMITIDO — no se midio`);
  } else if (decision?.status === "skip") {
    skipped.push({ name: step.name, reason: decision.reason });
    skip(`${step.name}: ${decision.reason}`);
  } else if (decision?.status === "pass" || (!decision && r.status === 0)) {
    if (decision) console.log(decision.reason);
    ok(step.name);
  } else {
    if (decision) warn(decision.reason);
    fail(`${step.name} (exit ${r.status ?? "señal " + r.signal})`);
    failures.push(step.name);
  }
}

console.log(`\n${C.dim}── resumen ───────────────────────────────────${C.nc}`);
// Cuantos de los pasos declarados se MIDIERON de verdad. Este es el numero que
// hay que citar al cerrar: "13 de 13" no es lo mismo que "11 de 13".
const corrieron = STEPS.length - skipped.length;
console.log(
  `${C.dim}   ${corrieron} de ${STEPS.length} pasos corrieron de verdad${C.nc}`,
);

for (const om of skipped) warn(`omitido: ${om.name} — ${om.reason}`);

if (failures.length > 0) {
  fail(`verify: ${failures.length} fallo(s) → ${failures.join(", ")}`);
  process.exit(1);
}

if (skipped.length > 0) {
  // Verde CON RESERVA, y se dice con todas las letras. No es rojo —el entorno
  // no es culpa del cambio— pero tampoco se puede citar como "todo verde":
  // exactamente eso paso cinco veces con migrations-applied apagado.
  warn(
    `verify: sin fallos, pero ${skipped.length} paso(s) NO se midieron → ${skipped
      .map((om) => om.name)
      .join(", ")}. Esto NO es un cierre verde completo.`,
  );
  process.exit(0);
}

ok(`verify: TODO VERDE ✓ (${corrieron}/${STEPS.length} pasos medidos)`);
process.exit(0);
