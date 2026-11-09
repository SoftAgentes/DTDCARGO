# Handoff — SDD-0621: el CI de PR no corre en borrador

- Task ID / owner: 0621-ci-sin-borradores / Worker Claude, sesión hija de `local_3a2c01d2-13d4-492f-bf01-00ec331ce449`.
- Rama / worktree: `claude/zen-goodall-a57a03` en `.claude/worktrees/zen-goodall-a57a03`, base `origin/main` 793ee2c17.
- SDD: [docs/specs/0621-ci-sin-borradores/spec.md](../../docs/specs/0621-ci-sin-borradores/spec.md), `in-progress`.
  Reserva local `refs/dtd/reservations/0621` y `codex/sdd-reserve-0621-ci-sin-borradores` (b150060a4), **sin
  publicar**; el stub entró por cherry-pick (8a1539b68).
- Fecha: 2026-11-09.

## Qué cambia

- `quality.yml`, `kommo-historial-cargador.yml`, `portal-historial-cargador.yml`:
  `pull_request: types: [opened, synchronize, reopened, ready_for_review]` y en el job
  `if: github.event_name != 'pull_request' || !github.event.pull_request.draft`. Se conservan `branches: [main]`,
  los `paths`, la concurrencia y todos los pasos. Push a main y `workflow_dispatch` corren siempre.
- `scripts/__tests__/ci-workflow-contract.test.mjs`: bloque SDD-0621 con `assertNoCorreEnBorrador` y mutantes; los
  cuatro asertos de obligatoriedad (0444, 0450, unitarios, 0550) aceptan solo la condición exacta del borrador.
- Regla del portón en `docs/runbooks/codex-engineering.md` (sección «PR e integración») y una línea en las skills
  Worker y Director: el CI corre al marcar la PR lista con `gh pr ready <n>`.

## Evidencia

| Comprobación | Resultado |
|---|---|
| `vitest run scripts/__tests__/ci-workflow-contract.test.mjs` | PASÓ, 67/67 |
| Control: los tres workflows de `origin/main` con el contrato nuevo | 4 rojos de 66 (los 3 casos «salta en borrador» y «un tipo de más»); restaurados, 66/66 (antes del caso del runbook) |
| `vitest run infra/ops/tests/publicable.test.mjs` (el vigilante lee corridas de `quality.yml`) | PASÓ, junto con el contrato: 108/108 |
| `publicable.test.mjs`, caso nuevo: corrida `skipped` de borrador no es verde para publicar | PASÓ 42/42; mutante sin el filtro `conclusion === "success"`: 2 rojos |
| Corrida con su único job saltado por `if:` (run 42426458584, `publicable.yml`) | medido: `completed / skipped`, job `skipped` |
| `pnpm docs:check` / `pnpm sdd:check` / `pnpm governance:check` | PASÓ / PASÓ / PASÓ |
| `node scripts/check-skills-manifest.mjs` | PASÓ |
| `pnpm harness:test` | PASÓ, 240 pass, 0 fail, 5 skipped (no revisé cuáles; no tocan esta tarea) |
| `eslint` del archivo de contrato | PASÓ |
| `pnpm verify` completo | NO EJECUTADO: el diff es solo workflows, una prueba de contrato, docs y skills. El portón es el CI de GitHub |
| Comportamiento real en GitHub (`skipped` en borrador, corrida tras `gh pr ready`) | NO DISPONIBLE: Actions bloqueado por facturación desde 2026-11-09 03:36Z |

Ruleset de main consultado (solo metadatos): 22364692 «DTD main - PR y calidad obligatoria», exige el check
«Calidad local sin secretos» (`integration_id` 15368) con política estricta.

## Para quien fusiona y para los vigías

- **Un check `skipped` de un borrador no es un rojo.** Los vigías que cuentan como fallo cualquier corrida
  `completed` distinta de `success` sobre la cabeza tienen que ignorar `skipped` (lo ajusta el Director General).
- **Tampoco es un verde.** El ruleset cuenta el `skipped` como aprobado, así que entre `gh pr ready` y el registro de
  la corrida nueva la PR puede verse fusionable sin CI real. Regla: **success de una corrida `pull_request` sobre la
  cabeza exacta, creada después del `ready_for_review`**. Está en el comentario del job, en el runbook y el contrato
  falla si se pierde.
- Trenes del Director General: se abren en borrador y se marcan listos con `gh pr ready`; ahí corre la Calidad. No
  hay excepción por nombre de rama.

## Pendientes de esta tarea

- [ ] Cuando vuelva Actions: push de la rama y PR en borrador a main. Verificar que en borrador «Calidad continua»
      sale `skipped`, marcar con `gh pr ready` y comprobar que corre completa y que el ruleset toma esa corrida
      (inferencia de la spec por medir). Avisar al Director General (`local_25e2dded-103b-4eaa-b10e-6527564b9cad`)
      para la revisión independiente.
- [ ] Publicar la reserva 0621 (`git push --no-follow-tags --force-with-lease=refs/heads/codex/sdd-reserve-0621: origin b150060a4000eb1ab79e8a5575b7826eeb04ca6d:refs/heads/codex/sdd-reserve-0621`) o dejar que la PR la lleve.
- [ ] Al fusionar: aceptación pendiente en la spec («primera PR real»).

## Impacto documental

- Guardado en la tarea: spec 0621, runbook `codex-engineering.md`, skills Worker y Director, índice de specs.
- Graphify/Obsidian: sin cambios en esta rama; el Director lo revisa al integrar.

## FUERA DE ALCANCE DETECTADO (opciones para Sam, no implementadas)

1. **Quitar «Calidad continua» del push a main**: ~3.002 min en 9 días, repite lo que ya probó la PR (con política
   estricta, la PR ya corrió contra main al día). Ojo: el vigilante de publicación
   (`infra/ops/web/publicable.mjs`, `corridasExitosas`) busca corridas `push` en verde de `quality.yml` para mover
   `:publicable`; antes habría que cambiar esa fuente a la corrida de la PR fusionada.
2. **Runner propio** en una máquina aparte (nunca en el VPS de producción): los minutos de un runner self-hosted no se
   cobran. Cuidado con un repo con PR de terceros y con dejar Docker y secretos al alcance de los jobs.
3. Medir cuánto baja el gasto en la semana siguiente con la misma consulta de corridas (solo metadatos).
