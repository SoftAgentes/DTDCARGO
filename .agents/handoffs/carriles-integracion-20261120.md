# Handoff · carriles de integración (pasos 1 y 2, contrato del paso 3)

- Fecha: 2026-11-20 · Owner: Worker `local-carriles-integracion-305dae` · Encarga: Dir_DTD.
- Worktree: `.claude/worktrees/carriles-integracion-305dae` · Rama: `claude/carriles-integracion-305dae`.
- Base: `origin/main` `af0f635ad61f179e20719828b319461d10f37429`.
- SDD: no aplica. Es harness (reglas de integración y una herramienta del tren), no comportamiento del Studio.
  El runbook no pide SDD para esto.
- Autorización: commits, publicar la rama y abrir la PR en borrador. Sin merge ni producción.
- Estado de la tarea: lista-para-revision (PR en borrador).

## OBJETIVO ORIGINAL

Sam aprobó el 2026-11-20 los carriles de integración («Carriles: sí, arranca hoy con los pasos 1 a 3»). Esta
tarea cubre el paso 1 (la regla escrita en AGENTS, runbook y skill del Director), el paso 2 (el clasificador
`scripts/carril.mjs` con sus pruebas y un check de CI informativo) y, del paso 3, el contrato que va a usar
`tren.sh`. Todo en una PR en borrador.

## COMPLETADO

- `AGENTS.md`: sección «Carriles de integración», con los dos carriles, la reversión, la revisión de madrugada
  y las ventanas.
- `docs/runbooks/codex-engineering.md`: sección «Carriles de integración», con las reglas completas, la
  semana de prueba y qué se mide, la nota de que GitHub no es la barrera, cómo decide el clasificador y su
  límite conocido, y el contrato del tren: comando, JSON, códigos de salida y desde qué copia se corre.
- `.agents/skills/director/SKILL.md`: resumen operativo para el Director.
- `scripts/carril.mjs`: Node sin dependencias. Toma las rutas por argumento, por stdin o con `--pr N`. Salida en
  texto o en `--json`. Códigos: `0` rapido, `1` revision, `2` error.
- `scripts/tests/carril.node.mjs`: 108 pruebas con `node:test`, que corren en `pnpm harness:test`.
- `.github/workflows/carril.yml`: el check «Carril (informativo)». Corre sin install, con permisos de solo
  lectura y usando el clasificador de la base. Escribe el carril en el resumen del job y como anotación, y no
  bloquea.

Decisiones tomadas dentro del alcance:

- **`--pr` lee el diff completo (`gh pr diff N --color=never`) y no `--name-only`.** `--name-only` da solo la
  ruta nueva de un renombre, y alguien podría esconder un archivo sensible renombrándolo a una ruta segura. El
  script toma las dos rutas de las cabeceras del diff.
- **Las reglas mismas van con revisión previa.** Entran ahí `AGENTS.md` y `CLAUDE.md`, `.agents/` (salvo los
  handoffs), `.claude/`, `docs/governance/`, el runbook de integración, el de migraciones en producción, el
  clasificador, sus pruebas y el contrato del CI. Así una PR no puede rebajar su propio carril. Por esa misma
  razón, el CI y el tren usan el clasificador de `main`.
- **`layout.tsx` y `template.tsx` van con revisión previa** aunque sean pantallas, porque suelen llevar las
  puertas de acceso.
- **Los formularios** (`*Form.tsx`), el consentimiento de cookies, la analítica y Clarity van con revisión
  previa: deciden qué datos personales se capturan.
- **Ventanas.** Mientras cada push a `main` publique (SDD-0541), integrar es publicar, así que la regla escrita
  dice que el tren fusiona solo dentro de una ventana. Es lo más seguro con la regla vigente de AGENTS
  («un merge a main es publicación web»). Si Dir_DTD o Sam quieren integrar fuera de ventana, primero hay que
  separar la publicación del push a `main`, y ese es un cambio de operaciones aparte.

