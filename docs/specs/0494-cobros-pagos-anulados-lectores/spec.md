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

### Desde cuándo: la 0230, no la 0470

Circula la versión de que esto lo destapó la **0470** el 2026-09-19 —o sea que
sería una regresión de SDD-0492—, porque `0079_cobranzas.sql:145-149`, que creó
`"payment_receipts by tenant"`, todavía dice
`using (tenant_id = ... and deleted_at is null)`. **No es así**, y vale la pena
dejar escrito por qué, porque el método que lleva a esa conclusión es razonable
y falla igual.

Ese método es buscar las migraciones que tocan `payment_receipts`. **La 0230 no
nombra ninguna tabla**: es un `do $$` que recorre `pg_policies` y reescribe toda
policy con `cmd = 'ALL'`, `qual ilike '%deleted_at%'` y `with_check` sin
`deleted_at`. Un grep por nombre de tabla la omite por construcción.

Tres evidencias independientes, todas sobre archivos del repo:

1. **La forma calza.** La policy de la 0079 es FOR ALL, su `qual` menciona
   `deleted_at` y su `with check` no: exactamente lo que la 0230 busca. Y la
   0230 está aplicada (`cutoff: 238` en `migrations-baseline.json`, y no figura
   en `pendingBelowCutoff`).
2. **El caso gemelo ya está probado.** `0077_facturacion.sql:114-118` crea
   `"invoices by tenant"` con el texto **idéntico**. SDD-0465 existe justamente
   porque la 0230 le quitó ese filtro a `invoices` y hubo que compensarlo en la
   capa de consulta. Si la barrida funcionó sobre esa forma, funcionó sobre esta.
3. **La 0470 lo dice de su propia mano.** Su cabecera describe el estado
   PREVIO a sí misma: «Cada tabla tiene una sola policy, "<tabla> by tenant"
   (0079:145, 0088:266-282, **con la 0230**): FOR ALL para authenticated, **que
   sólo pide el tenant**». Su autor observó la policy viva y la vio sin
   `deleted_at`.

El archivo 0079 sigue diciendo lo que **creó**, no lo que quedó vivo, porque una
migración aplicada nunca se edita (su identidad se prueba por md5 contra el
ledger). Para saber qué dice hoy una policy hay que leer su `create policy`
**más todas las migraciones posteriores que la tocan**, incluidas las que la
tocan sin nombrarla.

Consecuencia práctica: **no hay nada que revertir de SDD-0492**. Es un agujero
viejo, del que SDD-0465 cerró la mitad de facturas y dejó abierta la de cobros y
órdenes de pago.

> **VERIFICADO CONTRA PRODUCCIÓN el 2026-09-20**, por el Director (lectura de
> catálogo, sin filas de negocio; esta tarea no tiene esa autorización). En
> `pg_policy` hay **89 policies `FOR ALL` llamadas «<tabla> by tenant»: 85 sin
> `deleted_at` en el USING y sólo 4 con él**. Las 4 son exactamente las que la
> barrida no podía tocar: `agent_tool_grants` —el no-op que la propia cabecera
> de la 0230 nombra, porque su `deleted_at` es el de `agents` y no uno propio— y
> tres tablas creadas **después** de la 0230 (`supplier_claims` 0236,
> `warehouse_boxes` 0240, `consolidation_plans` 0298). La barrida corrió y dejó
> sin predicado a todas las preexistentes, `payment_receipts` incluida.
>
> Consulta: `select` sobre `pg_policy` y `pg_class` filtrando `polcmd = '*'` y
> `polname like '% by tenant'`, con `pg_get_expr(polqual, polrelid)`.
> Autorización del Director, 2026-09-20, **a su nombre**; esta sesión no leyó
> producción.

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
| `app/studio/(app)/tesoreria/actions.ts` | `getPayableForBill`: lectura para abrir una CxP saldada desde el tab «Pagos», **con `moduleViewDenial("treasury")`**. El mismo candado se le pone a `getBillHistory`, que no lo tenía (ver «El gate de la superficie nueva») |
| `app/studio/(app)/tesoreria/_components/TesoreriaClient.tsx` | la fila del tab «Pagos» abre la CxP de su orden (clic + teclado, con `studio-tracking-row` para hover/foco y `aria-label`), con estado de carga, aviso ante fallo de lectura y la columna «CxP origen» como afordancia |
| `lib/studio/collections-actions.ts` | el comentario de `identifyPaymentFor` decía que la RLS «excluye anulados» — el mismo error que esta tarea corrige en `getReceiptByCode`. Se corrige y se explica por qué ESA lectura sí debe traer el anulado (para rechazarlo con su mensaje). Solo comentario; el código no cambia |
| `app/studio/(app)/cobranzas/_components/CobranzaDrawer.tsx` · `app/studio/(app)/tesoreria/_components/BillDrawer.tsx` (×2) · `app/studio/(app)/facturacion/_components/InvoiceDetailClient.tsx` | voseo → tuteo: «Sembrá» → «Siembra» |
| `lib/studio/__tests__/documentos-anulados-cobros-pagos.test.ts` | regresión por lector, con doble que aplica el filtro y casos de control |
| `app/studio/(app)/tesoreria/_components/TesoreriaClient.cxp-saldada.test.tsx` | el camino de clic del criterio 5, el drawer fresco tras anular y el aviso ante fallo de lectura |
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

