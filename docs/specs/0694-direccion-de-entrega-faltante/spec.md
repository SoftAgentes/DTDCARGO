---
sdd: "0694"
title: "Dirección de entrega: una sola fuente, aviso y pedirla desde la ficha"
status: proposed
author: "Claude (Worker) + Sam"
created: 2026-11-20
updated: 2026-11-20
supersedes: null
superseded_by: null
related: ["0131", "0138", "0169", "0524", "0531", "0587"]
confidencialidad: interno
---

# SDD-0694 — Dirección de entrega: una sola fuente, aviso y pedirla desde la ficha

> **Estado: propuesta para que Sam la apruebe.** No trae código, ni migración, ni cambio de producto.
> Las decisiones de Sam van citadas con su fecha (§3, decisiones 1 a 9). Las ocho preguntas están contestadas
> (§9).
>
> **Condición previa a publicar el campo de dirección del registro (§4.7):** antes hay que ajustar
> `app/privacidad/page.tsx:82`, y ese cambio va al DG (§6, punto 7).

## 1. Pedido

El 2026-11-20 Dir_DTD midió que la dirección de entrega de un cliente vive en varios lugares sin
enlace, que la ficha del Studio lee el lugar viejo y que muchos clientes no tienen dirección en
ningún lado. Ese mismo día Sam pidió:

- una sola fuente para la dirección;
- que la ficha muestre esa fuente;
- un botón para pedirle el dato al cliente desde la ficha;
- un aviso automático cuando le llega mercancía a la bodega de China y no tenemos su dirección.

## 2. Medición (código de `main` 87ff55598; base actualizada a `af0f635ad`, sin deriva en las líneas citadas de la §4.6 ni de `portal-queries.ts:117`)

### 2.1 Cuatro fuentes, no dos

| # | Fuente | Dónde nace | Qué guarda |
|---|---|---|---|
| F-1 | `clients.address` | `0006_clients.sql:16` | Una sola línea de texto libre. |
| F-2 | `client_delivery_addresses` | `0198_client_delivery_addresses.sql:23-38` | Varias direcciones por cliente, con `label`, `line`, `city`, `city_slug` (0347), `state`, `reference` e `is_default`, y RLS del portal por Shipping Mark. |
| F-3 | `clients.city` y `clients.state` | `0348_clients_ciudad_estado.sql:38-40` | La ciudad y el estado que pide el registro. El Studio no los muestra: `client-queries.ts:51` no los selecciona. |
| F-4 | `clients.address_reference` | `0066_foundation_v3.sql:151` | El punto de referencia viejo. Duplica `client_delivery_addresses.reference`. |

- La 0198 copió **una sola vez** F-1 a F-2 (`0198:167-181`) y dejó F-1 «como legacy». Esa copia no
  llevó F-3 ni F-4.
- El código ya declara F-2 como la fuente canónica (`lib/portal/portal-queries.ts:709-712`). Aun así,
  el indicador del portal mira las dos: primero F-1 y, si está vacío, F-2 (`portal-queries.ts:713-721`).
- **Conteo de producción, autorizado por Sam y hecho por Dir_DTD.** Los números no se copian a este
  repo, que es público.
  - De los clientes registrados por el portal, **más de la mitad** no tiene dirección en ningún lado.
  - **Muchos** la tienen solo en F-2.
  - Los clientes importados del sistema viejo (`registration_channel = 'legacy_import'`), cargados
    después de la 0198, la tienen **solo en F-1**.

### 2.2 Quién escribe cada fuente

**Ningún registro escribe la tabla nueva (F-2).**

| Escritor | Archivo:línea | Fuente que escribe |
|---|---|---|
| Registro de la página (`/registro`) | `app/registro/actions.ts:251` (`address: null`, a propósito), `:252-253` (ciudad y estado) | F-1 en null; F-3 |
| Registro por enlace del asesor | RPC `portal_registration_link_complete`: `0552:427-429` y `:446-448`, redefinida en `0562:247-249` y `:266-268`. La llama `app/registro/link/[token]/actions.ts:116` con `p_address` (`:127`) | F-1 y F-3 |
| Registro por enlace propio (activar) | RPC `portal_registration_link_complete_self`: `0562:594-596` y `:611-613`. La llama `app/registro/activar/[token]/actions.ts:127` con `p_address` (`:138`) | F-1 y F-3 |
| Alta de cliente en el Studio | `app/studio/(app)/clientes/actions.ts:101` (lee el form), `:245` (insert) | F-1 |
| Edición de cliente en el Studio | `clientes/actions.ts:392` (update). El campo está en `ClientDrawer.tsx:549-557` | F-1 |
| Fusión de clientes | `merge_clients`, última versión `0361:50`. Mueve las filas de F-2 al sobreviviente (`0361:137-149`) y completa F-1 y F-4 (`0361:248-249`). **No toca F-3**: la ciudad y el estado de la ficha fusionada se pierden | F-1, F-2, F-4 |
| Mi perfil (portal) | `app/portal/(app)/perfil/address-actions.ts:53`, `:59`, `:92`, `:109` → `lib/studio/client-address-queries.ts` | F-2 |
| Tarjeta «Direcciones de entrega» del Studio | `clientes/actions.ts:1141` (`addClientAddressAction`), `:1173` (`setDefaultClientAddressAction`) → `client-address-queries.ts` | F-2 |
| Importación del sistema viejo (`legacy_import`) | **NO VERIFICABLE en el repo.** `legacy_import` no aparece en el código ni en su historial de Git; el cargador de consolidados (`scripts/consolidados/lote-sql.ts:483-534`) crea clientes sin dirección. El importador que dejó esos clientes vive fuera del repo | F-1, según la medición de §2.1 |
| Semillas de prueba | `scripts/seed-portal-demo.sql:35`; `scripts/seed-test-client.mjs:69` (null) | F-1 |

F-4 no la escribe nadie en `app/` ni en `lib/`. Solo la toca la fusión (`0361:249`).

### 2.3 Quién lee cada fuente

| Lector | Archivo:línea | Fuente | Efecto hoy |
|---|---|---|---|
| **App del camionero** | `lib/studio/dispatch-mobile-queries.ts:163`, `:199-200` → `app/m/ve/camionero/_components/CurrentDelivery.tsx:338-364` | F-1 y F-4 | **Lo más grave:** el chofer no ve la dirección que el cliente cargó en Mi perfil, y la referencia sale vacía. |
| Ficha, fila «Dirección» | `app/studio/(app)/clientes/[markbox]/page.tsx:440` | F-1 | Dice «sin dato» aunque el cliente tenga direcciones en F-2. Esas direcciones salen más abajo, en la tarjeta de `page.tsx:525`. |
| Ficha, bloque «Perfil del cliente» | `clientCompleteness` en `lib/studio/client-types.ts:426` (`hasText(c.address)`), usado en `page.tsx:292` y pintado en `page.tsx:657-747` | F-1 | **Verificado:** marca «Falta: Dirección» aunque el cliente tenga direcciones en F-2. |
| Aviso del alta en el drawer | `ClientDrawer.tsx:231-239` | F-1 (lo que se escribió en el form) | Es coherente con el form de hoy y cambia con él. |
| Indicador del portal y su candado | `portal-queries.ts:700-724` → `app/portal/(app)/layout.tsx:76`, `page.tsx:76`, `perfil/page.tsx:79`; el candado es `lib/portal/verify-gate.ts:16`, `:27-32` y `:75-84` | F-1 o F-2 | Funciona, con la doble lectura. |
| Cliente del portal | `portal-queries.ts:85`, `:117` | F-1 y F-3 | Alimenta las dos filas siguientes. |
| Cotización nueva del portal | `app/portal/(app)/cotizaciones/nueva/page.tsx:19` | F-1 | El destino por defecto sale vacío si la dirección está en F-2. |
| Comprobante HTML de la factura (portal) | `app/portal/(app)/facturas/[code]/comprobante/page.tsx:232` | F-1 | Imprime la dirección **actual** del cliente. El PDF del Studio imprime el domicilio fiscal **sellado** en la factura (`lib/studio/invoice-client-doc.ts:69-84`, migración 0466). |
| Exportación CSV operativa | `lib/studio/export/operativo-csv.ts:89` | F-1 | |
| Agente IA (herramienta de embarques) | `lib/studio/agents/tools/shipment-tools.ts:224` | F-1 | |
| Geocodificación del Studio | `clientes/actions.ts:522-540` → `lib/studio/geocoding.ts:19` (Nominatim) | F-1 (escrita en el form) | Llena `clients.lat` y `clients.lng`. |

