---
sdd: "0008"
title: "DoorTuDoor — Tarifas (módulo rates) · primer módulo real del handoff"
status: done
author: "founder"
created: 2026-05-24
updated: 2026-06-02
supersedes: null
superseded_by: null
related: ["0003", "0004", "0005", "0006", "0007"]
confidencialidad: interno
---

# DTD-0008 — Tarifas (módulo `rates`)

> **Primer módulo real del handoff de diseño v1 portado al Studio.** Sienta el
> patrón para los SDDs siguientes (Cambio de destino, Clientes, Cotizador).
> Valida que: shell → page → drawer → server actions → Supabase + RLS funciona
> end-to-end sin fricción.

---

## 1. Resumen en una línea

Catálogo CRUD de tarifas por servicio + ruta (origen → destino), con tarifa por
CBM (LCL) o flat (FCL), min charge, días de tránsito y vigencia. Bloquea Cambio
de destino (SDD-0009), Cotizador (SDD-0011) y Facturación (SDD-0020) porque
todos necesitan leer del catálogo.

---

## 2. Scope

### Incluye

#### Backend (Supabase)
- Migration `0005_rates.sql`:
  - Tabla `public.rates` con todas las columnas necesarias
  - CHECK constraint: al menos `per_cbm` o `flat_rate` debe estar seteado
  - Índices: `(tenant_id, service)` y `(tenant_id, valid_until)` ambos con
    `where deleted_at is null`
  - RLS por `tenant_id` reusando `public.get_user_tenant_id()`
  - Grants explícitos (memoria del proyecto: auto-expose OFF)
  - Trigger `touch_updated_at` reutilizando function existente
  - Seed: 4-6 rutas DTD reales para que la pantalla nazca poblada

#### Lib (TypeScript)
- `lib/studio/rate-types.ts`:
  - `Rate` type (matchea schema)
  - `RateInput` = subset editable
  - Reusa `ShipmentService` de `shipment-types.ts` (mismo enum)
  - `RATE_SERVICE_OPTIONS` para selects
- `lib/studio/rate-queries.ts`:
  - `listRates(supabase, { service?, q? })` con filtros + búsqueda fuzzy en
    origen/destino
  - `getRateById(supabase, id)` para edit
  - Hasta 200 filas por query

#### Pages + actions
- `app/studio/(app)/tarifas/page.tsx` — reemplaza el placeholder por:
  - Header con eyebrow "OPERACIÓN COMERCIAL" + h1 "Tarifas." + subtítulo
    + botón "+ Nueva tarifa" + botón "Exportar tarifario" (deshabilitado)
  - Toolbar: input search (debounced 350ms via URL params) + select servicio
  - Tabla con columnas del handoff: Servicio · Origen · Destino · Tarifa ·
    Min charge · Tránsito · Vigencia · Acciones (edit, duplicate deshabilitado)
  - Empty state con CTA "+ Nueva tarifa"
  - Filas clickeables → abren drawer en modo edit
- `app/studio/(app)/tarifas/actions.ts`:
  - `createRate(prevState, formData)`
  - `updateRate(id, prevState, formData)`
  - `softDeleteRate(id)` — set `deleted_at = now()`
  - Validación con zod (esquemas en `rate-types.ts`)
  - ActionState pattern del SDD-0006
- `app/studio/(app)/tarifas/_components/RateDrawer.tsx` (client):
  - Drawer lateral derecho 560px (o modal centrado si más simple)
  - Form: servicio select, origen text, destino text, per_cbm o flat_rate
    (visible según servicio), min_charge, transit_days, valid_until, notes
  - "Soft delete" como botón secundario danger en footer
  - Cierra con Esc o click fuera
  - `useActionState` para el form submit

### NO incluye (queda para SDDs futuros)

- **Botón "Duplicar"** — visible pero `disabled` con tooltip "Próximamente"
- **Botón "Exportar tarifario"** — visible pero `disabled` con tooltip
- **Lookup tables `origins` / `destinations`** — origen/destino son `text`
  libre por ahora. Cuando llegue el módulo Clientes con direcciones,
  evaluamos lookup tables.
- **Tarifas por container type específico** (20', 40', 40HC del handoff
  original) — el `service` actual cubre `reserva_FCL` agregado, sin granular
  por container. Si el negocio lo necesita, agregamos columna `container_type`
  text nullable en SDD futuro.
- **Historial de cambios de tarifa** (audit log) — no se versiona; al editar
  se pisa. Si el negocio necesita tracking de cambios, SDD futuro.
