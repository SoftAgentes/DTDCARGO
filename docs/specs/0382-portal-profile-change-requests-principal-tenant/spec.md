---
sdd: "0382"
title: Perfil y solicitudes de cambio Portal por principal y tenant
status: in-progress
author: Codex
created: 2026-09-03
updated: 2026-09-03
supersedes: null
superseded_by: null
related: ["0042", "0151", "0381"]
confidencialidad: interno
---

# SDD0382 · perfil y solicitudes de cambio Portal

## Evidencia y autoridad

La numeración 0382/0430 se comprobó tras `git fetch origin` contra 15 refs y
el commit local 1d03318f. Una reproducción independiente en PostgreSQL
desechable confirmó que las policies vigentes confían en un `client_id` sin
comprobar que `client_users.tenant_id = clients.tenant_id`: un vínculo
sintético incoherente leyó el perfil y solicitudes del cliente enlazado. Un
cliente retirado conservó sus solicitudes; la rama Portal también leyó una
traza `source='admin'` y una solicitud con tenant incoherente. Esto demuestra
lecturas indebidas bajo estados administrativos inconsistentes, no que un
atacante pueda crear esos estados.

No se usan datos reales ni se autoriza Cloud, push, `main`, despliegue o
limpieza. La migración 0430 sólo se prepara localmente.

## Contrato acotado

- Endurecer únicamente las policies `clients portal self read` y
  `client_change_requests self or tenant read`.
- La rama Portal exige `auth.uid()`, vínculo activo, cliente vivo y coherencia
  de `client_id` y tenant. Para solicitudes exige además `source='client'` y
  coherencia de la fila con el cliente.
- Conservar exactamente la rama de lectura del equipo por tenant, incluido el
  historial `source='admin'` y las sesiones híbridas con sus derechos propios.
- La aplicación deja de confiar sólo en `get_portal_client_id()`: resuelve la
  relación activa con filtros explícitos por UID y valida el cliente embebido.
- La lectura Portal de solicitudes filtra explícitamente tenant, cliente,
  origen y estado; las queries genéricas del Studio no cambian.
- Conservar el DTO del cliente, orden, mapeo, fallback y presentación visual.
- Fallar cerrado ante sesión ausente, vínculo múltiple, retirado, incoherente
  o errores de transporte. Sin nuevos logs, acciones ni datos personales.

## Allowlist exacta

- `supabase/migrations/0430_portal_profile_change_requests_principal_tenant.sql`.
- `supabase/tests/0430_portal_profile_change_requests_principal_tenant.test.sql`.
- `lib/portal/portal-queries.ts`.
- `lib/portal/change-request-queries.ts`.
- `lib/portal/__tests__/account.test.ts`.
- `lib/portal/__tests__/portal-profile-scope.test.ts`.
- `lib/portal/__tests__/portal-change-request-scope.test.ts`.
- `lib/portal/__tests__/payment-report-consumers.test.ts` (fixture de identidad).
- `lib/portal/__tests__/payment-report-actions.test.ts` (fixture de identidad).
- `app/portal/(app)/perfil/page.tsx`.
- Esta spec, `docs/specs/README.md` generado y la auditoría local del slice.
- Checklist de arranque y handoff del saneamiento.

## Aceptación

- [x] RED causal SQL y aplicación conservado.
- [x] Perfil ajeno, vínculo incoherente y cliente retirado fallan cerrado.
- [x] Solicitudes ajenas/incoherentes y trazas administrativas no llegan al Portal.
- [x] Perfil y solicitudes propias siguen visibles; equipo e híbridos se preservan.
- [x] Deriva, idempotencia, ACL, filas y catálogo quedan preservados.
- [x] Gates focales, SQL/rebuild y suite conjunta quedan aprobados.
- [x] Límites de release y checklist se documentan sin inflar 56/106.

Gobernanza: no conformidad de aislamiento confirmada. El cumplimiento del
correctivo sólo se declara tras GREEN. No cambia UI, confirmaciones, rutas ni
acciones; SGE00.05/12 exige autoridad explícita y mantiene gates externos.
