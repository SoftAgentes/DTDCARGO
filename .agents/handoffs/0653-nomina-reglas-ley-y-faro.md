# Handoff — SDD-0653 · Reglas de nómina al día con la ley y estante de ley pública para Faro

- Rama: `claude/0653-nomina-ley-faro-0b4370` · Worker 0653 · 2026-11-16
- Entregable: `docs/specs/0653-nomina-reglas-ley-y-faro/spec.md` (`proposed`). Solo documentación.
- Migración reservada por el DG: **0556** (no creada; se crea en la fase A2 tras las D de Sam).

## Hecho

- Ubicadas las reglas: 0162, 0175, 0179, tipos, motor y pantalla (spec §1, con archivo:línea).
- Tabla regla / sistema / ley / fuente con grado de verificación V, A, C o N (spec §2).
- Diseño del estante «Ley» de Faro sobre el minicerebro de la SDD-0637 (spec §3).
- Fases, migración propuesta, allowlist y D1-D10 con la opción recomendada (spec §4-§7).

## Evidencia

- No se leyó producción. La columna «sistema» usa los valores por defecto y la siembra demo de Git.
- Fuentes web listadas en spec §9; lo no confirmado está dicho al final de §9.
- Comprobaciones: `node scripts/build-docs-index.mjs --check` y `node scripts/check-numbering.mjs` (resultado en la PR).
  `pnpm verify` NO EJECUTADO: el diff es solo de documentación.

## Pendiente de esta tarea

- Respuestas de Sam a D1-D10.
- Fase A2 (migración 0556 y pantalla), A3 (tope del motor), A4 (carga en producción con OK nominal), B1 y B2.
- B2 depende de la fase 3 de la SDD-0637 (motor de Faro), que aún no existe en `main`.

## FUERA DE ALCANCE DETECTADO

- `lib/studio/nomina/payroll-run-types.ts:327-339`: el tope de SSO/RPE mezcla Bs (`min_salary`) con USD (sueldo del
  período) y compara un tope mensual con períodos quincenales o semanales. Propuesto como D6 / fase A3.
- La siembra demo de `0162:121` rotula en Bs montos que parecen dólares (cestaticket 40, bono 90).

## Impacto documental

- Al implementar A2: actualizar la guía de Faro de nómina y su novedad (D-10 de la 0637), y la §8 de la spec 0103
  si cambian columnas.
