---
sdd: "0231"
title: "Entrega manual gobernada en Almacén VE"
status: done
author: "Sam (founder) + Codex"
created: 2026-08-01
updated: 2026-08-01
supersedes: null
superseded_by: null
related: ["0017", "0019", "0029", "0030", "0192", "0219"]
confidencialidad: interno
---

# SDD-0231 — Entrega manual gobernada en Almacén VE

## 1. Objetivo

Corregir exclusivamente el fallback R3 `out_for_delivery|last_mile → delivered`
identificado por REV-SGE-039. La decisión debe verificar actor, tenant, rol,
estado, receptor e idempotencia bajo lock. Shipment, timestamp, receptor,
timeline y AUD-01 cambian juntos o ninguno cambia.

Este fallback es una constancia manual. No se presenta ni se almacena como el
POD sellado de `dispatch_pods`, que conserva su flujo canonical en la PWA de
Despacho. No se certifica el módulo completo ni se crea una relación artificial
entre shipments y ODs.

## 2. Decisiones

- La capability admite membresías activas `admin`, `operations` y `warehouse`.
  `support` conserva su contrato global read-only.
- Las únicas precondiciones son shipment activo `out_for_delivery` o
  `last_mile`, receptor obligatorio y motivo humano.
- La UI cambia el nombre a “Confirmar entrega manual” y declara expresamente que
  no sustituye el POD sellado con foto y firma de la PWA.
- Tracking deja de ofrecer el bypass genérico a `delivered` y dirige la decisión
  hacia Almacén VE.
- El primer paso sólo identifica al receptor. La decisión irreversible usa
  `ConfirmDialog` canonical con motivo, presión sostenida y foco seguro.
- Un trigger impide que PostgREST o las actions genéricas declaren `delivered`.
- La entrega es terminal para estado, timestamp, receptor, dirección y borrado.
- `request_ref` hace replay seguro. Reutilizarla con otro payload falla.
- Shipment, `delivered_at`, receptor, timeline con actor y evento
  `shipment_delivery_manually_confirmed` se escriben en una transacción.

## 3. Políticas

| Política | Resultado del slice |
|---|---|
| SGE-00 | cumplimiento: estado, hito, timeline y auditoría son atómicos |
| MP-01 | cumplimiento: rol activo, tenant y estado se verifican bajo lock en DB |
| BTN-01 | cumplimiento: identificar receptor no ejecuta la entrega |
| HTD-01 | cumplimiento: presión sostenida + alternativa accesible |
| AUD-01 | cumplimiento: actor, motivo, request ref y mutación son atómicos |
| ERR-01 | cumplimiento: errores públicos estables y referencia segura |
| FRM-01 | cumplimiento: receptor y motivo son obligatorios y se preservan al fallar |
| LOD-01 | cumplimiento: pending y doble envío bloqueados |
| A11Y-01 | cumplimiento: diálogo canonical, foco, teclado y live regions |
| NUM-01 | no aplica: la decisión no captura números |
| UPL-01 | excepción: este fallback no captura archivos; el POD sellado sigue en PWA |

## 4. Allowlist

- `.agents/plugins/plugins/erp-studio-governance/references/policy-registry.json`
- `app/studio/(app)/ve/actions.ts`
- `lib/studio/rbac-actions-guard.test.ts`
- `app/studio/(app)/ve/_components/VeRowActions.tsx`
- `app/studio/(app)/tracking/[id]/actions.ts`
- `app/studio/(app)/tracking/[id]/_components/StateActionsPanel.tsx`
- `lib/studio/warehouse-ve-types.ts`
- `lib/studio/warehouse-ve-queries.ts`
- `lib/studio/__tests__/warehouse-ve-delivery-governance.test.ts`
- `supabase/migrations/0321_warehouse_ve_delivery_governance.sql`
- `supabase/tests/0321_warehouse_ve_delivery_governance.test.sql`
- `docs/specs/0231-almacen-ve-entrega-manual-gobernada/spec.md`
- `docs/specs/README.md`
- `docs/architecture/module-sdd-map.md`
- `docs/governance/README.md`
- `docs/governance/reviews/warehouse-ve-r3-delivery-implementation-2026-08-01.md`

## 5. Aceptación

- Rol no permitido, tenant ajeno y membresía deshabilitada no mutan.
- `UPDATE` directo y la action genérica de Tracking no declaran `delivered`.
- Estado o receptor inválidos producen error y cero cambios.
- Replay idéntico retorna `replayed`; una request ref no sirve para otro envío.
- Shipment, timestamp, receptor, timeline y AUD-01 quedan atómicos.
- Una falla del writer de auditoría revierte todos los efectos.
- El hito entregado y su receptor quedan inmutables.
- UI distingue la constancia manual del POD sellado, exige receptor y motivo y
  bloquea doble envío.
- Tests focales, contratos SQL, TypeScript y validadores canónicos pasan.

## 6. Gates externos

La migración 0321 queda preparada y validada sólo en local. Aplicarla a
Producción exige autorización futura que nombre exactamente
`0321_warehouse_ve_delivery_governance`. Este slice no autoriza 0316–0320,
Cloud, Vercel ni integración a `main`.
