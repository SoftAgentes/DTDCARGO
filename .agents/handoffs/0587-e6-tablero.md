# Handoff · SDD-0587 paso 6.3 — tablero de dos embudos y ficha de la tarjeta

- **Owner:** Claude Worker «E6 tablero» (sesión `local_e6-tablero-0587`), encargado por el Director (sesión `local_535053f4-40c2-4124-a280-63f4fc882820`).
- **Ruta:** `.claude/worktrees/sad-nash-bbeef2`
- **Rama:** `codex/0582-e6-tablero`, desde `origin/codex/0582-e6-modelo` (`01aa6929c`, PR #336).
- **SDD:** 0587 (aprobada; E6 sigue en esta SDD). Sección §15 y allowlist en §10.
- **Programa:** SDD-0582, fila 6.3 del checklist → «entregado».

## Objetivo

Tablero Kanban con los dos embudos (Leads y Clientes), paso automático de uno a otro según el segmento calculado en el momento, mover con arrastre o con teclado por `crm_mover_etapa`, esconder la tarjeta de una ficha borrada en suave, ficha con historial, tareas, notas, fuente y dueño separado del asignado del chat (D9), permisos admin/commercial como la RLS de la 0506, y estados vacío, cargando y error.

## Qué quedó

Detalle en la SDD-0587 §15.1. Resumen:

- Pestaña **Embudos** en `/studio/crm` (convive con las de Kommo durante F2).
- `lib/studio/crm-tablero.ts` (puro: ubicación por segmento, «de dónde vino», columnas, destinos, búsqueda), `lib/studio/crm-tablero-queries.ts` (lecturas paginadas, fichas borradas, rastro del historial, tareas vencidas), `lib/studio/crm-ficha.ts` (tipos de la ficha).
- `app/studio/(app)/crm/tarjeta-actions.ts`: mover, leer ficha, nota, tarea, completar tarea, cambiar dueño. Doble candado: módulo `kommo` + `rolUsaCrm`.
- Vistas: `CrmEmbudosSlot.tsx` (server, permisos y estados), `CrmEmbudosClient.tsx` (selector, búsqueda, movimiento optimista, motivo de cierre), `CrmTableroKanban.tsx` (columnas, arrastre y selector accesible), `TarjetaFichaDrawer.tsx` (ficha).
- **Sin migración nueva.**

## Validación

| Comprobación | Resultado |
|---|---|
| Pruebas puntuales nuevas (5 archivos, 59 pruebas) | PASÓ |
| `app/studio/(app)/crm` completo + contrato PGlite de la 0506 | PASÓ (10 archivos, 180 pruebas) |
| 4 mutantes (anonimizadas, ficha borrada, vuelta a recontacto, candado de rol) | PASÓ: caen los 4 |
| `tsc` acotado a 6.3 y sus dependencias | PASÓ |
| ESLint de `crm/_components` y `lib/studio/crm-*` | PASÓ (0 errores; 2 avisos que ya estaban) |
| `/ui-check` | PASÓ con 3 ajustes aplicados |
| revisar-datos-ve | §15.3: 5 CORRECTO, 1 ENCONTRADO (notas no editables ni borrables → «Anonimizar ahora» de 6.6) |
| Gate de símbolos de migraciones pendientes | PASÓ: 0 ROJO (ver abajo) |
| Prueba visual en navegador con datos | NO EJECUTADO: hace falta una base con la 0506 aplicada |
| `pnpm verify` | NO EJECUTADO: cola del Director (E10 → E2 → E6). Pido turno |

Las pruebas se corrieron con `node node_modules/vitest/vitest.mjs` y un enlace `node_modules` (junction, ignorado por Git) hacia la instalación de `agent-af5818079f13959fd`, que tiene el mismo `pnpm-lock.yaml`. La instalación del checkout principal tiene `jsdom` incompleto (falta `lib/api.js`): las pruebas de componentes no arrancan con ella.

## Gate de símbolos

PASÓ en `1d12270b6`, con `3c86f4053` (`e6-modelo` + `a319d4cdc` de E10) integrado: **0 ROJO, 7 AMARILLO declarados**. La 0506 queda declarada en `sdd-0587-crm-tablero` (7 símbolos, 6 evidencias). Mis dos sitios nuevos se suman a las declaraciones de E2 (`chatwoot_agent_links` en `tarjeta-actions.ts:209` y `chatwoot_conversations` en `tarjeta-actions.ts:197`). El rojo de antes (líneas vencidas de E2 y la 0505 sin declarar) lo resolvieron `f90aede00` y `632be86fd`.

## Impacto documental

- SDD-0587: §10 (allowlist 6.3), §13 (seguimiento) y §15 (nuevo).
- Checklist 0582: fila 6.3 → entregado, 0,5 d reales, 0 restantes. Avance del programa: 20,4 % (lo mueve la aceptación, no la entrega).
- `knowledge:status`, Graphify y Archify: NO EJECUTADO en este worktree (corrida pesada; las publica el Director desde main).

## PENDIENTES DE ESTA TAREA

- Turno de `pnpm verify` (Director).
- Prueba visual con datos cuando haya una base con la 0506 (local o después de aplicarla).
- Aceptación de 6.3 por Sam.

## FUERA DE ALCANCE DETECTADO

- **Límite de §15.1 (I):** la vuelta cliente → lead de una tarjeta sin historial en Clientes no se detecta; registrar el cambio de tablero al detectarlo es de 6.6.
- **Notas no corregibles:** la 0506 solo da INSERT en `crm_notas`; la acción «Anonimizar ahora» de 6.6 lo cubre (revisar-datos-ve, punto 4).
- **`node_modules` del checkout principal:** `jsdom@29.1.1` sin `lib/api.js`; cualquier prueba de componentes que use esa instalación falla al arrancar el worker de Vitest.
- La pestaña «Dirección» calcula la analítica de Kommo en todas las pestañas, incluida «Embudos» (`page.tsx`, `getKommoAnalytics`): lectura de más que 6.6 puede quitar.
