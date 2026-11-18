---
sdd: "0676"
title: "Vincular a cliente: un chat sin teléfono se une a mano a una ficha y se reconoce solo"
status: in-progress
author: "Claude Worker (Sam)"
created: 2026-11-18
updated: 2026-11-18
supersedes: null
superseded_by: null
related: ["0582", "0585", "0587", "0647", "0648", "0649", "0650"]
confidencialidad: interno
---

# SDD-0676 — Vincular a cliente desde la Ficha DTD

> **Decisiones 1 a 5 resueltas por Sam el 2026-11-18**, en la sesión del Subdirector de Chatwoot, literal: «Las cinco preguntas recomendadas, correcto en todas.» Es decir, la opción (a) en las cinco, incluida la 3 reformulada (absorber sin mover filas, reversible).
> Implementado en esta PR con la migración 0566 **en espera**: nada aplicado ni encendido en producción.
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
| Ficha DTD y `chatwoot_conversations.client_id` (`chatwoot_registrar_evento`) | Teléfono con ficha única | La unión del contacto; si no hay, el teléfono. Con contacto y sin unión ni teléfono, el cruce vuelve a vacío |
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

Lo que la base **no** repite: «ve Clientes». Esa parte vive solo en el servidor de Studio. Hoy no hay un rol que edite la Bandeja sin ver Clientes; si se crea uno (o un acceso por persona, SDD-0675), la base lo dejaría vincular y el servidor no. Es un límite conocido, no un hueco abierto: las funciones no se pueden llamar desde el navegador (ver abajo).

**Quién puede llamar a las funciones.** Todas las de la 0566 quitan el permiso a `public`, `anon` y `authenticated`. Las que usa el servidor (`chatwoot_vincular_contacto`, `chatwoot_quitar_union`, `chatwoot_ficha_de_contacto`, `chatwoot_registrar_evento`, `crm_entrada_chatwoot`, `crm_asesor_desde_chatwoot`) quedan solo para `service_role`. Las internas (`crm_absorber_tarjeta_de_contacto`, `crm_soltar_tarjeta_de_contacto`) no quedan para nadie: solo las llaman las anteriores, que son `security definer` con `search_path` vacío. El servidor crea el cliente de servicio **después** del candado y pasa explícitos el tenant y el actor de la sesión; la función los vuelve a comprobar. El contrato lo prueba con un admin con sesión que llama directo por la API y recibe `42501` (bloque 9).

**RLS.** La 0566 no crea tablas ni políticas: agrega columnas a dos tablas que ya tenían RLS.

- `chatwoot_contact_links` (0554): lectura para `authenticated` de su tenant con acceso a la Bandeja; sin permiso de escritura para `authenticated` (solo `select`); todo para `service_role`. La columna `canal_chat` hereda esa política.
- `crm_tarjetas` (0506): las políticas no cambian. `absorbida_en` y `absorbida_at` se leen con la misma regla que el resto de la tarjeta; el tablero filtra `absorbida_en is null` en la consulta, no en la política. Una restricción impide que una tarjeta absorbida reciba ficha o se absorba a sí misma.
- Cruce de tenant: `chatwoot_ficha_de_contacto` filtra por tenant; el contrato comprueba que el mismo contacto visto desde otro tenant no es de nadie (4l), y que vincular a una ficha de otro tenant falla.
- «A qué ficha estaba unido» se lee con el cliente **de la sesión**, no con el de servicio: si esa persona no puede ver la otra ficha, el aviso no la nombra.

**Desarme** (`0566_desarme`, en `supabase/desarmes/`; no es una migración y no se aplica sola).

- Devuelve a su cuerpo anterior, copiado literal, `chatwoot_registrar_evento` (0504, 13 parámetros), `crm_entrada_chatwoot` y `crm_asesor_desde_chatwoot` (0513), `chatwoot_quitar_union` y el disparador de ficha borrada (0554).
- Suelta primero las tarjetas absorbidas (vuelven a su tablero) y después quita las funciones nuevas, las dos columnas de `crm_tarjetas` y `canal_chat`.
- No toca las uniones ni la auditoría. No repone el `phone_last10` que se le quitó a una tarjeta al absorberla (lo repone su siguiente mensaje) ni el canal guardado (se pierde con la columna).
- Es repetible: correrlo dos veces no falla.
- Orden: el web de esta PR tolera la falta de la 0566, así que se puede desarmar sin despublicar. Un web **anterior** a esta PR llama a `chatwoot_registrar_evento` con 13 parámetros, que la 0566 sigue aceptando (4k).
- Ensayo: `lib/studio/__tests__/chatwoot-vincular-canal.migration.test.ts` aplica la 0566, desarma y comprueba que las funciones vuelven a la firma anterior y que no quedan tarjetas absorbidas. Usarlo en producción exige OK nominal de Sam.

