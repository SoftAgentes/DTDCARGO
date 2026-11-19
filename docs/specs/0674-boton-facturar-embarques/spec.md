---
sdd: "0674"
title: "Embarques: botón «Facturar» para los contenedores montados sin pasar por origen (regla transitoria)"
status: approved
author: "Claude (Worker) + Sam"
created: 2026-11-18
updated: 2026-11-18
supersedes: null
superseded_by: null
related: ["0040", "0054", "0197", "0294", "0357", "0407", "0414", "0466", "0497", "0514", "0543", "0549", "0552", "0553", "0556", "0571", "0574", "0661"]
confidencialidad: interno
---

# SDD-0674 — Botón «Facturar» en Embarques (regla transitoria)

> Sam lo pidió en la reunión con la oficina del 2026-11-18, por el DG. Embarques tendría un botón
> «Facturar» que oprimen **solo** `accounting` y `admin`, los roles que ya ven montos (§4, pregunta 4). Al facturar, la factura
> llega al portal del cliente y a la contabilidad. Es **transitorio**: era para los cuatro contenedores
> montados sin pasar por origen, y por decisión de Sam (§4, pregunta 5) hoy cubre **solo el contenedor
> 64**. Antes de facturar, la oficina confirma que lo cargado en el sistema cuadra con el Excel y escribe
> el valor a facturar.
>
> **Aprobada por Sam el 2026-11-18.** Contestó las seis preguntas del §4 y aprobó las tres decisiones del
> §3.1 (a) y del §4, pregunta 3. Alcance: solo el contenedor 64. Migración: 0564.
>
> **Revisión independiente (Opus) sobre `a166d07fe`: CHANGES_REQUESTED, 7 bloqueantes.** El DG decidió cómo
> resolverlos el 2026-11-18. Están corregidos en el §3.1, el §7 y el §8 (contrato de implementación), y el
> §9 dice dónde quedó cada uno.

## 1. Por qué es transitorio

El flujo definitivo es otro: al recibir la mercancía en China se registra, y desde ahí el cliente ve el
tracking y el monto sin facturar (decisión 9; SDD-0574 y 0571). Los contenedores de esta regla se
montaron sin recepción real en origen: entraron con la carga de consolidados (SDD-0543) desde el Excel. Por
eso no tienen el camino normal, y la oficina necesita una forma de decir «esto ya está listo para el
cliente».

## 2. Lo que hay hoy (medido en código y migraciones, sin leer producción; base `origin/main` `9434cc4f6`)

### 2.1 El portal ya muestra los embarques sin factura

- **Lista de envíos.** `listMyShipments` (`lib/portal/portal-queries.ts`) lee `shipments` por tenant y
  Shipping Mark del principal. No mira `invoices`.
- **La RLS tampoco.** La policy `shipments portal self read` (migración 0416) solo exige que el envío esté
  vivo y que su `client_markbox` sea del cliente activo del mismo tenant.
- **Detalle de envío** (`app/portal/(app)/envios/[code]`). Muestra el estado y el avance sin depender de
  una factura. Lo único que habla de facturar es la tarjeta «Este envío espera tu aceptación para que
  podamos facturarlo» del gate legal AUT-04.
- **Aviso «Seguimiento en construcción».** `TRACKING_EN_CONSTRUCCION = true`
  (`lib/portal/tracking-en-construccion.ts:69`, SDD-0514). La portada, Envíos y el detalle lo pintan
  mientras el almacén no registre en el sistema.
- **Facturas en el portal.** El cliente ve sus facturas vivas **menos los borradores**: la policy
  `invoices portal self read` (0452) tiene `status <> 'borrador'`, y las queries lo repiten. Tampoco ve las
  anuladas que nunca se emitieron (0556).

**Consecuencia.** Hoy un embarque del contenedor ya se ve en el portal **antes** de facturar, con el
aviso de seguimiento en construcción encima. Que solo se vea al facturar **no** se logra con un botón.
Habría que cambiar la regla del portal: un filtro nuevo en la policy 0416 y en las lecturas del portal de
las SDD-0549, 0552 y 0553, con su migración. Ese cambio cruzaría la 0668 («código viejo visible en el
portal»), que está en la PR #680, sin fusionar, y solo toca documentación (§5).

Por eso, «al facturar el cliente ve el tracking» **ya ocurre hoy**, aunque no haya factura. Lo que el
botón agrega es la factura y su monto en el portal y en la contabilidad.

### 2.2 Cómo se crea hoy una factura

- **Studio, `createInvoice`** (`app/studio/(app)/facturacion/actions.ts`):
  - Pasa la puerta `moduleEditDenial(supabase, "invoices")`.
  - Pide el código a `next_invoice_code(p_tenant_id)` (0077:63-83). **No es atómico.** Calcula
    `max + 1` sobre los `invoice_code` del año sin tomar ningún lock, y solo lo protege el
    `unique (tenant_id, invoice_code)` de la 0077:48. Dos emisiones simultáneas del mismo tenant pueden pedir
    el mismo número, y la segunda falla al insertar. El riesgo es esa concurrencia, no un hueco.
  - Inserta la factura en `borrador`.
- **Emisión, `emitInvoice`.** La pasa de `borrador` a `emitida`, pone `issued_at` y `due_date` (+30 días
  si no tenía) y pasa el gate legal AUT-04.
  - El gate está en bloqueo duro: `LEGAL_GATE_HARD_BLOCK = true` (`lib/studio/legal/gate-config.ts`).
  - Una factura DDP **no se emite** si el cliente no tiene una aceptación vigente.
- **Quién puede.**
  - El módulo `invoices` es solo de `accounting` (y `admin`) en `lib/studio/rbac.ts`.
  - La RLS lo repite. La 0407 (`invoices_accounting_insert` / `_update`) exige
    `current_studio_role() in ('accounting','admin')` para INSERT y UPDATE.
  - La 0414 hace lo mismo para SELECT.
  - Embarques (`shipments`) lo ven `commercial`, `operations`, `accounting`, `warehouse` y `support`.
  - **Hoy el rol de Embarques no puede crear, emitir ni leer facturas con su sesión.**
