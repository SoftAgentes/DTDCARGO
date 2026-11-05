// Corre en el harness las pruebas de Python del puente de ALFRED
// (infra/oficina/dtd-alfred), que es código de la oficina de agentes y no del
// producto: Vitest no lo ve. Sin red y sin dependencias.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';

const CARPETA = path.join('infra', 'oficina', 'dtd-alfred', 'tests');
/** Piso de pruebas: un «OK» con menos pruebas de las que hay es un verde vacío. */
const MINIMO = 32;

const python = ['python3', 'python'].find((candidato) => {
  const r = spawnSync(candidato, ['-c', 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)'], { windowsHide: true });
  return r.status === 0;
});
// En el CI no se salta: el runner de ubuntu trae python3, y sin él esto es rojo.
const enCi = process.env.CI === 'true';
const skip = python || enCi ? false : 'NO DISPONIBLE: Python 3.9 o superior';

test('puente de ALFRED: las pruebas de Python pasan y no son menos de las esperadas', { skip }, () => {
  assert.ok(python, 'hace falta python3 para probar el puente de ALFRED');
  // -I: sin variables ni rutas del usuario. -B: no deja __pycache__ en el árbol.
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
  assert.doesNotMatch(salida, /skipped/i, `ninguna prueba del puente se salta:\n${salida}`);
});
