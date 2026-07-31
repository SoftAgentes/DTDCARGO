---
sdd: "0219"
title: "Legal holds append-only de auditoría"
status: in-progress
author: "Sam (founder) + Codex"
created: 2026-07-31
updated: 2026-07-31
supersedes: null
superseded_by: null
related: ["0166", "0186"]
confidencialidad: interno
---

# SDD-0219 · Legal holds append-only de auditoría

## 1. Objetivo

Implementar E2 de AUD-02: un hold preserva eventos por tenant y alcance, y su
liberación requiere dos decisiones humanas distintas. Conservar es el default
seguro; un hold nunca concede permiso para borrar.

## 2. Contrato

- `audit_legal_holds` conserva la definición inmutable del alcance;
- `audit_legal_hold_events` registra `active`, `release_requested` y `released`
  sin reescribir historia;
- alcance `tenant`, `entity_type` o `entity`, con rango temporal opcional;
- crear, pedir liberación, aprobar y listar son RPC admin-only;
- quien aprueba la liberación debe ser distinto de quien la pidió;
- RLS activa, cero grants crudos de aplicación y trigger anti UPDATE/DELETE;
- cada transición agrega un evento canónico `audit_hold` sin PII;
- `audit_event_is_held` queda solo para service role y funciones gobernadas.

## 3. Allowlist

- `docs/specs/0219-audit-legal-holds/spec.md`
- `docs/specs/README.md` generado
- `docs/architecture/module-sdd-map.md`
- `docs/specs/0166-auditoria-gobernada-aud-01-aud-02/spec.md`
- `docs/governance/reviews/aud-corte-e2-holds.md`
- `supabase/migrations/0301_audit_legal_holds.sql`
- `supabase/tests/0301_audit_legal_holds.test.sql`

## 4. Riesgo y rollback

R3 por preservar evidencia y por la futura relación con purga. La migration es
aditiva. Si falla, se revocan RPCs; no se borran holds existentes. Retirar
tablas con historia requiere migración y revisión propias.

## 5. Aceptación

- tenant ajeno y no-admin fallan;
- no hay UPDATE/DELETE directo;
- alcance inválido falla;
- segunda solicitud de liberación falla;
- autoaprobación falla;
- hold activo y `release_requested` bloquean; `released` deja de bloquear;
- SQL efímero, schema rebuild, advisors y postcondiciones Cloud en verde.

