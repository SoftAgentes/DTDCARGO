---
sdd: 0346
title: Encapsular el contexto privado del listado de envíos del Portal
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related:
  - SDD-0133
  - SDD-0170
  - SDD-0308
  - SDD-0335
confidencialidad: interno
---

# SDD-0346 — Contexto privado del listado de envíos acotado

## Estado real

`/portal/envios` construía tres clientes `service_role` en el RSC y les pasaba
listas de ids de compras/envíos y un client id para packing online,
consolidaciones y próximo zarpe.

## Decisión

1. Crear un contexto `server-only` sin parámetros de ids.
2. Resolver cliente, envíos, compras, proveedores, visibilidad y documentos con
   sesión/RLS.
3. Construir un único admin y entregarle sólo los conjuntos recién derivados.
4. Obtener el tenant del banner desde el client id resuelto dentro del contexto.
5. Si la elevación falla, conservar datos RLS y devolver packing,
   consolidaciones y zarpe vacíos.

## Gobernanza

- `cumplimiento`: ids y Shipping Mark se derivan desde sesión/RLS.
- `cumplimiento` ERR-01: fallo de admin no produce datos internos.
- `cumplimiento`: el RSC ya no puede suministrar colecciones a service_role.
- `no aplica`: escritura, borrado, migración o cambio visual.

## Allowlist exacta

- `app/portal/(app)/envios/page.tsx`
- `lib/portal/shipments-hub-private-context.ts`
- `lib/portal/__tests__/shipments-hub-private-context.test.ts`
- `lib/studio/prealertas/__tests__/document-presence.test.ts`
- `scripts/__tests__/portal-service-role-boundary.test.mjs`
- `docs/specs/0346-contexto-listado-envios-portal-acotado/spec.md`
- `docs/specs/README.md`
- `docs/audits/2026-09-02-codex-arranque-checklist.md`
- `.agents/handoffs/2026-09-02-portal-shipments-hub-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

## Aceptación

- Principal no Portal no ejecuta lecturas ni construye admin.
- Packing y consolidaciones reciben sólo ids derivados de datos RLS propios.
- El zarpe usa sólo el tenant resuelto desde el client id de sesión.
- Fallo de admin mantiene el hub con derivados privados vacíos.
- La página sale del inventario RSC; baseline: 2 rutas / 4 construcciones.
- Unitarios, TypeScript, ESLint, docs, gobernanza, componentes y diff pasan.

## Fuera de alcance

- Modificar compras, documentos, consolidaciones o zarpes.
- Aplicar migraciones, desplegar o escribir en Cloud/Producción.
