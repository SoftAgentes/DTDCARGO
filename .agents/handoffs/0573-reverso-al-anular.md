# Handoff · SDD-0573 · M1 local 27 PASÓ, supervisión incompleta, PR CORE DRAFT

| Campo | Valor |
|---|---|
| Fecha | 2026-10-21 |
| Task ID / owner | 0573-core-reparacion-20261021 / worker-0573core-01a15a4e-ddf0-7d82-8656-d9dc56b58468 |
| Sesión | Worker interno delegado de 01a15a4e-ddf0-7d82-8656-d9dc56b58468; principal permanece Director |
| Worktree | C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/sdd-0573-core-reparacion-20261021 |
| Rama | codex/sdd-0573-core-reparacion-20261021 |
| H / B fija | 89f15a5dcb9c9047e9a289fd499563c201ab5701 / e834dc6eef597421d10f880b5deb8d689dcc7078 |
| SDD | [0573](../../docs/specs/0573-reverso-al-anular/spec.md), in-progress |
| Estado vigente | M1 funcional local aceptada sobre 7394: 27 PASÓ/0 FALLÓ/0 OMITIDAS; supervisión INCOMPLETA/UNKNOWN 21908/turnReleased=false; 14 hallazgos/A/B abiertos |
| Contrato GO0 | 0573-core-go0-asignacion-director.md / SHA256 7a16dbdb1ebecfc420ca2f3c181ca6aa1cb5d6c5584f0c33fb2a7237af773428 |
| Candidato completo | 0573-encargo-core-propuesto.md / SHA256 5ee11eab1d2f08af8890f676efdc20aa2daba918dd8d1c50c34950b366b22880 y diez fuentes completas cotejadas |
| Permisos vigentes | Sólo spec/handoff y un commit LOCAL padre 7394; sin producto/tests/índice/runtime/push/bodyedit hasta revisión documental |
| Turno y relevo | Corrida T01 única terminada; resultado funcional aceptado, supervisión incompleta y turno retenido; sin otra pesada/claim release |

## OBJETIVO ORIGINAL

Adoptar metodología vigente, crear aislamiento nuevo desde H y componer exclusivamente B por merge normal para R0 revisable, preservando cinco commits H y M/P304/P306/P307. No reparación ni instalación/pruebas en GO0. Objetivo posterior: B1/I1–I4/M1–M9 y aceptaciones A/B independientes; I2/M2/I3/R1–R4 ratificados, sin repetir preguntas a Sam.

## COMPLETADO

- Lectura completa de AGENTS canónico vigente, skill Worker, runbook, project-rules, GO0, candidato5ee11, diez fuentes y prevuelo; AGENT-BRIEF, registro aplicable, SGE-00/AUD-01/AUD-02 y backend Norte.
- Creación real desde H mediante harness, guard/claim/guard(owner) PASÓ; árbol nuevo inicialmente limpio, sin env/deps/secretos copiados.
- 16 fuentes externas verificadas;76 blobs originales de48rutas conservados antes de autoría en C:/tmp/director-traspaso-20261020/0573-core-go0-worker-20261021/0573-core-preimages-go0.json, SHA256 f83e940408331b6763b8268515dbf434afe43ba02acae1db4f37e8d490f4652b.
- Adopción del contrato y48rutas guardada antes del merge sin staging; R0 fijado con padres H/B y documentación en commit posterior. No hubo commit documental previo.
- R0 bd2eeb29af909bc0d62b902ab4973386ee0e2d98; árbol c34aeddce41eb51a9608c0feb16b67ffa2c7cdd5;6344 entradas;29 rutas contra B dentro de48; sin conflicto/edición manual de producto.
- Metadata unión exacta5esperas/3declaraciones y procedencia actions prefijo/sufijo B + void H por bytes. docs559/numbering/diff-check PASÓ.
- Histórico H/árbol/rama/status/claim contabilidad-2026-10-18 preservado; claim SHA256 23f8b82db6f695f668f4a4a54dac363b7992efd1065a45ca9ab3ca046deedb3c. No takeover/reset/copias. Status limpio no prueba ausencia de consumidores. Consulta app parcial50chats+1fijado no prueba ausencia histórica.

## Contratos ratificados y gobernanza

I2 mantiene oficial/ajuste documental/base de comparación; septiembre/octubre/combinado, documento100/venta90/diferencia10, metadata fuera de issued_at, VES/CNY no_comparable/diferencia null, conversión/lectura incompleta y actividad/corrupción neto0 visibles. UI/CSV/Dirección heredan el puente sin alterar otros KPIs/oficial anual.

I3 atomiza código/cabecera/todas las líneas bajo lock compartido; sólo datos persistidos; emitida/parcial/vencida/pagada vivas; numeric exacto no negativo/cero coherente no-op/negativo-cero incoherente-centavo rechazan; resultado escalar versionado validado/desconocido honesto. Tres intentos totales sólo constraint de código comprobada. Interfaz/callers preservados; sin fallback inseguro/reemisión/cobro-crédito repetidos. Emisión/crédito previos separados.

M2 bloquea cualquier borrador de venta vivo incluso con asentado. B1 protege par/líneas sin bypass; I1 tenant/cuentas/estado/relaciones; M1 count/error antes de crédito; M3 fecha original; M4 motivo humano sólo D2; M5 canVoid/FK corregidos documentalmente; M6 sólo JSDoc futuro; M7 no ocultar par inválido; M8/M9 MIGRATE-FIRST real/huellas/owner/ACL/CHECK efectivo/cierre0493/audit/rollback. Matriz14 y aceptación completas en spec, no ejecutadas.

Riesgo funcional R3. Cumplimiento sólo documental/aislamiento; B1/I1/I3/M1/M4 y falsos estados siguen no conformidades. Excepción nueva ninguna; no aplica motivado para capacidades ajenas. Visual/runtime/pruebas no se declaran conformes. BRAND/diseño/Norte y demás políticas UI pendientes antes de UI.

## Allowlist acumulada CORE exacta

GO0 escritoras propias sólo: docs/specs/0573-reverso-al-anular/spec.md; .agents/handoffs/0573-reverso-al-anular.md; docs/specs/README.md por generador; supabase/migrations-baseline.json; supabase/pending-migration-symbol-declarations.json.

```text
supabase/migrations/0497_reverso_al_anular_factura.sql
supabase/tests/0497_reverso_al_anular_factura.test.sql
lib/studio/__tests__/reverso-al-anular-factura.migration.test.ts
supabase/tests/0467_reversion_credito_carrera.test.sql
supabase/migrations-baseline.json
supabase/pending-migration-symbol-declarations.json
app/studio/(app)/facturacion/actions.ts
app/studio/(app)/facturacion/__tests__/void-invoice-referral-warning.test.ts
app/studio/(app)/facturacion/[code]/page.tsx
app/studio/(app)/facturacion/_components/InvoiceDetailClient.tsx
app/studio/(app)/facturacion/_components/InvoiceDetailClient.anular.test.tsx
lib/studio/journal-types.ts
app/studio/(app)/contabilidad/_components/LibroDiarioTab.tsx
lib/studio/accounting/libro-control.ts
lib/studio/accounting/libro-control-queries.ts
lib/studio/accounting/__tests__/libro-control-queries.test.ts
lib/studio/accounting/__tests__/libro-control-reverso.test.ts
lib/studio/borrado/asistente.ts
lib/studio/borrado/__tests__/asistente.test.ts
lib/studio/borrado/__tests__/asistente-servidor.test.ts
app/studio/(app)/embarques/__tests__/asistente-borrado-action.test.ts
app/studio/(app)/embarques/_components/__tests__/AsistenteBorrado.test.tsx
scripts/qa/radiografia-integridad.sql
scripts/qa/radiografia-integridad.fixture.sql
scripts/__tests__/radiografia-integridad.test.ts
scripts/__tests__/subdiario-radiografia-paridad.test.ts
docs/specs/0573-reverso-al-anular/spec.md
docs/specs/README.md
.agents/handoffs/0573-reverso-al-anular.md
app/studio/(app)/contabilidad/actions.ts
lib/studio/journal-queries.ts
app/studio/(app)/contabilidad/__tests__/reverso-factura-acciones.test.ts
app/studio/(app)/contabilidad/__tests__/libro-diario-reverso.test.tsx
lib/studio/__tests__/journal-queries-reverso.test.ts
lib/studio/accounting/invoice-posting.ts
lib/studio/accounting/__tests__/invoice-posting-reverso.test.ts
supabase/tests/0497_reverso_al_anular_factura_carrera.test.sql
lib/studio/accounting/ingreso-periodo.ts
lib/studio/accounting/__tests__/ingreso-periodo.test.ts
lib/studio/accounting/__tests__/ingreso-fixture.ts
app/studio/(app)/contabilidad/_components/IngresoDelPeriodoCard.tsx
app/studio/(app)/contabilidad/__tests__/reportes-tab.test.tsx
lib/studio/reports/export-csv.ts
lib/studio/reports/__tests__/export-csv.test.ts
lib/studio/direccion/queries.ts
lib/studio/direccion/__tests__/queries.test.ts
lib/studio/reports/types.ts
lib/studio/reports/__tests__/types.test.ts
```

48únicas; SHA256 literal LF con salto final 0a95bea2a8de4323b3ccbccb34499482d7dd5597736d055c735c4e275871b07c. R1 fechasCaracas sólo C1, no crearla aquí. Cinco tests CORE nuevos siguen ausentes.

## VALIDACIÓN

| Comprobación | Alcance | Estado |
|---|---|---|
| Fuentes/hash/preimágenes | H/B/M/P304/P306/P307 y48rutas/16fuentes | PASÓ; recibo citado |
| Creación/guard/claim | raíz/rama propia desde H | PASÓ |
| Histórico protegido | metadata/status/claimH | PASÓ; consumidores no declarados ausentes |
| B remoto | ls-remote rama de B | PASÓ: e834dc6eef597421d10f880b5deb8d689dcc7078 |
| 0497 pendiente | encargo vigente/baseline H | PASÓ sólo metadata, sin ledger vivo |
| R0/árbol/padres/ascendencias/delta | bd2eeb29af909bc0d62b902ab4973386ee0e2d98 | PASÓ; H/B exactos,9positivas/6negativas,29rutas dentro48 |
| Índice/docs/numbering/diff-check |559specs y6344entradas de R0 | PASÓ; logs externos docs-check-go0.log/numbering-go0.log |
| ROJO/VERDE/carreras/SQL/PGlite/mutantes | aceptación funcional futura | NO EJECUTADO; fuera GO0 |
| Tipos/lint/build/verify/browser/HTTP | producto | NO EJECUTADO; fuera GO0 |
| Instalación/env/deps copiados/DB real | no autorización | NO EJECUTADO |
| Graphify/semántica/Archify/preview/export/Obsidian | impacto documental | NO EJECUTADO; turno futuro |

## COMMITS

- bd2eeb29af909bc0d62b902ab4973386ee0e2d98 — chore(studio): SDD-0573 — compone R0 de H y base temporal B. Padres H/B literales; árbol c34aeddce41eb51a9608c0feb16b67ffa2c7cdd5.
- Commit que contiene este documento — adopción/contrato completo/evidencia de GO0, sólo spec y handoff. Su SHA final se conserva en el recibo de cierre externo, sin recursión.
- Cinco commits H conservados y sólo R0 nuevo fuera de H/B antes de documentación. No reparación propia de producto.

## PR / BRANCH

Rama propia codex/sdd-0573-core-reparacion-20261021. Sin PR en GO0. Futura única PR CORE DRAFT contra codex/0573-base-temprana-20261021 tras revisión R0 y alcance. No retarget/reabrir otras PRs.

## PENDIENTES DE ESTA TAREA

1. Director revisa R0 exacto, delta heredado/composición,49unión/48CORE y alcance; sólo después fija GO/turno de ROJO/reparación.
2. ROJO funcional, implementación y VERDE de14hallazgos; PG dos conexiones/cierre0493 real/ACL/audit/MIGRATE-FIRST/rollback, mutantes y matriz monetaria; tipos/lint/verify normal/UI real/revisión independiente, todos NO EJECUTADOS en GO0.
3. Revalidar0497 pendiente antes de editarla en futuro; evidencia de aplicación exige detener edición sin renumerar.
4. Futura única PR CORE DRAFT contra B después de revisión R0. Propagación CORE→310→311→C1(R1)→C2→C3→BCV y aceptaciónB por otro SHA.
5. Conocimiento por capas/preview/revisión visible en turno futuro; compartido sólo main integrado autorizado.
## FUERA DE ALCANCE DETECTADO

- BCV b179 FALLÓ/INCOMPLETO funcional según Director; cierre de custodia no es aceptación ni padre.
- Diagnóstico0577 y principal con instalación implícita EPERM son otras tareas: no alias pnpm ni reparación/copia de deps.
- 0495 aplicada una vez según encargo; baseline heredado pendiente no prueba ni autoriza repetir/retirar.0496/0497 pendientes según autoridad; no DB real.
- 2.2/2.3/2.6/finanzas4.3, historia, otros posters/emisores, CN/Portal, SQL0498/0499/0500 y deuda0575.

## HANDOFF AL DIRECTOR

GO0 completó adopción y composición real, sin reparación funcional. R0 es bd2eeb29af909bc0d62b902ab4973386ee0e2d98 y su árbol c34aeddce41eb51a9608c0feb16b67ffa2c7cdd5; H/B son sus padres exactos. Aprobar R0 para autorizar el siguiente turno/GO; no se crean PR ni pruebas por adelantado. Árbol propio quieto y claim retenido según encargo. Histórico/consumidores preservados.

Recibo R0: C:/tmp/director-traspaso-20261020/0573-core-go0-worker-20261021/0573-core-R0-go0.json; SHA256 c594fef0439035f122e778a40e4d9bf47bfdb1763652d7e2308fc356ab2b28da. Respaldo/readback/HEAD final y estado quieto se acreditan en 0573-core-cierre-go0.json, posterior al push propio; no inferir respaldo de un commit local.

Delta completo contra B: R0-completo-vs-B.patch,208900bytes,SHA256 f228ad2bbfd9db86c5a77cc928d8afe01d6f5a25c5e631aad9a1b2294f392c54. Delta automático de producto completo: R0-producto-vs-B.patch,24rutas/155874bytes,SHA256 6a51e26cd9b2d8483731da0ddb30986a8ace531cba4ef7fc1fee4dabdfc35089. No reparación manual; herencia H y B se conserva.

Únicos blobs nuevos de composición: actions deb9fe678829412985ffa24b775c8dab74e07caa, índice953189508aa4509175b504d9291aceaa9549cd77, baselinebd2f932f621c223a1106cb8755878d8abc618e23 y declaracionesbaa687b18c7b6fbfb840528af9b9f2d2cc197fb5. prefijo/sufijo actions = B, voidInvoice = H. Fuera de void FX/CAS/override/VES/aviso persistido quedan idénticos B. Cotejo no acepta lógica ni repara M1/I3.

