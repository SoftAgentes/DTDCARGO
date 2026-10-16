---
sdd: "0545"
title: "sdd:next --reserve: --expect, --number y aviso de hueco reciente"
status: in-progress
author: "Sam (founder) + Claude Code"
created: 2026-10-16
updated: 2026-10-16
supersedes: null
superseded_by: null
related: ["0444", "0539"]
confidencialidad: interno
---

# SDD-0545 · `sdd:next --reserve`: `--expect`, `--number` y aviso de hueco reciente

## Pedido

Sam, 2026-10-16: «Haz esta tarea aquí: “sdd:next --reserve: avisar cuando el número cambia”».
Es el seguimiento que propuso el Worker de la [SDD-0539](../0539-transportistas-lote-y-auditoria/spec.md).

El Director asignó la 0545, sin migración, y aprobó el alcance:

- `--expect NNNN` cancela sin crear refs;
- el inventario avisa cuando el número salta un hueco;
- no se cambia a «primer hueco».

Al ver el caso de la 0543, sumó `--reserve <slug> --number NNNN` con tres reglas:

- sólo toma el número si está libre en el inventario completo;
- si no está libre, cancela sin crear nada;
- no se combina con `--expect`.

## Estado medido antes del cambio (`main` `dc84d94f`)

- `scripts/next-number.mjs` reserva con `nextFree(taken) = Math.max(...taken) + 1`, el máximo + 1
  de todo el inventario (refs, ramas, reservas, PR abiertas y archivos sin commit de los
  worktrees).
- No hay forma de decir qué número se espera. Tampoco hay CLI para reservar un número asignado:
  se hace a mano con `prepareReservation`.
- **Caso del 2026-10-16:**
  1. `sdd:next` sin reservar dijo 0539;
  2. otra sesión reservó la 0540 a las 03:06:52 −04:00;
  3. el `--reserve` de las 03:07:38 −04:00 sacó la **0541** sin avisar y dejó la 0539 de hueco;
  4. el Director autorizó a mano el descarte de la 0541, y la 0539 se reservó con
     `prepareReservation`.
- **Caso del mismo día, más tarde:** el Director tenía asignada la 0543 a una sesión en modo
  plan. Ninguna ref, rama, worktree ni PR la nombraba, y el inventario no lo mostraba en ningún
  lado.

## Decisión

1. **`--expect NNNN`** (sólo con `--reserve`). Si el número que tocaría no es `NNNN`, cancela
   antes de crear refs y explica por qué:
   - el esperado ya está ocupado, y por quién;
   - es un hueco que `--reserve` no usa;
   - o es mayor que el siguiente.

   Además nombra quién tiene los números intermedios.
2. **`--number NNNN`** (sólo con `--reserve`, no con `--expect`). Reserva un número asignado por
   el Director cuando cumple dos condiciones:
   - está libre en todo el inventario;
   - no pasa del siguiente, porque un número mayor dejaría un hueco nuevo.

   Si no las cumple, no crea nada. Si otra sesión toma el mismo número después del inventario, el
   lock numérico create-only de `prepareReservation` hace fallar entera a la segunda.
3. **`ADVISORY hueco reciente`.** El inventario nombra los números libres que hay entre lo
   integrado en `origin/main` y el siguiente. No repite los huecos históricos por debajo de lo
   integrado, que ya están en el índice de specs. Sin `origin/main`, no hay aviso.
4. **`--reserve` sigue tomando el máximo + 1.** Un hueco puede ser una reserva abandonada («no
   reutilices números de reservas abandonadas»): usarlo es una decisión del Director, por eso va
   con `--number`.
5. **Errores de uso** cancelan sin crear nada:
   - `--expect` o `--number` sin `--reserve`;
   - los dos juntos;
   - un número que no tenga 4 dígitos, o la 0000;
   - un flag repetido.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| AGENTS.md §Requisitos (numeración SDD) | cumplimiento | La reserva sigue siendo rama con stub, sin push a `main`. El Director sigue asignando, ahora con una forma de comprobar y de reservar lo que asignó. |
| Runbook `codex-engineering.md` §SDD | actualizado | El paso 3 documenta `--expect`, `--number` y el aviso. |
| Políticas de producto (AUD, MP, BTN…) | no aplica | Es un cambio sólo de harness: no toca producto, datos ni producción. |

## Allowlist

- `scripts/next-number.mjs`
- `scripts/tests/next-number.integration.node.mjs`
- `docs/runbooks/codex-engineering.md` (paso 3 de §SDD)
- `docs/specs/0545-sdd-next-reserva-esperada/spec.md`, `docs/specs/README.md`
- `.agents/handoffs/0545-sdd-next-reserva-esperada.md`

## Aceptación

1. Con `--expect`, si otra sesión reservó entre el inventario y la reserva, la reserva se cancela.
   No quedan lock, rama ni cambios en HEAD, índice o estado. Es la réplica del 16-10, con dos
   worktrees.
2. Dos reservas casi simultáneas desde worktrees distintos, con el mismo `--expect`: una gana y
   la otra no deja nada.
3. `--number` libre reserva ese número. Se cancela sin crear nada en cuatro casos:
   - el número lo ocupa una reserva;
   - lo ocupa un archivo sin commit de otro worktree;
   - pasa del siguiente;
   - dos reservas casi simultáneas piden el mismo número (gana una).
4. El inventario avisa del hueco reciente y no repite los históricos.
5. Las 8 pruebas que ya tenía el script siguen pasando.

## Verificación (2026-10-16, en el worktree)

- `scripts/tests/next-number.integration.node.mjs`: 21/21. Son las 8 de antes y 13 nuevas, en
  repositorios Git temporales con worktrees de verdad.
- Las dos pruebas concurrentes pasaron 6 de 6 corridas seguidas.
- El control rojo y los mutantes van en el handoff.
- En el repositorio real, en modo inventario (`--no-fetch`), el aviso encontró la 0543 libre
  entre la 0542 integrada y la siguiente. El Director confirmó que estaba asignada a una sesión
  en modo plan, sin reserva todavía.

## Estado

Implementada en la PR de esta spec, en borrador y sin fusionar. El merge lo hace el Director:
desde el 2026-10-16 cada merge se publica solo.
