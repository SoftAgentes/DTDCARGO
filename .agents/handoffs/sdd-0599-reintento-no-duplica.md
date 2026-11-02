# SDD-0599: reintentar un envío del portal no lo duplica

- **Fecha:** 2026-11-02. **Owner:** `claude-sweet-curie-8102cb`.
- **Ruta:** `DTD-worktrees/reintento-no-duplica`. **Rama:** `codex/reintento-no-duplica`, local y sin publicar. **Base:** `codex/accion-que-lanza` en `dc049dcb5` (PR #360, apilada sobre #358).
- **SDD:** 0599, reservada con `sdd:next --reserve`, sin publicar: `codex/sdd-reserve-0599-reintento-no-duplica`, `refs/dtd/reservations/0599`. La migración 0512 es la siguiente libre, sin reservar.
- **Límite:** nada entra a `main` antes de publicar. Sin migraciones aplicadas: eso exige OK nominal de Sam.
- **Ojo:** `node_modules` es una junction al de `error-no-borra-portal`. **No correr `pnpm` en este worktree:** reinstala y rompe el original. Usar `node node_modules/vitest/vitest.mjs` y `node scripts/...`.

## OBJETIVO ORIGINAL

Sam, literal: «Haz esta tarea aquí: "Que reintentar un envío del portal no lo duplique"».

## Estado

**Propuesta, a la espera de la aprobación de Sam.** Está en `docs/specs/0599-reintento-no-duplica/spec.md`. El encargo pide dejarla escrita antes de la migración: no hay código ni migración.

## COMPLETADO

- Lectura de las acciones, tablas, RPC y del precedente de pagos, con citas en la spec.
- Clasificación del daño por acción, y propuesta con su alternativa.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `docs:check`, `sdd:check` | Ver el commit de esta propuesta |
| Código, migración, pruebas, mutantes, `next dev`, `verify` | NO EJECUTADO: no hay nada que probar hasta que se apruebe |
| Filas por tabla en producción | NO EJECUTADO: no se leyó producción |

## PR / BRANCH

Sin publicar. La PR en borrador se abre al implementar, apilada sobre #360.

## PENDIENTES DE ESTA TAREA

1. Decisión de Sam sobre la propuesta.
2. Si la aprueba: implementar, con la migración sin aplicar, y abrir la PR en borrador.
3. Aplicar en producción: OK nominal aparte, después de la salida, de #358 y de #360.

## FUERA DE ALCANCE DETECTADO

1. **Candados de proveedor, referido y registro:** leen y después escriben; dos intentos simultáneos podrían pasar.
2. **Aviso al asesor si el primer envío murió antes de avisar:** sin una cola de avisos no se puede garantizar.

## HANDOFF AL DIRECTOR

- Los turnos pasaron al Director General, según el traspaso de Sam del 2026-11-02. Esta tarea no pide turno todavía.
- Sigue pendiente el turno de `next dev` y mutantes de #358 y #360.

### Impacto documental

Spec 0599 nueva e índice regenerado. No cambian políticas.
