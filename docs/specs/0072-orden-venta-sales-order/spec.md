---
sdd: "0072"
title: "Orden de venta (Sales Order · modelo QuickBooks): el estimado confirmado, formal y trazable"
status: in-progress
author: "Claude Code (carril comercial · sesión con founder 2026-06-07)"
created: 2026-06-07
updated: 2026-06-12
supersedes: null
superseded_by: null
related: ["0061", "0071", "0057", "0021", "0041", "0016", "0044", "0058"]
confidencialidad: interno
---

# DTD-0072 — Orden de venta (Sales Order)

> **Nota de numeración (2026-06-12):** renumerado de **0064 → 0072** (su gemela orden-compra pasó de 0063 → 0071 el mismo día). El 0064 ya estaba tomado en `main` por `reestructuracion-mensaje-ux-seo` cuando se cortó este lane; 0072 verificado libre en todas las ramas. Migración de Fase 1 = **0125** (primer libre tras 0124).

> Sub-SDD de **0061 Fase D** (lado VENTAS · gemela de 0071 Orden de compra). Construye la
> **Orden de venta (`OV-`)**: el estimado **confirmado y formal** (distinto del estimado,
> que es intención descartable). Nodo de **trazabilidad** del QB y disparador de la
> facturación cuando la mercancía llega y Warehouse confirma.

## 1. Resumen en una línea

El asesor (o el sistema) **convierte un estimado en Orden de venta** (`OV-YYYY-NNNN`) — snapshot
editable del estimado, **linkeada al estimado (arriba) y a la(s) prealerta(s) física(s) (abajo)**;
cuando el operario recibe + Warehouse confirma con datos reales, **se factura** (parcial por defecto).

## 2. Por qué (grounding · verificado)

- **El estimado es intención descartable** (founder): `quotes` (EST-, 0061) capta cálculos web/manual
  que "se vuelven basura". Falta el documento **formal** que confirma la venta y soporta otros servicios.
- **El embarque ≠ orden.** `shipments` es lo físico; la OV es el documento comercial/contable que
  dispara facturación y carga la trazabilidad.
- **Las piezas alrededor existen:** Estimado (0061), Prealerta (0057, lo físico/escaneable),
  Recepción CN (`warehouse_receipts`, 0016, con CBM/peso reales), Factura (0021), Cobranzas (0041).
  Falta la **OV** y el disparo **recepción→factura**.
- **Cierra la cadena de links** (founder): `Factura ← OV ← Estimado` · `Bill ← OC ← OV ← Estimado`.

## 3. Decisiones ancladas (con el founder · sesión 2026-06-07)

1. **OV = entidad nueva** (`sales_orders`, `OV-YYYY-NNNN`). Formal; soporta otros servicios; es el
   nodo de trazabilidad. NO absorbe la prealerta → **linkeadas** (venta ↔ compra/físico, como QB).
2. **estimado → OV:** conversión que **snapshotea** los datos del estimado y **permite editarlos**
   (entre estimado y OV PUEDE haber cambios). Link bidireccional `sales_orders.quote_id`.
3. **OV creable también manual** (sin estimado) — B2B / otros servicios.
4. **OV ↔ prealerta(s):** una OV se cumple con 1+ prealertas (`prealertas.sales_order_id`, aditivo).
   El operario escanea la **caja (prealerta)** en CN → resuelve la **OV**.
5. **Auto-Factura en la confirmación de Warehouse** (no botón): la recepción con CBM/peso **reales**
   dispara la factura (0021). **GATED por requisitos**: CBM ok + peso ok + verificado (packing list del
   proveedor **o** medido en warehouse) + adjuntos. Si faltan datos → **NO factura → "faltan datos"**.
6. **Factura PARCIAL por defecto** (1 OV : N facturas): si llegan 6 de 10 cajas, factura por lo recibido;
   esperar-completo = opción, no default.
7. **Factura en recepción China · Cobranza después** (al llegar a VE · Financiamiento 100%). El sistema
   ya separa Factura (0021) de Cobranzas (0041).

