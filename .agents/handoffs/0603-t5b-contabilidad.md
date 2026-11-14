# Handoff · SDD-0603, tramo 5b: filas y avisos de Contabilidad

- **Owner:** Claude (Worker), sesión abierta por el Subdirector Rebrand (`local_9104159b-a41d-4fd2-bde2-63c17443a370`).
- **Worktree:** `.claude/worktrees/0603-t5b-contabilidad-05e824`. **Rama:** `claude/0603-t5b-contabilidad-05e824`, desde `origin/main` `375adebfb`, que es `da8d123ee` más el tren #549, sin cambios en Contabilidad.
- **SDD:** 0603 (BD-037). El detalle, la clasificación por archivo, la aceptación y el gate VIS-01 están en `docs/specs/0603-claridad-controles/tramo-5b.md`. `spec.md` no se edita.
- **Encargo:** filas, avisos y selección de Contabilidad según BD-037. Autorizados el push de la rama y la PR lista contra main. Prohibidos fusionar, la imagen de prueba y producción. Sin Auto-fix.

## Hecho

- 12 `<Aviso>` en 11 archivos: errores de acción (`error`, compacto en cajones) y el aviso del cierre (`atencion`, con la superclave fuera de la región viva).
- Conciliación: «Abrir» real por extracto. La fila sale del Tab. El extracto abierto va en tinta: contorno `--ctl-border`, botón oscuro y `aria-current`, sin vino.
- Nuevos: `conciliacion-abrir.test.tsx` y `claridad-t5b-contract.test.ts`, con cuenta exacta por archivo y mutantes.

## Decisiones

- **Allowlist:** el Subdirector Rebrand la confirmó con los 14 archivos el 2026-11-14. El Subdirector de Contabilidad midió sus cinco worktrees y ninguno tenía trabajo en `contabilidad/_components/`.
- **Preguntas sin respuesta al publicar:**
  - Extracto abierto: «Abrir» lleva a su extracto, y la fila, con el ratón, sigue cerrándolo.
  - Candidatos de `LineMatchDrawer`: quedan fuera, porque ligan al pulsarlos y no abren nada.
  - En las dos se tomó la opción conservadora. El Subdirector puede pedir otra.
- **Finales de línea:** `AccountDrawer.tsx` y `LineMatchDrawer.tsx` están en el índice con CRLF y un CR suelto (`-text`). Se editaron sin cambiar sus finales, para que el diff quede en las líneas tocadas.

## Validación

- Ver el cuerpo de la PR y la sección de Validación al cierre: vitest focal, mutantes, `dark-theme-contrast`, `tsc`, ESLint, `docs:check` y `sdd:check`.
- `/ui-check`: sin hallazgos altos. Uno medio, el comportamiento distinto con ratón y teclado del extracto abierto, y dos bajos.
- `pnpm verify` local: NO EJECUTADO. Lo cubre el CI de GitHub (regla del DG, 2026-11-13).
- Vista en pantalla con datos, en claro y en oscuro: NO EJECUTADA.

## Impacto documental

Nuevo `tramo-5b.md`. Sin cambios en los documentos canónicos (`BRAND.md`, `spec.md`, CLAUDE, el registro de componentes). Graphify y Archify no se regeneraron en este worktree; quedan para el cierre del Director.

## Pendientes de esta tarea

- Verlo en la imagen de prueba antes de fusionar: Conciliación, con un extracto abierto y otro cerrado, y los cajones de cuenta, asiento, activo, extracto, cierre y ligar, con error. También el diálogo de excepción al cierre. En claro, oscuro y compacto.

## FUERA DE ALCANCE DETECTADO

- Los botones de papelera de `StatementDrawer` y `EntryDrawer` tienen contorno `--border`, que puede quedar por debajo de 3:1 (BD-037).
- `accentColor: var(--wine)` en casillas: `AccountDrawer`, `AjustesDelCierre`, `EntryDrawer` y unos 20 archivos más del Studio. Es selección en vino; conviene una tarea transversal.
- Las filas de cuentas (`PlanCuentasTab.tsx`) y del mayor (`LibroMayorTab.tsx`) no estaban en la allowlist.
- Los candidatos de `LineMatchDrawer` son una fila entera que liga al pulsarla, con contorno `--border`. Se podría pasar a fila más botón «Ligar».
- `EntryDrawer.tsx` choca con las PRs abiertas #529, #527, #526, #521, #520 y #312.
