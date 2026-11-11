# Handoff · SDD-0577 · contratos de pruebas Portal/Embarques

Fecha: 2026-10-21. Estado: checkpoint c4 aceptado para PR DRAFT/composición;
GO3 receptor aceptado en 16 pasos medidos, CIERRE INCOMPLETO 16/17.
Conocimiento y liberación del claim pendientes de GO expreso. SDD: in-progress.
Worker: /root/revision_fixtures, adopción explícita como Worker independiente
después de terminar la revisión read-only; reglas actuales del principal.

## Identidad, alcance y permisos

- Owner: worker-0577-01a15a4e-ddf0-7d82-8656-d9dc56b58468.
- Sesión: 01a15a4e-ddf0-7d82-8656-d9dc56b58468.
- Worktree: C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/sdd-0577-contratos-pruebas-portal-embarques.
- Rama: codex/sdd-0577-contratos-pruebas-portal-embarques.
- Base inicial: eafbd910d1c082c9b416b558f8c3db5847b994a6.
- Reserva publicada y remoto comprobado:
  8e1d2765d7b51db811d4a367ea2f2cc13aa3e73b.
- SDD: docs/specs/0577-contratos-pruebas-portal-embarques/spec.md.
- Contrato externo: C:/tmp/director-traspaso-20261020/0577-contratos-pruebas-asignacion-worker.md,
  SHA-256 cc8e1c968640605bee912e509bcd61dc0b4ff06f3aa50057a5978eaaba72ffa5.
- Preparación leída íntegra: C:/tmp/director-traspaso-20261020/fixtures-portal-embarques-preparacion.md,
  SHA-256 516cebf9696342ba8fc1d76f9081efed1b3405344d2bf62a309149a628099012.
- Director asignó 0577 con inventario/fetch de 497 refs y worktrees. Sin SQL.
- GO pesado recibido después de devolución expresa de 0574 a 09:15:44Z.
- Permitidos: commits/push propios, checkpoint para revisión y PR DRAFT base main.
  La canónica general se ejecutó con GO3 en receptor 22bd5192, registrada por su SHA.
  Este cierre ligero autoriza solo spec/handoff/índice generado, checks documentales
  y commit/push selectivo; sin repetir pruebas ni ejecutar conocimiento todavía.
- Sin main, merge de PR, deploy, VPS, DB real, PII, secretos, cuentas ni otros Workers.

Allowlist exacta: los dos tests, la spec 0577, docs/specs/README.md generado y este
handoff. Las cinco rutas están enumeradas en la spec. Claim adquirido y conservado
hasta revisión/handoff e instrucción explícita del Director. No se limpian recursos
ajenos ni se elimina worktree/rama/store.

## OBJETIVO ORIGINAL

Corregir exclusivamente el contrato de reintento de borrado y consultas positivas
del caso Portal de archivos/Excel, conservando todos los oráculos y 40 casos.
No modificar producto ni atribuir causa del timeout sin medición.

## COMPLETADO

- Guard/claim, raíz/rama/base limpia, adopción y reserva publicada.
- Preimágenes de ambos tests iguales en árbol inicial, base, main conocido/C2/C3,
  0571 ba43747a803ea9aec3b8750d1b461d69795834a5 y checkpoint 0574
  639c8954607ee81f86694390775fae325acadf8a.
- Merge-base main conocido d410ab2 y 0571 ba43747 confirmado: eafbd910.
- Instalación propia única con lockfile congelado y sin scripts, exit 0.
  package/lock/config/setup conservan sus blobs originales.
- Original sin instrumentar: 40/40 PASÓ, 2 workers, retry 0.
- Embarques: espera dentro del mismo diálogo el botón «Eliminar embarques»
  visible y habilitado antes de un solo segundo click; sin efectos dentro de
  waitFor, sleeps, cambio de mock o de límites.
- Portal: solo el caso compacto de Files/Excel. Consultas positivas en la región
  real de uploads, que permanece montada. Conserva File/chooser, FormData y
  recepción; todas las negativas y la cardinalidad global del título siguen iguales.
  No se modifica ningún helper global ni los otros 22 casos.
- Candidato sin instrumentar, mismo comando/runtime: 40/40 PASÓ.
- Correspondencia AST y JSON nativos: mismos 40 nombres únicos y firmas;
  171 oráculos previos conservados en orden, matcher/valores esperados iguales;
  29 negativas con objetivo idéntico; solo 3 objetivos positivos pasan a within
  en Portal; 2 aserciones nuevas visible/enabled; 38 cuerpos de casos idénticos.
  La revisión del diff comprueba además las acciones, transporte y allowlist.
