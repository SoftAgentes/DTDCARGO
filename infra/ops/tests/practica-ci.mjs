// Gate focal: un exit 0 con navegador omitido no acredita la práctica.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const tituloPreparados='perfiles nuevos practican destino preparado sin acciones previas de China';
const esperadosPreparados=['operations-shipments','warehouse-ve','support-ve'].flatMap(perfil=>[390,1280].flatMap(width=>['light','dark'].map(tema=>`${perfil}-${width}-${tema}`))).sort();
function comprobar(informe, matriz, preparados) {
  const pruebas = informe.testResults.flatMap(a => a.assertionResults);
  assert.ok(pruebas.length > 0, 'Debe haber pruebas ejecutadas');
  assert.ok(pruebas.every(p => p.status === 'passed'), 'Ninguna prueba focal puede quedar omitida o pendiente');
  assert.equal(pruebas.filter(p => p.title === 'recorrido persistido de pantalla a 390 y 1280 px, sin efectos externos').length, 1);
  assert.deepEqual([...matriz].sort(), ['1280-dark','1280-light','390-dark','390-light']);
  assert.equal(pruebas.filter(p=>p.title===tituloPreparados).length,1);
  assert.deepEqual([...preparados].sort(),esperadosPreparados,'Deben terminar los 12 recorridos de perfiles nuevos');
  return pruebas.length;
}

if (process.argv.includes('--autoprueba')) {
  const informe = {testResults:[{assertionResults:[{title:'recorrido persistido de pantalla a 390 y 1280 px, sin efectos externos',status:'passed'},{title:tituloPreparados,status:'passed'}]}]};
  const matriz = ['390-light','390-dark','1280-light','1280-dark'];
  assert.equal(comprobar(informe, matriz,esperadosPreparados), 2);
  assert.throws(() => comprobar({testResults:[]}, matriz,esperadosPreparados));
  assert.throws(() => comprobar({testResults:[{assertionResults:[{...informe.testResults[0].assertionResults[0],status:'pending'},informe.testResults[0].assertionResults[1]]}]}, matriz,esperadosPreparados));
  assert.throws(() => comprobar(informe, matriz.slice(1),esperadosPreparados));
  assert.throws(() => comprobar(informe, matriz,esperadosPreparados.slice(1)));
  assert.throws(() => comprobar({testResults:[{assertionResults:[informe.testResults[0].assertionResults[0]]}]},matriz,esperadosPreparados));
  console.log('PASÓ · gate rechaza suite vacía, navegador omitido y matrices incompletas de China y perfiles nuevos.');
} else {
const carpeta = mkdtempSync(join(tmpdir(), 'practica-ci-'));
const reporte = join(carpeta, 'vitest.json');
const recibo = join(carpeta, 'navegador.json');
const resultado = spawnSync(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', [
  'exec', 'vitest', 'run', 'lib/studio/practica/__tests__', '--maxWorkers=1',
  '--reporter=default', '--reporter=json', process.platform === 'win32' ? `"--outputFile.json=${reporte}"` : `--outputFile.json=${reporte}`,
], {stdio:'inherit', shell:process.platform === 'win32', env:{...process.env,PRACTICA_NAVEGADOR:'1',PRACTICA_RECIBO:recibo}});
if (resultado.error) throw resultado.error;
assert.equal(resultado.status, 0, 'La suite focal debe terminar aprobada');
const informe = JSON.parse(readFileSync(reporte, 'utf8'));
const matriz = JSON.parse(readFileSync(recibo, 'utf8'));
const preparados=JSON.parse(readFileSync(recibo+'.preparados.json','utf8'));
const cantidad = comprobar(informe, matriz,preparados);
console.log(`PASÓ · ${cantidad} pruebas focales sin omisiones; Chromium ejecutó ${matriz.join(', ')} y ${preparados.length} recorridos preparados: ${preparados.join(', ')}.`);
}
