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
