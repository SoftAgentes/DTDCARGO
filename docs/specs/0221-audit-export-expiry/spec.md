---
sdd: "0221"
title: "Expiración segura de artefactos de auditoría"
status: in-progress
author: "Sam (founder) + Codex"
created: 2026-07-31
updated: 2026-07-31
supersedes: null
superseded_by: null
related: ["0166", "0186", "0219", "0220"]
confidencialidad: interno
---

# SDD-0221 · Expiración segura de artefactos de auditoría

E4 elimina solo objetos temporales de `audit-exports` vencidos. Un claim
append-only evita carreras; un hold activo omite el request. Storage confirma
borrado antes de registrar `expired`. Fallo deja recibo y permite reintento.

## Allowlist

- `docs/specs/0221-audit-export-expiry/spec.md`
- `docs/governance/reviews/aud-corte-e4-expiry.md`
- `supabase/migrations/0303_audit_export_expiry.sql`
- `lib/studio/audit/export-service.ts` y prueba existente
- `app/api/studio/audit/export/route.ts`
- índices SDD y mapa módulo

## Aceptación

- no reclama antes de `expires_at` ni bajo hold;
- claim concurrente no duplica trabajo;
- fallo de Storage no marca `expired`;
- confirmación registra hash/ruta/conteo sin payload;
- nunca ejecuta DELETE sobre `entity_audit_log`.

