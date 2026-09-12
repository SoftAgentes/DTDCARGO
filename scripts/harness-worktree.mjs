/** Worktree lifecycle safety. Cleanup is a Director-reviewed manual operation. */
import { existsSync, realpathSync, writeFileSync, readFileSync, readdirSync, unlinkSync, lstatSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runGit } from './harness-spawn.mjs';

export function isValidSlug(slug) {
  return typeof slug === 'string' && slug.length <= 60 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
    && !/^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i.test(slug);
}
const CODEX_CONTAINER = 'DTD-worktrees';
const CLAUDE_CONTAINER = path.join('.claude', 'worktrees');
export function worktreePathFor(mainWorktree, slug) {
  if (!isValidSlug(slug)) throw new Error('Slug inválido; usa kebab-case seguro.');
  return path.join(path.dirname(mainWorktree), CODEX_CONTAINER, slug);
}
/**
 * Los dos contenedores donde este repo aloja worktrees vinculados: el de la metodología
 * Codex, que `start` crea, y el que la app de Claude Code crea dentro del propio checkout.
 * Es un filtro de pertenencia, nunca una fuente: el candidato de `finish` sale siempre de
 * `git worktree list`, jamás de una ruta armada con el nombre que se pasó.
 */
export function worktreeContainers(mainWorktree) {
  return [path.join(path.dirname(mainWorktree), CODEX_CONTAINER), path.join(mainWorktree, CLAUDE_CONTAINER)];
}
export function branchFor(slug) {
  if (!isValidSlug(slug)) throw new Error('Slug inválido.');
  return `codex/${slug}`;
}
export function parseArgs(argv) {
  const out = { cmd: argv[0], slug: undefined, from: 'origin/main', dryRun: false, deleteBranch: false, owner: undefined };
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--delete-branch') out.deleteBranch = true;
    else if (arg === '--from' || arg === '--owner') {
      const value = argv[++i];
      if (!value || value.startsWith('-')) throw new Error(`Falta valor de ${arg}.`);
      out[arg.slice(2)] = value;
    } else if (!arg.startsWith('-') && out.slug === undefined) out.slug = arg;
    else throw new Error(`Argumento desconocido: ${arg}`);
  }
  if (out.owner !== undefined && !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(out.owner)) throw new Error('Owner inválido.');
  if (out.deleteBranch) throw new Error('--delete-branch retirado: limpieza manual por el Director; consulta docs/runbooks/codex-engineering.md#cleanup.');
  if (out.slug !== undefined && !['start', 'finish'].includes(out.cmd)) throw new Error('Este comando opera sobre el worktree actual, sin slug.');
  if (argv.includes('--from') && out.cmd !== 'start') throw new Error('--from solo aplica a start.');
  if (out.owner !== undefined && !['claim', 'release', 'guard'].includes(out.cmd)) throw new Error('--owner solo aplica a claim, release o guard.');
  return out;
}
// Buffer and spawn-error handling live in harness-spawn.mjs: a worktree with dependencies
// emits listings far past the 1 MB spawnSync default, and ENOBUFS used to abort finish.
const git = runGit;
function mustGit(args, cwd) {
  const r = git(args, cwd);
  if (r.code !== 0) throw new Error(r.err || `git ${args[0]} falló.`);
  return r.out;
}
const normalize = (p) => process.platform === 'win32' ? path.resolve(p).toLowerCase() : path.resolve(p);
function worktrees() {
  return mustGit(['worktree', 'list', '--porcelain', '-z']).split('\0\0').filter(Boolean).map((entry) => {
    const fields = entry.split('\0');
    return { path: fields.find((f) => f.startsWith('worktree '))?.slice(9), branch: fields.find((f) => f.startsWith('branch '))?.slice(7) };
  });
}
function assertNotRedirected(target) {
  const container = path.dirname(target);
  if (existsSync(container) && (lstatSync(container).isSymbolicLink() || normalize(realpathSync(container)) !== normalize(container))) throw new Error('Contenedor de worktrees redirigido: revisión manual requerida.');
  if (existsSync(target) && (lstatSync(target).isSymbolicLink() || normalize(realpathSync(target)) !== normalize(target))) throw new Error('Worktree redirigido: revisión manual requerida.');
  return target;
}
function startTarget(slug) {
  const entries = worktrees();
  return assertNotRedirected(worktreePathFor(realpathSync(entries[0].path), slug));
}
const sameName = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
const nameList = (entries) => entries.length ? [...entries.map((e) => path.basename(e.path))].sort().join(', ') : 'ninguno';
/**
 * Candidato de `finish`, resuelto contra la lista real de `git worktree list`. Antes se armaba
 * la ruta con `worktreePathFor`, así que el comando solo veía `DTD-worktrees/<slug>` y respondía
 * «Slug inválido» o «no es un worktree registrado» ante los de `.claude/worktrees/`, donde hoy
 * trabaja buena parte de las sesiones: un cierre que mira medio universo es el mismo verde por
 * omisión que SDD-0457 quitó de `check-unpublished`. Sin nombre informa sobre el worktree donde
 * se corre —ahí no hay ambigüedad que resolver, así que no se exige contenedor conocido—; con
 * nombre exige pertenecer a `worktreeContainers`. El checkout principal nunca es candidato.
 *
 * Pura y exportada. El nombre solo se **compara** con entradas ya registradas y nunca se
 * concatena a una ruta, así que `..`, separadores o un nombre absoluto no pueden señalar nada
 * de fuera: como mucho no coinciden con ninguna entrada.
 *
 * @param {{path: string, branch?: string}[]} entries — `git worktree list`, principal primero.
 * @param {string} main — ruta real del checkout principal.
 * @param {string|undefined} name — nombre del directorio del worktree; sin él, el actual.
 * @param {string|null} cwdRoot — raíz del worktree desde donde se corre, o null si no se pudo saber.
 */
