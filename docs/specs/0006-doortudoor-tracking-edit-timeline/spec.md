---
sdd: "0006"
title: "DoorTuDoor — Fase 3: Tracking edición + detalle + timeline + filtros"
status: approved
author: "founder"
created: 2026-05-23
updated: 2026-05-23
supersedes: null
superseded_by: null
related: ["0003", "0004", "0005"]
---

# DTD-0006 — Fase 3: Tracking edición, detalle, timeline, filtros

> **Depende de SDD-0005** (Tracking module — schema + CRUD básico). Este SDD cierra
> el módulo Tracking para que un operador pueda operar el día a día **sin Excel**.

---

## 1. Resumen en una línea

Vista detalle por envío con timeline cronológico, botones de cambio de estado contextuales
por servicio, edición in-place de campos, filtros por servicio/estado + búsqueda por código/cliente,
y soft delete vía UI. Después de esto, el módulo Tracking está **completo para operación diaria**.

---

## 2. Scope

### Incluye

#### Backend (API + acciones)
- `GET /api/studio/shipments/[id]` — detalle envío + lista de eventos
- `PATCH /api/studio/shipments/[id]` — edición de campos
- `DELETE /api/studio/shipments/[id]` — soft delete (set `deleted_at = now()`)
- `POST /api/studio/shipments/[id]/events` — agregar evento (cambio de estado)
- Server actions correspondientes (preferidas para forms del Studio)

#### UI
- `/studio/tracking/[id]` — vista detalle con:
  - Header: código + cliente + servicio + status badge grande
  - Sección **Datos** — campos editables in-place (origen, destino, peso, volumen, vehículo, notas, MARKBOX cliente)
  - Sección **Estado + acciones** — botones de transición contextuales (solo los estados válidos para el servicio actual, ordenados por flujo natural)
  - Sección **Timeline** — lista cronológica de `shipment_events` con autor, nota, hora
  - Sección **Customer preview** — qué verá el cliente con el estado actual (de `shipment-messages.ts`)
  - Footer: **Cancelar envío** (modal con razón obligatoria) + **Eliminar** (modal de confirmación, soft delete)
- `/studio/tracking` mejorado:
  - Filtros: dropdown servicio, dropdown estado, input búsqueda
  - URL state via `searchParams` (`?service=consolidacion&status=in_transit&q=DTDU-001`)
  - Filas clickeables → `/studio/tracking/[id]`
  - Hover highlight visual
  - Empty state cuando filtros no matchean

#### Lib
- `lib/studio/shipment-actions.ts` — helpers para transiciones rápidas (label del botón, próximo estado sugerido)
- `lib/studio/shipment-queries.ts` — query helpers reutilizables (filtros, búsqueda)

### NO incluye (SDDs futuros)

- Conexión `/track/[code]` del sitio público al backend → **SDD-0007** (requiere autorización explícita por tocar zona prohibida)
- Storage de archivos (POD, fotos del paquete) → SDD futuro con Supabase Storage
- Realtime updates (dashboard auto-refresh) → diferido
- Notificaciones automáticas (WhatsApp/email al cambiar estado) → SDD futuro
- Portal Cliente con MARKBOX login → SDD-0009
- Filtros avanzados (rango de fechas, peso, volumen) → si hace falta
- Bulk actions (cambiar estado a varios envíos a la vez) → si hace falta
- Export CSV / PDF de envíos → SDD futuro
- Auditoría con `created_by` user info en timeline → básico ahora, expandido después
- Editor del Module "Transporte Terrestre" con flota normalizada → SDD-0010+

---

## 3. Archivos a crear / editar

### Nuevos (10)

```
app/
├── api/
│   └── studio/
│       └── shipments/
│           └── [id]/
│               ├── route.ts                          [nuevo] GET/PATCH/DELETE
│               └── events/
│                   └── route.ts                      [nuevo] POST evento
└── studio/
    └── (app)/
        └── tracking/
            ├── [id]/
            │   ├── page.tsx                          [nuevo] vista detalle
            │   ├── actions.ts                        [nuevo] server actions (edit/delete/cancel/transition)
            │   └── _components/
            │       ├── ShipmentHeader.tsx            [nuevo] header del detalle
            │       ├── ShipmentDataPanel.tsx         [nuevo] form edicion in-place
            │       ├── StateActionsPanel.tsx         [nuevo] botones transicion
            │       ├── TimelinePanel.tsx             [nuevo] lista de eventos
            │       └── CustomerPreview.tsx           [nuevo] preview del mensaje al cliente

lib/
└── studio/
    ├── shipment-actions.ts                           [nuevo] helpers transicion (label, proximo)
    └── shipment-queries.ts                           [nuevo] query helpers filtros/search
```

