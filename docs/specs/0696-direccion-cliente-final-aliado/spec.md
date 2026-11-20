---
sdd: "0696"
title: "Dirección de entrega del cliente final de un aliado: la carga el aliado o el cliente con un enlace de su marca"
status: proposed
author: "Claude (Worker) + Sam"
created: 2026-11-20
updated: 2026-11-20
supersedes: null
superseded_by: null
related: ["0198", "0255", "0336", "0552", "0663", "0666", "0694", "0695"]
confidencialidad: interno
---

# SDD-0696 — Dirección de entrega del cliente final de un aliado

> **Estado: propuesta para que Sam la apruebe.** Esta PR solo trae la spec: ni código, ni migración, ni
> cambio de producto. Las preguntas van una por una en la §8.
>
> **Medición:** código de `main` en `6a7787d08`. La rama se basa en ese commit y la reserva `e9a0aa2aa` no
> cambia código. No se leyó producción. La consulta Q17 de la SDD-0695
> cuenta los clientes de aliado sin dirección. Su número va por chat, no a este repo.

## 1. Pedido

El 2026-11-20 Sam explicó el caso.

- Un aliado tiene su propia dirección de entrega, y sus clientes tienen otras.
- Ejemplo con datos inventados: un aliado trae siete cargas, de siete clientes distintos. DTD les entrega
  en Venezuela a esos siete clientes, pero no tiene sus direcciones ni sabe cómo escribirles, porque los
  contactos los tiene el aliado.

Lo que pidió:

- en el módulo de aliados, una opción de marca blanca para que **el aliado cargue la dirección de recepción
  de sus clientes**;
- o, si no, **un enlace que el aliado les mande a sus clientes**, para que la llenen ellos mismos con la
  marca del aliado.

Dir_DTD le dio a este tema una SDD propia (la 0696, y no un bloque dentro de la 0695), porque es una función
nueva de la marca blanca, con sus propias preguntas legales y de marca.

## 2. Lo que hay (medido en el código)

| Pieza | Dónde | Qué significa para esta spec |
|---|---|---|
| El cliente de un aliado es una ficha de `clients` con `aliado_id` | `0362_aliados_base.sql:129-139` | Su dirección cabe en la fuente única de siempre. **No hace falta una tabla nueva para la dirección.** |
| La dirección de entrega es `client_delivery_addresses` | `0198:23-38`; fuente única según la SDD-0694 §4.1 | El cliente final guarda la suya en **su propia ficha**, como cualquier cliente. |
| El aliado tiene una ficha ancla | `aliados.client_id`, con `unique (client_id)` (`0362:66`, `:106`) | La dirección del aliado es la de su ficha ancla, que también vive en `client_delivery_addresses`. |
| Quién entrega en Venezuela | 0666 §2.1: «Depende del aliado: dato en su ficha (retira el aliado / DTD entrega al cliente final)» | **No está construido:** no hay columna ni código (búsqueda vacía de `cliente_final`, `retira` y `entrega_ve` en `supabase/migrations`, `app` y `lib`). |
| El aliado no cambia direcciones | 0666 §4.3, última viñeta; 0255 §8.4 | **Esta spec lo cambia**, solo para la dirección de entrega y solo por RPC (§4.3). Lo pidió Sam el 2026-11-20. |
| Sin dirección «en ningún caso» | 0666 §6.2, D2 (recomendación de minimización) | **Esta spec lo cambia:** la dirección se pide solo cuando DTD le entrega al cliente final (§6). |
| Cláusula de datos de terceros para aliados | 0255 §8.5; 0666 §6.2, D1 | Sigue faltando, y es requisito para toda fase que trate datos del cliente final (§6). |
| Hoy la oficina ya puede cargar la dirección de cualquier ficha | Tarjeta «Direcciones de entrega»: `addClientAddressAction` (`app/studio/(app)/clientes/actions.ts:1141`) | Es la salida provisional: el aliado manda las direcciones y la oficina las carga. |
| Patrón de enlace de un solo uso | `client_registration_links` (`0552:13-36`): token aleatorio de 256 bits, la base guarda solo su sha256, un solo uso, 14 días, y regenerarlo revoca el anterior (`0552:256-262`) | El enlace de dirección copia ese patrón. |
| Marca blanca por cliente | `get_portal_brand()` (`0401:12-45`, cadena en `0451`) deriva todo de `auth.uid()` y `client_users`. `resolveBrandForClient` (`lib/studio/aliados/brand-resolve.ts:37-47`) cae a `DTD_BRAND` ante cualquier error. `aliados.hide_dtd_brand` vale `true` por defecto (`0362:85`) | **Ninguna de las dos sirve para el enlace:** quien abre el enlace no tiene sesión, y caer a DTD rompe la marca blanca. La marca se resuelve desde el token, y si falla, la página sale neutra (§4.4.3). |
| Límite de intentos en la base | `brand_access_attempts` (`0334:140-150`): guarda el SHA-256 del origen, no la IP, con bloqueo escalonado y acceso solo por service_role | El enlace copia el mecanismo, pero sin `tenant_id` y con HMAC (§4.4.1). `0552` no trae ninguno. |
| Helper de direcciones | `lib/studio/client-address-queries.ts` (`insertClientDeliveryAddress:96`, `listClientDeliveryAddresses:46`) | Ahí vive `direccionDeEntrega` (0694 §10, F-1), y ahí se ubica `destinoDeEntrega`. |
| Dominio sin rastro de DTD | 0666 §2.2: `hailuway.com`, todavía sin montar (fase P5) | Define en qué dirección vive el enlace (P-2). |
| Avisos | 0666 §2.1: «Solo al aliado; nada al cliente final» | El aviso de dirección faltante le llega **al aliado** (§4.5). |

