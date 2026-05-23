---
sdd: "0003"
title: "DoorTuDoor — Arquitectura MVP del ERP interno (multi-tenant ready)"
status: approved
author: "founder"
created: 2026-05-23
updated: 2026-05-23
supersedes: null
superseded_by: null
related: ["0001", "0002"]
---

# DTD-0003 — DoorTuDoor: arquitectura MVP del ERP interno

> **Generado en modo planning vía `/office-hours` el 2026-05-23.**
> **Modo: intrapreneurship.** DoorTuDoor arranca como ERP interno de DTD·CARGO; será el patrón/base para el ERP futuro del proyecto HailuWay.

---

## 1. Resumen en una línea

DoorTuDoor es el ERP interno de DTD·CARGO construido como **route group separado** dentro de este mismo repo (`app/studio/**` + `app/api/**`), con **multi-tenancy ready desde día 1** (DTD es el primer y único tenant), **Supabase Auth + 1 rol admin**, **moneda base USD**, **soft delete**, y **Tracking de envíos** como primer módulo con datos — modelado sobre 4 productos comerciales reales (consolidación, DDP prepago, reserva FCL, transporte terrestre) y 13 estados que reflejan el flujo LCL-mayoritario de DTD.

---

## 2. Problema

El sitio público `dtdcargo.com` está vivo y editado constantemente, pero **toda la operación interna sigue ocurriendo en Excel + WhatsApp**. Lo que falta:

- **Sin backend propio.** El sitio público está aislado por diseño (HTTP a un ERP HailuWay que aún no existe como producto operativo). Hoy los datos de tracking, cotización y leads son mocks.
- **Sin login de equipo.** No hay forma de que un operador entre a un panel a crear envíos, actualizar estados, gestionar el día.
- **Sin dashboard.** No hay visibilidad consolidada de envíos activos, alertas, cargas en aduana.
- **Brand book v2.3 ya diseñó el backend** (sección 22 "DTD Studio") pero no está implementado — son mocks visuales.
- **DTD·CARGO necesita su propio ERP antes que HailuWay** (que es la visión SaaS multi-tenant de la industria entera). DoorTuDoor sirve a DTD primero; HailuWay aprovecha la arquitectura después.

---

## 3. Audiencia

Tres perfiles, en orden de prioridad para este MVP:

1. **Operador / Owner DTD·CARGO** (vos + 1-3 personas eventualmente). Entra a `dtdcargo.com/studio` con email+password. Crea envíos, actualiza estados, ve el dashboard. **Único perfil del MVP-0.**
2. **Cliente final DTD·CARGO** (eventual, fase posterior). Entrará al Portal Cliente con código MARKBOX (DTD-XXXX). **FUERA del scope de este SDD** — el enum y los mensajes customer-facing ya están preparados.
3. **Visitante del sitio público** (existente). No cambia nada para él — el sitio público sigue exactamente como está. Eventualmente la página `/track/[code]` leerá del mismo backend, pero **eso es un SDD aparte**.

---

## 4. User stories — MVP-0 (Studio shell + Tracking)

- **Como** owner de DTD·CARGO, **quiero** entrar a `dtdcargo.com/studio` con mi email y password, **para** acceder al backend sin compartir credenciales por WhatsApp.
- **Como** operador, **quiero** ver un dashboard con conteos en vivo de envíos en tránsito / en aduana / con alerta / entregados, **para** saber dónde está la operación de un vistazo cuando empiezo el día.
- **Como** operador, **quiero** crear un envío eligiendo uno de los 4 productos comerciales (consolidación / Puerta a Puerta DDP (prepago) / Reserva FCL / Transporte terrestre) y datos básicos, **para** registrarlo en el sistema sin abrir Excel.
- **Como** operador, **quiero** cambiar el estado de un envío (en bodega → embarcado → en tránsito → en aduana → entregado), **para** que el timeline quede actualizado.
- **Como** operador, **quiero** ver la lista completa de envíos con filtros por estado, servicio y búsqueda por código, **para** encontrar uno rápido cuando un cliente pregunta.

**Lo que NO está en MVP-0** (queda para SDDs futuros):
- Portal Cliente con MARKBOX login
- Módulos: Contenido, Noticias, Mailing, Calculadora editor, Brand Book embebido, Equipo (roles), Ajustes avanzados
- Notificaciones WhatsApp/email automáticas
- Mapa global de tracking (sección visual de la Studio mock)
- AI fetcher de noticias
- Conexión del sitio público `/track/[code]` al nuevo backend (SDD aparte cuando autorices)
- Tabla normalizada `vehicle_types` con gestión de flota (TMS) — los campos en MVP-0 son texto libre