Baseline cutoff238 y unión0422/0423/0495/0496/0497 intacta; degradaciones0569/0571/0573 intactas. No se retiró metadata histórica de0495 ni se repite aplicación;0496/0497 pendientes sólo según encargo/metadata. No lectura de DB real.

Separación: R0 contiene herencia y composición de cuatro blobs; el commit documental posterior sólo spec/handoff. El recibo de cierre comprobará equivalencia completa de producto/SQL/tests entre R0 y HEAD final. Aceptación A CORE y B propagación siguen NO EJECUTADAS.

Impacto documental: spec/handoff propios e índice generado, sin nueva regla general. Guardado/integración/Graphify estructural/semántica/Archify/archivos de bóveda/revisión visible son capas distintas. Todo conocimiento NO EJECUTADO por GO0; medirlo en turno futuro. Histórico/mocks/PGlite/sintético no se convierten en producción.

## GO1 · adopción de regresiones autorales, 2026-10-21

GO0 fue aceptado por Director sólo como composición/adopción/respaldo. R0 bd2eeb29af909bc0d62b902ab4973386ee0e2d98 y checkpoint db5f84aab482252ada9030ba20f9e527338b66e2 quedan preservados. B fija e834dc6eef597421d10f880b5deb8d689dcc7078. Misma raíz, rama, owner y claim; sin nuevo Writer.

Encargo GO1: C:/tmp/director-traspaso-20261020/0573-core-go1-regresiones-autorales-director.md; 6024 bytes, SHA256 0192fa90cba290e6c1579138d105cd08dc0e2d2625267e1087fc87332fc3ab6a. Recibos Director GO0: 0573-core-R0-cotejo-director.json SHA256 19569b1b78d1224868f8fef8a52f3cfa9a64ab52a6ab6636ba2056927a655e6c y 0573-core-go0-adopcion-respaldo-director.json SHA256 869a70d0f80854e24bcab5eacf855ee17386f2b3c47a398a071ac3ad1ade6d81.

Autoría permitida sólo en este subset de la allowlist acumulada de48; no cambia la frontera CORE/R1:

```text
app/studio/(app)/facturacion/__tests__/void-invoice-referral-warning.test.ts
lib/studio/accounting/__tests__/ingreso-periodo.test.ts
lib/studio/accounting/__tests__/ingreso-fixture.ts
lib/studio/accounting/__tests__/libro-control-reverso.test.ts
lib/studio/accounting/__tests__/invoice-posting-reverso.test.ts
docs/specs/0573-reverso-al-anular/spec.md
.agents/handoffs/0573-reverso-al-anular.md
```

Se conservaron preimágenes db5 y sellos de producto/package/lock/config antes de editar: C:/tmp/director-traspaso-20261020/0573-core-go1-worker-20261021/0573-core-go1-adopcion-preimagenes.json.

GO1 permite escribir regresiones M1/I2/I3 y receta futura, hacer checkpoint selectivo/push y crear una única PR CORE DRAFT contra codex/0573-base-temprana-20261021, con attach/readback. Todas las pruebas quedan NO EJECUTADAS. No instala ni ejecuta ROJO, parser, tipos, lint, SQL/DB/Docker/browser/HTTP/build/verify/conocimiento; no repara producto ni cambia0497. Árbol quieto/claim retenido al entregar fuente; runtime requiere otro GO/turno.

Preservar pruebas/asserts heredados. Los dobles deben admitir las llamadas reales actuales y el contrato candidato sin importar DTO futuros: una falta de import, TypeError, preparación o infraestructura no acredita ROJO. I3 sólo mide adapter TS; no atribuye atomicidad/commit/locks a un mock. I2 helper no certifica sus lectores ni UI/CSV/Dirección.

Los14hallazgos, SQL/PG/carreras/cierre0493/ACL/audit, consumidores y aceptaciones A/B siguen pendientes. M5/M6 no reciben pruebas de comentarios.0495 aplicada una vez no se repite;0496/0497 pendientes según metadata, sin ledger real.

### GO1 · fuentes redactadas y receta propuesta

Se redactó únicamente el subset de siete rutas. Producto, SQL0497, tipos/DTO, package/lock/workspace/.npmrc y configuración permanecen sellados: 14 comprobaciones de bytes sin diferencias. No hubo instalación ni ejecución de tests, parser, tipos, lint, SQL/DB/Docker, browser/HTTP, build/verify o conocimiento.

| Bloque autoral | Casos nuevos previstos | Estado |
|---|---:|---|
| M1: count/error/tenant y efectos separados | 7 | NO EJECUTADO |
| I2: lector real, puente documental y estados | 15 | NO EJECUTADO |
| I2: vínculo coherente en cruce puro | 7 | NO EJECUTADO |
| I3: adapter público/RPC/resultado/desconocido | 28 | NO EJECUTADO |

57 casos nuevos previstos; 64 casos literales heredados conservados (20 M1, 38 ingreso, 6 cruce). Total previsto de los cuatro archivos completos: 121. Son conteos de fuente/tablas de casos, no discovery de Vitest ni resultados; cero casos ejecutados, cero ROJO observado, cero VERDE observado. No hay cuota para cerrar el contrato.

Se preservan los escenarios heredados. M1 amplía el doble válido para count nulo/error y recibos de otro tenant; su aserción de filtros mantiene invoice_id/deleted_at y agrega tenant, con cardinalidad exacta de tres y orden indiferente. El aviso de crédito liberado antes de void fallido conserva dos pasos separados.

I2 llama a ingresoDelPeriodo/describirIngreso reales y al paginador real con datos sintéticos; el doble aplica sesión/tenant, filtros, proyección plana y páginas. ajusteAnulacionesUsd/baseComparacionUsd son nombres de salida propuestos en expectativas, sin importar DTO futuro. Una proyección relacional aún no modelada es preparación, no ROJO. No se trajo implementación 310. Lectores completos y consumidores UI/CSV/Dirección no quedan aceptados por este bloque.

I3 importa sólo InvoicePostingInput/Result y postInvoiceJournalEntry existentes. El doble admite también el camino legado completo (contador, cuentas, next_entry_code/string, header y líneas), para observar fallos por salidas/llamadas/efectos; no fabricar TypeError. La RPC de dos UUID, resultado version1 y motivos finitos son contrato candidato, no catálogo instalado. Ningún mock TS demuestra commit/atomicidad/locks/tres intentos internos SQL.

La receta externa conserva comandos completos por archivo, captura de SHA/exit/logs, clasificación de errores y propuesta de plazo/cleanup. Node nativo 24.20.0; PNPM disponible fuera del principal 11.25.0 frente CI 11.19.0; dependencias propias ausentes. Director debe revisar la versión/receta de instalación congelada con scripts deshabilitados y store propio, o provisionar el gestor que fije; no ejecutar el alias PNPM del principal ni copiar deps/env/secretos.

El futuro turno runtime requiere GO y SHA concretos. Import, TypeError, binario/setup, proyección no modelada y TIMEOUT son preparación/infraestructura, nunca ROJO funcional. Se conservan los timeouts del repo; la propuesta administrativa es 180 s por archivo y comunicación cada 30 s, sin retry automático. Logs y store se conservan; sólo el proceso propio puede detenerse por identidad en un futuro watchdog, sin borrar árboles o datos.

La siguiente entrega es checkpoint selectivo/push y una única PR CORE DRAFT contra B, con attach/readback. La PR describirá herencia+composición+fuentes NO EJECUTADAS y los 14 hallazgos abiertos. Árbol quieto/claim retenido después; no runtime ni reparación por adelantado. Aceptaciones A/B, cierre0493/ACL/audit/carreras, consumidores, normal verify, visual y conocimiento siguen pendientes.

Receta: C:/tmp/director-traspaso-20261020/0573-core-go1-worker-20261021/0573-core-go1-receta-y-oraculos.md; SHA256 8ce8c568b88b288c75911f456511dfe5c442a180e84b72ca233df53b9f951aaa.
Manifiesto de fuente/14 sellos/inventario/receta: 0573-core-go1-receta-y-fuentes.json; SHA256 8afa09ce4f56d12447f132203f02cff882739ca9d0c9ed48d7ac706016f88033.

## Cierre GO1 · autoría, respaldo y PR

### OBJETIVO ORIGINAL

Escribir regresiones M1/I2/I3 y receta futura dentro del subset7, conservar preimágenes db5/pruebas heredadas y entregar una única PR CORE DRAFT tras la revisión R0. GO1 no autoriza runtime ni reparación.

### COMPLETADO

