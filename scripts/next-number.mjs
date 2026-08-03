/**
 * scripts/next-number.mjs — ¿qué número de spec/migración está libre DE VERDAD?
 *
 * SIN SHEBANG a propósito (mismo motivo que los otros checks: el `#!` rompe el
 * parser de Vite si el módulo se importa desde un test).
 *
 * POR QUÉ EXISTE
 * "Mirar el disco local" no alcanza: hay 15-20 worktrees en paralelo y cada uno
 * ve sólo su rama. El 29-jul hubo CUATRO colisiones en un día. Este script mira
 * **todas las refs** (locales y remotas) después de un `git fetch`, así que ve
 * los números que otras ventanas ya tomaron aunque todavía no estén en tu árbol.
 *
 * PERO EL FETCH NO CIERRA LA CARRERA. Entre que numerás y que pusheás pueden
 * pasar horas — que es exactamente cómo se duplicó la spec 0175. Para cerrarla
 * hay que RESERVAR: publicar el número en `main` apenas lo decidís.
 *
 * ⭐ LA RESERVA NO ES UN COMMIT VACÍO. Un commit sin archivos no reserva nada:
 * el próximo `next-number` escanea CARPETAS, no mensajes de commit, así que
 * vería el número libre igual. La reserva crea el `spec.md` de verdad (stub en
 * `status: draft`), que es lo que hace visible el número para todo el mundo.
 *
 * ⚠️ CADA RESERVA DISPARA UN DEPLOY DE PRODUCCIÓN. `vercel.json` no tiene
 * `ignoreCommand`, así que cualquier push a `main` —aunque sea sólo docs—
 * construye. Por eso `--reserve` **prepara y NO pushea**: te imprime el comando
 * exacto para que el push sea una decisión tuya, no un efecto secundario.
 *
 * Uso:
 *   node scripts/next-number.mjs                    → próximo libre de spec y de migración
 *   node scripts/next-number.mjs --reserve <slug>   → prepara la reserva (no pushea)
 *   node scripts/next-number.mjs --reserve <slug> --push   → reserva y publica
 *   node scripts/next-number.mjs --no-fetch         → sin red (usa lo que ya tienes)
 *
 * Exit: 0 = ok · 1 = error de uso o de git
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const C = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  dim: "\x1b[2m",
  yellow: "\x1b[33m",
  bold: "\x1b[1m",
  nc: "\x1b[0m",
};

function git(args, opts = {}) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", opts.quiet ? "ignore" : "inherit"],
    ...opts,
  }).trim();
}

/**
 * Todos los números ya tomados en CUALQUIER ref (local o remota).
 *
 * `git ls-tree` por ref en vez de `git log -S` o de leer el disco: es lo único
 * que ve el árbol REAL de cada rama, incluidas las de otras ventanas que
 * todavía no mergeaste.
 *
 * @param {"specs"|"migrations"} kind
 * @returns {Set<number>}
 */
export function takenNumbers(kind, refs, lsTree) {
  const dir = kind === "specs" ? "docs/specs" : "supabase/migrations";
  const re =
    kind === "specs"
      ? /docs\/specs\/(\d{4})/
      : /supabase\/migrations\/(\d{4})/;
  const taken = new Set();
  for (const ref of refs) {
    for (const line of lsTree(ref, dir)) {
      const m = line.match(re);
      if (m) taken.add(parseInt(m[1], 10));
    }
  }
  return taken;
}

/** El primer número libre por encima del máximo tomado. */
export function nextFree(taken) {
  const max = taken.size ? Math.max(...taken) : 0;
  return max + 1;
}

const pad = (n) => String(n).padStart(4, "0");

function allRefs() {
  return git([
    "for-each-ref",
    "--format=%(refname:short)",
    "refs/heads",
    "refs/remotes",
  ])
    .split(/\r?\n/)
    .filter(Boolean);
}

function lsTreeFactory() {
  return (ref, dir) => {
    try {
      return git(["ls-tree", "-r", "--name-only", ref, "--", dir], {
        quiet: true,
      }).split(/\r?\n/);
    } catch {
      return []; // ref sin ese directorio → nada que aportar
    }
  };
}

const STUB = (num, slug, hoy) => `---
sdd: "${num}"
title: "RESERVADO — ${slug}"
status: draft
author: "Claude Code"
created: ${hoy}
updated: ${hoy}
supersedes: null
superseded_by: null
related: []
confidencialidad: interno
---

# SDD-${num} — RESERVADO

Número reservado el ${hoy} para evitar que dos ventanas lo tomen a la vez
(\`scripts/next-number.mjs --reserve\`). El contenido llega en el commit del
trabajo real.

Si esta spec sigue así después de unos días, o el trabajo se abandonó o alguien
se olvidó de llenarla: preguntá antes de reusar el número.
`;