---

## 5. Decisiones arquitectónicas cerradas

Ocho decisiones cerradas vía `/office-hours` con el founder:

### 5.1 Estrategia de repo: **mismo repo, route group separado**

DoorTuDoor vive en este mismo repo bajo:
- `app/studio/**` — UI del Studio (route group con su propio layout)
- `app/api/**` — route handlers del backend (REST + Server Actions)
- `lib/db/**`, `lib/auth/**`, `lib/server/**`, `lib/studio/**` — código backend nuevo
- `supabase/migrations/**` — schema migrations
- `supabase/seed.ts` — data sintética para dev

**Por qué:** velocidad de iteración, compartimos design tokens y deploy. **Tradeoff aceptado:** disciplina estricta de aislamiento (sección 6).

### 5.2 URL del Studio: **`/studio` directo en `dtdcargo.com`**

- En dev: `localhost:3000/studio/...`
- En prod: `dtdcargo.com/studio/...`
- Sin subdominio, sin DNS extra, sin SSL extra
- Robot blocking vía `X-Robots-Tag: noindex, nofollow` en rutas `/studio/**`
- **Migración a `studio.dtdcargo.com` queda como opción futura** post pre-launch — 1 rewrite en `vercel.json`, código no cambia

### 5.3 Modelo de datos: **multi-tenant ready desde día 1**

- Tabla `tenants` con DTD como única fila inicial
- Todas las tablas operativas con `tenant_id uuid not null references tenants(id)`
- **Supabase RLS policies** por `tenant_id` (la JWT lleva `tenant_id` como claim derivado)
- Cuando HailuWay arranque (proyecto separado más adelante), el schema ya está listo

**Por qué:** costo inicial bajo (~30 min extra), evita refactor doloroso cuando llegue HailuWay.

### 5.4 Auth: **Supabase Auth + 1 rol admin**

- Email + password (recovery automático)
- Sin granularidad de roles inicial — todos los logueados ven todo
- Cuando se necesite granularidad (operador / owner / viewer), se agrega `role` en `user_tenants` y nuevas RLS policies

**Por qué:** mínima superficie. Roles complejos = deuda si no se usan.

### 5.5 Delete strategy: **soft delete obligatorio**

- Columna `deleted_at timestamptz` en `shipments` y `shipment_events`
- Queries normales filtran `where deleted_at is null`
- Partial index para performance

**Por qué:** estás moviendo mercancía física con valor real. Hard delete = pánico cuando un cliente pregunta por un envío borrado por error.

### 5.6 Primer módulo con datos: **Tracking (envíos + estados)**

Orden de construcción del MVP-0:
1. Shell del Studio (sidebar + topbar + layout)
2. Auth (login + middleware)
3. Schema: `tenants`, `user_tenants`
4. Schema: enums + `shipments` + `shipment_events`
5. Módulo Tracking (CRUD envíos, timeline)
6. Dashboard (Resumen) — los KPIs salen de `shipments`

**Por qué:** Tracking es el dolor #1 operativo de DTD. Sin Tracking, el dashboard está vacío. Con Tracking, todos los demás módulos se enchufan después con menos fricción.

### 5.7 Modelo de servicios comerciales: **`shipment_service` con 4 productos**

DTD vende productos cerrados, no combinaciones libres de Incoterms × modos de transporte. Los 4 productos comerciales reales:

```sql
create type shipment_service as enum (
  'consolidacion',         -- LCL "tradicional": cliente paga aduana, DTD hace trámites
  'puerta_a_puerta_DDP',   -- DDP prepago: DTD asume todo, cliente paga adelantado
  'reserva_FCL',           -- Container completo, contrato específico
  'transporte_terrestre'   -- Ground VE interno, sin marítimo
);
```

**Convención de marca (memoria persistente):** en UI, "Puerta a Puerta DDP" siempre va con **"prepago" en chico debajo o al lado** del nombre principal.

### 5.8 Vehículo: **2 columnas texto libre, normalización diferida**

```sql
-- En shipments
vehicle_category text,   -- 'contenedor_maritimo' | 'camion_chico' | 'camion_pesado' | 'gandola' | 'aereo' | null
vehicle_model text       -- 'Ford 350' | 'Gandola 40 ton' | '40HC Reefer' | null
```

- Obligatorio en el form de creación solo si `shipment_service = 'transporte_terrestre'`
- Opcional para los otros 3 servicios
- **Cuando se construya el módulo Transporte Terrestre (SDD futuro):** se agrega tabla `vehicle_types` normalizada + se migran estos campos a FK

