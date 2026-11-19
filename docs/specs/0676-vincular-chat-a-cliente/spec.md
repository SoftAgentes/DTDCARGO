---
sdd: "0676"
title: "Vincular a cliente: un chat sin teléfono se une a mano a una ficha y se reconoce solo"
status: in-progress
author: "Claude Worker (Sam)"
created: 2026-11-18
updated: 2026-11-19
supersedes: null
superseded_by: null
related: ["0582", "0585", "0587", "0647", "0648", "0649", "0650"]
confidencialidad: interno
---

# SDD-0676 — Vincular a cliente desde la Ficha DTD

> **Decisiones 1 a 5 resueltas por Sam el 2026-11-18**, en la sesión del Subdirector de Chatwoot, literal: «Las cinco preguntas recomendadas, correcto en todas.» Es decir, la opción (a) en las cinco, incluida la 3 reformulada (absorber sin mover filas, reversible).
> **Estado al 2026-11-19.** Implementado en la #689 y corregido antes de aplicar en la #696. La migración 0566 está aplicada en producción el 2026-11-19 a las 12:05:23Z, con el OK nominal de Sam «OK, aplica 0566, 0565 y 0562» (md5 `d201a65bdc027b6a364285b7bc286097`, 56403 bytes, cuerpos vivos iguales; evidencia `/srv/ops/evidencias/apply-0566-dtd-cargo-20261119T120522Z`). Datos que me pasó el Director General: el md5 y los bytes los comprobé contra el archivo de `main`; el resto (hora, OK, evidencia) no lo verifiqué yo. Falta el smoke con Sam (runbook `chatwoot-ficha-dtd`) y el relleno de las uniones del portal que ya existían, que lleva un OK de Sam aparte. `CHATWOOT_FICHA_UNIR` no cambió.
> Etiquetas: **C** código leído · **D** documento del repo · **I** inferencia · **NV** sin verificar.

## 1. Pedido

Sam, 2026-11-18. Al registrarse, el cliente da teléfono y correo, pero no sus redes. A veces escribe por Instagram (o Messenger, TikTok) en vez de WhatsApp. La Ficha DTD solo reconocía por teléfono y mostraba «Sin ficha»: esa conversación quedaba suelta, sin Shipping Mark, sin segmento y sin su tarjeta en el CRM.

Pidió además (misma fecha, por el Subdirector): ver los canales de un cliente como chips en su ficha, una sola lista de conversaciones con el logo de cada canal, que la tarjeta de lead del contacto de Instagram quede dentro de la del cliente, y que la unión se haga en el ERP, reversible y auditada, **sin** usar la fusión de contactos de Chatwoot.

## 2. Lo que ya existía (no se rehace)

| Hecho | Fuente | Etiqueta |
|---|---|---|
| `chatwoot_contact_links` une un contacto de Chatwoot con una ficha, solo con ids. Un contacto es de una ficha; una ficha puede tener varios contactos. Unir y quitar a mano quedan en `entity_audit_log` con el actor real | `supabase/migrations/0554_chatwoot_contact_links.sql`, SDD-0650 F2 | C |
| La 0554 figura aplicada: el candado de migraciones tiene su entrada con fecha 2026-11-18 y no está entre las esperas | `supabase/migrations.lock.json`, `supabase/migrations-baseline.json` | D |
| La ficha del cliente lista las conversaciones de todos sus contactos unidos y deja unir (escribiendo el número de conversación) y quitar, a quien edita la Bandeja | `lib/studio/chatwoot/ficha-panel.ts`, `app/studio/(app)/clientes/conversaciones-actions.ts` | C |
| El cliente de una conversación salía **solo** del teléfono con ficha única | `chatwoot_registrar_evento` (0504), `crm_entrada_chatwoot` (0513), `marcarContactoErp` (SDD-0649) | C |
| El webhook une contacto y ficha cuando el teléfono cruza, solo con `CHATWOOT_FICHA_UNIR=1` | `lib/studio/chatwoot/union-ficha-manejador.ts` | C |
| El CRM admite una tarjeta por ficha, una por contacto y una `fuente` fija desde el alta | `supabase/migrations/0506_crm_modelo.sql` | C |

**El hueco:** la unión existía, pero nada del reconocimiento la consultaba, y desde el chat no había cómo crearla.

## 3. Decisiones de Sam (2026-11-18)

| # | Pregunta | Resuelto |
|---|---|---|
| 1 | Quién vincula | **(a)** Admin y Comercial: quien edita la Bandeja, igual que en la ficha del cliente. Soporte solo ve |
| 2 | Contacto ya unido a otra ficha | **(a)** Se avisa a cuál y se permite «Mover aquí» con confirmación y un motivo escrito, auditado en las dos fichas |
| 3 | Tarjeta de lead que ya tenía ese contacto | **(a)** Se **absorbe** en la del cliente sin mover filas: reversible |
| 4 | Qué ve quien busca | **(a)** Shipping Mark, nombre y los últimos 4 dígitos del teléfono; mínimo 3 caracteres, 8 resultados |
| 5 | Motivo al vincular | **(a)** Automático: «Vinculado desde la conversación N» |