### El gate de la superficie nueva

Abrir una CxP saldada desde el tab «Pagos» **no es un filtro más: es superficie
de UI que antes no existía**, y el Director pidió mirarla con el estándar de una
funcionalidad. Al hacerlo apareció un hueco real:

El layout de Tesorería exige `requireModuleView("treasury")` y su comentario es
explícito — «Mueve plata → solo accounting (+admin). NUNCA
operations/commercial». Pero eso **protege la página, no la action**: una server
action es un endpoint invocable directo, que es justo lo que dice el docstring
de `moduleEditDenial` (SDD-0085 §Seguridad). Y la RLS no cubre el hueco, porque
`supplier_bills_team_select` y `supplier_payments_team_select` (0470) son
tenant-wide: cualquier rol del tenant puede hacer SELECT.

O sea que `getPayableForBill` habría sido **una puerta nueva sin candado**: un
rol `operations` o `commercial` podía leer proveedor, total, pagado y saldo de
cualquier CxP. Lleva `moduleViewDenial("treasury")` —el de VISTA, no el de
edición, porque no muta nada pero expone dinero—.

`getBillHistory` tenía **el mismo hueco, preexistente**, y se cierra junto: dejar
una action gateada al lado de su gemela abierta, en el mismo archivo, es una
incoherencia que invita a copiar la mala. Va declarado acá y no como hallazgo
suelto.

#### Pero el candado NO es el límite, y hay que decirlo

**Gatear las dos actions reduce la superficie; no cierra la exposición.** El
límite de lectura de los módulos de dinero es **de capa de aplicación, no de
base**: cualquier miembro autenticado del tenant, con el rol que sea, puede leer
proveedores, cuentas por pagar, órdenes de pago y recibos **directamente por
PostgREST**, sin pasar por ninguna action. Y no hace falta adivinar ids, porque
`supplier_bills` también es tenant-wide: se enumeran solos.

> **Medido en producción el 2026-09-20 por el Director** (lectura de catálogo,
> a su nombre): `supplier_bills_team_select` y `supplier_payments_team_select`
> tienen `using (tenant_id = get_user_tenant_id())` **sin predicado de rol**, y
> `authenticated` tiene **SELECT** sobre `suppliers`, `supplier_bills`,
> `supplier_payments` y `payment_receipts`.

Esto **no lo introdujo esta tarea ni la 0470**. SDD-0492 lo dice explícitamente
—«el SELECT sigue tenant-wide»— porque su alcance era la escritura, y la 0407
ya lo había anotado como deuda deliberada para `invoices`. Se escribe acá para
que nadie lea esta spec y concluya que el límite de lectura quedó cerrado:
**no quedó**. Cerrarlo pide RPC minimizadas o policies de SELECT con rol, y es
una decisión de Sam que el Director le lleva por su lado — fuera del alcance de
esta tarea.

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
   esa CxP esté saldada**, y ahí se puede anular la orden. Se abre con clic,
   con Enter y con la barra espaciadora; el panel de una CxP saldada ofrece
   «Anular» sobre la orden y **no** ofrece «Registrar pago» ni «Anular CxP».
6. Un rol sin el módulo Tesorería que invoque `getPayableForBill` o
   `getBillHistory` directo recibe la denegación, no los datos. **Esto vale para
   esas dos actions, no para la tabla**: la lectura por PostgREST sigue siendo
   tenant-wide y esta spec no la cierra (ver «Pero el candado NO es el límite»).
7. `payableForBill` deriva el mismo `stage`/`daysOverdue` que la cola para una
   CxP con saldo, y devuelve `null` para una CxP borrada o un id vacío.
8. No queda voseo en los textos de producto de Cobranzas, Tesorería y el detalle
   de factura.