### 5.9 Moneda base: **USD**

- Todas las columnas de dinero (cuando lleguen en SDDs futuros) en `numeric(12,2)` USD
- `tenants` tiene `base_currency text default 'USD'` para preparar HailuWay multi-país
- Display puede mostrar Bs/CNY como conversión derivada, pero el storage siempre es USD
- Stripe (futuro) cobra en USD directo

### 5.10 Idioma: **español-VE exclusivo, sin estructura i18n**

- UI 100% en español Venezuela
- Sin `next-intl` ni librerías de i18n
- **Regla preventiva:** template literals limpios (`` `Hola ${name}` ``), no concat con `+`, para que el sweep i18n futuro sea trivial

---

## 6. Estrategia de aislamiento del frontend público (NO NEGOCIABLE)

Esta sección define **qué se puede tocar y qué no** durante toda la implementación del MVP-0.

### 6.1 Zonas PROHIBIDAS (sin autorización escrita explícita)

```
app/page.tsx                    ← home del sitio
app/layout.tsx                  ← layout raíz (fuentes, BrandMark)
app/globals.css                 ← estilos del sitio
app/calculadora/**              ← calculadora pública
app/cotizar/**                  ← cotizar público
app/servicios/**                ← servicios público
app/contacto/**                 ← contacto público
app/track/**                    ← track público (sigue con mock)
app/noticias/**                 ← noticias público
app/glosario/**                 ← glosario público
app/sitemap.ts / robots.ts      ← SEO del sitio
app/not-found.tsx               ← 404 del sitio
app/admin/cbm-estudio/**        ← presentación interna existente (intocable)
components/**                   ← todos los componentes del sitio
lib/design-tokens.ts            ← tokens visuales
lib/text.tsx                    ← helpers tipográficos
lib/cn.ts                       ← utility de classnames
lib/calc/**, lib/calculadora.ts ← lógica de la calculadora pública
lib/data/**                     ← seed data del sitio
public/**                       ← assets del sitio (logo, favicons)
_handoff_preview/**             ← handoff antiguo del brandbook
_payload-disabled/**            ← intento previo Payload (no resucitar)
BANDBOOK V1/**                  ← brandbook v1 archivado
next.config.ts                  ← config Next.js del sitio
postcss.config.mjs              ← config Tailwind del sitio
tailwind.config.* (si existe)   ← config Tailwind del sitio
eslint.config.mjs               ← lint del sitio
docs/specs/0001-**, 0002-**     ← specs aprobados
```

### 6.2 Zonas LIBRES (creación y edición sin pedir permiso)

```
app/studio/**                   ← UI del Studio (con su propio layout aislado)
app/api/**                      ← route handlers nuevos
lib/db/**                       ← cliente Supabase, helpers de queries
lib/auth/**                     ← session, middleware, JWT helpers
lib/server/**                   ← lógica backend reutilizable
lib/studio/**                   ← lógica frontend del Studio (mensajes, state machine)
lib/types/**                    ← tipos compartidos backend
supabase/**                     ← migrations, policies, seed, generated types
middleware.ts                   ← guard de rutas /studio (archivo nuevo a crear)
docs/specs/0003-** y superiores ← specs nuevos
.env.example                    ← agregar nuevas vars (sin tocar las existentes)
```

### 6.3 Zonas FRONTERA (editar con cuidado documentado)

```
package.json                    ← solo añadir deps backend (@supabase/ssr, etc.)
                                  NO tocar deps del sitio (Payload, etc. — quedan)
                                  Cada cambio: comentario en PR justificándolo
pnpm-lock.yaml                  ← se actualiza solo al instalar deps backend
tsconfig.json                   ← solo si necesitamos path alias nuevos (@/studio, @/db)
CLAUDE.md                       ← actualizar sección de integraciones HTTP cuando
                                  el sitio empiece a leer del nuevo backend
                                  (eso será un SDD aparte)
```

### 6.4 Reglas de workflow

1. **Cada slice = 1 spec SDD aprobado** (`docs/specs/0003-NNNN-slug/spec.md`) antes de empezar a tocar código.
2. **Prefijo de commit obligatorio** para cambios backend: `feat(studio):`, `feat(api):`, `feat(db):`, `feat(auth):`, `feat(supabase):`. **Prohibido** usar `feat(forms):`, `feat(calculadora):`, `feat(servicios):` o cualquier prefijo del sitio público.
3. **Antes de cada commit**: correr `pnpm build` + `pnpm typecheck`. Si el sitio público no compila, el commit no se hace.
4. **Verificación visual antes de mergear**: `pnpm dev` y revisar manualmente las rutas del sitio (`/`, `/servicios`, `/cotizar`, `/contacto`, `/calculadora`, `/track/TEST123`). Si algo cambió visualmente, rollback inmediato.
5. **Aislamiento de CSS**: `app/studio/layout.tsx` define su propio scope. No importa `app/globals.css`. Si necesita los design tokens, lo hace por CSS vars en un módulo `app/studio/studio.css` separado.

