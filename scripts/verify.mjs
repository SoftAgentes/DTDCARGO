#!/usr/bin/env node
/**
 * scripts/verify.mjs — Gate de verificación del harness DTD Cargo.
 *
 * Corre, en orden: lint → rsc-boundary → typecheck → test → docs:check →
 * numbering → components:check → governance:check → migrations-applied → e2e.
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
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const C = { green: "\x1b[32m", red: "\x1b[31m", dim: "\x1b[2m", yellow: "\x1b[33m", nc: "\x1b[0m" };
const ok = (m) => console.log(`${C.green}[OK]${C.nc}   ${m}`);
const fail = (m) => console.log(`${C.red}[FAIL]${C.nc} ${m}`);
const skip = (m) => console.log(`${C.yellow}[SKIP]${C.nc} ${m}`);
const warn = (m) => console.log(`${C.yellow}[AVISO]${C.nc} ${m}`);

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
  let stats;
  try {
    stats = JSON.parse(fs.readFileSync(E2E_JSON, "utf8")).stats;
  } catch {
    return null; // sin reporte legible no se absuelve nada
  }
  if (!stats || stats.unexpected !== 0) return null;
  const flaky = stats.flaky ? `, ${stats.flaky} flaky` : "";
  return (
    `e2e: ${stats.expected} tests pasaron${flaky} y ninguno falló, pero el proceso salió ≠0 — ` +
    `es el worker de WebKit que no cierra en Windows, no una regresión. ` +
    `No se re-corre la suite por eso.`
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
function runningDevServer() {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), ".next", "dev", "lock"), "utf8");
    const lock = JSON.parse(raw);
    if (!lock?.port || !lock?.pid || !pidAlive(lock.pid)) return null;
    return { pid: lock.pid, appUrl: lock.appUrl ?? `http://localhost:${lock.port}` };
  } catch {
    return null;
  }
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
  // Si ya hay un dev server de ESTE worktree, reusarlo (BASE_URL desactiva el
  // webServer de Playwright): evita el choque del lock por-dir al intentar
  // levantar un segundo `next dev` en la misma carpeta.
  const running = runningDevServer();
  if (running)
    return {
      env: { BASE_URL: running.appUrl },
      note: `reusando el dev server del worktree en ${running.appUrl} (PID ${running.pid})`,
    };
  return null; // sin dev acá → Playwright levanta el suyo en E2E_PORT (puerto propio por worktree, ver e2ePort)
}

// Puerto único por worktree → dos ventanas en carpetas distintas nunca
// colisionan en el mismo puerto (evita reusar el next dev de otra ventana con
// reuseExistingServer:true de Playwright). Determinístico: mismo cwd → mismo puerto.
function e2ePort() {
  const h = crypto.createHash("sha1").update(process.cwd()).digest();
  return 3100 + (h.readUInt16BE(0) % 700); // rango 3100–3799
}

// Cada check = un binario JS invocado con el mismo node que corre este script.
const STEPS = [
  { name: "lint", argv: ["node_modules/eslint/bin/eslint.js", "."] },
  // Frontera RSC: caza un server module que usa un VALOR de un módulo "use client"
  // (typecheck/vitest no lo ven; explota 500 en runtime — ver SDD-0050). Cero deps, rápido.
  { name: "rsc-boundary", argv: ["scripts/check-rsc-boundary.mjs"] },
  { name: "typecheck", argv: ["node_modules/typescript/bin/tsc", "--noEmit"] },
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
    // `list` es lo que se ve; `json` va a un archivo y sólo lo lee `e2eAbsolver`
    // cuando el proceso sale ≠0, para saber si de verdad falló un test.
    argv: ["node_modules/@playwright/test/cli.js", "test", "--reporter=list,json"],
    env: { E2E_PORT: String(e2ePort()), PLAYWRIGHT_JSON_OUTPUT_NAME: E2E_JSON },
    retry: 1,
    preflight: e2ePreflight,
    absolver: e2eAbsolver,
  },
];

const failures = [];
for (const step of STEPS) {
  console.log(`\n${C.dim}── ${step.name} ──────────────────────────────────${C.nc}`);
  let preflightEnv = null;
  if (step.preflight) {
    const pf = step.preflight();
    if (pf?.skip) {
      skip(`${step.name}: ${pf.reason}`);
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
  let absuelto = null;
  for (let i = 1; i <= attempts; i++) {
    // El absolvedor lee el reporte de ESTA corrida: si quedó uno viejo, mentiría.
    try {
      fs.rmSync(E2E_JSON, { force: true });
    } catch {}
    r = spawnSync(process.execPath, step.argv, { stdio: "inherit", cwd: process.cwd(), env });
    if (r.status === 0) break;
    // Antes de gastar un reintento: ¿el proceso se fue mal habiendo pasado todo?
    absuelto = step.absolver ? step.absolver() : null;
    if (absuelto) break;
    if (i < attempts) {
      console.log(`${C.dim}   ${step.name} falló (exit ${r.status ?? "señal " + r.signal}) → reintento ${i}/${attempts - 1} (flaky conocido)${C.nc}`);
    }
  }
  if (r.status === 0) ok(step.name);
  else if (absuelto) {
    // Amarillo, no verde: pasó, pero que se vea que hubo una anomalía.
    warn(absuelto);
    ok(`${step.name} (con aviso)`);
  } else {
    fail(`${step.name} (exit ${r.status ?? "señal " + r.signal})`);
    failures.push(step.name);
  }
}

console.log(`\n${C.dim}── resumen ───────────────────────────────────${C.nc}`);
if (failures.length === 0) {
  ok("verify: TODO VERDE ✓");
  process.exit(0);
}
fail(`verify: ${failures.length} fallo(s) → ${failures.join(", ")}`);
process.exit(1);
