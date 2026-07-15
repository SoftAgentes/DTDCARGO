# SDD-0137 — Crédito de referido auto-aplicado (Modo Yunque)

Rama `feat/credito-ref` · worktree `DTD-worktrees/credito-ref`. **Toca dinero**
(Facturación/CxC/Contabilidad) → leer con lupa lo marcado 🔴 **REVISAR FOUNDER**.

## Qué hace
Convierte el crédito **acreditado** del referidor ($80, SDD-0051 Slice C) en un
crédito **aplicado** que baja la CxC del referidor en su próxima factura y genera
un asiento contable. **El sistema PROPONE, accounting APLICA** (fail-closed).

## Modelo del crédito — Opción A (decisión del founder)
Se **deriva de `referrals`** (sin tabla ledger). Un referido `acreditado` = un
crédito de $80; aplicarlo = transición de estado **`acreditado → aplicado`**
(mismo patrón idempotente-por-estado que la acreditación de Slice C, migr 0197).
Se agregó a `referrals`: estado `aplicado` + `applied_invoice_id`,
`applied_entry_id`, `applied_at`.

- Limitaciones asumidas de Opción A (vs ledger Opción B del spec): **no** hay
  aplicación parcial ni arrastre de remanente ni créditos no-referido. V1 aplica
  el crédito **entero** solo a facturas con `total ≥ crédito` (spec §3.4, §7).

## El setting configurable (clave) — `referral_credit_mode`
El reflejo fiscal va **CONFIGURABLE**, no hardcodeado. Vive en
`fiscal_settings.referral_credit_mode` (la config contable/fiscal per-tenant,
patrón SDD-0073). Lo lee la lógica de posting; el founder lo cambia **sin
re-código** (flip en DB, o una UI futura de config fiscal).

| modo | default | asiento al aplicar ($80) | efecto |
|---|---|---|---|
| `marketing_expense` | ✅ **default** | **DR 6.11** Publicidad y marketing / **CR 1.1.2** CxC clientes | gasto de incentivo; **no toca base ni IVA** (recomendación spec §3.2/§3.3) |
| `commercial_discount` | — | **DR 4.9** Descuentos sobre ventas (contra ingreso) / **CR 1.1.2** CxC clientes | rebaja de precio; reduce el ingreso neto |

En **ambos** modos el HABER es `1.1.2` CxC (el referidor paga $80 menos); solo
cambia la cuenta del DEBE. La factura fiscal se emite **completa** y queda
intacta (el crédito se aplica en la capa de saldo/CxC, no como línea que altere
la base). Todas las cuentas ya están sembradas en el CoA (seed migr 0078).

🔴 **REVISAR FOUNDER:** confirmar el default `marketing_expense` y si el contador
prefiere el devengo en dos pasos (pasivo `2.1.7`, spec §3.3) — quedó fuera de V1.

## Gate de accounting (fail-closed, mueve plata)
- `applyReferralCredit` y `listApplicableInvoices` llaman
  **`moduleEditDenial(supabase, "accounting")`** de verdad → solo rol
  `accounting`/`admin` (MONEY_MODULES, SDD-0085). Un rol sin permiso de dinero
  recibe "No tienes permiso…" y **no** pasa nada.
- El botón "Aplicar a factura" de la UI solo se muestra a rol dinero
  (`canEditModule(role,"accounting")` en la page), pero el gate REAL vive en la
  server action (invocable directo como endpoint).

## Idempotencia + concurrencia (en DB)
- **Claim atómico**: `UPDATE referrals SET status='aplicado', … WHERE id=? AND
  status='acreditado' RETURNING id`. El filtro por estado + el **row-lock** de
  Postgres hacen que un segundo intento (doble-submit/carrera) devuelva 0 filas
  → no re-aplica, no duplica asiento. Es el patrón aceptado del repo (migr 0197).
- Si el asiento **no** se pudo crear (falta cuenta del plan, etc.) → se **revierte**
  el claim (vuelve a `acreditado`, limpia el rastro): todo-o-nada. Mover plata sin
  asiento sería peor que no moverla.
