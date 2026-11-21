---
sdd: "0699"
title: "Cascada al cambiar el dueño: reasignar un embarque o fusionar clientes arrastra factura, pre-orden y pagos, con aviso previo"
status: approved
author: "Claude (Worker) + Sam"
created: 2026-11-21
updated: 2026-11-21
supersedes: null
superseded_by: null
related: ["0122", "0341", "0488", "0543", "0573", "0629", "0645", "0662", "0690", "0695", "0698"]
confidencialidad: interno
---

# SDD-0699 — Cascada al cambiar el dueño de un embarque o al fusionar clientes

> **Estado: aprobada para planear (2026-11-21).** Sam contestó las nueve preguntas de la §9, en el chat de
> Dir_DTD: «SDD-0699: apruebo las nueve opciones recomendadas». Dir_DTD le pasó el texto a este Worker el
> mismo día. Las decisiones están en la §9.
>
> La spec no trae código, ni migraciones, ni cambios de producto. Aprobarla no autoriza implementar
> ninguna fase ni aplicar ninguna migración. La implementación toca migraciones, facturación y pagos, así
> que va por el **carril con revisión previa**: cada fase lleva su PR, con revisión independiente APPROVED,
> y cada migración, su **OK nominal de Sam**. La F-0 (§8) la verificó Dir_DTD el 2026-11-21.
>
> Los ejemplos son inventados. No hay nombres de clientes, Shipping Marks reales, montos ni conteos de
> producción.

## 1. Pedido

Al planear la carga de pre-órdenes del contenedor 64 se vio un caso. Una pre-orden reúne varios embarques
de un cliente. Si uno de esos embarques es en realidad de otro cliente, «Pasar a otro cliente» (SDD-0645)
se niega con `factura_varios_embarques`. No parte la pre-orden, no la rehace y no dice qué cambiaría.

Lo que pidió Sam (2026-11-21, en el chat de Dir_DTD):

> «Si después cambio el cliente, se tiene que cambiar su factura, su proforma y todo lo que está pegado.
> Debería salir un mensaje avisando: "El cambio va a ser esto, esto y esto; su factura se va a
> representar y, si hay un pago atado, se va a soltar del que estaba". Hay que entender la lógica contable
> y administrativa para el tema de los merges de clientes y el cambio de un embarque.»

Y decidió: «arranca también el SDD de la cascada». El 64 se resuelve aparte, cargándolo hoy sin el
comodín DTD-0000; esta spec no lo bloquea.

Esta spec define dos operaciones con la misma regla:

1. **Pasar un embarque a otro cliente** (amplía la SDD-0645).
2. **Fusionar dos clientes duplicados** (amplía `merge_clients`).

Esa regla dice tres cosas:

- **todo lo atado se mueve o se rehace;**
- **nada contable se borra ni se reescribe en silencio;**
- **antes de confirmar, una vista previa dice qué va a cambiar.**

## 2. Lo que hay hoy (verificado en `main` `2e174c818`)

Las citas `NNNN:línea` son de `supabase/migrations/`. **Verificado** quiere decir que se leyó el archivo,
no que se midió en producción. Varias cabeceras dicen «NO APLICADA A PRODUCCIÓN» (0464, 0466, 0467, 0494,
0497, 0551, 0552, 0564, 0569), mientras que `supabase/migrations-baseline.json` tiene `pendingBelowCutoff`
vacío.

**F-0, verificado por Dir_DTD el 2026-11-21:** **0466, 0467, 0497, 0551, 0552, 0564 y 0569 están
aplicadas en producción.** Lo leyó con una consulta de solo lectura a
`supabase_migrations.schema_migrations`. Sus cabeceras «NO APLICADA» son texto viejo y esta spec no edita
esos `.sql`. Dir_DTD midió después, igual, la **0464** y la **0494**: también están aplicadas. Esa medición es
del Director; este Worker no consultó producción.

### 2.1 Cómo se ata cada cosa al cliente

**Ni embarques, ni facturas, ni pagos tienen `client_id`.** El vínculo es el texto `client_markbox`
(el Shipping Mark), más una copia del nombre:

| Objeto | Cómo se liga al cliente | Cómo se liga al embarque | Cita |
|---|---|---|---|
| Embarque | `shipments.client_markbox`, `client_name` | — | SDD-0645 §1 |
| Factura y pre-orden | `invoices.client_markbox` (texto, sin FK), `client_name` | `shipment_id` (el primero) o `lines[].shipmentCode` | `0077:28-31`; SDD-0690 §2.2 |
| Recibo de cobro | `payment_receipts.client_markbox`, `invoice_id` con FK `on delete restrict` | por la factura | `0079:25-44`; `0122:61-62` |
| Reporte de pago del Portal | `payment_reports.client_markbox`, `invoice_id not null` | por la factura | `0195:55-57` |
| Crédito de referido | `referrals.referrer_client_id`, `applied_invoice_id` | por la factura | `0237:49-51`; `0494:151-154` |
| Asiento contable | **no lleva cliente**; llega por `invoice_id` o `receipt_id` | — | `0078`; `0079:81-82` |
| Portal | `get_portal_client_markbox()` y RLS por **igualdad de texto** con el Shipping Mark vigente | — | `0453:253-267`; `0452:151-167`; `0367:14-17` |

### 2.2 La pre-orden es una factura en borrador

- El modelo de Sam es estimado (cotización) → **pre-orden** (el cliente aceptó, no es contable) →
  **factura**. En pantalla se dice «pre-orden»; «borrador» es el nombre técnico
  (`docs/specs/0690-embarques-facturar-emite-borrador/spec.md:191-192`).
- El cargador de consolidados crea **una pre-orden por cliente**. Sus líneas llevan el `shipmentCode` de
  cada embarque y `shipment_id` es el primer embarque del cliente (SDD-0690 §2.2).
- **Hoy una pre-orden no recibe abonos:** el cobro y el reporte de pago rechazan el borrador
  (SDD-0690 §3.5; `0195:183-186`).
- No hay tabla de proformas. «Proforma» en el pedido de Sam es la pre-orden. El estimado web es una
  `quote` (`0113:1-11`), con `client_markbox` sin FK (`0007:13`).

### 2.3 Pasar un embarque a otro cliente (SDD-0645, `0551`)

- `reassign_shipment_client(p_shipment_id, p_client_id, p_reason, p_dry_run)` (`0551:203-464`), SECURITY
  DEFINER, motivo de 4 a 1000 caracteres (`0551:251-253`).
- **Vista previa:** con `p_dry_run` calcula lo mismo sin bloquear filas ni escribir (`0551:258-265`,
  `:386-392`). Devuelve `outcome` (`preview` | `blocked` | `reassigned`), `blockers`, `warnings`,
  `portal` y `moved`. Es el patrón que esta spec reutiliza.
- **Bloquea** (`0551:309-348`):
  - `factura_emitida`, una factura viva que ya no es borrador (`:327`, `:331`);
  - `factura_varios_embarques`, un borrador que también cobra otros embarques (`:311-316`, `:328`, `:332`);
  - `reclamo` (`:334-336`), `prealerta` (`:338-341`) y `orden_despacho` (`:343-348`).
- **Mueve en una transacción** (`0551:396-430`): el embarque, sus recepciones CN (las cajas, por el
  trigger de 0240), sus borradores (y limpia el titular fiscal, `:410-413`), sus líneas de consolidación,
  sus documentos del Portal y sus avisos `scheduled`.
- **Avisa sin bloquear** la tarifa congelada de otro cliente (`0551:353-357`) y lo que verá el cliente
  nuevo en el Portal (`0551:360-371`).
- **Auditoría:** `shipment_client_reassigned` con `append_audit_event`, `permanence: P1` y
  `recovery: 'reassign_again'` (`0551:432-454`).
