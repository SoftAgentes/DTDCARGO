# Handoff — SDD-0686 · Color de acción azul en web, Portal y ERP

- Fecha: 2026-11-20
- Owner: Worker «Rebrand Design» (Claude Code), bajo el Director General
- Worktree: `.claude/worktrees/rebrand-design-aa6ba9`
- Rama: `claude/sdd-0686-color-accion-azul` (parte de `claude/rebrand-design-aa6ba9` más `origin/main` `2ea18799a`)
- SDD: `docs/specs/0686-rebrand-color-accion-azul/spec.md`, estado `in-progress`. Reserva del Director: `codex/sdd-reserve-0686` (`c20842933`).
- Aprobación: Sam, 2026-11-20, a «¿Apruebas la spec de la SDD-0686 para empezar con las fases 0 y 1?»: «Sí, empieza». Cubre implementar las fases 0 y 1; no cubre fusionar ni publicar.
- Estado de tarea: **fase 0 escrita; fase 1 sin empezar.** Sin push, sin PR.
- Permisos: commits locales selectivos. Push y PR, con orden del Director. Sin merge, sin producción, sin base de datos.

## OBJETIVO ORIGINAL

Sam decidió el 2026-11-20 pasar el color de acción del vino al azul en web, Portal y ERP, porque el vino se lee como negativo o «borrar». Citas literales en la spec, §1.

## COMPLETADO

- Rama propia creada desde la de análisis y puesta al día con `origin/main` (merge limpio, 49 commits).
- Spec real con BD-076 (número del Director General) y la condición de publicación entre las fases 1 y 2 (§8.1).
- **Fase 0 (documentos):**
  - `docs/design/studio/_norte/BRAND-DECISIONS.md`: entrada BD-076, enmienda de color en BD-037, cierre previsto de EXC-0654-01 y filas del índice.
  - `BRAND.md`: fila «Acción» separada de «Marca»; sección «Azul de acción, rojo de peligro, vino de identidad»; tokens de acción en claro y oscuro; vino como identidad; el azul de acción no es alerta; par de relleno del botón principal; `--wine-text` reservado a identidad; badge `wine` en revisión; cierre previsto de EXC-0654-01.
  - VIS-01 v1.1 (§3 roles, distancia de tono acción/peligro ≥ 90°, nota de adopción) y BTN-01 v1.2 (§2), con sus filas en `docs/governance/README.md` y la cápsula regenerada.
  - Nota de enmienda local al tope de §Sistema de color del Norte (`_norte/CLAUDE.md`), como en SDD-0441.
  - `app/studio/CLAUDE.md`: `primary` en azul de acción, regla para código nuevo y badge `wine` en revisión.
- **Observaciones de la revisión de la PR #715**, traídas aquí por orden del Director: handoff de análisis cerrado con su PR, borrador enlazado a las tres specs y «acciones sobre varias filas» en lugar de «acciones por lote».

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `docs:check` (con `node scripts/build-docs-index.mjs --check`) | **PASÓ** |
| `sdd:check` (con `node scripts/check-numbering.mjs`) | **PASÓ** |
| `governance:check` (con `node scripts/build-governance-capsule.mjs --check`) | **PASÓ** (29 políticas), tras regenerar la cápsula |
| Pruebas que lean el texto cambiado | Ninguna lee `BRAND.md`, BTN-01, VIS-01 ni las guías: búsqueda en `*.test.*` y `scripts/` |
| `verify`, vitest, build | **NO EJECUTADO**: la fase 0 es solo documentos; la fase 1 lo necesita, con turno de PC del Director |
| Imagen de prueba y recorrido visual | **NO EJECUTADO** |

## PENDIENTE DE ESTA TAREA

1. Fase 1: tokens `--accion*`, `studio.css` y contratos (`color-accion-contract.test.ts` nuevo). Turno de PC pedido al Director.
2. Imagen de prueba para que Sam fije el tono.
3. Fases 2 a 5, cada una con su allowlist y su PR. **Condición de publicación (spec §8.1):** entre la fase 1 y el final de la fase 2 no se publica ni se fusiona a `main`, salvo que la pantalla quede coherente.
4. Decisiones abiertas de Sam: tono exacto, color del Shipping Mark, correos/PDF/Chatwoot y el badge `wine` (spec §10).

## FUERA DE ALCANCE DETECTADO

- Si la PR #715 entra a `main` por **squash**, esta rama tendrá conflictos de «añadido en los dos lados» en los cuatro archivos del análisis que corrige. Se resuelven tomando la versión de esta rama. Con merge normal no hay conflicto.
- Los enlaces del borrador a las specs 0687 y 0688 no resuelven hasta que esas specs lleguen a `main`.
- `BRAND.md:33` dice que el logo `mono-light` va «sobre wine, CTAs, alertas». Desde BD-076 los CTA son azules; no lo cambié porque es una regla del logo y Sam no autorizó cambios de logo. Hay que confirmarlo al ver la imagen de prueba.
