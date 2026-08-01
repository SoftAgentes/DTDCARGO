---
sdd: "0229"
title: "Pago gobernado de indemnización de Reclamos"
status: done
author: "Sam (founder) + Codex"
created: 2026-07-31
updated: 2026-07-31
supersedes: null
superseded_by: null
related: ["0040", "0102", "0147", "0219"]
confidencialidad: interno
---

# SDD-0229 — Pago gobernado de indemnización de Reclamos

## 1. Objetivo

Corregir exclusivamente la transición R3 `aprobado → pagado` identificada por
REV-SGE-039. La decisión debe verificar actor, tenant, rol, estado, monto, medio
de pago, período contable e idempotencia en PostgreSQL. Reclamo, asiento
balanceado y AUD-01 cambian juntos o ninguno cambia.

No se certifica el módulo completo ni se modifica la recepción, evaluación,
aprobación, evidencia, recupero del proveedor o experiencia del portal.

## 2. Decisiones

- La capability admite membresías activas `accounting` y `admin` del tenant.
- La única precondición aceptada es reclamo activo `aprobado`, con monto
  positivo y fecha efectiva dentro de un período contable abierto.
- El medio de pago confirmado debe coincidir con la resolución financiera
  persistida; si no existe, el default contractual es transferencia.
- La UI usa `ConfirmDialog` canonical con reclamo, cliente, monto, medio, fecha,
  consecuencia, motivo obligatorio, presión sostenida y alternativa accesible.
- El RPC bloquea el reclamo y la resolución financiera antes de validar.
- Un trigger impide que PostgREST o la action genérica declaren `pagado`.
- `pagado` es terminal: estado, monto, resolución y datos financieros quedan
  sellados después de completar la transacción.
- `request_ref` hace replay seguro. Reutilizarla con otro payload o reclamo
  falla sin mutaciones parciales.
- Reclamo, asiento con dos líneas balanceadas y evento
  `client_claim_indemnity_paid` se escriben en una transacción.
- La action traduce errores técnicos a copy público estable.

## 3. Políticas

| Política | Resultado del slice |
|---|---|
| SGE-00 | cumplimiento: el éxito exige estado, asiento y auditoría atómicos |
| MP-01 | cumplimiento: rol activo, tenant y estado se verifican bajo lock en DB |
| BTN-01 | cumplimiento: el primer clic sólo abre la confirmación |
| HTD-01 | cumplimiento: presión sostenida + alternativa accesible |
| AUD-01 | cumplimiento: actor, motivo, request ref y mutación son atómicos |
| ERR-01 | cumplimiento: errores públicos estables y referencia segura |
| FRM-01 | cumplimiento: motivo obligatorio preservado ante error |
| LOD-01 | cumplimiento: pending y doble envío bloqueados |
| NUM-01 | cumplimiento: monto monetario se valida en DB y sólo se presenta en UI |
| A11Y-01 | cumplimiento: diálogo canonical, foco, teclado y live regions |
| UPL-01 | no aplica: el pago no carga ni mueve archivos |

## 4. Allowlist

- `docs/specs/0229-reclamos-pago-indemnizacion-gobernado/spec.md`
- `docs/specs/README.md`
- `docs/architecture/module-sdd-map.md`
- `docs/governance/README.md`
- `docs/governance/reviews/client-claims-r3-indemnity-payment-implementation-2026-07-31.md`
- `.agents/plugins/plugins/erp-studio-governance/references/policy-registry.json`
- `app/studio/(app)/reclamos/actions.ts`
- `app/studio/(app)/reclamos/_components/ReclamosClient.tsx`
- `lib/studio/reclamos/claims-types.ts`
- `lib/studio/reclamos/claims-queries.ts`
- `lib/studio/reclamos/__tests__/claim-payment-governance.test.ts`
- `supabase/migrations/0319_claim_indemnity_payment_governance.sql`
- `supabase/tests/0319_claim_indemnity_payment_governance.test.sql`

## 5. Aceptación

- Rol no permitido, tenant ajeno y membresía deshabilitada no mutan.
- `UPDATE` directo y la action genérica no pueden declarar `pagado`.
- Estado inválido, monto cero, cuenta faltante, medio divergente o período
  cerrado producen error y cero mutaciones parciales.
- Replay idéntico retorna `replayed`; una request ref no sirve para otro pago.
- Reclamo, asiento balanceado y AUD-01 quedan atómicos con actor y motivo.
- Una falla del writer de auditoría revierte estado, cabecera y líneas.
- El hito pagado y su resolución financiera quedan inmutables.
- UI presenta objeto, monto, medio, fecha y consecuencia, exige motivo y bloquea
  doble envío.
- Tests focales, contratos SQL, TypeScript y validadores canónicos pasan.

## 6. Gates externos

La migración 0319 queda preparada y validada sólo en local. Aplicarla a
Producción exige autorización futura que nombre exactamente
`0319_claim_indemnity_payment_governance`. Este slice no autoriza 0316 de
Nómina, 0317 de Financiero China, 0318 de Aduana SENIAT, Cloud, Vercel ni
integración a `main`.
