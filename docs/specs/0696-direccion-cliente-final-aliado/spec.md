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
> **Medición:** código de `main` en `e9a0aa2aa`. No se leyó producción. La consulta Q17 de la SDD-0695
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
| Marca blanca por cliente | `get_portal_brand()` (`0401`, cadena en `0451`) y SDD-0336 | La página del enlace puede mostrar la marca del aliado del cliente final. |
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
- Lo hace una RPC `security definer` nueva, `aliado_set_client_delivery_address`, con el mismo patrón de
  las RPC del aliado (0666 §4.3). La RPC:
  - deriva la identidad de `auth.uid()`;
  - exige el rol `aliado`;
  - comprueba que el cliente cuelga de la cadena del aliado que llama;
  - escribe en `client_delivery_addresses` y en nada más.
- No se abren las 12 políticas de escritura del portal (0255 §8.4): el aliado sigue sin poder reportar
  pagos ni tocar otra cosa.
- Si el cliente final ya cargó su dirección, el aliado la ve y puede agregar otra, pero no la borra (P-5).
- Cada cambio deja un evento en `entity_audit_log` sin el texto de la dirección:
  `{ campo: "delivery_address", origen: "aliado" }`.

### 4.4 Enlace para que el cliente final la llene

**La tabla.** Tabla nueva `client_address_links`, que copia el patrón de `client_registration_links`:

- token de 256 bits, del que la base guarda solo el sha256;
- un solo uso y 14 días de vigencia;
- regenerar el enlace revoca el anterior;
- `client_id`, `created_by` y `created_via`, que vale `studio` o `aliado`.

**Quién lo genera:**

- la oficina, desde la ficha del cliente final o desde la lista de §4.3, con «Copiar enlace para el
  aliado»;
- el aliado, desde su portal, cuando exista (0666 P2).

DTD no le escribe al cliente final: el enlace lo manda el aliado (0666 §2.1).

**La página pública** (`/d/[token]`; la dirección exacta depende de P-2):

- Lleva **la marca del aliado** del cliente final (`get_portal_brand()` por la cadena) y **nada de DTD**:
  ni logo, ni nombre, ni colores, ni pie.
- Muestra solo el código impreso del cliente (por ejemplo `FA-1232`) y el formulario. No muestra el
  nombre, el teléfono ni la carga: el token da permiso para dar una dirección, no para ver datos.
- El formulario es el mismo de Mi perfil (`PortalAddresses.tsx`), con la calle, la ciudad (del catálogo),
  el estado y el punto de referencia. No pide la cédula ni el correo.
- Al guardar, si el cliente no tiene ninguna dirección vigente, queda como predeterminada. Si ya tenía una,
  la nueva queda como predeterminada y la anterior sigue guardada: el cliente es el que mejor sabe dónde
  recibe.
- El enlace queda usado, y la página dice: «Listo. Tu aliado ya tiene tu dirección de entrega».
- Un enlace vencido, usado o revocado responde igual que uno que no existe: «Este enlace ya no está
  disponible. Pídele uno nuevo a tu aliado». No dice cuál de los casos es.
- Lleva un límite de intentos por IP, como las rutas públicas de registro.
- El aviso de privacidad del formulario depende de P-7.

### 4.5 Aviso al aliado

Cuando llega a la bodega de China la carga de un cliente final de un aliado con `dtd_entrega_cliente_final`,
y ese cliente no tiene dirección:

- le llega un correo **al aliado**, no al cliente: «Tu cliente FA-1232 tiene mercancía en nuestro almacén y
  no tenemos su dirección de entrega». Lleva el botón «Cargar dirección» (portal del aliado) o, mientras no
  exista, el enlace de §4.4;
- se decide al enviar, como en la 0694 §4.5: si la dirección se cargó en el medio, el aviso no sale;
- se agrupa por aliado: un correo al día con todos sus clientes sin dirección, no uno por caja;
- no lleva el nombre del cliente final, solo el código impreso, porque el aliado ya sabe quién es.