**No leen ninguna de las cuatro:**

- **TMS y almacén VE.** Usan `shipments.delivery_address` (`0009:11`). Ese campo se llena a mano en la
  ruta (`app/studio/(app)/tms/actions.ts:239`) o al entregar (`app/studio/(app)/ve/actions.ts:107`), y se
  lee en `lib/studio/warehouse-ve-queries.ts:27`.
- **Correos y PDFs.** Los correos de avisos no llevan la dirección (`lib/studio/notifications/drain-client-notifications.ts:233-258`).
  La factura usa el domicilio fiscal, que es otro dato (`invoice-client-doc.ts:69-84`).
- **El ocultamiento para China** (`lib/studio/privacidad-cn.ts:101-112`) ya tapa `address` y
  `client_address`, y vale para cualquier fuente.

### 2.4 Nada exige la dirección

- El registro de la página la difiere a propósito (`app/registro/actions.ts:234-251`). El comentario dice que
  se pide «antes de la 1ª compra», pero ningún código lo exige.
  - El paso 2 («Contacto», `app/registro/RegisterForm.tsx:755-846`) pide el WhatsApp, el teléfono de oficina y
    la ciudad y el estado de entrega (`CiudadEntrega`, `:834-843`). No pide la dirección.
  - El paso 3 reemplazó el paso «Dirección» del mockup (`:145-147`, `:848-849`).
- El registro por enlace (`registro/link` y `activar`, que comparten `RegistroLinkForm`) **sí** la pide,
  opcional (`app/registro/link/[token]/RegistroLinkForm.tsx:276-284`), pero la guarda en el campo viejo (§2.2).
- El candado del portal cierra solo Documentos, Referidos, Academia y Soporte (`verify-gate.ts:27-32`). Compras,
  proveedores, cotizaciones y envíos quedan abiertos sin dirección.
- El portal solo muestra la píldora «Falta completar datos» (`app/portal/(app)/layout.tsx:74-76`) y la
  tarjeta de perfil pendiente (`perfil/ProfilePendingBanner.tsx`).
- `composeAddress` (`lib/portal/register-types.ts:335`) no tiene llamadores fuera de las pruebas.

### 2.5 El teléfono no está validado

Sam pidió que el número de WhatsApp salga «del teléfono del cliente ya validado». Ese teléfono validado no
existe todavía:

- el registro solo exige que no esté vacío (`lib/portal/register-types.ts:256-257`);
- el Studio solo le quita los espacios (`lib/studio/client-types.ts:346`).

Lo que sí existe es la normalización para `wa.me`: `normalizeWhatsappPhone` (`lib/studio/quote-types.ts:399`)
pasa `0412…` a `58412…`, y el Cotizador ya abre `wa.me` desde el Studio con `quoteWhatsappHref` (`quote-types.ts:412`).

### 2.6 El aviso de bodega y la Bandeja

- El aviso «llegó a la bodega» se programa en `scheduleReceiptInWarehouse`
  (`lib/studio/notifications/schedule-fanout.ts:400`). Lo llaman la recepción del Studio
  (`app/studio/(app)/cn/actions.ts:331`), la del móvil (`app/m/cn/recibir/actions.ts:229`) y
  `lib/studio/notifications/aviso-recepcion-cn.ts:130`.
- El texto es `DEFAULT_EVENT_COPY["status:in_warehouse"]` (`lib/studio/notifications/client-notification-types.ts:92-95`).
  El correo se arma **al enviarse**, en `dispatchEmail` (`drain-client-notifications.ts:228-274`).
- Las conversaciones de Chatwoot guardan su ficha en `chatwoot_conversations.client_id`, con un índice por
  cliente y última actividad (`0504_chatwoot_eventos.sql:90-107`). La Bandeja abre una conversación con
  `/studio/bandeja?c=<id>` (`app/studio/(app)/bandeja/page.tsx:45` y `:57-60`).
- No hay código que mande plantillas de WhatsApp. `lib/public/markbox-whatsapp.ts:16` lo dice, y en `lib/` y
  `app/` no hay envío de plantillas.

## 3. Decisiones de Sam

1. **Una sola fuente** (2026-11-20): «No debería haber dos campos». Hay que copiar a
   `client_delivery_addresses`, como predeterminada, la dirección de todo cliente que la tenga en
   `clients.address` y no tenga ninguna fila en la tabla, con una migración idempotente. Después, todos leen y
   escriben la tabla, el cargador deja de escribir el campo viejo y `clients.address` se retira por fases,
   con su inventario previo.
2. **La ficha** (2026-11-20): la fila «Dirección» muestra la dirección de entrega predeterminada, o «Sin
   dirección de entrega» en rojo. El bloque «Perfil del cliente» lee la misma fuente.
3. **Botón para pedir el dato** (2026-11-20). Va al lado de cada «FALTA» del bloque «Perfil del cliente» y
   tiene dos acciones:
   - **WhatsApp:** abre `wa.me` en una pestaña nueva o, si el cliente ya tiene una conversación en la
     Bandeja, abre esa conversación;
   - **Correo.**

   Es solo para roles internos, no escribe PII en logs ni en la auditoría, y el número sale del teléfono del
   cliente.
4. **Aviso automático. Canal decidido por Sam el 2026-11-20:** «correo, portal y además WhatsApp automático
   cuando Meta apruebe la plantilla» (mensaje de Dir_DTD a este Worker, el mismo día). Así quedan dos fases
   (§4, A-1 y A-2).
5. **Dónde se exige (P-5). Decidido por Sam el 2026-11-20:** «En la primera compra». El portal exige la
   dirección al crear la primera compra o prealerta, con el formulario en la misma pantalla. Además, el Studio
   muestra un aviso, sin bloquear, al consolidar mercancía de un cliente sin dirección (§4.6).
6. **Pedido por correo (P-6). Decidido por Sam el 2026-11-20:** «Correo del sistema». Sale del sistema, con
   plantilla y rastro sin PII, como máximo uno cada 24 horas (§4.4).
7. **Dirección rápida en el registro. Decidido por Sam el 2026-11-20:** «sí, agrega la dirección rápida
   opcional en el paso 2». Esto incluye el registro por enlace (§4.7).
8. **Ciudad y estado del registro (P-7). Decidido por Sam el 2026-11-20:** «Dejarlos y mostrarlos».
   - `clients.city` y `clients.state` se quedan donde están.
   - La ficha del Studio los muestra.
   - La fusión de clientes los conserva: si el que sobrevive no los tiene, toma los del que se fusiona.
   - Moverlos a `client_delivery_addresses` no entra en esta SDD (§8).
9. **Comprobante HTML del portal (P-8). Decidido por Sam el 2026-11-20:** «Como QuickBooks: dos
   direcciones». La respuesta llegó por mensaje de Dir_DTD, después de que Sam viera cómo lo hace QuickBooks.
   - **Lo que entra en esta spec:** el comprobante HTML y el PDF usan **la misma fuente y la misma lógica**,
     `domicilioFiscalSellado` (`lib/studio/invoice-client-doc.ts:69-84`), que ya usan los dos PDF
     (`app/portal/(app)/facturas/[code]/pdf/route.ts:74` y `app/studio/(app)/facturacion/[code]/pdf/route.ts:57`).
     Sea cual sea la regla del PDF, el HTML hace lo mismo, así que los dos nunca dicen cosas distintas.
   - **Lo que pasa a la SDD-0698** (facturación, la escribe otra sesión):
     - sellar siempre «Facturar a»;
     - el bloque «Entregar en», con la casilla «igual a mi dirección de entrega»;
     - la etiqueta «Dirección actual del cliente» para las facturas viejas.
   - **Esto resuelve el hallazgo 1 de la revisión sobre `c3f81665b`.** El revisor encontró que `0466:315`
     sella `client_fiscal_address` solo cuando la factura va a otra identidad de facturación, y que en el
     caso común (`0466:319`) queda null. Con esta decisión el HTML no promete nada que el PDF no haga: si el
     PDF no imprime domicilio, el HTML tampoco. Completarlo es trabajo de la 0698.

