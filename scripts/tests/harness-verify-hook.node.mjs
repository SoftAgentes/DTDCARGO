import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { clasificarGate } from '../harness-verify-hook.mjs';
import { MAX_BUFFER } from '../harness-spawn.mjs';
const hook = fileURLToPath(new URL('../harness-verify-hook.mjs', import.meta.url));
test('un gate sin medir bloquea igual que un rojo, pero no se disfraza de rojo', () => {
  assert.ok(MAX_BUFFER >= 32 * 1024 * 1024);
  assert.deepEqual(clasificarGate({ status: 0 }), { bloquea: false, medido: true, motivo: 'verde' });
  const rojo = clasificarGate({ status: 1 });
  assert.equal(rojo.bloquea, true); assert.equal(rojo.medido, true); assert.match(rojo.motivo, /ROJO \(exit 1\)/);
  // spawnSync mata al hijo al desbordar el búfer: el gate no terminó, así que no hay veredicto.
  const desbordado = clasificarGate({ status: null, signal: 'SIGTERM', error: Object.assign(new Error('spawnSync ENOBUFS'), { code: 'ENOBUFS' }) });
  assert.equal(desbordado.bloquea, true); assert.equal(desbordado.medido, false); assert.match(desbordado.motivo, /64 MB de salida capturada/);
  const noLanzado = clasificarGate({ status: null, error: Object.assign(new Error('spawnSync ENOENT'), { code: 'ENOENT' }) });
  assert.equal(noLanzado.bloquea, true); assert.equal(noLanzado.medido, false); assert.match(noLanzado.motivo, /ENOENT/);
  const porSenal = clasificarGate({ status: null, signal: 'SIGKILL' });
  assert.equal(porSenal.bloquea, true); assert.equal(porSenal.medido, false); assert.match(porSenal.motivo, /SIGKILL/);
  // En Linux un desbordamiento suele llegar con status 0, porque el hijo alcanza a salir
  // bien antes del corte. Un exit 0 con error NO es un gate verde: nunca midió.
  const verdeFalso = clasificarGate({ status: 0, signal: null, error: Object.assign(new Error('spawnSync ENOBUFS'), { code: 'ENOBUFS' }) });
  assert.equal(verdeFalso.bloquea, true); assert.equal(verdeFalso.medido, false);
  // Ningún motivo sin medir puede leerse como un veredicto rojo.
  for (const sinMedir of [desbordado, noLanzado, porSenal, verdeFalso]) assert.doesNotMatch(sinMedir.motivo, /ROJO/);
});
test('el hook deja cerrar solo con un gate verde, y una salida enorme ya no lo engaña', (t) => {
  const sandbox = mkdtempSync(path.join(tmpdir(), 'dtd-hook-test-'));
  // This fixture is the only recursive deletion target; never a real checkout.
  t.after(() => { assert.ok(path.resolve(sandbox).startsWith(path.resolve(tmpdir()) + path.sep)); rmSync(sandbox, { recursive: true, force: true }); });
  const marca = path.join(sandbox, 'gate-corrio.txt');
  mkdirSync(path.join(sandbox, 'scripts'), { recursive: true });
  const r = spawnSync('git', ['init', '-b', 'main'], { cwd: sandbox, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  function fakeVerify({ exit, megas = 0 }) {
    if (existsSync(marca)) rmSync(marca);
    writeFileSync(path.join(sandbox, 'scripts', 'verify.mjs'), [
      "import { writeFileSync } from 'node:fs';",
      `writeFileSync(${JSON.stringify(marca)}, 'corrió');`,
      `for (let i = 0; i < ${megas}; i++) process.stdout.write('x'.repeat(1024 * 1024));`,
      "process.stdout.write('\\nULTIMA-LINEA-DEL-GATE\\n');",
      // `process.exitCode`, NUNCA `process.exit()`: en Linux las escrituras a un pipe son
      // asíncronas y `exit()` descarta lo pendiente. Medido con Node 24: de 3.145.751 bytes
      // llegaban 146.176 y la última línea se perdía, mientras en Windows llegaba todo. Eso
      // hacía fallar en la CI la prueba de que la cola conserva el final del gate.
      `process.exitCode = ${exit};`,
    ].join('\n'));
  }
  const correr = (input = '{}') => spawnSync(process.execPath, [hook], { cwd: sandbox, input, encoding: 'utf8' });
  fakeVerify({ exit: 1 });
  // Sin cambios en app/lib/supabase el gate ni se lanza: el cierre es instantáneo.
  assert.equal(correr().status, 0);
  assert.equal(existsSync(marca), false);
  mkdirSync(path.join(sandbox, 'app'));
  writeFileSync(path.join(sandbox, 'app', 'pagina.tsx'), 'export default null;\n');
  // Anti-loop: con stop_hook_active tampoco se lanza.
  assert.equal(correr(JSON.stringify({ stop_hook_active: true })).status, 0);
  assert.equal(existsSync(marca), false);
  const rojo = correr();
  assert.equal(rojo.status, 2); assert.ok(existsSync(marca));
  assert.match(rojo.stderr, /🛑 Harness gate en ROJO \(exit 1\)/);
  assert.match(rojo.stderr, /ULTIMA-LINEA-DEL-GATE/);
  fakeVerify({ exit: 0 });
  assert.equal(correr().status, 0);
  // El defecto: 3 MB de salida desbordaban el maxBuffer por defecto de 1 MB, spawnSync
  // mataba al gate a media corrida y el hook informaba ROJO un gate verde.
  fakeVerify({ exit: 0, megas: 3 });
  const verdeRuidoso = correr();
  assert.equal(verdeRuidoso.status, 0, verdeRuidoso.stderr.slice(0, 300));
  assert.doesNotMatch(verdeRuidoso.stderr, /🛑|SIN MEDIR/);
  // Y un rojo ruidoso sigue bloqueando, con la cola real del final de la corrida.
  fakeVerify({ exit: 3, megas: 3 });
  const rojoRuidoso = correr();
  assert.equal(rojoRuidoso.status, 2);
  assert.match(rojoRuidoso.stderr, /🛑 Harness gate en ROJO \(exit 3\)/);
  assert.match(rojoRuidoso.stderr, /ULTIMA-LINEA-DEL-GATE/);
  // Un gate que desborda el búfer de verdad: spawnSync lo mata, no hay veredicto y el
  // cierre se bloquea diciendo SIN MEDIR, nunca ROJO.
  fakeVerify({ exit: 0, megas: 80 });
  const sinMedir = correr();
  assert.equal(sinMedir.status, 2);
  assert.match(sinMedir.stderr, /SIN MEDIR/);
  assert.match(sinMedir.stderr, /64 MB de salida capturada/);
  assert.doesNotMatch(sinMedir.stderr, /gate en ROJO/);
  // El aviso de rama sin publicar llega a stderr sin decidir el cierre.
  writeFileSync(path.join(sandbox, 'scripts', 'check-unpublished.mjs'), "process.stdout.write('[AVISO] rama sin publicar\\n');\n");
  fakeVerify({ exit: 0 });
  const conAviso = correr();
  assert.equal(conAviso.status, 0); assert.match(conAviso.stderr, /\[AVISO\] rama sin publicar/);
});
