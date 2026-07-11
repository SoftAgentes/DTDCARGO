#!/usr/bin/env node
/**
 * scripts/verify.mjs — Gate de verificación del harness DTD Cargo.
 *
 * Corre, en orden: lint → rsc-boundary → typecheck → test → docs:check → e2e.
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
  // E2E (Playwright) — captura bugs de interacción cliente que vitest NO ve
  // (ej. el estimado de la calculadora que desaparecía al tocar el panel de
  // medidas). Va ÚLTIMO: los checks rápidos fallan primero. Reusa el dev server
  // de este worktree si está corriendo (ver e2ePreflight); si no, levanta el
  // suyo en un puerto PROPIO por worktree (e2ePort, derivado del hash del cwd)
  // → dos ventanas nunca colisionan. Los specs Tier-3 que piden seed se auto-omiten sin creds.
  {
    name: "e2e",
    argv: ["node_modules/@playwright/test/cli.js", "test"],
    env: { E2E_PORT: String(e2ePort()) },
    retry: 1,
    preflight: e2ePreflight,
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
  for (let i = 1; i <= attempts; i++) {
    r = spawnSync(process.execPath, step.argv, { stdio: "inherit", cwd: process.cwd(), env });
    if (r.status === 0) break;
    if (i < attempts) {
      console.log(`${C.dim}   ${step.name} falló (exit ${r.status ?? "señal " + r.signal}) → reintento ${i}/${attempts - 1} (flaky conocido)${C.nc}`);
    }
  }
  if (r.status === 0) ok(step.name);
  else {
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
