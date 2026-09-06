import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isValidSlug, worktreePathFor, branchFor, parseArgs } from '../harness-worktree.mjs';
const script = fileURLToPath(new URL('../harness-worktree.mjs', import.meta.url));
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
  const sandbox = mkdtempSync(path.join(tmpdir(), 'dtd-harness-test-'));
  // This fixture is the only recursive deletion target; never a real checkout.
  t.after(() => { assert.ok(path.resolve(sandbox).startsWith(path.resolve(tmpdir()) + path.sep)); rmSync(sandbox, { recursive: true, force: true }); });
  const repo = path.join(sandbox, 'repo'); mkdirSync(repo);
  function git(args, cwd = repo) {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr); return r.stdout.trim();
  }
  function cli(args, cwd = repo, success = true) {
    const r = spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' });
    assert.equal(r.status === 0, success, r.stdout + r.stderr); return r.stdout;
  }
  git(['init', '-b', 'main']); git(['config', 'user.email', 'test@example.invalid']); git(['config', 'user.name', 'Fixture']);
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