## 4. Diseño

### 4.1 La identidad del canal es el contacto de Chatwoot

Chatwoot ya amarra el id de Instagram o de Messenger a su contacto. Studio guarda el **id del contacto** (lo que ya hacía la 0554) y, nuevo, el **canal** (`whatsapp`, `instagram`, `messenger`, `tiktok`, `correo`, `otro`). No se copia al ERP el id ni el usuario de la red: no hace falta para reconocer a la persona.

No se usa la fusión de contactos de Chatwoot: es irreversible. Los hilos de cada canal quedan separados; se unifica la persona en el ERP.

### 4.2 El botón, en una conversación «Sin ficha»

1. **Buscar** por Shipping Mark, nombre o teléfono. Cada resultado muestra el código, el nombre y «Teléfono termina en 0142».
2. **Elegir** y **confirmar**, con el código y el nombre a la vista.
3. La ficha se vuelve a pedir y ya sale completa.

Si el chat ya está unido a otra ficha, se dice a cuál (si esta persona puede verla) y el botón pasa a «Mover aquí», que exige un motivo escrito.

El contacto no viaja desde el navegador: el servidor lo lee de la conversación con el token del propio agente. Si Chatwoot no le muestra esa conversación, no se vincula nada.

### 4.3 Reconocimiento automático: unión primero, teléfono después

| Pieza | Antes | Ahora |
|---|---|---|
| Ficha DTD y `chatwoot_conversations.client_id` (`chatwoot_registrar_evento`) | Teléfono con ficha única | La unión del contacto; si no hay, el teléfono con ficha única; si tampoco, **se conserva** el cliente que la conversación ya tenía. Ningún evento automático deja una conversación sin cliente (§4.9) |
| Tarjeta del CRM (`crm_entrada_chatwoot`, `crm_asesor_desde_chatwoot`) | Teléfono | La unión; si no hay, el teléfono. La actividad de un contacto vinculado cae en la tarjeta del cliente |
| Segmento y Shipping Mark en el contacto (`marcarContactoErp`, SDD-0649) | Solo bandejas de WhatsApp, por teléfono | En WhatsApp, la unión manda sobre el teléfono. En las demás bandejas, solo si el contacto está unido |

No cambia `clasificarContacto` (la redirección del número de leads): Instagram no pasa por esa bandeja.

### 4.4 La tarjeta de lead se absorbe, no se mueve

- La tarjeta del lead recibe una marca (`absorbida_en` → la tarjeta del cliente) y **sale de los tableros**. Su historial de etapas, sus notas y sus tareas siguen colgando de ella.
- La ficha de la tarjeta del cliente los muestra en un bloque «Antes, como lead de Instagram», solo para leer.
- Si el cliente no tenía tarjeta, se crea la suya con la fuente del lead y la etapa que da su segmento.
- **Dueño:** el de la tarjeta del cliente. Si no tiene, el asesor de la ficha; si tampoco, el del lead.
- **Logos:** la tarjeta del cliente lleva el de su fuente y el de los otros canales vinculados a su ficha.
- Al absorber se le quita a la tarjeta del lead `phone_last10` (el teléfono ya vive en la ficha, y así el alta web no la confunde con un lead suelto). El nombre visible se conserva.

### 4.5 Deshacer

«Quitar» en la ficha del cliente (o «Mover aquí» desde otra conversación):

- borra la unión y deja la salida en `entity_audit_log`, con el motivo;
- deja sin ficha, en el mismo momento, las conversaciones de ese contacto (y solo esas), y la auditoría dice cuántas;
- quita la marca: la tarjeta del lead **vuelve a su tablero, en la etapa donde estaba**, con su historial intacto;
- en un contacto que no es de WhatsApp, borra el segmento y el Shipping Mark que Studio le había puesto en Chatwoot.

Lo que no se revierte: el asesor que la tarjeta del cliente heredó del lead, y el `phone_last10` de la tarjeta del lead (lo repone su siguiente mensaje). Las dos cosas quedan en la auditoría o se reponen solas.

Borrar la ficha (borrado lógico) quita sus uniones, como ya hacía la 0554, y ahora también suelta las tarjetas que había absorbido.

### 4.6 La ficha del cliente

«Canales vinculados»: un chip por contacto unido, con el logo y el nombre del canal, cómo se unió y «Quitar». «Unir un chat a esta ficha» pasa a llamarse «Vincular otra red» y guarda el canal. La lista de conversaciones no cambia: ya juntaba las de todos los contactos.

### 4.7 Si la migración no está aplicada

El código tolera su falta: el cruce vuelve solo al teléfono, el tablero se lee sin filtrar absorbidas, los chips salen sin logo y «Vincular» une con la RPC de la 0554 (sin canal ni absorción). «Mover aquí» responde que falta la migración. Detalle en la espera (`supabase/migrations-baseline.json`) y en `supabase/pending-migration-symbol-declarations.json`.


