# Handoff · carril.mjs: ciclos de imports exactos

- Fecha: 2026-11-21 · Owner: Worker `local-carriles-integracion-305dae` · Encarga: Dir_DTD.
- Worktree: `DTD-worktrees/carril-ciclos-memo` · Rama: `codex/carril-ciclos-memo`.
- Base: `origin/main` `d414f5e2de7ce065c4a04ebe875d539f7c5c9623` (la #730 ya fusionada).
- SDD: no aplica. Es harness (el clasificador del tren), no comportamiento del Studio.
- Carril: con revisión previa, porque toca `scripts/carril.mjs`.
- Estado de la tarea: lista-para-revision.

## OBJETIVO ORIGINAL

Corregir el hallazgo bajo de la quinta revisión de la #730. En el recorrido de imports de `cargarContenido`, la
memoria de `sensible()` guardaba como limpio (`null`) un nodo cuyo ciclo seguía abierto. Con
`Uno → MA → [MB, MS]`, `MB → MA` y `MS → expense-posting`, si `Uno` se clasificaba primero, `Dos` (que solo
importa `MB`) salía `rapido`. El carril de la PR no cambiaba, porque la raíz daba `revision`, pero el carril por
archivo de `archivos[]` salía mal y eso ensucia la medición de la semana.

## COMPLETADO

- `sensible()` ya no es una recursión con memoria. Ahora es alcanzabilidad: se siembran los nodos sensibles por sí
  mismos (y los que quedaron cortados por el tope) y se propaga hacia atrás, por las aristas invertidas, con un solo
  recorrido en anchura. El resultado es exacto con ciclos, no depende del orden de las pantallas y la cadena del
  motivo es la más corta.
- Cada nodo guarda su `ref`, para armar las aristas sin depender del orden.
- Dos pruebas nuevas en `scripts/tests/carril.node.mjs`:
  - el caso exacto del revisor, en los dos órdenes y con `Dos` solo;
  - un ciclo de tres módulos en el que el resultado por archivo es el mismo juntos y por separado.

## VALIDACIÓN

| Comprobación | Alcance | Resultado |
|---|---|---|
| `node --test scripts/tests/carril.node.mjs` | rama | PASÓ (199/199) |
| La prueba del caso del revisor contra el código anterior (stash del arreglo) | `scripts/carril.mjs` de `d414f5e2d` | FALLÓ, como debía: reproduce el `rapido` falso |
| Conteo del árbol completo | `HEAD` | 128 pantallas en rápido, igual que antes. Tarda 1,4 s (antes, unos 3 s) |
| `node scripts/carril.mjs --json --pr 721` con git real | PR #721 | revision (15 de 36), igual que antes |
| `node scripts/build-docs-index.mjs --check` y `git diff --check` | rama | PASÓ |
| `pnpm lint` / `pnpm verify` | — | NO EJECUTADO: sin `node_modules` ni turno de PC; los cubre el CI al marcar la PR lista |

## COMMITS

- El commit que contiene este documento: el arreglo, las pruebas y este handoff.

## PR / BRANCH

- Rama `codex/carril-ciclos-memo`, con base `main`. El número de la PR va en el aviso a Dir_DTD.

## PENDIENTES DE ESTA TAREA

- La revisión independiente (la lanza Dir_DTD) y el CI verde en la cabeza.

## FUERA DE ALCANCE DETECTADO

- Ninguno nuevo.

## HANDOFF AL DIRECTOR

- Impacto documental: el runbook no cambia. Describe el recorrido con ciclos como «se detectan y no cuelgan», y
  eso sigue siendo cierto. El contrato JSON del tren tampoco cambia.
- Libero el claim al terminar.
