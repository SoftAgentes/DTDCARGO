# Handoff — facturas borradas fuera de los lectores financieros (SDD-0465)

Fecha: 2026-09-14. Task ID: `facturas-borradas-lectores-financieros`.
Owner / sesión escritora: `worker-w1-facturas-borradas-20260914` (Worker Claude Code, asignado por la sesión Director del 2026-09-14). Sin subagentes.

Estado de la tarea: en-progreso.

- **Worktree:** `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/facturas-borradas-lectores-financieros` (preexistente, creado por el Director).
  - `guard` PASÓ y `claim --owner worker-w1-facturas-borradas-20260914` adquirido sobre el árbol limpio en `b07ad98b`.
- **Rama:** `codex/facturas-borradas-lectores-financieros`, creada desde `origin/main` `b07ad98bda4da35086d8207640321a7995fc8f24`. Sin upstream al arrancar.
- **SDD:** `docs/specs/0465-facturas-borradas-lectores-financieros/spec.md`. Reserva del Director en `codex/sdd-reserve-0465-facturas-borradas-lectores-financieros` (`fd11416711913df5f4f271fc5ac84f9c586a0c98`), incorporada con cherry-pick como `3aaad629`. No se reserva otro número.
- **Dependencias:** ninguna. No depende de 0414 ni de 0415. Sin migración: `0230_fix_rls_soft_delete_blocked` dejó el filtro de borrados en la capa de aplicación a propósito.
- **Permisos:** commits locales selectivos (`fix(studio): SDD-0465 — …`); publicar la rama y abrir PR en borrador contra `main`: SÍ. Sin merge, sin deploy, sin aplicar migraciones, sin leer filas de negocio, sin tocar ruleset ni borrar ramas. Producción Supabase no se toca.

## OBJETIVO ORIGINAL

Que ninguna factura con soft delete cuente, cobre ni reciba recordatorios en Studio: los lectores financieros filtran `deleted_at` y el borrado lógico solo acepta los estados que la spec fije con evidencia.

Aceptación asignada:

1. `listInvoices`, `getInvoiceByCode` e `invoiceKpis` (`lib/studio/invoice-queries.ts`) excluyen `deleted_at` no nulo (no existe vista de papelera para facturas).
2. `receivablesQueue` (`lib/studio/payment-queries.ts`) excluye facturas borradas, y con ella la cola de Cobranzas y los recordatorios por correo.
3. `financeInvoiceKpis` (`lib/studio/dashboard/dashboard-kpi-queries.ts`), `revenueByShipment` (`lib/studio/costing/queries.ts`) y `applicableInvoicesForReferrer` (`lib/studio/fidelizacion/referral-credit-queries.ts`) excluyen facturas borradas.
4. `softDeleteInvoice` (`app/studio/(app)/facturacion/actions.ts`) restringe el estado permitido y responde con mensaje claro cuando no procede; la regla queda escrita en la spec con su justificación.
5. Un test de regresión por lector con una factura borrada en el fixture; ningún test existente se debilita.

Alcance: los archivos citados, sus tests, la spec 0465, el índice de specs y este handoff. Exclusiones: RLS y migraciones (0230 y 0414 no se tocan); Portal y `lib/portal`; nada de la PR #21; `supabase/migrations-baseline.json` intacto.

## COMPLETADO

En progreso; se completa al cierre.

## VALIDACIÓN

En progreso; se completa al cierre.

## COMMITS

- `3aaad629` — cherry-pick de la reserva SDD-0465 (`fd114167`).

## PR / BRANCH

- Rama `codex/facturas-borradas-lectores-financieros`, base `main`, worktree arriba. PR: todavía ninguna.

## PENDIENTES DE ESTA TAREA

Toda la aceptación.

## FUERA DE ALCANCE DETECTADO

Se registra al cierre.

## HANDOFF AL DIRECTOR

Se registra al cierre.
