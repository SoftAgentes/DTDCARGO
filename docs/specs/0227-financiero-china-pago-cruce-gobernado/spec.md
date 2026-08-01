---
sdd: "0227"
title: "Pago gobernado de cruce en Financiero China"
status: done
author: "Sam (founder) + Codex"
created: 2026-07-31
updated: 2026-07-31
supersedes: null
superseded_by: null
related: ["0059", "0110", "0115", "0219"]
confidencialidad: interno
---

# SDD-0227 — Pago gobernado de cruce en Financiero China

## 1. Objetivo

Corregir exclusivamente la transición R3
`reconocido_proveedor → pagado_en_china` identificada por REV-SGE-035. La
decisión debe validar actor, tenant, rol, estado, fecha, motivo e idempotencia en
PostgreSQL y dejar evidencia AUD-01 en la misma transacción.

No se certifica el módulo completo ni se modifican montos, asientos, creación de
cruces, aplicación al cliente, cierre, estados de cuenta o conversiones.

## 2. Decisiones

- La capability es admin-only, coherente con el gate vigente del módulo.
- La UI usa `ConfirmDialog` canonical con proveedor, monto, fecha efectiva,
  consecuencia, motivo obligatorio, presión sostenida y alternativa accesible.
- La fecha efectiva se envía explícita y no puede ser futura ni anterior al
  reconocimiento del proveedor.
- El RPC bloquea la fila, exige el estado esperado y actualiza estado+hito.
- Un trigger impide que PostgREST ejecute directamente el paso gobernado.
- `request_ref` hace replay seguro. Reutilizarla con otro payload o cruce falla.
- El evento `partner_claim_paid_in_china` guarda actor, tenant, motivo, origen,
  destino, fecha, proveedor, monto y request ref; una falla de auditoría revierte
  la transición.
- La action traduce permisos, validación, conflicto y ausencia a copy público y
  no expone errores SQL.

## 3. Políticas

| Política | Resultado del slice |
|---|---|
| SGE-00 | cumplimiento: una decisión, consecuencia y verdad de éxito |
| MP-01 | cumplimiento: rol y tenant en DB; estado bajo lock |
| BTN-01 | cumplimiento: el primer clic sólo abre confirmación |
| HTD-01 | cumplimiento: presión sostenida + alternativa accesible |
| AUD-01 | cumplimiento: evento y mutación atómicos |
| ERR-01 | cumplimiento: errores públicos estables y referencia segura |
| FRM-01 | cumplimiento: motivo obligatorio preservado ante error |
| LOD-01 | cumplimiento: pending y doble envío bloqueados |
| NUM-01 | no aplica: el monto sólo se presenta, no se edita |
| UPL-01 | no aplica |

## 4. Allowlist

- `docs/specs/0227-financiero-china-pago-cruce-gobernado/spec.md`
- `docs/specs/README.md`
- `docs/architecture/module-sdd-map.md`
- `docs/governance/README.md`
- `docs/governance/reviews/partner-finance-r3-claim-payment-implementation-2026-07-31.md`
- `app/studio/(app)/financiero-china/actions.ts`
- `app/studio/(app)/financiero-china/_components/ClaimOffsetsTab.tsx`
- `lib/studio/partner-finance/claim-offsets-queries.ts`
- `lib/studio/partner-finance/types.ts`
- `lib/studio/partner-finance/__tests__/claim-payment-governance.test.ts`
- `supabase/migrations/0317_partner_claim_payment_governance.sql`
- `supabase/tests/0317_partner_claim_payment_governance.test.sql`

## 5. Aceptación

- Rol no admin, tenant ajeno y membresía deshabilitada no mutan.
- `UPDATE` directo no puede declarar pagado en China.
- Estado previo distinto produce conflicto, nunca éxito falso.
- Fecha, motivo y request ref inválidos no mutan.
- Replay idéntico retorna `replayed` y conserva un solo evento.
- Request ref reutilizada con otro payload falla.
- Evento y transición son atómicos y preservan el actor.
- UI presenta proveedor, monto, fecha y consecuencia, exige motivo y bloquea
  doble envío.
- Tests focales, contratos SQL, TypeScript y validadores canónicos pasan.

## 6. Gates externos

La migración 0317 sólo queda preparada y validada localmente. Aplicarla a
Producción requiere autorización futura que nombre exactamente
`0317_partner_claim_payment_governance`. Este slice no autoriza 0316 de Nómina,
Cloud, Vercel ni integración a `main`.
