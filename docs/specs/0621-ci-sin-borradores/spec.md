---
sdd: "0621"
title: "El CI de PR no corre en borrador: corre al marcar la PR lista"
status: in-progress
author: Claude (Worker)
created: 2026-11-09
updated: 2026-11-09
supersedes: null
superseded_by: null
related:
  - SDD-0349
  - SDD-0444
  - SDD-0550
  - SDD-0586
  - SDD-0590
confidencialidad: interno
---

# SDD-0621 — El CI de PR no corre en borrador

## Estado real (medido el 2026-11-09)

Medición con la API de corridas de Actions (solo metadatos), del 2026-11-01 al
2026-11-09: 1.000 corridas y unos 19.185 minutos.

| Workflow / evento | Corridas | Minutos |
|---|---|---|
| «Calidad continua» en `pull_request` | 466 (150 canceladas) | ~13.248 |
| «Calidad continua» en `push` a main | — | ~3.002 |
| Cargadores Kommo y portal (`pull_request`) | — | ~2.100 |

Cada corrida de calidad en PR dura unos 28 min; el paso Unitarios se lleva 25,6
de ~32 min en el runner de 2 vCPU (run 42555105808). Los agentes abren la PR en
borrador y empujan muchas veces; cada push lanza una corrida completa y cancela
la anterior (`cancel-in-progress`), así que 150 corridas se pagaron a medias sin
dar resultado. El repositorio es privado en una cuenta personal: los minutos se
cobran, y Actions quedó bloqueado por facturación el 2026-11-09 a las 03:36Z.

El portón de fusión (desde el 2026-11-07) es «Calidad continua» en verde sobre la
cabeza exacta más revisión independiente. Ese portón se mide con la PR lista; las
corridas en borrador no lo alimentan.

## Decisión

1. `quality.yml`, `kommo-historial-cargador.yml` y `portal-historial-cargador.yml`
   declaran `pull_request: types: [opened, synchronize, reopened, ready_for_review]`.
   `ready_for_review` no está entre los tipos por defecto: sin él, pasar la PR a
   lista no lanzaría ninguna corrida sobre su cabeza.
2. El job lleva exactamente
   `if: github.event_name != 'pull_request' || !github.event.pull_request.draft`.
   En borrador el job sale `skipped` y no se factura; `push` a main y
   `workflow_dispatch` corren siempre.
3. Se conservan `branches: [main]` de quality, los `paths` de los cargadores, la
   concurrencia y todos los pasos.
4. Regla de proceso (runbook `codex-engineering.md`, skills Worker y Director):
   el CI corre al marcar la PR lista con `gh pr ready <n>`; un check `skipped`
   no es verde.

## Contrato

`scripts/__tests__/ci-workflow-contract.test.mjs`:

- `assertNoCorreEnBorrador` exige los cuatro tipos exactos, `workflow_dispatch` y
  la condición exacta del job en los tres workflows.
- Mutantes rechazados: sin `ready_for_review`, sin `synchronize`, sin `types`, un
  tipo de más, sin `workflow_dispatch`, condición quitada, invertida, `false`,
  solo en PR (salta el push a main) y `continue-on-error`.
- Los asertos de obligatoriedad previos (SDD-0444, SDD-0450, unitarios,
  SDD-0550) seguían rechazando cualquier `if` en el job. Ahora aceptan solo la
  condición exacta de borrador; siguen rechazando `false`, «solo en push» y la
  invertida (casos nuevos), y los mutantes que ya tenían.
- Un caso exige que el runbook conserve la regla para fusionar tras el `skipped`
  y que el comentario de `quality.yml` la repita.
- `infra/ops/tests/publicable.test.mjs`: el vigilante de publicación acepta como
  verde de la PR una corrida `pull_request` de `quality.yml`
  (`infra/ops/web/publicable.mjs`, `evaluarCommit`). Un caso nuevo exige que la
  corrida saltada de un borrador (`conclusion: skipped`) no cuente. Medido: una
  corrida cuyo único job se salta por `if:` termina `completed / skipped`, y el
  job también (run 42426458584 de `publicable.yml`). Mutante: quitar el filtro
  `conclusion === "success"` da 2 rojos; restaurado, 42/42.
- Control: con los tres workflows de `origin/main` (793ee2c17) el bloque nuevo da
  4 rojos de 66; con el cambio y la regla del runbook, 67/67.

## Riesgos y límites

- **Ruleset de main.** El ruleset 22364692 («DTD main - PR y calidad
  obligatoria», consultado el 2026-11-09) exige el check «Calidad local sin
  secretos» (`integration_id` 15368, GitHub Actions) con política estricta. Un
  job saltado por `if:` deja ese check concluido como `skipped`, que GitHub cuenta
  como aprobado: no queda **pendiente para siempre** en un borrador, y el
  borrador no se puede fusionar de todos modos. Al marcarla lista, el evento
  `ready_for_review` crea una corrida nueva sobre la misma cabeza; mientras corre,
  el check está pendiente y el merge queda bloqueado hasta el `success`.
  INFERENCIA por verificar en la primera PR real: que el ruleset tome la corrida
  más reciente del check y no el `skipped` anterior.
