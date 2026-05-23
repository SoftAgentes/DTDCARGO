---
sdd: "0005"
title: "DoorTuDoor — Fase 2: Módulo Tracking (envíos + estados + dashboard real)"
status: done
author: "founder"
created: 2026-05-23
updated: 2026-05-23
supersedes: null
superseded_by: null
related: ["0003", "0004"]
---

# DTD-0005 — Fase 2: Módulo Tracking

> **Depende de SDD-0004** (Studio shell + Auth). Este SDD agrega los envíos reales.

---

## 1. Resumen en una línea

Schema completo de envíos (4 servicios comerciales + 13 estados + soft delete + grants), CRUD de envíos en `/studio/tracking`, dashboard con KPIs reales agrupados por servicio, máquina de estados que enforce transiciones válidas por servicio, archivo de mensajes customer-facing 2-niveles, y seed con envíos sintéticos.

---

## 2. Scope

### Incluye
- Migración `0002_shipments.sql` con:
  - Enum `shipment_service` (4 productos: consolidacion, puerta_a_puerta_DDP, reserva_FCL, transporte_terrestre)
  - Enum `shipment_status` (13 estados)
  - Tabla `shipments` con todas las columnas del SDD-0003 sec. 7
  - Tabla `shipment_events` para timeline
  - Triggers `updated_at` y `set_arrived_destination_at`
  - RLS por tenant
  - **Grants explícitos a `authenticated`** (lección aprendida del SDD-0004)
- `lib/studio/shipment-types.ts` — tipos TypeScript matching los enums
- `lib/studio/shipment-state-machine.ts` — transiciones válidas por servicio (matriz sec. 7.3 del SDD-0003)
- `lib/studio/shipment-messages.ts` — mapeo 2-niveles (servicio × status → mensaje customer-facing)
- `app/api/studio/shipments/route.ts` — GET list, POST create
- `app/api/studio/kpis/route.ts` — GET dashboard counts
- `app/studio/(app)/tracking/page.tsx` — lista de envíos (reemplaza placeholder)
- `app/studio/(app)/tracking/nuevo/page.tsx` — form crear envío + server action
- `app/studio/(app)/resumen/page.tsx` — dashboard con KPIs reales (reemplaza placeholders en 0)
- `supabase/seed.ts` — script de seed con 5-10 envíos sintéticos cubriendo los 4 servicios

### NO incluye (SDDs futuros)
- Editar envío existente → SDD-0006
- Detalle + timeline expandido por envío → SDD-0006
- Cambio de estado vía UI (botones "Marcar embarcado", etc.) → SDD-0006
- Filtros avanzados (por servicio, estado, fecha, cliente) → SDD-0006
- Búsqueda full-text → SDD-0006
- Eliminar envío (soft delete) — el schema lo soporta, la UI vendrá en SDD-0006
- Mapa global de tracking visual → SDD-0007 o más tarde
- Conexión sitio público `/track/[code]` → SDD-0008 (requiere autorización aparte)
- Realtime updates → diferido
- Storage de POD/fotos → SDD futuro

---

## 3. Schema — `supabase/migrations/0002_shipments.sql`

