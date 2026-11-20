---
sdd: "0690"
title: "Embarques: «Facturar» emite el borrador con los precios del Excel, «Facturar todo» y «Facturado»"
status: in-progress
author: "Claude (Worker) + Sam"
created: 2026-11-20
updated: 2026-11-20
supersedes: null
superseded_by: null
related: ["0543", "0661", "0674", "0682", "0689", "0691", "0692", "0693"]
confidencialidad: interno
---

# SDD-0690 — Embarques: «Facturar» emite el borrador con los precios del Excel, «Facturar todo» y «Facturado»

> **Aprobada por Sam el 2026-11-20:** «Apruebo la 0690» (en el chat del DG), sin abonos sobre
> pre-órdenes. La migración **0569** lleva en su cabecera «NO APLICADA EN NINGÚN ENTORNO». Aplicarla y
> cargar las pre-órdenes del 64 llevan cada una su OK nominal de Sam, y las corre el DG.

## 1. Pedido

Sam lo pidió el 2026-11-20, mirando el contenedor 64 en Embarques (decisiones textuales en las notas del
DG, fuera del repo):

- **«Por cobrar» trae los precios del Excel**, los de la preorden de cada cliente. Hoy la oficina teclea
  el monto a mano (SDD-0674).
- **Botón «Facturar todo»** en el contenedor.
- **Un contenedor facturado completo se queda en Embarques**, dice «Facturado» y ya no muestra la opción
  de facturar. Cuando se entregue al 100 %, se va a un historial dentro de Embarques; eso es la SDD-0691.
- **Borradores con los precios del Excel: «Solo el 64».**

El DG asignó el número y la migración 0569, y fijó el orden 0689 → 0690 → 0692. La 0692, la tarifa por
cliente con el exceso de kg (el caso del 64 está en las notas del DG), va después y agrega la línea de
exceso a estos borradores.

## 2. Medición (código de `main` 765f3954a)

### 2.1 El botón «Facturar» de hoy (SDD-0674, migración 0564)

- La RPC `exc0674_facturar(p_consolidation_id, p_montos, p_confirmacion)` **crea una factura nueva** con
  el total tecleado y la inserta ya **emitida** (`0564_exc0674_facturar_contenedor.sql:285-295`,
  `:496-508`). No usa ningún borrador.
- Guardas:
  - rol `accounting` o `admin` (`:334`);
  - `p_confirmacion = 'Confirmado'` (`:337`);
  - contenedor vivo, del tenant y en la lista `exc0674_contenedores` (`:345-353`);
  - total > 0 con dos decimales (`:381`);
  - cliente sin factura previa en el rastro (`:389-393`).
- Escribe:
  - el asiento con `post_invoice_journal_entry_atomic`, y si el resultado no es `posted` ni
    `already_posted` se deshace todo (`:511-517`);
  - el rastro `exc0674_factura_envios` y `exc0674_facturas`, con `legal_ack = 'exc_0674'`
    (`:519-537`);
  - la auditoría `invoice_emitted_exc0674` (`:541-551`).
- Lo usa `facturarExc0674Action` (`app/studio/(app)/embarques/facturar-actions.ts:51`), que manda el
  correo `invoice_emitted` después del commit. La pantalla es `FacturarContenedor.tsx`, con la doble
  confirmación («Sí, los datos están bien» → «Confirmado»).
