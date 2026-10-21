# Handoff · SDD-0577 · contratos de pruebas Portal/Embarques

Fecha: 2026-10-21. Estado: checkpoint funcional preparado para revisión;
aceptación canónica de composición C3 pendiente. SDD: in-progress.
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
  Canónica general se ejecutará en composición C3 con un GO nuevo.
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
| Canónica general corepack pnpm verify | NO EJECUTADO | Composición C3 receptora, con GO nuevo |
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

Hashes SHA-256 ya comprobados:

| Evidencia | SHA-256 |
|---|---|
| original-01.vitest.json | 86c4134d4671425cda3e991c5d2014c1b837ea8b968e9a8c4e548150b7af081a |
| candidate-01.vitest.json | 026ddcbcb727dba70c8a8bef313aab21b512781d3b4972e67f56a9d2d34f08bc |
| oracles-and-cases-01.json | b40c84f7c083554d8a6492a7b40ffdfa34ae379273b21c5ee861102499a2cd9d |

## COMMITS

- 8e1d2765d7b51db811d4a367ea2f2cc13aa3e73b: reserva SDD/handoff/índice, publicada.
- Implementación: commit que contiene esta versión del documento. SHA y respaldo
  remoto se entregan al Director en el recibo posterior; no se crea recursión
  de commits para insertar su propio hash.

## PR / BRANCH

Rama propia indicada arriba. Checkpoint/push para revisión inmutable del Director
y peer antes de PR DRAFT base main. No se integró ni desplegó.
La aceptación general se registra por separado sobre el SHA de composición C3.

## PENDIENTES DE ESTA TAREA

- Commit/push y recibo final para revisión del Director.
- Revisión inmutable Director/peer y PR DRAFT con pendiente canónico explícito.
- Ciclo de conocimiento solo cuando el Director asigne turno.
- Composición C3 receptora, canónica general con GO nuevo y evidencia por SHA;
  no se declara cerrada antes de ejecutarse.

## FUERA DE ALCANCE DETECTADO

Historial C3 de env-example-contract y fallos bajo suite general; producto/revisión
0574; ajuste de claves pnpm o wrappers; cualquier fallo ajeno de producto/config/
runner. Ninguno se absorbe en 0577. Gobernanza de comportamiento de producto/UI
nueva: no aplica, solo pruebas/documentación sin cambio de experiencia o datos reales.

## HANDOFF AL DIRECTOR

Revisar el checkpoint inmutable y su delta de cinco rutas. No atribuir la validación
local del candidato a una composición todavía no ejecutada. No se transporta producto
de C2; specs/índice receptor se preservan y regeneran al componer.

El claim continúa adquirido hasta instrucción explícita. Los procesos focales y
ESLint terminaron; no se abrió servidor ni se reclamó puerto. Consulta Win32_Process de Node por ruta propia: cero procesos atribuibles tras los checks. El recibo final revalida esta observación, preservando cualquier atribución incierta.

Impacto documental: spec 0577 y este handoff dentro de la rama, índice generado.
Integración, estructura Graphify, cobertura semántica, Archify y preview Obsidian
siguen pendientes por turno; sin publicación compartida. No se escribió memoria.
El índice de la base histórica muestra 0569-0576 como huecos locales; no significa
que estén libres. Al componer se preservan las specs de la rama receptora.