```sql
-- ─────────────────────────────────────────────────────────────
-- SDD-0005 Fase 2: schema completo de envíos + eventos
-- ─────────────────────────────────────────────────────────────

-- Productos comerciales que DTD vende (NO combinaciones Incoterm × modo)
create type shipment_service as enum (
  'consolidacion',          -- LCL tradicional: cliente paga aduana
  'puerta_a_puerta_DDP',    -- DDP prepago: DTD asume todo, cliente paga adelantado
  'reserva_FCL',            -- Container completo
  'transporte_terrestre'    -- Ground VE interno
);

-- Estados (13 totales, aplicabilidad por servicio en lib/studio/shipment-state-machine.ts)
create type shipment_status as enum (
  'draft',
  'in_warehouse',
  'consolidating',
  'shipped',
  'in_transit',
  'in_customs',
  'arrived_destination',
  'delayed_warehouse',
  'out_for_delivery',
  'last_mile',
  'delivered',
  'exception',
  'cancelled'
);

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  client_name text,
  client_markbox text,                          -- DTD-XXXX (futuro link a clients)
  origin text,
  destination text,
  shipment_service shipment_service not null,
  status shipment_status not null default 'draft',
  weight_kg numeric(10,2),
  volume_m3 numeric(10,3),
  vehicle_category text,                        -- 'contenedor_maritimo' | 'camion_chico' | 'camion_pesado' | 'gandola' | 'aereo'
  vehicle_model text,                           -- 'Ford 350', 'Gandola 40 ton', '40HC Reefer'
  arrived_destination_at timestamptz,           -- para calcular bodegaje
  cancellation_reason text,
  notes text,
  deleted_at timestamptz,                       -- soft delete
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

comment on table public.shipments is 'Envios del tenant. Soft delete via deleted_at. RLS por tenant_id.';

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

comment on table public.shipment_events is 'Timeline de eventos por envio. Cada cambio de status genera una fila.';

create index shipment_events_shipment_idx
  on public.shipment_events (shipment_id, occurred_at desc)
  where deleted_at is null;

-- GRANTS EXPLICITOS (lección aprendida del SDD-0004 fix de 42501)
grant select, insert, update, delete on public.shipments to authenticated;
grant select, insert, update, delete on public.shipment_events to authenticated;

-- RLS por tenant
alter table public.shipments enable row level security;
alter table public.shipment_events enable row level security;

create policy "shipments by tenant"
  on public.shipments for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

create policy "shipment_events by tenant"
  on public.shipment_events for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

-- Trigger updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger shipments_touch
  before update on public.shipments
  for each row execute function public.touch_updated_at();

-- Trigger arrived_destination_at: dispara el reloj del bodegaje cuando el envio
-- entra al estado arrived_destination por primera vez
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

---

## 4. Archivos a crear (11 nuevos + 2 editados)

```
supabase/
├── migrations/
│   └── 0002_shipments.sql                     [nuevo] schema completo
└── seed.ts                                    [nuevo] seed con envíos sinteticos

lib/
└── studio/
    ├── shipment-types.ts                      [nuevo] tipos TS
    ├── shipment-state-machine.ts              [nuevo] transiciones validas por servicio
    └── shipment-messages.ts                   [nuevo] customer-facing copy

app/
├── api/
│   └── studio/
│       ├── shipments/
│       │   └── route.ts                       [nuevo] GET list, POST create
│       └── kpis/
│           └── route.ts                       [nuevo] GET dashboard counts
└── studio/
    └── (app)/
        ├── tracking/
        │   ├── page.tsx                       [REEMPLAZA placeholder] lista de envios
        │   ├── nuevo/
        │   │   ├── page.tsx                   [nuevo] form crear envio
        │   │   └── actions.ts                 [nuevo] server action crear
        │   └── _components/
        │       ├── ShipmentRow.tsx            [nuevo] fila de la tabla
        │       ├── ServiceBadge.tsx           [nuevo] badge del producto comercial
        │       └── StatusBadge.tsx            [nuevo] badge del estado
        └── resumen/
            └── page.tsx                       [REEMPLAZA] KPIs reales en vez de placeholders
```

**Total: 11 archivos nuevos + 2 editados.** Cero archivos del sitio público tocados.

---

## 5. Lib core — state machine y messages

### 5.1 `lib/studio/shipment-state-machine.ts`

```typescript
import type { ShipmentService, ShipmentStatus } from "./shipment-types";

/**
 * Para cada servicio, lista de estados aplicables y transiciones permitidas.
 * El form de edicion solo muestra los estados validos como proximas opciones.
 */
export const STATE_MACHINE: Record<
  ShipmentService,
  { applicableStatuses: ShipmentStatus[]; defaultInitial: ShipmentStatus }
