import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, lstatSync, realpathSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isValidSlug, worktreePathFor, worktreeContainers, resolveCandidate, branchFor, parseArgs, isSensitiveIgnoredName } from '../harness-worktree.mjs';
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
