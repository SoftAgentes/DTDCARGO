/** Worktree lifecycle safety. Cleanup is a Director-reviewed manual operation. */
import { spawnSync } from 'node:child_process';
import { existsSync, realpathSync, writeFileSync, readFileSync, unlinkSync, lstatSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function isValidSlug(slug) {
  return typeof slug === 'string' && slug.length <= 60 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
    && !/^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i.test(slug);
}
export function worktreePathFor(mainWorktree, slug) {
  if (!isValidSlug(slug)) throw new Error('Slug inválido; usa kebab-case seguro.');
  return path.join(path.dirname(mainWorktree), 'DTD-worktrees', slug);
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
function git(args, cwd = process.cwd()) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return { code: r.status ?? 1, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
}
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
function safeTarget(slug) {
  const entries = worktrees();
  const main = realpathSync(entries[0].path);
  const target = worktreePathFor(main, slug);
  const container = path.dirname(target);
  if (existsSync(container) && (lstatSync(container).isSymbolicLink() || normalize(realpathSync(container)) !== normalize(container))) throw new Error('Contenedor de worktrees redirigido: revisión manual requerida.');
  if (existsSync(target) && (lstatSync(target).isSymbolicLink() || normalize(realpathSync(target)) !== normalize(target))) throw new Error('Worktree redirigido: revisión manual requerida.');
  return { target, entries };
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
function readClaim(root) {
  const file = claimPath(root);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8'));
}
function main() {
  const args = parseArgs(process.argv.slice(2));
  switch (args.cmd) {
    case 'start': {
      const { target } = safeTarget(args.slug);
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
      const { target, entries } = safeTarget(args.slug);
      const entry = entries.find((e) => normalize(e.path) === normalize(target));
      if (!entry || !existsSync(target)) throw new Error('El candidato no es un worktree registrado y disponible.');
      const status = mustGit(['status', '--porcelain=v1', '--untracked-files=all'], target);
      const ignored = mustGit(['ls-files', '--others', '--ignored', '--exclude-standard'], target);
      const claim = readClaim(target);
      const head = mustGit(['rev-parse', 'HEAD'], target);
      const remote = git(['rev-parse', '--verify', 'refs/remotes/origin/main']);
      const included = remote.code === 0 ? git(['merge-base', '--is-ancestor', head, remote.out]).code === 0 : null;
      console.log(JSON.stringify({ candidate: target, branch: entry.branch ?? null, head, hasChanges: Boolean(status), hasIgnoredFiles: Boolean(ignored), claim, includedInCachedOriginMain: included, cleanupAuthorized: false }, null, 2));
      console.log('Solo informe: no borra ni poda. origin/main es una referencia local que puede estar atrasada. El claim no prueba ausencia de otras sesiones. El Director debe verificar sesiones, procesos, archivos ignorados y publicación con remoto actualizado antes de limpieza manual: docs/runbooks/codex-engineering.md#cleanup.');
      break;
    }
    case 'list': console.log(mustGit(['worktree', 'list'])); break;
    case undefined: case 'help': case '--help': case '-h':
      console.log('harness-worktree start <slug> [--from <ref>] [--dry-run]\nharness-worktree guard [--owner <id>]\nharness-worktree claim|release --owner <id> [--dry-run]\nharness-worktree finish <slug> [--dry-run] (solo informe)\nharness-worktree list\nDefault: codex/<slug>, origin/main, --no-track. Sin copias de entorno ni instalación implícita.');
      break;
    default: throw new Error(`Comando desconocido: ${args.cmd}`);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
