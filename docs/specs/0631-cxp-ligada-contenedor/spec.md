---
sdd: "0631"
title: "CxP ligada a un contenedor y a un embarque, con su costo en el margen"
status: in-progress
author: "Claude (Worker)"
created: 2026-11-13
updated: 2026-11-13
supersedes: null
superseded_by: null
related: ["0044", "0047", "0053", "0572"]
confidencialidad: interno
---

# SDD-0631 — CxP ligada a un contenedor y a un embarque, con su costo en el margen

> Una cuenta por pagar (CxP) de un proveedor o de un aliado de espacio se liga a un
> contenedor (consolidado) y, si se quiere, a un embarque. Ese costo entra al margen
> del embarque y al del contenedor en Costing & Margen, sin contarse dos veces.

## 1. Contexto

Viene un lote de contenedores y contabilidad tiene que poder decir cuánto costó cada uno.
Hoy, cuando se le debe a un aliado el espacio que nos vendió en un contenedor, esa deuda
se registra como CxP en Tesorería, pero no se puede ligar al contenedor:

- `NewBillDrawer` (`app/studio/(app)/tesoreria/_components/BillDrawer.tsx`) siempre manda
  `shipmentId: null`, aunque `supplier_bills.shipment_id` existe desde la 0088.
- `supplier_bills` no tiene vínculo con `consolidations` (0096).
- El costeo (`lib/studio/costing/queries.ts`, `listShipmentCosts`) lee solo `shipment_costs`
  (0100). Las CxP no llegan a ningún margen.
- No existe un margen por contenedor.

Vocabulario: en el ERP, «aliado» (`0362_aliados_base.sql`) es un revendedor del lado del
cliente. Quien nos vende espacio en un contenedor es un **proveedor**; esta SDD lo llama
«aliado de espacio» y lo registra en `suppliers` con un tipo propio. No toca la tabla de
aliados.

## 2. Contrato

### 2.1 Datos (migración 0536)

`supplier_bills` gana dos columnas nullable, sin default y sin reescribir filas:

| Columna | Tipo | Significado |
|---|---|---|
| `consolidation_id` | `uuid` → `consolidations(id) on delete set null` | Contenedor al que pertenece el costo. |
| `cost_category` | `text`, CHECK en las 7 categorías de Costing | Qué renglón del costeo cubre la CxP. |

Más:

- Índice parcial `(tenant_id, consolidation_id)` y `(tenant_id, shipment_id)` sobre las
  CxP vivas ligadas.
- Trigger `supplier_bills_validate_cost_link` (`before insert or update of
  consolidation_id, shipment_id, tenant_id`), fail-closed:
  1. el contenedor es vivo y del mismo tenant (`consolidation_in_tenant`, 0241);
  2. el embarque es vivo y del mismo tenant (`shipment_in_tenant`, 0100);
  3. si vienen los dos, el embarque está asignado a ese contenedor
     (`consolidation_items`);
  4. si hay contenedor o embarque, `cost_category` no es null.
- Sin cambios en RLS, grants, asientos ni auditoría D2: las columnas heredan las policies
  de 0470 (SELECT tenant-wide; INSERT/UPDATE solo `accounting` o `admin`).

**No aplicada a producción.** Aplicarla exige OK de Sam nombrando el archivo y el
[runbook](../../runbooks/aplicar-migraciones-prod.md). El código tolera la base sin las
columnas: ver §2.4.

### 2.2 Tesorería

- **Nueva CxP:** sección «Costo de contenedor» opcional con selector de contenedor
  (consolidaciones vivas), selector de embarque filtrado por los embarques asignados a ese
  contenedor (opcional) y categoría de costo (por defecto «Flete naviera»).
- **CxP existente:** el drawer muestra el vínculo y permite ligarla, cambiarla o quitarla
  mientras no esté anulada (`linkBillCost`). Esto cubre la deuda que ya está registrada.
- Validación en el servidor (`validateBillCostLink`): embarque sin contenedor está
  permitido (costo directo del embarque); categoría obligatoria cuando hay vínculo; si
  vienen los dos, el embarque debe estar en el contenedor. El trigger repite la regla en
  la base.
- Registrar el pago (orden OP-) no cambia el vínculo ni el costo.

### 2.3 Costeo

Función pura `allocateLinkedBills` (`lib/studio/costing/cxp-ligadas.ts`):

1. Entran las CxP vivas (`deleted_at is null`, `status <> 'anulada'`) con contenedor o
   embarque. El costo es el **monto causado** de la CxP en USD (`usdOrNull`, SDD-0572),
   no lo pagado: la orden de pago no suma costo.
2. CxP con embarque → todo su monto va a ese embarque.
3. CxP con contenedor y sin embarque → se reparte entre los embarques del contenedor
   proporcional a su CBM (`consolidation_items.cbm`). Si el contenedor no tiene CBM
   asignado, queda como costo del contenedor «sin repartir».
4. CxP sin tasa → no suma; se cuenta como «sin tasa» en el embarque o contenedor, y su
   margen no se certifica (mismo trato que las facturas sin tasa, SDD-0572).

**Sin doble conteo con `shipment_costs`:** por cada embarque y categoría, si hay CxP
ligada en esa categoría, el monto de las CxP **reemplaza** el valor cargado a mano en
`shipment_costs` para esa categoría. Las demás categorías siguen saliendo de
`shipment_costs`. Un flete estimado a mano y la CxP real del mismo flete nunca se suman.

