# Handoff · SDD-0678 fase 2 · PR A — el pie de los drawers y los botones sin ningún estado

- **Owner:** Worker `worker-0678-f2` (la misma sesión de la fase 1, iniciada por el Director General)
- **Ruta:** `DTD-worktrees/sdd-0678-f2-drawerfooter`
- **Rama:** `codex/sdd-0678-f2-drawerfooter`, creada desde `origin/main` en `4cb9fe5ff` (ya con la #695)
- **SDD:** [0678](../../docs/specs/0678-botones-trabajando/spec.md) §9 (PR A) y §10 (lo que sigue)
- **Permisos:** subir la rama propia y abrir la PR. Sin fusión, sin migración, sin datos de producción ni PII.

## Objetivo

El bloque A del orden aprobado por el DG el 2026-11-19: `DrawerFooter` (66 archivos) con `aria-busy` y ancho
estable, y los botones del inventario que llaman al servidor sin ningún estado de trabajo.

## Completado

- `EtiquetaEstable`: la rejilla de dos etiquetas de la fase 1 sale a un componente; `BotonEnvio` la reutiliza.
- `DrawerFooter`: `aria-busy`, spinner y el mismo ancho en reposo y mientras guarda.
- Operarios · desactivar: `FormularioAccion` + estado (deshabilitado, `aria-busy`, «Desactivando a …», spinner).
- Inspecciones · eliminar foto: `useTransition` + estado, y el error ya no se calla (aviso).
- CSV del libro diario: no aplica (GET de descarga). Documentado en la spec §9.1.

## Validación

Se completa con el turno de la PC del DG (install + vitest). Ver la PR.

## Impacto documental

- Spec 0678 §9 y §10. `app/studio/CLAUDE.md` todavía no se toca: se propone sumar `EtiquetaEstable`/`BotonEnvio`
  a «UI primitivas compartidas» cuando el DG lo decida (fase 2, contrato final).

## Pendientes de esta tarea

- PR B, PR C… según la spec §10.

## FUERA DE ALCANCE DETECTADO

- `setOperarioActiveAction` (`app/studio/(app)/operarios/actions.ts:337`) devuelve `void` y no mira el error del
  `rpc` ni el permiso denegado: la fila no se entera si la desactivación falló. Anotado como §10.2.
- `knobStyle` en `OperariosClient.tsx` usa `#FFFFFF` en línea (hex fuera de tokens), preexistente.
