/**
 * SDD-0370: lifecycle local, sin push/merge/prune ni borrados de respaldo.
 * El GO y la comprobación externa de tareas/procesos pertenecen al responsable.
 * Contrato: docs/runbooks/git-worktrees-multiventana.md.
 */
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, realpathSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

export function isValidSlug(slug) {
  return typeof slug === "string" && slug.length > 0 && slug.length <= 60
    && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
    && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(slug);
}

export function worktreePathFor(mainWorktree, slug) {
  return path.join(path.dirname(mainWorktree), "DTD-worktrees", slug);
}

export function branchFor(slug) {
  return `codex/${slug}`;
}

export function parseArgs(argv) {
  const out = {
    cmd: argv[0], slug: undefined, from: "origin/main", dryRun: false,
    deleteBranch: false, confirmIdle: undefined, handoff: undefined,
  };
  if (![undefined, "help", "--help", "-h", "start", "finish", "list"].includes(out.cmd)) {
    throw new Error("Comando desconocido.");
  }
  const allowed = out.cmd === "start" ? ["--dry-run", "--from"]
    : out.cmd === "finish" ? ["--dry-run", "--delete-branch", "--confirm-idle", "--handoff"] : [];
  const seen = new Set();
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("-") && out.slug === undefined && ["start", "finish"].includes(out.cmd)) {
      out.slug = arg;
      continue;
    }
    if (!allowed.includes(arg) || seen.has(arg)) throw new Error("Argumento desconocido, duplicado o fuera de contexto.");
    seen.add(arg);
    if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "--delete-branch") out.deleteBranch = true;
    else {
      const value = argv[++i];
      if (!value || value.startsWith("-") || /[\r\n\0]/.test(value)) throw new Error(`Falta un valor válido para ${arg}.`);
      out[{ "--from": "from", "--confirm-idle": "confirmIdle", "--handoff": "handoff" }[arg]] = value;
    }
  }
  return out;
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

const normalize = (value) => process.platform === "win32" ? path.resolve(value).toLowerCase() : path.resolve(value);
const samePath = (left, right) => normalize(left) === normalize(right);
const oidPattern = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;

function assertGitEnvironment() {
  const redirects = /^(GIT_(DIR|WORK_TREE|COMMON_DIR|INDEX_FILE|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|NAMESPACE|CONFIG|CONFIG_COUNT|CONFIG_PARAMETERS|PREFIX|GRAFT_FILE|SHALLOW_FILE))$/i;
  requireCondition(!Object.keys(process.env).some((key) => redirects.test(key)), "Hay variables Git que redirigen el repositorio; retíralas antes de operar.");
}

function git(cwd, args) {
  const result = spawnSync("git", ["--no-replace-objects", "--literal-pathspecs", "-C", cwd, ...args], {
    encoding: "utf8", timeout: 30_000, maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" },
  });
  return { code: result.error || result.signal ? 1 : result.status ?? 1, out: result.stdout ?? "" };
}

function checkedGit(cwd, args) {
  const result = git(cwd, args);
  // No imprimir stderr: un fallo de transporte puede contener URL/credenciales.
  requireCondition(result.code === 0, `Git no pudo completar ${args[0]}; no se aplican atajos.`);
  return result.out;
}

