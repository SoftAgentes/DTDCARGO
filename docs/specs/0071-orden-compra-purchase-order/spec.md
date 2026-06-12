---
sdd: "0071"
title: "Orden de compra (Purchase Order · compra asistida → Bill): el lado COMPRAS del modelo QuickBooks"
status: done
author: "Claude Code (carril comercial · sesión con founder 2026-06-07)"
created: 2026-06-07
updated: 2026-06-12
supersedes: null
superseded_by: null
related: ["0061", "0057", "0044", "0021", "0041", "0043", "0058", "0062", "0016"]
confidencialidad: interno
---

# DTD-0071 — Orden de compra (Purchase Order · compra asistida)

> **Nota de numeración (2026-06-12):** renumerado de **0063 → 0071** y migración **0114 → 0124**. Los números 0063 (`servicios-detalle-publico`) y 0114 (`financiero_china`) ya estaban tomados en `main` cuando se cortó este lane; 0071/0124 verificados libres en todas las ramas. Sin cambios de lógica — solo numeración (carpeta, front-matter, comentarios y archivo de migración).

> Sub-SDD de **0061 Fase D** (lado COMPRAS). Construye la **OC de DTD**: cuando DTD
> **compra la mercancía POR el cliente** (agente de compra · "compra asistida"),
> registra qué le compra al proveedor → al recibir genera el **Bill** (0044). Cierra
> la simetría QB: ventas (Orden de venta → Factura) ↔ compras (Orden de compra → Bill).

## 1. Resumen en una línea

DTD crea una **Orden de compra `OC-YYYY-NNNN`** para comprarle al proveedor chino por
cuenta del cliente; la OC trackea proveedor + ítems + costo, se liga (opcional) a la
Orden de venta que la originó, y **al recibir la mercancía genera un Bill** en Tesorería.

## 2. Por qué (grounding · verificado)

- **La compra asistida ya es un negocio real, sin riel en el ERP.** El espejo Kommo
  (SDD-0043) tiene un pipeline **"Compra asistida" con 232 leads** (SDD-0062 §2.1, dato
  de prod). Hoy el ERP **no modela** ese flujo → no hay trazabilidad ni Bill automático.
- **El lado COMPRAS del QB está a medias.** 0061 §4 mapea Órdenes de compra = 2 sub-tipos:
  *OC de cliente* = **Prealertas** (0057, **existe**) y *OC de DTD* (**NUEVA**). El Bill ya
  existe (**0044 Tesorería**: `bill-queries.ts`, `BillDrawer`, `supplier-payment-posting`).
  Falta la **OC de DTD** y su puente a Bill.
- **Cierra la cadena de trazabilidad** que pidió el founder: `Bill ← OC de DTD ← Orden de
  venta ← Estimado` (los 3 links).

## 3. Decisiones ancladas (con el founder · sesión 2026-06-07)

1. **OC de DTD = entidad nueva** (`purchase_orders`, `OC-YYYY-NNNN`). **NO absorbe la
   prealerta** — la prealerta (OC de cliente) sigue siendo su propia entidad (0057). El
   **módulo "Órdenes de compra" LISTA las dos** (prealertas etiquetadas "OC cliente" +
   purchase_orders "OC DTD"). Mismo criterio "link, no absorber" que la Orden de venta.
2. **Genera Bill al recibir** (0044). La OC de DTD, al confirmarse la recepción, crea el
   Bill (lo que DTD le debe al proveedor) → Pay Bills / Tesorería.
3. **Link opcional a Orden de venta** (`purchase_orders.sales_order_id`, nullable). Una OC
   puede nacer de una OV (drop-ship) **o standalone** (un lead de "Compra asistida" de Kommo
   pide comprar, sin OV previa) → la OC NO depende de que exista la OV.
4. **Proveedor:** reusa `suppliers_cn` (0057) cuando aplica; permite proveedor libre.
5. **No romper datos.** Aditivo. Migración **0124** (verificado libre en todas las ramas al crear).

## 4. Modelo de datos + trazabilidad

```
                       (cliente pide / lead "Compra asistida" Kommo / desde una OV)
                                        │
ORDEN DE COMPRA de DTD (purchase_orders, OC-)   ← NUEVO en 0071
  · client_markbox · supplier (suppliers_cn | libre) · ítems + costo USD
  · sales_order_id (→ OV, nullable) · status · bill_id (nullable)
        │ recepción confirmada (mercancía llega / proveedor factura a DTD)
        ▼
BILL (0044 Tesorería)  → Pay Bills
        ▲
        └─ trazabilidad: "este Bill viene de OC-0007 ← OV-0042 ← EST-2026-0042"
```

