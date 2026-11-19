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

| Comprobación | Resultado | Detalle |
|---|---|---|
| Vitest: pruebas nuevas, oficina y todos los archivos de prueba que mencionan Drawer/DrawerFooter/OperariosClient/PhotoManager/FormularioAccion | PASÓ | 67 archivos, 648 pruebas |
| Mutantes: DrawerFooter sin `aria-busy` (3 pruebas fallan), sin etiqueta en curso (1), foto sin `disabled` (2), foto calla el error (1), operario sin `disabled` ni `aria-busy` (1) | los 5 detectados | el control sin cambio de conducta pasa 6/6 |
| eslint en lo tocado | PASÓ | 0 errores, 2 avisos por parámetros sin usar en los dobles de prueba |
| tsc | PASÓ | tras corregir 3 tipos en los dobles de las pruebas |
| `check-rsc-boundary`, `docs:check` | PASÓ | |
| Revisión independiente, cambio 1 (bloqueante): `await` sin `try/catch` en `PhotoManager` | corregido | `try/catch` con mensaje genérico; prueba nueva con acción que RECHAZA; vitest de ese archivo 3/3 PASÓ y el mutante sin `try/catch` la hace fallar |
| Revisión, cambio 2: ancho del submit en reposo | medido | spec §9.2b (Chrome headless). `/ui-check`: NO EJECUTADO |
| Revisión, cambio 3 (menor) | DECLARADO, no cubierto | (a) ninguna prueba detecta quitar `className="studio-spin"` de `EtiquetaEstable`; (b) el doble clic de `OperariosClient.desactivar.test.tsx` se frena porque el botón ya está `disabled`, no por el candado. Cubrirlos exige correr más vitest y el turno de la PC era solo para `PhotoManager.test.tsx` |
| `pnpm verify` local | NO EJECUTADO | lo cubre el CI de GitHub |

## Impacto documental

- Spec 0678 §9 y §10. `app/studio/CLAUDE.md` todavía no se toca: se propone sumar `EtiquetaEstable`/`BotonEnvio`
  a «UI primitivas compartidas» cuando el DG lo decida (fase 2, contrato final).

## Pendientes de esta tarea

- PR B, PR C… según la spec §10.

## FUERA DE ALCANCE DETECTADO

- `setOperarioActiveAction` (`app/studio/(app)/operarios/actions.ts:337`) devuelve `void` y no mira el error del
  `rpc` ni el permiso denegado: la fila no se entera si la desactivación falló. Anotado como §10.2.
- `knobStyle` en `OperariosClient.tsx` usa `#FFFFFF` en línea (hex fuera de tokens), preexistente.