Las decisiones 5 a 9 llegaron por mensaje de Dir_DTD a este Worker, el mismo día.

Los **otros** datos con fuente vieja y nueva van en la SDD-0695 (datos duplicados y fuentes únicas). No entran en esta spec (§8).

## 4. Diseño

### 4.1 La fuente única

**`client_delivery_addresses` es la única fuente de la dirección de entrega.** «Tiene dirección» significa
que el cliente tiene al menos una fila vigente (`deleted_at is null`) con `line` no vacía.

La dirección de un cliente se calcula siempre con la misma regla, en un solo helper de `lib/studio`
(por ejemplo, `direccionDeEntrega`), con una variante por lote para las listas:

- **la predeterminada vigente**;
- si no hay predeterminada pero sí filas vigentes, la más reciente, marcada «sin predeterminada»;
- si no hay ninguna fila vigente, **ninguna**.

**Cómo se llevan las cuatro fuentes a una.** Va en una migración de copia, idempotente, con número que asigna
Dir_DTD:

| Caso del cliente (vivo, `deleted_at is null`) | Qué hace la copia |
|---|---|
| Sin filas en F-2 y con F-1 no vacío | Inserta una fila predeterminada: `line = btrim(address)`, `reference = address_reference` (F-4) y `city`/`state` de F-3 (con `city_slug` en null). |
| Sin filas en F-2, F-1 vacío y F-3 lleno | No inserta: una ciudad sola no es una dirección de entrega, y `line` es `not null`. F-3 queda como **precarga** del primer formulario de dirección (§4.3). |
| Con filas en F-2 | No toca nada: F-2 manda. Si F-1 tiene otro texto, solo se cuenta, sin copiarlo (el conteo va al acta, no a Git). |
| Con filas en F-2 sin `reference`, y F-4 lleno | Copia F-4 a `reference` de la predeterminada, solo si está vacía. |

- Se repite igual en cada corrida: la condición es «no existe fila», como en `0198:179-181`, y el trigger
  sella `tenant_id` y `client_markbox`.
- La aplica Dir_DTD con el runbook de producción, después del ensayo `begin … rollback`.
- **Hay que volver a correrla justo antes de retirar F-1** (fase F-4), para atrapar lo que entre por los
  escritores viejos mientras tanto.

### 4.2 Lectores: el cambio de cada uno

| Lector | Cambio | Fase |
|---|---|---|
| App del camionero (`dispatch-mobile-queries.ts:163`, `:199-200`) | Lee por lote la dirección de F-2: `line`, `city` y `state` en `client_address`, y `reference` en `client_address_reference`. Se conserva la forma de `dispatch-types.ts:102-103`. | **F-1** |
| Ficha, fila «Dirección» (`page.tsx:440`) | Muestra `line` y, debajo, ciudad y estado de la predeterminada. Sin dirección, dice «Sin dirección de entrega» en el tono de peligro del Studio (`var(--danger)`), con el texto escrito y no solo con el color. | **F-1** |
| Ficha, ciudad y estado del registro (decisión 8) | Fila nueva «Ciudad de entrega» en «Datos del cliente», junto a «Dirección» (`page.tsx:440`), con `clients.city` y `clients.state` («Valencia, Carabobo»). Sin dato, «—». Para eso, `client-queries.ts:51` agrega `city, state` al select y `Client` (`client-types.ts:46`) los suma. | **F-1** |
| «Perfil del cliente» (`client-types.ts:426`) | `CompletenessSource` cambia `address` por `hasDeliveryAddress: boolean`. La página lo calcula con las direcciones que ya lee (`page.tsx:259`). | **F-1** |
| Indicador del portal (`portal-queries.ts:713-721`) | Solo F-2. Se quita la lectura de F-1, una vez aplicada la copia. | F-2 |
| Cotización nueva del portal (`cotizaciones/nueva/page.tsx:19`) | El destino por defecto sale de la predeterminada. | F-2 |
| Comprobante HTML de la factura (`comprobante/page.tsx:232`) | **Decisión 9:** deja de leer `clients.address` y llama a `domicilioFiscalSellado` (`invoice-client-doc.ts:69-84`) con la sesión del cliente, igual que el PDF del portal (`facturas/[code]/pdf/route.ts:74`). Imprime lo que devuelve esa función, y si devuelve null no imprime ninguna dirección, igual que el PDF. Sellarlo siempre es de la SDD-0698. | F-2 |
| CSV operativo (`operativo-csv.ts:89`) | Columna «Dirección» desde la predeterminada (por lote). | F-2 |
| Agente IA (`shipment-tools.ts:224`) | Lee la predeterminada. | F-2 |
| Geocodificación (`clientes/actions.ts:522-540`) | Geocodifica la línea de la predeterminada. `clients.lat`/`lng` no cambian en esta spec (§8). | F-2 |
| `portal-types.ts:82-86`, `:260` (comentarios) | Se actualizan. | F-2 |

### 4.3 Escritores: el cambio de cada uno

| Escritor | Cambio | Fase |
|---|---|---|
| Alta en el Studio (`clientes/actions.ts:101`, `:245`) | Si se escribe una dirección en el alta, se crea la **predeterminada** en F-2 con la RPC `client_delivery_address_save` (abajo). No se escribe F-1. | F-2 |
| Edición en el Studio (`clientes/actions.ts:392`, `ClientDrawer.tsx:549-557`) | El campo «Dirección» sale del drawer de edición: la dirección se edita en la tarjeta «Direcciones de entrega», que ya existe. El update deja de escribir F-1. | F-2 |
| RPC de registro por enlace (`0562:247-249`, `:266-268`, `:594-596`, `:611-613`) | Una migración nueva las redefine: si llega `p_address`, insertan la predeterminada en F-2 (con la ciudad y el estado) solo si el cliente no tiene ninguna vigente. Dejan de escribir F-1. Ver §4.7. | F-2 |
| Registro de la página (`app/registro/actions.ts:251-253`) | Con la dirección rápida del paso 2 llena, el alta crea la predeterminada en F-2. Nunca escribe F-1: el `address: null` se queda. F-3 se sigue escribiendo. Ver §4.7. | F-2 |
| Mi perfil y tarjeta del Studio | Ya escriben F-2. Si no hay ninguna dirección, el formulario llega con la ciudad y el estado de F-3. Pasarlos a la RPC es de la 0695 F-9a. | F-2 |
| Fusión (`merge_clients`, `0361`) | Una migración nueva la redefine. Conserva las filas de F-2 como hoy (`0361:137-149`), deja de completar F-1 y F-4 (`:248-249`), y **conserva F-3** con `coalesce` (sobreviviente primero, luego la fusionada). Hoy esa ciudad se pierde. | F-2 |
| Importación `legacy_import` | Dir_DTD ubica el importador fuera del repo. Si se vuelve a usar, escribe F-2. Mientras no se ubique, la copia de §4.1 se vuelve a correr después de cada carga. | F-2 |
| Semillas (`seed-portal-demo.sql:35`) | Escriben F-2. | F-2 |

**Un solo camino de escritura desde `app/` y `lib/`.** Esta F-2 crea las dos RPC por las que pasa toda
escritura de `client_delivery_addresses` desde TypeScript. La regla y su prueba de contrato son de la
SDD-0695 (§4.10 y F-9a):

- `client_delivery_address_save(p_client_id, p_address_id, …, p_make_default)`, `security invoker`, para
  quien tiene sesión: el alta del Studio, y después Mi perfil y la tarjeta del Studio;
- `client_delivery_address_save_service`, para el registro de la página, que no tiene sesión de usuario.

**Definición de `client_delivery_address_save_service`** (idéntica en la 0694 §4.3 y la 0695 §4.10):

