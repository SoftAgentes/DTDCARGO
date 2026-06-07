#!/usr/bin/env node
/**
 * scripts/harness-worktree.mjs — gestión de worktrees del harness DTD Cargo.
 *
 * Aísla cada feature/lane en su propia carpeta (worktree) para que el trabajo
 * NUNCA caiga en `main` (la rama de integración). Implementa la pieza
 * "diseñada-no-construida" del runbook git-worktrees-multiventana §8.
 *
 * Uso:
 *   node scripts/harness-worktree.mjs start  <slug> [--from <ref>] [--dry-run]
 *   node scripts/harness-worktree.mjs finish <slug> [--delete-branch] [--dry-run]
 *   node scripts/harness-worktree.mjs list
 *
 * Convenciones (ver el runbook):
 *   - Worktrees agrupados en el contenedor `<parent>/DTD-worktrees/<slug>`
 *     (hermano del repo principal, NUNCA anidado adentro). Decisión founder.
 *   - Rama `feat/<slug>` creada off `main` (local) por default → sin upstream
 *     = cero footgun de `git push` a main.
 *   - `start` copia `.env.local` (gitignored, no viaja) + corre `pnpm install`.
 *   - `finish` remueve el worktree manejando el long-path de Windows (robocopy
 *     /MIR de fallback) + prune. NO mergea, NO pushea (gate del founder).
 */

import { spawnSync } from "node:child_process";
import { existsSync, copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

// ── colores ──
const C = { g: "\x1b[32m", r: "\x1b[31m", y: "\x1b[33m", d: "\x1b[2m", n: "\x1b[0m" };
const ok = (m) => console.log(`${C.g}✓${C.n} ${m}`);
const warn = (m) => console.log(`${C.y}⚠${C.n} ${m}`);
const info = (m) => console.log(m);
function die(m) {
  console.error(`${C.r}✗ ${m}${C.n}`);
  process.exit(1);
}

// ────────────────────────────────────────────────
// Helpers PUROS (exportados para test, sin side effects)
// ────────────────────────────────────────────────

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Slug válido = kebab-case (a-z, 0-9, guiones simples; sin bordes ni dobles). */
export function isValidSlug(slug) {
  return (
    typeof slug === "string" &&
    slug.length > 0 &&
    slug.length <= 60 &&
    SLUG_RE.test(slug)
  );
}

/** Carpeta del worktree para un slug, dado el path del worktree principal. */
export function worktreePathFor(mainWorktree, slug) {
  return path.join(path.dirname(mainWorktree), "DTD-worktrees", slug);
}

/** Rama de un slug. */
export function branchFor(slug) {
  return `feat/${slug}`;
}

/** Parsea argv (sin `node script`): { cmd, slug, from, dryRun, deleteBranch }. */
export function parseArgs(argv) {
  const out = {
    cmd: argv[0],
    slug: undefined,
    from: "main",
    dryRun: false,
    deleteBranch: false,
  };
  const rest = argv.slice(1);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--delete-branch") out.deleteBranch = true;
    else if (a === "--from") out.from = rest[++i];
    else if (!a.startsWith("--") && out.slug === undefined) out.slug = a;
  }
  return out;
}

// ────────────────────────────────────────────────
// git / shell (side effects)
// ────────────────────────────────────────────────

function git(args) {
  const r = spawnSync("git", args, { encoding: "utf8" });
  return {
    code: r.status ?? 1,
    out: (r.stdout || "").trim(),
    err: ((r.stdout || "") + (r.stderr || "")).trim(),
  };
}

function gitInherit(args) {
  return spawnSync("git", args, { stdio: "inherit" }).status ?? 1;
}

function refExists(ref) {
  return git(["rev-parse", "--verify", "--quiet", ref]).code === 0;
}

/** pnpm en Windows es `pnpm.cmd` (sin shell:true → evita el DEP0190). */
function pnpmInstall(wt) {
  const bin = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  // pnpm puede salir 0 con ERR_PNPM_IGNORED_BUILDS (esbuild) → benigno.
  return spawnSync(bin, ["-C", wt, "install"], { stdio: "inherit" }).status ?? 1;
}