- **Multi-moneda** — solo USD por ahora (matchea `tenants.base_currency`).
- **Estados de tarifa** (draft / published / archived) — no hay; toda tarifa
  no-soft-deleted es "vigente" si `valid_until >= today`.
- **Hooks al Cotizador** — el Cotizador (SDD-0011) consumirá `listRates()`.
  No hay nada que escribir desde Tarifas hacia Cotizador.

---

## 3. Archivos a crear / editar

### Nuevos

```
docs/specs/0008-tarifas/
└── spec.md                                              ← este archivo

supabase/migrations/
└── 0005_rates.sql                                       ← schema + RLS + seed

lib/studio/
├── rate-types.ts                                        ← Rate, RateInput, zod
└── rate-queries.ts                                      ← listRates, getRateById

app/studio/(app)/tarifas/
├── page.tsx                                             ← reemplaza placeholder
├── actions.ts                                           ← create, update, softDelete
└── _components/
    └── RateDrawer.tsx                                   ← client, form crear/editar
```

### Editados

```
docs/design/v1-studio/module-map.md                      ← marcar 1.1 ✅ SDD-0008
```

### Sin cambios

```
app/studio/(app)/_components/StudioSidebar.tsx           ← badge "Tarifas" sigue sin número
                                                          (lo wireamos cuando haya >0 rates)
```

---

## 4. Schema completo

```sql
create table public.rates (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  service      shipment_service not null,    -- reusa enum existente
  origin       text not null,
  destination  text not null,
  per_cbm      numeric(10,2),
  flat_rate    numeric(10,2),
  min_charge   numeric(10,2),
  transit_days int,
  valid_until  date,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  check (per_cbm is not null or flat_rate is not null)
);

create index rates_tenant_service_idx
  on public.rates (tenant_id, service)
  where deleted_at is null;

create index rates_tenant_valid_idx
  on public.rates (tenant_id, valid_until)
  where deleted_at is null;

grant select, insert, update, delete on public.rates to authenticated;

alter table public.rates enable row level security;

create policy "rates by tenant"
  on public.rates for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

create trigger rates_touch
  before update on public.rates
  for each row execute function public.touch_updated_at();
```

### Seed (rutas DTD reales)

```sql
insert into public.rates (tenant_id, service, origin, destination, per_cbm, flat_rate, min_charge, transit_days, valid_until, notes)
select t.id, x.service, x.origin, x.destination, x.per_cbm, x.flat_rate, x.min_charge, x.transit_days, x.valid_until, x.notes
from public.tenants t
cross join (values
  ('consolidacion'::shipment_service,        'Yiwu',      'Valencia',     480.00,  null,    380.00, 38, '2026-12-31'::date, 'LCL DDP estándar Yiwu-Valencia'),
  ('consolidacion'::shipment_service,        'Guangzhou', 'Valencia',     520.00,  null,    400.00, 42, '2026-12-31'::date, 'LCL DDP Guangzhou-Valencia'),
  ('puerta_a_puerta_DDP'::shipment_service,  'Yiwu',      'Caracas',      550.00,  null,    450.00, 40, '2026-12-31'::date, 'DDP prepago Yiwu-Caracas con last mile'),
  ('reserva_FCL'::shipment_service,          'Guangzhou', 'La Guaira',    null,    8500.00, null,   35, '2026-12-31'::date, 'FCL 40 HC Guangzhou-La Guaira'),
  ('reserva_FCL'::shipment_service,          'Shenzhen',  'Puerto Cabello', null,  7800.00, null,   38, '2026-12-31'::date, 'FCL 40 estándar Shenzhen-Puerto Cabello'),
  ('transporte_terrestre'::shipment_service, 'Valencia',  'Maracaibo',    null,    650.00,  null,    2, '2026-12-31'::date, 'Camión chico Valencia-Maracaibo')
) as x(service, origin, destination, per_cbm, flat_rate, min_charge, transit_days, valid_until, notes)
where t.slug = 'dtd'
on conflict do nothing;
```

---

## 5. Decisiones de diseño

### 5.1 Servicio = enum `shipment_service` existente (reuso)

Se reusa el enum `shipment_service` (4 valores: consolidacion / puerta_a_puerta_DDP
/ reserva_FCL / transporte_terrestre) en lugar de crear un enum nuevo para tarifas.

**Por qué:** una tarifa siempre se asocia a UN servicio comercial. Mantener un
solo enum significa que el Cotizador (SDD-0011) puede hacer JOIN directo
shipments.shipment_service ↔ rates.service sin mappings. Reduce superficie de
error.

