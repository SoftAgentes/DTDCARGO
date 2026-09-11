---
sdd: 0342
title: Resolver y firmar Documentos del Portal desde el principal
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related:
  - SDD-0042
  - SDD-0096
  - SDD-0308
  - SDD-0335
confidencialidad: interno
---

# SDD-0342 — Documentos del Portal por principal

> **Nota de importación — 2026-09-11.** Esta spec se importa desde la PR #21 con su
> contenido original, `status: done` incluido, que refleja su estado **en la rama de origen**.
> Su migración `0406_portal_packing_lists_por_principal` queda **declarada pendiente** en
> `supabase/migrations-baseline.json` y **no se ha aplicado a producción en esta tarea**: el
> `done` de la cabecera no significa que este contrato esté vigente en la base real.
> **MIGRATE-FIRST:** el código importado consume la RPC, así que 0406 se aplica y verifica en
> producción **antes** de fusionar la importación; sin la RPC, Documentos omite los packing lists.
> Aplicarla exige OK nominal de Sam y el runbook `docs/runbooks/aplicar-migraciones-prod.md`.
> Corte focal del bloque C (L06): no se importan `scripts/__tests__/portal-service-role-boundary.test.mjs`
> (inventario RSC ausente en main) ni los documentos de auditoría/handoff de la allowlist original.

## Estado real

Documentos construía dos `service_role`: uno para leer packing lists por un
Shipping Mark suministrado por la aplicación y otro para firmar una lista de
storage paths también suministrada por la página.

## Decisión

1. Crear `get_portal_packing_list_documents()` sin parámetros.
2. Derivar cliente, tenant y Shipping Mark desde `auth.uid()` y un vínculo activo.
3. Devolver sólo id del documento, código de compra, folio, fecha y cajas.
4. Encapsular la firma de documentos de envío en un módulo `server-only` que
   primero relee mediante RLS y no recibe paths.
5. Construir `service_role` únicamente cuando existan documentos RLS-visibles.

## Gobernanza

- `cumplimiento`: identidad y tenant se fijan en la base.
- `cumplimiento` ERR-01: sin RLS o firma no se produce URL.
- `cumplimiento`: packing list omite contacto, filas y montos.
- `no aplica`: carga, modificación, borrado o cambio visual.

## Allowlist exacta

- `supabase/migrations/0406_portal_packing_lists_por_principal.sql`
- `supabase/tests/0406_portal_packing_lists_por_principal.test.sql`
- `lib/portal/packing-list-queries.ts`
- `lib/portal/signed-portal-documents.ts`
- `lib/portal/__tests__/portal-packing-list-documents.test.ts`
- `lib/portal/__tests__/signed-portal-documents.test.ts`
- `app/portal/(app)/documentos/page.tsx`
- `scripts/__tests__/portal-service-role-boundary.test.mjs`
- `docs/specs/0342-documentos-portal-por-principal/spec.md`
- `docs/specs/README.md`
- `docs/audits/2026-09-02-codex-arranque-checklist.md`
- `.agents/handoffs/2026-09-02-portal-documents-principal-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

## Aceptación

- La RPC no recibe ids ni Shipping Mark y sólo permite `EXECUTE` a `authenticated`.
- Tenant A no ve packing lists de tenant B, versiones viejas o compras eliminadas.
- La respuesta no contiene contacto del proveedor, filas o montos.
- El firmador no recibe paths y no eleva cuando RLS no devuelve documentos.
- Documentos sale del inventario RSC; baseline: 6 rutas / 12 construcciones.
- SQL, unitarios, TypeScript, ESLint, docs, gobernanza, componentes y diff pasan.

## Fuera de alcance

- Subir, modificar, borrar o convertir adjuntos y packing lists.
- Cambiar policies de Storage o de las tablas fuente.
- Aplicar 0406 a Cloud o desplegar Producción.
