---
sdd: 0337
title: Resolver la visibilidad de hitos del Portal por el principal autenticado
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related:
  - SDD-0156
  - SDD-0335
  - SDD-0336
confidencialidad: interno
---

# SDD-0337 — Visibilidad de hitos del Portal por principal autenticado

> **Nota de importación — 2026-09-11.** Esta spec se importa desde la PR #21 con su
> contenido original, `status: done` incluido, que refleja su estado **en la rama de origen**.
> Su migración `0402_portal_hidden_statuses_por_principal` queda **declarada pendiente** en
> `supabase/migrations-baseline.json` y **no se ha aplicado a producción en esta tarea**: el
> `done` de la cabecera no significa que este contrato esté vigente en la base real. Aplicarla
> exige OK nominal de Sam y el runbook `docs/runbooks/aplicar-migraciones-prod.md`.
> **MIGRATE-FIRST:** el código de este lote no se fusiona antes de aplicar y verificar 0402,
> porque sin la RPC el Portal muestra todos los hitos, incluidos los que una regla oculta. El
> corte L02 adopta sólo la lectura por RPC en las tres vistas vigentes; no importa la allowlist
> histórica completa ni la meta de construcciones `service_role` de la aceptación.

## Estado real

Dashboard, lista y detalle de envíos calculaban los hitos ocultos leyendo
`client_notification_rules` con `service_role`. Los ids provenían de la sesión,
pero el aislamiento y la precedencia override→default vivían en filtros de la
aplicación.

## Decisión

1. Crear `get_portal_hidden_shipment_statuses()` sin parámetros.
2. Derivar cliente y tenant exclusivamente de `auth.uid()` y `client_users`
   activo, rechazando clientes eliminados o vínculos revocados.
3. Resolver en SQL la precedencia de override de cliente sobre default de tenant.
4. Devolver sólo nombres de status ocultos; no exponer reglas, ids ni tenant.
5. Consumir la RPC con la sesión en las tres vistas. Ante error, conservar el
   fallback vigente: no ocultar hitos.

## Gobernanza

- `cumplimiento`: RBAC e identidad se aplican en la base.
- `cumplimiento` ERR-01: el error muestra todos los hitos y no oculta información
  operativa por una falla de configuración.
- `no aplica`: cambio visual, escritura, borrado, captura de PII o publicación.

## Allowlist exacta

- `supabase/migrations/0402_portal_hidden_statuses_por_principal.sql`
- `supabase/tests/0402_portal_hidden_statuses_por_principal.test.sql`
- `lib/studio/notifications/portal-visibility-queries.ts`
- `lib/studio/notifications/__tests__/portal-visibility-queries.test.ts`
- `app/portal/(app)/page.tsx`
- `app/portal/(app)/envios/page.tsx`
- `app/portal/(app)/envios/[code]/page.tsx`
- `scripts/__tests__/portal-service-role-boundary.test.mjs`
- `docs/specs/0337-visibilidad-portal-por-principal/spec.md`
- `docs/specs/README.md`
- `docs/audits/2026-09-02-codex-arranque-checklist.md`
- `.agents/handoffs/2026-09-02-portal-hidden-statuses-rpc-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

## Aceptación

- La RPC no recibe ids ni códigos y sólo permite `EXECUTE` a `authenticated`.
- Un tenant no recibe reglas de otro; override de cliente prevalece al default.
- Vínculos revocados y clientes eliminados no reciben filas.
- Las tres vistas usan la misma RPC; el baseline baja a 10 rutas / 19
  construcciones de `service_role`.
- SQL, unitarios, TypeScript, ESLint, docs, gobernanza, componentes y diff pasan.

## Fuera de alcance

- Aplicar 0402 a Cloud o desplegar Producción.
- Retirar las otras 19 construcciones elevadas.
- Cambiar las reglas configuradas o su semántica `active` vigente.
