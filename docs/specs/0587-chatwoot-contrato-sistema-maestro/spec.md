---
sdd: "0587"
title: "Contrato de sistema maestro por objeto y fase: Studio, Chatwoot y Kommo (E6 del programa SDD-0582, paso 6.1)"
status: approved
author: "Claude Worker «E6 contrato» (Sam)"
created: 2026-10-30
updated: 2026-10-30
supersedes: null
superseded_by: null
related: ["0582", "0585", "0586", "0043", "0084", "0106", "0143", "0157"]
confidencialidad: interno
---

# SDD-0587 — Contrato de sistema maestro (E6, paso 6.1)

> **Solo diseño.** Esta SDD no programa producto, no escribe migraciones y no toca producción, Kommo, Meta, el VPS ni Chatwoot. Fija las reglas que tienen que cumplir 6.2 a 6.7 y deja las decisiones abiertas para Sam. Puerta del paso: **OK de Sam** a este contrato.

Programa: [SDD-0582](../0582-chatwoot-piloto/spec.md) · checklist: [fila 6.1](../0582-chatwoot-piloto/checklist.md) · evidencia de E0: [registro](../0582-chatwoot-piloto/investigacion-2026-10-29-e0.md) y [guías](../0582-chatwoot-piloto/e0-guias.md).

**Etiquetas de evidencia** (las del programa): **C** código leído en esta tarea, **D** documento o proveedor, **T** medido en la cuenta de DTD, **I** inferencia, **NV** no verificado. Las citas de código son de la rama `codex/0582-e6-contrato` (base `a0fa04215`) salvo que digan otra rama. No se leyó ninguna fila de la base.

## 1. Punto de partida

### 1.1 Lo que el programa ya decidió

- **Dos números.** El nuevo atiende a leads y vive en Chatwoot desde 4.9. El actual atiende a clientes y sigue en Kommo hasta el corte (E8) (spec 0582, «Cambio de alcance v2»).
- **Regla de segmentos de 0.8** (Sam, 2026-10-30): **cliente** = algún envío vivo o recibo vivo en China con uno de sus códigos; **lead registrado** = está en `clients` y no es cliente; **lead nuevo** = no está en `clients` o su teléfono es ambiguo. Se calcula en el momento y no se guarda. Quien pierde su único envío vivo vuelve a lead.
- **La lógica vive en Studio, no en n8n** (spec 0582, «Decisión sobre n8n»).
- **Kommo fuera del ERP, sin rastro, al corte** (decisión 10 de Sam): exportar cifrado y borrar. Límite: migraciones aplicadas, Git y specs se quedan (spec 0582, «Límites de "sin rastro"»).
- **El bot responde en 1 mensaje** y Meta cobra cada mensaje de servicio después de 1.000 al mes por número desde el 2026-10-01 (V3-1, **D**).

### 1.2 Lo que Studio ya tiene (inventario, **C**)

| Pieza | Dónde | Qué importa para el contrato |
|---|---|---|
| Espejo de Kommo: 12 tablas `kommo_*` | Migraciones 0082–0391: `kommo_connections`, `kommo_pipelines`, `kommo_statuses` (0082:30-50, PK corregida en 0083:8-9), `kommo_custom_fields`, `kommo_contacts` (0082:71, teléfono en 0363:40-56), `kommo_leads` (0082:86, mensajes en 0391:51-54), `kommo_users` (0139:5), `kommo_unsorted` (0343:32), `kommo_lead_contacts` (0362:39), `kommo_tasks` (0390:45), `kommo_writeback_outbox` (0136:21), `kommo_writeback_echo` (0376:72) y `sync_logs` | **No hay tabla de leads propia de Studio.** Todo el CRM vive en el espejo. **No se espejan las notas ni las etiquetas**; los UTM no existen en ninguna columna |
| Vínculo cliente ↔ Kommo | `clients.kommo_lead_id` (0108:7-8, único parcial en 0108:30-32) y `clients.kommo_contact_id` (0342:34-35) | Se borran en 8.11 |
| Outbox ERP → Kommo, 8 operaciones | `0377_*.sql:55-64`: `patch_price`, `patch_stage`, `patch_lead`, `patch_contact`, `patch_owner`, `patch_tags`, `add_note`, `add_task` | Idempotencia por `<lead>:<op>` y `<lead>:<op>:<token>` (0377:75-77). El drenaje por pg_cron está **comentado** (0136:190); se drena «en caliente» desde el webhook |
| Etapas reales de Kommo | Embudo único `Ventas DTD`: `Incoming leads → Contacto inicial → Recontacto → Estimado enviado → Negociación → Logrado con éxito / Ventas Perdidos` (`docs/runbooks/kommo-consolidacion-embudo-unico.md:15-20`, ids en `:84-92`, leídos de la API el 2026-08-06, **D**) | Base del mapeo de etapas de §3 |
| Enrutador de Kommo | `decideRoute` en `supabase/functions/_shared/kommo-router.ts:85-111` | Trata como «cliente» a cualquiera en `clients`: lo reemplaza `chatwoot_segmento_contacto` de E10 |
| Módulo CRM | `/studio/crm`, módulo RBAC `kommo`; pestañas Dirección, Tablero, Asesor y Recuperación (`app/studio/(app)/crm/_components/kommo-tabs.shared.ts:21-26`); verbos en `crm/actions.ts`: convertir (62), mover etapa (439), reasignar (505), etiquetas (540), nota (589), tarea (627) | Es lo que 6.6 reemplaza. Todo lee y escribe `kommo_*` |
| Conversión lead → cliente | `convertLead` pone `registration_channel = 'kommo'` (`lib/studio/kommo-convert.ts:167-231`, `:216`) | Valor con «kommo» en datos vivos: se decide en la SDD de limpieza (§9) |
| Etapas desde el cotizador | `transitionStatus` encola `patch_price` y `patch_stage` (`app/studio/(app)/cotizador/actions.ts:339-352`) | En 6.6 pasa a mover la tarjeta propia |
| «Sin atender» | `leadsSinAtender` (`lib/studio/kommo-atencion.ts:77`), sobre `kommo_tasks` | **Sin consumidor fuera de pruebas** |
| Reporte por asesor | `commercialByAgent` (`lib/studio/reports/queries.ts:601-649`), usado en `app/studio/(app)/reportes/page.tsx:77` | Agrupa por `responsible_user_id` de Kommo |
| Asesor en Studio | `clients.advisor_id` (0151:28-29); `conversations.assigned_to` (0106:50) | No hay mapeo `kommo_users` ↔ usuarios de Studio |
| Conversaciones propias | `conversations` (0106:42-61) con `client_id` **obligatorio** (0106:45) y canal `whatsapp | email | portal` (0106:31) | No sirve para leads sin ficha. Sigue siendo la fuente de los tickets del portal (10.5) |
| Motor de flujos «N8N-lite» | 0143: `service_workflow_steps` y `workflow_step_runs`; eventos de envío, cotización, factura y oferta (`lib/studio/workflow/types.ts:114-143`) | **No tiene eventos de lead ni de conversación, ni reintentos** (`workflow-drain.ts:148-169`). No se usa para el CRM (§4.4) |
| Atribución | `/registro` guarda `?origen=` en `clients.registration_channel` (`app/registro/actions.ts:259`), con 3 valores admitidos (`lib/public/registro-origen.ts:27-33`); los UTM solo van a GA (`components/Analytics.tsx:120-130`) | No hay atribución guardada. 6.4 la crea |
| Cotizador | `quotes.prospect_whatsapp` y `source` (0113:31-35); el detalle cruza con el espejo de Kommo (`app/studio/(app)/cotizador/[code]/page.tsx:49-55`) | Ese cruce pasa a la tarjeta propia en 6.6 |
| Chatwoot en Studio (ramas sin integrar) | Rama `codex/0582-e2-poc`: `chatwoot_agent_links` (0503), `chatwoot_webhook_events` con eventos `message_created` y `conversation_status_changed` (0504:52-67) y `chatwoot_conversations` con `client_id` cuando el teléfono cruza con un solo cliente (0504:89-103). Rama `codex/0582-e10-enrutamiento`: `chatwoot_segmento_contacto(tenant, phone_last10)`, `chatwoot_respuestas_bot` y `chatwoot_contactos_bsuid` (0505:8-44) | Las tres migraciones están **sin aplicar**. El contrato se apoya en ellas y pide dos ajustes (§4.2) |