**Sin doble conteo entre embarque y contenedor:** una CxP con embarque y contenedor
cuenta una vez, en el embarque; el contenedor la recibe a través de sus embarques.

Margen por contenedor (`marginByContainer`): por cada consolidación viva, la suma del
revenue y del costo efectivo de sus embarques, ponderada por la fracción de CBM del
embarque que va en ese contenedor (1 si el embarque está en un solo contenedor), más el
costo sin repartir. `costingRows` aplica el costo efectivo, así que Dashboard y Reportes
(Combinados) reciben el mismo número que Costing.

La pantalla Costing & Margen gana la pestaña **Contenedores**: contenedor, estado,
embarques, revenue, costo (con lo que viene de CxP), margen y margen %.

### 2.4 Base sin la 0536

Mientras la migración no esté aplicada, leer `consolidation_id`/`cost_category` falla con
columna inexistente. El costeo lo detecta (código `42703`), sigue sin CxP ligadas y no
rompe la pantalla; Tesorería oculta el selector y la acción de ligar responde «la base
todavía no tiene el vínculo (migración 0536)».

### 2.5 Camino operativo: alta de un aliado de espacio

Documentado en [`docs/runbooks/cxp-aliado-de-espacio.md`](../../runbooks/cxp-aliado-de-espacio.md):
proveedor con tipo «Aliado de espacio» (`aliado_espacio`, nuevo valor del tipo, que es
texto acotado sin CHECK SQL) → CxP ligada al contenedor con categoría «Flete naviera» →
orden de pago → margen en Costing › Contenedores.

## 3. Allowlist exacta

- `docs/specs/0631-cxp-ligada-contenedor/spec.md`
- `docs/specs/README.md` (índice generado)
- `docs/architecture/module-sdd-map.md`
- `docs/runbooks/cxp-aliado-de-espacio.md`
- `.agents/handoffs/0631-cxp-ligada-contenedor.md`
- `supabase/migrations/0536_cxp_ligada_contenedor.sql`
- `supabase/tests/0536_cxp_ligada_contenedor.test.sql`
- `lib/studio/treasury/__tests__/cxp-ligada-contenedor.migration.test.ts`
- `lib/studio/treasury/types.ts`
- `lib/studio/treasury/bill-queries.ts`
- `lib/studio/treasury/treasury-actions.ts`
- `lib/studio/treasury/cost-link-queries.ts`
- `lib/studio/treasury/__tests__/cost-link.test.ts`
- `app/studio/(app)/tesoreria/actions.ts`
- `lib/studio/rbac-actions-guard.test.ts` (inventario RBAC: `linkBillCost`, 466 → 467)
- `app/studio/(app)/tesoreria/page.tsx`
- `app/studio/(app)/tesoreria/_components/BillDrawer.tsx`
- `app/studio/(app)/tesoreria/_components/TesoreriaClient.tsx`
- `lib/studio/costing/cxp-ligadas.ts`
- `lib/studio/costing/queries.ts`
- `lib/studio/costing/__tests__/cxp-ligadas.test.ts`
- `lib/studio/costing/__tests__/cxp-ligada-punta-a-punta.test.ts`
- `lib/studio/reports/queries.ts`
- `app/studio/(app)/costing/page.tsx`
- `app/studio/(app)/costing/_components/CostingClient.tsx`

## 4. Criterios de aceptación

- **CA1** La 0536 agrega las dos columnas, el CHECK, los índices y el trigger; es
  idempotente; el contrato SQL corre en PGlite con control rojo (sin migración) y un
  mutante por regla del trigger.
- **CA2** El trigger rechaza: contenedor de otro tenant o borrado, embarque de otro tenant,
  embarque que no está en el contenedor, y vínculo sin categoría. Acepta: solo contenedor,
  solo embarque, ambos coherentes, ninguno.
- **CA3** Nueva CxP desde Tesorería puede ligarse a contenedor y, opcional, a embarque; una
  CxP existente no anulada se puede ligar, cambiar o desligar.
- **CA4** `allocateLinkedBills` reparte por CBM, deja sin repartir si no hay CBM, convierte
  a USD con la tasa de la CxP, excluye anuladas y borradas, y cuenta las sin tasa.
- **CA5** La CxP reemplaza la categoría de `shipment_costs` que cubre; las otras categorías
  no cambian. Una CxP con contenedor y embarque cuenta una sola vez.
- **CA6** `marginByContainer` suma revenue y costo de los embarques del contenedor
  (ponderados por CBM si el embarque está repartido) más el costo sin repartir.
- **CA7** Punta a punta con montos inventados: CxP ligada → orden de pago → asiento de
  causación y de pago → el margen del contenedor y del embarque reflejan el costo una sola
  vez (el pago no suma).
- **CA8** Con la base sin la 0536 el costeo no rompe y devuelve el margen sin CxP.
- **CA9** `pnpm verify` registrado en el handoff por comprobación.

## 5. Fuera de alcance

- Aplicar la 0536 en producción, o cargar la CxP real del aliado: eso lo hace contabilidad
  cuando la migración esté aplicada con OK nominal.
- Auditoría D2 del cambio de vínculo: `audit_d2_financial_change` (0290) registra solo
  código, proveedor, estado y moneda de la CxP; cambiar el vínculo no deja evento. Queda
  como hallazgo en el handoff.
- Prorrateo de una CxP de contenedor por peso u otro criterio distinto de CBM.
- Una CxP repartida en varios contenedores, o la orden de compra (`purchase-orders`)
  ligada a contenedor.
- Cambios a la tabla de aliados (0362) o a su portal.
