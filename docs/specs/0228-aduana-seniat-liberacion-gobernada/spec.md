---
sdd: "0228"
title: "Liberación gobernada de Aduana SENIAT"
status: done
author: "Sam (founder) + Codex"
created: 2026-07-31
updated: 2026-07-31
supersedes: null
superseded_by: null
related: ["0018", "0017", "0219"]
confidencialidad: interno
---

# SDD-0228 — Liberación gobernada de Aduana SENIAT

## 1. Objetivo

Corregir exclusivamente la transición R3 `pagado → liberado` identificada por
REV-SGE-037. La decisión debe verificar actor, tenant, rol, estado, fecha, los
seis documentos obligatorios e idempotencia en PostgreSQL. Filing, shipment,
timeline y AUD-01 cambian juntos o ninguno cambia.

No se certifica el módulo completo ni se modifica la carga, los montos, el
checklist documental, el agente, el arribo o el flujo posterior de despacho.

## 2. Decisiones

- La capability admite membresías activas `admin`, `operations` y `accounting`,
  coherente con el gate vigente de SENIAT.
- La única precondición aceptada es filing `pagado` y shipment `in_customs`.
- Los seis documentos requeridos son factura comercial, packing list, BL,
  certificado de origen, DUA y comprobante de pago. El permiso sanitario
  conserva su carácter condicional de SDD-0018.
- La UI usa `ConfirmDialog` canonical con DUA, shipment, agente, fecha,
  consecuencia, motivo obligatorio, presión sostenida y alternativa accesible.
- El RPC bloquea filing, shipment y documentos antes de validar y escribir.
- Un trigger impide que PostgREST o la action genérica declaren `liberado`.
- `liberado` es terminal; estado y `cleared_at` no pueden reescribirse después.
- `request_ref` hace replay seguro. Reutilizarla con otro payload o filing falla.
- Filing, shipment, `shipment_events` y `customs_filing_cleared` se escriben en
  una transacción. El evento durable conserva actor, motivo y referencia.
- La action traduce errores técnicos a copy público estable.

## 3. Políticas

| Política | Resultado del slice |
|---|---|
| SGE-00 | cumplimiento: el éxito exige convergencia transaccional |
| MP-01 | cumplimiento: rol, tenant y estados se verifican bajo lock en DB |
| BTN-01 | cumplimiento: el primer clic sólo abre la confirmación |
| HTD-01 | cumplimiento: presión sostenida + alternativa accesible |
| AUD-01 | cumplimiento: actor, motivo, request ref y mutación son atómicos |
| ERR-01 | cumplimiento: errores públicos estables y referencia segura |
| FRM-01 | cumplimiento: motivo obligatorio preservado ante error |
| LOD-01 | cumplimiento: pending y doble envío bloqueados |
| UPL-01 | excepción: el slice valida flags; no adopta Storage transversal |
| NUM-01 | no aplica: los montos sólo se presentan |

## 4. Allowlist

- `docs/specs/0228-aduana-seniat-liberacion-gobernada/spec.md`
- `docs/specs/README.md`
- `docs/architecture/module-sdd-map.md`
- `docs/governance/README.md`
- `docs/governance/reviews/customs-seniat-r3-clearance-implementation-2026-07-31.md`
- `app/studio/(app)/seniat/actions.ts`
- `app/studio/(app)/seniat/_components/FilingDetailDrawer.tsx`
- `lib/studio/customs-types.ts`
- `lib/studio/customs-queries.ts`
- `lib/studio/__tests__/customs-clearance-governance.test.ts`
- `supabase/migrations/0318_customs_clearance_governance.sql`
- `supabase/tests/0318_customs_clearance_governance.test.sql`

## 5. Aceptación

- Rol no permitido, tenant ajeno y membresía deshabilitada no mutan.
- `UPDATE` directo y la action genérica no pueden declarar `liberado`.
- Filing que no está `pagado`, shipment que no está `in_customs` o documento
  obligatorio incompleto producen error y cero mutaciones parciales.
- Replay idéntico retorna `replayed` y conserva un evento y una auditoría.
- Request ref reutilizada con otro payload falla.
- Filing, shipment, timeline y AUD-01 quedan atómicos con actor y motivo.
- UI presenta objeto, fecha y consecuencia, exige motivo y bloquea doble envío.
- Tests focales, contratos SQL, TypeScript y validadores canónicos pasan.

## 6. Gates externos

La migración 0318 queda preparada y validada sólo en local. Aplicarla a
Producción exige autorización futura que nombre exactamente
`0318_customs_clearance_governance`. Este slice no autoriza 0316 de Nómina,
0317 de Financiero China, Cloud, Vercel ni integración a `main`.