- Constraint de coherencia `referrals_credit_applied_coherent` (no referencia el
  literal del enum → seguro junto al `ADD VALUE`): un crédito aplicado tiene
  factura+timestamp juntos; el asiento solo existe si hay factura aplicada.

## Reversión al anular factura (spec §3.6)
`voidInvoice` (Facturación) llama best-effort `revertReferralCreditsForInvoice`:
por cada crédito `aplicado` con `applied_invoice_id = <factura anulada>` →
anula su asiento (`journal_entries.status='anulado'`) + devuelve el crédito a
`acreditado` + limpia el rastro. Idempotente. El crédito no se "quema" por una
factura que no existió.

## Archivos
**Migración (NO aplicada — la aplica el founder):**
- `supabase/migrations/0237_referral_credit_apply.sql` — enum value `aplicado` +
  columnas `applied_*` en `referrals` + constraint + índice + columna
  `referral_credit_mode` en `fiscal_settings`. Aditiva, sin DDL destructivo, RLS
  ya cubierta por las policies existentes de ambas tablas.

**Lógica:**
- `lib/studio/accounting/referral-credit-posting.ts` — `buildReferralCreditLines`
  (puro), `postReferralCreditJournalEntry` (best-effort, mode-aware),
  `voidReferralCreditEntry`, `revertReferralCreditsForInvoice`.
- `lib/studio/fidelizacion/referral-credit-queries.ts` — `getReferralCreditMode`
  (default `marketing_expense`), `applicableInvoicesForReferrer`.
- `lib/studio/fidelizacion/types.ts` — `ReferralStatus` +`aplicado`,
  `REFERRAL_STATUS.aplicado`, columnas `applied_*` en `Referral`.
- `lib/studio/fidelizacion/queries.ts` — créditos ganados/emitidos cuentan
  `aplicado` además de `acreditado`.
- `app/studio/(app)/fidelizacion/actions.ts` — `applyReferralCredit`,
  `listApplicableInvoices` (con gate accounting).
- `app/studio/(app)/facturacion/actions.ts` — hook de reversión en `voidInvoice`.

**UI (solo tokens `var(--*)`, DrawerShell existente):**
- `app/studio/(app)/fidelizacion/page.tsx` — resuelve `canApplyCredit` + `creditMode`.
- `.../_components/FidelizacionClient.tsx` — pasa props + muestra créditos aplicados.
- `.../_components/ReferralDrawer.tsx` — panel "Aplicar $80 a una factura" (picker
  de facturas elegibles + botón, solo rol dinero) + resumen del crédito aplicado.

**Portal (solo lee; alineado al nuevo estado):**
- `app/portal/(app)/referidos/page.tsx` — badge `aplicado`.
- `lib/portal/portal-referral-queries.ts` — créditos ganados cuentan `aplicado`.

**Tests (Vitest):**
- `lib/studio/accounting/__tests__/referral-credit-posting.test.ts` — balance
  DR=CR, XOR, cuentas por modo, mapa de códigos, guard de modo.
- `lib/studio/fidelizacion/__tests__/referral-credit-queries.test.ts` — modo por
  defecto/inválido, filtro `total ≥ crédito`.

## Cómo lo verifiqué
- `node scripts/verify.mjs` → **VERDE** (lint · rsc-boundary · typecheck · test
  3538 · docs:check · e2e).
- Tests nuevos + `queries.test.ts`/`types.test.ts` existentes en verde (factory
  de test actualizada con los campos `applied_*`).

## Fuera de alcance (V1 → V2, spec §7)
Aplicación parcial + arrastre · auto-aplicar sin humano · devengo al acreditar
(pasivo 2.1.7) · vencimiento del crédito · créditos no-referido (Club DTD) ·
nota de crédito fiscal · aplicar a facturas VES/CNY (fx).

🔴 **Pendiente founder (dinero):** (1) confirmar default `marketing_expense`;
(2) aplicar la migración 0237 a prod; (3) decidir con el contador si el devengo
va en un paso (hoy) o dos (V2).
