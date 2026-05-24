---
sdd: "0016"
title: "DoorTuDoor — Almacén CN (recepción + scope + traductor)"
status: approved
author: "founder"
created: 2026-05-25
updated: 2026-05-25
supersedes: null
superseded_by: null
related: ["0010", "0012"]
---

# DTD-0016 — Almacén CN

> **Recepción de mercadería en hubs CN.** Primer módulo del Sprint 3
> (Operación profunda). Cuando una caja llega del supplier chino al
> almacén de Yiwu / Guangzhou / Shenzhen / Shanghai, el operario la
> registra acá: cliente (MARKBOX) + supplier + items con HS code +
> CBM/peso. La caja queda `pendiente_consolidacion` esperando que
> Embarques la junte con otras para crear un container.

---

## 1. Resumen en una línea

`/studio/cn` muestra la tabla de recepciones del tenant con filtros
por hub + status + búsqueda, KPIs operativos, drawer "Nueva
recepción" con form multi-item bilingüe (supplier CN/ES), y toggle de
idioma de display.

> **Nota slug**: el sidebar (SDD-0007) ya registra el módulo con
> `slug: "/studio/cn"`. Reusamos esa ruta, no se renombra a
> `/studio/cn` para mantener consistencia con el shell ya
> implementado y los placeholders existentes (`app/studio/(app)/cn/`).

---

## 2. Scope

### Incluye

#### Schema (migración 0008)

- Enum `warehouse_receipt_status`:
  `pendiente_consolidacion` / `consolidado` / `incidencia`
- Tabla `warehouses_cn` (catálogo de hubs, **sin** RLS por tenant —
  son hubs físicos compartidos a nivel sistema, pero hoy todos
  pertenecen a DTD)
- Tabla `warehouse_receipts_cn` (1 row por caja física que llegó)
- Tabla `warehouse_receipt_items` (N items con HS code distinto por
  recepción — modela cajas mixtas)
- Tabla `warehouse_receipt_events` (timeline: recibido, consolidado,
  incidencia, nota)
- Función `public.next_receipt_code(tenant_id) → 'WR-YYYY-NNNN'`
- Función `public.next_orphan_code(tenant_id) → 'SIN-CODIGO-NNNN'`
- RLS por tenant en `warehouse_receipts_cn`, `warehouse_receipt_items`
  y `warehouse_receipt_events`
- Seed: 5 hubs en `warehouses_cn` (YIW-A1, YIW-A2, CAN-C1, SZX-A2,
  SHA-A1) matching el JSX de referencia
- Trigger `touch_updated_at` reusable

#### Lib

- `lib/studio/warehouse-cn-types.ts`:
  - Tipos `WarehouseReceiptStatus`, `WarehouseCN`, `WarehouseReceipt`,
    `WarehouseReceiptItem`, `WarehouseReceiptEvent`
  - `RECEIPT_STATUS_LABELS` + `RECEIPT_STATUS_TONES` (badge tone wine
    convention: warning para pendiente, success para consolidado,
    danger para incidencia)
  - `HUB_GROUPS` const con los 4 hubs principales + sus subs
  - `LANG_OPTIONS: ('original'|'cn'|'es')[]`
  - Helper `isChinese(text)` con regex `/[一-鿿]/`

- `lib/studio/warehouse-cn-queries.ts`:
  - `listWarehouses(supabase)` — devuelve hubs ordenados por hub_code
  - `listReceipts(supabase, filters)` — joins con warehouses_cn,
    devuelve hasta 100 más recientes con filters: `q`, `hub` (prefix
    YIW/CAN/SZX/SHA), `warehouseCode` (exact YIW-A1), `status`
  - `getReceiptById(supabase, id)` — con items joined
  - `listItemsForReceipt(supabase, receiptId)`
  - `getReceiptEvents(supabase, receiptId)`
  - `computeWarehouseKpis(supabase)` — counts mes + pending + cbm en
    bodega + incidencias (1 query agregada)
  - `parseFiltersFromSearchParams(sp)` con sanitización

#### Componentes (`app/studio/(app)/cn/_components/`)

