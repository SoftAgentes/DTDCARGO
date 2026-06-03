---
sdd: "0011"
title: "DoorTuDoor — Cotizador (Sprint 1 completo)"
status: done
author: "founder"
created: 2026-05-24
updated: 2026-06-02
supersedes: null
superseded_by: null
related: ["0005", "0006", "0008", "0009", "0010"]
confidencialidad: interno
---

# DTD-0011 — Cotizador

> **Cierre del Sprint 1 (Comercial mínimo).** Conecta Tarifas (SDD-0008)
> + Clientes (SDD-0010) en quotes guardables como entidad. El operador
> calcula el precio en vivo, lo guarda como draft, lo envía al cliente,
> y al aceptarlo se convierte en un shipment del Tracking (SDD-0005/0006).

---

## 1. Resumen en una línea

CRUD de cotizaciones con calculator en vivo (servicio + CBM + tarifa +
packaging → total USD), state machine de 5 estados (draft → sent →
accepted/rejected/expired), y "Convertir a embarque" que crea un shipment
con los datos copiados.

---

## 2. Scope

### Incluye

#### Backend (Supabase)
- Migration `0007_quotes.sql`:
  - Enum `quote_status` (draft / sent / accepted / rejected / expired)
  - Tabla `public.quotes` con: id, tenant_id, quote_code (unique por
    tenant), client_markbox, client_name (snapshot), service, origin,
    destination, cbm, weight_kg, boxes, packaging, rate_per_cbm,
    flat_rate, rate_used_id (FK opcional a rates), subtotal_usd,
    packaging_cost, total_usd, status, valid_until, sent_at, accepted_at,
    converted_to_shipment_id (FK opcional a shipments), notes, timestamps,
    deleted_at
  - Función `public.next_quote_code(p_tenant_id)` formato
    `Q-YYYY-NNNN` con padding 4 dígitos (año actual + counter
    por tenant del año)
  - Índices: `(tenant_id, status)` y `(tenant_id, client_markbox)`
  - RLS por tenant + grants explícitos + trigger updated_at
  - SIN seed (los quotes son data operativa, no demo)

#### Lib
- `lib/studio/quote-types.ts`:
  - `Quote`, `QuoteStatus`, `QuoteInput`
  - `QUOTE_STATUS_OPTIONS`, `statusLabel`, `statusBadgeTone`
  - `PACKAGING_OPTIONS` hardcoded: `{ id, label, extra }` para
    `carton (0)`, `paleta (60)`, `madera (60)`
  - `calcQuoteTotal({ service, cbm, ratePerCbm, flatRate, packaging })`
    → `{ subtotal, packagingCost, total }`
  - `validateQuoteInput(partial)` — manual sin zod
- `lib/studio/quote-queries.ts`:
  - `listQuotes(supabase, filters)` — status, q (code/client_name/markbox),
    client_markbox específico
  - `getQuoteByCode(supabase, code)`
  - `suggestRateForQuote(supabase, service, destination)` — wrapper que
    devuelve la rate matching para sugerir precio

#### Pages + actions
- `app/studio/(app)/cotizador/page.tsx` (server) — reemplaza placeholder:
  - Header con eyebrow + h1 "Cotizador." + subtítulo + botón "+ Nueva"
    + botón "Exportar" (disabled placeholder)
  - Toolbar: search + select status
  - Tabla: CODE · Cliente (name + MARKBOX) · Servicio · Ruta · CBM ·
    Total · Estado (badge dot) · Vigencia · Acciones
  - Click fila → `/studio/cotizador/[code]`
