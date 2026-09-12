/**
 * scripts/harness-spawn.mjs — subprocesos del harness: un búfer y un helper de git.
 *
 * SIN SHEBANG a propósito (mismo motivo que check-unpublished.mjs): se importa desde
 * tests y el `#!` rompe el parser de Vite.
 *
 * POR QUÉ EXISTE
 * `spawnSync` y `execSync` capturan hasta `maxBuffer` y, al pasarse, **matan al hijo**
 * y dejan el error solo en `r.error`, con `status` en null y `stderr` vacío. Con el 1 MB
 * por defecto eso rompió tres cosas del harness, cada una a su manera:
 *   - `finish` abortaba con «git ls-files falló.» en cualquier worktree con dependencias
 *     (231.105 rutas ignoradas, ~25 MB);
 *   - el hook `Stop` mataba `verify.mjs` a media corrida y lo informaba ROJO;
 *   - `check-unpublished` podía imprimir [OK] sin haber listado una sola rama.
 *
 * Los tres compartían la causa y la cura, así que el búfer y el helper viven acá en vez
 * de repetidos. Nada de esto oculta errores: un fallo de spawn se nombra y sigue siendo
 * código ≠ 0.
 */
import { spawnSync } from "node:child_process";

/** Holgado a propósito: ninguna salida de texto real del harness se le acerca. */
export const MAX_BUFFER = 64 * 1024 * 1024;

/**
 * Corre git y devuelve `{ code, out, err }`, nunca una excepción.
 * `err` trae el stderr de git o, si `spawnSync` falló, el motivo real (ENOBUFS, ENOENT…).
 *
 * @param {string[]} args
 * @param {string} [cwd]
 * @param {number} [maxBuffer]
 */
export function runGit(args, cwd = process.cwd(), maxBuffer = MAX_BUFFER) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", maxBuffer });
  // Un fallo de spawn deja status en null y stderr vacío: se nombra en vez de perderlo.
  if (r.error) return { code: r.status ?? 1, out: "", err: `git ${args.join(" ")}: ${r.error.message}` };
  return { code: r.status ?? 1, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
}
