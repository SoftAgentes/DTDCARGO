# Handoff 0508 · El objeto de un documento se firma y se borra en el bucket que dice su fila

- Fecha: 2026-10-14 01:20Z → 02:20Z (2026-10-13 noche, Caracas). Estado: **app y pruebas
  listas; sin migración**. PR contra `main`, sin merge.
- Owner/sesión: `claude-keen-swirles-62b904` (Claude Opus 5.5, Worker). Sesión de la app:
  «Corregir bucket_id de adjuntos de Bitácora». No había Director activo (ListAgents ~02:00Z);
  hice la coordinación de esta tarea según la skill Worker.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO/.claude/worktrees/keen-swirles-62b904`
  (lo creó la app de Claude). `guard` OK, sin claim previo; reclamé con
  `harness-worktree.mjs claim --owner claude-keen-swirles-62b904` y revalidé con `guard --owner`
  antes de cada commit.
- Rama: `claude/keen-liskov-c47c81` (nombre de la app), desde `origin/main` = `221c48f4`.
- SDD: [0508](../../docs/specs/0508-documentos-bucket-bitacora/spec.md), reservada con
  `node scripts/next-number.mjs --reserve documentos-bucket-bitacora` (rama
  `codex/sdd-reserve-0508-documentos-bucket-bitacora`, commit `1fda890c`, **local, sin push**).
  El inventario de ese momento: spec siguiente 0508, migración siguiente 0474 (0506 y 0507 ya
  tomadas por las sesiones de Bitácora y de adjuntos visibles).
- Permisos del encargo (Sam): rama y worktree propios, SDD reservado, **PR al final, sin merge**.
  Cualquier migración no se aplica sin OK nominal (esta tarea no tiene migración).

## OBJETIVO ORIGINAL

La SDD-0506 (PR #199, migración 0473 sin aplicar) va a permitir que la «Prueba de avance» de
Bitácora cree filas `documents` con `entity_type='bitacora_task'`. Esas filas nacen con
`bucket_id='documents'` (default de 0307) aunque el objeto vive en `bitacora`, y
`deleteDocument` del hub borra en `DOCUMENTS_BUCKET`: el objeto quedaría huérfano. Pedido:
1) confirmar leyendo el código; 2) cambio mínimo en la app (la acción envía
`bucket_id: 'bitacora'`; el borrado del hub y cualquier consumidor que borre o firme por
`storage_path` usa el `bucket_id` de la fila) con pruebas unitarias; 3) evaluar restricción o
backfill en la base; 4) cierre por el diff y handoff.

## COMPLETADO

### 1. Confirmado leyendo el código (`main` = `221c48f4`)

- `registerTaskAttachmentAction` (`app/studio/(app)/bitacora/collab-actions.ts`) insertaba sin
  `bucket_id`. La columna es `text not null default 'documents'` (0307, con índice único
  `(bucket_id, object_key)`).
- `deleteDocument` (`app/studio/(app)/documentos/actions.ts`): soft-delete y
  `storage.from(DOCUMENTS_BUCKET).remove([doc.storage_path])`. Ningún botón la ofrece hoy para un
  `bitacora_task` (`DocsPanel` solo se monta en clientes y embarques), pero es una server action
  invocable con cualquier id.
- **Segundo consumidor**: `signDocumentUrl(storagePath)` firmaba siempre en `documents`. El hub
  lista los `bitacora_task` y su «Historial» (`VersionHistoryDrawer`) la llama: el «Ver» de un
  adjunto de Bitácora no abría nada.
- **Tercer consumidor**: la galería (`listTaskAttachmentsAction`) y el borrado de la tarea
  (`deleteTaskAttachmentAction`) usaban `BITACORA_BUCKET` fijo. El tipo de entidad no decide el
  bucket: `uploadDocument`/`addDocumentVersion` del hub (y la RPC `add_document_version` de 0116)
  aceptan `bitacora_task` y guardan en `documents` con el mismo formato de path.
- `bitacora-purge-orphans` no toca adjuntos de tarea. `shipment_documents` es otra tabla con otro
  bucket (no afectada). `scripts/attachments-pilot-worker.mjs` ya usa `document.bucket_id`.
- Grants de `documents` para `authenticated` son de tabla (0097; 0394 solo quitó DELETE): enviar
  `bucket_id` en el INSERT no choca con ningún grant por columna, trigger ni policy (ninguna
  migración posterior a 0309 menciona `documents.bucket_id`).

### 2. Cambio en la app

- **Nuevo** `lib/studio/documents/object-bucket.ts` → `documentObjectBucket(row)`: `documents` →
  `documents`; `bitacora` → `bitacora` solo si la fila es `bitacora_task` y el path es de la
  carpeta de su tarea en su tenant (`isValidTaskAttachmentPath`; el bucket también guarda audios
  de actas); cualquier otro valor (incluido `erp-attachments`, cuyo download exige
  `scan_status='clean'`) → `null`, no se firma ni se borra.
- `registerTaskAttachmentAction` envía `bucket_id: BITACORA_BUCKET`.
- `deleteDocument` pide `tenant_id, bucket_id` y borra en el bucket resuelto.
- `signDocumentUrl(documentId)`: por id de fila (RLS + `deleted_at is null`), en el bucket
  resuelto. `DocsPanel` y el «Historial» pasan `doc.id`/`v.id`. Sigue en la DEUDA de
  `rbac-actions-guard.test.ts` (sin candado de módulo); actualicé su texto.
- Galería y borrado de la tarea usan el bucket de la fila; `COLUMNS` de
  `lib/studio/documents/queries.ts` y `DocumentRow` suman `bucket_id`.

### 3. Base de datos: sin migración (evaluado)

- **Backfill: no aplica.** 0 filas `bitacora_task` en producción (dato de Sam; la 0506 midió 0 en
  Cloud) y no pueden crearse hasta aplicar la 0473 (el trigger las rechaza).
- **Restricción: no.** `bitacora_task ⇒ bitacora` sería falsa (el hub guarda `bitacora_task` en
  `documents`). `bitacora ⇒ bitacora_task` es válida, pero el resolvedor ya la exige donde se
  actúa sobre el objeto; queda como propuesta.
- **Orden**: desplegar esta PR **antes** de aplicar la 0473. Si no, la spec trae la consulta de
  lectura y el `update` de contingencia (filtran por existencia real del objeto en
  `storage.objects`).

## VALIDACIÓN

Cierre elegido por el diff: código de producto (`app/`, `lib/`) + pruebas + spec. **No corrí
`pnpm verify` completo**: no había Director para dar turno y otra sesión Worker (SDD-0507) estaba
ocupada en la máquina (CPU 37 %, 10 GB libres). Corrí los pasos que el diff puede afectar.

| Comprobación | Resultado | Evidencia |
|---|---|---|
| Pruebas nuevas (3 archivos) | PASÓ | 27/27 |
| Control rojo (acciones de `main`, pruebas nuevas) | PASÓ (rojo esperado) | 12 de 27 caen, cada una en su aserción; archivos restaurados con el mismo sha256 |
| Mutantes (7) | PASÓ | 7/7 muertos: COLUMNS sin `bucket_id`, `deleteDocument` sin `bucket_id`, borrado de tarea sin `tenant_id`, resolvedor sin entidad, resolvedor sin carpeta, `signDocumentUrl` sin `deleted_at`, registro sin `bucket_id` |
| Suites afectadas (documents, documentos, bitacora, `_components/documents`, `lib/studio/bitacora`, rbac guard, portal signed docs, `app/m/erp`) | PASÓ | 28 archivos, 780 pruebas |
| typecheck (`tsc --noEmit` completo) | PASÓ | exit 0, sin salida |
| eslint de los 13 archivos tocados | PASÓ | exit 0, 0 warnings |
| docs:check | PASÓ | índice sincronizado con 492 specs |
| numbering (`sdd:check`) | PASÓ | sin números repetidos |
| governance:check | PASÓ | 28 políticas · cápsula vigente |
| components:check | PASÓ | CMP-01 válido |
| `git diff --check` | PASÓ | exit 0 |
| `pnpm verify` completo (test, lint, build, e2e, rsc-boundary, sql-tests…) | NO EJECUTADO | Corrida pesada: pide turno al Director. Sin migraciones ni SQL en el diff |
| Smoke en el servidor | NO EJECUTADO | Depende de desplegar esta PR y de aplicar la 0473 (spec, aceptación 7) |

## COMMITS

- `c9b9257d` docs: SDD-0508 spec — el objeto de un documento se firma y se borra en el bucket que dice su fila
- `732f9f85` fix(studio): SDD-0508 — el objeto de un documento se firma y se borra en el bucket de su fila
- (este handoff) docs: SDD-0508 handoff

## PR / BRANCH

- Rama `claude/keen-liskov-c47c81` → PR contra `main` (el enlace va en el reporte de cierre). No es
  draft: sin migración; lo que falta es `verify` completo con turno y el smoke posterior.

## PENDIENTES DE ESTA TAREA

1. `pnpm verify` completo cuando el Director dé turno (o el CI de quality de la PR como evidencia).
2. **Orden de despliegue**: esta PR antes de aplicar la 0473. Si la 0473 se aplica antes, correr la
   consulta READ ONLY de la spec y, si da > 0, el `update` de contingencia con OK nominal de Sam.
3. Smoke tras desplegar y aplicar la 0473 (spec, aceptación 7): subir foto, verla en la galería y en
   el «Historial» del hub, quitarla desde el hub; leer `bucket_id='bitacora'`, `deleted_at` y que el
   objeto ya no esté en `bitacora`.
4. Estado de la SDD-0508 a `done` solo con el smoke hecho.

## FUERA DE ALCANCE DETECTADO

1. **SDD-0507 (adjuntos visibles, sesión activa)** fija `bucket: "documents"` para filas de
   `documents` en `lib/studio/documents/adjuntos-queries.ts` (`desdeHub`) y firma con un bucket que
   manda el cliente (`firmarAdjuntoAction(bucket, storagePath)`). Hoy acierta: solo lista clientes y
   embarques, que solo sube el hub. Cuando ambas estén en `main`, conviene que use
   `documentObjectBucket`. Mi prueba de propiedad no la marca (usa `storagePath` y un bucket
   variable). Ambas PR editan `lib/studio/rbac-actions-guard.test.ts` en hunks distintos (yo el
   texto de la DEUDA, ella los totales): debería fusionar sin conflicto; si `main` se mueve,
   `docs/specs/README.md` se regenera con el script.
2. Las specs 0049, 0060 y 0500 describen el `signDocumentUrl` por path. Evidencia fechada; no las
   reescribí.
3. Propuesta (no decisión): `check (bucket_id <> 'bitacora' or entity_type = 'bitacora_task')` en
   `documents`, si algún día se quiere el invariante en la base además de en la app.

## IMPACTO DOCUMENTAL Y CONOCIMIENTO

- Documento canónico nuevo: la spec SDD-0508 (+ índice regenerado). Ningún runbook ni AGENTS cambió.
- `pnpm knowledge:status`: `structural INVALID` (4481 pendientes, 3306 ausentes), `semantic INVALID`
  (1175), `archify PENDING`, `obsidian PENDING`, en todo el repo: este worktree no tiene grafo
  construido. No lo causa este diff. Graphify se publica desde main integrado (Director). Recibos
  semánticos: no aplica (no toqué fuentes de `semanticPilot` que haya podido verificar).
- Archify: **NO DISPONIBLE** — `knowledge:visual` → `ARCHIFY_RUNTIME_MISSING` (falta `archify.zip`
  v2.16.0 en `graphify-out/archify-package`; descargarlo requiere permiso). Preview de Obsidian: no
  generada.

## HANDOFF AL DIRECTOR

- Revisar la PR (SHA de cabeza en el reporte). Sin migración: el merge despliega solo código.
- **Integrar antes de aplicar la 0473** (PR #199). Sugiero sumar esa condición a la espera de la
  0473 en `pendingBelowCutoff` dentro de la PR #199 (archivo de otra tarea: no lo toqué).
- Coordinar el orden con la SDD-0507 (ver FUERA DE ALCANCE 1).
- La rama de reserva `codex/sdd-reserve-0508-documentos-bucket-bitacora` es local y sin push. Se
  borra con `-D` cuando la spec esté en main.
