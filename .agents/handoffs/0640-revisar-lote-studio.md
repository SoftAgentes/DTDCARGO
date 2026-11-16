# Handoff · SDD-0640 · Revisar lote en el Studio (etapa 1: spec y maqueta)

Fecha: 2026-11-16 · Rama: `claude/sdd-revisar-lote-studio-b09288` · Worker del Subdirector Portal.

## Qué se hizo

- `docs/specs/0640-revisar-lote-studio/spec.md` (`proposed`): origen de los datos (recomienda un archivo
  `revision.json` que emite el generador y se sube al Studio), modelo de datos y auditoría sin texto libre en
  el log, permisos (dentro de Naviera; aprueban `operations` y `admin`, más el acceso por persona de la
  SDD-0622; quien sube no aprueba), cambios futuros en `aplicar-lote.sh` y en el runbook, datos personales,
  criterios de aceptación, fases y nueve decisiones para Sam.
- `docs/specs/0640-revisar-lote-studio/maqueta/revisar-lote.html`: maqueta interactiva con datos inventados:
  contenedores, clientes con filtros, «Bien» y «Corregir» con comentario obligatorio, preguntas, barra de
  progreso, aprobación o devolución y «Copiar respuestas». Tokens del Studio en claro y oscuro.
- `/ui-check`: OK con ajustes menores. Se corrigió el ancho de la columna Remitente; lo pendiente quedó anotado
  en la spec, §8.

## Evidencia

| Comprobación | Resultado |
|---|---|
| `pnpm docs:check` (node scripts/build-docs-index.mjs --check) | PASÓ tras regenerar el índice (623 specs) |
| `pnpm sdd:check` (node scripts/check-numbering.mjs) | PASÓ: sin números repetidos |
| Maqueta en navegador (marcar, filtros, botón deshabilitado con motivo, devolver) | PASÓ (panel del navegador, 2026-11-16) |
| `pnpm verify` | NO EJECUTADO: el cambio es solo de documentación |

## Pendientes de esta tarea

- Que Sam conteste las decisiones de la spec (§12). Sin eso no empieza la fase 1.
- La fase 1 toca `scripts/consolidados/`, así que espera a que se fusione la PR #559 (F2).

## FUERA DE ALCANCE DETECTADO

- La SDD-0543 decía que la pantalla de importación iba en una «segunda fase». Esta spec no la absorbe, y esa
  línea sigue vigente.
- El riesgo de los `ref` con forma `XX-NN-<texto>` en `entity_audit_log` (SDD-0543 §Datos personales) sigue
  abierto para cualquier carga, haya revisión o no.

## Impacto documental

- Cuando se implemente la fase 3, se actualiza `docs/runbooks/cargar-consolidados.md` (§1b nuevo y §2b).
- Este cambio no toca código, migraciones ni producción.
