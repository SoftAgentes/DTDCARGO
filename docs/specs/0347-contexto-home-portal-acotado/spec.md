---
sdd: 0347
title: Encapsular el contexto privado del home del Portal
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related:
  - SDD-0054
  - SDD-0101
  - SDD-0133
  - SDD-0335
confidencialidad: interno
---

# SDD-0347 — Contexto privado del home del Portal acotado

## Estado real

El home del Portal construía tres clientes `service_role`: uno para facturas DDP
pendientes, otro para el snapshot naviero y otro para resolver tenant + próximo
zarpe. El RSC les entregaba client id, Shipping Mark y shipment id.

## Decisión

1. Crear un contexto `server-only` que sólo reciba el cliente de sesión.
2. Resolver cliente y activación antes de toda lectura pesada; una cuenta
   pendiente no construye admin.
3. Obtener dashboard, arribo, envíos, perfil, actividad, visibilidad y asesor
   mediante sesión/RLS.
4. Reutilizar un único admin con client id, Shipping Mark y shipment id recién
   derivados para facturas pendientes, naviera y zarpe.
5. Si la elevación falla, conservar el contexto de sesión y devolver privados
   vacíos.

## Gobernanza

- `cumplimiento`: identidad e ids salen de sesión/RLS, no del RSC.
- `cumplimiento` ERR-01: fallo de admin no entrega datos internos.
- `cumplimiento`: una cuenta no activa no dispara trabajo privilegiado.
- `no aplica`: escritura, borrado, migración o cambio visual.

## Allowlist exacta

- `app/portal/(app)/page.tsx`
- `lib/portal/portal-home-private-context.ts`
- `lib/portal/__tests__/portal-home-private-context.test.ts`
- `scripts/__tests__/portal-service-role-boundary.test.mjs`
- `docs/specs/0347-contexto-home-portal-acotado/spec.md`
- `docs/specs/README.md`
- `docs/audits/2026-09-02-codex-arranque-checklist.md`
- `.agents/handoffs/2026-09-02-portal-home-context-close.md`
- `.agents/handoffs/2026-09-02-saneamiento-integral-close.md`

## Aceptación

- Sin cliente Portal no se consulta activación ni se eleva.
- Cuenta pendiente no carga dashboard ni construye admin.
- Cuenta activa usa exactamente un admin y sólo ids recién derivados.
- Fallo de admin preserva datos RLS y vacía facturas, naviera y zarpe.
- El home sale del inventario RSC; baseline: 1 ruta / 1 construcción.
- Unitarios, TypeScript, ESLint, docs, gobernanza, componentes y diff pasan.

## Fuera de alcance

- Cambiar activación, cálculo de KPIs, aceptación o navegación.
- Aplicar migraciones, desplegar o escribir en Cloud/Producción.