- `app/studio/(app)/cotizador/[code]/page.tsx` (server):
  - Header: code (mono grande) + cliente + status badge
  - Card TOTAL en navy (el "hero" del detalle)
  - Grid datos: cliente, MARKBOX, servicio, origen, destino, volumen,
    peso, cajas, packaging, tarifa, vigencia
  - Botones contextuales según status:
    - `draft` → Editar (drawer), Enviar al cliente
    - `sent` → Marcar aceptada, Marcar rechazada
    - `accepted` → Convertir a embarque (si no convertida aún)
    - `accepted/rejected/expired` → Duplicar (disabled placeholder), PDF (disabled)
  - Link a shipment si converted_to_shipment_id
  - Link "← Volver al listado"
- `_components/CotizadorClient.tsx`: orquesta lista + drawer
- `_components/QuoteDrawer.tsx`: calculator + form completo (~600 líneas
  esperadas)
- `_components/QuoteDetailClient.tsx`: wrapper client del detalle con
  manejo de estado para drawer de edit + confirmaciones
- `cotizador/actions.ts`:
  - `createQuote(prev, formData)` — autogenera code via rpc → insert
    como `draft`
  - `updateQuote(id, prev, formData)` — solo permite si status=draft
  - `markQuoteSent(id)` — status → sent + sent_at = now
  - `markQuoteAccepted(id)` — status → accepted + accepted_at = now
  - `markQuoteRejected(id)` — status → rejected
  - `convertQuoteToShipment(id)` — INSERT en shipments con datos copiados,
    UPDATE quote con converted_to_shipment_id, redirect a tracking
  - `softDeleteQuote(id)`

### NO incluye (queda para SDDs futuros)

- **PDF export** — botón visible disabled. Implementación con library
  (react-pdf / puppeteer) es trabajo separado, SDD futuro.
- **Email send real** — botón "Enviar al cliente" solo cambia status a
  `sent` + sent_at. No manda email. SDD futuro con email service.
- **Duplicar cotización** — botón disabled. SDD futuro: clona quote
  como nuevo draft.
- **Line items por caja** — solo cbm + weight + boxes totales. Si negocio
  necesita detalle por item, SDD futuro.
- **Múltiples tarifas / servicios en una quote** — UN servicio por
  quote. Si cliente quiere comparativa, son dos quotes separadas.
- **Auto-expiry job** — sin trigger que mueva quotes vencidas a
  `expired`. La UI filtra por `valid_until < today` manualmente. Cron job
  en SDD futuro.
- **Revisiones / versionado** — edit pisa el draft. Si quote ya está
  sent y querés cambiar precio, hay que crear nueva.
- **Negociación con contraoferta** — no hay flow. Cliente acepta o
  rechaza tal cual.
- **Cliente del catálogo obligatorio** — el MARKBOX se acepta libre
  (puede no estar en `clients`). Si no está, warning visual + sugerencia
  "Crear cliente" pero no bloquea. Decisión: matchea patrón shipments.

---

## 3. Archivos a crear / editar

### Nuevos

```
docs/specs/0011-cotizador/
└── spec.md                                              ← este

supabase/migrations/
└── 0007_quotes.sql                                      ← schema + RLS + función

lib/studio/
├── quote-types.ts                                       ← Quote + calcQuoteTotal
└── quote-queries.ts                                     ← list, getByCode, suggestRate

app/studio/(app)/cotizador/
├── page.tsx                                             ← reemplaza placeholder
├── actions.ts                                           ← 7 actions
├── _components/
│   ├── CotizadorClient.tsx                              ← orquesta lista + drawer
│   ├── QuoteDrawer.tsx                                  ← calculator + form
│   └── QuoteDetailClient.tsx                            ← wrapper detalle con drawer edit
└── [code]/
    └── page.tsx                                         ← detalle con card total + acciones
```

### Editados

```
docs/design/v1-studio/module-map.md                      ← 1.4 ✅, Sprint 1 cerrado
```

---

## 4. Schema completo

