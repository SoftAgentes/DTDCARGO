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
// Un campo del porcelain es `clave` pelada o `clave valor`. `bare` y `detached` llegan siempre
// pelados; `locked` y `prunable`, de las dos formas —`locked` a secas cuando se bloqueó sin razón,
// `prunable gitdir file points to non-existent location` cuando git la da—, medido con git 2.55.
// Por eso el booleano mira las dos formas y la razón solo la segunda: bloqueado sin razón es
// `locked: true` con `lockedReason: null`, que es un bloqueo deliberado del que git no guardó motivo,
// nunca un bloqueo invisible.
const hasField = (fields, key) => fields.some((f) => f === key || f.startsWith(`${key} `));
const fieldValue = (fields, key) => fields.find((f) => f.startsWith(`${key} `))?.slice(key.length + 1) ?? null;
/**
 * Registros de `git worktree list --porcelain -z`, **tal cual los emite git**: no se descarta
 * ninguno y no se reordena. `entries[0]` sigue siendo el primer registro del porcelain, que es la
 * invariante sobre la que `mainWorktreeFrom` verifica el principal; filtrar acá la entrada bare se
 * la sacaría de abajo. Quién no es candidato lo decide cada consumidor con el flag `bare`.
 *
 * El `-z` no es cosmético: sin él git **cita y escapa en octal** la razón de un lock con caracteres
 * no ASCII (`locked "el Director lo pidi\303\263"`), así que la razón cruda solo sale de este
 * formato. Medido con git 2.55.
 *
 * Pura y exportada para fijar por prueba el parseo sobre una salida literal, incluido el registro
 * bare y las dos formas de `locked`, sin depender de armar el repo que los produce.
 *
 * @param {string} porcelain — salida de `git worktree list --porcelain -z`.
 */
export function parseWorktrees(porcelain) {
  return porcelain.split('\0\0').filter(Boolean).map((entry) => {
    const fields = entry.split('\0');
    // `bare` es un campo sin valor: marca el repo común cuando no tiene checkout propio.
    return {
      path: fieldValue(fields, 'worktree'),
      branch: fieldValue(fields, 'branch'),
      bare: fields.includes('bare'),
      locked: hasField(fields, 'locked'),
      lockedReason: fieldValue(fields, 'locked'),
      prunable: hasField(fields, 'prunable'),
      prunableReason: fieldValue(fields, 'prunable'),
    };
  });
}
function worktrees() {
  return parseWorktrees(mustGit(['worktree', 'list', '--porcelain', '-z']));
}
/**
 * Checkout principal **verificado**, o `null` cuando no hay ninguno.
 *
 * `entries[0]` era el principal por convención del porcelain, y nadie preguntaba si existía.
 * Medido con git 2.55: en un repo no bare el principal se lista primero siempre —da igual desde
 * qué worktree se consulte, y da igual que otro se llame `aaa`—, así que la posición no estaba
 * mal; lo que faltaba era la pregunta. Si el repo común es **bare** no hay checkout principal,
 * `entries[0]` es el propio bare, y quien lo tratara como principal razonaría sobre una ruta que
 * no es un árbol de trabajo. Descartar la entrada bare sin más es peor: el primero pasa a ser el
 * worktree de un Worker y el harness lo declara «checkout principal», rechazando su `guard`.
 *
 * Acá no se elige: si no hay principal se devuelve `null` y cada consumidor decide qué hacer con
 * el «no sé», que nunca puede ser contestar igual que cuando sí lo hay.
 *
 * La posición se **verifica** en vez de confiarse, con una sola condición: el checkout principal
 * es el árbol cuyo `.git` es el directorio común, o sea `dirname(--git-common-dir)`. En un repo
 * normal eso da `entries[0]` y coincide; en uno bare el común es el propio `repo.git`, cuyo
 * `dirname` es su carpeta contenedora y nunca el `entries[0]` que el porcelain trae —el bare
 * mismo—, así que no coincide y la respuesta es `null`. Una primera versión sumaba a esto el
 * flag `bare` y un chequeo del nombre `.git`; la mutación mostró que **ninguno de los dos
 * cambiaba un resultado** y se fueron: la comparación sola los cubre. El flag se sigue leyendo
 * en `worktrees()`, pero para otra cosa —excluir esa entrada de los candidatos—, y eso sí lo
 * fija una prueba.
 *
 * Ojo con la vía obvia: `git rev-parse --is-bare-repository` devuelve **`false`** desde un
 * worktree linked de un repo bare (medido), así que confirma la hipótesis equivocada.
 *
 * Pura y exportada para poder fijar por prueba el caso bare sin depender del repo donde corre.
 *
 * @param {{path: string, bare?: boolean}[]} entries — `git worktree list --porcelain`.
 * @param {string|null} commonDir — `git rev-parse --path-format=absolute --git-common-dir`.
 * @returns {string|null} ruta del checkout principal, o null si no hay o no se pudo verificar.
 */