- Lint focal de los dos tests PASÓ, sin warnings ni archivos ignorados.
- Numeración PASÓ: 556 specs, 488 migraciones; 11 colisiones históricas congeladas
  reconocidas por el script, ninguna colisión nueva. No se consultó ni escribió DB.
- Director aceptó c4b2e72dabbdde80ec7fe5c8a7f128966b6494be para PR DRAFT y
  composición local revisada. Revisó delta completo, metadata/driver/lint y los
  13 artefactos por hash/bytes; revisión independiente sin hallazgo obligatorio,
  SHA-256 e48f432cd469f299ef8f9db1d5ebee569f7941a554a8b810a680b0584592c057.
- PR 315 creada OPEN/DRAFT y adjunta al chat. La evidencia receptora GO3 se detalla
  abajo; este cierre no cambia los dos blobs de tests del checkpoint c4.

Blobs de tests ejecutados en el candidato:

- Portal: 8112f1d2d1d98623830e31855e67c0bf97b325d3.
- Borrado: 64c357737fd383078ce3b68594f816561f93bed5.

## VALIDACIÓN

| Comprobación | Estado | Evidencia o límite |
|---|---|---|
| Aislamiento / guard / ownership / reserva remota | PASÓ | Owner, rama y reserva arriba |
| Instalación congelada, sin scripts, store propia | PASÓ | install-01.pnpm.log; exit 0; una sola instalación |
| Preflight inicial vía corepack.cmd con JS inline | FALLÓ | SyntaxError de quoting; no fue corrida de tests ni motivo de reinstalación |
| Preflight directo Node + corepack.js | PASÓ | Node 24.20.0, Corepack 0.35.0, pnpm 12.14.0, Vitest 4.1.7 |
| Original 40, sin instrumentar | PASÓ | original-01.vitest.json/log y driver; exit 0 |
| Candidato 40, mismo comando | PASÓ | candidate-01.vitest.json/log y driver; exit 0 |
| Casos/firmas y correspondencia de oráculos | PASÓ | oracles-and-cases-01.json; revisión estática + ambos JSON nativos |
| Lint focal de dos tests | PASÓ | ESLint 9.39.4; exit 0, sin diagnósticos; lint-01.receipt.json |
| Numeración | PASÓ | numbering-01.log; exit 0, sin colisiones nuevas |
| Índice / docs:check final | PASÓ | Índice generado, 556 specs; docs-check-01.log; exit 0 |
| Diff-check / allowlist final | PASÓ | Cinco rutas exactas; sin cambios de producto/package/lock/config |
| Pares adicionales / perfil CPU | NO EJECUTADO | No se afirma mejora estable ni se necesitó atribuir causa para el cambio acotado |
| Canónica propia sobre base histórica | NO EJECUTADO | No se repite producto intacto; la receta GO3 pertenece al receptor 22bd5192 |
| Canónica receptora GO3 | CIERRE INCOMPLETO 16/17 | Exit 0 sobre 22bd5192, 16 pasos medidos aceptados; ledger OMITIDO y avisos conservados |
| Knowledge/Graphify/Archify/preview | NO EJECUTADO | Director indicó no ejecutarlos todavía |
| UI/SQL/build propios | NO EJECUTADO | Sin producto/UI/SQL nuevos; build incluido en canónica receptora |

Original: 09:19:27.893Z–09:19:50.738Z, pared del driver 22845.05 ms;
Portal completo 20616 ms, caso Files/Excel 2506.32 ms; reintento Embarques 626.70 ms.
Candidato: 09:20:56.504Z–09:21:18.643Z, pared del driver 22139.00 ms;
Portal completo 19976 ms, caso Files/Excel 2259.59 ms; reintento Embarques 655.67 ms.

Ambos pasaron. Este único par no demuestra reducción estable, causa del timeout
C3 ni comportamiento bajo la concurrencia de su suite general. No se fabricó ROJO,
no se modificaron topes/config/skips y no se ejecutaron pares adicionales sin necesidad.

### Entorno y comando efectivo

Node real y del proceso pnpm: v24.20.0, C:/Program Files/nodejs/node.exe.
Corepack 0.35.0; pnpm efectivo 12.14.0; Vitest 4.1.7; TypeScript 5.9.3.
pnpm del PATH es un wrapper fallback Codex con su propio Node y no se usó.
package.json no declara packageManager. Auto-pin se deshabilitó solo en cada
proceso; se restauró la ausencia previa mediante Remove-Item Env:.
No se copiaron secretos, .env o node_modules de otros worktrees.

