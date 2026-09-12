import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MAX_BUFFER, runGit, normalizeGitResult } from '../harness-spawn.mjs';
const repo = fileURLToPath(new URL('../..', import.meta.url));
const enobufs = () => Object.assign(new Error('spawnSync git ENOBUFS'), { code: 'ENOBUFS' });
test('un desbordamiento es un fallo aunque git alcance a salir con 0', () => {
  // El caso que destapó la CI en Linux: ahí `status` sale 0 en la mayoría de las corridas
  // (51 de 60 medidas) porque git termina antes del corte, mientras `error` siempre viene.
  // Creerle al status devolvía { code: 0, out: "" }: un éxito con salida vacía.
  const linux = normalizeGitResult({ status: 0, signal: null, error: enobufs(), stdout: 'x'.repeat(64), stderr: '' }, ['ls-files']);
  assert.notEqual(linux.code, 0);
  assert.equal(linux.out, ''); assert.match(linux.err, /ENOBUFS/); assert.match(linux.err, /^git ls-files:/);
  // En Windows el mismo desbordamiento llega con status null y SIGTERM.
  const windows = normalizeGitResult({ status: null, signal: 'SIGTERM', error: enobufs(), stdout: '', stderr: '' }, ['ls-files']);
  assert.notEqual(windows.code, 0); assert.match(windows.err, /ENOBUFS/);
  // Un fallo normal de git conserva su código y su stderr, sin inventar nada.
  const normal = normalizeGitResult({ status: 128, signal: null, error: undefined, stdout: '', stderr: 'fatal: not a git repository\n' }, ['rev-parse']);
  assert.equal(normal.code, 128); assert.equal(normal.err, 'fatal: not a git repository');
  const verde = normalizeGitResult({ status: 0, signal: null, error: undefined, stdout: ' true \n', stderr: '' }, ['rev-parse']);
  assert.deepEqual(verde, { code: 0, out: 'true', err: '' });
});
test('el búfer cubre los listados del harness y el desbordamiento real se nombra', () => {
  // 1 MB (el default de spawnSync) no alcanza: un worktree con dependencias da ~25 MB de ignorados.
  assert.ok(MAX_BUFFER >= 32 * 1024 * 1024);
  const version = runGit(['--version'], repo);
  assert.equal(version.code, 0); assert.match(version.out, /^git version/); assert.equal(version.err, '');
  // Desbordamiento de verdad, con una salida grande: `git ls-files` de este repo pasa de 1 KB
  // de sobra. Se mide con el comando real en vez de con un tope simbólico.
  const listado = runGit(['ls-files'], repo);
  assert.equal(listado.code, 0); assert.ok(listado.out.length > 1024);
  const desbordado = runGit(['ls-files'], repo, 1024);
  assert.notEqual(desbordado.code, 0);
  assert.match(desbordado.err, /ENOBUFS/); assert.match(desbordado.err, /^git ls-files:/);
  assert.equal(desbordado.out, '');
});
test('runGit informa el fallo de git sin lanzar, y respeta el cwd', (t) => {
  const sandbox = mkdtempSync(path.join(tmpdir(), 'dtd-spawn-test-'));
  // This fixture is the only recursive deletion target; never a real checkout.
  t.after(() => { assert.ok(path.resolve(sandbox).startsWith(path.resolve(tmpdir()) + path.sep)); rmSync(sandbox, { recursive: true, force: true }); });
  // El cwd manda, y se pasa explícito para no depender de dónde se corra la prueba:
  // fuera de un repo el mismo comando falla y trae el stderr de git; dentro, no.
  const fuera = runGit(['rev-parse', '--show-toplevel'], sandbox);
  assert.notEqual(fuera.code, 0); assert.notEqual(fuera.err, ''); assert.equal(fuera.out, '');
  const dentro = runGit(['rev-parse', '--is-inside-work-tree'], repo);
  assert.equal(dentro.code, 0); assert.equal(dentro.out, 'true');
  // Un subcomando inexistente es un fallo de git, no una excepción: code ≠ 0 y motivo.
  const inexistente = runGit(['no-existe-este-subcomando'], repo);
  assert.notEqual(inexistente.code, 0); assert.notEqual(inexistente.err, '');
});