- **Permiso:** en la base, `admin`, `operations` o `commercial` (`0551:239-246`). En la app, la acción
  RBAC `reassign_shipment_owner` (`lib/studio/rbac.ts:324-331`), que exigen las dos server actions
  (`app/studio/(app)/tracking/[id]/actions.ts:610`, `:628`).
- **Pantalla:** `ReassignClientPanel.tsx`. Pide la vista previa al elegir el cliente (`:80`), muestra los
  bloqueos (`:90`) y solo deja confirmar con `outcome = 'preview'` y motivo válido (`:94-95`). Los textos
  salen de `lib/studio/reasignar-embarque.ts`. El de `factura_varios_embarques` dice «Sepárala primero»
  (`:92-93`), **pero el sistema no ofrece cómo separarla.**

### 2.4 Facturas emitidas, cobros y anulación

- Estados: `borrador, emitida, parcial, pagada, vencida, anulada` (`0077:12`). No hay columna de saldo: el
  saldo es `total_amount − paid_amount` (`0077:41`).
- **Al emitir se sella el titular.** El trigger `invoices_seal_billing_titular` busca el cliente por
  `client_markbox` y, después de emitir, congela nombre, RIF, tipo de documento, dirección fiscal y
  `bill_to_kind` (`0466:262-273`). **No congela `client_markbox`.**
- **Cobrar** suma a `paid_amount` y pasa la factura a `pagada` o `parcial` (`0467:236-240`). **Anular un
  recibo** baja el pagado y devuelve la factura a `emitida` o `parcial`; una anulada o un borrador no
  reviven (`0467:380-390`).
- **Un recibo puede quedar sin factura:** el estado `recibido_sin_ref` exige `invoice_id null`
  (`0122:90-100`). Hoy ese estado nace sin copia del cliente (`lib/studio/collections-actions.ts:314`,
  `:342-360`), y la CHECK de los snapshots solo lo permite en ese estado (`0122:103-109`).
- **Asientos de un recibo, hoy:**
  - **cobro con factura:** DR caja / CR 1.1.2 «Cuentas por cobrar clientes» (`0078:205`);
  - **pago sin referencia:** DR caja / CR **2.1.8 «Fondos por identificar»**, una cuenta puente de pasivo
    (`lib/studio/accounting/receipt-posting.ts:30-35`, `:375-378`; `collections-actions.ts:312-316`);
  - **al identificarlo:** la app reclasifica DR 2.1.8 / CR 1.1.2 con fecha `received_at`, por fuera de la
    transacción y en modo best-effort. Es idempotente por `source = 'receipt_reclass'`
    (`receipt-posting.ts:451-460`; `collections-actions.ts:418-423`).
- **`identify_collection_receipt`** (`0467:252-330`) aplica un recibo sin referencia a una factura:
  - exige que esté `recibido_sin_ref` (`:287`);
  - rechaza un monto mayor que el saldo de la factura, `PAYMENT_EXCEEDS_BALANCE` (`:306-308`), así que no
    hay aplicación parcial;
  - **sobrescribe el cliente del recibo con el de la factura** (`:310-314`).
- **`rendido`** existe en el CHECK, para fondos de terceros incluidos en una rendición, pero su transición
  está «definida pero sin wiring» (`0122:10-12`, `:53`, `:92`).
- **No hay cuenta de anticipos de clientes.** La única cuenta de anticipos es 1.1.4 «Anticipos a
  proveedores / navieras», del activo (`0078:207`). En 2.1.x el último código en uso es 2.1.8.
- **Anular una factura** (`void_invoice_with_audit_reason`, `0497:740-872`):
  - solo `admin` o `accounting` (`0497:772-777`);
  - no anula si está `pagada` (`0497:782`), si tiene recibos vivos (`:787-791`) ni si `paid_amount > 0`
    por crédito o reporte (`:793-795`);
  - **reversa el asiento** con líneas espejo y `reverses_entry_id`, en la fecha abierta más temprana que
    respete el cierre (`0497:829-849`).
- **No hay nota de crédito para clientes.** Lo dice la SDD-0698 §5.5. La única tabla con ese nombre es
  `supplier_credit_notes`, de las finanzas con proveedores de China (`0114`).
- **No hay saldo a favor genérico:** un sobrepago no compensa otra factura (`0492:56-57`).
- **Todo en dólares.** Los Bs son solo una vista, sin columnas, asientos ni recibos en Bs, y la
  facturación fiscal queda fuera (`docs/specs/0629-equivalente-bs-solo-visual/spec.md:20`, `:24`, `:117`).
  Por eso esta spec no habla de nota de crédito fiscal (SENIAT): habla de **anular y rehacer**.

### 2.5 Fusionar clientes (`merge_clients`, `0361`)

- **Permiso:** `admin, commercial, operations, accounting, support` (`0361:73-75`). En la app pasa por
  `moduleEditDenial(clients)` (`app/studio/(app)/clientes/merge-actions.ts:43`). **No hay acción RBAC
  propia.**
- **Mueve, por `client_id`:**
  - el acceso al Portal: muda `client_users`, o revoca el duplicado si el que sobrevive ya tenía
    (`0361:120-134`);
  - direcciones, conversaciones, reglas de aviso, reclamos, solicitudes de cambio, referidos y otros
    (`0361:140-222`);
  - rellena los datos vacíos del que sobrevive (`0361:245-279`).
- **No mueve** nada que se ligue por `client_markbox`: embarques, facturas, recibos, reportes de pago ni
  cotizaciones (`0551:19-20`; `0492:63-65`). Tampoco `legal_acceptances`, a propósito (`0361:224-227`).
- **Marca** la ficha retirada con `merged_into_client_id` y `deleted_at`, y **le deja su Shipping Mark**
  como alias (`0361:230-236`; `0341:14-18`).
- **Sin vista previa y sin motivo.** Solo un `ConfirmDialog` que dice «Esto no se deshace solo»
  (`app/studio/(app)/clientes/_components/DuplicadosClient.tsx:217-241`).
- **Consecuencias:**
  - la deuda **sí** sigue al que sobrevive, porque `client_outstanding` recorre la cadena de fusiones y
    el historial de códigos (`0492:61-66`);
  - **INFERENCIA, no medida:** el Portal no la sigue. Compara el texto con el Shipping Mark vigente
    (`0367:14-17`), así que el que sobrevive no vería los embarques ni las facturas que quedaron con el
    código de la ficha retirada. La SDD-0695 lo deja como inferencia en su D-7 y lo mide con la consulta
    Q18 (`docs/specs/0695-datos-duplicados-fuentes-unicas/spec.md:175-179`). La corrige la 0695 F-6.

### 2.6 Cambiar el código de un cliente (`rename_client_markbox`, `0552:702-875`)

Reescribe el texto del código viejo en unas 30 tablas, **incluidas las facturas emitidas, los recibos y
los reportes de pago** (`0552:808-821`), y guarda el código viejo en `client_markbox_history`. Es el
único camino de hoy que cambia el `client_markbox` de una factura emitida. Es legítimo porque es **el
mismo cliente** con otro código: el titular sellado no cambia.

### 2.7 Auditoría y deshacer

- `append_audit_event` (`0294:49-70`) escribe en `entity_audit_log`, que es de solo agregar
  (`0267:710-714`).
- **No hay deshacer genérico.** Lo más cercano es la pista `recovery` en el evento (`0551:447`).

## 3. Principios

1. **Un documento emitido no cambia de dueño.** Se anula (con su reverso, `0497`) y se rehace a nombre
   del cliente correcto. Así el titular sellado (`0466`) sigue siendo verdad, y el cliente que recibió
   la factura vieja la ve anulada, no desaparecida.