Instalación única:

    corepack pnpm install --frozen-lockfile --ignore-scripts --store-dir node_modules/.pnpm-store-0577

Store propia preservada dentro de node_modules, ignorada por /node_modules.
Avisos conservados: descargas lentas y clave pnpm.onlyBuiltDependencies ya no leída
por pnpm 12; no se cambió configuración para ocultarlos. La resolución se omitió
porque el lock estaba actualizado. El preflight inline vía .cmd mostró SyntaxError
y eco de ejecución; se resolvió usando el archivo Corepack existente con Node,
sin modificar wrappers ni repetir la instalación exitosa.

Invocación focal efectiva, idéntica entre original y candidato salvo nombre de
salida exclusivo:

    & "C:/Program Files/nodejs/node.exe" "C:/Program Files/nodejs/node_modules/corepack/dist/corepack.js" pnpm test "app/p/[token]/supplier-flow.test.tsx" "app/studio/(app)/embarques/_components/__tests__/EmbarquesClient.borrado.test.tsx" --maxWorkers=2 --retry=0 --reporter=default --reporter=json --outputFile="<ruta exclusiva del JSON nativo>"

Firmas originales y candidatas, títulos it en orden UTF-8/LF y LF final:
Portal 23 = a302d42af39bbc139f826442502812806fec36f65023f305c2930de01ff84eb5;
Embarques 17 = 66a9d5dded14c60a21d4570ebe0a073c322e41381702bdc12b99dd3aa4375f39.
Los JSON nativos también contienen exactamente los mismos 40 nombres únicos,
40 PASÓ, 0 FALLÓ, 0 pendientes.

### Composición receptora C3 · GO3, separada del focal propio

Receptor aprobado/ejecutado: 22bd5192825199aeafd0cf5e3625606ff77657b0,
rama codex/sdd-0576-fechas-caracas-movil, incorporando c4b2e72d.
Comando normal corepack pnpm verify de 2026-10-21 09:58:37.0499811Z a
10:36:15.3461774Z, exit 0. Solo dos banderas Corepack de proceso; sin VERIFY*,
NODE_OPTIONS, credenciales ni cambios de workers/timeouts/runner.
Los manifests sellados antes/después del EXIT conservan 43 rutas únicas, sus
43 hashes y bytes, HEAD intacto, bytecheck 10:36:15.5742581Z antes de documentos.
El Director aceptó los 16 pasos medidos; la salida literal conserva
CIERRE INCOMPLETO 16/17, sin verde completo ni autorización de release.

| Comprobación receptora | Estado | Resultado y límite |
|---|---|---|
| Harness | PASÓ | 237/237, sin omisiones |
| Lint, RSC, tipos y cuatro Edge | PASÓ | Lint 0 errores/15 avisos conservados |
| Unitario, primer intento | FALLÓ / PARCIAL | Exit 1; 12823 PASÓ/1 SKIP de 12936, 886 archivos PASÓ/1 SKIP de 889; 2 errores del pool tras ZoneOOM; 519.63 s; no acredita lo no reportado |
| Unitario, único retry nativo | PASÓ CON OMISIÓN | 12935 PASÓ/1 SKIP de 12936; 888 archivos PASÓ/1 SKIP de 889; 647.26 s; no se suman intentos |
| Identidad nativa del SKIP unitario | NO DISPONIBLE | Stdout informa 1 skipped sin nombre; corpus.test.ts:31 es correspondencia estática/inferencia, no resultado nominal nativo |
| Docs, numeración, constantes, componentes, gobernanza y manifiesto pendiente | PASÓ | Manifiesto conserva 0 ROJO/2 AMARILLO declarados/3 homónimos descartados |
| migrations-applied / ledger productivo | OMITIDO / NO MEDIDO | Faltan URL/SERVICE_ROLE; sin lectura ni aplicación de DB real |
| SQL y reconstrucción efímeros | PASÓ | 249 contratos con rollback; 492 migraciones = 474 DDL desde cero + 18 solo-ledger; 219 tablas/2 tenants sintéticos |
| E2E | PASÓ CON AVISOS/OMISIONES | Original 198 únicos = 177 expected + 20 skipped + 1 flaky, 0 unexpected; duración 557377.402 ms; error global del worker conservado |
| Build normal | PASÓ | tsconfig restaurado por el runner; sin edición manual |

El corpus real de proformas depende de DOCUMENT_IMPORT_CORPUS/carpeta disponible;
su correspondencia estática no prueba el nombre de la omisión en esta corrida.
No se leyó el corpus ni se reconstruyeron casos nativos desde caché.

