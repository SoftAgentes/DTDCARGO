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
 *   - Respeta `stop_hook_active` (anti-loop infinito). Es la única salida si el gate
 *     nunca logra medirse: el segundo intento de cierre pasa.
 *   - Fail-open ante errores propios del hook: sin git, stdin raro o el aviso de
 *     publicación nunca traban el cierre.
 *   - Un gate SIN MEDIR (spawn fallido, salida desbordada, señal) bloquea igual que un
 *     ROJO, porque no hay veredicto; pero se anuncia como tal, nunca disfrazado de rojo.
 */
import { readFileSync } from "node:fs";
import { execSync, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { MAX_BUFFER } from "./harness-spawn.mjs";

// El búfer vive en harness-spawn.mjs. Acá importa por qué: spawnSync MATA al hijo al
// superarlo, así que con el 1 MB por defecto un `verify` largo moría a media corrida y el
// hook lo informaba como ROJO. 64 MB deja el corte fuera del alcance de cualquier salida
// de texto real; si aun así se cruza, ahora se dice en vez de inventar un veredicto.

/**
 * Veredicto del gate. Solo un exit 0 deja cerrar: un rojo bloquea por su veredicto y un
 * gate sin medir (spawn fallido, salida desbordada, señal) bloquea por la ausencia de él.
 * `medido` separa los dos motivos, que el mensaje nunca debe confundir.
 */
export function clasificarGate(resultado) {
  if (resultado.error) {
    const motivo = resultado.error.code === "ENOBUFS"
      ? `el gate se canceló al pasar de ${Math.round(MAX_BUFFER / 1024 / 1024)} MB de salida capturada`
      : `el gate no se pudo lanzar: ${resultado.error.message}`;
    return { bloquea: true, medido: false, motivo };
  }
  if (resultado.status === null) {
    return { bloquea: true, medido: false, motivo: `el gate terminó por la señal ${resultado.signal ?? "desconocida"}, sin código de salida` };
  }
  if (resultado.status === 0) return { bloquea: false, medido: true, motivo: "verde" };
  return { bloquea: true, medido: true, motivo: `ROJO (exit ${resultado.status})` };
}

function main() {
  // 1. Input del hook por stdin. Si ya venimos de un stop-hook, no re-bloquear (anti-loop).
  let input = {};
  try {
    input = JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    /* sin stdin / no-JSON → seguimos */
  }
  if (input.stop_hook_active) return 0;

  // 2. ¿Hay cambios sin commitear en código? (solo app/ lib/ supabase/)
  let changed = "";
  try {
    changed = execSync("git status --porcelain -- app lib supabase", { encoding: "utf8", maxBuffer: MAX_BUFFER });
  } catch {
    return 0; // sin git o error → fail-open
  }
  // 2b. Trabajo COMMITEADO que nunca se publicó. Va antes del corto-circuito
  //     porque es justo el estado en el que no hay cambios sin commitear: todo
  //     prolijo, todo verde, y la rama nunca pusheada. Así se perdió SDD-0091.
  //     Es un AVISO en stderr, no un bloqueo: hay ramas legítimamente a medias.
  try {
    const u = spawnSync(process.execPath, ["scripts/check-unpublished.mjs"], {
      encoding: "utf8",
      maxBuffer: MAX_BUFFER,
    });
    if ((u.stdout || "").includes("[AVISO]")) process.stderr.write(u.stdout);
  } catch {
    /* el aviso nunca traba el cierre */
  }

  if (!changed.trim()) return 0; // no tocaste código → cierre instantáneo

  // 3. Tocaste código → corre el gate.
  const r = spawnSync(process.execPath, ["scripts/verify.mjs"], { encoding: "utf8", maxBuffer: MAX_BUFFER });
  const veredicto = clasificarGate(r);
  if (!veredicto.bloquea) return 0; // verde → dejar cerrar

  // 4. Bloquear el cierre y mostrar el final del output a Claude. El rojo medido y el gate
  //    sin medir comparten el exit 2, pero jamás el mensaje: son cosas distintas.
  const tail = ((r.stdout || "") + "\n" + (r.stderr || "")).slice(-1800);
  const encabezado = veredicto.medido
    ? `🛑 Harness gate en ${veredicto.motivo} — hay cambios en app/lib/supabase. ` +
      "Corré y arreglá `node scripts/verify.mjs` antes de cerrar:"
    : `🛑 Harness gate SIN MEDIR: ${veredicto.motivo}. No hay veredicto, así que el cierre se ` +
      "bloquea igual: hay que correr `node scripts/verify.mjs` a mano y confirmar que está " +
      "verde. Cola de lo que alcanzó a correr:";
  process.stderr.write(encabezado + "\n\n" + tail + "\n");
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main());