```sql
create type quote_status as enum ('draft', 'sent', 'accepted', 'rejected', 'expired');

create table public.quotes (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants(id) on delete cascade,
  quote_code               text not null,                    -- "Q-2026-0001"
  client_markbox           text not null,                    -- lookup textual
  client_name              text not null,                    -- snapshot
  service                  shipment_service not null,
  origin                   text not null,
  destination              text not null,
  cbm                      numeric(10,3),
  weight_kg                numeric(10,2),
  boxes                    int,
  packaging                text not null default 'carton',
  rate_per_cbm             numeric(10,2),
  flat_rate                numeric(10,2),
  rate_used_id             uuid references public.rates(id) on delete set null,
  subtotal_usd             numeric(10,2) not null,
  packaging_cost           numeric(10,2) not null default 0,
  total_usd                numeric(10,2) not null,
  status                   quote_status not null default 'draft',
  valid_until              date not null default (current_date + interval '30 days'),
  sent_at                  timestamptz,
  accepted_at              timestamptz,
  converted_to_shipment_id uuid references public.shipments(id) on delete set null,
  notes                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  deleted_at               timestamptz,
  unique (tenant_id, quote_code)
);

create index quotes_tenant_status_idx
  on public.quotes (tenant_id, status) where deleted_at is null;

create index quotes_tenant_client_idx
  on public.quotes (tenant_id, client_markbox) where deleted_at is null;

-- Función next_quote_code: formato Q-YYYY-NNNN, counter por año + tenant
create or replace function public.next_quote_code(p_tenant_id uuid)
returns text language plpgsql security definer set search_path = public
as $$
declare
  v_year int := extract(year from current_date);
  v_max int;
  v_padded text;
begin
  select coalesce(max((regexp_match(quote_code, '^Q-\d{4}-(\d+)$'))[1]::int), 0) + 1
  into v_max
  from public.quotes
  where tenant_id = p_tenant_id
    and quote_code like 'Q-' || v_year || '-%';

  v_padded := lpad(v_max::text, 4, '0');
  return 'Q-' || v_year || '-' || v_padded;
end;
$$;

grant select, insert, update, delete on public.quotes to authenticated;
grant execute on function public.next_quote_code(uuid) to authenticated;

alter table public.quotes enable row level security;

create policy "quotes by tenant"
  on public.quotes for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

create trigger quotes_touch
  before update on public.quotes
  for each row execute function public.touch_updated_at();
```

---

## 5. Decisiones de diseño

### 5.1 client_name como snapshot al momento

Cuando creás una quote para "Empresa Demo S.A." (MARKBOX DTD-1001),
guardamos `client_name = 'Empresa Demo S.A.'` en la fila. Si después el
cliente cambia su razón social, la quote vieja sigue mostrando el nombre
original — es un documento histórico.

### 5.2 Lookup blando del cliente (no requiere)

Si el operador escribe un MARKBOX no registrado (DTD-9999), se acepta
con warning visual. Razón: matchea patrón actual de shipments. La data
inconsistente se limpia cuando el cliente se da de alta o se hace audit.

### 5.3 Rate snapshot vs FK