## 3. Decisión de Sam (2026-11-20)

- El aliado carga en su marca blanca la dirección de recepción de sus clientes, o les manda un enlace con su
  marca para que la llenen ellos.
- Esa dirección sirve para la logística de la entrega en Venezuela.

## 4. Diseño

### 4.1 Quién recibe la carga en Venezuela

Columna nueva `aliados.entrega_ve`, con dos valores:

- `retira_aliado`: DTD le entrega al aliado, en la dirección de su ficha ancla;
- `dtd_entrega_cliente_final`: DTD le entrega a cada cliente final, en la dirección de la ficha de ese
  cliente.

El valor por defecto es `retira_aliado` (P-1). Así nada cambia para los aliados de hoy hasta que la oficina
lo decida.

Va en la tarjeta del aliado del Studio (`app/studio/(app)/clientes/_components/AliadoCard.tsx`), solo para
los roles que editan clientes.

**Subaliados (P-6):**

- el subaliado hereda el modo de su raíz, salvo que tenga uno propio;
- con `retira_aliado`, la dirección es la de la ficha ancla del subaliado, si tiene una; si no, la del raíz.

### 4.2 Dónde vive la dirección

- **En `client_delivery_addresses` de la ficha del cliente final**, con la regla de la SDD-0694 §4.1
  (predeterminada vigente). No hay tabla nueva ni copia en `aliados`.
- **El destino se resuelve en un solo lugar.** El helper de la 0694 (`direccionDeEntrega`) suma
  `destinoDeEntrega(cliente)`:
  - si el cliente no es de un aliado, o su aliado tiene `dtd_entrega_cliente_final`, el destino es la
    dirección del propio cliente;
  - si su aliado tiene `retira_aliado`, el destino es la dirección del aliado (§4.1), y la pantalla lo dice:
    «Retira el aliado».
- La app del chofer, el despacho y la vista de completitud de la 0695 leen `destinoDeEntrega`, nunca la
  dirección suelta.

### 4.3 El aliado carga la dirección

**Hasta que exista el portal del aliado (0666):**

- La oficina carga en la ficha del cliente final lo que el aliado le manda, con la tarjeta que ya existe.
- La ficha del aliado suma una lista: «Clientes sin dirección de entrega». Muestra el código impreso y el
  nombre, y solo aparece cuando el modo es `dtd_entrega_cliente_final`. Cada fila tiene «Cargar dirección»
  y «Copiar enlace para el aliado» (§4.4).

**En el portal del aliado (0666, P2, «Mis clientes»):**

- Cada cliente tiene «Dirección de entrega»: ver, agregar y cambiar la predeterminada.
- **La RLS de la 0198 no le sirve al aliado.** Solo da lectura por tenant (al equipo) o por el markbox
  propio (al cliente). Por eso hay dos RPC `security definer` nuevas, con el patrón de las RPC del aliado
  (0666 §4.3):
  - **`aliado_list_client_delivery_addresses(p_client_id)`**, de lectura. Devuelve las filas vigentes de
    ese cliente: `id`, `label`, `line`, `city`, `state`, `reference` e `is_default`;
  - **`aliado_add_client_delivery_address(p_client_id, …, p_make_default)`**, de escritura. Solo hace
    `insert` de una fila nueva y, si se pide, mueve `is_default` a esa fila.
- Las dos:
  - derivan la identidad de `auth.uid()` y exigen el rol `aliado`;
  - comprueban que el cliente cuelga de la cadena del aliado que llama: suben por `parent_aliado_id`, en el
    mismo tenant (0451);
  - responden igual si el cliente no existe o es de otro aliado;
  - no devuelven el nombre, el teléfono ni la dirección a un usuario de la región `cn` (0666 D7).
