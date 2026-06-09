---
sdd: "0060"
title: "Documentos · Versionado — revisiones append-only sobre el Hub DMS (capa 2 de 0049)"
status: done
author: "Claude Code (carril Documentos · Norte v2.4)"
created: 2026-06-05
updated: 2026-06-05
supersedes: null
superseded_by: null
related: ["0049", "0045", "0054"]
confidencialidad: interno
---

# DTD-0060 — Documentos · Versionado

> **Capa 2 de [SDD-0049](../0049-documentos-hub/spec.md).** El Hub DMS (`documents`, polimórfico +
> bucket privado + `<DocsPanel>` embebible + hub `/studio/documentos`) está `done` en V1, pero §8 lo
> dejó explícito: **"Versionado de documentos (V2)"**. El Norte lo pide en el mapa de módulos
> (`HANDOFF.md`: *Documentos · Hub → subida real, preview, OCR, **versionado***). Esta spec agrega
> **revisiones append-only** a un documento ya subido, sin reescribir nada de 0049 (reusa su RLS,
> trigger polimórfico, bucket, signed-URLs y derivación de estado).

## 1. Resumen en una línea

Una **cadena de versiones** dentro de la misma tabla `documents` (`root_id` + `version_no` +
`supersedes_id` + `is_current`): subir una **nueva versión** de un documento crea otra fila ligada a
la cabeza de la cadena y marca la anterior como histórica; los listados muestran **solo la versión
vigente**; el detalle muestra el **historial** (quién/cuándo/nota + descargar cada versión). Atómico
vía RPC `SECURITY DEFINER` tenant-safe.

## 2. Por qué (grounding)

- **Hueco confirmado:** hoy cada archivo es una fila independiente. Si llega un BL corregido, una
  factura re-emitida o un RIF renovado, el operador **sube otro documento suelto** y el viejo queda
  como ruido (o lo borra y pierde la traza). No hay "este reemplaza a aquel".
- **El dominio lo necesita:** BL/packing/factura comercial se corrigen seguido; KYC/RIF/permisos se
  **renuevan** (ya hay `valid_until` + badge `vencido`/`por-vencer` en 0049 — el reemplazo versionado
  es la otra mitad). Una aceptación legal versionada (0054) vive del mismo principio: el original
  nunca se pisa, se supersede.
- **Reusa el patrón, no lo reinventa:** la cadena self-referencing vive en `documents` y hereda
  RLS fail-closed por tenant, trigger `documents_validate_entity`, bucket privado, `signDocumentUrl`
  y `deriveDocStatus`. Cero infra nueva de Storage.

## 3. Approach — staged (2 slices)

### Slice A — Foundation: schema de cadena + RPC atómica + queries (sin UI) ← arranca acá