- La 0564 está aplicada en producción desde el 2026-11-18 (cierre en la PR #692). La cabecera del archivo
  todavía dice «NO APLICADA»: es texto viejo, no se toca aquí (§8).

### 2.2 Los borradores del cargador (SDD-0543)

- `scripts/consolidados/lote-sql.ts:674-720` crea **un borrador por cliente**:
  - las líneas son la descripción, la cantidad y el precio unitario de la preorden del Excel, en
    `invoices.lines` (jsonb) con el `shipmentCode` de cada línea;
  - la base es la suma de las líneas y el IVA se calcula sobre ella;
  - `shipment_id` es el primer envío del cliente;
  - el código sale de `next_invoice_code` **al insertar**;
  - deja el evento `invoice_imported` en la auditoría.
- El 64 se cargó con `--sin-facturas` (`generar-lote.ts:150`), así que **no tiene borradores**. El
  cargador no se puede volver a correr para el 64: su preflight aborta si el contenedor ya está cargado
  (`lote-sql.ts:349-355`) o si el lote ya tiene facturas (`:399-404`).

### 2.3 El paso de borrador a emitida que ya existe

- `emitInvoice` (`app/studio/(app)/facturacion/actions.ts:558`) pasa un borrador a emitida, pero aplica
  la **puerta legal** (`:611`, `LEGAL_GATE_HARD_BLOCK` en `:620`). Un borrador del 64 apunta a un envío
  `puerta_a_puerta_DDP`, así que la puerta lo bloquea. La SDD-0674 ya decidió que la excepción a la puerta
  vale solo para los contenedores de la lista y solo por la RPC (§3.1, opción 2). Además, el asiento de
  `emitInvoice` no es atómico (`:686`) y no escribe el rastro `exc0674_*`.
- **Conclusión:** `emitInvoice` no sirve tal como está. Hace falta una RPC hermana de la 0564.

### 2.4 Los montos de la pantalla

- `leerMontosDeContenedores` (`lib/studio/embarques-contenedores-queries.ts:158`) lee las facturas no
  anuladas. `montosPorEmbarque` suma por `invoice.shipment_id`: como el borrador apunta al primer envío del
  cliente, todo su total cae en ese envío. Por contenedor y por cliente, la suma es correcta.
- **«Por cobrar» hoy es la suma de `total_amount`, borradores incluidos**, no el saldo (`sumarMontos`).
  En la franja y en el detalle, «Sin facturar» quiere decir «sin facturas» (`textoMonto`). En el
  encabezado de la 0689 quiere decir «borradores». La 0689 dejó ese doble sentido para resolverlo aquí.

## 3. Decisión propuesta

### 3.1 Cargar los borradores del 64 (solo el 64)

- Modo nuevo del cargador: **`--solo-facturas`**, para un contenedor que ya está cargado.
  - Lee del Excel solo las líneas de la preorden y no toca consolidación, envíos, recepciones ni ítems.
  - Su preflight exige el contenedor vivo, cargado y en la lista `exc0674_contenedores`.
  - **Por cliente es idempotente:** si el cliente ya tiene una factura viva (borrador o emitida) en el
    contenedor, no le crea otra y lo informa en el reporte.
  - Escribe el mismo borrador que hoy (§2.2): mismas líneas, mismo `shipment_id`, el código de
    `next_invoice_code`, `invoice_imported` en la auditoría y la marca del lote en `notes`.
- **La carga en producción escribe datos.** Necesita un OK nominal de Sam en el chat del DG, que nombre
  el contenedor (el 64, y nada más). **La corre el DG con el runbook**, no el Worker. Fusionar la PR no
  autoriza la carga.
- **Condiciones previas a la carga del 64** (DG, 2026-11-20). No forman parte de la PR de implementación:
  1. el ensayo de `--solo-facturas` en una base local con el 64 cargado desde el mismo Excel: corre
     `simulacro.sql`, que termina en `rollback`, y se reportan conteos sin montos (pre-órdenes nuevas,
     clientes saltados y clientes sin líneas);
  2. el OK nominal de Sam en el chat del DG, nombrando el 64;
  3. la 0569 aplicada en producción, con su propio OK nominal, si la carga se hace para emitir
     enseguida. La carga en sí no necesita la 0569.

### 3.2 El caso de datos: un cliente que ya tiene una factura emitida con monto tecleado

- Con la 0564 aplicada, puede haber clientes del 64 con una factura **emitida** por el botón de hoy,
  con el monto tecleado.
- **Regla:** a ese cliente no se le crea borrador (§3.1, idempotencia). Su factura emitida queda como
  está y cuenta como facturada. No se anula, no se reemplaza y no se recalcula con el Excel. Si la
  oficina quiere corregirla, la anula en Facturación (el trigger `exc0674_marcar_anulada` libera al
  cliente) y después se le carga el borrador con otra corrida de `--solo-facturas`.
- **Por qué es seguro hoy:** producción no tiene facturas reales del ERP. Hoy el sistema solo sirve el
  portal y los registros, y las únicas facturas de producción salen de este flujo de excepción. Ni
  cargar borradores ni emitirlos toca una contabilidad real ya cerrada. Un borrador no genera asiento:
  el asiento se hace al emitir, dentro de la RPC.
- La carga se reporta con conteos (clientes con borrador nuevo, clientes saltados por tener factura) y
  nunca con montos, nombres ni literales del Excel. El repo es público.

### 3.3 «Facturar» emite el borrador (migración 0569)

- RPC nueva: **`exc0674_emitir_borradores(p_consolidation_id uuid, p_invoice_ids uuid[], p_confirmacion
  text) returns jsonb`**, hermana de la 0564: `SECURITY DEFINER`, `search_path=''` y EXECUTE solo para
  `authenticated`.
- **Guardas:** las mismas de la 0564 (rol, `'Confirmado'`, contenedor de la lista) y, por cada factura:
  - es `borrador`, viva, del tenant, en USD y con total > 0;
  - su `shipment_id` es un envío vigente del contenedor;
  - el cliente no tiene otra factura emitida viva en el rastro.
  - Cualquier fallo deshace todo; no hay emisiones a medias.
- **Qué hace:**
  - `UPDATE` del borrador a `emitida`, con `issued_at` de hoy, `due_date` a +30 días y `write_version`
    + 1. **El código no cambia**: se asignó al insertar el borrador;
  - el asiento con `post_invoice_journal_entry_atomic`, con la misma regla de la 0564;
  - el rastro `exc0674_factura_envios` (los envíos del cliente en el contenedor) y `exc0674_facturas`,
    con `legal_ack = 'exc_0674'`;
  - la auditoría `invoice_emitted_exc0674_borrador`;
  - los mismos bloqueos de numeración y de cliente que la 0564.
- **El monto es el de la pre-orden** (el borrador). La RPC no recibe montos. En el 64 manda el Excel. En
  Embarques no se edita el precio; si hace falta corregirlo, se corrige la pre-orden en Facturación
  antes de emitir (`updateInvoice` ya edita borradores). Lo decidió Sam el 2026-11-20 (§7, punto 1).
- `exc0674_facturas.tecleado_por` hoy quiere decir «quién tecleó el monto». En la 0569 se agrega
  `origen_monto` (`'tecleado'` o `'borrador'`) para que el rastro diga de dónde salió el monto.
- Hay que verificar en la implementación que los triggers de `invoices` (titular 0466, guarda i3 0497,
  auditoría d2 0290) aceptan el `UPDATE` borrador → emitida, con prueba SQL.
- Acción de servidor nueva, hermana de `facturarExc0674Action`. Hace las mismas verificaciones, manda un
  correo `invoice_emitted` por factura después del commit y revalida la página.

### 3.4 La puerta legal AUT-04: la RPC no la salta en silencio

> **Decisión de Sam (2026-11-20):** la aceptación de T&C no frena la facturación ni la contabilidad; se
> exige en el portal (SDD-0693). Mientras la 0693 no cambie formalmente la AUT-04, la RPC de la 0690 emite
> bajo la EXC-0674 ampliada a pre-orden y «Facturar todo», con el mismo alcance y la misma fecha.
>
> La ampliación se anota en el registro de la EXC-0674 en la PR de implementación, no antes.

- **Qué regla no aplica.** La puerta legal AUT-04 (SDD-0054), en `evaluateLegalGate`
  (`app/studio/(app)/facturacion/actions.ts:299`, y su llamada al emitir en `:611`), exige para un envío
  `puerta_a_puerta_DDP` una aceptación vigente de T&C (`hasValidAcceptanceForMarkbox`) que cuadre con el
  Shipping Mark, el CBM, el peso, el total y la orden. Con `LEGAL_GATE_HARD_BLOCK = true`
  (`lib/studio/legal/gate-config.ts:35`), sin aceptación no se emite y no hay override. La RPC nueva no
  consulta esa exigencia de aceptación, y **solo esa**. Todo lo demás de la emisión sí corre: rol, lista,
  doble confirmación, estado `borrador`, triggers de `invoices`, asiento atómico y auditoría.
- **Por qué.** Es la excepción **EXC-0674**, opción 2, que Sam decidió el 2026-11-18 (spec 0674, §3.1 (a)
  y §7.3). Los clientes del 64 entraron por la carga de consolidados y no pasaron por una cotización
  aceptada en el portal, y hoy no existe un flujo de aceptación para esos envíos. Sin la excepción, la
  puerta bloquea a todos los clientes del 64.
- **Hasta cuándo.** Lo que diga el registro de la EXC-0674: revisión el **2027-01-31**, o antes si se
  vacía la lista `exc0674_contenedores`. Con la lista vacía, la RPC no emite nada, porque su guarda de
  lista falla. `LEGAL_GATE_HARD_BLOCK` sigue igual para todo lo demás, y `emitInvoice` no cambia.
- **Cómo queda la marca.** Cada factura emitida por la RPC deja `legal_ack = 'exc_0674'` en
  `exc0674_facturas` y en la auditoría (`append_audit_event`, misma transacción), con quién la emitió y
  `origen_monto = 'borrador'`. Así se puede listar todo lo emitido sin aceptación.
- **La ampliación de la excepción.** El registro formal de la EXC-0674
  (`docs/governance/reviews/excepcion-0674-facturar-embarques-2026-11-18.md`) cubre «solo la acción
  «Facturar»» de la 0564, la del monto tecleado. Emitir la pre-orden y «Facturar todo» son acciones
  nuevas. Sam aprobó ampliarla a esas dos acciones con el mismo alcance (solo la lista, solo `accounting`
  y `admin`) y la misma fecha de revisión (§7, punto 3). Se anota en ese registro en la PR de
  implementación.

### 3.5 La pantalla

- **Las palabras de Sam.** El modelo es estimado (la cotización) → **pre-orden** (el cliente aceptó; no es
  contable) → **factura**. En la pantalla se dice «pre-orden», nunca «borrador». «Borrador» queda solo
  como nombre técnico del estado de `invoices`.
- En `FacturarContenedor`, por cliente:
  - **con pre-orden:** se ve su total en USD, sin campo para teclear, y el botón «Facturar», que la emite;
  - **sin pre-orden ni factura** (el cliente no tiene precio en el Excel): monto tecleado, como hoy, por
    el camino de la 0564 (§7, punto 2);
  - **ya facturado:** «Facturada {código}», sin botón, como hoy.
- **El número en color es un enlace.** En el detalle por cliente (y en `FacturarContenedor`), el monto se
  ve en color y lleva a su documento en Facturación (`/studio/facturacion/{código}`, la misma ruta que
  usan Facturación y Cobranzas):
  - si el cliente está facturado, a **su factura**;
  - si no, a **su pre-orden**.
  - Ahí se edita, con el RBAC de Facturación. Embarques no edita precios. El enlace solo aparece con
    `montos`, para `accounting` y `admin`.
- **«Facturar todo»** emite todas las pre-órdenes del contenedor en una sola llamada, con la misma doble
  confirmación. El resumen dice cuántos clientes y el total en USD.
- **«Facturado»:** cuando todos los clientes del contenedor tienen factura emitida viva, la cabecera
  muestra la insignia «Facturado» y `FacturarContenedor` no muestra ningún botón. El contenedor se queda
  en Embarques. El historial de los entregados al 100 % es la SDD-0691.
- **Sobre el contenedor entero** (revisión de la PR, 2026-11-20): los clientes, las pre-órdenes,
  «Facturar todo» y «Facturado» se calculan sobre todos los envíos del contenedor, sin la pestaña, el
  servicio ni la búsqueda. Así, un cliente cuya pre-orden cuelga de un envío que el filtro dejó fuera no
  aparece con el monto para teclear.
- **Pre-orden sin monto válido:** un cliente con una pre-orden viva en $0 o en otra moneda no va al camino
  tecleado. La fila dice «Pre-orden sin monto válido: corrígela en Facturación», con el enlace a la
  pre-orden y sin botón. En la base, `exc0674_facturar` (redefinida en la 0569) rechaza el monto tecleado
  de un cliente con una pre-orden viva en el contenedor (`exc0674:tiene_preorden`).
- **Los rótulos del dinero, para cerrar el pendiente de la 0689:**
  - **«Sin facturar» = la suma de las pre-órdenes**, igual que en el encabezado. Esto es firme (Sam,
    2026-11-20).
  - **El resumen es la versión B** (Sam, 2026-11-20: «Me quedo con la versión B»; §7, punto 4):
    - **«Total del embarque»** = la suma del total de las facturas emitidas y de las pre-órdenes, todo
      lo no anulado, en USD;
    - **«Sin facturar»** va como desglose del total: la parte que todavía son pre-órdenes;
    - **«Pagado»** = lo abonado (`paid_amount`), sobre facturas y pre-órdenes, contando los abonos por
      adelantado;
    - **«Saldo»** = el total menos lo pagado.
  - **Por cliente, igual:** Total, Pagado y Saldo. El saldo de una pre-orden es su total menos lo abonado.
  - La franja del contenedor y el detalle por cliente usan las mismas palabras con el mismo sentido. «Por
    cobrar» y «Cobrado» desaparecen de Embarques.
  - **Medido: hoy una pre-orden no puede recibir abonos.** El cobro (`0467_cobro_factura_atomico.sql:209`)
    y el reporte de pago (`0195_payment_reports.sql` §5, `0464_reporte_pago_factura_pagada.sql:245`)
    rechazan una factura en `borrador`. Así que hoy el «Pagado» de una pre-orden es 0 y su saldo es su
    total. La fórmula ya cuenta los abonos por adelantado para cuando existan. **Registrar un abono
    sobre una pre-orden no entra en esta spec** (§8).
- Los quiebres que la revisión de la 0689 dejó para aquí:
  - el «Peso total» de la franja y del pie se iguala al del encabezado: el contenedor entero
    (`GrupoContenedor.completo`);
  - la referencia vencida de la spec 0689 (§3.1 remite a «§5, punto 3», que ahora es el punto 4);
  - un borrador en USD por $0 muestra un texto exacto, no «Sin monto en USD».
- Todo en USD; el bolívar es solo una vista. Una factura en otra moneda no suma y no se emite por esta
  RPC.

## 4. Permisos y datos

- Solo `accounting` y `admin` ven montos y facturan (Sam, 2026-11-18: «El rol operaciones no factura y
  tampoco ve los valores.»). La página lo decide en el servidor, como en la 0661 y la 0689.
- La RPC no cambia la RLS de `invoices`.
- No se guardan montos, nombres ni literales del Excel en Git. Las pruebas usan datos inventados.
- Los datos personales que se tocan (el titular de la factura) ya los trata la 0564. No se agregan campos
  personales nuevos. Se revisa con `revisar-datos-ve` antes de la PR de implementación.

## 5. Aceptación

1. `--solo-facturas` crea un borrador por cliente del 64 con las líneas del Excel. A un cliente que ya
   tiene una factura viva no le crea otra. Con un contenedor que no está en la lista, aborta.
2. «Facturar» en un cliente con borrador lo emite **sin cambiar su código ni su total**. Hace el asiento
   y escribe el rastro con `origen_monto = 'borrador'`.
3. «Facturar todo» emite todos los borradores del contenedor, o ninguno si uno falla.
4. Con todos los clientes facturados, el contenedor dice «Facturado» y no hay botón.
5. Ningún rol fuera de `accounting` y `admin` puede llamar la RPC ni ve montos (prueba SQL y prueba del
   servidor).
6. El resumen de dinero es «Total del embarque» / «Pagado» / «Saldo», con «Sin facturar» (las
   pre-órdenes) como desglose del total. Por cliente va Total / Pagado / Saldo. Las palabras significan lo
   mismo en el encabezado, la franja y el detalle, y «Por cobrar» y «Cobrado» ya no aparecen en Embarques.
   Prueba con un cliente con factura emitida y abono parcial, y otro con pre-orden: el saldo de la
   pre-orden es su total menos lo abonado.
7. El «Peso total» de la franja y del pie coincide con el del encabezado con cualquier pestaña o filtro.
8. En el detalle, el monto en color lleva a la factura si el cliente está facturado y a la pre-orden si no.
   La pantalla dice «pre-orden», nunca «borrador».
9. Las pruebas de la 0564, la 0661 y la 0689 siguen pasando.

## 6. Archivos (allowlist)

Documentos:
- esta spec, el índice `docs/specs/README.md` y `.agents/handoffs/sdd-0690-embarques-facturar-emite-borrador.md`;
- `docs/specs/0689-embarques-encabezado-y-cliente/spec.md`, solo la referencia vencida del §3.1;
- `docs/governance/reviews/excepcion-0674-facturar-embarques-2026-11-18.md`, solo la ampliación aprobada
  (§3.4).

Base de datos:
- `supabase/migrations/0569_exc0674_emitir_borradores.sql`;
- el desarme de la 0569 en `supabase/desarmes/` (mismo número, sufijo `_desarme`; no se escribe el nombre entero porque el contrato `spec-migration-refs` busca todo `NNNN_*.sql` en `supabase/migrations/`);
- `supabase/tests/0569_exc0674_emitir_borradores.test.sql`;
- `supabase/tests/0569_exc0674_emitir_borradores_carrera.test.sql`;
- la plomería que el runbook y la CI piden para una migración nueva, igual que la 0564 (#684):
  `supabase/migrations-baseline.json`, `supabase/pending-migration-symbol-declarations.json`,
  `supabase/migrations.lock.json`, `scripts/ci-sql-tests-control.sh` (montaje del desarme) y
  `scripts/__tests__/invoice-read-boundary.test.mjs` (inventario de lecturas de facturas);
- `lib/studio/rbac-actions-guard.test.ts`, solo el inventario de acciones exportadas (496 → 497) y su
  comentario, igual que la 0674.

Cargador:
- `scripts/consolidados/generar-lote.ts` y `scripts/consolidados/lote-sql.ts` (modo `--solo-facturas`);
- `scripts/__tests__/consolidados-sql.test.ts`.

Embarques:
- `app/studio/(app)/embarques/facturar-actions.ts`;
- `app/studio/(app)/embarques/page.tsx`;
- `app/studio/(app)/embarques/_components/FacturarContenedor.tsx`;
- `app/studio/(app)/embarques/_components/EmbarquesClient.tsx`;
- `lib/studio/exc0674-queries.ts`;
- `lib/studio/embarques-contenedores.ts` (Total, Pagado, Saldo y «Sin facturar»);
- `lib/studio/embarques-contenedores-queries.ts`, **solo** agregar `id, invoice_code` al `select` de
  `invoices` en `leerMontosDeContenedores`, con sus dos líneas de mapeo y su comentario: el enlace a la
  factura o a la pre-orden y «Facturar» los necesitan. Es la misma consulta, con la misma puerta de
  `montos`; ninguna lectura nueva. Para los roles sin `montos` no llegan al navegador (prueba en
  `page-monto-por-rol.test.ts`). OK del DG del 2026-11-20.
- `lib/studio/exc0674.ts` (`mensajeErrorExc0674`) y su prueba `lib/studio/__tests__/exc0674.test.ts`,
  **solo** los textos de los errores nuevos de la 0569 (`tiene_preorden`, `no_borrador`, `moneda`,
  `borrador_alterado`, `factura_inexistente`, `envio_fuera_del_contenedor`). Fuera de la allowlist
  original; lo autorizó el DG en la revisión de la PR (2026-11-20).

Pruebas de Embarques:
- `app/studio/(app)/embarques/__tests__/facturar-exc0674-action.test.ts`;
- `app/studio/(app)/embarques/__tests__/page-exc0674-por-rol.test.ts`;
- `app/studio/(app)/embarques/__tests__/page-monto-por-rol.test.ts`;
- `app/studio/(app)/embarques/_components/__tests__/EmbarquesClient.facturar.test.tsx`;
- `app/studio/(app)/embarques/_components/__tests__/EmbarquesClient.cajas-monto.test.tsx`;
- `app/studio/(app)/embarques/_components/__tests__/EmbarquesClient.encabezado-cliente.test.tsx`;
- `lib/studio/__tests__/embarques-cajas-y-monto.test.ts`.

Cualquier archivo fuera de esta lista se anota en el handoff y pide OK del DG antes de tocarlo.

## 7. Decisiones de Sam

Respuestas de Sam del 2026-11-20, en el chat del DG:

1. **El precio (DECIDIDO).** En el 64 manda el Excel, y en Embarques no se edita el precio. En el detalle, el
   número en color es un enlace: a la factura si está facturado, o a la pre-orden si no. La edición se
   hace en Facturación. Su modelo es estimado (cotización) → pre-orden (el cliente aceptó, no contable) →
   factura, y en la pantalla se dice «pre-orden», no «borrador» (§3.3 y §3.5).
2. **Cliente sin precio en el Excel (DECIDIDO).** Monto tecleado, como hoy (§3.5).
3. **La aceptación de T&C (DECIDIDO).** No frena la facturación ni la contabilidad: se exige en el portal
   del cliente, en la SDD-0693 (aviso insistente, sin tracking ni estado de cuenta hasta que acepte, y un
   correo con hash y acuse). Mientras la 0693 no cambie formalmente la AUT-04, la RPC emite bajo la
   EXC-0674 ampliada a pre-orden y «Facturar todo», con el mismo alcance y la misma fecha (§3.4).
4. **El resumen de dinero (DECIDIDO).** Sam vio dos versiones y respondió «Me quedo con la versión B»: Total
   del embarque / Pagado / Saldo, contando los abonos por adelantado, con «Sin facturar» (las pre-órdenes)
   como desglose del total. Por cliente, igual: Total, Pagado y Saldo; el saldo de una pre-orden es su
   total menos lo abonado (§3.5).

## 8. Fuera de alcance

- **Registrar abonos sobre una pre-orden.** Hoy el cobro y el reporte de pago rechazan los borradores
  (§3.5). El resumen ya los cuenta si existen, pero abrir esa vía toca Cobranzas y la contabilidad, y es
  una SDD propia si Sam la pide.
- La línea de exceso de kg y la tarifa por cliente: SDD-0692.
- El historial de contenedores entregados al 100 %: SDD-0691.
- Cargar borradores de cualquier contenedor que no sea el 64.
- Aplicar la 0569 en producción: lleva su propio OK nominal de Sam, aparte del merge.
- Corregir la cabecera vieja de la 0564 («NO APLICADA»): un archivo aplicado no se edita. Si hace falta,
  se anota en su spec.

## 9. Clasificación de gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| SGE-00 (acciones predecibles) | cumplimiento | «Facturar» y «Facturar todo» dicen qué emiten, con doble confirmación. |
| BTN-01 | cumplimiento | Los mismos botones y estados de `FacturarContenedor`. |
| MP-01 (mutación protegida) | cumplimiento | La RPC exige rol, lista, `'Confirmado'` y estado `borrador`, y es atómica. |
| AUD-01 / AUD-02 | cumplimiento | `append_audit_event` en la misma transacción y rastro `exc0674_*`. |
| Regla de montos (0661, RLS 0414, frontera SDD-0357) | cumplimiento | Montos solo con `accounting` o `admin`, decididos en el servidor. |
| Gate legal AUT-04 (SDD-0054) | excepción | EXC-0674 ampliada a pre-orden y «Facturar todo», mismo alcance y fecha (revisión 2027-01-31), mientras la SDD-0693 no cambie formalmente la AUT-04 (§3.4). Solo la regla de aceptación de T&C. |
| Producción y migraciones | cumplimiento | Sin archivo 0569 hasta aprobar. La aplicación de la 0569 y la carga del 64 llevan cada una su OK nominal, y la carga la corre el DG. |