## 2. Fases

| Fase | Empieza | Termina | Qué cambia |
|---|---|---|---|
| **F1 · Piloto** | Hoy | El número de leads (4.9) recibe tráfico real | Chatwoot solo con el número de prueba. Kommo atiende todo lo real |
| **F2 · Paralelo** | 4.9 vivo | Instante de corte (8.2) | Los leads del número nuevo entran por Chatwoot. Los clientes, Instagram y Messenger siguen en Kommo hasta 8.2 y 8.3. La convivencia corta del número principal (4.5) ocurre aquí |
| **F3 · Después del corte** | 8.2 | Siempre | Kommo deja de recibir. El espejo y su código se van en 8.7–8.11 |

## 3. Sistema maestro por objeto y fase

«Maestro» = el sistema donde se crea y se corrige el dato; los demás solo lo leen o guardan una referencia. **Regla general: los mensajes viven en Chatwoot (y en Kommo hasta el corte); la relación comercial vive en Studio; Studio nunca guarda el texto de un mensaje.**

| Objeto | F1 · Piloto | F2 · Paralelo | F3 · Después del corte | Notas |
|---|---|---|---|---|
| **Cliente** (ficha, códigos, segmento) | Studio | Studio | Studio | El segmento se calcula en el momento con la regla de 0.8. Ni Chatwoot ni Kommo deciden quién es cliente |
| **Lead** (tarjeta comercial) | Kommo | Kommo para los que entran por Kommo; **Studio** para los que entran por Chatwoot, `/registro` o el portal | Studio | En F2 una misma persona puede tener tarjeta en Studio y lead en Kommo: ver conflictos en §5.3 |
| **Contacto** (persona en un canal: nombre, teléfono, username) | Kommo | Chatwoot para los contactos de sus bandejas; Kommo para los suyos | Chatwoot | Para quien tiene ficha, los datos de la ficha mandan sobre los del contacto. Studio no copia contactos a Chatwoot ni al revés (decisión D6 para el lead nuevo) |
| **Conversación** (mensajes, estado, notas privadas del chat) | Kommo | Chatwoot o Kommo, según el número o el receptor principal de Meta | Chatwoot (incluye el «Archivo Kommo» de E5) | Studio guarda solo estado e IDs (`chatwoot_conversations`, 0504), sin texto |
| **Etapa** | Kommo | Kommo para sus leads; Studio para sus tarjetas | Studio | Chatwoot no tiene embudo y no recibe etapas |
| **Tarea** | Kommo | Kommo para sus leads; Studio para sus tarjetas | Studio | Chatwoot CE no tiene tareas. Las abiertas de Kommo se migran en 6.5 |
| **Nota** | Kommo | Nota de tarjeta: Studio. Nota del chat: Chatwoot. Kommo para sus leads | Studio (tarjeta) y Chatwoot (chat) | **No se sincronizan notas en ningún sentido**: copiarlas sería duplicar texto con datos personales. Las de Kommo: decisión D5 |
| **Etiqueta** | Kommo | Etiquetas de segmento en Chatwoot: **Studio** (las pone E10 con la regla). Etiquetas manuales en Chatwoot: Chatwoot. Kommo para las suyas | Igual que F2, sin Kommo | Studio no importa las etiquetas manuales de Chatwoot. Las de Kommo se mapean o se descartan (D5) |
| **Asesor asignado** | Kommo (`responsible_user_id`) | Asesor de la tarjeta: Studio. Quien atiende el chat: Chatwoot | Igual que F2, sin Kommo | Son dos cosas distintas: dueño comercial y quien contesta. Ver §5.4 y D9 |
| **Fuente o atribución** | Nadie (los campos UTM de Kommo están vacíos, K-11) | Studio | Studio | Se fija al crear la tarjeta y no se pisa |
| **IDs de Kommo** | Kommo | Kommo; Studio los guarda en el espejo | Studio los guarda en la tabla de mapeo de 6.5 **hasta 8.11** | Por «sin rastro», el mapeo se exporta cifrado y se borra con las tablas `kommo_*`. En Chatwoot quedan los IDs que conserve el cargador de E5 (fuera del ERP) |
| **IDs de Chatwoot** (contacto, conversación, agente) | Chatwoot | Chatwoot | Chatwoot | Studio guarda referencias: `chatwoot_conversations`, `chatwoot_agent_links` y la tarjeta |