- **Migración** `0116_documentos_versionado.sql` (renumerada de `0111` al integrar a main):
  - **Columnas nuevas en `public.documents`** (todas con default seguro para el backfill):
    - `root_id uuid` — cabeza lógica de la cadena (la v1 apunta a sí misma).
    - `version_no int not null default 1` — correlativo dentro de la cadena (1, 2, 3…).
    - `supersedes_id uuid references public.documents(id) on delete set null` — la versión anterior
      directa (null en la v1).
    - `is_current boolean not null default true` — marca la versión vigente de la cadena.
    - `version_note text` — nota opcional de la revisión ("corregido el monto", "firmado por aduana").
  - **Backfill** de las filas existentes: `root_id = id`, `version_no = 1`, `is_current = true`,
    `supersedes_id = null`. (Toda fila previa = cadena de 1.)
  - `root_id` pasa a `not null` tras el backfill.
  - **Índice único parcial** `documents_one_current_per_root` —
    `unique (root_id) where is_current and deleted_at is null`: **a lo sumo 1 versión vigente** por
    cadena (invariante de integridad, no solo convención).
  - Índice `documents_chain_idx (tenant_id, root_id, version_no) where deleted_at is null` para el
    historial.
  - **RPC `add_document_version(...)` `SECURITY DEFINER`** (`set search_path = public`) — hace el
    flip + insert en **una transacción** (evita la ventana no-atómica de 2 round-trips PostgREST y la
    violación del índice único). Firma sugerida:
    `add_document_version(p_root uuid, p_storage_path text, p_name text, p_content_type text,
    p_size_bytes bigint, p_status document_status, p_valid_until date, p_doc_type text,
    p_version_note text) returns documents`. Pasos internos:
    1. Resuelve `tenant := get_user_tenant_id()`; valida que la cadena `p_root` exista, sea de ese
       tenant y no esté borrada (fail-closed; cross-tenant → `raise exception`).
    2. Toma la fila `is_current = true` de la cadena → calcula `version_no := max+1`,
       `supersedes_id := id de la actual`, **hereda** `entity_type`/`entity_id`/`folder` de la cabeza
       (la nueva versión pertenece a la MISMA transacción y carpeta — no se re-parametriza acá).
    3. `update documents set is_current = false where id = <actual>`.
    4. `insert ... is_current = true, root_id = p_root, ...` con los metadatos nuevos.
    5. Devuelve la fila nueva.
    - Grant `execute` a `authenticated` (RLS de tabla + el filtro por tenant explícito en la función
      cubren el aislamiento; mismo patrón que las RPCs `next_*` del repo). El trigger
      `documents_validate_entity` igual corre sobre el insert (defensa en profundidad).
- **Tipos** `lib/studio/documents/types.ts` (EXTENDER, no romper): agregar a `DocumentRow`
  `root_id` / `version_no` / `supersedes_id` / `is_current` / `version_note`; helper
  `versionLabel(n) → "v{n}"`. Tipo `DocumentVersionRow` (fila del historial: id, version_no,
  name, size_bytes, content_type, status, version_note, uploaded_by, created_at, storage_path,
  is_current).
- **Queries** `lib/studio/documents/queries.ts`:
  - **Todos los listados existentes** (`listDocumentsByEntity`, `listAllDocuments`, `folderCounts`,
    `expiringDocuments`, `pendingDocuments`, `unlinkedDocuments`) suman el filtro **`is_current = true`**
    a su `deleted_at is null` → el hub y el panel muestran SOLO la versión vigente (las viejas no
    aparecen sueltas). ⚠️ Este es el cambio de comportamiento clave: revisar cada query.
  - Nueva `listDocumentVersions(supabase, rootId)` → la cadena completa ordenada `version_no desc`.
- **Tests** con stub `SupabaseClient` en `__tests__/`: cadena (v1→v2→v3), invariante "una sola
  current", listados ocultan no-current, `versionLabel`, validación de la firma de la RPC (shape).
- **NO** en Slice A: server action de subida, UI, historial visual.

### Slice B — Operable: subir nueva versión + historial · NO en Slice A

- **Server action** `app/studio/(app)/documentos/actions.ts` → `addDocumentVersion(rootId, formData)`:
  valida mime/size (reusa `validateDocumentInput`/`canonicalContentType`/`buildDocumentStoragePath`),
  sube el object al bucket **server-side** con un **uuid nuevo** (mismo path scheme; el object viejo
  **se conserva** — append-only), llama la RPC `add_document_version`, hace **rollback del object** si
  la RPC falla (mismo patrón que `uploadDocument` de 0049), `revalidatePath`.
- **UI embebida** en `<DocsPanel>` (`app/studio/_components/documents/DocsPanel.tsx`):
  - Badge **`v{n}`** junto a cada documento (neutral; solo se muestra `>1` o siempre, decisión §4.5).
  - Acción **"Subir nueva versión"** por fila (input file → `addDocumentVersion`). Usa `<ActionButton>`
    (anti-doble-submit; la subida no es idempotente) + trazabilidad (toast + highlight, reglas del
    Studio).
  - Acción **"Historial"** por fila → abre un **drawer** (`DrawerShell`) o popover con
    `listDocumentVersions`: lista versiones (v{n} · nombre · tamaño · estado · nota · quién · cuándo)
    con **"Ver"** por versión (reusa `signDocumentUrl` — firma cualquier `storage_path` del tenant,
    TTL 60s). La versión vigente marcada.
  - El **hub** (`/studio/documentos`) hereda el cambio automáticamente (sus queries ya filtran
    `is_current`); agregar el badge `v{n}` en la tabla y el acceso a "Historial".
