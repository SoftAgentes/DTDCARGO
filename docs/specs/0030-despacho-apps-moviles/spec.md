---
sdd: "0030"
title: "Despacho · Apps móviles bodeguero VE + camionero VE (PWAs)"
status: approved
author: "founder"
created: 2026-05-25
updated: 2026-05-25
supersedes: null
superseded_by: null
related: ["0020", "0022", "0023", "0029"]
---

# DTD-0030 — Despacho · Apps móviles bodeguero VE + camionero VE

> **Fase 2 del bundle Claude Design v1.6.** Cierra el pipeline 3-actor de
> SDD-0029 sumando las dos PWAs móviles: bodeguero arma camiones desde la
> cola de ODs → camionero entrega con POD foto+firma. El admin web del
> Studio (Fase 1) ya está; lo que faltaba era el lado mobile.

---

## 1. Resumen en una línea

`/m/ve/login` valida PIN del operario VE → según `role` lo manda a
`/m/ve/bodeguero` (cola de cargas + carga fraccionada P1/P2 + cierre
`status='lista'`) o a `/m/ve/camionero` (ruta del día + POD con foto y
firma canvas + cierre `status='entregada'`). Reusa enteramente la
infraestructura PWA de `/m/cn/*` (PIN + cookie HTTP-only + service_role
para mutaciones).

---

## 2. Scope

### Incluye

#### Schema (migración 0025)

- Extender CHECK constraint `operario_pins.role` agregando valores
  `'bodeguero'` y `'camionero'`. Wang Hua (`role='operario'`) sin cambios.
- Nueva constraint: `bodeguero|camionero requires region='ve'`.
  Refuerza la invariante (los CN ya tenían su propia constraint que
  requiere `warehouse_id` para `region='cn'`).
- Update RPC `verify_operario_pin` para devolver también `region`
  (necesario para que el server action de login sepa a qué app redirigir).
- 4 RPCs nuevas (pattern de `create_receipt_as_operario` · security
  definer · service_role only):
  - `bodeguero_advance_od(p_operario_id, p_od_id, p_status)` —
    transición `creada → cargando → lista`.
  - `bodeguero_split_p2(p_operario_id, p_od_id, p_package_id,
    p_boxes_shipped, p_split_reason, p_split_reason_text)` —
    fracciona un paquete y genera OD nueva P2 con `parent_od_id`.
  - `camionero_advance_od(p_operario_id, p_od_id, p_status, p_progress,
    p_current_city)` — transición `lista → en_ruta → entregada`.
  - `camionero_pod(p_operario_id, p_od_id, p_photo_path, p_signature_path,
    p_received_by, p_received_doc, p_notes)` — crea fila `dispatch_pods`
    asociada a la OD (no necesariamente cambia el status; eso lo hace
    advance_od en la última entrega).
- Tabla nueva **`dispatch_pods`** (proofs of delivery):
  - `id uuid pk`, `tenant_id`, `od_id` FK
  - `photo_path text` (path en bucket `receipt-photos` con prefijo `pod/`)
  - `signature_path text` (path en bucket con prefijo `firma/`)
  - `received_by text`, `received_doc text` (cédula opcional)
  - `notes text`
  - `created_by_operario_id` FK
  - `created_at`

#### Bucket Storage (reuso)

**Sin bucket nuevo.** Se reusa `receipt-photos` con prefijos:
- `pod/<tenant>/<od_id>/<timestamp>.jpg` — foto carga descargada
- `firma/<tenant>/<od_id>/<timestamp>.png` — canvas firma (PNG)
- `fachada/<tenant>/<client_markbox>/<timestamp>.jpg` — opcional (SDD futuro
  cuando portemos portal/registro · queda fuera de scope acá)

Policy: el operario authenticated (via cookie) puede `INSERT/SELECT` los
prefijos `pod/` y `firma/`. El admin del tenant lee todo.

#### Server-side (lib/auth + lib/studio)

- `lib/auth/operario-session.ts` actualizado:
  - `OperarioSession` agrega `region: OperarioRegion`
  - `signInWithPin` lee `region` del RPC y lo persiste en la cookie
    (en realidad sigue siendo solo `operario_id`; el `getCurrentOperario`
    re-fetcha y devuelve region en el shape)
- `lib/studio/operario-types.ts`:
  - `OperarioRole` agrega `"bodeguero" | "camionero"`
  - `OperarioSession.region` y `OperarioSession.role` ahora narrowable
- `lib/studio/dispatch-mobile-types.ts` (nuevo):
  - `BodegueroAdvanceInput`, `BodegueroSplitInput`, `CamioneroAdvanceInput`,
    `CamioneroPodInput` + validators
  - `MobileActionState` compartido