### 4.8 Para la revisión: quién vincula, RLS y desarme

**Quién puede vincular (dos capas, las dos obligatorias).**

| Capa | Qué comprueba | Dónde |
|---|---|---|
| Servidor de Studio | `moduleEditGate("bandeja")` al entrar a cada acción; después que la sesión **edite** la Bandeja, **vea** Clientes y sea del tenant dueño de la cuenta de Chatwoot (`CHATWOOT_TENANT_ID`) | `app/studio/(app)/bandeja/vincular-actions.ts` y `puedeVincularContacto`, en `lib/studio/chatwoot/vincular.ts` |
| Servidor de Studio | Que Chatwoot le muestre esa conversación **al propio agente**: el contacto y el canal se leen con su token, nunca llegan del navegador | `obtenerConversacion`, en `lib/studio/chatwoot/account-api.ts` |
| Base | `chatwoot_vincular_contacto` y `chatwoot_quitar_union` llaman a `chatwoot_contact_links_actor_puede` (0554): usuario activo en ese tenant y con edición de la Bandeja (`user_has_module('bandeja', true)`). Además exigen que la ficha sea de ese tenant y no esté borrada | Migración 0566 y 0554 |

Con los roles de hoy eso deja a **Admin y Comercial** (decisión 1 de Sam); Soporte ve la Bandeja y no la edita.

Lo que la base **no** repite: «ve Clientes». Esa parte vive solo en el servidor de Studio, y **sí hay** formas de editar la Bandeja sin ver Clientes: un desvío de rol (SDD-0252, `studio_role_module_overrides`) o un acceso adicional por persona (SDD-0622; la SDD-0675 propone usarlo para la Bandeja). Por eso las **cuatro** acciones que vinculan o desvinculan pasan por `puedeVincularContacto`: las dos de la Ficha DTD (`buscarClientesParaVincular`, `vincularContactoDeConversacion`) y las dos de la ficha del cliente (`unirChatAction`, `quitarUnionAction`, en `app/studio/(app)/clientes/conversaciones-actions.ts`). Estas dos últimas solo exigían editar la Bandeja hasta la revisión del 2026-11-18; como ahora también absorben y sueltan la tarjeta del CRM, se les sumó el mismo candado, con pruebas (desvío de rol y acceso por persona). Queda como límite conocido que la base no lo repite: las funciones no se pueden llamar desde el navegador (ver abajo), así que el único camino es el servidor de Studio.

**Quién puede llamar a las funciones.** Todas las de la 0566 quitan el permiso a `public`, `anon` y `authenticated`. Las que usa el servidor (`chatwoot_vincular_contacto`, `chatwoot_quitar_union`, `chatwoot_ficha_de_contacto`, `chatwoot_registrar_evento`, `crm_entrada_chatwoot`, `crm_asesor_desde_chatwoot`) quedan solo para `service_role`. Las internas (`crm_absorber_tarjeta_de_contacto`, `crm_soltar_tarjeta_de_contacto`) no quedan para nadie: solo las llaman las anteriores, que son `security definer` con `search_path` vacío. El servidor crea el cliente de servicio **después** del candado y pasa explícitos el tenant y el actor de la sesión; la función los vuelve a comprobar. El contrato lo prueba con un admin con sesión que llama directo por la API y recibe `42501` (bloque 9).

**RLS.** La 0566 no crea tablas ni políticas: agrega columnas a dos tablas que ya tenían RLS.

- `chatwoot_contact_links` (0554): lectura para `authenticated` de su tenant con acceso a la Bandeja; sin permiso de escritura para `authenticated` (solo `select`); todo para `service_role`. La columna `canal_chat` hereda esa política.
- `crm_tarjetas` (0506): las políticas no cambian. `absorbida_en` y `absorbida_at` se leen con la misma regla que el resto de la tarjeta; el tablero filtra `absorbida_en is null` en la consulta, no en la política. Una restricción impide que una tarjeta absorbida reciba ficha o se absorba a sí misma.
- Cruce de tenant: `chatwoot_ficha_de_contacto` filtra por tenant; el contrato comprueba que el mismo contacto visto desde otro tenant no es de nadie (4l), y que vincular a una ficha de otro tenant falla.
- «A qué ficha estaba unido» se lee con el cliente **de la sesión**, no con el de servicio: si esa persona no puede ver la otra ficha, el aviso no la nombra.

**Auditoría y carreras (revisión del 2026-11-18).**

- Vincular un contacto que **ya estaba unido** a esa ficha (por el webhook, por Kommo o a mano) y cuya tarjeta de lead seguía suelta responde «ya_estaba», absorbe la tarjeta y **lo audita** con el actor, el motivo y la tarjeta (`solo_absorcion` en el detalle). Si no había nada que absorber, no escribe auditoría: repetirlo no la duplica (contrato, bloque 10).
- **Doble clic:** dos llamadas a la vez no ven la fila de la otra; la segunda espera en la llave única. Si la primera unió a esa misma ficha, la segunda responde «ya_estaba» en vez de «unido a otra ficha». NO VERIFICABLE con una sola conexión: ni el contrato ni PGlite abren dos transacciones a la vez, así que esa rama está leída, no ejercida.
- **Ficha borrada:** el evento de auditoría lleva los ids de los contactos (como en la 0554) y ahora también los de las tarjetas que se soltaron (`tarjetas_soltadas`; contrato 8d).