- **No hay borrado ni edición (P-5).** No existe una RPC del aliado que haga `update` del texto ni
  `deleted_at` en una fila de `client_delivery_addresses`. Lo único que la RPC de escritura cambia en una
  fila existente es `is_default`, para elegir la nueva.
- No se abren las 12 políticas de escritura del portal (0255 §8.4): el aliado sigue sin poder reportar
  pagos ni tocar otra cosa.
- Cada cambio deja un evento en `entity_audit_log` sin el texto de la dirección:
  `{ campo: "delivery_address", origen: "aliado" }`.

### 4.4 Enlace para que el cliente final la llene

#### 4.4.1 La tabla

La tabla nueva `client_address_links` copia el patrón de `client_registration_links` (0552):

| Columna | Qué guarda |
|---|---|
| `id` | Llave |
| `tenant_id` | El tenant |
| `client_id` | El cliente final |
| `token_hash` | El sha256 en hex del token (`^[0-9a-f]{64}$`), único |
| `expires_at` | `now() + interval '14 days'` |
| `used_at` | Cuándo se usó |
| `revoked_at` | Cuándo se revocó |
| `created_by` | Quién lo generó |
| `created_via` | `studio` o `aliado` |

- RLS encendida y sin políticas: no la lee ni la escribe `anon` ni `authenticated`, solo las RPC.
- Un índice parcial único garantiza **un solo enlace vigente por cliente**: `client_id` donde `used_at` y
  `revoked_at` son null.
- El token tiene 32 bytes aleatorios (256 bits) y se genera en el servidor. En claro **solo existe al
  crearlo**: se muestra una vez para copiarlo y no se puede recuperar.

La tabla nueva `client_address_link_attempts` cuenta los intentos (§4.4.4). **No tiene `tenant_id`**: un
token inválido no tiene tenant. Por eso no copia tal cual `brand_access_attempts`, que sí lo exige
(`0334:140-150`).

| Columna | Qué guarda |
|---|---|
| `id` | `bigint generated always as identity` |
| `attempt_key` | El HMAC-SHA-256 en hex del origen (`^[0-9a-f]{64}$`), con un secreto del servidor (§4.4.4). No guarda la IP |
| `succeeded` | `boolean not null` |
| `created_at` | `timestamptz not null default now()` |

- Tiene un índice `(attempt_key, created_at desc) where succeeded = false`.
- RLS encendida y sin políticas. `revoke all` de `public`, `anon` y `authenticated`, y
  `select, insert, delete` solo para service_role.

#### 4.4.2 Las RPC

Las tres son `security definer` y tienen `search_path = ''`.

| RPC | Quién la ejecuta | Qué hace |
|---|---|---|
| `client_address_link_create(p_client_id, p_token_hash)` | `authenticated` (con `revoke` de `public` y `anon`). Pide un rol del Studio (`admin`, `commercial` u `operations`) en el tenant del cliente, o el rol `aliado` con la cadena comprobada (§4.3) | Revoca el enlace vigente de ese cliente, si hay uno, e inserta el nuevo. **`created_via` no es un parámetro:** la RPC lo deriva del rol que pasó la comprobación (`studio` o `aliado`), y `created_by` sale de `auth.uid()`. Rechaza a un cliente directo de DTD (sin `aliado_id`). **Solo la llama un clic de una persona** («Copiar enlace nuevo»), nunca un proceso automático (§4.5). |
| `client_address_link_peek(p_token_hash, p_attempt_key)` | **solo `service_role`** (`revoke` de `public`, `anon` y `authenticated`, como `0552:309-310`) | Revisa el bloqueo del origen y registra el intento (abajo). Si el origen no está bloqueado y el enlace está vigente, devuelve `client_id`, `tenant_id` y la marca resuelta (§4.4.3). En cualquier otro caso devuelve cero filas. |
| `client_address_link_complete(p_token_hash, p_attempt_key, p_line, p_city, p_city_slug, p_state, p_reference)` | **solo `service_role`** | Revisa el bloqueo, registra el intento, hace el consumo atómico, escribe la dirección y deja la auditoría (abajo). |

**El bloqueo se revisa en la base, dentro de la misma transacción** que la lectura o el consumo. No depende
de que el servidor se acuerde de hacerlo:

1. Cuenta los fallos de `p_attempt_key` en `client_address_link_attempts` dentro de la ventana de §4.4.4.
2. **Si el origen está bloqueado,** registra el intento como fallo y termina igual que con un enlace
   inválido: `_peek` devuelve cero filas y `_complete` da el error neutro. **No llega al `update`:** un token
   válido no se consume y no se escribe ninguna dirección.
3. Si no está bloqueado, sigue con la lectura o el consumo, y registra el intento como fallo o como éxito
   según el resultado.

