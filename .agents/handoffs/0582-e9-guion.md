# Handoff — SDD-0582 paso 9.1 (guion de la guía)

- **Owner:** Claude Worker (sesión lanzada por la sesión «Chatwoot piloto»), claim `local_e9-guion-91`
- **Ruta:** `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\0582-e9-guion`
- **Rama:** `codex/0582-e9-guion`, apilada sobre `codex/0582-e0-preparacion` (PR #328), que a su vez va sobre `codex/chatwoot-piloto` (PR draft #327). Nació de `21e4c7e0e`; el 2026-10-29 se le fusionó la base cerrada (`77a6922c6`, E0 con 7/7 aceptados) y después su corrección (`b3452c1ae`: sin 2FA en 4.1 ni en la decisión B, y fechas de 0.3 y 0.7 al 2026-10-29).
- **PR:** draft [#330](https://github.com/SoftAgentes/DTDCARGO/pull/330), publicada por la sesión «CRM Chatwoot» con la autorización de Sam («Sí, publícalas»). Sin merge.
- **SDD:** 0582 (programa). 9.1 es solo documentación: no lleva SDD hija. El código de la guía (9.2–9.5) sí la lleva.
- **Objetivo:** entregar el guion «Antes en Kommo → Ahora aquí» de las tareas diarias, con anclas `data-guia`, roles y claves i18n.
- **Aceptación:** OK de Sam al guion. La PR solo con su autorización.
- **Permisos de esta tarea:** sin acceso a Kommo ni a Meta, sin PII. Push de la rama propia autorizado por Sam a través de la sesión «CRM Chatwoot»; merge no.

## Estado al 2026-10-29

| Paso | Estado | Qué hay | Qué falta |
|---|---|---|---|
| 9.1 | aceptado | [`guia-guion.md`](../../docs/specs/0582-chatwoot-piloto/guia-guion.md): 6 recorridos y 24 tarjetas (Bandeja 6, Embudo 4, Ficha DTD 4, IA 4, Usuarios 3, Actualizaciones 3), controles de la guía, formato de claves `guide.*` y de anclas, y 19 preguntas (S-1–S-9 para Sam, P-1–P-10 para la persona que atiende) | Nada para 9.1. Las 19 preguntas siguen abiertas y pasan a 9.2–9.6 (tabla en el guion) |

**2026-10-29, merges de la base:** se resolvió el conflicto de `spec.md` (Seguimiento) conservando las dos líneas. La tarjeta B5 se ajustó a la decisión B actualizada: las plantillas se recrean y se aprueban en la cuenta de mensajes propia de Chatwoot; ya no se dice que «son las mismas».

**2026-10-29, aceptación:** Sam aceptó 9.1 en la sesión del programa. A la pregunta «¿Aceptas los pasos entregados (1.1–1.5, 1.7, 4.2 y 9.1)?» respondió «Acepto todo». Llegó relayado por la sesión «CRM Chatwoot». La fila 9.1 pasó a `aceptado` en un commit propio.

## Decisiones de redacción (aceptadas con el guion; las que dependen de S-1 y S-6 siguen abiertas)

- **Claves:** dominio nuevo `guide` en `lib/i18n/es-VE/guide.ts` y `lib/i18n/zh-CN/guide.ts`, con sufijos `.title`, `.what`, `.before` y `.now`. Sigue el formato plano de `lib/i18n/es-VE/users.ts` y `chrome.ts`.
- **Anclas:** `<pantalla>.<elemento>`. Dentro de Chatwoot el nombre es la clave del archivo de selectores de 9.4; si el selector falta, la tarjeta cae al marco `bandeja.marco`.
- **Roles:** Admin (Sam) y Agente (la persona que atiende), por E0-D2. El interruptor de IA se propone solo para Admin (pregunta S-1).
- **Primera vez:** por pantalla, no toda junta (pregunta S-6).

## Evidencia y límites

- Las rutas de clics reales salen de K-14, K-15, K-17 y K-19 (T). Las del trabajo diario (chats, buscar, notas, tareas, asignar, mover) **no están en el inventario de 0.4** y van NV; algunas tienen apoyo D en documentos de agosto de 2026.
- Hallazgo en código (C): el tablero CRM de Studio ya cambia la etapa de un lead y la escribe en Kommo (`app/studio/(app)/crm/_components/StageControl.tsx`). Quedó en E2 y en la pregunta P-5.
- Todo «Ahora aquí» depende de pasos que no existen: está marcado NV con su etapa (E2, E3, E4, E5, E6 o E7).
- No se usó ningún dato de clientes. Un documento de origen (`docs/marketing/kommo-estado-y-pendientes.md:28`) nombra a un usuario de Kommo; el guion no copia el nombre.

## Validación

| Comprobación | Resultado |
|---|---|
| `node scripts/build-docs-index.mjs --check` (docs:check) | PASÓ: índice sincronizado con 565 specs |
| `node scripts/check-numbering.mjs` (sdd:check) | PASÓ: sin números repetidos (los choques históricos ya aplicados salen como aviso, como siempre) |
| `git diff --check` | PASÓ |
| `node scripts/avance-checklist.mjs …/checklist.md` | PASÓ: 3,8 %, 9.1 en «Entregados sin aceptar» |
| `pnpm verify` | NO EJECUTADO: el cambio es solo de docs (regla de `instrucciones-ia.md`, paso 5) |
| Graphify, Archify y `knowledge:status` | NO EJECUTADO: el worktree no tiene `node_modules` y el cambio es un documento nuevo de spec; lo revisa el Director al integrar |

Ejecutados con `node` directo porque el worktree no tiene `node_modules`; los tres scripts no los necesitan.

## Impacto documental

- Nuevo: `docs/specs/0582-chatwoot-piloto/guia-guion.md`.
- Actualizados: `checklist.md` (fila 9.1) y `spec.md` (allowlist y seguimiento).
- Este handoff.

## Pendientes de esta tarea

1. Hecho: OK de Sam al guion y fila 9.1 en `aceptado`.
2. Pasa a 9.2–9.6: respuestas a S-1–S-9 y P-1–P-10 para ajustar las tarjetas y cerrar las rutas NV de «Antes en Kommo». Quién cierra cada pregunta está en la tabla de «Preguntas» del guion.
3. Integrar la PR #330 después de la #328 (está apilada). El merge lo decide el Director con Sam.

## FUERA DE ALCANCE DETECTADO

- La decisión K de la spec dice «patrón de la 0233». La SDD-0233 es «Retiro gobernado de reportes de Inspecciones»; el patrón real es la **migración** `0233_user_dashboard_prefs.sql` (registro del 2026-10-28, R-7). Conviene precisarlo al redactar la SDD hija de 9.3.
- Los recorridos de E9 dependen de 2.1: si el iframe no pasa, todas las tarjetas «(Chatwoot)» se muestran en la pestaña aparte y 9.4 cambia de alcance.

## HANDOFF AL DIRECTOR

Rama `codex/0582-e9-guion` publicada en la PR draft #330, con la base E0 ya fusionada. 9.1 está aceptado («Acepto todo», 2026-10-29). Quedan las respuestas a las 19 preguntas para 9.2–9.6, y decidir el merge después del de la #328.
