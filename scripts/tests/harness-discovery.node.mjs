import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const { scripts } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
const command = scripts['harness:test'];

function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'dtd-harness-discovery-'));
  t.after(() => {
    const target = path.resolve(root);
    const relative = path.relative(path.resolve(tmpdir()), target);
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
    assert.ok(path.basename(target).startsWith('dtd-harness-discovery-'));
    rmSync(target, { recursive: true, force: true, maxRetries: 3 });
  });
  mkdirSync(path.join(root, 'scripts', 'tests'), { recursive: true });
  copyFileSync(new URL('./run-harness.mjs', import.meta.url), path.join(root, 'scripts', 'tests', 'run-harness.mjs'));
  return root;
}

function writeTest(root, name, body) {
  writeFileSync(path.join(root, 'scripts', 'tests', name), body, 'utf8');
}

function runHarness(root) {
  const env = { ...process.env };
  // This is an independent harness invocation, not another child of this test runner.
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(command, {
    cwd: root,
    shell: true,
    env,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30_000,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  return { status: result.status, output: result.stdout + result.stderr };
}

test('harness:test discovers a newly added *.node.mjs without updating its command', (t) => {
  const root = fixture(t);
  writeTest(root, 'seed.node.mjs', "import test from 'node:test'; test('fixture seed ran', () => {});\n");
  // A non-matching file must not enter the harness merely because it is in this directory.
  writeTest(root, 'not-a-node-test.mjs', "throw new Error('nonmatching fixture must not run');\n");
  const before = runHarness(root);
  assert.equal(before.status, 0, before.output);
  assert.match(before.output, /fixture seed ran/);

  writeTest(root, 'unexpected-future-check.node.mjs', "import test from 'node:test'; test('new fixture discovered', () => {});\n");
  const after = runHarness(root);
  assert.equal(after.status, 0, after.output);
  assert.match(after.output, /fixture seed ran/);
  assert.match(after.output, /new fixture discovered/);
});

test('harness:test propagates failure from a newly added *.node.mjs', (t) => {
  const root = fixture(t);
  writeTest(root, 'unexpected-failing-check.node.mjs', "import test from 'node:test'; test('new fixture fails visibly', () => { throw new Error('intentional fixture failure'); });\n");
  const result = runHarness(root);
  assert.notEqual(result.status, 0, result.output);
  assert.match(result.output, /new fixture fails visibly/);
  assert.match(result.output, /intentional fixture failure/);
});

test('harness:test fails when scripts/tests has no matching test files', (t) => {
  const root = fixture(t);
  const result = runHarness(root);
  assert.notEqual(result.status, 0, result.output);
  assert.match(result.output, /No harness tests found/);
});
