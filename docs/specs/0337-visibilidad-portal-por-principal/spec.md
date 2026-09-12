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

> **Nota de importación — 2026-09-11; actualizada el 2026-09-12.** Esta spec se importa desde la
> PR #21 con su contenido original, `status: done` incluido. Su migración
> `0402_portal_hidden_statuses_por_principal` **fue APLICADA a producción el 2026-09-12** con OK
> nominal de Sam (ledger `20260912022703 / 0402_portal_hidden_statuses_por_principal`), con el
> archivo de esta rama idéntico al aplicado (md5 `b28cacbbd4d84d736ecd16f1016aa38d`, 2068 B);
> esta ronda queda asentada en `.agents/handoffs/c-l02-portal-visibilidad.md`. Por eso 0402 ya
> **no** figura como espera en `supabase/migrations-baseline.json` ni tiene declaración en
> `supabase/pending-migration-symbol-declarations.json`. El orden migrate-first se cumplió: la
> RPC `get_portal_hidden_shipment_statuses()` existe en la base antes de fusionar el código que
> la consume, así que el Portal no mostrará los hitos que una regla del tenant oculta y el
> fail-open del lector vuelve a ser transitorio, igual que en main. El corte L02 adopta sólo la
> lectura por RPC en las tres vistas vigentes; no importa la allowlist histórica completa ni la
> meta de construcciones `service_role` de la aceptación.

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
