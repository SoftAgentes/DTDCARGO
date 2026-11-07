# Handoff · SDD-0586 paso 10.5 — conversaciones del portal en Chatwoot y en los embudos (rediseño en borrador)

- **Fecha:** 2026-11-06
- **Owner:** Claude Worker «10.5 diseño», sesión iniciada por el Subdirector de Chatwoot (`local_535053f4-40c2-4124-a280-63f4fc882820`).
- **Ruta:** `.claude/worktrees/trusting-kowalevski-525bef`
- **Rama:** `claude/trusting-kowalevski-525bef`, desde `main` en `3d17292a4`. Lo que el diseño cita de `main` es de `7a3cde25d`.
- **SDD:** 0586 (E10), sección «Paso 10.5». Sin SDD hija: la 0586 ya decía que 10.4 a 10.6 la amplían.
- **PR:** #400, en borrador.
- **Programa:** SDD-0582, fila 10.5 del checklist. Sigue «pendiente».

## Objetivo

Diseñar, sin código de producto, cómo el chat del portal («canales», en palabras de Sam) entra al CRM. Primero fue un borrador con tickets propios en Studio; el 2026-11-06 Sam contestó sus seis preguntas y el paso se rehízo con esas respuestas como decisiones cerradas.

## Qué quedó

- **Rediseño completo en la spec** (`docs/specs/0586-chatwoot-enrutamiento-segmento-e10/spec.md`, «Paso 10.5», §10.5.1 a §10.5.22).
- **Respuestas de Sam como decisiones cerradas** (§10.5.1), con fecha y cita, del registro literal del Director General:
  - P1: se llama «Conversaciones»; en la ficha, «Conversaciones del portal»; «Tus casos» queda fuera.
  - P2: se contesta desde Chatwoot. **E10-D25 y E10-D26 quedan reemplazadas por E10-D33**, con su texto literal en el historial (§10.5.18).
  - P3: el portal no muestra número.
  - P4: las conversaciones que ya existen se cargan a Chatwoot, con el rigor de E5 (§10.5.10).
  - P5: un mensaje del fin de semana vence al terminar el lunes, hora de Caracas.
  - P6: texto nuevo de `/privacidad`; el chat no se conecta hasta que esté publicado.
- **El diseño, en corto:**
  - bandeja propia en Chatwoot, de canal API;
  - Studio sigue siendo la fuente del hilo del portal, y el portal no cambia a la vista salvo una línea;
  - la ida va por una cola sin trigger, con orden por hilo, idempotencia por `source_id` y reintentos;
  - la vuelta es un manejador del webhook, idempotente por `external_msg_id`;
  - la tarjeta entra por la ficha con `crm_entrada_portal` y la pieza única;
  - un interruptor `chatwoot_portal` que nace apagado, con aviso y modo de respaldo si Chatwoot no responde.
- **Carga de P4** (§10.5.10): cuatro pasos, catorce mediciones (C-1 a C-14), cinco puertas y la consulta de conteo de solo lectura para el Director General. No se contó nada en producción.
- **Plazo y feriados** (§10.5.11), con la pregunta nueva P7 para Sam.
- **Textos públicos propuestos** palabra por palabra (§10.5.12): T1 en el portal, T2 y T3 en `/privacidad`, y T4, la fecha.
- **revisar-datos-ve** del rediseño (§10.5.13). Que Chatwoot es software propio en el servidor de DTD, y no un tercero, lo confirma la evidencia del repo; el VPS no se leyó en esta tarea.
- **Reestimación** fila por fila contra la línea base v3 (§10.5.21): E10 pasa de 7,25 a 13,75 días (+6,5). Queda vencida la de 1,25 → 2.
- **Checklist 0582:** no se tocó en esta revisión, por pedido del Subdirector. La nota de la fila 10.5 en esta rama sigue diciendo «seis preguntas para Sam».

## Validación

| Comprobación | Estado |
|---|---|
| `node scripts/build-docs-index.mjs --check` (docs:check) | PASÓ: índice sincronizado, 589 specs |
| `node scripts/check-numbering.mjs` (sdd:check) | PASÓ: sin números repetidos |
| Referencias `NNNN_*.sql` de la spec contra `supabase/migrations/` (la regla de `scripts/__tests__/spec-migration-refs.test.ts`, corrida con `node` directo) | PASÓ: 13 citadas, todas existen |
| La cita de la D-SA y la D-AUD | PASÓ: igual a la de `9acf84b60`; su fuente no cambió entre `17dc41cfc` y `5dc8500c3` (diff vacío) |
| `pnpm verify` | NO APLICA: cambio solo de documentación. El cierre se eligió por el diff |
| Pruebas de producto, contrato SQL, `/ui-check` | NO APLICA: no hay código; van en las PR de implementación (§10.5.15) |

## Impacto documental

- Guardado en esta tarea: la spec 0586 (sección rehecha, `related` con 0590, 0127 y 0149) y este handoff.
- Pendiente de integración: el checklist 0582 (filas nuevas y la nota de la 10.5) lo actualiza quien lo lleve, cuando Sam apruebe la reestimación.
- Graphify, Archify y Obsidian: los revisa el Director al integrar, según el runbook de conocimiento.

## Historia de la tarea (2026-11-06)

1. Borrador con tickets propios en Studio (`89fb586cf`), con seis preguntas para Sam.
2. Revisión del Director General: D-1 (pieza única), número de migración al arrancar, reestimación a 2 días y orden 10.5 → 6.6; cambios b, c, d y f (`821813031`).
3. Cita de la D-SA y la D-AUD de la SDD-0614 §2.8 (`9acf84b60`).
4. Respuestas de Sam y rediseño (este commit).

## PENDIENTES DE ESTA TAREA

- **Para Sam** (los lleva el Director General): P7, los feriados; aprobar T1 a T4; confirmar que los hilos archivados no se cargan; la reestimación; y las puertas, cada una con su OK nominal (§10.5.20).
- **Para el Director General:** correr el conteo de §10.5.10 con su OK; decidir con el Subdirector de SEO el aviso de Telegram del portal; elegir dónde viven los scripts de la carga; llevar a la 0614 la propuesta de §10.5.19 (señal 2 de la D-SA y `crm_ticket` sin objeto).
- La implementación, la migración, la carga y sus aplicaciones quedan fuera de este encargo.

## FUERA DE ALCANCE DETECTADO

- **Telegram recibe el nombre y el texto del cliente** (`lib/studio/conversation-inbound-notify.ts:103-112`), contra el texto de la #399. Lo lleva el Director General al Subdirector de SEO; con el rediseño, ese aviso sobra para el portal cuando el flag esté encendido.
- **La RLS de `conversations` no mira el rol** (`supabase/migrations/0106_conversaciones.sql:128`).
- **`chatwoot_conversations` se lee por tenant sin mirar el rol** (0504); con la 10.5 también tendrá las del portal, sin texto.
- **Falta Cloudflare en la tabla general de terceros** (`docs/legal/privacidad/inventario-terceros.md:84`).
- **Sin `node_modules` en este worktree:** las comprobaciones se corrieron con `node` directo sobre los scripts.
