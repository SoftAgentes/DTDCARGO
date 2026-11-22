# Handoff — quitar un conteo de producción de `invoice-client-doc.ts`

- **Owner:** Worker (Claude), sesión `local-sdd-0698-worker`, encargada por Dir_DTD el 2026-11-20.
- **Ruta:** `DTD-worktrees/quitar-conteo-invoice-client-doc`.
- **Rama:** `codex/quitar-conteo-invoice-client-doc`, desde `origin/main` `78aa5edd9`.
- **Objetivo:** que el comentario de `lib/studio/invoice-client-doc.ts:29` sea cualitativo y no cite el
  número de clientes de producción. El repo es público.

## COMPLETADO

- Cambia solo el texto del comentario, no el código.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `git diff --check` | PASÓ |
| `pnpm verify` y vitest | NO EJECUTADO: el cambio es solo un comentario. La CI de la PR es la que cuenta |

## PENDIENTES DE ESTA TAREA

- Ninguno.

## FUERA DE ALCANCE DETECTADO

- `docs/specs/0298-la-factura-le-sirve-al-contador/spec.md:83` cita el mismo conteo. Dir_DTD decide si
  se quita.

## Impacto documental

No aplica: no cambia ningún documento canónico.
