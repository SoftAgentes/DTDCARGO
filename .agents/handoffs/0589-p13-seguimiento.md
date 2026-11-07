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

El detalle está en la tabla «Evidencia del seguimiento» de la spec. Se corrió con el turno del Subdirector.

| Comprobación | Resultado |
|---|---|
| Rojo previo: las pruebas nuevas contra el motor de `a0b4457a4` | FALLÓ, como se esperaba: 5 de 21 |
| Con el arreglo | PASÓ: 21 de 21 |
| 5 mutantes, de a uno, con base verde | PASÓ: 5 de 5 muertos, todo restaurado |
| Suite de la guía (10 archivos, 1 worker) | PASÓ: 170 de 170 |
| `tsc --noEmit` y ESLint de los 2 archivos | PASÓ |
| `check-numbering`, `build-docs-index --check` y `git diff --check` | PASÓ |
| `pnpm verify` y la página real | NO EJECUTADO: el portón es el CI de la PR |

La primera versión de la prueba de la doble pulsación pasaba sin el arreglo, porque el botón retoma el paso guardado. Quedó parametrizada con el botón y desde el código.

**Revisión de la #418 (CHANGES_REQUESTED sobre `ee22c804a`).** Pedir la guía otra vez mientras carga el tablero cancelaba la espera de 10 s y empezaba una de 2 s. Con un tablero lento, la guía ya no abría. Arreglo en `54f28c1c7`: la espera nueva del mismo recorrido hereda los intentos que le quedaban a la anterior, y un cambio de pestaña que ya va en camino no se pide dos veces. El merge de `origin/main` `250e86f65`, que ya trae la #416 y la S0, va en `b3247f37e`.

| Comprobación | Resultado |
|---|---|
| Rojo contra el motor de `ee22c804a` | FALLÓ, como se esperaba: 3 de 24 (tableros de 4 s y 6 s, y dos pulsaciones seguidas) |
| Con el arreglo | PASÓ: 24 de 24 |
| 8 mutantes, de a uno | PASÓ: 8 de 8 muertos. MB2c quedó vivo en la primera tanda; S4 ahora exige la tarjeta del botón |
| Suite de la guía con `guia-se-queda` de la S0, sobre el árbol fusionado | PASÓ: 182 de 182 en 11 archivos |
| `tsc`, ESLint de los 2 archivos y checks de docs | PASÓ |

## COMMITS

Ver la PR. Commits selectivos con `git commit -F`.

## PR / BRANCH

`claude/0589-p13-seguimiento` → `main`, en borrador: [#418](https://github.com/SoftAgentes/DTDCARGO/pull/418). Por orden nueva del DG (avanzar en varias líneas a la vez), se abrió antes de fusionar la #416, con base `main` porque «Calidad continua» solo corre contra `main`. Para revisar: solo los commits propios, encima de `a0b4457a4`.

## PENDIENTES DE ESTA TAREA

- PR en borrador #418, base `main`, apilada sobre la #416: se fusiona después de la #416. Cuando la #416 esté en `main`, traer `main` con el driver.
- `pnpm verify`: lo corre el Director General.
- Al fusionar: limpiar este worktree y su rama. El árbol de la #416 (`.claude/worktrees/laughing-mclaren-33178a`, rama `claude/0589-p13-embudo-pestana`) se limpia cuando la #416 esté en `main`.

## FUERA DE ALCANCE DETECTADO

- Ninguno nuevo.

## HANDOFF AL DIRECTOR

- Solo cambia el motor de la guía y su prueba. Fusionar no enciende nada (D11).