/** Path del worktree principal (el primero de `git worktree list --porcelain`). */
function mainWorktreePath() {
  const r = git(["worktree", "list", "--porcelain"]);
  if (r.code !== 0) die("No es un repo git (o git no está en PATH).");
  const first = r.out.split("\n").find((l) => l.startsWith("worktree "));
  if (!first) die("No pude determinar el worktree principal.");
  return path.normalize(first.slice("worktree ".length).trim());
}

/** ¿`wt` es un worktree REGISTRADO por git? Guard del fallback destructivo:
 *  nunca borramos a ciegas una carpeta que git no reconoce como worktree. */
function isRegisteredWorktree(wt) {
  const r = git(["worktree", "list", "--porcelain"]);
  if (r.code !== 0) return false;
  const norm = (p) => (process.platform === "win32" ? path.resolve(p).toLowerCase() : path.resolve(p));
  const target = norm(wt);
  return r.out
    .split("\n")
    .filter((l) => l.startsWith("worktree "))
    .some((l) => norm(l.slice("worktree ".length).trim()) === target);
}

// ────────────────────────────────────────────────
// Comandos
// ────────────────────────────────────────────────

function cmdStart({ slug, from, dryRun }) {
  if (!slug) die("Falta <slug>. Ej: node scripts/harness-worktree.mjs start sdd-0061-fase-b");
  if (!isValidSlug(slug)) die(`Slug inválido "${slug}". Usá kebab-case (a-z, 0-9, guiones).`);

  const main = mainWorktreePath();
  const wt = worktreePathFor(main, slug);
  const branch = branchFor(slug);

  if (existsSync(wt)) die(`Ya existe la carpeta ${wt}.`);
  if (refExists(branch)) die(`La rama ${branch} ya existe. Elegí otro slug o borrala.`);
  if (!refExists(from)) die(`No encuentro la ref base "${from}".`);

  info(`${C.d}── start ${slug} ──────────────────────────${C.n}`);
  info(`  worktree: ${wt}`);
  info(`  rama:     ${branch}  (off ${from})`);
  if (dryRun) {
    warn("--dry-run: no ejecuto nada.");
    return;
  }

  if (gitInherit(["worktree", "add", "-b", branch, wt, from]) !== 0) die("git worktree add falló.");
  ok(`worktree creado en rama ${branch}`);

  // Sin upstream → cero footgun de `git push` a main (por si `from` era origin/main).
  git(["-C", wt, "branch", "--unset-upstream"]);

  const env = path.join(main, ".env.local");
  if (existsSync(env)) {
    copyFileSync(env, path.join(wt, ".env.local"));
    ok(".env.local copiado");
  } else {
    warn("no hay .env.local en el repo principal — copialo a mano si la app lo necesita");
  }

  info(`${C.d}pnpm install (store global hardlinkea → rápido)...${C.n}`);
  pnpmInstall(wt);
  ok("deps instaladas");

  info("");
  ok(`Lane "${slug}" listo.`);
  info(`  → Abrí una ventana de Claude/terminal en:  ${wt}`);
  info(`  → Y corré:  /feature ${slug}`);
  info(`  (recordá: NO implementes features en main; este es tu escritorio aislado)`);
}

