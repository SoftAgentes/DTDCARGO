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
> Las decisiones de Sam van citadas con su fecha (§3). Las seis preguntas de la §11 ya están contestadas
> (decisiones 6 a 11). Falta que Sam apruebe la spec completa.
>
> Los ejemplos son inventados. No hay datos, conteos ni montos de producción.

## 1. Pedido

En la revisión de la SDD-0694 (#725) se vio que la factura solo guarda una dirección cuando se emite a la
razón social alterna del cliente. En el caso normal, la factura a la persona principal, no guarda ninguna.

Sam pidió compararlo con QuickBooks y eligió ese modelo el 2026-11-20: **cada factura lleva dos
direcciones, «Facturar a» y «Entregar en», y las dos se sellan al emitir.** Esta spec diseña ese cambio:
el dato, las reglas, las pantallas y sus fases.

## 2. Medición en `main` (`af0f635ad`; lo que pidió la revisión, sobre `7ff097d12`)

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
- **La 0466 está aplicada en producción** desde el 2026-09-19. Lo dice el ledger
  (`0466_client_billing_identity`), según confirmó Dir_DTD el 2026-11-20. La cabecera «NO APLICADA A
  PRODUCCIÓN» (`0466:5-10`) es texto viejo. La migración no se corrige, porque está sellada. Este Worker
  no leyó producción.

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
spec agrega esa elección (§4.4, fase F-3).

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
  y, si hay aliado raíz, a nombre del aliado (`0564_exc0674_facturar_contenedor.sql:11-15`, `:50-58`). En
  ese caso, `client_markbox` es el del aliado y `shipment_id` es el primer embarque del cliente real
  (`0564:496-508`).
- La SDD-0690 (#719) agrega `exc0674_emitir_borradores` (0569). **Está aplicada en producción desde el
  2026-11-20** y quedó sellada en la #731 (`7ff097d12`). Emite la pre-orden con un UPDATE de `borrador` a
  `emitida` (`0569:288-296`), sin cambiar las líneas ni los montos. Su guarda `borrador_alterado` compara
  el código, el total, la base y el IVA (`0569:300-303`).

### 2.6 Despacho y app del chofer

- `hydrateClientFieldsOnPackages` lee `clients.address` y `address_reference` por Shipping Mark
  (`lib/studio/dispatch-mobile-queries.ts:161-163`) y los pasa a `client_address` y
  `client_address_reference` (`:199-200`).
- La SDD-0694, fase F-1, ya cambia este lector a la predeterminada de `client_delivery_addresses` (§9).
- Los paquetes del despacho son recepciones de almacén, no embarques. `dispatch_order_packages` las
  enlaza con `package_kind` y `package_id` (`0024_dispatch_core.sql:423-424`). **Medí el camino de cada
  tipo hasta su embarque:**

  | Tipo de paquete | ¿Llega a un embarque? | Evidencia |
  |---|---|---|
  | `warehouse_receipt_cn` | **Sí.** La recepción guarda `shipment_id` al consolidar | `0008_warehouses_cn.sql:74` |
  | `warehouse_receipt_ve` | **No.** Es una fila por contenedor que llega al hub, sin embarque ni cliente | `0067_warehouse_receipts_ve.sql:34-56`, `:58-59` |

  Por eso, en la F-3 el chofer ve la dirección elegida solo en los paquetes de China. En los de
  Venezuela sigue viendo la predeterminada del Shipping Mark del paquete (§4.4).

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

Las decisiones 6 a 11 son las respuestas de Sam a las preguntas P-1 a P-6 (§11). Las dio directamente a este
Worker el 2026-11-20, a pedido de Dir_DTD. Van literales.

6. **P-1, varios embarques con direcciones distintas:**

   > «Sí, la factura solo muestra la dirección predeterminada. Realmente, cuando hay una emisión de
   > embarque, adentro del embarque las instrucciones de embarque sí dan especificaciones. En la factura no
   > se requiere; solamente facturación global y listo. Lo que quiero hacer es que, en los embarques que
   > tengan diferentes direcciones, poner una letra o algo que avise que es otra dirección diferente a la
   > predeterminada, o un aviso pequeño en el ERP que diga: "Varias direcciones, cliente escogió varias
   > direcciones, revisar". La revisión es porque si hay una zona que está fuera del precio, podemos
   > refacturar. Eso después lo reanalizamos más adelante.»

   Cómo queda: la factura no trae detalle por embarque. El aviso va en el ERP, no en el papel (§5.3).
7. **P-2, la casilla sigue a la predeterminada:** «La sigue (Recomendado)».
8. **P-3, la casilla viene marcada:** «Marcada, salvo empresas con domicilio (Recomendado)».
9. **P-4, el corte para el cliente:** «Hasta llegar a Venezuela».
10. **P-5, quién edita la dirección fiscal en el Studio:** «Solo en el borrador (Recomendado)».
11. **P-6, cliente sin dirección de entrega:** «Emitir sin el bloque (Recomendado)».

## 4. Modelo de datos

Hay tres fases con migración (F-1 a F-3). Las migraciones van sin número: las numera Dir_DTD.

### 4.1 La dirección fiscal por identidad (F-1)

**Tabla nueva `client_fiscal_addresses`.** Hay una fila por identidad del cliente:

| Columna | Tipo | Regla |
|---|---|---|
| `id` | uuid | Llave primaria |
| `tenant_id` | uuid, not null | FK a `tenants`, `on delete cascade`. La sella un trigger desde el cliente, como en `0198` |
| `client_id` | uuid, not null | FK a `clients`, `on delete cascade` |
| `billing_identity_id` | uuid, null | FK a `client_billing_identities(id)`, `on delete cascade`. **Null = la persona principal.** Con valor, es la identidad alterna |
| `same_as_delivery` | boolean, not null | La casilla «Igual a mi dirección de entrega». Por defecto, `true` |
| `line` | text | Recortada, de 5 a 300 caracteres, como `0466:162-165` |
| `city`, `state` | text, null | Recortados, hasta 100 caracteres |
| `created_at`, `updated_at` | timestamptz | — |

- **La llave es la identidad, no el tipo** (revisión, punto 5).
  - Hay dos índices únicos: `(client_id) where billing_identity_id is null`, una fila para la principal, y
    `(billing_identity_id)`, una por alterna.
  - Un trigger valida que la alterna sea del mismo `client_id`.
  - Si la principal cambia de `doc_kind`, su fila sigue siendo de la principal. No hay forma de que pase a
    ser de la alterna.
  - Borrar la alterna borra su fila por la cascada. No hace falta cambiar `portal_delete_my_billing_identity`.
- **CHECK de forma:** `(same_as_delivery and line is null and city is null and state is null) or (not
  same_as_delivery and line is not null)`.
  - Ciudad y estado se pueden dejar en null en la tabla. Así cumplen la copia de abajo, que no los trae, y
    cualquier UPDATE posterior de esas filas (revisión, punto 4).
  - La RPC del portal los exige en las filas que escribe el cliente.
- **Sin fila, se entiende que la casilla está marcada** (decisión 8). Las empresas que ya tienen domicilio
  fiscal quedan desmarcadas por la copia.
- **La casilla sigue a la predeterminada** (decisión 7): no se copia ningún texto. Si el cliente cambia su
  predeterminada, la dirección fiscal cambia en las facturas nuevas. Las emitidas no cambian.
- **Por qué una tabla y no una columna en `clients`:**
  - la 0466 decidió no agregar columnas a `clients` (`0466:25`);
  - la SDD-0695 pide una fuente por dato;
  - con una sola tabla, las dos identidades se leen y se sellan igual.

**Seguridad (revisión, punto 3).** Sigue el patrón de `0466:179-188`:

- `enable row level security`;
- `revoke all on table public.client_fiscal_addresses from public, anon, authenticated, service_role`;
- `grant select` a `authenticated` y `grant select, insert, update, delete` a `service_role`;
- **ningún INSERT, UPDATE ni DELETE para `authenticated`.** El portal escribe solo por RPC, y el Studio no
  escribe (decisión 10);
- la política `client_fiscal_addresses_studio_select`, `for select to authenticated`, deja leer solo si
  `tenant_id = (select public.get_user_tenant_id())` y `(select public.current_studio_role()) in
  ('accounting', 'admin', 'commercial')`;
- **el portal no tiene política SELECT**: lee por RPC (§4.3);
- las funciones nuevas son `security definer`, con `search_path = ''` y `revoke all … from public, anon`.
  EXECUTE solo para `authenticated`, en las que el portal tiene que llamar. Los triggers no tienen
  EXECUTE para nadie.

**RPC del portal** (el cliente y el tenant salen de `get_portal_client_id()`, nunca de un parámetro):

- **`portal_set_my_fiscal_address(p_identity text, p_same_as_delivery boolean, p_line text, p_city text,
  p_state text)`**, que devuelve `table (outcome text)`, como las de la 0466:
  - `p_identity` es `principal` o `alterna`. Con `alterna`, toma la fila de `client_billing_identities`
    del cliente. Si no tiene, da error;
  - con la casilla desmarcada exige `line`, `city` y `state`. Con la casilla marcada, los ignora y los
    guarda en null;
  - **audita** con `append_audit_event`, igual que `0466:555-563`:
    - entidad `client`;
    - acción `client_fiscal_address_saved`, canal `rpc`;
    - payload `{identity, same_as_delivery, changed}`, sin el texto;
    - clave `'fiscal-address:' || client_id || ':' || gen_random_uuid()`, versión 1;
    - clasificación `sensitive`.
- **`portal_get_my_billing_profile()`** se redefine con la misma firma, para devolver además la dirección
  fiscal de cada identidad.
- **`portal_upsert_my_billing_identity(p_legal_name, p_doc, p_fiscal_address, p_set_default)`** se redefine
  con la misma firma (`0466:397-402`). El `p_fiscal_address` que recibe ya no va a la columna vieja, sino a
  la fila de la alterna en la tabla nueva, desmarcada. Así, aunque quede código desplegado que todavía usa
  ese parámetro, no se escribe en dos lugares.

**El paso de la F-1 a la F-2 (revisión, punto 2).** Desde la F-1 hay una sola fuente. En la misma
migración:

1. **copia** cada `client_billing_identities.fiscal_address` no vacío a la fila de su alterna, desmarcada y
   con `line` = el texto. Es idempotente: solo copia si no existe la fila. El conteo previo va al acta, no
   a Git;
2. **redefine `portal_upsert_my_billing_identity`** como se dijo arriba;
3. **redefine `invoices_seal_billing_titular` (versión 2, §4.5)** para que lea la dirección de la alterna en
   la tabla nueva.
   - El comportamiento es **el mismo de la 0466**: la alterna sella `line`, ciudad y estado solo si su fila
     está desmarcada, y si no, null. La principal sigue sellando null.
   - El sello completo es de la F-2.

Desde ahí, `client_billing_identities.fiscal_address` no tiene ni escritor ni lector: queda congelada. Su
retiro es una fase aparte (§12). Si la F-1 está aplicada y la F-2 no, las facturas salen como hoy, y lo
que edite el cliente ya va a la fuente nueva.

### 4.2 El sello doble en `invoices` (F-2)

**Columnas que se reutilizan:**

- `client_name`, `client_rif` y `client_doc_kind` siguen igual: son el nombre y el documento de «Facturar a».
- `client_fiscal_address` pasa a ser **la dirección de «Facturar a»**, para las dos identidades.

**Columnas nuevas:**

| Columna | Tipo | Qué guarda |
|---|---|---|
| `ship_to_address` | text, CHECK: null o recortada, de 5 a 400 caracteres | La dirección de «Entregar en», en texto: `line`, ciudad y estado |
| `ship_to_address_id` | uuid, sin FK | La fila de `client_delivery_addresses` de la que salió. Es solo rastro. La escribe solo el trigger |
| `addresses_sealed_at` | timestamptz | La hora del sello. **Es la marca que separa una factura nueva de una vieja.** La escribe solo el trigger |

`client_fiscal_address` no lleva un CHECK nuevo. Un CHECK, aun `NOT VALID`, se evalúa en cualquier UPDATE de
la fila, y las facturas viejas se siguen actualizando (pagos, `0466:40-43`). El largo y el recorte de una
edición los valida el trigger, solo cuando cambia ese valor en un borrador.

**El trigger `invoices_seal_billing_titular`, versión 3** (§4.5). Se redefine completo. Conserva lo de la
versión 2 y agrega lo siguiente:

1. **Congelado:** a la lista de `0466:265-269` se suman `ship_to_address`, `ship_to_address_id` y
   `addresses_sealed_at`.
2. **En el borrador:**
   - `client_fiscal_address` y `ship_to_address` solo los escribe el operador, cuando edita esa factura.
     **Null significa «sigue al cliente».** El trigger rechaza una edición que no venga recortada o que no
     tenga de 5 a 400 caracteres;
   - `ship_to_address_id` y `addresses_sealed_at` **los pone en null** el trigger, venga lo que venga.
3. **Al emitir**, en el mismo momento que hoy (`0466:275-280`):
   - **Siempre sobrescribe** `ship_to_address_id` y `addresses_sealed_at`, aunque el INSERT emitida (RPC
     0128) o el UPDATE los traigan llenos (revisión, punto 6). `ship_to_address_id` sale solo de la
     resolución del trigger, del mismo tenant.
   - **Sin cliente vivo** (`0466:290-293`): la versión 3 no regresa antes de sellar las direcciones.
     - `client_fiscal_address` y `ship_to_address` quedan como vienen: la edición del borrador o null;
     - `ship_to_address_id` queda en null y `addresses_sealed_at := now()`;
     - así, una factura nueva nunca se lee como vieja.
   - **«Facturar a»:**
     - el nombre y el documento se resuelven como hoy;
     - si el borrador trae `client_fiscal_address`, se queda esa;
     - si no, toma la fila de la identidad elegida: marcada o sin fila, la predeterminada de entrega;
       desmarcada, `line`, ciudad y estado;
     - **cambio de comportamiento:** en el caso de la principal, `0466:320` hoy pone null y ahora sella la
       dirección.
   - **«Entregar en»:**
     - **guarda del aliado (revisión, punto 7, y segunda vuelta, C):** si **alguno** de los embarques de
       la factura tiene un `client_markbox` distinto del de la factura, `ship_to_address` y
       `ship_to_address_id` quedan en null, aunque el borrador traiga una edición.
       - «Los embarques de la factura» son `new.shipment_id` más los embarques del mismo tenant, vivos,
         cuyo código aparece en `lines[].shipmentCode`. Es la misma lectura de las líneas que ya hace la
         0551 (`0551:306-322`). Las líneas de la 0564 traen ese código (`0564:489`).
       - No basta con `new.shipment_id`. La 0564 guarda ahí solo el primer embarque (`0564:497-499`), y si
         ese primero es del propio aliado, coincidiría con la factura.
       - La regla vive en una función interna, `invoice_ships_to_others(p_invoice invoices) returns
         boolean`, sin EXECUTE para nadie. La usan el trigger y la rama de las facturas viejas de
         `invoice_addresses` (§4.3).
       - **Bordes (tercera vuelta, 2):**
         - el tenant es siempre el de la factura (`p_invoice.tenant_id`), nunca el de la sesión. Como
           `shipments` es único por `(tenant_id, code)` (`0002_shipments.sql:51`), un código de otro tenant
           no coincide;
         - si `lines` no es un arreglo, se lee como vacío, igual que `0551:310-320`;
         - una línea con `shipmentCode` que no tiene embarque vivo en el tenant **cuenta como de otro
           cliente**: la guarda actúa y «Entregar en» queda en null. Si no se puede saber de quién es la
           mercancía, es más seguro no sellar una dirección. Las líneas sin código (las facturas hechas a
           mano) no cuentan;
         - en las facturas viejas, la guarda actúa además si la fila de `exc0674_facturas` de esa factura
           tiene un `client_markbox` distinto de su `billed_markbox` (`0564:190`, `:193`). Esa fila se
           escribe después de la factura, así que al emitir no sirve, pero en las viejas es el respaldo.
       - Es el caso de la factura de contenedor al aliado raíz (`0564:496-508`) y de sus pre-órdenes (0569).
         Esas facturas salen sin el bloque «Entregar en» hasta que la **SDD-0696** defina qué mostrar (§5.6
         y §12);
     - si no aplica la guarda y el borrador trae `ship_to_address`, se queda esa, con `ship_to_address_id`
       en null;
     - si no, la **predeterminada vigente** del cliente de la factura (decisión 5);
     - si no hay predeterminada pero sí filas vigentes, la más reciente, con la misma regla que el helper
       `direccionDeEntrega` de la 0694 (§4.1 de esa spec);
     - sin filas vigentes, queda en null, y la factura sale sin el bloque (decisión 11).
   - **Por embarque no se sella nada** (decisión 6). El aviso de varias direcciones es del ERP (§5.3).
   - `addresses_sealed_at := now()`.
   - **Auditoría:** si el borrador editó alguna de las dos direcciones, registra `invoice_address_overridden`
     con `append_audit_event`, igual que `0466:323-345`:
     - payload `{bill_to_edited, ship_to_edited}`, sin el texto;
     - clave `'invoice-address:' || new.id`. Es distinta de la clave `'invoice-bill-to:' || new.id` del
       evento de la 0466 (`0466:341`);
     - versión 1, clasificación `internal`.
4. **Una sola resolución.** La regla de «Facturar a» y «Entregar en» vive en una función interna,
   `invoice_resolve_addresses(p_invoice invoices)`, sin EXECUTE para nadie. La usan el trigger y la RPC de
   lectura (§4.3), así que el borrador muestra exactamente lo que se va a sellar.
5. **El formato del texto** sale de una función SQL, `invoice_format_address(line, city, state)`,
   `immutable` y con `search_path = ''`. **No incluye `reference`** (§10, punto 2). **No tiene copia en
   TypeScript** (cuarta vuelta, 2): el borrador, el PDF, el comprobante y la pantalla del Studio reciben el
   texto ya armado de `invoice_addresses` (§4.3).
6. **Las vías de emisión que ya cubre el trigger** siguen igual:
   - la RPC 0128 y la acción del Studio;
   - `exc0674_facturar` (0564), que inserta en `emitida`;
   - `exc0674_emitir_borradores` (0569), que pasa la pre-orden de `borrador` a `emitida`.

   No hay que cambiar ninguna. La guarda `borrador_alterado` de la 0569 compara el código, el total, la base
   y el IVA que devuelve el `UPDATE … returning` (`0569:300-303`). Ese `returning` no trae direcciones, así
   que el sello no la dispara. El contrato 15 lo prueba.

**Sin backfill.** Las facturas ya emitidas quedan con `addresses_sealed_at` en null. Son las «viejas sin
sello» de la decisión 4 (§5.4).

### 4.3 La lectura de las direcciones (F-2)

**Hay una sola función para leer, en el portal y en el Studio** (revisión, punto 1). El PDF y el
comprobante del portal corren con la sesión del cliente (`app/portal/(app)/facturas/[code]/pdf/route.ts:51-74`)
y no pueden leer `client_fiscal_addresses`, que no tiene política SELECT para el portal.

- **`invoice_addresses(p_invoice_id uuid) returns jsonb`**, que devuelve `{ "bill_to": text|null, "ship_to":
  text|null, "legacy": boolean }`.
  - Es `security definer`, con `search_path = ''`, y EXECUTE solo para `authenticated`.
  - **Autoriza con el predicado completo de las políticas de lectura de la 0414, copiado tal cual**
    (segunda vuelta, B). No basta con `get_portal_client_id()`: solo devuelve el `client_id` de un vínculo
    activo, sin el tenant ni el cliente vivo (`0080_portal_cliente.sql`, la definición de esa función).
    - **Portal**, como «invoices portal self read» (`0414:62-80`):
      - la factura tiene `deleted_at is null`, `status <> 'borrador'` y `client_markbox` no nulo;
      - existe un `client_users` con `auth_user_id = auth.uid()` y `status = 'active'`, del mismo tenant
        de la factura;
      - su cliente está vivo (`deleted_at is null`), es de ese tenant y su `markbox` es el
        `client_markbox` de la factura.
    - **Studio**, como `invoices_accounting_select` (`0414:52-56`): `tenant_id = get_user_tenant_id()` y
      rol `accounting` o `admin`.
    - En cualquier otro caso devuelve null, sin un error que distinga «no existe» de «no es tuya».
    - **Un contrato de equivalencia lo amarra a la 0414.** Para una matriz de roles y facturas,
      `invoice_addresses` devuelve algo si y solo si un `select` de `invoices` con el mismo rol ve esa fila.
      Si alguien cambia la política, el contrato se pone rojo.
  - **Borrador:** lo que saldría al emitir, con `invoice_resolve_addresses`.
  - **Emitida con sello:** lo sellado.
  - **Emitida sin sello (vieja):**
    - «Facturar a» sellado, si lo tiene; si no, el actual de la identidad sellada;
    - «Entregar en», el actual, **salvo que `invoice_ships_to_others` diga que sí** (segunda vuelta, D). En
      ese caso es null. Así, una factura de contenedor al aliado ya emitida tampoco muestra la dirección
      del aliado;
    - `legacy = true`.
- **`direccionesDeLaFactura(supabase, invoiceId)`**, en `lib/studio/invoice-client-doc.ts`, es un envoltorio
  fino de esa RPC. Reemplaza a `domicilioFiscalSellado` en los dos PDF, el comprobante y la pantalla del
  Studio.

### 4.4 «Entregar en» por embarque (F-3)

**Columna nueva `shipments.delivery_address_id`**: uuid, nullable, FK a `client_delivery_addresses(id)`
`on delete set null`.

- **Null = la predeterminada.** Es el caso normal: «Aunque no use esa opción, queda su dirección principal
  como predeterminada» (decisión 5).
- **Integridad (revisión, punto 8):**
  - un **constraint trigger diferido**, `shipments_delivery_address_same_client` (`deferrable initially
    deferred`, `after insert or update of delivery_address_id, client_markbox, tenant_id`), revisa al
    confirmar que, si `delivery_address_id` tiene valor, la dirección sea del mismo tenant y del cliente vivo
    que tiene hoy el Shipping Mark del embarque. Cuando cambia `delivery_address_id`, exige además que la
    dirección esté vigente;
  - es **`security definer` con `search_path = ''`** (segunda vuelta, F): lee `clients` y
    `client_delivery_addresses` fuera de la RLS de quien escribe, como el chequeo diferido de la 0695
    (§4.10). Solo devuelve el error, sin datos;
  - **no revisa los embarques entregados** (`status = 'delivered'`). Su `delivery_address_id` es el
    histórico de una entrega que ya ocurrió (segunda vuelta, A);
  - es diferido porque `rename_client_markbox` (0371) cambia el código del cliente, del embarque y de las
    direcciones en la misma transacción. Al confirmar, los tres ya coinciden;
  - **`reassign_shipment_client`** (`0551:203`) se redefine con la misma firma. Al cambiar el
    `client_markbox` del embarque (`0551:396-398`):
    - **si el embarque no está entregado**, pone `delivery_address_id := null` y lo anota en su auditoría.
      Sin eso, el trigger diferido rechazaría la reasignación;
    - **si ya está entregado, lo conserva** (segunda vuelta, A): es el histórico de la entrega. Así no
      choca con el congelado de la 0321, que lo protege después de `delivered`, y el trigger diferido no
      lo revisa;
    - en las pre-órdenes que mueve al cliente nuevo, además de lo que ya limpia (`0551:410-413`), pone
      `ship_to_address := null` (segunda vuelta, E): era una edición del operador hecha para el cliente
      viejo.
- **Congelado (revisión, punto 8):** `guard_ve_delivery_completion()` (`0321:46`, condición en `:66-73`) se
  redefine para sumar `delivery_address_id` a lo que no cambia después de `delivered`.
- **Regla única de resolución (tercera vuelta, 1).** Una sola función SQL,
  `shipment_chosen_delivery_address(p_shipment shipments)`, interna y sin EXECUTE para nadie, devuelve la
  dirección elegida **solo si se cumplen las tres condiciones**:
  - la fila de `delivery_address_id` existe y está vigente (`deleted_at is null`);
  - su `client_id` es el del cliente vivo que hoy tiene el Shipping Mark del embarque, en su tenant (la
    misma condición del trigger diferido);
  - el tenant de la dirección es el del embarque.

  Si falta alguna, devuelve null, y el embarque **cuenta como sin elección**: va a la predeterminada del
  cliente actual.
  - **No tiene espejo en TypeScript** (cuarta vuelta, 2). Es la única fuente, y la leen dos RPC:
    - **`portal_get_shipment_delivery_address(p_shipment_code text)`**, para la tarjeta «Entregar en» del
      portal:
      - es `security definer`, con `search_path = ''`, y EXECUTE solo para `authenticated`;
      - **autoriza con el predicado completo de la política «shipments portal self read»** (`0416:40-53`),
        copiado tal cual (cuarta vuelta, 1). El embarque tiene `deleted_at is null` y `client_markbox` no
        nulo. Además, existe un `client_users` con `auth_user_id = auth.uid()` y `status = 'active'` del
        mismo tenant del embarque, cuyo cliente está vivo, es de ese tenant y tiene el `markbox` del
        embarque;
      - no usa `get_portal_client_id()`, que solo devuelve el `client_id` de un vínculo activo, sin tenant
        ni cliente vivo;
      - **devuelve solo lo que muestra la tarjeta**: `{ "address": text|null, "is_default": boolean,
        "options": [{ "id", "label", "address" }], "locked": boolean }`. `address` y las opciones salen de
        `invoice_format_address`, sin `reference`. `options` son las direcciones vigentes del propio
        cliente, y `locked` dice si el embarque ya llegó a Venezuela;
      - en cualquier otro caso devuelve null, sin distinguir «no existe» de «no es tuyo»;
    - **`studio_get_shipment_delivery(p_shipment_ids uuid[])`**, para el Studio:
      - es `security definer`, con `search_path = ''`, y EXECUTE solo para `authenticated`;
      - autoriza con el predicado de la política «shipments by tenant» (`0012:228-231`): `tenant_id =
        get_user_tenant_id()` y `deleted_at is null`;
      - acepta hasta 500 ids por llamada y devuelve, por embarque, `{ shipment_id, address, other_address }`.
        `other_address` es verdadero si la regla devuelve una dirección y no es la predeterminada actual;
      - la usan la marca «Otra dirección» y el drawer de Embarques (`lib/studio/shipment-queries.ts`), el
        aviso «Varias direcciones» de Facturación (`lib/studio/invoice-queries.ts`), la precarga del Almacén
        VE y del TMS, y el chofer (`lib/studio/dispatch-mobile-queries.ts`).
  - **Contratos de equivalencia** (cuarta vuelta, 1). Para una matriz de roles y embarques:
    - `portal_get_shipment_delivery_address` devuelve algo si y solo si un `select id from shipments` con
      el mismo rol del portal ve esa fila;
    - `studio_get_shipment_delivery` devuelve una fila si y solo si el mismo `select` con el rol del Studio
      la ve.

    Si alguien cambia una de esas políticas, el contrato se pone rojo.
  - **Nadie lee `delivery_address_id` directo, y la base lo impide** (cuarta vuelta, 3):
    - la F-3 quita el `select` de tabla de `authenticated` (`0002_shipments.sql:83`) y lo vuelve a dar por
      columnas, a todas menos `delivery_address_id`. `insert`, `update` y `delete` siguen a nivel de tabla.
      Un `revoke select (columna)` solo no basta, porque el permiso de tabla cubre todas las columnas;
    - un `select delivery_address_id` como `authenticated` falla con 42501, y lo prueba un contrato;
    - **trampa nueva**: desde ahí, una columna que se agregue a `shipments` no la ve `authenticated` hasta
      que su migración le dé el `grant select` de esa columna. Un contrato compara las columnas de la
      tabla con las que tiene `authenticated` y falla si falta alguna que no sea `delivery_address_id`;
    - **lectores medidos que se romperían** (`git grep` en `app/` y `lib/` sobre `7ff097d12`):
      - `app/api/studio/shipments/[id]/route.ts:140-145` hace `.update(...).select()`, que pide todas las
        columnas. La F-3 lo pasa a una lista explícita de columnas;
      - no hay ningún `.from("shipments").select("*")` fuera de las pruebas. La única prueba que lo usa
        (`lib/studio/notifications/__tests__/avisos-bodega-confiables.test.ts:158`) corre contra un doble en
        memoria, sin permisos;
      - las funciones SQL que hacen `select s.*` sobre `shipments` son todas `security definer` (0321, 0336,
        0477, 0484, 0486, 0487 y 0563), así que corren como su dueño y no las toca;
      - la única vista `security_invoker` que se cruza (`exc0674_envios_cubiertos`, `0564:271-277`) no lee
        `shipments`;
      - la F-3 repite este `git grep` antes de aplicar, porque puede entrar código nuevo.
  - **El id histórico se conserva**, pero ningún lector se lo muestra al cliente nuevo. Por ejemplo,
    después de reasignar un embarque entregado (abajo), ni el portal del cliente nuevo ni el Studio
    muestran la dirección del anterior, y no salen ni la marca ni el aviso.
  - Si la dirección elegida se borra después (borrado lógico), la regla la ignora y vuelve a la
    predeterminada. La columna no se limpia sola.
- **Límite conocido (tercera vuelta, 3).** La FK `on delete set null` choca con el congelado de la 0321
  solo en un **borrado permanente**: borrar de verdad una dirección, o un cliente por la cascada, que use un
  embarque ya entregado. Ese UPDATE lo rechaza la guarda (42501).
  - El código de hoy borra las direcciones de forma lógica (`lib/studio/client-address-queries.ts:161-171`),
    así que no lo toca.
  - Hoy la guarda de la 0321 no tiene ninguna excepción para cambiar un embarque entregado. Sus ajustes de
    sesión (`0321:52-64`) sirven para confirmar la entrega, no para cambiarla después.
  - Por eso, **el borrado permanente de una dirección que usa un embarque entregado queda bloqueado**.
    Ese borrado lo corre Sam aparte. Si alguna vez hace falta, se diseña una excepción gobernada en la
    0321, con su OK. Esta spec no la crea.
- **Quién la cambia:**
  - **el cliente, en el portal**, con `portal_set_shipment_delivery_address(p_shipment_code text,
    p_address_id uuid)`:
    - es `security definer`, con `search_path = ''`, y EXECUTE solo para `authenticated`;
    - busca el embarque por el **código** con el mismo predicado completo de «shipments portal self read»
      (`0416:40-53`) que la RPC de lectura (cuarta vuelta, 1): tenant, vínculo activo, cliente vivo y
      Shipping Mark. El Shipping Mark solo es único dentro del tenant, y no usa `get_portal_client_id()`;
    - null vuelve a la predeterminada;
    - funciona **hasta que el embarque llega a Venezuela** (decisión 9), medido con
      `shipments.arrived_destination_at` no nulo (`lib/studio/warehouse-ve-queries.ts:27`). La F-3 confirma
      que esa columna y el estado de llegada dicen lo mismo. Después responde con un error de campo: «Este
      embarque ya llegó a Venezuela. Escríbenos para cambiar la entrega»;
  - **el equipo, en el Studio**, con `studio_set_shipment_delivery_address(p_shipment_id uuid, p_address_id
    uuid)`, `security invoker`: la RLS de `shipments` decide quién escribe, sin corte de fecha y hasta la
    entrega;
  - las dos auditan `shipment_delivery_address_changed`:
    - payload `{address_id, origen: "portal" | "studio"}`, sin el texto;
    - clave `'shipment-delivery:' || shipment_id || ':' || gen_random_uuid()`, versión 1;
    - clasificación `internal`.
- **`shipments.delivery_address` (el texto de la 0009) se queda.** Es la dirección operativa del envío y la
  sigue escribiendo el equipo. Lo nuevo:
  - el Almacén VE (`ve/actions.ts:103-112`) y el TMS (`tms/actions.ts:236-239`) **precargan** ese campo con
    la dirección elegida o, si no hay, con la predeterminada. El operador la puede cambiar;
  - el congelado de `0321:66-73` sigue cubriendo ese texto.

  La 0694 dejó esta precarga como «mejora aparte» (su §8). Aquí la toma la F-3.
- **El chofer:** en los paquetes `warehouse_receipt_cn`, la dirección elegida del embarque de la recepción
  (`0008:74`). En los `warehouse_receipt_ve`, que no tienen embarque (§2.6), la predeterminada, como lo deja
  la 0694 F-1.
- **`merge_clients`** mueve las filas de `client_delivery_addresses` al cliente que sobrevive, sin
  cambiarles el id (`0361:137-149`). Por eso `delivery_address_id` sigue apuntando bien después de una
  fusión. La 0698 no redefine esa función. El contrato 23 lo prueba (§9 explica el orden).

### 4.5 Las funciones que redefine esta spec (revisión, punto 9)

Cada redefinición es un `create or replace` completo, con la misma firma.

- **Preflight:** la migración revisa que el cuerpo vigente sea la versión esperada, comparando el md5 de
  `prosrc` (como `0453:176-178`). Si no lo es, aborta.
- **Contrato:** en la misma PR corre el contrato de la versión anterior, que tiene que seguir verde en todo
  lo que no cambia.
- **Desarme:** cada fase trae su desarme en `supabase/desarmes/`, sin número y fuera de `supabase/migrations/`,
  como `0569_desarme.sql`. Aplicarlo exige el OK nominal de Sam.

| Función | Hoy | La redefine | Contrato que sigue verde | Lo que repone el desarme |
|---|---|---|---|---|
| `invoices_seal_billing_titular` | 0466 (v1) | **F-1 (v2):** lee la tabla nueva, con el mismo comportamiento. **F-2 (v3):** sello doble | F-1: `0466_client_billing_identity.test.sql`. F-2: el contrato de la F-1 | F-1: la v1. F-2: la v2 |
| `portal_upsert_my_billing_identity` | 0466 | F-1 | `0466_client_billing_identity.test.sql` | La de la 0466 (ver abajo) |
| `portal_get_my_billing_profile` | 0466 | F-1 | Ídem | La de la 0466 |
| `reassign_shipment_client` | 0551 | F-3 | `0551_pasar_embarque_a_otro_cliente.test.sql` | La de la 0551 |
| `guard_ve_delivery_completion` | 0321 | F-3 | `0321_warehouse_ve_delivery_governance.test.sql` | La de la 0321 |

- **El desarme de la F-1:**
  - antes de reponer la 0466, vuelve a copiar a `client_billing_identities.fiscal_address` el texto de las
    filas desmarcadas de las alternas;
  - **se niega** si hay filas de la principal desmarcadas: son datos que cargó el cliente y que no tienen a
    dónde volver;
  - los desarmes de la F-2 y de la F-3 se niegan si ya hay facturas selladas o embarques con dirección
    elegida, salvo el OK nominal de Sam.
- **Ninguna de las specs abiertas que se cruzan con esta redefine estas cinco funciones.** Busqué los cinco
  nombres en la 0694 (#725) y la 0695 (#728), y no aparece ninguno. Si otra spec las necesita, parte de la
  versión vigente y la suma a esta tabla.

## 5. Reglas

### 5.1 Qué se sella y cuándo

| Dato | Se sella | Desde dónde |
|---|---|---|
| Nombre y documento de «Facturar a» | Al emitir (como hoy) | La identidad elegida (`bill_to_kind` o la preferencia) |
| Dirección de «Facturar a» | Al emitir | La edición del borrador o, si no hay, la fila de esa identidad (§4.1) |
| «Entregar en» | Al emitir | La edición del borrador o, si no hay, la predeterminada vigente del cliente de la factura. Nada en la factura al aliado (§5.6) |

**Si después el cliente cambia su dirección, solo cambian las facturas nuevas** (decisión 1). Lo garantiza
el congelado del trigger, no la pantalla.

### 5.2 El borrador

- Muestra los dos bloques, «Facturar a» y «Entregar en», con lo que **saldría si se emitiera ahora**, leído
  de `invoice_addresses` (§4.3). Es la misma idea que la vista previa de hoy, «Así sale en la factura»
  (`InvoiceTitularPicker.tsx:140`).
- Cada bloque tiene **«Editar en esta factura»**, que abre un campo de texto con la dirección actual, y
  **«Volver a la del cliente»**, que deja la columna en null.
- La edición **solo vale para esa factura**. No cambia el perfil del cliente.
- Si el cliente cambia su predeterminada mientras la factura está en borrador, el bloque sin editar muestra
  la nueva. El bloque editado conserva lo que escribió el operador.
- **Cliente sin dirección de entrega** (decisión 11): el borrador muestra `<Aviso tono="atencion">`, «Este
  cliente no tiene dirección de entrega», con el botón «Pedir» de la 0694 (§4.4 de esa spec). La factura se
  emite igual, sin el bloque «Entregar en».
- Las facturas que nacen ya emitidas (RPC 0128 y `exc0674_facturar`) no tienen borrador: se sellan con lo
  que tenga el cliente en ese momento.

### 5.3 Una factura con varios embarques que van a direcciones distintas

**La factura solo muestra la predeterminada** (decisiones 5 y 6). No lleva detalle por embarque: la
entrega de cada embarque la dicen sus instrucciones de embarque, y la factura es «facturación global».

**El aviso va en el ERP, no en el papel** (decisión 6). Se calcula en vivo y no se sella:

- **En Embarques del Studio**, el embarque cuya dirección elegida (`delivery_address_id`) no es la
  predeterminada actual del cliente lleva una marca corta, **«Otra dirección»**. Es texto, no solo color.
  El drawer del embarque muestra cuál es la dirección.
- **En Facturación del Studio**, el borrador y el detalle de una factura muestran `<Aviso tono="atencion">`
  si alguno de sus embarques tiene otra dirección: **«Varias direcciones: el cliente escogió varias
  direcciones de entrega. Revisar.»** El aviso lista los códigos de esos embarques. Para eso se leen
  `shipment_id` y los `shipmentCode` de las líneas (`invoice-types.ts:32-38`). Las líneas sin código
  (facturas hechas a mano) no cuentan.
- **No sale en el PDF, ni en el comprobante del portal, ni en la ficha del envío del cliente.**
- Para qué sirve: si una dirección está en una zona fuera del precio, la oficina puede refacturar. **Ese
  análisis de zonas y precio se hará más adelante** (§12).

Ejemplo inventado: la factura F-2026-0999 de DTD-9001 cubre tres embarques; dos van a la predeterminada y
uno a otro almacén.

```text
PDF y comprobante                   Studio (borrador o detalle)
Facturar a                          ⚠ Varias direcciones: el cliente escogió
Comercial Ejemplo, C.A.               varias direcciones de entrega. Revisar.
RIF: J-00000000-0                     DTDU-0003
Calle 1, Torre A, piso 2
Caracas, Distrito Capital           Embarques
                                      DTDU-0001
Entregar en                           DTDU-0002
Av. Principal, Galpón 3               DTDU-0003  Otra dirección
Valencia, Carabobo
```

### 5.4 Facturas viejas sin sello

Una factura **emitida** con `addresses_sealed_at` en null es vieja (§4.2). Para ella, `invoice_addresses`
devuelve `legacy = true` (§4.3), y:

- **«Facturar a»:** si tiene `client_fiscal_address` sellado (las de la identidad alterna), sale ese, como
  hoy. Si no, se muestra la dirección fiscal **actual** de la identidad sellada, con la etiqueta
  **«Dirección actual del cliente»**;
- **«Entregar en»:** la predeterminada **actual**, con la misma etiqueta.

Sale igual en el PDF, en el comprobante HTML y en la pantalla del Studio, porque los tres leen la misma
RPC. Un borrador nunca lleva esa etiqueta, porque todavía no se ha sellado.

### 5.5 La anulación y la devolución parcial

- Anular no vuelve a sellar. Cobranzas (0467) devuelve de `parcial` a `emitida` al anular un recibo, y el
  trigger no vuelve a sellar (`0466:34-36`). Las direcciones siguen esa misma regla.
- No hay notas de crédito en el sistema (no hay facturación fiscal SENIAT). Si llegan, se diseñan aparte.

### 5.6 La factura de contenedor al aliado raíz

Las facturas de las 0564 y 0569 con aliado raíz van a nombre del aliado, pero la mercancía es del cliente
final (`0564:496-508`). La guarda de §4.2 deja «Entregar en» vacío en esas facturas, y la rama de las
facturas viejas de `invoice_addresses` aplica la misma guarda (§4.3). Mira todos los embarques de la
factura, no solo el primero. Nunca lleva la dirección del aliado. «Facturar a» sí se sella, con la
identidad del aliado, como hoy.

Lo que se muestre en su lugar (la dirección de cada cliente final, o nada) lo define la **SDD-0696**, que
es una dependencia de esta spec (§9 y §12). La 0696 ya cita la 0698 de vuelta (#729).

## 6. Pantallas

| Pantalla | Archivo de hoy | Cambio | Fase |
|---|---|---|---|
| **Mi perfil del portal: identidades** | `app/portal/(app)/perfil/BillingIdentityCard.tsx:57-59`, `perfil/empresa/BillingIdentityForm.tsx:100-114` | Cada identidad, también la principal, muestra «Dirección fiscal», con la casilla **«Igual a mi dirección de entrega»**. Marcada, muestra la predeterminada en solo lectura. Desmarcada, pide dirección, ciudad y estado. El campo de domicilio libre del formulario de empresa se convierte en este bloque | F-1 |
| **Mi perfil: direcciones de entrega** | `PortalAddresses.tsx` | Solo texto de ayuda: «La predeterminada es la que sale en tus facturas, y a donde llegan tus embarques si no eliges otra». Sin cambio de datos | F-1 |
| **Ficha del cliente en el Studio** | `app/studio/(app)/clientes/_components/ClientBillingCard.tsx:56-59` | Muestra la dirección fiscal de cada identidad, o «Igual a la dirección de entrega». Solo lectura: el Studio no edita la dirección fiscal del perfil (decisión 10) | F-1 |
| **Borrador de la factura** | `facturacion/_components/InvoiceDrawer.tsx`, `InvoiceTitularPicker.tsx` y `facturacion/actions.ts:1115-1150` | Un componente nuevo, `InvoiceAddressesBlock.tsx`, con los dos bloques, la vista previa, «Editar en esta factura» y «Volver a la del cliente» (§5.2). La acción manda `client_fiscal_address` y `ship_to_address`, con el patrón `*_present` de `bill_to_kind` (`invoice-billing.ts:89-116`) | F-2 |
| **PDF de la factura** | `lib/studio/pdf/factura-pdf.tsx:379-394` | El bloque «Cliente» pasa a ser **«Facturar a»** (nombre, documento, dirección y Shipping Mark). Se agrega **«Entregar en»** al lado, con la predeterminada. Sin detalle por embarque (decisión 6). Si no hay dirección, el bloque no sale (decisión 11). Las facturas viejas llevan la etiqueta de §5.4 | F-2 |
| **Rutas del PDF** | `app/portal/(app)/facturas/[code]/pdf/route.ts:74`, `app/studio/(app)/facturacion/[code]/pdf/route.ts:57` | Dejan de llamar a `domicilioFiscalSellado` y llaman a `direccionesDeLaFactura`, el envoltorio de `invoice_addresses` (§4.3) | F-2 |
| **Comprobante HTML del portal** | `app/portal/(app)/facturas/[code]/comprobante/page.tsx:226-233` | Los mismos dos bloques y la misma etiqueta, con el mismo helper. La 0694 F-2 deja este archivo leyendo `domicilioFiscalSellado`; la 0698 F-2 lo cambia por el helper nuevo (§9) | F-2 |
| **Detalle de la factura en el Studio** | `app/studio/(app)/facturacion/[code]/page.tsx`, `facturacion/_components/InvoiceDetailClient.tsx` | Los dos bloques en solo lectura cuando ya está emitida. Desde la F-3, también el aviso «Varias direcciones» (§5.3) | F-2 y F-3 |
| **Ficha del envío en el portal** | `app/portal/(app)/envios/[code]/page.tsx`, `_components/PortalShipmentDetailNorte.tsx` | Un componente nuevo, `EntregarEnCard.tsx`: muestra a dónde va el embarque y deja elegir otra dirección o «Usar mi predeterminada». Cuando el embarque ya llegó a Venezuela (decisión 9), queda en solo lectura con el texto del error. No muestra la marca «Otra dirección», que es del ERP | F-3 |
| **Embarques en el Studio** | `app/studio/(app)/embarques/_components/EmbarquesClient.tsx`, `ShipmentDetailDrawer.tsx` | La marca «Otra dirección» en la fila (§5.3). En el drawer, el campo «Entregar en», con las direcciones del cliente | F-3 |
| **Borrador de la factura (aviso)** | `facturacion/_components/InvoiceDrawer.tsx` | El aviso «Varias direcciones» (§5.3) | F-3 |
| **Almacén VE y TMS** | `ve/actions.ts:103-112`, `ve/_components/VeRowActions.tsx:40`, `tms/_components/RouteDrawer.tsx:56-75` | Precargan `delivery_address` con la dirección elegida o con la predeterminada | F-3 |
| **Despacho y app del chofer** | `lib/studio/dispatch-mobile-queries.ts:161-200` | Después de la 0694 F-1, que pasa este lector a la predeterminada: en los paquetes de China, la dirección elegida del embarque de la recepción (§4.4) | F-3 |

Toda pantalla nueva o con cambio visual sustancial pasa por `/ui-check` antes del commit. Se usan los
componentes `canonical` del Studio (`<Aviso>`, `DrawerShell`) y solo tokens `var(--*)`.

## 7. Fases

| Fase | Qué entra | Migración | Depende de |
|---|---|---|---|
| F-0 | Esta spec y las respuestas de Sam (§11) | No | — |
| **F-1** | `client_fiscal_addresses` con su RLS, la copia, las tres RPC del portal, el trigger v2, Mi perfil y la ficha del Studio | Sí: `NNNN_direccion_fiscal_por_identidad.sql` y su desarme | El helper `direccionDeEntrega` de la 0694 F-1 en `main`, para mostrar la predeterminada cuando la casilla está marcada |
| **F-2** | Las columnas nuevas, el trigger v3, `invoice_addresses`, el borrador, el PDF, el comprobante HTML y la pantalla del Studio | Sí: `NNNN_factura_sella_facturar_a_y_entregar_en.sql` y su desarme (**migrate-first**: sin ella, el código nuevo no tiene la RPC; la lectura degrada como `invoice-client-doc.ts:64-68`, sin la línea) | La F-1 en producción y la 0694 F-2 en `main` (comparten el comprobante) |
| **F-3** | `shipments.delivery_address_id`, sus dos RPC, el trigger diferido, `reassign_shipment_client`, el congelado de la 0321, la ficha del envío, Embarques, Almacén VE, TMS, el despacho, la marca «Otra dirección» y el aviso «Varias direcciones» | Sí: `NNNN_embarque_entregar_en.sql` y su desarme. El trigger de la factura no cambia | La F-2 en producción y la 0694 F-1 en `main` (comparten `dispatch-mobile-queries.ts`) |

Hasta la F-3 no hay embarques con otra dirección, así que el aviso de Facturación entra con ella. **El
retiro de `client_billing_identities.fiscal_address` no es una fase de esta spec** (§12).

Cada fase lleva su PR, su `pnpm verify` y sus contratos SQL (`supabase/tests/*.test.sql`), que el CI corre
en el job «Contratos SQL». Las migraciones las numera Dir_DTD y las aplica con el
[runbook de producción](../../runbooks/aplicar-migraciones-prod.md) y el OK nominal de Sam, **de a una**.
Fusionar una PR no autoriza aplicarla. **Ninguna fase corrige datos de producción.** La copia de la F-1 es
idempotente («no existe fila»), y su conteo previo va al acta, no a Git.

## 8. Aceptación verificable

Cada punto se comprueba con una prueba que corre y observa el resultado, no con una búsqueda de texto. Los
contratos SQL corren con los roles reales (`authenticated` con el claim del portal o del Studio), no como
superusuario.

**F-1**

1. Un contrato inserta una alterna con `fiscal_address` y corre la copia dos veces: queda **una** fila de
   esa alterna, desmarcada, con el mismo texto y ciudad y estado en null. Después, un UPDATE de otra
   columna de esa fila no falla (CHECK de §4.1).
2. `portal_set_my_fiscal_address` con la casilla desmarcada y sin ciudad o sin estado da error de campo y
   no escribe nada. Con `alterna` y sin alterna, también.
3. La tabla rechaza una fila marcada con `line`, y una desmarcada sin `line`.
4. Con el rol del portal, un `select` directo a `client_fiscal_addresses` no devuelve filas, y la RPC no
   escribe la fila de otro cliente ni la de otro tenant. Con el Studio, `operations` no lee y
   `commercial` sí. Ningún `authenticated` puede hacer INSERT, UPDATE ni DELETE directo.
5. Borrar la alterna borra su fila. Si la principal cambia de `doc_kind`, su fila sigue siendo de la
   principal y la alterna no la ve.
6. `portal_set_my_fiscal_address` deja un evento `client_fiscal_address_saved` cuyo payload no tiene el
   texto de la dirección.
7. `portal_upsert_my_billing_identity` con `p_fiscal_address` escribe en la tabla nueva, y
   `client_billing_identities.fiscal_address` no cambia.
8. Con el trigger v2, una factura a la alterna desmarcada sella su `line`, ciudad y estado. Una a la
   principal sigue sellando null. `0466_client_billing_identity.test.sql` sigue verde.

**F-2**

9. Emitir una factura a la **principal**, con la casilla marcada, sella en `client_fiscal_address` la
   predeterminada formateada. Hoy queda null (`0466:320`).
10. Emitir con la casilla desmarcada sella `line`, ciudad y estado de la fila.
11. Emitir sella `ship_to_address` con la predeterminada y `ship_to_address_id` con su id. Si el INSERT trae
    otro `ship_to_address_id` o `addresses_sealed_at`, el trigger los sobrescribe.
12. Un borrador con `ship_to_address` editado se emite con ese texto, `ship_to_address_id` en null y un evento
    `invoice_address_overridden` con la clave `invoice-address:<id>`, cuyo payload no tiene la dirección.
13. Después de emitir, un UPDATE de cualquiera de las columnas de §4.2 falla con `invoice_titular_frozen`.
    Cambiar después la predeterminada del cliente no cambia la factura emitida. Un UPDATE de `paid_amount`
    de una factura vieja sigue funcionando.
14. Una factura sin cliente vivo se emite con `addresses_sealed_at` lleno y `invoice_addresses` devuelve
    `legacy = false`.
15. `exc0674_facturar`, `exc0674_emitir_borradores` (0569) y la RPC 0128 emiten con el sello completo. En
    la 0569, la guarda `borrador_alterado` no se dispara.
16. Una factura de contenedor al aliado raíz (0564 o 0569) se emite con `ship_to_address` en null, aunque
    el aliado tenga predeterminada y el borrador traiga una edición. También cuando el **primer** embarque
    (el de `shipment_id`) es del propio aliado y los demás, de las líneas, son de clientes finales. Bordes de
    `invoice_ships_to_others`:
    - una línea cuyo `shipmentCode` es igual al de un embarque de **otro tenant** y de otro cliente no
      activa la guarda, y la factura de un solo cliente conserva su «Entregar en»;
    - `lines` que no es un arreglo se lee como vacío;
    - una línea cuyo código no tiene embarque vivo activa la guarda;
    - una factura vieja con su fila de `exc0674_facturas` facturada a otro (`billed_markbox` distinto)
      devuelve «Entregar en» en null.
17. `invoice_addresses`, con el rol del portal, devuelve las direcciones de su factura vieja (`legacy =
    true`), con «Facturar a» y «Entregar en» actuales. Devuelve null en estos casos:
    - la factura de otro cliente o de otro tenant;
    - su propio borrador;
    - una factura de otro tenant con **el mismo Shipping Mark**;
    - una factura con `deleted_at`;
    - un vínculo `client_users` que no está `active`;
    - un cliente borrado.

    Con el Studio, `accounting` la lee y `operations` no. Una factura vieja de contenedor al aliado
    devuelve «Entregar en» en null. El contrato de equivalencia con la 0414 (§4.3) está verde.
18. El PDF (render de prueba) y el comprobante HTML muestran los mismos dos bloques para la misma factura.
    Una factura vieja muestra «Dirección actual del cliente» en los dos.
19. La función SQL de formato da el texto esperado para la tabla de
    casos, y ninguno incluye `reference`.

**F-3**

20. Las dos RPC del portal, la de leer (`portal_get_shipment_delivery_address`) y la de escribir
    (`portal_set_shipment_delivery_address`), con los mismos casos:
    - una dirección de otro cliente: la de escribir da error;
    - una dirección borrada: la de escribir da error;
    - el código de un embarque de otro tenant con el mismo Shipping Mark: ninguna lo encuentra;
    - un embarque borrado: ninguna lo encuentra;
    - un vínculo `client_users` que no está `active`: ninguna lo encuentra;
    - un cliente borrado: ninguna lo encuentra.

    La de leer no trae `reference` en ningún campo. Los dos contratos de equivalencia con las políticas de
    `shipments` están verdes. Con el rol `authenticated`, un `select delivery_address_id from shipments`
    falla con 42501, y el contrato de columnas de `shipments` está verde.
21. Con `arrived_destination_at` lleno (llegó a Venezuela, decisión 9), la RPC del portal da el error de
    campo y no escribe nada. Antes sí escribe. El Studio la puede cambiar hasta la entrega.
22. `reassign_shipment_client`, en un embarque **no entregado**, deja `delivery_address_id` en null, y en
    las pre-órdenes que mueve deja `ship_to_address` en null. Un UPDATE de `client_markbox` que deje la
    dirección de otro cliente en un embarque no entregado falla al confirmar. `rename_client_markbox` del
    mismo cliente no falla. Reasignar un embarque **entregado** con dirección elegida funciona: conserva su
    `delivery_address_id`, la guarda de la 0321 no salta y el trigger diferido no lo rechaza. **Después de
    esa reasignación**, `shipment_chosen_delivery_address` devuelve null, el portal del cliente nuevo y el
    drawer del Studio no muestran la dirección del anterior, y no salen ni la marca «Otra dirección» ni el
    aviso «Varias direcciones». `studio_get_shipment_delivery` devuelve `address` en null y
    `other_address` en falso.
23. Después de `merge_clients`, el embarque sigue apuntando a la misma dirección, ya del cliente que
    sobrevive.
24. Después de `delivered`, un UPDATE de `delivery_address_id` falla con el error de la 0321.
    `0321_warehouse_ve_delivery_governance.test.sql` y `0551_pasar_embarque_a_otro_cliente.test.sql` siguen
    verdes.
25. Una factura con tres embarques, uno con otra dirección, muestra en el Studio el aviso «Varias
    direcciones» con ese solo código. Su PDF y su comprobante no traen detalle por embarque. Sin embarques
    con otra dirección, el aviso no sale. La fila de ese embarque en Embarques lleva «Otra dirección».
26. En un paquete `warehouse_receipt_cn` cuyo embarque tiene una dirección elegida, el chofer ve esa. Sin
    dirección elegida, o en un `warehouse_receipt_ve`, ve la predeterminada. **Riesgo:** depende de que la
    recepción de China tenga `shipment_id` (`0008:74`), que se llena al consolidar. Una recepción sin
    consolidar cae a la predeterminada, y la prueba cubre ese caso.

**Para todas las fases**

27. Cada desarme se ensaya en su contrato: se niega en los casos de §4.5 y, sin ellos, repone la versión
    anterior exacta (md5 de `prosrc`).

Cada contrato nuevo se mata con un mutante antes de darlo por bueno: quitar la línea del sello, quitar la
columna del congelado, quitar el filtro de tenant de la RPC o quitar la guarda del aliado.

## 9. Relación con la SDD-0694 (#725), la SDD-0695 (#728) y la SDD-0696 (#729)

Las tres están abiertas. La 0694 y la 0695 usan `client_delivery_addresses` como fuente única de la
dirección de entrega. Esta spec no reabre nada de lo que ya tiene dueña.

| Pieza | Dueña | Qué hace la 0698 |
|---|---|---|
| La fuente única de la dirección de entrega y el helper `direccionDeEntrega` («la predeterminada vigente; si no, la más reciente») | **0694** §4.1, F-1 | Lo usa para la casilla y para «Entregar en». `invoice_resolve_addresses` replica la misma regla en SQL. Como la regla vive en dos lenguajes y en dos SDD, el fixture de casos es **uno solo** (un JSON en `supabase/tests/fixtures/`), y lo leen la prueba de TypeScript de la 0694 y el contrato SQL de la 0698 |
| Las RPC de escritura `client_delivery_address_save` y `_save_service` | **0694** F-2 | No las toca. Mi perfil sigue escribiendo direcciones de entrega por ellas |
| El comprobante HTML: misma fuente que el PDF | **0694** decisión 9, F-2 | Va después. Cambia `domicilioFiscalSellado` por el helper nuevo en todos los lectores a la vez |
| Sellar siempre «Facturar a», el bloque «Entregar en», la casilla y la etiqueta de las facturas viejas | **0698** (0694 §3, decisión 9, y §8) | Es esta spec |
| El lector del despacho pasa a la predeterminada | **0694** F-1 | La F-3 agrega encima la dirección elegida del embarque. No toca el archivo antes de que la 0694 F-1 esté en `main` |
| Precargar `shipments.delivery_address` | Ninguna (la 0694 §8 la dejó como «mejora aparte») | La toma la F-3 |
| `merge_clients` (dirección, ciudad, estado y Shipping Mark) | **0694** F-2 y **0695** F-6 | No la redefine. Su contrato 23 vive en `supabase/tests/` y corre en el CI. La 0695 F-6, que redefine `merge_clients` después, lo tiene que mantener verde. Si la 0698 F-3 llega después de la 0695 F-6, se prueba contra esa versión |
| Una sola predeterminada por cliente (RPC atómica y triggers) | **0695** F-9 | No la repite. Mientras la F-9 no esté, el sello usa «la más reciente» si no hay predeterminada, como el helper de la 0694 |
| **Las filas del registro de fuentes únicas** para la dirección fiscal (`client_fiscal_addresses`) y la dirección del embarque (`shipments.delivery_address_id`) | **0694** F-2 (lo decidió Dir_DTD el 2026-11-20) | Solo las cita. La lista de lectores congelados de `client_billing_identities.fiscal_address` también va en esas filas. El archivo `docs/architecture/fuentes-unicas.md` lo crea la 0695 F-1, y Dir_DTD lo suma a la allowlist de la 0694 F-2 |
| Las copias selladas de `invoices` | **0695** §2.1 («copias intencionales») | `invoices.client_fiscal_address` ya no es solo de la alterna: se sella siempre. Y se suman `ship_to_address`, `ship_to_address_id` y `addresses_sealed_at`. La fila para la tabla §5 de la 0695 se la pasó este Worker a Dir_DTD |
| Las funciones que redefine esta spec | **0698** §4.5 | La tabla de versiones de §4.5 es la única lista. Ninguna de las otras specs las redefine |
| El cliente final del aliado, su dirección y la factura del aliado raíz | **0696** | **Es una dependencia de esta spec.** Hasta que la 0696 decida, la guarda de §4.2 deja «Entregar en» vacío en esas facturas, y el aviso «Varias direcciones» mira solo los embarques del cliente de la factura (§5.6 y §12) |

## 10. `revisar-datos-ve` aplicado

Esto no es asesoría legal. Estados: `ENCONTRADO`, `CORRECTO` y `NO VERIFICABLE`.

**Inventario (paso 1):**

| Campo | Qué es | Finalidad | Quién más lo ve |
|---|---|---|---|
| `client_fiscal_addresses.line`, `city`, `state` (nuevo) | Dirección fiscal de cada identidad | Que la factura sirva al contador del cliente (SDD-0298) | El equipo de `accounting`, `admin` y `commercial` |
| `invoices.client_fiscal_address` (ya existe; ahora siempre lleno) | Copia sellada de «Facturar a» | El documento | Quien ve la factura: el cliente y los roles que ven montos (RLS 0414) |
| `invoices.ship_to_address` (nuevo) | Copia sellada de «Entregar en» | El documento | Lo mismo |
| `shipments.delivery_address_id` (nuevo) | A cuál de sus direcciones va el embarque | La entrega | El equipo y el chofer |

**Los doce puntos:**

1. **Inventario.** `ENCONTRADO`: la dirección fiscal de la alterna vive en `client_billing_identities.fiscal_address`
   (`0466:162-165`). Con la F-1 se copia a una sola tabla y la vieja queda congelada. Su retiro es aparte
   (§12).
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
   - El cliente lee las direcciones de sus facturas por `invoice_addresses`, que solo le devuelve las suyas
     (§4.3).
   - El cliente **no** puede cambiar una factura ya emitida. Es un comprobante, como explica
     `invoice-client-doc.ts:4-14`.
5. **Borrado.**
   - `NO VERIFICABLE`: qué pasa con la dirección sellada en facturas viejas si el cliente pide borrar sus
     datos. La factura es un documento contable y la política de conservación la tiene que fijar el
     abogado. **Esta spec no agrega ni quita plazos.**
   - Borrar una dirección de entrega no borra la copia sellada en las facturas emitidas, y eso es
     intencional.
6. **Trazabilidad.** Los cambios de la dirección fiscal, las ediciones del borrador y los cambios de entrega
   de un embarque dejan auditoría sin PII (§4.1, §4.2 y §4.4).
7. **Política pública.** `NO VERIFICABLE`: si `app/privacidad/page.tsx` dice que la factura lleva las dos
   direcciones. Se revisa en la F-2. Si hay que cambiar un texto aprobado, va al DG antes.
8. **Terceros.** No hay ninguno nuevo. El PDF se genera en el servidor (`@react-pdf`) y no sale a un
   tercero. El correo que manda la factura ya existe (Resend).
9. **Transferencia internacional y China (PIPL).**
   - El equipo de Yiwu no necesita ninguna de las dos direcciones.
   - La tarjeta «Entregar en» del Studio y la de Embarques pasan por el ocultamiento de la región `cn`
     (`lib/studio/privacidad-cn.ts`). La F-3 lo prueba.
10. **Decisiones automatizadas.** El sello es una regla visible: el borrador muestra qué saldrá y deja
    editarlo. El corte de la llegada a Venezuela se explica en el mismo error.
11. **Valor probatorio.** No aplica: la factura no se firma.
12. **Titulares que no son usuarios.** Una dirección de entrega puede ser la de otra persona. La factura la
    imprime solo si el cliente la eligió como predeterminada, y no imprime la referencia. La dirección elegida para
    un embarque solo la ve el equipo en el ERP y el chofer.

La skill recomienda que otro modelo revise esta sección antes de la F-2.

## 11. Preguntas para Sam: todas contestadas

Sam las contestó el 2026-11-20, una por una. Las respuestas literales están en la §3.

| Pregunta | Respuesta | Decisión |
|---|---|---|
| P-1. Si una factura junta varios embarques y uno va a otra dirección, ¿cómo lo mostramos? | La factura muestra solo la predeterminada. En el ERP, una marca en el embarque y el aviso «Varias direcciones… revisar» | 6 |
| P-2. La casilla «igual a mi dirección de entrega», ¿sigue a la predeterminada o la copia una vez? | La sigue | 7 |
| P-3. ¿La casilla viene marcada por defecto? | Marcada, salvo las empresas con domicilio fiscal | 8 |
| P-4. ¿Hasta cuándo puede el cliente cambiar a dónde llega un embarque? | Hasta que llega a Venezuela | 9 |
| P-5. ¿Quién edita la dirección fiscal desde el Studio? | Solo en el borrador de cada factura | 10 |
| P-6. ¿Qué hacemos con la factura de un cliente sin dirección de entrega? | Se emite sin el bloque «Entregar en» | 11 |

## 12. Fuera de alcance

- **Qué muestra la factura del aliado raíz** (SDD-0674, `0564:11-15`, y sus pre-órdenes de la 0569).
  - La mercancía es del cliente final, pero la factura va al aliado. Esta spec deja «Entregar en» vacío en
    esas facturas (§5.6), y el aviso «Varias direcciones» mira solo los embarques del cliente de la factura.
  - Si deben llevar la dirección de cada cliente final, lo define la **SDD-0696** (#729). **Es una
    dependencia**: lo que decida puede quitar la guarda o ampliar el aviso.
  - Dir_DTD estuvo de acuerdo el 2026-11-20 y lo coordina. También le avisa a la 0696 para que cite esta
    spec de vuelta.
- **Retirar `client_billing_identities.fiscal_address`.** Desde la F-1 la columna queda congelada, sin
  escritor ni lector (§4.1). Borrarla es una operación aparte, **con su propia SDD o con el OK nominal de
  Sam**, y exige:
  1. un `git grep` sin lectores;
  2. respaldo de la columna;
  3. volver a correr la copia de la F-1 justo antes;
  4. su desarme en `supabase/desarmes/`;
  5. sus propios criterios de aceptación.
- **Refacturar por zona fuera del precio.** El aviso «Varias direcciones» sirve para que la oficina lo
  revise, pero el análisis de zonas y precio, y cómo se refactura, lo reanaliza Sam más adelante
  (decisión 6).
- Facturación fiscal SENIAT, notas de crédito y numeración fiscal: no existen en el sistema.
- Mover `clients.city` y `clients.state`, o `lat`/`lng` y la foto de fachada: siguen como los dejó la 0694.
- Geocodificar la dirección fiscal: no hace falta.
- Pedir la dirección fiscal en el registro: no entra. El registro solo pide la dirección rápida de entrega
  (0694 §4.7).

## 13. Archivos (allowlist)

La allowlist es exacta. Antes de empezar cada fase, se vuelve a medir con un `git grep` de los lectores, y
cualquier archivo nuevo entra solo con una enmienda de esta spec. Las migraciones las numera Dir_DTD.

- **F-0:** `docs/specs/0698-factura-facturar-a-y-entregar-en/spec.md`, `docs/specs/README.md` (índice) y
  `.agents/handoffs/2026-11-20-sdd-0698-factura-direcciones.md`.
- **F-1:**
  - `supabase/migrations/NNNN_direccion_fiscal_por_identidad.sql`;
  - `supabase/tests/NNNN_direccion_fiscal_por_identidad.test.sql`;
  - `supabase/desarmes/NNNN_desarme.sql`;
  - `supabase/migrations-baseline.json` y `supabase/pending-migration-symbol-declarations.json`;
  - `lib/portal/billing-identity.ts` y `lib/portal/__tests__/billing-identity.test.ts`;
  - `app/portal/(app)/perfil/BillingIdentityCard.tsx`, `app/portal/(app)/perfil/empresa/BillingIdentityForm.tsx`,
    `app/portal/(app)/perfil/billing-actions.ts`, `app/portal/(app)/perfil/PortalAddresses.tsx` (solo el
    texto) y `app/portal/(app)/perfil/page.tsx`;
  - `lib/studio/invoice-billing.ts` y `lib/studio/__tests__/invoice-billing.test.ts`;
  - `app/studio/(app)/clientes/_components/ClientBillingCard.tsx` y `app/studio/(app)/clientes/[markbox]/page.tsx`;
  - `app/studio/(app)/facturacion/actions.ts` (la lectura de `:1115-1150`).
- **F-2:**
  - `supabase/migrations/NNNN_factura_sella_facturar_a_y_entregar_en.sql`;
  - `supabase/tests/NNNN_factura_sella_facturar_a_y_entregar_en.test.sql`;
  - `supabase/desarmes/NNNN_desarme.sql`;
  - `supabase/migrations-baseline.json` y `supabase/pending-migration-symbol-declarations.json`;
  - `lib/studio/invoice-client-doc.ts` y `lib/studio/__tests__/invoice-client-doc.test.ts`;
  - `lib/studio/invoice-billing.ts` (el patrón `*_present` de las dos direcciones);
  - `lib/studio/invoice-types.ts` y `lib/studio/invoice-queries.ts`;
  - `lib/studio/pdf/factura-pdf.tsx`;
  - `app/portal/(app)/facturas/[code]/pdf/route.ts` y `app/studio/(app)/facturacion/[code]/pdf/route.ts`;
  - `app/portal/(app)/facturas/[code]/comprobante/page.tsx`, `app/portal/(app)/facturas/[code]/comprobante/page.test.tsx`,
    `lib/portal/comprobante.ts` y `lib/portal/__tests__/comprobante.test.ts`;
  - `app/studio/(app)/facturacion/_components/InvoiceAddressesBlock.tsx` (nuevo) y su prueba,
    `InvoiceTitularPicker.tsx`, `InvoiceDrawer.tsx` e `InvoiceDetailClient.tsx`, en la misma carpeta;
  - `app/studio/(app)/facturacion/actions.ts` y `app/studio/(app)/facturacion/[code]/page.tsx`.
- **F-3:**
  - `supabase/migrations/NNNN_embarque_entregar_en.sql`;
  - `supabase/tests/NNNN_embarque_entregar_en.test.sql`;
  - `supabase/desarmes/NNNN_desarme.sql`;
  - `supabase/migrations-baseline.json` y `supabase/pending-migration-symbol-declarations.json`;
  - `app/portal/(app)/envios/[code]/page.tsx`, `app/portal/(app)/envios/[code]/_components/PortalShipmentDetailNorte.tsx`,
    `app/portal/(app)/envios/[code]/_components/EntregarEnCard.tsx` (nuevo), `app/portal/(app)/envios/[code]/actions.ts`
    (nuevo) y sus pruebas en `app/portal/(app)/envios/[code]/__tests__/`;
  - `lib/studio/shipment-types.ts`;
  - `lib/studio/shipment-queries.ts` (la marca y el drawer, por `studio_get_shipment_delivery`);
  - `lib/studio/invoice-queries.ts` (la consulta del aviso «Varias direcciones»);
  - `app/api/studio/shipments/[id]/route.ts` (el `.select()` pasa a columnas explícitas);
  - `app/studio/(app)/embarques/_components/EmbarquesClient.tsx`, `ShipmentDetailDrawer.tsx`,
    `app/studio/(app)/embarques/actions.ts` y sus pruebas en `app/studio/(app)/embarques/__tests__/`;
  - `app/studio/(app)/facturacion/_components/InvoiceDrawer.tsx` e `InvoiceDetailClient.tsx` (el aviso);
  - `app/studio/(app)/ve/actions.ts`, `app/studio/(app)/ve/_components/VeRowActions.tsx` y
    `app/studio/(app)/ve/_components/AlmacenVeClient.tsx`;
  - `app/studio/(app)/tms/actions.ts`, `app/studio/(app)/tms/_components/RouteDrawer.tsx` y `lib/studio/tms-queries.ts`;
  - `lib/studio/dispatch-mobile-queries.ts` y `lib/studio/dispatch-types.ts` (después de la 0694 F-1);
  - `lib/studio/privacidad-cn.ts`;
  - `lib/studio/__tests__/warehouse-ve-delivery-governance.test.ts`.
- **F-2, además:** `supabase/tests/fixtures/direccion-de-entrega-casos.json`, el fixture único de la regla
  de la predeterminada (§9).

## 14. Clasificación de gobernanza

| Política | Estado | Nota |
|---|---|---|
| AUD-01 y AUD-02 (tenant y auditoría) | Cumplimiento (propuesto) | El tenant sale de la sesión. Las RPC nuevas validan el cliente y el tenant. La tabla nueva tiene RLS y grants mínimos (§4.1). La auditoría va sin PII |
| Redefiniciones y desarmes | Cumplimiento (propuesto) | Cada función que se redefine tiene preflight, contrato previo y desarme (§4.5) |
| FRM-01 y ERR-01 (formularios y errores) | Cumplimiento (propuesto) | La casilla, «Editar en esta factura» y el error del corte son errores de campo, con texto escrito |
| BTN-01 (acciones) | Cumplimiento (propuesto) | «Volver a la del cliente» no destruye nada y no pide confirmación. Emitir sigue como hoy |
| CMP-01 (componentes) | Cumplimiento (propuesto) | Se usan `<Aviso>` y `DrawerShell` canonical. No hay componentes nuevos del sistema |
| Datos personales (`revisar-datos-ve`) | §10 | Tres `NO VERIFICABLE` que se revisan en la F-2 y la F-3 |
| `/ui-check` | Pendiente | En cada fase con pantalla |
