---
sdd: "0033"
title: "Cola de impresión QR · oficina + push del operario CN"
status: done
author: "founder"
created: 2026-05-25
updated: 2026-06-02
supersedes: null
superseded_by: null
related: ["0008", "0020", "0027", "0031"]
---

# DTD-0033 — Cola de impresión QR · vista oficina + push del operario CN

> **Fase 3c del bundle Claude Design v1.6** (release v1.5 quick win).
> El operario CN del PWA `/m/cn` puede mandar a la oficina un "pedido
> de impresión" cuando recibe un bulto y necesita etiquetar más cajas
> del cliente. La oficina ve las órdenes en `/studio/cola-qr`, las
> imprime en lote en alguna impresora del sistema, y marca como
> impresas / entregadas.

---

## 1. Resumen en una línea

`/studio/cola-qr` muestra cola activa de órdenes de impresión QR
(pendiente / imprimiendo) + historial (impreso / entregado / cancelado).
Admin selecciona N órdenes → asigna impresora → marca como impresas →
marca como entregadas al cliente. RPC `push_qr_order_as_operario` listo
para que el PWA `/m/cn` pushee órdenes (la UI del wizard se conecta
en SDD futuro · este SDD solo crea backend + admin web).

---

## 2. Scope

### Incluye

#### Schema (migración 0027)

- **2 enums** nuevos:
  - `qr_order_status`: `pendiente` / `imprimiendo` / `impreso` / `entregado` / `cancelado`
  - `qr_order_priority`: `urgent` / `normal`
- **1 tabla** nueva: `qr_print_orders` (RLS por tenant_id):
  - id uuid PK
  - tenant_id uuid FK tenants
  - order_code text unique-per-tenant (`QR-YYYY-NNNN`)
  - warehouse_id uuid FK warehouses_cn
  - markbox text NOT NULL
  - client_name text NOT NULL (denorm para que la oficina no resuelva en cada render)
  - supplier_name text (denorm · opcional)
  - bultos int NOT NULL CHECK > 0
  - sent_by_operario_id uuid FK operario_pins ON DELETE SET NULL
  - sent_by_name text NOT NULL (denorm)
  - sent_by_phone text
  - sent_at timestamptz NOT NULL DEFAULT now()
  - priority qr_order_priority NOT NULL DEFAULT 'normal'
  - status qr_order_status NOT NULL DEFAULT 'pendiente'
  - assigned_printer text · label de la impresora elegida (sin tabla de impresoras V1)
  - printed_at timestamptz · printed_by uuid (auth.users)
  - delivered_at timestamptz · delivered_by uuid
  - cancelled_at timestamptz · cancelled_by uuid · cancel_reason text
  - notes text (operario al pushear puede dejar contexto)
  - created_at / updated_at
- **2 RPCs**:
  - `next_qr_order_code(p_tenant_id uuid) returns text` — secuencial `QR-YYYY-NNNN` (mismo patrón que `next_dispatch_order_code`)
  - `push_qr_order_as_operario(...)` — security definer + service_role only. El operario PWA lo invoca (en SDD futuro) para encolar una orden.
- **Trigger guard**: transiciones válidas mirror del trigger del Despacho (pendiente→imprimiendo→impreso→entregado / *→cancelado).
- **Publicación Realtime**: `alter publication supabase_realtime add table public.qr_print_orders` (para que en V2 el admin web reciba updates push sin polling).

#### Server-side

- `lib/studio/qr-queue-types.ts`:
  - Types `QrOrder` + `QrOrderStatus` + `QrOrderPriority`
  - Labels + tones + validators
  - `validateBatchPrintInput` + `validateCancelInput`
- `lib/studio/qr-queue-queries.ts`:
  - `listQrOrders(supabase, filters)` con tabs activa/historial
  - `computeQrQueueKpis` (pendientes, urgentes, imprimiendo, impresos hoy, bultos totales)
- `app/studio/(app)/cola-qr/actions.ts`:
  - `batchAssignPrinterAction` (selecciona N → imprimiendo + assigned_printer)
  - `markPrintedAction` (uno o batch → impreso + printed_at/by)
  - `markDeliveredAction` (uno o batch → entregado + delivered_at)
  - `cancelQrOrderAction` (con confirm + razón)

#### UI

- `/studio/cola-qr/page.tsx` — server fetch + render Client
- `_components/QrQueueClient.tsx` — orquestador con state (tab activa/historial + filtros warehouse/priority + selección múltiple)
- `_components/QrQueueKpis.tsx` — 4 KPIs header
- `_components/QrQueueTable.tsx` — tabla con selección + acciones inline
- `_components/BatchPrintDrawer.tsx` — drawer con selector de impresora (3 mock) + confirmar
- Refresh manual con botón "Refrescar" (V2: Realtime channel)

