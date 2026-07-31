---
sdd: "0187"
title: "Auditoría D2 — motivos humanos en anulaciones financieras"
status: done
author: "Sam (founder) + Codex"
created: 2026-07-31
updated: 2026-07-31
supersedes: null
superseded_by: null
related: ["0021", "0040", "0041", "0044", "0166", "0174"]
confidencialidad: interno
---

# SDD-0187 — Auditoría D2 · motivos humanos en anulaciones financieras

## 1. Problema

D2 garantiza que la mutación financiera y su evento comparten transacción, pero
cinco callers legacy reemplazaban el contexto humano de una anulación R3 por
una frase estable del trigger. Esa frase permite identificar el flujo, no
explica la decisión.

## 2. Decisión

Las anulaciones de asiento, factura, recibo, cuenta por pagar y orden de pago:

1. usan `ConfirmDialog` canonical con motivo obligatorio;
2. validan entre 4 y 1000 caracteres también en el servidor;
3. llaman una RPC security-invoker de una sola operación;
4. fijan el motivo como contexto local de esa transacción;
5. dejan que el trigger D2 escriba el evento o aborte la mutación.

El wrapper de `append_audit_event` sólo prioriza ese contexto validado. Conserva
la firma, ACL append-only, payload mínimo y writer anterior como implementación
interna. No expone escritura del log a `authenticated`.

## 3. Allowlist

- `lib/studio/audit/reason.ts`
- `lib/studio/audit/__tests__/reason.test.ts`
- `supabase/migrations/0294_audit_d2_human_reasons.sql`
- `supabase/tests/0294_audit_d2_human_reasons.test.sql`
- `app/studio/(app)/contabilidad/actions.ts`
- `app/studio/(app)/contabilidad/_components/LibroDiarioTab.tsx`
- `app/studio/(app)/facturacion/actions.ts`
- `app/studio/(app)/facturacion/_components/InvoiceDetailClient.tsx`
- `app/studio/(app)/tesoreria/actions.ts`
- `app/studio/(app)/tesoreria/_components/BillDrawer.tsx`
- `lib/studio/treasury/treasury-actions.ts`
- `app/studio/(app)/cobranzas/actions.ts`
- `app/studio/(app)/cobranzas/_components/CobranzaDrawer.tsx`
- `lib/studio/collections-actions.ts`
- esta spec, revisión, registro, mapa, índice generado y línea base.

No abre eliminación de cuentas/borradores, migración masiva de formularios,
otros dominios, Cloud, Vercel ni Producción.

## 4. Aceptación

- los cinco callers exigen motivo humano;
- motivo inválido no muta;
- cada éxito produce el motivo exacto sin copiarlo al payload;
- `anon` no ejecuta las RPC y `authenticated` sólo usa las cinco fronteras;
- el writer continúa cerrado a `authenticated`;
- fallo forzado del writer revierte la mutación;
- pruebas SQL terminan en rollback;
- typecheck, Vitest, lint proporcional y gates documentales pasan.

## 5. Resultado y gate externo

El slice local retira la no conformidad D2 descrita por REV-AUD-019. La
migración `0294_audit_d2_human_reasons` no está autorizada ni aplicada en
Producción; hasta una autorización nominal individual, Producción conserva el
comportamiento legacy.