2. **Un borrador sí se mueve, y si es compartido se parte.** No es contable (SDD-0690 §3.5).
3. **El dinero nunca se pierde ni cambia de pagador en silencio.** Un pago aplicado a una factura que se
   anula **se suelta**: queda **pendiente de aplicar a nombre de quien pagó**. Solo se aplica a la factura
   nueva si la persona lo elige en la vista previa, y queda en la bitácora.
4. **Vista previa obligatoria.** La operación no se confirma sin haber visto la vista previa de ese
   mismo estado (§6.1).
5. **Todo o nada.** Una transacción, con auditoría en la misma transacción. Si falla el evento, no cambia
   nada.
6. **Período cerrado manda.** Nada reescribe asientos de un período cerrado: los reversos van al
   período abierto, como hoy (`0497:829-833`).
7. **Dólares.** Todo en USD; sin documentos fiscales.

## 4. Caso 1 — Pasar un embarque a otro cliente

Notación: **A** es el cliente actual, **B** el cliente nuevo y **E** el embarque.

### 4.1 Matriz de qué pasa con cada cosa

| Objeto atado a E | Hoy (0551) | Con esta spec |
|---|---|---|
| Pre-orden **solo de E** | Se mueve a B, sin titular fiscal (`0551:410-413`) | **Igual.** Sin cambio. |
| Pre-orden **de A que también cobra otros embarques** | Bloquea `factura_varios_embarques` | **Se parte** (§4.2): las líneas de E salen de la pre-orden de A y van a la pre-orden viva de B en ese contenedor, o a una nueva. Se recalculan las dos. |
| Factura **emitida sin pagos** solo de E | Bloquea `factura_emitida` | **Anular y rehacer** (§4.3): se anula con reverso y se crea una **pre-orden** de B con las mismas líneas (P1). |
| Factura **emitida que cobra E y otros embarques** | Bloquea | **Anular y rehacer dos:** pre-orden de A con las líneas que quedan y pre-orden de B con las de E (P1, P2). |
| Factura **con pagos** (`parcial` o `pagada`) | Bloquea | **Soltar y rehacer** (§4.4): los recibos se sueltan, se anula, se rehace (P3, P4). |
| Recibo de cobro aplicado | No se toca | **Se suelta** al estado nuevo `liberado`, **conservando el pagador** (§4.4). |
| Reporte de pago del Portal pendiente | No se toca | **Bloquea** mientras esté pendiente: lo resuelve primero Cobranzas, porque lo envió A desde su Portal. |
| Crédito de referido aplicado | No se toca | **Bloquea**, como hoy en la anulación (`0497:793-795`): se revierte antes con su acción. |
| Factura anulada o eliminada | No se mueve | **Igual:** es historia de A. |
| Cotización o estimado (`quotes`) | No se toca | **Igual:** la cotización fue a A. Si se convirtió, la vista previa la nombra, sin moverla. |
| Recepciones CN y cajas | Se mueven | **Igual.** |
| Tarifa congelada (`0496`) | Avisa | **Igual:** se avisa y contabilidad la reemplaza (P5). |
| Líneas de consolidación | Se mueven | **Igual.** |
| Documentos del Portal | Se mueven, y avisa lo que verá B | **Igual.** |
| Avisos `scheduled` | Se mueven; los enviados se quedan | **Igual.** |
| Reclamo vivo | Bloquea | **Igual:** es del cliente que lo abrió. |
| Prealerta viva | Bloquea | **Igual:** la anunció A. |
| Orden de despacho viva | Bloquea | **Igual:** va a nombre de A; se cancela primero. |
| Código del embarque y etiquetas | Se conservan, con trazabilidad (SDD-0645 §4.4) | **Igual.** |

### 4.2 Partir una pre-orden compartida

Ejemplo inventado: la pre-orden `F-2026-0901` de DTD-9001 tiene tres líneas, de los embarques
DTDU-0001, DTDU-0002 y DTDU-0003. DTDU-0003 es en realidad de DTD-9002.

1. Se toman las líneas con `shipmentCode = E.code` (el mismo criterio de `0551:319-322`).
2. **Pre-orden de A:** quedan las otras líneas. Se recalculan la base, el IVA y el total con la misma
   regla con la que se creó (la del cargador, SDD-0543). Si `shipment_id` era E, pasa al primer embarque
   que queda.
3. **Pre-orden de B:**
   - si B ya tiene una pre-orden viva en el mismo contenedor y en la misma moneda, las líneas se **suman**
     a ella y se recalcula;
   - si no, se crea una pre-orden nueva con `next_invoice_code`, `shipment_id = E` y las líneas de E.
     Va sin titular fiscal, que se sella al emitir (`0466`).
4. **Si la pre-orden de A queda sin líneas**, se elimina con borrado lógico (`deleted_at`), porque no es
   contable (P6).
5. **Líneas sin `shipmentCode`** (cargos a mano, como un descuento): **se quedan en A** y la vista previa
   lo dice (P2).
6. **Si a la pre-orden de A solo le quedan líneas sin `shipmentCode`** (B2 de la revisión):
   - con total mayor que 0 se conserva, con el aviso «Esta pre-orden ya no cobra ningún embarque; revísala
     antes de emitirla»;
   - con total en 0 o negativo (por ejemplo, solo un descuento), **bloquea** con `preorden_sin_embarques`.
     Contabilidad la corrige primero en Facturación. La P6 no aplica, porque la pre-orden no queda sin
     líneas, y nadie borra un descuento en silencio.
7. **El total se conserva** (B3 de la revisión):
   - la suma de las **bases** (cantidad × precio de cada línea) de A y de B es **exactamente** la misma
     antes y después, porque las líneas se mueven sin cambiar;
   - el IVA se recalcula por pre-orden, con la misma regla y el redondeo de siempre: a dos decimales,
     mitad hacia arriba. Por eso **el total de A más B puede diferir en ±0,01 por cada pre-orden
     recalculada**, y nunca más;
   - la vista previa muestra esa diferencia, si la hay, como «ajuste de redondeo».
8. La vista previa muestra, solo en pantalla, el total antes y después de las dos pre-órdenes.

### 4.3 Factura emitida: anular y rehacer

No hay nota de crédito (§2.4), así que la regla contable es la que ya existe:

1. Se anula la factura de A con `void_invoice_with_audit_reason` (`0497`). El asiento se reversa en el
   período abierto, y el motivo es el de la reasignación con el prefijo de la operación.
2. Se crea una **pre-orden** de B con las líneas de E (y una de A con el resto, si cobraba otros
   embarques).
3. **B queda en pre-orden** y contabilidad la emite con el botón de siempre (P1). Así la puerta legal
   AUT-04 (SDD-0690 §3.4) se aplica como siempre al emitir.
4. **Orden dentro de la transacción:** primero se sueltan los recibos (§4.4). Soltarlos baja el pagado y
   devuelve la factura a `emitida`, con la misma regla de anular un recibo (`0467:380-390`). Entonces `void_invoice_with_audit_reason` la acepta (`0497:782-795`).
   Después se crean las pre-órdenes.
5. La factura anulada **queda a nombre de A** y A la sigue viendo anulada en su Portal. No se reescribe
   su `client_markbox`.
6. Si la factura entró por la excepción EXC-0674 (`exc0674_facturas`), la anulación marca `anulada_at`
   como hoy (`0564:231`), y eso deja facturar de nuevo.

### 4.4 Pagos: soltar sin perder

Hoy, para anular una factura con cobros, primero hay que anular los recibos (`0497:787-791`). Anular un
recibo quiere decir «ese dinero no entró», y eso **no es verdad** aquí: el dinero entró, solo estaba
aplicado a la factura equivocada. Por eso hay una acción nueva, **«soltar el recibo»**, distinta de
anularlo. Las decisiones son P3 y P4.

#### 4.4.1 Qué recibos se sueltan

