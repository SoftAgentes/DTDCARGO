---
sdd: "0049"
title: "Documentos · Hub DMS — adjuntos polimórficos embebibles + carpeta central (Bloque 5)"
status: approved
author: "Claude Code (carril Bloque 5 · Norte v2.4)"
created: 2026-06-03
updated: 2026-06-03
supersedes: null
superseded_by: null
related: ["0042", "0045", "0047", "0021", "0018"]
confidencialidad: interno
---

# DTD-0049 — Documentos · Hub (DMS)

> **Bloque 5.** El **hub central de adjuntos**: una entidad `documents` **polimórfica** (adjunta a
> cualquier transacción — embarque, factura, pago, cliente, proveedor, contenedor…) con bucket
> privado por tenant, un **panel embebible** que cualquier detalle puede montar, y una **página hub**
> para navegar/buscar todo por carpeta. Cierra la entidad `Document` (era 🟡: hoy hay adjuntos
> fragmentados por superficie). Diseño en el Norte v2.4 (`erp/modules/documentos*.jsx`).

## 1. Resumen en una línea

`documents` polimórfico (`entity_type` + `entity_id`) + bucket privado por tenant + `<DocsPanel>`
embebible (subir/listar/preview signed-URL) + página `/studio/documentos` (árbol de carpetas + buscar
+ filtros vencer/pendiente/sin-vincular). **Generaliza** el patrón de `shipment_documents` (0086).

## 2. Por qué (grounding)

- **Hueco confirmado:** los adjuntos están **fragmentados por superficie** — `shipment_documents`
  (0086, por envío + portal), `bug_attachments`, `warehouse_receipt_photos`, `customs_documents`,
  `expense-receipts`. No hay un **DMS genérico** ni un lugar central para verlos. El módulo
  `documentos` del sidebar es stub.
- **El Norte ya lo diseñó** (`documentos-data.jsx`): árbol de carpetas (Operacionales/Logísticas/
  Contables/Aduaneras/Otras), link polimórfico a transacción (`LINK_KIND`: embarque/factura/pago/
  asiento/cliente/proveedor/ninguno), estados (firmado/vigente/pendiente/vencido/por-vencer) y un
  hub navegable + vista "embebida en la transacción" (`DocsForTransaction({kind,id})`).
- **El patrón ya existe** en `shipment_documents` (0086): bucket privado, Storage RLS por tenant
  (1er segmento del path = `tenant_id`), signed URLs server-side, RLS de tabla por tenant. Esta spec
  lo **generaliza a cualquier entidad** (no reescribe; calca + polimorfiza).

## 3. Approach — staged (2 slices)

### Slice A — Foundation: schema + storage + validación DB (sin UI) ← arranca acá

- **Migración** `00NN_documentos_hub.sql`:
  - Enum `document_entity_type` (`shipment`, `invoice`, `supplier_bill`, `supplier_payment`,
    `journal_entry`, `client`, `supplier`, `consolidation`, `booking`, `none`).
  - `documents` — `id`, `tenant_id`, `entity_type` (enum), `entity_id` (uuid, nullable si `none`),
    `folder` (text, id de subcarpeta del taxonomy fijo, ej. `log-bl`), `doc_type` (text libre, ej.
    "BL marítimo"), `name`, `storage_path` (unique), `content_type`, `size_bytes`, `status`
    (enum `document_status`: firmado/vigente/pendiente/borrador/vencido/por-vencer — o derivar
    vencido/por-vencer de `valid_until`), `valid_until` (date, nullable), `uploaded_by`
    (→ auth.users), `created_at`, `deleted_at`.
  - **Bucket privado `documents`** (10 MB, PDF + imágenes + xlsx/docx/zip) + **Storage RLS por tenant**
    (calca las 4 policies de `shipment-docs`: service_role all + tenant insert/read/delete por
    `(storage.foldername(name))[1] = tenant_id`). Path: `{tenant_id}/{entity_type}/{entity_id|none}/{uuid}.{ext}`.
  - **RLS de tabla** fail-closed por tenant (patrón 0086/0090).
  - ⚠️ **Validación en DB de la tabla polimórfica** (lección de SDD-0045, memoria
    `feedback_polymorphic_table_db_validation`): helper `document_entity_in_tenant(entity_type,
    entity_id, tenant_id)` (chequea que la entidad exista en ese tenant según el tipo) + **trigger
    BEFORE INSERT/UPDATE** `documents_validate_entity` que rechaza entity inexistente / wrong-type /
    de otro tenant (cubre todo cliente PostgREST, no solo la server action). `none` salta la validación.
  - **NO migra `shipment_documents`** (coexisten · §4.1).