- **Solo inserta la primera dirección de un cliente recién creado.** Firma:
  `client_delivery_address_save_service(p_tenant_id, p_client_id, p_line, p_city, p_city_slug, p_state,
  p_reference)`. No recibe `p_address_id`, no edita filas y no elige otra predeterminada. La fila que
  inserta queda como predeterminada.
- **Condiciones:** si falla cualquiera, la RPC termina con error y no escribe nada.
  - `p_client_id` existe en `public.clients` y está vivo (`deleted_at is null` y `merged_into_client_id is
    null`);
  - el `tenant_id` del cliente es `p_tenant_id`;
  - el cliente **no tiene ninguna dirección viva**;
  - el cliente es **recién creado:** su `created_at` es de hace 10 minutos o menos.
- **Por qué esa ventana, y no un marcador.** `registerClientAction` crea la ficha y llama a esta RPC en la
  misma petición, a segundos de distancia. La ventana no necesita una columna nueva en `clients` ni un
  estado que limpiar después. Junto con la condición de «sin dirección viva», impide que la función sirva
  para escribir en fichas viejas aunque alguien consiguiera ejecutarla con service_role. Un marcador del
  registro obligaría a otra migración de `clients` y a decidir cuándo se borra.
- **Permisos:** `security definer` y `set search_path = ''`, con todo calificado (`public.…`, `pg_catalog.…`).
  Lleva `revoke execute … from public, anon, authenticated` y `grant execute … to service_role`.
- **Uso:** la llama solo `registerClientAction` (`app/registro/actions.ts`), que no tiene sesión de
  usuario. El alta por enlace escribe dentro de su RPC SQL y no la necesita. Si algún día se llamara desde
  TypeScript, los únicos otros archivos permitidos son `app/registro/link/[token]/actions.ts` y
  `app/registro/activar/[token]/actions.ts`. La prueba de contrato falla si cualquier otro archivo de
  `app/` o `lib/` la invoca.
- **Pruebas.** Van en la 0694 F-2, donde nace la función, en un `.test.sql`, con un caso por condición:
  - `public`, `anon` y `authenticated` no la pueden ejecutar, y `service_role` sí (`has_function_privilege`);
  - un cliente recién creado y sin direcciones recibe una fila predeterminada;
  - un cliente que ya tiene una dirección viva da error y no escribe;
  - un cliente creado hace más de 10 minutos da error y no escribe;
  - con un `p_tenant_id` que no es el del cliente da error y no escribe;
  - un cliente borrado, uno fusionado y un id inexistente dan error y no escriben.

  La 0695 F-9a solo las cita.

Las RPC SQL que escriben dentro de su propia transacción (el registro por enlace, la copia de §4.1, las
semillas y el `_complete` de la 0696) cumplen la regla porque son una sola transacción.

### 4.4 Botón para pedir el dato

- Al lado de cada «Falta» del bloque «Perfil del cliente» (`page.tsx:747`) va un botón **«Pedir»**. Abre un
  menú con dos acciones: **WhatsApp** y **Correo**.
- Va en todo ítem que el cliente puede dar: tipo, documento, contacto, correo, teléfono, dirección y foto del
  documento. **No va** en «Identidad verificada», porque esa la verifica el equipo, no el cliente.
- **Quién lo ve:**
  - los roles que editan clientes (`canEditModule(studioRole, "clients")`, `page.tsx:169`);
  - nunca un usuario con región `cn` que no sea admin: no ve el teléfono ni el correo del cliente
    (SDD-0531, `privacidad-cn.ts`).
- **WhatsApp:**
  - Si el cliente tiene una conversación en `chatwoot_conversations` y quien mira tiene el módulo Bandeja, la
    acción es **«Abrir su conversación»** y lleva a `/studio/bandeja?c=<id>`. Sale la de actividad más
    reciente, y el mensaje se escribe ahí.
  - Si no, la acción es **«Abrir WhatsApp»**: `https://wa.me/<número>?text=<mensaje>` en una pestaña nueva
    (`target="_blank"`, `rel="noopener noreferrer"`), donde el equipo tiene WhatsApp Web abierto. El enlace se
    arma con `normalizeWhatsappPhone` y se reutiliza `quoteWhatsappHref` (`quote-types.ts:399`, `:412`).
  - Si el teléfono, ya normalizado, no tiene entre 11 y 15 dígitos, la acción queda deshabilitada y dice por
    qué: «El teléfono no sirve para WhatsApp».
  - Sin teléfono, no hay acción de WhatsApp.
- **Mensaje de la dirección**, en tuteo neutro. El ejemplo usa datos inventados:

  ```
  Hola María, te escribe DTD Cargo. Para entregarte tu mercancía (Shipping Mark DTD-0000)
  necesitamos tu dirección exacta de entrega: avenida o calle, edificio o casa, piso y número,
  urbanización o sector, ciudad, estado y un punto de referencia. Puedes cargarla en tu perfil
  del Portal (dtdcargo.com/portal/perfil) o respondernos por aquí.
  ```

  - Lleva solo el nombre de pila y el Shipping Mark, igual que `lib/public/markbox-whatsapp.ts:20-23`. El
    texto viaja en la URL de `wa.me`, así que nunca lleva el correo, el teléfono, el documento ni otra
    dirección.
  - Cada ítem tiene su propio texto, que pide solo ese dato.
- **Correo (decisión 6):** un correo del sistema con plantilla propia, mandado con `sendEmail` y con un botón al
  perfil del Portal. No hay `mailto:`.
  - Usa `<ActionButton>`: «Pedir por correo» → «Enviando…» → «Pedido enviado».
  - **Se limita a un correo por ítem y por cliente cada 24 horas.** El estado vive en una tabla nueva,
    `client_data_requests`:
    - columnas: `id`, `tenant_id`, `client_id`, `campo` (el ítem que se pide), `canal` (`email`),
      `requested_by` y `requested_at`;
    - RLS solo para el equipo del tenant; sin PII en la fila.
  - **Contra el doble clic de dos operadores,** la acción llama a una RPC
    `client_data_request_claim(p_client_id, p_campo)` que:
    - toma `pg_advisory_xact_lock(hashtextextended(p_client_id::text || ':' || p_campo, 0))`;
    - mira si hay una fila de ese cliente y ese campo en las últimas 24 horas;
    - si no la hay, inserta la fila y devuelve `ok = true` **con el `id` de la fila reclamada**; si la hay,
      devuelve `ok = false` con la hora del último pedido, sin insertar.
  - El correo sale **solo** con `ok = true`. Con `ok = false`, el botón dice «Ya se pidió hoy, a las …».
  - **Cuenta como enviado** si `sendEmail` devuelve `ok: true`, también con `queued: true`. En ese caso el
    correo quedó registrado y se reintenta solo, así que el reclamo se conserva.
  - Si `sendEmail` devuelve `ok: false`, se borra **por `id`** la fila reclamada, la que devolvió el
    `claim`, nunca por cliente y campo. Así un fallo tardío de un operador no puede borrar el reclamo de
    otro y dejar pasar un duplicado. El reintento queda libre.
  - **Límite conocido y aceptado:** si el proceso muere entre el `claim` y el envío, la fila queda y bloquea
    ese pedido durante 24 horas sin que haya salido ningún correo. El operador ve «Ya se pidió hoy» y puede
    usar WhatsApp.
  - Sin correo, no hay acción de correo.
- **Rastro sin PII:**
  - El correo del sistema deja un evento en `entity_audit_log` (AUD-01) con solo
    `{ campo: "address", canal: "email" }`: sin el correo, sin el texto y sin el teléfono. Sus metadatos en
    `sendEmail` tampoco llevan PII.
  - Abrir `wa.me` o la Bandeja es navegación: no deja auditoría ni escribe logs.
  - Nada de esto va a `console.*` con datos del cliente.

### 4.5 Aviso automático

**A-1: correo y portal.**