## 4. Los dos embudos (para 6.3)

### 4.1 Una tarjeta por persona, dos tableros

- **Una sola tarjeta por persona** en Studio, con `etapa_leads` y `etapa_clientes` guardadas. **En qué tablero aparece no se guarda:** sale del segmento calculado en el momento. Lead nuevo o registrado → tablero Leads; cliente → tablero Clientes.
- Así el paso de un tablero a otro **no necesita migración, marca ni cron**: cumple la regla de 0.8 de no guardar el segmento.
- **Llave de la tarjeta** (6.2 la hace única por tenant): `client_id` si hay ficha; si no, el contacto de Chatwoot; si no hay contacto (usuario solo con username), el BSUID de `chatwoot_contactos_bsuid`.
- Al registrarse un lead nuevo, la tarjeta se liga a la ficha si su teléfono (últimos 10) cruza con **una sola** ficha. Con cero o más de una, queda sin ligar, como E2-D19.

### 4.2 Dos ajustes que el contrato les pide a E2 y E10

1. **La regla de segmentos por `client_id`.** La función de E10 recibe un teléfono (0505:8-31). El tablero necesita calcularla por ficha y en conjunto. **Tiene que haber una sola definición de la regla:** se recomienda que la 0505, que no está aplicada, exponga un núcleo por `client_id` y que la versión por teléfono lo use. Si no llega a tiempo, 6.2 lo hace refactorizando, sin duplicar la regla.
2. **Eventos del webhook.** La 0504 solo admite `message_created` y `conversation_status_changed` (0504:56). 6.4 necesita además `conversation_created` (alta de la tarjeta) y `conversation_updated` (asignado y etiquetas). Que Chatwoot 4.19.1 los emita es **NV** en esta tarea; se confirma en `app/listeners/webhook_listener.rb`. Si la 0504 se aplica antes, 6.2 amplía el `check` con una migración propia.

### 4.3 Tablero Leads (etapas propuestas, decisión D1)

| # | Etapa | Viene de Kommo | Entra cuando | Sale cuando |
|---|---|---|---|---|
| 1 | **Nuevo** | Incoming leads (108343827) | Lead nuevo: primer mensaje por Chatwoot o alta desde la web | El asesor contesta o califica |
| 2 | **Contactado** | Contacto inicial (108343831) | Hubo respuesta del equipo | Se envía estimado, se pierde o pasa a recontacto |
| 3 | **Registrado / recontacto** | Recontacto (108343835) | Lead registrado que escribe, **o cliente que vuelve a lead** (§4.5) | Se envía estimado |
| 4 | **Estimado enviado** | Estimado enviado (108343839) | **Automático:** el cotizador marca el estimado `sent` | Aceptado, rechazado o vence el SLA |
| 5 | **Negociación** | Negociación (109855104) | Manual | Aceptado o perdido |
| 6 | **Aceptado, esperando carga** | Logrado con éxito (142), si aún no es cliente | **Automático:** estimado `accepted`. Convertir crea ficha y envío, pero un envío en `draft` no cuenta para la regla | **Sale solo del tablero** cuando aparece el primer envío vivo o recibo vivo en China |
| 7 | **Perdido** | Ventas Perdidos (143) | Estimado `rejected` o manual, con motivo obligatorio | Terminal. Si vuelve a escribir, pasa a 3 |

La etapa 6 es nueva: Kommo daba el lead por ganado al aceptar el estimado, pero con la regla de 0.8 la persona no es cliente hasta tener carga.

### 4.4 Tablero Clientes (etapas propuestas, decisión D2)

El estado operativo (en almacén, en tránsito, en aduana, entregado) **no se repite como etapa**: ya lo tiene el envío del ERP y la tarjeta lo muestra como insignia. El tablero sigue la relación comercial, como el bucle de recompra de [`embudo-ventas.md` §5](../../marketing/embudo-ventas.md).

| # | Etapa | Entra cuando |
|---|---|---|
| 1 | **Activo** | Entrada automática al volverse cliente, o al aceptar un estimado de recompra |
| 2 | **Postventa** | Manual, o automática al pasar su último envío a `delivered` |
| 3 | **Recompra pendiente** | Manual, o automática cuando vence la cadencia del cliente (si 6.6 la guarda) |
| 4 | **Recompra en curso** | Automática: estimado `sent` de un cliente |

### 4.5 Cambios de tablero automáticos

| Caso | Qué pasa | Por qué |
|---|---|---|
| Lead → cliente (primer envío vivo o recibo vivo en China) | La tarjeta deja de verse en Leads y aparece en Clientes en «Activo». `etapa_leads` se conserva como historia | Regla de 0.8 |
| **Cliente → lead** (pierde su único envío vivo y no tiene carga viva en China) | Vuelve a Leads en **«Registrado / recontacto»**, no en su etapa vieja (que sería 6 o anterior). `etapa_clientes` se conserva | Decisión de Sam en 0.8 («Vuelve a lead»). Recontactarlo es la acción útil |
| Lead nuevo → registrado | Sigue en Leads; si estaba en «Nuevo» o «Contactado» no se mueve: el registro no cambia lo que el asesor ya hizo | — |

Cada cambio de etapa, manual o automático, queda en un historial (`quién`, `cuándo`, `de`, `a`, `motivo`; sin texto de mensajes). Como el tablero se deriva en el momento, el cambio de tablero **no** es un evento guardado: se ve en el historial cuando 6.6 lo registre al detectarlo (I; el mecanismo lo fija 6.2).

## 5. Sincronización

### 5.1 Qué fluye y en qué sentido

