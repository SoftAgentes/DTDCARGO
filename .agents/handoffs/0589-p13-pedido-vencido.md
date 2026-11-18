# SDD-0589 · P-13: el pedido vencido se borra (handoff)

Rama `claude/0589-p13-pedido-vencido`, worktree `.claude/worktrees/p13-vencido`, desde `main` en `ce878289f`, que ya trae la #416 y la #418. Owner del claim: `worker-0589-p13-vencido`. Encargo del Subdirector de Chatwoot (2026-11-07): los dos pendientes que dejó la tercera revisión de la #418, en una PR nueva en borrador desde `main`. Nada en producción ni en Chatwoot.

## OBJETIVO ORIGINAL

- **El pedido vencido no se borraba al vencer** (`GuiaMotor.tsx:294-303` en `9c7f38d63`). Si un `replace` se pierde y nadie vuelve a pulsar, cuando la persona entra después a Embudos con un clic, la guía se abre sola y frena el arranque automático (la guarda de `:432`). Arreglo: borrar el pedido vencido en el efecto del pedido (`:405`), con una prueba que falle antes y su mutante.
- **Renombrar las pruebas** del seguimiento a S1–S9, para que coincidan con la aceptación de la spec.

## COMPLETADO

El detalle está en `docs/specs/0589-guia-motor-studio/spec.md`, sección «2026-11-07 · P-13: el pedido vencido se borra».

- El efecto del pedido borra el pedido vencido (`VIGENCIA_PEDIDO_MS`, 10 s) y no abre la guía.
- `GuiaEmbudoPestana.test.tsx`: S10 (entrar después a Embudos no abre la guía sola) y S11 (con el arranque automático encendido, el pedido vencido no lo frena). Las pruebas del seguimiento llevan su número, de S1 a S9, sin cambiar lo que comprueban.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| Rojo contra el motor de `ce878289f` (`main` con la #418) | FALLÓ, como se esperaba: 1 de 28 (S10) |
| Con el arreglo | PASÓ: 28 de 28 |
| 12 mutantes, de a uno, con base verde | PASÓ: 12 de 12 muertos, todo restaurado. En la primera tanda MB1 quedó vivo: S1 volvía a Embudos después de los 10 s y la tapaba el vencimiento; ahora vuelve antes |
| Suite de la guía con `guia-se-queda` (11 archivos, 1 worker) | PASÓ: 186 de 186 |
| `tsc --noEmit` y ESLint de los 2 archivos | PASÓ |
| `check-numbering`, `build-docs-index --check` y `git diff --check` | PASÓ |
| `pnpm verify` y la página real | NO EJECUTADO |

S11 no tiene rojo previo: sobre `ce878289f` también pasa, porque allí el arranque automático reabría la guía detrás del pedido. Comprueba que el pedido vencido se borra y no solo se ignora, y lo mata MVe2.

## COMMITS

Ver la PR. Commits selectivos con `git commit -F`.

## PR / BRANCH

`claude/0589-p13-pedido-vencido` → `main`, en borrador.

## PENDIENTES DE ESTA TAREA

- `pnpm verify` y la página real: NO EJECUTADO. El portón es el CI «Calidad continua».
- Al fusionar: limpiar este worktree y su rama, con evidencia.

## FUERA DE ALCANCE DETECTADO

- Ninguno nuevo.

## HANDOFF AL DIRECTOR

- Solo cambia el motor de la guía y su prueba. Fusionar no enciende nada (D11).
- `p13-seguimiento`, el árbol de la #418, se limpió desde esta sesión después de moverla aquí. El de la #416 (`laughing-mclaren-33178a`) lo limpia el Subdirector.
