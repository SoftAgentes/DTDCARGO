#!/usr/bin/env node
/**
 * harness-verify-hook.mjs — Hook `Stop` "inteligente" del harness DTD Cargo.
 *
 * Corre el gate (`node scripts/verify.mjs`) SOLO si hay cambios sin commitear en
 * CÓDIGO (`app/`, `lib/`, `supabase/`). En charlas / docs / diseño NO corre → el
 * cierre del turno es instantáneo. Si tocaste código y el gate queda ROJO, BLOQUEA
 * el cierre (exit 2) y devuelve el error a Claude para que lo arregle.
 *
 * Se registra como hook `Stop` en `.claude/settings.json`. Diseño defensivo:
 *   - Respeta `stop_hook_active` (anti-loop infinito).
 *   - Fail-open: cualquier error propio → exit 0 (nunca te traba por un bug del hook).
 */
import { readFileSync } from "node:fs";
import { execSync, spawnSync } from "node:child_process";

// 1. Input del hook por stdin. Si ya venimos de un stop-hook, no re-bloquear (anti-loop).
let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8") || "{}");
} catch {
  /* sin stdin / no-JSON → seguimos */
}
if (input.stop_hook_active) process.exit(0);

// 2. ¿Hay cambios sin commitear en código? (solo app/ lib/ supabase/)
let changed = "";
try {
  changed = execSync("git status --porcelain -- app lib supabase", { encoding: "utf8" });
} catch {
  process.exit(0); // sin git o error → fail-open
}
if (!changed.trim()) process.exit(0); // no tocaste código → cierre instantáneo

// 3. Tocaste código → corré el gate.
const r = spawnSync(process.execPath, ["scripts/verify.mjs"], { encoding: "utf8" });
if (r.status === 0) process.exit(0); // verde → dejar cerrar

// 4. Rojo → bloquear el cierre y mostrar el final del output a Claude.
const tail = ((r.stdout || "") + "\n" + (r.stderr || "")).slice(-1800);
process.stderr.write(
  "🛑 Harness gate en ROJO (hay cambios en app/lib/supabase). " +
    "Corré y arreglá `node scripts/verify.mjs` antes de cerrar:\n\n" +
    tail +
    "\n",
);
process.exit(2);
