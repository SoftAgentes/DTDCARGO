# SDD-0507 — Adjuntos visibles en el Studio (listados y ficha del cliente)

- **Owner**: Worker Claude, claim `claude-adjuntos-visibles-20261013` (sesión
  «Mostrar adjuntos en listas de clientes y embarques»)
- **Worktree**: `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\adjuntos-visibles-studio-20261013`
- **Rama**: `codex/adjuntos-visibles-studio-20261013`, creada con
  `harness-worktree start` desde `origin/main` `221c48f4`.
- **SDD**: 0507, `docs/specs/0507-adjuntos-visibles-studio/spec.md`, estado
  `in-progress`. Reserva local `codex/sdd-reserve-0507-adjuntos-visibles-studio`
  (`32e4b66e`), incorporada por fast-forward.
- **Migración**: ninguna.
- **Fechas**: 2026-10-14 UTC (2026-10-13 en Caracas).
- **Estado de la tarea**: lista-para-revision. Falta el smoke en producción
  después del merge y del deploy, que autoriza Sam.

## Por qué este worktree y no el que asignó la app

La app abrió la sesión en `.claude/worktrees/modest-chaplygin-c2cdee` (rama
`claude/dreamy-kare-8ccfdb`). Ese árbol tiene un claim ajeno vigente:
`festive-ellis-03485b`, del 2026-09-21. Un claim ajeno no se roba ni vence por
tiempo, así que se creó aislamiento propio con el harness. El árbol de la app
quedó intacto.

## OBJETIVO ORIGINAL

Pedido de Sam del 2026-10-14, literal:

> «que cuando un cliente tiene algún adjunto, salga algo que se vean todos los
> adjuntos. Igual un embarque, que se vea visible si tiene adjuntos o no tiene»

1. Señal por fila, con cuántos, en Clientes y en Embarques/Tracking. Sin cargar
   archivos y respetando RLS y tenant.
2. En la ficha del cliente, «Todos los adjuntos»: cliente y embarques, con tipo,
   fecha, tamaño, embarque de origen y «Ver».
3. Opcional, si Sam lo aprueba: filtro «con / sin adjuntos».

## Decisiones de Sam (2026-10-14, AskUserQuestion)