## 5. Datos personales (`revisar-datos-ve`)

Revisión acotada a esta pieza. Estados: `ENCONTRADO`, `CORRECTO`, `NO VERIFICABLE`. Resumen: 0 `ENCONTRADO`, 9 `CORRECTO`, 4 `NO VERIFICABLE`.

### 5.1 Inventario

| Campo | Qué es | Finalidad | Retención | Quién lo ve |
|---|---|---|---|---|
| `chatwoot_contact_links.canal_chat` (nuevo) | Canal por el que escribe un contacto unido | Pintar el logo sin llamar a Chatwoot | La de la unión: se borra al quitarla o al borrar la ficha | Quien abre la Bandeja en su tenant (RLS de la 0554) |
| `crm_tarjetas.absorbida_en`, `absorbida_at` (nuevos) | Qué tarjeta de cliente absorbió a una de lead, y cuándo | Esconder la tarjeta duplicada y poder deshacer | La de la tarjeta | Admin y Comercial (RLS de la 0506) |
| Resultado de la búsqueda (no se guarda) | Shipping Mark, nombre y últimos 4 dígitos del teléfono de hasta 8 fichas | Que el agente elija a la persona correcta | Ninguna: vive en la respuesta | Quien edita la Bandeja y ve Clientes |
| `entity_audit_log` (filas nuevas del mismo tipo) | Quién vinculó, movió o quitó, con el id del contacto, el canal y el id de la tarjeta | Saber quién unió un chat a una ficha y por qué | La de `entity_audit_log` | Lo que ya dicta la auditoría del Studio |

No hay datos sensibles ni archivos. No entra al ERP el id ni el usuario de la red social. Titular que no es usuario del sistema: el lead que escribió por la red; su tarjeta sigue con la regla de la D6 de la SDD-0587.

### 5.2 Puntos

| Punto | Estado | Evidencia |
|---|---|---|
| Minimización de la búsqueda | CORRECTO | Solo código, nombre y cuatro dígitos: `app/studio/(app)/bandeja/vincular-actions.ts:107`, `lib/studio/chatwoot/canal-union.ts:63`. Tope y mínimo: `vincular-actions.ts:71` y `:72` |
| Quién puede buscar y vincular | CORRECTO | Edición de la Bandeja al tope de las dos acciones: `vincular-actions.ts:90` y `:132`. Módulo encendido, módulo Clientes y tenant de Chatwoot: `vincular-actions.ts:82`, `lib/studio/chatwoot/vincular.ts:33`. La base repite al actor: `0566_chatwoot_vincular_canal.sql:292` |
| El contacto no lo elige el navegador | CORRECTO | Sale de la conversación leída con el token del agente: `vincular-actions.ts:160`; el agente del contexto es el de la sesión: `vincular-actions.ts:152`; solo salen el id y el tipo de bandeja: `lib/studio/chatwoot/account-api.ts:92` |
| Auditoría de vincular, mover y quitar | CORRECTO | `0566_chatwoot_vincular_canal.sql:354` (vincular) y el bloque de mover sobre la ficha anterior; quitar conserva la de la 0554 y suma la tarjeta restaurada. Sin nombres: contrato `supabase/tests/0566_chatwoot_vincular_canal.test.sql`, aserción 3j |
| No mover sin confirmación | CORRECTO | `0566_chatwoot_vincular_canal.sql:326`; el motivo escrito lo exige la acción: `vincular-actions.ts:145` y su validación previa |
| A qué ficha estaba unido | CORRECTO | Se lee con la sesión (RLS de la 0554 y de `clients`) y con el tenant: `vincular-actions.ts:194`. Si esta persona no la ve, no se nombra |
| Logs | CORRECTO | Solo códigos: `vincular-actions.ts:112`, `:157`, `:163` y `:183`; `conversaciones-actions.ts:173` |
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
| Espera y degradación | `supabase/migrations-baseline.json` · `supabase/pending-migration-symbol-declarations.json` |
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
2. Aplicar `0566_chatwoot_vincular_canal` en producción, con el runbook `aplicar-migraciones-prod`. Recomendado antes de publicar el web.
3. Smoke en producción con una conversación de prueba, según `docs/runbooks/chatwoot-ficha-dtd.md`.
