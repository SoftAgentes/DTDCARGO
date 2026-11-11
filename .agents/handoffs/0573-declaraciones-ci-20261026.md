# SDD-0573 · declaraciones de metadata para gate15

## Alcance y autoridad

DIRECTOR-0573-DECLARACIONES-GATE15-LOCAL-FIX-20261026.
Mismo CORE y owner worker-0573core-01a15a4e-ddf0-7d82-8656-d9dc56b58468.
Tarea separada de I2, que ya estaba fijado, revisado y respaldado. No se
reanuda ninguna de sus ejecuciones o recepciones.

Base exacta f60744cd92569b63b7e093a2afe495af55b6bd36,
tree b8f91a499749a483af99931a069fe4b31c3f2dad,
padre 34e5911c77bdc80956051984515df027b669fe5e.
Rama propia codex/sdd-0573-declaraciones-ci-20261026.
WT real C:/Users/AKX generator/.codex/worktrees/sdd-0573-declaraciones-ci-20261026/DTDCARGO.

El commit que contiene este handoff es candidato local hijo directo de f607.
La allowlist tiene exactamente dos rutas:
- supabase/pending-migration-symbol-declarations.json
- .agents/handoffs/0573-declaraciones-ci-20261026.md, nueva.

No se modifica producto, SQL, baseline, scanners, exclusiones, umbrales, tests,
configuración ni condiciones MIGRATE-FIRST. Pendiente no pasa a aplicada.
No hay nuevo SDD, excepción normativa o permiso financiero.

## Causa y delta exacto

La CI de Reportes15d había fallado gate15 tras sus pruebas. No se repite esa
CI ni se incorpora Reportes. La metadata se deriva contra f607 y el scanner
intacto; no se copian líneas de15d.

A. En degradations[id=sdd-0569-conversor-usd-tasas].evidence, sólo site de la
evidencia de error de duplicateInvoice cambia de
app/studio/(app)/facturacion/actions.ts:1019 a
app/studio/(app)/facturacion/actions.ts:1056.
La función completa fue leída desde Gitf607: Native517260/0, primera línea999,
2374bytes, SHA256 3c693e9d314f304b0dee13e14959e87619fd70493b726404e8b6be62cf3cd3c2.
El guard exacto es único en esa función. contains, degradation y todo lo demás
de0569 permanecen literales; actions.ts no cambia.

B. Sólo callSites del símbolo column journal_entries.reverses_entry_id del
grupo sdd-0573-reverso-al-anular cambia. Conjunto completo anterior y vigente,
agrupado por ruta exacta; cada número es una línea de ESA ruta:

| Ruta | Anterior | Vigente |
| --- | --- | --- |
| lib/studio/accounting/libro-control-queries.ts | 81,94,220,240,247,447,460 | 81,94,220,271,278,478,491 |
| lib/studio/accounting/libro-control.ts | 203,215,227,228,235,237,239 | 203,215,227,228,235,237,239 |
| lib/studio/accounting/ingreso-periodo.ts | ninguno | 295,296,348 |
| lib/studio/journal-queries.ts | 26,27,39,44,81,89,106,109,112,116,125,137,141,144,156 | 26,27,39,44,81,89,106,109,112,116,125,137,141,144,156 |
| app/studio/(app)/contabilidad/actions.ts | 294 | 294 |

Son30 sitios anteriores y33 vigentes. En libro-control-queries el helper I2
desplazó31 líneas los cuatro usos posteriores:240→271 conserva la lectura del
vínculo original;247→278 conserva el filtro de reversos;447→478 conserva el
mapper legado;460→491 conserva el mapper estricto. Los usos81/94/220 no se
desplazaron. No se elimina ningún uso de los otros archivos. Se agregan las
tres referencias existentes del puente puro295/296/348.

La derivación62d0d9/0 leyó internamente las cinco rutas fijas y emitió sólo
metadata de líneas, respetando máscara de comentarios y límites de
identificador del scanner. La única ejecución posterior del scanner intacto
confirmó igualdad del conjunto alcanzable. No se ejecutó el gate para explorar
y luego corregir/repetir.

## Fuentes leídas y preservación

Unidades completas, individuales y con presupuesto previo:
- Registro original18128bytes, blob6ffeed6b8e7e8ee7866d8a06f4d91955bfa8c8b1,
  SHA256 22d2299745d0ef439eeb1290c655ffdc270580a51ac0049b42e8674fa5bf85a0,
  Native87fb09/0.
- Scanner39124bytes, blob0184ab68dd7f047fc17aaae4bc26245b69ca3ef3,
  SHA256 98cdb3edb6e84abccc89c92fa0cdaebe705127e50bd0754a865e11071c87ea13,
  Native25b5fb/0.
- quality.yml3339bytes, blobe2bf24977abebd5c099d07aa744a9231ce233cff,
  SHA256 b4c7a99a466b57a14785dea147cbe71f1f8e764cff02ee7272203f1db6248b1e,
  Native0c8c45/0.

El workflow ordena node scripts/check-pending-migration-symbols.mjs; el
scanner importa sólo node:fs,node:path,node:url. El binario autorizado existía.
No requiere node_modules, instalación, pnpm/npm/npx ni otro script.

