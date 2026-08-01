---
sdd: "0234"
title: "Cancelación gobernada de órdenes de despacho"
status: done
author: "Sam (founder) + Codex"
created: 2026-08-01
updated: 2026-08-01
supersedes: null
superseded_by: null
related: ["0029", "0030", "0174", "0219"]
confidencialidad: interno
---

# SDD-0234 — Cancelación gobernada de órdenes de despacho

## 1. Objetivo

Corregir exclusivamente la decisión R3 “Cancelar OD” identificada por
REV-SGE-039. La orden, sus metadatos de cancelación y AUD-01 cambian juntos bajo
rol, tenant, estado esperado, lock e idempotencia.

El slice no certifica el módulo completo ni modifica creación, asignación,
salida, entrega o cierre. Los paquetes no se borran: vuelven a ser elegibles por
la regla existente que excluye únicamente ODs activas.

## 2. Decisiones

- La capability conserva los editores existentes: membresías activas `admin`,
  `operations` y `warehouse`.
- El RPC acepta estados vivos `creada`, `cargando`, `lista` o `en_ruta` y exige
  el estado observado por la UI para detectar carreras.
- La cancelación fija estado, motivo, actor y fecha en una transacción y agrega
  AUD-01 con conteo de paquetes y disposición explícita.
- `request_ref` hace replay seguro; reutilizarla con otra orden, estado o motivo
  falla sin mutar.
- Un trigger bloquea la cancelación directa y sella el hito terminal.
- La UI usa `ConfirmDialog` canonical con motivo obligatorio, presión sostenida,
  foco seguro, pending/error y referencia estable.
- La cancelación no elimina filas de `dispatch_order_packages`; la consulta de
  elegibilidad ya libera los paquetes cuando la OD queda `cancelada`.

## 3. Políticas

| Política | Resultado del slice |
|---|---|
| SGE-00 | cumplimiento: OD, metadatos y auditoría cambian juntos |
| MP-01 | cumplimiento: rol activo, tenant y estado se verifican bajo lock en DB |
| BTN-01 | cumplimiento: abrir el diálogo no cancela la OD |
| HTD-01 | cumplimiento: presión sostenida + alternativa accesible |
| AUD-01 | cumplimiento: actor, motivo, request ref y paquetes quedan atómicos |
| ERR-01 | cumplimiento: errores públicos estables y carreras visibles |
| FRM-01 | cumplimiento: motivo obligatorio preservado al fallar |
| LOD-01 | cumplimiento: pending y doble envío bloqueados |
| A11Y-01 | cumplimiento: diálogo canonical, foco, teclado y live regions |
| NUM-01 | no aplica: la decisión no captura números |

## 4. Allowlist

- `.agents/plugins/plugins/erp-studio-governance/references/policy-registry.json`
- `app/studio/(app)/despacho/actions.ts`
- `app/studio/(app)/despacho/_components/CancelOdDrawer.tsx`
- `lib/studio/dispatch-types.ts`
- `lib/studio/dispatch-queries.ts`
- `lib/studio/__tests__/dispatch-order-cancellation-governance.test.ts`
- `supabase/migrations/0324_dispatch_order_cancellation_governance.sql`
- `supabase/tests/0324_dispatch_order_cancellation_governance.test.sql`
- `docs/specs/0234-despacho-cancelacion-od-gobernada/spec.md`
- `docs/specs/README.md`
- `docs/architecture/module-sdd-map.md`
- `docs/governance/README.md`
- `docs/governance/reviews/dispatch-r3-order-cancellation-implementation-2026-08-01.md`

## 5. Aceptación

- Rol no permitido, tenant ajeno y membresía deshabilitada no cancelan.
- Actualización directa y cambios posteriores del hito terminal fallan.
- Estado, motivo o request ref inválidos producen error y cero cambios.
- Replay idéntico recupera la misma evidencia; una request ref no sirve para
  otra orden, estado o motivo.
- Estado, motivo, actor, fecha y AUD-01 quedan atómicos.
- Una falla del writer de auditoría revierte toda la cancelación.
- Los paquetes permanecen relacionados y vuelven a ser elegibles por estado.
- Tests focales, contratos SQL, schema rebuild, TypeScript y validadores pasan.

## 6. Gates externos

La migración 0324 queda preparada y validada sólo en local. Aplicarla a
Producción exige autorización futura que nombre exactamente
`0324_dispatch_order_cancellation_governance`. Este slice no autoriza
0316–0323, Cloud, Vercel ni integración a `main`.
