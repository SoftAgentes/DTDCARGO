---
sdd: "0077"
title: "Contabilidad estilo QuickBooks — proveedor→cuenta por defecto + cascada Tipo→Subtipo + gasto→cuenta del plan"
status: in-progress
author: "Claude Code (carril contabilidad-qbo)"
created: 2026-06-14
updated: 2026-06-14
supersedes: null
superseded_by: null
related: ["0040", "0044", "0039", "0021", "0052"]
confidencialidad: interno
---

# SDD-0077 · Contabilidad estilo QuickBooks (3 slices)

## Contexto

El operador de la contabilidad del Studio está acostumbrado a **QuickBooks Online**. La
investigación [`docs/architecture/contabilidad-qbo-online.md`](../../architecture/contabilidad-qbo-online.md)
recorrió QBO función por función y aisló **3 huecos accionables** — todos para **acelerar la carga
y cerrar el puente operación↔contabilidad**. Lo demás (plan de cuentas, asientos doble partida,
posteo automático, P&L/Balance) **ya existe** (SDD-0040/0021/0041/0044) y no se toca.

Esta spec implementa los 3 en una tanda.

## Alcance (3 slices)

### Slice 1 · Proveedor → cuenta de gasto por defecto ⭐
Como en QBO ("Default expense account"): el proveedor guarda una **cuenta de costo/gasto** y, al
crear su cuenta por pagar (CxP), esa cuenta se **autollena**.
- `suppliers.default_expense_account_id` (FK→`accounts`, `on delete set null`).
- Selector "Cuenta de gasto por defecto" en el drawer de proveedor (poblado solo con cuentas de
  costo/gasto, igual que el selector de la CxP).
- Precarga en `NewBillDrawer` (estado inicial + al cambiar de proveedor).
- **Defensa:** `createSupplier`/`updateSupplier` validan que la cuenta sea tipo `CGS` o `G` y
  postable (RLS ya la restringe al tenant; el posteo `bill-posting` revalida en uso).

### Slice 2 · Cuenta → cascada Tipo → Subtipo
Como el "esquema automatizado" de QBO (Account Type → Detail Type): al crear una cuenta, eliges el
**Tipo** (de los 6) y se filtran los **Subtipos** válidos.
- `accounts.subtype` (text, nullable). Solo organiza/agrupa; **el reporte P&L vs Balance lo sigue
  decidiendo `type`**, no el subtipo.
- `ACCT_SUBTYPES` por tipo en `lib/studio/account-types.ts` (set pensado para logística + trading
  China↔Venezuela).
- Cascada reactiva en `AccountDrawer` (al cambiar Tipo, se limpia un subtipo que no aplique).
- Las 84 cuentas sembradas siguen válidas sin subtipo (no hay backfill obligatorio).

### Slice 3 · Gasto → cuenta del plan
El gasto del operario (hoy `category` operativa, suelto de la contabilidad) se **imputa a una cuenta
del plan**.
- `expenses.account_id` (FK→`accounts`, `on delete set null`).
- Mapeo `EXPENSE_CATEGORY_ACCOUNT_CODE` (categoría → code de cuenta) + helper
  `resolveExpenseAccountId()` (resuelve a id por tenant). Centralizado: lo usan el alta web
  (`/studio/gastos`) y la móvil (`/m/erp`), y se re-imputa al editar.
- Backfill de los gastos vivos en la migración (mismo mapeo).
- **Imputación advisory:** NO genera asiento por ahora (para que los reportes puedan consolidar por
  cuenta sin doble carga). El asiento automático del gasto queda como paso futuro.
- **Nota (re-derivación):** `account_id` se deriva de la categoría y se re-deriva en cada edición
  (hoy no es editable a mano en la UI). Si en el futuro se agrega un selector de cuenta en el form de
  gasto, NO re-derivar incondicionalmente en el update (pisaría la imputación manual).

## Esquema (migración `0131_contabilidad_qbo.sql`)

| Tabla | Columna nueva | Tipo | Notas |
|---|---|---|---|
| `suppliers` | `default_expense_account_id` | `uuid` FK→accounts | on delete set null · índice parcial |
| `accounts` | `subtype` | `text` | nullable |
| `expenses` | `account_id` | `uuid` FK→accounts | on delete set null · índice parcial · backfill |

Columnas aditivas nullable → **heredan la RLS por tenant** de cada tabla; sin policies, funciones ni
grants nuevos.

## No-goals (esta tanda)

- Asiento automático del gasto (`expenses` → journal_entries).
- Conciliación bancaria · cash flow de 3 secciones.
- `display_name` / `payment_terms` en cliente (opcional, ver research §5).
- Trigger en DB para el tipo de `default_expense_account_id` (hoy validado en la action; hardening
  futuro).

## Verificación

- `node scripts/verify.mjs` verde (lint + typecheck + tests + docs:check).
- Tests de la lógica pura en `lib/studio/__tests__/contabilidad-qbo.test.ts` (subtipos, mapeo,
  normalización proveedor).
- E2E manual (tras aplicar la migración en un entorno con el plan sembrado):
  1. Proveedor → asignar cuenta por defecto → nueva CxP de ese proveedor → la cuenta llega precargada.
  2. Nueva cuenta → elegir Tipo → el selector de Subtipo se filtra; guardar; persiste el subtipo.
  3. Cargar un gasto (web y móvil) → el gasto queda con `account_id` según su categoría.

## Estado / pendiente de coordinación

Implementado en la rama `feat/contabilidad-qbo` (sin push). Pendiente de la ventana de coordinación:
**merge + push** y **aplicar la migración 0131 a prod**. La migración queda como archivo en la rama;
esta ventana no la aplica.