- `LangToggle.tsx` (client):
  - Pill switcher 3 estados (original / 中文 / Español) con flag
  - Estado en URL `?lang=cn` (default `original`)
  - Cambia via `router.replace`
- `WarehouseKpis.tsx` (server):
  - 4 KPI cards horizontal: Recepciones del mes / Pendientes
    consolidar / CBM en bodega / Incidencias
  - Tonos: wine / warning / neutral / danger
- `WarehouseFilters.tsx` (client):
  - Search input (debounced 250ms, escribe a `?q`)
  - Select hub (Todos / YIW / CAN / SZX / SHA)
  - Select status (Todos / pendiente / consolidado / incidencia)
  - Botón "Limpiar" si hay filtros activos
- `ReceiptsTable.tsx` (server):
  - Columnas: `receipt_code` (mono) · cliente (markbox+name o orphan
    label) · supplier (con CN/ES según lang) · warehouse badge (con
    nombre CN si lang=cn) · cajas · CBM · peso · items count · estado
    badge · received_at
  - Empty state cuando 0 rows
  - Click en fila no hace nada V1 (detalle diferido a SDD futuro)
  - Renderiza supplier según `?lang`: original = `supplier_name` tal
    como está · `cn` = si `isChinese(supplier_name)` muestra original,
    sino muestra `supplier_name_translated` si existe · `es` =
    análogo inverso
- `ReceiptStatusBadge.tsx` (server, pure):
  - Reusa `<Badge>` global con tone según status
- `OrphanInlineWarning.tsx` (server, pure):
  - Cuando la fila es huérfana, label "📦 Caja huérfana" con tone
    warning en lugar del client_name
- `NewReceiptDrawer.tsx` (client):
  - Drawer 620px que se abre con `?view=create`
  - Form con secciones:
    1. **Almacén** (select de warehouses)
    2. **Cliente** — select MARKBOX (busca en clients) + toggle
       "📦 ¿Sin código MARKBOX? · caja huérfana"
       - Si huérfana: fields `orphan_marks`, `orphan_brought_by`,
         `orphan_suspected_client`
    3. **Supplier** — `SupplierBilingualInput.tsx` (sub-componente,
       client): input principal + auto-detecta idioma con regex +
       muestra hint "🌐 Texto en chino detectado" o "🌐 Click
       traducir para enviar en chino al supplier" + botón "Traducir"
       que llena `supplier_name_translated` (mock V1: placeholder
       string explicando que la integración real va en SDD futuro)
    4. **Items** — repeater (mínimo 1, máximo 10 V1):
       - Description text input + Description traducción nullable
       - HS code (mono, formato 0000.00 o 0000.00.00)
       - Quantity (int)
       - Unit value USD (numeric)
       - Botón "+ Agregar item" + botón "x" eliminar por row
    5. **Totales** — cajas (int) + total CBM (numeric 0.000) + total
       weight kg (numeric 0.00). Editables manualmente (no se calculan
       desde items V1 — los items pueden ser productos sin "CBM por
       unidad", el operario suma a ojo).
    6. **Notas** — textarea
  - Submit → server action `createReceiptAction` → toast + redirect
    a la lista sin `?view`
- `ReceiptRowActions.tsx` (client):
  - Menú "..." por fila con acciones: "Marcar consolidado", "Marcar
    incidencia", "Marcar pendiente" (cambian status via server
    action, refresh route)
  - Server action `changeReceiptStatusAction(receiptId, newStatus, note?)`
- `ReceiptsEmptyState.tsx`:
  - Empty state cuando 0 rows: "Sin recepciones" + CTA "+ Nueva
    recepción" que pasa `?view=create`

#### Page

- `app/studio/(app)/cn/page.tsx` (server):
  - Lee searchParams (`?q`, `?hub`, `?status`, `?lang`, `?view`)
  - Llama `listReceipts(filters)` + `listWarehouses()` +
    `computeWarehouseKpis()` + `listClients()` (para el drawer)
  - Layout:
    - PageHeader: eyebrow "Operación · Almacén" + h1 "Almacén CN ·
      中国" + sub "Recepción de mercadería en hubs Yiwu · Guangzhou ·
      Shenzhen · Shanghai. Consolidación previa a zarpe." + actions
      (`<LangToggle>` + botón "+ Nueva recepción")
    - `<WarehouseKpis>`
    - `<WarehouseFilters>` con warehouseCount, statusCount actuales
    - `<ReceiptsTable rows={receipts} lang={lang}>` o
      `<ReceiptsEmptyState>` si vacío
    - `<NewReceiptDrawer>` (renderizada siempre, abre por `?view=create`)