- `lib/studio/dispatch-mobile-queries.ts` (nuevo):
  - `listOdsForBodegueroHub(supabase, hub)` — OD `creada/cargando/lista`
    en hub donde el bodeguero opera
  - `listOdsForCamioneroDriver(supabase, driverId)` — OD `lista/en_ruta`
    asignadas al chofer
  - `listPackagesOfOd(supabase, odId)` — junction completo

#### Server actions

- `/m/ve/login/actions.ts` · `signInOperarioVeAction`:
  - misma lógica que `/m/cn/login` pero después del PIN valida que
    `session.region === 've'` (defensive · doble protección)
  - redirect según `session.role`:
    - `bodeguero` → `/m/ve/bodeguero`
    - `camionero` → `/m/ve/camionero`
    - `operario`/`supervisor` (legacy VE si existe) → `/m/ve/bodeguero`
      como default
- `/m/ve/bodeguero/actions.ts`:
  - `advanceOdAction` (creada → cargando · cargando → lista)
  - `splitPackageP2Action`
  - `signOutAction`
- `/m/ve/camionero/actions.ts`:
  - `advanceOdAction` (lista → en_ruta · en_ruta → entregada)
  - `podAction` (sube foto + firma + datos receiver)
  - `signOutAction`

#### UI

- `/m/ve/login/page.tsx` — login PIN reusa pattern `/m/cn/login`. Brand
  navy gradient · sentence case · PIN dots con shake · sin emojis.
- `/m/ve/bodeguero/page.tsx` (server):
  - Fetch ODs en estado `creada|cargando|lista` del hub del operario
  - Render `BodegueroClient` con cola
- `/m/ve/bodeguero/_components/BodegueroClient.tsx`:
  - Lista ODs activas con badge status
  - Click → vista detalle inline con packages + acciones
  - Modal "Carga fraccionada P1/P2" cuando boxes_shipped < boxes_total
  - Botón "Cerrar carga · lista para salir" → advance a `lista`
- `/m/ve/camionero/page.tsx` (server):
  - Fetch ODs `lista` asignadas al driver matcheando operario por nombre
    (no hay FK directo operario→driver; queda como deuda para SDD futuro)
  - Render `CamioneroClient` con ruta del día
- `/m/ve/camionero/_components/CamioneroClient.tsx`:
  - Header sticky + RouteBlock (info OD activa)
  - Lista paquetes/entregas pending vs done
  - Click "Llegué" → modal POD con foto + firma canvas + nombre receptor
  - Última POD → advance a `entregada`

#### Sidebar / Studio admin

NO se duplica. El admin sigue gestionando todos los operarios desde
`/studio/operarios` (existente, SDD-0028). Agregamos solo:
- Filtro por `region` en el listado (cn vs ve)
- Selector de `role` con los 4 valores (`operario`, `supervisor`,
  `bodeguero`, `camionero`) al crear/editar operario

### Fuera de scope

- Realtime cross-actor (Supabase Realtime subscription) → deferred a un
  patch chico cuando se valide el MVP. La Fase 2 funciona con
  `router.refresh()` después de cada server action (admin web hace lo
  mismo). El bodeguero ve la OD al refrescar manualmente o cargar la
  página · idem el camionero.
- Foto fachada del cliente al registrarse → SDD-0032
- AttachModal de docs (BL/Packing/Factura) → SDD-0034 wiring
- No-Olvidar de credenciales para camionero (alcabalas SENIAT) → SDD futuro
- Push notifications nativas → fuera de scope V1 (mock visible-only en
  el camionero si GPS off)
- GPS real (geolocation API) → V1 toggle estado interno; V2 wired al API

---

## 3. Decisiones de diseño

### D1 · El role decide la app, no la URL

El usuario operario tiene 1 PIN, 1 role. El server action de login
redirige a la app correcta basado en `session.role`. No hay role picker
visible (a diferencia del mockup del bundle que asumía 1 PIN = N roles).

Razón: 1 PIN = 1 persona = 1 role. Si Yusneidy también es camionera en
otro turno, le creás un PIN distinto. Mantiene el modelo de auth simple
y auditable (un PIN nunca pertenece a 2 personas o 2 roles).

### D2 · Sin enum nuevo, extendemos CHECK

El campo `operario_pins.role` es text con CHECK. Para mantener el
patrón ya en prod, extendemos el CHECK con `bodeguero` y `camionero` en
lugar de migrar a enum. Migration aditiva y no destructiva.

