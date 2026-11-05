---
sdd: "0587"
title: "Contrato de sistema maestro por objeto y fase: Studio, Chatwoot y Kommo (E6 del programa SDD-0582, paso 6.1)"
status: approved
author: "Claude Worker «E6 contrato» (Sam)"
created: 2026-10-30
updated: 2026-11-02
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
2. **Eventos del webhook.** La 0504 solo admite `message_created` y `conversation_status_changed` (0504:56). 6.4 necesita además `conversation_created` (alta de la tarjeta) y `conversation_updated` (asignado y etiquetas). Que Chatwoot 4.19.1 los emita es **NV** en esta tarea; se confirma en `app/listeners/webhook_listener.rb`. Si la 0504 se aplica antes, 6.2 amplía el `check` con una migración propia. **Resuelto en 6.4:** los emite (§16.2) y el `check` se amplía en la migración de ese paso (§16.3).

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

**6.3** (tablero y ficha; misma SDD):

- `lib/studio/crm-tablero.ts`, `lib/studio/crm-tablero-queries.ts`, `lib/studio/crm-ficha.ts`
- `app/studio/(app)/crm/tarjeta-actions.ts`
- `app/studio/(app)/crm/page.tsx` (pestaña «Embudos» y su `Suspense`)
- `app/studio/(app)/crm/_components/kommo-tabs.shared.ts` y `KommoClient.tsx` (solo la pestaña y su slot)
- `app/studio/(app)/crm/_components/CrmEmbudosSlot.tsx`, `CrmEmbudosClient.tsx`, `CrmTableroKanban.tsx`, `TarjetaFichaDrawer.tsx`
- Pruebas: `lib/studio/__tests__/crm-tablero.test.ts`, `lib/studio/__tests__/crm-tablero-queries.test.ts`, `app/studio/(app)/crm/__tests__/tarjeta-actions-gate.test.ts`, `app/studio/(app)/crm/_components/CrmTableroKanban.test.tsx`, `app/studio/(app)/crm/_components/CrmEmbudosClient.test.tsx`
- `supabase/pending-migration-symbol-declarations.json` (solo la entrada `sdd-0587-crm-tablero`)
- `.agents/handoffs/0587-e6-tablero.md`

**6.4** (entrada de leads desde Chatwoot y la web, con atribución; misma SDD):

- `supabase/migrations/0513_crm_entrada_leads.sql`, `supabase/tests/0513_crm_entrada_leads.test.sql`, `lib/studio/__tests__/crm-entrada.migration.test.ts`
- `supabase/migrations-baseline.json` (solo la entrada `0513_crm_entrada_leads`)
- `supabase/pending-migration-symbol-declarations.json` (la entrada `sdd-0587-crm-entrada` y las líneas de E2 en `webhook-procesar.ts` que este paso corre)
- `lib/studio/chatwoot/entrada-leads.ts` (nuevo), `webhook-events.ts`, `webhook-procesar.ts` (lista de manejadores y contexto), `router-api.ts` (`obtenerConversacionYContacto`), `config.ts` (`chatwootBandejasWhatsapp`)
- `app/api/chatwoot/webhook/route.ts` (pasa el contacto a parte)
- `lib/studio/crm-alta-web.ts` y `lib/public/registro-atribucion.ts` (nuevos)
- `app/registro/actions.ts` (paso 6c y el interruptor en el paso 11), `app/registro/page.tsx` (lee los UTM), `app/registro/RegisterForm.tsx` (solo los campos ocultos)
- Pruebas: `lib/studio/chatwoot/__tests__/entrada-leads.test.ts`, `webhook-events.test.ts`, `webhook-fixtures.ts`, `enrutar.test.ts` (el doble del reproceso), `app/api/chatwoot/webhook/__tests__/route.test.ts`, `lib/public/__tests__/registro-atribucion.test.ts`, `app/registro/__tests__/register-tarjeta-crm.test.ts`, `app/registro/__tests__/register-atribucion-oculta.test.tsx`
- `.env.example` e `infra/dtd-cargo/.env.example` (solo `CRM_ALTA_WEB_SIN_KOMMO`)
- `docs/runbooks/chatwoot-bandeja.md` (eventos y orden de encendido)
- `docs/specs/0582-chatwoot-piloto/checklist.md` (fila 6.4)
- `.agents/handoffs/0587-e6-entrada-leads.md`
- `app/privacidad/page.tsx` y `app/__tests__/privacidad-chat.test.ts` (solo la frase de la campaña, §16.8 punto 7, con el OK de Sam del 2026-11-03)
- `app/studio/(app)/crm/_components/KommoClient.tsx` y `app/studio/(app)/crm/__tests__/stage-control.test.ts` (solo el encabezado: decía «solo lectura» y «todavía no modifica nada» con Embudos ya guardando. Lo pidió el Director General, 2026-11-04)

**`/privacidad` con Instagram** (2026-11-05, encargo del Director General con el texto que aprobó Sam):

- `app/privacidad/page.tsx` (solo los dos textos, la fecha y su comentario), `app/__tests__/privacidad-chat.test.ts` y `app/__tests__/faq-seguimiento-coherente.test.tsx` (solo la fecha)
- `docs/legal/privacidad/inventario-terceros.md` (la fila de Meta y la frase de «datos reales» de la sección 2 bis)
- `.agents/handoffs/0587-privacidad-instagram.md`

Los pasos 6.5 en adelante suman aquí su allowlist al empezar.

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
- **2026-10-30:** 6.3 se programa en la rama `codex/0582-e6-tablero`, apilada sobre `codex/0582-e6-modelo`, y queda entregado sin migración nueva (§15). `pnpm verify` corrió sobre `4f277075a` (§15.2): el rojo propio quedó corregido y los demás son ajenos.
- **2026-10-30:** Sam aceptó 6.2: a «¿Aceptas lo entregado: 2.4–2.6, 3.1–3.3, 6.2, 6.3 y 10.1–10.3?» respondió «Acepto todo» (texto literal que pasó el Director, sesión «CRM Chatwoot»). Fila 6.2 aceptada; el avance del programa en la rama `codex/0582-e6-modelo` pasa de 20,4 % a 22,1 % (25,5 ÷ 115,5 d, salida de `avance-checklist`, con las aceptaciones de las otras ramas ya fusionadas). Aplicar la 0506 sigue siendo una puerta aparte: OK nominal de Sam al integrar, después de la 0505 y con el runbook de producción.
- **2026-10-30:** Sam aceptó 6.3: a «¿Aceptas lo entregado: 2.4–2.6, 3.1–3.3, 6.2, 6.3 y 10.1–10.3?» respondió «Acepto todo» (texto literal que pasó el Director, sesión «CRM Chatwoot»). Fila 6.3 aceptada; el avance del programa en la rama `codex/0582-e6-tablero` pasa de 22,1 % a 26,4 % (30,5 ÷ 115,5 d, salida de `avance-checklist`). La prueba visual con datos sigue pendiente hasta que haya una base con la 0506, y aplicarla es una puerta aparte con OK nominal de Sam.
- **2026-11-02:** Sam dijo «Sí, arranca» al paso 6.4 (texto que pasó el Subdirector). Se programa en la rama `claude/0582-e6-entrada-leads-ef62df`, apilada sobre `codex/0582-e6-tablero`, y queda entregado con la migración 0513 sin aplicar y D7 detrás de un interruptor apagado (§16).

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

