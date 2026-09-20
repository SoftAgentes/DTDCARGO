---
sdd: "0494"
title: "Cobros y órdenes de pago anulados fuera de los lectores de Cobranzas y Tesorería"
status: in-progress
author: "Claude"
created: 2026-09-20
updated: 2026-09-20
supersedes: null
superseded_by: null
related: ["0041", "0044", "0068", "0135", "0230", "0294", "0465", "0467", "0468", "0470", "0488", "0489", "0492"]
confidencialidad: interno
---

# SDD-0494 — Cobros y órdenes de pago anulados fuera de los lectores

> Un recibo de cobro o una orden de pago con `deleted_at` no se muestra, no se
> suma y no se imprime en Studio. El filtro va en la CAPA DE CONSULTA, no en la
> RLS. Sin migración: la 0470 está aplicada a producción y no se toca.

## Contexto

`payment_receipts` y `supplier_payments` **no tienen columna de estado**: anular
es poner `deleted_at`, y nada más.

- `void_collection_receipt` (`supabase/migrations/0467_cobro_factura_atomico.sql`)
  marca el recibo y baja el `paid_amount` de su factura en una transacción.
  `voidReceiptFor` (`lib/studio/collections-actions.ts:470-476`) lo dice
  textual: «lo marca como anulado (deleted_at, con el motivo D2)».
- `void_supplier_payment_order` (`supabase/migrations/0468_pago_proveedor_atomico.sql:255-300`)
  hace lo propio con la orden, vía la envoltura D2 `void_supplier_payment_with_audit_reason`
  de la 0294, y rechaza una segunda anulación leyendo `v_payment.deleted_at is not null`
  (`:270`). Esa lectura es la prueba de que `deleted_at` ES la marca.

La RLS **no** oculta esas filas, y es deliberado:

- `0230_fix_rls_soft_delete_blocked.sql:11-14` quitó `AND deleted_at IS NULL`
  del `USING` de las policies `FOR ALL`, porque Postgres exige que la fila
  resultante de un `UPDATE` siga cumpliendo el `USING` — o sea, ese filtro
  bloqueaba el propio soft delete para cualquier usuario. La migración dejó
  escrito que «el filtro de "no mostrar borrados" ya lo hace la capa de
  aplicación en cada query».
- `0470_rls_escritura_cobros_proveedores.sql:186-191` reescribió
  `payment_receipts` en policies por comando y conservó ese criterio:
  `payment_receipts_team_select` solo compara `tenant_id`.

Para facturas, ese contrato se cumplió en SDD-0465. Para **cobros y órdenes de
pago, no**: ningún lector de Cobranzas ni de Tesorería pedía `deleted_at is null`
(medido con `grep 'deleted_at' lib/studio/payment-queries.ts` —un solo `.is`, el
de `receivablesQueue`, de la 0465— y `lib/studio/treasury/bill-queries.ts`
—ninguno—). Reportes, Fiscal, Partner-finance y las rendiciones elegibles sí lo
piden; Cobranzas y Tesorería eran las excepciones.

### Lo que se veía

Un recibo anulado seguía apareciendo, con su monto, en:

| Superficie | Lector |
|---|---|
| Historial de recibos del drawer de la factura | `listReceipts` |
| Bloque «Recibos de cobranza» del detalle de factura | `listReceipts` |
| Bandeja amarilla «Sin identificar», con su botón «Identificar» | `listUnidentifiedReceipts` |
| Tarjeta «Separación de fondos», **sumando su monto** | `fundsSeparationSummary` |
| Buscador global ⌘K | `searchReceipts` |
| `/studio/cobranzas/recibo/<code>`, imprimible | `getReceiptByCode` |

Y una orden de pago anulada, en el tab «Pagos», en el historial del drawer de su
CxP y en el KPI «Pagado» — los tres alimentados por `listPayments`.

Volver a pulsar «Anular» respondía «Este recibo ya está anulado.» /
«Esta orden ya está anulada.» (`collections-actions.ts:121`,
`treasury-actions.ts:89`), que es lo correcto: el defecto era que el documento
siguiera a la vista, no la guarda.

### El tercer hallazgo: una CxP saldada era inalcanzable

La cola de `/studio/tesoreria` solo trae CxP con saldo (`buildPayablesQueue`
descarta `balance <= 0`), el drawer solo se abre desde esa cola
(`selectedPayable = payables.find(...)`) y las filas del tab «Pagos» no eran
clicables. El botón «Anular» de una orden vive **solo** dentro de ese drawer
(`BillDrawer.tsx:634`). Consecuencia: si una orden saldaba su CxP y después el
pago se devolvía, **no había camino en la UI** para revertirla.

## Decisión

**El filtro va en la capa de consulta, no en la RLS.** Criterio de Sam,
sostenido por dos razones:

