---
sdd: "0582"
title: "Programa Kommo → Chatwoot dentro de Studio, con checklist y avance medible"
status: proposed
author: "Claude Worker «Chatwoot piloto» (Sam)"
created: 2026-10-28
updated: 2026-10-29
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
- bot propio con modos;
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
| G | **Máquina (decisión de Sam del 2026-10-29, paso 0.2):** el VPS actual del ERP (Contabo Cloud VPS 8), con límites de CPU y memoria por servicio y respaldo fuera del host. La medición de capacidad está en el [registro E0](investigacion-2026-10-29-e0.md) (VPS-1 a VPS-7). Si la vigilancia de 1.6 sale mal, el plan B es un Cloud VPS 4 dedicado, como cambio de alcance con OK de Sam. |
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

- **Número nuevo para el público y los leads,** conectado a la API y a Chatwoot (paso 4.9). El actual, el de `CONTACT.ve.whatsapp`, queda **solo para clientes**: sigue en Kommo y pasa a Chatwoot en el corte (E8), como ya estaba previsto. (Decisión de Sam, plan v3.)
- **Va en el mismo portafolio, «Importador de China».** Con los usernames de WhatsApp, Meta identifica a cada usuario con un ID por portafolio (BSUID), y si el usuario adopta un username su teléfono puede no llegar en los webhooks (**D**, V2-1 y V2-2). Que un número de otro portafolio no le pueda escribir con ese ID se deduce del alcance por portafolio (**I**, V2-1).
- El número nuevo arranca con un tope bajo de mensajes iniciados por DTD, que no limita atender (**NV**; se comprueba en 4.9).
- Las prohibiciones del número actual no cambian. Cómo queda el número nuevo frente a la regla de «una sola cuenta de mensajes de DTD para Chatwoot» (decisión B) se confirma en 4.9 (**NV**).

### Regla de segmentos (fuente única: el ERP)

| Segmento | Regla | Número y embudo |
|---|---|---|
| **Cliente** | Algún `shipments` vivo (`deleted_at is null`, estado distinto de `draft` y `cancelled`) con un `client_markbox` de sus códigos vigente, histórico o fusionado. Contar o no la carga recibida en China (`warehouse_receipts_cn`) lo decide Sam en **0.8** | Número de clientes · embudo **Clientes** |
| **Lead registrado** | Está en `clients` pero no cumple la regla de cliente | Número de leads · embudo **Leads**, etapa «Registrado / recontacto» |
| **Lead nuevo** | No está en `clients`, o su teléfono es ambiguo o desconocido | Número de leads · embudo **Leads**, etapa «Nuevo» |

- **Hoy el ERP no distingue cliente de registrado:** el router de Kommo trata como «cliente» a cualquiera que esté en `clients` (`supabase/functions/_shared/kommo-router.ts:85-111`, **C**, V2-4).
- **El cruce es por `clients.phone_last10`** (`supabase/migrations/0383_clients_phone_last10_y_vinculo.sql:64-80`). Tiene índices pero no es única, así que más de un candidato se trata como desconocido, igual que hoy (`kommo-router.ts:108-110`) (**C**, V2-5).
- **Los envíos se ligan por texto** en `shipments.client_markbox` (`supabase/migrations/0002_shipments.sql:36`). Los códigos viejos o fusionados salen de `client_outstanding` (`supabase/migrations/0492_client_outstanding.sql:215`). La carga en China está en `warehouse_receipts_cn` (`supabase/migrations/0008_warehouses_cn.sql:52`) (**C**, V2-6).
- **La regla de «cliente» está pendiente de Sam en 0.8.** Hasta entonces, la tabla es la propuesta del plan v3.
- La regla se calcula **siempre en el momento** y no se guarda como estado. Va en una función SQL de solo lectura, sin datos personales en la salida y con contrato en PGlite (10.1).
- Un lead nuevo pasa a registrado al registrarse, y a cliente con su primer envío vivo. Su tarjeta cambia de embudo sola (6.3 y 10.5).

### Redirección sin IA

