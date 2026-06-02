---
sdd: "0039"
title: "Gastos CN · scope contenedor/operativo + moneda dual CNY/USD + alerta de consolidado al equipo CN"
status: done
author: "founder"
created: 2026-05-29
updated: 2026-06-02
supersedes: null
superseded_by: null
related: ["0016", "0026", "0038", "0047"]
confidencialidad: interno
migrations:
  - "0073_expense_categories_op — ALTER TYPE expense_category ADD VALUE op_* (aislado del uso)"
  - "0074_expenses_scope_fx — expense_scope enum + expenses.scope/amount_usd/fx_rate + CHECK + tenant_fx_history + RLS expenses_cn_team / expenses_ve_accounting"
  - "0075_expense_alerts — expense_alerts + expense_alert_resolution enum + unique-active-per-shipment + RLS + RPC next_consolidation_code (C-YYYY-NNNN)"
deferred:
  - "Scope toggle en /m/erp móvil (cargar gastos op_* desde el teléfono) — diferido: bajo valor (staff VE), y el fix de scope inferido ya deja correcto el flujo móvil"
  - "Template zh-CN del evento shipment_consolidated_cn (regla + template en /studio/mailing — paso de config del founder)"
  - "Auto-close por BL+gasto (hoy cierra con el 1er gasto; el gate BL llega con Part C / SDD documentos contenedor)"
  - "occurred_at editable en el drawer (hoy default now())"
  - "Revisión nativa zh-CN de las ~95 keys del dict expenses"
  - "Test cross-rol en browser en chino (manos del founder)"
---

# DTD-0039 — Gastos CN + alerta de consolidado

> **La contadora de la oficina China carga los gastos del negocio distinguiendo
> los que pertenecen a un contenedor de los gastos operativos de oficina, en
> CNY o USD con tipo de cambio del día, y el sistema normaliza todo a USD.
> Cuando el operario consolida un contenedor, el equipo CN recibe una alerta
> para cargar esos gastos.** Todo en chino mandarín simplificado (ver SDD-0038).

## Contexto

El módulo Expenses sólo vivía en el Mobile ERP (`/m/erp`) con `shipment_id`
nullable y categorías de viaje del personal. La oficina CN necesita dos cosas
que la BD no distinguía:

1. **Scope del gasto**: ¿pertenece a un contenedor/embarque concreto
   (`shipment`) o es overhead de oficina/bodega (`external`: alquiler,
   servicios, sueldos locales)?
2. **Moneda dual**: la contadora carga en **CNY (renminbi)** y en USD, con el
   tipo de cambio del día. El sistema interno trabaja en USD como moneda base
   (decisión del founder) para consolidar costos del contenedor y calcular
   margen.

Y un hueco de proceso: cuando se consolida un contenedor, hoy no hay disparo
que avise al equipo CN para que cargue los gastos — se hace por WhatsApp.

## Decisiones (founder)

- **Scope explícito** (`expenses.scope`), no derivado de `shipment_id IS NULL`:
  reportes indexados + permite futuros scopes sin nueva columna.
- **Normalización a USD en BD**: `amount_usd = amount / fx_rate`. `fx_rate` se
  guarda por gasto (auditoría: con qué cambio cargó la contadora ese día).
  `tenant_fx_history` recuerda el último cambio por par para prefill.
- **"chino" = mandarín simplificado (zh-CN)** siempre. **"renminbi/RMB" = CNY**
  (las transcripciones speech-to-text "remedy/remmeby" mapean a CNY).
- **Modelo A para la alerta (confirmado)**: al consolidar una recepción, el
  sistema **crea o reutiliza un `shipment` "contenedor"** (service=`consolidacion`,
  status=`consolidating`) agrupado por destino; gastos + (futuro) BL + alerta
  cuelgan de ese `shipment_id`. Razón: la BD no tenía un ancla para el contenedor
  (las WR consolidadas tenían `shipment_id = NULL`).
- **Destinatarios de la alerta = equipo CN** (`region='cn'` en
  `warehouse/operations/accounting/admin`) + accounting/admin. **VE no recibe**
  esta alerta.
- **Privacidad CN**: a users `region='cn'` no se les muestra el nombre real del
  cliente VE — sólo MARKBOX. (Redacción server-side: deferred.)

## Esquema (migraciones 0073 / 0074 / 0075)

- `expense_scope` enum `('shipment','external')`; `expenses.scope` default
  `'shipment'`, `amount_usd` default 0, `fx_rate` default 1.0000; CHECK
  `scope='external' OR shipment_id IS NOT NULL`; índice `expenses_scope_idx`.
- Categorías `op_*` (`op_rent`, `op_utilities`, `op_salaries`, `op_supplies`,
  `op_equipment`, `op_local_transport`, `op_customs_local`) para `external`.