No hay una RPC aparte para los intentos.

**El consumo atómico de `_complete`** pasa en una sola sentencia:

```sql
update public.client_address_links
   set used_at = now()
 where token_hash = p_token_hash
   and used_at is null and revoked_at is null and expires_at > now()
returning client_id, tenant_id;
```

- Esta sentencia corre solo si el origen no está bloqueado (arriba).
- Sin fila, la RPC termina con el mismo error neutro que un enlace que no existe.
- Con fila, la dirección se escribe **solo** en `client_delivery_addresses`, y solo en filas del
  `client_id` que devolvió esa sentencia. No acepta un `client_id` del que llama. `client_markbox` y
  `tenant_id` no los pone la RPC: los sella desde `clients` el trigger de la 0198 (`0198:149`).
- **Además de la dirección, `_complete` toca exactamente tres cosas:**
  - `client_address_links.used_at`;
  - una fila en `client_address_link_attempts`;
  - **un evento en `entity_audit_log`** (AUD-01) con `{ campo: "delivery_address", origen: "enlace" }`,
    el `client_id` y el id de la fila nueva. El evento no lleva el texto de la dirección, ni el token, ni
    su hash, ni la clave del intento.

  No toca ninguna otra tabla.
- Dentro de ese cliente hace dos cosas, en este orden:
  1. si había una predeterminada vigente, un `update … set is_default = false` **solo de esa fila**. Lo
     exige el índice único de una predeterminada por cliente (`client_delivery_addresses_default_uidx`,
     `0198:44-46`). No cambia `line`, `deleted_at` ni `client_id` de ninguna fila;
  2. el `insert` de la fila nueva con `is_default = true`.

  Así la nueva queda como predeterminada, y la anterior queda guardada.
- Todo va en la misma transacción. Si dos envíos llegan a la vez, el `update` con su condición deja pasar
  solo uno: el otro no encuentra fila.
- Valida en la base: `line` entre 1 y 300 caracteres, y `city`, `state` y `reference` con sus propios
  límites.

#### 4.4.3 La marca, desde el token y cerrada ante errores

- `get_portal_brand()` y `resolveBrandForClient` no se usan aquí (§2).
- `_peek` resuelve la marca **en la base**, desde el `client_id` del token. Sube por la cadena hasta el
  aliado raíz (la marca la pone el raíz, 0666 §2.2) y devuelve `trade_name`, el logo, el color y
  `hide_dtd_brand`.
- **Se falla cerrado:**
  - si no hay aliado;
  - si la cadena no resuelve;
  - si `hide_dtd_brand` es `false`;
  - o si la consulta falla.

  En cualquiera de esos casos la página sale **neutra**: sin logo, sin nombre, sin colores y sin pie, con
  el título «Dirección de entrega». **Nunca** sale la de DTD. La página no importa `DTD_BRAND`.
- El enlace solo se genera para clientes de un aliado. Para un cliente directo de DTD, `_create` lo
  rechaza: ese cliente tiene Mi perfil y el pedido de la 0694.

#### 4.4.4 La página pública

- La ruta es `/d/[token]`, y su dirección exacta depende de P-2.
- El servidor toma el token del segmento, calcula el sha256 y llama a `_peek` y a `_complete` con el
  cliente de service_role. El token en claro **no** va a ningún `console.*`, ni a Sentry, ni a la
  auditoría, ni a un error. El registro del servidor lleva solo los primeros 8 caracteres del **hash**.
- **Cabeceras:** `Cache-Control: no-store` y `Referrer-Policy: no-referrer`. Las pone la página (o
  `proxy.ts` para `/d/`). Sustituyen el `strict-origin-when-cross-origin` general de `next.config.ts:201`
  en esa ruta, para que el token no viaje en el `Referer`.
- **Límite de intentos en la base**, efectivo en serverless porque no vive en la memoria de un proceso:
  - Lo hace la tabla `client_address_link_attempts` (§4.4.1), sin tenant.
  - `attempt_key` es un **HMAC-SHA-256** del origen con un secreto del servidor
    (`ADDRESS_LINK_ATTEMPT_SECRET`, que va en los dos `.env.example`), no un SHA-256 sin sal. Así la tabla
    no permite recuperar la IP probando las direcciones posibles.
  - Con 5 fallos en 15 minutos desde el mismo origen, la página responde igual que un enlace inválido
    durante 1 hora.
  - Cada token inválido cuenta como fallo.
  - Las filas se borran a los 7 días.
- **La misma respuesta para todo enlace inválido** (vencido, usado, revocado, inexistente o bloqueado), con
  el mismo código HTTP (200), las mismas cabeceras y el mismo texto: «Este enlace ya no está disponible.
  Pídele uno nuevo a tu aliado». Vale para la **carga** de la página y para el **envío** del formulario.