| Estado del recibo | Qué pasa |
|---|---|
| `identificado` o `aplicado`, vivo, de la factura que se anula | **Se suelta** |
| `rendido` (fondos de terceros ya incluidos en una rendición, `0122:10-12`) | **Bloquea** con `recibo_rendido`. Ese dinero ya se rindió a un tercero, y soltarlo cambiaría una rendición cerrada. Hoy la transición a `rendido` no tiene wiring (`0122:53`); si se llega a usar, su salida se diseña aparte (B1 de la revisión). |
| Anulado (`deleted_at`) | No cuenta: es historia |

#### 4.4.2 El estado nuevo `liberado`

**No se reusa `recibido_sin_ref`.** Ese estado quiere decir «no sabemos de quién es»: nace sin cliente y
su asiento usa la cuenta puente 2.1.8 (§2.4). Si un recibo soltado pasara a ese estado, la reaplicación
de hoy lo reclasificaría desde 2.1.8 sin que nunca hubiera pasado por ahí. La cuenta puente quedaría
negativa y Clientes se acreditaría dos veces (H1 de la revisión).

Por eso el recibo soltado pasa a un estado nuevo, **`liberado`**: se sabe de quién es, pero no está
aplicado a ninguna factura.

- **Esquema (F-2):**
  - `application_status` suma `liberado` y `reaplicado` al CHECK de `0122:92`;
  - la CHECK de `0122:96-99` pasa a `(application_status in ('recibido_sin_ref','liberado','reaplicado')) = (invoice_id is null)`;
  - la de los snapshots (`0122:103-109`) **sigue exigiendo el cliente** en `liberado` y `reaplicado`,
    porque solo exime a `recibido_sin_ref`;
  - la tabla nueva `receipt_applications` guarda las partes aplicadas (§4.4.5);
  - una columna nueva, `released_from_invoice_id`, guarda la factura de la que salió.
- **La identificación de hoy no lo toca.** `identify_collection_receipt` exige `recibido_sin_ref`
  (`0467:287`), así que rechaza un recibo `liberado`. La reclasificación de la app
  (`postReceiptReclassEntry`) solo se llama desde la identificación. Nada lo trata como un pago sin
  referencia.

#### 4.4.3 Los asientos (P4: aprobada; contabilidad la valida antes de la F-2)

La cuenta nueva es la **2.1.9 «Anticipos de clientes»**, un pasivo corriente. El número se confirma en la
F-2. Está libre en el repo (§2.4) y, **verificado por Dir_DTD el 2026-11-21** con un conteo de solo
lectura sobre `public.accounts`, ningún tenant de producción tiene una cuenta 2.1.9. Como la app deja
crear cuentas a mano (`app/studio/(app)/contabilidad/actions.ts:628`), la F-2 lo vuelve a medir antes de
sembrarla. **La 2.1.8 no se toca.**

| Paso | Asiento | Fecha |
|---|---|---|
| Soltar el recibo | DR 1.1.2 Clientes / CR **2.1.9** Anticipos de clientes, por el monto del recibo | la de la operación |
| Anular la factura de A | El reverso de siempre (`0497:829-849`) | la que calcula la 0497 |
| Reaplicar a una factura emitida (de B o de A) | DR **2.1.9** / CR 1.1.2 Clientes, por el monto aplicado | la de la reaplicación |

- **Funciona igual, venga el recibo de donde venga.**
  - Si entró con factura, su asiento fue DR caja / CR 1.1.2.
  - Si entró sin referencia y se identificó, su neto también es DR caja / CR 1.1.2, por la
    reclasificación.
  - En los dos casos, soltarlo devuelve el crédito a Clientes y lo pasa a Anticipos.
- **Fecha:** el día de Caracas en que se hace la operación. Si ese día cae en el cierre o antes
  (`get_accounting_closing_date`), el asiento va al día siguiente del cierre. Es la misma regla del
  reverso de la 0497 (`0497:829-833`). **Nunca `received_at`**, para no escribir en un período cerrado
  (principio 6).
- **Misma transacción** (principio 5). Los dos asientos los escribe la RPC, no la app en modo best-effort
  como la reclasificación de hoy, así que si un asiento falla no se suelta nada.
  - Llevan el `receipt_id` y un `source` propio: `receipt_release` y `receipt_reapply`.
  - Son idempotentes por (`receipt_id`, `source`, correlación).
- **Cuadre** (§10, criterio 4b; N1 de la revisión). Los asientos no llevan cliente (§2.1), así que se
  mide en dos planos:
  - **por cliente**, con el saldo que calcula la app con facturas y recibos (`client_outstanding`, 0492),
    más el disponible de los recibos `liberado` de cada pagador;
  - **en el libro**, con el total de la 1.1.2 más el de la 2.1.9. Ese total no cambia al soltar ni al
    reaplicar; solo lo mueven el reverso de la factura anulada y la emisión de la nueva, que se
    compensan entre sí.

Ejemplo inventado: una factura de A por 100, con un abono de 30, se pasa a B.

```text
Antes:      A debe 70 (1.1.2)                          Anticipos 0
Soltar:     DR 1.1.2 30 / CR 2.1.9 30   → A debe 100   Anticipos 30
Anular:     reverso CR 1.1.2 100        → A debe 0     Anticipos 30
Emitir B:   DR 1.1.2 100 / CR ventas    → B debe 100   Anticipos 30
Reaplicar:  DR 2.1.9 30 / CR 1.1.2 30   → B debe 70    Anticipos 0
```

#### 4.4.4 El pagador se conserva (P3; H2 de la revisión)

- **El recibo es uno solo y no cambia de dueño.** Su `client_markbox` y su `client_name` siguen siendo
  los de quien pagó (A).
  - Nada los sobrescribe, porque `identify_collection_receipt` rechaza un recibo `liberado` (§4.4.2).
  - Un trigger los congela mientras el recibo está `liberado` o `reaplicado`. Solo los cambian
    `rename_client_markbox` y la fusión (§5), porque ahí se trata del mismo cliente.
  - Así no hacen falta las columnas `payer_client_*` de la versión anterior. Hacían falta cuando
    `client_markbox` seguía a la factura aplicada; ahora la factura se ve por `receipt_applications`.
- **El Portal de B** ve el abono aplicado a su factura leyendo `receipt_applications` (§4.4.5), sin el
  nombre ni el código de A.
- **El Portal de A** ve su pago como «Aplicado a otra cuenta», sin el código de la factura de B. Qué se
  muestra en detalle se confirma en la F-2.
- **El Studio** muestra los dos datos, por ejemplo: «Pagó DTD-9001 · aplicado a F-2026-0960 de
  DTD-9002».

#### 4.4.5 Reaplicar: una tabla de aplicaciones, no recibos hijos (H4)

La reaplicación **no usa** `identify_collection_receipt`, que sobrescribe el cliente (`0467:310-314`) y
no deja aplicar una parte (`0467:306-308`). **Tampoco crea recibos hijos.** El recibo sigue siendo una
sola fila, con su monto, su fecha y su asiento de caja, y se aplica por partes con una tabla nueva:

**`receipt_applications`** (F-2), una fila por cada parte aplicada:

| Columna | Qué guarda |
|---|---|
| `id`, `tenant_id` | — |
| `receipt_id` | el recibo `liberado` (FK) |
| `invoice_id` | la factura emitida o parcial a la que se aplica (FK) |
| `amount` | lo aplicado, mayor que 0, en la moneda del recibo |
| `journal_entry_id` | su asiento DR 2.1.9 / CR 1.1.2 (§4.4.3), obligatorio |
| `applied_at`, `applied_by`, `correlation_id` | — |
| `voided_at`, `voided_by`, `void_reason` | para deshacer una aplicación |

