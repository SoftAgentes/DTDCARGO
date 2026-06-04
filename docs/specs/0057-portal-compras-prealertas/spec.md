---
sdd: "0057"
title: "Portal — Compras/Prealertas + Proveedores del cliente (cierra el código-por-caja con etiquetas)"
status: in-progress
author: "Claude Code (carril portal · worktree feat/portal)"
created: 2026-06-04
updated: 2026-06-04
supersedes: null
superseded_by: null
related: ["0042", "0031", "0008", "0010"]
confidencialidad: interno
---

# DTD-0057 — Portal · Compras (prealertas) + Proveedores

> Habilita el CTA primario del dashboard del Portal (hoy deshabilitado, slice 5.6 de
> SDD-0042): el cliente registra una **compra** = una **prealerta** (nos avisa que viene
> mercancía de China) contra uno de **sus proveedores** chinos, y obtiene el **código por
> caja** (shipping mark) + las **etiquetas** para que el proveedor las pegue. Cierra la deuda
> **D6 de SDD-0031** (suppliers como input libre → tabla real).

## 1. Resumen en una línea
Dos entidades nuevas — `suppliers_cn` (proveedores chinos del cliente) + `prealertas`
(compras: cliente + proveedor + descripción + tracking + N cajas + estado), con código
secuencial por cliente, accesibles desde el **Portal** (el cliente crea/ve) y el **Studio**
(el operador ve las entrantes); reusa el generador de etiquetas de SDD-0031.

## 2. Por qué (grounding)
- **El Norte lo diseñó** (`portal/app.jsx` → vista "Tus proveedores"): *"Cada compra es una
  prealerta: nos avisás que viene mercancía de China para esperarla y procesarla más rápido
  (lo que las puerta-a-puerta de EE.UU. llaman pre-alerta)."* Registrás un proveedor → generás
  el código + etiquetas → al llegar el envío, el código lo liga automáticamente al proveedor.
- **Falta la base de datos:** no existe `prealertas` ni `suppliers_cn` (el único `suppliers`
  es de **tesorería** 0088 = vendors que DTD paga, otra cosa). El módulo `/studio/proveedores`
  es un stub (EmptyState). SDD-0031 dejó el supplier como **input libre** (D6) esperando esta
  tabla.
- **Las etiquetas YA existen** (SDD-0031 `done`): `/studio/etiquetas` genera planchas PDF
  bilingües ES/中文 con MARKBOX + Box X/Y + QR, leyendo `warehouses_cn` (0008). Acá se REUSA;
  no se reinventa.