1. La 0470 está aplicada a producción y no se edita (ver
   [cabecera de migración aplicada](../../runbooks/aplicar-migraciones-prod.md)).
2. Esconder por RLS un documento anulado le quitaría a contabilidad la
   trazabilidad por SQL: el ledger de anulaciones es auditable a propósito
   (`comment on table public.payment_receipts`, 0470: «Anular = deleted_at
   (auditable)»).

**No hace falta migración.** Se evaluó y se descarta: la marca ya existe, los
índices parciales ya la contemplan (`sp_tenant_bill_idx ... where deleted_at is
null`, 0088) y las RPC ya la respetan. `supabase/migrations-baseline.json` no se
toca y no se declara ninguna espera en `pendingBelowCutoff`.

**Para el hallazgo 3, consulta antes que cola.** No se relaja
`buildPayablesQueue` —es una cola de pagos PENDIENTES y debe seguir mostrando
solo lo que se debe—; se agrega una lectura aparte, `payableForBill`, y la fila
del tab «Pagos» abre esa CxP. El drawer ya gatea sus acciones por saldo y
estado (registrar pago pide `balance > 0`; anular la CxP pide `paid_amount === 0`),
así que una CxP saldada se abre en consulta y lo único accionable es «Anular»
sobre sus órdenes — que es exactamente lo que faltaba.

## Alcance

Allowlist exacta:

| Archivo | Cambio |
|---|---|
| `lib/studio/payment-queries.ts` | `listReceipts`, `searchReceipts`, `getReceiptByCode`, `listUnidentifiedReceipts` y `fundsSeparationSummary` piden `deleted_at is null`; se corrigen los comentarios que decían «vivos» / «RLS … excluye anulados» |
| `lib/studio/treasury/bill-queries.ts` | `listPayments` y `listBills` piden `deleted_at is null`; se extrae `buildPayable` (pura) y se agrega `payableForBill` |
| `app/studio/(app)/tesoreria/actions.ts` | `getPayableForBill`: lectura para abrir una CxP saldada desde el tab «Pagos» |
| `app/studio/(app)/tesoreria/_components/TesoreriaClient.tsx` | la fila del tab «Pagos» abre la CxP de su orden (clic + teclado), con estado de carga y la columna «CxP origen» como afordancia |
| `app/studio/(app)/cobranzas/_components/CobranzaDrawer.tsx` · `app/studio/(app)/tesoreria/_components/BillDrawer.tsx` (×2) · `app/studio/(app)/facturacion/_components/InvoiceDetailClient.tsx` | voseo → tuteo: «Sembrá» → «Siembra» |
| `lib/studio/__tests__/documentos-anulados-cobros-pagos.test.ts` | regresión por lector, con doble que aplica el filtro y casos de control |
| Esta spec, `docs/specs/README.md` y `.agents/handoffs/cobros-pagos-anulados-lectores-0494.md` | documentación |

`listBills` **no estaba en el encargo**: lo destapó el fixture de regresión de
esta tarea (el KPI «Por pagar» sumaba una CxP borrada). Es el mismo defecto de
una línea, en el mismo archivo y en la misma ruta de dinero, así que se repara
acá. Hoy no hay camino en la app que ponga `deleted_at` en una CxP —anular una
CxP es `status = 'anulada'` (0294)—, así que el defecto era **latente**, no
observable en producción; se cierra porque la base sí trata esa marca como la de
liveness y porque dejar la cola y `payableForBill` con criterios distintos
invitaba a la deriva.

**Fuera de alcance**, con motivo:

- **RLS y migraciones.** 0230 y 0470 no se tocan; sin SQL nuevo; sin cambios en
  `supabase/migrations-baseline.json`.
- **`renditions/queries.ts:443`.** Enriquece por id los recibos que una
  rendición YA congeló (`.in("id", lote)`). Ahí un anulado **debe** seguir
  apareciendo: es el detalle histórico de un documento emitido. No se toca.
- **`getBill`** (`bill-queries.ts:130`) no filtra `deleted_at`, pero no tiene
  ningún consumidor en el repo (grep `getBill(` sobre `.ts`/`.tsx`: solo su
  propia definición). Es código muerto; tocarlo o borrarlo es otra tarea.
- **El espejo del hallazgo 3 en Cobranzas** — ver «Riesgos y límites».
- **Voseo en otros módulos** (`costing/_components/CostingClient.tsx:303`,
  `conversaciones/conversations-types.ts:358`) y en mensajes de aserción de
  tests, que son para quien programa, no producto.

## Aceptación

> **`status: in-progress` a propósito.** Los ocho criterios están implementados
> y los que se pueden probar sin pantalla tienen cobertura automática, pero el
> criterio 5 (el camino de clic del tab «Pagos») solo lo demuestra el smoke, y
> `pnpm verify` está **NO EJECUTADO** a la espera del turno del Director. Pasa a
> `done` cuando ambas cosas den PASÓ.