| De → a | Evento | Qué hace | Paso |
|---|---|---|---|
| Chatwoot → Studio | `message_created`, `conversation_status_changed` (webhook firmado de 2.3) | Estado de la conversación y push (ya hecho en E2) | 2.3 |
| Chatwoot → Studio | `message_created` entrante en una conversación nueva, o `conversation_created` (§4.2) | Crea la tarjeta si no existe, en «Nuevo» o «Registrado / recontacto» según el segmento, con su fuente | 6.4 |
| Chatwoot → Studio | `conversation_updated` (asignado) | Si la tarjeta no tiene asesor, toma el agente vinculado (`chatwoot_agent_links`) | 6.4 |
| Studio → Chatwoot | Clasificación de E10 | Etiqueta de segmento, equipo y la respuesta de redirección en 1 mensaje | 10.2 |
| Studio → Studio | Estimado `sent`, `accepted`, `rejected` (cotizador) | Mueve la tarjeta (§4.3, §4.4) en vez de encolar `patch_stage` a Kommo | 6.6 |
| Studio → Studio | Alta en `/registro` | Crea o liga la tarjeta con fuente «web» y el `origen` | 6.4 |
| Studio → Studio | Ticket del portal (`conversations`, canal `portal`) | Crea o liga la tarjeta; tablero según el segmento | 10.5 |
| Kommo → Studio | Sync, webhook y writeback de hoy | **Sin cambios en F1 y F2** para los leads de Kommo. Se apagan en 8.7 | — |
| Studio → Kommo | — | **Nada nuevo.** Las tarjetas propias nunca se escriben en Kommo (D7 sobre el alta web) | — |

Studio **no** escribe en Chatwoot nombres, teléfonos, códigos ni notas. La Ficha DTD (2.4) los lee de Studio en el momento.

### 5.2 Idempotencia

- **Eventos de Chatwoot:** pasan por el registro de la 0504 con su clave semántica y su reintento (E2-D18, E2-D26). Los manejadores de 6.4 se suman a la lista de `procesarEventoChatwoot` (E2-D25) y tienen que poder correr dos veces sin efecto doble.
- **Alta de tarjeta:** inserción con la llave única de §4.1 y `on conflict do nothing`. Dos eventos a la vez no crean dos tarjetas.
- **Movimientos automáticos de etapa:** clave `<origen>:<id>:<estado>` (por ejemplo, el estimado y su estado) en el historial, única. Un evento repetido no mueve dos veces.
- **Carga de 6.5:** idempotente por ID de Kommo en la tabla de mapeo; correrla dos veces da el mismo resultado.

### 5.3 Conflictos

| Conflicto | Regla |
|---|---|
| Movimiento automático contra uno manual más reciente | **Gana el manual.** El automático solo se aplica si la tarjeta no se movió a mano después de la hora del evento (mismo criterio que el chequeo optimista del writeback, `_shared/kommo-writeback-plan.ts:155-180`) |
| La misma persona tiene tarjeta en Studio y lead abierto en Kommo (F2) | Cada sistema manda en lo suyo. La tarjeta muestra «también en Kommo» con el cruce por teléfono que ya existe (`findKommoContactsByPhone`, `lib/studio/kommo-convert.ts:136`). En 6.5, **la tarjeta de Studio gana la etapa**; las tareas abiertas y, si D5 lo decide, las notas del lead de Kommo se suman a la tarjeta |
| Teléfono que cruza con más de una ficha | No se adivina: la tarjeta queda sin ficha, como E2-D19 y 0505 |
| Contacto de Chatwoot con otro nombre que la ficha | Manda la ficha. No se corrige Chatwoot desde Studio |
| Evento viejo después de uno nuevo | La 0504 ya descarta el estado más viejo (`source_updated_at`); los movimientos usan la regla de la primera fila |

### 5.4 Asesor

- **Dueño comercial** (asesor de la tarjeta, Studio): para un cliente, por defecto `clients.advisor_id`; para un lead, el primero que lo atiende en Chatwoot (por el vínculo de `chatwoot_agent_links`). Cambiarlo es una acción de Studio.
- **Quien contesta** (asignado del chat, Chatwoot): se cambia en Chatwoot. Studio no lo pisa.
- Con Sam y 1 agente (E0-D2) los dos casi siempre coinciden; el contrato los separa para no tener que sincronizarlos (D9).
- **Kommo → Studio en 6.5:** `responsible_user_id` se traduce a un usuario de Studio **solo si el correo de `kommo_users` es el mismo** del usuario de Studio, como pide E2-D10. Si no, la tarjeta queda sin asesor.

## 6. Reemplazos de Kommo (para 6.6 y 6.7)

**Costo de Meta:** cada mensaje que sale del número cuenta contra los 1.000 gratis al mes por número; después, US$0,0113 por mensaje a +58 con la tarifa de enero de 2026 (**D**; la de octubre es **NV**). Un aviso interno en Studio cuesta 0. Fuera de la ventana de 24 h hace falta plantilla (precio por categoría **NV**).

### 6.1 Los 15 Salesbots (K-13: todos apagados)

| Bot | Hoy | Reemplazo | Costo de Meta |
|---|---|---|---|
| 38249 Bienvenida horario oficina | Sin disparador | Contenido a la base de conocimiento (7.4) | 0 (no envía solo) |
| 38711 Asignar asesor (Round Robin) | Sin disparador | Ninguno: 1 agente (E0-D2); el asesor se toma del primero que atiende (§5.4) | 0 |
| 38713 Solicitud de datos | Sin disparador | Ninguno: lo hace `/registro` | 0 |
| 38251 Carga marítima, 38773 Cursos, 38775 Asesorías, 38715 Validación de proveedores, 38771 Validación de mercancía | Sin disparador | Contenido a la base (7.4) | 0 |
| 38777 Atención al cliente | Sin disparador; imagen + cambio de etapa | Ninguno: el cambio de tablero es automático (§4.5) | 0 |
| 47639 NPS Bot | «Conversación cerrada»; nunca corrió | Ninguno en el 100 % | 0 |
| 54707 Chat del sitio | Vacío; nunca corrió | Ninguno | 0 |
| Ping 23 h — Leads Entrantes | 23 h tras el último entrante; escribe al cliente | **Alerta interna** en Studio: tarjeta en «Nuevo» o «Contactado» con el último mensaje entrante sin respuesta y la ventana por cerrar (D8) | 0 con la recomendación; 1 mensaje cobrable por ping si se automatiza el mensaje |
| Seguimiento antes de que cierre la ventana de 24 h (Contacto inicial) | Igual | Igual que el anterior | Igual |
| Ping 23 h — Recontacto | Igual | Igual, para «Registrado / recontacto» | Igual |
| Aviso interno — ventana de 24 h por cerrarse | Crea una tarea que vence en 1 h | Tarea o alerta en Studio, con la misma regla | 0 |