- **Terminología (regla del Norte):** de cara al **cliente** = **"Compra"** (CTA "Nueva
  compra"), anclada al concepto **prealerta**; interno/operativo = **"Orden"**. El **valor**
  del registro no cambia; cambia la etiqueta. (No renombrar el CTA a "Compra / Prealerta".)

## 3. Decisiones ancladas
1. **Entidad nueva, NO reusar shipments:** una compra/prealerta es el aviso pre-arribo (puede
   haber N compras que consoliden en 1 envío). El `shipment` se crea al llegar/medir en CN.
2. **Doble acceso (portal + studio):** el **cliente** (portal, `get_portal_client_id` /
   `get_portal_client_markbox`) CRUD de SUS proveedores + SUS compras; el **operador** (user de
   equipo, `get_user_tenant_id`) lee todas las del tenant. RLS fail-closed que cubra ambos
   principales (lección [[0042]]: el cliente del portal no está en `user_tenants`). Donde la RLS
   del cliente no alcance para insertar, la action del portal usa **admin client** scopeado
   explícito por el markbox de sesión (patrón [[project_sdd0054_capa_legal]] Slice C).
3. **Código de compra (esquema del Norte, reconciliado en Slice B):**
   `DTD-{clientNo}-{supplier_seq}-{order_seq}` — `clientNo` del MARKBOX,
   `supplier_seq` = nº de proveedor POR CLIENTE (#1, #2, …), `order_seq` = nº de compra de
   ESE (cliente, proveedor). RPCs `next_supplier_seq(client)` + `next_order_seq(client,
   supplier)`. El **número de caja NO va en el código**: por caja se rotula el MISMO `code`
   + "Caja M/N" como texto (es el shipping mark que imprime SDD-0031).
   *(El borrador de Slice A usaba `DTD-XXXX-N` + por-caja `-M`; se descartó al reconciliar.)*
4. **Reusa etiquetas (SDD-0031):** desde una compra se generan las etiquetas con su código +
   boxes + el `warehouses_cn` destino. El selector de supplier de `/studio/etiquetas` pasa de
   input libre a dropdown de `suppliers_cn` (cierra D6 de 0031) — en Slice C.
5. **Migración aditiva `0105`** (libre mirando todas las ramas: main=0103, feat/calculadora=0104).
   **NO** se aplica a prod en esta corrida. Spec **0057** (0055 = calc, feat/calculadora).
6. **Sin Zod.** Patrones del repo (portal: estética paper/wine + `getPortalClient`; studio:
   server actions + `<ActionButton>` + `revalidatePath`).

## 4. Slices

### Slice A — Fundación (esta corrida) · migración + lib + tests · SIN UI
- **Migración `0105_portal_compras.sql`** (aditiva · NO a prod):
  - `suppliers_cn`: `id uuid pk`, `tenant_id → tenants`, `client_markbox text` (dueño),
    `name text not null`, `city text`, `wechat text`, `contact text`, `notes text`,
    `deleted_at`, `created_at`, `updated_at`. Índice `(tenant_id, client_markbox)`. RLS doble:
    el cliente del portal CRUD donde `client_markbox = get_portal_client_markbox()`; el operador
    (user del tenant) read; `service_role all`.
  - `prealertas`: `id uuid pk`, `tenant_id`, `client_markbox`, `supplier_id → suppliers_cn(id)
    on delete set null`, `code text` (`DTD-XXXX-N`, unique/tenant), `description text not null`,
    `tracking_cn text`, `boxes int not null check (boxes >= 1)`, `est_value_usd numeric(12,2)`,
    `status text not null default 'anunciada' check (status in
    ('anunciada','en_camino','recibida','consolidada','cancelada'))`, `received_at timestamptz`,
    `shipment_id uuid` (link futuro al envío, nullable), `deleted_at`, `created_at`, `updated_at`.
    Índices `(tenant_id, client_markbox)`, `(tenant_id, status)`. RLS doble como arriba.
    Validación cross-tenant del `supplier_id` (trigger BEFORE INSERT/UPDATE, lección [[0045]]).
  - **RPC** `next_prealerta_seq(p_client_markbox text)` → próximo N para `DTD-XXXX-N`
    (secuencial por cliente; security definer, `set search_path=public`; tolera la race con el
    `unique(tenant,code)` como `next_quote_code`). Grant authenticated.
- **`lib/studio/prealertas/`** (o `lib/portal/`): `types.ts` (`Supplier`, `Prealerta`,
  `PrealertaStatus`, `validateSupplierInput`, `validatePrealertaInput`, label/tone helpers) +
  `queries.ts` (`listSuppliers`/`listPrealertas` por markbox o por tenant; `prealertaStats` para
  el operador) — funciones puras que reciben `SupabaseClient`.
- **Tests Vitest:** validadores (boxes≥1, name no vacío, status válido), helpers de label/tone,
  el armado del código `DTD-XXXX-N` / `-N-M`.

### Slice B — Portal (cliente) · "Tus proveedores" + "Nueva compra"
- Vista `/portal/(app)/proveedores` ("Tus proveedores"): listar/agregar/editar proveedores +
  el explicador del Norte ("por qué registrar a tu proveedor importa"). `<ActionButton>` patrón
  portal.
- "Nueva compra": form (elegir proveedor + descripción + tracking + N cajas + valor opcional) →
  crea la prealerta con código + muestra el **código por caja** + CTA a generar/descargar
  etiquetas. Habilita el botón "Nueva compra" del dashboard (hoy deshabilitado).
- Vista "Mis compras" (listado de prealertas del cliente + estado).

### Slice C — Studio (operador) + etiquetas
- Backear `/studio/proveedores` (hoy stub) con `suppliers_cn` + vista de **prealertas
  entrantes** (cola para el operador; matchear al llegar a CN → `shipment_id`).
- `/studio/etiquetas`: el selector de supplier pasa de input libre a **dropdown de
  `suppliers_cn`** (cierra D6 de SDD-0031); generar etiquetas desde una prealerta.

## 5. Acceptance — Slice A
- [x] Migración `0105` aplica limpio: `suppliers_cn` + `prealertas` con RLS doble (portal
      client CRUD lo suyo · operador read del tenant · service_role all), trigger cross-tenant
      del supplier_id, RPC `next_prealerta_seq`.
- [x] `lib/.../prealertas`: validadores + queries puras + armado del código. Tests verdes.
- [x] `node scripts/verify.mjs` 🟢 (en el worktree). Migración `0105` **NO** aplicada a prod.
- [x] **Frontera:** nada del sitio público; el portal es superficie Supabase (permitido).

### Slice B / C
- [x] B: portal "Tus proveedores" + "Nueva compra" (código + etiquetas) + "Mis compras";
      habilita el CTA del dashboard.
- [ ] C: `/studio/proveedores` backeado + cola de prealertas entrantes + dropdown de supplier
      en `/studio/etiquetas` (cierra D6 de 0031).

## 6. Fuera de alcance
- **NO** auto-matching prealerta↔arribo CN (Slice C lo hace manual; auto = futuro).
- **NO** tracking en vivo del courier chino (solo se guarda el número). **NO** reescribir el
  generador de etiquetas (se reusa). **NO** aplicar `0105` a prod. **NO** Zod.

## 7. Notas de implementación

### Slice A — Fundación (2026-06-04, worktree `feat/portal`)
- **Migración `0105_portal_compras.sql`** (aditiva · NO aplicada a prod):
  - Tablas `suppliers_cn` + `prealertas` según §4. `prealertas.unique(tenant_id, code)`
    (no global) — el `code` es secuencial **por cliente**, no por tenant.
  - **Helper nuevo `get_portal_client_tenant()`** (security definer): resuelve el `tenant_id`
    del cliente del portal desde `client_users` (el cliente NO está en `user_tenants`). Se
    necesita para forzar `tenant_id` en el `WITH CHECK` de los INSERT/UPDATE que hace el
    propio cliente del portal — si no, no tendría de dónde derivar el tenant en la policy.
  - **RLS doble fail-closed** en ambas tablas:
    - Cliente del portal: policies SELECT/INSERT/UPDATE separadas, ownership por
      `client_markbox = get_portal_client_markbox()` + `tenant_id = get_portal_client_tenant()`
      en el CHECK. El **DELETE del cliente es soft** (UPDATE de `deleted_at`), cubierto por la
      policy UPDATE — no se expone DELETE físico al cliente.
    - Operador del tenant: SELECT por `get_user_tenant_id()` (read-only acá; el CRUD del
      operador llega en Slice C).
    - `service_role all` (para el admin-client scopeado de las actions del portal, patrón
      capa-legal Slice C).
  - **Validación cross-tenant del `supplier_id`** (lección 0045/0093): helper
    `prealerta_supplier_in_tenant()` + trigger `prealertas_validate_supplier` BEFORE
    INSERT/UPDATE (null permitido = compra sin proveedor). La FK ya garantiza existencia; el
    trigger garantiza mismo-tenant + no-borrado.
  - **RPC `next_prealerta_seq(p_client_markbox)`**: devuelve el próximo `int N` mirando el
    sufijo numérico (`-(\d+)$`) de los `code` de ESE cliente en su tenant (resuelto vía
    `coalesce(get_portal_client_tenant(), get_user_tenant_id())`, así sirve tanto al cliente
    del portal como al operador). Calca `next_quote_code`. **La race se tolera con el
    `unique(tenant, code)`: la server action de Slice B debe REINTENTAR el insert ante un
    choque de código** (recalcular seq + reintentar).
  - Triggers `touch_updated_at` en ambas tablas. Grants explícitos (auto-expose OFF). Sin seed.
- **`lib/studio/prealertas/`** (carpeta de dominio, ≥3 archivos — convención AGENTS.md; igual
  que `naviera/`):
  - `types.ts`: `Supplier`, `Prealerta`, `PrealertaStatus` (+ `PREALERTA_STATUSES` /
    `PREALERTA_STATUS`), `SupplierInput`, `PrealertaInput`, `*ActionState`;
    `validateSupplierInput` (name no vacío), `validatePrealertaInput` (description no vacío,
    boxes entero ≥ 1, status normaliza a `anunciada`, est_value ≥ 0 si viene),
    `prealertaStatusLabel`/`prealertaStatusTone`/`isPrealertaStatus`, y `boxCode(code, n)` →
    `DTD-XXXX-N-M` (soporta boxes > 9, sin padding; normaliza n < 1 a 1).
  - `queries.ts`: `listSuppliers(supabase, {markbox?})`, `listPrealertas(supabase,
    {markbox?, status?})`, `prealertaStats(supabase)` (conteo por status para el operador;
    defensivo si la tabla no existe). Coerción numeric→number. El cliente del portal pasa
    `markbox` = defensa en profundidad (principal team+portal a la vez).
- **Tests** (`__tests__/types.test.ts`, 1 archivo, todos verdes dentro de `verify.mjs`):
  validadores (name/description vacíos, boxes 0/negativo/no-entero, status inválido, est_value
  negativo, est_value como string), `boxCode` (N-M, boxes > 9, normalización), label/tone para
  cada status + casos desconocidos.
- **Gate `node scripts/verify.mjs` VERDE** desde el worktree (lint 0 errores · rsc-boundary ·
  typecheck · 1048 tests · docs:check). Migración `0105` **NO** aplicada a prod (lo hace el
  founder). Sin push.
- **Pendiente Slice B/C** (sin tocar acá): UI del portal (proveedores + nueva compra + mis
  compras), action con reintento ante choque de `code`, backear `/studio/proveedores` + cola
  de prealertas entrantes, dropdown de supplier en `/studio/etiquetas` (cierra D6 de 0031).

### Slice B — Portal UI (2026-06-04, worktree `feat/portal`)

**Reconciliación de la fundación (migración `0105` editada in-place — sigue SIN prod):**
- El código pasó del borrador `DTD-XXXX-N` al esquema del Norte
  `DTD-{clientNo}-{supplier_seq}-{order_seq}` (`PortalSuppliers` en `_norte/portal/app.jsx`):
  cada proveedor tiene un nº POR CLIENTE y cada compra a ese proveedor incrementa el order#.
  - `suppliers_cn`: + columna `supplier_seq int not null` + `unique(tenant_id, client_markbox,
    supplier_seq)`. RPC **`next_supplier_seq(p_client_markbox)`** (próximo nº de proveedor;
    cuenta el `max(supplier_seq)` incluyendo borrados → no reusa números todavía rotulados).
  - `prealertas.code` = `DTD-{clientNo}-{supplier_seq}-{order_seq}`. **`next_prealerta_seq`
    reemplazada por `next_order_seq(p_client_markbox, p_supplier_id)`** (cuenta las prealertas
    vivas de ese proveedor para ese cliente + 1). Se mantiene `unique(tenant_id, code)` como
    red anti-race → la action reintenta ante `23505`.
  - El **número de caja NO es un 5º segmento**: `lib/studio/prealertas/types.ts` reemplazó
    `boxCode(code, n)` por `buildPrealertaCode(markbox, supplierSeq, orderSeq)` +
    `buildLabels(code, totalBoxes)` → `[{code, boxN, totalBoxes}]` (mismo code en todas las
    cajas, "Caja M/N" como texto). Helpers nuevos: `clientNoFromMarkbox`, `summarizeSuppliers`
    (proveedor + nº de compras + próximo código para la lista del portal). Tests actualizados.

**Portal UI (estética real paper/wine, tokens `var(--*)`, es-VE / voseo, sentence-case):**
- **`app/portal/(app)/proveedores/`** — "Tus proveedores": header + "Nueva compra" (primary) +
  explicador del Norte + card "Por qué registrar a tu proveedor importa" (Rapidez/Control
  total) + mensaje verde + lista de proveedores (`#n`, nombre, N compras, próximo código,
  "Re-comprar") + alta inline de proveedor + **modal "Nueva compra"** (proveedor existente o
  nuevo → descripción → cajas → valor opcional → tracking opcional → crea la prealerta → muestra
  el **código** + CTA "Generar etiquetas"). `SuppliersClient` (client) + `actions.ts`.
- **`app/portal/(app)/compras/`** — "Mis compras": listado read-only de prealertas (código,
  proveedor, descripción, cajas, estado con `PrealertaStatusBadge`), recientes primero; cada
  fila linkea a sus etiquetas.
- **Etiquetas (V1 básico):** `app/portal/(app)/compras/[code]/etiquetas` → vista imprimible
  (`LabelsClient`): una etiqueta por caja con "SHIPPING TO DTD-CARGO" + el code + "Caja M/N" +
  nombre del cliente + placeholder de QR; botón "Descargar / imprimir" (`window.print()` con
  CSS `@media print` que aísla la grilla). **Diferido (TODO comentado):** adjuntar packing
  list / factura / fotos antes de generar (paso "docs" del `LabelGenerator` del Norte).
- **Dashboard:** el CTA "Nueva compra" (antes deshabilitado "Próximamente") ahora linkea a
  `/portal/proveedores`. **`PortalNav`:** + ítem "Compras" (cubre proveedores + compras).

**Server actions** (`proveedores/actions.ts`, `"use server"`): `createSupplierAction` /
`updateSupplierAction` (validan con `validateSupplierInput`) · `createPrealertaAction`
(`validatePrealertaInput`; resuelve markbox vía `get_portal_client_markbox`, arma el code con
`next_order_seq` + `buildPrealertaCode`, **reintenta hasta 5× ante `23505`** recomputando el
order_seq). Usan el **client de SESIÓN** (`createClient`) — la RLS doble de 0105 permite la
escritura del cliente; service_role queda de respaldo. `revalidatePath` de `/portal`,
`/portal/proveedores`, `/portal/compras`. Sin Zod; anti doble-submit con `pending`.

**Gate `node scripts/verify.mjs` VERDE** desde el worktree (lint 0 errores · rsc-boundary ·
typecheck · 1056 tests · docs:check). Migración `0105` **NO** aplicada a prod. Sin push.

**Pendiente Slice C** (sin tocar acá): backear `/studio/proveedores` + cola de prealertas
entrantes para el operador + dropdown de supplier en `/studio/etiquetas` (cierra D6 de 0031).
