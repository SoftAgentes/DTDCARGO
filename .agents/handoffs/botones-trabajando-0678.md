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

Ver la sección del cierre en la PR: se registra por comprobación (PASÓ / FALLÓ / NO EJECUTADO).

## Impacto documental

- Nuevo: `docs/specs/0678-botones-trabajando/spec.md`.
- Pendiente para la fase 2: sumar `FormularioAccion`/`BotonEnvio` a `app/studio/CLAUDE.md` («UI primitivas
  compartidas» y «Anti-double-submit») cuando se decida la regla. Esta PR no lo toca: hoy tiene un solo consumidor.

## Pendientes de esta tarea

- Smoke en el móvil por Sam, en una base de prueba (A8 de la spec).

## FUERA DE ALCANCE DETECTADO

- Cuando una acción de la oficina vuelve con error, React reinicia el formulario y se pierde el motivo escrito.
- `OperariosClient` (interruptor de desactivar) no tiene ningún estado pendiente: primer candidato de la fase 2.
