# Handoff · SDD-0603, tramo 5b: filas y avisos de Contabilidad

- **Owner:** Claude (Worker), sesión abierta por el Subdirector Rebrand (`local_9104159b-a41d-4fd2-bde2-63c17443a370`).
- **Worktree:** `.claude/worktrees/0603-t5b-contabilidad-05e824`. **Rama:** `claude/0603-t5b-contabilidad-05e824`, desde `origin/main` `375adebfb`, que es `da8d123ee` más el tren #549, sin cambios en Contabilidad.
- **SDD:** 0603 (BD-037). El detalle, la clasificación por archivo, la aceptación y el gate VIS-01 están en `docs/specs/0603-claridad-controles/tramo-5b.md`. `spec.md` no se edita.
- **Encargo:** filas, avisos y selección de Contabilidad según BD-037. Autorizados el push de la rama y la PR lista contra main. Prohibidos fusionar, la imagen de prueba y producción. Sin Auto-fix.

## Hecho

- 12 `<Aviso>` en 11 archivos: errores de acción (`error`, compacto en cajones) y el aviso del cierre (`atencion`, con la superclave fuera de la región viva).
- Conciliación: control real por extracto, «Abrir» o «Cerrar» según el estado, con `aria-expanded` y nombre «Abrir/Cerrar extracto <período> · <cuenta>». Conserva el toggle de la fila. La fila sale del Tab. El abierto va en tinta: contorno `--ctl-border` y botón oscuro, sin vino.
- Ampliación del 2026-11-14 (pedido de Sam, transmitido por el Subdirector Rebrand):
  - `LineMatchDrawer`: «Ligar con <código>» por candidato, con la fila fuera del Tab y `stopPropagation` para no ligar dos veces.
  - `PlanCuentasTab`, que entra a la allowlist: «Abrir cuenta <código>», con el nombre fuera del Tab y el botón de colapsar en 32 px.
- Nuevos: `conciliacion-abrir.test.tsx`, `line-match-ligar.test.tsx`, `plan-cuentas-abrir.test.tsx` y `claridad-t5b-contract.test.ts` (15 archivos con cuenta exacta y mutantes).

## Decisiones

- **Allowlist:** el Subdirector Rebrand la confirmó con los 14 archivos el 2026-11-14. El Subdirector de Contabilidad midió sus cinco worktrees y ninguno tenía trabajo en `contabilidad/_components/`.
- **Extracto abierto (Subdirector Rebrand, 2026-11-14):** «se mantiene el toggle, porque no cambiamos comportamiento». Se aplica con texto «Abrir»/«Cerrar», `aria-expanded` y la fila fuera del Tab. La primera versión, en la que «Abrir» siempre abría, se reemplazó en `da9e63d56`.
- **Relleno de tinta de la selección:** se aplicó en el control (`studio-btn-dark`) y en el contorno de la fila, como en la #552, y no en toda la fila. Con la fila en `--ink`, el texto y los `Badge` quedarían sin contraste medido. Queda señalado para la revisión independiente en `tramo-5b.md`.
- **LineMatchDrawer y PlanCuentasTab (Subdirector Rebrand, 2026-11-14):** primero LineMatchDrawer quedó fuera. Luego Sam pidió resolver los pendientes menores en la misma PR, y entraron los dos. «Ligar» es secundario para no sumar un primario por candidato. La acción del servidor no cambia.
- **Finales de línea:** `AccountDrawer.tsx` y `LineMatchDrawer.tsx` están en el índice con CRLF y un CR suelto (`-text`). Se editaron sin cambiar sus finales, para que el diff quede en las líneas tocadas.

## Validación

- `pnpm install --frozen-lockfile`, con turno del Subdirector Rebrand: PASÓ.
- Vitest focal: PASÓ, 18 archivos y 317 pruebas.
  - Cubre `contabilidad/` completo y los contratos `claridad-t5b`, `claridad-controles`, `avisos` y `dark-theme-contrast`.
  - También `estado-gerencial-mezclado` y `fechas-caracas-formularios`.
  - Se corrió antes del toggle. Sobre la cabeza final se corrieron el contrato y `conciliacion-abrir`: 31 pruebas en verde.
- Mutantes sobre los archivos reales: murieron 6 de 6. Cada uno se restauró desde HEAD y el árbol quedó limpio.
  - `AccountDrawer`, `<Aviso>` a `<p role="alert">`: 6 fallos.
  - El aviso del cierre a `<p>`: 4 fallos.
  - La fila del extracto sin `tabIndex={-1}`: 4.
  - El control sin `aria-expanded`: 4.
  - «Cerrar» fijo en «Abrir»: 2.
  - El contorno del abierto en vino: 4.
- Los mutantes dentro del contrato están en `tramo-5b.md`.
- Ampliación, sobre `5e5d3fa17`: vitest focal (`contabilidad/` y el contrato) PASÓ, 15 archivos y 273 pruebas.
- Mutantes reales de la ampliación: murieron 6 de 6.
  - «Ligar» sin `stopPropagation`: 2 fallos.
  - «Ligar» sin nombre: 6.
  - El candidato ya conciliado que liga por la fila: 1.
  - El nombre de la cuenta en el Tab: 3.
  - La cuenta sin «Abrir»: 5.
  - Colapsar a 24 px: 1.
- `tsc --noEmit`: PASÓ. ESLint de lo tocado: PASÓ (las dos veces).
- `/ui-check`: sin hallazgos altos. El medio (ratón y teclado distintos en el extracto abierto) quedó resuelto con el toggle; quedan dos bajos (margen de 12 px fijo como el original y los campos del cierre sin caja, a ver en pantalla).
- `pnpm verify` local: NO EJECUTADO. Lo cubre el CI de GitHub (regla del DG, 2026-11-13).
- Vista en pantalla con datos, en claro y en oscuro: NO EJECUTADA.

## Impacto documental

Nuevo `tramo-5b.md`. Sin cambios en los documentos canónicos (`BRAND.md`, `spec.md`, CLAUDE, el registro de componentes). Graphify y Archify no se regeneraron en este worktree; quedan para el cierre del Director.

## Pendientes de esta tarea

- Verlo en la imagen de prueba antes de fusionar: Conciliación, con un extracto abierto y otro cerrado, y los cajones de cuenta, asiento, activo, extracto, cierre y ligar, con error. También el diálogo de excepción al cierre. En claro, oscuro y compacto.

## FUERA DE ALCANCE DETECTADO

- Los botones de papelera de `StatementDrawer` y `EntryDrawer` tienen contorno `--border`, que puede quedar por debajo de 3:1 (BD-037).
- `accentColor: var(--wine)` en casillas: `AccountDrawer`, `AjustesDelCierre`, `EntryDrawer` y unos 20 archivos más del Studio. Es selección en vino; conviene una tarea transversal.
- Las filas del mayor (`LibroMayorTab.tsx`) no están en la allowlist.