/** Remueve el worktree; si falla por el long-path de Windows, hace fallback. */
function removeWorktreeRobust(wt) {
  // OJO: `git worktree remove` DESREGISTRA el worktree y RECIÉN DESPUÉS borra la carpeta;
  // si falla por el long-path, ya quedó desregistrado → un chequeo posterior daría
  // falso-negativo y dejaría la carpeta huérfana. Por eso capturamos el estado ANTES.
  // (lo cazó el dogfood: el guard que chequeaba después rompía el caso real)
  const wasRegistered = isRegisteredWorktree(wt);
  let r = git(["worktree", "remove", wt]);
  if (r.code === 0) return true;

  const e = r.err.toLowerCase();
  // Trabajo sin commitear → NO forzar (proteger). Avisar y parar.
  if (e.includes("use --force") || e.includes("modified or untracked") || e.includes("contains modified")) {
    die(`El worktree ${wt} tiene cambios sin commitear. Commiteá/descartá primero.`);
  }

  // GUARD DESTRUCTIVO: solo nukeamos si ERA un worktree registrado (antes del remove).
  // Una carpeta cualquiera homónima (que git nunca registró) NO se borra a ciegas.
  if (!wasRegistered) {
    die(`${wt} no es un worktree registrado de git — no lo borro a ciegas. Si es basura, borrala a mano.`);
  }

  // Long-path de Windows (node_modules > MAX_PATH) → fallback de borrado.
  warn(`git worktree remove falló (${r.err.split("\n").pop()}). Fallback de borrado...`);
  if (existsSync(wt)) {
    if (process.platform === "win32") {
      // robocopy /MIR de una carpeta vacía sobre el target = la vacía (maneja long-paths nativo).
      const empty = mkdtempSync(path.join(tmpdir(), "wt-empty-"));
      spawnSync(
        "robocopy",
        [empty, wt, "/MIR", "/NFL", "/NDL", "/NJH", "/NJS", "/NC", "/NS", "/R:1", "/W:1"],
        { stdio: "ignore" },
      );
      try { rmSync(wt, { recursive: true, force: true, maxRetries: 3 }); } catch { /* ignore */ }
      try { rmSync(empty, { recursive: true, force: true }); } catch { /* ignore */ }
    } else {
      try { rmSync(wt, { recursive: true, force: true, maxRetries: 3 }); } catch { /* ignore */ }
    }
  }
  git(["worktree", "prune"]);
  return !existsSync(wt);
}

function cmdFinish({ slug, deleteBranch, dryRun }) {
  if (!slug) die("Falta <slug>.");
  if (!isValidSlug(slug)) die(`Slug inválido "${slug}".`);

  const main = mainWorktreePath();
  const wt = worktreePathFor(main, slug);
  const branch = branchFor(slug);

  info(`${C.d}── finish ${slug} ─────────────────────────${C.n}`);
  if (!existsSync(wt)) warn(`la carpeta ${wt} no existe (¿ya removida?). Igual hago prune.`);
  else info(`  removiendo worktree ${wt}`);
  if (dryRun) {
    warn("--dry-run: no ejecuto. (finish NO mergea, NO pushea).");
    return;
  }

  if (removeWorktreeRobust(wt)) ok("worktree removido + prune");
  else die(`No pude borrar ${wt}. Cerrá procesos que la usen (dev server) y reintentá.`);

  if (deleteBranch) {
    // `git branch -d` chequea contra HEAD (la rama actual), no contra `main` → poco fiable
    // desde otro worktree. Verificamos explícitamente que la rama ya esté en `main`.
    if (!refExists(branch)) {
      warn(`la rama ${branch} no existe (¿ya borrada?).`);
    } else if (git(["merge-base", "--is-ancestor", branch, "main"]).code === 0) {
      const r = git(["branch", "-D", branch]); // -D seguro: ya verificamos que está en main.
      if (r.code === 0) ok(`rama ${branch} borrada (mergeada a main)`);
      else warn(`no pude borrar ${branch}: ${r.err.split("\n").pop()}`);
    } else {
      warn(`rama ${branch} NO borrada: tiene commits que main no tiene. Mergeala a main primero.`);
    }
  } else {
    info(`  rama ${branch} conservada (no se pierde el trabajo). Borrala con --delete-branch tras mergear.`);
  }
  info("");
  warn("finish NO mergea ni pushea. El merge a main + push los hacés vos con tu OK.");
}

function cmdList() {
  gitInherit(["worktree", "list"]);
}

function usage() {
  info(`harness-worktree — aísla cada feature en su worktree (evita trabajar en main)

  node scripts/harness-worktree.mjs start  <slug> [--from <ref>] [--dry-run]
  node scripts/harness-worktree.mjs finish <slug> [--delete-branch] [--dry-run]
  node scripts/harness-worktree.mjs list

  start  → crea DTD-worktrees/<slug> en rama feat/<slug> (off main) + .env.local + pnpm install
  finish → remueve el worktree (maneja long-path Windows) + prune; NO mergea, NO pushea
  list   → git worktree list`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  switch (args.cmd) {
    case "start":
      return cmdStart(args);
    case "finish":
      return cmdFinish(args);
    case "list":
      return cmdList();
    case "help":
    case "--help":
    case "-h":
    case undefined:
      return usage();
    default:
      warn(`comando desconocido: ${args.cmd}`);
      usage();
      process.exit(1);
  }
}

// CLI guard: solo ejecuta si se invoca directo (importable para tests sin side effects).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
