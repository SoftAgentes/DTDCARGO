---
sdd: "0072"
title: "Orden de venta (Sales Order · modelo QuickBooks): el estimado confirmado, formal y trazable"
status: draft
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
- [ ] La confirmación de Warehouse (CBM/peso reales) genera Factura (0021), **parcial por defecto**.
- [ ] Sin requisitos completos → "faltan datos", NO factura. `invoices.sales_order_id` + provenance.

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

---
<!-- Validar con: node scripts/build-docs-index.mjs --check · regenerar índice: node scripts/build-docs-index.mjs -->
