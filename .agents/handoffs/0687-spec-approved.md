# Handoff — SDD-0687 pasa a approved

Fecha: 2026-11-23 · Rama: `claude/0687-spec-approved-a9957a`

## Aprobación

«Apruebo la spec 0687 de cifras 1.234,50» (Sam, 2026-11-23, en el chat de Dir_DTD). Sam repitió «La 0687 la apruebo» en el chat del Subdirector del Rebrand.

## Qué cambió

- `docs/specs/0687-rebrand-cifras-formato-ve/spec.md`: `status: proposed` → `approved`, `updated: 2026-11-23` (solo el encabezado).
- `docs/specs/README.md`: índice regenerado (una fila).

## Límites

La aprobación cubre solo la spec 0687. No cubre NUM-01 v1.2 (pendiente de Sam), ni fusionar ni publicar nada de las cifras.

## Cruce con la PR #790

La #790 solo añade la §12 al final de la spec; no toca el encabezado. `merge-tree` contra `main` sin conflictos. La #790 no edita `docs/specs/README.md`.

## Comprobaciones

- `node scripts/build-docs-index.mjs --check`: PASÓ (tras regenerar).
- `node scripts/check-numbering.mjs`: PASÓ.
- `pnpm verify`: NO EJECUTADO (PR solo de documentación).

## FUERA DE ALCANCE DETECTADO

Ninguno.
