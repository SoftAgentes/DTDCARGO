# Handoff · SDD-0568 · La ficha de un cliente eliminado

| Campo | Valor |
|---|---|
| Fecha | 2026-10-20 |
| Task ID / owner | `contabilidad-2026-10-18` / sesión Worker «Contabilidad» |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\sdd-0568-ficha-cliente-eliminado` |
| Rama | `codex/sdd-0568-ficha-cliente-eliminado`, desde `origin/main` `88b36c7a` |
| SDD | [0568](../../docs/specs/0568-ficha-cliente-eliminado/spec.md), `in-progress`. La reserva es `codex/sdd-reserve-0568` (`51599e38`, con `sdd:next --reserve ficha-cliente-eliminado --number 0568 --push`) y entró por cherry-pick |
| Estado | lista para revisión, con PR en borrador; `pnpm verify` con turno del Director. Sin migración |
| Permisos | El Director la asignó el 2026-10-20 («SDD chica, sin migración: la ficha del cliente eliminado»). Eso cubre commits selectivos, push de la rama propia y PR en borrador |

## OBJETIVO ORIGINAL

La ficha de un cliente con `deleted_at`, abierta por URL, debe decir «cliente eliminado» y no pedir el saldo, en vez de «No se pudo calcular el saldo». Lo encontró el Director en el smoke de la 0558 en producción, el 2026-10-20.

## COMPLETADO

- **El estado:** `getClientAccountState` mira `deleted_at` antes de nada y devuelve `eliminado`, sin llamar a `client_outstanding`.
- **La cabecera:** pinta «Cliente eliminado», con el día de Caracas en que se eliminó, y menciona el estado de cuenta solo si el rol lo abre.

## VALIDACIÓN

| Comprobación | Alcance | Resultado |
|---|---|---|
| `vitest run` de `client-account.test.ts` y `app/studio/(app)/clientes` | el estado y la ficha | PASÓ: `Test Files  17 passed (17)`, `Tests  147 passed (147)` |
| Control rojo, 3 mutantes, restaurados por copia con la huella sha256 | el estado ignora `deleted_at`; el día no es el de Caracas; la cabecera sin el aviso | `MUERTOS 3/3 · restaurados 3/3` |
| `typecheck`, eslint `--max-warnings=0` (los 5 archivos) | repo y archivos tocados | PASÓ |
| `pnpm verify` | completo | PENDIENTE: turno del Director |

## Impacto documental y conocimiento

La spec 0568 y el índice. Sin cambios de esquema.

## PENDIENTES DE ESTA TAREA

1. `pnpm verify` con turno del Director.
2. Integración por el Director.

## FUERA DE ALCANCE DETECTADO (para el Director)

Ninguno nuevo.
