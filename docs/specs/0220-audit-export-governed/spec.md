---
sdd: "0220"
title: "Exportación gobernada de auditoría"
status: done
author: "Sam (founder) + Codex"
created: 2026-07-31
updated: 2026-07-31
supersedes: null
superseded_by: null
related: ["0166", "0186", "0219"]
confidencialidad: interno
---

# SDD-0220 · Exportación gobernada de auditoría

## Contrato

E3 crea solicitudes durables, aprobación por segundo admin, job service-role,
bucket privado y descarga reautorizada. Los datos exportables son el mismo
sobre redacted del viewer; payload, before/after, reason y etiquetas de actor no
entran al archivo. CSV neutraliza `=`, `+`, `-` y `@`.

El artefacto vive como máximo 24 horas, la URL firmada 15 minutos y la ruta es
`tenant_id/request_id/audit.{csv|json|ndjson}`. La fila durable sella SHA-256,
conteo, tamaño y manifiesto fuera del objeto.

## Allowlist

- `docs/specs/0220-audit-export-governed/spec.md`
- `docs/governance/reviews/aud-corte-e3-export.md`
- `supabase/migrations/0302_audit_export_governed.sql`
- `lib/studio/audit/export-service.ts`
- `lib/studio/audit/__tests__/export-service.test.ts`
- `app/api/studio/audit/export/route.ts`
- índices SDD y mapa módulo

## Aceptación

- solicitante y aprobador distintos;
- filtros y campos en allowlist cerrada;
- job solo service role y salida redacted;
- bucket privado y sin policies de lectura directa;
- hash/conteo/ruta/TTL validados antes de `ready`;
- descarga reautoriza sesión, tenant, estado y expiración.

## Producción

Aplicada como `0302_audit_export_governed` (`20260731192253`). Tablas, RPCs y
bucket privado aprobados.