- **La carga de consolidados ya sabe facturar** (`scripts/consolidados/modelo.ts` y `lote-sql.ts`).
  - Hace una factura `borrador` en USD por cliente y contenedor, con `shipment_id` = el primer embarque.
  - Lleva una línea por embarque («Flete DDP · remitente · m³ × $precio», con el «PRECIO VENTA CBM» del
    Excel) más «Exceso de peso» con «PRECIO X KG EXTRA».
  - Con `--sin-facturas` no crea ninguna. Así se cargó el DDP 64 en producción (0 facturas, según la nota
    del DG del 2026-11-17).
- **Tarifa congelada (SDD-0571).** La carga de consolidados no escribe `shipment_rate_snapshots`. Los
  contenedores montados sin pasar por origen **no tienen tarifa congelada**, salvo que alguien la haya
  creado aparte.

### 2.3 Qué ve el dinero en Embarques

Por la SDD-0661, «Por cobrar» y «Cobrado» de la franja y del detalle por cliente se leen en el servidor
**solo** si el rol es `accounting` o `admin` y la puerta del módulo `invoices` deja pasar. Si no, el dato
no viaja al navegador.

## 3. Lo que implica el botón (decidido)

- **Escribir `invoices` con el rol de Embarques.** La RLS 0407 no lo deja, y no se amplía. Lo hace una RPC
  `security definer` acotada, `exc0674_facturar` (migración 0564, §8). No se usa el cliente admin desde
  una action para escribir o leer `invoices`: rompería la frontera SDD-0357.
- **Que el cliente vea solo al facturar.** No hace falta: el portal ya muestra los envíos (§2.1). La
  factura emitida aparece en el portal, y la regla del portal no cambia.
- **Emitir una factura DDP.** Choca con el gate legal AUT-04. Sam eligió una excepción explícita y
  auditada, solo para la lista (§3.1 a).

### 3.1 Qué dispara emitir (medido en `emitInvoice` y en los triggers de `invoices`, base `9434cc4f6`)

Sam decidió que el botón cree la factura **real y emitida** (pregunta 3). Esto es lo que pasa hoy al emitir,
y cómo queda cada punto para el botón:

**(a) Gate legal AUT-04: riesgo bloqueante, decide Sam.**
- `emitInvoice` llama a `evaluateLegalGate`. Si el envío de la factura es `puerta_a_puerta_DDP`, el gate
  exige una aceptación vigente de T&C (`hasValidAcceptanceForMarkbox`). Esa aceptación tiene que cuadrar
  con el Shipping Mark, el CBM, el peso, el total (`base_amount`) y la orden (`shipment_code`).
- Con `LEGAL_GATE_HARD_BLOCK = true`, si no hay aceptación **no se emite y no hay override**.
- La carga de consolidados escribe los envíos DDP como `puerta_a_puerta_DDP` (`lote-sql.ts:583`), y esos
  clientes no pasaron por una cotización aceptada en el portal. Por lo medido, **el botón quedaría
  bloqueado para todos los clientes del DDP 64**. Además, el monto se teclea a mano: aunque hubiera una
  aceptación, el total tendría que coincidir con lo que el cliente aceptó.
- El botón **no** salta el gate en silencio. Sam tiene que elegir una de estas tres opciones:
  1. **Cumplirlo.** El cliente acepta los términos en el portal antes de facturar. Hoy no existe un flujo
     de aceptación para envíos que entraron por la carga de consolidados.
  2. **Excepción explícita y auditada**, solo para los contenedores de la lista transitoria (§4, pregunta 5). Cada
     factura queda marcada como emitida sin aceptación por esta regla, con quién la emitió.
  3. **Quedar bloqueado.** El botón deja la factura en borrador con el aviso del gate hasta que haya
     aceptación. En ese caso no cumple la decisión 3.

  **DECIDIDO por Sam (2026-11-18, chat del DG: «Sí, las tres»): la opción 2.** La excepción es explícita y
  auditada, y aplica solo a la lista transitoria, que hoy es el contenedor 64.
  - `LEGAL_GATE_HARD_BLOCK` sigue igual para todo lo demás.
  - La RPC de la 0564 no consulta el gate para los clientes de la lista. Cada factura deja la marca
    `legal_ack = 'exc_0674'` en dos lugares:
    - en `exc0674_facturas`;
    - en `entity_audit_log`, por `append_audit_event` dentro de la misma transacción: entidad `invoice`,
      evento `invoice_emitted_exc0674`, actor `user` con el id de la sesión, fuente `rpc`, y un motivo que
      nombra la excepción.

    Así se ve que la factura salió por esta regla y no por una aceptación. Si el evento no se puede
    escribir, no se factura (AUD-01 §1).
  - La RPC rechaza en el servidor un contenedor fuera de la lista, aunque la pantalla no muestre el botón.

**(b) Lo que se dispara al emitir:**
- **Numeración.** `next_invoice_code` no toma lock (§2.2). Antes de pedir el número, la RPC toma un
  `pg_advisory_xact_lock` con la llave `exc0674:numeracion:<tenant>`, que se suelta al terminar la
  transacción. Dos llamadas a `exc0674_facturar` del mismo tenant esperan una a la otra, y la segunda ve
  el número que confirmó la primera. El lock solo ordena las llamadas de esta RPC: `createInvoice` y
  `duplicateInvoice` del Studio no lo toman. Contra ellas sigue mandando el `unique` de la 0077:48: si dos
  piden el mismo número, la segunda falla, su transacción se deshace entera y la pantalla dice que se
  intente otra vez. Hay una prueba de carrera (§8.6).
- **Titular.** El trigger `invoices_seal_billing_titular` (0466) sella el titular de facturación al pasar
  a `emitida`, y desde ahí no cambia. Decidido (§4, pregunta 3): se factura al aliado raíz cuando el
  cliente tiene uno, como en la carga de consolidados.