Aprobó el mockup (<https://claude.ai/artifact/SkR6QtFSXCLdaQcwGTCsVx>). Fuentes:
«Lo que muestran las fichas». Filtro: «En Embarques y Tracking». SDD-0506: «No, es
otra cosa». Las respuestas literales están en la spec.

## COMPLETADO

- `lib/studio/documents/adjuntos.ts` (puro): conteos, desgloses, filtro,
  agrupación y validación de rutas para «Ver».
- `lib/studio/documents/adjuntos-queries.ts`: una sola definición de «adjunto
  vivo» para los tres listados y la ficha. Se calcula con el cliente de sesión,
  en lotes de 100 ids, con paginación completa, y devuelve `null` si algo falla.
- `app/studio/(app)/clientes/adjuntos-actions.ts`: `firmarAdjuntoAction` con
  gate de vista `clients` (y `tracking` para lo de un embarque) y ruta validada.
  Firma 60 s con el cliente de sesión.
- `AdjuntosConteo`: el indicador. Columna en Clientes y Embarques, línea en
  Tracking, y filtro en Embarques y Tracking.
- `TodosLosAdjuntos` y el enlace de la cabecera en la ficha del cliente.
- Rótulo «Documentos del embarque · los ve el cliente» en el detalle del envío.
- Ajustes del `/ui-check`: `h2` en el título de la sección y escala de 4 px.

Criterios de la SDD (§«Criterios de aceptación»):

| # | Criterio | Estado | Evidencia |
|---|---|---|---|
| 1 | Una sola definición | CUMPLIDO | `adjuntos-queries.test.ts`, «una sola definición»: 40 clientes generados con PRNG fijo, tope de servidor 7. Fila = sección, y además ficha y portal por separado |
| 2 | El doble filtra de verdad | CUMPLIDO | 9 mutantes (`is_current`, los tres `deleted_at`, `entity_type`, lotes de 500, incompleto como completo, error como cero, sin `.in(entity_id)`): los 9 mueren, control verde |
| 3 | Sin truncar | CUMPLIDO | 2.500 documentos con tope de 1000 y de 300. Con 61 filas y tope 1, `null` |
| 4 | Lo que la RLS oculta no se cuenta | CUMPLIDO | Simulación de rol sin `tracking`: conteo y sección bajan a 2. Las lecturas reciben el cliente que les pasan y las páginas les pasan `createClient()` (sesión) |
| 5 | Fallo honesto | CUMPLIDO | `null` en las tres fuentes. Clientes, Embarques y Tracking dicen «No se pudieron contar los adjuntos.» y no pintan «Ninguno»; 3 mutantes de la UI de Clientes mueren |
| 6 | Indicador accesible | CUMPLIDO | `AdjuntosConteo.test.tsx`: «5 adjuntos», «1 adjunto», «Ninguno» y el icono `aria-hidden` |
| 7 | Ver | CUMPLIDO | `adjuntos-actions.test.ts` (8 pruebas; 3 mutantes de candados mueren). `rbac-actions-guard.test.ts` la acepta sin listas |
| 8 | Rótulo | CUMPLIDO, sin prueba propia | Cambio de texto en `ShipmentDocsPanel.tsx:82-84`; ningún test ni e2e fijaba el texto viejo (grep) |
| 9 | Filtro | CUMPLIDO | `EmbarquesClient.adjuntos.test.tsx` (con búsqueda incluida) y `ActiveShipmentList.adjuntos.test.tsx` |
| 10 | `pnpm verify` | 16/17 sin fallos | Ver VALIDACIÓN: `migrations-applied` no se midió (SKIP) y hay una brecha documentada entre el SHA verificado y la punta |

## VALIDACIÓN

`pnpm verify` completo sobre **`c9fa11ef`**, de 02:03 a 02:21 UTC, con la máquina
libre. No había Director activo: se avisó a la sesión de la SDD-0508, que
confirmó que no tenía corridas pesadas. Veredicto: **16 de 17 pasos medidos, 0
fallos**, `VERIFY_EXIT=0` y «CIERRE INCOMPLETO — CRÍTICOS SIN MEDIR:
migrations-applied».

| Paso | Resultado |
|---|---|
| harness, lint, rsc-boundary, typecheck, edge-functions (4), docs:check, numbering, feature-constants (5), components:check, governance:check | PASÓ |
| test (Vitest) | PASÓ: 680 archivos, 9184 pruebas pasadas, 1 omitida |
| pending-migration-symbols | PASÓ: 0 ROJO · 0 AMARILLO |
| sql-tests | PASÓ: 225 contratos, rollback total |
| schema-rebuild | PASÓ: 450 migraciones desde cero sobre postgres:17 |
| e2e | PASÓ: 177 pasadas, 20 omitidas por la suite |
| build | PASÓ |
| migrations-applied | NO DISPONIBLE: SKIP, el worktree no tiene `.env.local`. La tarea no trae migración |

**Brecha entre el SHA verificado y la punta.** Después de `c9fa11ef` entraron:
(a) la fusión de `origin/main` `8824a9ac` (PR #199, SDD-0506), en `3dd753e3`. Toca
archivos disjuntos de los míos salvo el índice `docs/specs/README.md`, que
resolvió el driver de registros generados; trae una migración (0473) y sus
pruebas, ya aplicadas y verificadas por su propia tarea. (b) Un commit de texto
en la spec y este handoff. Después de la fusión se corrieron, livianas (la
SDD-0508 tenía el turno del verify): `docs:check`, `sdd:check` y las 8 suites de
la 0507 más `rbac-actions-guard`. El resultado está en la bitácora. **No** se
repitió el verify completo sobre la punta.

Otras pruebas propias: 15 mutantes en total, todos muertos con control verde;
`/ui-check` OK con ajustes menores, los tres aplicados; anchos fijos medidos
con las fuentes reales del repo (peor celda 61,8 px en una columna de 96 px).

**Smoke visual en el Studio real:** NO EJECUTADO. El worktree no tiene
credenciales y no se copian a propósito. El guion está abajo.

## COMMITS

- `32e4b66e` chore(sdd): reserva SDD-0507 (stub)
- `8365db4b` docs(studio): propuesta (SDD + handoff inicial)
- `9a8fbf74` docs(studio): decisiones de Sam y diseño aprobado
- `fa3388ee` feat(studio): conteo y lista de adjuntos con una sola definición
- `3bd69636` feat(studio): «Ver» con candado de vista y ruta validada
- `2007b849` feat(studio): indicador por fila en Clientes, Embarques y Tracking
- `48b22239` feat(studio): «Todos los adjuntos» en la ficha del cliente
- `c9fa11ef` fix(studio): ajustes del ui-check (SHA del verify)
- `3dd753e3` merge de `origin/main` `8824a9ac` (PR #199)
- El commit que contiene este documento: corrección de la premisa de migraciones
  en la spec y el cierre del handoff.

## PR / BRANCH

Rama `codex/adjuntos-visibles-studio-20261013`, base `main`. La PR se abre
después de este commit, en draft no: la validación está completa salvo lo que
dice VALIDACIÓN. Su URL va en el reporte final y en la descripción de la PR.
Sin merge (permiso del encargo: «PR al final, sin merge»).

## PENDIENTES DE ESTA TAREA

1. **Revisión y merge** de la PR: decide el Director o Sam. Merge a main
   despliega.
2. **Smoke en producción** con el guion de abajo, después del deploy.
3. **Verify sobre la punta**, si el Director lo pide: la brecha está descrita en
   VALIDACIÓN.
4. **Con la PR #200 (SDD-0508) en main:** pasar `desdeHub`
   (`lib/studio/documents/adjuntos-queries.ts`) a `documentObjectBucket` de
   `lib/studio/documents/object-bucket.ts`, en vez de fijar `"documents"`. Hoy
   no cambia el comportamiento: `firmarAdjuntoAction` rechaza cualquier otro
   bucket con «No se pudo abrir el archivo». Aviso de la sesión de la 0508,
   respondido.
5. **Conocimiento:** impacto documental en la spec nueva y este handoff. En el
   worktree, `knowledge:status` da structural/semantic INVALID y
   archify/obsidian PENDING porque el worktree es nuevo y nunca generó
   `graphify-out` (lista todo el repo como pendiente, no sólo esta tarea). No se
   corrió Graphify para no competir con el verify de la 0508. La publicación
   (Graphify, Archify, Obsidian) la hace el Director desde main integrado.

### Guion de smoke en producción (después del deploy)

Con una cuenta admin del Studio:

1. **Clientes** (`/studio/clientes`): debe aparecer la columna «Adjuntos» entre
   «Tier» y «Contacto». Elige un cliente que sepas que tiene un RIF subido o un
   BL en un envío: su fila muestra un número y, con el cursor encima, el
   desglose. Un cliente sin nada dice «Ninguno». Abajo **no** debe aparecer «No
   se pudieron contar los adjuntos.».
2. Entra a ese cliente. Junto al nombre debe estar «N adjuntos · ver todos», con
   el mismo N de la fila. Tócalo: baja a «Todos los adjuntos». Comprueba que los
   grupos sumen N y toca «Ver» en un documento «Interno» y en uno «Portal».
   Los dos tienen que abrirse en una pestaña nueva.
3. **Embarques** (`/studio/embarques`): la columna «Adjuntos» aparece antes de
   «Creado». En el filtro «Adjuntos», «Con adjuntos» deja sólo filas con número
   y «Sin adjuntos» sólo filas con «Ninguno».
4. **Tracking** (`/studio/tracking`): cada tarjeta dice «N adjuntos» o «Sin
   adjuntos», y el filtro bajo el buscador hace lo mismo que en Embarques.
5. **Detalle de un envío**: el panel del portal dice «Documentos del embarque ·
   los ve el cliente».

Señal de falla: «No se pudieron contar los adjuntos.» o «No se pudieron cargar
los adjuntos.» indican un error de lectura. Mira los logs del contenedor de la
app; desde aquí no se registra ningún nombre de archivo.

## FUERA DE ALCANCE DETECTADO

- Clientes, Embarques, Tracking y el historial de envíos de la ficha listan
  registros eliminados: desde la 0230 la RLS no filtra `deleted_at` y esas
  consultas tampoco. Quedó como tarea aparte (chip «Ocultar eliminados en
  listados del Studio»).
- `IDS_POR_LOTE = 500` en `lib/db/paginate.ts` arma URLs de unos 19 KB. **NO
  VERIFICADO** si el Kong del servidor propio las corta. La 0507 usa 100.
- `addDocumentVersion` (`documentos/actions.ts:175-277`) no tiene gate de
  módulo.
- `DOCUMENT_ENTITY_TYPES` no incluye `expense` (está en la base desde la 0314).
- `EXT_META` marca el PDF con tono `danger`, en contra de la semántica de la
  SDD-0441. Se reusa tal cual para no divergir de `DocsPanel`.

## HANDOFF AL DIRECTOR

- **Siguiente acción:** revisar la PR. El diff de producto vive en
  `lib/studio/documents/adjuntos*.ts`, `app/studio/_components/documents/AdjuntosConteo.tsx`,
  `app/studio/(app)/clientes/{adjuntos-actions.ts,page.tsx,[markbox]/page.tsx,_components/*}`,
  `embarques/*` y `tracking/{page.tsx,_components/ActiveShipmentList.tsx,[id]/_components/ShipmentDocsPanel.tsx}`.
- **Compartido con otras PR:** `lib/studio/rbac-actions-guard.test.ts`. La 0507
  toca el comentario y los totales (74 archivos y 428 acciones); la PR #200
  (SDD-0508) toca la entrada `DEUDA` de `signDocumentUrl`. Partes distintas.
  Si otra PR suma un archivo de acciones, el total se recalcula al fusionar.
- **Sin migración ni escrituras en producción.** No se leyó ninguna fila de
  producción.
- **Sesiones consumidoras:** ninguna. El worktree queda con el claim liberado y
  no se borra (tampoco la rama ni la reserva).
- **Sin push de la reserva** `codex/sdd-reserve-0507-adjuntos-visibles-studio`:
  la spec viaja en la rama de trabajo. La reserva local se puede borrar con
  `-D` cuando la spec esté en main (memoria «Borrar reservas de SDD
  cumplidas»), con autorización aparte.

## Bitácora

- 2026-10-14 01:00 UTC: guard OK, claim ajeno detectado, worktree propio,
  `pnpm install --frozen-lockfile` OK, SDD-0507 reservada.
- Mapa del dominio (subagente Explore, citas revisadas a mano), diseño en la
  SDD y mockup publicado. Sam aprobó las cuatro recomendaciones.
- Implementación en cinco commits de producto. Mutantes: 9 de las lecturas, 3 de
  la acción y 3 de la UI de Clientes, todos muertos con control verde. Los 6
  últimos se repitieron: la primera corrida daba muertes falsas (exit 255,
  vitest no arrancaba por `(app)` sin comillas).
- `/ui-check`: OK con ajustes menores; los tres aplicados.
- Turno de `pnpm verify`: sin Director activo. Se avisó a la sesión de la
  SDD-0508, que respondió que no tenía corridas pesadas y se puso en cola.
- 02:21 UTC: verify 16/17 sin fallos sobre `c9fa11ef`. Turno devuelto a la
  0508, que lanzó el suyo a las ~02:25 UTC.
- `knowledge:status` mostró que main avanzó (PR #199). Fusión de `origin/main`
  `8824a9ac` en `3dd753e3`: limpia, con el driver del índice. La premisa de la
  spec sobre migraciones se corrigió: la 0473 se aplicó a mano en el servidor
  por orden de Sam.
- Después de la fusión: `git diff --check` limpio, `docs:check` (493 specs) y
  `sdd:check` OK, y las 10 suites de la 0507 más `rbac-actions-guard`: 493
  pruebas pasadas.

## CIERRE (Director, 2026-10-14)

- **Merge.** PR #202, merge `c80eea64` el 2026-10-14 a las 03:08:02Z, con
  `--match-head-commit 0c45112a`. El Director actualizó la rama del lado de
  GitHub con la #201.
- **CI.** «Calidad local sin secretos» PASÓ (14m34s).
- **Deploy.** Vercel, «Deployment has completed» a las 03:10:39Z.
- **Smoke en producción.** Hecho por Sam, PASÓ. Literal: «Aprobado, funcionan
  las cosas de adjuntos.»
- **SDD-0507 → `done`** en la PR de cierre `codex/cierres-noche-20261014`, con
  una sección «Cierre (2026-10-14)» en la spec.
- Pendientes 1 (merge) y 2 (smoke) de arriba: hechos.
- **Pendiente propuesto, no hecho:** que «Ver» de «Todos los adjuntos» tome el
  bucket de la fila con `documentObjectBucket` (pendiente 4 de arriba). Hoy no
  cambia el comportamiento; queda como tarea posterior.