Prueba514253/0: dos sustituciones literales, count1, forward WHOLE e inversa
BYTEWHOLE; JSON válido con tres grupos. Se comprobó0571 idéntico como datos.
La comparación completa de bytes conserva todos los textos/campos fuera de
site0569 y callSites0573, incluidos el segundo símbolo
post_invoice_journal_entry_atomic y todas las evidencias/degradaciones0573.
No hubo reformat masivo.

Registro nuevo18308bytes, SHA256
318bae3ecda90ea73c83a8c47e208e73ddc0cecea38123cc4539eee6bde46b99.
Lectura nueva completa6f08b0/0. diff --check conforme.
El cotejo final externo del árbol fija los blobs ajenos y la identidad real
del commit; no se declara ese cierre futuro como ya ejecutado aquí.

## Única ejecución gate15: PASÓ en su alcance

Input real completo, guardado antes del await:
{
  "cmd": "& 'C:/Users/AKX generator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' scripts/check-pending-migration-symbols.mjs",
  "shell": "C:/Users/AKX generator/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe",
  "login": false,
  "tty": false,
  "workdir": "C:/Users/AKX generator/.codex/worktrees/sdd-0573-declaraciones-ci-20261026/DTDCARGO",
  "yield_time_ms": 10000,
  "max_output_tokens": 12000
}

Observaciones exteriores propias:
- beforeUtc:2026-10-26T04:01:01.165Z.
- Recepción terminal:2026-10-26T04:03:09.155Z.
Son tiempos del observador; no reloj/origen/budget financiero ni prueba de UTC
de otro sistema.

Inicial ecff1d: sesión propia55379, stdout vacío, sin exit terminal todavía.
Seguimientos de ESA MISMA sesión: aa6ed1, f5ee90 y77cd2f con stdout vacío;
a9446f terminó con exit0 y retorno completo3260tokens. Hubo UNA invocación
Node, sin retry/rerun ni otro binario. El resultado fue:
0 ROJO · 3 AMARILLO declarado(s) · 3 homónimo(s) descartado(s).

Los tres amarillos son0569/fx_rate_on,0571/congelar_tarifa_recepcion y
0573/journal_entries.reverses_entry_id. Se conservan las degradaciones
declaradas de migraciones pendientes; el gate no dice que estén aplicadas.

Los originales completos y sin normalizar quedaron en:
- 0573-declaraciones:gate15-single: input7args, beforeUtc y primer retorno.
- 0573-declaraciones:gate15-poll-1..4: input y retorno íntegros de cada poll.
- Retorno terminal original de poll4: chunk a9446f, exit0, stdout13039bytes/
  12913UTF16, sin omisiones ni truncación recibidas.
- 0573-declaraciones:gate15-terminal-receipt: recibo compacto y referencias.

Este handoff contiene el resultado y sus referencias; no sustituye el cuerpo
Native original por una declaración verde. La revisiónParent del original
completo sigue siendo un paso separado. No se heredó salida/exit/tiempo deCI,
ni se descargó log omitido. VersiónNode: no medida; no se invocó --version.

Omisiones: no otras suites, TypeScript, build, verify o CI; no comprobación de
DB aplicada, concurrenciaPG17, operación real, cohortes o aceptación financiera.
No hay SKIPs presentados como cobertura del producto.

## Aislamiento, gobernanza y cierre

Creación managed única6cfefa2c-b5a0-4b21-b4eb-600f1a145bf3; seguimiento normal
recibió completed/revision83 y ambas raíces reales coincidentes con este WT.
Guard propio91b07a/0: sieteGit individuales0, base/tree/padre exactos, detached
inicial limpio, rama nueva y claim ausentes, handoff ausente. Se creó la rama
exacta y claim propio205bytes, SHA256
1acf523ef85a9d3e374b3791d43f8948cefde561d2dd219ce388f1ee36b52189,
en Git worktrees/DTDCARGO14/harness-session-claim.json, con owner/ruta exactos.

Se aplica AGENT-BRIEF/registro vigentes: SGE-00 mantiene evidencia y límites
honestos; ERR-01 conserva el retorno real. UI, accesibilidad, mutaciónAUD-01,
SQL/aplicaciónDB y nuevas capacidades no aplican al delta de metadata.
No se altera0571 ni política. No se ejecutan gestores/conocimiento, inventarios,
Graphify/Archify/Obsidian ni bootstrap.

El cierre externo debe acreditar padre f607, exactamente1M+1A, árbol/índice
limpios y release sólo de este claim nuevo con pin/owner/ruta. El handoff no
afirma un FINNative todavía futuro. No se libera B4 ni otros claims, ni se
modifican WT I2/DTDCARGO13, consumidores o refs protegidas.

Pendiente de esta tarea: revisión fijaParent de JSON+handoff+Native original/
proof, respaldo normal posterior y composición/CI que coordineGeneral con15d.
No hay push/PR/main/merge/deploy/SQL porOwner.
FUERA DE ALCANCE: las75definicionesI2 siguen NOEJ local; no se reabre su focal.
Se conservan todas las lecturasSTOP,113b22/fixtures/Source03–06/RAW/custodia y
límites de Reportes. FechasCORE06 transcurrieron sinEJE06; no se infiere consumo
de claves. No cierre2.1/QPG17/B/finanzas ni reactivación de permisos históricos.
AutomatizaciónPAUSADA. TrasFIN no se adelanta otra tarea.