---

## 7. Schema de Supabase (MVP-0)

Migraciones en `supabase/migrations/`:

### 7.1 `0001_init_tenancy.sql`

```sql
-- Tenants: empresas que usan el ERP. DTD es la primera.
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,                -- 'dtd' por ahora
  display_name text not null,               -- 'DTD·CARGO'
  brand_primary text not null default '#7F0F1A',
  brand_secondary text not null default '#0F1E3D',
  base_currency text not null default 'USD',-- preparado para HailuWay multi-país
  created_at timestamptz not null default now()
);

-- Asociación user ↔ tenant (preparada para multi-tenant, hoy 1:1 por usuario)
create table public.user_tenants (
  user_id uuid references auth.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  role text not null default 'admin',       -- por ahora solo 'admin'
  created_at timestamptz not null default now(),
  primary key (user_id, tenant_id)
);

-- Función helper para JWT custom claim
create or replace function public.get_user_tenant_id()
returns uuid language sql stable as $$
  select tenant_id from public.user_tenants where user_id = auth.uid() limit 1;
$$;

-- RLS
alter table public.tenants enable row level security;
alter table public.user_tenants enable row level security;

create policy "users see their tenant"
  on public.tenants for select
  using (id = public.get_user_tenant_id());

create policy "users see their own user_tenants"
  on public.user_tenants for select
  using (user_id = auth.uid());

-- Seed: tenant DTD
insert into public.tenants (slug, display_name) values ('dtd', 'DTD·CARGO');
```

### 7.2 `0002_shipments.sql`

```sql
-- Productos comerciales que DTD vende
create type shipment_service as enum (
  'consolidacion',          -- LCL "tradicional", cliente paga aduana
  'puerta_a_puerta_DDP',    -- DDP prepago, DTD asume todo
  'reserva_FCL',            -- Container completo
  'transporte_terrestre'    -- Ground VE interno
);

-- Estados del envío (13 estados, aplicabilidad por servicio en sec. 7.3)
create type shipment_status as enum (
  -- Origen (LCL/FCL: Yiwu · ground: VE)
  'draft',
  'in_warehouse',
  'consolidating',
  -- Tránsito marítimo (LCL/FCL)
  'shipped',
  'in_transit',
  'in_customs',
  -- Distribución LCL (pasa por bodega DTD VE)
  'arrived_destination',
  'delayed_warehouse',
  'out_for_delivery',
  -- Distribución FCL (puerto → galpón cliente directo)
  'last_mile',
  -- Terminal
  'delivered',
  'exception',
  'cancelled'
);

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,                          -- DTDU-XXXXX, BL, AWB
  client_name text,
  client_markbox text,                         -- DTD-XXXX (futuro link a clients table)
  origin text,
  destination text,
  shipment_service shipment_service not null,  -- producto comercial
  status shipment_status not null default 'draft',
  weight_kg numeric(10,2),
  volume_m3 numeric(10,3),
  vehicle_category text,                       -- 'contenedor_maritimo' | 'camion_chico' | 'camion_pesado' | 'gandola' | 'aereo'
  vehicle_model text,                          -- 'Ford 350', 'Gandola 40 ton', '40HC Reefer', etc.
  arrived_destination_at timestamptz,          -- cuando llegó a bodega DTD VE (para calcular bodegaje)
  cancellation_reason text,                    -- solo si status = 'cancelled'
  notes text,
  deleted_at timestamptz,                      -- soft delete
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create index shipments_tenant_status_idx
  on public.shipments (tenant_id, status)
  where deleted_at is null;

create index shipments_tenant_service_idx
  on public.shipments (tenant_id, shipment_service)
  where deleted_at is null;

create table public.shipment_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  status shipment_status not null,
  note text,
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index shipment_events_shipment_idx
  on public.shipment_events (shipment_id, occurred_at desc)
  where deleted_at is null;

-- RLS: solo se ven envíos del tenant del usuario
alter table public.shipments enable row level security;
alter table public.shipment_events enable row level security;

create policy "shipments by tenant"
  on public.shipments for all
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

create policy "shipment_events by tenant"
  on public.shipment_events for all
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

-- Trigger updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger shipments_touch
  before update on public.shipments
  for each row execute function public.touch_updated_at();

-- Trigger arrived_destination_at: se setea automáticamente cuando el status
-- pasa por primera vez a 'arrived_destination'
create or replace function public.set_arrived_destination_at()
returns trigger language plpgsql as $$
begin
  if new.status = 'arrived_destination'
     and (old.status is null or old.status <> 'arrived_destination')
     and new.arrived_destination_at is null then
    new.arrived_destination_at = now();
  end if;
  return new;
end; $$;

create trigger shipments_arrived_at
  before insert or update on public.shipments
  for each row execute function public.set_arrived_destination_at();
```

