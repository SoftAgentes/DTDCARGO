---
sdd: 0345
title: Encapsular el contexto privado del detalle de envío del Portal
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related:
  - SDD-0042
  - SDD-0075
  - SDD-0101
  - SDD-0156
  - SDD-0335
confidencialidad: interno
---

# SDD-0345 — Contexto privado del detalle de envío acotado

## Estado real

`/portal/envios/[code]` construía dos clientes `service_role`: uno para firmar
paths suministrados por la página y otro para avisos, naviera y aceptación usando
ids también entregados por el RSC.

## Decisión

1. Crear un contexto `server-only` que sólo reciba el código visible.
2. Probar primero el envío mediante sesión/RLS y resolver el cliente Portal.
3. Leer documentos mediante sesión y firmar sólo esos paths.
4. Reutilizar un único admin acotado al shipment id recién verificado para
   avisos, naviera, tracking y aceptación.
5. Si la elevación falla, conservar envío y metadatos RLS, sin URLs ni datos
   internos.

## Gobernanza

- `cumplimiento`: propiedad del envío se fija antes de elevar.
- `cumplimiento` ERR-01: fallo de firma/admin no produce privados.
- `cumplimiento`: el RSC no puede suministrar ids, paths ni clientes admin.
- `no aplica`: escritura, borrado, migración o cambio visual.

## Allowlist exacta

- `app/portal/(app)/envios/[code]/page.tsx`
- `lib/portal/shipment-private-context.ts`
- `lib/portal/__tests__/shipment-private-context.test.ts`
- `scripts/__tests__/portal-service-role-boundary.test.mjs`
- `docs/specs/0345-contexto-detalle-envio-portal-acotado/spec.md`
- `docs/specs/README.md`
- `docs/audits/2026-09-02-codex-arranque-checklist.md`
- `.agents/handoffs/2026-09-02-portal-shipment-detail-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

## Aceptación

- Código vacío o envío ajeno no construyen admin.
- Los únicos paths firmados provienen de la lectura RLS del envío propio.
- Avisos, naviera, tracking y aceptación reciben sólo el shipment id comprobado.
- El detalle sale del inventario RSC; baseline: 3 rutas / 7 construcciones.
- Unitarios, TypeScript, ESLint, docs, gobernanza, componentes y diff pasan.

## Fuera de alcance

- Refrescar tracking, aceptar facturas o modificar documentos/avisos.
- Aplicar migraciones, desplegar o escribir en Cloud/Producción.
