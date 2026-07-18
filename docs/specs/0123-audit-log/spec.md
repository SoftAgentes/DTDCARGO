---
sdd: "0123"
title: "Audit log — viewer read-only del entity_audit_log en Administración"
status: done
author: "Claude Code (sesión secundaria · worktree web-norte) + founder"
created: 2026-07-01
updated: 2026-07-15
supersedes: null
superseded_by: null
related: ["0085", "0066"]
confidencialidad: interno
---

# SDD-0123 · Audit log

> Cuarta sección real de Administración. Sin migración: es un **viewer
> read-only** sobre `entity_audit_log` (migr 0066), que ya registra las
> mutaciones cross-entity del Studio.

## Alcance

- Tabla de los últimos ~100 eventos del tenant: cuándo · entidad · evento ·
  actor · payload (expandible).
- Filtros client-side por tipo de entidad y por actor (usuario / operario /
  sistema).
- Solo lectura: `entity_audit_log` solo acepta INSERT vía service_role; acá se
  hace `select` (RLS filtra por tenant).

## Superficie de código

- `lib/studio/audit-types.ts` — `AuditEvent` + labels (entidad, actor, evento).
- `lib/studio/audit-queries.ts` — `getRecentAuditEvents(supabase, limit)`.
- `app/studio/(app)/admin/_components/AuditLogSection.tsx` — tabla + filtros.
- `app/studio/(app)/admin/page.tsx` — fetch condicional + render.

## Follow-ups (fuera de alcance)

- Resolver `actor_id` → nombre/email (join a perfiles) en vez de UUID corto.
- Filtros server-side + rango de fechas + paginación para volúmenes grandes.
- Ampliar `entity_type` a más entidades según se instrumenten.

## Estado

Código listo; `pnpm typecheck` + `pnpm lint` + build en verde. Sin migración.