#### Server actions

- `app/studio/(app)/cn/actions.ts`:
  - `createReceiptAction(formData)` — valida + insert receipt + insert
    items + insert event (`event_type='received'`) en una transacción
    (Supabase tiene .insert múltiple por table pero no joinedTx; uso
    inserts secuenciales con rollback manual via try/catch + delete
    si el segundo falla — patrón consistente con el resto del repo)
  - `changeReceiptStatusAction(receiptId, newStatus, note?)` — update
    receipt + insert event
- Validaciones con `zod` (ya está en deps del proyecto si los otros
  SDDs lo usan; sino con validación inline). El proyecto **no** usa
  zod actualmente — validación inline con guardas defensivas y
  mensajes legibles.

#### Sidebar

- ✅ Ya existe entry "Almacén CN" en el sidebar (SDD-0007). Solo
  verificar que el active state se enciende al navegar a `/studio/cn`.

### NO incluye (diferidos a SDDs futuros)

- **Wizard de consolidación** (`ConsolidationFlow` 4-steps con
  PartialEditor, FCL/LCL recomendación, vessel, ETD/ETA, confirm).
  El JSX dedica >300 líneas a esto. → **SDD-0016.1 Consolidación**
  (cuando se decida que está listo el flujo end-to-end de Almacén CN
  recepción).
- **Detalle individual** `/almacen-cn/[id]` (drawer o page con
  timeline + items + fotos + acciones avanzadas). V1 solo lista +
  status change. → **SDD-0016.2 Detalle de recepción**.
- **Photo upload + thumbnails SVG fake** del JSX. Requiere Supabase
  Storage + bucket + signed URLs. → **SDD-0016.3 Adjuntos**.
- **Files attachments** (PDF, Excel, packing list). Idem storage.
  → **SDD-0016.3 Adjuntos**.
- **HsDetector IA** (mock que "analiza fotos" y sugiere HS codes con
  confidence %). Requiere fotos primero + integración real OpenAI
  vision o equivalente. → **SDD-0016.4 HS Detector IA**.
- **Importar Excel** (botón "Importar Excel" del header del JSX).
  Requiere parser xlsx + UI de mapeo de columnas + validación bulk.
  → **SDD-0016.5 Importación masiva**.
- **Auto-traducción real CN/ES** vía API (OpenAI / DeepL / Google).
  V1 = campo manual `supplier_name_translated` que el operario llena
  (puede pegar la traducción de WeChat o donde sea). El JSX mostraba
  mock con `setTimeout`. → **SDD-0016.6 Auto-traducción**.
- **Suppliers como catálogo** con WeChat + ratings + histórico
  (`suppliers.jsx` 19KB del Sprint 5). → **SDD-0030 Proveedores CN**.
- **Scope por almacén / rol operario** (un operario de Yiwu no ve
  Shenzhen). V1 todos ven todo. → **SDD-0023 Usuarios + Roles + Scope**.
- **Edit de recepciones existentes** (corregir typo en supplier,
  ajustar CBM). V1 solo cambio de status. → **SDD-0016.2 Detalle**.
- **Recepción parcial con parent/children** (campo `related_receipts`
  o `parent_receipt_id`). V1 = recepciones discretas independientes.
  Si llega parcial, el operario crea N recepciones separadas.
- **Borrado** (soft delete via UI). V1 el schema soporta `deleted_at`
  pero no se expone UI. Cleanup manual via SQL si hace falta.

---

## 3. Archivos a crear / editar

### Nuevos