- **Asiento contable.** `post_invoice_journal_entry_atomic` (SDD-0040, cuerpo de la 0497:608-735) **no
  lanza error**: devuelve `outcome` = `posted`, `already_posted` o `not_posted`, con un `reason`. Además
  exige READ COMMITTED. La RPC lo llama en la misma transacción y **aborta todo** (sin factura, sin
  correlativo usado, sin rastro) si el `outcome` no es `posted` ni `already_posted`. Hay prueba.
- **Guarda contable.** El trigger `i3_invoice_guard` (0497) vigila todo INSERT o UPDATE de `invoices`, y
  la RPC tiene que pasarlo.
- **Referidos.** El trigger `invoices_accredit_referral` (0197) acredita al referidor en la **primera
  factura** emitida de un cliente referido. Facturar el contenedor puede acreditar referidos de una
  vez.
- **Correo.** Decisión del DG: sale igual que en una emisión normal. La server action llama a
  `fireMailEvent("invoice_emitted")` **después** de que la RPC hizo commit, por la vía existente de
  Mailing, y respeta sus reglas e interruptores: sin una regla activa no sale nada. Es best-effort: si el
  correo falla, la factura ya quedó emitida. El cliente admin se usa **solo** para ese correo, como en
  `emitInvoice`, y nunca para leer ni escribir `invoices`.
  - **Las variables del correo salen del retorno de la RPC** (código, titular facturado, Shipping Mark,
    embarque, emisión, vencimiento y total). La action **no** vuelve a leer `invoices`.
  - **Destinatario:** el titular facturado. Con aliado raíz, el correo va **al aliado**, que es a quien se
    le facturó, y no al cliente del contenedor.
- **Portal.** La factura emitida aparece en `/portal/facturas` del cliente (policy 0452) y entra en su
  estado de cuenta.
- **Vencimiento.** `due_date` es hoy + 30 días si la factura no trae una fecha.

**(c) Fronteras de lectura:**
- **SDD-0357.** La app no agrega ningún `.from("invoices")` literal.
  - Embarques lee el rastro `exc0674_facturas`.
  - El reporte de la 0574 lee la vista `exc0674_envios_cubiertos`. Es `security_invoker`, así que la RLS
    0414 de `invoices` sigue mandando: solo accounting y admin ven filas.
  - Las dos lecturas quedan registradas con el nombre EXC-0674 en el inventario de
    `invoice-read-boundary`, con +0 llamadas y sin aflojar la prueba.
  - Una prueba de migración congela la firma, el `security definer`, el `search_path` y los grants de la
    RPC y de la vista (§8.6). Ninguna de las dos le abre `invoices` a un rol que hoy no lo ve.
- **SDD-0574. Decisión del DG: se resuelve en esta PR.** `sin-facturar.ts:176-196` reconoce lo facturado
  por `shipment_id|client_markbox` de la factura. Con aliado raíz, la factura lleva el Shipping Mark del
  aliado (como en `lote-sql.ts:705`), y una factura por cliente solo apunta a su primer embarque. Por eso:
  - la 0564 guarda **qué envíos cubre cada factura**: la tabla de vínculo `exc0674_factura_envios`
    (factura ↔ envío ↔ Shipping Mark del cliente real del contenedor), escrita por la RPC en la misma
    transacción;
  - la vista `exc0674_envios_cubiertos` une ese vínculo con la factura viva y su estado;
  - `reporteSinFacturar` suma esas filas a las facturas que ya lee, con la llave
    `shipment_id|client_markbox` del cliente real. Así cada embarque facturado por esta regla sale del
    reporte, y uno de una factura anulada vuelve a aparecer;
  - la función pura `clasificarSinFacturar` no cambia;
  - sin la 0564, la vista no existe y el reporte queda como hoy. Es una degradación declarada.

**(d) Quién emite.** La RLS 0407 deja INSERT y UPDATE de `invoices` solo a `accounting` y `admin`. El rol
de Embarques no puede emitir con su sesión. Lo hace la RPC `exc0674_facturar` de la migración **0564**
(número asignado por el DG), con el contrato del §8. No se usa el cliente admin desde una action.

## 4. Decisiones de Sam (las seis preguntas, contestadas el 2026-11-18)

1. **¿Se factura por cliente dentro del contenedor o por embarque?** — **DECIDIDO por Sam (2026-11-18,
   por el DG):** hay dos modos.
   - **Contenedor completo:** un solo botón factura todo el contenedor, con **doble aprobación** (qué
     significa queda en la pregunta 6).
   - **Por cliente dentro del contenedor, con doble confirmación:** Sam lo dijo así: «Por cliente». El
     botón «Facturar» va en la fila de cada cliente del contenedor en Embarques. Quien lo oprime ve una
     pantalla «¿Estás seguro de los datos?» que **muestra los datos que se van a facturar**, y tiene que
     volver a oprimir «Confirmado».
   - El modo «contenedor completo» equivale a facturar todas las filas de cliente del contenedor a la vez.
   - Razón de Sam: quien oprime «tiene que saber que eso va a ir para el cliente en su portal y en la
     contabilidad».

   **La unidad mínima es el cliente del contenedor**, no el embarque. Sale una factura por cliente con una
   línea por embarque, igual que en la carga de consolidados. En ningún modo se factura un embarque
   suelto.

2. **¿De dónde sale el monto: lo escribe quien oprime, sale de la columna «valor a facturar» del Excel o
   de la tarifa congelada?** — **DECIDIDO por Sam (2026-11-18, por el DG):** «Lo escribe la oficina».
   El monto de cada cliente del contenedor se teclea a mano. No se importa del Excel ni se calcula con
   tarifa. Esto reemplaza la recomendación anterior del Worker de tomarlo del Excel.
   - **Validación (en el servidor, no solo en la pantalla):** el monto es mayor que 0, tiene como máximo
     dos decimales y va en USD. Un campo vacío, en cero, negativo o con más decimales no pasa.
   - **Revisión antes de «Confirmado»:** como lo teclea una persona, la pantalla de doble confirmación lo
     muestra **bien grande**, con `fmtUsd` (`$1,234.50`), junto a las cajas y el CBM de ese cliente en el
     contenedor. Así se ve de un golpe si el monto no cuadra con la carga.
   - **Rastro:** el monto no tiene otro origen que la persona, así que `exc0674_facturas` guarda quién lo
     tecleó (`tecleado_por`, el usuario de la sesión) y cuándo (`confirmado_at`) (§8.1).
   - Quién teclea el monto: solo `accounting` o `admin` (pregunta 4, corrección de Sam del 2026-11-18).