`rate_used_id` es FK opcional a `rates` para traceability ("¿qué tarifa
usé al cotizar?"). Pero también guardamos `rate_per_cbm` o `flat_rate`
como número directo en la quote. Si después la tarifa cambia en el
catálogo, la quote sigue mostrando el precio cotizado.

`on delete set null` evita romper la quote si se borra la rate.

### 5.4 State machine y transiciones permitidas

| Desde | A | Acción |
|---|---|---|
| draft | sent | "Enviar al cliente" |
| draft | (edit) | "Editar" (drawer) |
| sent | accepted | "Marcar aceptada" |
| sent | rejected | "Marcar rechazada" |
| accepted | (convert) | "Convertir a embarque" |
| any | (soft delete) | "Eliminar" |

`expired` se calcula visualmente (UI muestra badge "vencida" si
`valid_until < today` y status no es `accepted`/`rejected`). Sin job
que cambie el status real en BD.

### 5.5 Convertir a embarque

Cuando se acepta una quote, botón "Convertir a embarque" hace:
1. `INSERT INTO shipments` con datos copiados: service, origin,
   destination, client_name (de quote.client_name), client_markbox,
   weight_kg, volume_m3 (= cbm), notes (con prefijo "Quote {code}").
2. `code` del shipment auto-generado siguiendo el patrón actual.
3. `UPDATE quotes SET converted_to_shipment_id = new_id`.
4. Redirect a `/studio/tracking/{new_id}`.

El shipment queda en status `draft` para que el operario complete.

### 5.6 Packaging hardcoded (3 opciones)

Cartón / Paleta / Caja de madera con costos extra fijos del handoff
($0, $60, $60). Si negocio necesita más opciones o precios variables,
SDD futuro con tabla `packaging_options`.

### 5.7 calcQuoteTotal helper

Función pura sin dependencias para que se use tanto client-side (live
update del total mientras el operador tipea) como server-side (recalculo
final al persistir). Garantiza que UI y BD muestren el mismo número.

### 5.8 PDF y Email diferidos a SDDs futuros

Razón: cada uno es trabajo de 4-8h con libraries / services externos.
Por ahora botones disabled con tooltip "Próximamente". El status `sent`
se setea con la acción "Marcar enviada" (NO email real).

### 5.9 Sin auto-expiry job

Cron jobs requieren Supabase Edge Functions o pg_cron, ambos son
trabajo aparte. Por ahora la UI filtra/muestra vencidas en tiempo real
basándose en `valid_until < today`.

---

## 6. Criterios de aceptación

### Backend
- [ ] Migration aplicada sin errores
- [ ] `next_quote_code()` retorna `Q-2026-0001` en primera invocación del año
- [ ] CHECK / NOT NULL constraints respetados
- [ ] FKs `rate_used_id` y `converted_to_shipment_id` ambos opcionales y SET NULL on delete

### Lib
- [ ] `calcQuoteTotal({service: 'consolidacion', cbm: 3.4, ratePerCbm: 480, packaging: 'paleta'})`
      → `{subtotal: 1632, packagingCost: 60, total: 1692}`
- [ ] `listQuotes({status: 'draft'})` filtra correctamente
- [ ] `suggestRateForQuote('consolidacion', 'Valencia')` retorna rate matching

### UI
- [ ] `/studio/cotizador` muestra lista vacía con empty state + CTA
- [ ] Click "+ Nueva cotización" abre drawer
- [ ] Drawer: cards de servicio (LCL/FCL) updatean el calculator
- [ ] Cliente input: si MARKBOX no existe en clients, warning visible
- [ ] Sugerencia automática del rate al cambiar destino (debounced)
- [ ] Total card en navy se actualiza en vivo al cambiar inputs
- [ ] Submit crea quote como draft, redirect al detalle
- [ ] Detalle muestra card total + datos + acciones según status
- [ ] "Marcar enviada" cambia status sin email real
- [ ] "Convertir a embarque" crea shipment + redirect
- [ ] Sidebar marca "Cotizador" como active
- [ ] Light + dark themes funcionan

### Sistema
- [ ] `pnpm typecheck` pasa
- [ ] Cero hex literales nuevos

---

## 7. Out of scope / open questions

- **¿Aprobación con firma digital del cliente?** No. Por ahora confianza —
  operador marca aceptada cuando cliente responde "sí" por WhatsApp.
- **¿Notificación interna cuando una quote vence?** No automática. Si el
  operador no revisa la lista, vence sin alerta.
- **¿Histórico de cambios de precio dentro de la misma quote?** No. Edit
  pisa. Si negocio quiere audit, se agrega tabla `quote_revisions`.
- **¿Múltiples destinos en una sola quote (multi-leg)?** No. Un destino
  por quote. Para multi-leg, dos quotes con notas cruzadas.
- **¿Mostrar margen de ganancia al operador?** No por ahora. Cuando
  llegue Costing & Margen (SDD-0022), se cruzan.