### Editados (2)

```
app/studio/(app)/tracking/page.tsx                    [editar] agregar filtros + filas clickeables
app/studio/(app)/tracking/_components/ServiceBadge.tsx [editar] aceptar prop "size" para usar en detalle
```

**Total: 10 archivos nuevos + 2 editados.** Cero archivos del sitio público tocados.

---

## 4. Diseño UI — vista detalle `/studio/tracking/[id]`

Layout 2 columnas en desktop, stack en mobile.

```
┌─ Header (full width) ────────────────────────────────────────────────┐
│  ← Volver al listado                                                 │
│  DTDU-00042  •  Juan Pérez  •  [ServiceBadge grande]  [StatusBadge]  │
│  Yiwu → Caracas · creado 23 may · actualizado hace 2h                │
└──────────────────────────────────────────────────────────────────────┘

┌─ COLUMNA IZQUIERDA (datos) ──────┐  ┌─ COLUMNA DERECHA (operación) ──┐
│                                  │  │                                │
│  DATOS DEL ENVÍO                 │  │  ESTADO ACTUAL                 │
│  (campos editables in-place)     │  │  [Status badge grande]         │
│  - Cliente                       │  │                                │
│  - MARKBOX                       │  │  ACCIONES                      │
│  - Origen → Destino              │  │  [→ Marcar en bodega]          │
│  - Peso / Volumen                │  │  [→ Marcar embarcado]          │
│  - Vehículo (categoría + modelo) │  │  [⚠ Marcar excepción]          │
│  - Notas                         │  │                                │
│  [Guardar cambios]               │  │  CUSTOMER PREVIEW              │
│                                  │  │  "Tu carga zarpó. En ruta..."  │
│                                  │  │                                │
│                                  │  │  TIMELINE                      │
│                                  │  │  ● 23 may 14:00 · creado       │
│                                  │  │  ○ 23 may 16:30 · en bodega    │
│                                  │  │  ○ 24 may 09:15 · embarcado    │
│                                  │  │  [+ Agregar evento manual]     │
└──────────────────────────────────┘  └────────────────────────────────┘

┌─ Footer ─────────────────────────────────────────────────────────────┐
│  [Cancelar envío]              [Eliminar envío]                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.1 Botones de transición — lógica contextual

Para cada `(service, status)` actual, el panel de acciones muestra **solo las
transiciones sugeridas** según el flujo natural. La matriz vive en
`lib/studio/shipment-actions.ts`:

```typescript
// Ejemplo: consolidacion + status="in_warehouse"
nextActions("consolidacion", "in_warehouse") === [
  { status: "consolidating", label: "→ Marcar consolidando" },
  { status: "exception",     label: "⚠ Marcar excepción", variant: "warning" },
];