> = {
  consolidacion: {
    applicableStatuses: [
      "draft", "in_warehouse", "consolidating", "shipped", "in_transit",
      "in_customs", "arrived_destination", "delayed_warehouse",
      "out_for_delivery", "delivered", "exception", "cancelled",
    ],
    defaultInitial: "draft",
  },
  puerta_a_puerta_DDP: {
    applicableStatuses: [
      "draft", "in_warehouse", "consolidating", "shipped", "in_transit",
      "in_customs", "arrived_destination", "delayed_warehouse",
      "out_for_delivery", "delivered", "exception", "cancelled",
    ],
    defaultInitial: "draft",
  },
  reserva_FCL: {
    applicableStatuses: [
      "draft", "in_warehouse", "shipped", "in_transit", "in_customs",
      "last_mile", "delivered", "exception", "cancelled",
    ],
    defaultInitial: "draft",
  },
  transporte_terrestre: {
    applicableStatuses: [
      "draft", "in_warehouse", "in_transit", "out_for_delivery",
      "delivered", "exception", "cancelled",
    ],
    defaultInitial: "draft",
  },
};

export function isValidStatusForService(
  service: ShipmentService,
  status: ShipmentStatus,
): boolean {
  return STATE_MACHINE[service].applicableStatuses.includes(status);
}
```

### 5.2 `lib/studio/shipment-messages.ts`

```typescript
import type { ShipmentService, ShipmentStatus } from "./shipment-types";

/** Mensaje que el cliente final ve cuando el envio entra en cada estado. */
export const CUSTOMER_MESSAGES: Record<
  ShipmentService,
  Partial<Record<ShipmentStatus, string>>
> = {
  consolidacion: {
    in_warehouse: "Tu carga llegó a nuestra bodega en China.",
    consolidating: "Preparando tu carga para embarque.",
    shipped: "Tu carga zarpó. En ruta a Venezuela.",
    in_transit: "En tránsito marítimo. Prepare su pago de aduana.",
    in_customs: "En aduana. Pagá impuestos para liberar tu carga.",
    arrived_destination: "Llegó a nuestra bodega. Coordiná retiro o entrega.",
    delayed_warehouse: "Tu carga lleva más de 15 días en bodega — bodegaje en curso.",
    out_for_delivery: "En reparto hacia tu dirección.",
    delivered: "Entregado ✓",
    exception: "Pausa temporal — te contactamos pronto.",
    cancelled: "Operación cerrada.",
  },
  puerta_a_puerta_DDP: {
    in_warehouse: "Tu carga llegó a nuestra bodega en China.",
    consolidating: "Preparando tu carga para embarque.",
    shipped: "Tu carga zarpó. Tu anticipo está vigente.",
    in_transit: "En tránsito marítimo. Faltan pocos días para el anticipo.",
    in_customs: "En aduana. Tu pago debió completarse.",
    arrived_destination: "Llegó a nuestra bodega. Coordinamos entrega.",
    delayed_warehouse: "Bodegaje activo — pago pendiente.",
    out_for_delivery: "En reparto hacia tu dirección.",
    delivered: "Entregado ✓",
    exception: "Pausa temporal — te contactamos pronto.",
    cancelled: "Operación cerrada.",
  },
  reserva_FCL: {
    in_warehouse: "Tu contenedor en bodega.",
    shipped: "Tu contenedor zarpó.",
    in_transit: "En tránsito marítimo.",
    in_customs: "En aduana Venezuela.",
    last_mile: "Tu contenedor sale del puerto hacia tu galpón.",
    delivered: "Entregado ✓",
    exception: "Pausa temporal — te contactamos pronto.",
    cancelled: "Operación cerrada.",
  },
  transporte_terrestre: {
    in_warehouse: "Recibido en nuestra bodega.",
    in_transit: "En ruta hacia tu dirección.",
    out_for_delivery: "En reparto.",
    delivered: "Entregado ✓",
    exception: "Pausa temporal — te contactamos pronto.",
    cancelled: "Operación cerrada.",
  },
};