- **Correo.** Al armar el correo de `status:in_warehouse` en `dispatchEmail`, se pregunta si el cliente tiene
  dirección (§4.1). Si no la tiene, el correo lleva un **recuadro destacado** bajo el texto de llegada, con un
  botón al perfil (`${SITE_URL}/portal/perfil`):
  - título: «Nos falta tu dirección de entrega»;
  - texto: «Tu mercancía ya llegó a nuestro almacén de China, pero todavía no tenemos la dirección donde
    entregártela en Venezuela. Complétala en tu perfil para que no se retrase la entrega.»;
  - botón: «Completar mi dirección».

  Se decide al enviar, no al programar: si el cliente la cargó en el medio, el recuadro no sale. El recuadro
  no lleva datos del cliente, y el dedupe de la SDD-0524 no cambia.
- **Portal.** En el inicio del portal, un aviso específico con el mismo texto y el mismo botón. Sale cuando el
  cliente tiene mercancía recibida en la bodega de China (un envío abierto con `in_warehouse`) y no tiene
  dirección. Convive con la píldora «Falta completar datos».

**A-2: WhatsApp automático.**

- Depende de que Meta apruebe una plantilla nueva. **Esa aprobación es un paso de Sam en su cuenta de Meta**
  (las plantillas de Clientes siguen pendientes).
- Necesita su propio diseño de envío, porque hoy no hay código que mande plantillas (§2.6). Ese diseño se
  escribe en la fase A-2 y pasa por la §6, punto 3 (consentimiento).
- **Plantilla propuesta** `direccion_pendiente_embarque`. Sigue las reglas de
  `docs/marketing/whatsapp-plantillas-utilidad.md` §2: categoría Utility, idioma `es`, variables por
  posición que no van ni al principio ni al final, y botones de respuesta rápida sin URL.

  ```
  Hola, te escribe DTD Cargo. Tu mercancía con Shipping Mark {{1}} ya llegó a nuestro almacén
  de China, pero todavía no tenemos tu dirección de entrega en Venezuela.

  Para que no se retrase la entrega, complétala en tu perfil del Portal DTD Cargo o respóndenos
  por aquí con la dirección exacta y un punto de referencia.
  ```

  - **Botones (respuesta rápida):** «Ya la cargué» y «Tengo una duda».
  - **Ejemplo para Meta:** `{{1}}` = DTD-0000.
  - **Sin PII:** la única variable es el Shipping Mark. No lleva el nombre, ni el teléfono, ni la dirección,
    ni montos.
- **Cuándo sale:** en el mismo momento que el correo de A-1, y solo si el cliente no tiene dirección y tiene
  un teléfono que sirve para WhatsApp. Sale una vez por llegada, con el mismo dedupe que el correo.

### 4.6 Exigir la dirección en la primera compra (decisión 5)

**Portal.**

- **La compra se crea en una sola acción:** `createPrealertaAction`
  (`app/portal/(app)/proveedores/actions.ts:576`). El asistente de tres pasos (`NewPurchaseWizard.tsx`)
  la llama **al terminar el paso 1** (con `wizard`, `:582-585`), y el formulario largo la llama al final.
  No hay una segunda acción que cree la compra.
- Por eso la dirección se pide **antes de que esa acción corra**: en el asistente, como un bloque dentro
  del paso 1, que aparece solo si el cliente no tiene dirección (§4.1); en el formulario largo, antes del
  botón de enviar.
- El formulario es el mismo de Mi perfil (`PortalAddresses.tsx`), llega precargado con la ciudad y el estado
  del registro y se guarda con la misma acción (`perfil/address-actions.ts`). El cliente no sale de la
  pantalla ni pierde lo que ya escribió de la compra.
- Al guardarla, la compra sigue donde estaba.
- **Lo exige el servidor, no solo la pantalla:** `createPrealertaAction` comprueba la dirección **antes de
  insertar la compra**, en los dos caminos (asistente y formulario largo). Sin dirección, responde con un error
  de campo, «Agrega tu dirección de entrega para continuar», y no crea nada.
- Se aplica en cada compra mientras no tenga dirección, no solo en la primera: la primera es la que llega
  primero.

**Studio.**

- Al consolidar mercancía de un cliente sin dirección, el Studio muestra un `<Aviso tono="atencion">` que no
  bloquea, por ejemplo: «DTD-0000 no tiene dirección de entrega. Pídesela desde su ficha.», con un enlace a
  la ficha.
- El punto exacto se confirma al implementar: hoy la consolidación se arma en
  `app/studio/(app)/naviera/actions.ts` (`createConsolidation:320`, `linkConsolidation:823`) y la estiba del
  móvil en `app/m/cn/estibar/`.
- **China no recibe este aviso.** Es solo para Venezuela y para el Studio de VE. Un usuario de la región
  `cn` que no sea admin no ve si al cliente le falta la dirección (§6, punto 9), ni en la consolidación ni en
  la estiba del móvil (`app/m/cn/estibar/`).
  - Si la operación de China necesita saber que debe esperar, ve un marcador neutro, «Retener: falta un dato
    en VE», sin decir qué dato. Ese marcador lo decide Sam en la implementación; por defecto no se muestra.

### 4.7 Dirección rápida en el registro (decisión 7)

**Condición previa a publicar.** El campo del registro no se publica (ni el de la página ni el texto nuevo del
registro por enlace) hasta que:

- se ajuste `app/privacidad/page.tsx:82`, que hoy dice que la dirección detallada «la agregas después, en tu
  perfil del Portal»;
- el DG apruebe ese ajuste, porque cambia un texto aprobado. El texto propuesto está en la §6, punto 7.

El ajuste va en la misma PR del campo, o en una anterior, y la PR del campo no se fusiona sin ese visto
bueno.

**Registro de la página.**

- En `app/registro/RegisterForm.tsx`, paso 2 («Contacto»), debajo de `CiudadEntrega` (`:834-843`), va un campo
  de texto opcional:
  - etiqueta: «Dirección de entrega (opcional)»;
  - placeholder: «Calle, sector, casa o edificio»;
  - ayuda: «Así te entregamos sin tener que llamarte. Si prefieres, la pones después en tu perfil.»
- El campo viaja oculto al confirmar, como la ciudad y el estado (`:456-457`). El resumen del paso 4 lo muestra
  junto a «Ciudad de entrega» (`:923-926`).
- `validateRegisterInput` (`lib/portal/register-types.ts:223`) lo acepta vacío y lo limita a 300 caracteres,
  igual que el registro por enlace (`app/registro/link/[token]/actions.ts:89-91`).
- **Si viene lleno,** `registerClientAction` (`app/registro/actions.ts`), después de crear el cliente, inserta
  la predeterminada en `client_delivery_addresses`: `line` es el texto; `city` y `state` vienen del paso 2;
  `city_slug` viene del catálogo si la ciudad salió de ahí, y si no, null; `is_default` va en true. Usa
  la RPC `client_delivery_address_save_service` con el cliente admin (§4.3). No usa `insertClientDeliveryAddress`.
  - Nunca escribe `clients.address`: el `address: null` de `:251` se queda.
  - Si ese insert falla, el alta no se cae. El cliente queda sin dirección y aplica la §4.6. El error se
    registra sin el texto de la dirección.
- **Si viene vacío,** no se crea nada y aplica la §4.6.
- Se actualiza el comentario de `RegisterForm.tsx:145-147`, que dice que la dirección se difiere.

**Registro por enlace (`registro/link` y `activar`).**

- El campo ya existe y es opcional (`RegistroLinkForm.tsx:276-284`). Se alinea su etiqueta, su placeholder y
  su ayuda con los de arriba.
- Las RPC `portal_registration_link_complete` y `_complete_self` se redefinen (§4.3): la dirección va a
  `client_delivery_addresses` como predeterminada, con la ciudad y el estado. Se inserta solo si el cliente no
  tiene ninguna dirección vigente. Si ya la tiene, el texto nuevo no la pisa: se agrega como no
  predeterminada. Dejan de escribir `clients.address`.
- Va en la misma transacción de la RPC: si el insert falla, falla el registro por enlace, como hoy falla
  cualquier error de la RPC.

## 5. Fases

