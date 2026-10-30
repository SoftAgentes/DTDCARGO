# Handoff — SDD-0588, etapa E3 del programa SDD-0582 (pasos 3.1, 3.2 y 3.3)

- **Fecha:** 2026-10-30
- **Worker:** Claude, owner `local_e3-versiones` (sesión iniciada por el Director `local_535053f4…`)
- **Rama:** `codex/0582-e3-versiones`, en el worktree `.claude/worktrees/sad-kowalevski-241d34`
- **Base:** apilada sobre `codex/0582-e2-poc`; mergeada su punta `c1d081b3b` (2026-10-30) antes de registrar el cron
- **Reserva:** SDD-0588, local: `refs/heads/codex/sdd-reserve-0588-chatwoot-versiones-e3` en `74b81928`. El stub no se integra; la spec real vive en esta rama
- **Migración:** **0507**, asignada por el Director el 2026-10-30. **NO APLICADA**, declarada en `migrations-baseline.json › pendingBelowCutoff`

## OBJETIVO ORIGINAL

E3 «Actualizaciones desde Studio»: 3.1 runbook de versiones, 3.2 vigilante de versiones y 3.3 pantalla «Actualizaciones» solo para admin, con «Pedir actualización», que deja un registro y no despliega nada. El 3.4 (IA) queda fuera.

## COMPLETADO

| Paso | Entrega | Estado en el checklist |
|---|---|---|
| 3.1 | [`docs/runbooks/chatwoot-versiones.md`](../../docs/runbooks/chatwoot-versiones.md): RPO 0 mensajes / RTO ≤ 30 min, ventana de 21:00 a 23:00 en Caracas, de lunes a jueves, drenaje de Sidekiq (TSTP), respaldo conjunto en el momento, prueba en copia (`chatwoot-ensayo`), smoke S1–S10, recuperación del tráfico (Sidekiq, reintentos de Meta, reconciliación de Studio) y vuelta atrás a/b/c | entregado |
| 3.2 | `lib/studio/chatwoot/versiones{,-fuentes,-queries,-vigilante}.ts` y el cron `/api/cron/chatwoot-versiones` (13:15 UTC), registrado en `vercel.json` con el crontab regenerado. Guarda en `chatwoot_version_checks`; avisa por push a los admins una vez por versión | entregado |
| 3.3 | `/studio/admin/actualizaciones` (layout `requireModuleView("admin")`, acciones con `tenantAdminGate`): instalada, publicada, notas en texto plano, «Revisar ahora» y «Pedir actualización» → `chatwoot_update_requests`. Entrada: **una línea** en `admin/page.tsx` (grupo PRO) | entregado |

**Initializers de DTD en el runbook.** El candado de `/register` y la redacción de logs se comprueban así:
- en el ensayo local, con los controles en rojo: A1 de `ensayo-local.sh` y C de `prueba-register.sh`;
- tras subir, por la línea de arranque (S2, S4);
- por comportamiento: el dueño del método interceptado y `HTTParty::Request.ancestors` (S3), y una sonda de redacción (S5).

El candado vive en la PR de 4.2 (SDD-0584), todavía sin desplegar. Mientras no lo esté, S2 y S3 se registran como NO APLICA.

