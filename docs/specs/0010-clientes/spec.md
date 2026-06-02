---
sdd: "0010"
title: "DoorTuDoor — Clientes + MARKBOX (catálogo comercial)"
status: done
author: "founder"
created: 2026-05-24
updated: 2026-06-02
supersedes: null
superseded_by: null
related: ["0005", "0006", "0008", "0009"]
---

# DTD-0010 — Clientes + MARKBOX

> **Base de todo lo comercial.** Catálogo de clientes con MARKBOX
> autogenerado (`DTD-NNNN`), tier (regular/vip/premium), RIF venezolano
> opcional y datos de contacto. Sin FK constraint con `shipments` todavía
> — relación textual por `client_markbox`.

---

## 1. Resumen en una línea

CRUD de clientes con MARKBOX autogenerado vía función Postgres atómica,
detalle con histórico de envíos del cliente (read-only), filtros por tier
y búsqueda. Reemplaza el placeholder de `/studio/clientes`.

---

## 2. Scope

### Incluye

#### Backend (Supabase)
- Migration `0006_clients.sql`:
  - Enum `client_tier` (regular / vip / premium)
  - Tabla `public.clients` con: id, tenant_id, markbox (unique por tenant),
    name, email, phone, address, rif, tier, notes, timestamps, deleted_at
  - Función `public.next_markbox(p_tenant_id uuid) returns text` atómica
    (counter por tenant, formato `DTD-NNNN` con padding 4 dígitos, se
    extiende a 5+ si pasa de 9999)
  - Índices: `(tenant_id, tier)` y `(tenant_id, name)` ambos con
    `where deleted_at is null`
  - RLS por tenant reusando `get_user_tenant_id()`
  - Grants explícitos
  - Trigger `touch_updated_at` reusado
  - Seed: 3-5 clientes matching con `client_name` actuales de shipments
    para que el "histórico" tenga data desde día 1

#### Lib
- `lib/studio/client-types.ts`:
  - `Client`, `ClientTier`, `ClientInput`
  - `CLIENT_TIER_OPTIONS` para selects
  - `RIF_REGEX` = `/^[VEJGP]-?\d{8}-?\d$/i`
  - `formatRif(raw)` → normaliza a `X-XXXXXXXX-X`
  - `validateClientInput(partial)` — sin zod (patrón del proyecto)
  - `tierLabel(tier)` para badges
- `lib/studio/client-queries.ts`:
  - `listClients(supabase, filters)` — tier, q (search en name/markbox/email)
  - `getClientByMarkbox(supabase, markbox)` — para detalle
  - `listShipmentsByMarkbox(supabase, markbox)` — histórico (read-only)

#### UI
- `app/studio/(app)/clientes/page.tsx` (server) — reemplaza placeholder:
  - Header con eyebrow + h1 "Clientes." + subtítulo + botón "+ Nuevo cliente"
  - Toolbar: input search (debounced 350ms) + select tier (URL state)
  - Tabla: MARKBOX (mono) · Nombre · Tier (badge) · Email · Phone · RIF · Acciones
  - Click en fila → `/studio/clientes/[markbox]`
  - Empty state
- `app/studio/(app)/clientes/[markbox]/page.tsx` (server):
  - Header con MARKBOX (mono grande) · Nombre · Tier badge
  - Card de datos: email, phone, address, rif, notes
  - Sección "Historial de envíos" con tabla de shipments donde
    `client_markbox = X`, ordenados por created_at DESC, click → detalle
  - Botón "Editar cliente" abre drawer en modo edit
  - Link "← Volver al listado"
- `_components/ClientsClient.tsx` (client) — orquesta lista + drawer:
  - Header, toolbar, tabla
  - Botón "+ Nuevo cliente" abre drawer en mode create
- `_components/ClientDrawer.tsx` (client) — crear/editar:
  - Drawer 560px
  - Form: name (req), email (opt + validación), phone, address, rif (opt
    + regex), tier select, notes
  - En mode edit: muestra MARKBOX read-only en el header del drawer
  - En mode create: NO input markbox (se autogenera al submit)
  - Soft delete en footer (mode edit) con confirmación inline
- `_components/ClientDetailClient.tsx` (client wrapper para detalle):
  - Botón "Editar" que abre el drawer en mode edit
  - Renderiza el contenido del detalle

#### Server actions
- `clientes/actions.ts`:
  - `createClient(prev, formData)` — autogenera markbox via
    `rpc('next_markbox', { p_tenant_id })` → insert
  - `updateClient(markbox, prev, formData)` — patch por markbox (no toca markbox)
  - `softDeleteClient(markbox)` — set `deleted_at`

### NO incluye (queda para SDDs futuros)

