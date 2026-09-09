---
sdd: 0336
title: Resolver la marca del Portal por el principal autenticado
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related:
  - SDD-0255
  - SDD-0335
confidencialidad: interno
---

# SDD-0336 — Resolver la marca del Portal por el principal autenticado

## Estado real

Dos Server Components del Portal resolvían la marca white-label construyendo un
cliente `service_role` y pasando un Shipping Mark obtenido previamente. La
consulta estaba acotada, pero la garantía dependía del orden y de filtros de la
aplicación; una página quedaba completamente elevada sólo para leer ocho campos
públicos de marca.

## Decisión

1. Crear `get_portal_brand()` sin parámetros.
2. Derivar la identidad exclusivamente de `auth.uid()` y una vinculación activa
   en `client_users`.
3. Devolver únicamente los ocho campos que consume `resolveBrand()`; no exponer
   tenant, ids, acuerdos ni tarifa del aliado.
4. Conceder ejecución sólo a `authenticated`; `anon`, `PUBLIC` y `service_role`
   quedan revocados.
5. Usar la RPC desde las páginas de etiqueta y comprobante, conservando DTD como
   fallback para cliente directo, vínculo revocado o error.

## Gobernanza

- `cumplimiento`: RBAC se aplica en la base y la identidad no se recibe del
  cliente.
- `cumplimiento` ERR-01: un error degrada a la marca segura existente, sin
  documento parcialmente configurado.
- `no aplica`: cambio visual, nueva captura de PII, escritura, borrado o
  publicación alojada.

## Allowlist exacta

- `supabase/migrations/0401_portal_brand_por_principal.sql`
- `supabase/tests/0401_portal_brand_por_principal.test.sql`
- `lib/studio/aliados/brand-resolve.ts`
- `lib/studio/aliados/__tests__/brand-resolve.test.ts`
- `app/portal/(app)/facturas/[code]/comprobante/page.tsx`
- `app/portal/(app)/compras/[code]/etiquetas/page.tsx`
- `scripts/__tests__/portal-service-role-boundary.test.mjs`
- `docs/specs/0336-marca-portal-por-principal/spec.md`
- `docs/specs/README.md`
- `docs/audits/2026-09-02-codex-arranque-checklist.md`
- `.agents/handoffs/2026-09-02-portal-brand-rpc-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

## Aceptación

- La RPC no recibe identificadores ni códigos del cliente.
- Una sesión activa sólo obtiene su propia marca; vínculos revocados, clientes
  directos y clientes eliminados no obtienen fila.
- La firma no incluye campos internos del aliado.
- Una página deja de construir `service_role` y otra baja de dos usos a uno; el
  baseline queda en 10 rutas y 21 construcciones.
- SQL, unitarios, TypeScript, ESLint, documentación, gobernanza y diff pasan.

## Fuera de alcance

- Aplicar `0401` a Cloud o desplegar Producción.
- Resolver los otros 21 usos de `service_role` en un barrido.
- Cambiar el diseño visual de etiquetas o comprobantes.