- **`ui-ux-designer` pre-commit** (regla del founder).
- **Restaurar/revertir a una versión anterior = deferred** (ver §8): V1 es subir-nueva + ver-historial.

## 4. Decisiones de diseño

### 4.1 Cadena en `documents`, NO tabla `document_versions` aparte
Self-referencing (`root_id`/`version_no`/`supersedes_id`/`is_current`) reusa **toda** la infra de
0049 (RLS, trigger polimórfico, bucket, signed-URL, `deriveDocStatus`). Una tabla aparte duplicaría
RLS + Storage policies + validación polimórfica para nada. Costo: los listados deben filtrar
`is_current` (cambio acotado y testeable).

### 4.2 Append-only — el object viejo NUNCA se borra
Subir una versión **no toca** el object anterior en el bucket; inserta uno nuevo (uuid nuevo) y
flipea `is_current`. El historial es auditable (lección de inmutabilidad de 0054/0045). El soft-delete
(`deleted_at`) sigue existiendo por fila si hace falta retirar una versión puntual.

### 4.3 Atomicidad vía RPC, no 2 updates desde el cliente
El índice único `one_current_per_root` haría fallar un insert-then-flip hecho en 2 round-trips. La RPC
`SECURITY DEFINER` flip+insert en una transacción es la única forma segura; además centraliza la
herencia de `entity_type`/`entity_id`/`folder` (la nueva versión NO puede cambiar de transacción).

### 4.4 La versión hereda transacción y carpeta de la cabeza
`entity_type`/`entity_id`/`folder` se heredan de la versión vigente — una "nueva versión" es el mismo
documento lógico corregido, no un re-archivado. Mover de carpeta / re-vincular = `updateDocumentMeta`
existente sobre la fila vigente (fuera de alcance de esta spec).

### 4.5 Badge de versión
Mostrar `v{n}` siempre (incluso v1) da consistencia y enseña la feature; alternativa: solo `>1`.
Decisión V1: **mostrar siempre** (chip neutral discreto). Ajustable en ui-ux.

## 5. Acceptance

### Slice A ✅ (foundation — sin UI; implementado 2026-06-05, NO aplicado a prod)
- [x] Migración `0111`: 5 columnas en `documents` + backfill (toda fila previa = `root_id=id`,
      `version_no=1`, `is_current=true`) + `root_id not null` + índice único parcial
      `one_current_per_root` + índice `documents_chain_idx` + RPC `add_document_version`
      `SECURITY DEFINER` tenant-safe. *(NO aplicada a prod — la aplica el founder.)*
- [x] La RPC rechaza cadena de otro tenant / inexistente / borrada (fail-closed, `for update`
      lock anti-carrera); hereda `entity_type`/`entity_id`/`folder` de la cabeza; flip
      `is_current=false` en la actual + insert con `version_no=max+1`/`supersedes_id` → deja
      exactamente 1 `is_current` (forzado por el índice único parcial).
- [x] `lib/studio/documents/{types,queries}.ts`: `DocumentRow` extendido (5 columnas),
      `versionLabel(n)→"v{n}"`, `DocumentVersionRow`, `listDocumentVersions(supabase, rootId)`
      (cadena `version_no desc`, NO filtra `is_current`), y **todos** los listados existentes
      (`listDocumentsByEntity`, `listAllDocuments`, `folderCounts`, `expiringDocuments`,
      `pendingDocuments`, `unlinkedDocuments`) suman `is_current=true`.
