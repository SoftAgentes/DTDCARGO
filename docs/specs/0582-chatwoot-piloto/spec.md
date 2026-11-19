---
sdd: "0582"
title: "Programa Kommo → Chatwoot dentro de Studio, con checklist y avance medible"
status: proposed
author: "Claude Worker «Chatwoot piloto» (Sam)"
created: 2026-10-28
updated: 2026-11-19
supersedes: null
superseded_by: null
related: ["0020", "0056", "0089", "0114", "0147", "0326", "0535", "0564"]
confidencialidad: interno
---

# SDD-0582 — Programa Kommo → Chatwoot dentro de Studio

> Esta SDD es la **spec del programa**. No instala nada ni toca producción, Kommo, Meta ni Hostinger.

Define:
- el alcance del 100%;
- las etapas E0–E10 y sus puertas;
- la metodología de avance;
- las reglas que debe cumplir cada SDD hija.

El estado vivo está en [`checklist.md`](checklist.md). La evidencia, una por afirmación, está en [`investigacion-2026-10-28.md`](investigacion-2026-10-28.md). La IA ejecutora sigue [`instrucciones-ia.md`](instrucciones-ia.md).

## Pedido de Sam

Extractos literales del 2026-10-28:

- «Piloto de Chatwoot». «Realmente quiero ya pasarme y salirme de Kommo, porque la IA de Kommo me sale demasiado costosa.»
- «requiero que investigues cómo puedo instalar este CRM, Chatwoot, para que lo pueda visualizar y trabajar adentro de mi ERP, no de forma externa».
- «revisar cómo podemos pasar todo el historial y que sea lo menos drástico pasar el número de WhatsApp API». Canales: Instagram, Facebook, TikTok, WhatsApp y correo, «para que se puedan contestar ahí mismo». Conectar las IA «con el knowledge que tenemos de Kommo».
- Metodología: «un checklist de todo con los pasos y los días pronosticados», indicando «en qué etapa estamos y qué porcentaje hace falta». El 100% va «desde la puesta en marcha adentro del VPS hasta la migración completa y funcionamiento». «seguiremos trabajando con Kommo hasta que ese 100% se complete».

Respuestas y aportes:

1. **Bandeja dentro de Studio:** entra en el 100%.
2. **WhatsApp:** solo el número API. «deja de tarea para que EN EL FUTURO… seamos tech provider de Meta».
3. **Embudo:** propio en Studio.
4. **Bot:** «bot propio contestando solo», gastando lo menos posible.
5. **Actualizaciones de Chatwoot:** un botón en Studio que muestre qué implica cada versión, con análisis por IA.
6. **OpenCode como API:** opción para el bot. «analiza mi contestación» ya está trabajado.
7. **Usuarios y permisos en Studio:** «Actualmente es una sola persona, pero hay otra persona que puede ver y puede contestar».
8. **Control de la IA:** un botón de encendido y apagado, y la «respuesta sugerida por la IA», que la persona copia o ignora.
9. **Revisión de Codex del plan** (23 hallazgos): «Sí, incorpóralas».
10. **Kommo fuera del ERP, sin rastro:** quitar todo lo de Kommo del ERP «para que ya no haya rastro de ello y trabajemos desde cero». Decidido: **al corte**, con los datos **exportados y luego borrados**.
11. **Guía interactiva** en el ERP, «mostrando cómo se hacía en Kommo y cómo se hace aquí». Minimalista y poco intrusiva: aparece la primera vez y se activa o desactiva libremente.

## Alcance del 100%

**Dentro:**
- Chatwoot `v4.19.1-ce` en un VPS;
- bandeja dentro de Studio, con usuarios y permisos;
- actualizaciones gestionadas desde Studio;
- WhatsApp (número API), Messenger, Instagram, TikTok (condicional) y correo;
- historial de Kommo cargado;
- embudo propio y reemplazos de lo que hoy hace Kommo en el ERP;
- ~~bot propio con modos~~ (sale de la línea base v5, 2026-11-19; ver «Cambio de alcance v5: corte sin esperar el bot propio»);
- guía interactiva;
- corte, salida de Kommo y limpieza del ERP;
- dos números de WhatsApp, uno de leads y otro de clientes, con enrutamiento por segmento desde el ERP (línea base v2, E10).

**Kommo sigue operando hasta el 100%.**

**Fuera (después del 100%):**
- DTD como Tech Provider de Meta;
- rol «solo ver»;
- panel junto al chat y tema por `DASHBOARD_SCRIPTS`;
- atención móvil dentro de Studio;
- integración de comentarios de IG y FB, si la matriz de paridad decide atenderlos a mano temporalmente;
- n8n para pegamento no crítico, que se evalúa después del 100 % (ver «Cambio de alcance v2»).

## Decisiones técnicas (evidencia en la investigación)

