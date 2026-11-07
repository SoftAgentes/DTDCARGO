// Corre en el harness las pruebas de Python de los envoltorios de la oficina
// (infra/oficina/envoltorios, SDD-0615): dtd-motor, dtd-claude, dtd-codex, dtd-agente-run
// y el sudoers. Es código de la oficina de agentes, no del producto. Sin red y sin sudo.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';

const CARPETA = path.join('infra', 'oficina', 'envoltorios', 'tests');
/** Piso de pruebas: un «OK» con menos pruebas de las que hay es un verde vacío. */
const MINIMO = 42;

const python = ['python3', 'python'].find((candidato) => {
  const r = spawnSync(candidato, ['-c', 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)'], { windowsHide: true });
  return r.status === 0;
});
const enCi = process.env.CI === 'true';
const skip = python || enCi ? false : 'NO DISPONIBLE: Python 3.9 o superior';

test('envoltorios de la oficina: las pruebas de Python pasan y no son menos de las esperadas', { skip }, () => {
  assert.ok(python, 'hace falta python3 para probar los envoltorios de la oficina');
  const r = spawnSync(python, ['-I', '-B', '-m', 'unittest', 'discover', '-s', CARPETA, '-v'], {
    encoding: 'utf8',
    windowsHide: true,
  });
  const salida = `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
  assert.equal(r.status, 0, salida);
  const corridas = /^Ran (\d+) tests?/m.exec(salida);
  assert.ok(corridas, `unittest no informó cuántas pruebas corrió:\n${salida}`);
  assert.ok(Number(corridas[1]) >= MINIMO, `corrieron ${corridas[1]} pruebas y se esperan al menos ${MINIMO}:\n${salida}`);
  assert.match(salida, /^OK\b/m, salida);
  // En Windows se saltan las dos de enlaces y permisos; en Linux (el CI) no se salta ninguna.
  if (process.platform !== 'win32') {
    assert.doesNotMatch(salida, /skipped/i, `en Linux ninguna prueba de los envoltorios se salta:\n${salida}`);
  }
});