1. Un recibo con `deleted_at` no aparece en el historial del drawer, ni en el
   detalle de la factura, ni en la bandeja «Sin identificar», ni en el ⌘K, y su
   URL `/studio/cobranzas/recibo/<code>` responde «No existe ese recibo».
2. Ese recibo no suma en «Separación de fondos», ni en `unidentifiedUsd`, ni en
   `unidentifiedCount`, ni en `receiptCount`.
3. Una orden de pago con `deleted_at` no aparece en el tab «Pagos», ni en el
   historial del drawer de su CxP, ni suma en el KPI de pagado.
4. Una CxP borrada no entra a la cola ni al KPI «Por pagar».
5. Desde el tab «Pagos», la fila de una orden abre el drawer de su CxP **aunque
   esa CxP esté saldada**, y ahí se puede anular la orden.
6. `payableForBill` deriva el mismo `stage`/`daysOverdue` que la cola para una
   CxP con saldo, y devuelve `null` para una CxP borrada o un id vacío.
7. No queda voseo en los textos de producto de Cobranzas, Tesorería y el detalle
   de factura.
8. El texto «(los anulados no se muestran)» de
   `cobranzas/recibo/[code]/page.tsx:110` queda **cierto** (era falso antes; se
   conserva sin cambios porque el arreglo lo hizo verdadero).

## Evidencia

`lib/studio/__tests__/documentos-anulados-cobros-pagos.test.ts`, 20 casos.

El doble de PostgREST **aplica** `is/eq/neq/in/gte/lte` sobre las filas y corta
en `limit`/`range`, así que si un lector deja de pedir el filtro, la fila anulada
entra y la aserción lo delata. El fixture es **infeliz** a propósito: la fila
anulada es siempre la más reciente (encabeza los `order by ... desc`) y la de
monto más grande (domina cualquier suma). Además devuelve **copias**, para que
una mutación posterior no cambie «lo ya leído».

Cada bloque lleva su caso «control del doble», que corre el MISMO fixture con
`deleted_at: null` y afirma el resultado inflado — prueba de que el fixture no
pasa por casualidad: sin filtro, la separación de fondos da 17.500 en vez de
1.500, el KPI de pagado 6.400 en vez de 400 y «Por pagar» 6.000 en vez de 1.000.

**Mutante comprobado**: quitando los nueve `.is("deleted_at", null)` de los dos
archivos, **11 de los 20 casos fallan** (los 9 verdes son los controles, que
afirman justamente el comportamiento sin filtro, y los de `stage`/id vacío). Los
archivos se restauraron desde copia y se reverificaron.

## Riesgos y límites

- **El espejo del hallazgo 3 existe en Cobranzas y es peor.** `receivablesQueue`
  también descarta las facturas sin saldo (`payment-queries.ts:522-524`), el
  `CobranzaDrawer` solo se abre desde esa cola (`CobranzasClient.tsx:98-101`,
  `:263-269`) y el «Anular» de un recibo vive solo ahí (`CobranzaDrawer.tsx:1035-1042`).
  O sea: **si un cobro salda la factura, ese recibo no se puede anular desde
  ninguna pantalla.** Peor aún, un recibo `recibido_sin_ref` no se puede anular
  **nunca** —la bandeja amarilla solo ofrece «Identificar» y «Ver recibo»
  (`CobranzasClient.tsx:528-542`)— aunque `voidReceiptFor` lo soporta
  explícitamente. Y el filtro «Pagado» de `STAGE_FILTERS`
  (`CobranzasClient.tsx:58-65`) es código muerto: `derivedStage` solo devuelve
  `"pagado"` con `balance <= 0`, y esas facturas ya salieron de la cola.
  **No se arregla acá**: a diferencia de Tesorería —donde el tab «Pagos» ya
  existía y solo faltaba hacerlo clicable— en Cobranzas no hay superficie
  equivalente, así que abrir ese camino es una decisión de producto (¿un tab de
  recibos? ¿«Anular» en el detalle de factura? ¿en la bandeja?) que le toca a
  Sam. Queda en FUERA DE ALCANCE DETECTADO del handoff.
- **Esto no toca lo ya asentado.** Anular un recibo o una orden ya anulaba sus
  asientos (`voidEntriesForReceipt`, `voidSupplierPaymentJournalEntry`). El
  cambio es de LECTURA: no reescribe historia ni recalcula saldos.
- **Contabilidad conserva la trazabilidad.** Las filas siguen en la base con su
  motivo D2; lo que cambia es que el Studio ya no las presenta como vivas. Quien
  audite por SQL las sigue viendo.
- **`payableForBill` no lleva `moduleEditDenial`** porque es lectura, igual que
  el `getBillHistory` que ya existía en ese archivo: la vista del módulo la gatea
  el layout y la RLS acota al tenant. No expone nada que el tab «Pagos» no
  muestre ya de esa CxP.