export function mainWorktreeFrom(entries, commonDir) {
  if (!entries.length || !entries[0].path || !commonDir) return null;
  return normalize(path.dirname(commonDir)) === normalize(entries[0].path) ? entries[0].path : null;
}
/** Lee la lista y el common-dir juntos: el principal se verifica contra los dos. */
function repoState() {
  const entries = worktrees();
  const common = git(['rev-parse', '--path-format=absolute', '--git-common-dir']);
  const main = mainWorktreeFrom(entries, common.code === 0 ? common.out : null);
  return { entries, main: main === null ? null : realpathSync(main) };
}
const SIN_PRINCIPAL = 'Este repo no tiene checkout principal verificable (el repo común es bare, o su git-common-dir no cuelga de un árbol de trabajo)';
function assertNotRedirected(target) {
  const container = path.dirname(target);
  if (existsSync(container) && (lstatSync(container).isSymbolicLink() || normalize(realpathSync(container)) !== normalize(container))) throw new Error('Contenedor de worktrees redirigido: revisión manual requerida.');
  if (existsSync(target) && (lstatSync(target).isSymbolicLink() || normalize(realpathSync(target)) !== normalize(target))) throw new Error('Worktree redirigido: revisión manual requerida.');
  return target;
}
function startTarget(slug) {
  const { main } = repoState();
  // `start` deriva el contenedor del principal: sin principal no hay dónde crear, y adivinar
  // un hermano de un repo bare sería inventar la respuesta que no existe.
  if (main === null) throw new Error(`${SIN_PRINCIPAL}, así que start no puede decidir dónde crear el worktree. Creá el árbol a mano con git worktree add y corré guard adentro.`);
  return assertNotRedirected(worktreePathFor(main, slug));
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
 * Sin checkout principal (`main === null`) los dos caminos se separan en vez de igualarse: el
 * que no lo necesita —informar sobre el worktree donde se corre— sigue funcionando, y el que sí
 * lo necesita —resolver por nombre, que deriva los contenedores del principal— se niega con
 * motivo en vez de resolver contra rutas inventadas a partir de un repo bare.
 *
 * @param {{path: string, branch?: string, bare?: boolean}[]} entries — `git worktree list`.
 * @param {string|null} main — checkout principal verificado, o null si no hay ninguno.
 * @param {string|undefined} name — nombre del directorio del worktree; sin él, el actual.
 * @param {string|null} cwdRoot — raíz del worktree desde donde se corre, o null si no se pudo saber.
 */
export function resolveCandidate(entries, main, name, cwdRoot) {
  const containers = main === null ? null : worktreeContainers(main);
  const linked = entries.filter((e) => !e.bare && (main === null || normalize(e.path) !== normalize(main)));
  const eligible = containers === null ? [] : linked.filter((e) => containers.some((c) => normalize(path.dirname(e.path)) === normalize(c)));
  const candidatos = containers === null ? `Worktrees vinculados: ${nameList(linked)}` : `Candidatos: ${nameList(eligible)}`;
  if (name === undefined) {
    const here = cwdRoot === null ? undefined : linked.find((e) => normalize(e.path) === normalize(cwdRoot));
    if (here) return here;
    const donde = cwdRoot === null ? 'no se pudo determinar desde dónde corrés' : main !== null && normalize(cwdRoot) === normalize(main)
      ? `estás en el checkout principal (${cwdRoot}), que nunca es candidato` : `${cwdRoot} no es un worktree vinculado de este repo`;
    throw new Error(`Sin nombre, finish informa sobre el worktree actual, y ${donde}. Pasá el nombre del directorio. ${candidatos}.`);
  }
  if (containers === null) throw new Error(`${SIN_PRINCIPAL}, y los contenedores que finish acepta se derivan de él, así que no puedo resolver «${name}» por nombre. Corré finish sin nombre desde el worktree que querés informar. ${candidatos}.`);
  const matches = eligible.filter((e) => sameName(path.basename(e.path), name));
  if (matches.length > 1) throw new Error(`«${name}» nombra ${matches.length} worktrees registrados (${matches.map((e) => e.path).join('; ')}): corré finish sin nombre desde el que te toca.`);
  if (matches.length === 0) throw new Error(`No hay worktree registrado llamado «${name}». finish resuelve contra git worktree list y acepta los de ${containers.join(' y ')}. ${candidatos}.`);
  return matches[0];
}
function claimPath(root) {
  return path.join(mustGit(['rev-parse', '--absolute-git-dir'], root), 'harness-session-claim.json');
}
function guard(owner) {
  const root = realpathSync(mustGit(['rev-parse', '--show-toplevel']));
  const { entries, main } = repoState();
  const entry = entries.find((e) => !e.bare && normalize(e.path) === normalize(root));
  if (!entry) throw new Error('Trabajo rechazado: este árbol no es un worktree registrado de este repo.');
  // Sin principal la comparación no se omite por comodidad: es que ninguno lo es, así que
  // ningún árbol puede ser rechazado por serlo. El chequeo de linked worktree de más abajo
  // sigue siendo el que impide trabajar sobre el repo común.
  if (main !== null && normalize(main) === normalize(root)) throw new Error('Trabajo rechazado: el checkout principal no es un workspace de implementación.');
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
      const { entries, main } = repoState();
      const here = git(['rev-parse', '--show-toplevel']);
      const entry = resolveCandidate(entries, main, args.slug, here.code === 0 ? here.out : null);
      // `path.resolve` para que el informe use los separadores de la plataforma: git los devuelve con `/` también en Windows.
      const target = assertNotRedirected(path.resolve(entry.path));
      if (!existsSync(target)) throw new Error(`El worktree «${path.basename(target)}» está registrado pero no existe en disco (${target}): revisión manual del Director.`);
      const status = mustGit(['status', '--porcelain=v1', '--untracked-files=all'], target);
      const ignored = ignoredReport(target);
      const claim = readClaim(target);
      const head = mustGit(['rev-parse', 'HEAD'], target);
      const remote = git(['rev-parse', '--verify', 'refs/remotes/origin/main']);
      const included = remote.code === 0 ? git(['merge-base', '--is-ancestor', head, remote.out]).code === 0 : null;
      console.log(JSON.stringify({ candidate: target, branch: entry.branch ?? null, head, hasChanges: Boolean(status), hasIgnoredFiles: ignored.count > 0, ignoredEntryCount: ignored.count, ignoredEntries: ignored.preview, sensitiveIgnoredFiles: ignored.sensitive, claim, locked: entry.locked, lockedReason: entry.lockedReason, prunable: entry.prunable, prunableReason: entry.prunableReason, includedInCachedOriginMain: included, cleanupAuthorized: false }, null, 2));
      console.log('Solo informe: no borra ni poda. El inventario ignorado es compacto: un directorio ignorado completo se colapsa en una entrada y solo se expande un nivel para nombrar archivos sensibles, nunca para leerlos; `ignoredEntries` muestra hasta 50 y `ignoredEntryCount` da el total. origin/main es una referencia local que puede estar atrasada. El claim no prueba ausencia de otras sesiones. `locked` y `prunable` repiten lo que dice git del candidato —que alguien lo marcó a propósito, con su razón si la dio, y que git ya lo considera desechable— como evidencia para la limpieza manual, no como decisión: este informe no poda ni desbloquea nada. Un candidato ausente en disco se sigue rechazando por `existsSync` y no por lo que opine git: si git y el disco discrepan, manda el disco. El Director debe verificar sesiones, procesos, archivos ignorados y publicación con remoto actualizado antes de limpieza manual: docs/runbooks/codex-engineering.md#cleanup.');
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
