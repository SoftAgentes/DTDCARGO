---
sdd: "0674"
title: "Embarques: botón «Facturar» para los contenedores montados sin pasar por origen (regla transitoria)"
status: proposed
author: "Claude (Worker) + Sam"
created: 2026-11-18
updated: 2026-11-18
supersedes: null
superseded_by: null
related: ["0054", "0407", "0414", "0514", "0543", "0549", "0552", "0553", "0556", "0571", "0574", "0661"]
confidencialidad: interno
---

# SDD-0674 — Botón «Facturar» en Embarques (regla transitoria)

> Sam lo pidió en la reunión con la oficina del 2026-11-18, por el DG. Embarques tendría un botón
> «Facturar» para el personal del Studio (quién exactamente: §4, pregunta 4). Al facturar, la factura
> llega al portal del cliente y a la contabilidad. Es **transitorio**: era para los cuatro contenedores
> montados sin pasar por origen, y por decisión de Sam (§4, pregunta 5) hoy cubre **solo el contenedor
> 64**. Antes de facturar, la oficina confirma que lo cargado en el sistema cuadra con el Excel y escribe
> el valor a facturar.
>
> **Spec sin código.** Sam contestó las seis preguntas del §4 (2026-11-18). Antes de implementar faltan
> tres decisiones, listadas en el §7. Alcance: solo el contenedor 64.

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
las SDD-0549, 0552 y 0553, con su migración. Ese cambio cruza la 0668, que no encontré en `main` ni en
las ramas remotas al medir (§5).

Por eso, «al facturar el cliente ve el tracking» **ya ocurre hoy**, aunque no haya factura. Lo que el
botón agrega es la factura y su monto en el portal y en la contabilidad.

### 2.2 Cómo se crea hoy una factura

- **Studio, `createInvoice`** (`app/studio/(app)/facturacion/actions.ts`):
  - Pasa la puerta `moduleEditDenial(supabase, "invoices")`.
  - Pide el código a la RPC `next_invoice_code(p_tenant_id)`, que da un correlativo atómico por tenant.
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

## 3. Lo que implicaría el botón, según cómo responda Sam

- **Escribir `invoices` con el rol de Embarques.** La RLS 0407 no lo deja. Hay dos caminos:
  - una RPC `security definer` acotada, por ejemplo «facturar cliente del contenedor», con candado de
    tenant, rol, contenedor permitido y estado;
  - ampliar la policy.

  Los dos llevan **migración**, y el número se le pide al DG. No se usa el cliente admin desde una action
  para saltarse la RLS: rompe la frontera SDD-0357.
- **Que el cliente vea solo al facturar.** Es un cambio de la regla del portal (§2.1) y lleva migración.
  Si basta con que la factura **aparezca** en el portal (los envíos ya se ven), no hace falta tocar la
  regla.
- **Emitir una factura DDP.** Choca con el gate legal AUT-04 si el cliente no aceptó los términos (ver §3.1). Sam
  decide cómo se resuelve (§3.1 a).

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

  *Recomiendo la opción 2*, acotada a la lista y con su rastro, porque la regla ya es transitoria. Bajar
  `LEGAL_GATE_HARD_BLOCK` para todos **no** es una opción.

**(b) Lo que se dispara al emitir:**
- **Numeración.** `next_invoice_code(p_tenant_id)` da el correlativo atómico al **crear** la factura, no
  al emitir. Un intento que falle después de pedir el código deja un hueco en la numeración. Por eso la
  RPC tiene que hacer todo en una transacción.
- **Titular.** El trigger `invoices_seal_billing_titular` (0466) sella el titular de facturación al pasar
  a `emitida`, y desde ahí no cambia. La carga de consolidados factura al aliado raíz cuando el cliente
  tiene uno: falta decidir a quién va esta factura (§4, pregunta 3).
- **Asiento contable.** `post_invoice_journal_entry_atomic` (SDD-0040) registra DR Clientes / CR
  Ingresos [+ IVA]. Hoy es *best-effort* y corre con el cliente admin, después de emitir. En la RPC nueva
  conviene que el asiento ocurra en la misma transacción, o que se diga en la spec que puede faltar.