3. **¿Qué crea: una factura del ERP en dólares o una pre-factura?** — **DECIDIDO por Sam (2026-11-18, por
   el DG):** «Factura en dólares»; «ya es una factura que se va a facturar en contabilidad, en todo».
   - El botón crea la factura **real y emitida en USD**, no un borrador. Va por cliente dentro del
     contenedor y con el monto que escribe la oficina.
   - La pre-factura («valor sin facturar») es otra cosa: existe antes de montar el Excel y no se factura.
   - Lo que esto dispara está en el §3.1. El gate legal AUT-04 se resuelve con la excepción explícita que
     eligió Sam (§3.1 a).
   - **DECIDIDO por Sam (2026-11-18, «Sí, las tres»):**
     - **El monto tecleado es el total con IVA.** La base y el IVA se derivan con la tasa de IVA del
       tenant: `base = round(total / (1 + iva/100), 2)` e `iva = total − base`, así que `base + iva` da
       exactamente el total.
     - **Si el cliente tiene aliado raíz, se le factura al aliado**, igual que en la carga de consolidados.
       La factura lleva el Shipping Mark y los datos fiscales del aliado raíz, y una nota con el cliente
       del contenedor.

4. **Hoy solo Contabilidad y Admin ven montos (0661). ¿El rol de Embarques ve el monto?** — **DECIDIDO por
   Sam (2026-11-18, por el DG):** «El rol operaciones no factura y tampoco ve los valores.»

   La respuesta anterior («Ve el monto», que llevaba a una excepción EXC-0674 de montos para `operations`)
   **queda reemplazada** por esta corrección del mismo día.
   - **Facturan y ven el monto solo `accounting` y `admin`**, los mismos que ya ven montos (0661, RLS 0414,
     frontera SDD-0357). No hay excepción a la regla de montos.
   - `operations`, `commercial`, `warehouse`, `support` y `marketing` **no** ven el botón ni ningún monto, y
     el servidor no les lee nada de esta regla. La RPC los rechaza con `exc0674:rol`.
   - **Dónde no cambia:** la franja y el detalle por cliente de la 0661 siguen igual.
   - **Cómo se escribe.** `accounting` tampoco puede escribir `invoices` con su sesión en todos los casos
     que hacen falta (numeración con lock, asiento en la misma transacción, rastro). Lo hace una RPC
     `security definer` acotada, que:
     - verifica el rol, el tenant y que el contenedor esté en la lista;
     - crea y emite la factura.

     Lo ya facturado se lee del rastro `exc0674_facturas`, con RLS para `accounting` y `admin`, y no de
     `invoices`. No se usa el cliente admin desde una action, salvo para el correo (§3.1 b).
   - **Inventario SDD-0357.** Va como nota en `scripts/__tests__/invoice-read-boundary.test.mjs`, con +0
     llamadas literales y sin excepción de rol: la RPC, el rastro y la vista de la 0574 (§3.1 c).
   - **Si otro rol debe facturar**, será una decisión nueva de Sam, con su propia spec o enmienda.

5. **¿Cuáles son los otros contenedores?** — **DECIDIDO por Sam (2026-11-18, por el DG):** hoy **no** se
   hacen los otros.
   - El trabajo se centra en el **contenedor 64**. Su llegada estimada pasó del 12 a cerca del 20 de
     diciembre.
   - La lista cerrada del modo transitorio arranca **solo con el 64**. Los demás se agregan después por
     configuración, sin tocar el código.
   - Fuera de la lista el botón no aparece. Al cerrarse la regla transitoria, la lista se vacía.

6. **¿Qué es la «doble aprobación» del contenedor completo?** — **DECIDIDO por Sam (2026-11-18, por el
   DG):** la da **la misma persona**, con dos confirmaciones seguidas del mismo usuario. No son dos
   personas distintas.
   - **Primera confirmación:** «Facturar contenedor» (o «Facturar» en la fila de un cliente) abre la
     pantalla con los datos.
   - **Segunda confirmación:** vuelve a mostrar los datos y **avisa que la factura va al portal del cliente
     y a la contabilidad**. Solo al oprimir «Confirmado» se crea y se emite la factura.
   - **No guarda una solicitud intermedia**, así que esta parte no lleva migración.
   - La pantalla del modo contenedor completo muestra todas las filas de cliente, cada una con su monto
     grande, cajas y CBM, más el total del contenedor y cuántas facturas se van a emitir.

## 5. Cruces y dependencias