- [x] Tests del stub cubren cadena (v1→v2→v3), invariante 1-current, ocultamiento de no-current,
      `versionLabel`. `node scripts/verify.mjs` verde (1313 tests).

### Slice B ✅ (operable — implementado 2026-06-05; migración 0116 NO aplicada a prod aún)
- [x] Desde `<DocsPanel>`: "Subir nueva versión" de un PDF → el panel/hub muestran la nueva (la vieja
      desaparece del listado por el filtro `is_current` de Slice A pero sigue en el historial); badge
      `v{n}` junto a cada documento (chip neutral mono, mostrado siempre · §4.5). Acción con
      `<ActionButton>` (anti-doble-submit, subida no idempotente) + toast de trazabilidad.
- [x] "Historial" abre un `DrawerShell` con `listDocumentVersions` (vía `listDocumentVersionsAction`,
      read-only): lista `v{n} · nombre · tamaño · estado · nota · cuándo` con "Ver" por versión
      (signed-URL TTL 60s, reusa `signDocumentUrl`); la vigente marcada (borde wine + badge "Vigente").
- [x] `addDocumentVersion(rootId, formData)` arma el path SERVER-SIDE con uuid nuevo, hereda el
      `entity_type`/`entity_id` de la cabeza para el path (la RPC hereda entity/folder al insertar),
      re-valida mime/size (`validateVersionInput`), rollback del object si la RPC falla, conserva el
      object anterior (append-only). Traduce `no_data_found` (carrera de concurrencia) → "La versión
      cambió mientras subías. Reintentá." e `insufficient_privilege` → mensaje de permiso.
- [x] **Hub** `DocumentosHubClient`: badge `v{n}` en la tabla + columna "Versiones" con acceso al mismo
      `VersionHistoryDrawer` (reusado de `DocsPanel`).
- [x] Frontera público↔ERP intacta (ESLint la fuerza, parte del gate); `node scripts/verify.mjs` verde
      (lint 0 errors · rsc-boundary OK · typecheck OK · 1370 tests · docs:check OK). `ui-ux-designer`:
      auto-revisión contra las 8 reglas de botones + trazabilidad + tokens (pendiente check del founder
      pre-commit, regla estándar).

## Notas de cierre (2026-06-05)

- **Decisión §7.1 (restaurar versión):** quedó **deferida** (V1.1), como proponía la spec — V1 es
  subir-nueva + ver-historial.
- **Decisión §7.2 (badge):** se muestra **siempre** (incluso v1), chip neutral mono discreto.
- **`validateVersionInput`** (nuevo en `types.ts`): valida solo los campos de la revisión
  (name/mime/size/status/valid_until/doc_type/version_note, máx. 280) — **no** entity_type/entity_id/
  folder, porque la RPC los hereda de la cabeza (§4.4). Evita el hack de pasar un `folder` placeholder
  por `validateDocumentInput`.
- **`listDocumentVersionsAction`** (nuevo server action read-only): envuelve `listDocumentVersions`
  (RLS por tenant) + valida `rootId` (uuid) → `[]` si inválido. Lo consume el drawer on-open.
- **Reuso cross-superficie:** `VersionChip` y `VersionHistoryDrawer` se exportan desde `DocsPanel.tsx`
  y los importa el hub (ambos `"use client"`) — una sola implementación del historial.
- **Fix UX pre-commit (finding INFO del review):** `addDocumentVersion` puede resolver a
  `{ fieldErrors }` (rechazo de mime/size/nombre/nota) sin `error`, y `<ActionButton>` solo inspecciona
  `result.error` → un fieldError-only se trataría como ÉXITO (toast "Versión subida" + cierre del form)
  aunque el server rechazó. Fix: el `onAction` del form de versión pasa el resultado por el helper puro
  `versionResultToActionResult` (exportado de `DocsPanel.tsx`), que colapsa `{ fieldErrors }` (sin
  `error`) al primer mensaje de campo → `{ error }`; así dispara `onError` (banner) y NO el flash/cierre
  de éxito. Es subir un archivo + nota (no un form multi-campo), así que un único mensaje en el banner
  alcanza. Cubierto por `__tests__/DocsPanel.test.tsx` (helper + flujo UI: rechazo → banner sin toast ni
  cierre · happy → toast + cierre).
