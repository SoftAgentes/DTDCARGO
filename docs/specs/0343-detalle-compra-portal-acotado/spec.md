---
sdd: 0343
title: Encapsular el detalle operativo de compras del Portal
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related:
  - SDD-0285
  - SDD-0307
  - SDD-0308
  - SDD-0335
confidencialidad: interno
---

# SDD-0343 — Detalle de compra del Portal acotado

## Estado real

`/portal/compras/[code]` verificaba primero la compra con la sesión, pero después
construía dos clientes `service_role` y les entregaba directamente el id y el
Shipping Mark desde el RSC.

## Decisión

1. Crear un facade `server-only` que sólo reciba el código de compra.
2. Resolver el cliente desde `auth.uid()` y releer la compra mediante sesión/RLS.
3. No construir `service_role` si principal o propiedad no quedan probados.
4. Reutilizar un único cliente interno para recepciones, fotos y packing list.
5. Fallar cerrado a un resumen sin datos si la elevación no está disponible.

## Gobernanza

- `cumplimiento`: elevación posterior a identidad y propiedad comprobadas.
- `cumplimiento` ERR-01: ausencia o fallo no produce datos operativos.
- `cumplimiento`: el RSC no puede suministrar ids internos ni clientes admin.
- `no aplica`: escritura, borrado, migración o cambio visual.

## Allowlist exacta

- `app/portal/(app)/compras/[code]/page.tsx`
- `lib/portal/purchase-operational-detail.ts`
- `lib/portal/__tests__/purchase-operational-detail.test.ts`
- `lib/portal/purchase-reception-queries.ts`
- `lib/portal/packing-list-queries.ts`
- `scripts/__tests__/portal-service-role-boundary.test.mjs`
- `docs/specs/0343-detalle-compra-portal-acotado/spec.md`
- `docs/specs/README.md`
- `docs/audits/2026-09-02-codex-arranque-checklist.md`
- `.agents/handoffs/2026-09-02-portal-purchase-detail-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

## Aceptación

- Código vacío, principal no Portal o compra ajena no construyen admin.
- Una compra propia usa un solo admin y sólo el id/markbox recién verificados.
- La página sale del inventario RSC; baseline: 5 rutas / 10 construcciones.
- Unitarios, TypeScript, ESLint, docs, gobernanza, componentes y diff pasan.

## Fuera de alcance

- Cambiar RLS, Storage, packing lists, recepciones o fotos.
- Aplicar migraciones, desplegar o escribir en Cloud/Producción.