/**
 * Arma la reserva SIN tocar tu working tree ni tu rama: escribe el blob, arma
 * un índice temporal a partir del árbol de origin/main, y crea el commit con
 * `commit-tree`. Tu rama queda exactamente igual que antes.
 */
function prepararReserva(num, slug, hoy) {
  const rel = `docs/specs/${num}-${slug}/spec.md`;
  const tmpIndex = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "dtd-reserva-")),
    "index",
  );
  const tmpFile = path.join(path.dirname(tmpIndex), "spec.md");
  fs.writeFileSync(tmpFile, STUB(num, slug, hoy), "utf8");

  const blob = git(["hash-object", "-w", tmpFile]);
  const env = { ...process.env, GIT_INDEX_FILE: tmpIndex };
  git(["read-tree", "origin/main"], { env });
  git(["update-index", "--add", "--cacheinfo", `100644,${blob},${rel}`], { env });
  const tree = git(["write-tree"], { env });
  const commit = git([
    "commit-tree",
    tree,
    "-p",
    "origin/main",
    "-m",
    `chore(sdd): reserva SDD-${num} — ${slug}\n\nNúmero reservado para que otra ventana no lo tome (ver scripts/next-number.mjs).\nLa spec real llega en el commit del trabajo.`,
  ]);
  return { commit, rel };
}

function main(argv) {
  const noFetch = argv.includes("--no-fetch");
  const doPush = argv.includes("--push");
  const ri = argv.indexOf("--reserve");
  const slug = ri !== -1 ? argv[ri + 1] : null;

  if (ri !== -1 && (!slug || slug.startsWith("--"))) {
    console.error(
      `${C.red}✖${C.nc} --reserve necesita un slug: node scripts/next-number.mjs --reserve portal-estado-de-cuenta`,
    );
    return 1;
  }
  if (slug && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    console.error(
      `${C.red}✖${C.nc} el slug va en kebab-case, sin acentos ni mayúsculas: '${slug}'`,
    );
    return 1;
  }

  if (!noFetch) {
    try {
      git(["fetch", "--quiet", "origin"], { quiet: true });
    } catch {
      console.warn(
        `${C.yellow}⚠${C.nc} no pude hacer fetch (¿sin red?) — los números pueden estar viejos`,
      );
    }
  }

  const refs = allRefs();
  const lsTree = lsTreeFactory();
  const specs = takenNumbers("specs", refs, lsTree);
  const migs = takenNumbers("migrations", refs, lsTree);
  const nextSpec = pad(nextFree(specs));
  const nextMig = pad(nextFree(migs));

  console.log(`${C.dim}   ${refs.length} refs miradas (locales + remotas)${C.nc}`);
  console.log(`   spec libre     → ${C.bold}${C.green}${nextSpec}${C.nc}`);
  console.log(`   migración libre → ${C.bold}${C.green}${nextMig}${C.nc}`);

  if (!slug) {
    console.log(
      `${C.dim}\n   Para que nadie te lo pise mientras trabajas:\n` +
        `     node scripts/next-number.mjs --reserve <slug>${C.nc}`,
    );
    return 0;
  }

  const { commit, rel } = prepararReserva(nextSpec, slug, new Date().toISOString().slice(0, 10));
  console.log(`\n${C.green}✓${C.nc} reserva preparada: ${C.bold}${rel}${C.nc}`);
  console.log(`${C.dim}   commit ${commit} (sobre origin/main · tu rama NO se tocó)${C.nc}`);

  if (!doPush) {
    console.log(
      `\n${C.yellow}⚠ Falta publicarla${C.nc} — hasta que no esté en main, no reserva nada:\n` +
        `     ${C.bold}git push origin ${commit}:refs/heads/main${C.nc}\n` +
        `${C.dim}   Ojo: eso dispara un deploy de producción (vercel.json no tiene ignoreCommand).\n` +
        `   Después, en tu rama: git fetch origin && git merge origin/main${C.nc}`,
    );
    return 0;
  }

  git(["push", "origin", `${commit}:refs/heads/main`]);
  console.log(`${C.green}✓${C.nc} publicada en main. Ahora: git fetch origin && git merge origin/main`);
  return 0;
}

const isEntryPoint =
  process.argv[1] && import.meta.filename === path.resolve(process.argv[1]);

if (isEntryPoint) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    console.error(`${C.red}✖${C.nc} ${e?.message ?? e}`);
    process.exitCode = 1;
  }
}
