/**
 * scripts/check-unpublished.mjs — ¿hay trabajo commiteado que nunca se publicó?
 *
 * SIN SHEBANG a propósito (mismo motivo que check-numbering.mjs): se importa
 * desde su test y el `#!` rompe el parser de Vite.
 *
 * POR QUÉ EXISTE
 * El código de SDD-0091 (motor de flujo interno) SE PERDIÓ: tres rebanadas con
 * el gate en verde, en una rama que nunca se pusheó. La rama, los commits y el
 * worktree ya no existen en ningún checkout; sólo sobrevivió la spec. Y no fue
 * un caso aislado: las migraciones 0336/0337/0338 estuvieron TRES DÍAS
 * aplicadas en producción con su archivo colgando de un worktree sin publicar.
 *
 * Lo que fallaba no era la disciplina, era que **nadie lo medía**. El hook de
 * `Stop` sólo mira cambios SIN COMMITEAR (`git status`), así que un commit
 * hecho y no pusheado es invisible para él — justamente el estado en el que se
 * perdió SDD-0091.
 *
 * QUÉ MIDE
 * Toda rama local con commits que `origin/main` no tiene. Compara contra
 * **origin/main**, no contra `main` local: un `main` local atrasado hace que
 * todo parezca publicado (ése es el hueco que tenía `harness-worktree.mjs`).
 *
 * QUÉ **NO** HACE
 * No pushea, no borra, no falla el gate. Es un AVISO: hay ramas que legítimamente
 * están a medias. Lo que no puede pasar es que nadie las vea.
 *
 * LO QUE NO SE PUDO MEDIR TAMBIÉN SE DICE
 * Si git falla —listado, conteo o la base misma— sale [AVISO] con el motivo, nunca
 * [OK]. Un verde por un git que se rompió sería exactamente el agujero que esto tapa.
 *
 * Uso:  node scripts/check-unpublished.mjs [--fetch]
 * Exit: 0 siempre (informativo). 2 = bug del propio check.
 */
import { spawnSync } from "node:child_process";

const C = {
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  dim: "\x1b[2m",
  nc: "\x1b[0m",
};

// Mismo motivo que en harness-worktree.mjs y en el hook `Stop`: spawnSync corta —y mata
// al hijo— al pasar el 1 MB por defecto. Acá los listados son chicos y el riesgo es bajo,
// pero un corte silencioso pondría en verde justo el check que existe para que nada quede
// sin medir. El número se repite en los tres scripts a propósito: cada uno es autónomo.
export const GIT_MAX_BUFFER = 64 * 1024 * 1024;

export function runGit(args, maxBuffer = GIT_MAX_BUFFER) {
  const r = spawnSync("git", args, { encoding: "utf8", maxBuffer });
  // Un fallo de spawn deja status en null y stderr vacío: se nombra en vez de perderlo.
  if (r.error) return { code: r.status ?? 1, out: "", err: `git ${args.join(" ")}: ${r.error.message}` };
  return { code: r.status ?? 1, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
}

/**
 * Ramas locales con commits que `ref` no tiene. PURA respecto de git: recibe el
 * listado y el contador, así el test no necesita un repo de verdad.
 *
 * @param {string[]} ramas
 * @param {(rama: string) => number} contar  commits de `rama` ausentes en la base
 * @returns {{rama: string, commits: number}[]} ordenado de más a menos
 */
export function ramasSinPublicar(ramas, contar) {
  const out = [];
  for (const rama of ramas) {
    const n = contar(rama);
    if (n > 0) out.push({ rama, commits: n });
  }
  return out.sort((a, b) => b.commits - a.commits);
}

/** `ejecutar` se inyecta para poder probar los caminos en los que git falla. */
export function main(ejecutar = runGit) {
  if (process.argv.includes("--fetch")) ejecutar(["fetch", "origin", "main", "--quiet"]);

  const base = "origin/main";
  const verificada = ejecutar(["rev-parse", "--verify", base]);
  if (verificada.code !== 0) {
    console.log(
      `${C.yellow}[AVISO]${C.nc} sin ${base} (¿clone shallow o sin remoto?) — no se puede medir qué falta publicar` +
        (verificada.err ? `${C.dim} · ${verificada.err}${C.nc}` : ""),
    );
    return 0;
  }

  // Sin listado no hay medición. Un [OK] acá sería el falso verde que este check evita.
  const listado = ejecutar(["for-each-ref", "--format=%(refname:short)", "refs/heads"]);
  if (listado.code !== 0) {
    console.log(
      `${C.yellow}[AVISO]${C.nc} no se pudieron listar las ramas locales — qué falta publicar quedó SIN MEDIR` +
        `${C.dim} · ${listado.err || "git for-each-ref falló"}${C.nc}`,
    );
    return 0;
  }
  const ramas = listado.out.split("\n").map((x) => x.trim()).filter(Boolean);

  // Un conteo que falla no es una rama al día: se aparta en vez de contarse como 0.
  const sinMedir = [];
  const pendientes = ramasSinPublicar(ramas, (rama) => {
    const r = ejecutar(["rev-list", "--count", `${base}..${rama}`]);
    if (r.code !== 0) {
      sinMedir.push({ rama, motivo: r.err || "git rev-list falló" });
      return 0;
    }
    return Number(r.out) || 0;
  });

  if (pendientes.length === 0 && sinMedir.length === 0) {
    console.log(`${C.green}[OK]${C.nc}   sin trabajo commiteado fuera de ${base}`);
    return 0;
  }

  if (pendientes.length > 0) {
    console.log(
      `${C.yellow}[AVISO]${C.nc} ${pendientes.length} rama(s) con trabajo que NO está en ${base}:`,
    );
    for (const p of pendientes) {
      console.log(`${C.dim}   ${p.rama} → ${p.commits} commit(s) sin publicar${C.nc}`);
    }
    console.log(
      `${C.dim}   Una rama sin pushear con el gate verde NO es trabajo guardado: así se perdió SDD-0091.${C.nc}`,
    );
  }
  if (sinMedir.length > 0) {
    console.log(
      `${C.yellow}[AVISO]${C.nc} ${sinMedir.length} rama(s) SIN MEDIR contra ${base}:`,
    );
    for (const s of sinMedir) {
      console.log(`${C.dim}   ${s.rama} → ${s.motivo}${C.nc}`);
    }
  }
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith("check-unpublished.mjs")) {
  try {
    process.exit(main());
  } catch (e) {
    console.error("[check-unpublished] bug del check:", e);
    process.exit(2);
  }
}
