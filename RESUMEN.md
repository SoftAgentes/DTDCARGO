# SDD-0137 — Crédito de referido auto-aplicado (Modo Yunque)

Rama `feat/credito-ref` · worktree `DTD-worktrees/credito-ref`. **Toca dinero**
(Facturación/CxC/Contabilidad) → leer con lupa lo marcado 🔴 **REVISAR FOUNDER**.

---

## ⚠️ Cierre de huecos de dinero (review adversarial · 2ª pasada)

El review `.harness/progress/review_credito-ref.md` marcó 3 🟡 + 1 🟢. Cómo quedó cada uno:

### A — Over-credit en facturas 'parcial' → CERRADO
Antes se validaba `total_amount ≥ crédito`. Una factura 'parcial' con `paid_amount`
alto (ej. total $100, pagado $95, saldo $5) pasaba y regalaba $80 → CxC negativa.
**Fix:** se valida contra el **SALDO real** (`total − paid ≥ crédito`) tanto en la
action (`applyReferralCredit`) como en el picker (`applicableInvoicesForReferrer`,
que ahora expone `paid_amount` + `balance`). **Elección: RECHAZAR** (V1 no parte el
crédito) con mensaje que muestra el saldo — lo simple y seguro. La UI del picker
ahora muestra "saldo $X" en vez del total.

### B — Linkage no atómico → asiento huérfano + doble asiento → CERRADO
Si el proceso moría entre el claim y el seteo de `applied_entry_id`, quedaba el
asiento vivo con `applied_entry_id=NULL`; la reversa lo saltaba (dependía de ese
campo) → asiento huérfano + crédito re-aplicable ($80 doble). **Fix en 3 capas:**
1. **Link en DB por `journal_entries.referral_id`** (columna nueva en migr 0237):
   el asiento se ata al referral desde el INSERT, no depende de un 2º UPDATE.
2. **UNIQUE parcial `journal_entries_referral_credit_uniq`** `(tenant_id, referral_id)
   WHERE source='referral_credit' AND status<>'anulado' AND deleted_at IS NULL`:
   idempotencia **DURA en DB** — un 2º asiento vivo del mismo crédito falla (23505),
   el posting lo trata como "ya existe" y devuelve el asiento vivo (no duplica).
3. **La reversa barre por `referral_id`** (no por `applied_entry_id`): anula el
   asiento aunque el link quede NULL por un crash → **sin huérfanos**.

### C — El crédito no bajaba el subledger de la factura → CERRADO (opción consistente)
El asiento bajaba la CxC en el GL (CR 1.1.2) pero `invoices.paid_amount` quedaba
igual → GL ≠ subledger y el beneficio no se "entregaba" por saldo. **Fix:** el
crédito se registra como **abono NO-MONETARIO** en la factura del referidor —
`applyReferralCredit` sube `paid_amount` en el monto del crédito y recalcula status
(`parcial`/`pagada`), con la misma traza (`applied_at`→`last_payment_at`). NO crea
`payment_receipt` (no entró caja): es un abono por crédito. La reversa
(`revertReferralCreditsForInvoice`) **baja** `paid_amount` de vuelta. Así GL↔subledger
quedan consistentes. Mismo mecanismo de saldo que usa `identifyPaymentFor` (0068).
- 🔴 **REVISAR FOUNDER:** si una factura queda **totalmente saldada por el crédito**
  (saldo == $80), pasa a `pagada` y `voidInvoice` **bloquea** anularla (regla
  existente "no se anula una pagada"). Es un estado terminal correcto (factura
  liquidada), pero la reversa por void no es alcanzable en ese caso puntual.

### D — Rollback de header sin guardia → CERRADO (menor)
En `postReferralCreditJournalEntry`, si falla el insert de líneas se borra el
header; **si el DELETE falla**, ahora hay **fallback**: se marca el asiento
`anulado` (no queda un asiento 'asentado' 0=0 vivo que además tape el UNIQUE del reintento).

**Tests agregados:**
- `referral-credit-queries.test.ts` → Fix A: 'parcial' con saldo < crédito se
  excluye aunque total ≥ crédito; expone `paid_amount`/`balance`.
- `referral-credit-revert.test.ts` (nuevo) → Fix B: anula el asiento barriendo por
  `referral_id` con `applied_entry_id=NULL` (sin huérfano); Fix C: baja `paid_amount`;
  reversa idempotente (2ª pasada = 0, saldo no se descuenta doble).

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