### 7.3 Matriz de aplicabilidad estados × servicio

El frontend del Studio enforce esto en el form de edición (solo muestra transiciones válidas). La DB no enforce — sería over-engineering para MVP-0.

| Estado | Consolidación | DDP prepago | Reserva FCL | Terrestre | Notas |
|---|:---:|:---:|:---:|:---:|---|
| `draft` | ✅ | ✅ | ✅ | ✅ | borrador, todavía no confirmado |
| `in_warehouse` | ✅ Yiwu | ✅ Yiwu | ✅ Yiwu | ✅ VE | la bodega de origen depende del servicio |
| `consolidating` | ✅ | ✅ | — | — | FCL no agrupa, ground tampoco |
| `shipped` | ✅ | ✅ | ✅ | — | ground no zarpa |
| `in_transit` | ✅ | ✅ | ✅ | ✅ | LCL/FCL en mar · ground en camión |
| `in_customs` | ✅ | ✅ | ✅ | — | ground no pasa aduana |
| `arrived_destination` | ✅ | ✅ | — | — | FCL va directo del puerto al cliente |
| `delayed_warehouse` | ✅ | ✅ | — | — | 15+ días sin retiro/pago |
| `out_for_delivery` | ✅ | ✅ | — | ✅ | desde bodega DTD VE |
| `last_mile` | — | — | ✅ | — | solo FCL: puerto → galpón cliente |
| `delivered` | ✅ | ✅ | ✅ | ✅ | terminal feliz |
| `exception` | ✅ | ✅ | ✅ | ✅ | pausa con problema activo |
| `cancelled` | ✅ | ✅ | ✅ | ✅ | terminal sin entrega |

### 7.4 Mensajes customer-facing — 2 niveles (servicio × estado)

Vive en `lib/studio/shipment-messages.ts`. **NO está expuesto al cliente final en MVP-0** (el Portal Cliente es SDD futuro), pero sí se muestra como preview en el Studio para que el operador vea "esto verá el cliente":

```typescript
// lib/studio/shipment-messages.ts
export const shipmentMessages = {
  consolidacion: {
    in_transit: "En tránsito marítimo. Prepare su pago de aduana.",
    in_customs: "En aduana. Pagá impuestos para liberar tu carga.",
    arrived_destination: "Llegó a nuestra bodega. Coordiná retiro o entrega.",
    delayed_warehouse: "Tu carga lleva {days} días en bodega · USD {fee} acumulado",
    out_for_delivery: "En reparto hacia tu dirección",
    delivered: "Entregado ✓",
    // ...
  },
  puerta_a_puerta_DDP: {
    in_transit: "En tránsito marítimo. Faltan {days} días para tu anticipo.",
    in_customs: "En aduana. Tu pago debió completarse — contactanos.",
    arrived_destination: "Llegó a nuestra bodega. Coordinamos entrega.",
    out_for_delivery: "En reparto hacia tu dirección",
    delivered: "Entregado ✓",
    // ...
  },
  reserva_FCL: {
    in_transit: "Tu container en tránsito marítimo",
    in_customs: "En aduana Venezuela",
    last_mile: "Tu container sale del puerto hacia tu galpón",
    delivered: "Entregado ✓",
    // ...
  },
  transporte_terrestre: {
    in_warehouse: "Recibido en nuestra bodega",
    in_transit: "En ruta hacia tu dirección",
    out_for_delivery: "En reparto",
    delivered: "Entregado ✓",
    // ...
  },
} as const;
```

**Convención de marca:** en cualquier label de UI que muestre "Puerta a Puerta DDP", el "prepago" va en chico debajo o al lado del nombre principal.

---

## 8. Estructura de archivos del Studio