```
docs/specs/0016-almacen-cn/
└── spec.md                                              ← este

supabase/migrations/
└── 0008_warehouses_cn.sql                               ← schema completo

lib/studio/
├── warehouse-cn-types.ts                                ← tipos + labels + helpers
└── warehouse-cn-queries.ts                              ← queries + filters

app/studio/(app)/cn/
├── page.tsx                                             ← server, layout principal
├── actions.ts                                           ← server actions
└── _components/
    ├── LangToggle.tsx                                   ← client, pill switcher
    ├── WarehouseKpis.tsx                                ← server, 4 KPI cards
    ├── WarehouseFilters.tsx                             ← client, search + selects
    ├── ReceiptsTable.tsx                                ← server, tabla principal
    ├── ReceiptStatusBadge.tsx                           ← server, badge tone wine
    ├── OrphanInlineWarning.tsx                          ← server, label huérfana
    ├── NewReceiptDrawer.tsx                             ← client, form drawer
    ├── SupplierBilingualInput.tsx                       ← client, input CN/ES
    ├── ReceiptRowActions.tsx                            ← client, menú "..."
    └── ReceiptsEmptyState.tsx                           ← server, empty state
```

### Editados

```
app/studio/(app)/cn/page.tsx                              ← reemplaza placeholder
docs/design/v1-studio/module-map.md                       ← marcar Almacén CN ✅
```

> Sidebar (`app/studio/(app)/_components/StudioSidebar.tsx`) ya tiene
> el entry `{ id: "cn", group: "OPERACIÓN", label: "Almacén CN",
> icon: "warehouse", slug: "/studio/cn" }` — no requiere edición.

### Eliminados

Ninguno — es módulo nuevo.

---

## 4. Decisiones de diseño

### 4.1 Tres tablas (catálogo + receipts + items)

**Por qué:** El JSX de referencia modela la recepción como "1 fila =
1 HS code". Pero la realidad operativa de DTD (confirmada por el
founder en kickoff) es que **cajas mixtas con 3-5 productos
distintos son frecuentes**. Modelar items en una tabla separada:

- Soporta multi-HS sin truncar info (no hay que elegir un HS
  "principal")
- Reportes futuros pueden agregar por HS code real (no por HS
  ponderado o falseado)
- Aduana VE (SDD-0017 SENIAT) va a necesitar el detalle por HS para
  generar la declaración

Catálogo `warehouses_cn` separado permite:
- Agregar/desactivar hubs sin deploy de código
- FK limpia para RLS scope futuro (SDD-0023)
- UI puede mostrar metadata del hub (dirección, nombre CN) sin
  hardcodearla

### 4.2 `warehouses_cn` NO tiene tenant_id

**Por qué:** los hubs físicos no son tenant-specific (Yiwu A1 es Yiwu
A1, no "el Yiwu A1 de DTD"). Hoy hay 1 tenant (DTD) y los hubs
matchean su operación. Cuando llegue HailuWay multi-tenant, los hubs
siguen siendo globales (otros tenants pueden usar los mismos hubs
físicos para sus operaciones de import desde CN).

Trade-off: si en el futuro un tenant quiere "mi hub privado solo mío"
→ se agrega columna opcional `tenant_id` nullable y se ajusta la
policy. Por ahora, NULL = global.

RLS sigue habilitado en la tabla con policy `select to authenticated`
abierto. INSERT/UPDATE/DELETE solo via SQL/admin (no exponemos
mantenimiento de hubs en UI V1).

### 4.3 Sin scope por almacén V1 (todos ven todo)

**Por qué:** SDD-0023 (Sprint 5) es el de Usuarios + Roles + Scope.
Anticipar la columna `scope_warehouses text[]` en `user_tenants` +
helper SQL + policy = duplicar trabajo cuando llegue ese SDD
(probablemente con un modelo distinto: roles + grants por módulo
+ scope por entidad).

Hoy hay 1 usuario operativo (founder). Cuando entren operarios
reales, el SDD-0023 decide el modelo completo.

Mientras tanto: `warehouse_code` y `warehouse_id` quedan en
`warehouse_receipts_cn` listos para que el scope futuro filtre por
ese campo sin migration adicional.

### 4.4 Recepciones discretas, sin relación parent/children

