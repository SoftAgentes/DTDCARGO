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
- las etapas E0–E9 y sus puertas;
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
- corte, salida de Kommo y limpieza del ERP.

**Kommo sigue operando hasta el 100%.**

**Fuera (después del 100%):**
- DTD como Tech Provider de Meta;
- rol «solo ver»;
- panel junto al chat y tema por `DASHBOARD_SCRIPTS`;
- atención móvil dentro de Studio;
- integración de comentarios de IG y FB, si la matriz de paridad decide atenderlos a mano temporalmente.

## Decisiones técnicas (evidencia en la investigación)

| ID | Decisión |
|---|---|
| A | **Modo híbrido.** El panel de Chatwoot va en un iframe sobre `chat.dtdcargo.com`. Son nativos de Studio el SSO (Platform API), el contador y el push, la tarjeta en la ficha, la Dashboard App «Ficha DTD» y las altas y bajas. Traefik quita `X-Frame-Options` y fija `frame-ancestors`. Studio añade `frame-src` y `Permissions-Policy`. La aceptación del SSO prueba cierre, baja, revocación y acceso directo. Si la prueba E2.1 falla, se abre en una pestaña aparte. |
| B | **El número se comparte, no se migra,** y se protege: un initializer aborta `/register` para los Phone Number IDs protegidos. Los valores previos de Meta se guardan fuera de Git; la vuelta atrás los restaura. Pago propio en Meta antes de atender. **Actualizado el 2026-10-30 (Sam, «Apruebo todo», 2026-10-30):** el número se queda en el portfolio verificado «Importador de China». Con el modelo nuevo de Meta, Chatwoot usa **su propia cuenta de mensajes** en ese portfolio, con la app de DTD, su usuario del sistema, sus plantillas (las 5 de Kommo se recrean y se aprueban) y su pago propio. Antes de 4.1 se exige la 2FA a los administradores. Evidencia: [registro E0](investigacion-2026-10-29-e0.md), M-8 a M-31. |
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

## Metodología de avance

- **Fórmula:** `avance = Σ días base de pasos aceptados ÷ Σ días base del alcance aprobado`, y **falta = 100 − avance**. Unidad: persona-día de 8 h.
- **Línea base versionada.** La v1 del 2026-10-28 son 99,75 días en 10 etapas. Un cambio de alcance crea la v2 y muestra el % antes y después.
- **Esfuerzo aparte.** El real y el restante reestimado se informan aparte y no mueven el %. Las esperas pesan 0 y bloquean.
- **Estados:** `pendiente`, `en curso`, `entregado`, `aceptado`, `bloqueado`, `espera externa` y `descartado`. Solo `aceptado` suma.
- **Cálculo:** `node scripts/avance-checklist.mjs docs/specs/0582-chatwoot-piloto/checklist.md`.
- **Reporte en cada avance:** `Etapa N de 10 · <nombre> · paso <ID> · Avance X % (falta Y %) · Esfuerzo: real R d, restante D d · Fecha probable <rango> · Esperando: … · Necesito de ti: …`.
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

- `docs/specs/0582-chatwoot-piloto/{spec.md,checklist.md,instrucciones-ia.md,investigacion-2026-10-28.md,investigacion-2026-10-29-e0.md,e0-guias.md,guia-guion.md}`
- `docs/specs/README.md` (índice regenerado)
- `scripts/avance-checklist.mjs`
- `scripts/__tests__/avance-checklist.test.mjs`
- `.agents/handoffs/0582-chatwoot-piloto.md`
- `.agents/handoffs/0582-e0-preparacion.md`
- `.agents/handoffs/0582-e9-guion.md`

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
- **2026-10-29 (E9):** guion de la guía (9.1) entregado en [`guia-guion.md`](guia-guion.md), pendiente del OK de Sam.
- **2026-10-30 (E0):** Sam aprobó («Apruebo todo», 2026-10-30) dejar el número en «Importador de China», la cuenta de mensajes propia de Chatwoot con plantillas y pago propios, y la vuelta atrás de 0.3. Se corrigieron la decisión B y las prohibiciones.
