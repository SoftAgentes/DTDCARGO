---
sdd: "0690"
title: "Embarques: «Facturar» emite el borrador con los precios del Excel, «Facturar todo» y «Facturado»"
status: proposed
author: "Claude (Worker) + Sam"
created: 2026-11-20
updated: 2026-11-20
supersedes: null
superseded_by: null
related: ["0543", "0661", "0674", "0682", "0689", "0691", "0692"]
confidencialidad: interno
---

# SDD-0690 — Embarques: «Facturar» emite el borrador con los precios del Excel, «Facturar todo» y «Facturado»

> **Estado: propuesta.** Falta la aprobación de Sam y las respuestas del §7. La migración **0569**
> todavía no existe como archivo. Se escribe cuando esta spec quede aprobada, y su cabecera dirá «NO
> APLICADA EN NINGÚN ENTORNO».

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
- **Correrlo en producción necesita el OK nominal de Sam en el chat del DG**, para el 64 y para nada más.
  Antes va un ensayo en una base local con `rollback` y conteos, sin montos. Fusionar la PR no autoriza la
  carga.

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
- **El monto es el del borrador.** La RPC no recibe montos. Si la oficina tiene que corregir un precio,
  corrige el borrador en Facturación antes de emitir (`updateInvoice` ya edita borradores). Ver §7,
  pregunta 1.
- `exc0674_facturas.tecleado_por` hoy quiere decir «quién tecleó el monto». En la 0569 se agrega
  `origen` (`'tecleado'` o `'borrador'`) para que el rastro diga de dónde salió el monto.
- Hay que verificar en la implementación que los triggers de `invoices` (titular 0466, guarda i3 0497,
  auditoría d2 0290) aceptan el `UPDATE` borrador → emitida, con prueba SQL.
- Acción de servidor nueva, hermana de `facturarExc0674Action`. Hace las mismas verificaciones, manda un
  correo `invoice_emitted` por factura después del commit y revalida la página.

### 3.4 La pantalla

- En `FacturarContenedor`, por cliente:
  - **con borrador:** se ve su total en USD, sin campo para teclear, y el botón «Facturar», que lo emite;
  - **sin borrador ni factura:** queda el camino tecleado de la 0564, tal como está (ver §7, pregunta 2);
  - **ya facturado:** «Facturada {código}», sin botón, como hoy.
- **«Facturar todo»** emite todos los borradores del contenedor en una sola llamada, con la misma doble
  confirmación. El resumen dice cuántos clientes y el total en USD.
- **«Facturado»:** cuando todos los clientes del contenedor tienen factura emitida viva, la cabecera
  muestra la insignia «Facturado» y `FacturarContenedor` no muestra ningún botón. El contenedor se queda
  en Embarques. El historial de los entregados al 100 % es la SDD-0691.
- **Los rótulos del dinero, para cerrar el pendiente de la 0689:**
  - **«Sin facturar»** = la suma de los borradores, igual que en el encabezado;
  - **«Por cobrar»** = el saldo de lo emitido (total menos pagado; ver §7, pregunta 3);
  - **«Cobrado»** = lo pagado;
  - la franja y el detalle por cliente usan las mismas tres palabras con el mismo sentido.
- Los quiebres que la revisión de la 0689 dejó para aquí:
  - el «Peso total» de la franja y del pie se iguala al del encabezado (el contenedor entero), o se
    rotula como peso de la vista;
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
   y escribe el rastro con `origen = 'borrador'`.
3. «Facturar todo» emite todos los borradores del contenedor, o ninguno si uno falla.
4. Con todos los clientes facturados, el contenedor dice «Facturado» y no hay botón.
5. Ningún rol fuera de `accounting` y `admin` puede llamar la RPC ni ve montos (prueba SQL y prueba del
   servidor).
6. «Sin facturar», «Por cobrar» y «Cobrado» significan lo mismo en el encabezado, la franja y el detalle.
7. Las pruebas de la 0564, la 0661 y la 0689 siguen pasando.

## 6. Archivos (allowlist provisional; se cierra al aprobar)

- Esta spec, el índice `docs/specs/README.md` y `.agents/handoffs/sdd-0690-embarques-facturar-emite-borrador.md`.
- `supabase/migrations/0569_exc0674_emitir_borradores.sql`, su desarme en `supabase/desarmes/`, su prueba
  `.test.sql` y las declaraciones de espera que pida el runbook.
- `scripts/consolidados/generar-lote.ts` y `lote-sql.ts` (modo `--solo-facturas`) y sus pruebas.
- `app/studio/(app)/embarques/facturar-actions.ts`, `_components/FacturarContenedor.tsx`,
  `_components/EmbarquesClient.tsx`, `page.tsx` y `lib/studio/exc0674-queries.ts`.
- `lib/studio/embarques-contenedores.ts` (rótulos y saldo) y sus pruebas.
- `docs/specs/0689-embarques-encabezado-y-cliente/spec.md`, solo la referencia vencida del §3.1.

## 7. Preguntas para Sam

1. **¿Se puede cambiar el precio antes de emitir?** Propuesta: sí, editando el borrador en Facturación.
   Embarques emite lo que diga el borrador.
2. **Un cliente del 64 que no tiene precio en el Excel:** ¿sigue con el monto tecleado de hoy, o se queda
   sin facturar hasta tener precio? Propuesta: sigue el tecleado.
3. **«Por cobrar»:** ¿es el saldo de lo emitido (total menos pagado) o el total emitido? Propuesta: el
   saldo.

## 8. Fuera de alcance

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
| Puerta legal (EXC-0674) | excepción | La misma excepción aprobada en la 0674, solo para la lista y solo por la RPC. |
| Producción y migraciones | cumplimiento | Sin archivo 0569 hasta aprobar; la aplicación y la carga del 64 llevan cada una su OK nominal. |