- **El mismo trabajo en todos los casos.** El servidor siempre calcula el hash del token y el HMAC del
  origen, y llama a `_peek` en la carga y a `_complete` en el envío, **también cuando el origen está
  bloqueado**. La decisión del bloqueo la toma la base dentro de esas RPC (§4.4.2), no el servidor. Así el
  tiempo de respuesta no distingue el bloqueo de un token inválido, y un origen bloqueado no puede consumir
  un token válido.
- **Qué muestra:**
  - La marca de §4.4.3 y el formulario. El formulario es el de Mi perfil (`PortalAddresses.tsx`): calle,
    ciudad (del catálogo), estado y punto de referencia. No pide la cédula ni el correo.
  - El código impreso del cliente (por ejemplo `FA-1232`), para que sepa de qué carga se trata. **Ese código
    revela el prefijo del aliado** a quien tenga el enlace (§6, hallazgo 3).
  - No muestra el nombre, el teléfono ni la carga: el token da permiso para dar una dirección, no para ver
    datos.
- Al guardar, sale el texto «Listo. Tu aliado ya tiene tu dirección de entrega». Al recargar, la página ya
  da la respuesta de enlace inválido.
- El aviso de privacidad del formulario depende de P-7.

### 4.5 Aviso al aliado

Cuando llega a la bodega de China la carga de un cliente final de un aliado con `dtd_entrega_cliente_final`,
y ese cliente no tiene dirección:

- **El correo le llega al aliado**, no al cliente final:
  - Dice: «Tu cliente FA-1232 tiene mercancía en nuestro almacén y no tenemos su dirección de entrega».
  - **No lleva el enlace de §4.4 y nunca genera uno.** Generarlo revocaría el que el aliado quizá ya le
    mandó al cliente, y el token en claro no se puede recuperar.
  - En su lugar, lleva un botón a la ficha del cliente en el portal del aliado («Cargar dirección o
    mandar enlace»), cuando exista (0666 P2).
  - Mientras ese portal no exista, el correo dice: «Escríbenos para que te mandemos el enlace». La oficina
    genera el enlace a mano desde la lista de §4.3.
- Por cada cliente, el correo dice si ya hay un enlace vigente, y desde cuándo: «Enlace enviado el 18/11,
  vence el 02/12». Así el aliado sabe si tiene que reenviarlo o pedir uno nuevo.
- Se decide al enviar, como en la 0694 §4.5: si la dirección se cargó en el medio, el cliente no sale en
  el correo.
- Se agrupa por aliado: un correo al día con todos sus clientes sin dirección, no uno por caja.
- No lleva el nombre del cliente final, solo el código impreso: el aliado ya sabe quién es.
- Con `retira_aliado` no sale ningún aviso por los clientes finales. Solo cuenta la dirección del aliado,
  con el aviso normal de la 0694.

### 4.6 Exigir la dirección

La 0694 §4.6 exige la dirección en la primera compra o prealerta del portal. Para un cliente final:

- se exige solo si su aliado tiene `dtd_entrega_cliente_final`;
- si la prealerta la crea el aliado a nombre del cliente (0666 P3), el paso «¿Para quién es?» pide la
  dirección o ofrece «Mandarle el enlace»;
- **la prealerta no se bloquea**, porque el aliado puede no tenerla todavía, pero queda marcada «Sin
  dirección» y entra en el aviso de §4.5. *Recomendado:* no bloquear (P-4).

### 4.7 Lo que se enmienda en la 0666 y la 0255

Esto se aplica cuando Sam apruebe esta spec, con una nota de cambio en cada una:

- **0666 §2.1**, fila «Entrega en Venezuela»: apunta a esta spec (§4.1).
- **0666 §4.3**, última viñeta: el aliado no reporta pagos, pero **sí** carga direcciones de entrega de sus
  clientes, solo por la RPC de §4.3.
- **0666 §6.2, D2**: la dirección se pide solo con `dtd_entrega_cliente_final`.
- **0255 §8.4**: queda la misma nota.

## 5. Fases

| Fase | Qué entra | Migración | Requisitos |
|---|---|---|---|
| F-0 | Esta spec. | No | La aprobación de Sam. |
| **F-1** | `aliados.entrega_ve` en la tarjeta del aliado; `destinoDeEntrega` en el chofer y el despacho; la lista «Clientes sin dirección de entrega» en la ficha del aliado. | Sí | La 0694 F-1 (el helper). **No depende de la 0666 ni trata datos nuevos**: la oficina ya carga direcciones. |
| F-2 | El enlace de §4.4, generado desde el Studio, y su página pública con la marca del aliado. | Sí | La cláusula de la 0255 §8.5, el texto legal de P-7 y el dominio de P-2. |
| F-3 | El aviso diario al aliado (§4.5). | No | **La F-2**, porque el correo dice si cada cliente tiene un enlace vigente, y eso sale de `client_address_links`. También la F-1 y la 0694 A-1 (el mismo punto de la recepción). El correo nunca genera ni lleva enlaces (§4.5). |
| F-4 | En el portal del aliado: «Dirección de entrega» por cliente (con lectura y alta por RPC), «Mandarle el enlace» y el paso de la prealerta (§4.3 y §4.6). | Sí (las dos RPC) | La 0666 P2 y P3, la F-2 y la cláusula de la §8.5. |