Flaky E2E real: Chromium company-photo-carousel.spec.ts:93, aserción línea 103
sobre #operacion video, expected 2/received 1. Primer resultado failed 20335 ms;
retry 1 passed 20753 ms. Es distinto del auth de las dos recetas históricas.
Error global literal: worker-17 process did not exit within 300000ms after stop,
force-killed it. El runner lo convirtió en e2e OK con aviso y lo describe como
WebKit/Windows; esa interpretación no acredita causalidad independiente.

Omisiones E2E nativas: comments-lifecycle 3 por Preview aislado/credenciales/seed;
carousel móvil 2 porque capturas 390/1440 se hacen una vez; gastos 6 por
accounting/admin y gasto vivo de fixture; búsqueda global 6 por credenciales
Studio/branch/seed; nómina 3 por admin y finiquito desechable del seed.
La navegación sintética deny-only no prueba sesiones/RLS/filas reales ni
dispositivo físico. SQL efímero y build tampoco certifican aislamiento productivo.

Las recetas C3 históricas conservan FALLÓ y CIERRE ADEMÁS INCOMPLETO:
a732bcb0221ad821c671b0ee18d52ab928da26eb, exit 1, env-contract en ambos intentos
y timeout Portal añadido en el retry; d1a7cca287fafcfe978ac74a58c40040889193c2,
exit 1, Portal timeout en el primer intento y búsqueda del botón de Embarques en
el retry. Sus reintentos, SKIPs y avisos se preservan; no se suman ni se sustituyen
por GO3. No se demuestra causa del timeout Portal ni mejora temporal estable.

Revisión íntegra del Director leída y cotejada:
C:/tmp/director-traspaso-20261020/caracas-c3-revision-director-go3-terminada.md,
SHA-256 e46a0136ac34387f18ad5ddcb09238f167d305717658dac96dbe74901b697334.
Se cotejaron bytes/hash de los seis artefactos nativos de
C:/tmp/director-traspaso-20261020/0576-c3-next/canonical-3/; se parsearon ambos
manifests sellados y el JSON E2E completo, sin tocar el árbol escritor C3.

| Artefacto receptor | Bytes | SHA-256 |
|---|---:|---|
| verify-canonical.json | 511 | 3b7fb1b1c2d0e2e8fb2ae063f7b050445cf2b6a1788251fdbcbe313eb6a18022 |
| verify-canonical.log | 165915 | f4e8d39ee407d231b35836b889a4db39b30fefcb00d2c3a025e6ca95b40a5d14 |
| verify-manifest-before.json | 7531 | 61c8e2eb51762659cd6f5ef005289aaa6af42283df9341d74a448ee30772dda8 |
| verify-bytecheck-after.json | 7588 | ec9d2c3cb8ae8919321bec345900e0a439c857e0a83319a83b54e95deac39797 |
| e2e-c3-original-54192.json | 270339 | 455ae60e2a70281f0f87ff808b3e96cc82369a774e3fba68476d70115059b437 |
| e2e-c3-observer-final.json | 442 | 75a2afac0f19512496e55f31ab42f517fb9c0d53f5dcea0f8e6218c9db4212a5 |

### Evidencia externa propia

Raíz: C:/tmp/director-traspaso-20261020/0577-fixtures-validation/.

- install-01.pnpm.log
- original-01.vitest.log / original-01.vitest.json / original-01.driver.json
- candidate-01.vitest.log / candidate-01.vitest.json / candidate-01.driver.json
- preflight-versions-01.incident.json: error del wrapper y resolución, sin repetir instalación.
- inspect-0577-oracles-01.mjs / oracles-and-cases-01.json: inspector estático externo,
  no instrumenta pruebas ni sustituye su ejecución.
- lint-01.receipt.json / numbering-01.log / docs-check-01.log; el lint no emitió diagnósticos y Tee-Object no creó log vacío. El recibo conserva su exit observado; la inspección del log ausente se registró como incidencia de captura, sin repetir el lint.
- checkpoint-validation-01.json: recibo final externo con SHA del checkpoint,
  hashes y recursos atribuibles; se sella después del commit/push.

Cierre documental ligero actual: índice regenerado y docs:check PASÓ con 556 specs;
numeración PASÓ con 488 migraciones y las 11 colisiones históricas congeladas,
sin nuevas. Node directo v24.20.0; sin instalación, tests, SQL, knowledge ni navegador.
Outputs nuevos: cierre-documental-index-01.log, cierre-documental-docs-check-01.log,
cierre-documental-numbering-01.log y cierre-documental-checks-01.json. Este último
conserva también el error de preparación PowerShell de una consulta de hashes
(pipe tras foreach, sin validación ni escritura); la consulta corregida cotejó
los seis originales C3. No es fallo de instalación ni corrida de pruebas.
Diff-check y allowlist de tres rutas se verifican antes del commit D; su recibo
externo posterior fija SHA/remoto, hashes, PR y claim retenido.