Con `retira_aliado` no sale ningún aviso por los clientes finales. Solo cuenta la dirección del aliado,
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
| F-3 | El aviso diario al aliado (§4.5). | No | La F-1, y la 0694 A-1 (el mismo punto del correo). |
| F-4 | En el portal del aliado: «Dirección de entrega» por cliente, «Mandarle el enlace» y el paso de la prealerta (§4.3 y §4.6). | Sí (la RPC) | La 0666 P2 y P3, y la cláusula de la §8.5. |

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
3. **Minimización.** `CORRECTO` en el diseño: solo los campos de la dirección, solo cuando DTD entrega, y
   el enlace no muestra datos del cliente.
4. **Supresión.** Rige la 0666 D3. Las direcciones caen con la ficha (`on delete cascade`, `0198:26`).
   Los enlaces usados se pueden borrar a los 30 días: guardan solo el hash y el id.
5. **China.** `CORRECTO`, si las RPC y la lista nuevas pasan por `privacidad-cn.ts`. Lo exige la aceptación 6.
6. **Seguridad del enlace.** El token es de un solo uso y se guarda en hash. La respuesta es igual para
   todos los casos inválidos, y hay límite por IP.

## 7. Aceptación verificable

1. **F-1, modo.** Con `retira_aliado`, el chofer ve la dirección del aliado y la etiqueta «Retira el aliado».
   Con `dtd_entrega_cliente_final`, ve la del cliente final. Un subaliado sin modo propio hereda el del raíz.
   Con pruebas unitarias del helper y una `.test.sql` de la columna.
2. **F-1, lista.** La ficha del aliado lista solo a los clientes de su cadena sin dirección, y solo con
   `dtd_entrega_cliente_final`. Un usuario de la región `cn` no ve nombres.
3. **F-2, enlace.**
   - Abrir el enlace muestra la marca del aliado y ningún texto, logo ni color de DTD: una prueba busca
     «DTD» en el HTML renderizado.
   - Guardar crea la predeterminada en la ficha del cliente final.
   - Un segundo uso, un enlace vencido o uno revocado responden con el mismo texto.
   - Regenerar revoca el anterior.
   - La base guarda solo el hash. Contrato SQL con mutantes.
4. **F-3, aviso.** Un aliado con dos clientes sin dirección y carga en la bodega recibe un solo correo con
   los dos códigos. Si uno carga la dirección antes del envío, el correo lleva solo el otro. Con
   `retira_aliado`, no sale ningún correo.
5. **F-4, RPC.** El aliado escribe la dirección de un cliente de su cadena. Con un cliente de otro aliado o
   un cliente directo de DTD, la RPC rechaza. La RPC no toca otra columna ni otra tabla. Deja auditoría sin
   el texto.
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
  - `supabase/migrations/NNNN_client_address_links.sql`, con su `.test.sql`;
  - `app/d/[token]/**`;
  - `app/portal/(app)/perfil/PortalAddresses.tsx` (para reutilizar el formulario);
  - una acción en `app/studio/(app)/clientes/actions.ts`;
  - y sus pruebas.
- **F-3:** `lib/studio/notifications/` (el aviso al aliado), con sus pruebas.
- **F-4:**
  - `supabase/migrations/NNNN_aliado_set_client_delivery_address.sql`;
  - las secciones del portal del aliado de la 0666 P2 y P3.
- **Al aprobarse:** las notas de cambio en `docs/specs/0666-portal-del-aliado/spec.md` y
  `docs/specs/0255-aliados-white-label/spec.md` (§4.7).

## 10. Clasificación de gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| SGE-00 | cumplimiento (diseño) | «Copiar enlace para el aliado» y «Cargar dirección» dicen qué hacen. |
| BTN-01 | cumplimiento (diseño) | Guardar la dirección usa `<ActionButton>`: «Guardar» → «Guardando…» → «Listo». |
| FRM-01 / ERR-01 | cumplimiento (diseño) | El formulario es el de Mi perfil. El enlace inválido da un mensaje neutro con su salida. |
| AUD-01 | cumplimiento (diseño) | Cada carga por el aliado o por el enlace se audita sin el texto. |
| Privacidad CN (SDD-0531) | cumplimiento (diseño) | La lista, las RPC y el aviso no exponen datos a la región `cn`. |
| Marca blanca (SDD-0336, 0666) | cumplimiento (diseño) | La página del enlace no muestra nada de DTD. |
| Producción (AGENTS) | cumplimiento | No se leyó producción. |