// Ejemplo: consolidacion + status="in_transit"
nextActions("consolidacion", "in_transit") === [
  { status: "in_customs",       label: "→ Llegó a aduana" },
  { status: "arrived_destination", label: "→ Llegó a bodega VE" }, // si saltó aduana
  { status: "exception",        label: "⚠ Marcar excepción", variant: "warning" },
];
```

**Reglas:**
- No mostrar el estado actual como acción (no transition-to-self)
- No mostrar `draft` como destino (solo es estado inicial)
- No mostrar `cancelled` como botón directo (vive en el modal "Cancelar envío" con razón obligatoria)
- Siempre mostrar `exception` como opción de warning (cualquier momento puede fallar)
- Para estados terminales (`delivered`, `cancelled`): solo se muestra "→ Reabrir" si hace falta? **No por ahora** — terminal es terminal en MVP-0
- Cuando se cambia el estado, **se registra automáticamente un `shipment_event`** con `status` nuevo + `note` opcional + `created_by` del user actual

### 4.2 Edición in-place de campos

- Cada campo es un input/textarea normal
- Botón "Guardar cambios" abajo del formulario activa cuando hay cambios pendientes (estado `dirty`)
- Si servicio = `transporte_terrestre`, `vehicle_category` sigue siendo obligatorio
- Cambiar `shipment_service` **NO está permitido** después de crear (cambia la matriz de estados aplicables, sería caos)
- Cambiar `code` **NO está permitido** después de crear (puede romper trazabilidad con códigos pegados externamente — BL, AWB)
- Si el campo cambia, se actualiza vía server action → revalida la página

### 4.3 Cancelar envío (modal)

- Botón rojo en footer
- Modal pide **razón obligatoria** (textarea, mínimo 10 chars)
- Al confirmar: status → `cancelled`, `cancellation_reason` = razón, se crea `shipment_event` con `status='cancelled'` y `note=razón`
- Razón se ve después en el timeline y en el panel de cancelación
- **Es reversible** (otro PATCH puede reabrir) — pero no se ofrece desde UI en MVP, solo via SQL si hace falta

### 4.4 Eliminar envío (modal)

- Botón gris en footer (no rojo — soft delete)
- Modal de confirmación simple: "Esto oculta el envío de la lista. Podés recuperarlo desde Supabase si hace falta."
- Al confirmar: `deleted_at = now()` → RLS lo filtra automáticamente → redirect a `/studio/tracking`
- **Cascade:** los `shipment_events` también se soft-deletean (mismo `deleted_at`)

### 4.5 Timeline

- Lista vertical, más reciente arriba (orden `occurred_at desc`)
- Cada item: dot de color del status + label estado + hora relativa ("hace 2h" / "ayer 14:30" / "23 may 09:15") + nota si existe + autor (email del user que registró)
- El primer evento (creación) se genera automáticamente al insertar el envío — un trigger lo hace (ver sec. 5)
- "Agregar evento manual" → modal: dropdown estado (solo válidos para el servicio) + textarea nota + botón guardar

### 4.6 Customer preview

- Card pequeña, leve background `--color-paper-2`
- Texto: el output de `getCustomerMessage(service, status)`
- Header chico: "ESTO VERÁ EL CLIENTE"
- Útil para que el operador revise el mensaje antes de cambiar el estado

---

## 5. Schema changes — ¿hace falta migración?

**Casi nada.** El schema del SDD-0005 (`0002_shipments.sql`) ya soporta todo. Lo único:

### 5.1 Trigger nuevo: evento automático al crear envío

Migración pequeña: `0003_shipment_events_on_insert.sql`

```sql
-- Cada vez que se crea un shipment, se inserta un evento inicial automatico
create or replace function public.create_initial_shipment_event()
returns trigger language plpgsql security definer as $$
begin
  insert into public.shipment_events (tenant_id, shipment_id, status, note, occurred_at)
  values (new.tenant_id, new.id, new.status, 'Envío creado', new.created_at);
  return new;
end; $$;

create trigger shipments_initial_event
  after insert on public.shipments
  for each row execute function public.create_initial_shipment_event();
```

**Por qué:** así el timeline nunca está vacío. El primer evento siempre es la creación.

### 5.2 Soft delete cascade en events

También en la misma migración:

```sql
-- Cuando se soft-deletea un shipment, sus events también
create or replace function public.cascade_soft_delete_events()
returns trigger language plpgsql security definer as $$
begin
  if new.deleted_at is not null and (old.deleted_at is null) then
    update public.shipment_events
    set deleted_at = new.deleted_at
    where shipment_id = new.id and deleted_at is null;
  end if;
  return new;
end; $$;

create trigger shipments_cascade_soft_delete
  after update of deleted_at on public.shipments
  for each row execute function public.cascade_soft_delete_events();
```

**Por qué:** la consulta del timeline filtra `deleted_at is null` → si el shipment se borra, los events también deben desaparecer del listado.

### 5.3 Index para búsqueda por código/cliente

```sql
-- Indices para el listado filtrado/buscado
create index shipments_tenant_code_idx
  on public.shipments using btree (tenant_id, code)
  where deleted_at is null;

create index shipments_tenant_client_idx
  on public.shipments using btree (tenant_id, client_name)
  where deleted_at is null;