## 4. Modelo de datos + trazabilidad

```
ESTIMADO (quotes, EST-)
   │ quote_id (link · puede haber cambios)
   ▼
ORDEN DE VENTA (sales_orders, OV-)         ← NUEVO en 0072
   ├─ client_markbox · quote_id(null) · status · snapshot editable · totales
   ├── prealertas.sales_order_id (1:N) ─────────► físico/escaneable (recepción CN)
   ├──(Fase 2) recepción Warehouse OK ─► FACTURA (invoices.sales_order_id) → COBRANZA
   └──(0071) ─► ORDEN DE COMPRA de DTD ─► Bill     (compra asistida)
```

**Tablas/RPC (migración 011N · re-chequear al implementar):** `sales_orders` + RLS ·
`next_sales_order_code` → `OV-YYYY-NNNN` · columnas aditivas `prealertas.sales_order_id`
(FK nullable) y (Fase 2) `invoices.sales_order_id`.
**Status:** `confirmada → parcial → facturada → cerrada · cancelada`.

## 5. Approach por fases

### Fase 1 — fundación OV
- Migración: `sales_orders` + RLS + `next_sales_order_code` + `prealertas.sales_order_id`.
- `lib/studio/sales-orders/` (queries + types + validators, sin Zod).
- Conversión **estimado → OV** (snapshot + editable) + link bidireccional + OV manual.
- Link **OV ↔ prealerta**; resolución desde el escaneo CN (caja → OV).
- Módulo **`/studio/ordenes-venta`** (lista + detalle + provenance "viene de EST-…").

### Fase 2 — auto-Factura en la confirmación de Warehouse
- Hook en la confirmación de `warehouse_receipts`: resuelve la OV → valida requisitos (CBM/peso/
  packing-list/adjuntos) → **genera Factura (0021)** con montos reales, **parcial por defecto**;
  si faltan datos → bloquea con "faltan datos". `invoices.sales_order_id` + provenance.

### Fuera de 0072
- Puente **OV → OC de DTD** (botón "Convertir en orden de compra" · conecta con 0071).
- Alerta de cobranza **pre-arribo** (D4, marítimo · naviera 0047 + mailing 0026).

## 6. Acceptance

### Fase 1
- [ ] `sales_orders` + RLS + `next_sales_order_code` → `OV-`. `prealertas.sales_order_id` aditivo.
- [ ] "Convertir en orden" desde un estimado: OV con snapshot editable + link bidireccional. OV manual.
- [ ] Asignar 1+ prealertas a una OV; el escaneo de la prealerta en CN resuelve la OV.
- [ ] `/studio/ordenes-venta` lista + detalle con provenance. Datos intactos. `verify` 🟢. `ui-ux` OK.

### Fase 2
- [x] La confirmación de Warehouse (CBM/peso reales) genera Factura (0021), **parcial por defecto**.
- [x] Sin requisitos completos → "faltan datos", NO factura. `invoices.sales_order_id` + provenance.

## 7. Fuera de alcance

- La OC de DTD (0071) y el puente OV→OC. Alerta de cobranza pre-arribo (D4).
- Modificar Prealertas (0057), Almacén (0016) o Facturación (0021) más allá del link/hook.

## 8. Diseño

Módulo + drawer nuevos → `ui-ux-designer`. Reusa primitivas del Studio + tokens `var(--*)`.
Sin mockup del Norte para esta pantalla → `DESIGN-CHECK` si hace falta diseño nuevo.

## 9. Notas

- Gemela de 0071 (misma mecánica de conversión QB, lado ventas).
- Hereda patrón de link (0058 `kommo_lead_id`, 0061 OV↔prealerta) y de posteo (0021 factura).
- `sales_orders.quote_id` y `prealertas.sales_order_id` = FKs suaves; `invoices.sales_order_id` en Fase 2.

## 10. Notas de implementación (Fase 1 · 2026-06-12 · vía harness)