export function resolveCandidate(entries, main, name, cwdRoot) {
  const containers = worktreeContainers(main);
  const linked = entries.filter((e) => normalize(e.path) !== normalize(main));
  const eligible = linked.filter((e) => containers.some((c) => normalize(path.dirname(e.path)) === normalize(c)));
  if (name === undefined) {
    const here = cwdRoot === null ? undefined : linked.find((e) => normalize(e.path) === normalize(cwdRoot));
    if (here) return here;
    const donde = cwdRoot === null ? 'no se pudo determinar desde dónde corrés' : normalize(cwdRoot) === normalize(main)
      ? `estás en el checkout principal (${cwdRoot}), que nunca es candidato` : `${cwdRoot} no es un worktree vinculado de este repo`;
    throw new Error(`Sin nombre, finish informa sobre el worktree actual, y ${donde}. Pasá el nombre del directorio. Candidatos: ${nameList(eligible)}.`);
  }
  const matches = eligible.filter((e) => sameName(path.basename(e.path), name));
  if (matches.length > 1) throw new Error(`«${name}» nombra ${matches.length} worktrees registrados (${matches.map((e) => e.path).join('; ')}): corré finish sin nombre desde el que te toca.`);
  if (matches.length === 0) throw new Error(`No hay worktree registrado llamado «${name}». finish resuelve contra git worktree list y acepta los de ${containers.join(' y ')}. Candidatos: ${nameList(eligible)}.`);
  return matches[0];
}
function claimPath(root) {
  return path.join(mustGit(['rev-parse', '--absolute-git-dir'], root), 'harness-session-claim.json');
}
function guard(owner) {
  const root = realpathSync(mustGit(['rev-parse', '--show-toplevel']));
  const entries = worktrees();
  const entry = entries.find((e) => normalize(e.path) === normalize(root));
  if (!entry || normalize(realpathSync(entries[0].path)) === normalize(root)) throw new Error('Trabajo rechazado: el checkout principal no es un workspace de implementación.');
  if (!entry.branch || entry.branch === 'refs/heads/main') throw new Error('Trabajo rechazado: main o HEAD detached.');
  const gitDir = mustGit(['rev-parse', '--absolute-git-dir']);
  const common = mustGit(['rev-parse', '--path-format=absolute', '--git-common-dir']);
  if (normalize(gitDir) === normalize(common)) throw new Error('Se requiere un linked worktree.');
  if (owner !== undefined) {
    const claim = readClaim(root);
    if (!claim || claim.owner !== owner) throw new Error('La sesión no posee el claim de este worktree.');
  }
  return root;
}
// `.env*` names are evidence for the Director; this command never opens them.
export const isSensitiveIgnoredName = (name) => /^\.env/i.test(name);
const IGNORED_PREVIEW = 50;
const baseName = (entry) => entry.replace(/\/+$/, '').split('/').pop();
function childEntries(root, dir) {
  const full = path.join(root, dir);
  if (!existsSync(full)) return [];
  const stat = lstatSync(full);
  if (stat.isSymbolicLink() || !stat.isDirectory()) return [];
  return readdirSync(full).map((name) => dir + name);
}
/**
 * Compact inventory of ignored entries. `--directory` collapses a wholly ignored directory into one
 * line, so a 25 MB listing of node_modules becomes a handful of entries. Collapsed directories are
 * expanded one level so a nested .env is still named. Report only: nothing is opened, moved or removed.
 */