## VALIDACIÓN

| Comprobación | Alcance | Resultado |
|---|---|---|
| `node --test scripts/tests/carril.node.mjs` | `d4bdcb406` | PASÓ (108/108) |
| Mutaciones a mano: carril fijo en rapido, sin causantes, `---` dentro de un hunk, temas aplicados a docs | copia de trabajo, restaurada | PASÓ: 48, 5, 1 y 24 pruebas en rojo, en ese orden |
| `node --test` de `harness-discovery` y `verify-harness-discovery` | `d4bdcb406` | PASÓ (5/5) |
| Simulación del paso de `carril.yml` en un worktree descartable (commit sintético sobre la base) | diff de esta PR | PASÓ: da `revision` (gobernanza y ci), resumen y anotación correctos, exit 0 |
| `node scripts/carril.mjs --pr 726/724/723` contra GitHub | PRs ya fusionadas | PASÓ: revision (contratos SQL), rapido (spec), revision (skill) |
| `node scripts/build-docs-index.mjs --check` | árbol | PASÓ |
| `node scripts/check-numbering.mjs` | árbol | PASÓ |
| `node scripts/check-skills-manifest.mjs` | árbol | PASÓ |
| `node scripts/build-governance-capsule.mjs --check` | árbol | PASÓ |
| `git diff --check` | diff | PASÓ |
| `pnpm lint` (ESLint sobre `scripts/carril.mjs`) | — | NO EJECUTADO: el worktree no tiene `node_modules` e instalar pide turno. Lo cubre el CI al marcar la PR lista. |
| `pnpm verify` / Vitest | — | NO EJECUTADO: es harness, no producto, y no tengo turno de PC. El CI corre `pnpm harness:test` y el contrato del workflow de calidad. |
| Corrida real de `carril.yml` en GitHub | — | NO EJECUTADO todavía: corre al abrir la PR (también en borrador). |

## COMMITS

- `e277f92f7` clasificador y pruebas.
- `049bb1ad2` check informativo del carril.
- `f9509648b` regla en AGENTS, runbook y skill del Director, con el contrato del tren.
- `d4bdcb406` limpieza del corte de `--` en los argumentos.
- El commit que contiene este documento.

## PR / BRANCH

- Rama `claude/carriles-integracion-305dae`, con base `main`. El número de la PR queda en la descripción y en el
  aviso a Dir_DTD.

## PENDIENTES DE ESTA TAREA

- Revisión independiente. La PR va por el carril con revisión previa: el propio clasificador la manda ahí.
- Ver la primera corrida real de «Carril (informativo)» en la PR y, al marcarla lista, el verde de
  `quality.yml` (ESLint incluido).

## FUERA DE ALCANCE DETECTADO

- Paso 3: cambiar `tren.sh` para que use el contrato. Lo hace Dir_DTD, fuera del repo.
- La revisión de madrugada (2:00 de Caracas) necesita quien la corra: una tarea programada o una sesión. No
  existe todavía y no es parte de esta PR.
- El registro del carril de cada merge, para medir la semana, lo lleva el tren. Este repo no tiene dónde
  guardarlo.
- El escáner de voseo (`scripts/buscar-voseo.mjs`) da 2 apariciones previas en
  `lib/studio/chatwoot/bot/conocimiento/reglas-duras.ts`. Son ajenas a esta tarea.

## HANDOFF AL DIRECTOR

- Siguiente acción: lanzar la revisión independiente. Después, `gh pr ready` para la corrida de calidad y,
  con eso, fusionar en una ventana con el OK que corresponda.
- Contrato compartido nuevo: la salida de `scripts/carril.mjs` (versión 1) que va a usar `tren.sh`.
- Impacto documental: AGENTS, el runbook de integración y la skill del Director quedan actualizados. No toca
  `docs/specs` (no hay SDD) ni la cápsula de gobernanza, que sigue vigente.
- Ownership: libero el claim al terminar de escribir.