- **FK constraint** entre `shipments.client_markbox` y `clients.markbox` —
  por ahora solo lookup textual. Migration de FK futura con cleanup de
  markboxes huérfanos.
- **Update automático del badge "187"** en sidebar — se ignora hasta que
  exista wireup real al count.
- **Cálculo automático de tier** según volumen — manual por operador. Si
  el negocio lo necesita, SDD futuro con job de Supabase.
- **Merge de clientes duplicados** — sin handling. Si dos operadores crean
  el mismo cliente, queda duplicado hasta limpieza manual.
- **Sync con CRM externo** (HubSpot, etc.) — no. Solo Studio.
- **Bulk import desde Excel** — útil para migración inicial pero queda
  para SDD futuro. Por ahora carga manual.
- **Histórico de tier changes** — sin audit log. Edit pisa.
- **Portal Cliente con MARKBOX login** — SDD-0034 (apps mobile sprint).

---

## 3. Archivos a crear / editar

### Nuevos

```
docs/specs/0010-clientes/
└── spec.md                                              ← este

supabase/migrations/
└── 0006_clients.sql                                     ← schema + función + seed

lib/studio/
├── client-types.ts                                      ← Client, ClientInput, RIF_REGEX
└── client-queries.ts                                    ← list, getByMarkbox, listShipments

app/studio/(app)/clientes/
├── page.tsx                                             ← reemplaza placeholder
├── actions.ts                                           ← create, update, softDelete
├── _components/
│   ├── ClientsClient.tsx                                ← orquesta lista + drawer
│   ├── ClientDrawer.tsx                                 ← form crear/editar
│   └── ClientDetailClient.tsx                           ← wrapper detalle con drawer edit
└── [markbox]/
    └── page.tsx                                         ← detalle con histórico
```

### Editados

```
docs/design/v1-studio/module-map.md                      ← 1.3 ✅
```

---

## 4. Schema completo

```sql
create type client_tier as enum ('regular', 'vip', 'premium');

create table public.clients (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  markbox     text not null,                          -- "DTD-0001"
  name        text not null,
  email       text,
  phone       text,
  address     text,
  rif         text,                                   -- "J-12345678-9"
  tier        client_tier not null default 'regular',
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  unique (tenant_id, markbox)
);

create index clients_tenant_tier_idx
  on public.clients (tenant_id, tier) where deleted_at is null;

create index clients_tenant_name_idx
  on public.clients (tenant_id, name) where deleted_at is null;

-- Función atómica que devuelve el próximo MARKBOX para un tenant.
-- Usa COUNT + 1 con lock para evitar race conditions concurrentes.
-- Formato: DTD-NNNN con padding 4 dígitos (se extiende si >9999).
create or replace function public.next_markbox(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_padded text;
begin
  select count(*) into v_count
  from public.clients
  where tenant_id = p_tenant_id;

  v_padded := lpad((v_count + 1)::text, 4, '0');
  return 'DTD-' || v_padded;
end;
$$;

grant select, insert, update, delete on public.clients to authenticated;
grant execute on function public.next_markbox(uuid) to authenticated;

alter table public.clients enable row level security;

create policy "clients by tenant"
  on public.clients for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

create trigger clients_touch
  before update on public.clients
  for each row execute function public.touch_updated_at();
```

### Seed (matching con shipment client_names actuales)

```sql
-- Sample real basado en seed de SDD-0005 shipments
insert into public.clients (tenant_id, markbox, name, email, phone, tier, rif, notes)
select t.id, x.markbox, x.name, x.email, x.phone, x.tier::client_tier, x.rif, x.notes
from public.tenants t
cross join (values
  ('DTD-0001', 'Empresa Demo S.A.',  'compras@demosa.com.ve',  '+58 414 1234567', 'vip',     'J-12345678-9', 'Cliente histórico desde 2020'),
  ('DTD-0002', 'Carga Ejemplo C.A.', 'logistica@cargaejemplo.com', '+58 412 7654321', 'regular', 'J-87654321-0', null),
  ('DTD-0003', 'Demo Pyme C.A.',     null,                     '+58 414 5550000', 'regular', null,           'Pyme regional, 3 envíos/mes'),
  ('DTD-0004', 'Demo Local Pyme',    'demo@localpyme.ve',      null,              'premium', 'V-12345678',   'Premium 2026 — volumen alto'),
  ('DTD-0005', 'Importadora Andina', 'andina@import.com.ve',   '+58 412 9999999', 'regular', 'J-11112222-3', 'Cliente nuevo Q1 2026')
) as x(markbox, name, email, phone, tier, rif, notes)
where t.slug = 'dtd'
on conflict (tenant_id, markbox) do nothing;
```

---

## 5. Decisiones de diseño

### 5.1 MARKBOX autogenerado con función Postgres atómica

