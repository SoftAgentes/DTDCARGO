# Handoff · SDD-0635 · Acceso por persona interactivo (etapa 1: diseño)

- **Fecha:** 2026-11-15
- **Owner / sesión:** Worker 0635 (Claude Code), iniciada por la sesión `local_25e2dded-103b-4eaa-b10e-6527564b9cad`; claim `local_0635-worker`
- **Worktree:** `DTD-worktrees/0635-acceso-por-persona`
- **Rama:** `codex/0635-acceso-por-persona`, desde la reserva `codex/sdd-reserve-0635-acceso-por-persona-interactivo` (`ef4d2f7f7`), base `origin/main` `540d607f8`
- **Reserva publicada:** `refs/heads/codex/sdd-reserve-0635` (create-only, por `next-number.mjs --push`)
- **SDD:** `docs/specs/0635-acceso-por-persona-interactivo/spec.md`, estado `proposed`
- **Estado de tarea:** lista-para-revision (diseño). No implementa.
- **Permisos del encargo:** commits, push de la rama propia y PR draft. Sin merge, sin migraciones, sin producción.

## OBJETIVO ORIGINAL

Reservar una SDD y proponer el rediseño interactivo de la pestaña Acceso de la ficha de usuario (parte de la
SDD-0622 en producción): actuar sobre cada módulo desde «Lo que puede ver», dejar claro persona frente a rol,
hacer visible «ver y editar», ordenar «Almacén», y evaluar la Fase 6 (`custom`). Entrega: spec + maqueta +
`/ui-check`, PR draft y este handoff.

## COMPLETADO

- SDD-0635 reservada con `pnpm sdd:next` (stub en rama, sin push a main) y escrita: diagnóstico con archivo,
  diseño (§3), respuesta corta para Sam (§4), alternativas (§5), evaluación de la Fase 6 (§6), aceptación (§7),
  gobernanza (§8), fases (§9), allowlist exacta de la etapa 2 (§11), decisiones para Sam (§12), `/ui-check` (§14).
- Maqueta navegable autocontenida `maqueta/acceso-por-persona.html` (tokens de `app/studio/tokens.css`,
  personas ficticias) y 8 capturas PNG generadas con Chrome headless (estado por hash de URL).
- Índice de specs regenerado.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `pnpm docs:index` / `pnpm docs:check` | PASÓ (620 specs) |
| `pnpm sdd:check` | PASÓ (sin números repetidos; solo choques históricos ya conocidos) |
| `/ui-check` de la maqueta | PASÓ con ajustes menores; 2 hallazgos corregidos en la maqueta (§14) |
| Maqueta en navegador (clic en CRM, «Ver y editar», bandeja, motivo) | PASÓ, sin errores de consola |
| `git diff --check` | ver commit |
| `pnpm verify` | NO EJECUTADO: el diff es solo documentación (spec, HTML de maqueta, PNG); no cambia producto |

## COMMITS

- Reserva: `ef4d2f7f7` (stub).
- Commit que contiene este documento: spec, maqueta, capturas, índice y handoff.

## PR / BRANCH

PR draft contra `main` desde `codex/0635-acceso-por-persona` (URL en el cierre de la sesión).

## PENDIENTES DE ESTA TAREA

- Revisión del Director General y aprobación de Sam del diseño (§12, cinco decisiones).
- Al aprobar: cambiar `status` a `approved` y abrir la etapa 2 con la allowlist de §11.

## Impacto documental

- Nuevo: spec 0635 y su maqueta. Índice `docs/specs/README.md` regenerado.
- No se tocó la 0622; la 0635 la cita. Si Sam aprueba, la 0622 §5.4 queda superada en lo visual por la 0635
  (anotar en la 0622 al implementar, no antes).

## FUERA DE ALCANCE DETECTADO

- La matriz por rol (`studio_role_module_overrides`, 0357) no guarda historial ni motivo de sus cambios; solo la
  última versión de la celda. Propuesto como etapa 3 de la 0635, con migración propia.
- La regla de `/ui-check` (`.claude/skills/ui-check`) dice que el Studio usa Nunito + Sora; `app/studio/tokens.css`
  usa Archivo como `--f-sans`. Conviene alinear el texto de la skill.

## HANDOFF AL DIRECTOR

- Siguiente acción: revisar la PR draft y llevar a Sam las decisiones de §12.
- No hay cambios compartidos de código, API, base ni migraciones.
- Ownership: se libera el claim al cerrar esta sesión. No se borró worktree ni rama.