**Por qué:** la realidad operativa CN es que el operario registra
**lo que llega cuando llega**, no compara contra un "PO esperado".
Si un supplier mandó 12 cajas y llegan 8 hoy + 4 mañana → son 2
recepciones separadas con mismo `client_markbox` + `supplier_name`.

El `PartialEditor` con slider `-P1/-P2` del JSX es UI del wizard de
**consolidación** (cuando creás un container y querés que solo 6 de
las 8 cajas vayan en este zarpe). Eso es SDD-0016.1, no responsabilidad
del modelo de recepción.

### 4.5 Traducción CN/ES con 2 campos planos nullable

**Por qué:** ver caso B del análisis previo. Las opciones:
- JSONB `{cn, es}` → queries feas, no tipado
- Tabla `translations` genérica → overengineering V1
- Solo guardar original sin persistir traducción → se pierde la
  traducción cada refresh
- Tabla `suppliers_cn` con catálogo bilingüe → es SDD-0030 (Sprint 5)

**Recomendado:** `supplier_name` (lo que escribió el operario, en
cualquier idioma) + `supplier_name_translated` nullable (lo que
generó al click "Traducir" o pegó manualmente). Misma idea para
`description` + `description_translated` en items.

Detección de idioma es trivial con regex `/[一-鿿]/` (ya
está en el JSX). No requiere tabla ni JSONB.

Cuando llegue SDD-0030, la migration agrega `supplier_id` nullable
FK a `suppliers_cn` y los nombres se vuelven derivados del catálogo
(campos texto quedan como fallback).

### 4.6 Form usa items repeater (1-10) con submit atómico

**Por qué:** el flujo real del operario es "abro la caja, veo los
productos, los voy listando uno por uno". UI repeater con "+
Agregar item" es el patrón natural.

Límite 10 items V1: si la caja tiene 30 productos, el operario hace
2 recepciones o solicita el SDD-0016.5 (importación Excel). Cap
arbitrario pero defensivo (evita formularios de 200 fields que
rompen el drawer).

Submit es atómico vía server action: si falla el insert de items,
borro el receipt creado para que no quede en estado inconsistente.

### 4.7 Status change inline (no edit completo) V1

**Por qué:** el 80% del flujo post-recepción es solo "marcar como
consolidado" (cuando el container zarpa) o "marcar incidencia"
(daño / faltante / supplier wrong). Edit completo de la recepción
es raro y bloquea V1.

`<ReceiptRowActions>` menú "..." con 3 opciones es suficiente. Cada
cambio inserta un event en `warehouse_receipt_events` para el
timeline futuro.

### 4.8 `next_orphan_code` separado de `next_receipt_code`

**Por qué:** las cajas huérfanas necesitan un código DISTINTIVO en
la UI (`SIN-CODIGO-0042`) que el operario identifique de un vistazo,
para perseguir al cliente que reclame esa caja. Mezclarlas con
`WR-2026-NNNN` requiere que el operario lea cada código para saber
si tiene cliente o no.

Counter separado, mismo padding, mismo pattern de regex+MAX como
los otros `next_*_code` del repo.

### 4.9 LangToggle es de **display**, no de modelo

**Por qué:** el toggle CN/ES cambia **cómo se renderiza** la tabla
(qué columna del par `name`/`name_translated` aparece primero), no
qué se guarda. El operario siempre puede escribir en el idioma que
quiere; el toggle es para LEER cómodamente cuando trabaja con
suppliers chinos vs cuando reporta a Sam.

Default es `original` (mostrar exactamente lo que se cargó).

### 4.10 No usamos `<U.Drawer>` del JSX, usamos drawer del Studio actual

**Por qué:** el JSX es referencia visual pero el Studio actual tiene
sus propios componentes (`<Drawer>` en `_components/ui/` si existe,
sino patrón con `<dialog>` o conditional render con backdrop). No
copio los `window.ERPUI` / `window.Icon` del JSX — son del mockup
HTML standalone.

Si no existe `<Drawer>` reutilizable en el Studio actual, lo
construyo inline en `NewReceiptDrawer.tsx` siguiendo el patrón de
otros drawers existentes (ej: el de "+ Nuevo envío" en Tracking).