| ID | Decisión |
|---|---|
| A | **Modo híbrido.** El panel de Chatwoot va en un iframe sobre `chat.dtdcargo.com`. Son nativos de Studio el SSO (Platform API), el contador y el push, la tarjeta en la ficha, la Dashboard App «Ficha DTD» y las altas y bajas. Traefik quita `X-Frame-Options` y fija `frame-ancestors`. Studio añade `frame-src` y `Permissions-Policy`. La aceptación del SSO prueba cierre, baja, revocación y acceso directo. Si la prueba E2.1 falla, se abre en una pestaña aparte. |
| B | **El número se comparte, no se migra,** y se protege: un initializer aborta `/register` para los Phone Number IDs protegidos. Los valores previos de Meta se guardan fuera de Git; la vuelta atrás los restaura. Pago propio en Meta antes de atender. **Actualizado el 2026-10-29 (Sam, «Apruebo todo», 2026-10-29):** el número se queda en el portfolio verificado «Importador de China». Con el modelo nuevo de Meta, Chatwoot usa **su propia cuenta de mensajes** en ese portfolio, con la app de DTD, su usuario del sistema, sus plantillas (las 5 de Kommo se recrean y se aprueban) y su pago propio. La 2FA en «Importador de China» queda **sin exigir** por decisión de Sam del 2026-10-29 («No quiero activar el verificador de dos pasos de importador de China. Déjalo así por ahora. Quítalo del checklist y avancemos»): riesgo aceptado (M-28). Evidencia: [registro E0](investigacion-2026-10-29-e0.md), M-8 a M-31. |
| C | **Historial** por `GET /api/v4/talks/{id}/messages`, probado en E0. Carga a una bandeja API «Archivo Kommo» en un modo sin efectos externos. Acta de conciliación antes de lo irreversible. |
| D | **Canales:** cada trámite separado en expediente, app, configuración, demostración y revisión. Matriz de paridad de las fuentes de leads. |
| E | **Correo:** inventario de `info@` primero, con pruebas de hilo, adjuntos, rebotes y caída. Resend Inbound no se cierra hasta conocer sus consumidores. |
| F | **Bot `dtd-bot`:** Gemini de pago y GLM por API de respaldo, con corte de gasto local. Cola durable, modo comprobado antes de enviar, filtro de autor y privacidad. «Contesta solo» bloqueado hasta aprobar la excepción IA-01 acotada. |
| G | **Máquina (decisión de Sam del 2026-10-29, paso 0.2):** el VPS actual del ERP (Contabo Cloud VPS 8), con límites de CPU y memoria por servicio y respaldo fuera del host. La medición de capacidad está en el [registro E0](investigacion-2026-10-29-e0.md) (VPS-1 a VPS-7). Si la vigilancia de 1.6 sale mal, el plan B es un Cloud VPS 4 dedicado, como cambio de alcance con OK de Sam. **Ratificada por Sam el 2026-11-01 al cerrar la 1.6** («¿Aceptas el 1.6 y dejas Chatwoot en este VPS?» → «Sí, acepto el 1.6», transmitido por el Director): Chatwoot se queda en este VPS, aunque la fila de presión de CPU falla (p95 98,85 en total; 53,85 sin el episodio del 2026-10-31 al 2026-11-01, con dos rachas de 20 y 21 min sobre 60). El plan B no se activa. El criterio se vuelve a leer al cerrar E4 ([runbook de vigilancia §4](../../runbooks/chatwoot-vigilancia.md)). |
| H | **Actualizaciones:** RPO/RTO, ventana, drenaje, respaldo conjunto, prueba, producción y smoke. El análisis con IA solo informa. |
| I | **Permisos de CE:** un agente ve por bandeja **o por equipo** y ve los contactos de la cuenta. Studio sincroniza rol, bandejas y equipos. |
| J | **Limpieza de Kommo en el ERP:** 209 archivos al 2026-10-28. E6 construye los reemplazos. E8 detiene los productores, exporta cifrado, quita el código en una SDD de limpieza y borra tablas con migración aprobada. |
| K | **Guía interactiva:** motor propio y liviano, con estado por usuario en la base (patrón de la 0233). Primera vez automática y botón «Guía». Dentro de Chatwoot, script por `DASHBOARD_SCRIPTS` activado por `postMessage`. |

**Límites de «sin rastro»:**
- las migraciones aplicadas, el historial de Git y las specs y handoffs históricos se quedan;
- `entity_audit_log` se cuenta y lo decide revisar-datos-ve;
- en código vivo, pantallas, crons, funciones, secretos y tablas, **cero rastro**.

## Prohibiciones del número de WhatsApp

**Nunca:**
- borrar el número en WhatsApp Manager;
- `/deregister`;
- Embedded Signup sobre el número principal;
- una 2.ª **cuenta de WhatsApp** para el número, o moverlo a otro portfolio;
- más de una cuenta de mensajes de DTD para Chatwoot (se permite exactamente una, decisión B);
- reintentar `/register`;
- crear la bandeja del número principal sin el initializer de protección probado (4.2);
- crearla sin el gate 0.3 aprobado.

**Sin retorno, cada una con su OK nominal:**
- quitar el canal en Kommo;
- quitar a Kommo como socio en Meta;
- borrar las tablas de Kommo;
- cancelar la licencia.

## Gobernanza

- **Etapas con SDD hija.** Cada etapa con código o infraestructura es una tarea Worker con su SDD hija (`sdd:next --reserve`), rama, worktree, owner, allowlist, aceptación y PR. El Director coordina e integra.
- **Puertas separadas.** Un OK no cubre otro:
  - lectura de PII;
  - carga de datos;
  - despliegue;
  - aplicación de migraciones (runbook de producción);
  - acción irreversible en Meta o Kommo.
- **IA-01:** el bot arranca en Sugerir. «Contesta solo» exige la excepción acotada del paso 7.2: bandejas, tipos de respuesta, herramientas, datos, prohibiciones, tope de gasto, responsable, revocación y suspensión.
- **Privacidad:**
  - revisar-datos-ve corre en E1, E5, E7 y E8;
  - nunca entran en Git payloads, exportaciones, transcripciones ni capturas con datos personales;
  - los valores de Meta y las exportaciones van cifrados fuera del repo.

## Cambio de alcance v2 (2026-10-29)