**Por qué:** evitar typos del operador (`DTC-0001` vs `DTD-0001`) y
guarantee unicidad. La función Postgres es atómica (no race conditions
en concurrencia).

**Trade-off:** si se elimina un cliente (soft) y luego se crea otro, el
counter sigue desde N+1 (no reusa el del eliminado). Esto es deliberado
— MARKBOX es ID estable que no debe reusarse.

**Edge case:** si pasa de 9999 clientes, el padding se extiende
automáticamente (`DTD-10000`). Comportamiento esperado.

### 5.2 Sin FK constraint con shipments

`shipments.client_markbox` ya existe como `text`. Si forzamos FK ahora:
- Romperían los shipments cuyo `client_markbox` no esté en `clients` aún
- Forzar a operadores a crear cliente antes de cada envío sería fricción

Decisión: **soft relación textual**. El detalle del cliente busca shipments
con `client_markbox = markbox` via query. Sin garantía referencial pero
sin breaking change. FK constraint llega cuando todo el seed esté limpio
(SDD futuro de cleanup).

### 5.3 RIF venezolano opcional + regex validation

Formato: `[VEJGP]-?\d{8}-?\d` (e.g. `J-12345678-9`, `V-12345678`,
`J123456789`). Aceptamos con o sin guiones. Al guardar normalizamos a
`X-XXXXXXXX-X`.

Opcional porque hay clientes residenciales sin RIF formal (personas
naturales con cédula). Si el operador escribe, validamos. Si no, NULL.

### 5.4 3 tiers hardcoded

`regular`, `vip`, `premium`. Sin lógica de cálculo automático — asignación
manual. Si el negocio quiere "auto-upgrade a VIP si >10 envíos/mes",
es SDD futuro con job/trigger.

### 5.5 Detalle como página separada (no drawer)

Lista con drawer crear/editar. Detalle como `/clientes/[markbox]` con
URL propia (bookmarkeable, compartible) + histórico de envíos.

Drawer queda para CRUD rápido. Page para inspección con contexto completo.

### 5.6 Histórico de envíos lazy fetch en el detalle

El detalle hace dos queries: `getClientByMarkbox` + `listShipmentsByMarkbox`.
Sin pagination en V1 (hasta 200 envíos por cliente debería bastar).

### 5.7 Sidebar badge "187" deshabilitado

El número del handoff es fake (data demo). Por ahora no muestro count en
sidebar — los placeholders no quedan en `badge` field. Cuando agreguemos
wireup real, lo poblamos server-side.

---

## 6. Criterios de aceptación

### Backend
- [ ] Migration aplicada sin errores
- [ ] Seed crea 5 clientes en tenant `dtd`
- [ ] `next_markbox()` retorna `DTD-0006` (siguiente al seed) en la
      primera invocación post-seed
- [ ] RLS bloquea SELECT de clientes de otro tenant (verificable solo
      con el patrón mismo — solo hay un tenant hoy)
- [ ] UNIQUE constraint rechaza markbox duplicado

### Lib
- [ ] `listClients({tier: 'vip'})` retorna 1 row del seed (Empresa Demo S.A.)
- [ ] `getClientByMarkbox('DTD-0001')` retorna el cliente
- [ ] `getClientByMarkbox('DTD-9999')` retorna null
- [ ] `RIF_REGEX.test('J-12345678-9')` → true
- [ ] `RIF_REGEX.test('Z-123-X')` → false

### UI
- [ ] `/studio/clientes` muestra 5 clientes del seed
- [ ] Click en fila navega a `/studio/clientes/DTD-0001`
- [ ] Detalle muestra datos del cliente + histórico de shipments
- [ ] Filtro tier funciona via URL state
- [ ] Search filtra fuzzy en name/markbox/email
- [ ] Drawer "+ Nuevo cliente" abre, autogenera MARKBOX al submit
- [ ] Botón "Editar" en detalle abre drawer en mode edit con MARKBOX
      readonly
- [ ] Soft delete pide confirmación
- [ ] Dark + light themes funcionan

### Sistema
- [ ] `pnpm typecheck` pasa
- [ ] Cero hex literales nuevos
- [ ] Sidebar marca "Clientes" como active

---

## 7. Out of scope / open questions

- **¿Múltiples emails/phones por cliente?** No por ahora. Si negocio
  pide, agregar tabla `client_contacts`.
- **¿Tags arbitrarios además de tier?** No. Si crece la taxonomía,
  agregamos tabla `client_tags` con M:N.
- **¿Búsqueda en histórico de shipments del cliente?** No — solo
  ordenamiento por fecha desc. Si hay clientes con cientos de envíos,
  agregar filtros.
- **¿Edición de MARKBOX?** NO. Es ID inmutable. Si el operador insiste,
  delete + create new.