---

## 5. Criterios de aceptación

### Funcional

- [ ] `/studio/cn` muestra los 4 KPIs operativos calculados
      desde data real (no hardcoded)
- [ ] Tabla lista recepciones del tenant con todos los campos
      especificados
- [ ] Filtros funcionan: search por `receipt_code` / `client_name` /
      `supplier_name` / `client_markbox` · hub (prefix YIW/CAN/SZX/SHA)
      · status
- [ ] Drawer "Nueva recepción" se abre con `?view=create` y se cierra
      con `?view=null`
- [ ] Form valida: warehouse obligatorio, supplier obligatorio,
      al menos 1 item, cajas > 0
- [ ] Toggle huérfana cambia el form: oculta select cliente, muestra
      fields `orphan_marks`, `orphan_brought_by`, `orphan_suspected_client`
- [ ] Submit crea receipt + items + event `event_type='received'`
      en una operación atómica (si falla items, rollback receipt)
- [ ] Receipt huérfana recibe código `SIN-CODIGO-NNNN` autogenerado
- [ ] Receipt normal recibe código `WR-YYYY-NNNN` autogenerado
- [ ] Menú "..." en row permite cambiar status + crea event
- [ ] LangToggle cambia el display de supplier en la tabla
      (original / cn / es)
- [ ] Empty state aparece cuando hay 0 recepciones, con CTA que abre
      el drawer

### Sistema

- [ ] `pnpm typecheck` pasa
- [ ] Migration 0008 corre limpia en Supabase (idempotente, no rompe
      las anteriores)
- [ ] RLS funciona: usuario de tenant A no ve recepciones de tenant B
      (probar manualmente con segundo user)
- [ ] Seed de 5 hubs (`YIW-A1`, `YIW-A2`, `CAN-C1`, `SZX-A2`,
      `SHA-A1`) aparece en la BD post-migration
- [ ] Cero hex literales fuera de tokens (`var(--wine)`, etc.)
- [ ] Cero fuentes nuevas (solo Archivo + JetBrains Mono + Noto Sans SC)
- [ ] Light + dark themes funcionan en la pantalla
- [ ] Sidebar marca "Almacén CN" como active cuando estás en la ruta
- [ ] Componentes pasaron review del agente `ui-ux-designer`
- [ ] Brand check pasa: badges con tonos del sistema, sin AI slop,
      sin gradientes coloridos

---

## 6. Out of scope / open questions

### Out V1 (ya cubierto en sección 2)

Ver lista completa de "NO incluye" arriba. Resumen breve:
consolidación (wizard), detalle individual, fotos+files, HsDetector
IA, importar Excel, auto-traducción real, suppliers catálogo, scope
por rol, edit, parent/children parciales, borrado UI.

### Open questions resueltas en kickoff

- ✅ **Schema 2 vs 3 vs 4 tablas** → 3 (catálogo + receipts + items)
- ✅ **RLS scope V1** → sin scope, todos ven todo
- ✅ **Parciales** → discretas independientes
- ✅ **Traductor** → 2 campos planos nullable

### Open questions diferidas

- **¿Validación HS code formato `NNNN.NN` o `NNNN.NN.NN`?** V1 acepta
  ambos como text libre (cualquier string de 7-10 chars). Validación
  estricta cuando se integre con SENIAT (SDD-0017).
- **¿Cómo se computa "CBM en bodega"?** V1 = suma de
  `total_cbm` de receipts en status `pendiente_consolidacion` (las
  que esperan zarpe). Cuando una receipt pasa a `consolidado`, no
  cuenta más. Cuando pasa a `incidencia`, tampoco cuenta (sale del
  flujo normal).
- **¿"Recepciones del mes" cuenta por `created_at` o `received_at`?**
  V1 = `received_at` (fecha física de llegada, no de carga en
  sistema). Es lo que matchea el día a día del operario.
- **¿Items con `unit_value_usd` que sumen al total de la recepción?**
  V1 no agregamos campo `declared_value_usd` en receipts. El valor
  total se calcula sumando items × quantity × unit_value en queries.
  Si después queremos snapshot, agregamos columna calculada o trigger.
