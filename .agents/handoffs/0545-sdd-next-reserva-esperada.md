# Handoff 0545 · `sdd:next --reserve`: `--expect`, `--number` y aviso de hueco reciente

- Fecha: 2026-10-16 (Caracas = UTC − 4)
- Owner/sesión: `suspicious-mestorf-43ae11` (Claude Code, Worker). Claim tomado al empezar y liberado
  al cerrar.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/sdd-next-reserva-esperada`, creado
  con `harness-worktree start`. El de la 0539 no se tocó.
- Rama: `codex/sdd-next-reserva-esperada`, base `origin/main` `dc84d94f`
- SDD: [0545](../../docs/specs/0545-sdd-next-reserva-esperada/spec.md), `in-progress`, sin migración.
- Reserva 0545: commit `b04fe755`, `refs/dtd/reservations/0545` y
  `codex/sdd-reserve-0545-sdd-next-reserva-esperada`, local y sin publicar. El inventario de las 16:31Z
  dio «spec siguiente: 0545» y la reserva coincidió.
- Autorizaciones:
  - Sam: «Haz esta tarea aquí».
  - Director: confirmó la 0545 y el alcance (`--expect` cancela sin crear refs, aviso de hueco, sin
    «primer hueco»). Después, ante el caso de la 0543, sumó `--number` con sus reglas y sus cuatro
    pruebas, y pidió no tocar la 0543.
- Permisos usados: commits locales, push de mi rama a sí misma y la PR en borrador contra `main`. El
  merge lo hace el Director: desde el 2026-10-16 cada merge se publica solo.
- No toqué producción, ni la 0543, ni las reservas de otros.

## OBJETIVO ORIGINAL

Que `sdd:next --reserve` deje de pisar reservas casi simultáneas sin avisar. El caso del 16-10:
`sdd:next` dijo 0539, otra sesión reservó la 0540 y el `--reserve` siguiente sacó la 0541.

## COMPLETADO

- **`--reserve <slug> --expect NNNN`.** Si el que tocaría no es `NNNN`, cancela antes de crear refs.
  El mensaje dice por qué:
  - ocupado, y por quién;
  - un hueco que `--reserve` no usa;
  - o mayor que el siguiente.

  También nombra quién tiene los números intermedios.
- **`--reserve <slug> --number NNNN`**, con las reglas del Director:
  - sólo toma el número si está libre en todo el inventario (refs, ramas, reservas, PR abiertas
    traídas a `refs/dtd/pr/*`, `main` y archivos sin commit de los worktrees);
  - si no, no crea nada;
  - no se combina con `--expect`.
  - **Regla extra mía:** tampoco puede pasar del siguiente, porque dejaría un hueco nuevo. Si el
    Director no la quiere, es una línea (`numberUnavailable`).
- **`ADVISORY hueco reciente`.** Nombra los números libres entre lo integrado en `origin/main` y el
  siguiente. No repite los huecos históricos.
- **Sin cambios:** `--reserve` sigue tomando el máximo + 1, y el lock create-only sigue igual.
- **Errores de uso**, todos sin crear nada:
  - `--expect` o `--number` sin `--reserve`;
  - los dos juntos;
  - números que no tienen 4 dígitos, o la 0000;
  - flags repetidos.
- **Runbook** `docs/runbooks/codex-engineering.md`, §SDD paso 3: documenta lo anterior.

## VALIDACIÓN

| Comprobación | Resultado | Evidencia |
|---|---|---|
| `node --test scripts/tests/next-number.integration.node.mjs` | PASÓ | 21/21: las 8 de antes y 13 nuevas, con repositorios temporales y worktrees de verdad |
| Pruebas pedidas por el Director | PASÓ | Réplica del 16-10 con dos worktrees; dos reservas casi simultáneas con `--expect`; `--expect` no deja refs, rama ni cambios de HEAD, índice o estado. `--number` libre reserva y cancela con un número ocupado por reserva, ocupado por archivo sin commit de otro worktree, mayor que el siguiente, o pedido por dos reservas simultáneas. |
| Estabilidad de las dos pruebas concurrentes | PASÓ | 6 de 6 corridas seguidas |
| Control rojo contra `main` `dc84d94f` | PASÓ | Con el script de main caen 12 de las 13 nuevas. La de errores de uso pasa también en main, que ya rechazaba flags desconocidos; su valor lo prueban 4 mutantes. |
| Mutantes del diff de `next-number.mjs` | PASÓ | 18/18 muertos, leídos en TAP (`# fail N`). Control verde 21/21 antes y después. |
| `pnpm harness:test` (`run-harness.mjs`) | PASÓ | 24 archivos, 214/214 |
| `eslint` de los dos archivos | PASÓ | exit 0 |
| `pnpm docs:check` · `pnpm sdd:check` · `pnpm governance:check` | PASÓ | 529 specs; sin números repetidos; 28 políticas |
| `git diff --check` | PASÓ | exit 0 |
| `pnpm verify` completo | NO APLICA | cambio sólo de harness (AGENTS: pruebas de sus scripts y docs) |
| `pnpm knowledge:status` | NO DISPONIBLE | el worktree nuevo no tiene `graphify-out/`: sale `ok: false` por falta de derivados |

## COMMITS

- `47781bf2` chore(sdd): la reserva de SDD-0545 (cherry-pick de `b04fe755`)
- El commit del script y sus pruebas
- El commit de la spec, el índice, el runbook y este handoff

## PR / BRANCH

- `codex/sdd-next-reserva-esperada` contra `main`, PR en borrador. El enlace va en el aviso al
  Director.

## PENDIENTES DE ESTA TAREA

1. Que el Director revise y fusione.
2. Al fusionar, borrar la reserva local 0545 según `borrar-reservas-sdd-cumplidas`: el stub no se
   fusiona, y la seguridad es que la spec ya esté en `main`.

## Impacto documental y conocimiento

- Actualicé el runbook (§SDD paso 3), la spec 0545 y el índice generado.
- **Efecto del índice:** al regenerarlo aparecen la 0543 y la 0544 como «huecos», porque son reservas
  que todavía no están en `main`. Se corrige solo cuando entren.
- No toqué fuentes de `semanticPilot` ni del mapa Archify. Graphify lo actualiza el Director desde
  `main`.

## FUERA DE ALCANCE DETECTADO

1. **La 0543 no tenía reserva visible.** La asignó el Director a «Cargar los consolidados en camino»,
   que está en modo plan. El Director la avisa para que la reserve con `--number 0543`. No la toqué.
2. **El índice de specs llama «código sin spec o renumerado» a reservas en curso** (la 0543 y la
   0544). `scripts/build-docs-index.mjs` no distingue un hueco histórico de una reserva que todavía no
   entró.
3. **Ninguna PR de esta tarea publica la reserva** (`--push`). Hasta que la PR entre, otra máquina no
   ve la 0545. Es la práctica del repo, pero el aviso de hueco sólo ve lo que hay en este clon.

## HANDOFF AL DIRECTOR

- Revisar la PR en borrador y fusionar cuando convenga.
- Al reservar con el CLI nuevo:
  - el número que asignaste → `--number NNNN`;
  - el siguiente → `--expect NNNN`.
- Si quitas la regla «no pasa del siguiente» de `--number`, la prueba «--number por encima del
  siguiente» cambia con ella.
- No hay sesiones consumidoras de este worktree. Libero el claim al terminar.