## 6. `revisar-datos-ve` aplicado

Esto no es asesoría legal. Estados posibles: `ENCONTRADO`, `CORRECTO` y `NO VERIFICABLE`.

**Inventario:**

| Dato | Quién lo da | Finalidad | Quién lo ve |
|---|---|---|---|
| La dirección de entrega del cliente final: calle, ciudad, estado y referencia | El aliado (§4.3) o el propio cliente con el enlace (§4.4) | Entregarle la carga en Venezuela, solo con `dtd_entrega_cliente_final` | La oficina, el chofer y el aliado de su cadena. No el equipo de China (SDD-0531) ni el proveedor (`/p`) |

**Hallazgos:**

1. **Consentimiento.** `ENCONTRADO`: cuando la carga el aliado, es un dato de un tercero. Rige la 0666 D1:
   sin la cláusula de la 0255 §8.5 (el aliado declara que tiene el consentimiento y responde por él), ni la
   F-2 ni la F-4 salen. La F-1 no agrega datos: la oficina ya los carga hoy.
2. **Recogida directa.** `NO VERIFICABLE`: cuando el cliente final llena el enlace, entrega su dirección a
   un sistema operado por DTD bajo la marca del aliado, y la 0666 dice que el cliente final no ve ninguna
   política de DTD. Hay que decidir qué aviso de privacidad lleva el formulario (P-7). Lo ve el abogado de
   Sam antes de la F-2.
3. **Minimización.** **Diseño** (se verifica cuando el formulario exista):
   - solo se piden los campos de la dirección, y solo cuando DTD entrega;
   - el enlace no muestra el nombre, el teléfono ni la carga;
   - `ENCONTRADO`: el enlace muestra el código impreso (`FA-1232`), y ese código **revela el prefijo del
     aliado** a quien tenga el enlace. Se acepta porque el cliente final ya ve ese código en sus etiquetas
     (0666 §2.3) y el enlace solo lo recibe él. Si Sam prefiere no mostrarlo, la página dice «tu carga» sin
     código.
4. **Supresión.** Rige la 0666 D3. Las direcciones caen con la ficha (`on delete cascade`, `0198:26`).
   Los enlaces usados se pueden borrar a los 30 días: guardan solo el hash y el id.
5. **China.** `CORRECTO`, si las RPC y la lista nuevas pasan por `privacidad-cn.ts`. Lo exige la aceptación 6.
6. **Seguridad del enlace.** Diseño de §4.4:
   - el token es de un solo uso y la base guarda solo su hash;
   - el consumo es atómico;
   - las RPC solo las ejecuta service_role;
   - la marca falla cerrado;
   - la respuesta es la misma para todo enlace inválido;
   - el límite de intentos vive en la base y guarda el hash del origen, no la IP;
   - las cabeceras son `no-store` y `no-referrer`;
   - el token no va a los logs.

## 7. Aceptación verificable

1. **F-1, modo.** Con `retira_aliado`, el chofer ve la dirección del aliado y la etiqueta «Retira el aliado».
   Con `dtd_entrega_cliente_final`, ve la del cliente final. Un subaliado sin modo propio hereda el del raíz.
   Con pruebas unitarias del helper y una `.test.sql` de la columna.
2. **F-1, lista.** La ficha del aliado lista solo a los clientes de su cadena sin dirección, y solo con
   `dtd_entrega_cliente_final`. Un usuario de la región `cn` no ve nombres.
