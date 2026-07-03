# RESUMEN · lane `reportes-norte`

**Ventana:** secundaria (no push, no merge, no migrations).
**Rama:** `feat/reportes-norte` (off `main`, sin upstream).
**Tarea:** paridad de Reportes con el Norte — reporte "Por agente" + reporte IVA.
**Spec:** `docs/specs/0142-reportes-norte/spec.md`.

## Commit
- `91c7ef02` — feat(studio): SDD-0142 — Reportes al Norte, "Por agente" + IVA

## Qué quedó
- **Comerciales · Por agente:** desempeño por asesor con revenue REAL (espejo
  Kommo + facturación). EmptyState honesto si no hay Kommo.
- **Contables · IVA:** posición ante SENIAT (débito/crédito/cuota) reusando la
  clasificación fiscal de SDD-0073. Aproximaciones documentadas en la UI.
- Ambos con export CSV. 5 archivos modificados, cero nuevos/borrados.

## Verificación
`tsc --noEmit` → exit 0 · `eslint reportes/ + reports/` → 0 errores (2 warnings
preexistentes en BuilderView/charts, no míos). Sin migración. Sin push.

## Decisión abierta para el Director
El Norte gatea el tab IVA tras un flag; como el fiscal de DTD está OFF, lo dejé
**visible siempre con nota honesta** (testeable). Gateo estricto = cambio chico.

## Pendiente del Director
`verify.mjs` + `pnpm build` + `ui-ux-designer` + `docs:index`. Merge con OK del founder.