#### Sidebar

- Entry "Cola de QR" en OPERACIÓN, después de "Almacén CN" y antes de "Etiquetas CN".

### Fuera de scope

- **UI en el PWA `/m/cn/nueva`** para mandar la orden · respeta NO TOCAR #3 del handoff. Cuando el operario CN pueda mandar la orden será otro SDD que ajuste el wizard.
- **Catálogo de impresoras en DB** · V1 usa 3 mocks hardcoded en BatchPrintDrawer (HP LaserJet · Zebra ZT411 · Zebra ZT411-2). Tabla `printers` queda como SDD futuro.
- **Supabase Realtime subscription en el cliente** · V1 polling cada 30s + botón refresh manual. V2 wire al channel.
- **Generación del PDF de etiquetas en lote** · V1 muestra "impresa" pero el PDF lo arma el admin desde `/studio/etiquetas` (SDD-0031). V2 puede integrar.

---

## 3. Decisiones

### D1 · Sin tabla `printers` en V1

3 impresoras mock hardcoded en el drawer. Cuando un tenant tenga 5+ impresoras o quiera offline/online tracking real, abrir SDD propio. Hoy: campo `assigned_printer text` libre.

### D2 · Realtime postponed a V2

Polling cada 30s desde el client + botón refresh manual. Razones:
- Es el primer módulo que usa Realtime · no quiero crear el patrón sin validar
- Polling 30s es suficiente UX para una cola de impresión (no es chat)
- `alter publication ... add table` queda en la migration para que cuando V2 conecte el channel, ya esté lista la suscripción

### D3 · Denorm `client_name` + `sent_by_name`

La cola la consume admin web que NO tiene tiempo de hacer JOINs para mostrar el nombre del operario. Denorm al pushear (snapshot del display_name al momento). Si el operario cambia nombre después, la orden vieja sigue con el snapshot — auditable.

### D4 · RPC operario · sin auth.uid

Igual que SDD-0027 (create_receipt_as_operario): security definer +
recibe `p_operario_id` de cookie HTTP-only + valida active + tenant. El
operario PWA no tiene auth.uid.

### D5 · Trigger guard de transición

Mirror del de dispatch_orders. Prohíbe retroceder desde terminal,
`impreso → pendiente`, etc. Auto-stamp de `printed_at`, `delivered_at`,
`cancelled_at` cuando cambia el status.

---

## 4. Permisos

| Acción | Admin tenant | Operario CN |
|---|---|---|
| Ver cola activa | ✓ | ✗ |
| Asignar impresora batch | ✓ | ✗ |
| Marcar impreso / entregado | ✓ | ✗ |
| Cancelar orden | ✓ | ✗ |
| Pushear orden nueva | ✗ | ✓ (via RPC) |

---

## 5. Casos borde

| Caso | Comportamiento |
|---|---|
| Operario pushea orden sin markbox válido | RPC rechaza con `errcode P0001` |
| Cliente admin asigna impresora a 0 órdenes seleccionadas | Botón "Imprimir" disabled |
| Admin cancela orden ya en `impreso` | Permitido · sigue siendo `cancelado`. Audit: cancelled_at, cancelled_by, cancel_reason. |
| Mismo MARKBOX con 2 órdenes pendientes | OK · son entregas distintas o lotes distintos |
| Bulto duplicado · usuario doble-tap | Botón "Imprimir" tiene `disabled` durante `isPending` |
| Operario inactivo intenta pushear | RPC rechaza con `errcode P0002` |
| Polling 30s falla (offline) | UI sigue mostrando últimos datos. Botón refresh manual permite retry. |

---

## 6. Open questions

1. **Catálogo de impresoras real?** Si el tenant tiene 5+ impresoras y quiere status online/offline tracking, abrir SDD. Por ahora 3 mocks.
2. **Notificación push al operario cuando se imprime?** Útil para el flow (operario sabe que ya hay etiquetas listas). V2.
3. **PDF directo desde la cola?** Tendría que integrar con SDD-0031 etiquetas + pre-rellenar `?id=` y `?bultos=`. V2.

---

## 7. Origen

- **Bundle:** `docs/design/studio/v1.6-claude-design/handoff/SDD-2026-05-25-sesion/`
- **Brief:** `BRIEFS/06-qr-storage-listener.md`
- **Source:** `source/nuevo/modules/qr-queue.jsx` (~33 KB, ~880 líneas)