- **Guarda contable.** El trigger `i3_invoice_guard` (0497) vigila todo INSERT o UPDATE de `invoices`, y
  la RPC tiene que pasarlo.
- **Referidos.** El trigger `invoices_accredit_referral` (0197) acredita al referidor en la **primera
  factura** emitida de un cliente referido. Facturar el contenedor puede acreditar referidos de una
  vez.
- **Correo.** `fireMailEvent("invoice_emitted")` avisa según las reglas activas del tenant en Mailing,
  que pueden incluir al cliente.
- **Portal.** La factura emitida aparece en `/portal/facturas` del cliente (policy 0452) y entra en su
  estado de cuenta.
- **Vencimiento.** `due_date` es hoy + 30 días si la factura no trae una fecha.

**(c) Fronteras de lectura:**
- **SDD-0357.** Si la pantalla de confirmación o la RPC leen `invoices` (por ejemplo, para no facturar
  dos veces al mismo cliente del contenedor), cada lectura literal nueva se registra en
  `invoice-read-boundary` sin aflojar la prueba, igual que en la 0661.
- **SDD-0574.** Ahí un borrador no cuenta como facturado. Como el botón emite, sus facturas sí cuentan: la
  recepción de ese cliente sale del reporte «Embarques sin facturar» porque hay una factura viva del mismo
  envío y Shipping Mark. Ojo: la carga crea **una** factura con `shipment_id` = el primer embarque del
  cliente, así que los demás embarques de ese cliente seguirían en el reporte. La RPC tiene que resolver
  eso, por ejemplo con una factura por cliente que cubra todos sus envíos, o el reporte tiene que
  reconocer la regla transitoria.

**(d) Quién emite.** La RLS 0407 deja INSERT y UPDATE de `invoices` solo a `accounting` y `admin`. El rol
de Embarques no puede emitir con su sesión. Hace falta una **RPC `security definer` acotada**:
- tenant del usuario;
- rol permitido;
- contenedor en la lista transitoria;
- cliente del contenedor sin factura viva;
- monto mayor que 0, con 2 decimales, en USD;
- la doble confirmación o la doble aprobación de la pregunta 6;
- y todo en una transacción.

Lleva **migración**: el número se le pide al DG cuando Sam cierre las preguntas 4 y 5. No se usa el
cliente admin desde una action.

## 4. Preguntas para Sam (cada una con la recomendación del Worker)

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
   - **Rastro:** la factura guarda quién escribió el monto y cuándo, porque no tiene otro origen que la
     persona. Si eso no cabe en las columnas actuales de `invoices`, se suma al costo de migración del §3.
   - *Nota del Worker:* «la oficina» teclea el monto. Si quien lo teclea es el rol de Embarques, la
     pregunta 4 queda respondida en la práctica: Embarques ve el monto que escribe. Falta que Sam diga
     quién es «la oficina» en el Studio.

3. **¿Qué crea: una factura del ERP en dólares o una pre-factura?** — **DECIDIDO por Sam (2026-11-18, por
   el DG):** «Factura en dólares»; «ya es una factura que se va a facturar en contabilidad, en todo».
   - El botón crea la factura **real y emitida en USD**, no un borrador. Va por cliente dentro del
     contenedor y con el monto que escribe la oficina.
   - La pre-factura («valor sin facturar») es otra cosa: existe antes de montar el Excel y no se factura.
   - Lo que esto dispara y sus riesgos están en el §3.1. El gate legal AUT-04 bloquea hoy esta emisión, y
     hace falta que Sam decida.
   - Faltan dos cosas por decidir:
     - **¿El monto tecleado es la base o el total con IVA?** Recomiendo el total, porque es lo que el
       cliente paga; la base y el IVA se derivan con la tasa del tenant.
     - **¿A quién se factura cuando el cliente tiene un aliado raíz?** Recomiendo lo mismo que la carga de
       consolidados: al aliado raíz.

