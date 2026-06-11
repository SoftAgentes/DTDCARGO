---
sdd: "0069"
title: "Rendición quincenal a la Operadora (SDD-D del handoff legal) — corte 1-15 / 16-fin, recaudado de terceros neto de servicios locales, snapshot inmutable + export"
status: approved
author: "handoff Claude Chat (capa legal) + Claude Code"
created: 2026-06-11
updated: 2026-06-11
supersedes: null
superseded_by: null
related: ["0068", "0041", "0040", "0044", "0059"]
confidencialidad: interno
---

# DTD-0069 — Rendición quincenal a la Operadora (SDD-D)

> Cuarta pieza de la capa legal (`docs/legal/HANDOFF_CAPA_LEGAL.md` §SDD-D + decisión
> #5: corte QUINCENAL días 15 y último). **Consume directamente lo que creó SDD-0068**:
> `payment_receipts.fund_class` (third_party|local_revenue), `application_status`
> (…|`rendido` ya DEFINIDO, transición diferida a ESTA spec) y `fundsSeparationSummary()`.
> Branch: `feat/capa-legal`.

## 1. Resumen en una línea

María cierra cada quincena una **rendición inmutable** a la Operadora: total recaudado de
**fondos de terceros** (flete internacional cobrado en su nombre) **neto** de los
**servicios locales facturados** por DTD Services, dando el **saldo a favor de la
Operadora**; emitir congela un snapshot, marca los recibos incluidos como `rendido` y
habilita el export (CSV detalle + hoja imprimible formal).

## 2. Por qué

- Handoff SDD-D: "Reporte automático (corte quincenal): recaudado por cliente y
  referencia, neteo de servicios locales facturados, saldo a favor de la Operadora.
  Export XLSX/PDF. Usuaria: María." Decisión #5 cerró el corte = **quincenal (días 15 y
  último)**.
- Cierra el ciclo de la arquitectura de 3 patas (handoff §1): Inversiones DTD Services es
  **agente de cobranza** — el dinero de flete que recauda es de la Operadora y debe
  **rendirse**. SDD-0068 separó los fondos (`fund_class`) y dejó `rendido` esperando su
  productor; esta spec lo activa.
- Hoy NO existe: ni tabla de rendiciones, ni la transición a `rendido`, ni el reporte de
  separación por período cerrado (la card de 0068 es en vivo, no un corte congelado).

## 3. Decisiones ancladas

1. **Período quincenal.** Helper puro `quincenaRange(year, month, half)` (`half` ∈ {1,2}):
   Q1 = `[YYYY-MM-01, YYYY-MM-15]`, Q2 = `[YYYY-MM-16, YYYY-MM-<último>]` (último vía
   `new Date(y, m, 0).getDate()` — pero `Date` argless está prohibido en libs puras del
   harness; se computa con aritmética de `Date(Date.UTC(...))` recibiendo y/m explícitos,
   nunca `Date.now()`). El último día se deriva del mes pedido, no de "hoy". `quincenaLabel`
   → "junio 2026 · 16-30". La UI lista las quincenas del mes navegable (reusa el cursor de
   `calendar-helpers.ts`).
2. **Qué entra en la rendición.** Los `payment_receipts` con: `fund_class='third_party'`
   **Y** `application_status='aplicado'` (identificados/aplicados; los `recibido_sin_ref`
   NO entran — no se rinde lo no identificado) **Y** `received_at` dentro del período **Y**
   no incluidos ya en otra rendición activa. Normalización a USD con el helper existente
   (`receiptAmountUsd`: USD/USDT 1:1 · VES /fx_rate · CNY 0). El detalle es por recibo
   (código, cliente, Shipping Mark, ref. de envío, monto, moneda, fecha) — "por cliente y
   referencia" del handoff.