Adopción y preimágenes guardadas antes de autoría. Checkpoint fuente 8a588ccab2e0dc943a5c4b8a6610c3c612c6402e, exactamente7 rutas;57 casos nuevos previstos,64 heredados conservados por inventario textual. Receta/inventario y14 sellos guardados fuera de Git. Única PR [#320 DRAFT](https://github.com/SoftAgentes/DTDCARGO/pull/320), adjuntada oficialmente y readback inicial cotejado.

### VALIDACIÓN

PASÓ: guard/owner/claim, subset7 frente db5, diff-check,14 sellos sin diferencias y respaldo de checkpoint fuente; readback inicial draft/head8a588/basee834/cuerpo/rutas. Diff PR32 dentro48 (R0:29 más3 nuevas rutas al diff). Este cierre documental conserva los bytes de las fuentes autorales/producto/SQL. Recibo final externo registra SHA remoto/readback final y custodia.

NO EJECUTADO: los121 casos previstos, ROJO/VERDE, parser/tipos/lint, SQL/PG/carreras, Docker/browser/HTTP/build/verify, instalación y todas las capas de conocimiento. Checks PR iniciales: lista vacía; no se atribuye aceptación funcional. Conteos previstos no son discovery ni cuota.

### COMMITS

- bd2eeb29af909bc0d62b902ab4973386ee0e2d98: R0, padres H/B exactos, revisado por Director.
- db5f84aab482252ada9030ba20f9e527338b66e2: adopción/contrato GO0, conservado.
- 8a588ccab2e0dc943a5c4b8a6610c3c612c6402e: autoría GO1, árbol04e109975831dbab7e1ada7ad0777f5b6cf8ecdb, hijo db5, siete rutas.
- Commit que contiene este cierre: sólo spec/handoff; SHA/árbol finales en recibo externo, sin recursión. No reparación nueva de producto.

### PR / BRANCH

[PR #320](https://github.com/SoftAgentes/DTDCARGO/pull/320), OPEN/DRAFT. Head codex/sdd-0573-core-reparacion-20261021; base codex/0573-base-temprana-20261021 fija e834dc6eef597421d10f880b5deb8d689dcc7078. Attach oficial realizado. Una sola PR CORE; no retarget/merge ni integración en B/main.

### PENDIENTES DE ESTA TAREA

1. Director revisa fuente/receta y versión PNPM11.25 disponible frente11.19 CI; fija SHA/GO y un único turno runtime separado. Dependencias propias siguen ausentes. No usar alias PNPM principal ni copiar deps/env/secretos.
2. Obtener ROJO funcional con dobles/imports válidos; fallos de setup/import/TypeError/proyección no modelada/timeout no cuentan como ROJO. Implementación y VERDE siguen pendientes; fuentes no reparan producto.
3. Cerrar B1/I1–I4/M1–M9 con matriz monetaria, SQL/PG dos conexiones/locks, cierre0493 real, ACL/audit/rollback/MIGRATE-FIRST, mutantes, lectores y consumidores UI/CSV/Dirección, verify normal, visual y revisión independiente.
4. Revalidar0497 pendiente antes de cualquier edición futura;0495 aplicada no se repite. AceptaciónA CORE yB propagación independientes; CORE→310→311→C1(R1)→C2→C3→BCV por sus propios SHA/evidencias.
5. Conocimiento/canónica/Graphify/semántica/Archify/preview/Obsidian NO EJECUTADO, pendientes de su turno; publicación compartida sólo main integrado autorizado.

### FUERA DE ALCANCE DETECTADO

Diagnóstico0577, preparación0578 e instalación implícita EPERM en principal pertenecen a otros encargos. No se reparó entorno ni se copiaron dependencias. HistóricoH/claim contabilidad-2026-10-18, BCV/Caracas y otros productos preservados. Estado limpio no certifica ausencia de consumidores históricos.

### HANDOFF AL DIRECTOR

GO1 entregado como fuente y custodia. Los14 hallazgos y aceptaciones A/B permanecen abiertos. Revisar checkpoint fuente8a588 y PR320; otro GO/turno es necesario para instalación/ROJO/producto. Árbol propio quieto, claim retenido explícitamente por encargo; ningún proceso producto iniciado ni cleanup destructivo.

Evidencia externa: C:/tmp/director-traspaso-20261020/0573-core-go1-worker-20261021/. Receta-y-oráculos SHA2568ce8c568b88b288c75911f456511dfe5c442a180e84b72ca233df53b9f951aaa; manifiesto fuente/receta SHA2568afa09ce4f56d12447f132203f02cff882739ca9d0c9ed48d7ac706016f88033. Recibo final0573-core-go1-cierre.json incluirá PR/readback, hashes de parches completos y custodia local/remota.

## Cierre GO2 · L1 por fuente y preparación UNBOUND

### OBJETIVO ORIGINAL

Fortalecer sólo el oráculo L1 de ocho rechazos conocidos I3 y preparar fuentes externas de entorno propio. Encargo747424b7f73ac51628abdbea702c775094c68ec6c8aa3db3eea30e27a9851c69 y peer finalc10290f3a52f57591cf4cd7394d775b3cc7722c6ed3faef7e462a2ba1a77ba3c leídos completos. Entrada1c4b859d26d80033c6f8d3b971ee0f1f8e691e9c, misma raíz/rama/owner/claim. No GO de Node/parser/instalación/discovery/tests/ROJO/producto/SQL/DB/build/knowledge.

### COMPLETADO

Adopción y tres preimágenes antes de autoría. Sólo I3/spec/handoff: tabla SQL→skipped exacto y exclusión explícita de posting-state-unknown; conserva las22 líneas expect anteriores, títulos y28 casos I3. Un adapter que convierta todo rechazo conocido aunknown incumpliría la tabla: contraejemplo razonado, no mutante ejecutado. No cambia57 nuevos+64heredados=121 previstos.

Preparación externa nueva en C:/tmp/director-traspaso-20261020/0573-core-go2-preparacion/: receta-UNBOUND.md, launcher-runtime-UNBOUND.ps1, manifest-UNBOUND.json, cli-fuentes-locales.json, adopcion-preimagenes-go2.json y manifiesto-preparacion-go2.json. Sólo documentos/fuente; perfil, deps/store/cache y salidas runtime no creados. Launcher no cargado, parseado para validación ni ejecutado.

### VALIDACIÓN

PASÓ por Git/lectura/bytes: raíz/linkedworktree/rama/claim y SHAentrada; tres preimágenes;14 sellos producto/config y cuatro fuentes autorales restantes intactas; diff-check; conservación textual de aserciones y tamaño de tablas. No se ejecutó el guard Node por la prohibición expresa GO2: se cotejaron sus condiciones de aislamiento/registro/claim mediante Git nativo y metadata.

NO EJECUTADO:121 casos, discovery/ROJO/VERDE, Node/PNPM, parser/tipos/lint, instalación/SQL/PG/DB/Docker/browser/HTTP/UI/build/verify y todas las capas de conocimiento. Revisar bytes de fuente/receta no equivale a comprobar el funcionamiento del launcher o comandos.

Metadata/hash actual confirma Nodebundled24.19 y PNPMpackage11.25; CI11.19 distinto. El argv0578 rechazado no se copió como validado. Dist SHA256ddc64218bc85fb88d28b5def06eb01fafb39cb67f7a9465ce736456658cc7f11; referencias parser326097–326263, GLOBAL_OPTIONS327698–327719, rcInstall225656–225725, env168070–168210/171441–171485, configdir/auth168045–168058/171150–171185. Propuesta: argv sólo tipado/rutasconigual más PNPM_CONFIG_* y XDG propios; conserva frozen/scriptsdeshabilitados/failerror/TLS/storecacheconfigstate/virtualstore propios, child1/network2/copy. No se ejecutó help/install o --version.

### COMMITS

GO0 R0bd2eeb29af909bc0d62b902ab4973386ee0e2d98, adopcióndb5f84aab482252ada9030ba20f9e527338b66e2 y fuenteGO18a588ccab2e0dc943a5c4b8a6610c3c612c6402e preservados. Entrada1c4b859d26d80033c6f8d3b971ee0f1f8e691e9c. Commit que contiene este cierre: sólo tres rutas GO2; SHA fuente/final/tree/parent y respaldo remoto en cierre-go2.json externo, sin recursión.

### PR / BRANCH

Misma [PR320](https://github.com/SoftAgentes/DTDCARGO/pull/320), DRAFT, contra codex/0573-base-temprana-20261021 / e834dc6eef597421d10f880b5deb8d689dcc7078. Head codex/sdd-0573-core-reparacion-20261021. Attach oficial existente conservado; readback final head/base/draft/body/32rutas dentro48 se guarda en recibo externo. Ninguna PR adicional, retarget, merge o integración.

### PENDIENTES DE ESTA TAREA

1. Director revisa L1, argv/env/versiones/presupuesto y launcherUNBOUND; fija fuenteSHA/tree, copiaBOUND por hash, GO por fase y turno pesado separado. La selección PNPM11.25 local no es CI11.19 ni validación de instalación.
2. Futura faseI00–I03 antes de T; otro GO concreto para cuatro archivos seriales completos. Propuesta única1800s desdeI00 con pausa/cierre incluidos, sin renovar;30s versiones/900s instalación/180s archivo. Observación≤5s/progreso30s/comunicación≤45s, heap3GiB y cortes memoria/streams. Captura doblebinaria desdeStart, descarteVoidTaskResult, DateKindString/UTCexacta, identidad.NET/CIM sólo filiación y cierre de recursos primero≤60s. Son fuentes no validadas; UNKNOWN retiene turno con null, nunca cero.
3. Obtener ROJO funcional válido y reparar los14 hallazgos con VERDE posterior. Import/doble/setup/TypeError/timeout/captura parcial no cuentan como ROJO;121 previstos no son discovery/resultado. SQL/PG dos conexiones/locks/cierre0493/ACL/audit/rollback, consumidores y aceptaciónA/B siguen pendientes.
4. Revalidar0497 pendiente antes de editarla en futuro;0495 aplicada no se repite. Propagación serial CORE→310→311→C1(R1)→C2→C3→BCV con otra evidencia. Conocimiento/canónica/Graphify/semántica/Archify/preview/Obsidian NO EJECUTADO.

### FUERA DE ALCANCE DETECTADO

0578 y su incidente argv/identidad pertenecen a otro namespace; no hubo intervención, ejecución o copia de deps/entorno. 0577, principalEPERM, históricoH/claimajeno, BCV/Caracas y otros posters preservados. Estado limpio no prueba ausencia de consumidores. No producto/tipos/DTO/package/lock/config/0497.

### HANDOFF AL DIRECTOR

GO2 entrega fuenteL1 y preparaciónUNBOUND, no entorno instalado ni ROJO. Catorce hallazgos y A/B abiertos. Árbol quieto, claim retenido y cero procesos producto iniciados. Director decide la próxima fase; no hay runtime automático por esta entrega ni por el estado de0578.

Índice externo manifiesto-preparacion-go2.json SHA256e7f9a872ba40392fd25147460849d0e85b75d51dfa36f3bae1f31eee059768ff; receta-UNBOUND.md SHA25612606b0d9e3925fd54e2429e660605499d7016b5d8b8238ac8d6af9a8c40ae66. Cierre final externo cierre-go2.json contendrá diff completo, hashes, custodia y readback remoto de la mismaPR320.

### GO2 · sellado final v2 de preparación, sin ejecución

Candidato fuente L1 publicado: f9acd0eb9b02cb1392899c8a3e5015dec48c94d0, árbol d027ed9057193c62dcfda559dd9f72124e69c4a7, padre1c4b859d26d80033c6f8d3b971ee0f1f8e691e9c. La lectura final del launcher propuesto detectó una inicialización explícita necesaria de CloseUntil antes del primer paso bajo StrictMode. Se conserva v1/recibos y se crea v2 con esa sola línea operacional; no se cargó, parseó para validación ni ejecutó. Este commit posterior sólo actualiza spec/handoff: pruebas y producto idénticos a f9acd.

La preparación vigente para revisión es launcher-runtime-UNBOUND-v2.ps1 SHA25642a829b41ea855b2ba7de189b0f9436d746dc1c049fbc7f73eaba805af8d08fc, manifest-UNBOUND-v2.json SHA256b9dc3117405ae3dc3e5c9fce1ac5a4fdd254e52f216215f475c76607b101e8f6 y receta-UNBOUND-v2.md SHA256b7073c0a931f9bab457c05fe2e78cdd245030de829c4dfb440121a09695dd749. Índice manifiesto-preparacion-go2-v2.json SHA256d5e6966625a30263316d20b9658a2eb3c16f5b6e6340546ac8f3c19457d309fc, todos bajo C:/tmp/director-traspaso-20261020/0573-core-go2-preparacion/. El manifest sigue UNBOUND/executableNowfalse/runtimeApprovedfalse; perfil/deps/salidas no creados,121 previstos/0 ejecución y14 hallazgos/A/B abiertos.

Recibo final cierre-go2-final-v2.json registrará SHA fuente f9acd y SHA final documental, árbol/padre, delta GO2 completo/subset3,14+4 sellos y readback de la mismaPR320 DRAFT/baseB. Claim retenido/árbol quieto; otra decisión y turno son necesarios para cualquier runtime. Las verificaciones descritas son de fuente/Git/metadatos, no pruebas operacionales del launcher.
## Checkpoint M1 · producto local, VERDE pendiente

Adopción expresa del encargo 9385a175fc62381e8d7dcbea089e638075e8563e4781f74757b0876e84ca6aaf y peer faa1c1b2a4847c899a0c1c5802e40a7b6f4cafd9cf71c187c6c195dde87f918c, leídos completos. Guard propio por Git nativo/metadata antes de editar: raíz/rama/entrada 0e5a28567b5d5df43e92f3fd52eb0662ca55842a/treef7fa, owner y claim212/b4ea exactos, árbol limpio. No se ejecuta guard Node por la prohibición de runtime; se cotejan sus condiciones de aislamiento/registro/claim. Preimágenes de las tres rutas y 19 sellos previos en C:/tmp/director-traspaso-20261020/0573-M1-checkpoint-local-01/guard-y-preimagenes-M1.json.

ROJO M1 preservado: T01 completo, 27 reales/22 PASÓ/5 FALLÓ por aserción, exit1/reasonnull/quiettrue en 0573-core-runtime-T-04. Falla el tercer filtro tenant y el manejo de error/countnull; un recibo ajeno contamina el doble. Los logs cb10d746/5cdcfdd3 y los 27 oráculos daa0f5d7 no se editan ni repiten. T02 42/11 pertenece a I2 y el STOP por UNKNOWN46012/7728 dejó T03/T04 sin ejecutar; devolución administrativa limitada b27904a2 conserva false/incertidumbre y no prueba cero global.

Cambio M1: agregar tenant_id de current al count exact/head con invoice_id y deleted_at NULL; capturar error y rechazar error/count null antes de cualquier efecto, sin mensaje DB ni crédito liberado. Cero conocido y positivo conocido conservan sus caminos; permisos/motivo/estado/RPC lock y avisos separados del crédito quedan iguales. Riesgo/permanencia R3/P3, SGE-00 y ERR-01, sin excepción nueva ni cliente admin. No atomicidad SQL/RLS/carrera acreditada por mocks.

Entrega: sólo actions/spec/handoff; un commit local debe ser hijo directo de 0e5a. SHA/tree/padre/diff y hashes finales se registran externamente después de existir, sin escribir el SHA del propio commit dentro de él. Tests intactos; otros 18 inputs previos conservados. No push/PR en este checkpoint.

Validación de comportamiento: VERDE NO EJECUTADO; ningún runner/probe/parser/instalación/lint/tipos/build/verify/SQL/DB/UI/conocimiento o censo. Director revisa el commit exacto antes de GO focal con margen del reloj original, que no se renueva ni transfiere. M1 implementada POR FUENTE no cierra los 14 hallazgos ni A/B; I2/I3/I4/B1/M2–M9 siguen fuera de este parche.

Impacto documental: spec y handoff propios actualizados; publicación/estructura Graphify/cobertura semántica/Archify/revisión visible Obsidian y full verify pendientes del cierre CORE autorizado. Sin tocar derivados compartidos, histórico H, perfiles, store, parcial de dependencias o recibos. Árbol quieto y claim retenido al entregar.

## M1 · T01 local aceptada, supervisión incompleta · 2026-10-22 UTC

Producto probado: **7394f63f5a0ab4d39f950b73141c698ae17aff7d**, árbol **81b55b3d2b866e88d9f63795cea9ef64d57ec436**. El Director contable y el Director general aceptaron el resultado funcional local del archivo T01 completo: **27 ejecutados, 27 PASÓ, 0 FALLÓ y 0 OMITIDAS; exit nativo 0**. Se verificaron los mismos 27 oráculos inmutables, incluidos los rechazos por error/count desconocido, tenant, cero/positivo y avisos heredados; no se repitió el ROJO. Es evidencia unitaria con dobles, no prueba de DB/RLS/SQL, atomicidad o carreras. Los estados anteriores «VERDE pendiente/NO EJECUTADO» describen sus etapas históricas; este bloque registra la única verificación posterior aceptada.

Autoridad y cotejo: GO 0573-core-M1-T01-27-go-director.md, 6465 bytes, SHA256 8f44370f99ee40276294fb1cee266c1f294dee4723c4d84b0f3d5691480fd9d5; turno DIRECTOR-M1-27-20261021-01. Cotejo del Director 0573-M1-T01-27-resultado-cotejo-director.json, 14003 bytes, SHA256 4c7c1c0dd1160f9505c911af83b8645a3d62cdaa9bbadae67f385bdd86676ae8: 20 archivos, 27 nombres únicos, 3 muestras y 2 cierres oportunos. El resultado funcional PASÓ se acepta separado de la supervisión **INCOMPLETA**, sin cierre de los catorce hallazgos, A/B o PR.

Reloj propio de esa etapa, durable en verification-budget-fixed.json: origen local **2026-10-22T00:21:16.3598975Z**, deadline **00:36:16.3598975Z**, cutoff **00:35:16.3598975Z**; máximo 900 s con reserva 60 s incluida, T01 ≤180 s. Ventana concedida 00:12:02–00:42:02Z. No se recibió origen externo, restauró el reloj I, renovó presupuesto ni autorizó otra corrida con el margen restante. SHA256 del budget: 6f1c3b8527a13551e32a7afacd4c6e58e374b55336ffc431c3f70cb2fe79ca04.

El Process original del launcher fue **5476**, nacimiento .NET **00:21:15.8354405Z**, ticks **639282252758354405**, **exit 1** observado a **00:21:29.1017043Z** mediante WaitForExitAsync y ExitCode de ese mismo objeto; esa observación no se presenta como hora de salida OS reconstruida. Ambos streams se copiaron desde Start antes de leer birth. El hijo T01 tuvo identidad 2144:639282252789423843, nacimiento 00:21:18.9423843Z y exit 0.

STOP conservado por nuevo **UNKNOWN candidato 21908**, parentPid 2144, primer registro original **00:21:21.5415957Z**, CIM_FILIATION_WITHOUT_CONFIRMED_NET_BIRTH, sin nacimiento .NET confirmado y sin intervención. No se reconstruyó identidad por PID. Recibo nativo: **INCOMPLETO_RETIENE_TURNO, quiet=false, turnReleased=false**; capturas completas. La identidad conocida 2144 figura ABSENT sólo según observaciones cacheadas; UNKNOWN permanece y liveOwnedCount es null. No es supervisor verde ni cero global.

Las tres muestras cerradas conservan separación máxima 4029.2646 ms y duración máxima UTC derivada 2881.6855 ms. Los cierres T01/FINAL finalizaron a 00:21:24.5208279Z y 00:21:28.0740135Z, dentro del cap original **00:22:21.6161448Z**. SourceAfter original 00:21:25.6356094Z y **SourceFinal original 00:21:28.8805998Z** registran HEAD 7394 / tree 81b55 / rama propia/clean=true y claim SHA256 b4ea7421a49ca0ec099a6e0552d2af03630cc648863479e4468e2d98244b8905. Es custodia de observaciones originales, sin censo físico posterior para obtener cero.

Evidencia cerrada bajo C:/tmp/director-traspaso-20261020/. N = 0573-core-M1-verificacion-27-01/; E = 0573-core-M1-verificacion-27-exec-01/. Los originales se conservan:

| Archivo | Bytes | SHA256 |
|---|---:|---|
| N/T01-stdout.log | 5962 | 1792f6ace164c6028669edc060f49143078f8b5865ccdd7509774d01572a9ae7 |
| N/T01-stderr.log | 0 | e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 |
| N/operational-receipt.json | 8735 | d1f142378cde81cbbd14fda060cfde4c35b913ca0429a33c16930b4e55e7c46c |
| E/external-receipt.json | 3151 | 9f96bc74c37e3a490e5832eb394af0f67764e45ee409fc0b8b08590aaafb2771 |
| E/casos-M1-T01-27-observados.json | 10634 | 94cfd943daa616799ea525416e8921994c6f9c84689818e177f40aca2471d848 |
| E/cierre-M1-T01-27-incompleto.json | 11256 | 4351b68a3a9e5d018ddf3b68cb124722bd5a1244c60a1c2079559eb1ada64a9f |

Pendientes: I2 sigue sin implementar; su propuesta externa 0573-I2-preparacion-worker.md (21011 bytes, SHA256 5f412c910b3fabee62d848dd12f7b3d7cc66d5d53cfadf4a3ed10725dc2a8ed9) fue leída por el Director, no es GO. T03/T04 y sus 41 primeras ejecuciones permanecen NO EJECUTADOS. La baseline anterior 80 = 64 PASÓ + 16 FALLÓ sigue ligada a su SHA/recibos; estas 27 revalidaciones se solapan y no son casos únicos adicionales. I2/I3/I4/B1/M2–M9, SQL/carreras/lectores/consumidores/verify/visual y los catorce hallazgos/A/B conservan su revisión pendiente.

El freeze operativo de 7394 terminó exclusivamente para este checkpoint documental propio. Este commit cambia sólo spec y handoff; producto/tests/SQL/lock/config conservan todos sus blobs de 7394. El producto probado sigue siendo 7394; no se transfiere una ejecución nueva al commit documental. Sin modificación de índice ni nueva prueba. No push/bodyedit antes de revisión de este delta; misma PR320 DRAFT contra B, sin ready/merge/deploy o claim release.

Impacto documental: resultado, procedencia y límites guardados sólo en spec/handoff propios. **Conocimiento NO EJECUTADO por turno retenido**: sin generadores, Graphify, Archify, cobertura semántica ni publicación/apertura compartida Obsidian. Tampoco full verify en este checkpoint. El control se devuelve al Director con retención técnica explícita; no se libera el turno ni el claim y no se inicia otra pesada.

## I2 · adopción de autoría sin runtime, antes de producto

Asignación vigente 0573-I2-autoria-sin-runtime-director.md, 12059 bytes, SHA256 d992a236659643d37cb208962a7a816be15ac72892d6dc8c0d286a6f758bb50f, y criterio peer 0573-I2-criterio-peer.md, 29801 bytes, SHA256 eb9a2d2ca85557acbe4383fc23170c038408c9ef16c4b0166cde0a30235133d7, leídos completos. Contrato CORE5ee11 ratificado y propuesta5f412c91 conservados. Base b70c5ddfd649cabaf71ee90e3ef080fd4f25d459/tree9fdb5539 publicada, mismo owner/rama/WT/claimB4. Guard harness absoluto guard --owner PASÓ antes de esta adopción; única excepción Node de ownership, sin gestor ni runtime de producto. Quince preimágenes propias guardadas externamente antes de escribir.

Allowlist escritora exacta de esta fase, subset de48, sin permiso de publicar:

~~~text
lib/studio/accounting/ingreso-periodo.ts
lib/studio/accounting/libro-control-queries.ts
app/studio/(app)/contabilidad/_components/IngresoDelPeriodoCard.tsx
lib/studio/reports/types.ts
lib/studio/reports/export-csv.ts
lib/studio/direccion/queries.ts
lib/studio/accounting/__tests__/ingreso-periodo.test.ts
lib/studio/accounting/__tests__/libro-control-queries.test.ts
app/studio/(app)/contabilidad/__tests__/reportes-tab.test.tsx
lib/studio/reports/__tests__/types.test.ts
lib/studio/reports/__tests__/export-csv.test.ts
lib/studio/direccion/__tests__/queries.test.ts
lib/studio/accounting/__tests__/ingreso-fixture.ts
docs/specs/0573-reverso-al-anular/spec.md
.agents/handoffs/0573-reverso-al-anular.md
~~~

Decisiones adoptadas: oficial y conversor heredados intactos; ajuste documental y base comparada nullable; par100/venta90 conserva diferencia10. controlI2 separa verificación no_leida/completa/requiere_revision, unidad usd/nominal_mixto/sin_verificar y actividad/contribuciones/incidencias mínimas, sin filas/PII de contexto en DTO. Mayor sin contexto no certifica Cuadra; sin mayor conserva cifra oficial/sin_mayor. El lector siempre obtiene contexto si hay mayor, incluso precalculado.

Contexto por sesión/guard/RLS y lecturas completas por IDs, ambos extremos fuera del rango y todas las cuentas/ascendencias relevantes; no listAccounts.limit1000 como evidencia. Validar tenant/factura/source/backlink/estado/borrado y espejo por cuenta/multiplicidad/centavos, sin depender de orden o memo, admitir IVA/subcuentas y no inventar par roto ante ausencia legítima de posting. Duplicados incompatibles, metadata/cuenta/parent/counterpart faltantes, shapes inválidos, error/corte o FX desconocido impiden certificación y no producen cero completo. Separar diagnóstico del saldo; nominal acreditado mantiene no_comparable/diferencia null aunque coexista incidencia, con causa separada; moneda desconocida no se rotulaUSD. Neto0 válido conserva actividad y explicación; corrupto no es Cuadra/vacío. Card/CSV/Dirección/mapas y visibilidad conservan esos ejes, unión de vista actual y otros KPIs.

Los53títulos/aserciones existentes se conservan, con preparación explícita de filas/contexto cuando corresponda; no verified:true ni resultados precalculados. Ffixture está permitida sólo para contexto/lecturas reales nuevas; los27M1 y sus bytes permanecen intactos. Lecturas nuevas detectables se reportarán con caller/tenant/guard/conteo exactos antes de ampliar invoice-read-boundary, que sigue EXCLUIDA; tampoco otras rutas escritoras fuera15.

Alcance actual: autoría de código/tests/docs y un commit LOCAL coherente padre b70; validación por lectura/Git diff/check, NO ejecución. Sin parser/imports/Node producto/PNPM/tests/lint/tipos/build/UI server/verify/SQL/DB/censo/conocimiento/instalación/push/PRedit. Turno retenido por UNKNOWN21908 sin nacimiento y supervisor incompleto; M1 sólo tiene evidencia funcional27PASÓ en7394, no transferida al nuevo I2. Los14hallazgos/A/B/I3/B1/M2–M9 y41 primeras ejecuciones siguen abiertos. No claim release ni nueva pesada. Esta adopción se guardó en spec/handoff antes de la primera edición de producto I2; SHA final y evidencia de fuente se completarán después del checkpoint.

### Adopción I2 · ampliación concreta v2 antes de nuevas rutas

Se adopta 0573-I2-ampliacion-boundary-y-fixtures-director-v2.md (6511 bytes, SHA256 6c58cb6f5f9b442b2b1175b47a6bc61600b256155b0da24e64fa51e459742dc7), con peer 0573-I2-compatibilidad-fixtures-peer.md (12844 bytes, SHA256 84889f7bb4c28377d24344194ab5e355965dad17c3add6b275b631c5aa2d6039), ambos leídos completos. V1 se preserva no adoptada. Guard del mismo owner PASÓ; dos preimágenes externas registradas en 0573-I2-autoria-local-01/adopcion-ampliacion-v2.json antes de modificar las rutas añadidas.

El slice pasa explícitamente de15 a17 rutas I2 y de48 a50 CORE; R1 sigue excluida para propagación serial, unión51. Se añaden únicamente scripts/__tests__/invoice-read-boundary.test.mjs (comentario, Q2→3 y total44→45,19 rutas; analizador/resto intactos) y app/studio/(app)/reportes/__tests__/estado-gerencial-mezclado.test.tsx (contexto crudo completo para sus dos escenarios; títulos/aserciones/render/importes intactos). No modifica ReportesClient.

El caso Q de candidatos inválidos conserva e1/e4/e6, sus líneas/rangos y los saldos600/1100/500: requiere diferencia certificada null, revisión e incidencia;400 sólo comentario aritmético. Añadir positivo íntegro600+400, con sólo600asentada y manuales200+300, conserva diferencia certificada400. No se altera ningún oráculo53T02/oncefallos. Runtime/AST/tipos/lint/UI/DB/conocimiento siguen NO EJECUTADOS; un checkpoint LOCAL padre b70, sin publicación antes de revisión. Turno y claim retenidos.

### I2 · fuente preparada, validación funcional NO EJECUTADA

En este checkpoint de autoría se preparan los seis productos autorizados y su cobertura de fuente. La cifra oficial conserva estados, fecha de emisión, base sinIVA, propio/terceros y conversión/redondeo de b70. No se importa un conversor externo ni código de otra rama. M1 sólo conserva la prueba27/27 del producto7394; esa evidencia no valida I2.

- Firma pura: `resumirIngreso(facturas, rango, mayor, contexto?: ContextoControlI2)`. El contexto contiene filas crudas de documentos/headers/líneas/cuentas, se consume en servidor y NO cruza en el DTO de ingreso. Sin mayor se conserva sin_mayor; mayor sin contexto no obtiene cero conocido ni Cuadra.
- DTO: `ajusteAnulacionesUsd` y `baseComparacionUsd`, ambos number|null; `controlI2` separa verificación no_leida/completa/requiere_revision, unidad usd/nominal_mixto/sin_verificar, actividad, contribuciones y códigos/conteos de incidencia. `causaDelControlI2` presenta causas genéricas sin IDs/PII.
- Puente: par único, pertenencia de tenant/documento/source/status/deleted/backlink, líneas completas y espejo por cuenta/multiplicidad/centavos. PermiteIVA y subcuentas; no iguala la base documental al monto contabilizado. Documento100/par90 conserva diferencia10. La base se convierte una vez y el mismo importe revierte con signo opuesto. Error/metadata ausente/corte/identidad incompatible impiden certificación; no se ofrece subtotal parcial como total.
- Q lee candidatos del rango sin ocultar los inválidos, ambos extremos por documento/ID/backlink, metadata por IDs fuera de emisión y cuentas pertinentes/parent por lotes y paginación estable. No usa el límite1000 de listAccounts como certificado de ascendencia. Mantiene sesión/RLS; líneas pertenecen por entry/cuenta, pues su schema no tiene tenant_id propio. El lector también obtiene contexto con opts.mayor; mayor=null no incorpora nuevas lecturas al Dashboard. Varias consultas NO son snapshot transaccional; una identidad incompatible observada bloquea el control, sin prometer cero carreras.
- Card conserva oficial prominente y añade ajuste/base/diferencia con cero conocido y null distinguibles, causa e identidad de unidad independientes del estado. CSV conserva centavos y vacía la columnaUSD para cifras del mayor nominal/desconocido. Dirección conserva oficial como valor principal, explica puente/causa y no cambia cálculo de utilidad, margen u otrosKPI. vistaDelEstado mantiene su unión y conserva vista completa ante actividad/incidencia aun con neto0.
- Boundary: Q2→3/total44→45 en19rutas, exclusivamente comentario y oráculo; scanner/imports/raíces/prefiltro/exclusiones/concurrencia/timeout intactos por inversión textual exacta. El AST NO se ejecutó. Las guardas contabilidad(accounting), reportes(reports), Dirección(direccion+admin) se conservan; sólo agregados/estados/conteos salen al cliente.

Preparación modificada: el fixtureF materializa documentos, cabeceras, líneas y cuentas crudos para los controles puros heredados; no devuelve verificación/unidad/ajuste calculados ni verified:true. Los dos casos Q con mayor precalculado reciben tablas reales; reportesDelLibro explicita el vínculo f1 del asiento positivo. Dirección usa el doble que aplica filtros/proyección para tablas contables y completa IDs/tenant/fechas/contrapartidas sin cambiar importes oficiales niKPI. El gerencial conserva sus dos títulos/aserciones/render/importes y añade contexto VES36500nominal/USD1000 íntegro. El Q negativo conserva cabeceras inválidas y líneas/saldos600/1100/500, exige null/revisión/incidencia; el nuevo positivo600+400 sin corrupción conserva diferencia400 y otros500.

Los53casos originales T02 y sus onceoráculos conservan íntegro su cuerpo por inversión de dos imports de preparación, separado de47escenarios nuevos previstos por fuente: IP24, Q12, Card3, types3, CSV3, Dirección2. Conteos NO obtenidos por discovery/runtime. Nuevos escenarios: contexto ausente/sinmayor, tenant/cuenta/parent/ciclo/source/deleted/backlink/metadata oculta, duplicados/multiplicidad/forma no válida, IVA/subcuentas/orden/IDs/memo, centavos, monedas desconocidas/nominal corrupto/FXausente, lectura completa/no completa, deriva entre lecturas, no-op, reader con/sin mayor y consumidor real. No se modifica test27 deM1.

**Discrepancia B3 visible, pendiente de decisión:** el caso original T02 «una VES con su asiento de factura vivo pero sin líneas en4.5…» representa cabecera huérfana. Se conserva su cabecera SIN líneas; no se la repara con prep-pasivo. Por lectura del corte0573-I2-B3-corte-01: enOtraMoneda1 es conteo heredado de cabecera, unidad sin_verificar, actividadfalse, lineas_invalidas1, ajuste/base/difnull y requiere_revision, sin nota nominal. Sus aserciones originales de diferencia1000/mayor_menor siguen intactas y contradicen la integridad I2. NO es un fallo ejecutado. No se cierra/acepta I2 ni se oculta el caso para lograr verde; el Director revisa el corte antes de checkpoint final.

Gobernanza por fuente: SGE-00 verdad del estado, NUM-01 separación unidad/null/0 y centavos, ERR-01 causa persistente segura: cumplimiento de diseño propuesto, aún sin prueba de comportamiento. A11Y-01/BRAND: reutiliza StatusIcon, textos y tokens; teclado/contraste/reflow/lector/UI-check NO EJECUTADOS. CMP-01 alta de componente global no aplica (se adapta componente de módulo); mutación/permanencia/AUD/DB no aplica a este cambio de lectura y presentación. No es excepción ni certificación global de políticas.

Validación: guardharnessligero propio PASÓ; cotejo Git de fuente/whitespace PASÓ en el corte previo a commit. Pruebas I2, tipos, lint, parser/AST, imports, Nodeproducto, PNPM, instalación, UI/servidor/build/verify, SQL/DB, censos y conocimiento: NO EJECUTADOS por prohibición expresa y turno retenido. Impacto documental guardado en estas dos rutas propias; integración, Graphify/Archify, cobertura semántica y revisión/publicación Obsidian quedan pendientes y NO EJECUTADAS. No se modifica main ni índiceSDD.

Pendientes propios: resolver dictamen B3 sin alterar otrosoráculos, revisión de fuente y checkpoint inmutable; después autorización separada de ejecución/publicación. Evidencia y eventual SHA/tree/padre se guardan externamente en0573-I2-autoria-local-01; el padre autorizado es b70c5ddfd649cabaf71ee90e3ef080fd4f25d459. Claim/owner/turno retenidos. Catorcehallazgos/A-B siguen abiertos, I3/B1/M2–M9 y41primeras ejecuciones previas no absorbidos. No push/PRedit/ready/merge/deploy/producción ni cierre funcional por autoría.

### Adopción previa · enmienda B3 autorizada sin runtime

Se adopta íntegra 0573-I2-enmienda-B3-director.md,5591bytes/SHA256caf766a8c1bf67a0ed7f1a637d297c82440bf14a54a65b3e8815b18c0156edb8, con conformidad expresa del Director general. Mismas17I2/50CORE/R1excluida-unión51, mismo owner/claim/WT/rama/padre b70; guard ligero PASÓ antes del cambio. Permanecen intactas las cinco fuentes del corte B3 y el original histórico53.

Se precisa enOtraMoneda a documentos distintos con movimiento nominal acreditado por metadata/tenant/cuentas/líneas, incluidos reversos fuera de emisión; se elimina el atajo por Set de cabeceras y su variable comparable anterior a la evidencia. Única enmienda del caso huérfano B3: contador1→0; diferencia1000→null; mayor_menor→requiere_revision. Se mantienen header prep-va SIN líneas, documentoVES36500/tasa36.5/rango/mayor0sinmovimiento. Se afirmarán oficial1000, ajuste/base/difnull, verificaciónrequiere_revision, unidadsin_verificar, actividadfalse/contrib0/incidencialineas_invalidas/notanominalnull. Mapping literal original→nuevo se guardará en0573-I2-autoria-local-01; el original quedó copiado ANTES del cambio. La preparación prep-pasivo rechazada queda registrada como transcripción de evidencia de autoría, no como un resultado ejecutado.

Estado actual previsto:52casos históricos preservados y1reforzado nominalmente autorizado, sin alterar los onceI2; añadir UNA regresión de1VESacreditada+1VEShuérfana (contador1no2 con incidencia), llevando nuevos escenarios previstos47→48. Se conservan positivoVESsin asiento/dif1000 y documento100/par90/dif10. Autoría no prueba funcionalidad ni acepta I2/14/A-B; runtime/publicación siguen prohibidos hasta GO posterior y revisión del checkpoint LOCAL.

### Cierre de autoría I2 · B3 aplicada y checkpoint local para revisión

La enmienda B3caf766a8 está aplicada: enOtraMoneda contiene sólo documentos con movimiento nominal acreditado por filas; no conserva una unión por cabeceras ni comparable precalculado. La huérfana queda con contador0/unidadsin_verificar/actividadfalse/incidencia y totalesnull. Se mantiene la anulación sin posting como no-op cuando la lectura completa no acredita ningún asiento. Los positivos de VES sin asiento (diferencia1000) y documento100/par90 (diferencia10) permanecen sin modificar.

El mapping durable0573-I2-autoria-local-01/mapping-B3-y-preservacion-v2.json (1332bytes/SHA25635eaef3ce5886192d3c9ced0a0b1bc371cff69b707a72186d8c95324555f3966) documenta el título y cada aserción modificada. Una inversión literal del único bloqueB3 y los dosimports de preparación reconstruye toda la base53 de b70: estado vigente52preservados+1reforzado autorizado; onceoráculosI2 intactos. El gerencial también reconstruye b70 completo al invertir sólo preparación/importtipo/cuartoargumento, con2títulos/aserciones/render/importes intactos. Las fuentes históricas de las etapas47/48 y la contradicción previa se conservan fechadas y quedan superadas sólo en lo indicado por esta adopción.

Se atendió dentro17 la incoherencia detectada por fuente entre mayor truncable y evidencia raw: nominales acreditados determinan unidad sin depender de ventasConMovimiento precalculado, y mayor_inconsistente contrasta tanto neto como movimiento acreditado de4.5. No se recupera ni sustituye el mayor global. Una hoja4.5 omitida del primer1000 con parnominalneto0 conserva la incidencia/NoComparable, no obtiene USD/Cuadra. Si mayor.ventasnull contradice movimiento acreditado, la incidencia y los ejes impiden certificación; no se presume una reparación del plan ni ausencia global de4.5 a partir de una lectura truncable.

Cobertura autoral nueva vigente:49escenarios previstos por fuente (IP25, Q13, Card3, types3, CSV3, Dirección2), incluidos el único nuevo mixto1VESacreditada+1huérfana y el caso lector sin opts.mayor/hoja después1000/neto0. Esto NO es discovery ejecutado ni resultado funcional. Cualquier test/gate/runtime completo queda NO EJECUTADO. Guard propio y Git diff/check son las únicas comprobaciones realizadas; M1actions/test27/SQL/package/lock/config y demás blobs ajenos se conservan.

Checkpoint LOCAL autorizado, padre DIRECTO b70c5ddfd649cabaf71ee90e3ef080fd4f25d459; SHA/tree/diff/sellos completos se registran en0573-I2-autoria-local-01/checkpoint-I2.json al crear el commit que contiene este bloque.17rutas exclusivas, sin índiceSDD, sin cambios fuera del reparto. Queda para revisión de Director/peer; sin push o ediciónPR320 hasta revisión del SHA, sin funcionalverde I2 y sin transferir la evidenciaM1 de7394. Claim y turno retenidos. Siguen pendientes las comprobaciones I2/AST/tipos/lint/UI/verify/DB/conocimiento y los otrosfrentes14/A-B/I3/B1/M2–M9/41primeras ejecuciones históricas.

### Adopción previa · seguimiento fuente97df, cuatro rutas

Leídos íntegros y cotejados: invariante0573-I2-invariante-mayor-movimiento-director.md (4610bytes/SHA256b08e23fde5296eca40283a4515310b22091807638e8f853fd5a05e1fba6ab750) y encargo0573-I2-correccion-97df-fuente-director.md (5460bytes/SHA2564b81c66cf00bb47d537d3be12ea87d46730e3b170c23eff7f7d6e2456656ef0f). Se adopta antes de fuente, con guard propio PASÓ y entrada97df limpia. Cuatropreimágenes selladas en0573-I2-correccion-97df-01/adopcion-preimagenes.json.

Allowlist de este seguimiento: lib/studio/accounting/ingreso-periodo.ts; lib/studio/accounting/__tests__/libro-control-queries.test.ts; docs/specs/0573-reverso-al-anular/spec.md; .agents/handoffs/0573-reverso-al-anular.md. Otras13del reparto17 idénticas a97df;17I2/50CORE/R1excluida-unión51 no cambia. Nuevo commit HIJO97df, sin amend/rebase/push.

Se corrige sólo la preparación porIDs/parent/account_id del nuevoQ sinopts para garantizar raíz dentro1000/hoja fuera bajo el orden efectivo del doble; expectativas intactas y precondición con listAccounts real en el mismo doble. Se cierra la contradicción ventasnull+rawmovimiento aunque el flag recibido también seatrue, sin recuperar otro mayor. Se añaden DOS escenariosQ USD/VES con objeto opts.mayor real y contexto de filas: revisión/incidencia/totalesnull, estado según unidadraw. Sólo el JSDoc residual se alinea con esas precondiciones.

El contenido sustantivo b08 ya constaba en el cierre documental97df: unidadraw, contraste neto+movimiento/default1000 y límite de no recomputar el plan. La revisión encontró implementación incompleta del null/true y preparación default incorrecta por orden efectivo; no se presenta97df como aprobado ni esos casos como fallos ejecutados. Se preservan52oráculos/onceI2/B3/M1. Inventario previsto49+2=51, sin discovery. Runtimeproducto/parser/import/AST/tests/tipos/lint/build/UI/SQL/DB/PNPM/censo/conocimiento siguen NO EJECUTADOS; claim/turno retenidos.

### Seguimiento97df · fuente corregida, aún NO EJECUTADA

Preparación Q corregida exclusivamente en identidad/parent/pertenencia de líneas: raíz a-raiz-ventas-go1, hoja zz-hoja-ventas-go1, dos account_id financieros actualizados y parent_id coherentes. Bajo el ordenID efectivo del doble, la raíz precede al corte1000 y la hoja queda después de1001rellenos. El caso mantiene dinero, parVES/tasa/rango/neto0, TODAS sus expectativas y llamada pública sinopts.mayor. Se añadieron precondiciones autorales con listAccounts real en el mismo doble (1000/raízpresente/hojaausente); las consultas porIDs se afirman junto a recuperación efectiva evidenciada por contador1/unidadnominal/actividad/NoComparable/incidencia. Son aserciones escritas, NO comprobaciones ejecutadas. No se cambió doble/helper global/límite.

IP incorpora exactamente la condición mayor.ventasnull + movimientoVentasAcreditado → mayor_inconsistente, independientemente del flag recibido. No reemplaza el saldo ni certifica ausencia de4.5. Dos casosQ nuevos parametrizados USD/VES usan opts.mayor {ventas:null, ventasConMovimiento:true,…} y contexto crudo del lector: ambos requieren revisión/incidencia y ajuste/base/difnull; USD→requiere_revision, VES→no_comparable con revisión aparte. El caso legítimo sin_cuenta sin evidencia contradictoria se conserva. El JSDoc de diferencia ahora exige contexto íntegro, unidadacreditada/baseconocida y coherencia neto/movimiento; no promete diferencia a partir de una cabecera huérfana o de cero.

Inventario de autoría vigente51escenarios nuevos previstos:49de97df +2USD/VES; las precondiciones del caso anterior no son casos nuevos ni discovery.52heredados/onceI2/B3/M1 permanecen intactos; los otros13archivos de17 y todos los blobs externos a estas cuatro rutas deben coincidir con97df. Guard y Git/diff son la validación permitida; el resto de controles sigue NO EJECUTADO, sin atribuir fallo/verde real al contraejemplo o la preparación anterior.

HijoLOCAL de97dfe31652ddead1ed2d95a2dd70328b40cab7b5, sin amend/rebase/publicación. SHA/tree/diff/cuatrocopias y cotejo de los demás blobs se registran en0573-I2-correccion-97df-01/checkpoint-hijo97df.json al crear el commit que contiene este bloque. Turno y claim retenidos. La próxima ampliación de consumidor aún no se adopta en este seguimiento y no se toca aquí ninguna ruta adicional.

### Adopción previa · incertidumbre gerencial I2, sólo fuenteUI

Leído íntegro y cotejado0573-I2-ampliacion-incertidumbre-gerencial-director.md (6630bytes/SHA256cff99d8876ce1d6236ba4751725f8c120745117efee9f9e9f5f9505a709ee7b4), con conformidadGeneral. Entrada7d08c173d562acfb3fc7ee69f6fe65b19c29c7a2 limpia, guard del mismo owner PASÓ, cuatropreimágenes incluidanuevaRuta registradas antes de editarla en0573-I2-gerencial-incertidumbre-01/adopcion-preimagenes.json.

Nueva ruta única app/studio/(app)/reportes/_components/ReportesClient.tsx, antes excluida de48; acumulado18I2/51CORE/R1excluida-unión52, lista18literal en el manifest de adopción y el GO. En esta fase sólo cambian ReportesClient.tsx, app/studio/(app)/reportes/__tests__/estado-gerencial-mezclado.test.tsx y estosdos documentos; las otras14 del18 y todootroblob deben seguir idénticos a7d08. Se conserva97df/7d08 y sus recibos, nuevo commit HIJO7d08 sin amend/rebase/push.

CambioUI riesgoR2 exclusivamente en IncomeStatementCard cuando unidadMayor=sin_verificar: título sin certificaciónUSD, aviso persistente de unidad no verificada y siguiente paso de revisar el control deIngreso del período; importes No disponible y porcentajes raya. Conserva oficial y diagnóstico separados, ramasUSD/nominal, filas/importes/cálculosP&L/utilidad/margen/filtros/fechas/interacción. Sin nueva primitiva, permiso, lectura, conversor, dependencia, API o detalle técnico en el texto al usuario.

Añadir UN caso real de helper/contextoausente con income/netIncome0 y vista completa porincidencia, tarjeta gerencial real sinUSD/$0/porcentaje certificado y oficial conocido conservado. Los2títulos/aserciones/render/importes gerenciales anteriores permanecen literalmente intactos; total autoral51+1=52previstos, no discovery. Guard/Gitlectura-diff son las comprobaciones permitidas; UI/teclado/contraste/zoom/reflow/lector/ui-check/gobernanzaautomática y todo runtimeproducto/parser/import/AST/tests/tipos/lint/build/browser/SQL/DB/PNPM/censo/conocimiento quedan NO EJECUTADOS. No aceptaciónfuncionalI2/14/A-B, no liberación de claim/turno ni publicación antes de revisión delSHA.

### I2 · incertidumbre gerencial implementada por fuente, R2

IncomeStatementCard lee exclusivamente el eje unidadMayor. Sólo sin_verificar usa título «Gerencial · unidad monetaria sin verificar», aviso persistente role=note con unidad no verificada y siguiente paso de revisar Ingreso del período, importes «No disponible» y porcentajes raya. No ejecuta fmtUsd ni muestra color de monto negativo para esa rama desconocida. Las ramasUSD/nominal conservan título/aviso/formatos previos; no se cambian P&L, filas, valores, porcentajes calculados, utilidad/margen, fechas/filtros, interacción o APIs. IngresoDelPeriodoCard conserva oficial y diagnóstico separados.

El único caso nuevo llama resumirIngreso real sin contexto, con mayor0 y facturaUSD1000 conocida; payload gerencial income/netIncome0 y fila0/pct0. Usa vistaDelEstado real (completo porincidencia) y renderiza ambas tarjetas reales. Las aserciones de ausencia deUSD funcional/$/0% se limitan al nodo gerencial; la tarjeta oficial conserva$1000. Los dos casos anteriores mantienen literalmente títulos, aserciones, render e importes37500/36500/1000. Inventario52nuevos previstos=51+1, sin discovery ni ejecución.

Matriz SGE-00 de esta superficie (evidencia de fuente; no conformidad global ni excepción). UI=[IncomeStatementCard](../../app/studio/(app)/reportes/_components/ReportesClient.tsx); T=[testgerencial](../../app/studio/(app)/reportes/__tests__/estado-gerencial-mezclado.test.tsx). Los enlaces apuntan a la fuente del checkpoint; sus comprobaciones dinámicas siguen NO EJECUTADAS.

| Principio | Clasificación de esta autoría | Evidencia y límite |
|---|---|---|
| SGE-00.01 predecible | No aplica a acciones nuevas | UI no añade verbos de mutación ni controles; sólo presenta estado. |
| SGE-00.02 no pérdida silenciosa | No aplica | No hay edición/guardado/borrado ni estado de trabajo modificado. |
| SGE-00.03 riesgo/fricción | Cumple por fuente, cierre pendiente | RiesgoR2 financiero de lectura: aviso/no disponible sin confirmación o fricción nueva. UI conserva interacción. |
| SGE-00.04 auditoría | No aplica a evento nuevo | No se produce mutación financiera ni llamada externa; cálculos y permisos no cambian. |
| SGE-00.05 permisos/tenant/privacidad | No aplica a cambio de autoridad | Sólo DTO agregado recibido; UI no añade lecturas, IDs, PII, permisos o ruta de datos. No se declara RLS verificada. |
| SGE-00.06 prevenir error | Cumple por fuente, gate pendiente | UI guarda unidad antes de formatear dinero/porcentaje; T mantiene0 desconocido separado de oficial conocido. |
| SGE-00.07 estado verdadero | No conformidad de7d corregida por fuente; cierre pendiente | Antes títuloUSDfuncional/montos0 sin unidad; UI añade aviso persistente/título/no disponible. T describe el contraejemplo; NO EJECUTADO. |
| SGE-00.08 frecuencia/complejidad | Cumple por fuente, cierre pendiente | Sin pasos/campos/filtros extra ni ocultar vista; complejidad se explica cerca del dato. |
| SGE-00.09 reutilización | Cumple por fuente | Mismo Card/aviso role=note/estilos/tokens existentes; ninguna primitiva nueva. |
| SGE-00.10 accesibilidad | No cumple evidencia de cierre: gate pendiente | Texto explícito/role=note/tokens, sin nuevos foco/interacción. Contraste/zoom/reflow/teclado/lector/ui-check NO EJECUTADOS; no se presume fallo observado ni conformidad. |
| SGE-00.11 lenguaje/recuperación | Cumple por fuente, gate pendiente | Aviso dice qué no se verificó, qué no está disponible y próximo paso; no SQL/rutas internas/tipos/detalles técnicos al usuario. |
| SGE-00.12 autoridad humana | No aplica a acciónIA nueva | Sin ejecución externa, propuesta de mutación o decisión financiera automática. |

NUM-01: unidad/null/0 separados en presentación; oficial conocido permaneceUSD, gerencial desconocido no recibe signo$ ni porcentaje, sin nuevo cálculo. ERR-01: explicación persistente y cercana, texto legible neutro sobre aviso existente con próximo paso; no toast ni datos internos. A11Y-01/BRAND: reutilización de tokens/estructura, sin color como único mensaje; accesibilidad real y gobernanza automática NO EJECUTADAS. La lectura del JSX no certifica el gate; no se inventa excepción para omitirlo.

Validación realizada exclusivamente guard propio/Git/lectura/diff, sin runtimeproducto/import/parser/AST/scanner/tests/tipos/lint/build/browser/UI/SQL/DB/PNPM/censo/conocimiento. Evidencia textual de preservación y cuatropreimágenes/copias finales se guarda en0573-I2-gerencial-incertidumbre-01; SHA/tree/padre7d08/diff y cotejo de todos los demás blobs encheckpoint-gerencial.json al crear el hijo que contiene este bloque. Acumulado18I2/51CORE/R1excluida-unión52; sóloCUATRO rutas activas y otras14idénticas7d08.

Pendientes propios: revisión de Director/peer del nuevoSHA, validaciones funcionales/UI/gobernanza con GO posterior y eventual respaldoDRAFT exacto. Guardado documental propio realizado; integración/Graphify/Archify/semántica/publicaciónObsidian NO EJECUTADAS y pendientes. Fuera de alcance:14hallazgos/A-B no cerrados; M1 sólo27probados en7394; I3/B1/M2–M9/41primeras ejecuciones anteriores no absorbidos. Sin push/PRedit/ready/merge/main/deploy/producción; claim y turno retenidos.

Cotejo textual durable: preservacion-fuente.json SHA256701b6ad31796214aee8e0aebc9b42cc3cd1a2e5074fc7537377a58e2f9d02c3c. Inversión literal reconstruye ReportesClient7d08 entero y doscasosgerenciales originales; no es prueba ejecutada de ramas, estilo o accesibilidad.

## Adopción I3-A v2 · adapter, sólo fuente, hijo de5c65

Se adopta ANTES del cambio de producto 0573-I3A-autoria-adapter-sin-runtime-director-v2.md (9083bytes/SHA25602b7067a23fb2456c665de2c6bd7555726afb6a2317f4582c1e21b9091d99671), leído completo. V1c5e376d3 queda preservada NO ADOPTADA; v2 corrige sólo el typo not_posted. CORE5ee11eab1d2f08af8890f676efdc20aa2daba918dd8d1c50c34950b366b22880, especialmente§6, y peerI3(9983bytes/SHA256125d54a41d1f41da461eeb81d55f1c979502c96787d23fccb7c2bdab41385fbb) leídos completos. El peer es criterio técnico, la orden vigente activa únicamente I3-A.

Mismo Writer/owner worker-0573core-01a15a4e-ddf0-7d82-8656-d9dc56b58468, WT C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/sdd-0573-core-reparacion-20261021, rama codex/sdd-0573-core-reparacion-20261021. Entrada/padre DIRECTO5c659dad1bceb0c8f51031149287240827374619/tree5c4770102b89b9abb6def1ae5feed7a9ad1eaa93, guard propio PASÓ y estado limpio; claim212bytes/B4 y turno RETENIDOS. Cuatro preimágenes y adopción externas en C:/tmp/director-traspaso-20261020/0573-I3A-autoria-local-01/adopcion-preimagenes.json, preservadas antes de autoría.

Allowlist escritora EXACTA, dentro51CORE/R1excluida-unión52:

~~~text
lib/studio/accounting/invoice-posting.ts
lib/studio/accounting/__tests__/invoice-posting-reverso.test.ts
docs/specs/0573-reverso-al-anular/spec.md
.agents/handoffs/0573-reverso-al-anular.md
~~~

Objetivo de este corte: una única RPC post_invoice_journal_entry_atomic sólo con tenant/factura, validación escalar estricta y señal honesta de desconocido/dependencia ausente; API/exportaciones/códigosSALES preservados. Mantener literalmente28 oráculos T04 y su doble legado; nuevas regresiones sólo autoría, sin discovery/ejecución. No autoría SQL/M8/M9 ni RPC instalada inferida; futura unidad SQL de código/cabecera/líneas/locks/auditoría, tres intentos selectivos y catálogo siguen pendientes de otro corte concreto. Importes/código/fecha del caller se conservan por compatibilidad de tipos, sin autoridad de posting.

Únicamente lectura/fuente/Git/diff-check/guard ligero y commit LOCAL hijo5c65. Sin push/PRedit I3A antes de revisión; PR320DRAFT publicado permanece5c65/basee834. Se preservan18I2, M1actions/27, SQL/package/lock/config y otras6341entradas. Prohibidos runtimeproducto/Nodeadicional/import/parser/AST/tests/tipos/lint/build/UI/SQL/DB/PNPM/Docker/advisors/censo/supervisor/conocimiento/hooksruntime. Guardado documental propio sí; integración/Graphify/Archify/semántica/Obsidian NO EJECUTADOS. M1 sólo27PASÓ7394/supervisión INCOMPLETA, I2fuente5c65 NOEJ,28T04/base80/41restantes/14/A-B abiertos; UNKNOWN21908 y recibos intactos.

### Resultado de autoría I3-A · revisión y ejecución pendientes

El commit que contiene este bloque es un hijoLOCAL DIRECTO5c65 de exactamente cuatro rutas. invoice-posting.ts mantiene exports, tipos públicos y códigosSALES; cambia sólo la implementación del adapter. Una llamada a post_invoice_journal_entry_atomic(p_tenant_id,p_invoice_id) identifica la factura del tenant, sin enviar invoiceCode/importes/entryDate. Se eliminan count amplio, lecturas de cuentas, correlativo, writes directos, compensaciónDELETE, tolerancia/round monetario y fechaUTC/hoy. Esto no crea la RPC ni verifica atomicidad: toda persistencia, dinero/fecha civil persistidos, idempotencia íntegra, locks, cierre, auditoría y tres intentos selectivos pertenecen al futuro corte SQL/I3/M8/M9.

Contrato de respuesta implementado por fuente:

| Resultado escalar v1 identificado | Resultado público |
|---|---|
| posted/reasonposted + UUID/código/fecha civil válidos | oktrue/entryCode, sin skipped |
| already_posted/reasonentry_already_exists + mismos campos válidos | oktrue/entryCode/skippedentry-already-exists |
| not_posted/reasonzero_total, tres campos de asiento EXACTAMENTE null | oktrue/skippedzero-total, sin entryCode; sólo no-op |
| not_posted con uno de los ocho motivos conocidos y camposnull | okfalse/skippedestable específico; no confirma ausencia de antecedentes |
| RPC ausente42883/PGRST202 | okfalse/skippedatomic-posting-unavailable, explicación segura; no fallback |
| Otra forma/versión/identidad/reason/campo inválidos, error o excepción | okfalse/skippedposting-state-unknown, sin entryCode ni crudos; no afirma ausencia/rollback/commit |

Los ocho skipped son invoice-unavailable, invoice-not-postable, invalid-issue-date, invalid-amounts, totals-mismatch, missing-accounts, period-closed y existing-sale-requires-review. atomic-posting-unavailable es decisión acotada del adapter ratificada por este GO, no outcomeSQL adicional. Mensajes propios con recuperación; no se propagan message/hint/SQL/PII del servidor. Un error prevalece sobre data de éxito. Sin retry general, reemisión, cobro, crédito o reparación implícita.

La fecha devuelta exige longitud10/formatoYYYY-MM-DD y calendario gregoriano real de años0001–9999, con regla de siglo/bisiesto; no usa Date ni normalización. UUID exige36 caracteres y sintaxis hex canónica, sin imponer versión/variante adicional al contrato. Código string no blanco; se conserva su valor, sin inventar formato financiero. Longitudes explícitas evitan aceptar un salto final permitido por el ancla$ de una regex. Ninguna validación sustituye dinero/fecha del documento persistido a cargo de SQL.

T04: archivo original ENTERO10454bytes/SHA2565f92773763cf1c0db026f73e0919f73d6995c3b669e7dcf0e4c27fc1d486e33c preservado como prefijo literal, incluidos imports, doble legado real,28títulos/cuerpos/oráculos. No incompatibilidad heredada detectada por lectura. Sufijo nuevo51escenarios ESCRITOS NOEJ: combinaciones6;null explícito9;rechazo/cero incompletos2;campos de éxito8;forma/versión/identidad6;fechas inválidas9;fechas válidas5;RPC ausente2;errores devueltos3;excepción1. Total79previstos por inventario de fuente, SIN discovery, ROJO, VERDE o test ejecutado. Cada caso usa el adapter/doble existente y observa una sola RPC/sinfrom/sinwrites; no representa commit/locks SQL. Cotejo textual y refinamiento de longitudes en preservacion-oraculos-fuente.json externo, no convertido en validación funcional.

Superficie backend Studio/Contabilidad, riesgoR3 financiero; governance-check aplicado sólo por lectura de brief/registro derivado contrastado con políticas primarias SGE-00v1.0, ERR-01v1.0, NUM-01v1.1, AUD-01/AUD-02v1.0. No excepción nueva ni conformidad global:

| Principio | Clasificación acotada y evidencia |
|---|---|
| SGE-00.01 predecible | Cumplimiento por fuente del mapping estable; no confirma emisión/documento completo. |
| SGE-00.02 conservación | Adapter elimina compensación best-effort y no reintenta desconocido; no conformidad de cierre pendiente de unidad SQL/rollback probado. |
| SGE-00.03 riesgo | R3 mantenido; no aplica cambio de confirmación/fricción/UI, callers/gates intactos. |
| SGE-00.04 auditoría | No conformidad de evidencia de cierre: futura SQL/D2/fallo del evento y rollback aún NOEJ; no log ficticio enTS. |
| SGE-00.05 tenant/permisos | Cumplimiento por fuente de dosIDs/cliente existente; ACL/tenant/estados/cierre se deben probar enSQL, no aceptación. |
| SGE-00.06 prevención | Validación estricta antes de certificar resultado, sin autorizar éxito HTTP200 por sí solo; validación persistida pendiente. |
| SGE-00.07 estado real | Cumplimiento por fuente posted/reconocido/cero/rechazo/dependencia/unknown; no exactamente-una-vez ni commit exterior prometido. |
| SGE-00.08 complejidad | Conserva API/callers sin nuevos pasos o formularios; explica revisión antes de otra solicitud. |
| SGE-00.09 reutilización | Cliente admin/API existentes; tres funciones privadas locales (isCivilDate, postingStateUnknown y readAtomicResult) dentro del mismo adapter, sin nuevos imports, dependencias o componentes. |
| SGE-00.10 accesibilidad | No aplica control/render nuevo en este adapter; UI/callers no revalidados aquí. |
| SGE-00.11 lenguaje | Errores seguros con revisión/siguiente paso; sin ausencia afirmada o SQL crudo. Logs legados ajenos conservan deuda§6.4. |
| SGE-00.12 autoridad | Autoría local autorizada; no ejecución financiera, DB, integración o publicación nueva por esta fase. |

NUM-01: la autoridad decimal permanece SQL, nofloat/tolerancia en el adapter ni cero por error. ERR-01: rechazo/dependencia/desconocido separados y copy seguro; no auto-retry. AUD-01/AUD-02: ninguna auditoría ficticia, fila real, exportación o payload sensible; evento/ACL efectivos pendientes del corteSQL. Documentación primariaSupabase de funciones/rpc/EXECUTE/search_path y changelog consultada por lectura pública, sin medir servidor o conectarse a cuenta; la guía no sustituye la ACL service_role/tenant ratificadas ni impone auth.uid no-null al admin sin sujeto.

Validación de este corte: guard propio/Git/lectura/diff-check y preservación textual; controles automáticos de gobernanza/docs/UI, parser/AST, imports/tipos/lint/tests/build/verify, SQL/DB/locks/carreras/catálogo, conocimiento y supervisión NO EJECUTADOS. Mantener los28T04 sin ejecutar y baseline80/41,14hallazgos/A-B abiertos. M1 prueba27 sólo7394/supervisión INCOMPLETA; I2fuente5c65/52nuevos NOEJ. RPC/M8/M9 pendientes, no aplicadas0496/0497. Deuda fuera de estas cuatro rutas: logs legados de callers con prefijo “no creado” reconocido enCORE§6.4; no prueba de ausencia ni permiso de editarlos.

Entrega de revisión: cuatro copias finales/diff/manifest externo en0573-I3A-autoria-local-01 con padre/tree/6345entradas y6341otrasidénticas. Guardado documental propio realizado; integración, Graphify/Archify/semántica/Obsidian NO EJECUTADOS y pendientes por turno retenido. PR320DRAFT publicado sigue5c65/basee834 hasta revisión/GO de respaldo exactoI3. Sin push/PRedit/main/ready/merge/deploy/DB; Writer quieto tras checkpoint, claim/turno RETENIDOS y UNKNOWN21908/recibos intactos.


### I3-B · adopción del encargo de fuente local, sin ejecución · 2026-10-22

Se adopta íntegro el encargo externo C:/tmp/director-traspaso-20261020/0573-I3B-encargo-fuente-director.md (13345 bytes, SHA256 b307acc5e955e334c176ca627fbe57b673ef98d2ae4892c467f1c66de344292b), propuesta24ca y revisión21a998, con prevalencia de la corrección CASCADE. Mismo Writer/owner worker-0573core-01a15a4e-ddf0-7d82-8656-d9dc56b58468, WT y rama propios; padre46e5fd6ecf6e842ee967aba81406cf2cf71c88ea/tree d39a339068cc91f475ec133d89123dd00faf7c49, 6345 entradas, guard propio PASÓ/limpio/claim212-B4 antes de editar. Preimágenes externas en 0573-I3B-fuente-preparacion-01/adopcion-preimagenes-worker.json; 0497 conserva al adoptar el blob cd795051ac6380204c3af90ccd5f2f9194e2511b, declarada pendiente/MIGRATE-FIRST, sin evidencia nueva de aplicación ni permiso para aplicarla.

Allowlist escritora EXACTA de este corte, dentro51CORE/R1excluida-unión52: supabase/migrations/0497_reverso_al_anular_factura.sql; supabase/tests/0497_reverso_al_anular_factura.test.sql; lib/studio/__tests__/reverso-al-anular-factura.migration.test.ts; supabase/tests/0497_reverso_al_anular_factura_carrera.test.sql (nueva); supabase/migrations-baseline.json; supabase/pending-migration-symbol-declarations.json; esta spec; handoff0573 propio. No adapter/testI3A/I2/M1/callers/config/package/lock/runners ni otras migraciones. Autoría local/commit selectivo hijo46e5, sin push/PRedit antes de revisión.

Decisiones locales ratificadas: (1) líneas completas antes de cabecera protegida y sólo FK existente DEFERRABLE INITIALLY IMMEDIATE, con identidad/acciones/singularidad verificadas; sólo FK/final-entry/final-invoice nominales, nunca ALL; construcción puede rechazar pendientes previos y sale IMMEDIATE, no restaura un modo privado no observable. (2) RPC/protected construction exclusivamente READ COMMITTED/25000 antes de efectos; no globalizar a manuales. (3) venta automática existente también sin reverso queda inmutable/no se completa borrador o huérfana; manual ajeno conserva contrato. La explicación UI de ese endurecimiento es dependencia de B1/consumidores, fuera de estas ocho rutas. (4) mutex transaccional dtd:i3:journal-entry:UUID en toda cabecera, INSERT/DELETE de línea; decisión posterior al lock, factura primero y orden estable. No acredita origenRPC ni elimina deadlock/timeout/rollback de víctima. (5) ambas RPC SET dtd.audit_reason='' además de search_path vacío; motivo humano sólo en UPDATE que produce invoice_voided, contexto exterior acotado por función, referencias deterministas sin motivo en memo/notas copiadas; append/D2/cierre históricos reales preservados.

CASCADE adoptado: DELETE de línea toma el mismo mutex OLD.entry_id y relee padre íntegro sin filtro tenant/status/deleted. Padre protegido presente rechaza; manual ajeno conserva reglas; padre ausente permite exclusivamente DELETE/RETURN OLD sin exigir RC por esa ausencia. No abre INSERT/UPDATE ni bypass GUC/pila/pg_trigger_depth. DELETE de todo padre protegido continúa rechazado antes de cascada; cabecera nueva valida el conjunto restante.

Evidencia previa separada de esta autoría: T02/IP78 PASÓ78/78 sobre46e5 (dictamen88751ef2, cierre exterior oportuno); T04 PASÓ79/79 sobre46e5 con RPC simulada (dictamenb18a38f8, cierre exterior oportuno). Identidades exactamente reportadas: dos títulos parametrizados incluyen «…», y uno conserva LF; no se expanden argumentos originales. T04 cubre28 primeras antes pendientes: quedan13 iniciales pendientes, otros27 escenarios nuevosI2 y controles SQL/DB/locks/carreras/catálogo, además de14hallazgos y A/B abiertos. M1 conserva sólo27PASÓ7394 y supervisión INCOMPLETA; UNKNOWN21908/outer1/turnReleasedfalse y primerT02NOEJ intactos. Ninguna prueba se transfiere a fuente SQL nueva.

Estado al adoptar: AUTORÍA EN CURSO, no revisión ni aceptación funcional de I3-B. Todas las pruebas/catálogo/ACL/commit/races/D2 nuevas serán ESCRITAS NO EJECUTADAS; sin discovery ni mutantes detectados inferidos. Sólo guard ligero/Git/lectura/diff-check; Nodeproducto/import/parser/AST/tests/tipos/lint/build/verify/PNPM/SQL/DB/Docker/censo/supervisor y conocimiento NO EJECUTADOS. Impacto documental guardado sólo en spec/handoff propios; integración/Graphify/Archify/semántica/Obsidian/publicación compartida pendientes, sin generación ni publicación. Claim retenido.



#### I3-B · enmienda puntual de oráculos adoptada antes de tests
Se leyó/adopta 0573-I3B-oraculos-ampliacion-puntual-director.md,5396bytes/SHA2567592e34c799581df69598986a39b62b3a690068022d58baaf510b9f0f41cc62f, sobre solicitud5710/34dd8a42 y las dos preimágenes originales preservadas. Sólo se autoriza dentro de las mismas ocho rutas: retirar motivo humano del memo abierto/cerrado conservando códigos/fecha/sufijo, no copiar notas libres y reforzar motivo EXACTO sólo invoice_voided; mover el bloque apply_fix tras todas las semillas idénticas y antes del primer oráculo; adaptar los dos rechazos tempranos a23514 exacto con estado/líneas/eventos/contexto inalterados; separar catálogo real UNIQUE/FK/CHECK y mutantes por propiedad; preservar veinte propiedades mutantes con selectores singulares y oráculo concreto. Sólo el cloneSQL de un TEST funcional puede actualizar la huella propia de la función mutada, no otras huellas ni la candidata normal; mutantes del pinM9 mantienen la huella vieja. No basta cualquier error/hash/timeout/carga para contar detección.
El rechazo header-first cerrado conserva23514; no se atribuye a0493 sin llegar a esa guarda. Se añadirá positivo de alcance del cierre real mediante manual ajeno cerrado, sin excepción/bypass. Todos los demás oráculos originales se conservan; nueva incompatibilidad requiere evidencia antes del cambio. SQL, PGlite, mutantes, catálogo y carreras: ESCRITOS NO EJECUTADOS. Checkpoint fijo a revisión Director/peer y DIRECTOR ORQUESTADOR antes de cualquier GO de runtime; sin pausa de autoría, publicación o ampliación de rutas.

### I3-B · checkpoint local de fuente sobre 46e5 (2026-10-22)

Este bloque es el estado vigente de I3-B; los bloques anteriores conservan su fecha y evidencia. Encargo `b307acc5e955e334c176ca627fbe57b673ef98d2ae4892c467f1c66de344292b` y enmienda de oráculos `7592e34c799581df69598986a39b62b3a690068022d58baaf510b9f0f41cc62f` adoptados antes de producto/pruebas, respectivamente. Misma raíz/rama/owner y claim212/B4 retenido; padre directo de esta unidad: `46e5fd6ecf6e842ee967aba81406cf2cf71c88ea`. No se incorpora aquí el SHA de este mismo commit.

**Resultado de fuente, no aceptación funcional.** Se escribió la RPC escalarv1 `post_invoice_journal_entry_atomic(uuid,uuid)`, la construcción completa línea→cabecera, inmutabilidad inmediata OLD/NEW/participación inversa y coherencia final en ambas direcciones anulación↔par. El adapter y sus79 oráculos probados permanecen byte a byte como46e5. No se modificaron las18 rutasI2, M1, package/lock, callers, configuración, runners ni0078/0133/0267/0290/0294/0493/0496. La allowlist de esta fase consta exactamente de las ocho rutas del encargo, incluida la carrera nueva; no amplía51CORE/R1 excluida/unión52.

- Dinero: SQLnumeric persistido finito/no negativo/escala real/total exacto antes de cero; fecha civil issued_at persistida válida, sin caller/hoy; raíces de cuentas reales por tenant/code/is_postable. Base0/IVApositivo mantiene4.5 cero. Un original histórico íntegro90/documento100 se reconoce y revierte90, sin ajustar diez. Un borrador, huérfano, duplicado o vínculo cruzado es revisión, no ausencia.
- Construcción: UUID nuevo, TODAS las líneas antes de cabecera; sólo la FK existente de líneas pasa a DEFERRABLE INITIALLY IMMEDIATE con CASCADE/acciones/columnas/validación preservadas. Se normalizan/difieren/fuerzan sólo esa FK y dos constraints finales con nombre singular verificado. Lectura/no-op no cambia modos. Construcción puede rechazar pendientes previos y sale con esos nombres IMMEDIATE; no promete restaurar un modo privado no observable del caller.
- Concurrencia: RPC/construcción protegida sólo READ COMMITTED,25000 genérico antes de negocio en RR/serializable. Toda inserción de cabecera, incluso manual, y la admisión/borrado de líneas usan mutex transaccional UUID `dtd:i3:journal-entry:`, con lectura decisoria posterior a esperar. La factura se bloquea primero en RPC, luego entradas/líneas/cuentas ordenadas. DML ajeno puede invertir locks: deadlock/timeout/serialización se propagan sin retry general ni promesa de disponibilidad.
- CASCADE: DELETE de línea bloquea OLD.entry_id, relee padre sin filtros y devuelve OLD si realmente falta; sólo DELETE recibe ese tratamiento, sin exigir RC por esa ausencia. Padre protegido existente sigue indeletable, incluso venta automática sin reverso. Manual físico conserva contrato RC/RR. Quitar una línea PRE-header es lícito; el conjunto restante debe ser íntegro al admitir la cabecera. No es el soft-delete de UI.
- Factura: guardas inmediatas rechazan desvincular/reabrir una factura protegida; constraints finales consultan estado actual, sin exigir una transición imposible antes del UPDATE. La admisión de anulación/DELETE/cambio de identidad,tenant odeleted de factura exige RC aun ante ausencia no acreditable en un snapshot RR; no extiende ese requisito a todo DML manual de journal. No se inventa inmutabilidad global de importes o del plan de cuentas.
- Reintentos: máximo3 intentos TOTALES sólo por diagnóstico schema/table/constraint de la UNIQUE real tenant_id+entry_code. Cada subintento incluye código/TODAS líneas/cabecera/D2 y transición de void. Otra23505/FK/CHECK/append/cierre/permiso/deadlock/timeout propaga y revierte su unidad; no hay compensación DELETE ni retry de emisión,cobro ocrédito.
- D2/M4: ambas RPC delimitan `SET dtd.audit_reason=''` por función. Sólo UPDATE de invoice_voided lleva motivo humano exacto; memo/líneas son referencias deterministas, sin motivo ni notas libres originales. Fecha de reverso se calcula una vez como greatest(hoyCaracas,cierre+1,fechaoriginal). Se preservan cuerpos/ACL/triggers históricos de0267/0290/0294/0493, sin stubs ni excepción usada como bypass. Contexto ausente/vacío/no vacío/excepción/anidación tiene oráculos futuros explícitos; no se declara restauración medida.
- M9: pre/postflight verifica cuerpos con MD5 literal normalizado sólo LF, firma/retorno/owner/DEFINER/volatilidad/defaults/config/ACL efectiva y herencia, tipos/RLS/FK/PK/UNIQUE/CHECK/predicados/acciones/validez/diferibilidad, RI y enlaces/eventos/WHEN de triggers. Los sellos son derivados de lectura, no medición del catálogo de una DB.

**Oráculos heredados y enmienda puntual.** Se conservan las veinte propiedades mutantes; quince funcionales repinan exclusivamente el cuerpo de su propia función en el clon TEST para alcanzar su aserción concreta. Cinco mutantes estructurales heredados y quince M9 nuevos mantienen deliberadamente el pin anterior; no se acepta cualquier error, timeout o hash genérico como prueba funcional. El wrapper queda con40 casos previstos por composición de fuente, SIN discovery ni ejecución. El contrato SQL tiene18 grupos nuevos y la carrera18 grupos R01–R18, sin inventar un conteo de aserciones ejecutadas.

Mapping autorizado: el memo heredado pierde sólo el sufijo de motivo libre y conserva factura/códigoOriginal/fecha/sufijo de cierre; invoice_voided.reason mantiene igualdad EXACTA, con no-filtración a memo/notas/journal_entry_posted reforzada. Los mismos seeds legados se sitúan antes de aplicar0497, sin reparar corrupción/desactivar guardas. El duplicado header-first y DELETE de padre protegido esperan23514 de la guarda temprana, con estado/líneas/eventos intactos, en vez de atribuirles23505/RESTRICT no alcanzados. UNIQUE/FK/CHECK reales tienen oráculos M9 separados. El caso header-first cerrado no se atribuye0493; un manual ajeno cerrado alcanza y exige el mensaje real de cierre. Los20 anclajes/probes y las preimágenes originales quedan en el paquete externo.

**Selección futura UNBOUND.** Contrato secuencial y wrapperPGlite se separan de PostgreSQL17 real con dblink, coordinador+fixtureS y actores A/B (C fresca sólo contexto). La carrera exige fixture COMMIT previo, barrera pg_blocking_pids/pg_locks, efectos confirmados, prioridades post/post y post/void, UUID, correlativos, snapshot previo, FK/final en COMMIT real, rollback exterior, CASCADE manual RC/RR, reemplazo concurrente, contexto, timeout/deadlock y construcción directa en RR/serializable. Drena resultados/cancela sólo sus conexiones y limpia únicamente DB/roles marcados propios, sin FORCE; falla si falta PG17/dblink o no cierra. PGlite no acredita esos locks, commits, ACL de despliegue ni DB real. El anexo externo propone entorno/herramientas por archivos/recibos; imagen/daemon/psql/dblink no se dan por disponibles sin medición autorizada. No se inició ninguna de estas selecciones.

**Evidencia vigente y pendientes separados.** T02/IP78 PASÓ sobre46e5, dictamen `88751ef2d2bba5e42f455426dd97a067bab7eafc565acb2b62b5237e700c53b7`; incluye53 heredados con B3 enmendado y25 nuevosI2. T04/I3-A79 PASÓ sobre46e5, dictamen `b18a38f8a50e085260b1bb8fe6cb48816fe15619773df02d2f0be436b6887fbf`;28 heredados+51 nuevos, RPC simulada. Dos identidades parametrizadas contienen «…» tanto en stdout como en JSON; se preservan exactamente como reportadas, sin afirmar expansión de argumentos. Quedan13 controles iniciales y27 otros nuevosI2 pendientes, además de SQL/catálogos/carreras y cierre canónico. M1 conserva27PASÓ sólo sobre7394 y SUPERVISIÓN INCOMPLETA: UNKNOWN21908 sin nacimiento, launcheroriginal5476exit1 y turnReleasedfalse históricos intactos; cancelación administrativa posterior no los vuelve verdes. Baseline80=64/16,41 primeras NOEJ originales y primerT02NOEJ permanecen históricos. Catorce hallazgos/A-B y PR320DRAFT siguen abiertos.

| Comprobación de este corte | Estado y límite |
| --- | --- |
| Guard propio/ownership, lecturas de fuentes, huellas y Git diff-check | Permitidos y registrados en recibo externo; no son aceptación de producto |
| Producto SQL, contrato, mutantes, carrera y selección propuesta | AUTORADOS; NO EJECUTADOS |
| Tipos/lint/AST/imports/build/verify/UI/DB/SQL/Docker/advisors/supervisor/censo | NO EJECUTADOS, sin turno para esta fase |
| Publicación de rama/PR, merge, apply y producción | NO EJECUTADOS por esta autoría; checkpoint LOCAL para revisión fija |
| Impacto documental | Guardado sólo en spec/handoff propios y paquete externo |
| Graphify/Archify/semántica/Obsidian compartido | NO EJECUTADOS; sin generación o publicación |

RiesgoR3 por estado contable/auditoría. Reutilización: clienteadmin/API/adapter y fuentes D2/cierre existentes, helpers SQL privados sólo dentro0497, sin dependencias/componentes nuevos. Precisión nominal y errores fail-closed se documentan con causa/acción, no se convierte incertidumbre en éxito. UI sustancial NO APLICA a estas ocho rutas; pendiente del corte B1/consumidores explicar el bloqueo nuevo de una venta automática sin reverso. Locks/latencia y compatibilidad real PGlite/PG17 quedan para revisión y runtime autorizado; no se declara ausencia de deadlocks o commit externo. Paquete0497 continúa MIGRATE-FIRST/pendiente y requiere OK nominal de Sam antes de aplicar;0495 no se repite. Conocimiento pesado y revisión visible quedan pendientes fuera de este turno.

### I3-B · adopción de la enmienda de revisión de cfa71 · 2026-10-22

Se adopta íntegro `C:/tmp/director-traspaso-20261020/0573-I3B-enmienda-cfa71-director.md`,10096 bytes/SHA256 `41801e2b44620826bf23eb4053131f6ed9357435106c6ea7853ed89260d05eb6`, antes de editar producto o pruebas de esta fase. Misma tarea, Writer, worktree, rama y claim212/B4. Guard propio y metadatos confirman padre fijo `cfa71fbc5c93538f62a8a5bb9921eca6b2547f2f`, tree `9e6bb0785540d38ea758bd8ef198578489e0f9d5`, limpio; se guardaron ocho preimágenes en paquete NUEVO02. Cfa71 y los30 sellos del paquete01 permanecen intactos. Siguen vigentes encargo b307 y enmienda7592, dentro de exactamente las mismas ocho rutas, sin otro escritor.

Autoriza corregir sólo tres P2 por lectura: comparación determinista de expresiones reales de defaults de append/append_v1 (y ausencia con cero defaults), restitución nominal de dependencias antes del DDL y oráculoR15 que distingue ausencia registral de ausencia semántica del motivo. No se alteran escritores0267/0294, sus cuerpos/config/permisos, adapter/testI3-A, I2/M1, otras migraciones, package/lock/config/runners ni política compartida. Los P2 no son fallos ejecutados ni evidencia de fuga/corrupción.

Se adopta expresamente la condición RC ya escrita para DELETE/cambio de id/tenant/deleted_at/transición a anulada de cualquier invoice alcanzada antes de consultar asientos; no sólo las dos RPC. Manual físico de journal y CASCADE RC/RR siguen conservados, y padre ausente sólo habilita DELETE de línea. R17 de mutex no prueba rollback financiero después de escrituras; no hay carrera de cobro concurrente acreditada. Ambas limitaciones siguen pendientes globales, sin absolverlas como fuera de alcance definitivo.

Sólo fuente, guard ligero, Git, lectura, hash, edición y diff-check. Pruebas/SQL/DB/Docker/Nodeproducto/AST/import/discovery/build/verify/PNPM/censo/supervisor/conocimiento NO EJECUTADOS. Se preparará READYV2/selección UNBOUND del wrapper completo sobre una hija directa de cfa, con900+60 propuestos y ningún GO/reloj/turno iniciado. Revisión Director/General antes de runtime o publicación; claim retenido, sin push/PRedit.

### I3-B · corrección de los tres P2 y límites de cobertura · 2026-10-22

Estado de fuente de esta hija directa de cfa71; no reemplaza su paquete01 ni convierte sus lecturas en ejecución. Enmienda41801 adoptada antes de editar, con ocho preimágenes completas de cfa en `0573-I3B-fuente-preparacion-02/`.

**P2-D, defaults reales.** Se conservan firma/cantidad/cuerpo/owner/config/ACL y todos los pins anteriores. Pre/postflight comparan las expresiones con `pg_get_expr(proargdefaults,0::oid,false)`, sin normalización de espacios o literales: `'succeeded'::text, NULL::text, NULL::jsonb, NULL::jsonb, '{}'::jsonb, NULL::text, 1, 'internal'::text`, en ese orden. Para firmas con cero defaults se exige además proargdefaults NULL. Representación prevista por lectura de0267/0294 y código PG17 de deparse; no catálogo observado. Las migraciones predecesoras permanecen intactas. Cuatro oráculos M9 específicos: ambos escritores reales, antes del preflight y antes del postflight. Alteran sólo p_result DEFAULT a failed; el clon TEST comprueba que todo pg_proc salvo proargdefaults quede idéntico, incluyendo cantidad8 y prosrc. Error de ancla/carga/cuerpo no cuenta como detección. Se conserva el mutante anterior que añade un default al posting. Se añaden dos aserciones ordinarias al catálogo SQL, sin cambiar sus otras expectativas.

**P2-P, dependencias nominales.** Restituido antes de efectos/DDL el bloque original de nueve dependencias: invoices, journal_entries, journal_lines, payment_receipts, accounting_settings, user_tenants, get_user_tenant_id(), next_entry_code(uuid) y auth.uid(). Identidad de rechazo original conservada; los controles M9 nuevos siguen vigentes. Nueve casos negativos de fixture TEST renombran únicamente el objeto elegido (OID/cuerpo/ACL conservados), sin DROP CASCADE, stubs o cambios a predecesoras, y exigen ese rechazo nominal específico antes de otros pins.

**P2-R15, registro y motivo separados.** C sigue siendo conexión nueva, sin precargar dtd.audit_reason; se exige y conserva NULL crudo antes de la primera RPC. La evidencia guarda beforeRaw/afterRaw y clasificación explícita SQL_NULL/EMPTY_STRING/OTHER_VALUE, sin convertir ninguno en otro. Después de RPC/COMMIT se exige ausencia semántica de motivo (NULL o cadena vacía), no identidad de ausencia registral; se comprueba un evento D2 confirmado sin motivo filtrado. No se rediseñó SQL de producto para el test. Restauración exacta del contexto previamente vacío/no vacío, excepción y anidación y los demás oráculos de auditoría/rollback permanecen intactos.

La condición RC de i3_invoice_guard ya escrita en cfa queda adoptada para DELETE, cambio de id/tenant/deleted_at y transición a anulada de cualquier invoice alcanzada, antes de consultar asientos. No se describe como restricción exclusiva de RPC ni se modifica su cuerpo. Manual físico de journal y CASCADE RC/RR se conservan; padre ausente sólo admite DELETE de línea.

Límites nativos pendientes: R17 sólo construye un deadlock de mutex y **no acredita rollback financiero tras escrituras**; **no hay carrera de cobro concurrente acreditada**. La fuente exige las dos direcciones anulación↔par y hay mutante de anulada con original→reverso, pero **falta un oráculo ordinario independiente de COMMIT real para esa dirección**, equivalente a R11 en la otra. No transferir cobertura de reverso sin transición hacia el sentido inverso. Son pendientes globales, sin absolución definitiva de alcance y sin nuevas pruebas añadidas aquí para resolverlos. UI/B1 del bloqueo de ventas automáticas sin par continúa pendiente.

Conteo por lectura: wrapper completo **53 casos previstos**, no discovery:40 de cfa conservados +4 defaults de auditoría +9 dependencias nominales. Quince funcionales heredados conservan repin sólo de su función TEST; veinte M9 anteriores y los trece negativos añadidos preservan pins de cuerpo. Los18 grupos SQL y18 de carrera siguen autorados, sin aserciones ejecutadas inventadas. No se afirma detección de mutantes, PGlite operativo o catálogo instalado.

Selección y READYV2 concretos quedan UNBOUND sobre la hija, Node bundled/perfil-r3/whitelist26 por metadatos existentes, lectura JSON DateKindString/ISO UTC inequívoco, capturas stdout/stderr/JSON originales, LASTEXITCODE inmediato, salida nativa antes del cierre Git y cotejo exterior con exits individuales.900s de trabajo+60s de cierre/posible CtrlC880 son propuesta sin GO, reloj, turno o recursos iniciados. PG17 real conserva selección/receta/GO separados; esta preparación no inicia su bloque ni reutiliza bindings/outputs/relojes anteriores.

Producto SQL y las pruebas de esta hija: **NO EJECUTADOS**. Sólo guard propio/Git/lectura/hash/diff-check y commit local selectivo permitidos, con recibo externo de resultados. No push/PRedit/runtime/SQL/DB/Docker/PNPM/AST/import/discovery/tipos/lint/build/verify/censo/supervisor/conocimiento. T02/IP78 y T04/I3-A79 siguen evidencia de46e5; M1/UNKNOWN y originales permanecen intactos. Pendientes13 iniciales,27 otros nuevosI2, SQL/catálogos/carreras/cierre canónico y14/A-B abiertos. Documentación guardada en spec/handoff propios; integración/Graphify/Archify/semántica/Obsidian y revisiones automáticas NO EJECUTADAS.

## I3-B · captura R15 posterior al wrapper53 — adopción 2026-10-22

Adoptado íntegramente antes de editar SQL el encargo 0573-I3B-R15-captura-encargo-director.md, 7381 bytes/SHA256 78fb81db46c316a2378c57665e32b98db282178b69b553cb685e7b07179475d0. Mismo Worker/owner worker-0573core-01a15a4e-ddf0-7d82-8656-d9dc56b58468, worktree y rama propios; claim212/B4 retenido. Padre obligatorio 892130032401f2e99f969d3740a23aa9fc8e5c70, árbol a1e17769aed5fc758c2cbcdb7b230aca2a6f5e0d. Preimágenes de las ocho fuentes de892 guardadas en el paquete externo 0573-I3B-fuente-preparacion-03 antes de esta adopción.

Escritura exclusiva de esta hija: supabase/tests/0497_reverso_al_anular_factura_carrera.test.sql, esta spec y el handoff propio. Se autoriza añadir cuatro NOTICE estructurados con la etapa y sólo observaciones realmente alcanzadas: NULL inicial, resultado RPC antes de afirmar posted/COMMIT, crudos después del COMMIT y auditoría D2 antes de su aserción. Una sola SET LOCAL client_min_messages = notice inmediatamente después del BEGIN del coordinador desechable; no se cambia dtd.audit_reason ni configuración de C/A/B/S. Consultas, aserciones, orden, tabla temporal, cleanup y contextos vacío/no vacío/excepción/anidación se conservan. Las otras cinco fuentes y los23 inputs wrapper deben seguir literales.

Resultado histórico nuevo: wrapper completo53 PASÓ sobre892, no sobre esta hija:53 nombres únicos/53 líneas stdout,0 fallos/pending/todo/omisiones; una corrida78.6106419s, exit nativo0/shell0/session3622. Recibo Worker cd9abf12123e57ef42175ed05b6eb1ca17fa945a07356a53c198a0d69293330f y custodia20sellos/0diferencias ad5d5b348bb7b1ae050b895a05c5e97c292250d1026cfce8fbf1ca57803d695b. Dictamen Director64820/SHA43752ec3667579e8267404f37374e48697ed9e1eb9aa4beefd92e9dedea9726b; cierre exterior3695/SHA5f4be16dd1e1a9d8e2964cf43ea9129de060f7885dd50a093b4cb99deb88e0b5 a04:09:53.5370929Z, cuatro exits0/claim212B4. Turno wrapper devuelto formalmente por Worker y Director.

Esta fase es sólo fuente local y propuesta PG17 UNBOUND externa. PostgreSQL real/dblink/carreras/capturas NOTICE y toda nueva corrida siguen NO EJECUTADOS. No hay turno pesado, reloj, contenedor, instalación o publicación autorizados. T02/IP78 y T04/I3-A79 conservan su fuente46e5 y límites; M1 y sus UNKNOWN históricos permanecen intactos.

### Entrega de fuente: captura R15 por observaciones alcanzadas

Se añadieron únicamente cuatro RAISE NOTICE con etiqueta I3B_R15_RAW_CONTEXT y JSON, antes de cada aserción correspondiente: initial_before_first_call conserva beforeRaw y SQL_NULL/EMPTY_STRING/OTHER_VALUE; rpc_result_before_posted_assert conserva rpcRaw sin acreditar COMMIT; after_commit_before_semantic_assert conserva ambos crudos/representaciones y registryIdentityRestorationClaimed=false; audit_before_assert conserva auditRaw antes de comprobar D2 y antes del UPDATE temporal. Ninguna emisión inventa una etapa o resultado no alcanzados. La tabla temporal y su SELECT final siguen presentes como evidencia adicional.

Único ajuste de cliente: SET LOCAL client_min_messages = notice inmediatamente después del BEGIN del coordinador desechable. No se añadió ajuste en C/A/B/S, no se precargó dtd.audit_reason y no se alteró configuración persistente. Se preservan literalmente todas las consultas, aserciones, orden, COMMIT/ROLLBACK, escenarios de contexto vacío/no vacío, excepción22023, anidación y cleanup. La inversión de las cinco inserciones reconstruye los39832bytes/SHA729c55681edf5294583a794e017e9d4ec91b927a12e8766419c24f08ee0f4e33 de892. Las otras cinco fuentes y23inputs wrapper son idénticos a892 por bytes/SHA/blobs; no se repitió el wrapper sobre la hija.

Paquete externo03: ocho preimágenes de892 y ocho fuentes finales, diff completo, manifest/árbol, guard/commits/sellos y propuesta-PG17-UNBOUND-worker.json con receta descriptiva. La propuesta separa el contrato SQL secuencial y R01–R18 con A/B concurrentes, S y C propias; imagen local postgres:17 por ImageID atribuido al General, sin fingir RepoDigest, pullnever/networknone/sin puertos/mountRO y recursos sintéticos nuevos. Versión real, disponibilidad dblink, ausencia de roles/DB/objetos previos, ejecutor, presupuesto, ventana y cleanup exterior requieren revisión y GO separado; nada se inició.

Clasificación de evidencia: cumplimiento de alcance y conservación acreditado por lectura/inversión/guard/Git; cambios UI/componentes y publicación no aplican a esta fixture; runtime PG17/dblink/carreras/NOTICE de esta hija NO EJECUTADO, disponibilidad funcional nativa NO DISPONIBLE. El PASÓ53 sobre892 acredita sólo ese wrapper/PGlite. R17 no demuestra rollback financiero posterior a escrituras; cobro concurrente y COMMIT ordinario independiente anulada+original→reverso siguen pendientes, sin transferir evidencia desde la dirección opuesta. UI/B1,13iniciales,27otros nuevosI2,14/A-B y cierre canónico abiertos.

Impacto documental guardado sólo en spec/handoff propios. Verificación automática/UI/AST/tipos/lint/build/verify/SQLreal/DB/Docker/conocimiento/Graphify/Archify/semántica/Obsidian NO EJECUTADOS por esta asignación sólo de fuente. Integración y publicación pendientes; claim retenido y entrega local para revisión del Director/General.