**Desarme** (`0566_desarme`, en `supabase/desarmes/`; no es una migración y no se aplica sola).

- Devuelve a su cuerpo anterior, copiado literal, `chatwoot_registrar_evento` (0504, 13 parámetros), `crm_entrada_chatwoot` y `crm_asesor_desde_chatwoot` (0513), `chatwoot_quitar_union` y el disparador de ficha borrada (0554), y `chatwoot_portal_vincular` (0519).
- Suelta primero las tarjetas absorbidas (vuelven a su tablero) y después quita las funciones nuevas, las dos columnas de `crm_tarjetas` y `canal_chat`.
- No toca la auditoría ni las uniones, salvo las de origen `portal`, que **borra**: antes de la 0566 no existían, ese origen no cabe en el CHECK de la 0554 y el dato sigue completo en `chatwoot_portal_contactos`. Las conversaciones del portal conservan su cliente. Quita además `chatwoot_conversations.chat_contact_id`. No repone el `phone_last10` que se le quitó a una tarjeta al absorberla (lo repone su siguiente mensaje).
- **Se niega si hay uniones con canal guardado**: el canal se pierde con la columna y no se puede reconstruir. Para aceptarlo hay que escribir, en la misma transacción y antes del desarme, `set local dtd.desarme_0566_perder_canal = 'si';`. Las uniones siguen; solo dejan de mostrar el logo.
- Restaura los comentarios (`comment on function`) de las cuatro funciones que vuelven a su cuerpo anterior, copiados literal de la 0554, la 0513 y la 0504.
- Es repetible: correrlo dos veces no falla.
- Orden: el web de esta PR tolera la falta de la 0566, así que se puede desarmar sin despublicar. Un web **anterior** a esta PR llama a `chatwoot_registrar_evento` con 13 parámetros, que la 0566 sigue aceptando (4k).
- Ensayo: `lib/studio/__tests__/chatwoot-vincular-canal.migration.test.ts` aplica la 0566, desarma dos veces y comprueba que las funciones vuelven a la firma y al comentario anteriores, que no quedan tarjetas absorbidas y que, sin aceptar la pérdida del canal, el desarme se niega. Usarlo en producción exige OK nominal de Sam.

### 4.9 Corrección antes de aplicar: el chat del portal (2026-11-18)

Autorización de Sam, recibida en la sesión del Director General el 2026-11-18: «Ok, te encargo la corrección al 0566». La 0566 estaba fusionada y **sin aplicar**; se corrige en su propio archivo.

**El problema.** La primera versión dejaba una conversación sin cliente cuando un evento traía contacto, sin unión y sin teléfono. El chat del portal (SDD-0586, migración 0519) fija el cliente de sus conversaciones directo en `chatwoot_conversations`, sin teléfono y con su vínculo en otra tabla (`chatwoot_portal_contactos`). Como el webhook ya manda el contacto, el primer evento posterior a aplicar la 0566 le habría quitado el cliente a esas conversaciones.

**La solución, en dos reglas.**

1. **Un solo registro de vínculos.** `chatwoot_contact_links` vale también para el portal: `chatwoot_portal_vincular` (redefinida en la 0566, misma firma) deja ahí la unión del contacto, con origen y canal `portal`, auditada como del sistema. Esa unión no se quita ni se mueve a mano (la base responde `55000`; en la ficha del cliente su chip no trae «Quitar»): la pone el sistema y se va con la ficha.
2. **Ningún evento automático quita un cliente.** El orden es: unión del contacto → teléfono con ficha única → si no hay ninguno, se conserva el cliente que la conversación ya tenía. Solo dos acciones de una persona dejan una conversación sin cliente, y las dos lo auditan: quitar la unión (las conversaciones de ese contacto) y borrar la ficha (todas las de la ficha, unidas o cruzadas por teléfono).

**Decisiones tomadas al implementarla.**