function commitAt(cwd, ref) {
  const sha = checkedGit(cwd, ["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`]).trim();
  requireCondition(oidPattern.test(sha), "Git no devolvió un commit válido.");
  return sha;
}

function worktrees(cwd) {
  return checkedGit(cwd, ["worktree", "list", "--porcelain", "-z"])
    .split("\0\0").filter(Boolean).map((record) => Object.fromEntries(record.split("\0").filter(Boolean).map((line) => {
      const space = line.indexOf(" ");
      return space < 0 ? [line, true] : [line.slice(0, space), line.slice(space + 1)];
    })));
}

/** No seguir junctions ni enlaces, incluidos padres existentes del destino nuevo. */
function assertPlainPath(candidate) {
  let current = path.resolve(candidate);
  while (true) {
    try {
      requireCondition(!lstatSync(current).isSymbolicLink(), "La ruta contiene un enlace o junction; revisar fuera del helper.");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  if (existsSync(candidate)) requireCondition(samePath(realpathSync(candidate), candidate), "La ruta física no coincide con la registrada.");
}

function context(slug) {
  requireCondition(isValidSlug(slug), "Falta un slug válido en kebab-case (sin nombres reservados).");
  assertGitEnvironment();
  const entries = worktrees(process.cwd());
  const primary = entries[0];
  requireCondition(primary?.worktree && !primary.bare, "No se reconoce un checkout principal normal.");
  const main = path.resolve(primary.worktree);
  const target = worktreePathFor(main, slug);
  assertPlainPath(main);
  assertPlainPath(target);
  const common = checkedGit(main, ["rev-parse", "--git-common-dir"]).trim();
  requireCondition(!existsSync(path.resolve(main, common, "info/grafts")), "Hay info/grafts; no se puede demostrar la historia real.");
  requireCondition(!samePath(main, target) && samePath(path.dirname(target), path.join(path.dirname(main), "DTD-worktrees")), "Destino fuera del contenedor permitido.");
  return { main, target, entries };
}

function remoteHead(main, branch) {
  const ref = `refs/heads/${branch}`;
  const rows = checkedGit(main, ["ls-remote", "--exit-code", "--refs", "origin", ref]).trim().split(/\r?\n/);
  requireCondition(rows.length === 1, "No se pudo demostrar el SHA remoto exacto.");
  const [sha, found] = rows[0].split(/\s+/);
  requireCondition(found === ref && oidPattern.test(sha), "Respuesta remota inesperada.");
  return sha;
}

function assertClean(cwd, { ignored = false } = {}) {
  const flags = checkedGit(cwd, ["ls-files", "-v", "-z"]).split("\0").filter(Boolean);
  requireCondition(!flags.some((entry) => /^[a-zS]/.test(entry)), "El índice tiene assume-unchanged/skip-worktree; no se puede demostrar limpieza.");
  requireCondition(checkedGit(cwd, ["status", "--porcelain=v1", "--untracked-files=all"]).length === 0, "Hay cambios staged, unstaged o untracked; se conserva el checkout.");
  const operations = ["MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "rebase-merge", "rebase-apply", "BISECT_LOG"];
  // SDD-0376: Git resuelve las seis rutas en un proceso; no inferirlas desde .git.
  // Se repite esta lectura en ambas raíces y en las dos inspecciones del cierre.
  const statePaths = checkedGit(cwd, [
    "rev-parse", "--path-format=absolute", ...operations.flatMap((name) => ["--git-path", name]),
  ]).replace(/\r?\n$/, "").split(/\r?\n/);
  requireCondition(statePaths.length === operations.length && statePaths.every((statePath, index) =>
    path.isAbsolute(statePath) && path.basename(statePath) === operations[index]),
  "Git devolvió rutas de operación incompletas o ambiguas; se conserva el checkout.");
  requireCondition(!statePaths.some((statePath) => existsSync(statePath)), "Hay una operación Git en curso.");
  if (ignored) {
    const names = checkedGit(cwd, ["ls-files", "--others", "--ignored", "--exclude-standard", "--directory", "-z"]).split("\0").filter(Boolean);
    requireCondition(names.length === 0, `Hay archivos ignorados que requieren preservación/retiro previo: ${JSON.stringify(names.slice(0, 20))}`);
    requireCondition(!checkedGit(cwd, ["ls-files", "--stage", "-z"]).split("\0").some((entry) => entry.startsWith("160000 ")), "El candidato contiene submódulos; necesita revisión separada.");
  }
}

function handoffBlob(cwd, ref, relative) {
  const entry = checkedGit(cwd, ["ls-tree", "-z", ref, "--", relative]).split("\0").filter(Boolean);
  requireCondition(entry.length === 1 && /^(100644|100755) blob /.test(entry[0]), "El handoff no es un archivo regular versionado.");
  const [metadata, name] = entry[0].split("\t");
  requireCondition(name === relative, "El handoff no coincide con la ruta solicitada.");
  return metadata.split(" ")[2];
}

/** Snapshot local repetible. Ninguna condición se delega al resultado de remove. */
function inspectFinish(args) {
  const { main, target, entries } = context(args.slug);
  requireCondition(samePath(process.cwd(), main), "finish sólo puede ejecutarse desde la raíz del checkout principal.");
  requireCondition(checkedGit(main, ["symbolic-ref", "--quiet", "HEAD"]).trim() === "refs/heads/main", "El principal debe estar en main.");
  const record = entries.find((entry) => entry.worktree && samePath(entry.worktree, target));
  requireCondition(record && !record.locked && !record.prunable && !record.detached && !record.bare, "Candidato no registrado, bloqueado, detached o prunable.");
  requireCondition([`refs/heads/codex/${args.slug}`, `refs/heads/feat/${args.slug}`].includes(record.branch), "La rama registrada no corresponde al candidato.");
  requireCondition(existsSync(target) && lstatSync(target).isDirectory(), "La carpeta candidata no está disponible.");
  const targetRoot = checkedGit(target, ["rev-parse", "--show-toplevel"]).replace(/\r?\n$/, "");
  requireCondition(samePath(targetRoot, target), "El candidato redirige a otro checkout.");
  const commonFor = (cwd) => path.resolve(cwd, checkedGit(cwd, ["rev-parse", "--git-common-dir"]).trim());
  requireCondition(samePath(commonFor(target), commonFor(main)), "El candidato apunta a otro repositorio.");
  assertClean(main);
  assertClean(target, { ignored: true });
  const head = commitAt(target, "HEAD");
  const branch = record.branch.slice("refs/heads/".length);
  requireCondition(record.HEAD === head && commitAt(main, record.branch) === head, "El HEAD o la rama cambiaron durante la comprobación.");
  requireCondition(args.confirmIdle === head, "Falta --confirm-idle con el HEAD completo: comprobar externamente ownership, tareas, sesiones y procesos; la opción no concede autorización.");
  const relative = args.handoff?.replaceAll("\\", "/");
  requireCondition(relative && !path.posix.isAbsolute(relative) && !path.win32.isAbsolute(relative)
    && !/[\x00-\x1f:]/.test(relative) && relative.split("/").every((part) => part && part !== "." && part !== ".."), "Falta --handoff con una ruta relativa segura.");
  for (const cwd of [main, target]) {
    const file = path.join(cwd, relative);
    assertPlainPath(file);
    requireCondition(existsSync(file) && lstatSync(file).isFile(), "El handoff no está preservado como archivo regular.");
  }
  const mainHead = commitAt(main, "refs/heads/main");
  const publishedMain = commitAt(main, "refs/remotes/origin/main");
  requireCondition(mainHead === publishedMain, "main local no coincide con origin/main; integrar/publicar es una operación separada.");
  requireCondition(git(main, ["merge-base", "--is-ancestor", head, mainHead]).code === 0, "El candidato no está contenido en main.");
  requireCondition(checkedGit(main, ["config", "--get", `branch.${branch}.remote`]).trim() === "origin"
    && checkedGit(main, ["config", "--get", `branch.${branch}.merge`]).trim() === record.branch, "Upstream incorrecto: debe ser la misma rama en origin.");
  const upstream = checkedGit(main, ["for-each-ref", "--format=%(upstream)", record.branch]).trim();
  requireCondition(upstream === `refs/remotes/origin/${branch}` && commitAt(main, upstream) === head, "Rama y upstream no coinciden exactamente.");
  const blob = handoffBlob(main, head, relative);
  requireCondition(blob === handoffBlob(main, mainHead, relative), "El handoff del candidato no está preservado con el mismo contenido en main.");
  return { main, target, branch, head, mainHead, blob };
}

function start(args) {
  const { main, target } = context(args.slug);
  const branch = branchFor(args.slug);
  requireCondition(!existsSync(target), "La carpeta ya existe; no se reutiliza.");
  requireCondition(git(main, ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]).code === 1, "La rama existe o no se pudo verificar su ausencia.");
  const base = commitAt(main, args.from);
  if (["origin/main", "refs/remotes/origin/main"].includes(args.from)) {
    requireCondition(remoteHead(main, "main") === base, "origin/main está desactualizado; refrescar referencias es una operación previa.");
  }
  console.log(JSON.stringify({ action: "start", worktree: target, branch, base, dryRun: args.dryRun }));
  if (args.dryRun) return;
  assertPlainPath(target);
  // Un SHA fija la base comprobada incluso si la ref cambia antes de crear.
  checkedGit(main, ["worktree", "add", "--no-track", "-b", branch, target, base]);
  requireCondition(checkedGit(target, ["for-each-ref", "--format=%(upstream)", `refs/heads/${branch}`]).trim() === "", "Se creó un upstream inesperado; conservar el worktree y revisar.");
  // Comando estático: shell es necesario para pnpm.cmd en Windows, sin input interpolado.
  const installed = spawnSync("pnpm install --frozen-lockfile", { cwd: target, stdio: "inherit", shell: true });
  requireCondition(!installed.error && installed.status === 0, "La instalación falló; el worktree se conserva, pero no está listo. Revisar pnpm install --frozen-lockfile.");
  console.log("Worktree listo. No se copiaron variables ni secretos.");
}

function finish(args, removeWorktree) {
  const proof = inspectFinish(args);
  requireCondition(remoteHead(proof.main, "main") === proof.mainHead, "main remoto cambió o la referencia local está desactualizada.");
  requireCondition(remoteHead(proof.main, proof.branch) === proof.head, "La rama remota no coincide con el HEAD del candidato.");
  console.log(JSON.stringify({ action: "finish", ...proof, deleteBranch: args.deleteBranch, dryRun: args.dryRun }));
  // El responsable mantiene exclusividad. No se promete una transacción entre Git y el SO.
  requireCondition(JSON.stringify(inspectFinish(args)) === JSON.stringify(proof), "El estado cambió durante la comprobación; se conserva el worktree.");
  if (args.dryRun) return;
  const removed = removeWorktree(proof.main, ["worktree", "remove", "--", proof.target]);
  requireCondition(removed.code === 0, "git worktree remove falló: no habrá force, fallback, prune ni borrado de rama. Revisar estado físico y registro antes de reintentar.");
  requireCondition(!existsSync(proof.target) && !worktrees(proof.main).some((entry) => entry.worktree && samePath(entry.worktree, proof.target)), "La retirada no quedó confirmada; la rama se conserva.");
  console.log("Worktree retirado y ausencia verificada; su contenido versionado sigue publicado e integrado.");
  if (args.deleteBranch) {
    requireCondition(commitAt(proof.main, `refs/heads/${proof.branch}`) === proof.head && commitAt(proof.main, "HEAD") === proof.mainHead, "La rama cambió después de retirar la carpeta; no se borra.");
    checkedGit(proof.main, ["branch", "-d", "--", proof.branch]);
    console.log("Rama local retirada con -d; la rama remota se conserva.");
  }
}

/** La inyección acotada sólo permite probar un error operativo de remove tras los gates. */
export function runWorktreeCommand(argv, { removeWorktree = git } = {}) {
  const args = parseArgs(argv);
  if (args.cmd === "start") return start(args);
  if (args.cmd === "finish") return finish(args, removeWorktree);
  if (args.cmd === "list") {
    assertGitEnvironment();
    console.log(checkedGit(process.cwd(), ["worktree", "list"]));
    return;
  }
  console.log(`harness-worktree — SDD-0370
  start <slug> [--from <ref>] [--dry-run]
  finish <slug> --confirm-idle <HEAD-completo> --handoff <ruta-relativa> [--delete-branch] [--dry-run]
  list

start: codex/<slug>, base origin/main actual, sin secretos; instalación congelada.
finish: sólo desde main principal, limpio/actual y con candidato publicado/integrado.
Comprobar externamente GO, ownership, tareas, sesiones y procesos ANTES de --confirm-idle.
Los ignorados bloquean: preservarlos/retirarlos previamente con autorización separada.
No hay push, merge, deploy, prune global, force ni fallback de borrado.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { runWorktreeCommand(process.argv.slice(2)); }
  catch (error) {
    console.error(`OPERACIÓN BLOQUEADA / LIMPIEZA BLOQUEADA: ${error.message}`);
    process.exitCode = 1;
  }
}