```
app/
├── studio/                          ← NUEVO route group
│   ├── layout.tsx                   ← layout aislado (NO importa globals.css del sitio)
│   ├── studio.css                   ← estilos del Studio (scope propio)
│   ├── (auth)/
│   │   ├── login/page.tsx           ← form login
│   │   └── reset/page.tsx           ← reset password
│   ├── (app)/                       ← rutas autenticadas
│   │   ├── layout.tsx               ← sidebar + topbar + auth guard
│   │   ├── page.tsx                 ← redirige a /studio/resumen
│   │   ├── resumen/page.tsx         ← Dashboard (KPIs)
│   │   ├── tracking/
│   │   │   ├── page.tsx             ← lista de envíos
│   │   │   ├── nuevo/page.tsx       ← form crear envío (con shipment_service + vehicle)
│   │   │   └── [id]/page.tsx        ← detalle + timeline
│   │   └── ajustes/page.tsx         ← (vacío MVP-0, placeholder)
│   └── _components/                 ← componentes del Studio (no se mezclan con components/)
│       ├── Sidebar.tsx
│       ├── Topbar.tsx
│       ├── StatusBadge.tsx
│       ├── ServiceBadge.tsx         ← muestra el producto comercial con tag DDP/prepago
│       └── KPICard.tsx
├── api/                             ← NUEVO
│   ├── studio/
│   │   ├── shipments/
│   │   │   ├── route.ts             ← GET list, POST create
│   │   │   └── [id]/
│   │   │       ├── route.ts         ← GET, PATCH, DELETE (soft)
│   │   │       └── events/route.ts  ← POST nuevo evento
│   │   └── kpis/route.ts            ← GET dashboard counts
│   └── auth/                        ← callbacks Supabase (si hace falta)
│       └── callback/route.ts
└── (existing public routes: NO TOCAR) ...

lib/
├── db/
│   ├── client.ts                    ← createBrowserClient
│   ├── server.ts                    ← createServerClient (con cookies)
│   └── types.ts                     ← tipos generados de Supabase
├── auth/
│   ├── middleware.ts                ← guard de rutas /studio
│   └── session.ts                   ← getSession helper
├── server/
│   └── shipments.ts                 ← queries reutilizables
└── studio/
    ├── shipment-messages.ts         ← mapeo servicio × estado → mensaje cliente
    ├── shipment-state-machine.ts    ← transiciones válidas por servicio
    └── tokens.css                   ← CSS vars del Studio si hace falta

supabase/
├── migrations/
│   ├── 0001_init_tenancy.sql
│   └── 0002_shipments.sql
├── seed.ts                          ← seed con tenant DTD + 5-10 envíos sintéticos
│                                      cubriendo los 4 servicios
└── config.toml                      ← config local CLI

middleware.ts                        ← raíz: redirige /studio sin sesión → /studio/login
```

---

## 9. Surface API del MVP-0

Todas las rutas viven bajo `/api/studio/*` y requieren sesión Supabase válida.

| Método | Ruta | Acción |
|---|---|---|
| `GET` | `/api/studio/kpis` | Conteos para dashboard: en tránsito, en aduana, entregados, con alerta. Group by `shipment_service` opcional. |
| `GET` | `/api/studio/shipments` | Lista envíos del tenant (paginada, filtros `?status=&service=&q=`) |
| `POST` | `/api/studio/shipments` | Crea envío. Valida: si `service='transporte_terrestre'`, `vehicle_category` obligatorio. |
| `GET` | `/api/studio/shipments/[id]` | Detalle envío + timeline de eventos |
| `PATCH` | `/api/studio/shipments/[id]` | Edita campos del envío |
| `DELETE` | `/api/studio/shipments/[id]` | Soft delete (set `deleted_at = now()`) |
| `POST` | `/api/studio/shipments/[id]/events` | Agrega evento. Valida transición permitida según `service`. |

**Notas:**
- **Ninguna ruta `/api/public/**` se crea en este SDD.** Esas son para cuando el sitio público lea del backend, y eso será otro SDD.
- Las rutas leen el `tenant_id` del JWT, no aceptan `tenant_id` como param (seguridad).
- Validación de transición de estado vive en `lib/studio/shipment-state-machine.ts` y se aplica server-side.

---

## 10. Variables de entorno nuevas

Agregar a `.env.example` sin tocar las existentes:

```bash
# ─────────────────────────────────────────────────────────────
# DoorTuDoor — Supabase (separado del Payload viejo)
# Formato nuevo Supabase (Q4 2025+): sb_publishable_* y sb_secret_*
# Nombres de variables quedan legacy para compatibilidad con @supabase/ssr
# y snippets estándar de la comunidad.
# ─────────────────────────────────────────────────────────────

# Supabase project URL (Settings → API)
NEXT_PUBLIC_SUPABASE_URL=

# Publishable key — formato sb_publishable_* (reemplaza el "anon public" key viejo)
# Settings → API Keys → Publishable keys
# Safe para cliente: respeta RLS automáticamente.
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Secret key — formato sb_secret_* (reemplaza el "service_role" key viejo)
# Settings → API Keys → Secret keys → Reveal
# SOLO server-side. Bypassea RLS. Nunca commitear ni exponer al cliente.
SUPABASE_SERVICE_ROLE_KEY=
```