**Orden de magnitud de los pings (I):** K-13 cuenta 17, 368, 145 y 589 lanzamientos en total, sin saber a qué bot corresponde cada cifra ni en cuántos meses. Las respuestas de personas ya pasan los 1.000 gratis del mes (~1.960, spec 0582 «Corrección del supuesto de costos de Meta»), así que cada ping se cobra entero: si los ~1.100 fueran mensajes al cliente en un mes, serían ≈ US$12 (1.100 × 0,0113). Es poco, pero no aporta nada que una alerta interna no dé gratis. Por eso se recomienda la alerta (D8).

**Discrepancia (NV):** `e0-guias.md` dice que 3 de los 4 pings escriben al cliente; K-4 (documento de agosto) dice que 2. No cambia el reemplazo; 6.7 lo confirma al leer los bots.

### 6.2 Integraciones y piezas del ERP

| Pieza de Kommo | Reemplazo | Paso | Costo de Meta |
|---|---|---|---|
| `kommo-sync` (pull diario, pg_cron `kommo-sync-dtd`, 0084:52) | Ninguno: Studio es maestro. Corre hasta la extracción final de 8.5 | 8.7 | 0 |
| `kommo-webhook` (espejo en vivo, «volvió» y reapertura) | Webhook de Chatwoot (2.3) + manejadores de 6.4: quien vuelve a escribir pasa a «Registrado / recontacto» con tarea | 6.4 | 0 |
| `decideRoute` (enrutador) | `chatwoot_segmento_contacto` (E10) | 10.1–10.2 | Redirección: 1 mensaje cobrable por conversación cada 24 h como máximo (0505) |
| `kommo-writeback` y su outbox (8 operaciones) | Ninguno: Studio escribe en sus tablas directo. Mover, reasignar, etiquetar, notas y tareas pasan a verbos sobre la tarjeta | 6.6 | 0 |
| `kommo-push-client` (alta web → Kommo) | Tarjeta propia desde `/registro` | 6.4 | 0 |
| Cron `kommo-contact-status` (saldo y tránsito en el contacto de Kommo, `vercel.json:18-19`) | La Ficha DTD los muestra en el momento | 2.4 | 0 |
| Vista CRM: Dirección, Tablero, Asesor | Tableros de 6.3 y KPI de 6.6 sobre las tarjetas | 6.3, 6.6 | 0 |
| Recuperación (SDD-0157, CSV para SMS) | La misma salida sobre las tarjetas | 6.6 | 0 (no usa WhatsApp) |
| Conversión lead → cliente (`convertLead`) | Convertir desde la tarjeta: crea la ficha y la liga | 6.6 | 0 |
| Etapas desde el cotizador | Movimientos automáticos de §4.3 y §4.4 | 6.6 | 0 |
| Reporte por asesor (`commercialByAgent`) | Por asesor de la tarjeta | 6.6 | 0 |
| Alerta «sin atender» (`leadsSinAtender`, sin consumidor) | Alerta sobre las tareas de la tarjeta y el último entrante sin respuesta | 6.6 | 0 |
| 3 widgets NOVA (tintado de leads, «no es un lead activo», análisis de llamadas con IA, K-18) | Tintado = color por antigüedad en el tablero (6.3); «no es lead activo» = «Perdido» con motivo «no-fit»; análisis de llamadas: sin reemplazo (D10) | 6.3 | 0 |
| 4 agentes de IA, Copilot y respuesta sugerida | `dtd-bot` y respuesta sugerida | E7 | IA + 1 mensaje por turno |
| 5 plantillas aprobadas | Se recrean en la cuenta de mensajes de Chatwoot | 4.1, 4.5 | Por plantilla enviada (**NV**) |
| WhatsApp Lite, Google Business Messages, Twilio, Google (instaladas, K-18) | Si no se usan, ninguno. **Uso NV** (lectura L4) | — | — |
| Integración privada del ERP e integración de 0.6 | Se revocan en 8.8 y al cerrar E5 | E5, 8.8 | 0 |

## 7. Plan de migración de leads (para 6.5, sin ejecutar)

**Recomendación (D3): migrar al corte, desde el espejo de Studio, no con una extracción nueva.** El espejo ya tiene leads, contactos, etapas, tareas, usuarios y vínculos lead-contacto; el sync diario y la extracción final de 8.5 lo dejan al día. Así en F2 no hay dos maestros para el mismo lead de Kommo.

1. **Antes del corte, en 6.5:** el cargador, la tabla de mapeo de IDs y el ensayo sobre una copia (conteos, sin texto). Lo que falta del espejo (notas y etiquetas) se lee por API solo si D5 lo decide, con el token del ERP, que tiene el alcance `crm` (X-2; que alcance para notas y etiquetas es **I**).
2. **Alcance (D4):** leads abiertos con actividad en los últimos 180 días, más sus tareas abiertas. Los ganados ya son fichas: el segmento sale del ERP. Los perdidos y los viejos quedan solo en la exportación cifrada de 8.9.
3. **Orden de carga:** asesores (por correo, §5.4) → personas (ligar a ficha por `kommo_contact_id` o teléfono, o tarjeta sin ficha) → tarjetas con la etapa mapeada de §4.3 → tareas abiertas → (D5) notas y etiquetas → mapeo de IDs.
4. **Fuente de cada tarjeta migrada:** «Kommo», con el canal de origen si existe (`kommo_leads.last_message_origin`, `kommo_unsorted.source_name`).
5. **Conflictos:** §5.3. Si ya hay tarjeta de Studio, gana su etapa.
6. **Puertas:** OK nominal de Sam para la carga (fila 6.5) y lectura de PII si hay que leer notas. Acta con conteos por etapa y objeto antes y después.
7. **Después:** el mapeo y las columnas `kommo_*` se exportan cifrados y se borran en 8.9–8.11.

