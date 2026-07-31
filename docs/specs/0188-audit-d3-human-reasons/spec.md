---
sdd: "0188"
title: "Auditoría D3 — motivos humanos en cancelaciones comerciales"
status: done
author: "Sam (founder) + Codex"
created: 2026-07-31
updated: 2026-07-31
supersedes: null
superseded_by: null
related: ["0071", "0072", "0174", "0187"]
confidencialidad: interno
---

# SDD-0188 — Auditoría D3 · motivos humanos en cancelaciones comerciales

## 1. Problema

D3 garantiza que la mutación comercial y su evento comparten transacción, pero
los callers de cancelación de órdenes de compra y venta sustituían el contexto
humano por una frase estable del trigger. Esa frase identifica el flujo, no la
decisión concreta.

## 2. Decisión

Las cancelaciones manuales de OC y OV:

1. conservan el grafo de estados vigente;
2. usan `ConfirmDialog` canonical con motivo obligatorio;
3. validan entre 4 y 1000 caracteres en UI, servidor y PostgreSQL;
4. llaman una RPC security-invoker de una sola transición;
5. fijan el motivo como contexto local de esa transacción;
6. dejan que el trigger D3 escriba el evento o aborte la mutación.

El slice reutiliza el wrapper aprobado por SDD-0187. No agrega un segundo
writer, no expone INSERT sobre el ledger y no copia el motivo al payload.

## 3. Allowlist

- `supabase/migrations/0295_audit_d3_human_reasons.sql`
- `supabase/tests/0295_audit_d3_human_reasons.test.sql`
- `lib/studio/purchase-orders/actions.ts`
- `app/studio/(app)/ordenes-compra/_components/PoDrawer.tsx`
- `lib/studio/sales-orders/actions.ts`
- `app/studio/(app)/ordenes-venta/_components/OvDrawer.tsx`
- esta spec, revisión, registro, mapa, índice generado y línea base.

No abre nuevas transiciones, cancelaciones masivas, formularios adicionales,
otros dominios, Cloud, Vercel ni Producción.

## 4. Aceptación

- los dos callers exigen motivo humano;
- motivo inválido no muta;
- estados no elegibles devuelven `false` sin mutación;
- cada éxito produce el motivo exacto sin ampliar el payload;
- `anon` no ejecuta las RPC;
- el fallo forzado del writer revierte la cancelación;
- pruebas SQL terminan en rollback;
- typecheck, lint proporcional y gates documentales pasan.

## 5. Resultado y aplicación

El slice local retira la no conformidad D3 descrita por REV-AUD-020. La
migración `0295_audit_d3_human_reasons` fue autorizada nominalmente, aplicada
individualmente y verificada en Producción el 2026-07-31. El ledger, las dos
RPC security-invoker y sus ACL quedaron conformes según
[REV-AUD-046](../../governance/reviews/aud-sdd-0174-prod-close.md).
