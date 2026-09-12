import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ramasSinPublicar, runGit, main, GIT_MAX_BUFFER } from '../check-unpublished.mjs';
const script = fileURLToPath(new URL('../check-unpublished.mjs', import.meta.url));
/** Corre `main` con un git de mentira y devuelve lo que imprimió. */
function salidaDe(respuestas) {
  const lineas = [];
  const original = console.log;
  console.log = (...args) => lineas.push(args.join(' '));
  try {
    assert.equal(main((args) => respuestas[args[0]] ?? { code: 0, out: '', err: '' }), 0);
  } finally {
    console.log = original;
  }
  return lineas.join('\n');
}
test('runGit nombra el desbordamiento y ramasSinPublicar conserva su contrato', () => {
  assert.ok(GIT_MAX_BUFFER >= 32 * 1024 * 1024);
  const version = runGit(['--version']);
  assert.equal(version.code, 0); assert.match(version.out, /^git version/);
  const desbordado = runGit(['--version'], 4);
  assert.notEqual(desbordado.code, 0); assert.match(desbordado.err, /ENOBUFS/);
  const contar = { publicada: 0, vieja: 3, nueva: 1 };
  assert.deepEqual(ramasSinPublicar(['publicada', 'vieja', 'nueva'], (rama) => contar[rama]), [
    { rama: 'vieja', commits: 3 },
    { rama: 'nueva', commits: 1 },
  ]);
  assert.deepEqual(ramasSinPublicar([], () => 0), []);
});
test('un git que falla nunca sale [OK]: lo que no se midió se dice', () => {
  const ok = { code: 0, out: '', err: '' };
  // Nada pendiente y todo medido: ése es el único verde.
  const verde = salidaDe({ 'rev-parse': ok, 'for-each-ref': { code: 0, out: 'main', err: '' }, 'rev-list': { code: 0, out: '0', err: '' } });
  assert.match(verde, /\[OK\]/); assert.doesNotMatch(verde, /\[AVISO\]/);
  // El defecto: el listado fallaba, `ramas` quedaba vacío y esto imprimía [OK].
  const sinListado = salidaDe({ 'rev-parse': ok, 'for-each-ref': { code: 1, out: '', err: 'git for-each-ref: spawnSync git ENOBUFS' } });
  assert.doesNotMatch(sinListado, /\[OK\]/);
  assert.match(sinListado, /\[AVISO\].*SIN MEDIR/); assert.match(sinListado, /ENOBUFS/);
  // Un conteo que falla tampoco es una rama al día.
  const sinConteo = salidaDe({ 'rev-parse': ok, 'for-each-ref': { code: 0, out: 'main\ncodex/x', err: '' }, 'rev-list': { code: 1, out: '', err: 'git rev-list: roto' } });
  assert.doesNotMatch(sinConteo, /\[OK\]/);
  assert.match(sinConteo, /2 rama\(s\) SIN MEDIR/); assert.match(sinConteo, /codex\/x → git rev-list: roto/);
  // Sin base tampoco hay medición, y ahora se nombra el motivo real.
  const sinBase = salidaDe({ 'rev-parse': { code: 128, out: '', err: 'fatal: needed a single revision' } });
  assert.doesNotMatch(sinBase, /\[OK\]/);
  assert.match(sinBase, /sin origin\/main/); assert.match(sinBase, /needed a single revision/);
  // Y el aviso de siempre sigue igual, con su recordatorio de SDD-0091.
  const pendiente = salidaDe({ 'rev-parse': ok, 'for-each-ref': { code: 0, out: 'codex/y', err: '' }, 'rev-list': { code: 0, out: '4', err: '' } });
  assert.match(pendiente, /1 rama\(s\) con trabajo que NO está en origin\/main/);
  assert.match(pendiente, /codex\/y → 4 commit\(s\) sin publicar/); assert.match(pendiente, /SDD-0091/);
});
test('contra git de verdad: avisa de la rama sin publicar y del clon sin base', (t) => {
  const sandbox = mkdtempSync(path.join(tmpdir(), 'dtd-unpublished-test-'));
  // This fixture is the only recursive deletion target; never a real checkout.
  t.after(() => { assert.ok(path.resolve(sandbox).startsWith(path.resolve(tmpdir()) + path.sep)); rmSync(sandbox, { recursive: true, force: true }); });
  const repo = path.join(sandbox, 'repo'); mkdirSync(repo);
  const git = (args) => {
    const r = spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr); return r.stdout.trim();
  };
  const correr = () => {
    const r = spawnSync(process.execPath, [script], { cwd: repo, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr); return r.stdout;
  };
  git(['init', '-b', 'main']); git(['config', 'user.email', 'test@example.invalid']); git(['config', 'user.name', 'Fixture']);
  writeFileSync(path.join(repo, 'a.txt'), 'uno\n'); git(['add', 'a.txt']); git(['commit', '-m', 'base']);
  // Sin origin/main no se puede medir nada: es un aviso, no un verde.
  const sinBase = correr();
  assert.match(sinBase, /\[AVISO\]/); assert.match(sinBase, /sin origin\/main/); assert.doesNotMatch(sinBase, /\[OK\]/);
  git(['update-ref', 'refs/remotes/origin/main', 'HEAD']);
  assert.match(correr(), /\[OK\]/);
  git(['switch', '-c', 'codex/a-medias']);
  writeFileSync(path.join(repo, 'b.txt'), 'dos\n'); git(['add', 'b.txt']); git(['commit', '-m', 'sin publicar']);
  const aviso = correr();
  assert.match(aviso, /1 rama\(s\) con trabajo que NO está en origin\/main/);
  assert.match(aviso, /codex\/a-medias → 1 commit\(s\) sin publicar/);
});
