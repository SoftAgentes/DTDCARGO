---
sdd: "0079"
title: "Asiento automático del gasto — expenses → journal_entries (cierra el ciclo contable)"
status: done
author: "Claude Code (carril gasto-asiento)"
created: 2026-06-14
updated: 2026-06-27
supersedes: null
superseded_by: null
related: ["0077", "0040", "0039", "0044"]
confidencialidad: interno
---

# SDD-0079 · Asiento automático del gasto

## Contexto

Hoy **factura, cobro, CxP y pago de proveedor** generan asiento automático
(`invoice/receipt/bill/supplier-payment-posting.ts`). El **gasto operativo** era la
**única transacción sin posteo** — aparecía en los KPI de gastos pero **no en el
P&L/Balance**. SDD-0077 dejó listo `expenses.account_id` (la cuenta del plan) pero
**difirió** el posteo por miedo a "doble carga" en reportes.

**Auditoría (2026-06-14):** el temor era infundado. El P&L (`accounting/reports.ts`)
se calcula **solo** de `journal_entries`/saldos del plan; la tabla `expenses` **no**
alimenta ningún reporte contable (sus KPI son operativos, segregados). Postear el gasto
**no duplica** nada — al contrario, hace que el P&L por fin incluya el gasto operativo.

## Qué hace

Al cargar un gasto (web `/studio/gastos` y móvil `/m/erp`) se genera un asiento
`asentado` con `source='expense'`:

```
DR  account_id            (cuenta de gasto imputada, SDD-0077; 5./6.)   = amount_usd
CR  caja/banco según method                                            = amount_usd
```

El gasto es un **desembolso directo** (el operario ya pagó): por eso el haber es la
cuenta de caja/banco (no "por pagar" como la CxP). La contrapartida se elige del
`method` (`EXPENSE_METHOD_ACCOUNT_CODE` en `lib/studio/accounting/expense-posting.ts`):

| `method` | Cuenta haber | Code |
|---|---|---|
| cash | Caja chica | 1.1.1.1 |
| transfer | Banco cuenta corriente | 1.1.1.2 |
| card | Tarjeta de crédito (pasivo) | 2.1.2 |
| usdt | Banco USD | 1.1.1.3 |

*Convención editable; si la cuenta no está sembrada en el plan del tenant, no se asienta
(skip graceful, no bloquea la carga del gasto).*

## Ciclo de vida (web + móvil)

- **Crear** → postea el asiento (best-effort; el gasto se guarda pase lo que pase).
- **Editar** → si cambió **monto, cuenta (categoría) o método**, **anula** el asiento
  anterior y **repostea** (si no cambió nada contable, no toca el asiento).
- **Borrar** (soft-delete) → **anula** el asiento.

Idempotente por `journal_entries.expense_id` (no duplica). Monto en USD funcional
(`amount_usd`). El asiento usa la fecha del gasto (`occurred_at`).

## Esquema (migración `0132_expense_posting.sql`)

| Tabla | Columna nueva | Tipo | Notas |
|---|---|---|---|
| `journal_entries` | `expense_id` | `uuid` FK→expenses | on delete set null · índice parcial + índice **único** parcial (≤1 asiento `asentado` vivo por gasto: blinda la carrera de doble-submit) |

`source` es `text` (no enum) → `'expense'` no requiere alterar tipo. Reusa
`next_entry_code` (RPC) y el enum `entry_status` (0078). Columna aditiva nullable →
hereda la RLS por tenant. Sin funciones/grants nuevos.

## No-goals

- Re-facturación del gasto `billable=true` al cliente (sigue siendo metadata; el asiento
  es el mismo para billable true/false). Futuro: gasto billable → CxC / `shipment_costs`.
- Conciliación bancaria · cash flow de 3 secciones.
- Asiento de gastos `external` que sean realmente capex (hoy todos van a gasto/CGS).

## Verificación

- `node scripts/verify.mjs` verde + `pnpm build` (turbopack) verde.
- Tests de la lógica pura en `lib/studio/accounting/__tests__/expense-posting.test.ts`
  (líneas balanceadas + mapeo por método).
- E2E manual (con el plan sembrado): cargar un gasto → aparece un asiento `A-YYYY-NNNN`
  DR cuenta de gasto / CR caja; editar el monto → se anula y repostea; borrar → se anula.
  El P&L ahora refleja el gasto.

## Estado / pendiente de coordinación

Implementado en `feat/gasto-asiento` (sin push). Pendiente de la ventana de coordinación:
**merge + push** y **aplicar la migración 0132 a prod**. Decisión de Sam (opcional): si la
convención de contrapartida por método no te convence, se ajusta `EXPENSE_METHOD_ACCOUNT_CODE`.