## 8. Decisiones de Sam

**Resueltas el 2026-10-30, todas según la recomendación:** D1 (a), D2 (a), D3 (a), D4 (a), D5 (b), D6 (a), D7 (a), D8 (a), D9 (a) y D10 (a). A la pregunta del Director «Si te sirven todas mis recomendaciones de D1–D10, basta con que me digas "D1–D10 como recomiendas"», Sam respondió «si» (texto literal que pasó el Director). La columna «Recomendación» queda como registro de lo que se aprobó.

| # | Pregunta | Opciones | Recomendación |
|---|---|---|---|
| D1 | Etapas del tablero Leads | (a) Las 7 de §4.3 · (b) las 5 de Kommo sin «Aceptado, esperando carga» · (c) otras | **(a)**: la etapa 6 hace falta porque con la regla de 0.8 aceptar un estimado no vuelve cliente a nadie |
| D2 | Etapas del tablero Clientes | (a) Activo, Postventa, Recompra pendiente, Recompra en curso · (b) solo Activo y Recompra · (c) estados operativos del envío | **(a)**: sigue el bucle de recompra de `embudo-ventas.md`; (c) duplicaría lo que ya tiene el envío |
| D3 | Cuándo migrar los leads de Kommo | (a) Al corte, desde el espejo · (b) carga inicial al empezar F2 + incremental al corte · (c) no migrar: solo exportación | **(a)**: un solo maestro por lead y sin extracción nueva |
| D4 | Qué leads migrar | (a) Abiertos con actividad en 180 días · (b) todos los abiertos · (c) todos, incluidos perdidos | **(a)**: el 86 % de los leads llevaba más de 180 días quieto en agosto (`embudo-ventas.md` §1, **D**); se confirma con la lectura L1 |
| D5 | Notas y etiquetas de Kommo | (a) Etiquetas mapeadas a campos o motivo + notas solo de los migrados · (b) nada: solo la exportación cifrada · (c) todo | **(b)**, salvo que Sam use las notas para trabajar: no copia texto con datos personales y ahorra 0,5 d. Si las usa, (a) |
| D6 | Qué guarda Studio del lead nuevo | (a) Nombre visible y últimos 10 dígitos, con retención: anonimizar a los 12 meses sin actividad si está perdido · (b) solo IDs de Chatwoot, y el nombre se lee en el momento | **(a)**: el tablero necesita buscar por nombre. Pasa por revisar-datos-ve en 6.2 |
| D7 | Alta web en F2 | (a) Dejar de empujar a Kommo cuando 6.4 esté vivo · (b) seguir empujando | **(a)**: si no, el alta nace con dos maestros. Requiere la lectura L3 |
| D8 | Pings de 23 h | (a) Alerta interna, sin mensaje al cliente · (b) alerta + mensaje automático al lead · (c) nada | **(a)**: costo de Meta 0 y no gasta el cupo de las respuestas humanas |
| D9 | Asesor | (a) Dueño de la tarjeta separado del asignado del chat, con valor inicial (§5.4) · (b) sincronizarlos siempre | **(a)**: evita un ida y vuelta de eventos y conflictos |
| D10 | Análisis de llamadas con IA (widget NOVA) | (a) Sin reemplazo · (b) buscar uno | **(a)**: Chatwoot no maneja llamadas en el alcance del 100 % |

### Lecturas vivas propuestas (no se hicieron)

El «si» de Sam cubre D1–D10, **no** estas lecturas: cada una sigue pidiendo su OK. L3 hace falta antes de aplicar D7 en 6.4, y L1 confirma D4 antes de 6.5.

| # | Qué | Para qué | Puerta |
|---|---|---|---|
| L1 | Conteo de `kommo_leads` por etapa y por antigüedad de la última actividad, en el espejo de producción. Solo conteos | Dimensionar 6.5 y confirmar D4 | OK de Sam: es lectura de producción, aunque sin PII |
| L2 | Nombres y cantidad de las etiquetas de Kommo (`GET /api/v4/leads/tags`) | Decidir D5 y el mapeo | OK de Sam; los nombres van a la nota cifrada si nombran personas |
| L3 | Si `KOMMO_PUSH_DRY_RUN` vale `"false"` en la función de Supabase (solo sí o no) | D7 | OK de Sam |
| L4 | Si WhatsApp Lite, Google Business Messages y Twilio tienen tráfico en Kommo | §6.2 | OK de Sam; lectura en la interfaz |

## 9. Reestimación de 6.2 a 6.7

Los días base no cambian aquí: cambiarlos exige una línea base nueva con OK de Sam. Esto mueve solo «Días restantes» del checklist.

| Paso | Base | Restante | Motivo (evidencia) |
|---|---|---|---|
| 6.2 | 2 | **2,5** | Tarjeta, etapas configurables, historial, tareas, notas, fuente y mapeo, con RLS y contrato en PGlite. Suma el núcleo de la regla por `client_id` (§4.2) y ampliar los eventos de la 0504 si ya está aplicada |
| 6.3 | 5 | **4,5** | Ya existen el tablero, `StageControl` y `LeadActionsButton` (`app/studio/(app)/crm/`); se adaptan a la tarjeta en vez de escribirse de cero |
| 6.4 | 2 | **2,5** | Dos manejadores nuevos en el procesador de E2, alta desde `/registro` y la atribución, que hoy no existe en ninguna tabla |
| 6.5 | 1,5 | **1,5** | Con D3 (a) y D5 (b): desde el espejo, sin extracción nueva. Con D5 (a), **2** |
| 6.6 | 2,5 | **2,5** | Hay mucho reutilizable (`commercialByAgent`, `leadsSinAtender`, `convertLead`); el trabajo es moverlo de `kommo_*` a la tarjeta |
| 6.7 | 2,25 | **1** | Ya reestimado en E0 (todos los bots apagados); con D8 (a) es una alerta interna |
| **Total** | 15,25 | **14,5** | −0,75 frente a la base. Con D5 (a), −0,25 |