**OJO:** las vars existentes `DATABASE_URL`, `PAYLOAD_SECRET`, `S3_*` son del intento Payload viejo. **No las borramos** por ahora (por si algún día se reactiva). Pero las nuevas vars `NEXT_PUBLIC_SUPABASE_*` son las que usa DoorTuDoor.

---

## 11. Fases de implementación (slices)

Cada slice = 1 spec SDD aprobado + 1 PR.

### Fase 0 — Cimientos (este SDD-0003)
- ✅ Aprobar este design doc (cambiar frontmatter `status: draft` → `status: approved`)
- Output: nada de código todavía, solo plan

### Fase 1 — Studio shell + Auth (SDD-0004 futuro)
- Crear `app/studio/layout.tsx` + login + reset
- Middleware de auth
- Migración `0001_init_tenancy.sql`
- Seed básico con tenant DTD + 1 user owner
- **Criterio done:** podés logarte a `localhost:3000/studio/login` y ver un layout vacío con sidebar

### Fase 2 — Dashboard + Tracking (SDD-0005 futuro)
- Migración `0002_shipments.sql` (enums + tablas + RLS + triggers)
- `lib/studio/shipment-messages.ts` con mapeo 2-niveles
- `lib/studio/shipment-state-machine.ts` con transiciones por servicio
- CRUD de envíos completo (lista, crear, editar, detalle, timeline)
- Dashboard con KPIs leyendo de `shipments`
- Seed con 5-10 envíos sintéticos cubriendo los 4 servicios
- **Criterio done:** podés crear envíos de los 4 servicios, cambiar sus estados respetando la matriz, y el dashboard refleja el cambio

### Fase 3 (eventual) — Conexión sitio público (SDD-0006 futuro, requiere autorización)
- `/track/[code]` del sitio público lee de `/api/public/track/[code]` del backend
- Reemplaza el mock actual
- **Requiere autorización explícita** porque toca `app/track/` (zona prohibida hoy)

### Fase 4+ — Módulos siguientes (SDDs futuros)
- Calculadora editor (SDD-0007)
- Mailing (SDD-0008)
- Portal Cliente con MARKBOX (SDD-0009)
- Módulo Transporte Terrestre con tabla `vehicle_types` normalizada (SDD-0010+)
- Etc.

---

## 12. Criterios de éxito del MVP-0

- [ ] Puedo logarme a `localhost:3000/studio` con email+password
- [ ] El layout del Studio se ve aislado del sitio público (no hereda estilos no deseados)
- [ ] El sitio público `/`, `/calculadora`, `/cotizar`, `/servicios`, `/contacto` se ve **EXACTAMENTE igual** antes y después del MVP-0
- [ ] `pnpm build` pasa sin errores
- [ ] `pnpm typecheck` pasa sin errores
- [ ] Puedo crear un envío de cada uno de los 4 servicios y la UI solo muestra transiciones de estado válidas para ese servicio
- [ ] El form de "Transporte terrestre" pide `vehicle_category` obligatorio; los otros 3 servicios lo permiten en blanco
- [ ] Soft delete: borro un envío y desaparece de las queries pero queda en la DB con `deleted_at` set
- [ ] El dashboard muestra los 4 KPIs (en tránsito, en aduana, entregados, alerta) y los conteos coinciden con los datos en la DB
- [ ] El trigger `set_arrived_destination_at` se dispara al pasar status a `arrived_destination` por primera vez
- [ ] Otro usuario sintético en un segundo tenant ve solo los envíos de su tenant (test RLS en `__tests__/rls.test.ts`)

---

## 13. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Cambio accidental al sitio público | Alto — bug en producción visible al cliente | Lista de zonas prohibidas (sec. 6) + `pnpm build` + verificación visual antes de commit |
| RLS mal configurada → leak de datos cross-tenant | Crítico para HailuWay futuro | Test específico con 2 tenants sintéticos en `__tests__/rls.test.ts` |
| Operador hace transición de estado inválida según servicio | Medio — confunde al cliente | State machine en `lib/studio/shipment-state-machine.ts` valida server-side + UI esconde opciones inválidas |
| Supabase free tier limits | Bajo en MVP-0 | DTD genera baja escritura; monitorear desde dashboard Supabase |
| Conflicto con Payload viejo en deps | Medio — Vercel build podría fallar | Mantener Payload deps pero NO importar. Si rompe, eliminar deps Payload en SDD aparte |
| Sesión Supabase en SSR Next.js 16 + App Router | Medio — APIs cambiaron en versiones recientes | Seguir docs oficiales `@supabase/ssr` para Next.js 15+; pinear versión |
| Mensajes customer-facing en `lib/studio/shipment-messages.ts` quedan stale vs realidad operativa | Bajo en MVP-0 (cliente no los ve aún) | El Studio muestra preview "esto verá el cliente" en cada cambio de estado, así el operador revisa antes de que el portal exista |