| Fase | Qué entra | Migración | Notas |
|---|---|---|---|
| F-0 | Esta spec. | No | Aprobación de Sam. |
| **F-1** | Copia idempotente (§4.1). Helper de la dirección. **Camionero, fila «Dirección» y «Perfil del cliente»** (§4.2). | Sí: la copia | Prioridad de Dir_DTD. La copia se aplica antes de publicar los lectores. |
| F-2 | El resto de los lectores (§4.2) y todos los escritores (§4.3): el Studio, la **dirección rápida del registro de la página y del registro por enlace (§4.7)**, la fusión que conserva la ciudad, las semillas y el portal sin doble lectura. | Sí: las RPC de enlace y la fusión | Después de F-2, nadie escribe F-1 ni F-4. La dirección rápida va en F-2 porque el registro por enlace necesita la misma migración que sus RPC. **Condición previa:** el ajuste de `app/privacidad/page.tsx:82`, con el visto bueno del DG (§4.7). |
| F-3 | Botón «Pedir» (§4.4). | Sí: `client_data_requests` y su RPC `claim` | Puede ir en paralelo con F-2. |
| E-1 | Exigir la dirección en la compra o la prealerta del portal, y el aviso al consolidar en el Studio (§4.6). | No | Requiere F-1 (el helper). Va después de F-2, para que los registros nuevos ya traigan su dirección y no se les pida dos veces. |
| A-1 | Recuadro en el correo y aviso en el portal (§4.5). | No | Requiere F-1 (el helper). |
| A-2 | WhatsApp automático (§4.5). | Por decidir en su diseño | Condicionada a la aprobación de Meta. |
| F-4 | Retiro de F-1 y F-4. Un grep nuevo confirma que no quedan lectores ni escritores (en el código, las migraciones vivas y las semillas), y la copia se vuelve a correr. Después hay un periodo de guarda en el que la base rechaza escribir `clients.address` (trigger o `revoke update`) y, al final, el `drop column`. | Sí, en dos pasos | Con respaldo, el OK nominal de Sam y el runbook. F-3 de las fuentes (ciudad y estado) **no se retira** (decisión 8). |

## 6. `revisar-datos-ve` aplicado a la dirección y al número de WhatsApp

Esto no es asesoría legal. Estados: `ENCONTRADO`, `CORRECTO` y `NO VERIFICABLE`.

**Inventario (paso 1):**

| Campo | Qué es | Finalidad declarada | Quién más lo ve |
|---|---|---|---|
| `client_delivery_addresses.line`, `city`, `state` y `reference` | Dirección de entrega en Venezuela | Entregar la mercancía (`app/privacidad/page.tsx:86`) | El equipo del tenant, el chofer y, si se geocodifica, Nominatim |
| `clients.address` y `address_reference` | Copia vieja de la misma dirección | La misma; se retira en F-4 | Lo mismo |
| `clients.city` y `clients.state` | Ciudad y estado del registro | A dónde se entrega (`0348`, `privacidad/page.tsx:82`) | El equipo |
| `clients.phone` | Teléfono o WhatsApp | Contacto (`privacidad/page.tsx:70-74`) | El equipo; Meta, si se usa WhatsApp |

**Los doce puntos:**

1. **Inventario.** `ENCONTRADO`: la misma dirección vive en cuatro lugares (§2.1). La fuente única de esta
   spec es el arreglo.
2. **Minimización.**
   - `CORRECTO`: `lib/public/markbox-whatsapp.ts:20-23` ya fija que en `wa.me` va solo el nombre de pila y el
     Shipping Mark.
   - El mensaje de §4.4 y la plantilla de §4.5 siguen esa regla. La plantilla ni siquiera lleva el nombre.
   - `ENCONTRADO`: la referencia y la dirección vieja se le muestran al chofer desde F-1 y F-4, que pueden
     estar viejas. F-1 de las fases lo arregla.
   - **Registro.** La dirección rápida (§4.7) es opcional y su ayuda dice para qué sirve («Así te entregamos
     sin tener que llamarte»). Se pide una sola línea, además de la ciudad y el estado que ya se pedían.
3. **Consentimiento.**
   - Abrir `wa.me` lo manda una persona del equipo a quien ya es cliente: es una gestión de la entrega.
   - `NO VERIFICABLE`: si el aviso **automático** por WhatsApp (A-2) tiene base suficiente con la política
     actual. La política menciona Meta como transportista de los mensajes (`privacidad/page.tsx:276`) y
     WhatsApp para «atender tus mensajes» (`:205`), pero no un aviso proactivo de la entrega. Meta además
     exige que la persona haya aceptado recibir mensajes. Se revisa en el diseño de A-2, antes de encenderlo.
4. **Derechos.** No aplica en esta spec: el cliente ya ve, edita y borra sus direcciones en Mi perfil (SDD-0138).
5. **Borrado.**
   - La copia solo toma clientes vivos.
   - `client_delivery_addresses` cae con el cliente si se borra de verdad (`on delete cascade`, `0198:26`).
   - `NO VERIFICABLE`: si el borrado lógico de un cliente deja sus direcciones legibles. No se probó contra
     una base.
   - Retirar F-1 elimina una copia, y eso es a favor.
6. **Trazabilidad.** El correo de §4.4 deja auditoría sin PII. El texto del pedido y el número nunca van a
   `entity_audit_log` ni a logs.
7. **Política pública.**
   - `ENCONTRADO`: `privacidad/page.tsx:82` dice que la dirección detallada «la agregas después, en tu perfil
     del Portal».
   - Con la decisión 7, el registro **puede** recibirla, de forma opcional. Con la decisión 5, se exige al
     crear la primera compra.
   - **Hay que ajustar ese texto en F-2**, antes de publicar la dirección rápida: «puedes darla al registrarte
     o después en tu perfil; la necesitamos antes de tu primera compra». Es un texto aprobado que cambia, así
     que va al DG antes. A-2 también requiere revisar la política con el abogado.
8. **Terceros.**
   - Meta (WhatsApp) recibe el número y el texto: al abrir `wa.me` y en A-2.
   - Resend recibe el correo.
   - Nominatim (OpenStreetMap) recibe la línea de la dirección al geocodificar (`clientes/actions.ts:540`).
   - `NO VERIFICABLE`: si Nominatim figura en la lista de terceros de la política. Se revisa en F-2, al mover
     la geocodificación.
9. **Transferencia internacional y China (PIPL).**
   - El aviso nace de una recepción en Yiwu, pero se calcula en el servidor. El equipo de China no ve la
     dirección, ni el teléfono, ni si al cliente le falta la dirección.
   - El botón «Pedir» no se muestra a la región `cn` (§4.4).
   - `CORRECTO` en el ocultamiento actual (`privacidad-cn.ts:101-112`). Las rutas nuevas tienen que pasar por él.
10. **Decisiones automatizadas.**
    - El aviso solo informa: no bloquea nada ni cambia el estado del envío.
    - Exigir la dirección en la compra (§4.6) es una regla visible: dice qué falta y deja cargarlo en la misma
      pantalla. No es una decisión opaca.
11. **Valor probatorio.** No aplica.
12. **Titulares que no son usuarios.**
    - Una dirección de entrega puede ser la de otra persona, como «casa de mi hermana», con una referencia
      que la nombra.
    - El mensaje y la plantilla no la repiten.
    - El chofer la ve porque la necesita para entregar.
    - `NO VERIFICABLE`: si la política cubre a ese tercero.

Recomendación de la skill: que otro modelo revise esta sección antes de implementar A-2.

## 7. Aceptación verificable

1. **Copia.**
   - Con una base efímera sembrada con los cuatro casos de §4.1 (datos inventados), la migración crea una sola
     predeterminada por cliente que tenía F-1 y ninguna fila, con `reference` desde F-4 y ciudad y estado desde F-3.
   - No toca a los clientes con filas, ni a los borrados, ni a los que solo tienen ciudad.
   - Correrla dos veces da el mismo resultado. Es una prueba `.test.sql` en PGlite.
2. **Camionero.** Un cliente con la dirección solo en F-2 muestra `line`, ciudad, estado y referencia en
   `CurrentDelivery`. Un cliente sin dirección muestra el estado vacío de hoy.
