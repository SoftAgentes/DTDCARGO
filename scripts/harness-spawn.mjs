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
 *
 * EL `status` DE UN DESBORDAMIENTO NO ES DE FIAR; EL `error` SÍ
 * Medido el 2026-09-11 con Node 24 en las dos plataformas (60 corridas en Linux dentro de
 * `node:24`, provocando ENOBUFS con `git --version` y con `git ls-files`):
 *   - `r.error.code === "ENOBUFS"` apareció en el 100 % de los desbordamientos, siempre.
 *   - `r.status` NO: en Windows quedó `null` con SIGTERM, pero en Linux salió **0** en 51
 *     de 60 corridas, porque git alcanza a terminar bien antes de que el padre lo corte.
 * Por eso el error manda sobre el status. Creerle al status en Linux convertía un
 * desbordamiento en `{ code: 0, out: "" }`, es decir, en un éxito con salida vacía: un
 * worktree lleno de ignorados se habría informado como limpio, y `check-unpublished`
 * habría vuelto a imprimir [OK] sin listar una rama. Lo encontró la CI en Linux.
 */
import { spawnSync } from "node:child_process";

/** Holgado a propósito: ninguna salida de texto real del harness se le acerca. */
export const MAX_BUFFER = 64 * 1024 * 1024;

/**
 * Traduce el resultado crudo de `spawnSync` a `{ code, out, err }`. Pura y exportada
 * para poder fijar por prueba el caso que la CI destapó: `status: 0` con `error` puesto.
 */
export function normalizeGitResult(r, args) {
  // El error manda: un desbordamiento con status 0 es un fallo, no un éxito con salida vacía.
  if (r.error) return { code: r.status || 1, out: "", err: `git ${args.join(" ")}: ${r.error.message}` };
  return { code: r.status ?? 1, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
}

/**
 * Corre git y devuelve `{ code, out, err }`, nunca una excepción.
 * `err` trae el stderr de git o, si `spawnSync` falló, el motivo real (ENOBUFS, ENOENT…).
 *
 * @param {string[]} args
 * @param {string} [cwd]
 * @param {number} [maxBuffer]
 */
export function runGit(args, cwd = process.cwd(), maxBuffer = MAX_BUFFER) {
  return normalizeGitResult(spawnSync("git", args, { cwd, encoding: "utf8", maxBuffer }), args);
}