**Tablas/RPC de 0071 (migración 0124):**
- `purchase_orders` (OC-) + RLS por tenant: `client_markbox`, `supplier_id` (FK
  `suppliers_cn`, nullable) / `supplier_name` libre, `sales_order_id` (nullable, FK futura),
  `status`, `total_cost_usd`, `bill_id` (nullable, link al Bill generado), `notes`, timestamps.
- `purchase_order_items` (líneas): `purchase_order_id`, `description`, `qty`, `unit_cost_usd`, `position`.
- `next_purchase_order_code(p_tenant_id uuid)` → `OC-YYYY-NNNN` (cuenta solo `OC-%`, padding 4).
- Link a `bills` (0044): `purchase_orders.bill_id` (la OC apunta al Bill que generó).

**Status (enum de display):** `borrador → confirmada → recibida → facturada (Bill) → cerrada · cancelada`.

## 5. Approach por fases

### Fase 1 (0071 · ESTE spec) — fundación OC de DTD
- Migración **0124**: `purchase_orders` + `purchase_order_items` + RLS + `next_purchase_order_code` + link a `bills`.
- `lib/studio/purchase-orders/` (queries + types + validators manuales, sin Zod, patrón del repo).
- Crear/editar una OC de DTD (proveedor + ítems + costo); transiciones de status.
- **Recibir → generar Bill**: server action que postea el Bill en Tesorería (reusa
  `supplier-payment-posting` / `bill-queries` de 0044) y liga `bill_id` ↔ `purchase_order_id`.
- Módulo **`/studio/ordenes-compra`**: lista **prealertas (OC cliente) + purchase_orders
  (OC DTD)** juntas + detalle con provenance + drawer de creación.
- Tests (Vitest) de los criterios + helpers puros.

### Fuera de 0071 (sub-SDDs / fases siguientes)
- **Puente OV → OC de DTD** (botón "Convertir en orden de compra" desde la Orden de venta) →
  llega cuando exista la OV (sub-SDD hermano).
- **Cruce con Kommo "Compra asistida"** (importar el lead → OC) — reusa `lib/studio/kommo*`.
- Compra asistida avanzada (cotización al proveedor, tracking de compra, multi-proveedor, pagos).

## 6. Acceptance (Fase 1 · 0071)

- [ ] `purchase_orders` + `purchase_order_items` con RLS por tenant + `next_purchase_order_code` → `OC-`.
- [ ] Crear/editar una OC de DTD (proveedor + ítems + costo); status lifecycle.
- [ ] "Recibir" la OC → **genera un Bill** en Tesorería (0044) con link bidireccional (`bill_id` ↔ `purchase_order_id`).
- [ ] `/studio/ordenes-compra` lista OC cliente (prealertas) + OC DTD (purchase_orders) + provenance.
- [ ] Datos `prealertas`/`bills` intactos. `node scripts/verify.mjs` 🟢. `ui-ux-designer` OK.

## 7. Fuera de alcance

- La **Orden de venta** (sub-SDD hermano) y el puente OV→OC.
- Modificar Prealertas (0057) o Tesorería/Bill (0044) más allá del link/posteo.
- Compra asistida "completa" (negociación, pagos al proveedor, multi-proveedor) — por etapas.

## 8. Diseño

Módulo + drawer nuevos → `ui-ux-designer` antes del commit. Reusa primitivas del Studio
(DrawerShell, Badge, ActionButton, EmptyState, KpiCard) + tokens `var(--*)` + `BRAND.md`.
Norte: el pipeline "Compra asistida" existe en Kommo; sin mockup del Norte para esta pantalla
→ si hace falta diseño nuevo, `DESIGN-CHECK`.

## 9. Notas

- Hereda el patrón de link (SDD-0058 `kommo_lead_id`, 0061 OV↔prealerta) y de posteo a
  Tesorería (0044 `supplier-payment-posting`).
- La OC de DTD es el gemelo "compras" de la Orden de venta: misma mecánica de conversión QB.
- `sales_order_id` queda nullable (FK suave) hasta que exista la entidad Orden de venta.

## 10. Notas de implementación (Fase 1 · vía harness)

**Estado:** Fase 1 implementada en `feat/orden-compra`. Gate `node scripts/verify.mjs` 🟢
(lint + rsc-boundary + typecheck + test + docs:check). Migración 0124 **NO** aplicada a
prod (la aplica el founder). `ui-ux-designer` pendiente antes del commit.

