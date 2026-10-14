# Handoff 0508 · El objeto de un documento se firma y se borra en el bucket que dice su fila

- Fecha: 2026-10-14 01:20Z → 03:10Z (2026-10-13 noche, Caracas). Estado: **app, pruebas y
  migración 0474 listas; 0474 NO APLICADA**. PR [#200](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/200)
  contra `main`, sin merge.
- Owner/sesión: `claude-keen-swirles-62b904` (Claude Opus 5.5, Worker). Sesión de la app:
  «Corregir bucket_id de adjuntos de Bitácora». No había Director activo (ListAgents ~02:00Z);
  hice la coordinación de esta tarea según la skill Worker. Turnos de corrida pesada coordinados
  por mensaje con la sesión de la SDD-0507.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO/.claude/worktrees/keen-swirles-62b904`
  (lo creó la app de Claude). `guard` OK, sin claim previo; reclamé con
  `harness-worktree.mjs claim --owner claude-keen-swirles-62b904` y revalidé con `guard --owner`
  antes de cada commit.
- Rama: `claude/keen-liskov-c47c81` (nombre de la app), desde `origin/main` = `221c48f4`; trae
  `origin/main` = `8824a9ac` (PR #199) en el merge `3e50b182`.
- SDD: [0508](../../docs/specs/0508-documentos-bucket-bitacora/spec.md), reservada con
  `node scripts/next-number.mjs --reserve documentos-bucket-bitacora` (rama
  `codex/sdd-reserve-0508-documentos-bucket-bitacora`, commit `1fda890c`, **local, sin push**).
  Migración 0474: el inventario de refs, PRs y worktrees la dio libre antes de usarla.
- Permisos del encargo (Sam): rama y worktree propios, SDD reservado, **PR al final, sin merge**.
  Ninguna migración se aplica sin OK nominal.
- Autorizaciones de Sam en esta sesión, textuales (respuestas del 2026-10-14 ~02:25Z):
  backfill → «Migración 0474 en la PR (Recommended)»; lectura → «Sí, solo el conteo» (un
  `count(*)` agregado, READ ONLY, sin leer filas). Auto-fix de la PR: «activa el Auto-fix del CI
  de la PR».

## OBJETIVO ORIGINAL

La SDD-0506 (PR #199, migración 0473) permite que la «Prueba de avance» de Bitácora cree filas
`documents` con `entity_type='bitacora_task'`. Esas filas nacen con `bucket_id='documents'`
(default de 0307) aunque el objeto vive en `bitacora`, y `deleteDocument` del hub borra en
`DOCUMENTS_BUCKET`: el objeto quedaría huérfano. Pedido: 1) confirmar leyendo el código;
2) cambio mínimo en la app (la acción envía `bucket_id: 'bitacora'`; el borrado del hub y cualquier
consumidor que borre o firme por `storage_path` usa el `bucket_id` de la fila) con pruebas
unitarias; 3) evaluar restricción o backfill en la base; 4) cierre por el diff y handoff.

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
  `bucket_id` en el INSERT no choca con ningún grant por columna, trigger ni policy.

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

### 3. Base de datos: la premisa cambió a mitad de la tarea → migración 0474

- Mi primera evaluación (0 filas, backfill no aplica, desplegar antes de la 0473) dejó de valer:
  la PR #199 se fusionó y su handoff registra la 0473 **aplicada en el servidor el 2026-10-14 a
  las 01:44:06Z** y el smoke de Sam («ya probé la subida y funciona», ~01:53Z), con la app todavía
  sin el fix.
- **Conteo READ ONLY** (autorizado; 2026-10-14 02:26:44Z; `ssh.exe` del agente de Windows →
  `docker exec -i dtd-cargo-db-1 psql -U postgres -d postgres -X`, `begin transaction read only`
  … `rollback`, solo agregados): `bitacora_task_total` 1, `en_documents` 1, `en_documents_vivas` 1,
  `en_bitacora` 0, `corregibles` 1 (objeto en `bitacora` y no en `documents`). Es la foto del smoke.
- **`supabase/migrations/0474_documents_bitacora_bucket_backfill.sql`** (NUEVA, **NO APLICADA**):
  - `bucket_id` → `'bitacora'` solo para `bitacora_task` cuyo objeto existe en `storage.objects`
    de `bitacora` y no en el de `documents`; incluye borrados lógicos; no toca el resto.
  - Preflight: `documents` con sus columnas, `storage.objects` y la rama `bitacora_task` de la
    0473 en `document_entity_in_tenant` (el trigger de validación revalida la entidad en el
    UPDATE).
  - Postflight: no queda ninguna fila con el mismo filtro.
  - Sin DDL; re-aplicable; `lock_timeout` 5 s, `statement_timeout` 30 s.
  - NOTICE con el número de filas cambiadas. El guardia RBAC no interviene al aplicarla como
    `postgres` (solo actúa con `auth.role()='authenticated'`).
- Identidad del archivo (commit `5e8188e7`): blob `4f901d17ae3f7779cb999272fa17f53bb2bec99b`,
  **5786 bytes, md5 `6f4bb32df48a6e8851c8ced80ca02361`**, sin CRLF. Es lo que se compara con el
  ledger al aplicar.
- Espera declarada en `supabase/migrations-baseline.json › pendingBelowCutoff`, con la condición
  completa: aplicar **después** del deploy de esta PR, OK nominal, de a una, mismo procedimiento
  que la 0473.
- **Restricción: no.** `bitacora_task ⇒ bitacora` sería falsa (el hub guarda `bitacora_task` en
  `documents`). `bitacora ⇒ bitacora_task` es válida, pero el resolvedor ya la exige donde se
  actúa sobre el objeto; queda como propuesta.

## VALIDACIÓN

| Comprobación | Resultado | Evidencia |
|---|---|---|
| Pruebas nuevas de la app (3 archivos) | PASÓ | 27/27 |
| Control rojo de la app (acciones de `main`) | PASÓ (rojo esperado) | 12 de 27 caen, cada una en su aserción; archivos restaurados con el mismo sha256 |
| Mutantes de la app (7) | PASÓ | 7/7 muertos |
| Suites afectadas (documents, documentos, bitacora, `_components/documents`, `lib/studio/bitacora`, rbac guard, portal, `app/m/erp`) | PASÓ | 28 archivos, 780 pruebas |
| **`pnpm verify` completo** sobre `3e50b182` (02:22Z → 02:47Z) | **FALLÓ** (1 de 17) | `test`: un timeout de 20 s en cada intento, en pruebas distintas (`lib/db/__tests__/session-cookie.test.ts`, luego `__tests__/fuentes-locales.test.ts`), ambas de barrido de archivos, con la CPU saturada. 9175/9177 pasaron. El resto: harness, docs, numbering, governance, components, feature-constants, lint, rsc-boundary, typecheck, edge-functions, pending-migration-symbols, sql-tests, schema-rebuild, build y e2e (173 passed, 20 skipped) en [OK]; `migrations-applied` [SKIP] (worktree sin `.env.local`) |
| Las dos pruebas que vencieron, aisladas, mismo SHA | PASÓ | 14/14 en 2,9 s; cada barrido 0,9 s. Ninguno de los dos archivos está en este diff |
| Contrato 0474 en PGlite (Vitest) | PASÓ | 14/14: green 10 aserciones, control rojo en A, 2 preflights, mutante del preflight, 5 mutantes del filtro |
| Contrato 0474 en `postgres:17` (psql real) | PASÓ | 1.ª corrida 2 filas, 2.ª 0; `-v apply_fix=false` cae en A; `sin_rama` y `sin_storage` abortan con su mensaje; 0 tablas tras el ROLLBACK |
| `schema-rebuild` con la 0474 | PASÓ | 470 migraciones (452 desde cero + 18 solo-ledger) sobre `postgres:17` y sobre `supabase/postgres:17.6.1.136`; aislamiento de 219 tablas + 2 tenants |
| Todos los `*migration.test*` (leen el baseline) | PASÓ | 17 archivos, 212 pruebas |
| `scripts/tests/merge-generated-records.node.mjs` | PASÓ | 20/20 (TAP) |
| pending-migration-symbols | PASÓ | 0 ROJO · 0 AMARILLO |
| typecheck, eslint, docs:check, numbering, `git diff --check` | PASÓ | exit 0 |
| `verify` completo después de la 0474 | NO EJECUTADO | Los pasos que la 0474 afecta (sql-tests de su contrato, schema-rebuild, migration tests, símbolos, numeración) se corrieron de a uno arriba. La brecha entre el SHA verificado `3e50b182` y la punta es solo la 0474, sus pruebas, el baseline y docs |
| Smoke en el servidor | NO EJECUTADO | Después del deploy y de aplicar la 0474 (spec, aceptación 10) |

## COMMITS

- `c9b9257d` docs: SDD-0508 spec — el objeto de un documento se firma y se borra en el bucket que dice su fila
- `732f9f85` fix(studio): SDD-0508 — el objeto de un documento se firma y se borra en el bucket de su fila
- `4947f0dc` docs: SDD-0508 handoff
- `3e50b182` merge de `origin/main` (PR #199); índice de specs con el driver y regenerado
- `5e8188e7` fix(studio): SDD-0508 — 0474 corrige el bucket de los adjuntos de Bitácora creados antes del fix
- (este commit) docs: SDD-0508 — la 0473 ya estaba aplicada: spec y handoff con la 0474

## PR / BRANCH

- PR [#200](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/200), rama `claude/keen-liskov-c47c81`
  → `main`. Auto-fix activado por Sam. No es draft: la aplicación de la 0474 es una autorización
  aparte, no validación pendiente.
- **Fusionar la PR despliega la app y NO aplica la 0474.**

## PENDIENTES DE ESTA TAREA

1. Merge de la PR (decisión de Sam o del Director; merge = deploy).
2. **Inmediatamente después del deploy**: repetir el conteo READ ONLY (consulta en la spec) y pedir
   el **OK nominal de Sam para `0474_documents_bitacora_bucket_backfill`**. Aplicarla de a una con el
   procedimiento de la 0473 (psql en el contenedor, migración + fila del ledger en una transacción,
   identidad contra el blob de 5786 bytes / md5 `6f4bb32d…`). El NOTICE debe decir 1 fila (o las que
   dé el conteo); el postflight aborta si queda alguna.
3. Smoke (spec, aceptación 10): la foto del smoke se ve en la galería y en el «Historial» del hub;
   borrar un adjunto de prueba desde el hub deja `deleted_at` y el objeto fuera de `bitacora`.
4. Tras aplicar y verificar: retirar la espera de 0474 del baseline en una PR de limpieza y pasar la
   SDD-0508 a `done`.

## FUERA DE ALCANCE DETECTADO

1. **SDD-0507 (adjuntos visibles)** fija `bucket: "documents"` para filas de `documents` en
   `lib/studio/documents/adjuntos-queries.ts` (`desdeHub`) y firma con su propia acción
   (`firmarAdjuntoAction`, solo `documents` y `shipment-docs`, gates de vista). Hoy acierta: lista
   clientes y embarques, que solo sube el hub. Esa sesión confirmó por mensaje que no usa
   `signDocumentUrl` ni arma `DocumentRow`, y anotó en su handoff pasar a `documentObjectBucket`
   cuando las dos estén en `main`. Ambas PR tocan `lib/studio/rbac-actions-guard.test.ts` en hunks
   distintos.
2. Las specs 0049, 0060 y 0500 describen el `signDocumentUrl` por path. Evidencia fechada; no las
   reescribí.
3. Propuesta (no decisión): `check (bucket_id <> 'bitacora' or entity_type = 'bitacora_task')` en
   `documents`.
4. Las pruebas de barrido de archivos con timeout de 20 s (`session-cookie`, `fuentes-locales`)
   vencen con la máquina saturada. Si se repite, subirles el timeout o acotar el barrido.

## IMPACTO DOCUMENTAL Y CONOCIMIENTO

- Documento canónico nuevo: la spec SDD-0508 (+ índice regenerado). Ningún runbook ni AGENTS cambió;
  la condición de aplicación de la 0474 vive en el baseline y en la cabecera de la migración.
- `pnpm knowledge:status`: `structural INVALID` (4481 pendientes, 3306 ausentes), `semantic INVALID`
  (1175), `archify PENDING`, `obsidian PENDING`, en todo el repo: este worktree no tiene grafo
  construido. No lo causa este diff. Graphify se publica desde main integrado (Director).
- Archify: **NO DISPONIBLE** — `knowledge:visual` → `ARCHIFY_RUNTIME_MISSING`. Preview de Obsidian:
  no generada.

## HANDOFF AL DIRECTOR

- Revisar la PR (SHA de cabeza en el reporte). El merge despliega la app; la 0474 espera el OK.
- Ventana recomendada: merge → deploy verde → conteo READ ONLY → 0474 con OK nominal, sin pausa
  larga entre deploy y migración (en ese intervalo la foto del smoke no se ve en la galería).
- La rama de reserva `codex/sdd-reserve-0508-documentos-bucket-bitacora` es local y sin push. Se
  borra con `-D` cuando la spec esté en main.

## CIERRE (Director, 2026-10-14)

- **Merge.** PR #200, merge `ddf14c06` a las 03:31:43Z, con `--match-head-commit e611ae3f`. CI
  PASÓ (18m14s). Deploy a las 03:33:39Z.
- **OK nominal de Sam**, literal: «OK, aplica la 0474_documents_bitacora_bucket_backfill en el
  servidor propio».
- **Lectura previa READ ONLY, 04:01:13Z.** Ledger de 479 filas, con la última en 0473 y sin 0474;
  la rama `bitacora_task` de la 0473 presente; 1 fila por corregir; 30 conexiones y 0 esperando
  locks.
- **Script.** Generado desde el blob `4f901d17` de `origin/main` `4328f4fa`: md5
  `6f4bb32df48a6e8851c8ced80ca02361`, 5786 bytes. El md5 del script se verificó en el servidor
  (`55b519c003286b8f4dee9cc1907b9c07`) antes de correrlo.
- **Aplicación**, de 04:02:18.561Z a 04:02:18.794Z, en una transacción. Salida: `SET`, `SET`, `DO`,
  `DO` con «NOTICE: 0474: 1 fila(s) bitacora_task pasaron a bucket_id = bitacora», `DO`,
  `INSERT 0 1`, `COMMIT`; psql exit 0.
- **Verificación READ ONLY, 04:02:34Z.** Ledger de 480 filas;
  `20261014040218 · 0474_documents_bitacora_bucket_backfill`, `created_by =
  servidor-propio:psql:SDD-0508`, 1 sentencia, md5 igual al blob, 5786 bytes; 0 filas por corregir;
  `bitacora_task` en `bitacora` 1 y en `documents` 0; 0 esperando locks.
- **Evidencia** en `/srv/ops/evidencias/apply-0474-dtd-cargo-20261014T0402Z/`, con `SHA256SUMS`.
  Supabase Cloud no tiene la 0474.
- **En el repo** (PR de cierre `codex/cierres-noche-20261014`): la espera de la 0474 sale de
  `pendingBelowCutoff`; la prueba de la espera en
  `documents-bitacora-bucket-backfill.migration.test.ts` pasa a afirmar que ya no hay espera y que
  el archivo conserva el md5 y los bytes del ledger; la spec suma «Aplicación de la 0474
  (2026-10-14)». El archivo de la migración no se edita.
- Pendientes de arriba: 1 (merge) y 2 (conteo y 0474) hechos; 4 (retirar la espera) en la PR de
  cierre.
- **Pendiente:** la prueba manual de Sam (pendiente 3 de arriba; criterio 10 de la spec). La
  SDD-0508 sigue `in-progress` hasta entonces.
- **Prueba manual, 2026-10-14: PASÓ.** Sam probó la Bitácora en producción: la foto en la galería y
  en el «Historial», y el borrado de un adjunto de prueba desde el hub. Su texto literal: «Ya probé
  la 0508, funciona la Bitácora». La SDD-0508 pasa a `done`. Estado de la tarea: **integrada**. Sin
  pendientes propios. Lo único que queda es el FUERA DE ALCANCE 1: que «Todos los adjuntos» de la
  0507 tome el bucket de la fila; es propuesta, no tarea de esta SDD.