export function getCustomerMessage(
  service: ShipmentService,
  status: ShipmentStatus,
): string {
  return CUSTOMER_MESSAGES[service]?.[status] ?? "Estado actualizado.";
}
```

---

## 6. API surface

| Método | Ruta | Acción |
|---|---|---|
| `GET` | `/api/studio/kpis` | Conteos para dashboard: en tránsito, en aduana, entregados, con alerta. Agrupado por `shipment_service`. |
| `GET` | `/api/studio/shipments` | Lista envíos del tenant (paginada, filtros `?status=&service=&q=`). Por ahora sin paginación, devuelve los 100 más recientes. |
| `POST` | `/api/studio/shipments` | Crea envío. Valida: si `service='transporte_terrestre'`, `vehicle_category` obligatorio. |

**Notas:**
- Todas las rutas requieren sesión Supabase válida.
- `tenant_id` se deriva del JWT, no es param.
- Edición de envío + delete + eventos vendrán en SDD-0006.

---

## 7. Pasos de implementación (Turnos)

| Turno | Acción | Output |
|---|---|---|
| F | Aplicar migración 0002 al cloud (vía MCP `apply_migration`) | Tablas creadas + grants OK |
| G | Crear `lib/studio/shipment-types.ts` + state-machine + messages | 3 archivos lib |
| H | Crear `app/api/studio/shipments/route.ts` + `kpis/route.ts` | 2 API routes |
| I | Crear `app/studio/(app)/tracking/page.tsx` (lista) + `_components/*` | Lista de envíos navegable |
| J | Crear `nuevo/page.tsx` + `nuevo/actions.ts` (form crear envío) | Botón "+ Envío" funcional |
| K | Reescribir `app/studio/(app)/resumen/page.tsx` con KPIs reales | Dashboard con conteos vivos |
| L | Crear + correr `supabase/seed.ts` (envíos sintéticos) | 5-10 envíos de demo en DB |
| M | Verificar manualmente + criterios done | Listo para commit |

---

## 8. Criterios done

- [ ] Migración 0002 aplicada en cloud. `select * from shipments` (con service_role) devuelve la tabla
- [ ] `pnpm typecheck` + `pnpm build` pasan
- [ ] Sitio público intacto
- [ ] `/studio/tracking` muestra **lista de envíos** (no el placeholder)
- [ ] `/studio/tracking/nuevo` muestra form con dropdown de los 4 servicios + campos básicos
- [ ] Form valida: si servicio = terrestre, `vehicle_category` obligatorio
- [ ] Crear envío exitoso → redirect a `/studio/tracking` + envío aparece en la lista
- [ ] `/studio/resumen` muestra **KPIs reales** (no zeros placeholder)
- [ ] Crear envío con status `in_transit` → KPI "En tránsito" sube a 1
- [ ] Seed corre y agrega ~10 envíos sintéticos cubriendo los 4 servicios y varios estados
- [ ] Otro tenant (sintético) NO ve los envíos de DTD (test RLS)

---

## 9. Riesgos

| Riesgo | Mitigación |
|---|---|
| Grants olvidados → 42501 permission denied | YA aplicada lección del SDD-0004: la migración 0002 incluye los grants explícitos arriba de RLS |
| State machine en JS vs DB → divergencia | State machine es solo UI hint. La DB acepta cualquier transición de status. Si llega a haber regla dura, agregar trigger SQL en SDD futuro |
| Seed pisa datos reales | El seed es idempotente: usa `on conflict do nothing` sobre `(tenant_id, code)`. Si ya existen DTDU-0001..0010, no toca nada |
| Form de creación complejo (muchos campos) | MVP: campos mínimos (code, client_name, service, status default draft). Resto opcional. Detalle expandido en SDD-0006 |

---

## 10. La asignación

Cuando este SDD esté `approved`:

1. Yo aplico la migración 0002 al cloud vía MCP (Turno F).
2. Yo creo los archivos lib (Turno G).
3. Yo creo las API routes (Turno H).
4. Yo creo la UI de tracking (Turnos I, J).
5. Yo actualizo el resumen con KPIs reales (Turno K).
6. Yo corro el seed (Turno L).
7. Vos validás los criterios done (Turno M) y commiteamos.

Output final: `/studio/tracking` con envíos reales navegables + dashboard con KPIs vivos. SDD-0006 viene después con edición + detalle + timeline.