## 10. Allowlist de esta SDD

- `docs/specs/0587-chatwoot-contrato-sistema-maestro/spec.md`
- `docs/specs/0582-chatwoot-piloto/checklist.md` (fila 6.1 y «Días restantes» de 6.2–6.6)
- `docs/specs/README.md` (índice regenerado)
- `.agents/handoffs/0587-chatwoot-contrato-sistema-maestro.md`

**6.2** (decisión de esta tarea: E6 sigue en esta SDD, como E2 en la 0585 y E10 en la 0586; no se reservó otra):

- `supabase/migrations/0506_crm_modelo.sql`
- `supabase/tests/0506_crm_modelo.test.sql`
- `lib/studio/__tests__/crm-modelo.migration.test.ts`
- `supabase/migrations-baseline.json` (solo la entrada `0506_crm_modelo`)

Los pasos 6.3 en adelante suman aquí su allowlist al empezar.

## 11. Aceptación de 6.1

- [x] Las tablas de §3 cubren los 11 objetos en las 3 fases.
- [x] Los dos tableros tienen etapas propuestas, el paso automático y el caso del cliente que vuelve a lead (§4).
- [x] La sincronización dice qué fluye, en qué sentido, con qué idempotencia y cómo se resuelven los conflictos (§5).
- [x] Cada Salesbot e integración del inventario de 0.4 tiene reemplazo y costo de Meta (§6).
- [x] El plan de migración está escrito y no se ejecutó (§7).
- [x] Sam aceptó D1–D10 según la recomendación (2026-10-30, §8). Las lecturas L1–L4 quedan para 6.4 y 6.5, cada una con su OK.
- [x] `docs:check`, `sdd:check`, la prueba del avance y `git diff --check` en verde.

## 12. Fuera de alcance detectado (se informa, no se toca)

- `leadsSinAtender` (`lib/studio/kommo-atencion.ts:77`) no tiene consumidor fuera de pruebas: la alerta «sin atender» que 6.6 dice reemplazar no está en pantalla hoy.
- El drenaje del writeback por pg_cron está comentado (0136:190); solo se drena «en caliente» desde el webhook y las acciones de Studio.
- El motor de flujos 0143 no reintenta: un paso fallido queda `failed` (`workflow-drain.ts:148-169`).
- `convertLead` guarda `registration_channel = 'kommo'` (`kommo-convert.ts:216`): un valor con «kommo» en datos vivos que la SDD de limpieza (8.10) tiene que decidir.
- La regla «sin rastro» y el mapeo de IDs de 6.5 chocan si el mapeo vive después de 8.11: este contrato lo resuelve borrándolo en 8.11 (§3).

## 13. Seguimiento