| Decisión | Qué se hizo | Por qué |
|---|---|---|
| Teléfono que dejó de coincidir con una ficha | Se conserva el cliente (preferencia del Director General). Antes de la 0566 volvía a vacío | Cambiar el teléfono en la ficha no cambia de quién es el chat. Un teléfono que ahora cruza con **otra** ficha única sí la cambia, y una unión manda siempre |
| Saber de qué contacto es una conversación | Columna nueva `chatwoot_conversations.chat_contact_id`, que llenan el evento y el chat del portal | Sin ella, quitar una unión no puede tocar solo las conversaciones de ese contacto |
| Vincular y mover | Pasan a esa ficha, en el mismo momento, las conversaciones de ese contacto | No hace falta esperar al siguiente mensaje |
| Segmento y Shipping Mark en el contacto (SDD-0649) | El contacto del portal queda **excluido**, aunque esté unido | A Chatwoot solo van el nombre y el identificador del contacto del portal (SDD-0586, E10-D35) |
| Contactos del portal que ya existían | No se migran en la 0566: van en un archivo aparte, con conteo previo, idempotente y con OK de Sam aparte | Escribir filas en producción es otra autorización |
| Contacto del portal que alguien ya unió a mano a otra ficha | Ni la función ni el relleno lo tocan; el conteo lo informa | No se pisa una decisión de una persona ni se frena el envío del cliente |
| `chatwoot_portal_vincular_carga` (0524, la carga histórica ya hecha) | No se toca | Si se volviera a usar, sus contactos los recoge el relleno |

**Cambios de la revisión de la PR de la corrección (2026-11-18).**

- **El evento dice de dónde salió el cliente.** `chatwoot_registrar_evento` devuelve una cuarta columna, `origen_cliente`: `union`, `telefono` o `conservado`. Hacía falta porque ahora devuelve también el cliente conservado, y el manejador que une solo (`unirContactoAFicha`, SDD-0650 F2, apagado salvo `CHATWOOT_FICHA_UNIR=1`) tomaba cualquier cliente como «el teléfono cruzó con una ficha»: habría convertido cada conservación en una unión permanente, también la del portal. Ahora une **solo** con `telefono`, como pide la SDD-0650 («une solo con cruce único»). La función de antes de la 0566 no trae esa columna: su cliente solo sale del teléfono, y así se lee.
- **Ficha borrada.** El cliente que se conserva se revalida en el mismo `update`: una ficha borrada no se conserva. La ficha que el evento encuentra (por unión o por teléfono) se toma con `for share`, para que el evento y el borrado no se crucen: el que llega segundo espera al primero. Esa espera NO está ejercida por una prueba (pide dos transacciones a la vez); la revalidación sí (contrato 8h y 8i). Costo conocido de ese `for share` (segunda revisión, 2026-11-18): el evento espera lo que dure la otra transacción que tenga tomada esa ficha, y nada lo acota dentro de la función (el `lock_timeout` de la migración vale solo al aplicarla; en el webhook solo lo cortaría el tiempo máximo de sentencia que tenga el rol de servicio, que no medí). A la inversa, mientras dura el evento, que son milisegundos, la edición normal de esa ficha espera. No bloquea lecturas.
- **Orden de despliegue: el web primero, la 0566 después.** El web de esta corrección tiene que estar publicado antes de aplicar la 0566. Un web anterior trataría la unión del portal como una cualquiera: le escribiría el segmento y el Shipping Mark al contacto del portal en Chatwoot y le pondría «Quitar». Está escrito en la cabecera de la migración y en su espera.
- **Desarme.** Su guarda del canal guardado no cuenta las uniones del portal, y borrar esas uniones no se audita fila por fila: no es la decisión de una persona sobre un cliente y el dato sigue en `chatwoot_portal_contactos`.

**Mientras no se corra el relleno** el portal funciona igual: sus conversaciones conservan el cliente por la regla 2. Lo único que falta es el chip «Portal» en la ficha de los clientes antiguos y que quitar o mover no aplique a contactos sin unión.

**Menores de la segunda revisión, cerrados aquí:** la aserción 10d del contrato filtra por tenant, y la rama del doble clic completa el canal igual que la rama normal de «ya_estaba».

**Pruebas.** Contrato (`supabase/tests/0566_chatwoot_vincular_canal.test.sql`): 4i y 4m (un evento sin ficha conserva el cliente), 4n (la conversación guarda su contacto), 5g (mover), 6f y 6g (quitar), 8e a 8g (ficha borrada) y el bloque 11 entero (portal: 11a a 11h), 4o a 4s (de dónde salió el cliente) y 8h y 8i (una ficha borrada no se conserva). En PGlite, un mutante por cada regla, el ensayo del desarme con una unión del portal y el ensayo del relleno.

## 5. Datos personales (`revisar-datos-ve`)

Revisión acotada a esta pieza. Estados: `ENCONTRADO`, `CORRECTO`, `NO VERIFICABLE`. Resumen: 0 `ENCONTRADO`, 9 `CORRECTO`, 4 `NO VERIFICABLE`.

### 5.1 Inventario