- **Trazabilidad de la subida de versión (decisión consciente · UI/UX):** el rastro persistente de una
  subida exitosa = el **chip `v{n}` que bumpea en el mismo render** + el `revalidatePath` que refresca
  panel/hub. El `toast.success` **NO lleva `link`** porque el historial es un **drawer client, no una
  ruta** — `toast.link.href` espera un href y forzarlo sería inventar un destino que no existe. Por la
  misma razón, el **row-flash no aplica** en el panel embebido: el documento ya está visible y su chip
  cambia solo (no hay navegación ni listado destino al que resaltar). Cumple la regla de "Trazabilidad
  visual" de `app/studio/CLAUDE.md` por el camino correcto para este caso (rastro in-place, no toast-con-link).
- **Pendiente founder:** aplicar `supabase/migrations/0116_documentos_versionado.sql` a prod (lo hace el
  founder, no el harness). Sin la migración, la columna `root_id`/`is_current` y la RPC no existen en
  prod → la feature no opera hasta aplicarla.

## 6. Archivos a crear / editar (estimado)

```
supabase/migrations/0116_documentos_versionado.sql        ← Slice A (NEW)
lib/studio/documents/types.ts                             ← Slice A (EDIT: columnas + helpers)
lib/studio/documents/queries.ts                           ← Slice A (EDIT: filtro is_current + listDocumentVersions)
lib/studio/documents/__tests__/*                          ← Slice A (EDIT/NEW)
app/studio/(app)/documentos/actions.ts                    ← Slice B (EDIT: addDocumentVersion)
app/studio/_components/documents/DocsPanel.tsx            ← Slice B (EDIT: subir versión + historial + badge + versionResultToActionResult)
app/studio/_components/documents/__tests__/DocsPanel.test.tsx ← Slice B fix UX (NEW: helper + flujo de subida de versión)
app/studio/(app)/documentos/_components/DocumentosHubClient.tsx ← Slice B (EDIT: badge v{n} + historial)
docs/architecture/module-sdd-map.md · docs/specs/README.md ← al cerrar (lo regenera la ventana de integración)
```

> ⚠️ **Carril aislado (multi-ventana):** esta feature toca SOLO `lib/studio/documents/*`,
> `app/studio/(app)/documentos/*` y `app/studio/_components/documents/DocsPanel.tsx` + una migración
> nueva `0111`. **Disjunto** de los carriles vivos (web/brochure, Kommo/CRM `0058`, Financiero China
> `0059`/`partner-finance`/`0110`). **No** tocar `StudioSidebar.tsx` (el item `documentos` ya existe),
> ni `docs/specs/README.md` (lo regenera la ventana de integración). Commit **selectivo** al cierre.

## 7. Decisiones abiertas (founder)

1. **Restaurar versión anterior:** ¿incluir en V1 (flip de `is_current` a una vieja, reabriendo la
   cadena) o deferir? — propuesta: **deferir** (subir-nueva + historial es el valor; restaurar añade
   ambigüedad de correlativo). 
2. **Badge `v{n}`:** ¿siempre o solo `>1`? — propuesta: **siempre** (discreto).

## 8. Out of scope (V1) / Deferred

- **Restaurar / revertir** a una versión anterior (V1.1).
- **Diff** entre versiones / comparación visual.
- Cambiar de transacción o carpeta al versionar (se usa `updateDocumentMeta` sobre la vigente).
- Versionado de los adjuntos legacy (`shipment_documents` portal-facing, `warehouse_receipt_photos`,
  `customs_documents`) — el versionado vive en el DMS genérico `documents`.
- OCR / extracción (sigue futuro, como en 0049).
- Exposición del historial al Portal del cliente.