**Estado:** Fase 1 implementada en `feat/orden-venta`. Gate `node scripts/verify.mjs` 🟢 (1739 tests, incl. 26 nuevos). Migración 0125 **NO** aplicada a prod (la aplica el founder). `reviewer` **APPROVED** · `ui-ux-designer` **nits** (provenance EST- aplicada · #3 jerarquía) · auditoría Supabase OK (1 nota sistémica no-bloqueante: `next_*_code` security-definer sin check de tenant en el parámetro, idéntico a 0124/0007/0088 en prod).

**Archivos:**
- `supabase/migrations/0125_sales_orders.sql` — `sales_orders` (OV-YYYY-NNNN) + RLS fail-closed por tenant (espejo 0124) + `next_sales_order_code` (security-definer, search_path public) + columnas aditivas `prealertas.sales_order_id` (FK real on delete set null) y `quotes.sales_order_id` (uuid suave, marca de "convertido") + CHECK `'sales_order'` en `entity_audit_log` + FK indexes + grants explícitos + trigger updated_at. Aditiva, sin DDL destructivo.
- `lib/studio/sales-orders/{types,queries,actions}.ts` + `__tests__/types.test.ts` (26 tests). `convertEstimateToSalesOrder` (snapshot editable vía `buildSalesOrderFromQuote` + link bidireccional idempotente: rechaza estimado ya convertido + guard anti-race), `createSalesOrder` (manual), `updateSalesOrder` (solo `confirmada`), `setSalesOrderStatus`/`cancelSalesOrder` (valida grafo), `assign`/`unassignPrealertaFromSalesOrder`, `getSalesOrderForPrealerta` (resolución inversa lista para el escaneo CN en Fase 2). La provenance trae el code real del estimado vía embed `quotes(quote_code)`.
- `app/studio/(app)/ordenes-venta/` — módulo (lista + KPIs + drawers detalle/creación/conversión, provenance "viene del estimado EST-…") espejando ordenes-compra; solo tokens `var(--*)` + primitivas del Studio.
- Aditivos: `StudioSidebar` (ítem `sales-orders`), `quote-{types,queries}` y `prealertas/{types,queries}` (columna `sales_order_id`).

**Decisiones:** link bidireccional = `sales_orders.quote_id` (FK real) + `quotes.sales_order_id` (uuid suave, mismo criterio que 0124 para no acoplar el orden de migraciones); `parcial`/`facturada` los pone SOLO el motor (Fase 2), no la UI (`canTransition` los excluye, `isAllowedTransition` los admite); snapshot editable solo en `confirmada`.

**Pendiente (al cierre de Fase 1):** Fase 2 — ver §11.

## 11. Notas de implementación (Fase 2 · 2026-06-12 · vía harness)

**Estado:** Fase 2 implementada en `feat/orden-venta` (encima de Fase 1). Gate `node
scripts/verify.mjs` 🟢 (1761 tests, +22 nuevos de auto-facturación). Migración 0126
**NO** aplicada a prod (la aplica el founder). `reviewer`/`ui-ux` pendientes (no
auto-aprobado).

**Hallazgo arquitectónico clave (puente recepción↔OV):** la recepción CN real es
`warehouse_receipts_cn` (0016), **no** `warehouse_receipts` (nombre del spec), y NO
tenía FK a `prealertas` — usa `client_markbox`/`supplier_name` textuales. La OV se ata
a las CAJAS vía `prealertas.sales_order_id` (Fase 1). Para resolver "qué OV cumple la
caja recibida" + parcial + idempotencia, 0126 agrega el enlace que la Fase 1 dejó
preparado (`getSalesOrderForPrealerta`): `warehouse_receipts_cn.prealerta_id` (la caja
que la recepción materializa) y `.sales_order_id` (OV denormalizada). El "momento de
confirmación de Warehouse" = transición a **`consolidado`** (los CBM/peso reales ya se
capturan al recibir; consolidar es el cierre formal del almacén).