### D3 · Reuso del bucket receipt-photos

El bucket `receipt-photos` ya existe (SDD-0022) con policies sanas. En
lugar de crear `dispatch-photos` reusamos con prefijos:
`pod/` y `firma/`. Policy del bucket extendida para que operarios
`bodeguero|camionero` puedan escribir en esos prefijos.

### D4 · RPCs operario · pattern create_receipt_as_operario

Las 4 RPCs nuevas siguen el pattern del SDD-0027:
- `security definer` + `service_role` only
- Reciben `p_operario_id` (de la cookie) como auth
- Validan operario activo + tenant + region/role
- Devuelven el row mutado o lanzan exception con errcode P0xxx

El cliente nunca llama Supabase directo. Server actions wrappen con
service_role.

### D5 · POD es tabla nueva, no JSONB en dispatch_orders

Las pruebas de entrega merecen una tabla propia (auditoría, queries,
relacionados). Si en SDD futuro se agregan firmas multi-stop o fotos
adicionales, el modelo escala. Hoy: 1 fila por POD asociada a la OD.

### D6 · driver_id ↔ operario_id soft-link

En SDD-0029 ya hicimos que `dispatch_orders.driver_id` apunte a
`tms_drivers.id`. El camionero PWA es un `operario_pins` con
`role='camionero'`. **No hay FK directo entre ambos.**

Solución V1 (deuda chica): hacemos match por **nombre** (`display_name`
de operario_pins vs `name` de tms_drivers). Es suficiente para el piloto
donde hay 1-2 choferes por hub.

Solución V2 (SDD futuro): agregar `tms_drivers.operario_pin_id` FK
nullable. Si está set, esa fila operario es el "lado mobile" del driver.

---

## 4. Schema (migración 0025_operario_roles_extend.sql)

### Drops + recreates

```sql
-- Drop existing CHECK on role
alter table public.operario_pins drop constraint operario_pins_role_check;

-- Recreate with 4 valid values
alter table public.operario_pins
  add constraint operario_pins_role_check
  check (role in ('operario', 'supervisor', 'bodeguero', 'camionero'));

-- New constraint: bodeguero/camionero require region='ve'
alter table public.operario_pins
  add constraint operario_pins_ve_role_requires_ve_region
  check (
    region = 've'
    or role not in ('bodeguero', 'camionero')
  );
```

### Tabla dispatch_pods

```sql
create table public.dispatch_pods (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants(id) on delete cascade,
  od_id                    uuid not null references public.dispatch_orders(id) on delete cascade,
  package_id               uuid,                              -- nullable: pod por paquete específico (V2)
  photo_path               text,                              -- 'pod/<tenant>/<od>/<ts>.jpg'
  signature_path           text,                              -- 'firma/<tenant>/<od>/<ts>.png'
  received_by              text not null,                     -- nombre receptor
  received_doc             text,                              -- cédula opcional
  notes                    text,
  created_by_operario_id   uuid references public.operario_pins(id) on delete set null,
  created_at               timestamptz not null default now()
);

create index dispatch_pods_od_idx on public.dispatch_pods (od_id, created_at desc);
create index dispatch_pods_tenant_idx on public.dispatch_pods (tenant_id, created_at desc);
```

### RPC verify_operario_pin (update)

Necesita devolver `region` además de los campos existentes. Drop + recreate.

### 4 RPCs nuevas

`bodeguero_advance_od` + `bodeguero_split_p2` + `camionero_advance_od` +
`camionero_pod`. Todas security definer, service_role only.

### Bucket policy extension

Agregar policy a `receipt-photos` permitiendo `INSERT/SELECT` para
operarios authenticated por cookie (service_role lo bypassea pero queda
documentado).

---

## 5. State machine extendida

Cubrimos las transiciones que faltaban de SDD-0029:

| De | A | Trigger | Quién | RPC |
|---|---|---|---|---|
| `creada` | `cargando` | bodeguero abre OD | Bodeguero (PWA) | `bodeguero_advance_od` |
| `cargando` | `lista` | "Cerrar carga" | Bodeguero (PWA) | `bodeguero_advance_od` |
| `lista` | `en_ruta` | "Iniciar ruta" | Camionero (PWA) | `camionero_advance_od` |
| `en_ruta` | `entregada` | última POD confirmada | Camionero (PWA) | `camionero_advance_od` |
| `entregada` | `cerrada` | "Cerrar día" admin | Admin (Studio) | UPDATE direct |
| `*` | `cancelada` | confirm + motivo | Admin (Studio) | UPDATE direct |