- **El monto original** es `payment_receipts.amount`, que **nunca cambia**.
- **El disponible** se calcula: `amount − suma de las aplicaciones vivas`. Una guarda en la base impide
  que esa suma pase de `amount`. Ningún otro recibo nace de la aplicación, así que no hay nada que
  heredar: el recibo conserva `received_at`, `fund_class`, `cash_account_id` y su `journal_entry_id`.
- **El estado del recibo:**
  - `liberado` mientras el disponible sea mayor que 0;
  - `reaplicado` cuando el disponible llega a 0, con `invoice_id` en null;
  - la CHECK de `0122:96-99` incluye a los dos en el lado de `invoice_id is null` (§4.4.2).
- **La factura destino** sube su `paid_amount` por lo aplicado y pasa a `parcial` o `pagada`, con la
  regla de `0467:236-240`. `client_outstanding` (0492) lo lee de ahí sin cambios.

**La RPC `apply_released_receipt(p_receipt_id, p_invoice_id, p_amount, p_reason)`:**

- exige un recibo `liberado` y una factura emitida o parcial (ni borrador ni anulada), de la misma moneda
  y del mismo tenant;
- exige una factura con la **misma clase de fondos** (`fund_class`) que el recibo. Si no coincide,
  bloquea, para que una rendición nunca mezcle fondos propios y de terceros;
- `p_amount` va de 0,01 al menor entre el disponible y el saldo de la factura;
- escribe la aplicación, su asiento, el `paid_amount` y el evento `receipt_reapplied` en una
  transacción;
- **el resto queda como saldo a favor de quien pagó**, en la 2.1.9. Cobranzas lo ve en «Pendiente de
  aplicar» a nombre del pagador, y después se aplica con la misma RPC a otra factura de A o de B.

**Deshacer una aplicación** (`void_receipt_application`, con motivo):

- marca `voided_at`, baja el `paid_amount` de la factura y reversa su asiento (DR 1.1.2 / CR 2.1.9);
- el recibo vuelve a `liberado`.

**Anular el recibo:**

- un recibo `liberado` o `reaplicado` solo se anula sin aplicaciones vivas;
- al anularlo se reversan su asiento de caja y el de soltar.

**Anular una factura que tiene aplicaciones:** ya lo bloquea el `paid_amount > 0` de `0497:793-795`.
Primero se deshacen sus aplicaciones.

**En la vista previa de la reasignación:**

- cada recibo que se suelta sale con su monto, solo en pantalla;
- la casilla «Lo pagó A por B: aplicarlo a la factura nueva cuando se emita» **no aplica nada en ese
  momento**, porque la factura de B nace en pre-orden (P1). Deja una **instrucción pendiente** en el
  recibo (`apply_on_emit_invoice_id`). Cuando contabilidad emite esa pre-orden, la emisión llama a
  `apply_released_receipt` por el menor entre el disponible y el saldo de la factura, y lo dice en su
  confirmación;
- si el abono es mayor que lo que costará la factura de B, avisa: «El abono es mayor que la factura nueva;
  el resto queda como saldo a favor de DTD-9001».

#### 4.4.6 Un cobro sin asiento no se suelta (N2)

El asiento del cobro se publica hoy en modo best-effort, así que puede faltar: es lo que muestra
«Por contabilizar» (`libro-control-queries.ts:379-403`). Si se soltara un recibo sin asiento vivo, el
DR 1.1.2 / CR 2.1.9 descuadraría el libro.

**Soltar exige** que el recibo tenga su asiento vivo:

- `source = 'receipt'`;
- y, si entró sin referencia, también el de `receipt_reclass`.

Si falta, **bloquea** con `cobro_sin_asiento`, con el texto «Este cobro todavía no está contabilizado:
contabilízalo en Contabilidad › Por contabilizar y vuelve a intentarlo». La vista previa lo muestra como
bloqueo.

#### 4.4.7 Los lectores de `payment_receipts` cuentan una sola vez (H4)

Como el recibo es uno solo y su monto no cambia, cada lector cuenta una vez:

| Lector | Qué lee hoy | Con esta spec |
|---|---|---|
| Reportes, «Cobrado» (`lib/studio/reports/queries.ts:806-811`, `:856-872`) | `amount` de todo recibo vivo, por `received_at` | **Sin cambio.** El recibo cuenta una vez, en su fecha. Soltar y reaplicar no son dinero nuevo. |
| Contabilidad, «Por contabilizar» (`libro-control-queries.ts:379-403`) | recibos sin asiento vivo | **Sin cambio para el recibo**, que conserva su asiento. Las aplicaciones nacen con su asiento en la misma transacción, así que nunca aparecen como pendientes. |
| Libro de control, cruce de 1.1.2 por origen (`libro-control-queries.ts:55-75`) | `receipt`, `receipt_reclass`, `invoice_reversal` y los documentales | **Se suman los orígenes `receipt_release` y `receipt_reapply`** (N3). El cruce nuevo de la 2.1.9 dice que su saldo es igual a la suma de los disponibles de los recibos `liberado`. |
| Rendiciones (`lib/studio/renditions/queries.ts:271`, `:453`; `renditions/actions-helpers.ts:204`, `:297`) | recibos `third_party` en `aplicado` | **Excluyen `liberado` y `reaplicado`** hasta que la F-2 enseñe a rendir por aplicación. Un recibo soltado no estaba rendido, porque el estado `rendido` bloquea (§4.4.1), así que nada se rinde dos veces. |
| Cobranzas (`lib/studio/payment-queries.ts:41`, `:153`) | recibos por `invoice_id` | **Lee además `receipt_applications`** por factura. Los pagos de una factura son sus recibos más sus aplicaciones vivas, y suman su `paid_amount`. |
| `client_outstanding` (`0492`) | `paid_amount` de las facturas | **Sin cambio.** |

#### 4.4.8 Nunca se pierde

- La vista previa dice cuántos recibos se sueltan y por cuánto, solo en pantalla.
- Los eventos guardan los ids de los recibos y de las aplicaciones, no los montos (§6.2).
- El disponible de un recibo nunca queda negativo, y la suma de sus aplicaciones vivas más su disponible
  es siempre su monto original.

### 4.5 Qué sigue bloqueando

Cada bloqueo lleva su texto llano y la acción que lo desbloquea:

- reclamo vivo;
- prealerta viva;
- orden de despacho viva;
- reporte de pago pendiente del Portal;
- crédito de referido aplicado;
- recibo `rendido` (§4.4.1);
- cobro sin asiento vivo (`cobro_sin_asiento`, §4.4.6);
- pre-orden que queda con total en 0 o negativo (`preorden_sin_embarques`, §4.2);
- factura en un período cerrado **cuyo reverso no se pueda asentar**;
- otra reasignación del mismo embarque, ya preparada y a la espera de confirmación (§6.3).

## 5. Caso 2 — Fusionar dos clientes duplicados

Notación: **R** es la ficha que se retira y **S** la que sobrevive. Es **el mismo cliente real**, así que
la regla cambia: **no se anula nada.** La factura emitida a R se emitió a esa persona, y sigue siendo
verdad con el código de S. Es el mismo razonamiento de `rename_client_markbox` (§2.6).

