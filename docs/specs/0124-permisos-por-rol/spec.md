---
sdd: "0124"
title: "Permisos por rol — matriz read-only rol × módulo (visualiza la config RBAC)"
status: done
author: "Claude Code (sesión secundaria · worktree web-norte) + founder"
created: 2026-07-01
updated: 2026-07-15
supersedes: null
superseded_by: null
related: ["0085"]
confidencialidad: interno
---

# SDD-0124 · Permisos por rol

> Quinta sección real de Administración. Sin migración: **matriz read-only** que
> visualiza la config RBAC de [[0085]].

## Contexto

El RBAC del Studio es **estático en código** (`ROLE_MODULE_ACCESS` +
`canAccessModule`/`canEditModule` en `lib/studio/rbac.ts`, sobre el registro
`MODULES`). No vive en DB (decisión SDD-0085: RLS por **tenant**, no por rol; el
rol se gatea app-level). Por eso esta sección **visualiza** la matriz, no la
edita.

## Alcance

- Tabla rol × módulo (módulos agrupados por área). Cada celda:
  - **TOTAL** — admin (todo).
  - **V·E** — ver + editar (`canEditModule` true).
  - **V** — solo ver (típico `support`).
  - **—** — sin acceso.
- Derivada en vivo de `canAccessModule`/`canEditModule` → siempre refleja la
  config real, sin duplicarla.

## Superficie de código

- `app/studio/(app)/admin/_components/PermissionsSection.tsx` — server-safe, sin
  hooks (la config es data pura).
- `app/studio/(app)/admin/page.tsx` — render de la sección.

## Follow-ups (fuera de alcance)

- Permisos **editables** por tenant → mover RBAC a DB (cambio arquitectónico
  grande, con implicancias de RLS). Es una spec propia, no un ajuste de admin.

## Estado

Código listo; `pnpm typecheck` + build en verde. Sin migración.