Las transiciones ya tienen el `dispatch_orders_status_transition_guard`
trigger (SDD-0029 §4.11) que las valida en DB.

---

## 6. Permisos por rol

| Acción | Admin tenant | Bodeguero (PWA) | Camionero (PWA) |
|---|---|---|---|
| Ver cola de ODs del hub | ✓ (Studio) | ✓ (su hub) | ✗ |
| Ver paquetes de una OD | ✓ | ✓ (su hub) | ✓ (sus ODs `lista`) |
| Iniciar carga (creada→cargando) | ✗ | ✓ | ✗ |
| Fraccionar paquete P1/P2 | ✗ | ✓ | ✗ |
| Cerrar carga (cargando→lista) | ✗ | ✓ | ✗ |
| Iniciar ruta (lista→en_ruta) | ✗ | ✗ | ✓ |
| Confirmar POD | ✗ | ✗ | ✓ |
| Marcar entregada | ✗ | ✗ | ✓ |
| Cerrar día / cancelar | ✓ | ✗ | ✗ |

---

## 7. Casos borde

| Caso | Comportamiento |
|---|---|
| Operario CN intenta loguear en /m/ve/login | login action retorna error "Esta app es para operarios VE." |
| Operario VE legacy (`role='operario'`) | redirige a `/m/ve/bodeguero` por default · puede ver pero no actuar (botones disabled) — deuda a resolver creando operarios con role específico |
| Bodeguero cierra carga sin todos los paquetes confirmados | Permitido · queda `boxes_shipped < boxes_total` con motivo automático `falta_volumen` (V2: pedir motivo explícito) |
| Camionero intenta POD sin foto o sin firma | Botón "Confirmar entrega" disabled. Mensaje: "POD requiere al menos foto del cargamento y firma del receptor." |
| OD asignada a un truck cuyo driver_id no matchea ningún operario camionero | El camionero no ve la OD. Admin reasigna camión o crea operario PIN nuevo. |
| 2 camioneros distintos con el mismo nombre | Match por nombre ambiguo. Solución V2 con FK explícito. V1: usar nombres distintos en el seed. |
| PIN del camionero comprometido | Admin desactiva el operario desde `/studio/operarios`. La cookie expira en 12h máx pero `getCurrentOperario` chequea `active` en cada request → invalidación inmediata. |
| OD cancelada mientras el bodeguero la tiene abierta | Al refrescar, banner "OD cancelada por admin · volvé a la cola". |

---

## 8. Riesgos y mitigación

| # | Riesgo | Severidad | Mitigación |
|---|---|---|---|
| R1 | Match nombre operario↔driver es frágil | Media | Solo aplica en el query del camionero. V2 agregar FK. |
| R2 | Operarios sin `region='ve'` saltan a la app sin querer | Baja | Constraint nuevo bloquea seed con role inconsistente. Login revalida server-side. |
| R3 | Foto/firma uploads grandes saturan bucket | Baja | Compresión client-side en V2. V1 confiamos en cámara nativa (~2 MB típico). |
| R4 | Operario ofline pierde POD a confirmar | Media | V1 requiere conexión. V2 IndexedDB queue + sync. |
| R5 | Race: bodeguero y admin editan la misma OD | Baja | Last-write-wins. Trigger guard previene transiciones imposibles. |
| R6 | Cookie compartida con `/m/cn` accidentalmente | Baja | Path `/m` cubre ambas. Region en session distingue. Login action revalida. |

---

## 9. Open questions

1. **¿`role='bodeguero'` permitir actuar también como camionero en emergencia?**
   V1: no. Hay que crear PIN distinto. V2: rol multivalor en `operario_pins.roles text[]`.
2. **¿Cuánto pesa una foto comprimida JPEG 1080p?** ~150-300 KB. Bucket aguanta.
3. **¿Firma canvas como PNG transparente o JPEG con fondo?** PNG transparente para que el admin la pueda overlay sobre un PDF en V2 (Generar POD oficial).

---

## 10. Origen y trazabilidad

- **Bundle origen:** `docs/design/studio/v1.6-claude-design/handoff/SDD-2026-05-25-sesion/`
- **Briefs:** se infieren del brief 01-despacho (Vista 3 = bodeguero · Transportista = camionero)
- **Source JSX referencia:**
  - `source/operario/bodeguero-despacho.jsx` (~1500 líneas con role picker + LIFO + split)
  - `source/operario/camionero.jsx` (~600 líneas con GPS + POD modal)
- **NO portamos**: el role picker visual (D1 explica por qué), GPS real,
  push notifications nativas, IndexedDB offline.