3. **F-2, enlace.** Hay pruebas para:
   - **La marca.** Abrir el enlace muestra la marca del aliado y ningún texto, logo ni color de DTD: una
     prueba busca «DTD» en el HTML renderizado. Hay tres casos que fallan cerrado y en los tres la página
     sale neutra, nunca la de DTD: `hide_dtd_brand = false`, una cadena rota y un error simulado de la
     consulta de la marca.
   - **Lo que escribe.** Guardar crea la predeterminada en la ficha del cliente del token y en ninguna otra.
     Un `.test.sql` siembra un cliente con dos direcciones (una predeterminada) y otro cliente con una, y
     comprueba lo siguiente:
     - después de `_complete`, el cliente del token tiene una fila nueva predeterminada;
     - su predeterminada anterior solo cambió `is_default`;
     - ninguna fila cambió `line`, `deleted_at` ni `client_id`;
     - el otro cliente quedó igual;
     - fuera de `client_delivery_addresses`, solo cambiaron `client_address_links.used_at`, una fila de
       `client_address_link_attempts` y **un** evento en `entity_audit_log`;
     - el evento de auditoría no contiene la línea, la ciudad, la referencia, el token, su hash ni la
       clave del intento: el test busca esos textos en el `jsonb`.
   - **`_create` rechaza** (`.test.sql`):
     - a un `authenticated` sin rol del Studio ni rol `aliado`;
     - a un aliado con un cliente de otra cadena;
     - a cualquiera con un cliente directo de DTD;
     - a `anon`, que no la puede ejecutar (`has_function_privilege`).

     Con un rol del Studio, `created_via` queda en `studio`, y con el aliado, en `aliado`, aunque el que
     llama intente otra cosa: no hay parámetro para eso.
   - **El vencimiento.** Con el reloj simulado a 14 días y 1 minuto, el enlace responde como inválido. A los
     13 días y 23 horas todavía funciona.
   - **El doble envío.** En el `.test.sql`, dos `_complete` con el mismo token: solo uno inserta, y el
     otro recibe el error neutro. Queda una sola fila nueva.
   - **La misma respuesta.** Un segundo uso, un enlace vencido, uno revocado, uno inexistente y uno
     bloqueado responden igual, **en la carga y en el envío del formulario**. Una prueba compara las cinco
     respuestas con:
     - el mismo código HTTP;
     - las mismas cabeceras, sin contar `date`, el nonce de la CSP ni los ids de petición;
     - el mismo cuerpo **normalizado**: sin nonces, ids de React ni marcas de tiempo.
   - **El mismo trabajo.** Una prueba con las RPC simuladas comprueba que, en los cinco casos, el servidor
     llama a `_peek` en la carga y a `_complete` en el envío el mismo número de veces, también con el
     origen bloqueado, y que siempre pasa la clave del intento.
   - **El límite de intentos**, en `.test.sql` contra las RPC reales, no simuladas:
     - después de 5 fallos de una misma clave, `_peek` con un **token válido** devuelve cero filas;
     - **un origen bloqueado con un token válido por el envío:** `_complete` da el error neutro, no deja
       ninguna fila nueva en `client_delivery_addresses`, `used_at` sigue en null y no hay evento en
       `entity_audit_log`. El mismo token, con una clave no bloqueada, después funciona;
     - la tabla guarda el HMAC del origen, nunca la IP, no tiene `tenant_id` y solo la toca service_role.
   - **El acceso a las RPC.** `anon` y `authenticated` no pueden ejecutar `_peek` ni `_complete`: se prueba
     con `has_function_privilege`.
   - **Las cabeceras.** La respuesta de `/d/[token]` trae `Cache-Control: no-store` y
     `Referrer-Policy: no-referrer`.
   - **Los logs.** Una prueba captura `console.*` durante un uso válido y uno inválido, y busca el token en
     claro: no aparece.
   - **Regenerar** revoca el anterior.
   - **El hash.** La base guarda solo el hash. Contrato SQL con mutantes.
4. **F-3, aviso.**
   - Un aliado con dos clientes sin dirección y carga en la bodega recibe un solo correo con los dos
     códigos.
   - Si uno carga la dirección antes del envío, el correo lleva solo el otro.
   - Con `retira_aliado`, no sale ningún correo.
   - **El aviso no toca `client_address_links`:** después de enviarlo, el enlace vigente sigue vigente y
     el correo no trae ningún token. Una prueba compara la tabla antes y después.
5. **F-4, RPC.**
   - El aliado lee y agrega direcciones de un cliente de su cadena.
   - **Entre aliados:** el aliado A, con el `client_id` de un cliente del aliado B o de un cliente directo
     de DTD, recibe de las dos RPC la misma respuesta que con un id que no existe. Se prueba en
     `.test.sql` con dos aliados y sus cadenas.
   - La RPC de escritura solo inserta y mueve `is_default`: un `.test.sql` comprueba que no cambia `line`
     ni `deleted_at` de filas existentes (P-5).
   - Deja auditoría sin el texto.
6. **China.** Ninguna superficie nueva devuelve el nombre, el teléfono ni la dirección a un usuario `cn`
   que no sea admin.

## 8. Preguntas para Sam, una por una

- **P-1 (modo).** ¿Quién recibe la carga en Venezuela se decide por aliado, con la opción de cambiarlo para
  un cliente puntual? *Recomendado:* por aliado, con `retira_aliado` por defecto, y la excepción por
  cliente en una fase posterior si hace falta.