9. El texto «(los anulados no se muestran)» de
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

**Mutante comprobado**: quitando los **ocho** `.is("deleted_at", null)` que
agrega esta tarea —los dos archivos tienen nueve, pero el noveno
(`payment-queries.ts:539`, sobre `invoices` en `receivablesQueue`) es
preexistente de SDD-0465 y **se conserva**—, **11 de los 20 casos fallan**. Los
9 verdes son los controles, que afirman justamente el comportamiento sin
filtro, y los de `stage`/id vacío. En la misma corrida,
`lib/studio/__tests__/receivables-queue.test.ts` queda **verde**: prueba de que
el mutante no tocó el filtro ajeno. Los archivos se restauraron desde copia y se
reverificaron.

`app/studio/(app)/tesoreria/_components/TesoreriaClient.cxp-saldada.test.tsx`,
6 casos, cubre el criterio 5 —el único sin cobertura automática— con el camino
completo: tab «Pagos» → clic → drawer con «Anular» y sin «Registrar pago» ni
«Anular CxP». Dos mutantes comprobados: resolver el drawer por `selectedBillId`
en vez de por id contra la cola fresca mata el caso del saldo fresco, y quitar
el `catch` de `openBillFromPayment` mata el caso de la lectura fallida.

## Hueco de ESCRITURA que esta spec NO cierra

Lo señaló el Director y lo confirmé: `payment_receipts_accounting_update`
(`0470:199-209`) y `supplier_payments_accounting_update` (`0470:292-302`) piden
tenant y rol, **y nada más**. No hay trigger que lo compense: el único sobre
`payment_receipts` es `audit_d2_payment_receipts` (0290:396), que registra, no
frena.

> **Confirmado contra producción el 2026-09-20**, en la misma lectura de
> catálogo del Director: `payment_receipts_team_select` tiene
> `using (tenant_id = ...)` y nada más, y `payment_receipts_accounting_update`
> tiene tenant y rol en el `using` **y** en el `with check`, sin `deleted_at` en
> ninguno de los dos. No es teórico.

O sea que hoy un usuario con rol `accounting` o `admin`, llamando a PostgREST
directamente (no por la app), puede hacer **UPDATE sobre un recibo o una orden
ya anulados**. El vector más filoso no es editar el monto: es
**poner `deleted_at` de vuelta en `null`** y resucitar el documento, sin que
nadie recalcule el `paid_amount` de su factura. Corrupción contable silenciosa.

El camino de la app está a salvo: pasa por las RPC de la 0467/0468, que
responden «Este recibo ya está anulado» / «Esta orden ya está anulada». Lo que
falta es la defensa en profundidad de la RLS.

**Esto NO es una regresión de la 0470**, por lo mismo de la sección anterior: la
policy FOR ALL previa ya tenía el `using` reducido a tenant desde la 0230, así
que tampoco lo impedía.

### Qué haría falta, si se decide cerrarlo

Análisis hecho, **migración no escrita y no aplicada** — es un cambio de RLS en
producción y necesita el OK nominal de Sam:

- El predicado va en el **`using`, NO en el `with check`**. Es la lección de la
  0230: en una policy `FOR UPDATE` dedicada, Postgres evalúa `using` contra la
  fila vieja y `with check` contra la nueva, así que `deleted_at is null` en el
  `using` **permite** la anulación (la fila vieja está viva) y **bloquea** tocar
  una ya anulada. Ponerlo en el `with check` rompería la anulación misma.
- El camino de anulación sobrevive: `void_collection_receipt` (0467) no declara
  `security definer`, o sea que es INVOKER y pasa por la RLS — pero su UPDATE es
  sobre una fila todavía viva.
- **Efecto colateral que hay que decidir**, no ignorar: el revertido de
  rendiciones (`renditions/actions-helpers.ts:287-291`) hace
  `update payment_receipts set application_status = 'aplicado'` sobre los
  recibos de la rendición. Un recibo anulado después de entrar a una rendición
  conserva su `application_status`, así que hoy lo alcanza; con el predicado
  dejaría de alcanzarlo, en silencio (la RLS filtra filas, no da error). Yo
  diría que eso es **más correcto** —un recibo anulado no debería volver a
  «aplicado»— y el código ya trata ese update como best-effort, pero es un
  cambio de comportamiento y lo decide Sam, no yo.
- `supplier_bills` queda fuera: su marca de anulación es `status = 'anulada'`,
  no `deleted_at`, así que el predicado sería otro y nada escribe hoy su
  `deleted_at`.

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
