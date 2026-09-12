import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isValidSlug, worktreePathFor, branchFor, parseArgs, isSensitiveIgnoredName, parseWorktrees } from '../harness-worktree.mjs';
import { MAX_BUFFER } from '../harness-spawn.mjs';
const script = fileURLToPath(new URL('../harness-worktree.mjs', import.meta.url));
function gitAt(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: MAX_BUFFER });
  assert.equal(r.status, 0, r.stderr); return r.stdout.trim();
}
function cliAt(cwd, args, success) {
  const r = spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8', maxBuffer: MAX_BUFFER });
  assert.equal(r.status === 0, success, r.stdout + r.stderr); return r.stdout;
}
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
test('parseWorktrees descarta el registro bare y expone locked y prunable', () => {
  const entries = parseWorktrees(porcelainOf([
    // git emite el registro bare PRIMERO: por eso colarse en `entries[0]` era silencioso.
    ['worktree /repos/DTDCARGO.git', 'bare'],
    ['worktree /repos/co/principal', 'HEAD ' + 'a'.repeat(40), 'branch refs/heads/codex/principal'],
    ['worktree /repos/co/con-razon', 'HEAD ' + 'b'.repeat(40), 'branch refs/heads/codex/con-razon', 'locked el Director lo pidió'],
    ['worktree /repos/co/sin-razon', 'HEAD ' + 'c'.repeat(40), 'branch refs/heads/codex/sin-razon', 'locked'],
    ['worktree /repos/co/fantasma', 'HEAD ' + 'd'.repeat(40), 'branch refs/heads/codex/fantasma', 'prunable gitdir file points to non-existent location'],
    ['worktree /repos/co/suelto', 'HEAD ' + 'e'.repeat(40), 'detached'],
  ]));
  assert.equal(entries.length, 5);
  // El principal pasa a ser el primero: es de `entries[0]` que salen el contenedor, el guard y el candidato.
  assert.equal(entries[0].path, '/repos/co/principal');
  assert.ok(!entries.some((e) => e.path?.endsWith('.git')), 'el registro bare no debe quedar en la lista');
  assert.deepEqual(entries[0], { path: '/repos/co/principal', branch: 'refs/heads/codex/principal', locked: false, lockedReason: null, prunable: false, prunableReason: null });
  // Bloqueado con razón y bloqueado a secas: los dos son `locked: true`, y el segundo no es invisible.
  assert.deepEqual([entries[1].locked, entries[1].lockedReason], [true, 'el Director lo pidió']);
  assert.deepEqual([entries[2].locked, entries[2].lockedReason], [true, null]);
  assert.deepEqual([entries[3].prunable, entries[3].prunableReason], [true, 'gitdir file points to non-existent location']);
  assert.equal(entries[3].locked, false);
  // HEAD detached: sin campo `branch`. `guard` lo rechaza por falsy y el informe lo publica como null.
  assert.equal(entries[4].branch, null);
});
test('finish informa sobre el worktree correcto con un repositorio bare de por medio', (t) => {
  const sandbox = mkdtempSync(path.join(tmpdir(), 'dtd-harness-bare-'));
  t.after(() => { assert.ok(path.resolve(sandbox).startsWith(path.resolve(tmpdir()) + path.sep)); rmSync(sandbox, { recursive: true, force: true }); });
  const report = (out) => JSON.parse(out.slice(0, out.indexOf('\n}') + 2));
  const origen = path.join(sandbox, 'origen');
  mkdirSync(origen);
  gitAt(origen, ['init', '-b', 'main']); gitAt(origen, ['config', 'user.email', 'test@example.invalid']); gitAt(origen, ['config', 'user.name', 'Fixture']);
  writeFileSync(path.join(origen, 'tracked.txt'), 'fixture\n');
  gitAt(origen, ['add', 'tracked.txt']); gitAt(origen, ['commit', '-m', 'fixture']);
  const bare = path.join(sandbox, 'repo.git');
  gitAt(sandbox, ['clone', '--bare', origen, bare]);
  // `nido` existe para que el contenedor que sale del principal NO coincida con el que sale del bare:
  // sin filtrar el bare, `worktreePathFor` apunta a <sandbox>/DTD-worktrees, que no existe.
  const principal = path.join(sandbox, 'nido', 'AAA-principal');
  const worker = path.join(sandbox, 'nido', 'DTD-worktrees', 'worker');
  const fantasma = path.join(sandbox, 'nido', 'DTD-worktrees', 'fantasma');
  gitAt(bare, ['worktree', 'add', '-b', 'codex/principal', principal, 'main']);
  gitAt(bare, ['worktree', 'add', '-b', 'codex/worker', worker, 'main']);
  gitAt(bare, ['worktree', 'add', '-b', 'codex/fantasma', fantasma, 'main']);
  // Precondición medida (git 2.55): el registro bare va primero y los vinculados vienen ordenados por
  // ruta. Se asevera para que un cambio de git falle acá en vez de dejar pasar la prueba por suerte.
  const crudo = gitAt(principal, ['worktree', 'list', '--porcelain', '-z']);
  const registros = crudo.split('\0\0').filter(Boolean);
  assert.ok(registros[0].includes('bare'), 'fixture: se esperaba el registro bare primero');
  assert.match(registros[1], /AAA-principal/, 'fixture: se esperaba AAA-principal como primer vinculado');
  // La función pura contra bytes de git de verdad, no solo contra una cadena escrita a mano.
  assert.equal(parseWorktrees(crudo).length, registros.length - 1);
  assert.match(parseWorktrees(crudo)[0].path, /AAA-principal$/);
  gitAt(bare, ['worktree', 'lock', '--reason', 'el Director lo pidió', worker]);
  const out = cliAt(principal, ['finish', 'worker'], true);
  const informe = report(out);
  // Sin descartar el bare, el candidato se armaba sobre <sandbox> y esto salía exit 1.
  assert.match(informe.candidate, /nido[\\/]DTD-worktrees[\\/]worker$/);
  assert.equal(informe.branch, 'refs/heads/codex/worker');
  assert.deepEqual([informe.locked, informe.lockedReason], [true, 'el Director lo pidió']);
  assert.deepEqual([informe.prunable, informe.prunableReason], [false, null]);
  assert.equal(informe.cleanupAuthorized, false);
  // Sigue siendo solo informe: el bloqueo se nombra y no se levanta. Se relee con `-z` a propósito:
  // sin `-z`, git cita y escapa la razón en octal (`locked "el Director lo pidi\303\263"`), así que
  // la razón cruda solo sale del formato que usa `worktrees()`.
  assert.equal(parseWorktrees(gitAt(principal, ['worktree', 'list', '--porcelain', '-z'])).find((e) => e.path.endsWith('worker')).lockedReason, 'el Director lo pidió');
  // Límite conservado: un candidato ausente en disco se rechaza por existsSync, no por la opinión de
  // git. Acá git ya lo llama prunable y el informe igual no sale: si discrepan, manda el disco.
  rmSync(fantasma, { recursive: true, force: true });
  assert.match(parseWorktrees(gitAt(principal, ['worktree', 'list', '--porcelain', '-z'])).find((e) => e.path.endsWith('fantasma')).prunableReason, /non-existent/);
  cliAt(principal, ['finish', 'fantasma'], false);
  // Un repo bare sin worktrees vinculados deja la lista vacía al descartar el bare: se nombra en vez
  // de morir en `entries[0].path`. Se spawnea directo porque acá el contrato que se fija es el mensaje.
  const solo = path.join(sandbox, 'solo.git');
  gitAt(sandbox, ['init', '--bare', solo]);
  const vacio = spawnSync(process.execPath, [script, 'finish', 'algo'], { cwd: solo, encoding: 'utf8', maxBuffer: MAX_BUFFER });
  assert.notEqual(vacio.status, 0);
  assert.match(vacio.stderr, /ningún worktree con árbol de trabajo/);
  assert.doesNotMatch(vacio.stderr, /Cannot read properties/);
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