export function ignoredReport(target) {
  const entries = mustGit(['ls-files', '--others', '--ignored', '--exclude-standard', '--directory', '-z'], target).split('\0').filter(Boolean);
  const nested = entries.filter((entry) => entry.endsWith('/')).flatMap((dir) => childEntries(target, dir));
  const sensitive = [...new Set([...entries, ...nested].filter((entry) => isSensitiveIgnoredName(baseName(entry))))].sort();
  return { count: entries.length, preview: entries.slice(0, IGNORED_PREVIEW), sensitive };
}
function readClaim(root) {
  const file = claimPath(root);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8'));
}
function main() {
  const args = parseArgs(process.argv.slice(2));
  switch (args.cmd) {
    case 'start': {
      const target = startTarget(args.slug);
      const branch = branchFor(args.slug);
      if (existsSync(target)) throw new Error(`Ya existe ${target}.`);
      if (git(['show-ref', '--verify', '--quiet', `refs/heads/${branch}`]).code === 0) throw new Error(`Ya existe ${branch}.`);
      const base = mustGit(['rev-parse', '--verify', '--end-of-options', `${args.from}^{commit}`]);
      console.log(JSON.stringify({ worktree: target, branch, from: args.from, commit: base, dryRun: args.dryRun }));
      if (!args.dryRun) mustGit(['worktree', 'add', '--no-track', '-b', branch, target, base]);
      console.log('Entorno y dependencias requieren preparación explícita.');
      break;
    }
    case 'guard': console.log(`Guard OK: ${guard(args.owner)}`); break;
    case 'claim': {
      if (!args.owner) throw new Error('claim requiere --owner <id-de-sesión>.');
      const root = guard();
      if (args.dryRun) {
        if (readClaim(root)) throw new Error('El worktree ya tiene claim.');
        console.log('Dry-run: claim disponible; no reservado.');
        break;
      }
      // Exclusive create is the authority. No TTL, PID inference or automatic takeover.
      writeFileSync(claimPath(root), JSON.stringify({ owner: args.owner, createdAt: new Date().toISOString(), worktree: root }) + '\n', { flag: 'wx', mode: 0o600 });
      console.log(`Claim adquirido: ${args.owner}`);
      break;
    }
    case 'release': {
      if (!args.owner) throw new Error('release requiere --owner <id-de-sesión>.');
      const root = guard(args.owner);
      if (!args.dryRun) unlinkSync(claimPath(root));
      console.log(args.dryRun ? 'Dry-run: claim conservado.' : 'Claim liberado.');
      break;
    }
    case 'finish': {
      const entries = worktrees();
      const here = git(['rev-parse', '--show-toplevel']);
      const entry = resolveCandidate(entries, realpathSync(entries[0].path), args.slug, here.code === 0 ? here.out : null);
      // `path.resolve` para que el informe use los separadores de la plataforma: git los devuelve con `/` también en Windows.
      const target = assertNotRedirected(path.resolve(entry.path));
      if (!existsSync(target)) throw new Error(`El worktree «${path.basename(target)}» está registrado pero no existe en disco (${target}): revisión manual del Director.`);
      const status = mustGit(['status', '--porcelain=v1', '--untracked-files=all'], target);
      const ignored = ignoredReport(target);
      const claim = readClaim(target);
      const head = mustGit(['rev-parse', 'HEAD'], target);
      const remote = git(['rev-parse', '--verify', 'refs/remotes/origin/main']);
      const included = remote.code === 0 ? git(['merge-base', '--is-ancestor', head, remote.out]).code === 0 : null;
      console.log(JSON.stringify({ candidate: target, branch: entry.branch ?? null, head, hasChanges: Boolean(status), hasIgnoredFiles: ignored.count > 0, ignoredEntryCount: ignored.count, ignoredEntries: ignored.preview, sensitiveIgnoredFiles: ignored.sensitive, claim, includedInCachedOriginMain: included, cleanupAuthorized: false }, null, 2));
      console.log('Solo informe: no borra ni poda. El inventario ignorado es compacto: un directorio ignorado completo se colapsa en una entrada y solo se expande un nivel para nombrar archivos sensibles, nunca para leerlos; `ignoredEntries` muestra hasta 50 y `ignoredEntryCount` da el total. origin/main es una referencia local que puede estar atrasada. El claim no prueba ausencia de otras sesiones. El Director debe verificar sesiones, procesos, archivos ignorados y publicación con remoto actualizado antes de limpieza manual: docs/runbooks/codex-engineering.md#cleanup.');
      break;
    }
    case 'list': console.log(mustGit(['worktree', 'list'])); break;
    case undefined: case 'help': case '--help': case '-h':
      console.log('harness-worktree start <slug> [--from <ref>] [--dry-run]\nharness-worktree guard [--owner <id>]\nharness-worktree claim|release --owner <id> [--dry-run]\nharness-worktree finish [<nombre>] [--dry-run] (solo informe)\nharness-worktree list\nDefault: codex/<slug>, origin/main, --no-track. Sin copias de entorno ni instalación implícita.\nstart siempre crea en DTD-worktrees/<slug>; finish informa sobre cualquier worktree registrado de DTD-worktrees/ o .claude/worktrees/, y sin nombre sobre el actual.');
      break;
    default: throw new Error(`Comando desconocido: ${args.cmd}`);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
