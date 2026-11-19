# Handoff · SDD-0678 — botones que muestran que están trabajando

- **Owner:** Worker `worker-0678-optimistic-murdock` (sesión de Claude Code iniciada por el Director General)
- **Ruta:** `.claude/worktrees/optimistic-murdock-92f954`
- **Rama:** `claude/optimistic-murdock-92f954` (base `main` en `031ef7ad7`)
- **SDD:** [0678](../../docs/specs/0678-botones-trabajando/spec.md), reservada por el DG
- **Permisos:** subir la rama propia y abrir la PR. Sin fusión, sin migración, sin datos de producción ni PII.

## Objetivo

Que en la revisión de la oficina (`/studio/admin/oficina`) los botones muestren «Guardando…», no se pueda enviar dos
veces ni cambiar la opción a mitad, y que el resultado se vea (también en el móvil). Fase 2: solo el inventario.

## Completado

- `app/studio/_components/ui/FormularioAccion.tsx`: `FormularioAccion` (fieldset deshabilitado mientras corre +
  candado de doble envío en `onSubmit`) y `BotonEnvio` (spinner, «Guardando…», `aria-busy`, solo el botón tocado).
- `TarjetaCierre` y `TarjetaBorrador` usan los dos componentes; mismas clases y textos.
- `actions.ts`: el redirect lleva `c` (conversación), `v` (lo guardado) y `n` (distinto en cada envío).
- `AvisoResultado`: `<Aviso>` con foco y desplazamiento; el cierre dice «Cierre de la conversación 27 registrado:
  Cumple.»; un error de cierre nombra la conversación.
- Spec con la fase 2 inventariada (40 formularios con `<form action>`; 2 sin ningún pendiente, 1 que no aplica,
  33 por auditar).

## Validación

| Comprobación | Resultado | Detalle |
|---|---|---|
| Vitest: oficina, componente y contratos de avisos y controles | PASÓ | 13 archivos, 208 pruebas, sobre `7f2ec51d2` |
| Mutante 1: sin `e.preventDefault()` en el candado | detectado | falla «doble clic … envía una sola vez» |
| Mutante 2: `<fieldset disabled={false}>` | detectado | falla «no se puede cambiar «Cumple» por «Falló» a mitad» |
| Mutante 3: sin `alTerminar()` (el candado no se reabre) | detectado | falla «el candado se abre y se puede reintentar» |
| eslint y tsc en los archivos tocados | PASÓ | sobre `7f2ec51d2` |
| BTN-01 §5 «conserva ancho» (estaba en no conformidad, la detectó el Worker al leer la política) | PASÓ tras el arreglo | prueba de estructura + medida en Chrome headless: 140,06/140,06, 140,06/140,06 y 144,48/144,48 px |
| Mutante 4: la etiqueta oculta con `display: none` (deja de reservar el ancho) | detectado | falla «en reposo ya reserva el espacio de «Guardando…»…» |
| Vitest del componente y de la oficina tras el arreglo | PASÓ | 162 pruebas |
| CI de GitHub en `7f2ec51d2` (run 44432402211) | FALLÓ | Frontera RSC: `page.tsx` importaba dos helpers de un módulo `"use client"`; los demás pasos quedaron sin correr |
| `check-rsc-boundary.mjs` tras la corrección | PASÓ | local |
| `docs:check` (índice regenerado), `sdd:check`, `components:check`, `governance:check`, `feature-constants` | PASÓ | local |
| `pnpm verify` local | NO EJECUTADO | por decisión del DG; verify: cubierto por CI, en el run de la cabeza nueva |
| `/ui-check` | OK con ajustes menores | ver la PR |
| Smoke en el móvil por Sam | NO EJECUTADO | pendiente A8 |

## Impacto documental

- Nuevo: `docs/specs/0678-botones-trabajando/spec.md`.
- Pendiente para la fase 2: sumar `FormularioAccion`/`BotonEnvio` a `app/studio/CLAUDE.md` («UI primitivas
  compartidas» y «Anti-double-submit») cuando se decida la regla. Esta PR no lo toca: hoy tiene un solo consumidor.

## Pendientes de esta tarea

- Smoke en el móvil por Sam, en una base de prueba (A8 de la spec).

Pendientes de la fase 2: spec §7, puntos 1 a 5. Conformidad con BTN-01 y LOD-01: spec §6.

## FUERA DE ALCANCE DETECTADO

- Cuando una acción de la oficina vuelve con error, React reinicia el formulario y se pierde el motivo escrito
  (anotado también en la spec, §7.4).
- `OperariosClient` (interruptor de desactivar) no tiene ningún estado pendiente: primer candidato de la fase 2.