- **0668** («código viejo visible en el portal», PR #680, sin fusionar). Según el DG no cruza con esta
  spec, salvo que cambie la regla de lectura del portal (§3).
- **0549, 0552, 0553 y 0556.** Lecturas del portal por principal y tenant, y facturas anuladas fuera. Si
  cambia qué ve el cliente, se tocan sus lecturas y sus pruebas de frontera.
- **0357.** La frontera de lecturas de `invoices`. La nota EXC-0674 del inventario dice por dónde se lee
  lo facturado, sin excepción de rol (§3.1 c).
- **0040 / 0497.** El asiento atómico y su guarda i3. La RPC los usa dentro de su transacción.
- **0466.** El sello del titular al emitir.
- **0197 / 0494.** El crédito del referidor en la primera factura emitida.
- **0294.** `append_audit_event` para el evento con `legal_ack`.
- **0054 / AUT-04.** Gate legal al emitir una factura DDP.
- **0574 / 0571.** Flujo definitivo, embarques sin facturar y tarifa congelada. Este botón no los
  reemplaza. El reporte de la 0574 reconoce los envíos cubiertos por esta regla (§3.1 c).

## 6. Fuera de alcance

- Aplicar la 0564 en producción o staging, que necesita OK aparte de Sam y el runbook. Contenedores que no estén en la lista.
- Apagar `TRACKING_EN_CONSTRUCCION`. Es una decisión aparte de Sam (SDD-0514).
- El flujo definitivo de recepción en China.

## 7. Aceptación

1. En `/studio/embarques`, el botón «Facturar» (por cliente) y «Facturar contenedor» aparecen **solo** en
   el contenedor 64 (lista transitoria) y **solo** para `accounting` y `admin` (Sam, 2026-11-18:
   «El rol operaciones no factura y tampoco ve los valores.»). A `operations`, `commercial`, `warehouse`, `support` y `marketing` no se les lee ni se
   les envía nada de esta regla, ni el botón ni ningún monto; la RPC los rechaza. Lo prueba el servidor por rol, como en la 0661. La franja y el detalle de la 0661 no
   cambian.
2. El monto lo teclea la persona como total con IVA. El servidor rechaza un monto vacío, en cero, negativo,
   con más de dos decimales o en una moneda que no sea USD. Lo rechazan la acción y la RPC.
3. Confirmación, siempre del mismo usuario:
   - **por cliente y contenedor completo, dos pantallas seguidas** (decisión del DG sobre lo que pidió
     Sam, «por embarque con doble confirmación que muestre los datos»): la primera, «¿Estás seguro de los
     datos?», con todo visible (monto grande, cajas y CBM) y «Sí, los datos están bien»; la segunda vuelve
     a mostrar los datos, avisa que va al portal del cliente y a contabilidad, y emite con «Confirmado»;
   - sin «Confirmado» no se escribe nada. La RPC exige el texto exacto.
4. Se crea una factura **emitida** en USD por cliente del contenedor, con una línea por embarque vigente y
   `shipmentCode` en cada línea. Todo va en una transacción, con su rastro (quién tecleó el monto y
   cuándo):
   - el correlativo, con lock por tenant;
   - la emisión;
   - el titular;
   - el asiento, que tiene que quedar `posted` o `already_posted`;
   - el vínculo con los envíos;
   - el evento de auditoría.
5. Un cliente del contenedor tiene **una sola factura viva** de esta regla. Lo garantizan:
   - la marca de la regla, que es la fila de `exc0674_facturas`;
   - su índice único **parcial** (tenant, contenedor, cliente) `where anulada_at is null`;
   - el lock por (tenant, contenedor, cliente).

   Un doble clic o dos pestañas no crean dos facturas. **Decisión del DG (N1):** si la factura se anula en
   Facturación, un trigger marca `anulada_at` y el cliente se puede volver a facturar por la misma RPC,
   que también cubre la excepción AUT-04. Hay prueba.
6. El gate legal AUT-04 no se consulta para la lista, y cada factura queda auditada con
   `legal_ack = 'exc_0674'`. Fuera de la lista, el gate sigue en bloqueo duro.
7. Con aliado raíz, la factura sale a nombre del aliado. `base + iva = total` exacto.
8. El reporte «Embarques sin facturar» (0574) deja de mostrar todos los embarques cubiertos por una
   factura de esta regla, también con aliado raíz. Si la factura se anula, vuelven a aparecer.
9. La lista transitoria **solo cambia por migración o por una operación auditada con el OK nominal de
   Sam**. No hay interfaz ni RLS de escritura para ningún rol del Studio. Cada alta o baja deja un evento
   con su motivo. Hay prueba.
10. El correo `invoice_emitted` sale después del commit, por Mailing y respetando sus reglas. El cliente
    admin solo se usa para el correo.
11. Pruebas, en estos niveles:
    - contrato SQL: rechazos, todo o nada, asiento no `posted`, reparto, aliado raíz, no duplicar,
      privilegios, RLS, la lista sin escritura, el vínculo y la vista;
    - carrera: dos facturaciones simultáneas del mismo tenant;
    - migración: firma, `security definer`, `search_path` y grants congelados;
    - servidor: por rol y la acción;
    - render, la 0574 y la frontera SDD-0357;
    - `/ui-check`.

### 7.1 Allowlist exacta (archivos que esta PR puede tocar)

- `docs/specs/0674-boton-facturar-embarques/spec.md` · `docs/specs/README.md` (índice generado)
- `.agents/handoffs/sdd-0674-boton-facturar-embarques.md`
- `supabase/migrations/0564_exc0674_facturar_contenedor.sql`
- `supabase/desarmes/0564_desarme.sql`
- `supabase/tests/0564_exc0674_facturar_contenedor.test.sql`
- `supabase/tests/0564_exc0674_facturar_contenedor_carrera.test.sql`
- `supabase/migrations-baseline.json` · `supabase/pending-migration-symbol-declarations.json`
- `lib/studio/exc0674.ts` · `lib/studio/exc0674-queries.ts`
- `lib/studio/__tests__/exc0674.test.ts` · `lib/studio/__tests__/exc0674.migration.test.ts`
- `lib/studio/rate-snapshots/sin-facturar.ts` · `lib/studio/rate-snapshots/__tests__/sin-facturar-exc0674.test.ts`
- `app/studio/(app)/embarques/page.tsx` · `app/studio/(app)/embarques/facturar-actions.ts`
- `app/studio/(app)/embarques/_components/EmbarquesClient.tsx`
- `app/studio/(app)/embarques/_components/FacturarContenedor.tsx`
- `app/studio/(app)/embarques/__tests__/page-exc0674-por-rol.test.ts`
- `app/studio/(app)/embarques/__tests__/facturar-exc0674-action.test.ts`
- `app/studio/(app)/embarques/_components/__tests__/EmbarquesClient.facturar.test.tsx`
- `scripts/__tests__/invoice-read-boundary.test.mjs` (solo la nota EXC-0674, +0 llamadas)
- `lib/studio/rbac-actions-guard.test.ts` (solo el inventario de acciones, 488 → 489, con su comentario)
- `scripts/ci-sql-tests-control.sh` (solo copiar `supabase/desarmes/` en el control C4, como `cargas/`)
- `docs/governance/README.md` (filas SGE-00, MP-01 y BTN-01: enlace a la excepción)
- `docs/governance/reviews/excepcion-0674-facturar-embarques-2026-11-18.md`

### 7.2 Clasificación de gobernanza (AGENT-BRIEF: acción, permanencia, auditoría)

| Política | Clasificación | Evidencia |
|---|---|---|
| SGE-00.01 predecible | excepción | Ver el registro formal (§7.3, punto 1). «Facturar» y «Confirmado» son las palabras de Sam. El resultado (emitir una factura real) está escrito en la pantalla antes de ejecutar. |
| SGE-00.02 sin pérdida silenciosa | cumplimiento | Los montos tecleados quedan en el campo si se oprime «Volver» o si la base rechaza. El error queda en el diálogo. |
| SGE-00.03 riesgo → fricción | excepción | Ver MP-01 (§7.3, punto 4). Emitir una factura es R3. Hay consecuencia visible y doble confirmación, sin motivo tecleado. |
| SGE-00.04 auditoría | cumplimiento | `append_audit_event` va en la misma transacción. El rastro `exc0674_facturas` y la auditoría d2 de `invoices` quedan además. |
| SGE-00.05 permisos y tenant | cumplimiento | Rol, tenant y lista se comprueban en la acción, en la RPC y en la RLS. Hay pruebas negativas por rol, tenant ajeno y contenedor fuera de la lista. |
| SGE-00.06 prevenir errores | cumplimiento | El monto se valida antes de abrir la confirmación, y la acción y la RPC lo vuelven a validar. |
| SGE-00.07 estado verdadero | cumplimiento | «Emitiendo…» con `aria-busy` y botones bloqueados. El éxito se anuncia solo después de la RPC. El doble clic no duplica (§7, punto 5). |
| SGE-00.08 frecuencia | no aplica | Es una operación transitoria y rara (un contenedor). |
| SGE-00.09 patrón | excepción | Ver el §7.3, punto 2. `ConfirmDialog` solo admite un mensaje de texto, y la confirmación necesita la lista de clientes con montos. Se usa `useDialogA11y`, la misma base de foco y Esc. |
| SGE-00.10 accesible | cumplimiento | `role=dialog`, `aria-modal`, foco inicial en «Volver», Esc, una etiqueta por campo de monto y error con `role=alert`. |
| SGE-00.11 lenguaje | cumplimiento | La consecuencia («va al portal del cliente y a la contabilidad») queda escrita, y cada error dice qué pasó y que no se emitió nada. |
| SGE-00.12 IA | no aplica | No hay IA. |
| MP-01 | excepción | Ver el §7.3, punto 4. Permanencia P3: la factura se corrige anulándola en Facturación. Fricción R3 sin motivo tecleado, mitigada por los datos visibles, la doble confirmación, el motivo fijo de la regla en el audit y el alcance de la lista. |
| BTN-01 | excepción | Ver el §7.3, punto 3 (vocabulario). Se cumple el resto: «Volver» sale de la interacción a la izquierda, la primaria va a la derecha, `type="button"`, «Emitiendo…» con `aria-busy` e idempotencia en el servidor (§9 de BTN-01). El botón se oculta, en vez de deshabilitarse, para los roles sin permiso. Contrato `GovernedAction` en el §8.7. |
| AUD-01 | cumplimiento | La mutación y el evento son una sola operación, porque si el evento falla, no se factura. El actor es `user` con el id de la sesión. Lleva el motivo de la regla, `source = rpc` y `result = succeeded`. Las altas y bajas de la lista quedan auditadas con motivo obligatorio. |
| AUD-02 | no aplica | No hay consulta, exportación ni lectura del log nueva. El evento sigue la conservación y el acceso que ya existen. |
| Regla de montos solo para Contabilidad (0661, RLS 0414, frontera SDD-0357) | cumplimiento | Solo `accounting` y `admin` facturan y ven el monto (Sam, 2026-11-18). La EXC-0674 de montos para `operations` se retiró. |
| Gate legal AUT-04 (SDD-0054) | excepción | §7.3, punto 6. |

### 7.3 Registro formal de las excepciones (índice de gobernanza §5 y §7, protocolo L3)

Todas están aprobadas por Sam el 2026-11-18, con Sam como responsable. La **fecha de revisión es
2027-01-31**, o antes si se vacía la lista transitoria. El alcance común es solo la acción «Facturar», solo
los contenedores de la lista (hoy el 64) y solo `accounting` y `admin`. La decisión escrita,
con la mitigación completa, está en
[`docs/governance/reviews/excepcion-0674-facturar-embarques-2026-11-18.md`](../../governance/reviews/excepcion-0674-facturar-embarques-2026-11-18.md).
Las filas SGE-00, MP-01 y BTN-01 del registro maestro enlazan a ese documento.

| # | Política afectada | Qué se aparta | Motivo |
|---|---|---|---|
| 1 | SGE-00.01 | La etiqueta es «Facturar», no el verbo reservado «Emitir factura» | Es la palabra de la oficina y de Sam, y el resultado se escribe antes de ejecutar |
| 2 | SGE-00.09 | Diálogo propio en vez de `ConfirmDialog` | Dos pantallas seguidas, por cliente y por contenedor, que listan clientes con montos, cajas y CBM (decisión de Sam; §7 punto 3) |
| 3 | BTN-01 §3 | «Facturar» y «Confirmado» en vez de «Emitir factura» y «Confirmar» | Decisión de Sam (§4, preguntas 1 y 6) |
| 4 | MP-01 §3 | Una acción R3 sin motivo tecleado | La doble confirmación con datos es la fricción que eligió Sam. El audit lleva un motivo fijo |
| 5 | — | **Retirada.** Era la EXC-0674 de montos para `operations` | Sam, 2026-11-18: «El rol operaciones no factura y tampoco ve los valores.» |
| 6 | AUT-04 (SDD-0054) | Facturas de la lista sin aceptación de T&C | Sin la excepción el botón queda bloqueado para todo el 64. Opción 2 de Sam |

## 8. Contrato de implementación (migración 0564)

### 8.1 Objetos

- **`exc0674_contenedores`** (tenant, consolidación): la lista transitoria.
  - Nace vacía.
  - Tiene RLS de SELECT para `accounting` y `admin` de su tenant.
  - **Sin** INSERT, UPDATE ni DELETE para `authenticated`. Solo la cambian una migración o una operación
    con `service_role` y el OK nominal de Sam.
  - Un trigger escribe un evento de auditoría (entidad `consolidation`, `exc0674_lista_alta` o
    `exc0674_lista_baja`) y **exige** un motivo en `dtd.audit_reason`. Sin motivo, la operación falla.
  - **Actor (N7):** el cambio se hace con `service_role` o en una migración, sin sesión de usuario. Por eso
    el evento queda con `actor_type = 'system'` y `actor_id` nulo, y el motivo de `dtd.audit_reason`
    (obligatorio) lleva el OK de Sam y quién lo ejecutó. Si algún día lo hace un usuario con sesión, queda
    como `user` con su id. El contrato SQL prueba el alta y la baja como `system`.
- **`exc0674_facturas`**: la **marca de la regla**. Una fila por cliente del contenedor facturado, con
  factura, código, total tecleado, `tecleado_por` (el usuario de la sesión), `confirmado_at`, titular y
  `legal_ack = 'exc_0674'`.
  - Tiene `invoice_id` único y un índice único **parcial** (tenant, contenedor, cliente)
    `where anulada_at is null`.
  - El trigger `exc0674_marcar_anulada` (AFTER UPDATE OF status en `invoices`) pone `anulada_at` cuando
    la factura pasa a `anulada`. No toca la factura ni su reverso contable (0497).
  - RLS de SELECT: `accounting` y `admin` de su tenant. Sin escritura para `authenticated`. (La RLS de
    `operations` condicionada a la lista, N4, se retiró por la corrección de Sam del 2026-11-18.)
- **`exc0674_factura_envios`**: el vínculo factura ↔ envío ↔ Shipping Mark del cliente real. Una fila por
  embarque cubierto, con unique (factura, envío). Tiene la misma RLS que el rastro.
- **`exc0674_envios_cubiertos`**: vista `security_invoker` (N3). Hace un **inner join** del vínculo con
  `invoices` vivas (`deleted_at is null`) y expone solo `tenant_id`, `shipment_id`, `client_markbox`,
  `invoice_id`, `invoice_code` y `status`, **sin montos**. La lee el reporte de la 0574. Como es
  `security_invoker`, la RLS de `invoices` (0414) decide quién ve filas: accounting y admin. Una factura
  anulada sigue apareciendo con `status = 'anulada'`, y la 0574 no la cuenta como facturada.
- **`exc0674_facturar(p_consolidation_id uuid, p_montos jsonb, p_confirmacion text)`**:
  - `security definer` con `search_path` vacío;
  - EXECUTE solo para `authenticated`; ni `anon` ni `service_role`.

### 8.2 Orden dentro de la transacción (todo o nada)

1. Sesión, rol (`accounting` o `admin`), `p_confirmacion = 'Confirmado'` y forma de
   `p_montos` (1 a 500 clientes, sin repetidos).
2. El contenedor está vivo, es del tenant y está en la lista. Si no, rechaza.
3. **Lock de numeración por tenant:** `pg_advisory_xact_lock` con la llave
   `exc0674:numeracion:<tenant>`.
4. **Orden de bloqueo por cliente:** los clientes se ordenan por Shipping Mark y se toma
   `pg_advisory_xact_lock` por (tenant, contenedor, cliente) en ese orden. Dos llamadas con clientes
   cruzados no se bloquean entre sí.
5. Por cada cliente:
   - valida el monto (> 0, dos decimales, < 10¹²);
   - comprueba que no esté facturado;
   - toma sus embarques vigentes en el contenedor (la asignación más reciente);
   - resuelve el aliado raíz;
   - deriva la base y el IVA (16 % si `tenants.iva_enabled`, si no 0, como la carga);
   - reparte las líneas por CBM;
   - pide el correlativo e inserta la factura `emitida`;
   - pasa el asiento, que tiene que quedar `posted` o `already_posted`;
   - escribe el vínculo con cada envío, la marca y el evento de auditoría.
6. Si algo falla en cualquier cliente, no queda nada de ninguno.

### 8.3 Campos de la factura

- `currency = 'USD'`;
- `status = 'emitida'`;
- `issued_at` = hoy en Caracas;
- `due_date` = +30 días;
- `fund_class = 'third_party'`, porque es un servicio DDP: `deriveFundClass` da `third_party` a todo
  envío que no sea `transporte_terrestre`;
- `shipment_id` y `shipment_code` = el primer embarque por código;
- `lines` = una por embarque vigente (`Flete DDP · <código> · <m³> · contenedor <ref>`, qty 1, precio
  repartido por CBM, `shipmentCode`);
- `notes` = `EXC-0674 · contenedor … · cliente … · embarques: …`, más «facturado al aliado raíz» cuando
  aplica.

### 8.4 Lo que la RPC no hace

- No consulta el gate AUT-04 (excepción de Sam).
- No baja `LEGAL_GATE_HARD_BLOCK`.
- No abre la RLS de `invoices`. Lo único que suma sobre `invoices` es el trigger `exc0674_marcar_anulada`, que solo escribe `exc0674_facturas`.
- No manda correo: lo manda la acción, después del commit.

### 8.5 Degradación sin la 0564

Embarques no pinta el botón. El reporte de la 0574 queda como hoy. Está declarado en
`pending-migration-symbol-declarations.json`.

### 8.6 Pruebas de base

- **Contrato SQL** (`supabase/tests/0564_….test.sql`, en CI por `sql-tests.yml`). Cubre §7, puntos 2 a
  9, incluido el asiento `not_posted` que deshace todo.
- **Carrera** (`0564_…_carrera.test.sql`, con dblink). Dos facturaciones del mismo tenant a la vez: la
  segunda espera el lock de numeración y sale con otro correlativo. Además, dos facturaciones del mismo
  cliente: una gana y la otra recibe `ya_facturado`. Las corre `accounting`.
- **Roles** (contrato SQL): `operations`, `commercial`, `warehouse` y `support` reciben `exc0674:rol`;
  `operations` no ve filas del rastro, del vínculo ni de la lista. Las altas y bajas de la lista quedan
  auditadas como `system`, sin `actor_id`, con su motivo (N7).
- **Migración** (`lib/studio/__tests__/exc0674.migration.test.ts`). Congela el texto de la firma, el
  `security definer`, el `search_path` vacío y los grants de la RPC; el `security_invoker` de la vista; y
  que no haya policies de escritura en las tablas. También que la 0564 no nombre a `'operations'`.

### 8.7 Contrato de la acción (BTN-01 §8)

| Campo | Por cliente | Contenedor completo |
|---|---|---|
| actionKey | `shipments.exc0674.facturar_cliente` | `shipments.exc0674.facturar_contenedor` |
| verb / outcome | Facturar / se emite 1 factura real en USD | Facturar contenedor / se emiten N facturas reales en USD |
| role / risk | primary / critical | primary / critical |
| permanence / friction | P3 / R3 (excepción de motivo, §7.2) | P3 / R3 (excepción de motivo, §7.2) |
| permission | accounting, admin + contenedor en la lista | igual |
| preconditions | monto válido; cliente sin factura de esta regla | todos los pendientes con monto válido |
| buttonType | button | button |
| idle / loading / success | Facturar / Emitiendo… / «Factura F-… emitida.» | Facturar contenedor / Emitiendo… / «N facturas emitidas.» |
| errorRecovery | el error queda en el diálogo; no se emitió nada; corregir o volver | igual |
| audit | sí: `invoice_emitted_exc0674` | sí, uno por factura |
| afterSuccess | refresh-context (la fila muestra «Facturada F-…») | refresh-context |
| undo | no: se anula en Facturación | no |

## 9. Respuesta a la revisión independiente (`a166d07fe`)

| # | Bloqueante | Dónde quedó |
|---|---|---|
| 1 | Numeración sin lock | §2.2, §3.1 b, §8.2 paso 3 y la prueba de carrera del §8.6 |
| 2 | 0574 sin resolver | §3.1 c, `exc0674_factura_envios` y la vista (§8.1), §7 punto 8 y la allowlist con `sin-facturar.ts` |
| 3 | Asiento que no lanza | §3.1 b, §8.2 paso 5 y la prueba del contrato SQL |
| 4 | Duplicados y doble clic | marca = `exc0674_facturas` con índice único y locks (§8.1, §8.2 paso 4, §7 punto 5) |
| 5 | Lista transitoria | §8.1: sin escritura para el Studio, solo migración u operación auditada con motivo, y prueba (§7 punto 9) |
| 6 | Correo | §3.1 b y §7 punto 10: después del commit, por Mailing; el cliente admin solo para el correo |
| 7 | Allowlist y clasificación | §7.1 y §7.2, más el contrato de la acción en el §8.7 |

**Re-revisión (Opus) sobre `aaf25d169`:** los 7 quedaron resueltos en el diseño, y el 7 estaba parcial.
Los arreglos de esta vuelta:
- **B1:** registro formal de las excepciones (§7.3), el documento en `docs/governance/reviews/`, las filas
  del registro maestro y la tabla del §7.2 con solo las cuatro clasificaciones;
- **B2:** el handoff, alineado con esta spec;
- **N1:** índice parcial con `anulada_at` y refacturar después de anular;
- **N2:** la frase de los locks (§3.1 b);
- **N3:** inner join y vista sin montos (§8.1);
- **N4 y N5: ya no aplican.** Sam corrigió el 2026-11-18: «El rol operaciones no factura y tampoco ve los valores.» Solo `accounting` y `admin`
  facturan y ven montos; se retiraron la EXC-0674 de montos, la RLS de `operations` y su lectura;
- **N6:** la 0668 está en la PR #680 y solo toca documentación (§2 y §5);
- **N7:** actor `system` con motivo obligatorio en las altas y bajas de la lista, con prueba (§8.1);
- **N8:** las variables del correo salen del retorno de la RPC, y con aliado raíz el correo va al aliado
  (§3.1 b).

Los no bloqueantes de la primera revisión también quedaron atendidos:
- grants y `security definer` de la RPC y la vista, con la prueba de migración del §8.6;
- texto viejo de los §3, §3.1 y §4 actualizado;
- `legal_ack` en `entity_audit_log` (§3.1 a) y contenedor fuera de la lista rechazado en el servidor;
- `tecleado_por`;
- todo o nada con orden de bloqueo (§8.2);
- `fund_class` (§8.3);
- `related` ampliado.

## 10. Evidencia

Se registra en `.agents/handoffs/sdd-0674-boton-facturar-embarques.md`.

- **Aplicada en producción** (runbook `docs/runbooks/aplicar-migraciones-prod.md`):
  - OK nominal de Sam, literal: «OK, aplica 0563 y 0564».
  - COMMIT: 2026-11-18 23:38:29Z. `version` del ledger: `20261118233829`; `created_by`: `servidor-propio:psql:SDD-0674`. El ledger queda con 559 filas.
  - Una fila en el ledger, md5 `98c061b05735b1b12bd63e2a3c1d3b2a`, 36660 bytes. Verificación PASÓ: cuerpos
    vivos iguales al archivo.
  - Evidencia: `/srv/ops/evidencias/apply-0564-dtd-cargo-20261118T233828Z`. Paquete del SHA `8dec3ee29`,
    el merge de la PR #684 (2026-11-18 23:08:00Z).
  - Cierre (§6): `retirar-espera.mjs` salió con 0. Quitó la espera de `migrations-baseline.json` y las 3
    declaraciones, y selló la 0564 en `migrations.lock.json` (sha256 `51c99c4f…`). `migrations-lock.mjs`
    salió con 0.
  - La lista `exc0674_contenedores` sigue **vacía**. Agregar el 64 lleva otro OK nominal de Sam.
