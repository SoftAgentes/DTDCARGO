# Handoff 0537 · Tarifario de transportistas editable por ciudad

- Fecha: 2026-10-15
- Owner/sesión: `claude-worker-ad23b4a6a6176276d` (Claude Code, Worker subagente)
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO/.claude/worktrees/agent-ad23b4a6a6176276d`
- Rama: `worktree-agent-ad23b4a6a6176276d` (asignada por el lanzador; sin renombrar)
- Base: `main` `5d98ef62`
- SDD: [0537](../../docs/specs/0537-transportistas-tarifas-editables/spec.md), reservada en
  local con `sdd:next --reserve` (ref `codex/sdd-reserve-0537-transportistas-tarifas-editables`,
  commit `198190f6`, sin publicar). `sdd:next` propuso 0537 y migración 0490, igual que el encargo.
- Migración: **0490** (`0490_carrier_tariffs_auditoria.sql`, NO APLICADA). 0483–0489 viven en la
  PR #239; ninguna ref ni worktree usa 0490 como migración.
- Estado de tarea: en-progreso.
- Permisos: commits locales; publicar la rama y abrir PR **en borrador** contra `main`. Sin merge,
  sin producción, sin leer filas, sin migraciones aplicadas, sin corridas pesadas.

## AVISO TEMPRANO AL DIRECTOR — AUD-01 exige auditoría

La gobernanza **sí** exige auditoría con antes, después y actor para el tarifario:

- `docs/governance/policies/aud-01.md:27` — eventos obligatorios: «cambios de permisos, roles,
  acceso, **configuración sensible** y credenciales».
- `aud-01.md:15` — «Una mutación sensible y su evento obligatorio de auditoría son una sola
  operación».
- `aud-01.md:115-116` — «cada flujo nuevo o modificado vuelve a pasar el contrato de esta política».
- Precedente en la misma sección: `0293:48-49` y `0293:511` auditan `calculator_settings` y
  `calculator_cities` como `configuration`. `carrier_tariffs` (0330) quedó sin trigger.

Consecuencia: la migración **0490** pide **OK nominal de Sam** y aplicarla según
`docs/runbooks/aplicar-migraciones-prod.md`. Es **migrate-first compatible**: un trigger
`AFTER INSERT OR UPDATE` que audita también las escrituras del código desplegado hoy, así que puede
aplicarse antes del merge sin romper nada.

## Objetivo

Editar por ciudad costo, venta, frecuencia y días del transportista seleccionado; agregar una
ciudad desde `calculator_cities`; quitar una ruta con confirmación; cambio en lote como fase 2.

(Este documento se completa al cierre con validación, commits, smoke y fuera de alcance.)
