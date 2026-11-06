# Handoff · SDD-0614 — diseño del paso 6.6 (reemplazos de Kommo en el ERP)

- **Owner:** Claude Worker «E6 reemplazos», encargado por el Director General (sesión `local_535053f4-40c2-4124-a280-63f4fc882820`), 2026-11-06.
- **Ruta:** `.claude/worktrees/wizardly-hopper-d89dac`
- **Rama:** `claude/wizardly-hopper-d89dac`, desde `main` `3d17292a4`.
- **SDD:** [0614](../../docs/specs/0614-crm-reemplazos-kommo/spec.md), `status: draft`. Programa SDD-0582, fila 6.6; contrato SDD-0587.
- **Reserva:** `refs/dtd/reservations/0614` y `codex/sdd-reserve-0614-crm-reemplazos-kommo` (`c7691a9c3`), locales. La rama de reserva no se publicó: la PR de esta rama lleva la spec. Antes de reservar se revisaron las ramas remotas, las locales y `refs/dtd/reservations/*` (la más alta tomada era la 0613).

## Objetivo

Diseño en borrador de 6.6, sin código de producto, para que lo revise el Director General antes de programar: qué reemplaza cada pieza, modelo de datos y migración (descrita, sin escribir ni aplicar), pantallas con allowlist exacta, permisos y RLS, revisión de datos personales, pruebas, criterios de aceptación y lo que queda fuera.

## Qué quedó

- La spec completa: siete piezas (R1 a R7), una migración descrita (§3), allowlist por tramo (§5), revisar-datos-ve (§6), gobernanza (§7), pruebas (§8), aceptación (§9), reestimación (§10), **12 decisiones para Sam y 7 preguntas para el Director General** (§11) y fuera de alcance (§12).
- Índice `docs/specs/README.md` regenerado.
- **Sin código de producto, sin migración escrita, sin producción y sin preguntas a Sam.**

## Validación

| Comprobación | Resultado |
|---|---|
| `node scripts/build-docs-index.mjs --check` (`docs:check`) | PASÓ: 590 specs |
| `node scripts/check-numbering.mjs` (`sdd:check`) | PASÓ: sin números repetidos |
| `git diff --check` | PASÓ |
| Voseo en la spec | Revisado a mano y con grep: sin voseo |
| `pnpm verify` | NO APLICA: el cambio es solo documentación; el cierre se elige por el diff |
| Pruebas de producto | NO APLICA: no hay código |

## Pendientes de esta tarea

- Revisión del Director General de la spec y de las preguntas P-1 a P-7.
- Las decisiones D-6.6-1 a D-6.6-12 se las lleva el Director General a Sam. Esta sesión no le preguntó nada.
- Si el Director General da la salida, el código empieza por el tramo S1 (migración y contrato), con número de migración pedido en ese momento (el 2026-11-06 el siguiente libre era 0518, sin reservar).
- La fila 6.6 del checklist no se tocó: sigue «pendiente». Al integrar, conviene que su columna de evidencia apunte a la SDD-0614.

## FUERA DE ALCANCE DETECTADO

1. **`/privacidad` promete anonimizar a los 12 meses y nada lo corre.** `crm_anonimizar_leads_perdidos` no tiene llamadas fuera de las migraciones, y su predicado solo toma «Perdido» (`0506_crm_modelo.sql:768-774`). La primera tarjeta es del 2026-11-04, así que todavía no se incumple (inferencia). La spec lo resuelve en R7 b, con la decisión D-6.6-9.
2. **La SDD-0587 §16.6 está vencida en un punto:** pide ampliar `entity_audit_log_entity_type_check`, que no existe desde la 0261 (`0261_audit_entity_catalog_validate.sql:132`). Lo vigente es registrar el tipo en `audit_entity_types`.
3. **Reportes es de contabilidad y las tablas `crm_*` no la dejan leer** (`rbac.ts:129`, `0506_crm_modelo.sql:186`). Hoy contabilidad ve el desempeño por asesor porque sale del espejo de Kommo.
4. **Recuperación (SDD-0157) necesita el teléfono completo**, y la tarjeta del lead sin ficha guarda solo 10 dígitos (D6).
5. **Las pestañas del CRM** usan botones con `role="tab"`; no se probó si manejan flechas (A11Y-01).
6. **Otra sesión diseña la SDD-0610** (rama `claude/practical-swartz-5b50ae`, resumen semanal del CRM para marketing) y clasifica `motivo_perdida` como texto libre: se cruza con los motivos predefinidos de R7 (pregunta P-5).

## Impacto documental

- Nuevo: `docs/specs/0614-crm-reemplazos-kommo/spec.md` y este handoff.
- Regenerado: `docs/specs/README.md`.
- Pendiente al integrar: puntero en la SDD-0587 §10 (pregunta P-1) y la evidencia de la fila 6.6 del checklist.
- Graphify, Archify y Obsidian: los revisa el Director General al cierre, según el runbook de conocimiento. Esta tarea no los tocó.