| Objeto de R | Hoy (`0361`) | Con esta spec |
|---|---|---|
| Embarques, recepciones, consolidación y documentos (por texto) | No se mueven; S no los ve en el Portal | **Se reescriben** al Shipping Mark de S, como hace `rename_client_markbox` (`0552:808-856`). Es la 0695 F-6; esta spec la adopta y no la duplica. |
| Pre-órdenes de R | No se mueven | **Se reescriben** a S. Si S tiene una pre-orden viva en el mismo contenedor, **se unen** en la de S y se elimina la de R (P7). |
| Facturas emitidas, parciales y pagadas de R | No se mueven | **Se reescribe solo `client_markbox`.** El titular sellado se queda como se emitió (`0466:262-273`). |
| Facturas anuladas de R | No se mueven | **Se reescriben** también, para que el historial de S esté completo (P8). |
| Recibos y reportes de pago | No se mueven | **Se reescriben** a S. Los saldos ya siguen la cadena (`0492:61-66`). |
| Saldo a favor y créditos de referido | `referrals` se mueve por `client_id` (`0361:216-222`) | **Igual.** |
| Shipping Mark de R | Queda en la ficha retirada como alias (`0361:230-236`) | **Igual**, y además se registra en `client_markbox_history` de S para que `resolve_markbox` lo encuentre (`0367:39-55`). |
| Contactos, direcciones y conversaciones | Se mueven (`0361:140-188`) | **Igual**, más la ciudad y el estado de la 0694 F-2. |
| Acceso al Portal | Se muda, o se revoca el duplicado (`0361:120-134`) | **Igual**, y la vista previa dice cuál de los dos pasa. |
| Aceptaciones legales | No se mueven, a propósito (`0361:224-227`) | **Igual:** las aceptó R. La vista previa dice si S no tiene una vigente. |
| Kommo | Rellena el id vacío (`0361:245-279`) | **Igual.** |
| Embarque de R en un contenedor donde S también tiene | — | Sus líneas de pre-orden se unen según P7. |

**Vista previa y motivo:** hoy la fusión no tiene ninguna de las dos (§2.5). Esta spec agrega a
`merge_clients` el mismo patrón `p_dry_run` + `p_reason` de la 0551, con conteos por tabla.

**Saldos de signo contrario** (B4 de la revisión): si R tiene saldo a favor (un sobrepago o un recibo `liberado`) y S debe, la fusión **no los compensa sola**. Un sobrepago no compensa otra factura (`0492:56-57`). La vista previa lo avisa: «DTD-9001 tiene saldo a favor y DTD-9002 tiene facturas abiertas; Cobranzas puede aplicarlo después». El recibo `liberado` se aplica después con `apply_released_receipt` (§4.4.5). Un sobrepago que no está en un recibo `liberado` queda fuera de esta spec (§7).

**Deshacer:** la fusión sigue siendo **irreversible** en el sentido de SGE-00 (permanencia P3). La vista previa lo
dice y la bitácora guarda, por tabla, los ids que se reescribieron: con eso se puede rastrear y, si hace
falta, deshacer a mano con un procedimiento asistido.

## 6. Cómo se ve

### 6.1 Vista previa obligatoria

- La RPC de cada operación tiene `p_dry_run`, que devuelve lo mismo que haría sin escribir
  (`0551:258-265`). La respuesta suma, a `blockers`/`warnings`/`moved`, un bloque `cascade` con una
  entrada por documento afectado:
  - `accion` de un vocabulario cerrado: `mover`, `partir`, `unir`, `anular_y_rehacer`, `soltar_recibo`,
    `reescribir_codigo`, `sin_cambio`;
  - el código del documento (por ejemplo `F-2026-0901`);
  - los montos **antes y después**, solo para pantalla.
- **La vista previa lleva una huella** (`preview_token`): un hash del estado que leyó, con los ids y
  el `write_version` de las facturas (`0495:349-354`). Al confirmar se pasa la huella, y si el estado
  cambió, la RPC responde `40001` y la pantalla pide ver la vista previa de nuevo. Así nadie confirma un
  aviso viejo.
- Texto en pantalla, con el tono que pidió Sam (ejemplo inventado):

```text
Pasar DTDU-0003 de DTD-9001 a DTD-9002

Esto va a cambiar:
• La pre-orden F-2026-0901 de DTD-9001 se parte: queda con 2 embarques.
  Total antes 1.234,50 → después 823,00 USD.
• DTDU-0003 se suma a la pre-orden F-2026-0950 de DTD-9002.
  Total antes 400,00 → después 811,50 USD.
• 1 recepción del Almacén CN (3 cajas), 1 línea de consolidación y 2 documentos del Portal
  pasan a DTD-9002.

Avisos:
• DTD-9002 va a ver en su Portal 1 BL y 4 eventos del seguimiento.

Motivo (obligatorio)  [_______________________]
[Cancelar]  [Pasar a DTD-9002]
```

  Y con una factura emitida y un abono:

```text
• La factura F-2026-0877 de DTD-9001 se anula. Su asiento se reversa hoy.
• Se crea la pre-orden de DTD-9002 con DTDU-0003. Contabilidad la emite.
• El abono R-2026-0410 (300,00 USD) se suelta y queda pendiente de aplicar a nombre de DTD-9001.
  [ ] Lo pagó DTD-9001 por DTD-9002: aplicarlo a la factura nueva cuando se emita.
```

- Cifras con coma decimal (`1.234,50`), según el rebrand del 2026-11-20. Texto y no solo color; tuteo.
- **Montos solo en pantalla:** ni el evento de auditoría, ni los logs del servidor, ni los errores llevan
  montos (§6.2).

### 6.2 Auditoría

- **Un evento por operación** en la entidad principal (`shipment_client_reassigned` ampliado, o
  `client_merged` ampliado, `0455:231-279`), más **un evento por documento tocado** en su propia entidad:
  `invoice_split`, `invoice_voided_by_reassign`, `invoice_recreated`, `receipt_released`,
  `receipt_reapplied` y `receipt_application_voided`, más los del flujo de dos pasos (§6.3.2). Todos llevan la misma correlación (`sdd-0699:<operación>:<txid>`).
- Motivo obligatorio, de 4 a 1000 caracteres, en la columna `reason` (AUD-01), con el aviso de no escribir
  datos personales (SDD-0645 §5).
- `payload` **sin texto libre ni montos**: ids, códigos de documento, Shipping Marks, conteos y el
  vocabulario cerrado de `accion`. Los montos ya quedan en las facturas mismas y en su auditoría
  `audit_d2_invoices`.
- `permanence` (la escala de SGE-00, no las preguntas de la §9):
  - **P1** para mover y partir borradores (se puede volver a pasar);
  - **P2** para anular y rehacer, y para soltar un recibo (se rastrea y se corrige, pero la anulación no
    se deshace);
  - **P3** para la fusión.
- **Deshacer:** no hay un botón de deshacer genérico. La ficha del embarque y la del cliente muestran el
  historial con la correlación. Desde él se puede volver a pasar (permanencia P1) o seguir el rastro de
  cada documento (permanencias P2 y P3).

### 6.3 Permisos y confirmación en dos pasos (P9)

**Un paso** cuando la operación solo mueve o parte pre-órdenes y no anula nada (permanencia P1). Lo hace
quien tiene `reassign_shipment_owner`: operations, commercial y admin (`rbac.ts:324-331`; D2 de la 0645).
Es lo de hoy, más el partido de la §4.2.

**Dos pasos** cuando la operación anula una factura emitida o suelta un recibo (permanencia P2). Es lo que
decidió Sam en la P9: **la prepara operaciones o comercial, y la confirma contabilidad o un admin.** Hoy
nadie, salvo un admin, tiene a la vez `reassign_shipment_owner` (`rbac.ts:331`) y el módulo `invoices`
(`rbac.ts:121`). Por eso la operación se parte en dos personas.

#### 6.3.1 Dónde queda la operación preparada

Una tabla nueva, `ownership_change_requests` (F-3):

| Columna | Qué guarda |
|---|---|
| `id`, `tenant_id` | — |
| `kind` | `reassign_shipment` (y `merge_clients` si la F-4 lo adopta) |
| `shipment_id`, `target_client_id` | el embarque y el cliente nuevo |
| `preview_token` | la huella de la vista previa que vio quien preparó (§6.1) |
| `cascade_summary` | la lista de la vista previa **sin montos**: acciones, códigos de documento e ids de recibos |
| `apply_on_emit` | las casillas marcadas de la §4.4.5 |
| `reason` | el motivo de quien prepara, de 4 a 1000 caracteres |
| `status` | `preparada` · `confirmada` · `rechazada` · `cancelada` · `vencida` |
| `prepared_by`, `prepared_at`, `expires_at` | — |
| `decided_by`, `decided_at`, `decision_reason` | quien confirma o rechaza, y su motivo |