**Destino de los ENCONTRADO** (Director, 2026-10-30): el punto 4, «Anonimizar ahora», va a **6.6**; el punto 7, la actualización de `/privacidad`, va a **2.6** (revisión de datos de E2).

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
| 4 | Derechos | **ENCONTRADO** | No hay un camino para que una persona pida borrar su tarjeta antes de los 12 meses: la anonimización solo la corre `service_role` sobre perdidos (:759). Arreglo: una acción de admin «Anonimizar ahora» sobre una tarjeta, con la misma limpieza. **Va a 6.6** |
| 5 | Borrado | CORRECTO / NO VERIFICABLE | Anonimizar quita los datos y borra notas, tareas, mapeos y motivos (:759-789), probado en PGlite. No se probó contra una base real; los respaldos y Chatwoot conservan su copia (punto 8) |
| 6 | Trazabilidad de solicitudes | NO VERIFICABLE | Depende del camino del punto 4 |
| 7 | Política pública | **ENCONTRADO** | `/privacidad` no dice que se guarda al lead de WhatsApp ni su plazo (ya registrado como fuera de alcance en la SDD-0582). Arreglo: texto aprobado por Sam antes de 6.4 en producción. **Va a 2.6** (revisión de datos de E2) |
| 8 | Terceros | NO VERIFICABLE | Chatwoot guarda el contacto y la conversación completos y no tiene retención definida en el programa (E1/E5) |
| 9 | Transferencia internacional | CORRECTO | El modelo vive en la base de DTD; no envía nada a terceros |
| 10 | Decisiones automatizadas | CORRECTO | El segmento solo elige tablero y número; no niega servicio. La regla es pública en la SDD-0582 |
| 11 | Aceptación electrónica | No aplica | El modelo no registra aceptaciones |
| 12 | Titulares que no son usuarios | CORRECTO | El lead sin ficha es justo ese caso: se guarda lo mínimo y se anonimiza a los 12 meses (D6). Su aviso es el punto 7 |

## 15. Paso 6.3 — tablero de dos embudos y ficha de la tarjeta

