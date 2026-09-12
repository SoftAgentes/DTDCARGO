import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isValidSlug, worktreePathFor, branchFor, parseArgs, runGit, GIT_MAX_BUFFER, isSensitiveIgnoredName } from '../harness-worktree.mjs';
const script = fileURLToPath(new URL('../harness-worktree.mjs', import.meta.url));
function gitAt(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: GIT_MAX_BUFFER });
  assert.equal(r.status, 0, r.stderr); return r.stdout.trim();
}
function cliAt(cwd, args, success) {
  const r = spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8', maxBuffer: GIT_MAX_BUFFER });
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
test('runGit names a buffer overflow instead of masking it as a generic git failure', () => {
  // ENOBUFS leaves status null and empty stderr: without this the caller only saw «git ls-files falló».
  assert.ok(GIT_MAX_BUFFER >= 32 * 1024 * 1024);
  const version = runGit(['--version']);
  assert.equal(version.code, 0); assert.match(version.out, /^git version/);
  const overflow = runGit(['--version'], process.cwd(), 4);
  assert.notEqual(overflow.code, 0); assert.match(overflow.err, /ENOBUFS/);
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