- **Una sola preparada por embarque:** un índice único parcial sobre `shipment_id` donde `status =
  'preparada'`. Mientras hay una, el embarque no se puede reasignar por otro camino (§4.5).
- **RLS:** la leen quien la preparó y los roles que pueden confirmarla, en su tenant. Se escribe solo por
  RPC.

#### 6.3.2 El flujo

1. **Preparar** (`prepare_ownership_change`). Lo hace quien tiene `reassign_shipment_owner`.
   - Corre la vista previa, guarda la fila `preparada` con la huella y el resumen, y no cambia nada más.
   - Evento `ownership_change_prepared`.
2. **Confirmar** (`confirm_ownership_change(p_request_id, p_reason)`). Lo hace `accounting` o `admin`
   activo del tenant:
   - **Nunca quien preparó** (separación de funciones), aunque sea admin. Si un tenant tiene un solo
     admin y nadie de contabilidad, la operación no se puede confirmar. Es intencional: el caso se
     levanta a Sam.
   - La RPC **vuelve a calcular la vista previa**:
     - si la huella **coincide**, ejecuta todo en una transacción (§4.2-§4.4, auditoría incluida) y la
       fila pasa a `confirmada`;
     - si **no coincide** (alguien emitió, cobró o editó algo en el medio), no ejecuta nada y responde
       `40001`. La pantalla muestra la vista previa nueva junto a la vieja, y quien confirma solo puede
       **rechazarla**. Quien preparó la prepara de nuevo, con otra huella.
3. **Rechazar** (`reject_ownership_change`). Lo hace quien puede confirmar, con motivo. La fila pasa a
   `rechazada` y no cambia nada más.
4. **Cancelar**. Lo hace quien preparó, mientras siga `preparada`.
5. **Vencer.** A las **72 horas** de `prepared_at`, una fila `preparada` se trata como `vencida`. El
   índice parcial la excluye y no se puede confirmar. El plazo se confirma en la F-3.

Cada paso deja su evento (`ownership_change_confirmed`, `_rejected`, `_cancelled` y `_expired`), con la
misma correlación de la operación.

#### 6.3.3 Qué ve cada rol

| Rol | Ve |
|---|---|
| Quien preparó | En el embarque, «Cambio de cliente pendiente de confirmar por contabilidad», con la vista previa, la fecha de vencimiento y el botón «Cancelar». |
| `accounting` y `admin` (no quien preparó) | En Facturación, la bandeja «Cambios de cliente por confirmar», con la vista previa **recalculada al abrirla** (montos solo en pantalla) y los botones «Confirmar» y «Rechazar». |
| Otros con acceso al embarque | La marca «Cambio de cliente pendiente», sin montos ni botones. |
| Equipo de China (SDD-0531) | Nada nuevo: no ve nombres de clientes. |
| Portal | Nada, hasta que se confirma. |

#### 6.3.4 Fusión

La P9 trata de las reasignaciones. Para la fusión, esta spec **propone** una acción RBAC propia,
`merge_clients_cascade`, que hoy no existe (`0361:73-75` usa cinco roles y la app, `moduleEditDenial`).
Como la fusión no anula nada, va en un paso, con vista previa y motivo. Se decide en la F-4.

## 7. Fuera de alcance

- Notas de crédito o facturación fiscal (§2.4). Si llegan, se diseñan aparte.
- Abonos sobre una pre-orden (SDD-0690 §8).
- Partir un embarque entre dos clientes (SDD-0673 parte medidas, no dueños).
- Pasar varios embarques a la vez. Una versión por lote puede venir después, sobre la misma RPC.
- Avisar a A o a B por correo o WhatsApp del cambio.
- Corregir datos de producción: el 64 se carga aparte, y cualquier corrida sobre producción lleva su OK.
- Mover aceptaciones legales.
- Compensar automáticamente un sobrepago que no está en un recibo `liberado` (§5).
- Soltar un recibo `rendido` (§4.4.1).

## 8. Fases (cada una con su PR; las migraciones con OK nominal)

| Fase | Qué | Depende de |
|---|---|---|
| F-0 | **Hecha. Verificada por Dir_DTD el 2026-11-21** en el ledger, con solo lectura: 0464, 0466, 0467, 0494, 0497, 0551, 0552, 0564 y 0569 están aplicadas. Sus cabeceras «NO APLICADA» quedaron viejas y no se editan (§2). | — |
| F-1 | Partir y unir pre-órdenes al pasar un embarque (§4.2). Redefine `reassign_shipment_client` con `cascade` y la huella. Es la que desbloquea el caso del 64. | F-0, P2, P6 (decididas) |
| F-2 | Soltar un recibo y reaplicarlo (§4.4): estados `liberado` y `reaplicado`, cuenta 2.1.9, `receipt_applications`, asientos en la misma transacción, `apply_released_receipt` con aplicación parcial, y los lectores de la §4.4.7 (Reportes, libro de control, Rendiciones y Cobranzas). Es una acción propia en Cobranzas. | F-0, P3, P4 (decididas); la validación de contabilidad de la P4 |
| F-3 | Anular y rehacer facturas emitidas al pasar un embarque (§4.3), con la F-2 dentro, y el flujo de dos pasos (§6.3): `ownership_change_requests`, preparar, confirmar, rechazar, cancelar y vencer. | F-1, F-2, P1, P9 (decididas) |
| F-4 | Fusión con vista previa, motivo y cascada (§5). Va después de la 0694 F-2 y la 0695 F-6, que redefinen `merge_clients`. | 0695 F-6, P7, P8 (decididas) |

## 9. Decisiones de Sam (2026-11-21)

Sam aprobó las nueve opciones recomendadas. Su texto, en el chat de Dir_DTD, fue:

> «SDD-0699: apruebo las nueve opciones recomendadas»

Dir_DTD se lo pasó a este Worker el 2026-11-21.

| Pregunta | Decisión de Sam (2026-11-21) |
|---|---|
| P1 | **a)** La factura de B nace en pre-orden y la emite contabilidad. |
| P2 | **a)** Los cargos sin embarque se quedan en A, con aviso en la vista previa. |
| P3 | **a)** El abono se suelta y queda pendiente de aplicar a nombre de quien pagó. Pasa a la factura de B solo si se marca. |
| P4 | **a)** El asiento se reclasifica a anticipos de clientes (cuenta 2.1.9, §4.4.3) y se revierte al aplicarlo. **Nota:** está aprobado, pero **contabilidad lo valida antes de implementarlo** (antes de la F-2). |
| P5 | **a)** La tarifa congelada se avisa, como hoy, y contabilidad la reemplaza. |
| P6 | **a)** La pre-orden que queda sin líneas se elimina con borrado lógico y queda en la bitácora. |
| P7 | **a)** Al fusionar, las pre-órdenes del mismo contenedor se unen en la de S y se elimina la de R. |
| P8 | **a)** Al fusionar, las facturas anuladas de R también pasan al código de S. |
| P9 | **a)** La reasignación que anula facturas o suelta pagos la prepara operaciones o comercial, y la confirma contabilidad o un admin. |

Debajo quedan las preguntas como se le hicieron a Sam. Cada una trae sus opciones; la recomendada va
primero, y es la que se aprobó.

**P1. Cuando se anula una factura emitida para pasar el embarque, ¿la de B nace emitida o en pre-orden?**

- **a) En pre-orden, y contabilidad la emite (recomendada).** Quien reasigna no necesita permiso de
  facturar, y la puerta legal se aplica como siempre.
