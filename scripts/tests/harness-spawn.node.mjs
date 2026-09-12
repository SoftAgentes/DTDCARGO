import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MAX_BUFFER, runGit } from '../harness-spawn.mjs';
const repo = fileURLToPath(new URL('../..', import.meta.url));
test('el búfer cubre los listados del harness y un desbordamiento se nombra, no se tapa', () => {
  // 1 MB (el default de spawnSync) no alcanza: un worktree con dependencias da ~25 MB de ignorados.
  assert.ok(MAX_BUFFER >= 32 * 1024 * 1024);
  const version = runGit(['--version'], repo);
  assert.equal(version.code, 0); assert.match(version.out, /^git version/); assert.equal(version.err, '');
  // Con el búfer al ras, spawnSync mata a git y deja el motivo solo en r.error.
  const desbordado = runGit(['--version'], repo, 4);
  assert.notEqual(desbordado.code, 0);
  assert.match(desbordado.err, /ENOBUFS/); assert.match(desbordado.err, /^git --version:/);
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