- **Tipos puros** `lib/studio/documents/types.ts` — `FOLDERS` (taxonomy fijo del Norte, 5 grupos /
  ~18 subcarpetas), `EXT_META`, `LINK_KIND` (mapea entity_type → módulo + ruta para deep-link),
  `DOC_STATUS`, helpers (`folderLabel`, `topOf`, derivación de estado por `valid_until`),
  `validateDocumentInput()` (no Zod).
- **Queries** `lib/studio/documents/queries.ts` — `listDocumentsByEntity(supabase, type, id)`,
  `listAllDocuments(supabase, {folder?, q?})`, `folderCounts`, `expiringDocuments`,
  `pendingDocuments`, `unlinkedDocuments`.
- **NO** en Slice A: upload/delete actions, UI, embed, hub page.

> **Notas de implementación (Slice A · harness 2026-06-03):** migración `0097_documentos_hub.sql`
> (LOCAL, no aplicada a prod) + `lib/studio/documents/{types,queries}.ts` + tests.
> - `document_status` (enum persistido) = `firmado/vigente/pendiente/borrador`. `vencido`/`por-vencer`
>   se **derivan** de `valid_until` en `deriveDocStatus()` — NO viven en el enum (§4.4).
> - Mapa `entity_type → tabla` del helper/trigger de validación: `shipment→shipments` ·
>   `invoice→invoices` · `supplier_bill→supplier_bills` · `supplier_payment→supplier_payments` ·
>   `journal_entry→journal_entries` · `client→clients` · `supplier→suppliers` ·
>   `consolidation→consolidations` · `booking→bookings` (todas con `tenant_id` + `deleted_at`).
> - CHECK `documents_entity_id_coherent`: `none ⇒ entity_id null`; cualquier otro `⇒ entity_id not null`.

### Slice B — Operable: panel embebible + hub + wiring · NO en Slice A

- **Server actions** `app/studio/(app)/documentos/actions.ts` (`"use server"` + validate + tenant
  vía RLS + `revalidatePath`): `uploadDocument` (sube al bucket con el path scheme + inserta fila),
  `deleteDocument` (soft-delete + borra object), `updateDocumentMeta` (folder/status/valid_until).
  Signed upload o upload directo server-side (seguir el patrón de `tracking/[id]/document-actions.ts`).
- **`<DocsPanel entityType entityId>`** (`_components/documents/DocsPanel.tsx`) — **embebible**: lista
  docs de esa entidad + botón subir + preview signed-URL + borrar. Drop-in para cualquier detalle.
  Wire en **1-2 detalles** como demo: `tracking/[id]` (envío) + `clientes/[markbox]` (cliente).
- **Hub** `app/studio/(app)/documentos/page.tsx` — árbol de carpetas (sidebar del módulo) + tabla de
  docs (nombre/tipo/carpeta/vínculo deep-link/fecha/estado) + buscador + chips de filtro (por vencer
  / pendientes / sin vincular). Reemplaza el stub.
- **Sidebar:** activar el item `documentos` (ya existe stub).
- **`ui-ux-designer` pre-commit.**

## 4. Decisiones de diseño

### 4.1 Coexiste con `shipment_documents`, no lo migra
`shipment_documents` (0086) tiene **RLS especial del portal** (cliente lee sus BL/POD por markbox).
Migrarlo es riesgoso. V1: `documents` es el **DMS interno genérico**; `shipment_documents` sigue
siendo la vía portal-facing. (El hub PUEDE surfacear ambos en V2; en V1 son separados.)

### 4.2 Taxonomy de carpetas FIJO (no carpetas de usuario)
V1 usa el árbol fijo del Norte (5 grupos / ~18 subcarpetas) como catálogo en código (`FOLDERS`).
Carpetas creadas por el usuario = V2. Simple y suficiente.