- **2026-10-30:** SDD propuesta y fila 6.1 entregada (PR #334, commit `1fae5e0a0`).
- **2026-10-30:** Sam aceptó D1–D10 según la recomendación («si», pasado por el Director). Fila 6.1 aceptada: el avance del programa en esta rama pasa de 4,8 % a 6,5 % (7,5 ÷ 115,5 d, salida de `avance-checklist`). 6.2 espera la PR de E10 (0505) y los eventos de la 0504 antes de empezar.
- **2026-10-30:** el Director da la salida de 6.2 cuando E10 publica la PR #335 (`231e471c1`). 6.2 se programa en la rama `codex/0582-e6-modelo`, apilada sobre `codex/0582-e10-enrutamiento`, y queda entregado con la migración 0506 sin aplicar (§14).

## 14. Paso 6.2 — modelo de datos (migración 0506, sin aplicar)

Archivo: [`supabase/migrations/0506_crm_modelo.sql`](../../../supabase/migrations/0506_crm_modelo.sql). Declarada pendiente en `supabase/migrations-baseline.json`. **Aplicarla exige el OK nominal de Sam y el runbook de producción**, después de la 0505.

### 14.1 Qué crea

| Pieza | Qué hace | Regla del contrato que cumple |
|---|---|---|
| `crm_segmento_clientes(tenant, client_ids[])` y `crm_segmento_cliente(tenant, client_id)` | Núcleo único de la regla de 0.8, en conjunto y por ficha. Una ficha borrada o de otro tenant no sale (la escalar devuelve `lead_nuevo`) | §4.2.1: una sola definición |
| `chatwoot_segmento_contacto` (0505) redefinida | Solo resuelve el teléfono a exactamente una ficha viva y delega en el núcleo. Misma firma y mismos grants | §4.2.1 |
| `crm_segmento_tarjetas(tarjeta_ids[])` | Segmento de las tarjetas del tenant de quien llama, para el tablero; exige el módulo CRM | §4.1: el tablero no se guarda |
| `crm_etapas` | 7 etapas de Leads (D1) y 4 de Clientes (D2) por tenant, `sistema = true`; sembradas en los tenants existentes y por trigger en los nuevos. El admin cambia nombre y orden y suma etapas propias; las de sistema no se apagan ni se borran | §4.3, §4.4 |
| `crm_tarjetas` | Una por persona. Llaves únicas por tenant: ficha, contacto de Chatwoot y BSUID. Las dos etapas con su fecha y la del último movimiento manual; asesor del tenant; fuente y UTM fijos desde el alta (trigger); nombre visible y últimos 10 dígitos solo si no hay ficha (check) | §4.1, §5.4, D6, D9 |
| `crm_historial_etapas` | Cada cambio de etapa, con clave de evento única para los automáticos | §4.5, §5.2 |
| `crm_tareas`, `crm_notas` | Tareas (las automáticas con clave única) y notas de la tarjeta, solo agregables. Las notas del chat siguen en Chatwoot | §3, D5 (b), D8 |
| `crm_ids_externos` | Mapeo de IDs de Kommo (lead, contacto, tarea, usuario), solo `service_role`. Se exporta y se borra en 8.11 | §3, §7 |
| `crm_mover_etapa` | Movimiento manual (módulo CRM). Una etapa de cierre pide motivo; al salir de ella el motivo se borra | §4.3 |
| `crm_mover_etapa_auto` | Movimiento automático: idempotente por clave; `omitido_manual` si la tarjeta se movió a mano después del evento | §5.2, §5.3 |
| `crm_anonimizar_leads_perdidos` | D6: lead sin ficha, perdido y con 12 meses sin actividad → sin nombre, teléfono, contacto, BSUID ni motivos; se borran sus notas, tareas y mapeos | D6 |

**Acceso:** leen y escriben `admin` y `commercial` del tenant (`crm_puede_usar()`), los mismos roles que el módulo `kommo` de `lib/studio/rbac.ts:99`. Las etapas las cambia solo el admin. Una tarjeta creada desde Studio lleva `fuente = 'manual'`; las demás las crea `service_role` (6.4). La etapa de una tarjeta no tiene GRANT de UPDATE: solo cambia por las RPC. Nadie borra tarjetas desde la API.

**Lo que 6.2 deja a otros pasos:**
- **Eventos nuevos del webhook (`conversation_created`, `conversation_updated`):** van en 6.4 junto con sus manejadores. La 0504 es de E2 y ampliar su `check` sin el código que los interpreta no cambia nada.
- **Alta idempotente de tarjeta** desde los eventos: la llave única ya está; la RPC de alta va con 6.4.
- **El cron de la retención:** la función existe; la ruta y su agenda (`vercel.json` y crontab del VPS) van con 6.6.
- **Tarjeta de una ficha borrada en suave:** `clients` se borra en suave (0455). Su tarjeta queda y el segmento la da como `lead_nuevo`; el tablero de 6.3 tiene que esconderla.
- **Permisos por usuario:** la RLS sigue el rol. Un permiso extra por usuario (overrides de `lib/studio/rbac-guard.ts`) no abre las tablas; si hace falta, es una decisión aparte.

### 14.2 Evidencia

| Comprobación | Resultado |
|---|---|
| Contrato `supabase/tests/0506_crm_modelo.test.sql` en PGlite (aplica la 0505 y la 0506 reales) | PASÓ: 78 aserciones |
| Control rojo (sin la 0506) | PASÓ: cae en la primera aserción |
| Mutantes | PASÓ: los 34 caen en la aserción que los nombra |
| Reaplicación y preflight (sin la 0505) | PASÓ: abortan sin crear nada |
| Declaración en `migrations-baseline.json` | PASÓ |
| `pnpm verify` y la reconstrucción del esquema con todas las migraciones | **NO EJECUTADO**: E10 tiene el turno de verify; se pide al Director |

### 14.3 revisar-datos-ve del modelo

Estados de la skill: **ENCONTRADO**, **CORRECTO** o **NO VERIFICABLE**. Citas de `supabase/migrations/0506_crm_modelo.sql`. Esto no es asesoría legal.

**Resumen:** 6 CORRECTO (el 5 con una parte no verificable), 2 ENCONTRADO, 3 NO VERIFICABLE y 1 no aplica.

**Inventario de datos del modelo:**

| Dato | Dónde | De quién | Retención |
|---|---|---|---|
| Nombre visible | `crm_tarjetas.nombre_visible` (:306) | Lead sin ficha | Hasta 12 meses sin actividad si está perdido (:759) |
| Últimos 10 dígitos del teléfono | `crm_tarjetas.phone_last10` (:307) | Lead sin ficha | Igual |
| ID de contacto de Chatwoot y BSUID | `crm_tarjetas` (:302, :304) | Lead | Igual |
| Notas y tareas (texto libre del equipo) | `crm_notas.texto` (:514), `crm_tareas.texto` (:492) | Puede nombrar a cualquiera | Con la tarjeta; se borran al anonimizar (:779) o al purgar la ficha (cascada, :301) |
| Motivo de pérdida | `crm_tarjetas.motivo_perdida`, `crm_historial_etapas.motivo` (:466) | Lead | Se borran al anonimizar |
| UTM y fuente | `crm_tarjetas` (:318-326) | Lead (no identifica sola) | Con la tarjeta |

| # | Punto | Estado | Evidencia y comentario |
|---|---|---|---|
| 1 | Inventario | CORRECTO | Tabla de arriba; la prueba confirma que ninguna columna `crm_` guarda teléfono completo, correo, código ni mensajes |
| 2 | Minimización | CORRECTO | Con ficha no se copian nombre ni teléfono (check, :339); solo 10 dígitos; sin texto de mensajes |
| 3 | Consentimiento | NO VERIFICABLE | La base de licitud para guardar al lead que escribe por WhatsApp no está en el código; la decide Sam con su asesor |
| 4 | Derechos | **ENCONTRADO** | No hay un camino para que una persona pida borrar su tarjeta antes de los 12 meses: la anonimización solo la corre `service_role` sobre perdidos (:759). Arreglo: en 6.6, una acción de admin «Anonimizar ahora» sobre una tarjeta, con la misma limpieza |
| 5 | Borrado | CORRECTO / NO VERIFICABLE | Anonimizar quita los datos y borra notas, tareas, mapeos y motivos (:759-789), probado en PGlite. No se probó contra una base real; los respaldos y Chatwoot conservan su copia (punto 8) |
| 6 | Trazabilidad de solicitudes | NO VERIFICABLE | Depende del camino del punto 4 |
| 7 | Política pública | **ENCONTRADO** | `/privacidad` no dice que se guarda al lead de WhatsApp ni su plazo (ya registrado como fuera de alcance en la SDD-0582). Arreglo: texto aprobado por Sam antes de 6.4 en producción |
| 8 | Terceros | NO VERIFICABLE | Chatwoot guarda el contacto y la conversación completos y no tiene retención definida en el programa (E1/E5) |
| 9 | Transferencia internacional | CORRECTO | El modelo vive en la base de DTD; no envía nada a terceros |
| 10 | Decisiones automatizadas | CORRECTO | El segmento solo elige tablero y número; no niega servicio. La regla es pública en la SDD-0582 |
| 11 | Aceptación electrónica | No aplica | El modelo no registra aceptaciones |
| 12 | Titulares que no son usuarios | CORRECTO | El lead sin ficha es justo ese caso: se guarda lo mínimo y se anonimiza a los 12 meses (D6). Su aviso es el punto 7 |