3. **Neto a favor de la Operadora (fórmula del handoff, bases etiquetadas).**
   `recaudado_terceros` (base CAJA: third_party cobrado en el período, punto #2) **menos**
   `servicios_locales_facturados` (base DEVENGADO: `invoices.fund_class='local_revenue'`
   con `status ∈ {emitida, parcial, pagada}` e `issue_date`/emisión en el período;
   normalizado a USD) = **`neto_a_favor_operadora`**. Cada bloque del reporte declara SU
   base (el handoff mezcla "recaudado" y "facturado" a propósito; lo hago explícito, no lo
   oculto). Query nueva `localRevenueInvoicedSummary(supabase, range)` espejo de
   `fundsSeparationSummary`.
4. **Sin asiento contable en V1.** La rendición es un REPORTE + cambio de estado; NO genera
   `journal_entries`. La liquidación contable real Operadora↔DTD Services (qué cuenta se
   debita/acredita al transferir el neto) la decide el contador — se documenta el gancho.
   Coherente con el principio rector del handoff ("en el contrato los derechos, en el ERP
   los procedimientos; prometer poco, documentar todo"). NO se reforma el reconocimiento de
   ingreso de la emisión (esa deuda ya la anotó 0068).
5. **Emisión = snapshot INMUTABLE (no hay borrador persistido).** María revisa un **preview
   calculado en vivo** (no se guarda) y pulsa "Emitir rendición": una transacción lógica
   (a) inserta `renditions` con los totales CONGELADOS + (b) inserta `rendition_receipts`
   (puente con los `receipt_id` incluidos) + (c) marca esos recibos
   `application_status='aplicado' → 'rendido'`. Tras emitir, la rendición no se edita
   (trigger de inmutabilidad como `legal_acceptances`, salvo la transición a `anulada`).
6. **Anulación reversible (admin + motivo).** Anular una rendición: `status → 'anulada'` +
   `void_reason` + revierte sus recibos `rendido → aplicado` (vuelven a estar disponibles
   para una nueva rendición). Queda en el historial. Es el único cambio permitido post-emisión.
7. **Un recibo en una sola rendición activa.** `rendition_receipts` con
   `unique(tenant_id, receipt_id)` **parcial** sobre rendiciones no anuladas — un recibo
   `rendido` no puede colarse en dos rendiciones. Al anular se libera (la fila puente se
   borra o la rendición anulada se excluye del índice parcial). El builder de "qué entra"
   ya filtra `application_status='aplicado'`, así que un `rendido` no reaparece — el unique
   es la defensa en DB (lección 0045: validar en la base, no solo en la action).
8. **Export V1 = CSV + hoja imprimible (sin dep nueva).** No se agrega `xlsx`/`pdfkit`
   (consistencia con 0067/0068; "XLSX" del handoff se cubre con CSV que Excel abre nativo).
   (a) **CSV detalle** vía `rowsToCsv` (`reports/export-csv.ts`): un row por recibo +
   filas de totales; filename `rendicion-{YYYY-MM-DD}-{YYYY-MM-DD}.csv`. (b) **Hoja
   imprimible** `app/studio/(app)/rendiciones/[code]/page.tsx` (server, print-friendly
   patrón 0067/0068, tokens `var(--*)` re-anclados): encabezado "RENDICIÓN DE CUENTAS A LA
   OPERADORA", código `RND-YYYY-NNNN`, período, los 3 totales con su base, tabla de recibos,
   y pie "Inversiones DTD Services, C.A., en su condición de agente de cobranza de la
   Operadora." **Cero "DoorTuDoor Trading"/J-50220185** (regla absoluta). El nombre "Canopy"
   NO aparece — solo "la Operadora" (handoff §1).
9. **Admin-only (patrón `direccion`/`legal`).** Página gateada por `user_tenants.role ===
   'admin'` (María opera como admin; si a futuro necesita un rol propio "tesorería" es otra
   spec). Server actions resuelven tenant del usuario logueado (RLS).
10. **Migración `0123_rendiciones.sql` — aditiva.** Tablas `renditions` +
    `rendition_receipts` con RLS por tenant (read authenticated del tenant; write admin/
    service_role) + RPC `next_rendition_code` (RND-YYYY-NNNN, patrón `next_quote_code`,
    security definer, search_path=public) + trigger de inmutabilidad en `renditions`. NO se
    aplica a prod (founder).
11. **No tocar:** asientos/estados de `invoices` y `payment_receipts` salvo la transición
    `aplicado↔rendido` · evidencia 0067 · gate AUT-04 · partner-finance (0059) · módulo
    Tesorería.

## 4. Approach (archivos)

- `supabase/migrations/0123_rendiciones.sql` — decisión #10.
  - `renditions`: `id, tenant_id, rendition_code, period_from date, period_to date,
    third_party_usd numeric, local_revenue_usd numeric, net_to_operadora_usd numeric,
    receipt_count int, status text check in ('emitida','anulada') default 'emitida',
    void_reason text, created_by uuid, emitted_at timestamptz default now(), created_at`.
    Índices `(tenant_id, period_from)`, `(tenant_id, status)`.
  - `rendition_receipts`: `id, tenant_id, rendition_id → renditions(id) on delete cascade,
    receipt_id → payment_receipts(id), amount_usd numeric, created_at`. Índice único parcial
    `(tenant_id, receipt_id) where` (rendición no anulada) — vía columna denormalizada o
    índice sobre join; el implementer elige la forma robusta (puente sin la anulada).
  - Trigger `renditions_immutable` BEFORE UPDATE: permite SOLO `status: emitida→anulada`
    (+ set `void_reason`); cualquier otro UPDATE `raise exception`. BEFORE DELETE bloquea.
  - Validación cross-tenant del `receipt_id` (helper `*_in_tenant` + trigger, lección 0045).
  - RPC `next_rendition_code`.
- `lib/studio/renditions/` (dominio ≥3 archivos):
  - `types.ts` — `Rendition`, `RenditionReceipt`, `RenditionPreview`, `RenditionStatus`,
    labels/badge tones, `validateRenditionEmitInput`. PURO.
  - `period.ts` — `quincenaRange`, `quincenaLabel`, `quincenasOfMonth` (PUROS, reciben y/m;
    sin `Date.now`).
  - `queries.ts` — `localRevenueInvoicedSummary(supabase, range)`, `previewRendition(
    supabase, range)` (compone fundsSeparation + local facturado + lista de recibos
    elegibles), `listRenditions`, `getRenditionWithReceipts`.
  - `actions-helpers.ts` o directo en la action: `emitRenditionFor` (transacción:
    insert + puente + UPDATE recibos→rendido, con re-check de elegibilidad server-side y
    reintento de correlativo ante choque unique, patrón 0054), `voidRenditionFor` (revierte).
  - `rendition-csv.ts` — `buildRenditionCsv(rendition, receipts)` reusando `rowsToCsv`.
- `app/studio/(app)/rendiciones/` — `page.tsx` (admin-only, lista quincenas del mes +
  preview + historial de rendiciones), `actions.ts` (`emitRenditionAction`,
  `voidRenditionAction`), `_components/RendicionesClient.tsx`, `_components/EmitDrawer.tsx`
  (revisión del preview antes de emitir, con ActionButton), `[code]/page.tsx` imprimible +
  `[code]/PrintButton.tsx`, `[code]/export/route.ts` (CSV, admin-only, `apiError()`).
- Sidebar: entry "Rendiciones" (grupo SISTEMA o FINANZAS, adminOnly) en `StudioSidebar.tsx`.
- Tests Vitest: `period` (Q1/Q2, febrero 28/29, diciembre→enero, último día correcto) ·
  `previewRendition` (solo third_party+aplicado+en-rango; excluye sin_ref, rendido,
  local_revenue, fuera de rango; USD multi-moneda) · `localRevenueInvoicedSummary` (status
  e issue_date filtran) · neto = recaudado − local · `validateRenditionEmitInput` (rango
  válido, no vacío) · CSV (headers + totales) · imprimible builder (leyenda, "agente de
  cobranza de la Operadora", cero DoorTuDoor/J-50220185, cero "Canopy").

## 5. Acceptance

- [ ] Migración `0123` aditiva (renditions + rendition_receipts con RLS, trigger de
      inmutabilidad, unique parcial de no-doble-inclusión, RPC `next_rendition_code`,
      validación cross-tenant). NO aplicada a prod.
- [ ] Helper de quincena correcto (Q1 1-15, Q2 16-último; meses de 28/29/30/31; sin `Date.now`).
- [ ] Preview en vivo: lista solo third_party+aplicado+en-rango (excluye sin_ref/rendido/
      local/fuera-rango); 3 totales con su base; neto = recaudado − local facturado.
- [ ] Emitir: snapshot inmutable + recibos pasan a `rendido` + no entran en otra rendición;
      re-emitir el mismo período ya rendido da preview vacío (idempotencia visible).
- [ ] Anular (admin + motivo): revierte recibos a `aplicado`, libera para nueva rendición,
      queda en historial.
- [ ] Export CSV detalle + hoja imprimible formal con la leyenda de agente de cobranza;
      cero "DoorTuDoor Trading"/J-50220185, cero "Canopy".
- [ ] Admin-only (no-admin → redirect dashboard). `node scripts/verify.mjs` 🟢.
- [ ] Sin cambios en: asientos contables, máquina de estados de invoices, evidencia 0067,
      gate AUT-04, partner-finance, Tesorería.

## 6. Fuera de alcance (respetar)

- Asiento contable de liquidación Operadora↔DTD al transferir el neto (lo decide el contador).
- Disparo por **cron** de la rendición (V1 = María la emite supervisada; el cron es futuro).
- Email/WhatsApp de la rendición a la Operadora · PDF server-side (V1 = imprimible navegador).
- Rendición a aliados white-label (es partner-finance/0059, otra cosa).
- Multi-moneda de presentación (V1 consolida a USD con el helper existente; CNY=0 documentado).
- Aplicar la migración a prod (founder).