```

Para tablas chicas (cientos de envíos por mes) no es crítico, pero baratísimo de agregar y previene un problema de scaling temprano.

**Total: 1 migración nueva** (`0003_shipment_events_on_insert.sql`), retro-compatible con el seed existente.

---

## 6. API surface — completa después de este SDD

| Método | Ruta | Acción | Estado |
|---|---|---|---|
| `GET` | `/api/studio/kpis` | Conteos dashboard | ✅ ya existe |
| `GET` | `/api/studio/shipments` | Lista envíos del tenant | ✅ ya existe |
| `POST` | `/api/studio/shipments` | Crea envío | ✅ ya existe |
| `GET` | `/api/studio/shipments/[id]` | Detalle envío + events | 🆕 SDD-0006 |
| `PATCH` | `/api/studio/shipments/[id]` | Edita campos | 🆕 SDD-0006 |
| `DELETE` | `/api/studio/shipments/[id]` | Soft delete | 🆕 SDD-0006 |
| `POST` | `/api/studio/shipments/[id]/events` | Agrega evento (cambio de estado) | 🆕 SDD-0006 |

### 6.1 Server actions paralelas

Para los forms del Studio preferimos **server actions** (Next.js 15+ idioma natural). Las API routes quedan disponibles para uso programático futuro (importar envíos, integración con WhatsApp webhook, etc.). Lo que conviva:

```typescript
// app/studio/(app)/tracking/[id]/actions.ts
"use server";

