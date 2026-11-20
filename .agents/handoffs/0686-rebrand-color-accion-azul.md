# Handoff — SDD-0686 · Color de acción azul en web, Portal y ERP

- Fecha: 2026-11-20
- Owner: Worker «Rebrand Design» (Claude Code), bajo el Director General
- Worktree: `.claude/worktrees/rebrand-design-aa6ba9`
- Rama: `claude/sdd-0686-color-accion-azul` (parte de `claude/rebrand-design-aa6ba9` más `origin/main` `2ea18799a`)
- SDD: `docs/specs/0686-rebrand-color-accion-azul/spec.md`, estado `proposed`. Reserva del Director: `codex/sdd-reserve-0686` (`c20842933`).
- Estado de tarea: **spec escrita; ninguna fase implementada.** Sin push, sin PR.
- Permisos: commits locales selectivos. Push y PR, con orden del Director. Sin merge, sin producción, sin base de datos.

## OBJETIVO ORIGINAL

Sam decidió el 2026-11-20 pasar el color de acción del vino al azul en web, Portal y ERP, porque el vino se lee como negativo o «borrar». Citas literales en la spec, §1.

## COMPLETADO

- Rama propia creada desde la de análisis y puesta al día con `origin/main` (merge limpio, 49 commits).
- Spec real de la SDD-0686: regla, BRAND-CHECK, valores propuestos con contraste medido, reparto del vino, seis fases, allowlist de las fases 0 y 1, aceptación con contrato y mutantes, gate VIS-01 y pendientes de decisión.
- Índice de specs regenerado (`docs/specs/README.md`).

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `docs:check` (con `node scripts/build-docs-index.mjs --check`) | **PASÓ** (668 specs) |
| `sdd:check` (con `node scripts/check-numbering.mjs`) | **PASÓ** |
| `governance:check`, `verify`, vitest, build | **NO EJECUTADO**: todavía no hay cambio de producto ni de políticas. Requieren `pnpm install` en este worktree, con aviso al Director |
| Imagen de prueba y recorrido visual | **NO EJECUTADO** |

## PENDIENTE DE ESTA TAREA

1. Fase 0: BD-076 (número del Director General; BD-071, 074 y 075 están tomadas fuera del registro y 072-073 son huecos que no se reutilizan), `BRAND.md`, VIS-01 §3, BTN-01 §2, nota de enmienda del Norte y `app/studio/CLAUDE.md`.
2. Fase 1: tokens `--accion*`, `studio.css` y contratos (`color-accion-contract.test.ts` nuevo).
3. Imagen de prueba para que Sam fije el tono.
4. Fases 2 a 5, cada una con su allowlist y su PR. **Condición de publicación (spec §8.1):** entre la fase 1 y el final de la fase 2 no se publica ni se fusiona a `main`, salvo que la pantalla quede coherente.
5. **Observaciones menores de la revisión independiente de la PR #715** (aprobada sobre `d10f228c2`; por orden del Director no se corrigen allí, se llevan a la PR de esta SDD):
   - Actualizar `.agents/handoffs/rebrand-design-evaluacion-ant-design.md:8-10`: dice «sin push, sin PR» y cita una base vieja; ya existe la PR #715.
   - Enlazar las reservas 0686, 0687 y 0688 desde `docs/design/rebrand-erp/borrador-sdd-rebrand-sistema.md` al adoptar el borrador.
   - Cambiar «acciones por lote» por «acciones sobre varias filas» en `docs/design/rebrand-erp/checklist-y-color.md:127` y `docs/design/rebrand-erp/evaluacion-carbon.md:44`.
6. Decisiones abiertas de Sam: tono exacto, color del Shipping Mark, correos/PDF/Chatwoot y el badge `wine` (spec §10).

## FUERA DE ALCANCE DETECTADO

- El inventario y el análisis previo viven en `docs/design/rebrand-erp/` (rama de análisis, incluida en esta rama). Si esa rama se integra por su propia PR antes, esta PR mostrará solo su delta.
- SDD-0687 (cifras) y SDD-0688 (simetría) no se empiezan hasta cerrar el camino de la 0686, por orden del Director.