Rama `codex/0582-e6-tablero`, apilada sobre `codex/0582-e6-modelo` (PR #336). Sin migración nueva: usa la 0506 tal como quedó en 6.2. Mientras la 0506 no esté aplicada, la pestaña lo dice («Falta aplicar la migración 0506») en vez de romperse.

### 15.1 Qué quedó

| Pieza | Dónde | Regla del contrato |
|---|---|---|
| Pestaña **Embudos** en `/studio/crm`, con selector Leads / Clientes (conteo por embudo) y búsqueda por nombre o Shipping Mark | `page.tsx` (`Suspense`), `CrmEmbudosSlot.tsx`, `CrmEmbudosClient.tsx` | §4.1. Convive con las pestañas de Kommo durante F2; 6.6 las reemplaza |
| Columnas desde `crm_etapas`, en el orden del admin. Una etapa propia apagada solo aparece si aún tiene tarjetas | `armarColumnas` (`lib/studio/crm-tablero.ts`) | D1, D2 |
| Mover arrastrando (HTML5 nativo, como Bitácora) o con el selector «Mover a…» de cada tarjeta, accesible por teclado (DND-01). Una etapa de cierre pide motivo (`ConfirmDialog`). El movimiento es optimista y vuelve atrás si el servidor dice que no | `CrmTableroKanban.tsx`, `moverTarjetaAction` → `crm_mover_etapa` | §4.3, §5.3: la RPC fija `etapa_*_manual_at`, que es lo que hace ganar al manual posterior frente a `crm_mover_etapa_auto` |
| Paso automático entre embudos: el tablero sale del segmento de `crm_segmento_tarjetas` en cada lectura. La tarjeta dice de dónde vino («Vino de Leads · …» o «Volvió de Clientes · …») | `ubicarTarjeta` | §4.1, §4.5 |
| Cliente que vuelve a lead → «Registrado / recontacto» si su último movimiento fue en Clientes; en cuanto alguien la mueve a mano en Leads, manda su etapa guardada | `ubicarTarjeta` + `rastrosDesdeHistorial` | §4.5, §5.3 |
| Tarjeta de una ficha borrada en suave (o que ya no se ve) se esconde y se cuenta al pie; las anonimizadas tampoco se pintan | `separarVisibles`, `.is("anonimizada_at", null)` | Pendiente de §14.1 |
| Ficha: resumen (las dos etapas, motivo, fuente, UTM, fechas, enlace a la ficha del cliente), **dueño de la tarjeta** (se cambia aquí) separado de **quién contesta el chat** (lectura de `chatwoot_conversations` + `chatwoot_agent_links`; se cambia en Chatwoot), tareas (crear y marcar hechas), notas (agregar) e historial de etapas | `TarjetaFichaDrawer.tsx`, `cargarFichaTarjetaAction` y los verbos de `tarjeta-actions.ts` | D9, §5.4, D5 (b) |
| Antigüedad en la etapa con punto dorado desde 30 días (reemplazo del «tintado» de NOVA, §6.2) y tareas vencidas en rojo | `CrmTableroKanban.tsx` | §6.2 |
| Estados: cargando (`Suspense`), vacío (con las escondidas), sin modelo, error con «Reintentar», búsqueda sin resultados y vista de lectura | `CrmEmbudosSlot.tsx`, `CrmEmbudosClient.tsx` | BRAND §Estados obligatorios |

**Permisos.** Dos candados en cada verbo y en la pantalla: el módulo `kommo` (con sus desvíos) y el rol de la RLS de la 0506 (`rolUsaCrm` = admin o commercial, el mismo predicado que `crm_puede_usar()`). Un desvío que le abra el módulo a otro rol no abre las tablas, así que la pantalla dice «Tu rol no usa el CRM propio» antes de que la base responda con un error. La llave de servicio solo se usa para nombres del equipo (`listTenantAdvisors`, como la ficha del cliente) y para traducir el agente de Chatwoot a un usuario, acotado al tenant.

**Límite conocido (I).** Una tarjeta que fue cliente sin moverse nunca en Clientes (entró a «Activo» por defecto) no deja rastro en el historial: si vuelve a lead, aparece en su etapa guardada de Leads y no en «Registrado / recontacto». Registrar el cambio de tablero al detectarlo es de 6.6, que lleva los movimientos automáticos (`crm_mover_etapa_auto` con clave de evento).

### 15.2 Evidencia

| Comprobación | Resultado |
|---|---|
| Pruebas puntuales: `crm-tablero` (14), `crm-tablero-queries` (10, doble que aplica los filtros), `CrmTableroKanban` (6), `CrmEmbudosClient` (5), `tarjeta-actions-gate` (24) | PASÓ |
| Pruebas vecinas: todo `app/studio/(app)/crm` y el contrato PGlite de la 0506 (`crm-modelo.migration.test.ts`) | PASÓ: 10 archivos, 180 pruebas |
| Mutantes: sin `.is("anonimizada_at", null)`; sin esconder la ficha borrada; sin la vuelta a recontacto; sin el candado de rol en `puertaEdicion` | PASÓ: los 4 caen |
| `tsc` acotado a los archivos de 6.3 y sus dependencias | PASÓ |
| ESLint de `app/studio/(app)/crm/_components/` y `lib/studio/crm-*` | PASÓ: 0 errores; 2 avisos que ya estaban (`KommoClient.tsx:558`, `KommoBoardView.tsx:124`) |
| `/ui-check` | PASÓ con 3 ajustes aplicados (espaciado con `var(--s-*)`, `ErrorAlert` del sistema, selector de 32 px) |
| Gate de símbolos de migraciones pendientes | PASÓ: 0 ROJO, 7 AMARILLO declarados; la 0506 con `sdd-0587-crm-tablero`. Medido en `1d12270b6`, con `3c86f4053` integrado, que trae la resincronización de E2/E10 |
| Prueba visual en el navegador con datos | NO EJECUTADO: hace falta una base con la 0506 aplicada |
| `pnpm verify` completo sobre `4f277075a` (17:11Z–18:12Z, `node scripts/verify.mjs`) | FALLÓ: 16 de 17 pasos corridos; 3 rojos (test, sql-tests, e2e) y `migrations-applied` NO DISPONIBLE (worktree sin `.env.local`). Detalle por paso abajo |
| verify · harness, lint, rsc-boundary, typecheck, edge-functions, docs:check, numbering, feature-constants, components:check, governance:check, pending-migration-symbols (0 ROJO · 7 AMARILLO), schema-rebuild, build | PASÓ |
| verify · test (Vitest: 13 734 de 13 738) | FALLÓ. Propio: `rbac-actions-guard.test.ts` (2) contaba 78 archivos y 450 acciones; `tarjeta-actions.ts` suma 1 y 6, todas con candado. Corregido en el commit siguiente: 461 de 461 PASÓ. Ajenos: `infra-env-example.test.ts`, por cinco variables de E10 en el `.env.example` de la raíz sin documentar en el del servidor (`a319d4cdc`); y `TransportistasPanel.test.tsx`, que falló sólo en el reintento bajo carga y pasa solo |
| verify · sql-tests | FALLÓ, ajeno: `0467_reversion_credito_carrera`, `0497_reverso_al_anular_factura` y `0497_reverso_al_anular_factura_carrera` (preflight de la 0497 sobre `excepcion_al_cierre_vigente`). El diff de 6.3 no toca migraciones ni contratos SQL |
| verify · e2e (Playwright: 217–218 pasan) | FALLÓ, ajeno: `e2e/sin-scroll-horizontal.spec.ts:119` (CTA de Shipping Mark, página pública) en chromium, las dos vueltas; `auth.spec.ts:81` inestable. El diff de 6.3 no toca páginas públicas |
| verify · migrations-applied | NO DISPONIBLE: el worktree no tiene credenciales de Supabase, y por regla no se copian |

### 15.3 revisar-datos-ve de 6.3

Sobre lo que 6.3 suma al modelo de §14.3. Esto no es asesoría legal.

| # | Punto | Estado | Evidencia |
|---|---|---|---|
| 1 | Inventario | CORRECTO | 6.3 no crea campos. Lee nombre visible, Shipping Mark y nombre de la ficha; escribe notas, tareas, dueño y etapa por las tablas de la 0506 |
| 2 | Minimización | CORRECTO | El tablero no lee `phone_last10` ni BSUID (`lib/studio/crm-tablero-queries.ts:27-28`); la ficha tampoco (`tarjeta-actions.ts:134`). Ningún `console` con datos en los archivos nuevos |
| 4 | Derechos | **ENCONTRADO** | Una nota no se corrige ni se borra desde la pantalla (la 0506 solo da INSERT). La ficha lo avisa y pide no pegar datos de más (`TarjetaFichaDrawer.tsx:473`). Arreglo: la acción «Anonimizar ahora» de 6.6 (§14.3, punto 4) |
| 5 | Borrado | CORRECTO | La tarjeta de una ficha borrada en suave no se pinta (`crm-tablero-queries.ts:83`) y su ficha no se abre (`tarjeta-actions.ts:189`) |
| 8 | Terceros | CORRECTO | No se envía nada fuera. De Chatwoot solo se leen estado y asignado de la conversación, sin texto |
| — | Fixtures | CORRECTO | Nombres de prueba y Shipping Marks inventados (`DTD-01xx`); sin teléfonos ni correos |

## 16. Paso 6.4 — entrada de leads desde Chatwoot y la web, con atribución

Rama `claude/0582-e6-entrada-leads-ef62df`, apilada sobre `codex/0582-e6-tablero` (PR #337). Migración [`supabase/migrations/0513_crm_entrada_leads.sql`](../../../supabase/migrations/0513_crm_entrada_leads.sql), **sin aplicar**: exige el OK nominal de Sam y el runbook de producción, después de la 0503, la 0504 y la 0506.

### 16.1 Qué quedó

| Pieza | Dónde | Regla del contrato |
|---|---|---|
| `conversation_created` o mensaje entrante → tarjeta. Lead nuevo en «Nuevo»; lead registrado o cliente en «Registrado / recontacto» (el cliente aparece en Clientes, y si vuelve a lead ya está donde §4.5 pide). Lleva su fuente, nombre visible y últimos 10 solo si no hay ficha | `entrarLead` (`lib/studio/chatwoot/entrada-leads.ts`) → `crm_entrada_chatwoot` | §4.1, §4.3, §5.1, D6 |
| Si la tarjeta ya existe, se completa lo que falta (ficha si el teléfono cruza con una sola, contacto, BSUID, asesor, actividad) y no se pisa nada. Una ficha borrada o fusionada ya no retiene la tarjeta: pasa a la que cruce hoy, o queda como lead a la vista | `crm_entrada_chatwoot` | §3, §4.1, §5.3 |
| Quien estaba en «Perdido» y escribe vuelve a «Registrado / recontacto», sin el motivo y con una tarea. Un movimiento manual posterior gana. `conversation_created` solo no lo saca: hace falta un mensaje entrante | `crm_volver_a_recontacto` sobre `crm_mover_etapa_auto` | §4.3, §5.3, §6.2 |
| `conversation_updated` con cambio de asignado → asesor a la tarjeta que no lo tiene, por `chatwoot_agent_links`. Si la ficha tiene asesor activo, manda ese. No crea tarjetas. Un bot asignado no es asesor | `crm_asesor_desde_chatwoot` | §5.4, D9 |
| La fuente sale del canal: `whatsapp_leads` o `whatsapp_clientes` por bandeja, `instagram`, `messenger`, `correo`. **Sin fuente no hay tarjeta:** la bandeja API «Archivo Kommo» de E5 no crea leads y un WhatsApp en otra bandeja no se atribuye a ciegas | `fuenteDeCanal` | §3 |
| El nombre no entra en `EventoChatwoot`: viaja aparte, en `ContactoEntrada`, y solo lo recibe `entrarLead`. Si el «nombre» de Chatwoot es un teléfono o un correo, no se guarda | `interpretarContacto`, `nombreVisibleDe` (`webhook-events.ts`) | D6; la prueba de E2 que exige que el nombre no salga de `interpretarEvento` sigue igual |
| Reproceso: el evento no guardó el contacto, así que se relee de Chatwoot con el token de E10. Sin token no hace nada y el siguiente mensaje crea la tarjeta | `obtenerConversacionYContacto` | §5.2, E2-D26 |
| Sin la migración, las RPC responden que no existen y el manejador avisa sin lanzar: un evento fallido repetiría el push en cada reintento | `fallarSalvoSinMigracion` | E2-D25 |
| Alta desde `/registro`: tarjeta nueva en «Nuevo» con fuente `web_registro`, el `origen` en `fuente_detalle` y los UTM. Si el lead ya escribió y su teléfono cruza con esta única ficha, se liga y conserva etapa, fuente y atribución; solo sale de «Perdido» | `crm_alta_tarjeta_web`, `altaTarjetaWeb` (`lib/studio/crm-alta-web.ts`), paso 6c de `app/registro/actions.ts` | §3, §4.1, §4.5, §5.1 |
| **El registro no se toca.** La tarjeta corre en `after()`, después de responder, y `altaTarjetaWeb` no lanza. Va antes de los pasos que pueden volver con un aviso, porque la ficha ya existe. Lo único nuevo en la página son campos ocultos con los UTM que llegaron; la action los vuelve a validar | `app/registro/actions.ts`, `lib/public/registro-atribucion.ts` | Pedido de Sam |
| Se puede correr dos veces sin efecto doble: llave única de §4.1 con `on conflict do nothing`; lo demás, con `coalesce` y clave de evento | Las tres RPC | §5.2 |

### 16.2 Los eventos en Chatwoot 4.19.1 (**C**, leído en la etiqueta `v4.19.1`)

- `WebhookListener#conversation_created` y `#conversation_updated` existen (`app/listeners/webhook_listener.rb`). El payload es `conversation.webhook_data` más `event`; el segundo trae también `changed_attributes`.
- `conversation_updated` se dispara si cambia `assignee_id`, pero también con equipo, etiquetas, estado y más (`list_of_keys` en `app/models/conversation.rb`). **E10 lo provoca en cada clasificación**, así que `interpretarEvento` ignora el que no cambia al asignado: no deja fila ni manejador.
- `changed_attributes` es `[{ atributo: { previous_value, current_value } }]` (`app/listeners/base_listener.rb`).
- `meta.sender` trae `id`, `name` y `phone_number` en el webhook y en la API de cuenta. El canal viene en `channel` en el webhook y en `meta.channel` en la API (`event_data_presenter.rb`, `_conversation.json.jbuilder`).
- `meta.assignee` también puede ser un agente bot, con `assignee_type: "AgentBot"` y otra secuencia de ids.
- Instagram conectado por una página de Facebook viaja como `Channel::FacebookPage` con `additional_attributes.type = "instagram_direct_message"` (`messages/instagram/messenger/message_builder.rb`).

Esto se leyó en el código. **Falta verlo contra un Chatwoot corriendo:** no se tocó ni prueba ni el servidor.

### 16.3 Decisión: migración nueva, sin editar la 0504

Se amplía el `check` en la 0513. Evidencia:

1. La RPC de alta hace falta de todos modos (§14.1), así que ya hay una migración de este paso.
2. La 0504 es de E2, en la PR #332, un eslabón más abajo de la pila, y otra sesión la está fusionando. Editarla mezcla los dos pasos y cambia un archivo que Sam ya aceptó con su contrato.
3. Con migración propia da igual si la 0504 ya se aplicó. `migrations-baseline.json` la declara pendiente, pero **no se comprobó contra producción** (NO VERIFICADO): leer producción está fuera de este encargo. Editarla solo sería seguro si eso se comprueba.
4. Ninguna función de la 0504 mira el valor de `event`, solo el `check` lo restringe. La purga de la 0508 tampoco.

El preflight exige la 0503, la 0504 y la 0506, y aborta si la 0513 ya se aplicó.

### 16.4 D7: dejar de empujar a Kommo

**Puerta sin abrir.** `CRM_ALTA_WEB_SIN_KOMMO` (`altaWebSinKommo`, `lib/studio/crm-alta-web.ts`) está apagado: solo `"1"` lo enciende, y vacío o cualquier otro valor deja la conducta de hoy, probado valor por valor. **Falta, en este orden:** la lectura L3 con OK de Sam (si `KOMMO_PUSH_DRY_RUN` vale `"false"`, solo sí o no); decidir con ese resultado; cargar la variable en el `.env` del servidor. Mientras esté apagado, un alta web de F2 nace con dos maestros, que es lo que D7 evita al encenderlo.

### 16.5 Límites conocidos

- **Las pruebas no bloquean de verdad:** PGlite tiene una conexión y la carrera se simula con un trigger que inserta la misma llave. La carrera real con `dblink` necesita Docker.
- **Dos tarjetas de una persona no se fusionan.** Pasa si escribió sin teléfono (tarjeta del contacto), se registró (tarjeta de la ficha) y después Chatwoot conoce su teléfono. Manda la de la ficha y la otra queda igual. Fusionarlas toca historial, tareas y notas; no hay regla en el contrato (**propuesta para 6.5 o 6.6**).
- **Si la tarjeta web falla, no se reintenta:** se crea cuando la persona escriba por Chatwoot, en «Registrado / recontacto» y con fuente de WhatsApp, o en la carga de 6.5. La atribución de esa alta se pierde. Un reintento pediría una cola en una ruta que no debe demorar.
- **UTM solo si llegan a `/registro`, y hoy casi ninguno llega.** Ningún enlace del sitio los lleva: los que apuntan ahí usan `?origen=`, `?est=` o `?ref=`, y los UTM de `/enlaces` van a otras páginas. Así que, por ahora, la atribución guardada es sobre todo el `origen`, salvo que un anuncio apunte directo a `/registro`. Conservarlos mientras la persona navega es una decisión aparte (cookie o almacenamiento del navegador, con su análisis de privacidad): **no se hizo**.
- **`conversation_updated` puede llegar antes que la tarjeta:** no hace nada, y el asesor llega con el siguiente mensaje, que trae el asignado.
- **Canales fuera del mapa** (`Channel::WebWidget`, Telegram, SMS y otros) no crean tarjeta. Si se conecta uno, hay que sumarlo a `fuenteDeCanal` y al `check` de `crm_tarjetas.fuente`.
- **Una conversación que abre DTD también crea tarjeta:** visto en producción el 2026-11-04. Está al final de esta spec, en «Pendiente de E6», y lo decide Sam.

### 16.6 Aceptación de 6.4

- [x] `conversation_created` o el primer mensaje entrante crea la tarjeta en la etapa que dice el segmento, con su fuente.
- [x] `conversation_updated` con asignado da asesor a la tarjeta que no lo tiene, por `chatwoot_agent_links`, sin pisar a nadie.
- [x] Los manejadores corren dos veces sin efecto doble (contrato PGlite y prueba del manejador).
- [x] Que Chatwoot 4.19.1 emite los eventos está confirmado en su fuente (§16.2) y la 0504 los admite con la migración nueva (§16.3).
- [x] `/registro` crea o liga la tarjeta con fuente web y su `origen`, y guarda los UTM.
- [x] **Un fallo de la tarjeta no rompe ni demora el registro** (`register-tarjeta-crm.test.ts`: base con error, promesa rechazada, llamada que lanza, promesa que no termina y `after()` que lanza).
- [x] No cambia nada visible para quien se registra (`register-atribucion-oculta.test.tsx`: mismo texto, solo campos ocultos).
- [x] D7 detrás de un interruptor apagado, sin cambiar la conducta de hoy (§16.4).
- [x] Control rojo y mutantes (§16.7): 43 de 43 del contrato y 7 de 7 de `/registro` y del manejador caen.
- [ ] `pnpm verify` (§16.7).
- [ ] Prueba de punta a punta con un Chatwoot real: fuera de este encargo. Sam cambió cómo se hace el 2026-11-03, en el chat del Director General: «Probar WhatsApp al publicar». En prueba, con cuenta aparte y sin datos reales: entrega firmada, conversación creada → tarjeta, asignar asesor, mensaje entrante (contador y aviso) y enrutamiento. En producción, justo después de publicar la tanda A, desde su teléfono al número de prueba: tarjeta por primer mensaje, volver desde «Perdido», fuente WhatsApp, teléfono y BSUID reales. Si falla la tarjeta, se quita el webhook.
- [ ] L3, y con ella D7: puerta de Sam.
- [ ] Aplicar la 0513: puerta de Sam.
- [x] Aceptación de Sam de la fila 6.4 (2026-11-03, en el chat del Director General, por el selector, a «¿Aceptas el paso 6.4? Sus pruebas de código pasan, pero nunca corrió contra un Chatwoot real»: «Acepto, con ese límite»; lo registra el Subdirector según la nota del Director General). Queda aceptado el código. El límite: sin probar contra un Chatwoot real, y esa prueba se hace en prueba antes de llevarlo a producción; dos tarjetas de la misma persona no se fusionan (§16.5); crear o ligar una tarjeta no deja rastro en la auditoría (AUD-01, abajo). No aplica ninguna migración: la 0513 lleva su propio OK.

**Clasificación de gobernanza** ([AGENT-BRIEF](../../governance/AGENT-BRIEF.md)):

| Política | Clasificación | Evidencia |
|---|---|---|
| SGE-00 | cumplimiento | El permiso vive en la base: las RPC son solo de `service_role` y las piezas internas no tienen grant de nadie (contrato). No hay superficie nueva para el usuario |
| AUD-01 | **no conformidad, pendiente** | Crear una tarjeta, ligarla a una ficha o darle asesor no deja evento en `entity_audit_log`. Los cambios de etapa sí quedan en `crm_historial_etapas`, pero con su propio contrato. **Arreglo propuesto:** un trigger en `crm_tarjetas` con ids y sin datos personales, en 6.6, que además agrega la acción «Anonimizar ahora». Pide ampliar `entity_audit_log_entity_type_check` desde su última definición, por eso no entra aquí |
| AUD-02 | no aplica | No cambia quién consulta, retiene ni exporta la bitácora |
| MP-01 | no aplica | Nada se borra ni se archiva desde aquí. El motivo de «Perdido» se limpia al volver, igual que en `crm_mover_etapa` |
| FRM-01 / ERR-01 | cumplimiento | El formulario y sus errores no cambian. Un fallo de la tarjeta no le llega a quien se registra: queda en el log con su código |
| BTN-01, A11Y-01, VIS-01, TBL-01 | no aplica | Sin pantalla nueva: en `/registro` solo se suman campos ocultos. `/ui-check` no aplica por lo mismo |

### 16.7 Evidencia

| Comprobación | Resultado |
|---|---|
| Contrato `supabase/tests/0513_crm_entrada_leads.test.sql` en PGlite (aplica la 0503, 0504, 0505, 0506 y 0513 reales) | PASÓ |
| Control rojo (sin la 0513), reaplicación y preflight sin la 0506 | PASÓ |
| Pruebas puntuales, ya con `codex/0582-e10-enrutamiento` fusionada: `lib/studio/chatwoot`, ruta del webhook, `app/registro`, atribución y contratos de `.env` | PASÓ: 490 pruebas en 42 archivos |
| `tsc` acotado a los archivos de 6.4 y sus dependencias, ya fusionado | PASÓ |
| ESLint de los archivos tocados, antes del merge | PASÓ |
| Gate de símbolos de migraciones pendientes | PASÓ: 0 ROJO, 9 AMARILLO declarados; la 0513 en `sdd-0587-crm-entrada` |
| Mutantes del contrato, sobre `fac203f66` (turno del Director General, una sola tanda) | PASÓ: 43 de 43 caen, cada uno en lo que lo nombra (31,6 s) |
| Mutantes de `/registro` y del manejador, sobre `fac203f66` | PASÓ: 7 de 7 caen, con control en verde antes y después y árbol limpio al final |
| `pnpm verify` | NO EJECUTADO: el Director General lo corre en la punta de la tanda A al integrar, y lo pide el Subdirector después de publicar |
| Prueba de punta a punta con Chatwoot y con producción | NO EJECUTADO: fuera de este encargo |
| Frase de `/privacidad` frente al texto aprobado (2026-11-03) | PASÓ con `node`: cada párrafo aprobado está igual en `page.tsx` y la frase está dentro de «Registro de cliente». `privacidad-chat.test.ts`: PASÓ, 5 de 5 |

### 16.8 revisar-datos-ve de 6.4

Sobre lo que 6.4 suma al modelo de §14.3 y §15.3. Estados de la skill: **ENCONTRADO**, **CORRECTO** o **NO VERIFICABLE**. Esto no es asesoría legal.

**Resumen:** 8 CORRECTO, 3 NO VERIFICABLE y 1 no aplica. El punto 7 fue ENCONTRADO y se corrigió el 2026-11-03.

**Inventario que suma este paso:**

| Dato | Dónde | De quién | Retención |
|---|---|---|---|
| Nombre visible, últimos 10 dígitos, ID de contacto, BSUID: ya estaban en el modelo y ahora se llenan solos | `crm_tarjetas` | Lead sin ficha | 12 meses sin actividad si está perdido (§14.3) |
| Origen (`fuente_detalle`) y UTM de quien se registra | `crm_tarjetas` | Quien se registra por la web | Con la tarjeta; se borra con la ficha (`on delete cascade`). Al anonimizar se conserva: no identifica sola |
| UTM en campos ocultos del formulario | `RegisterForm.tsx` | Quien se registra | Solo mientras viaja |

| # | Punto | Estado | Evidencia y comentario |
|---|---|---|---|
| 1 | Inventario | CORRECTO | Tabla de arriba. `crm_entrada_chatwoot` y `crm_alta_tarjeta_web` no reciben correo, documento, texto ni teléfono completo (`entrada-leads.test.ts`, `register-tarjeta-crm.test.ts`) |
| 2 | Minimización | CORRECTO | Un «nombre» que es teléfono o correo no se guarda (`nombreVisibleDe`, `webhook-events.ts`). Los UTM pasan por una lista corta de caracteres, sin `@`, `=` ni `%` (`registro-atribucion.ts`). El nombre no entra en `EventoChatwoot`. Con ficha no se copia nada |
| 3 | Consentimiento | NO VERIFICABLE | Sigue el punto 3 de §14.3: la tarjeta se crea sola con el primer mensaje, sin un acto de la persona. La base de licitud la decide Sam con su asesor. Los UTM de la web tampoco tienen consentimiento propio: se guardan sin pasar por el banner de cookies, porque son de la URL y no de una cookie |
| 4 | Derechos | NO VERIFICABLE | Depende de «Anonimizar ahora» de 6.6 (§14.3). Lo nuevo no le agrega un camino: se ve y se corrige en la ficha de la tarjeta, salvo la fuente y los UTM, que son fijos |
| 5 | Borrado | CORRECTO | Una tarjeta anonimizada no revive: quien vuelve a escribir empieza en una tarjeta nueva (contrato). Con ficha, se va con la purga (`on delete cascade`, 0506). No se probó contra una base real |
| 6 | Trazabilidad de solicitudes | NO VERIFICABLE | Igual que §14.3. Además, ver AUD-01 en §16.6 |
| 7 | Política pública | CORRECTO | `/privacidad` no decía que se guarde por qué enlace o campaña llegó quien se registra, y «medir nuestras campañas» lo condiciona a aceptar cookies, cosa que estos UTM no hacen. **Corregido:** «Registro de cliente» (`app/privacidad/page.tsx`) suma «También guardamos la campaña por la que llegaste, si el enlace la trae.». Sam aprobó el texto el 2026-11-03 («Apruebo el texto», en el chat del Director General) y ese mismo día cambió esta frase («Usar «el enlace»»), porque la primera redacción decía «si la dirección los trae» y se podía leer como la dirección postal. **Sale solo con la tanda A y las piezas que describe,** y la fecha se ajusta al publicar. Si cambia una palabra, se le vuelve a preguntar |
| 8 | Terceros | CORRECTO | No se envía nada nuevo fuera: el dato entra desde Chatwoot y desde el formulario. Con D7 apagado, Kommo recibe lo mismo de hoy. La retención dentro de Chatwoot sigue sin definir (§14.3, punto 8) |
| 9 | Transferencia internacional | CORRECTO | Todo vive en la base de DTD. Solo admin y comercial leen tarjetas (RLS de la 0506) |
| 10 | Decisiones automatizadas | CORRECTO | El segmento y la vuelta desde «Perdido» solo eligen etapa; no niegan servicio ni escriben al cliente. La tarea es interna y con texto fijo |
| 11 | Aceptación electrónica | No aplica | Este paso no registra aceptaciones |
| 12 | Titulares que no son usuarios | CORRECTO | El lead sin ficha sigue siendo este caso: lo mínimo, con su plazo de 12 meses, y el aviso ya está en `/privacidad`. El asesor es un empleado y solo queda su id |
| — | Logs | CORRECTO | Solo códigos (`entrada-leads.ts`, `crm-alta-web.ts`); las dos pruebas comprueban que no salgan nombre, teléfono, correo ni BSUID |
| — | Fixtures | CORRECTO | Solo nombres de prueba, teléfonos 555 y correos `example.test` |

La skill recomienda una segunda opinión: otro modelo puede auditar este mismo diff. **Lo que hace falta de un abogado:** la base de licitud. La redacción del punto 7 ya la aprobó Sam, y el pase de abogado sigue sin hacerse.

## 2026-11-04 · La 0506 y la 0513 aplicadas en producción: cierre del runbook §6

Aplicadas hoy por el Director General. Lo que antes en esta spec dice que no están aplicadas es de su fecha.

| Migración | COMMIT | `version` del ledger | md5 y bytes | Filas del ledger | PR | Evidencia, en `/srv/ops/evidencias/` | Sello en el candado, `ledger` exacta |
|---|---|---|---|---|---|---|---|
| `0506_crm_modelo` | 2026-11-04T04:33:28.805Z | `20261104043328` | `f44ed0afecfd58b22b23a1022d5d54c2`, 40916 | 509 | #336 | `apply-0506-dtd-cargo-20261104T043327Z` | `ec85f43c23d74dd2b27bac32e4ca85b5f35011dced4080ec1091d18a32d0ec0b` |
| `0513_crm_entrada_leads` | 2026-11-04T04:33:51.804Z | `20261104043351` | `034b50b506c77f909ccf4f67aa6468fe`, 20623 | 510 | #364 | `apply-0513-dtd-cargo-20261104T043350Z` | `26ce0b5ee550ee8d4ea688d60912dcb95c45cb0c1705a87d6575c170b5ba3c60` |

- **OK literal de Sam:** «Doy el mandato», en el chat del Director General, a «¿Das el mandato para terminar las fases 2, 3 y 4 sin detenerme?», 2026-11-03 ~20:10Z. Punto 2 del texto que vio: «Aplicar, primero en prueba y luego en dtd-cargo, de a una y con lectura previa». Registrado a nombre del Director General; el texto íntegro está en `AUTORIZACION.txt` de cada evidencia.
- **Ensayo en prueba:** las seis aplicadas de a una el 2026-11-04 sobre `5fbb25045`. Sobre la imagen de `56cb9f6d5`, sin cambio de blobs, `prueba-punta-a-punta.sh` dio 48 PASÓ y `prueba-reproceso.sh` 35 PASÓ, con 0 fallas. Evidencia en `/srv/ops/evidencias/chatwoot-e2e-prueba/`. Lo que depende de un WhatsApp real se prueba al publicar (`docs/runbooks/chatwoot-bandeja.md`).
- **Respaldo previo:** no se tomó uno antes de este apply. Fue una omisión del Director General, no una decisión. El más reciente es `dtd-cargo-20261103T170055Z`, unas 11,5 horas antes, el que tomó para la 0510 y la 0511. Él lo acepta porque las seis son objetos nuevos y aditivos y la marcha atrás no depende de restaurar. El automático corre a las 06:00Z y la publicación lleva el suyo.
- **Merge:** #336, 2026-11-04T08:19:50Z, `6cc14bd9c`; #337 (el tablero), 2026-11-04T09:05:05Z, `60d265fbc`; #364, 2026-11-04T09:55:14Z, `d62b06f6b`. Todas por el Director General.
- **Lectura de esta nota:** los datos salen de `IDENTIDAD.txt` y `registro.txt` de cada evidencia. Este cierre no consultó tablas de producción. El md5 y los bytes se comprobaron contra el archivo al sellar.
- **Espera:** salieron de `pendingBelowCutoff` y de las declaraciones de símbolos. Su cabecera «NO APLICADA A PRODUCCIÓN» no se corrige: la identidad se prueba por md5. Las pruebas que afirmaban la espera ahora afirman que salió. Los comentarios condicionales del código («sin la 0506…») siguen siendo ciertos para otro entorno y no cambian. La web no cambia ni se publica con este cierre.

## 2026-11-04 · Al publicar: la prueba de WhatsApp y un pendiente de E6

Publicada en `dtd-cargo` la imagen de `fe35eb2d1` a las 12:41:54Z, con el webhook de la cuenta 1 creado por Sam a las 12:37:58Z; las dos horas son las que reportó el Director General. Lo de abajo son conteos y horas, sin contenido de mensajes ni datos de personas.

### La prueba desde el 5202

| # | Medida | Estado |
|---|---|---|
| W1 | 2 `message_created`, 13:08:07Z y 13:08:41Z, `procesado` al primer intento | PASÓ |
| W2 | 1 tarjeta a las 13:08:08Z: `whatsapp_clientes`, etapa `nuevo`, con teléfono y contacto, sin ficha | PASÓ |
| W3 | Bandeja 2, 2 no leídos | PASÓ |
| W4 | Sam ve su tarjeta en Embudos. Contestó «Sí, la veo»; es su ojo, sin medida aparte | PASÓ, según Sam |
| W5 | Pasar la tarjeta a Perdido con motivo. A las 21:49Z no se ha hecho. Sí hay 2 cambios `manual` con actor y sin motivo: 21:02:28Z, la de Instagram, `nuevo` → `negociacion`; 21:02:31Z, la de WhatsApp, `nuevo` → `aceptado_esperando_carga`. Prueban que mover deja historial | PENDIENTE |
| W6 | Volver a escribir desde Perdido: depende de W5. 0 tareas de recontacto a las 21:49Z | PENDIENTE |
| W7 | El segundo mensaje no duplicó la tarjeta. Falta repetirlo después de W6 | Parcial |
| W8 | Sin agentes vinculados; el asesor ya se probó en prueba | NO APLICA |
| BSUID | Solo se guarda de un usuario sin teléfono, y este lo trae | NO VERIFICABLE |

La conversación existía desde 2026-10-30T17:01:12Z, así que la tarjeta nació del mensaje entrante y no de `conversation_created`. Es el camino que prueba no podía cubrir (`docs/runbooks/chatwoot-bandeja.md`). Que esos dos mensajes sean de Sam es inferencia por la hora y la bandeja, hasta que lo confirme.

### Pendiente de E6: una conversación que abre DTD crea una tarjeta de lead

**Lo medido** (Chatwoot y `dtd-cargo`, 19:50Z). En la bandeja 5, Instagram, desde el corte de `rails` de las 08:29:22Z hay 0 entrantes, 2 salientes sin remitente (18:22:02Z y 19:33:20Z) y 1 mensaje de actividad (19:33:23Z). El último entrante es de 2026-11-03T14:31:08Z. El saliente de las 19:33:20Z abrió una conversación nueva, y a las 19:33:22Z nació una tarjeta `instagram`, etapa `nuevo`, sin teléfono ni ficha y con contacto. Esa persona no había escrito en esa conversación.

**Lo leído.**
- `lib/studio/chatwoot/entrada-leads.ts:25` deja entrar todo `conversation_created`, sin mirar quién escribió. Pasa igual con una conversación que un agente abra desde Chatwoot en una bandeja con fuente.
- En Chatwoot 4.19.1, `app/jobs/webhooks/instagram_events_job.rb` trata `is_echo` como un saliente de la cuenta.
- En WhatsApp, `app/jobs/webhooks/whatsapp_events_job.rb` hace lo mismo con el campo `smb_message_echoes`, y `app/services/whatsapp/incoming_message_base_service.rb:172` deja el remitente vacío.

**Lo inferido.** Alguien de DTD escribió desde la app de Instagram y a Chatwoot le llegó el eco. Sale de ver saliente sin remitente; no se comprobó en Meta. Si es así, la entrada de Meta a Chatwoot sigue viva tras el corte.

**Lo no medido.**
- Si el 5202 o cualquier otra bandeja con eco crearía una tarjeta igual cuando alguien de DTD escribe desde el teléfono. El código de Chatwoot lo permite en WhatsApp si Meta entrega `smb_message_echoes`; no se sabe si los entrega para ese número.
- El primer entrante real de Instagram tras el corte: sigue sin llegar.

**La decisión es de Sam:** si alguien a quien DTD le escribió primero cuenta como lead. Se la presenta el Director General. El código no cambia hasta que decida, y las sesiones no borran ni mueven esa tarjeta. Sam la movió a `negociacion` a las 21:02:28Z; eso no se toma como su decisión.

## 2026-11-05 · `/privacidad` nombra Instagram

**Por qué.** La bandeja 5 tiene 10 entrantes de 9 remitentes desde 2026-10-31T22:36Z (conteo del Director General, sin nombres ni contenido). Sam dijo «Son clientes», a «¿Quién escribió por Instagram?»: es dicho por Sam, no medido. `/privacidad` no nombraba Instagram y entre los proveedores nombraba a Meta solo por WhatsApp.

**Decisiones de Sam, por el selector, en el chat del Director General; las registra el Subdirector:**

- A «Instagram ya recibe clientes reales sin la revisión de Meta. ¿Cómo queda?»: «Dejarlo conectado (Recommended)». Messenger y el envío a App Review siguen como estaban.
- A «/privacidad no nombra Instagram y ya entran datos de clientes por ahí. ¿Apruebas este cambio de texto?»: «Apruebo este texto (Recommended)». La opción decía: «Entra a main con estas palabras y se publica con la tanda C, con la fecha de actualización nueva.»
- A la pregunta sobre si ajustar el texto, después de ver lo que guarda Chatwoot del perfil: «Apruebo el texto ajustado (Recommended)». Ese párrafo reemplaza al de la respuesta anterior.

**Lo que trajo el ajuste** (conteos del Director General, 2026-11-05, sin leer valores). De los 9 contactos de la bandeja 5: 9 con foto, 9 con usuario, 9 con número de seguidores, 4 con «sigue a la cuenta», 9 con ID en `contact_inboxes`, 0 con teléfono, 0 con correo y 0 desconocidos.

**Texto aprobado**, palabra por palabra:

| Dónde | Antes | Ahora |
|---|---|---|
| Párrafo «Mensajes por WhatsApp y chat» | «Si nos escribes por WhatsApp u otro canal de chat: tu nombre y tu teléfono tal como aparecen en ese canal y el contenido de la conversación. Si no muestras tu teléfono, WhatsApp nos da en su lugar un código anónimo de tu cuenta (BSUID). Si todavía no eres cliente, guardamos tu nombre visible y los últimos 10 dígitos de tu teléfono para dar seguimiento a tu consulta.» | «Si nos escribes por WhatsApp, Instagram u otro canal de chat: tu nombre y tu usuario o teléfono tal como aparecen en ese canal, los datos de tu perfil que ese canal nos entrega (en Instagram, por ejemplo: un código de tu cuenta, tu foto, tu número de seguidores y si sigues nuestra cuenta) y el contenido de la conversación. Si no muestras tu teléfono, WhatsApp nos da en su lugar un código anónimo de tu cuenta (BSUID). Si todavía no eres cliente, guardamos tu nombre visible y, si lo tenemos, los últimos 10 dígitos de tu teléfono para dar seguimiento a tu consulta.» |
| Lista de proveedores | «**Meta (WhatsApp)**, que transporta los mensajes que nos envías y te enviamos por WhatsApp.» | «**Meta (WhatsApp e Instagram)**, que transporta los mensajes que nos envías y te enviamos por esos canales.» |
| Fecha, `UPDATED` | «4 de noviembre de 2026» | «5 de noviembre de 2026» |

La frase del sistema de atención no cambia. `privacidad-chat.test.ts` fija los dos textos completos. La fila de Meta de `docs/legal/privacidad/inventario-terceros.md` queda con Instagram activo y Messenger pendiente.

**Evidencia:**

| Comprobación | Resultado |
|---|---|
| `privacidad-chat.test.ts` y `faq-seguimiento-coherente.test.tsx` | PASÓ: 17 de 17 |
| Mutantes del texto: Instagram fuera del párrafo, «tu usuario o» fuera, los datos del perfil fuera, «tu foto» fuera, «si lo tenemos» fuera, fila de Meta vieja, «por esos canales», «propio sistema», fecha vieja | PASÓ: 9 de 9 caen, con el control en verde antes y después |
| Citas del texto viejo | Las 2 pruebas de arriba y `.agents/handoffs/0582-guion-publicacion-tanda-a.md`, que es historia y no se toca. Ningún guion ni `scripts/` lo cita |
| `pnpm verify` | NO EJECUTADO: necesita turno; el cambio son textos y sus pruebas |

### revisar-datos-ve de este cambio

Sobre lo que suma Instagram. Estados de la skill: **ENCONTRADO**, **CORRECTO** o **NO VERIFICABLE**. Esto no es asesoría legal. Lo de Chatwoot se leyó en el contenedor del VPS, imagen 4.19.1, sin datos de personas.

**Resumen:** 3 ENCONTRADO, 3 CORRECTO, 5 NO VERIFICABLE y 1 no aplica.

**Inventario que suma Instagram:**

| Dato | Dónde | De quién | Retención |
|---|---|---|---|
| Contenido de la conversación y adjuntos | Chatwoot | Quien escribe por Instagram | Sin definir en Chatwoot (§14.3, punto 8) |
| Nombre, usuario, foto, seguidores, si sigue a la cuenta, si la cuenta lo sigue y si está verificado. Meta los entrega: ver los conteos de arriba | Contacto de Chatwoot: nombre, avatar y `additional_attributes` | Igual | Igual |
| ID de Instagram de esa persona para la app; si Meta niega el perfil, va también en el nombre, «Unknown (IG: …)» | `contact_inboxes.source_id` y nombre del contacto, en Chatwoot | Igual | Igual |
| Nombre visible e ID de contacto, sin teléfono | `crm_tarjetas`, fuente `instagram` | Lead sin ficha | 12 meses sin actividad si está perdido (§14.3) |

| # | Punto | Estado | Evidencia y comentario |
|---|---|---|---|
| 1 | Inventario | CORRECTO | Tabla de arriba. `fetch_instagram_user` (`app/services/instagram/message_text.rb:10`), `webhooks_base_service.rb:26` y `:40-54`; `entrada-leads.ts:50-60` |
| 2 | Minimización | ENCONTRADO | Chatwoot pide y guarda foto, seguidores y las banderas de seguimiento, y Studio no los lee: `git grep` no halla `social_instagram`, `follower_count` ni `profile_pic` en `lib/`, `app/` ni `components/`. Es código de Chatwoot. Meta los entrega hoy, según los conteos de arriba, y la política ya lo dice. Arreglo posible: un `zz_dtd_*` que limite los campos, con SDD propia |
| 3 | Consentimiento | NO VERIFICABLE | Sigue el punto 3 de §14.3: la tarjeta se crea sola con el primer mensaje. La base de licitud la decide Sam con su asesor |
| 4 | Derechos | NO VERIFICABLE | Depende de «Anonimizar ahora» de 6.6 (§14.3). Para Instagram no hay teléfono con el que encontrar a la persona si lo pide: se busca por usuario, si Meta lo entregó |
| 5 | Borrado | NO VERIFICABLE | En la tarjeta es igual para todas las fuentes: `crm_anonimizar_leads_perdidos` no filtra por fuente (`0506_crm_modelo.sql:768-774`); falta su cron, de 6.6. En Chatwoot sigue sin plazo (§14.3, punto 8), y la conversación queda también en la cuenta de Instagram, en Meta. No se probó contra una base real |
| 6 | Trazabilidad de solicitudes | NO VERIFICABLE | Igual que §14.3 |
| 7 | Política pública | ENCONTRADO | **Corregido:** Instagram, los datos del perfil, el código de la cuenta y el «si lo tenemos» del teléfono (`app/privacidad/page.tsx:57` y `:257`). **Quedan dos puntos sin corregir, en la lista del Director General para Sam:** (a) «nuestro propio sistema de atención», cuando las 5 respuestas reales de la bandeja 5 se escribieron por fuera de Chatwoot, y ninguna por la API, según el conteo del Director General, que filtra las 2 notas privadas; (b) la bandeja 4 de Messenger está conectada y la fila de Meta no la nombra. Lo publicado obliga por haberse publicado |
| 8 | Terceros | CORRECTO | Fila de Meta en `inventario-terceros.md`. El contrato con Meta y sus términos no se revisaron. Si los salientes por fuera pasan por otra herramienta conectada, sería otro tercero: sin medir |
| 9 | Transferencia internacional | NO VERIFICABLE | Meta recibe estas conversaciones como las de WhatsApp. Dónde las procesa no se revisó; sigue el punto 9 de SDD-0585 |
| 10 | Decisiones automatizadas | CORRECTO | La respuesta automática de E10 no toca Instagram: `enrutar.ts:43` solo sigue en la bandeja de leads. La auto-asignación a una cuenta no decide sobre la persona |
| 11 | Aceptación electrónica | No aplica | Este cambio no registra aceptaciones |
| 12 | Titulares que no son usuarios | ENCONTRADO | Quien escribe por Instagram no pasó por ningún registro ni recibe aviso al escribir. Desde 2026-10-31 hasta que salga este texto, `/privacidad` no lo nombró; lo cubría solo «otro canal de chat», desde la tanda A. Si hace falta un aviso en el canal lo decide Sam con su asesor |
| — | Logs | ENCONTRADO fuera del conteo | Son dos líneas de código de Chatwoot. (1) `instagram_events_job.rb:53` escribe a nivel `info` todo lo que entrega Meta de cada mensaje, con ID del remitente y texto (`LOG_LEVEL` por defecto `info`, `infra/chatwoot/compose.yml:105`, rotación de 10 MB por 5 archivos). Corre en cada entrante. (2) Si un envío falla, `base_send_service.rb:65` escribe el destinatario y el texto. `zz_dtd_redaccion_logs.rb` tapa `payload=`, correos y teléfonos, no esto. El valor vivo de `LOG_LEVEL` y las líneas reales no se leyeron |
| — | Fixtures | CORRECTO fuera del conteo | Las pruebas nuevas solo contienen el texto de la política |

La skill recomienda una segunda opinión: otro modelo puede auditar este mismo diff. **Lo que hace falta de un abogado:** la base de licitud y el pase de la política, que sigue sin hacerse.