Sam lo aprobó al aprobar el plan del Director en la app; no hay frase literal, así que se registra como «aprobación del plan v3 del Director, 2026-10-29». La línea base pasa de **v1, 99,75 días** a **v2, 109,25 días** (0.8, 4.9, 6.3 y E10 en el [checklist](checklist.md)). La evidencia está en el [registro E0](investigacion-2026-10-29-e0.md#línea-base-v2--fuentes-y-verificación-del-código-2026-10-29), filas V2-1 a V2-14. Etiquetas: **C** código, **D** documentación de un proveedor, **I** inferencia, **NV** no verificado.

### Dos números en el mismo portafolio

- ~~Número nuevo para el público y los leads; el actual, solo para clientes~~ (plan v3): **lo cambió Sam el 2026-10-30**, ver «Enmienda del 0.8» abajo. Hoy: **clientes → número nuevo (termina en 5202)**; **leads nuevos y registrados → número viejo (termina en 8021, el de `CONTACT.ve.whatsapp`)**.
- **Va en el mismo portafolio, «Importador de China».** Con los usernames de WhatsApp, Meta identifica a cada usuario con un ID por portafolio (BSUID), y si el usuario adopta un username su teléfono puede no llegar en los webhooks (**D**, V2-1 y V2-2). Que un número de otro portafolio no le pueda escribir con ese ID se deduce del alcance por portafolio (**I**, V2-1).
- El número nuevo arranca con un tope bajo de mensajes iniciados por DTD, que no limita atender (**NV**; se comprueba en 4.9). Como ahora es el de clientes, ese tope pesa: ver (c) en la enmienda.
- Las prohibiciones del número actual no cambian. Cómo queda el número nuevo frente a la regla de «una sola cuenta de mensajes de DTD para Chatwoot» (decisión B) se confirma en 4.9 (**NV**).

### Enmienda del 0.8: reparto de los números (2026-10-30)

Sam cambió el reparto el 2026-10-30; su texto literal: «este whatapp va ser para cliente y el numero viejo paraleeds y leed registrados con numero de markbox». **0.8 sigue aceptado**; esto lo enmienda (S08-8 y S08-9).

| Segmento | Número | Dónde se atiende |
|---|---|---|
| **Cliente** | número nuevo (termina en 5202), en la cuenta de mensajes nueva «DTD Cargo Clientes» (ID en la nota cifrada; huella sha256 `0c535f011d35`) | Chatwoot (4.9) |
| **Lead nuevo y lead registrado (con markbox)** | número viejo (termina en 8021, el de `CONTACT.ve.whatsapp`) | Kommo hasta que pase a Chatwoot (4.5 / corte en E8) |

Consecuencias:

- **(a) La web pública no cambia de número.** Ya apunta al viejo, que queda para leads. 10.4 se achica: solo el portal muestra el número nuevo a los clientes. Los días de 10.4 no se tocan hasta reestimarla al arrancar.
- **(b) La redirección automática del bot (10.2) solo opera cuando el número viejo pase a Chatwoot** (4.5 / E8). Mientras siga en Kommo, sus mensajes no llegan al webhook de Chatwoot (**I**). Hasta entonces, los clientes se pasan al número nuevo con aviso: en el portal, con un mensaje y por el equipo.
- **(c) El número nuevo arranca con el tope inicial de mensajes que inicia DTD.** Los avisos a clientes salen de ahí, así que hay que vigilar su escalado (4.9). Ese tope no limita atender (**NV**).
- **(d) En E10 solo se intercambia la configuración de números;** el código no cambia.
- Las cifras del % no cambian: no se suman ni se quitan días.

### Regla de segmentos (fuente única: el ERP)

| Segmento | Regla | Número y embudo |
|---|---|---|
| **Cliente** | Algún `shipments` vivo (`deleted_at is null` y estado distinto de `draft` y `cancelled`) **o** algún recibo vivo en `warehouse_receipts_cn` (`deleted_at is null`), con un `client_markbox` igual a uno de sus códigos: el vigente, los del historial o los de las fichas fusionadas en él (Sam, 0.8) | Número de clientes, el nuevo · embudo **Clientes** |
| **Lead registrado** | Está en `clients` pero no cumple la regla de cliente | Número de leads, el viejo · embudo **Leads**, etapa «Registrado / recontacto» |
| **Lead nuevo** | No está en `clients`, o su teléfono es ambiguo o desconocido | Número de leads, el viejo · embudo **Leads**, etapa «Nuevo» |

- **Hoy el ERP no distingue cliente de registrado:** el router de Kommo trata como «cliente» a cualquiera que esté en `clients` (`supabase/functions/_shared/kommo-router.ts:85-111`, **C**, V2-4).
- **El cruce es por `clients.phone_last10`** (`supabase/migrations/0383_clients_phone_last10_y_vinculo.sql:64-80`). Tiene índices pero no es única, así que más de un candidato se trata como desconocido, igual que hoy (`kommo-router.ts:108-110`) (**C**, V2-5).
- **Los envíos se ligan por texto** en `shipments.client_markbox` (`supabase/migrations/0002_shipments.sql:36`). Los códigos viejos o fusionados salen de `client_outstanding` (`supabase/migrations/0492_client_outstanding.sql:215`). La carga en China está en `warehouse_receipts_cn` (`supabase/migrations/0008_warehouses_cn.sql:52`) (**C**, V2-6).
- **La regla de «cliente» la decidió Sam en 0.8** (2026-10-30, por el selector, respuestas literales):
  - «¿Cuenta como cliente quien ya tiene carga recibida en China, aunque todavía no tenga envío creado?» → «Sí cuenta (Recomendado)».
  - «Si a un cliente le cancelan o borran su único envío, ¿qué pasa?» → «Vuelve a lead (Recomendado)».
- **Envío vivo** (**C**): `shipments.deleted_at is null` (`supabase/migrations/0002_shipments.sql:48`) y `status` (`:40`) distinto de `draft` y `cancelled` (enum en `:15-29`).
- **Recibo vivo = `deleted_at is null`** (**C**). Es el único criterio que define la tabla:
  - tiene borrado suave (`supabase/migrations/0008_warehouses_cn.sql:78`) y sus índices filtran `where deleted_at is null` (`:87-97`);
  - desde la 0476 solo se borra con `soft_delete_warehouse_receipts_cn_with_audit_reason`, con motivo (`supabase/migrations/0476_borrado_embarques_recepciones.sql:671`);
  - no hay estado «anulado»: `warehouse_receipt_status` solo tiene `pendiente_consolidacion`, `consolidado` e `incidencia` (`0008_warehouses_cn.sql:8-12`).
  - **Si un recibo en `incidencia` cuenta como carga recibida es NV y se decide en 10.1.**
  - Una caja huérfana (`is_orphan`, sin `client_markbox`, `0008_warehouses_cn.sql:58-61`) no cuenta para nadie hasta que se le asigne dueño (**I**).
- **Códigos del cliente** (**C**): el vigente en `clients.markbox`, el historial en `client_markbox_history` (`supabase/migrations/0367_client_markbox_historial.sql:39`) y las fichas fusionadas por `merged_into_client_id` (`supabase/migrations/0341_client_merge_duplicados.sql:41`; `resolve_markbox` en `:89`). `client_outstanding` ya arma ese conjunto (`supabase/migrations/0492_client_outstanding.sql:61-63` y `:259-290`); 10.1 lo reutiliza o copia su patrón.
- **Quien pierde su único envío vivo** (cancelado o borrado) y no tiene carga viva en China **vuelve a lead registrado**. Como la regla se calcula en el momento, pasa solo: sin migración y sin marca guardada. Su tarjeta vuelve al embudo Leads (6.3 y 10.5). (Decisión de Sam; el mecanismo es **I**.)
- La regla se calcula **siempre en el momento** y no se guarda como estado. Va en una función SQL de solo lectura, sin datos personales en la salida y con contrato en PGlite (10.1).
- Un lead nuevo pasa a registrado al registrarse, y a cliente con su primer envío vivo o su primera carga recibida en China. Su tarjeta cambia de embudo sola (6.3 y 10.5).

### Redirección sin IA

- **El bot no usa IA.** Dentro de la ventana de 24 h, al cliente que escribe al número de leads le contesta en **1 mensaje** (0.8) con un texto y un enlace `wa.me/<número de clientes>?text=…` (10.2). Solo funciona cuando el número viejo esté en Chatwoot: ver (b) en la enmienda del 0.8.
- ~~Que esa respuesta no se cobre dentro de la ventana de servicio~~: **refutado en la v3**. Desde el 2026-10-01 cuenta contra el cupo de 1.000 mensajes de servicio gratis al mes del número (ver «Cambio de alcance v3»).
- **Botón CTA URL:** Meta documenta el mensaje interactivo `cta_url` (**D**, V2-3). Que Chatwoot lo envíe está **NV**, así que el enlace va en el texto.
- **Usuario con username y sin teléfono (BSUID):** el bot no pide códigos ni teléfono. Contesta lo mismo a todos, «si ya eres cliente, escríbenos aquí», y guarda el BSUID (10.3). Así no revela si un número o un código existe. (Diseño, **I**.)
- ~~**No se le escribe al cliente desde el número de clientes.**~~ **Enmendada el 2026-11-16** (ver la entrada de Seguimiento de esa fecha).
  - La **redirección** sigue igual: el bot no le escribe primero al cliente desde el número de clientes, porque con el enlace basta y el cliente es quien inicia.
  - **Sí se permite** que DTD le escriba primero desde el número de clientes, con **plantillas aprobadas por Meta**. Condiciones:
    - utilidad, solo con un embarque, pago, documento o entrega real de ese cliente;
    - marketing, solo a quien aceptó avisos de DTD Cargo por WhatsApp, como máximo uno por persona a la semana, y con el botón «Detener promociones».

    El juego propuesto está en [`docs/marketing/whatsapp-plantillas-por-numero.md`](../../marketing/whatsapp-plantillas-por-numero.md) §4.
  - Fuera de la ventana de 24 h, Meta exige plantilla y consentimiento (**D**: [Meta, «Pricing»](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing) y [«Getting opt-in»](https://developers.facebook.com/documentation/business-messaging/whatsapp/getting-opt-in), leídas el 2026-11-16).
  - Cada envío iniciado por DTD cuenta contra el tope de (c), y eso incluye el aviso de cambio de número de (b).
  - Crear cada plantilla en Meta sigue pidiendo el OK de Sam con el texto exacto.
  - Automatizar los envíos es otra tarea, con su SDD.

### Tickets del portal a los embudos

- `conversations` lleva `client_id` (`supabase/migrations/0106_conversaciones.sql:45`). `conversation_messages` se liga por `conversation_id`; el plan v3 decía que las dos llevaban `client_id` (**C**, V2-7).
- El enganche va justo después de `notifyConversationInbound` en `app/portal/(app)/mensajes/actions.ts:45` (**C**, V2-8). Un cliente va al embudo Clientes, y un registrado sin envío vivo va a Leads registrados (10.5, requiere 6.3).
- **Web y portal con el número correcto (10.4):** la web no cambia y el portal muestra el número nuevo a los clientes (enmienda del 0.8, (a)).
  - El sitio público usa una sola constante, `CONTACT.ve.whatsapp` / `whatsappRaw` (`lib/design-tokens.ts:245-246`), con `buildWhatsAppLink` (`lib/design-tokens.ts:146-149`) en 44 archivos fuera de pruebas. Hay un número escrito a mano en `components/servicios/FichaF2.tsx:69` (**C**, V2-9).
  - El portal sabe quién es la persona con `get_portal_client_id()` (`supabase/migrations/0080_portal_cliente.sql:40`), así que puede mostrar el número según su segmento (**C**, V2-10).

### Decisión sobre n8n

- **n8n no se usa para el enrutamiento: todo va en Studio.** Las razones:
  1. Los datos sensibles se quedan en el ERP. n8n guarda por defecto los datos de cada ejecución, con teléfonos y mensajes (**I**, del plan v3; no se contrastó con la documentación de n8n). Además, necesitaría una llave de la base o un endpoint nuevo.
  2. La regla es simple: tres casos y una respuesta. Va con pruebas, contratos SQL y el despliegue de siempre.
  3. Es un servicio menos que asegurar, respaldar y actualizar en el VPS.
  4. Studio ya tiene su motor de flujos «N8N-lite» (`supabase/migrations/0143_workflow_engine.sql:4`, **C**, V2-11).
- **Se puede evaluar después del 100 %** para pegamento no crítico, como reportes y avisos: aislado, sin guardar ejecuciones y llamando solo a endpoints de Studio con secreto.
- El bot con IA de E7 sigue con el motor de la v2 de esta spec.

### Alerta de Meta «Datos restringidos»

- Es **informativa** y no pide ninguna acción. La causa probable es la regla del DOJ de EE. UU. sobre «países de preocupación» (**I**, inferida; no hay fuente leída en esta tarea, V2-12).

### Dependencias de los pasos nuevos

- 4.3 (número de prueba) → 4.9 (número nuevo, de clientes).
- 2.3 (webhook de Chatwoot a Studio) → 10.1–10.3 → 10.6.
- 6.3 → 10.5.
- 10.4 (solo el portal) va al final, con el número nuevo vivo.
- 10.2 en automático solo después de 4.5 / E8, con el número viejo en Chatwoot.
- E10 se reserva como SDD hija con `sdd:next --reserve` cuando arranque, después de 2.3.

## Cambio de alcance v3 (2026-10-29)

Sam aprobó el análisis comparativo del Director: el video y el kit de Basdonax, la guía de Meta en .docx, la calculadora de WhatsApp, el contraplan de Codex y el costo por chat. No hay frase literal, así que se registra como «aprobación del análisis comparativo del Director, 2026-10-29». La línea base pasa de **v2, 109,25 días** a **v3, 115,5 días** (**114,5 sin el 2.8 opcional**). La evidencia está en el [registro E0](investigacion-2026-10-29-e0.md#línea-base-v3--fuentes-2026-10-29), filas V3-1 a V3-12. Etiquetas: **C** código, **D** documentación de un proveedor o fuente leída, **I** inferencia, **NV** no verificado.

### Pasos que cambian

| Paso | Cambio | Días |
|---|---|---:|
| 0.8 | Dos decisiones más de Sam: bot con 1 o 3 globos por respuesta, y qué pasa cuando un cliente pierde su único envío vivo | +0,25 |
| 2.3 | Acción pendiente durable en la misma transacción que el evento, con reintento recuperable; tope de tamaño del cuerpo; reconciliación recuperable | +1,5 |
| 2.6 | Pruebas de caída del webhook | +0,5 |
| 2.8 | **Opcional, nuevo.** Costo de referencia por chat en la Ficha DTD, sin migración | +1 |
| 4.3 | Salida: si en 1 día no hay ida y vuelta con Chatwoot, se adelanta 4.9 | 0 |
| 4.9 | Guía propia de alta corregida, ID nuevo en la lista protegida de 4.2, alarma del cupo de 1.000 y fallas de entrega | +0,75 |
| 6.7 | Revisar con su costo los «Ping 23 h» | +0,25 |
| 7.5 | Matriz de foto, audio, PDF y formato desconocido | +0,5 |
| 7.6 | Frenos del bot con estado durable y falla cerrada; costo de la IA por llamada | +0,75 |
| 7.7 | «Resolver» calla al bot y la opción «solo el primer mensaje» | +0,25 |
| 7.9 | Pruebas de reinicio de los frenos y de pase a humano por formato | +0,5 |
| **Total** | | **+6,25** |

El análisis agrupa los +5,25 días por bloques (2.3/2.6, 4.1/4.3/4.9, 0.8/4.3/4.9/6.7, 7.6/7.9, 7.7 y 7.5/7.9). **El reparto por fila es de esta tarea (I)**: suma lo mismo y se puede mover dentro de cada bloque con una línea base nueva.

### Corrección del supuesto de costos de Meta

- **Desde el 2026-10-01, Meta cobra las respuestas.** Cada número tiene **1.000 mensajes de servicio entregados gratis al mes**; no se acumulan, y después se cobra cada mensaje según el mercado de quien recibe (**D**, V3-1). La frase «dentro de la ventana de 24 h la respuesta es gratis» (V2-14) **queda refutada** a partir de los 1.000 al mes.
- **Mercado:** se cobra por el código de país del destinatario, y **Venezuela (+58) está en «Resto de Latinoamérica»** (**D**, V3-1).
- **Tarifa de referencia: US$0,0113 por mensaje** para Resto de Latinoamérica, del tarifario de Meta de **enero de 2026** (copia de un BSP) y de la calculadora (**D**, V3-2). **La tarifa vigente desde octubre de 2026 es NV:** la página de precios remite a tablas en CSV y PDF que no se leyeron.
- Cuenta **cada mensaje que sale del número**, lo escriba una persona o el bot (**D**, V3-1, según el análisis). El tope de US$25 al mes de la IA (E0-D3) no incluye a Meta.
- **Impacto:**
  - **E10 (10.2):** la respuesta de redirección cuenta contra el cupo de 1.000 del número de leads. Con dos números hay dos cupos (**I**).
  - **E7:** el costo del bot es IA + Meta. Sam decidió en 0.8 que responda en **1 mensaje** («1 mensaje (Recomendado)», 2026-10-30); con 3 globos se habrían triplicado los mensajes cobrables.
  - **6.7:** cada «Ping 23 h» que se reemplace ahora puede costar; se revisa con su costo.
- **Orden de magnitud (I/NV):** con ~1.960 respuestas al mes por WhatsApp (X-4 y X-5) en **1 mensaje**, que es lo decidido, ≈ US$11 al mes después de los 1.000 gratis, con la tarifa de enero (la de octubre es NV). Con 3 globos habrían sido ≈ US$55. No cuenta el segundo cupo.

### Corrección de la guía del PIN

- El `pin` de `/register` es el **PIN de verificación en dos pasos, de 6 dígitos**, no el código del SMS. Si el número no tiene uno, el que se envía queda como PIN nuevo (**D**, V3-3).
- Meta limita `register` a **10 intentos por número en una ventana móvil de 72 h**; al pasarse da el error 133016 y bloquea el registro 72 h (**D**, V3-3).
- Para 4.9: el PIN lo elige DTD, va en la nota cifrada y nunca en Git. Para el número principal no cambia nada: `/register` sigue prohibido (decisión B y 4.2).

### Qué adoptamos del kit y qué no

**Se adopta, con estado durable y no en memoria:**
- frenos del bot: ráfagas, tope por conversación en 24 h, recortes de entrada y salida, y pase a humano si algo falla (7.6). El kit los tiene en memoria del proceso y se pierden al reiniciar (**D**, V3-5);
- «resolver» calla al bot y «solo el primer mensaje» (7.7) (**D**, V3-5);
- **falla cerrada**, al revés que el kit: ante la duda, `dtd-bot` no envía y pasa a humano (**D** sobre el kit, V3-6; **I** como regla nuestra);
- fotos, audios y PDF con un proveedor aprobado, sin OpenAI, o pase a humano (7.5).

**Se rechaza:**
- **token sin vencimiento con todos los permisos**, guardado «donde quieras» y enviado en la URL (**D**, V3-7). Va por cabecera, con permisos mínimos y en la nota cifrada;
- **Postgres expuesto a internet** (**D**, V3-7);
- **acceso root** para el agente que despliega, en modo «bypass» (**D**, V3-7);
- **OpenAI para los audios**: el kit lo obliga, y OpenAI y Anthropic no listan a Venezuela (**D**, V3-8);
- **n8n para enrutar**: ya decidido en la v2. El kit tampoco lo usa, y su memoria aparte sería una tercera copia de datos personales (**D** sobre el kit, V3-5; **I** el impacto);
- logs con los primeros 200 caracteres de cada mensaje (**D**, V3-5): va contra 1.7 y revisar-datos-ve.

**Se confirma sin cambios:** Chatwoot v4.19.1 sí firma sus webhooks (`X-Chatwoot-Signature`), contra lo que dice el README del kit. Nuestra 2.3 ya lo verifica (**C** de Chatwoot, V3-9).

### Decisiones de 0.8 (Sam, 2026-10-30)

La v3 sumó dos preguntas a 0.8. Sam respondió por el selector el 2026-10-30 (S08-1 a S08-3):

- **Bot: 1 mensaje por respuesta** («1 mensaje (Recomendado)»). Aplica a E7 (7.6) y a la redirección de E10 (10.2).
- **Cliente que pierde su único envío vivo: vuelve a lead** («Vuelve a lead (Recomendado)»), salvo que tenga carga viva en China. Ver «Regla de segmentos» en la v2.
- **La carga recibida en China cuenta como cliente** («Sí cuenta (Recomendado)»).
- **Enmienda del mismo día:** clientes al número nuevo; leads nuevos y registrados al viejo. Ver «Enmienda del 0.8» en la v2.

### 2.3: no se acepta hasta arreglar la idempotencia

El procesador del webhook registra el evento primero y, si un manejador falla, solo deja un aviso y responde «procesado». Si Chatwoot reintenta, el duplicado se descarta y la acción se pierde (**C**, rama `codex/0582-e2-poc`, V3-11). Para el push da igual; para E10 no, porque un cliente podría quedarse sin su redirección. E2 lo está corrigiendo con una acción pendiente durable en la misma transacción. **La 2.3 no se acepta hasta ese arreglo.**

**Actualización (E2, 2026-10-30): la idempotencia está corregida en `19df1e51f`.**
- El evento entra en «procesando» en la misma transacción que el estado de la conversación, y se cierra «procesado» solo si todas las acciones salen bien. Si alguna falla, queda «fallido» y la ruta responde 500.
- Un evento fallido, o colgado más de 5 minutos, se vuelve a procesar en la próxima entrega. Un duplicado real se sigue descartando.
- Se probó con rojo primero. El contrato 0504 da 15/15.

**Siguen pendientes de lo que pide la v3:**
- **El reintento propio de Studio.** Chatwoot 4.19.1 no reintenta webhooks de cuenta (**C**: `Webhooks::Trigger#execute` rescata el error y solo reintenta agentes bot), así que un evento fallido espera una reentrega o un reproceso.
- **El tope de tamaño del cuerpo.**

Están en la fila 2.3 del checklist.

### 2.8 opcional: costo de referencia por chat

- En la Ficha DTD: «N mensajes enviados × tarifa = US$X», con la fecha y la fuente de la tarifa. Aclara que no descuenta los 1.000 gratis ni las plantillas.
- Cuenta los salientes de la conversación por la API de Chatwoot en el momento, sin guardarlos. La tarifa es configuración con fecha y fuente.
- Sin migración, sin tablas, sin tocar Meta y sin guardar texto ni teléfonos. Va después de 2.4.
- Va en Studio y no en un fork de Chatwoot, porque v4.19.1 descarta el detalle de cobro que manda Meta (**C** de Chatwoot, V3-12).
- La medición conciliada (unos 4 días) y el «portero» de Codex delante de Chatwoot quedan para **después del 100 %**.

## Cambio de alcance v5: corte sin esperar el bot propio (2026-11-19)

Revisión completa del plan, pedida por Sam, sobre `main` en `875767eaf`. El checklist no se tocaba desde el 2026-11-08 (línea base v4: 129,5 d, avance 49,0 %). La v5 deja el alcance en **127,75 d** y el avance en **49,7 %** (63,5 d aceptados). El detalle por paso, la evidencia y el camino al corte están en el [checklist](checklist.md), secciones «Cambios desde v4» y «Lo que falta para el corte (E8), en orden».

### Decisiones de Sam, 2026-11-19 (citadas literalmente)

1. «Sí, cortamos como sin esperar el bot.» El corte de Kommo (E8) **ya no depende de E7**. Sustituye a la regla de esta spec que condicionaba el bot al corte (E7 antes de 8.1, con el modo sombra de 7 días).
2. «No hace falta ya que el bot lo tenemos siempre apagado.» El bot propio sale del camino del corte.
3. Las plantillas C1 a C10 de Clientes, aprobadas por Meta, se usan solo desde Chatwoot (bandeja Clientes). No se recrean en Kommo. El número viejo queda para leads.

### Messenger queda fuera del corte (Sam, 2026-11-19)

Sam decidió, según el relato del Director General: «Deja Messenger, no los cuentes, sé que no hay casi nada.» El corte no espera a Messenger: la 8.3 corta solo Instagram, y Messenger se conecta después del corte o no se conecta. Sustituye a la espera por App Review que la 4.4 y la 4.6 tenían como camino al corte (decisión del 2026-11-03, «Mantener la espera»); la 4.6 de Instagram no cambia.

### Qué se hizo con E7 y por qué

- **Decisión del Worker, con criterio:** E7 pasa a **fase posterior, fuera de la línea base**, y en el checklist sus 11 pasos quedan `descartado`. No se dejó `descartado` a secas como si fuera «no se hará»: Sam no dijo eso, dijo que no hace falta *ahora*. Tampoco se dejó dentro del alcance: el bot no frena nada y mantener 18,5 d en el denominador escondería el avance real hacia el corte.
- El estado `descartado` es el único mecanismo del script para sacar pasos del alcance conservando su historia. Retomar el bot exige una línea base nueva (v6) con reestimación; **no se pierde trabajo**: `dtd-bot` ya fusionado (núcleo puro #449, base de conocimiento y reglas duras #448, la 0522 de la cola durable #459 y #465) queda en `main`, apagado, con el flag `chatwoot_bot` apagado. SDD-0618 sigue vigente como diseño; su estado lo decide quien la retome.
- **Lo que sí se conserva del bot:** la 7.3 (respaldar el conocimiento de la IA de Kommo y ubicar «analiza mi contestación») pasa a la **8.14** (0,5 d), porque ese conocimiento es de DTD y se pierde al cancelar la licencia.
- **Pasos de E8 ajustados:** la **8.1** ya no espera a E7 ni al modo sombra (la convivencia de 7 días sigue); la **8.2** apagaba «la IA y los Salesbots de Kommo y el bot queda en el modo aprobado», y ahora dice que se apagan los Salesbots, que, según Sam (2026-11-19), el bot está siempre apagado y el estado de la IA y de los Salesbots de Kommo se verifica en 8.1, y que se comprueba que `dtd-bot` sigue apagado.
- **Regla de aceptación del programa:** «Bot: "Contesta solo" activo solo si 7.2 está aprobado» deja de aplicar al corte. Mientras E7 esté fuera, `dtd-bot` no se enciende.

### Trabajo nuevo que el plan no tenía (+16,75 d)

| Tema | Pasos | Días | Estado |
|---|---|---|---|
| Plantillas de Clientes C1 a C10 | 4.10 | 1 | entregado (aprobadas por Meta el 2026-11-17) |
| Bandeja como pestaña de CRM, gestión, acceso por persona y pantalla completa | 2.9 a 2.12 | 2,5 | 2 entregados, 1 pendiente, 1 en curso |
| Embudos por segmento, tarjeta compacta, Ficha 360°, franja y «Vincular a cliente» | 6.11 a 6.17 | 11,75 | 5 entregados, 1 pendiente, 1 en curso |
| Datos del ERP en el contacto de Chatwoot | 10.9 | 1 | entregado, interruptor apagado |
| Respaldo del conocimiento de la IA de Kommo (viene de la 7.3) | 8.14 | 0,5 | pendiente |

Cambian de estado sin cambiar de días: 10.5 y 10.7 (chat del portal en producción desde el 2026-11-15, flag encendido por Sam y smoke 5c suyo) pasan a `entregado`. Ninguna es `aceptado`: no hay aceptación de Sam posterior al 2026-11-08 en los registros que se revisaron.

### Aprobación de la estimación (Sam, 2026-11-19)

Los días de 2.10, 2.11, 2.12, 6.16 y 6.17 (0,5, 1, 0,5, 3 y 2) los estimó el Worker. Sam aprobó la estimación el 2026-11-19, según el relato del Director General, que le dio el contexto de esas cinco filas: «Ya no me acuerdo qué puse que sí en el chat. Alguien tocó, sí, yo fui el que toqué», y después del contexto, «ok avanzamos». Es aprobación de la estimación, no aceptación de los pasos. La 2.12 pasa a `entregado` con la #690 fusionada en `7f90d8483`.

### Lo que esta revisión no pudo verificar (NV)

- Que las alarmas del cupo de WhatsApp y del token de Instagram (código en `main` desde el 2026-11-06) estén instaladas y corriendo en el VPS.
- Que las 10 plantillas C1 a C10 sigan aprobadas en la cuenta de Meta (viene del registro del DG del 2026-11-18).
- La aplicación en producción de la 0553, y que la 0554 y la 0566 sigan sin aplicar (la 0566 la corrige la #696).
- Las pantallas 2 y 10, el adjunto y revisar-datos-ve de la 10.6.

No se leyó ninguna base de producción ni se consultó Meta o Kommo para este cambio.

## Metodología de avance

- **Fórmula:** `avance = Σ días base de pasos aceptados ÷ Σ días base del alcance aprobado`, y **falta = 100 − avance**. Unidad: persona-día de 8 h.
- **Línea base versionada.** La v1 del 2026-10-28 son 99,75 días en 10 etapas. La **v2 del 2026-10-29** son 109,25 días en 11 etapas (ver «Cambio de alcance v2»). La **v3 del mismo día** son 115,5 días, o 114,5 sin el 2.8 opcional (ver «Cambio de alcance v3»). La **v4 del 2026-11-07** son 129,5 días, por el rediseño de la 6.6 y la 10.5, con cinco filas nuevas (ver el checklist, «Cambio de alcance v4»). La **v5 del 2026-11-19** son 127,75 días: E7 sale de la línea base (−18,5) y entran 14 filas nuevas (+16,75) (ver «Cambio de alcance v5: corte sin esperar el bot propio»). Cada cambio de alcance crea una versión nueva y muestra el % antes y después.
- **Esfuerzo aparte.** El real y el restante reestimado se informan aparte y no mueven el %. Las esperas pesan 0 y bloquean.
- **Estados:** `pendiente`, `en curso`, `entregado`, `aceptado`, `bloqueado`, `espera externa` y `descartado`. Solo `aceptado` suma.
- **Cálculo:** `node scripts/avance-checklist.mjs docs/specs/0582-chatwoot-piloto/checklist.md`.
- **Reporte en cada avance:** `Etapa N de 11 · <nombre> · paso <ID> · Avance X % (falta Y %) · Esfuerzo: real R d, restante D d · Fecha probable <rango> · Esperando: … · Necesito de ti: …`.
- **Reestimación:** al cerrar cada etapa, con el motivo escrito.
- **Calendario (inferencia):**
  - mínimo idealizado de 60 días con dos carriles;
  - 15–19 semanas con esperas, es decir, del 2027-02-15 al 2027-03-15 si se arranca el 2026-11-02;
  - el vencimiento probable de Kommo es el 2027-02-28 (no verificado); puede hacer falta un mes más.
  - **Actualizado el 2026-10-29 (E0-D5, T):** Kommo vence el 2027-05-29 con renovación automática activada (cobro el 2027-05-26). El margen frente al calendario es de unos 2,5 meses.

## Aceptación del programa

- **Etapas:** cada paso del checklist está `aceptado` con evidencia (PR, commit, handoff o acta), o `descartado` con una línea base nueva aprobada.
- **Actas:** de conciliación final firmada (8.6) y de corte (8.1).
- **Bot:** fuera de la línea base v5 (Sam, 2026-11-19). `dtd-bot` queda apagado; si se retoma, «Contesta solo» activo solo si 7.2 está aprobado, con una línea base nueva.
- **Kommo:** `git grep -i kommo` en código vivo devuelve solo historia permitida (migraciones aplicadas, specs, handoffs). Las tablas están borradas con migración aprobada. La licencia está cancelada.
- **Cierre durable (PRG-01):** runbooks, handoff y retrospectiva.

## Allowlist de esta SDD

- `docs/specs/0582-chatwoot-piloto/{spec.md,checklist.md,instrucciones-ia.md,investigacion-2026-10-28.md,investigacion-2026-10-29-e0.md,e0-guias.md,guia-guion.md,e4-correo.md}`
- `docs/specs/README.md` (índice regenerado)
- `scripts/avance-checklist.mjs`
- `scripts/__tests__/avance-checklist.test.mjs`
- `.agents/handoffs/0582-chatwoot-piloto.md`
- `.agents/handoffs/0582-e0-preparacion.md`
- `.agents/handoffs/0582-e9-guion.md`
- `.agents/handoffs/0582-checklist-v5.md`
- Paso 4.8, correo, que no tiene SDD hija (detalle en `e4-correo.md` §10): `infra/chatwoot/correo/{bandeja-prueba.rb,bandeja-vzla.rb,zz_dtd_correo_sistema.rb}`, `infra/chatwoot/pruebas/{prueba-correo-sistema.sh,sonda-correo-sistema.rb,sonda-bandeja-vzla.rb,compose.correo-sistema.yml,compose.correo-sistema-control.yml}`, `.github/workflows/chatwoot-correo-sistema.yml`, `docs/legal/privacidad/{revision-chatwoot-correo-2026-10-31.md,inventario-terceros.md}` y `.agents/handoffs/0582-e4-correo.md`

Fuera del paso 4.8, el código del producto y la infraestructura se allowlistan en la SDD hija de cada etapa.

## Fuera de alcance detectado (se informa, no se toca)

- Anthropic y OpenAI no listan a Venezuela; Anthropic, desde el 2026-11-12. Puede afectar `lib/studio/agents/runtime`. Lo revisa el Director.
- `/privacidad` dice que los datos se tratan en Venezuela (`app/privacidad/page.tsx:262-264`).
- El PDF del DPA de Contabo está sin seguimiento en la raíz del checkout principal.
- `kommo_unsorted.raw` guarda texto de clientes.

## Seguimiento

- **2026-10-28:** SDD propuesta como piloto (fases 0–3).
- **2026-10-29:** reescrita como programa:
  - plan v2 con la revisión de Codex;
  - decisiones 10 y 11 de Sam;
  - línea base v1 de 99,75 días;
  - nada instalado.

  Las decisiones del piloto anterior (máquina, ruta 2A/2B y dueño de la WABA) pasan a los pasos 0.2 y 0.3. La ruta queda fijada como «compartir el número API».
- **2026-10-29 (E0):** decisiones de 0.2 en el [registro E0](investigacion-2026-10-29-e0.md): máquina = VPS actual del ERP (cambia G), Sam admin + 1 agente, tope del bot de US$25 al mes y «analiza mi contestación» en la IA de Kommo. Guías de 0.3–0.7 en [`e0-guias.md`](e0-guias.md). El DNS de `dtdcargo.com` está en Cloudflare, no en Hostinger.
- **2026-10-29 (E9):** guion de la guía (9.1) entregado en [`guia-guion.md`](guia-guion.md) y aceptado por Sam el mismo día («Acepto todo»). Sus preguntas abiertas pasan a 9.2–9.6 y no bloquean la aceptación.
- **2026-10-29 (E0, tarde):** Sam aprobó («Apruebo todo», 2026-10-29) dejar el número en «Importador de China», la cuenta de mensajes propia de Chatwoot con plantillas y pago propios, y la vuelta atrás de 0.3. Se corrigieron la decisión B y las prohibiciones.
- **2026-10-29 (línea base v2):** Sam aprobó el plan v3 del Director («aprobación del plan v3 del Director, 2026-10-29»): dos números, regla de segmentos, E10 y n8n fuera del enrutamiento. Alcance 99,75 → 109,25 días; avance en la rama de E0 5,0 % → 4,6 %, y con las aceptaciones de las otras ramas 7,8 % → 7,1 %. La regla de «cliente» queda para 0.8.
- **2026-10-29 (línea base v3):** Sam aprobó el análisis comparativo del Director («aprobación del análisis comparativo del Director, 2026-10-29»). Alcance 109,25 → 115,5 días (114,5 sin el 2.8 opcional). Avance en la rama de E0 4,6 % → 4,3 %, y con las otras ramas 7,1 % → 6,7 %. Se corrigen el costo de Meta (cobro desde el 2026-10-01) y la guía del PIN. 0.8 suma dos decisiones y la 2.3 no se acepta hasta arreglar la idempotencia.
- **2026-10-30 (0.8):** Sam respondió por el selector: la carga recibida en China cuenta como cliente, quien pierde su único envío vuelve a lead y el bot responde en 1 mensaje. 0.8 aceptado y E0 completa. Sin cambio de línea base: avance en la rama de E0 4,3 % → 4,8 %, y con las otras ramas 6,7 % → 7,1 %.
- **2026-10-30 (enmienda del 0.8):** Sam cambió el reparto de números («este whatapp va ser para cliente y el numero viejo paraleeds y leed registrados con numero de markbox»): clientes al número nuevo en «DTD Cargo Clientes»; leads nuevos y registrados al viejo, que sigue en Kommo hasta el corte. La web no cambia, 10.4 se achica al portal, 10.2 opera en automático solo con el viejo en Chatwoot y E10 solo intercambia configuración. Sin cambio de días ni de %.
- **2026-11-04 a 2026-11-06 (publicación por tandas):** con el mandato de Sam al Director General («Doy el mandato», 2026-11-03 ~20:10Z), lo integrado de E1 a E10 salió a producción en cuatro tandas. Imágenes y evidencias, según él:

  | Tanda | Hora | Imagen | Anterior | Evidencia, en `/srv/ops/evidencias/` |
  |---|---|---|---|---|
  | A | 2026-11-04 12:41:54Z | `fe35eb2d1` | `dac99762e` | Guion: `.agents/handoffs/0582-guion-publicacion-tanda-a.md` |
  | B | 2026-11-04 22:53:29Z | `sha-92e2bb706` | `fe35eb2d1` | `ventana-tanda-b-20261104T225143Z` |
  | C | 2026-11-05, antes de las 16:15Z | `sha-1aafa150e` | — | — |
  | D | 2026-11-06 02:01Z | `sha-7a8afdd2c` | `sha-1aafa150e` | `ventana-tanda-d-20261106T015919Z` |

  En la D pasaron el respaldo, las puertas (269 migraciones en el ledger, con huellas iguales) y la prueba rápida, 14 de 14. El webhook de Chatwoot responde 401 sin firma, el cron 403, y el log no tiene errores. No cambió el crontab ni el compose. El Subdirector comprobó a las 02:04Z, desde fuera, que `/privacidad` publica el texto de SDD-0587 con fecha del 5 de noviembre. **Con la D, todo lo de Chatwoot del mandato está en producción.** Lo que sigue abierto está en el checklist: 4.4 y 4.6 en espera de Meta, 4.5, 4.8, 4.9, y de E6 a E9.
- **2026-11-05 (capacitación, pedida por Sam, todavía sin orden de empezar):** lo dijo Sam en el chat del Director General: «Hay que hacer un entrenamiento al personal para que entiendan cómo manejar esta herramienta comparada con Kommo. Hay que preparar diferencias entre Kommo y Chatwoot. Lo hacía de una manera ya en el pipeline, en el embudo, y aquí lo va a hacer casi de la misma manera o diferente.» Y: «El bug del ERP hay que ponerlo visible dentro de la herramienta cuando trabajen los empleados, o recordarles que cualquier mejora puede hacerlo en el book.» La capacitación ya es parte de 8.1 y sale de [`guia-guion.md`](guia-guion.md). De 9.2 a 9.6, lo del botón de bugs cae en 9.5. **No se empieza hasta que Sam la ordene.**
- **2026-11-19 (línea base v5):** Sam decidió cortar Kommo sin esperar el bot propio y que las plantillas de Clientes se usen solo desde Chatwoot (ver «Cambio de alcance v5: corte sin esperar el bot propio»). Alcance 129,5 → 127,75 días; avance 49,0 % → 49,7 %. Cierre de E8 estimado entre el 2026-12-30 y el 2027-02-01, según el ritmo; el token de Instagram vence el 2026-12-30.
- **2026-11-16 (enmienda, plantillas desde el número de clientes):** a la pregunta «¿Enmiendo la spec 0582 para permitir plantillas desde el número de Clientes?», Sam respondió en la sesión de análisis de plantillas: «Sí, enmiéndala».
  - Cambia la regla «No se le escribe al cliente desde el número de clientes» de *Redirección sin IA*. Ahora DTD puede escribir primero con plantillas aprobadas, con las condiciones que dice esa sección. La redirección por enlace no cambia.
  - No cambia código, no crea plantillas en Meta y no automatiza envíos. Cada uno de esos pasos va con su propio OK.
  - Análisis: [`docs/marketing/whatsapp-plantillas-por-numero.md`](../../marketing/whatsapp-plantillas-por-numero.md).
