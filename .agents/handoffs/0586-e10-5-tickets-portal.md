# Handoff · SDD-0586 paso 10.5 — tickets del portal a los embudos (diseño en borrador)

- **Fecha:** 2026-11-06
- **Owner:** Claude Worker «10.5 diseño», sesión iniciada por el Director (`local_535053f4-40c2-4124-a280-63f4fc882820`).
- **Ruta:** `.claude/worktrees/trusting-kowalevski-525bef`
- **Rama:** `claude/trusting-kowalevski-525bef`, desde `main` en `3d17292a4`.
- **SDD:** 0586 (E10), sección nueva «Paso 10.5». Sin SDD hija: la 0586 ya decía que 10.4 a 10.6 la amplían.
- **Programa:** SDD-0582, fila 10.5 del checklist. Sigue «pendiente»; solo se le sumó la nota del borrador.

## Objetivo

Diseñar, sin código de producto, cómo el chat del portal («canales», en palabras de Sam) entra al CRM como tickets en los embudos de E6, para que el Director General lo revise antes de programarlo.

## Qué quedó

- **Diseño completo en la spec** (`docs/specs/0586-chatwoot-enrutamiento-segmento-e10/spec.md`, «Paso 10.5», §10.5.1 a §10.5.16): qué entra como ticket, a qué embudo va y cómo se decide, qué ve el asesor y cómo responde, modelo de datos y migración (solo descrita), permisos y RLS, revisión de datos personales, gobernanza con matriz SGE-00, allowlist exacta, pruebas, criterios de aceptación y lo que queda fuera.
- **Decisiones E10-D18 a E10-D30.** Las centrales:
  - un ticket es un **episodio** del hilo del Canal Portal (`conversations.channel = 'portal'`): lo abre el mensaje del cliente cuando no hay uno abierto y lo cierra «Resuelto»;
  - lo abre **un trigger en la base**, en la misma transacción que el mensaje, y **el portal no cambia**; un fallo del CRM nunca impide guardar el mensaje;
  - el ticket guarda el hilo y no la tarjeta, y el embudo sale del segmento calculado en el momento;
  - el asesor responde en Conversaciones, con el enlace `?c=` que ya existe; sin Chatwoot en 10.5.
- **Migración descrita, no escrita:** `05NN_crm_tickets_portal.sql`, con la tabla `crm_tickets`, dos triggers, la fila `crm_ticket` del catálogo de auditoría y la redefinición de `crm_alta_tarjeta_web` desde la 0513 (o la alternativa de copiar, que elige el Director: D-1). Número a reservar: al 2026-11-06 hay 0514 a 0517 en ramas remotas.
- **Checklist:** nota en la columna de evidencia de la fila 10.5, con el enlace a la sección. Estado, días y % sin cambios (`avance-checklist` da lo mismo antes y después).

## Validación

| Comprobación | Estado |
|---|---|
| `node scripts/build-docs-index.mjs --check` (docs:check) | PASÓ: índice sincronizado, 589 specs |
| `node scripts/check-numbering.mjs` (sdd:check) | PASÓ: sin números repetidos |
| `node scripts/avance-checklist.mjs` sobre el checklist, antes y después | PASÓ: mismas cifras (E10, 4 de 7,25 d) |
| `pnpm verify` | NO APLICA: cambio solo de documentación, sin código ni migración. El cierre se eligió por el diff |
| Pruebas de producto, contrato SQL, `/ui-check` | NO APLICA: no hay código; van en la PR de implementación (§10.5.11) |
| revisar-datos-ve | Hecha sobre el diseño (§10.5.8): 4 CORRECTO, 7 NO VERIFICABLE, 1 no aplica y 1 ENCONTRADO anterior a 10.5 |

## Impacto documental

- Guardado en esta tarea: la spec 0586 (sección nueva, `updated` y `related`) y la fila 10.5 del checklist de la 0582.
- Pendiente de integración: nada más; el índice de specs no cambió.
- Graphify, Archify y Obsidian: los revisa el Director al integrar, según el runbook de conocimiento.

## Revisión del Director General (2026-11-06)

Sobre `89fb586cf`, comunicada por el Subdirector de Chatwoot: «bien encaminado», con cambios menores de texto, aplicados en la misma rama y sin código.

- **Decisiones** (spec §10.5.14): D-1, una sola pieza «ubicar o crear la tarjeta» para el alta web, la 10.5 y el cotizador de la 6.6, redefinida desde la última definición y con su contrato vuelto a correr; el número de migración se asigna al arrancar (nadie reserva la 0518); reestimación de 1,25 a 2 días aceptada, va a Sam con la de la 6.6; orden: primero la 10.5 y después la 6.6.
- **Cambios:** b, barrido `crm_tickets_reconciliar` en el cron `chatwoot-reintentos` con aviso de solo números (E10-D31); c, actor `system` para lo que dispara el cliente (E10-D27); d, «Perdido» mira el segmento antes de volver a recontacto (E10-D22); f, P6 va después de la #399, y el aviso de Telegram lo lleva el Director General al Subdirector de SEO.
- **Coordinación con la #401** (spec §10.5.17): la 6.6 cerró la D-SA («sin atender») y la D-AUD (qué lleva la auditoría del CRM) en la SDD-0614 §2.8, cabeza `17dc41cfc`. La 10.5 las cita literalmente; la cita se comparó con la fuente y coincide. E10-D23 separa el «vencido» del ticket, que sigue siendo de la 10.5, de «sin atender», que es la señal 2 de la D-SA. E10-D27 dice que lo que dispara el cliente lleva actor `system` y nunca `client_id`.

## PENDIENTES DE ESTA TAREA

- **Seis preguntas para Sam** (§10.5.14), sin hacer: las lleva el Director General con las de la 6.6 y la línea base. No cambiaron con la D-SA; la nota de P5 ahora dice que es la regla del «vencido» de la 10.5.
- **Nombre de la pieza única en la 0614:** la SDD-0614 §2.8 la llama `crm_tarjeta_de_ficha`, el nombre de la primera versión; el vigente es `crm_tarjeta_ubicar_o_crear`. Lo alinea la sesión de la 6.6.
- La implementación, la migración y su aplicación quedan fuera de este encargo.

## FUERA DE ALCANCE DETECTADO

- **Telegram recibe el nombre y texto del cliente:** `lib/studio/conversation-inbound-notify.ts:103-112` manda a Telegram el nombre, el Shipping Mark y un extracto de hasta 140 caracteres de cada mensaje del portal (SDD-0148), y el texto ya aprobado de la #399 dice que la mensajería interna recibe avisos «sin tu nombre ni tus datos de contacto». Lo lleva el Director General al Subdirector de SEO.
- **La RLS de `conversations` no mira el rol:** la política «conversations by tenant» (`supabase/migrations/0106_conversaciones.sql:128`) deja cambiar el estado de un hilo por la API directa a cualquier usuario del tenant; solo la acción lo frena con `moduleEditDenial`.
- **Sin `node_modules` en este worktree:** las comprobaciones se corrieron con `node` directo sobre los scripts, que no tienen dependencias.
