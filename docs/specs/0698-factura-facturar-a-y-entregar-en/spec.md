---
sdd: "0698"
title: "Factura: Facturar a y Entregar en"
status: proposed
author: "Claude (Worker) + Sam"
created: 2026-11-20
updated: 2026-11-20
supersedes: null
superseded_by: null
related: ["0138", "0298", "0487", "0543", "0674", "0690", "0694", "0695", "0696"]
confidencialidad: interno
---

# SDD-0698 — Factura: Facturar a y Entregar en

> **Estado: propuesta para que Sam la apruebe.** No trae código, ni migraciones, ni cambios de producto.
> Las decisiones de Sam van citadas con su fecha (§3). Las preguntas abiertas están en la §11, una por una,
> cada una con su opción recomendada (⭐).
>
> Los ejemplos son inventados. No hay datos, conteos ni montos de producción.

## 1. Pedido

En la revisión de la SDD-0694 (#725) se vio que la factura solo guarda una dirección cuando se emite a la
razón social alterna del cliente. En el caso normal, la factura a la persona principal, no guarda ninguna.

Sam pidió compararlo con QuickBooks y eligió ese modelo el 2026-11-20: **cada factura lleva dos
direcciones, «Facturar a» y «Entregar en», y las dos se sellan al emitir.** Esta spec diseña ese cambio:
el dato, las reglas, las pantallas y sus fases.

## 2. Medición en `main` (`af0f635ad`)

### 2.1 Qué sella la factura hoy

- El trigger `invoices_seal_billing_titular` (`supabase/migrations/0466_client_billing_identity.sql:351-353`)
  sella el titular **solo al emitir**. Lo hace en un INSERT con status `emitida` o en un UPDATE de
  `borrador` a `emitida` (`0466:275-280`).
- Resuelve el tipo de titular con `bill_to_kind` del borrador o, si no hay, con la preferencia del cliente
  (`0466:301-307`).
- **Si la factura va a la identidad alterna**, sella su nombre, documento, tipo y `fiscal_address`
  (`0466:309-315`).
- **Si va a la principal**, sella nombre, documento y tipo desde `clients`, y deja
  `client_fiscal_address := null` (`0466:316-320`). **La principal no tiene dónde guardar su dirección
  fiscal.** La 0466 lo decidió así: «No se agrega ninguna columna a `clients`» (`0466:25`).
- Después de emitir, el trigger congela `client_name`, `client_rif`, `client_doc_kind`,
  `client_fiscal_address` y `bill_to_kind` (`0466:263-272`).
- La identidad alterna vive en `client_billing_identities`: una por cliente (`0466:170`), con
  `fiscal_address` opcional en texto libre de 5 a 300 caracteres (`0466:162-165`) y la preferencia
  `is_billing_default` (`0466:166`).
- En el Studio, la opción de la principal sale con `fiscalAddress: null` (`lib/studio/invoice-billing.ts:46-52`).
  La vista previa del borrador, «Así sale en la factura», solo muestra una dirección para la alterna
  (`app/studio/(app)/facturacion/_components/InvoiceTitularPicker.tsx:140-146`).
- La cabecera de la 0466 dice «NO APLICADA A PRODUCCIÓN» (`0466:5-10`), pero ya no figura como espera:
  `supabase/migrations-baseline.json:39` tiene `pendingBelowCutoff` vacío. No leí producción. Dir_DTD
  confirma su estado antes de la F-2 (§7).

### 2.2 Dirección de entrega del cliente

- `client_delivery_addresses` (0198) guarda varias direcciones por cliente, con `label`, `line`, `city`,
  `city_slug`, `state`, `reference` e `is_default` (`0198:22-37`).
- El índice único parcial `client_delivery_addresses_default_uidx` (`0198:44-46`) permite **como máximo una**
  predeterminada vigente por cliente. Que haya **al menos una** es de la SDD-0695, fase F-9 (§9).
- Mi perfil del portal ya deja agregar, editar, borrar y **predeterminar** direcciones
  (`app/portal/(app)/perfil/PortalAddresses.tsx:148-220`, `:542-546`).

### 2.3 ¿El embarque guarda una dirección elegida por el cliente?

Sam dice que «esa opción está». **Lo medí y está a medias:**

| Pieza | Existe | Evidencia |
|---|---|---|
| Varias direcciones y una predeterminada | Sí | `0198:22-46`, `PortalAddresses.tsx:148-220` |
| El cliente elige a dónde llega **cada** embarque | **No** | Ninguna tabla tiene `delivery_address_id` (búsqueda en `supabase/migrations/`, `app/` y `lib/`). La ficha del envío del portal (`app/portal/(app)/envios/[code]/page.tsx`) no lee direcciones |
| Texto de la dirección final del envío | Sí, pero **lo escribe el equipo** | `shipments.delivery_address`, texto libre (`0009_shipment_delivery_pod.sql:11`, `:15-16`). Lo llenan el Almacén VE (`app/studio/(app)/ve/actions.ts:103-112`) y el TMS con la última parada de la ruta (`app/studio/(app)/tms/actions.ts:236-239`). Se congela al entregar (`0321_warehouse_ve_delivery_governance.sql:71`) |

Es decir: el cliente puede tener siete direcciones, pero hoy no puede decir a cuál va cada embarque. Esta
spec agrega esa elección (§4.3, fase F-3).

### 2.4 El PDF y el comprobante HTML

- `domicilioFiscalSellado` (`lib/studio/invoice-client-doc.ts:69-84`) lee `invoices.client_fiscal_address`
  y no recalcula nada.
- Lo usan los dos PDF: el del portal (`app/portal/(app)/facturas/[code]/pdf/route.ts:74`) y el del Studio
  (`app/studio/(app)/facturacion/[code]/pdf/route.ts:57`).
- El PDF tiene un bloque «Cliente» con nombre, documento, «Domicilio fiscal» y Shipping Mark, y un bloque
  «Envío» con el código del envío (`lib/studio/pdf/factura-pdf.tsx:379-394`). **No tiene «Entregar en».**
- El comprobante HTML del portal imprime `clients.address` en vivo (`app/portal/(app)/facturas/[code]/comprobante/page.tsx:232`).
  La SDD-0694, decisión 9, lo cambia para que use `domicilioFiscalSellado`, igual que el PDF (§9).

### 2.5 Una factura puede cubrir varios embarques

- `invoices.shipment_id` y `shipment_code` enlazan **un** embarque (`0077_invoices.sql:30-31`).
- Desde la SDD-0543, cada línea puede llevar su `shipmentCode` cuando la factura junta varios embarques
  de un cliente y contenedor (`lib/studio/invoice-types.ts:32-38`).
- La facturación por contenedor de la SDD-0674 inserta la factura ya `emitida`, con una línea por embarque
  y, si hay aliado raíz, a nombre del aliado (`0564_exc0674_facturar_contenedor.sql:11-15`, `:50-58`).
- La SDD-0690 (#719, fusionada el 2026-11-20 y todavía sin aplicar) agrega `exc0674_emitir_borradores`.
  Esa función emite la pre-orden que ya existe, con un UPDATE de `borrador` a `emitida`, y no cambia ni
  las líneas ni los montos (`0569_exc0674_emitir_borradores.sql:2`, `:13-17`).

### 2.6 Despacho y app del chofer

- `hydrateClientFieldsOnPackages` lee `clients.address` y `address_reference` por Shipping Mark
  (`lib/studio/dispatch-mobile-queries.ts:161-163`) y los pasa a `client_address` y
  `client_address_reference` (`:199-200`).
- Los paquetes del despacho son recepciones de almacén (`warehouse_receipt_cn` y `warehouse_receipt_ve`,
  `lib/studio/dispatch-types.ts:36-38`), no embarques. El camino de una recepción a su embarque hay que
  medirlo en la F-3.
- La SDD-0694, fase F-1, ya cambia este lector a la predeterminada de `client_delivery_addresses` (§9).

## 3. Decisiones de Sam (2026-11-20)

Llegaron por mensaje de Dir_DTD a este Worker, el mismo día.

1. **Modelo: «Como QuickBooks: dos direcciones».** En QuickBooks, el cliente tiene una dirección de
   facturación y una de envío. La factura copia «Facturar a» y «Enviar a» al crearse, y se pueden editar
   en esa factura. Si después el cliente cambia su dirección, solo cambian las facturas nuevas.
2. **Cada identidad tiene su dirección fiscal.** Las identidades son la persona principal y la razón social
   alterna de `client_billing_identities` (0466). La dirección fiscal lleva una casilla «igual a mi
   dirección de entrega».
3. **Al emitir, la factura sella las dos:** «Facturar a» (nombre, documento y dirección fiscal) y «Entregar
   en». Las dos se pueden editar mientras la factura está en borrador.
4. **Las facturas viejas sin sello** muestran «Dirección actual del cliente».
5. **La predeterminada manda.** Texto de Sam, casi literal:

   > «El cliente puede tener varias direcciones, pero solamente nos va a aparecer la dirección
   > predeterminada: la última que escogió en su perfil. En el perfil puede registrar direcciones nuevas de
   > entrega o varios almacenes, y escoger en qué almacén quiere que se entregue cada embarque. Si tiene
   > siete embarques para siete direcciones, puede escoger a dónde llega cada uno. Aunque no use esa
   > opción, queda su dirección principal como predeterminada. A la hora de facturar, siempre va a salir la
   > que él escoja como predeterminada en su portal.»

## 4. Modelo de datos

Tres piezas, una por fase. Las migraciones van sin número: las numera Dir_DTD.

### 4.1 La dirección fiscal por identidad (F-1)

**Tabla nueva `client_fiscal_addresses`.** Hay una fila por cliente y por identidad:

| Columna | Tipo | Regla |
|---|---|---|
| `id` | uuid | Llave primaria |
| `tenant_id` | uuid | La sella un trigger desde el cliente, como en `0198` |
| `client_id` | uuid | FK a `clients`, `on delete cascade` |
| `kind` | text | `persona` o `empresa`. Tiene que ser el tipo de la principal (`clients.doc_kind`) o el de la identidad alterna. Lo valida un trigger |
| `same_as_delivery` | boolean | La casilla «Igual a mi dirección de entrega». Por defecto, `true` |
| `line`, `city`, `state` | text | Obligatorios si `same_as_delivery` es `false`, y en null si es `true`. `line` va de 5 a 300 caracteres, recortada, como `0466:162-165` |
| `created_at`, `updated_at` | timestamptz | — |

- `unique (client_id, kind)`.
- **Sin fila, se entiende que la casilla está marcada.** Así, ningún cliente necesita una fila nueva para
  que su factura tenga dirección. Esto depende de la pregunta P-3 (§11).
- **Por qué una tabla y no una columna en `clients`:**
  - la 0466 decidió no agregar columnas a `clients` (`0466:25`);
  - la SDD-0695 pide una fuente por dato;
  - con una sola tabla, las dos identidades se leen y se sellan igual.
- **`client_billing_identities.fiscal_address` se retira por fases:**
  1. la migración copia cada `fiscal_address` no vacío a una fila con `same_as_delivery = false` y
     `line = fiscal_address`. Ciudad y estado quedan en null, porque hoy es texto libre;
  2. los lectores (`lib/portal/billing-identity.ts`, `invoice-billing.ts`, `ClientBillingCard.tsx`) pasan a
     la tabla nueva;
  3. la columna se borra en una migración aparte, después de un `git grep` sin lectores. Esta migración
     entra en el registro de fuentes únicas de la 0695 (§4.1 de esa spec).

  La regla de `line`, `city` y `state` obligatorios aplica a las filas nuevas. Las copiadas pueden llevar
  ciudad y estado en null.
- **Acceso:**
  - en el portal, por RPC de sesión, igual que la 0466 (`0466:47-51`): `portal_get_my_billing_profile` se
    redefine para devolver la dirección fiscal de cada identidad, y una RPC nueva,
    `portal_set_my_fiscal_address(p_kind, p_same_as_delivery, p_line, p_city, p_state)`, la escribe. Las dos
    son `security definer`, con `search_path = ''`, EXECUTE solo para `authenticated`, y el cliente sale de
    la sesión, nunca de un parámetro;
  - en el Studio, SELECT para `accounting`, `admin` y `commercial` del tenant, como `0466:52`. Quién la
    edita desde el Studio depende de la pregunta P-5;
  - `service_role`: todo.
- **Borrar la identidad alterna** (`portal_delete_my_billing_identity`, 0466) borra también su fila de
  dirección fiscal, en la misma transacción.
- **Cambiar el tipo de la principal** (`clients.doc_kind`) deja la fila vieja con un `kind` que ya no es de
  ninguna identidad. El trigger de validación no la borra: el resolvedor solo lee las filas de un `kind`
  vigente. La F-1 mide si ese cambio ocurre y por cuál camino.

### 4.2 El sello doble en `invoices` (F-2)

**Columnas que se reutilizan:**

- `client_name`, `client_rif` y `client_doc_kind` siguen igual: son el nombre y el documento de «Facturar a».
- `client_fiscal_address` pasa a ser **la dirección de «Facturar a»**, para las dos identidades.

**Columnas nuevas:**

| Columna | Tipo | Qué guarda |
|---|---|---|
| `ship_to_address` | text | La dirección de «Entregar en», en texto: `line`, ciudad y estado |
| `ship_to_address_id` | uuid, sin FK | La fila de `client_delivery_addresses` de la que salió. Sirve de rastro. Queda en null si se editó a mano o si no había dirección |
| `ship_to_by_shipment` | jsonb | Las entregas de los embarques que van a otra dirección: `[{ "shipmentCode": "…", "address": "…" }]`. Depende de la pregunta P-1 |
| `addresses_sealed_at` | timestamptz | La hora del sello. **Es la marca que separa una factura nueva de una vieja** |

**El trigger** `invoices_seal_billing_titular` se redefine en una migración nueva. Conserva todo lo de la
0466 y agrega lo siguiente:

1. **Congelado:** a la lista de `0466:265-269` se suman `ship_to_address`, `ship_to_address_id`,
   `ship_to_by_shipment` y `addresses_sealed_at`.
2. **En el borrador**, `client_fiscal_address` y `ship_to_address` solo los escribe el operador cuando edita
   esa factura. **Null significa «sigue al cliente».**
3. **Al emitir**, en el mismo momento que hoy (`0466:275-280`):
   - **«Facturar a»:**
     - el nombre y el documento se resuelven como hoy;
     - si el borrador trae `client_fiscal_address`, se queda esa;
     - si no, se toma la dirección fiscal de la identidad elegida: si la casilla está marcada (o no hay
       fila), la predeterminada de entrega; si no, `line`, ciudad y estado de la fila;
     - **cambio de comportamiento:** en el caso principal, `0466:320` hoy pone null y pasa a sellar la
       dirección.
   - **«Entregar en»:**
     - si el borrador trae `ship_to_address`, se queda esa, con `ship_to_address_id` en null;
     - si no, la **predeterminada vigente** del cliente de la factura (decisión 5);
     - si no hay predeterminada pero sí filas vigentes, la más reciente, con la misma regla que el helper
       `direccionDeEntrega` de la 0694 (§4.1 de esa spec). Ver §9;
     - sin filas vigentes, queda en null.
   - **Por embarque:** ver §5.3.
   - `addresses_sealed_at := now()`.
   - **Auditoría:** si el borrador editó alguna de las dos direcciones, se registra
     `invoice_address_overridden` con `append_audit_event`, igual que `0466:323-345`. El payload lleva
     **solo cuál de las dos se editó** (`bill_to` o `ship_to`), nunca el texto.
4. **El formato del texto** sale de una función SQL nueva (por ejemplo, `format_delivery_address(line, city,
   state)`), que es la única que arma la dirección para el sello. Su equivalente en TypeScript lo prueba la
   misma tabla de casos. **No incluye `reference`** (§10, punto 2).
5. **Las vías de emisión que ya cubre el trigger** se mantienen: la RPC 0128, la acción del Studio y
   `exc0674_facturar` (0564), que inserta en `emitida`. También `exc0674_emitir_borradores` (0569), que
   pasa la pre-orden de `borrador` a `emitida`: la pre-orden se sella al emitirla, con sus ediciones de
   borrador si las tiene. No hay que cambiar ninguna de ellas. La F-2 comprueba que la guarda
   `borrador_alterado` de la 0569 no salta por las columnas que llena el trigger en ese mismo UPDATE.

**Sin backfill.** Las facturas ya emitidas quedan con `addresses_sealed_at` en null. Son las «viejas sin
sello» de la decisión 4 (§5.4).

### 4.3 «Entregar en» por embarque (F-3)

**Columna nueva `shipments.delivery_address_id`**: uuid, nullable, FK a `client_delivery_addresses(id)`
`on delete set null`.

- **Null = la predeterminada.** Es el caso normal: «Aunque no use esa opción, queda su dirección principal
  como predeterminada» (decisión 5).
- Un trigger valida que la dirección sea **del cliente del embarque**, del mismo tenant y que esté vigente
  (`deleted_at is null`).
- Si la dirección elegida se borra después (borrado lógico), el resolvedor la ignora y vuelve a la
  predeterminada. La columna no se limpia sola.
- **Quién la cambia:**
  - **el cliente, en el portal**, con una RPC de sesión nueva, `portal_set_shipment_delivery_address(p_shipment_code,
    p_address_id)`. Null vuelve a la predeterminada. Funciona **hasta el corte** que defina la pregunta
    P-4. Después responde con un error de campo: «Este embarque ya salió a reparto. Escríbenos para
    cambiar la entrega»;
  - **el equipo, en el Studio**, en la ficha del embarque, con los mismos roles que hoy escriben
    `shipments`;
  - los dos dejan auditoría `shipment_delivery_address_changed`, con la fila elegida (su id) y sin el
    texto de la dirección.
- **`shipments.delivery_address` (el texto de 0009) se queda.** Es la dirección operativa del envío y la
  sigue escribiendo el equipo. Lo nuevo:
  - el Almacén VE (`ve/actions.ts:103-112`) y el TMS (`tms/actions.ts:236-239`) **precargan** el campo con
    la dirección elegida o, si no hay, con la predeterminada. El operador la puede cambiar;
  - el congelado de `0321:71` no cambia.

  La 0694 dejó esta precarga como «mejora aparte» (su §8). Aquí la toma la F-3.
- **`merge_clients`** mueve las filas de `client_delivery_addresses` al cliente que sobrevive sin cambiarles
  el id (`0361:137-149`). Por eso `delivery_address_id` sigue apuntando bien después de una fusión. La F-3
  lo comprueba con un contrato SQL. No hace falta redefinir la función.

## 5. Reglas

### 5.1 Qué se sella y cuándo

| Dato | Se sella | Desde dónde |
|---|---|---|
| Nombre y documento de «Facturar a» | Al emitir (como hoy) | La identidad elegida (`bill_to_kind` o la preferencia) |
| Dirección de «Facturar a» | Al emitir | La edición del borrador o, si no hay, la dirección fiscal de esa identidad (§4.1) |
| «Entregar en» | Al emitir | La edición del borrador o, si no hay, la predeterminada vigente del cliente de la factura |
| Entregas por embarque | Al emitir | La dirección elegida de cada embarque de las líneas, solo si es distinta de la de «Entregar en» (§5.3) |

**Si después el cliente cambia su dirección, solo cambian las facturas nuevas** (decisión 1). Lo garantiza
el congelado del trigger, no la pantalla.

### 5.2 El borrador

- Muestra los dos bloques, «Facturar a» y «Entregar en», con lo que **saldría si se emitiera ahora**. Es la
  misma idea que la vista previa de hoy, «Así sale en la factura» (`InvoiceTitularPicker.tsx:140`).
- Cada bloque tiene **«Editar en esta factura»**, que abre un campo de texto con la dirección actual, y
  **«Volver a la del cliente»**, que deja la columna en null.
- La edición **solo vale para esa factura**. No cambia el perfil del cliente.
- Si el cliente cambia su predeterminada mientras la factura está en borrador, el bloque sin editar muestra
  la nueva. El bloque editado conserva lo que escribió el operador.
- **Cliente sin dirección de entrega:** depende de la pregunta P-6. La opción recomendada es que el
  borrador muestre `<Aviso tono="atencion">`, «Este cliente no tiene dirección de entrega», con el botón
  «Pedir» de la 0694 (§4.4 de esa spec), y que la factura se emita igual, sin el bloque.
- Las facturas que nacen ya emitidas (RPC 0128 y `exc0674_facturar`) no tienen borrador: se sellan con lo
  que tenga el cliente en ese momento.

### 5.3 Una factura con varios embarques que van a direcciones distintas

Sam dice que en la factura sale la predeterminada (decisión 5). **Propuesta, pendiente de la pregunta P-1:**

- el encabezado «Entregar en» lleva la predeterminada, como dijo Sam;
- **debajo de las líneas**, un bloque «Entregas por embarque» que lista **solo** los embarques que van a
  otra dirección. Se sella en `ship_to_by_shipment`. Si todos van a la predeterminada, el bloque no sale.

Ejemplo inventado: la factura F-2026-0999 de DTD-9001 cubre tres embarques; dos van a la predeterminada y
uno a otro almacén.

```text
Facturar a                          Entregar en
Comercial Ejemplo, C.A.             Av. Principal, Galpón 3
RIF: J-00000000-0                   Valencia, Carabobo
Calle 1, Torre A, piso 2
Caracas, Distrito Capital

Líneas
  DTDU-0001  Flete consolidado  …
  DTDU-0002  Flete consolidado  …
  DTDU-0003  Flete consolidado  …

Entregas por embarque
  DTDU-0003 → Calle 5, Depósito Norte, Maracay, Aragua
```

Las líneas sin `shipmentCode` (facturas hechas a mano, `invoice-types.ts:32-37`) no entran al bloque.

### 5.4 Facturas viejas sin sello

Una factura **emitida** con `addresses_sealed_at` en null es vieja (§4.2). Para ella:

- **«Facturar a»:** si tiene `client_fiscal_address` sellado (las de la identidad alterna), sale ese, como
  hoy. Si no, se muestra la dirección fiscal **actual** de la identidad sellada, con la etiqueta
  **«Dirección actual del cliente»**;
- **«Entregar en»:** la predeterminada **actual**, con la misma etiqueta;
- **«Entregas por embarque»:** no sale.

Sale igual en el PDF, en el comprobante HTML y en la pantalla del Studio. Un borrador nunca lleva esa
etiqueta, porque todavía no se ha sellado.

### 5.5 La anulación y la devolución parcial

- Anular no vuelve a sellar. Cobranzas (0467) devuelve de `parcial` a `emitida` al anular un recibo, y el
  trigger no vuelve a sellar (`0466:34-36`). Las direcciones siguen esa misma regla.
- No hay notas de crédito en el sistema (no hay facturación fiscal SENIAT). Si llegan, se diseñan aparte.

## 6. Pantallas

| Pantalla | Archivo de hoy | Cambio | Fase |
|---|---|---|---|
| **Mi perfil del portal: identidades** | `app/portal/(app)/perfil/BillingIdentityCard.tsx:57-59`, `perfil/empresa/BillingIdentityForm.tsx:100-114` | Cada identidad, también la principal, muestra «Dirección fiscal», con la casilla **«Igual a mi dirección de entrega»**. Marcada, muestra la predeterminada en solo lectura. Desmarcada, pide dirección, ciudad y estado. El campo de domicilio libre del formulario de empresa se convierte en este bloque | F-1 |
| **Mi perfil: direcciones de entrega** | `PortalAddresses.tsx` | Solo texto de ayuda: «La predeterminada es la que sale en tus facturas, y a donde llegan tus embarques si no eliges otra». Sin cambio de datos | F-1 |
| **Ficha del cliente en el Studio** | `app/studio/(app)/clientes/_components/ClientBillingCard.tsx:56-59` | Muestra la dirección fiscal de cada identidad, o «Igual a la dirección de entrega». Solo lectura, salvo lo que decida la pregunta P-5 | F-1 |
| **Borrador de la factura** | `InvoiceTitularPicker.tsx` y `facturacion/actions.ts:1115-1150` | Los dos bloques con vista previa, «Editar en esta factura» y «Volver a la del cliente» (§5.2). La acción manda `client_fiscal_address` y `ship_to_address`, con el mismo patrón `*_present` que usa `bill_to_kind` (`invoice-billing.ts:89-116`) | F-2 |
| **PDF de la factura** | `lib/studio/pdf/factura-pdf.tsx:379-394` | El bloque «Cliente» pasa a ser **«Facturar a»** (nombre, documento, dirección y Shipping Mark). Se agrega **«Entregar en»** al lado y, debajo de las líneas, «Entregas por embarque». Las facturas viejas llevan la etiqueta de §5.4 | F-2 |
| **Rutas del PDF** | `app/portal/(app)/facturas/[code]/pdf/route.ts:74`, `app/studio/(app)/facturacion/[code]/pdf/route.ts:57` | Dejan de llamar a `domicilioFiscalSellado` y llaman a un helper nuevo, `direccionesDeLaFactura(supabase, invoiceId)`, que devuelve las dos direcciones, las entregas por embarque y si la factura es vieja | F-2 |
| **Comprobante HTML del portal** | `app/portal/(app)/facturas/[code]/comprobante/page.tsx:226-233` | Los mismos dos bloques y la misma etiqueta, con el mismo helper. La 0694 F-2 deja este archivo leyendo `domicilioFiscalSellado`; la 0698 F-2 lo cambia por el helper nuevo (§9) | F-2 |
| **Detalle de la factura en el Studio** | `app/studio/(app)/facturacion/[code]/` | Los dos bloques en solo lectura cuando ya está emitida | F-2 |
| **Ficha del envío en el portal** | `app/portal/(app)/envios/[code]/page.tsx` | Tarjeta **«Entregar en»**: muestra a dónde va y deja elegir otra dirección o «Usar mi predeterminada». Después del corte (P-4), solo lectura con el texto del error | F-3 |
| **Embarques en el Studio** | `app/studio/(app)/embarques/_components/` (el drawer del embarque, a medir en F-3) | Campo «Entregar en», con las direcciones del cliente | F-3 |
| **Almacén VE y TMS** | `ve/actions.ts:103-112`, `ve/_components/VeRowActions.tsx:40`, `tms/_components/RouteDrawer.tsx:56-75` | Precargan `delivery_address` con la dirección elegida o con la predeterminada | F-3 |
| **Despacho y app del chofer** | `lib/studio/dispatch-mobile-queries.ts:161-200` | Después de la 0694 F-1 (que pasa este lector a la predeterminada), si el paquete pertenece a un embarque con dirección elegida, el chofer ve esa. El camino de la recepción a su embarque se mide en la F-3 | F-3 |

Toda pantalla nueva o con cambio visual sustancial pasa por `/ui-check` antes del commit. Se usan los
componentes `canonical` del Studio (`<Aviso>`, `DrawerShell`) y solo tokens `var(--*)`.

## 7. Fases

| Fase | Qué entra | Migración | Depende de |
|---|---|---|---|
| F-0 | Esta spec y las respuestas de Sam (§11) | No | — |
| **F-1** | `client_fiscal_addresses`, la copia desde `client_billing_identities.fiscal_address`, las RPC del portal, Mi perfil y la ficha del Studio | Sí: `NNNN_direccion_fiscal_por_identidad.sql` | El helper `direccionDeEntrega` de la 0694 F-1 en `main`, para mostrar la predeterminada cuando la casilla está marcada |
| **F-2** | El sello doble, el borrador, el PDF, el comprobante HTML y la pantalla del Studio | Sí: `NNNN_factura_sella_facturar_a_y_entregar_en.sql` (**migrate-first**: sin ella, el código nuevo no tiene columnas que leer; la lectura degrada como `invoice-client-doc.ts:64-68`) | F-1 en producción, la 0694 F-2 en `main` (comparten el comprobante), y la 0466 confirmada en producción por Dir_DTD |
| **F-3** | `shipments.delivery_address_id`, la RPC del portal, la ficha del envío, Embarques, Almacén VE, TMS, el despacho y «Entregas por embarque» | Sí: `NNNN_embarque_entregar_en.sql`, y en la misma migración, la redefinición del trigger para llenar `ship_to_by_shipment` | F-2 en producción y la 0694 F-1 en `main` (comparten `dispatch-mobile-queries.ts`) |
| F-4 | Retirar `client_billing_identities.fiscal_address` | Sí: `NNNN_retira_fiscal_address_de_identidad.sql` | F-1 a F-3 en producción, y un `git grep` sin lectores |

Hasta la F-3, `ship_to_by_shipment` queda en null: todavía no hay embarques con otra dirección.

Cada fase lleva su PR, su `pnpm verify` y sus contratos SQL (`supabase/tests/*.test.sql`), que el CI corre
en el job «Contratos SQL». Las migraciones las numera Dir_DTD y las aplica con el
[runbook de producción](../../runbooks/aplicar-migraciones-prod.md) y el OK nominal de Sam, **de a una**.
Fusionar una PR no autoriza aplicarla. **Ninguna fase corrige datos de producción.** La copia de la F-1 es
idempotente («no existe fila»), y su conteo previo va al acta, no a Git.

## 8. Aceptación verificable

Cada punto se comprueba con una prueba que corre y observa el resultado, no con una búsqueda de texto.

**F-1**

1. Un contrato SQL inserta una identidad alterna con `fiscal_address` y corre la copia dos veces: queda
   **una** fila con `same_as_delivery = false` y el mismo texto.
2. `portal_set_my_fiscal_address` con un `kind` que no es de ninguna identidad del cliente da error, y no
   escribe nada.
3. Con la casilla marcada y `line` lleno, la tabla rechaza la fila. Con la casilla desmarcada y `line`
   vacío, también.
4. Un usuario del portal no puede leer ni escribir la dirección fiscal de otro cliente, ni de otro tenant
   (RLS y RPC). Un rol `operations` del Studio no la lee.
5. Borrar la identidad alterna borra su fila de dirección fiscal.

**F-2**

6. Emitir una factura a la **principal**, con la casilla marcada, sella en `client_fiscal_address` la
   predeterminada formateada. Hoy queda null (`0466:320`).
7. Emitir con la casilla desmarcada sella `line`, ciudad y estado de la fila.
8. Emitir sella `ship_to_address` con la predeterminada y `ship_to_address_id` con su id.
9. Un borrador con `ship_to_address` editado se emite con ese texto, `ship_to_address_id` en null y un evento
   `invoice_address_overridden` cuyo payload no tiene la dirección.
10. Después de emitir, un UPDATE de cualquiera de las columnas de §4.2 falla con `invoice_titular_frozen`.
    Cambiar después la predeterminada del cliente no cambia la factura emitida.
11. `exc0674_facturar`, `exc0674_emitir_borradores` (0569) y la RPC 0128 emiten con el sello completo.
12. El PDF (render de prueba) y el comprobante HTML muestran los mismos dos bloques para la misma factura.
    Una factura emitida con `addresses_sealed_at` en null muestra «Dirección actual del cliente» en los
    dos.
13. La función SQL de formato y su equivalente en TypeScript dan el mismo texto para la misma tabla de
    casos, y ninguno incluye `reference`.

**F-3**

14. `portal_set_shipment_delivery_address` con una dirección de otro cliente da error. Con una dirección
    borrada, también.
15. Después del corte de la pregunta P-4, la RPC del portal da el error de campo y no escribe nada. El
    Studio sí puede cambiarla.
16. Una factura con tres embarques, uno con otra dirección, sella `ship_to_by_shipment` con ese solo
    embarque. Sin embarques distintos, queda null.
17. Después de `merge_clients`, el embarque sigue apuntando a la misma dirección, ya del cliente que
    sobrevive.
18. El chofer ve la dirección elegida del embarque cuando la hay, y la predeterminada cuando no.

Cada contrato nuevo se mata con un mutante antes de darlo por bueno (quitar la línea del sello, quitar la
columna del congelado, quitar el filtro de cliente de la RPC).

## 9. Relación con la SDD-0694 (#725) y la SDD-0695 (#728)

Las dos están abiertas, y las dos usan `client_delivery_addresses` como fuente única de la dirección de
entrega. Esta spec no reabre nada de lo que ya tiene dueña.

| Pieza | Dueña | Qué hace la 0698 |
|---|---|---|
| La fuente única de la dirección de entrega y el helper `direccionDeEntrega` («la predeterminada vigente; si no, la más reciente») | **0694** §4.1, F-1 | Lo usa para la casilla «igual a mi dirección de entrega» y para «Entregar en». El trigger de la F-2 replica la misma regla en SQL. Los dos se prueban con la misma tabla de casos |
| El comprobante HTML: misma fuente que el PDF | **0694** decisión 9, F-2 | Va después. Cambia `domicilioFiscalSellado` por el helper nuevo en los dos lectores a la vez |
| Sellar siempre «Facturar a», el bloque «Entregar en», la casilla y la etiqueta de las facturas viejas | **0698** (0694 §3, decisión 9, y §8) | Es esta spec |
| El lector del despacho pasa a la predeterminada | **0694** F-1 | La F-3 agrega encima la dirección elegida por embarque. No toca el archivo antes de que la 0694 F-1 esté en `main` |
| Precargar `shipments.delivery_address` | Ninguna (la 0694 §8 la dejó como «mejora aparte») | La toma la F-3 |
| `merge_clients` (dirección, ciudad, estado y Shipping Mark) | **0694** F-2 y **0695** F-6 | No la redefine. Solo comprueba en un contrato que `delivery_address_id` sobrevive |
| Una sola predeterminada por cliente (RPC atómica y triggers) | **0695** F-9 | No la repite. Mientras la F-9 no esté, el sello usa «la más reciente» si no hay predeterminada, como el helper de la 0694 |
| El registro de fuentes únicas y la guardia de CI | **0695** F-1 (§4.1 y §4.8) | Agrega dos filas: la dirección fiscal (`client_fiscal_addresses`) y la dirección del embarque (`shipments.delivery_address_id`). Agrega `client_billing_identities.fiscal_address` a la lista de lectores congelados hasta la F-4 |
| Las copias selladas de `invoices` | **0695** §2.1 («copias intencionales») | Las columnas nuevas de §4.2 son copias intencionales con la misma razón. Se suman a esa lista |
| El cliente final del aliado y su dirección | **0696** | Ver §12 |

## 10. `revisar-datos-ve` aplicado

Esto no es asesoría legal. Estados: `ENCONTRADO`, `CORRECTO` y `NO VERIFICABLE`.

**Inventario (paso 1):**

| Campo | Qué es | Finalidad | Quién más lo ve |
|---|---|---|---|
| `client_fiscal_addresses.line`, `city`, `state` (nuevo) | Dirección fiscal de cada identidad | Que la factura sirva al contador del cliente (SDD-0298) | El equipo de `accounting`, `admin` y `commercial` |
| `invoices.client_fiscal_address` (ya existe; ahora siempre lleno) | Copia sellada de «Facturar a» | El documento | Quien ve la factura: el cliente y los roles que ven montos (RLS 0414) |
| `invoices.ship_to_address` y `ship_to_by_shipment` (nuevos) | Copia sellada de «Entregar en» | El documento | Lo mismo |
| `shipments.delivery_address_id` (nuevo) | A cuál de sus direcciones va el embarque | La entrega | El equipo y el chofer |

**Los doce puntos:**

1. **Inventario.** `ENCONTRADO`: la dirección fiscal de la alterna vive en `client_billing_identities.fiscal_address`
   (`0466:162-165`). Con la F-1 se copia a una sola tabla, y la F-4 retira la vieja.
2. **Minimización.**
   - La factura **no** imprime `reference` (punto de referencia), que es para el chofer y puede nombrar a
     un tercero («casa de mi hermana»).
   - El sello copia el texto una sola vez por factura. No copia `label` ni `city_slug`.
   - La auditoría guarda ids y qué bloque se editó, nunca el texto.
3. **Consentimiento.** El cliente carga sus direcciones en su perfil para recibir mercancía y facturas. No
   hay un uso nuevo.
4. **Derechos.**
   - `CORRECTO`: el cliente ve, edita y borra sus direcciones de entrega en Mi perfil (`PortalAddresses.tsx:148-220`).
     Con la F-1, también la fiscal de cada identidad.
   - El cliente **no** puede cambiar una factura ya emitida. Es un comprobante, como explica
     `invoice-client-doc.ts:4-14`.
5. **Borrado.**
   - `NO VERIFICABLE`: qué pasa con la dirección sellada en facturas viejas si el cliente pide borrar sus
     datos. La factura es un documento contable y la política de conservación la tiene que fijar el
     abogado. **Esta spec no agrega ni quita plazos.**
   - Borrar una dirección de entrega no borra la copia sellada en las facturas emitidas, y eso es
     intencional.
6. **Trazabilidad.** Las ediciones del borrador y los cambios de entrega de un embarque dejan auditoría sin
   PII (§4.2 y §4.3).
7. **Política pública.** `NO VERIFICABLE`: si `app/privacidad/page.tsx` dice que la factura lleva las dos
   direcciones. Se revisa en la F-2. Si hay que cambiar un texto aprobado, va al DG antes.
8. **Terceros.** No hay ninguno nuevo. El PDF se genera en el servidor (`@react-pdf`) y no sale a un
   tercero. El correo que manda la factura ya existe (Resend).
9. **Transferencia internacional y China (PIPL).**
   - El equipo de Yiwu no necesita ninguna de las dos direcciones.
   - La tarjeta «Entregar en» del Studio y la de Embarques pasan por el ocultamiento de la región `cn`
     (`lib/studio/privacidad-cn.ts`). La F-3 lo prueba.
10. **Decisiones automatizadas.** El sello es una regla visible: el borrador muestra qué saldrá y deja
    editarlo. El corte de la pregunta P-4 se explica en el mismo error.
11. **Valor probatorio.** No aplica: la factura no se firma.
12. **Titulares que no son usuarios.** Una dirección de entrega puede ser la de otra persona. La factura la
    imprime solo si el cliente la eligió como predeterminada o para ese embarque, y no imprime la referencia.

La skill recomienda que otro modelo revise esta sección antes de la F-2.

## 11. Preguntas para Sam, una por una

**P-1. Si una factura junta varios embarques y uno va a otra dirección, ¿cómo lo mostramos?**

- ⭐ **Opción A (recomendada):** arriba, en «Entregar en», tu dirección predeterminada. Debajo de las
  líneas, un bloque «Entregas por embarque» con **solo** los embarques que van a otra dirección. Si todos
  van a la predeterminada, ese bloque no sale.
- Opción B: solo la predeterminada, sin detalle por embarque.
- Opción C: un bloque «Entregar en» por cada embarque, siempre.

**P-2. La casilla «igual a mi dirección de entrega», ¿sigue a la predeterminada o la copia una sola vez?**

- ⭐ **Opción A (recomendada): la sigue.** Si el cliente cambia su predeterminada, su dirección fiscal
  cambia para las facturas nuevas. Las emitidas no cambian.
- Opción B: la copia una vez, al marcar la casilla. Después hay que actualizarla a mano.

**P-3. ¿La casilla viene marcada por defecto?**

- ⭐ **Opción A (recomendada):** sí, marcada, para la persona principal y para las empresas que no tienen
  domicilio fiscal cargado. Las empresas que ya lo tienen lo conservan, con la casilla desmarcada.
- Opción B: desmarcada para todos. Mientras el cliente no cargue su dirección fiscal, «Facturar a» sale sin
  dirección.

**P-4. ¿Hasta cuándo puede el cliente cambiar a dónde llega un embarque?**

- ⭐ **Opción A (recomendada):** hasta que el embarque sale a reparto. Después, solo la oficina.
- Opción B: hasta que llega a Venezuela.
- Opción C: siempre, hasta que se entrega.

**P-5. ¿Quién edita la dirección fiscal desde el Studio?**

- ⭐ **Opción A (recomendada):** en el perfil la cambia solo el cliente, como hoy con su empresa. La
  oficina la corrige en el borrador de cada factura, y eso queda en la auditoría.
- Opción B: el asesor también la edita en la ficha del cliente.

**P-6. ¿Qué hacemos con la factura de un cliente sin dirección de entrega?**

- ⭐ **Opción A (recomendada):** se emite igual, sin el bloque «Entregar en». El borrador avisa y ofrece el
  botón «Pedir» de la 0694.
- Opción B: no deja emitir hasta que el cliente tenga una dirección.

## 12. Fuera de alcance

- **La factura a nombre del aliado** (SDD-0674 con aliado raíz, `0564:11-15`). La mercancía es del cliente
  final, pero la factura va al aliado. Esta spec sella «Entregar en» con la predeterminada **del cliente de
  la factura**, y «Entregas por embarque» solo con los embarques de ese mismo cliente. Si la factura del
  aliado tiene que mostrar las direcciones de sus clientes finales, eso lo define la **SDD-0696**.
  Dir_DTD lo coordina.
- Facturación fiscal SENIAT, notas de crédito y numeración fiscal: no existen en el sistema.
- Mover `clients.city` y `clients.state`, o `lat`/`lng` y la foto de fachada: siguen como los dejó la 0694.
- Geocodificar la dirección fiscal: no hace falta.
- Pedir la dirección fiscal en el registro: no entra. El registro solo pide la dirección rápida de entrega
  (0694 §4.7).

## 13. Archivos (allowlist provisional)

Se confirma al empezar cada fase, con un `git grep` de los lectores. Las migraciones las numera Dir_DTD.

- **F-0:** esta spec, `docs/specs/README.md` (índice) y `.agents/handoffs/2026-11-20-sdd-0698-factura-direcciones.md`.
- **F-1:**
  - `supabase/migrations/NNNN_direccion_fiscal_por_identidad.sql` y `supabase/tests/NNNN_direccion_fiscal_por_identidad.test.sql`;
  - `lib/portal/billing-identity.ts` y sus pruebas;
  - `app/portal/(app)/perfil/BillingIdentityCard.tsx`, `perfil/empresa/BillingIdentityForm.tsx`,
    `perfil/billing-actions.ts`, `perfil/PortalAddresses.tsx` (solo el texto) y `perfil/page.tsx`;
  - `lib/studio/invoice-billing.ts` (la opción de la principal deja de salir con `fiscalAddress: null`);
  - `app/studio/(app)/clientes/_components/ClientBillingCard.tsx` y `app/studio/(app)/clientes/[markbox]/page.tsx`;
  - `app/studio/(app)/facturacion/actions.ts` (la lectura de `:1115-1150`);
  - `supabase/migrations-baseline.json` y `supabase/pending-migration-symbol-declarations.json`, si la migración va como espera;
  - y sus pruebas.
- **F-2:**
  - `supabase/migrations/NNNN_factura_sella_facturar_a_y_entregar_en.sql` y su `.test.sql`;
  - `lib/studio/invoice-client-doc.ts` (el helper `direccionesDeLaFactura` y la función de formato);
  - `lib/studio/invoice-types.ts`, `lib/studio/invoice-queries.ts`;
  - `lib/studio/pdf/factura-pdf.tsx`;
  - `app/portal/(app)/facturas/[code]/pdf/route.ts`, `app/studio/(app)/facturacion/[code]/pdf/route.ts`;
  - `app/portal/(app)/facturas/[code]/comprobante/page.tsx` y `lib/portal/comprobante.ts`;
  - `app/studio/(app)/facturacion/_components/InvoiceTitularPicker.tsx` (o un componente hermano,
    `InvoiceAddressesBlock.tsx`), `app/studio/(app)/facturacion/actions.ts` y la página del detalle;
  - y sus pruebas, incluidas `lib/studio/__tests__/invoice-client-doc.test.ts`, `invoice-billing.test.ts`
    y `app/portal/(app)/facturas/[code]/comprobante/page.test.tsx`.
- **F-3:**
  - `supabase/migrations/NNNN_embarque_entregar_en.sql` y su `.test.sql`;
  - `app/portal/(app)/envios/[code]/page.tsx`, un componente nuevo en `envios/[code]/_components/` y una
    acción del portal;
  - `lib/studio/shipment-types.ts` y el drawer de `app/studio/(app)/embarques/_components/`;
  - `app/studio/(app)/ve/actions.ts`, `ve/_components/VeRowActions.tsx`, `ve/_components/AlmacenVeClient.tsx`;
  - `app/studio/(app)/tms/actions.ts`, `tms/_components/RouteDrawer.tsx`, `lib/studio/tms-queries.ts`;
  - `lib/studio/dispatch-mobile-queries.ts`, `lib/studio/dispatch-types.ts` (después de la 0694 F-1);
  - `lib/studio/privacidad-cn.ts`, si hace falta agregar las rutas nuevas;
  - y sus pruebas.
- **F-4:** `supabase/migrations/NNNN_retira_fiscal_address_de_identidad.sql`, su `.test.sql`, y el registro de
  fuentes únicas de la 0695.

## 14. Clasificación de gobernanza

| Política | Estado | Nota |
|---|---|---|
| AUD-01 y AUD-02 (tenant y auditoría) | Cumplimiento (propuesto) | El tenant sale de la sesión. Las RPC nuevas validan el cliente. La auditoría va sin PII |
| FRM-01 y ERR-01 (formularios y errores) | Cumplimiento (propuesto) | La casilla, «Editar en esta factura» y el error del corte son errores de campo, con texto escrito |
| BTN-01 (acciones) | Cumplimiento (propuesto) | «Volver a la del cliente» no destruye nada y no pide confirmación. Emitir sigue como hoy |
| CMP-01 (componentes) | Cumplimiento (propuesto) | Se usan `<Aviso>` y `DrawerShell` canonical. No hay componentes nuevos del sistema |
| Datos personales (`revisar-datos-ve`) | §10 | Tres `NO VERIFICABLE` que se revisan en la F-2 y la F-3 |
| `/ui-check` | Pendiente | En cada fase con pantalla |