Hashes SHA-256 ya comprobados:

| Evidencia | SHA-256 |
|---|---|
| original-01.vitest.json | 86c4134d4671425cda3e991c5d2014c1b837ea8b968e9a8c4e548150b7af081a |
| candidate-01.vitest.json | 026ddcbcb727dba70c8a8bef313aab21b512781d3b4972e67f56a9d2d34f08bc |
| oracles-and-cases-01.json | b40c84f7c083554d8a6492a7b40ffdfa34ae379273b21c5ee861102499a2cd9d |

## COMMITS

- 8e1d2765d7b51db811d4a367ea2f2cc13aa3e73b: reserva SDD/handoff/índice, publicada.
- c4b2e72dabbdde80ec7fe5c8a7f128966b6494be: implementación focal revisada y publicada;
  original/candidato ejecutados sobre bytes locales de reserva 8e1d2765, vinculados
  a los blobs de c4 por el recibo 2824, sin atribuir una ejecución iniciada en c4.
- Cierre documental D: commit que contiene esta versión, limitado a tres rutas
  documentales. SHA/remoto/checks constan en cierre-documental-01.receipt.json
  externo después de commit/push; no se crea recursión para insertar su propio hash.

## PR / BRANCH

PR https://github.com/SoftAgentes/DTDCARGO/pull/315 OPEN/DRAFT, base main;
rama propia indicada arriba. c4 fue aceptado para composición y el cierre documental
actualiza su head sin cambiar tests. Nuevo body/readback pr-draft-02, externos;
pr-draft-01 permanece intacto. No se integró ni desplegó. La receta general se
registra por separado sobre el receptor 22bd5192, sin atribuirla a c4 o D.

## PENDIENTES DE ESTA TAREA

- Revisión del cierre documental D, su recibo nuevo y actualización PR DRAFT.
- Un único ciclo nativo de conocimiento después de D limpio, solo cuando el Director
  asigne GO pesado; no está ejecutado ni certificado en este documento.
- Integración y publicación compartida corresponden al Director sobre main comprobado;
  ledger release OMITIDO, conocimiento y claim release conservan sus fronteras.

## FUERA DE ALCANCE DETECTADO

Historial C3 de env-example-contract y fallos bajo suite general; producto/revisión
0574; ajuste de claves pnpm o wrappers; cualquier fallo ajeno de producto/config/
runner. Ninguno se absorbe en 0577. Gobernanza de comportamiento de producto/UI
nueva: no aplica, solo pruebas/documentación sin cambio de experiencia o datos reales.

## HANDOFF AL DIRECTOR

Revisar el cierre documental D y su delta de tres rutas respecto de c4; el delta
acumulado de la tarea sigue en cinco rutas. Tests conservan los blobs c4 probados;
GO3 corresponde al receptor 22bd, con CIERRE INCOMPLETO 16/17 y todos sus avisos.
No se transporta producto de C2; specs/índice receptor se preservan al componer.

El claim continúa adquirido hasta instrucción explícita. Los procesos focales y
ESLint terminaron; no se abrió servidor ni se reclamó puerto. Consulta Win32_Process de Node por ruta propia: cero procesos atribuibles tras los checks. El recibo final revalida esta observación, preservando cualquier atribución incierta.

Impacto documental: spec 0577 y este handoff dentro de la rama, índice generado.
Integración, estructura Graphify, cobertura semántica, Archify y preview Obsidian
siguen pendientes por turno; sin publicación compartida. Plan externo v02 aceptado,
cierre-documental-knowledge-plan-02.md, SHA-256
216b710da194568997e59715968c54d199ce318f40b870b53b870882081b7deb, inmutable.
El ciclo futuro usará runtime oficial Archify 2.16.0 con ZIP/tree lock en ignorados
propios y un único update Graphify 0.9.61 nativo, según ese plan; resultados externos
nuevos en knowledge-native-01/closure-receipt-01.json, sin autocitación tracked
posterior ni cobertura semántica inventada. Knowledge y claim release esperan GO.
Los 13 originales y checkpoint-validation-01.json SHA-256
2824bd5df16ac699c101024dcecace19de8577f7d1727c4fbfb499449c8f2d8e se conservan.
No se escribió memoria.
El índice de la base histórica muestra 0569-0576 como huecos locales; no significa
que estén libres. Al componer se preservan las specs de la rama receptora.