**Trade-off:** si en el futuro Tarifas necesita un servicio que NO existe en
shipments (ej: "almacenaje en bodega Yiwu"), agregar al enum afecta también
shipments. Aceptable hoy. Revisión en SDD-0011.

### 5.2 `per_cbm` XOR `flat_rate` con CHECK

El handoff dibuja la tarifa como `$X/CBM` o `$X/ctr` según servicio (LCL = CBM,
FCL = ctr). El schema usa **ambas columnas nullable** + CHECK `(per_cbm is not
null or flat_rate is not null)`.

**Por qué no XOR estricto:** algunos contratos negociados pueden tener AMBOS
(ej: una tarifa LCL con tope de container). El CHECK permite ambos sin forzar
exclusión. La UI muestra el campo apropiado según servicio pero el server
acepta ambos.

### 5.3 RLS hereda de shipments — mismo patrón

`get_user_tenant_id()` + policy `rates by tenant` con `using` filtra
`tenant_id = current` Y `deleted_at is null`. El `with check` solo el tenant
(permite UPDATE que setea `deleted_at` sin conflicto).

### 5.4 Soft delete + sin "Eliminar para siempre"

Como en shipments — `deleted_at = now()` esconde, no borra. Si un operador
elimina por error, recuperable desde Supabase. No hay botón "Eliminar para
siempre" en este SDD (innecesario y peligroso).

### 5.5 Drawer vs Modal

El handoff usa `<U.Drawer width={560}>`. Yo voy con **drawer lateral derecho** —
matchea handoff. Si la primitiva `<Drawer>` no existe todavía (Sprint 0.2
pendiente), construyo uno mínimo inline dentro del componente.

### 5.6 Sin badge de count en sidebar todavía

El sidebar muestra Tarifas sin badge. Cuando haya >0 rates, en SDD futuro
agregamos count real (server-side). Por ahora no hay wireup → no muestro
badge falso.

### 5.7 Naming `valid_until` vs `valid`

El handoff usa `valid` (string libre). Yo uso `valid_until: date` — tipo
estricto + parseable + permite query `where valid_until >= today` para
filtrar "vigentes".

---

## 6. Criterios de aceptación

### Backend
- [ ] Migration `0005_rates.sql` aplicada sin errores
- [ ] Seed crea 6 rows en tenant `dtd`
- [ ] RLS funciona: usuario de tenant A NO ve rates de tenant B (verificable
      pero solo hay tenant `dtd` hoy — el patrón mismo lo garantiza)
- [ ] CHECK rechaza row sin `per_cbm` ni `flat_rate`
- [ ] Grants explícitos en migration (no 42501 al hacer SELECT)

### Lib
- [ ] `listRates({ service: 'consolidacion' })` retorna 2 rows del seed
- [ ] `listRates({ q: 'yiwu' })` matchea con ilike en origin
- [ ] `getRateById('uuid-nonexistent')` retorna null sin throw

### UI
- [ ] `/studio/tarifas` muestra las 6 rutas del seed en tabla legible
- [ ] Filtro select servicio funciona (URL state)
- [ ] Search input filtra fuzzy (debounced 350ms via URL)
- [ ] Click en fila abre drawer en modo edit
- [ ] Botón "+ Nueva tarifa" abre drawer en modo create
- [ ] Submit del form valida con zod y muestra fieldErrors si aplica
- [ ] Soft delete pide confirmación y re-renderiza la lista sin el row
- [ ] Dark theme funciona sin hex hardcoded
- [ ] Sidebar marca "Tarifas" como active

### Sistema
- [ ] `pnpm typecheck` pasa sin errores
- [ ] Cero hex literales nuevos (solo tokens `var(--*)`)
- [ ] Cero fuentes prohibidas
- [ ] Verificación visual en preview light + dark

---

## 7. Out of scope / open questions

- **¿Tarifas históricas?** Si una tarifa cambia, la versión vieja se pisa.
  Para invoicing retroactivo, eventualmente necesitaremos audit log. Hoy no.
- **¿Notificación cuando una tarifa vence?** No hay job para mandar email
  cuando `valid_until < today + 30 días`. Sprint operativo futuro.
- **¿Validación de "no dos tarifas activas para misma ruta + servicio"?**
  Por ahora se permite (puede haber tarifas A/B testing). Si hace falta, se
  agrega `unique (tenant_id, service, origin, destination) where deleted_at
  is null`.
- **¿Editar el `service` de una tarifa existente?** Sí, se permite. Si afecta
  envíos en curso, es responsabilidad del operador no romper data.