| Campo | Qué es | Finalidad | Retención | Quién lo ve |
|---|---|---|---|---|
| `chatwoot_contact_links.canal_chat` (nuevo) | Canal por el que escribe un contacto unido | Pintar el logo sin llamar a Chatwoot | La de la unión: se borra al quitarla o al borrar la ficha | Quien abre la Bandeja en su tenant (RLS de la 0554) |
| `chatwoot_conversations.chat_contact_id` (nuevo) | Id del contacto de Chatwoot de cada conversación | Que quitar una unión deje sin ficha solo las conversaciones de ese contacto | La de la conversación | Quien abre la Bandeja en su tenant (RLS de la 0504) |
| Unión del contacto del portal en `chatwoot_contact_links` (origen `portal`) | Los mismos ids que ya guardaba `chatwoot_portal_contactos`: ficha y contacto | Un solo registro de vínculos; reconocer el chat del portal igual que los demás | La de la unión: se va con la ficha | Igual que las demás uniones (RLS de la 0554) |
| `crm_tarjetas.absorbida_en`, `absorbida_at` (nuevos) | Qué tarjeta de cliente absorbió a una de lead, y cuándo | Esconder la tarjeta duplicada y poder deshacer | La de la tarjeta | Admin y Comercial (RLS de la 0506) |
| Resultado de la búsqueda (no se guarda) | Shipping Mark, nombre y últimos 4 dígitos del teléfono de hasta 8 fichas | Que el agente elija a la persona correcta | Ninguna: vive en la respuesta | Quien edita la Bandeja y ve Clientes |
| `entity_audit_log` (filas nuevas del mismo tipo) | Quién vinculó, movió o quitó, con el id del contacto, el canal y el id de la tarjeta | Saber quién unió un chat a una ficha y por qué | La de `entity_audit_log` | Lo que ya dicta la auditoría del Studio |

No hay datos sensibles ni archivos. No entra al ERP el id ni el usuario de la red social. Titular que no es usuario del sistema: el lead que escribió por la red; su tarjeta sigue con la regla de la D6 de la SDD-0587.

### 5.2 Puntos

| Punto | Estado | Evidencia |
|---|---|---|
| Minimización de la búsqueda | CORRECTO | Solo código, nombre y cuatro dígitos: `app/studio/(app)/bandeja/vincular-actions.ts:108`, `lib/studio/chatwoot/canal-union.ts:63`. Tope y mínimo: `vincular-actions.ts:72` y `:73` |
| Quién puede buscar y vincular | CORRECTO | Edición de la Bandeja al tope de las dos acciones: `vincular-actions.ts:91` y `:134`. Módulo encendido, módulo Clientes y tenant de Chatwoot: `vincular-actions.ts:83`, `lib/studio/chatwoot/vincular.ts:33`. La base repite al actor: `0566_chatwoot_vincular_canal.sql:362` |
| El contacto no lo elige el navegador | CORRECTO | Sale de la conversación leída con el token del agente: `vincular-actions.ts:162`; el agente del contexto es el de la sesión: `vincular-actions.ts:154`; solo salen el id y el tipo de bandeja: `lib/studio/chatwoot/account-api.ts:92` |
| Auditoría de vincular, mover y quitar | CORRECTO | `0566_chatwoot_vincular_canal.sql:468` (vincular), `:397` (absorción de una unión que ya existía) y el bloque de mover sobre la ficha anterior; quitar conserva la de la 0554 y suma la tarjeta restaurada. Sin nombres: contrato `supabase/tests/0566_chatwoot_vincular_canal.test.sql`, aserción 3j |
| No mover sin confirmación | CORRECTO | `0566_chatwoot_vincular_canal.sql:416`; el motivo escrito lo exige la acción: `vincular-actions.ts:147` y su validación previa |
| A qué ficha estaba unido | CORRECTO | Se lee con la sesión (RLS de la 0554 y de `clients`) y con el tenant: `vincular-actions.ts:196`. Si esta persona no la ve, no se nombra |
| Logs | CORRECTO | Solo códigos: `vincular-actions.ts:113`, `:159`, `:165` y `:185`; `conversaciones-actions.ts:173` |
| Vincular a la ficha equivocada revela datos de otra persona | CORRECTO (mitigado) | Confirmación con código y nombre: `app/studio/(panel)/ficha-chat/_components/VincularCliente.tsx:126`. Se deshace desde la ficha: `ConversacionesFichaCard.tsx:264`. Al quitar se limpian los atributos del contacto: `conversaciones-actions.ts:173`. El bot nunca afirma «eres cliente» (SDD-0586) |
| Aislamiento por tenant | CORRECTO | `chatwoot_ficha_de_contacto` filtra unión y ficha por tenant; contrato, aserciones 2c, 2d y 4l |
| Borrado contra una base real | NO VERIFICABLE | La lógica de quitar y de ficha borrada se ve correcta en el contrato (bloques 6 y 8), pero no se probó contra producción ni contra el entorno de prueba. La migración no está aplicada |
| Retención del nombre visible de una tarjeta absorbida | NO VERIFICABLE | Se conserva para poder deshacer. La anonimización de 12 meses (D6 de la SDD-0587) solo toca tarjetas en «Perdido»: una absorbida en otra etapa no se anonimiza mientras dure la unión. **Pendiente de Sam** (§9) |
| Atributos viejos en un contacto de otra red tras borrar la ficha | NO VERIFICABLE | Al borrar una ficha, el segmento y el Shipping Mark de un contacto de Instagram no se limpian solos: fuera de WhatsApp nadie los corrige con el siguiente mensaje. **Pendiente de Sam** (§9) |
| Qué ve un Agente de Chatwoot | NO VERIFICABLE | El segmento y el Shipping Mark en el contacto los ve todo usuario de la cuenta de Chatwoot (medido en la SDD-0649). Esta pieza los extiende a contactos de otras redes: mismo riesgo, más contactos |