3. **Ficha.** Con la dirección solo en F-2, la fila «Dirección» muestra la predeterminada y «Perfil del
   cliente» la marca completa. Sin filas, dice «Sin dirección de entrega» en rojo y el bloque dice «Falta: Dirección».
   - **Ciudad y estado (decisión 8).** La fila «Ciudad de entrega» muestra `clients.city` y `clients.state`,
     con o sin dirección. Sin dato, muestra «—».
   - La fila no abre ningún acceso nuevo: la ve quien hoy ve la fila «Dirección» de la ficha.
4. **Ningún lector de §4.2 lee F-1 ni F-4** al cerrar F-2. Lo vigila una prueba de contrato que busca
   `address` y `address_reference` de `clients` en `app/`, `lib/` y las RPC vivas, con una lista de
   excepciones que llega a cero en F-4.
5. **Ningún escritor de §4.3 escribe F-1** al cerrar F-2.
   - El registro por enlace con dirección deja una predeterminada en F-2.
   - La fusión conserva las filas de F-2 y la ciudad y el estado. Hay tres casos, con una prueba `.test.sql`:
     - si el sobreviviente no tiene ciudad ni estado, toma los del fusionado;
     - si los tiene, conserva los suyos;
     - si ninguno los tiene, quedan en null.
6. **Comprobante (decisión 9).** Se prueba en
   `app/portal/(app)/facturas/[code]/comprobante/page.test.tsx`, con datos inventados:
   - con `client_fiscal_address` sellado en la factura, el comprobante imprime ese texto y no el de
     `clients.address` ni el de la predeterminada;
   - sin domicilio sellado (el caso común de hoy, `0466:319`), no imprime ninguna línea de dirección, igual
     que el PDF;
   - **factura vieja:** con la factura sellada, cambiar la dirección del cliente y su domicilio de facturación
     no cambia lo que imprime el comprobante;
   - **misma fuente:** una prueba de contrato comprueba que el comprobante HTML y los dos PDF obtienen el
     domicilio de `domicilioFiscalSellado` y de ninguna otra fuente.
7. **Botón «Pedir».**
   - Lo ven los roles que editan clientes y no lo ve la región `cn`.
   - Con una conversación, lleva a `/studio/bandeja?c=<id>`. Sin ella, el enlace es `wa.me/58…?text=…` con
     `target="_blank"`.
   - El texto lleva solo el nombre de pila y el Shipping Mark; una prueba lo vigila como en `markbox-whatsapp`.
   - Con un teléfono que no sirve, la acción queda deshabilitada con su motivo.
   - El correo deja un evento de auditoría sin PII.
   - **El límite de 24 horas** (`.test.sql` y Vitest):
     - dos `client_data_request_claim` del mismo cliente y campo, en paralelo, dan un `ok = true` y un
       `ok = false`, y queda una sola fila;
     - a las 23 h 59 min el segundo pedido da `ok = false`, y a las 24 h 1 min da `ok = true`;
     - otro campo del mismo cliente no queda bloqueado;
     - con `ok = false` no se llama a `sendEmail`;
     - si `sendEmail` da `ok: false`, se borra la fila **por su `id`** y el reintento sale. Con dos reclamos
       seguidos (el de A vence y después B reclama), el fallo tardío de A no borra el de B;
     - con `ok: true, queued: true`, el reclamo se conserva y el segundo pedido da `ok = false`.
8. **A-1.**
   - Un aviso `status:in_warehouse` de un cliente sin dirección lleva el recuadro y el botón a `/portal/perfil`.
   - Con dirección, no lo lleva.
   - Si el cliente carga la dirección antes de que se envíe el correo, el correo sale sin recuadro.
   - El portal muestra el aviso en las mismas condiciones.
9. **A-2.** No se enciende sin la plantilla aprobada por Meta, sin el diseño de envío aprobado y sin la §6,
   punto 3 resuelto.
10. **Dirección rápida del registro (§4.7).**
    - **Condición previa:** en `main`, o en la misma PR, está el ajuste de `app/privacidad/page.tsx:82`, con el
      visto bueno del DG registrado en la PR.
    - El paso 2 muestra el campo opcional debajo de la ciudad y el estado, con la etiqueta, el placeholder y la
      ayuda decididos.
    - El alta escribe la dirección con `client_delivery_address_save_service`, no con un insert directo.
    - `client_delivery_address_save_service` (definición en §4.3) tiene un `.test.sql` con un caso por
      condición: privilegios de `public`, `anon`, `authenticated` y `service_role`; cliente recién creado
      sin direcciones; cliente con una dirección viva; cliente de más de 10 minutos; `p_tenant_id`
      distinto; cliente borrado, fusionado e inexistente. Una prueba de contrato falla si otro archivo de
      `app/` o `lib/`, fuera de `registerClientAction` y de las dos acciones de enlace permitidas, la
      invoca.
    - Con el campo lleno, el alta deja **una** predeterminada en `client_delivery_addresses`, con esa línea y la
      ciudad y el estado del paso 2, y `clients.address` queda en null.
    - Con el campo vacío, no crea ninguna fila.
    - Con más de 300 caracteres, da un error de campo en el paso 2.
    - Si el insert de la dirección falla, el alta termina igual y el error no lleva el texto.
    - El registro por enlace y el de activar, con la dirección llena, dejan la predeterminada en la tabla y no
      escriben `clients.address`. Si el cliente ya tenía una vigente, la nueva no es predeterminada.
11. **Exigir en la compra (§4.6).**
    - Un cliente sin dirección no puede crear una compra ni una prealerta: `createPrealertaAction` responde con
      el error de campo y no inserta nada, **con `wizard` (paso 1 del asistente) y sin él**. La prueba llama
      la acción directo, sin pasar por la pantalla.
    - La pantalla le muestra el formulario de dirección sin perder lo que escribió. Al guardarla, la compra se
      confirma.
    - Un cliente con dirección no ve ningún paso de más.
    - En el Studio, consolidar mercancía de un cliente sin dirección muestra el aviso y la consolidación sigue.
      Un usuario de la región `cn` no admin **no ve el aviso** (una prueba lo comprueba en la consolidación y en
      la estiba). Si se activa el marcador neutro, no nombra el dato que falta.
12. **F-4.** Antes del `drop`, un grep sin resultados (fuera de migraciones aplicadas y desarmes), una segunda
    corrida de la copia y el OK nominal de Sam.

## 8. Fuera de alcance

- **Otros datos con fuente vieja y nueva.** Van en la SDD-0695. Las piezas que comparten las dos specs
  tienen una sola dueña:

  | Pieza | Dueña | La otra |
  |---|---|---|
  | La guardia de `clients.address` y `address_reference` | **0694** §7, punto 4 | La 0695 §4.8 la cita y no la repite |
  | `merge_clients`: dirección, ciudad y estado | **0694** F-2 | La 0695 F-6 parte de la versión de la 0694 F-2, solo agrega el Shipping Mark y va después |
  | `clientCompleteness` → `hasDeliveryAddress` | **0694** F-1 | La 0695 F-8 cambia el cálculo por su vista `client_completeness`, conservando la regla, y va después |
  | Ciudad y estado | **0694**, decisión 8 (cerrada) | La 0695 no la reabre |
  | La persona de la ficha fusionada (`person_id` en `merge_clients`, `0361:258`) | **0695** F-3 | La 0694 F-2 conserva esa línea tal cual al redefinir `merge_clients` |
  | Las RPC de escritura `client_delivery_address_save` y `_save_service` | **0694** F-2, que las crea porque es la primera que las necesita | La 0695 F-9a pasa a ellas a Mi perfil y a la tarjeta del Studio, y agrega la prueba de contrato |
  | Una sola predeterminada por cliente (los triggers y el preflight) | **0695** F-9b | La 0694 no la repite. Su helper lee «la más reciente, sin predeterminada» mientras tanto |
- **Mover `clients.city` y `clients.state` a `client_delivery_addresses`.** Por la decisión 8 se quedan en
  `clients`. Está cerrado, y la 0695 no lo reabre.
- `clients.lat`/`lng` y la foto de fachada (`facade_photo_url`, `0066`): siguen en `clients`. Pasarlos a la
  dirección es trabajo aparte.
- `shipments.delivery_address` (TMS y almacén VE): es la dirección de **ese** envío y se escribe a mano.
  Precargarla desde la predeterminada sería una mejora aparte.