- **P-2 (dominio del enlace).** Mientras no esté montado `hailuway.com`, ¿el enlace puede salir de una
  dirección de DTD con la marca del aliado, o esperamos el dominio neutro? *Recomendado:* montar solo la
  ruta del enlace en `hailuway.com`, sin subdominio por aliado, para no mostrar DTD.
- **P-3 (enlace).** ¿El enlace es de un solo uso y vence a los 14 días? *Recomendado: sí,* y el aliado lo
  regenera cuando quiera.
- **P-4 (prealerta sin dirección).** Si el aliado crea una prealerta para un cliente sin dirección, ¿la
  bloqueamos o la dejamos pasar con el aviso? *Recomendado:* dejarla pasar, marcada, con el aviso diario.
- **P-5 (quién manda).** Si el cliente final ya cargó su dirección, ¿el aliado puede cambiarla?
  *Recomendado:* sí puede agregar otra y elegirla como predeterminada, pero no borrar la del cliente.
- **P-6 (subaliado).** Con `retira_aliado`, ¿la carga de un cliente de un subaliado la retira el subaliado
  o el raíz? *Recomendado:* el subaliado si tiene dirección, y si no, el raíz.
- **P-7 (legal).** ¿Qué aviso de privacidad lleva el formulario del enlace? ¿El del aliado, uno de DTD sin
  la marca o uno neutro? Esto lo decide tu abogado junto con la cláusula de la 0255 §8.5.

## 9. Archivos (allowlist provisional)

Se confirma en cada fase. Las migraciones las numera Dir_DTD.

- **F-0:** esta spec, `docs/specs/README.md` y `.agents/handoffs/2026-11-20-sdd-0696-cliente-final-aliado.md`.
- **F-1:**
  - `supabase/migrations/NNNN_aliados_entrega_ve.sql`, con su `.test.sql`;
  - `lib/studio/aliados/aliado-types.ts` y `lib/studio/client-address-queries.ts` (`destinoDeEntrega`);
  - `lib/studio/dispatch-mobile-queries.ts`;
  - `app/studio/(app)/clientes/_components/AliadoCard.tsx` y `app/studio/(app)/clientes/[markbox]/page.tsx`;
  - y sus pruebas.
- **F-2:**
  - `supabase/migrations/NNNN_client_address_links.sql`, con su `.test.sql`. Lleva la tabla, la de
    intentos y las RPC `_create`, `_peek` y `_complete`;
  - `app/d/[token]/**`, y `proxy.ts` si las cabeceras van ahí;
  - `.env.example` y `infra/dtd-cargo/.env.example` (`ADDRESS_LINK_ATTEMPT_SECRET`, sin valor);
  - `app/portal/(app)/perfil/PortalAddresses.tsx` (para reutilizar el formulario);
  - una acción en `app/studio/(app)/clientes/actions.ts`;
  - y sus pruebas.
- **F-3:**
  - `lib/studio/notifications/aviso-aliado-direcciones.ts`, que arma y agrupa el correo;
  - `app/api/cron/aliado-direcciones-pendientes/route.ts`, el disparo diario, con el mismo patrón que
    `app/api/cron/portal-cold-reminder/route.ts`;
  - y sus pruebas.
- **F-4:**
  - `supabase/migrations/NNNN_aliado_direcciones_rpc.sql`, con `aliado_list_client_delivery_addresses` y
    `aliado_add_client_delivery_address`, y su `.test.sql`;
  - las secciones del portal del aliado de la 0666 P2 y P3.
- **Al aprobarse:** las notas de cambio en `docs/specs/0666-portal-del-aliado/spec.md` y
  `docs/specs/0255-aliados-white-label/spec.md` (§4.7).

## 10. Clasificación de gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| SGE-00 | cumplimiento (diseño) | «Copiar enlace para el aliado» y «Cargar dirección» dicen qué hacen. |
| BTN-01 | cumplimiento (diseño) | Guardar la dirección usa `<ActionButton>`: «Guardar» → «Guardando…» → «Listo». |
| FRM-01 / ERR-01 | cumplimiento (diseño) | El formulario es el de Mi perfil. El enlace inválido da un mensaje neutro con su salida. |
| AUD-01 | cumplimiento (diseño) | Cada carga por el aliado (§4.3) o por el enlace (`_complete`, §4.4.2) deja un evento en `entity_audit_log` sin el texto de la dirección, que se prueba en la §7. |
| Privacidad CN (SDD-0531) | cumplimiento (diseño) | La lista, las RPC y el aviso no exponen datos a la región `cn`. |
| Marca blanca (SDD-0336, 0666) | cumplimiento (diseño) | La página del enlace no muestra nada de DTD. |
| Producción (AGENTS) | cumplimiento | No se leyó producción. |