**Archivos:**
- `supabase/migrations/0124_purchase_orders.sql` — `purchase_orders` (OC-) +
  `purchase_order_items` + RLS por tenant (patrón 0088/0096: `by tenant` +
  `service_role all`) + `next_purchase_order_code` (OC-YYYY-NNNN, cuenta solo
  `OC-%`, padding 4) + FK indexes (patrón 0013) + grants explícitos + triggers
  `updated_at`. Extiende el CHECK de `entity_audit_log` con `'purchase_order'`
  (re-arma con la lista completa de 0088 + el nuevo valor; aditivo).
- `lib/studio/purchase-orders/types.ts` — tipos, enum de status + labels/tones,
  grafo de transiciones (`canTransition`/`isTerminalStatus`/`canReceive`),
  cálculo de total puro (`itemLineTotal`/`computeTotalCost`), validador manual
  `validatePurchaseOrderInput` (sin Zod), mapeo puro OC→Bill
  `buildBillPayloadFromPo`, espejo del código `formatPurchaseOrderCode`.
- `lib/studio/purchase-orders/queries.ts` — `listPurchaseOrders`,
  `getPurchaseOrder`/`getPurchaseOrderByCode`, `listPurchaseOrderItems`,
  `purchaseOrderStats` (defensivo si 0124 no está aplicada).
- `lib/studio/purchase-orders/actions.ts` — `createPurchaseOrder`,
  `updatePurchaseOrder` (reemplaza ítems, solo borrador/confirmada),
  `setPurchaseOrderStatus`/`cancelPurchaseOrder` (valida el grafo),
  `receivePurchaseOrder` (⭐ el puente).
- `app/studio/(app)/ordenes-compra/` — `page.tsx` (server) + `actions.ts`
  (re-export "use server") + `_components/OrdenesCompraClient.tsx` (KPIs + 2 tabs:
  OC DTD / OC cliente) + `_components/PoDrawer.tsx` (detalle + provenance +
  recepción, y `NewPoDrawer` con ítems). Entrada al sidebar en grupo COMERCIAL
  (junto a "Proveedores CN"), id `purchase-orders`.
- `lib/studio/purchase-orders/__tests__/types.test.ts` — 24 tests (validadores,
  total, lifecycle, mapeo OC→Bill, código).

**Decisión `expense_account_id` (el punto a resolver del prompt):**
El Bill (`supplier_bills`, 0044) exige `expense_account_id` (cuenta contable). NO se
hardcodea ningún id de cuenta. Al **Recibir**, el form de recepción lista las cuentas
de costo/gasto (`listExpenseAccounts`) y **pre-selecciona la 1ª cuenta COGS (code `5.*`)**
como default sensato (compra de mercadería = costo de venta); el operador puede cambiarla.
La server action `receivePurchaseOrder` **valida "faltan datos: elegí la cuenta de
costo/gasto"** si no llega ninguna, y aborta si el plan de cuentas está vacío. Razón:
robusto contra seeds distintos por tenant + el operador ve/elige la imputación.

**Decisión proveedor del Bill (`supplier_id`):** `purchase_orders.supplier_id` → FK a
`suppliers_cn` (0105, proveedor chino *del cliente*), que **NO** es el `suppliers` (PRV-)
de Tesorería (vendor que *DTD* paga). El Bill necesita un `suppliers`. Al recibir,
`ensureTesorerySupplier()` busca un `suppliers` por nombre (el de la ficha `suppliers_cn`
o el `supplier_name` libre) y, si no existe, **crea uno** (PRV-, type `proveedor_cn`).
Luego reusa `createBillFor` de Tesorería (no duplica la causación) y linka bidireccional
`purchase_orders.bill_id` ↔ Bill + status `facturada`. El `reference` del Bill = el código
de la OC (rastro `Bill ← OC`).

**Lifecycle:** `borrador → confirmada → recibida → facturada → cerrada · cancelada`.
`facturada` la pone SOLO el motor (`receivePurchaseOrder` al crear el Bill), no es
transición manual (el grafo `canTransition` lo prohíbe desde la UI).

**Fuera de Fase 1 (confirmado, no implementado):** puente OV→OC (la entidad Orden de
venta no existe — `sales_order_id` queda nullable sin FK); cruce con Kommo "Compra
asistida"; edición de ítems post-recepción; compra asistida avanzada (cotización al
proveedor, multi-proveedor, pagos). No se tocó Prealertas (0057) ni Tesorería/Bill (0044)
más allá de leer/linkear/postear (createBillFor) y extender el CHECK del audit.

---
<!-- Validar con: node scripts/build-docs-index.mjs --check · regenerar índice: node scripts/build-docs-index.mjs -->
