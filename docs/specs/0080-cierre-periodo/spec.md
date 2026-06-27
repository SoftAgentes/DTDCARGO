---
sdd: "0080"
title: "Cierre de período contable — bloquear asientos de períodos cerrados (close the books, estilo QBO)"
status: done
author: "Claude Code (carril cierre-periodo)"
created: 2026-06-14
updated: 2026-06-27
supersedes: null
superseded_by: null
related: ["0040", "0079", "0073"]
confidencialidad: interno
---

# SDD-0080 · Cierre de período contable

## Contexto

Ahora que **todas las transacciones postean** (factura/cobro/CxP/pago/gasto — SDD-0079 cerró el
ciclo), falta el control interno clásico de QuickBooks: **"cerrar los libros"**. Hoy cualquier
asiento es editable/anulable en cualquier momento — sin candado de período (SDD-0040 lo dejó como
futuro). Eso permite manipular retroactivamente meses ya reportados.

## Qué hace

El **admin** fija una `closing_date` por tenant. Los asientos con `entry_date <= closing_date`
quedan **read-only**: no se pueden crear, asentar, anular ni borrar. Para corregir algo de un
período cerrado, el admin **reabre** (mueve la fecha hacia atrás), corrige y vuelve a cerrar.

**Modelo simple, fail-closed:** se bloquea por `entry_date` (sin importar el estado del asiento).
Es lo más robusto y predecible: "nada con esa fecha o anterior se toca".

## Esquema (migración `0133_period_close.sql`)

- **`accounting_settings`** — singleton por tenant (`tenant_id` PK, `closing_date date null`,
  `locked_by`, `locked_at`, `updated_at`, `updated_by`). RLS: SELECT del tenant; INSERT/UPDATE
  **admin-only** (patrón `fiscal_settings` 0126); DELETE bloqueado; service_role total.
- **`get_accounting_closing_date(tenant_id)`** — helper `security definer` (`revoke execute from
  public, anon`) que el trigger usa para leer la fecha saltando RLS.
- **Trigger `journal_entries_validate_closing`** — `before insert or update or delete` en
  `journal_entries`: bloquea si **OLD o NEW** `entry_date <= closing_date` (no se puede "sacar" un
  asiento del período cerrado moviéndole la fecha). `raise check_violation`. Es `security invoker` →
  **aplica a todos los roles, incluido service_role** (los posteos automáticos con admin client
  también respetan el cierre).
- **Trigger `journal_lines_validate_closing`** — gemelo en `journal_lines` (el debe/haber real vive
  ahí): bloquea tocar las líneas de un asiento cerrado vía PATCH directo. Usa el helper
  security-definer `journal_entry_is_closed(entry_id)` (lee el entry padre saltando RLS, fail-closed).

`closing_date` nace NULL (período abierto). Sin seed. Aditiva, hereda RLS de las tablas existentes.

## Defensa en 2 capas

1. **Dura (DB):** el trigger es la verdad — nadie escribe en período cerrado, ni el admin client.
2. **App (UX):** los asientos (`createJournalEntry` / `postEntry` / `voidEntry` / `softDeleteEntry`)
   **y los gastos** (`createExpenseAction` / `updateExpenseAction` / `softDeleteExpenseAction`, web
   `/studio/gastos` + móvil `/m/erp`) chequean `isPeriodClosed()` antes de tocar la DB → mensaje
   claro en vez del error crudo del trigger. Así un gasto cuyo `occurred_at` cae en período cerrado
   no se crea/edita/borra (no diverge de su asiento congelado).

Los **posteos automáticos** que caigan en período cerrado fallan en best-effort (logean, no rompen
la transacción de origen). Editar/borrar un gasto cuyo asiento está cerrado deja el asiento intacto
(los libros cerrados son inmutables — comportamiento contable correcto).

## UI (admin-only, en /studio/contabilidad · tab Libro diario)

- Botón **"Cerrar período" / "Cierre: AAAA-MM-DD"** (admin) → drawer para fijar/mover la fecha o
  **reabrir** (quitar el cierre).
- Para no-admin: badge informativo **"Cerrado hasta AAAA-MM-DD"** cuando hay cierre.

## No-goals

- Cierre por mes con records `accounting_periods` (open/closed por período): el modelo de fecha
  única (QBO) alcanza para V1.
- Password de cierre (QBO opcional): el rol admin alcanza.
- Asiento de cierre de resultados (mayorización a utilidad retenida al cierre de ejercicio): futuro.

## Verificación

- `node scripts/verify.mjs` verde + `pnpm build` (turbopack) verde.
- Tests de `isPeriodClosed` en `lib/studio/accounting/__tests__/period-queries.test.ts` (igual,
  anterior, posterior, timestamps, cruce de año).
- E2E manual (con la migración aplicada): admin fija cierre al 31/05 → intentar crear/anular un
  asiento ≤ 31/05 da error de período cerrado; un asiento del 01/06 funciona; reabrir lo desbloquea.

## Estado / pendiente de coordinación

Implementado en `feat/cierre-periodo` (sin push). Pendiente de coordinación: **merge + push** y
**aplicar la migración 0133 a prod**.
