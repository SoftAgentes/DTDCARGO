---
sdd: 0338
title: Resolver el asesor del Portal por el principal autenticado
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related:
  - SDD-0147
  - SDD-0151
  - SDD-0335
confidencialidad: interno
---

# SDD-0338 — Asesor del Portal por principal autenticado

> **Nota de importación — 2026-09-11; actualizada el 2026-09-12.** Esta spec se importa desde la
> PR #21 con su contenido original, `status: done` incluido. Su migración
> `0403_portal_advisor_por_principal` **fue APLICADA a producción el 2026-09-12** con OK nominal
> de Sam (ledger `20260912022746 / 0403_portal_advisor_por_principal`), con el archivo de esta
> rama idéntico al aplicado (md5 `bfae7279d28a8cf28961e0783ee23f36`, 1711 B); esta ronda queda
> asentada en `.agents/handoffs/c-l03-portal-asesor.md`. Por eso 0403 ya **no** figura como
> espera en `supabase/migrations-baseline.json` ni tiene declaración en
> `supabase/pending-migration-symbol-declarations.json`. El orden migrate-first se cumplió: la RPC
> `get_portal_advisor()` existe en la base antes de fusionar el código que la consume, así que
> Inicio y Soporte resuelven el asesor asignado por la sesión del cliente y no degradan al
> contacto público al integrarse. El corte L03 adopta sólo la lectura por RPC en las dos vistas
> vigentes; no importa la allowlist histórica completa ni la meta de construcciones
> `service_role` de la aceptación, cuyo test de frontera no existe en main.

## Estado real

Inicio y Soporte resolvían el asesor asignado con `service_role` y un client id
obtenido previamente de la sesión. El filtro era correcto, pero su garantía
dependía del orden de llamadas de la aplicación.

## Decisión

1. Crear `get_portal_advisor()` sin parámetros.
2. Derivar el cliente desde `auth.uid()` y una vinculación activa.
3. Exigir que el asesor siga como miembro activo del mismo tenant.
4. Devolver sólo nombre, teléfono, avatar y cargo; no exponer ids, tenant ni
   campos internos del perfil.
5. Reusar la RPC desde Inicio y Soporte, conservando el contacto público como
   fallback cuando no haya asesor o la consulta falle.

## Gobernanza

- `cumplimiento`: identidad y frontera de tenant se aplican en la base.
- `cumplimiento` ERR-01: cualquier inconsistencia degrada al contacto público.
- `no aplica`: cambio visual, escritura, borrado, captura de PII o publicación.

## Allowlist exacta

- `supabase/migrations/0403_portal_advisor_por_principal.sql`
- `supabase/tests/0403_portal_advisor_por_principal.test.sql`
- `lib/portal/portal-queries.ts`
- `lib/portal/__tests__/portal-advisor-query.test.ts`
- `app/portal/(app)/page.tsx`
- `app/portal/(app)/soporte/page.tsx`
- `scripts/__tests__/portal-service-role-boundary.test.mjs`
- `docs/specs/0338-asesor-portal-por-principal/spec.md`
- `docs/specs/README.md`
- `docs/audits/2026-09-02-codex-arranque-checklist.md`
- `.agents/handoffs/2026-09-02-portal-advisor-rpc-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

## Aceptación

- La RPC no recibe ids y sólo permite `EXECUTE` a `authenticated`.
- Un cliente sólo obtiene el asesor activo asignado en su mismo tenant.
- Vínculos revocados, clientes eliminados y asesores deshabilitados no obtienen
  filas.
- Inicio deja de construir un `service_role`; el baseline queda en 10 rutas / 18
  construcciones.
- SQL, unitarios, TypeScript, ESLint, docs, gobernanza, componentes y diff pasan.

## Fuera de alcance

- Aplicar 0403 a Cloud o desplegar Producción.
- Cambiar asignaciones de asesores o datos de sus perfiles.
- Migrar los otros dominios de Soporte que comparten su admin client.
