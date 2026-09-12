import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, lstatSync, realpathSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isValidSlug, worktreePathFor, worktreeContainers, resolveCandidate, mainWorktreeFrom, branchFor, parseArgs, isSensitiveIgnoredName, parseWorktrees } from '../harness-worktree.mjs';
import { MAX_BUFFER } from '../harness-spawn.mjs';
const script = fileURLToPath(new URL('../harness-worktree.mjs', import.meta.url));
function gitAt(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: MAX_BUFFER });
  assert.equal(r.status, 0, r.stderr); return r.stdout.trim();
}
// Al fallar devuelve también stderr: el mensaje de error es parte del contrato que se fija acá.
function cliAt(cwd, args, success) {
  const r = spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8', maxBuffer: MAX_BUFFER });
  assert.equal(r.status === 0, success, r.stdout + r.stderr); return success ? r.stdout : r.stdout + r.stderr;
}
// En Windows `tmpdir()` puede venir en forma 8.3 (AKXGEN~1) y git devuelve siempre la ruta
// larga: las rutas se comparan resueltas, no como cadenas. `.native` es lo que expande el 8.3;
// `realpathSync` a secas lo conserva y la comparación fallaba por eso.
const realPath = (p) => process.platform === 'win32' ? realpathSync.native(p).toLowerCase() : realpathSync.native(p);
const assertSamePath = (a, b) => assert.equal(realPath(a), realPath(b));
function sandboxRepo(t, prefix) {
  const sandbox = mkdtempSync(path.join(tmpdir(), prefix));
  // This fixture is the only recursive deletion target; never a real checkout.
  t.after(() => { assert.ok(path.resolve(sandbox).startsWith(path.resolve(tmpdir()) + path.sep)); rmSync(sandbox, { recursive: true, force: true }); });
  const repo = path.join(sandbox, 'repo'); mkdirSync(repo);
  const git = (args, cwd = repo) => gitAt(cwd, args);
  const cli = (args, cwd = repo, success = true) => cliAt(cwd, args, success);
  git(['init', '-b', 'main']); git(['config', 'user.email', 'test@example.invalid']); git(['config', 'user.name', 'Fixture']);
  return { sandbox, repo, git, cli };
}
test('helpers reject unsafe input and use Codex defaults', () => {
  for (const slug of ['a', 'sdd-0061-fase-b', 'a1']) assert.ok(isValidSlug(slug));
  for (const slug of ['', '..', '../x', 'a/b', 'a\\b', 'SEO', 'a--b', 'con', 'nul', 'a'.repeat(61), undefined]) assert.equal(isValidSlug(slug), false);
  assert.equal(branchFor('seo'), 'codex/seo');
  assert.equal(worktreePathFor(path.resolve('repo'), 'seo'), path.join(path.dirname(path.resolve('repo')), 'DTD-worktrees', 'seo'));
  assert.equal(parseArgs(['start', 'seo']).from, 'origin/main');
  assert.equal(parseArgs(['guard', '--owner', 'session-1']).owner, 'session-1');
  for (const args of [['start', 'a', '--from'], ['start', 'a', '--foo'], ['finish', 'a', '--delete-branch'], ['guard', 'a'], ['start', 'a', '--owner', 'x']]) assert.throws(() => parseArgs(args));
});
// Armado del porcelain `-z`: cada campo termina en NUL y cada registro lleva un NUL extra.
const porcelainOf = (records) => records.map((fields) => fields.join('\0') + '\0\0').join('');
test('parseWorktrees conserva todos los registros y expone locked y prunable', () => {
  const entries = parseWorktrees(porcelainOf([
    ['worktree /repos/DTDCARGO.git', 'bare'],
    ['worktree /repos/co/principal', 'HEAD ' + 'a'.repeat(40), 'branch refs/heads/codex/principal'],
    ['worktree /repos/co/con-razon', 'HEAD ' + 'b'.repeat(40), 'branch refs/heads/codex/con-razon', 'locked el Director lo pidió'],
    ['worktree /repos/co/sin-razon', 'HEAD ' + 'c'.repeat(40), 'branch refs/heads/codex/sin-razon', 'locked'],
    ['worktree /repos/co/fantasma', 'HEAD ' + 'd'.repeat(40), 'branch refs/heads/codex/fantasma', 'prunable gitdir file points to non-existent location'],
    ['worktree /repos/co/suelto', 'HEAD ' + 'e'.repeat(40), 'detached'],
  ]));
  // Ningún registro se descarta y el orden es el de git: `entries[0]` sigue siendo el primero del
  // porcelain, que es la invariante que `mainWorktreeFrom` verifica. Descartar acá el bare se la
  // sacaría de abajo, y además hacía que el harness declarara «principal» al árbol de un Worker.
  assert.equal(entries.length, 6);
  assert.deepEqual(entries[0], { path: '/repos/DTDCARGO.git', branch: null, bare: true, locked: false, lockedReason: null, prunable: false, prunableReason: null });
  assert.deepEqual(entries[1], { path: '/repos/co/principal', branch: 'refs/heads/codex/principal', bare: false, locked: false, lockedReason: null, prunable: false, prunableReason: null });
  // Bloqueado con razón y bloqueado a secas: los dos son `locked: true`, y el segundo no es invisible.
  assert.deepEqual([entries[2].locked, entries[2].lockedReason], [true, 'el Director lo pidió']);
  assert.deepEqual([entries[3].locked, entries[3].lockedReason], [true, null]);
  assert.deepEqual([entries[4].prunable, entries[4].prunableReason], [true, 'gitdir file points to non-existent location']);
  assert.equal(entries[4].locked, false);
  // HEAD detached: sin campo `branch`. `guard` lo rechaza por falsy y el informe lo publica como null.
  assert.equal(entries[5].branch, null);
});
test('finish publica locked y prunable, y sigue creyéndole al disco y no a git', (t) => {
  const { sandbox, repo, git, cli } = sandboxRepo(t, 'dtd-harness-locked-');
  const report = (out) => JSON.parse(out.slice(0, out.indexOf('\n}') + 2));
  writeFileSync(path.join(repo, 'tracked.txt'), 'fixture\n');
  git(['add', 'tracked.txt']); git(['commit', '-m', 'fixture']);
  git(['update-ref', 'refs/remotes/origin/main', 'HEAD']);
  cli(['start', 'worker']); cli(['start', 'fantasma']);
  const worker = path.join(sandbox, 'DTD-worktrees', 'worker');
  const fantasma = path.join(sandbox, 'DTD-worktrees', 'fantasma');
  // Un worktree sano: los cuatro campos en su forma negativa, que es la que se ve casi siempre.
  const sano = report(cli(['finish', 'worker']));
  assert.deepEqual([sano.locked, sano.lockedReason, sano.prunable, sano.prunableReason], [false, null, false, null]);
  git(['worktree', 'lock', '--reason', 'el Director lo pidió', worker]);
  const trabado = report(cli(['finish', 'worker']));
  assert.deepEqual([trabado.locked, trabado.lockedReason], [true, 'el Director lo pidió']);
  // Solo informe: el bloqueo se nombra y no se levanta. Se relee con `-z` a propósito, porque sin
  // `-z` git cita y escapa la razón en octal (`locked "el Director lo pidi\303\263"`).
  assert.equal(parseWorktrees(git(['worktree', 'list', '--porcelain', '-z'])).find((e) => e.path.endsWith('worker')).lockedReason, 'el Director lo pidió');
  assert.equal(trabado.cleanupAuthorized, false);
  // Bloqueado sin razón: sigue siendo `true`, con la razón en null. Un bloqueo deliberado del que
  // git no guardó motivo no puede leerse igual que «no está bloqueado».
  git(['worktree', 'unlock', worker]); git(['worktree', 'lock', worker]);
  assert.deepEqual([report(cli(['finish', 'worker'])).locked, report(cli(['finish', 'worker'])).lockedReason], [true, null]);
  // EL LÍMITE QUE SE CONSERVA: git ya llama `prunable` a un worktree borrado del disco, y `finish`
  // igual lo rechaza por `existsSync`. Si git y el disco discrepan, manda el disco: el informe
  // publica la opinión de git como evidencia, nunca como autorización para cerrar ni para podar.
  rmSync(fantasma, { recursive: true, force: true });
  const muerto = parseWorktrees(git(['worktree', 'list', '--porcelain', '-z'])).find((e) => e.path.endsWith('fantasma'));
  assert.equal(muerto.prunable, true);
  assert.match(muerto.prunableReason, /non-existent/);
  assert.match(cli(['finish', 'fantasma'], repo, false), /registrado pero no existe en disco/);
  assert.match(git(['worktree', 'list', '--porcelain']), /fantasma/);
});
test('isolated lifecycle enforces worktree guard, claims and report-only cleanup', (t) => {
  const { sandbox, repo, git, cli } = sandboxRepo(t, 'dtd-harness-test-');
  writeFileSync(path.join(repo, '.gitignore'), '.env.local\nnode_modules/\n');
  writeFileSync(path.join(repo, 'tracked.txt'), 'fixture\n');
  git(['add', '.gitignore', 'tracked.txt']); git(['commit', '-m', 'fixture']);
  cli(['start', 'missing-base'], repo, false);
  assert.equal(existsSync(path.join(sandbox, 'DTD-worktrees', 'missing-base')), false);
  git(['update-ref', 'refs/remotes/origin/main', 'HEAD']);
  writeFileSync(path.join(repo, '.env.local'), 'TEST_SECRET=never-copy\n');
  cli(['guard'], repo, false);
  git(['switch', '-c', 'codex/principal']); cli(['guard'], repo, false); git(['switch', 'main']);
  cli(['start', 'worker', '--dry-run']); assert.equal(existsSync(path.join(sandbox, 'DTD-worktrees', 'worker')), false);
  cli(['start', 'worker']);
  const worker = path.join(sandbox, 'DTD-worktrees', 'worker');
  assert.equal(git(['branch', '--show-current'], worker), 'codex/worker');
  assert.equal(git(['for-each-ref', '--format=%(upstream)', 'refs/heads/codex/worker']), '');
  assert.equal(existsSync(path.join(worker, '.env.local')), false);
  assert.equal(existsSync(path.join(worker, 'node_modules')), false);
  cli(['guard'], worker); cli(['guard', '--owner', 'session-a'], worker, false);
  cli(['claim', '--owner', 'session-a'], worker);
  cli(['claim', '--owner', 'session-b'], worker, false);
  cli(['release', '--owner', 'session-b'], worker, false);
  cli(['guard', '--owner', 'session-a'], worker);
  writeFileSync(path.join(worker, 'untracked.txt'), 'keep');
  writeFileSync(path.join(worker, '.env.local'), 'KEEP=1');
  const report = cli(['finish', 'worker']);
  assert.match(report, /"hasChanges": true/); assert.match(report, /"hasIgnoredFiles": true/);
  assert.match(report, /"owner": "session-a"/); assert.match(report, /"cleanupAuthorized": false/);
  cli(['finish', 'worker', '--delete-branch'], repo, false);
  assert.ok(existsSync(path.join(worker, 'untracked.txt'))); assert.ok(existsSync(path.join(worker, '.env.local')));
  assert.match(git(['worktree', 'list', '--porcelain']), /codex\/worker/);
  cli(['release', '--owner', 'session-a'], worker);
  cli(['claim', '--owner', 'session-b'], worker); cli(['release', '--owner', 'session-b'], worker);
  git(['switch', '--detach'], worker); cli(['guard'], worker, false);
  git(['switch', 'codex/principal']); git(['switch', 'main'], worker); cli(['guard'], worker, false);
});
test('the sensitive-name table flags .env* and nothing else', () => {
  // El búfer y el desbordamiento se prueban en harness-spawn.node.mjs, donde ahora viven.
  for (const name of ['.env', '.env.local', '.ENV.Production', '.envrc']) assert.ok(isSensitiveIgnoredName(name));
  for (const name of ['env.local', 'environment.ts', 'node_modules', 'readme.md']) assert.equal(isSensitiveIgnoredName(name), false);
});
test('finish inventories ignored files compactly and still flags .env without reading it', (t) => {
  const SECRET = 'contenido-que-nunca-debe-imprimirse';
  const { sandbox, repo, git, cli } = sandboxRepo(t, 'dtd-harness-ignored-');
  const report = (out) => JSON.parse(out.slice(0, out.indexOf('\n}') + 2));
  writeFileSync(path.join(repo, '.gitignore'), 'node_modules/\nsecrets/\n.env*\n');
  writeFileSync(path.join(repo, 'tracked.txt'), 'fixture\n');
  git(['add', '.gitignore', 'tracked.txt']); git(['commit', '-m', 'fixture']);
  git(['update-ref', 'refs/remotes/origin/main', 'HEAD']);
  cli(['start', 'bulto']);
  const worker = path.join(sandbox, 'DTD-worktrees', 'bulto');
  const clean = report(cli(['finish', 'bulto']));
  assert.equal(clean.hasIgnoredFiles, false); assert.equal(clean.ignoredEntryCount, 0); assert.deepEqual(clean.sensitiveIgnoredFiles, []);
  // Dependencies installed in the worktree: thousands of ignored files under nested ignored directories.
  const modules = path.join(worker, 'node_modules');
  for (let pkg = 0; pkg < 40; pkg++) {
    const nested = path.join(modules, `pkg-${pkg}`, 'dist', 'chunks');
    mkdirSync(nested, { recursive: true });
    for (let file = 0; file < 30; file++) writeFileSync(path.join(nested, `module-${file}.js`), 'export default 0;\n');
  }
  // A .env inside a wholly ignored directory: --directory collapses the directory, the flag must survive.
  mkdirSync(path.join(worker, 'secrets'));
  writeFileSync(path.join(worker, 'secrets', '.env.production'), `API_KEY=${SECRET}\n`);
  writeFileSync(path.join(worker, '.env.local'), `TOKEN=${SECRET}\n`);
  const expanded = git(['ls-files', '--others', '--ignored', '--exclude-standard'], worker).split('\n').filter(Boolean);
  assert.ok(expanded.length > 1000, `fixture insuficiente: ${expanded.length} archivos ignorados`);
  const out = cli(['finish', 'bulto']);
  const ignored = report(out);
  assert.equal(ignored.hasIgnoredFiles, true);
  assert.ok(ignored.ignoredEntryCount <= 10, `inventario sin colapsar: ${ignored.ignoredEntryCount} entradas`);
  assert.deepEqual(ignored.ignoredEntries.sort(), ['.env.local', 'node_modules/', 'secrets/']);
  assert.deepEqual(ignored.sensitiveIgnoredFiles, ['.env.local', 'secrets/.env.production']);
  assert.ok(!out.includes(SECRET), 'el informe no debe imprimir contenido de archivos ignorados');
  assert.ok(!out.includes('module-0.js'), 'el informe no debe enumerar el interior de un directorio colapsado');
  assert.ok(out.length < 4000, `informe desproporcionado: ${out.length} caracteres`);
  // Report only: nothing is pruned, not even the ignored tree it just named.
  for (const kept of [path.join(worker, '.env.local'), path.join(worker, 'secrets', '.env.production'), path.join(modules, 'pkg-0', 'dist', 'chunks', 'module-0.js')]) assert.ok(existsSync(kept));
  assert.equal(git(['ls-files', '--others', '--ignored', '--exclude-standard'], worker).split('\n').filter(Boolean).length, expanded.length);
});
test('resolveCandidate resuelve contra la lista real y nunca arma una ruta con el nombre', () => {
  const main = path.resolve(path.join('repos', 'DTDCARGO'));
  const codex = { path: path.join(path.dirname(main), 'DTD-worktrees', 'codex-wt'), branch: 'refs/heads/codex/codex-wt' };
  const app = { path: path.join(main, '.claude', 'worktrees', 'app-wt'), branch: 'refs/heads/claude/app-wt' };
  const suelto = { path: path.resolve(path.join('otro', 'lado', 'suelto')), branch: 'refs/heads/suelto' };
  const entries = [{ path: main, branch: 'refs/heads/main' }, codex, app, suelto];
  assert.deepEqual(worktreeContainers(main), [path.join(path.dirname(main), 'DTD-worktrees'), path.join(main, '.claude', 'worktrees')]);
  // Los dos contenedores, por nombre. El de .claude/worktrees es el que no se veía.
  assert.equal(resolveCandidate(entries, main, 'codex-wt', null).path, codex.path);
  assert.equal(resolveCandidate(entries, main, 'app-wt', null).path, app.path);
  // Sin nombre, el worktree donde se corre: ahí no hay ambigüedad, así que no se exige contenedor.
  assert.equal(resolveCandidate(entries, main, undefined, app.path).path, app.path);
  assert.equal(resolveCandidate(entries, main, undefined, suelto.path).path, suelto.path);
  // Por nombre sí se exige: un worktree fuera de los dos contenedores no se alcanza a ciegas.
  assert.throws(() => resolveCandidate(entries, main, 'suelto', null), /No hay worktree registrado/);
  // El principal nunca es candidato, y el mensaje lo dice en vez de parecer culpa de quien escribió.
  assert.throws(() => resolveCandidate(entries, main, undefined, main), /checkout principal/);
  assert.throws(() => resolveCandidate(entries, main, 'DTDCARGO', null), /No hay worktree registrado/);
  assert.throws(() => resolveCandidate(entries, main, undefined, null), /no se pudo determinar/);
  // El nombre se compara con entradas registradas, jamás se concatena. Los dos primeros son los
  // que sí darían en el blanco si se armara `path.join(contenedor, nombre)`: salen de un
  // contenedor y aterrizan en el otro. Con comparación de nombres no alcanzan nada.
  const cruzados = [path.join('..', '..', '..', 'DTD-worktrees', 'codex-wt'), path.join('..', path.basename(main), '.claude', 'worktrees', 'app-wt')];
  for (const evil of [...cruzados, '..', '../codex-wt', codex.path, ''])
    assert.throws(() => resolveCandidate(entries, main, evil, null), /No hay worktree registrado/);
  // Mismo nombre en los dos contenedores: ambiguo, y no se elige por orden de la lista.
  const duplicado = { path: path.join(main, '.claude', 'worktrees', 'codex-wt'), branch: 'refs/heads/claude/codex-wt' };
  assert.throws(() => resolveCandidate([...entries, duplicado], main, 'codex-wt', null), /nombra 2 worktrees registrados/);
  // El error enumera lo que sí existe: es la diferencia entre «no existe» y «el comando no mira ahí».
  assert.throws(() => resolveCandidate(entries, main, 'no-existe', null), /Candidatos: app-wt, codex-wt\./);
  assert.throws(() => resolveCandidate([entries[0]], main, 'no-existe', null), /Candidatos: ninguno\./);
});
test('finish cubre los worktrees de .claude/worktrees sin perder los de DTD-worktrees', (t) => {
  const { sandbox, repo, git, cli } = sandboxRepo(t, 'dtd-harness-contenedores-');
  const report = (out) => JSON.parse(out.slice(0, out.indexOf('\n}') + 2));
  writeFileSync(path.join(repo, '.gitignore'), 'node_modules/\n');
  writeFileSync(path.join(repo, 'tracked.txt'), 'fixture\n');
  git(['add', '.gitignore', 'tracked.txt']); git(['commit', '-m', 'fixture']);
  git(['update-ref', 'refs/remotes/origin/main', 'HEAD']);
  cli(['start', 'codex-wt']);
  const codex = path.join(sandbox, 'DTD-worktrees', 'codex-wt');
  // El worktree que crea la app de Claude Code: dentro del checkout y con nombre propio, no un slug de start.
  const app = path.join(repo, '.claude', 'worktrees', 'app-wt');
  git(['worktree', 'add', '--no-track', '-b', 'claude/app-wt', app, 'HEAD']);
  // Su `.git` es un archivo que apunta al repo padre, no un directorio: finish tiene que tolerarlo.
  assert.ok(lstatSync(path.join(app, '.git')).isFile());
  const porNombre = report(cli(['finish', 'app-wt']));
  assertSamePath(porNombre.candidate, app);
  assert.equal(porNombre.branch, 'refs/heads/claude/app-wt');
  assert.equal(porNombre.cleanupAuthorized, false);
  // El camino viejo sigue igual: el arreglo suma un contenedor, no cambia el que ya andaba.
  const viejo = report(cli(['finish', 'codex-wt']));
  assertSamePath(viejo.candidate, codex);
  assert.equal(viejo.branch, 'refs/heads/codex/codex-wt');
  // Sin nombre informa sobre el worktree donde se corre, en cualquiera de los dos contenedores.
  assertSamePath(report(cli(['finish'], app)).candidate, app);
  assertSamePath(report(cli(['finish'], codex)).candidate, codex);
  // Desde el checkout principal el mensaje nombra el motivo real y los candidatos que sí existen.
  const principal = cli(['finish'], repo, false);
  assert.match(principal, /checkout principal/);
  assert.match(principal, /Candidatos: app-wt, codex-wt\./);
  // Un candidato que de veras no existe se distingue de «el comando no mira ahí».
  const inexistente = cli(['finish', 'no-existe'], repo, false);
  assert.match(inexistente, /No hay worktree registrado llamado «no-existe»/);
  assert.match(inexistente, /Candidatos: app-wt, codex-wt\./);
  assert.doesNotMatch(inexistente, /Slug inválido/);
  // El primero alcanzaría DTD-worktrees/codex-wt desde .claude/worktrees si la ruta se armara con el nombre.
  for (const evil of [path.join('..', '..', '..', 'DTD-worktrees', 'codex-wt'), '..', '../repo', app])
    assert.match(cli(['finish', evil], repo, false), /No hay worktree registrado/);
  // Sigue siendo solo informe: nada se borró ni se despublicó, ni siquiera lo que nombró.
  writeFileSync(path.join(app, 'untracked.txt'), 'keep');
  assert.equal(report(cli(['finish', 'app-wt'])).hasChanges, true);
  assert.ok(existsSync(path.join(app, 'untracked.txt')));
  assert.match(git(['worktree', 'list', '--porcelain']), /claude\/app-wt/);
  assert.match(git(['worktree', 'list', '--porcelain']), /codex\/codex-wt/);
  // Registrado pero ausente en disco: resolver por la lista real trae este caso, y el informe
  // no puede inventarlo. El borrado es del fixture y vive dentro del sandbox de tmp.
  const fantasma = path.join(repo, '.claude', 'worktrees', 'fantasma');
  git(['worktree', 'add', '--no-track', '-b', 'claude/fantasma', fantasma, 'HEAD']);
  assert.ok(realPath(fantasma).startsWith(realPath(sandbox)));
  rmSync(fantasma, { recursive: true, force: true });
  assert.match(git(['worktree', 'list', '--porcelain']), /claude\/fantasma/);
  assert.match(cli(['finish', 'fantasma'], repo, false), /registrado pero no existe en disco/);
});
test('mainWorktreeFrom verifica el principal y devuelve null cuando no hay ninguno', () => {
  const principal = path.resolve(path.join('repos', 'DTDCARGO'));
  const comun = path.join(principal, '.git');
  const linked = { path: path.join(principal, '.claude', 'worktrees', 'wt'), branch: 'refs/heads/codex/wt' };
  const bare = path.resolve(path.join('repos', 'repo.git'));
  // Repo normal: el porcelain lista el principal primero y el common-dir lo confirma.
  assert.equal(mainWorktreeFrom([{ path: principal }, linked], comun), principal);
  // Repo bare: `entries[0]` es el propio bare, así que NO hay principal. Antes se devolvía igual.
  assert.equal(mainWorktreeFrom([{ path: bare, bare: true }, linked], bare), null);
  // El flag manda esté donde esté: un repo común sin checkout no deja principal que elegir.
  assert.equal(mainWorktreeFrom([linked, { path: bare, bare: true }], comun), null);
  // La posición se verifica, no se confía: si el common-dir no cuelga de entries[0], es «no sé».
  assert.equal(mainWorktreeFrom([{ path: linked.path }, { path: principal }], comun), null);
  // Lo que decide es la relación entre el common-dir y entries[0], no cómo se llame el directorio:
  // si cuelga del propio árbol, lo identifica aunque no se llame `.git`...
  assert.equal(mainWorktreeFrom([{ path: principal }], path.join(principal, 'otro-dir')), principal);
  // ...y si cuelga de otro lado no lo identifica aunque sí se llame `.git`. Esta condición única
  // es la que cubre sola el caso bare, y por eso el flag y el chequeo de nombre se fueron.
  assert.equal(mainWorktreeFrom([{ path: principal }], path.join(path.dirname(principal), 'otro', '.git')), null);
  // Sin datos no se inventa: lista vacía, o common-dir que git no pudo dar.
  assert.equal(mainWorktreeFrom([], comun), null);
  assert.equal(mainWorktreeFrom([{ path: principal }], null), null);
  // El «no sé» se propaga a resolveCandidate sin convertirse en respuesta: por nombre se niega...
  assert.throws(() => resolveCandidate([{ path: bare, bare: true }, linked], null, 'wt', null), /no tiene checkout principal verificable/);
  // ...y el camino que no necesita el principal sigue funcionando igual.
  assert.equal(resolveCandidate([{ path: bare, bare: true }, linked], null, undefined, linked.path).path, linked.path);
  // La entrada bare no es un worktree vinculado ni candidato de nada.
  assert.throws(() => resolveCandidate([{ path: bare, bare: true }, linked], null, undefined, bare), /no es un worktree vinculado/);
});
test('en un repo bare el harness no elige un principal: se niega con motivo donde hace falta', (t) => {
  const sandbox = mkdtempSync(path.join(tmpdir(), 'dtd-harness-bare-'));
  t.after(() => { assert.ok(path.resolve(sandbox).startsWith(path.resolve(tmpdir()) + path.sep)); rmSync(sandbox, { recursive: true, force: true }); });
  const origen = path.join(sandbox, 'origen'); mkdirSync(origen);
  gitAt(origen, ['init', '-q', '-b', 'main']);
  gitAt(origen, ['config', 'user.email', 'test@example.invalid']); gitAt(origen, ['config', 'user.name', 'Fixture']);
  writeFileSync(path.join(origen, 'tracked.txt'), 'fixture\n');
  gitAt(origen, ['add', '-A']); gitAt(origen, ['commit', '-qm', 'fixture']);
  // Repo común SIN checkout propio: el caso donde `entries[0]` no es un árbol de trabajo.
  const bare = path.join(sandbox, 'repo.git');
  gitAt(sandbox, ['clone', '-q', '--bare', origen, 'repo.git']);
  const uno = path.join(sandbox, 'uno');
  gitAt(bare, ['worktree', 'add', '-q', '--no-track', '-b', 'codex/uno', uno, 'main']);
  assert.match(gitAt(bare, ['worktree', 'list', '--porcelain']), /(^|\n)bare(\n|$)/);
  // Un worktree linked legítimo se sigue pudiendo usar: no hay principal que lo desplace.
  assert.match(cliAt(uno, ['guard'], true), /Guard OK/);
  // finish sin nombre no necesita el principal, así que informa igual que en un repo normal.
  const informe = cliAt(uno, ['finish'], true);
  assertSamePath(JSON.parse(informe.slice(0, informe.indexOf('\n}') + 2)).candidate, uno);
  // Lo que sí lo necesita se niega nombrando el motivo y la salida, en vez de resolver contra
  // contenedores derivados de un repo que no es un árbol de trabajo.
  const porNombre = cliAt(uno, ['finish', 'uno'], false);
  assert.match(porNombre, /no tiene checkout principal verificable/);
  assert.match(porNombre, /Corré finish sin nombre/);
  assert.match(porNombre, /Worktrees vinculados: uno\./);
  assert.doesNotMatch(porNombre, /Candidatos: ninguno/);
  const start = cliAt(uno, ['start', 'nuevo', '--dry-run'], false);
  assert.match(start, /no tiene checkout principal verificable/);
  assert.match(start, /start no puede decidir dónde crear/);
  assert.equal(existsSync(path.join(sandbox, 'DTD-worktrees', 'nuevo')), false);
});
