---
sdd: 0339
title: Resolver el programa de referidos del Portal por principal
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related:
  - SDD-0051
  - SDD-0159
  - SDD-0335
confidencialidad: interno
---

# SDD-0339 — Referidos del Portal por principal

> **Nota de importación — 2026-09-11.** Esta spec se importa desde la PR #21 con su
> contenido original, `status: done` incluido, que refleja su estado **en la rama de origen**.
> Su migración `0404_portal_referidos_por_principal` queda **declarada pendiente** en
> `supabase/migrations-baseline.json` y **no se ha aplicado a producción en esta tarea**: el
> `done` de la cabecera no significa que este contrato esté vigente en la base real. Es
> **MIGRATE-FIRST**: la página de Referidos consume la RPC desde esta misma PR, así que 0404
> debe aplicarse y verificarse en producción antes de fusionar; sin ella la página falla
> cerrada y queda vacía. Aplicarla exige OK nominal de Sam y el runbook
> `docs/runbooks/aplicar-migraciones-prod.md`.

## Estado real

Referidos construía `service_role` para consultar facturación, configuración y
lista mediante un markbox resuelto antes desde la sesión. Los filtros eran
explícitos, pero la garantía dependía de la aplicación.

## Decisión

1. Crear `get_portal_referral_program()` sin parámetros.
2. Derivar cliente, tenant y Shipping Mark desde `auth.uid()` y un vínculo activo.
3. Normalizar en la base sólo la facturación billable trailing-12m del cliente.
4. Devolver hasta 200 referidos recientes sin email, teléfono, notas, lead id ni
   ids de cliente/tenant.
5. Mantener en TypeScript el motor puro de niveles, código y créditos.
6. Fallar cerrado si la sesión no corresponde a un cliente Portal activo.

## Gobernanza

- `cumplimiento`: identidad, tenant y markbox se fijan dentro de la base.
- `cumplimiento` ERR-01: un error o principal inválido no produce datos parciales.
- `cumplimiento`: la respuesta minimiza PII a nombre y empresa ya visibles.
- `no aplica`: escritura, borrado, nueva captura de datos o cambio visual.

## Allowlist exacta

- `supabase/migrations/0404_portal_referidos_por_principal.sql`
- `supabase/tests/0404_portal_referidos_por_principal.test.sql`
- `lib/portal/portal-referral-queries.ts`
- `lib/portal/__tests__/portal-referral-query.test.ts`
- `lib/portal/__tests__/referrals.test.ts`
- `app/portal/(app)/referidos/page.tsx`
- `scripts/__tests__/portal-service-role-boundary.test.mjs`
- `docs/specs/0339-referidos-portal-por-principal/spec.md`
- `docs/specs/README.md`
- `docs/audits/2026-09-02-codex-arranque-checklist.md`
- `.agents/handoffs/2026-09-02-portal-referidos-rpc-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

## Aceptación

- La RPC no recibe ids ni Shipping Mark y sólo permite `EXECUTE` a `authenticated`.
- Tenant A no observa facturas, configuración ni referidos de tenant B.
- Vínculos revocados y clientes eliminados no obtienen snapshot.
- La respuesta no contiene contacto, notas, lead ids ni ids de cliente/tenant.
- Referidos deja de construir `service_role`; baseline: 9 rutas / 17 construcciones.
- SQL, unitarios, TypeScript, ESLint, docs, gobernanza, componentes y diff pasan.

## Fuera de alcance

- Aplicar 0404 a Cloud o desplegar Producción.
- Cambiar invitaciones, altas, estados o acreditación de referidos.
- Alterar montos configurados o datos de clientes.