export async function updateShipment(id: string, formData: FormData) { ... }
export async function deleteShipment(id: string) { ... }
export async function cancelShipment(id: string, reason: string) { ... }
export async function transitionShipment(id: string, newStatus: ShipmentStatus, note?: string) { ... }
export async function addShipmentEvent(id: string, status: ShipmentStatus, note: string) { ... }
```

Las server actions llaman a Supabase directo (con `createClient()` server) + `revalidatePath("/studio/tracking")` para refrescar el listado.

---

## 7. Pasos de implementación (turnos)

| Turno | Acción | Output |
|---|---|---|
| A | Aplicar migración `0003_shipment_events_on_insert.sql` al cloud | Triggers + indices listos |
| B | Crear `lib/studio/shipment-actions.ts` + `shipment-queries.ts` | Helpers reutilizables |
| C | Crear API routes `[id]/route.ts` (GET/PATCH/DELETE) + `[id]/events/route.ts` (POST) | API completa |
| D | Crear vista detalle: `[id]/page.tsx` + `actions.ts` + 5 sub-componentes | URL `/studio/tracking/[id]` navegable |
| E | Editar lista `/studio/tracking/page.tsx` para agregar filtros + filas clickeables | Lista filtrable y navegable |
| F | UI/UX review con agente `ui-ux-designer` antes del commit | Aprobación visual |
| G | Verificación manual + criterios done sec. 8 | Listo para commit |

---

## 8. Criterios done

- [ ] Migración 0003 aplicada en cloud. `select * from pg_trigger where tgname like 'shipments_%'` muestra 4 triggers.
- [ ] `pnpm typecheck` + `pnpm build` pasan.
- [ ] Sitio público intacto (`/`, `/calculadora`, `/cotizar`, `/servicios`, `/contacto`, `/track/[code]`).
- [ ] Lista `/studio/tracking` muestra filtros funcionales (servicio + estado + búsqueda).
- [ ] Click en una fila lleva a `/studio/tracking/[id]`.
- [ ] Vista detalle muestra: header, datos editables, panel de acciones contextuales, timeline, customer preview, footer con cancelar/eliminar.
- [ ] Cambiar el estado vía botón crea un `shipment_event` automáticamente y refresca la UI.
- [ ] Editar un campo + guardar persiste y muestra el cambio.
- [ ] Cancelar envío con razón → status `cancelled`, razón visible en timeline, no se puede des-cancelar desde UI.
- [ ] Eliminar envío → `deleted_at` set, redirect a `/studio/tracking`, ya no aparece en la lista.
- [ ] Soft delete cascade: los events del envío borrado tampoco aparecen.
- [ ] Trigger de evento inicial: crear un envío nuevo → timeline tiene 1 evento (creación).
- [ ] Customer preview muestra el mensaje correcto según `(service, status)` actual.
- [ ] Botones de transición solo muestran estados aplicables al servicio (LCL no muestra `last_mile`, FCL no muestra `consolidating`, etc.).
- [ ] RLS sigue funcionando: otro tenant sintético NO ve los envíos de DTD.

---

## 9. Riesgos

| Riesgo | Mitigación |
|---|---|
| Server action y API route quedan desincronizadas | Server actions llaman a las mismas validaciones que las API routes (delegadas a `lib/studio/shipment-actions.ts`). DRY. |
| Trigger inicial dispara dos eventos si seed corre 2 veces | El seed usa `on conflict do nothing` sobre `(tenant_id, code)` → no re-inserta → no re-dispara |
| Soft delete cascade pierde info de "cuándo se borró el event original" | Si event ya tenía `deleted_at` (caso raro), el trigger NO lo pisa (filtra `where deleted_at is null`) |
| Edición concurrente: 2 operadores editan el mismo envío | MVP: last-write-wins. Si pasa a ser problema → agregar `version` column + optimistic lock en SDD futuro |
| Botones de transición confunden al operador (muchas opciones) | Máximo 3-4 botones por estado. Reglas claras en `shipment-actions.ts`. Si quedan muchos: dropdown "Otras transiciones" |
| El cliente de Supabase server no encuentra cookies en `[id]` dinámico | Patrón ya validado en SDD-0005 — usar `await createClient()` igual que en `tracking/page.tsx` |
| Customer preview queda stale vs realidad operativa | Es solo UI hint para el operador. La fuente de verdad sigue siendo `shipment-messages.ts`. Cuando hagamos Portal Cliente (SDD-0009) se versionará si hace falta |

---

## 10. Preguntas abiertas (cerrar antes de implementar)

1. **¿Estados terminales son reabrirables desde UI?**
   - Recomendación: **NO en MVP**. `delivered`, `cancelled` son terminales. Si hace falta corregir, vía SQL directo.
2. **¿"Agregar evento manual" puede tener un status anterior al actual?**
   - Recomendación: **SÍ**. El evento es histórico, puede ser retroactivo. La UI permite cualquier `occurred_at` editable, default `now()`.
3. **¿El timeline muestra eventos eliminados (soft-deleted)?**
   - Recomendación: **NO en MVP**. Filtra `deleted_at is null`. Si hace falta auditoría, vía SQL.
4. **¿Filtros por rango de fechas en el listado?**
   - Recomendación: **diferido**. MVP solo servicio + estado + búsqueda de texto. Fecha si la necesidad aparece.
5. **¿Paginación del listado?**
   - Recomendación: **diferido**. Hoy mostramos 100 más recientes. Cuando DTD tenga >500 envíos activos: agregar `?page=2` + count total.

---

## 11. Lo que viene después (preview)

- **SDD-0007 — Conexión sitio público `/track/[code]`** — reemplaza el mock del sitio con fetch al backend. **Requiere autorización explícita** porque toca `app/track/**` (zona prohibida hoy).
- **SDD-0008 — Calculadora editor** — admin puede ajustar factores volumétricos, precios CBM, parámetros DDP desde el Studio.
- **SDD-0009 — Portal Cliente con MARKBOX login** — clientes entran con su código DTD-XXXX a ver sus envíos.
- **SDD-0010 — Módulo Transporte Terrestre con flota** — tabla `vehicle_types` normalizada, gestión de camiones reales, FK desde `shipments`.
- **SDD-0011+ — Notificaciones WhatsApp/email** automáticas al cambiar estado.

---

## 12. La asignación

Cuando este SDD esté `approved` (vos cambiás `status: draft` → `status: approved` en el frontmatter):

1. **Turno A** — Yo aplico la migración 0003 al cloud vía MCP.
2. **Turno B** — Yo creo los helpers en `lib/studio/`.
3. **Turno C** — Yo creo las 4 API routes.
4. **Turno D** — Yo creo la vista detalle completa (página + 5 componentes + actions).
5. **Turno E** — Yo edito la lista para agregar filtros + filas clickeables.
6. **Turno F** — Llamo al agente `ui-ux-designer` para review visual (proceso obligatorio de memoria persistente).
7. **Turno G** — Vos validás los criterios done de sec. 8. Si OK → commit `feat(studio): SDD-0006 — Tracking edicion + timeline + filtros (Fase 3 DoorTuDoor)`.

Output final: módulo Tracking **completo para operación diaria**. El operador puede crear, ver, editar, transicionar, cancelar y eliminar envíos desde `/studio/tracking`, con timeline y preview del mensaje al cliente.

---

## 13. Convenciones que sigue (recordatorio)

- **español-VE** exclusivo. Sin i18n.
- **"Puerta a Puerta DDP"** siempre con **"prepago"** en chico (memoria persistente, ya implementado en `SERVICE_LABELS`).
- **Soft delete obligatorio** en `shipments` y `shipment_events`. Hard delete prohibido.
- **Zonas prohibidas del sitio público** (SDD-0003 sec. 6.1) — no se toca nada de `app/`, `components/`, `lib/design-tokens.ts`, etc. Solo se editan los 2 archivos listados en sec. 3.
- **Process UI/UX review** antes del commit (Turno F).
- **`tenant_id` siempre del JWT**, nunca del payload del cliente.
- **State machine es UI hint**, no enforcement DB. Si se necesita hard enforcement, trigger SQL en SDD futuro.