- `tenant_fx_history (currency_pair, rate, set_at, set_by)` + RLS.
- RLS `expenses`: `expenses_cn_team` (region=cn en warehouse/operations/
  accounting/admin) + `expenses_ve_accounting` (accounting/admin VE).
- `expense_alerts (shipment_id, resolved_at, resolved_by, resolution_reason)` +
  enum `expense_alert_resolution ('manual','auto','reverted')` + **unique
  parcial** `(shipment_id) WHERE resolved_at IS NULL` (1 alerta activa por
  contenedor → idempotencia) + RLS equipo CN.
- RPC `next_consolidation_code(tenant)` → `C-YYYY-NNNN` (patrón de
  `next_receipt_code`, security definer, search_path=public).

## Flujo de la alerta (Modelo A)

1. **Operario** consolida una recepción en `/studio/cn` con destino →
   `changeReceiptStatusAction` (admin client, side-effect de sistema):
   find-or-create contenedor por destino, set `warehouse_receipts_cn.shipment_id`,
   `ensureActiveAlert` (idempotente), `fireMailEvent('shipment_consolidated_cn')`
   **sin nombre de cliente** (sólo código de contenedor).
2. **Contadora/Logística** ven la alerta: **badge** en sidebar (item Gastos),
   **banner** en `/studio/gastos` (contenedores pendientes con "Cargar gasto" /
   "Marcar cargado"), **chip** "Pendiente gastos / 待录入费用" en la row de
   Almacén CN.
3. **Cierre** — 3 caminos:
   - `auto`: al cargar el 1er gasto `scope=shipment` del contenedor
     (`createExpenseAction` → `autoResolveAlertForShipment`). *(V1: gate sólo
     gasto; el gate "BL + gasto" llega con el módulo de documentos del
     contenedor.)*
   - `manual`: botón "Marcar cargado" en el banner (`resolveExpenseAlertAction`,
     cliente RLS).
   - `reverted`: el operario saca la recepción de consolidado y el contenedor
     queda sin recepciones consolidadas (`revertAlertIfShipmentEmpty`).

Agrupación: 1 contenedor por (tenant, destino) mientras siga `consolidating`;
recepciones del mismo destino se agrupan ahí (sin spam — 1 alerta por
contenedor). Reversible por admin. Cuando Logística avance el contenedor
(Part C), deja de aceptar nuevas recepciones.

## Estructura del módulo

```
app/studio/(app)/gastos/
├── page.tsx                # server: locale + scope + KPIs + shipments + fx + alertas
├── actions.ts              # create/update/softDelete + resolveExpenseAlert + auto-close
└── _components/
    ├── GastosClient.tsx    # tabs scope + toolbar + tabla + banner alertas + drawer
    ├── GastosKpis.tsx      # totales del mes (USD normalizado)
    ├── ExpenseDrawer.tsx   # 2 pasos (scope → fields) + fx CNY/USD + preview USD live
    └── ExpenseRowActions.tsx
lib/studio/
├── expense-types.ts        # scope + op_* + fx helpers + validateExpenseInput
├── expense-queries.ts      # listTenantExpenses + computeExpenseKpis + listShipmentsForPicker + getLastFxRate
├── expense-alerts-types.ts
└── expense-alerts-queries.ts  # count/list/activeIds + find-or-create + ensure/auto/revert/manual close
```

Reusa `next_expense_code`, bucket `expense-receipts`, `DrawerShell`,
`NumericInput`, `useRowHighlight`, `useToast`, sistema i18n (SDD-0038).

## Estado

**Hecho**: esquema 0073/0074/0075; módulo web `/studio/gastos` (tabs, KPIs,
drawer 2 pasos con fx dual + sanity + preview USD, row actions); alerta E2E
in-app (crear contenedor al consolidar, badge/banner/chip, auto/manual/revert
close); evento `shipment_consolidated_cn` registrado + disparo best-effort;
**vínculo Almacén CN** (chip clickeable → drawer prefilled vía `?new_expense`);
**export CSV mensual** (UTF-8 BOM, ambos scopes, URLs de recibo firmadas,
sin nombres de cliente); **privacidad** (redacción server-side de
`client_name` + toggle oculto para region=cn no-admin); fix de regresión del
flujo de gastos móvil (`/m/erp`: scope inferido + `amount_usd` persistido).

**Pendiente**: ver `deferred` en el frontmatter (scope toggle móvil, template
zh-CN, gate BL con Part C, revisión nativa, test cross-rol en browser).

## Deuda técnica adyacente detectada

Al tocar `AlmacenCnClient` y `StudioSidebar` el linter marcó errores
`react-hooks/set-state-in-effect` en **código pre-existente** (no de este SDD).
Riesgo si el build corre lint como gate. Tratado como cleanup aparte.