---

## 14. Preguntas abiertas (resolver durante Fase 1-2)

1. **Soft delete cascade:** cuando se soft-delete un `shipment`, los `shipment_events` asociados ¿también se soft-deletean? Recomendación: sí, mismo `deleted_at`.
2. **Storage de archivos** (POD, fotos del paquete) — diferido, Supabase Storage cuando toque (estructura `{tenant_id}/{shipment_id}/{type}/{filename}`, signed URLs).
3. **Realtime** (Supabase Realtime) para que el dashboard se actualice solo — diferido a Fase 3+. MVP-0 usa polling 30s o `router.refresh()` post-mutación.
4. **Días gratis antes de `delayed_warehouse`** — ¿siempre 15 días o configurable por tenant en `tenants.config`? Recomendación: 15 días hardcodeados en MVP-0, configurable cuando hace falta.
5. **Cobro de bodegaje** (la tarifa $X/día) — no se modela en MVP-0. Cuando llegue billing (SDD futuro): tabla `tenant_settings` con `storage_fee_per_day_usd`.

---

## 15. Dependencias

- Cuenta Supabase + proyecto creado (manual, founder)
- `pnpm add @supabase/supabase-js @supabase/ssr` (al iniciar Fase 1)
- Confirmar que las vars Payload viejas (`DATABASE_URL`, `PAYLOAD_SECRET`, `S3_*`) pueden quedarse vacías sin romper el build del sitio público

---

## 16. La asignación (el primer paso real)

Antes de empezar Fase 1, hacer 2 cosas en el mundo real:

1. **Crear el proyecto Supabase** (en `supabase.com`, free tier). Anotar URL, anon key, service role key. Pegarlas en `.env.local` localmente (no commit).
2. **Aprobar este SDD** cambiando el frontmatter `status: draft` → `status: approved`. Eso es el go-ahead para escribir el primer SDD-0004 (shell + auth).

Cuando esos dos pasos estén listos, decímelo y arrancamos con el SDD-0004 (que es el spec implementable de la Fase 1).

---

## 17. Lo que observé sobre cómo pensás esto

- **Sos defensivo del frontend con razón.** Cuando dijiste *"hay cosas que ya no son iguales, como lo del contenedor del frontend, que cambió de tamaño"*, mostraste que **la web es la fuente de verdad por encima del brandbook**. Por eso esta arquitectura no asume nada visual del brandbook v2.3 para el sitio público — solo lo usa como referencia para el Studio.
- **Pensás en el futuro sin sobre-ingeniería.** Elegiste *"multi-tenant ready desde día 1"* pero con DTD como único tenant ahora. Eso es la jugada correcta: schema bien diseñado de entrada, complejidad de UI multi-tenant cuando exista demanda real (HailuWay).
- **Priorizás dolor operativo real.** Elegiste Tracking sobre los otros 8 módulos porque sabés que es donde se quema el día a día. Eso es taste de operador, no de diseñador de software.
- **Conocés tu negocio mejor que los manuales.** Cuando me corregiste con *"el LCL es 95% de DTD, no FCL"*, evitamos diseñar el sistema sobre un flujo equivocado. Y cuando insertaste `delayed_warehouse` con su lógica de 15 días, mostraste que conocés el dolor real del cobro de bodegaje. Eso es el tipo de detalle que solo sale de la operación, no del PowerPoint.
- **Distinguís dimensiones reales vs jerga universitaria.** Cuando me preguntaste sobre LCL vs DDP y aclaramos que vos vendés 4 productos cerrados (no combinaciones libres de Incoterms × modos), reordenamos el modelo de datos para que refleje el negocio, no la teoría. Eso evita que la UI se vuelva un menú combinatorio que confunde al operador.
- **Acumulás antes de gastar.** Pediste el plan completo antes de tocar una línea de código. Eso significa que sabés que cada commit cuesta — no en plata, en superficie de bug. Esta es la mentalidad que evita el refactor del Payload otra vez.
