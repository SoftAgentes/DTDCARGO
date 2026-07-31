---
sdd: "0222"
title: "Retención de auditoría por lotes controlados"
status: in-progress
author: "Sam (founder) + Codex"
created: 2026-07-31
updated: 2026-07-31
supersedes: null
superseded_by: null
related: ["0166", "0186", "0219", "0220", "0221"]
confidencialidad: interno
---

# SDD-0222 · Retención de auditoría por lotes controlados

E5 implementa dry-run, hash estable, segundo aprobador, hold check y ejecución
service-role. Solo `operational` (5 años) y `security` (2 años) son ejecutables.
`fiscal` y `legacy_unknown` fallan siempre y exigen decisión profesional o
clasificación posterior.

## Allowlist

- `docs/specs/0222-audit-retention-batches/spec.md`
- `docs/governance/reviews/aud-corte-e5-retention.md`
- `supabase/migrations/0304_audit_retention_batches.sql`
- índices SDD y mapa módulo

## Aceptación

- cutoff más reciente que el calendario falla;
- fiscal/legacy no crean lote;
- hold excluye el evento;
- solicitante no autoaprueba;
- cambio de snapshot invalida aprobación/ejecución;
- ejecución requiere service role, lote aprobado y deja recibo sin payload;
- no existe DELETE individual ni job por fecha sin lote.