- **El bot no usa IA.** Dentro de la ventana de 24 h, al cliente que escribe al número de leads le contesta con un texto y un enlace `wa.me/<número de clientes>?text=…` (10.2).
- Que esa respuesta no se cobre dentro de la ventana de servicio queda **NV**; se comprueba en 4.3 o 4.9.
- **Botón CTA URL:** Meta documenta el mensaje interactivo `cta_url` (**D**, V2-3). Que Chatwoot lo envíe está **NV**, así que el enlace va en el texto.
- **Usuario con username y sin teléfono (BSUID):** el bot no pide códigos ni teléfono. Contesta lo mismo a todos, «si ya eres cliente, escríbenos aquí», y guarda el BSUID (10.3). Así no revela si un número o un código existe. (Diseño, **I**.)
- **No se le escribe al cliente desde el número de clientes.** Un mensaje iniciado por la empresa exige una plantilla pagada y consentimiento previo, y con el enlace basta, porque lo inicia el cliente (**I**: regla general de Meta, sin fuente leída en esta tarea).

### Tickets del portal a los embudos

- `conversations` lleva `client_id` (`supabase/migrations/0106_conversaciones.sql:45`). `conversation_messages` se liga por `conversation_id`; el plan v3 decía que las dos llevaban `client_id` (**C**, V2-7).
- El enganche va justo después de `notifyConversationInbound` en `app/portal/(app)/mensajes/actions.ts:45` (**C**, V2-8). Un cliente va al embudo Clientes, y un registrado sin envío vivo va a Leads registrados (10.5, requiere 6.3).
- **Web y portal con el número correcto (10.4):**
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

- 4.3 (número de prueba) → 4.9 (número nuevo).
- 2.3 (webhook de Chatwoot a Studio) → 10.1–10.3 → 10.6.
- 6.3 → 10.5.
- 10.4 va al final, con el número nuevo vivo.
- E10 se reserva como SDD hija con `sdd:next --reserve` cuando arranque, después de 2.3.

## Metodología de avance

- **Fórmula:** `avance = Σ días base de pasos aceptados ÷ Σ días base del alcance aprobado`, y **falta = 100 − avance**. Unidad: persona-día de 8 h.
- **Línea base versionada.** La v1 del 2026-10-28 son 99,75 días en 10 etapas. La **v2 del 2026-10-29** son 109,25 días en 11 etapas (ver «Cambio de alcance v2»). Cada cambio de alcance crea una versión nueva y muestra el % antes y después.
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
- **Bot:** «Contesta solo» activo solo si 7.2 está aprobado.
- **Kommo:** `git grep -i kommo` en código vivo devuelve solo historia permitida (migraciones aplicadas, specs, handoffs). Las tablas están borradas con migración aprobada. La licencia está cancelada.
- **Cierre durable (PRG-01):** runbooks, handoff y retrospectiva.

## Allowlist de esta SDD

- `docs/specs/0582-chatwoot-piloto/{spec.md,checklist.md,instrucciones-ia.md,investigacion-2026-10-28.md,investigacion-2026-10-29-e0.md,e0-guias.md}`
- `docs/specs/README.md` (índice regenerado)
- `scripts/avance-checklist.mjs`
- `scripts/__tests__/avance-checklist.test.mjs`
- `.agents/handoffs/0582-chatwoot-piloto.md`
- `.agents/handoffs/0582-e0-preparacion.md`

El código del producto y la infraestructura se allowlistan en la SDD hija de cada etapa.

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
- **2026-10-29 (E0, tarde):** Sam aprobó («Apruebo todo», 2026-10-29) dejar el número en «Importador de China», la cuenta de mensajes propia de Chatwoot con plantillas y pago propios, y la vuelta atrás de 0.3. Se corrigieron la decisión B y las prohibiciones.
- **2026-10-29 (línea base v2):** Sam aprobó el plan v3 del Director («aprobación del plan v3 del Director, 2026-10-29»): dos números, regla de segmentos, E10 y n8n fuera del enrutamiento. Alcance 99,75 → 109,25 días; avance en la rama de E0 5,0 % → 4,6 %, y con las aceptaciones de las otras ramas 7,8 % → 7,1 %. La regla de «cliente» queda para 0.8.