**Archivos:**
- `supabase/migrations/0126_sales_order_invoicing.sql` — aditiva, sin DDL destructivo,
  idempotente. `invoices.sales_order_id` (FK real on delete set null · provenance) +
  puente `warehouse_receipts_cn.prealerta_id`/`.sales_order_id` (FK suaves) + tracking
  idempotencia `prealertas.invoice_id` (FK suave · marca de facturada) + `.invoiced_at`
  + FK indexes. Las 3 tablas YA tienen RLS por tenant → las columnas heredan; no
  reabre el CHECK de `entity_audit_log` (audita con `invoice`/`sales_order` ya
  presentes). Reusa `next_invoice_code` (0077) y `postInvoiceJournalEntry` (0040) desde
  la app — no los redefine.
- `lib/studio/sales-orders/invoicing.ts` — capa PURA testeable: `canAutoInvoice` (gate
  §3.5: CBM>0 + peso>0 + verificación [packing list proveedor **o** medido] + adjuntos
  + no huérfana → si falta algo `{ok:false, reason:"faltan datos: …"}`),
  `computeReceiptInvoiceAmount` (monto parcial), `nextStatusAfterInvoice`
  (parcial/facturada vía `isAllowedTransition`), `salesOrderAcceptsInvoicing`.
- `lib/studio/sales-orders/actions.ts` — `autoInvoiceForReceipt({admin, tenantId,
  receiptId})`: resuelve OV (denormalizada o vía prealerta) → gate → **reclama la caja
  con `UPDATE … WHERE invoice_id IS NULL` (guard anti-race)** → crea factura `emitida`
  reusando `next_invoice_code` + asiento `postInvoiceJournalEntry` (best-effort) → liga
  `prealertas.invoice_id` → setea status OV. NO throwea (devuelve `AutoInvoiceResult`).
- `app/studio/(app)/cn/actions.ts` — hook **best-effort** (try/catch) en
  `changeReceiptStatusAction` cuando consolida: si falla/faltan datos la consolidación
  se completa igual; deja un evento `note` en el timeline de la recepción ("Factura …
  generada" o "No se facturó: faltan datos …").
- `lib/studio/sales-orders/queries.ts` (+`listInvoicesForSalesOrder`) + `page.tsx` +
  `OrdenesVentaClient`/`OvDrawer` — provenance: lista de facturas generadas por la OV.
- `__tests__/invoicing.test.ts` — 22 tests: gating (cada requisito faltante), monto
  parcial proporcional + ajuste final exacto + cuadre de suma, idempotencia (status),
  transición parcial→facturada.

**Decisiones (para el review):**
- *Idempotencia por caja:* `prealertas.invoice_id` + guard `UPDATE … WHERE invoice_id
  IS NULL`. 1 OV : N facturas = facturar SOLO las cajas no facturadas de la recepción.
  El cerrojo (`invoiced_at`) se revierte si el monto es 0 o si el insert/code falla
  (las cajas vuelven al pool). on delete set null en la FK → anular la factura las
  rehabilita.
- *Monto real:* PROPORCIONAL al snapshot por cajas (`total_usd × recibidas/totales`),
  con la recepción FINAL absorbiendo el restante exacto (cuadre sin centavos sueltos).
  Motivo: no hay motor de tarifa de venta por-caja reutilizable trivial (0053 = costos
  internos; 0055 = cotiza envío completo). Alineado con §3.5 ("si recalcular es
  inviable, factura proporcional al snapshot"). **Punto a validar con el founder:** si
  quiere recálculo por CBM real en vez de prorrateo por cajas, es un cambio acotado en
  `computeReceiptInvoiceAmount`.
- *IVA:* hereda el toggle `tenants.iva_enabled` (igual que 0021); con ON el total se
  desglosa base/IVA 16%.

**Pendiente:** `reviewer` + `ui-ux-designer`. Aplicar `0125` y `0126` a prod (founder).
Puente OV → OC de DTD + alerta de cobranza pre-arribo (D4) siguen fuera de 0072.

---
<!-- Validar con: node scripts/build-docs-index.mjs --check · regenerar índice: node scripts/build-docs-index.mjs -->