- **Riesgo conocido: la ventana del `skipped`.** Si GitHub cuenta el `skipped`
  del borrador como aprobado, entre `gh pr ready` y el registro de la corrida
  nueva la PR puede verse «verde» y fusionarse sin CI real. Regla para quien
  fusiona: **`success`, no `skipped`, del check requerido, en una corrida
  `pull_request` sobre la cabeza exacta**. (La primera redacción, «creada
  después del `ready_for_review`», no servía para una PR abierta ya lista, que
  nunca pasa por ese evento.) Manda la corrida **más reciente** de
  `pull_request` de `quality.yml` sobre la cabeza:
  `gh api "repos/SoftAgentes/DTDCARGO/actions/workflows/quality.yml/runs?head_sha=<sha>&event=pull_request" --jq '.workflow_runs | max_by(.id) | [.status, .conclusion, .check_suite_id] | @tsv'`.
  Vale solo `completed` + `success`; si una `success` vino antes de una
  `failure`, manda la `failure`. `event=pull_request` deja fuera una corrida
  manual sobre la misma cabeza. La primera versión de este seguimiento leía
  `commits/<sha>/check-runs?check_name=…` y decía que el filtro `latest` traía la
  corrida más reciente: es falso. Cada corrida es una check suite distinta y
  `latest` no las junta; en `d41e1e45c` (#484) trajo 2 filas, el `skipped` del
  borrador y la posterior `in_progress` (medido el 2026-11-09).
  `gh pr checks` tampoco basta: en la #484 en borrador mostró «skipping» y salió
  con 0 (medido). La regla está en el comentario del job en `quality.yml`, en el
  runbook `codex-engineering.md` y en la skill Director. El contrato extrae el
  comando del runbook y exige `event=pull_request`, `max_by(.id)` y el endpoint
  de corridas de `quality.yml`, con un mutante para cada uno; la skill no la
  cubre el contrato.
- **Re-ejecutar no rescata el `skipped`.** La re-ejecución de una corrida usa el
  evento original, con `draft: true`, y vuelve a saltar. Remedio: un push nuevo
  con la PR lista, o `gh pr ready <n> --undo` y `gh pr ready <n>`.
- **Vigías.** Una corrida `skipped` de un borrador no es un rojo. Los vigías que
  cuentan como fallo cualquier `completed` distinto de `success` tienen que
  ignorar `skipped` (ajuste del Director General).
- Los trenes de integración del Director General (PR en borrador que necesitan su
  CI completo) siguen la misma regla: se abren en borrador, se marcan listos con
  `gh pr ready` y ahí corre la Calidad. No se agregó una excepción por nombre de
  rama (`claude/tren-*`): un solo camino, el mismo para todos.
- Si Actions está bloqueado al marcar la PR lista, se espera que la corrida salga
  con error de facturación y no `skipped` (INFERENCIA, no medida). Si no se crea
  corrida, el último check de la cabeza sería el `skipped` del borrador: el
  Director no fusiona sin una corrida `success` de `pull_request` posterior al
  `ready_for_review`.
- Si una PR vuelve a borrador con una corrida en curso y se empuja, la corrida
  nueva (saltada) cancela la anterior por concurrencia. Es lo deseado.
- **Carrera de concurrencia entre `synchronize` en borrador y `ready_for_review`.**
  La concurrencia es por rama (`quality-<workflow>-<ref>`, `cancel-in-progress`),
  sin distinguir borrador de lista. Si se empuja con la PR en borrador y casi a
  la vez se marca lista, salen dos corridas sobre la misma cabeza: la de
  `synchronize`, con `draft: true` (saltará), y la de `ready_for_review` (real).
  GitHub no garantiza el orden en que entran a la cola. Si la de `synchronize`
  entra segunda, cancela a la real y la cabeza queda solo con un `skipped`, que
  el ruleset da por aprobado. La regla de arriba lo atrapa (no hay `success`) y
  el remedio es el mismo: push nuevo, o `--undo` y `ready`. **Ya pasó:** en
  `3c777e33e` (#482) la corrida 42594555574 (`skipped`, 09:35Z) dejó `cancelled`
  la 42593482952 (09:26Z). El runbook dice: marcar la PR lista después de que
  aparezca la corrida del push, o esperar a que el `skipped` termine. Opción
  propuesta, no implementada: sumar el estado de borrador al grupo de
  concurrencia (`…-${{ github.event.pull_request.draft }}`), para que una corrida
  de borrador no cancele nunca a una de PR lista. Costo: si una PR lista vuelve a
  borrador y se empuja, su corrida en curso ya no se cancela y termina gastando.
- La corrida manual (`gh workflow run quality.yml --ref <rama>`) prueba la rama
  sola, no la fusión con main: no reemplaza la de la PR.
- No toca producción, Vercel, secretos ni la corrida en push a main.

## Fuera de alcance (opciones para Sam)

- Quitar «Calidad continua» del push a main (~3.002 min en 9 días; repite lo que
  ya probó la PR). Lo usa el vigilante de publicación (`infra/ops/web/publicable.mjs`
  busca corridas `push` en verde de `quality.yml`), así que exige cambiar esa
  fuente antes.
- Runner propio en una máquina aparte, nunca en el VPS de producción.
- `sql-tests.yml`, `chatwoot-correo-sistema.yml` y `chatwoot-portal-poc.yml`
  siguen corriendo en borradores (no se tocaron en esta SDD).

## Aceptación

- [x] Los tres workflows con los tipos y la condición.
- [x] Contrato con mutantes y control contra main.
- [x] Regla documentada en runbook y skills.
- [x] Primera PR real (#484, `d41e1e45c`): en borrador la corrida 42593499007
      salió `completed / skipped` y su check run también; `gh pr ready` lanzó la
      42593601563 sobre la misma cabeza.
- [ ] Una corrida posterior al `ready_for_review` termina en `success` y el
      ruleset deja fusionar con ella (no con el `skipped`).