- b) Emitida en la misma operación. Es más rápido, pero obliga a pasar AUT-04 y a tener permiso de
  facturación.

**P2. Factura o pre-orden con cargos sin embarque (descuento, cargo a mano), ¿a quién van?**

- **a) Se quedan en A y la vista previa lo avisa (recomendada).** Contabilidad decide si los reparte.
- b) Se reparten en proporción al monto de los embarques.
- c) Bloquea hasta que alguien los reparta a mano.

**P3. Factura emitida y pagada a medias: ¿qué pasa con el abono?**

- **a) Se suelta y queda pendiente de aplicar a nombre de quien pagó (A); se aplica a la factura de B
  solo si se marca (recomendada).** No cambia de pagador en silencio.
- b) Pasa siempre a la factura nueva de B.
- c) Bloquea: primero Cobranzas mueve el abono a mano.

**P4. Contabilidad del abono suelto: ¿cómo queda el asiento?**

- **a) Se reclasifica de la cuenta por cobrar a «anticipos de clientes» con un asiento nuevo y se
  revierte al aplicarlo (recomendada).** El balance dice la verdad en todo momento.
- b) El asiento del cobro queda como está, ligado a la factura anulada, hasta que se aplique.

Esta conviene confirmarla con quien lleva la contabilidad.

**P5. Tarifa congelada del cliente anterior.**

- **a) Igual que hoy: se avisa y contabilidad la reemplaza (recomendada).**
- b) Se reemplaza sola por la tarifa vigente de B en la misma operación.

**P6. Si al partir la pre-orden de A no le queda ninguna línea:**

- **a) Se elimina con borrado lógico; queda en la bitácora (recomendada).**
- b) Queda viva en $0 para que alguien la revise.

**P7. Al fusionar, si R y S tienen cada uno una pre-orden en el mismo contenedor:**

- **a) Se unen en la de S y se elimina la de R (recomendada).** Una pre-orden por cliente, como el
  cargador.
- b) Quedan las dos, una al lado de la otra.

**P8. Al fusionar, ¿las facturas anuladas de R también pasan al código de S?**

- **a) Sí, para que el historial de S esté completo (recomendada).**
- b) No: se quedan con el código de R, que es alias.

**P9. ¿Quién confirma una reasignación que anula facturas o suelta pagos?**

- **a) Operaciones o comercial la prepara y la confirma contabilidad o un admin (recomendada).** Es la
  misma regla de la anulación de hoy.
- b) Cualquiera con `reassign_shipment_owner`.
- c) Solo admin.

## 10. Aceptación verificable (para cuando se implemente)

1. Pasar E desde una pre-orden compartida la parte: A queda con sus otras líneas y B con las de E, con
   los totales recalculados, y la vista previa da los mismos números que el cambio real.
1b. **El total se conserva.** La suma de las bases de A y de B es exactamente la misma antes y después.
    El total de A más B difiere, como máximo, en ±0,01 por pre-orden recalculada, y la vista previa
    muestra ese ajuste de redondeo.
1c. Si a A solo le quedan cargos sin embarque con total en 0 o negativo, la operación bloquea con
    `preorden_sin_embarques`; con total mayor que 0, pasa con el aviso.
2. Con una pre-orden viva de B en el mismo contenedor, las líneas se suman a ella; sin ella, se crea una.
3. Con una factura emitida, la operación la anula con reverso, crea la pre-orden de B (P1), y la anulada
   sigue a nombre de A.
4. Con un abono, el recibo queda `liberado` y su `client_markbox` sigue siendo el del pagador. La factura
   baja su pagado, ningún recibo se anula y `identify_collection_receipt` rechaza el recibo `liberado`.
4b. **Cuadre contable.**
    - Por cliente: el saldo de A, el de B (con `client_outstanding`) y el disponible de los recibos
      `liberado` suman lo mismo antes y después, salvo la factura anulada y la nueva.
    - En el libro: el total de la 1.1.2 más el de la 2.1.9 solo lo mueven el reverso y la emisión.
    - El saldo de la 2.1.9 es igual a la suma de los disponibles de los recibos `liberado`.
    - La 2.1.8 no se mueve.
4c. Los asientos de soltar y reaplicar van en la misma transacción que el cambio: si falla uno, no
    cambia nada. Con el cierre en el día de la operación o después, el asiento va al día siguiente del
    cierre, nunca a `received_at`.
4d. `apply_released_receipt` aplica una parte: crea una fila en `receipt_applications`, el recibo queda
    `liberado` por el resto y su `amount` no cambia. Las aplicaciones vivas más el disponible suman el
    monto original, y el pagador no cambia. Rechaza un monto mayor que el disponible o que el saldo de la
    factura destino, y una factura de otra clase de fondos. Al llegar el disponible a 0, el recibo pasa a
    `reaplicado`.
4f. **Cada lector cuenta una vez** (§4.4.7), con un recibo soltado y aplicado en dos partes:
    - Reportes, «Cobrado», suma su monto una vez, en su `received_at`;
    - «Por contabilizar» no lista el recibo ni sus aplicaciones;
    - el cruce de la 1.1.2 incluye `receipt_release` y `receipt_reapply`, y el de la 2.1.9 cuadra con
      los disponibles;
    - Rendiciones no lo incluye mientras esté `liberado` o `reaplicado`;
    - en Cobranzas, los pagos de cada factura destino suman su `paid_amount`.
4g. Soltar un recibo sin asiento de cobro vivo bloquea con `cobro_sin_asiento` (§4.4.6).
4e. Un recibo `rendido` bloquea con `recibo_rendido`.
5. Confirmar con una huella vieja da `40001` y no cambia nada.
5b. **Dos pasos.** Una reasignación que anula o suelta queda `preparada` sin cambiar nada más. No la
    confirma quien la preparó, ni un rol fuera de `accounting` o `admin`. Vencida, no se confirma.
    Con dos preparadas para el mismo embarque, la segunda falla.
6. Con un bloqueo de §4.5, o si falla un evento de auditoría, ninguna fila cambia.
7. Ningún evento, log ni error lleva montos o texto libre fuera de `reason`.
8. La fusión con vista previa reescribe el código de R en embarques, facturas y recibos. S ve en el Portal
   lo que era de R, y el titular sellado de las facturas emitidas no cambia. Con saldos de signo
   contrario, la vista previa avisa y no compensa nada.
9. Los roles fuera de §6.3 reciben `42501`, y un admin de otro tenant no encuentra nada.
10. En un período cerrado, el reverso va al período abierto.

## 11. Archivos (allowlist de esta PR)

- `docs/specs/0699-cascada-cambio-de-dueno/spec.md` (nueva)
- `docs/specs/README.md` (índice regenerado)
- `.agents/handoffs/0699-cascada-cambio-de-dueno.md` (nuevo)

Cada fase de la §8 trae su propia allowlist en una enmienda de esta spec.

## 12. Gobernanza

| Política | Clasificación |
|---|---|
| SGE-00 / MP-01 (permanencia) | cumplimiento propuesto: P1 para mover y partir, P2 para anular y soltar, P3 para la fusión; vista previa y motivo |
| BTN-01 | cumplimiento propuesto: el primario nombra el destino; con P2/P3, confirmación doble |
| AUD-01 / AUD-02 | cumplimiento propuesto: eventos en la misma transacción, correlación común, sin montos ni texto libre fuera de `reason` |
| ERR-01 | cumplimiento propuesto: cada bloqueo con texto llano y su salida |
| Privacidad (`revisar-datos-ve`) | no aplica en esta PR (solo spec). Se pasa en la F-1 y la F-4: la fusión mueve datos personales y el Portal de B ve documentos que eran de A (riesgo aceptado H-2 de la 0645) |
| Carril | con revisión previa: toca facturación, pagos, montos y RLS del Portal |