**Decisiones:** E3-D1 a E3-D8, en la [spec](../../docs/specs/0588-chatwoot-versiones-e3/spec.md).

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| PGlite de la 0507 (`chatwoot-versiones.migration.test.ts`) | PASÓ 13/13: contrato de 26 aserciones, control rojo, 9 mutantes, preflight y declaración |
| Vigilante, fuentes, ruta, acciones y panel | PASÓ (32 + 18) |
| Mutantes manuales del vigilante: `sinError` fuera y limpieza de `@usuario` fuera | los dos mueren |
| `rbac-actions-guard` (inventario 78 → 79 archivos, 450 → 452 acciones) | PASÓ 457/457 |
| `build-crontab --check` y su prueba (22 crons) | PASÓ |
| `tsc --noEmit` del proyecto | PASÓ (antes del merge de E2) |
| ESLint de los archivos nuevos | PASÓ, 0 avisos |
| `docs:check`, `sdd:check`, `git diff --check` | PASÓ |
| `check-pending-migration-symbols` | 0507 declarada en AMARILLO. **El gate sale ROJO tras el merge de E2 por una declaración de E2** (ver FUERA DE ALCANCE) |
| `/ui-check` | OK con ajustes menores; aplicados 3 (`--ink-mute` como texto → `--ink-soft`, notas en `--f-sans`, alineación sin px) |
| Pantalla en el navegador | **NO EJECUTADO**: necesita sesión de Studio con datos y la 0507 aplicada en una base local; cubierto por las pruebas del panel |
| `pnpm verify` | **NO EJECUTADO**: en cola, detrás de E10, E6.2, E2 y E6.3. Pido turno al Director |
| `knowledge:status` | structural/semantic INVALID y Archify/Obsidian PENDING en este worktree; Graphify no corrido (lo publica el Director) |

## COMMITS

`18e4383a7` spec + runbook (3.1) · `9c2b0619e` vigilante + 0507 (3.2) · `3e6fae7e5` pantalla (3.3) · `ce6ed41fa` checklist · `2a39aeca1` merge de E2 `c1d081b3b` · `8e1dc526b` cron registrado · (este handoff y la spec, en el commit siguiente).

## PR / BRANCH

`codex/0582-e3-versiones`, PR en borrador con base `codex/0582-e2-poc` (link en el reporte al Director).

## PENDIENTES DE ESTA TAREA

1. `pnpm verify` con turno del Director.
2. ~~Confirmar la 0507~~: asignada por el Director. Pidió además guardar las notas sin HTML crudo: `limpiarNotas` quita etiquetas y comentarios (prueba más un mutante que muere).
3. Aplicar la 0507: OK nominal de Sam y runbook `aplicar-migraciones-prod`. Sin ella, todo responde `omitido`/«sin datos».
4. Aceptación de Sam de 3.1 a 3.3 (PR → OK Sam).

## FUERA DE ALCANCE DETECTADO

- **Declaración vencida de E2.** `sdd-0585-chatwoot-eventos` en `pending-migration-symbol-declarations.json` cita `app/studio/(app)/_components/BandejaBadge.tsx:19` y `chatwoot_conversations` en líneas que el commit `e626c8cab` (paso 2.6) movió: «if (n === 0) return null;» ahora está en la 21. En la punta de E2 (`c1d081b3b`) la declaración también dice `:19`, así que el gate sale ROJO allí igual. No lo toqué (archivo de E2).
- **`ensayo-local.sh` fija `4.19.1`** en C1 y tras restaurar: cada subida tiene que cambiarlo (anotado en el runbook §3 paso 4). Convendría parametrizarlo cuando se haga la primera subida.
- **Monitor «Chatwoot · versión» de Uptime Kuma** busca `"version":"4.19.1"`: se cambia en su UI después de cada subida (runbook §6).

## Impacto documental

- Canónicos nuevos: `docs/runbooks/chatwoot-versiones.md` y `docs/specs/0588-chatwoot-versiones-e3/spec.md`; el índice `docs/specs/README.md` está regenerado.
- Checklist de la 0582: filas 3.1 a 3.3 en `entregado`. El % no se mueve (solo suma `aceptado`).
- Graphify, Archify y Obsidian: pendientes para el Director desde la main integrada; aquí no se emitieron recibos.

## HANDOFF AL DIRECTOR

SDD-0588. Migración 0507 por confirmar. PR en borrador apilada sobre E2. Falta el turno de `pnpm verify`. La declaración vencida de E2 bloquea el gate de símbolos en las dos ramas: es de E2.