Chatwoot y Studio corren en el servidor propio. La pieza no llama a terceros y no usa IA. Conviene que otro modelo revise el mismo diff. Esto no es asesoría legal.

## 6. Gobernanza

| Política | Clasificación | Nota |
|---|---|---|
| Acción y auditoría (BTN-01, AUD-01) | cumplimiento | Vincular, mover y quitar auditados con el actor real; `ActionButton` con anti doble envío |
| Formulario, error y carga (FRM-01, ERR-01, LOD-01) | cumplimiento | Estado de la búsqueda en `role="status"`; errores con `Aviso`; etiqueta con `htmlFor` |
| Búsqueda y teclado (BUS-01, A11Y-01) | cumplimiento | Resultados como botones de 36 px o más; foco al abrir |
| Componentes (CMP-01) | cumplimiento | `ActionButton`, `Aviso`, `CanalLogo`; ningún componente nuevo en el sistema |
| Marca: logos de terceros (SDD-0648, D1) | cumplimiento | Logos de 14 a 16 px, en el CRM y en la lista de canales de la ficha |
| Trazabilidad visual en la Ficha DTD | excepción | El panel vive fuera del layout del Studio y no tiene `ToastProvider`: el rastro es el botón en verde y la ficha que aparece |

## 7. Lista exacta de archivos

| Qué | Archivos |
|---|---|
| Migración, desarme y contrato | `supabase/migrations/0566_chatwoot_vincular_canal.sql` · `0566_desarme`, en `supabase/desarmes/` (sin la extensión: `spec-migration-refs.test.ts` toma todo `NNNN_nombre` con `.sql` como migración) · `supabase/tests/0566_chatwoot_vincular_canal.test.sql` · `lib/studio/__tests__/chatwoot-vincular-canal.migration.test.ts` |
| Espera y degradación (retiradas en el cierre del 2026-11-19) | `supabase/migrations-baseline.json` · `supabase/pending-migration-symbol-declarations.json` · `supabase/migrations.lock.json` (la migración sellada) |
| Reglas y servidor | `lib/studio/chatwoot/canal-union.ts` (nuevo) · `lib/studio/chatwoot/vincular.ts` (nuevo) · `lib/studio/chatwoot/account-api.ts` · `lib/studio/chatwoot/webhook-procesar.ts` · `lib/studio/chatwoot/contacto-erp-manejador.ts` · `lib/studio/chatwoot/ficha-panel.ts` |
| Acciones | `app/studio/(app)/bandeja/vincular-actions.ts` (nuevo) · `app/studio/(app)/bandeja/actions.ts` · `app/studio/(app)/clientes/conversaciones-actions.ts` |
| Ficha DTD | `app/studio/(panel)/ficha-chat/_components/VincularCliente.tsx` (nuevo) · `FichaDtdClient.tsx` · `FichaDtdView.tsx` |
| Ficha del cliente | `app/studio/(app)/clientes/_components/ConversacionesFichaCard.tsx` |
| CRM | `lib/studio/crm-tablero.ts` · `lib/studio/crm-tablero-queries.ts` · `lib/studio/crm-ficha.ts` · `app/studio/(app)/crm/tarjeta-actions.ts` · `app/studio/(app)/crm/_components/CrmTableroKanban.tsx` · `CrmEmbudosLista.tsx` · `TarjetaFichaDrawer.tsx` |
| Textos | `lib/i18n/es-VE/bandeja.ts` · `lib/i18n/zh-CN/bandeja.ts` |
| Pruebas | `app/studio/(app)/bandeja/__tests__/vincular-actions.test.ts` (nuevo) · `ficha-dtd-action.test.ts` · `app/studio/(panel)/ficha-chat/__tests__/VincularCliente.test.tsx` (nuevo) · `FichaDtdClient.test.tsx` · `lib/studio/chatwoot/__tests__/vincular-reconocimiento.test.ts` (nuevo) · `contacto-erp.test.ts` · `lib/studio/__tests__/crm-tablero-vinculos.test.ts` (nuevo) · `app/studio/(app)/clientes/__tests__/conversaciones-actions.test.ts` · `conversaciones-ficha-card.test.tsx` · `lib/studio/rbac-actions-guard.test.ts` |
| Documentos | esta spec · `docs/runbooks/chatwoot-ficha-dtd.md` · `.agents/handoffs/sdd-0676-vincular-chat-a-cliente.md` |

Fuera de esta lista no se toca nada.

## 8. Aceptación

El estado lo da el CI de la PR. `pnpm verify` local no se corre sin turno del Director General.

