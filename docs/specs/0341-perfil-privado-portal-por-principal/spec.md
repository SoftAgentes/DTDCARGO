---
sdd: 0341
title: Resolver el contexto privado de Perfil por principal autenticado
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related:
  - SDD-0138
  - SDD-0258
  - SDD-0335
confidencialidad: interno
---

# SDD-0341 — Contexto privado de Perfil por principal

> **Nota de importación — 2026-09-11; actualizada el 2026-09-12.** Esta spec se importa desde la
> PR #21 con su contenido original, `status: done` incluido. Su migración
> `0405_portal_perfil_privado_por_principal` **fue APLICADA a producción el 2026-09-12** con OK
> nominal de Sam (ledger `20260912022835 / 0405_portal_perfil_privado_por_principal`), con el
> archivo de esta rama idéntico al aplicado (md5 `60c500b5bf20603d28be7aa56f28ed64`, 1617 B); esta
> ronda queda asentada en `.agents/handoffs/c-l05-portal-perfil-privado.md`. Por eso 0405 ya **no**
> figura como espera en `supabase/migrations-baseline.json` ni tiene declaración en
> `supabase/pending-migration-symbol-declarations.json`. El orden migrate-first se cumplió: la RPC
> `get_portal_private_profile_context()` existe en la base antes de fusionar el código que la
> consume, así que el perfil conserva los Shipping Marks anteriores y las fotos firmadas del avatar
> y de la cédula al integrarse, en vez de quedar sin códigos ni imágenes.
> El lote L05 importa sólo la migración, su contrato, el helper con su test y la adopción en la
> página; el resto de la allowlist histórica, incluido el inventario de
> `scripts/__tests__/portal-service-role-boundary.test.mjs`, queda fuera. El helper conserva la
> URL firmada de la cédula en 60 s, contrato vigente de SDD-0439.

## Estado real

Perfil construía dos `service_role`: uno para Shipping Marks retirados y otro
para obtener y firmar los paths del avatar y la foto de identidad.

## Decisión

1. Crear `get_portal_private_profile_context()` sin parámetros.
2. Derivar cliente y tenant desde `auth.uid()` y un vínculo activo.
3. Devolver sólo sus códigos históricos y sus dos paths privados.
4. Consumir la RPC desde un módulo `server-only` que no acepta ids ni paths.
5. Construir el cliente elevado sólo si existe al menos una foto para firmar.
6. Entregar a la página únicamente códigos y URLs firmadas; nunca los paths.

## Gobernanza

- `cumplimiento`: identidad y tenant se fijan dentro de la base.
- `cumplimiento` ERR-01: sin principal o ante fallo no se emiten URLs.
- `cumplimiento`: los paths no cruzan la frontera del firmador server-only.
- `no aplica`: nueva captura, escritura, borrado o cambio visual.

## Allowlist exacta

- `supabase/migrations/0405_portal_perfil_privado_por_principal.sql`
- `supabase/tests/0405_portal_perfil_privado_por_principal.test.sql`
- `lib/portal/profile-private-context.ts`
- `lib/portal/__tests__/profile-private-context.test.ts`
- `app/portal/(app)/perfil/page.tsx`
- `scripts/__tests__/portal-service-role-boundary.test.mjs`
- `docs/specs/0341-perfil-privado-portal-por-principal/spec.md`
- `docs/specs/README.md`
- `docs/audits/2026-09-02-codex-arranque-checklist.md`
- `.agents/handoffs/2026-09-02-portal-profile-private-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

## Aceptación

- La RPC no recibe ids ni paths y sólo permite `EXECUTE` a `authenticated`.
- Tenant A no observa códigos o paths de tenant B.
- Vínculos revocados y clientes eliminados no obtienen contexto.
- Sin fotos no se construye `service_role`; con fotos sólo se firman los paths
  retornados por la RPC.
- Perfil sale del inventario RSC; baseline: 7 rutas / 14 construcciones.
- SQL, unitarios, TypeScript, ESLint, docs, gobernanza, componentes y diff pasan.

## Fuera de alcance

- Subir, reemplazar o borrar fotos.
- Cambiar historial de Shipping Marks o policies del bucket.
- Aplicar 0405 a Cloud o desplegar Producción.
