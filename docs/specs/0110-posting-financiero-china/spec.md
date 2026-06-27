---
sdd: "0110"
title: "Cablear el posting contable del Financiero con el Socio Logístico China (wiring de SDD-0059)"
status: draft
author: "Claude Code (carril sdd0110-posting-china)"
created: 2026-06-26
updated: 2026-06-26
supersedes: null
superseded_by: null
related: ["0059", "0079", "0101", "0040"]
confidencialidad: confidencial
---

# SDD-0110 · Posting contable del Financiero China (wiring)

## Contexto

SDD-0059 (migr 0114/0115) cerró la mitad "China / proveedor" del ERP: cuenta corriente
bilateral USD+RMB, cargos del socio, notas de crédito, conversión de divisa (spread forex =
revenue) y cruce contable reclamo→cliente. La lib `lib/studio/partner-finance/posting.ts`
incluso **construye** los asientos de doble partida (`buildChargeLines` / `buildConversionLines` /
`buildClaimOffsetLines`) y un poster idempotente (`post*JournalEntry`).

**El problema (audit):** esos posters **nunca se invocaban**. `actions.ts` no importaba
`posting.ts`, no había server actions para conversión ni cruce, y `journal_entry_id` quedaba
**siempre NULL**. El dominio registraba los movimientos pero **no los contabilizaba**.

## Decisión

Cablear el posting al alta de los tres eventos del dominio, sin cambiar la lógica contable ya
escrita y testeada de `posting.ts`. Patrón espejo de SDD-0079 (asiento del gasto) y SDD-0101
(`syncClaimIndemnityEntry`): wrappers best-effort que postean + escriben el back-pointer.

### 1. Migración 0178 (aditiva, no destructiva)

`currency_conversions` ya tenía `journal_entry_id` desde 0114. Faltaba en las otras dos:

- `supplier_charges.journal_entry_id` — back-pointer al asiento de causación.
- `supplier_claim_offsets.journal_entry_id` — back-pointer al asiento de neutralización.

Columna `uuid` nullable, FK `on delete set null`, índice parcial. RLS **no se toca** (las
policies por `tenant_id` de 0114 cubren la columna nueva). Sin DROP/ALTER de columnas, sin
backfill destructivo. NO se aplica a prod desde el harness (lo hace el founder).

### 2. Wrappers de wiring (`posting.ts`)

`syncChargeJournalEntry` / `syncConversionJournalEntry` / `syncClaimOffsetJournalEntry`:
1. llaman al poster existente (idempotente por `journal_entries.{charge_id,conversion_id,claim_offset_id}`, índices ya creados en 0114);
2. escriben el back-pointer `journal_entry_id` en la fila origen **sólo si sigue NULL** (`is journal_entry_id null` → no pisa un valor previo), filtrando por `tenant_id` (el admin client bypasea RLS → scoping explícito);
3. son **best-effort**: no throwean — el alta ya quedó persistida; si el asiento falla se logea y se puede re-postear (idempotente de punta a punta).

El check de idempotencia ahora devuelve el `entryId` del asiento existente (no sólo un `count`),
para que un reintento re-aplique el back-pointer aunque el asiento ya existiera.

### 3. Server actions (`financiero-china/actions.ts`)

- `addChargeAction` — tras `addCharge`, postea `syncChargeJournalEntry` (net = amount; un cargo
  nuevo no tiene notas de crédito). No asienta un cargo nacido `cancelado`.
- `addConversionAction` (**nueva**) — `addConversion` + `syncConversionJournalEntry` (monto =
  `commission_amount`). Comisión 0 (sin spread) no genera asiento.
- `addClaimOffsetAction` (**nueva**) — `addClaimOffset` + `syncClaimOffsetJournalEntry` (monto =
  `amount_usd`).

Validación con `validate*Input()` propios (no Zod), tenant vía RLS, `revalidatePath()`.

## Garantías contables

- **DR = CR**: el poster rechaza un set desbalanceado antes de insertar (defensa de doble
  partida); los builders balancean por construcción.
- **Idempotencia**: doble alta del mismo origen → un solo asiento (índice por FK de origen).
- **Tenant scoping**: el check de existencia y el write-back filtran por `tenant_id`; orígenes
  homónimos de otro tenant no se confunden; plan de cuentas de otro tenant → `missing-account`
  (skip graceful, no asienta).
- **`journal_entry_id` deja de ser NULL** tras el alta.

## Acceptance

1. Doble alta de un cargo/conversión/cruce → **un** asiento (idempotencia).
2. El asiento balancea **DR = CR** (= monto); un set desbalanceado no inserta nada.
3. El check de existencia + write-back **filtran por `tenant_id`**.
4. Tras el alta, la fila origen tiene `journal_entry_id` **no NULL** (deja de ser NULL).
5. `missing-account` / `zero-amount` → skip graceful (no rompe el alta).

Tests: `lib/studio/partner-finance/__tests__/posting-wiring.test.ts` (fake stateful del admin
client) — cubre los 5 criterios. La suite de `posting.test.ts` (builders puros) sigue verde.

## Fuera de alcance

- UI de alta de conversión / cruce (drawers) — Slice C de SDD-0059, diferido. Las actions
  quedan listas para cuando llegue la UI.
- Backfill de los asientos de filas históricas (todas las viejas quedan re-posteables por
  idempotencia; el founder decide cuándo correr el back-fill).
- Asiento de la nota de crédito (la causación ya usa el net; una NC posterior ajusta el net del
  cargo pero el asiento original no se reversa automáticamente — diferido).

## Riesgos

- El monto del cargo se asienta como **net = amount** al alta (sin notas de crédito todavía). Si
  luego se aplica una NC, el asiento de causación no se ajusta automáticamente (ver Fuera de
  alcance). Aceptable: la NC es un evento posterior y poco frecuente; el ajuste contable es
  trabajo futuro.
- Best-effort: si el posting falla (p.ej. falta el plan de cuentas), el movimiento queda sin
  asiento pero el alta no se pierde. Re-postear es seguro (idempotente).