- El domicilio fiscal (`client_fiscal_address`, 0466): es otro dato y no se toca.
- **SDD-0698 (facturación, de otra sesión):** sellar siempre «Facturar a», el bloque «Entregar en» con la
  casilla «igual a mi dirección de entrega», que los dos sean editables en el borrador, y la etiqueta
  «Dirección actual del cliente» para las facturas viejas (decisión 9).
- Validar el teléfono en el registro (§2.5). Esta spec solo normaliza para `wa.me`.

## 9. Preguntas para Sam: todas contestadas

Las ocho preguntas están contestadas y no queda ninguna abierta:

- P-1 a P-3 son las decisiones 1 a 3 del pedido (§3);
- P-4 a P-8 están abajo.

- **P-4 (canal del aviso). Decidida** el 2026-11-20: correo y portal (A-1) y, además, WhatsApp automático
  cuando Meta apruebe la plantilla (A-2).
- **P-5 (dónde se exige). Decidida** el 2026-11-20: «En la primera compra». Se exige en el portal, al crear
  la compra o la prealerta, y el Studio avisa sin bloquear al consolidar (§3, decisión 5, y §4.6).
- **P-6 (pedido por correo). Decidida** el 2026-11-20: «Correo del sistema» (§3, decisión 6, y §4.4).
- **Dirección rápida en el registro. Decidida** el 2026-11-20 (§3, decisión 7, y §4.7).
- **P-7 (ciudad y estado del registro). Decidida** el 2026-11-20: «Dejarlos y mostrarlos» (§3, decisión 8).
- **P-8 (comprobante HTML del portal). Decidida** el 2026-11-20: «Como QuickBooks: dos direcciones». En esta
  spec, el HTML y el PDF usan la misma fuente. El modelo de dos direcciones va en la SDD-0698 (§3, decisión 9).

## 10. Archivos (allowlist provisional)

Se confirma al implementar cada fase. Las migraciones las numera Dir_DTD.

- Esta spec, `docs/specs/README.md` (índice) y `.agents/handoffs/2026-11-20-sdd-0694-direccion-entrega.md`.
- **F-1:**
  - `supabase/migrations/NNNN_direccion_entrega_copia.sql` y su `.test.sql`;
  - `lib/studio/client-address-queries.ts` (el helper y su variante por lote);
  - `lib/studio/dispatch-mobile-queries.ts`;
  - `lib/studio/client-types.ts` (`CompletenessSource`, y `city`/`state` en `Client`);
  - `lib/studio/client-queries.ts` (`city, state` en el select de `:51`);
  - `app/studio/(app)/clientes/[markbox]/page.tsx` (fila «Dirección» y fila nueva «Ciudad de entrega»);
  - `app/studio/(app)/clientes/_components/ClientDrawer.tsx` (la fuente del aviso del alta);
  - y sus pruebas.
- **F-2:**
  - `app/studio/(app)/clientes/actions.ts`, `ClientDrawer.tsx`;
  - `lib/portal/portal-queries.ts`, `lib/portal/portal-types.ts`. **Antes de cambiar `PortalClient.address`**
    (`portal-queries.ts:117`) se hace un `git grep` de sus consumidores. Medidos en `af0f635ad`:
    `app/portal/(app)/cotizaciones/nueva/page.tsx:19` y `app/portal/(app)/facturas/[code]/comprobante/page.tsx:232`.
    La medición se repite al arrancar la F-2;
  - `app/portal/(app)/cotizaciones/nueva/page.tsx`;
  - el comprobante (decisión 9):
    - `app/portal/(app)/facturas/[code]/comprobante/page.tsx`;
    - la consulta de la factura del portal que alimenta `lib/portal/comprobante.ts`, para leer
      `client_fiscal_address`;
    - `app/portal/(app)/facturas/[code]/comprobante/page.test.tsx`;
  - `lib/studio/export/operativo-csv.ts`, `lib/studio/agents/tools/shipment-tools.ts`;
  - `app/portal/(app)/perfil/PortalAddresses.tsx` (la precarga de ciudad y estado);
  - `supabase/migrations/NNNN_registro_enlace_direccion.sql` y `NNNN_merge_clients_conserva_direccion.sql`, con sus pruebas;
  - `supabase/migrations/NNNN_client_delivery_address_save.sql` (las dos RPC de §4.3, con los permisos y el
    chequeo de tenant de `_service`), con su `.test.sql`;
  - la prueba de contrato del uso de `_service`, en `lib/__tests__/client-delivery-address-service.contract.test.ts`;
  - `scripts/seed-portal-demo.sql`;
  - dirección rápida del registro (§4.7):
    - `app/registro/RegisterForm.tsx` (paso 2, campo oculto, resumen y comentario);
    - `app/registro/actions.ts`;
    - `lib/portal/register-types.ts` (validación);
    - `app/registro/link/[token]/RegistroLinkForm.tsx` (textos);
    - las RPC de enlace, en la misma migración `NNNN_registro_enlace_direccion.sql`;
    - pruebas en `app/registro/__tests__/` y `lib/portal/__tests__/register.test.ts`, más las de
      `app/registro/link/[token]/` y `app/registro/activar/[token]/__tests__/`;
  - `app/privacidad/page.tsx` (§6, punto 7), con el visto bueno del DG.
- **E-1:**
  - `app/portal/(app)/compras/nueva/` (el wizard y su paso de confirmar);
  - `app/portal/(app)/proveedores/actions.ts` (`createPrealertaAction`, la única acción que crea la compra);
  - `app/portal/(app)/perfil/PortalAddresses.tsx` (el formulario, reutilizable dentro de la compra);
  - `app/studio/(app)/naviera/actions.ts` y su pantalla, o la de la estiba (`app/m/cn/estibar/`), según dónde se consolide;
  - y sus pruebas.
- **F-3:**
  - `supabase/migrations/NNNN_client_data_requests.sql` (la tabla y `client_data_request_claim`), con su
    `.test.sql`;
  - un componente nuevo en `app/studio/(app)/clientes/_components/` (`PedirDato`);
  - `page.tsx`;
  - una acción en `clientes/actions.ts`;
  - la plantilla del correo en `lib/studio/`;
  - y sus pruebas.
- **A-1:** `lib/studio/notifications/drain-client-notifications.ts`, el aviso del inicio del portal
  (`app/portal/(app)/page.tsx` o un componente suyo) y sus pruebas.
- **A-2 y F-4:** se definen en su propia fase.

## 11. Clasificación de gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| SGE-00 (acciones predecibles) | cumplimiento (diseño) | «Pedir» dice a dónde lleva: Bandeja, WhatsApp o correo. |
| BTN-01 | cumplimiento (diseño) | El correo usa `<ActionButton>`. WhatsApp y la Bandeja son enlaces, no mutaciones. |
| LNK-01 | cumplimiento (diseño) | `wa.me` abre en una pestaña nueva y la ficha se queda donde estaba. La Bandeja navega dentro del Studio. |
| A11Y-01 | cumplimiento (diseño) | «Sin dirección de entrega» va en texto, no solo en rojo. El menú se maneja con teclado. |
| MP-01 | no aplica | No se borra nada en F-1 a F-3. El `drop` de F-4 sigue el runbook y su propia aprobación. |
| AUD-01 / AUD-02 | cumplimiento (diseño) | El pedido por correo se audita sin PII. Las direcciones siguen con su auditoría actual. |
| FRM-01 | no aplica en F-1; aplica en F-2 y E-1 | Quitar el campo del drawer y precargar el formulario de dirección. El campo opcional del registro sigue el patrón del wizard: el error del servidor devuelve al paso y enfoca el campo. El formulario dentro de la compra conserva lo escrito. |
| ERR-01 | cumplimiento (diseño) | El error «Agrega tu dirección de entrega para continuar» dice qué falta y cómo resolverlo en la misma pantalla. |
| Privacidad CN (SDD-0531) | cumplimiento (diseño) | Ni «Pedir» ni el aviso exponen datos a la región `cn`. |
| Producción (AGENTS) | cumplimiento | Esta spec no leyó producción. Los conteos de §2.1 son de Dir_DTD, con la autorización de Sam, y no se copian al repo. |