### 4.3 Validación DB de la tabla polimórfica (no negociable)
Igual que SDD-0045: la server action valida, **pero** un cliente Supabase directo la saltaría →
trigger BEFORE INSERT/UPDATE + helper `*_in_tenant()`. Sin esto, `entity_id` es forjable.

### 4.4 Estado por vencimiento derivable
`vencido`/`por-vencer` se pueden **derivar** de `valid_until` (útil para KYC/permisos/certificados).
V1: guardar `valid_until` + derivar el badge; el resto de estados (firmado/pendiente/borrador) son
campo libre `status`.

### 4.5 Reusa el patrón de Storage de 0086
Bucket privado + 4 Storage policies por tenant + signed URLs server-side. No se inventa nada nuevo
de Storage; se calca `shipment-docs` con path polimórfico.

## 5. Acceptance

### Slice A ✅ (implementado · pendiente review + aplicar a prod)
- [x] Migración `0097_documentos_hub.sql` escrita; `documents` con RLS fail-closed por tenant; bucket
      `documents` privado (10 MB, 7 mimes) + 4 Storage policies por tenant (1er segmento = tenant_id).
      *(NO aplicada a prod — la aplica el founder.)*
- [x] Trigger `documents_validate_entity` (BEFORE INSERT/UPDATE) + helper `document_entity_in_tenant()`
      rechazan `entity_id` inexistente / de otro tenant / wrong-type; `none`/`null` pasan. CHECK
      `documents_entity_id_coherent` fuerza la coherencia entity_type↔entity_id.
- [x] `lib/studio/documents/{types,queries}.ts` — `listDocumentsByEntity` / `listAllDocuments` /
      `folderCounts` / `expiringDocuments` / `pendingDocuments` / `unlinkedDocuments` + `deriveDocStatus`
      + `validateDocumentInput` (no Zod). Tests con stub SupabaseClient en `__tests__/`.
- [x] `node scripts/verify.mjs` verde (634 tests, 43 files).

### Slice B
- [ ] Subir un PDF a un envío desde `<DocsPanel>` → aparece en el panel + en el hub bajo su carpeta.
- [ ] Preview por signed-URL (no público); borrar (soft-delete + object).
- [ ] Hub: navegar carpeta, buscar, filtrar por-vencer/pendiente/sin-vincular; deep-link al módulo.
- [ ] `ui-ux-designer` sin hallazgos Alta.

## 6. Archivos a crear / editar (estimado)

```
supabase/migrations/00NN_documentos_hub.sql              ← Slice A (NEW)
lib/studio/documents/{types,queries}.ts + __tests__/     ← Slice A (NEW)
app/studio/(app)/documentos/{page,actions}.tsx           ← Slice B (NEW)
app/studio/_components/documents/DocsPanel.tsx           ← Slice B (NEW, embebible)
app/studio/(app)/tracking/[id]/ + clientes/[markbox]/    ← Slice B (wire DocsPanel)
app/studio/(app)/_components/StudioSidebar.tsx           ← Slice B (activar item)
docs/architecture/module-sdd-map.md · docs/specs/README.md ← al cerrar
```

## 7. Decisiones resueltas (founder · 2026-06-03)

1. **Convivencia con `shipment_documents`:** ✅ **coexistir** — `documents` = DMS interno genérico;
   `shipment_documents` sigue portal-facing (RLS por markbox). Unificación = V2.
2. **Carpetas:** taxonomy fijo del Norte en V1 (carpetas de usuario = V2).
3. **Cadencia del harness:** Slice A primero (schema + validación testeable), B después.
4. **Vencimiento:** se incluye `valid_until` + badge derivado (vencido/por-vencer) en V1.

## 8. Out of scope (V1) / Deferred

- Migrar/unificar `shipment_documents` (V2).
- Carpetas creadas por el usuario / mover entre carpetas (V2).
- OCR / extracción de datos del documento (futuro).
- Versionado de documentos (V2).
- Preview inline avanzado (visor PDF embebido) — V1 abre signed-URL en pestaña.
- Surfacear adjuntos legacy (warehouse_receipt_photos, customs_documents) en el hub (V2).
- Exposición de documents al Portal del cliente (el portal sigue con `shipment_documents`).