- [ ] En «Sin ficha», quien edita la Bandeja y ve Clientes ve «Vincular a cliente»; Soporte y los demás roles, no.
- [ ] La búsqueda devuelve como mucho 8 fichas, con código, nombre y cuatro dígitos; nunca el teléfono entero.
- [ ] Vincular usa el contacto que Chatwoot da para esa conversación al agente de la sesión; con otro agente, sin acceso o sin contacto, no escribe.
- [ ] Un chat unido a otra ficha no se mueve sin «Mover aquí» y un motivo de 4 caracteres o más.
- [ ] Vincular, mover y quitar dejan su fila en `entity_audit_log` con el actor real y sin nombres.
- [ ] Con el contacto vinculado y sin teléfono: la Ficha DTD sale completa, la actividad cae en la tarjeta del cliente y el contacto recibe su segmento y su Shipping Mark.
- [ ] La unión manda sobre el teléfono; una unión de otro tenant o a una ficha borrada no cuenta.
- [ ] La tarjeta del lead queda absorbida, no se pinta en el tablero y su historial se ve en la del cliente.
- [ ] Quitar la unión devuelve la tarjeta del lead a su tablero, en su etapa.
- [ ] La ficha del cliente muestra un chip por canal vinculado, con «Quitar».
- [ ] Sin la migración, nada se rompe: cruce por teléfono, tablero completo y unión como la 0554.
- [ ] Contrato SQL y PGlite en verde, con control rojo y mutantes.
- [ ] `/ui-check` hecho; CI de la PR en verde.

## 9. Pendiente de Sam y fuera de alcance

**Pendiente de Sam (no frena la PR):**

1. **Nombre visible de una tarjeta absorbida.** Se conserva para poder deshacer. Opciones: (a) dejarlo así · (b) borrarlo al absorber (deshacer devuelve la tarjeta sin nombre hasta el siguiente mensaje) · (c) anonimizar las absorbidas a los 12 meses de la absorción.
2. **Ficha borrada con chats de otras redes.** Hoy el segmento y el Shipping Mark de un contacto de Instagram quedan hasta que alguien lo vincule de nuevo. Limpiarlos al borrar la ficha pide un manejador del borrado (la misma pregunta D4 de la SDD-0649).
3. **`CHATWOOT_FICHA_UNIR`.** El chip de WhatsApp solo aparece si el contacto de WhatsApp tiene unión, y el webhook las crea solo con esa variable en `1`. Según el registro del Director General (2026-11-18) **no está encendida en producción** (no medido después); encender el panel de la SDD-0650 F2 (variable y token) es una decisión pendiente de Sam. Esta pieza no depende de ella: vincular a mano funciona con la variable apagada, que sigue siendo el valor por defecto.

**Fuera de alcance:**

- Rellenar el canal de las uniones anteriores (nace vacío; se llena al volver a vincular).
- Escribir el segmento y el Shipping Mark en el contacto en el momento de vincular: se escriben con su siguiente mensaje.
- Vincular desde la Bandeja de Studio fuera de la Ficha DTD.
- Fusión de fichas (SDD-0651) y fusión de contactos de Chatwoot (SDD-0644).

## 10. Puertas

Cada una con OK nominal de Sam, por el Director General:

1. Fusionar la PR (revisión independiente y CI en verde).
2. Aplicar `0566_chatwoot_vincular_canal` en producción, con el runbook `aplicar-migraciones-prod`. **HECHO el 2026-11-19 a las 12:05:23Z** (OK literal de Sam: «OK, aplica 0566, 0565 y 0562»). Ledger: version `20261119120523`, una sola fila, creada por `servidor-propio:psql:SDD-0676`, md5 `d201a65b…` y 56403 bytes (dato del Director General, según la verificación del apply). La espera quedó retirada y la migración sellada en el cierre (§6 del runbook de producción). **Orden real:** El web de la #696 **no** estaba publicado antes del apply: la publicación anterior fue `f0169eed9` a las 10:56Z y la #696 entró a las 10:58Z. Quedó migrate-first (la base nueva con el web anterior) y el web con la #696 se publicó después, en `a30e7ca38`. Dato del Director General; no lo medí yo. Con el web anterior y la 0566 aplicada hubo una ventana, desde el apply hasta esa publicación, en la que el web anterior podía escribir segmento y Shipping Mark al contacto del portal (solo si `CHATWOOT_ATRIBUTOS_CONTACTO=1`) y mostrar «Quitar» en el chip del portal. NV: si eso llegó a pasar; no se midió ni el valor de esa variable ni los contactos del portal en Chatwoot.
3. Smoke en producción según `docs/runbooks/chatwoot-ficha-dtd.md` («Smoke después de aplicar la 0566»): Sam con su WhatsApp y su Instagram secundarios. **PENDIENTE: no se ha hecho.**
4. Relleno de las uniones del portal que ya existían (`supabase/cargas/portal-uniones-0566/`). Escribe filas: lleva un OK nominal **aparte** del de la 0566. No es urgente (§4.9). **PENDIENTE.** Antes se corre el conteo de solo lectura (`conteo.sql`, en esa carpeta) y se le lleva a Sam.
