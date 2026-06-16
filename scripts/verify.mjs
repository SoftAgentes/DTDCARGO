#!/usr/bin/env node
/**
 * scripts/verify.mjs — Gate de verificación del harness DTD Cargo.
 *
 * Corre, en orden: lint → rsc-boundary → typecheck → test → docs:check.
 * Es el "init.sh real" del proyecto, multiplataforma (Node, cero deps).
 *
 * Invoca cada binario con `node <entry>` DIRECTO (no vía `pnpm <script>`) a propósito:
 * en este entorno `pnpm run` dispara un preflight `install` que falla con
 * ERR_PNPM_IGNORED_BUILDS (esbuild). Llamar al entry JS lo esquiva.
 *
 * Uso:  node scripts/verify.mjs   ·   o:  pnpm verify
 * Exit: 0 = todo verde · 1 = al menos un check falló (corre TODOS y los lista).
 */
import { spawnSync } from "node:child_process";

const C = { green: "\x1b[32m", red: "\x1b[31m", dim: "\x1b[2m", nc: "\x1b[0m" };
const ok = (m) => console.log(`${C.green}[OK]${C.nc}   ${m}`);
const fail = (m) => console.log(`${C.red}[FAIL]${C.nc} ${m}`);

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
];

const failures = [];
for (const step of STEPS) {
  console.log(`\n${C.dim}── ${step.name} ──────────────────────────────────${C.nc}`);
  const attempts = (step.retry ?? 0) + 1;
  let r;
  for (let i = 1; i <= attempts; i++) {
    r = spawnSync(process.execPath, step.argv, { stdio: "inherit", cwd: process.cwd() });
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