4. **Hoy solo Contabilidad y Admin ven montos (0661). ¿El rol de Embarques ve el monto?** — **RESPONDIDA
   por Sam (2026-11-18, por el DG):** «la oficina» es el personal que trabaja en el ERP Studio, no un rol
   aparte.

   **Propuesta del Worker: escriben el precio y facturan solo `accounting` y `admin`.**
   - **El dinero no se abre a nadie más.** Son los mismos roles que hoy ven montos (0661), pasan la RLS de
     `invoices` (0407 y 0414) y entran en la frontera de lectura SDD-0357.
   - **No hay que tocar Embarques.** `accounting` ya ve el módulo `shipments` (`lib/studio/rbac.ts`).
   - **Los otros roles no ven nada del botón.** `commercial`, `operations`, `warehouse` y `support` siguen
     viendo Embarques como hoy, sin «Facturar», sin campo de precio y sin montos. Igual que en la 0661, la
     decisión se toma en el servidor y el dato no viaja al navegador.
   - **Esto reemplaza la recomendación anterior** de abrir el monto a Embarques en la pantalla de
     confirmación.

   **Decisión explícita para Sam, si la quiere:** que otro rol (por ejemplo `operations`) escriba el precio
   y facture. Eso **amplía** quién ve dinero:
   - cambia la regla de la 0661;
   - pide una RPC que escriba `invoices` saltando la RLS 0407;
   - y abre una lectura nueva de montos fuera de Contabilidad, que habría que registrar en la SDD-0357.

   No se hace sin su OK escrito.

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
- **0357.** La frontera de lecturas de `invoices`. Una lectura nueva se registra en el inventario.
- **0054 / AUT-04.** Gate legal al emitir una factura DDP.
- **0574 / 0571.** Flujo definitivo, embarques sin facturar y tarifa congelada. Este botón no los
  reemplaza.

## 6. Fuera de alcance (por ahora)

- Código, migraciones, producción y staging. Solo esta spec.
- Apagar `TRACKING_EN_CONSTRUCCION`. Es una decisión aparte de Sam (SDD-0514).
- El flujo definitivo de recepción en China.

## 7. Aceptación

1. En `/studio/embarques`, el botón «Facturar» (por cliente) y «Facturar contenedor» aparecen **solo** en
   el contenedor 64 (lista transitoria) y **solo** para `accounting` y `admin`. Para los demás roles no se
   lee ni se envía ningún monto (prueba de servidor por rol, como en la 0661).
2. El monto lo teclea la persona. El servidor rechaza vacío, cero, negativo, más de dos decimales y
   cualquier moneda que no sea USD.
3. La doble confirmación es del mismo usuario:
   - la segunda pantalla muestra el monto grande, las cajas y el CBM de cada cliente;
   - avisa que va al portal del cliente y a contabilidad;
   - sin «Confirmado» no se escribe nada.
4. Se crea una factura **emitida** en USD por cliente del contenedor, con una línea por embarque y todos
   sus envíos cubiertos (para que la 0574 no los siga mostrando como «sin facturar»). Correlativo, emisión,
   titular y asiento van en una transacción, con su rastro: quién tecleó el monto, quién confirmó y cuándo.
5. Un cliente del contenedor que ya tiene una factura viva de esta regla no se factura dos veces.
6. El gate legal AUT-04 se resuelve según la decisión de Sam del §3.1 (a). No se salta en silencio.
7. Las pruebas cubren: servidor por rol, validación del monto, doble confirmación, factura por cliente con
   sus líneas, no duplicar, la frontera SDD-0357 y el render; además se pasa `/ui-check`.

**Decisiones de Sam que faltan antes de implementar** (las recomendaciones están en el §3.1 y el §4):
- el gate legal AUT-04 (recomiendo una excepción explícita y auditada, solo para la lista);
- si el monto tecleado es la base o el total con IVA (recomiendo el total);
- si con aliado raíz se le factura al aliado (recomiendo que sí, como la carga de consolidados).

**Migración:** la RPC transaccional y la lista transitoria en configuración la necesitan. El número se le
pide al DG al pasar a implementación.

## 8. Evidencia

Se registra en `.agents/handoffs/sdd-0674-boton-facturar-embarques.md`.
