# SDD-0589 · seguimiento del P-13: B1 y B2 (handoff)

Rama `claude/0589-p13-seguimiento`, worktree `.claude/worktrees/p13-seguimiento`, desde la cabeza de la #416 (`a0b4457a4`). Owner del claim: `worker-0589-p13-seguimiento`. Encargo del Subdirector de Chatwoot, 2026-11-07: las dos BAJAS que dejó el Director General al aprobar la #416, en una PR aparte que se abre con la #416 fusionada y `main` traído. Nada en producción ni en Chatwoot.

## OBJETIVO ORIGINAL

- **B1 (`GuiaMotor.tsx:345`):** si la persona cambia de pestaña antes de que termine el `router.replace`, el pedido queda pendiente y la guía se abre sola minutos después, cuando la persona entra a Embudos. Hay que limpiar el pedido cuando la consulta cambia sin la pestaña pedida.
- **B2 (`:347` y `:385`):** dos pulsaciones de «Guía» durante la espera arrancan dos series de reintentos, y eso puede reiniciar la tarjeta. Hay que cancelar la espera anterior al arrancar otra, y también en `cerrarGuia`.
- Cada arreglo, con una prueba que falle antes (rojo anotado) y un mutante. Pruebas con fake timers.

## COMPLETADO

El detalle está en `docs/specs/0589-guia-motor-studio/spec.md`, sección «2026-11-07 · Seguimiento del P-13».

- **B1:** el pedido guarda `consultaDelPedido`. Si la URL cambia a otra sin la pestaña pedida, el pedido se olvida.
- **B2:** hay una sola espera a la vez (`esperaRef`). La nueva cancela la anterior y `cerrarGuia` también la cancela. El arranque automático no reemplaza un pedido de la persona en curso.
- **Pruebas:** 5 casos nuevos en `GuiaEmbudoPestana.test.tsx`: B1 por URL y por botón, B2 con doble pulsación, `cerrarGuia` y el arranque automático encendido. El doble de navegación agrega `persona(query)`, que cancela el `replace` en curso, como en Next.

## VALIDACIÓN

Pendiente del turno de máquina: los `verify` del DG corrían al escribir el código, y por eso solo se leyó y se editó.

## COMMITS

Ver la PR. Commits selectivos con `git commit -F`.

## PR / BRANCH

`claude/0589-p13-seguimiento` → `main`, en borrador. Se abre solo con la #416 fusionada y `main` traído con el driver.

## PENDIENTES DE ESTA TAREA

- Con turno: instalar dependencias, correr el rojo previo sobre el `GuiaMotor.tsx` de `a0b4457a4`, el verde, los mutantes, la suite de la guía, `tsc`, ESLint y los checks de docs.
- Con la #416 en `main`: traer `main` con el driver, abrir la PR y mandarle al Subdirector el SHA, el numstat y los rojos previos.
- `pnpm verify`: lo corre el Director General.
- Al fusionar: limpiar este worktree y su rama. El árbol de la #416 (`.claude/worktrees/laughing-mclaren-33178a`, rama `claude/0589-p13-embudo-pestana`) se limpia cuando la #416 esté en `main`.

## FUERA DE ALCANCE DETECTADO

- Ninguno nuevo.

## HANDOFF AL DIRECTOR

- Solo cambia el motor de la guía y su prueba. Fusionar no enciende nada (D11).
