# Handoff · SDD-0628 — Aviso, componente único de avisos del Studio (tramo 4a de SDD-0603)

- **Rol:** Worker. Lo coordina el Subdirector Rebrand (SDD-0603, tramos 3 a 5).
- **Ruta:** `.claude/worktrees/0628-aviso-44ed11` · **rama:** `claude/0628-aviso-44ed11`, desde `origin/main` `11f90a32e`.
- **Claim:** `local_0628-aviso`.
- **Spec:** [`docs/specs/0628-aviso-studio/spec.md`](../../docs/specs/0628-aviso-studio/spec.md).
- **Reserva:** `refs/dtd/reservations/0628` y `codex/sdd-reserve-0628-aviso-studio` (commit `bdb8734cc`, incorporado con cherry-pick como `b4ce8998b`). No se publicó aparte: la PR lleva la spec.

## Objetivo

`Aviso` (franja plana con icono, sin contorno ni sombra, en cuatro tonos), clases en `studio.css`, `ErrorAlert` sobre él sin cambiar su API, registro CMP, contrato con piso y mutantes. No se adopta en ninguna pantalla.

## Completado

- `app/studio/_components/ui/Aviso.tsx`: tonos `info`, `atencion`, `exito` y `error`; `titulo`, `accion` (botón ghost sm existente), `urgente`, `compacto`. Error o urgente es `alert`; el resto, `status`.
- `app/studio/studio.css`: bloque «Aviso · SDD-0628», solo tokens existentes. Atención en claro lleva el icono en tinta, porque el dorado mide 2,49–2,79:1 (BRAND §Estados: el acento que no alcanza es decorativo). En oscuro, solo en pantalla, el icono va en dorado (≥ 4,87:1).
- `ErrorAlert.tsx`: misma API y conducta, pinta con `<Aviso tono="error">`. En sus 11 consumidores, sin editarlos, el icono pasa de 14 a 16 px (en compacto sigue en 14) y se alinea en columna.
- `avisos-contract.test.ts`: 24 mediciones (2 temas × 4 tonos × 3 superficies), piso de 13 reglas y 5 mutantes internos. Mutante externo comprobado: se cambió el `studio.css` real para que el icono de atención en claro fuera dorado, y fallaron exactamente «claro / atención» y M1. El archivo se restauró.
- `aviso.json` (CMP-01 `proposed`), registro regenerado, `app/studio/CLAUDE.md` (primitivas y clases), índice de specs.

## Validación

| Comprobación | Resultado |
|---|---|
| `vitest` focal: `Aviso.test.tsx`, `avisos-contract.test.ts`, `claridad-controles-contract.test.ts` | PASÓ, 62/62. Una primera corrida bajo carga dio «3 errors, no tests» al arrancar los workers; repetida, verde. |
| `eslint` sobre los 4 archivos de código | PASÓ |
| `pnpm components:check` | PASÓ (6 fuentes) |
| `pnpm governance:check` | PASÓ (29 políticas) |
| `pnpm docs:check` | PASÓ (608 specs) |
| `pnpm sdd:check` | PASÓ (sin números repetidos; advertencias históricas) |
| `/ui-check` | OK para commit, advisory: tres hallazgos bajos o medios, ninguno de marca dura |
| `pnpm verify` | NO EJECUTADO: cubre el CI de GitHub (regla del DG, 2026-11-13, transmitida por el Subdirector Rebrand) |
| `pnpm knowledge:status` | NO DISPONIBLE: «Respuesta inválida del adaptador Graphify» (structural y semantic UNAVAILABLE) |

## Commits

- `b4ce8998b` chore(sdd): reserva SDD-0628 — aviso-studio
- `fddea1698` feat(studio): SDD-0628 — componente Aviso y ErrorAlert sobre él
- `ecbc62e35` docs(studio): SDD-0628 — spec, registro CMP de Aviso y guía del Studio

## Al arrancar

PRs abiertas que tocan la allowlist: solo `docs/specs/README.md`, que es índice generado y lo tocan #530, #529, #527, #526, #525, #521, #520, #519, #515, #488, #318, #314, #313 y #312. Al integrar se regenera; ver la memoria sobre merge del índice de specs.

## Pendientes de esta tarea

- Leer el CI de GitHub de la PR y corregir en esta rama si sale rojo. La revisión independiente la lanza el DG. No se fusiona desde aquí.

## Impacto documental

- Canónicos actualizados: la spec 0628, `app/studio/CLAUDE.md` y el registro CMP.
- `BRAND.md` y la spec 0603 no se tocan: este tramo aplica BD-037 tal como está.
- Graphify y Archify no se actualizaron, porque el adaptador no respondió (NO DISPONIBLE). Queda pendiente para el Director al integrar.

## FUERA DE ALCANCE DETECTADO

- `pnpm sdd:next` cuenta como ocupado el número cuya spec ya está escrita en el propio worktree, y cancela la reserva con `--number`. Se resolvió sacando la spec un momento. Otro intento falló por un acceso transitorio a `.git/config`, con «Permission denied» mientras otra sesión lo escribía.
- `pnpm knowledge:status` devuelve «Respuesta inválida del adaptador Graphify» en este worktree.
- Propuesta para 4b: un trinquete en el contrato contra avisos nuevos pintados a mano. Ver la spec, §Adopción posterior.
