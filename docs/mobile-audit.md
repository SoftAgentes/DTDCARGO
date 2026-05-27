# Mobile Audit · pre-Portal Cliente · 2026-05-27

> **PASO 1.1 del prompt maestro App Móvil DTDCARGO.**
> Reporte para alinear sobre estado actual antes de scaffold del portal cliente
> en `/m/cliente/*` y migración SQL 0043. Sin tocar código.

---

## 1. Estructura `app/m/`

```
app/m/
├── layout.tsx                          # root mobile (PWA metadata, viewport, tokens.css)
├── m.css                               # ajustes locales del namespace mobile
├── _components/
│   ├── BigButton.tsx                   # botón ≥48px (CTA grande)
│   ├── KpiCard.tsx                     # card de KPI (cn home)
│   ├── MobileHeader.tsx                # header reusable (back + título + acciones)
│   └── PwaRegister.tsx                 # service worker register (client)
│
├── cn/                                 # ───── Operario almacén CN (Wang Hua / YIW-A1)
│   ├── login/
│   │   ├── actions.ts                  # signInOperarioAction (server)
│   │   └── page.tsx                    # numpad PIN bilingüe ES/CN (client)
│   ├── actions.ts                      # signOutOperarioAction
│   ├── page.tsx                        # home — KPIs día + últimas recepciones (server)
│   ├── _components/
│   │   └── OperarioHomeClient.tsx      # UI client del home
│   └── nueva/                          # wizard 4-step para registrar recepción
│       ├── actions.ts                  # createReceiptAction (server)
│       ├── photo-actions.ts            # upload + link foto (server)
│       ├── page.tsx                    # entry server
│       └── _components/
│           └── NuevaRecepcionClient.tsx
│
└── ve/                                 # ───── Despacho VE (bodeguero + camionero)
    ├── login/
    │   ├── actions.ts                  # signInOperarioVeAction (server, redirige por role)
    │   └── page.tsx                    # numpad PIN (client)
    ├── bodeguero/
    │   ├── actions.ts                  # advance_od / split_p2 (server)
    │   ├── page.tsx                    # cola de ODs (server)
    │   └── _components/BodegueroClient.tsx
    └── camionero/
        ├── actions.ts                  # advance_od / POD (server)
        ├── page.tsx                    # ruta activa (server)
        └── _components/
            ├── CamioneroClient.tsx
            └── PodModal.tsx            # foto + firma + receptor
```

**Lo que NO existe (target de Fase 1 del prompt):**
- `app/m/cliente/` — completo, hay que scaffoldear.
- Layout con bottom nav cliente (envíos / facturas / perfil).
- Auth Supabase email+password (todo `/m/*` actual usa PIN custom).

**Patrones reusables que vale la pena heredar al portal cliente:**
- `_components/MobileHeader.tsx` (back + título + acción) — funciona genérico.
- `_components/BigButton.tsx` (≥48px tap target) — listo.
- `_components/PwaRegister.tsx` — el service worker actual se monta en root layout, así que el portal cliente lo hereda gratis.
- `layout.tsx` raíz — ya define viewport mobile + theme color navy + manifest. El portal cliente entra al mismo namespace y hereda.

---

## 2. PIN auth en `/m/cn` (cómo funciona hoy)

### 2.1 Flujo completo

1. **Login** ([app/m/cn/login/page.tsx](app/m/cn/login/page.tsx)) — numpad 4 dígitos, `useActionState` con `signInOperarioAction`.
2. **Server action** ([app/m/cn/login/actions.ts](app/m/cn/login/actions.ts)):
   - Valida formato (4 dígitos numéricos) con `isValidPin()`.
   - Llama `signInWithPin(pin)` de `lib/auth/operario-session.ts`.
   - Si OK → `redirect("/m/cn")`; si no → retorna `{ error }`.
3. **`signInWithPin`** ([lib/auth/operario-session.ts:32](lib/auth/operario-session.ts:32)):
   - Crea `createAdminClient()` (service_role).
   - Llama RPC `verify_operario_pin(p_pin)` — RPC compara bcrypt contra todos los `operario_pins.pin_hash` activos.
   - Si match único → setea cookie `dtd_op = operario_id`.
   - Retorna `OperarioSession`.
4. **Cada `page.tsx` protegido** llama `getCurrentOperario()`:
   - Lee cookie `dtd_op`.
   - Re-valida `id + active` en DB (cada request).
   - Si no encuentra o está `active=false` → borra cookie + retorna `null` → page redirige a `/m/cn/login`.

### 2.2 La cookie `dtd_op`

```ts
{
  name:     "dtd_op",
  value:    operario_id,            // uuid v4 random, no enumerable
  httpOnly: true,
  secure:   NODE_ENV === "production",
  sameSite: "lax",
  path:     "/m",                   // SOLO namespace mobile
  maxAge:   60 * 60 * 12,            // 12h — turno
}
```

**No HMAC, no JWT, no refresh.** La validación es: cada request → SELECT contra DB para confirmar `active=true`. Si el admin desactiva al operario, la próxima acción del operario lo bota.

### 2.3 RPC `verify_operario_pin` (DB)

```sql
-- Definido en supabase/migrations/0020_operario_pins.sql
-- Reemplazado en 0025_operario_roles_extend.sql para devolver region
-- Hardenado en 0037_harden_operario_pin_validator.sql

verify_operario_pin(p_pin text)
  RETURNS TABLE (
    operario_id, tenant_id, warehouse_id,
    display_name, display_name_cn, role, region
  )
  SECURITY DEFINER
  GRANT EXECUTE TO service_role  -- nadie más
```

- bcrypt via `crypt(p_pin, pin_hash)` (pgcrypto).
- Si hay 0 o >1 matches activos → retorna nada (falla silenciosa).
- Update `last_login_at = now()` en el mismo RETURNING.

### 2.4 Por qué el operario NO usa Supabase Auth

UX hard: el operario tipea 4 dígitos en kiosko, no maneja email/password. Costo: rompe el patrón estándar RLS porque `auth.uid()` es `null` → todas las mutaciones del operario van por RPCs `SECURITY DEFINER` con service_role (e.g. `create_receipt_as_operario`, `link_receipt_photo`, `bodeguero_advance_od`, `camionero_advance_od`, `camionero_pod`).

**Implicancia para el portal cliente:** el cliente SÍ va a usar Supabase Auth (email+password normal), así que **no replica este patrón** — vuelve al canon RLS basado en `auth.uid()`.

---

## 3. `proxy.ts` y refresh de JWT

Archivo: [proxy.ts](proxy.ts) (raíz). En Next.js 16 reemplaza al deprecated `middleware.ts`.

### 3.1 Qué hace

```ts
export const config = {
  matcher: ["/studio/:path*", "/back/:path*"],
}
```

- **Solo corre en `/studio/**` y `/back/**`.**
- `/m/*` y el sitio público (`/`, `/cotizar`, `/track`, etc.) NO pasan por él.
- Refresca la sesión Supabase en cookies con `createServerClient` + `getUser()` (no `getSession()` — valida el JWT contra Supabase).
- Si no hay user y la ruta no es `/{studio,back}/login` → redirect al login.
- Si hay user y está en `/{studio,back}/login` → redirect al dashboard.
- **No hace gating fino de roles** — eso lo hace `requireAnyBackRole()` en el layout protegido respectivo.

### 3.2 Implicancia para el portal cliente

El portal cliente vive en `/m/cliente/*`. Hay 3 opciones para protegerlo:

| Opción | Pro | Con |
|---|---|---|
| **A. Extender matcher del proxy a `/m/cliente/:path*`** | Reusa patrón Studio/back. Cookie refresh automático. | Riesgo: si el matcher pesca también `/m/cn` o `/m/ve` por error, rompe el PIN auth (el proxy llama `getUser()` y los operarios no tienen auth.users — `user` quedaría siempre null → redirige a `/m/cliente/login` aunque la cookie `dtd_op` esté seteada). Hay que ser muy preciso con el glob. |
| **B. Sin proxy: layout `app/m/cliente/layout.tsx` + page-level guards** ⭐ | Cero riesgo de afectar al PIN auth de CN/VE. Patrón ya usado en `/m/cn` y `/m/ve` (cada page chequea sesión). | Sin refresh automático: si el access_token vence durante la sesión, el cliente ve un 401 hasta que recargue. Solución: ServerComponent llama `createClient()` que ya refresca cookies via `@supabase/ssr`. |
| **C. proxy nuevo separado** | Pero Next.js solo soporta un `proxy.ts` raíz. ❌ inviable. | — |

**Recomiendo opción B** porque mantiene el firewall entre PIN auth (`/m/cn`, `/m/ve`) y Supabase Auth (`/m/cliente`). El refresh de JWT lo cubre `@supabase/ssr` desde el server component al ejecutar `createClient()`.

**Si elegimos A**, el matcher debe ser **explícito**: `"/m/cliente/:path*"` (NO `/m/:path*`).

---

## 4. Esquema actual: lo que existe vs lo que pide el prompt

### 4.1 `user_tenants` ✅ existe — pero NO es `back_user_roles`

Definido en `supabase/migrations/0001_init_tenancy.sql` + extendido en `0019_users_roles.sql`:

```sql
public.user_tenants (
  user_id        uuid NOT NULL REFERENCES auth.users(id),
  tenant_id      uuid NOT NULL REFERENCES tenants(id),
  role           text NOT NULL DEFAULT 'admin'
                   CHECK (role IN ('admin','commercial','operations',
                                   'accounting','warehouse','support')),
  disabled_at    timestamptz,
  last_login_at  timestamptz,
  invited_by     uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tenant_id)
);

-- Helper crítico usado por todas las RLS:
public.get_user_tenant_id() → uuid    -- el tenant del user actual
```

**Nota:** el prompt pide consultar `back_user_roles` pero **esa tabla no existe en este repo**. El prompt parece arrastrar nomenclatura de otro proyecto (el back del sitio HailuWay original usa `back_user_roles`, este Studio sí o sí pasa por `user_tenants`). Si "back" del prompt refiere al admin del studio → tabla a leer es `user_tenants`. Si refiere literalmente al back público (`app/back/*`) → eso no aplica al portal cliente del prompt.

**Implicancia para portal cliente:** el `client_id` del shipment debería FK a `auth.users.id`, pero **el cliente del portal NO debería entrar en `user_tenants`** (porque eso le daría acceso a la operación interna del tenant). Hay que separar conceptualmente:
- `user_tenants` = staff interno del tenant (DTD employees).
- `clients` (tabla 0006) = catálogo de clientes finales (sin auth hoy).
- **Falta una relación 1:N entre auth.users (cliente externo) ↔ clients (catálogo).** Esto es decisión de PASO 1.2.

### 4.2 `shipments` ✅ existe (con caveats)

Definido en `supabase/migrations/0002_shipments.sql`:

```sql
public.shipments (
  id                       uuid PK,
  tenant_id                uuid NOT NULL,
  code                     text NOT NULL,
  client_name              text,
  client_markbox           text,                     -- DTD-XXXX (string, no FK)
  origin                   text,
  destination              text,
  shipment_service         shipment_service enum,    -- 4 productos
  status                   shipment_status enum,     -- 13 estados
  weight_kg                numeric(10,2),
  volume_m3                numeric(10,3),
  vehicle_category         text,
  vehicle_model            text,
  arrived_destination_at   timestamptz,
  cancellation_reason      text,
  notes                    text,
  deleted_at               timestamptz,              -- soft delete
  created_at, updated_at   timestamptz,
  UNIQUE (tenant_id, code)
);

public.shipment_events (
  id, tenant_id, shipment_id, status,
  note, occurred_at, created_by uuid REFERENCES auth.users(id),
  deleted_at, created_at
);
```

**Diferencias con lo que pide el prompt:**

| Campo prompt | Estado actual | Acción |
|---|---|---|
| `client_id uuid FK auth.users` | ❌ NO existe — solo `client_markbox text` | ALTER ADD COLUMN en 0043 |
| `origin` | ✅ text genérico | OK |
| `destination` | ✅ text genérico | OK |
| `status enum` | ✅ 13 valores oficiales | OK |
| `cbm numeric` | ⚠️ se llama `volume_m3` | mapear en query layer |
| `weight numeric` | ✅ `weight_kg` | mapear |
| `total_usd numeric` | ❌ NO existe | ALTER ADD COLUMN |

**`shipment_events`** lo que pide el prompt:

| Campo prompt | Estado actual |
|---|---|
| `event_type` | ⚠️ se llama `status` (enum) — semántica solapada |
| `location` | ❌ NO existe |
| `notes` | ✅ `note` |
| `photo_url` | ❌ NO existe |
| `operator_id` | ⚠️ se llama `created_by` (uuid → auth.users) |

Decisión PASO 1.2: ¿ALTER aditivo (add `location`, `photo_url`) o crear `shipment_events_public` separada para el portal cliente?

### 4.3 `receipts` ❌ NO existe con ese nombre

Lo más cercano es `warehouse_receipts_cn` (migration 0008 + extends), que son **recepciones de mercancía en el hub CN** registradas por el operario — semántica distinta a "fotos de facturas del cliente" que pide el prompt.

**Recomendación de naming:** la tabla nueva del prompt debe llamarse `client_invoice_uploads` o `client_receipts` para no chocar conceptualmente con `warehouse_receipts_cn`. Decisión PASO 1.2.

Schema que pide el prompt:

```sql
public.receipts (              -- naming a confirmar
  id              uuid PK,
  tenant_id       uuid,
  client_id       uuid REFERENCES auth.users(id),
  shipment_id     uuid REFERENCES shipments(id),  -- nullable
  photo_url       text,                            -- storage path
  amount_usd      numeric,
  status          text,                            -- enum pendiente/aprobada/rechazada?
  created_at      timestamptz
);
```

### 4.4 `push_subscriptions` ❌ NO existe como tabla aparte

**Infra existente:** las push subscriptions del Studio se guardan dentro de `user_notification_prefs.push_subscription` (columna jsonb), gestionadas por:
- `POST /api/studio/push/subscribe` ([app/api/studio/push/subscribe/route.ts](app/api/studio/push/subscribe/route.ts))
- `DELETE /api/studio/push/subscribe` (mismo route)

Esto sirve para users del Studio (`user_tenants`). Para clientes externos del portal **necesitamos una de tres opciones** (decidir en PASO 1.2):

| Opción | Pro | Con |
|---|---|---|
| **A. Tabla `push_subscriptions` standalone** (como pide el prompt) ⭐ | Schema simple. Soporta N devices por user. Soporta plataforma (web/ios/android) sin tocar prefs Studio. | Duplica modelo: el Studio tiene 1 sub por user (en jsonb), el cliente puede tener N en tabla. |
| **B. Reusar `user_notification_prefs`** | Una sola tabla, menos surface. | Schema actual asume 1:1 user↔sub. Móvil real necesita N (mismo user en web + Android + iOS). Migración disruptive. |
| **C. Crear `user_notification_prefs` plural y deprecar la jsonb** | Refactor limpio. | Out of scope para este sprint. |

**Recomiendo A** porque la columna `platform` (web/ios/android) y N devices por user están en el prompt explícitamente — el modelo del Studio no se reusa.

### 4.5 Bucket `receipt-photos` ✅ existe

Definido en `0022_receipt_photos.sql`. Bucket privado, 8MB max, MIME types: jpeg/png/webp/heic/heif.

**Storage policies actuales:**
- `service_role` → all (insert/select/delete) cuando `bucket_id = 'receipt-photos'`.
- `authenticated` → select cuando `bucket_id = 'receipt-photos' AND foldername[1] = tenant_id`.
- **El path scheme actual del operario:** `{tenant_id}/{receipt_id}/{position}-{uuid}.jpg`.

**Para portal cliente:** el prompt pide `tenants/{tenant_id}/clients/{client_id}/{uuid}.jpg`. Esto **compatibiliza con la policy actual** (primer segmento = tenant_id) **siempre que `clients` esté en algún subpath**. El cliente, autenticado, va a poder leer cualquier foto de su tenant — incluyendo las del operario. Si eso es problemático (probable), hay que hacer policy más fina:

```sql
-- Borrador propuesta para PASO 1.2
create policy "receipt-photos client owns its uploads"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'receipt-photos'
    and (storage.foldername(name))[1] = 'clients'
    and (storage.foldername(name))[3] = auth.uid()::text
  );
```

Decisión PASO 1.2: ¿path scheme + policy?

---

## 5. RLS existente en tablas relevantes

| Tabla | RLS habilitado | Policy | Comentario |
|---|---|---|---|
| `tenants` | ✅ | `id = get_user_tenant_id()` | SELECT only |
| `user_tenants` | ✅ | `user_id = auth.uid()` (rollback de 0040 en 0041 — solo veo mis membresías) | SELECT only; INSERT/UPDATE via RPC |
| `shipments` | ✅ | `tenant_id = get_user_tenant_id() AND deleted_at IS NULL` (FOR ALL) | El cliente externo no califica porque `get_user_tenant_id()` para él retornaría NULL (no está en user_tenants). **Hay que sumar policy específica para clientes.** |
| `shipment_events` | ✅ | igual a shipments | mismo problema |
| `clients` | ✅ | `tenant_id = get_user_tenant_id() AND deleted_at IS NULL` | mismo problema |
| `warehouse_receipts_cn` | ✅ | tenant_id check + service_role para inserts del operario | OK |
| `warehouse_receipt_photos` | ✅ | tenant_id check | OK |
| `operario_pins` | ✅ | DENY ALL para authenticated (solo service_role) | by design |
| `dispatch_orders` + 4 dispatch tables | ✅ | `tenant_id IN (select tenant_id from user_tenants where user_id = auth.uid())` | mismo problema |
| `dispatch_pods` | ✅ | tenant_id IN user_tenants | mismo problema |
| `user_notification_prefs` | ✅ (presunto) | owner-only | OK pero no aplica si vamos por push_subscriptions standalone |

### 5.1 Decisión central para PASO 1.2 — RLS del cliente externo

`get_user_tenant_id()` está pensado para staff. El cliente externo NO debe ser miembro de `user_tenants` (eso lo haría empleado). Entonces necesitamos:

```sql
-- Helper paralelo
create or replace function public.get_user_client_id()
returns uuid language sql stable security definer as $$
  select id from public.clients
  where auth_user_id = auth.uid() and deleted_at is null
  limit 1;
$$;

-- Y RLS adicional en shipments:
create policy "shipments client portal"
  on public.shipments for select
  to authenticated
  using (
    deleted_at is null
    and client_id = auth.uid()      -- nueva col 0043
  );
```

Esto requiere:
1. ALTER `clients` ADD `auth_user_id uuid REFERENCES auth.users(id) UNIQUE` (nullable: clientes legacy sin login).
2. ALTER `shipments` ADD `client_id uuid REFERENCES auth.users(id)` (nullable: shipments legacy con solo `client_markbox`).

---

## 6. Patrón Server Components vs Client Components en `/m/cn`

### 6.1 Estructura

- **`page.tsx` → Server Component por default.**
  - `export const dynamic = "force-dynamic"` para que cookies y queries no se cacheen.
  - Hace `await getCurrentOperario()` (cookie + DB roundtrip).
  - Si no hay sesión → `redirect("/m/cn/login")`.
  - Usa `createAdminClient()` (service_role) para queries porque el operario no tiene `auth.uid()`.
  - Hace fetching paralelo con `Promise.all([...])`.
  - Calcula KPIs/agregados en server.
  - Pasa props serializables al Client Component.

- **`_components/<X>Client.tsx` → `"use client"`.**
  - Recibe props del server.
  - Maneja interactividad (forms, drawers, modals, gestos touch).
  - Llama server actions con `useActionState` + `startTransition`.

- **`actions.ts` → `"use server"`.**
  - Toma `FormData`, valida con helpers tipados (no Zod — convención del repo).
  - Mutación via RPC `SECURITY DEFINER` con service_role.
  - `revalidatePath()` o `redirect()`.

- **`login/page.tsx` → excepción: Client Component.**
  - Necesita estado local (PIN buffer, shake animation, lang switch).
  - Usa `useActionState` directamente.
  - El server action `signInOperarioAction` hace el `redirect()` server-side cuando la cookie ya está seteada en el header.

### 6.2 Recomendación para portal cliente

Aplicar el **mismo patrón** con dos diferencias:

1. **Backend client**: usar `createClient()` (con `@supabase/ssr`) en lugar de `createAdminClient()`. El cliente tiene `auth.uid()` real, RLS hace el trabajo de filtrado.
2. **Sesión**: `await supabase.auth.getUser()` en cada server component protegido (en lugar de `getCurrentOperario()`).

Esquema:

```
app/m/cliente/
├── layout.tsx                          # server component, auth guard común
├── login/
│   ├── actions.ts                      # signInAction (email+password)
│   └── page.tsx                        # client (forms necesitan estado)
├── envios/
│   ├── page.tsx                        # server: lista
│   ├── [id]/
│   │   ├── page.tsx                    # server: detalle
│   │   └── _components/ShipmentTimeline.tsx  # client: lightbox fotos
│   └── _components/ShipmentListItem.tsx
├── facturas/
│   ├── actions.ts                      # upload + delete
│   ├── page.tsx                        # server: grid thumbnails
│   └── _components/
│       ├── FacturasGrid.tsx            # client: lightbox
│       └── UploadButton.tsx            # client: input file + compresión
└── perfil/
    ├── actions.ts                      # logout + update profile
    └── page.tsx                        # server (con form action al server)
```

---

## 7. Stack mobile · estado de instalación

| Dependencia | Versión | Estado | Uso futuro |
|---|---|---|---|
| `next` | 16.x | ✅ instalado | base |
| `react` | 19.x | ✅ instalado | base |
| `@supabase/ssr` | ✅ | ✅ instalado | auth cliente |
| `@supabase/supabase-js` | ✅ | ✅ instalado | admin/service queries |
| `web-push` | ^3.6.7 | ✅ instalado (CONFIRMADO en `package.json:39`) | push web (Fase 2.3) |
| `html5-qrcode` | — | ❌ falta | scanner web (Fase 2.1) |
| `browser-image-compression` | — | ❌ falta | compresión fotos cliente (Fase 2.2) |
| `@capacitor/core` + `cli` | — | ❌ falta | wrapper nativo (Fase 3.1) |
| `@capacitor/android` `/ios` | — | ❌ falta | platforms (Fase 3.1) |
| `@capacitor-mlkit/barcode-scanning` | — | ❌ falta | scanner nativo (Fase 3.2) |
| `@capacitor/camera` | — | ❌ falta | cámara nativa (Fase 3.2) |
| `@capacitor/push-notifications` | — | ❌ falta | push FCM nativo (Fase 3.2) |
| `@capacitor/preferences` | — | ❌ falta | storage nativo (Fase 3.2) |
| `@capacitor/filesystem` | — | ❌ falta | fs nativo |
| `@capacitor/app` + `status-bar` + `splash-screen` | — | ❌ falta | UX nativa |
| `@capacitor/assets` (dev) | — | ❌ falta | generar icon/splash (Fase 3.3) |

**VAPID keys:** según memoria persistente del proyecto (2026-05-27), las VAPID keys están **pendientes de pegar en Vercel** después de generarse. Hay que confirmar con founder si ya están en local `.env.local`. Si no, Fase 2.3 tiene que generar nuevas con `npx web-push generate-vapid-keys`.

**Service worker actual:** `app/m/_components/PwaRegister.tsx` registra el SW de la PWA. Hay que verificar si el SW actual maneja push events o si hay que sumar uno separado `public/sw-push.js` (como pide el prompt). Si reusamos el SW existente, evitamos doble registration.

---

## 8. Riesgos y decisiones que necesito antes de PASO 1.2

Antes de escribir la migración `0043_client_portal.sql`, necesito confirmación del founder en los siguientes puntos. Los marqué por orden de prioridad:

### ⭐ Decisión 1 — Modelo de cliente externo (cliente del portal)

**Pregunta:** ¿El cliente del portal (auth.users) se relaciona con la tabla `clients` (catálogo) cómo?

**Opciones:**
- **A. ALTER `clients` ADD `auth_user_id uuid UNIQUE REFERENCES auth.users(id)`** (nullable) ⭐
  - Cliente queda 1:1 con su row de catálogo. Si el catálogo no tiene `auth_user_id`, no hay login.
  - El cliente ve sus shipments via `shipments.client_id = auth.uid()` (nueva col).
- **B. Tabla `client_users` aparte** — N usuarios por client_id (e.g. logística + admin + financiero del cliente).
- **C. El cliente NO se loguea al portal (sin auth) — usa solo `/track/[code]` público.**
  - Si fuera C, todo PASO 1.x del prompt es vacío. Asumo NO.

### ⭐ Decisión 2 — `client_id` en `shipments`

**Pregunta:** ¿Cómo backfilleamos `shipments.client_id` para los envíos existentes?

**Opciones:**
- **A. Backfill por match `client_markbox = clients.markbox`** y luego `clients.auth_user_id` (chain JOIN). ⭐
- **B. Nullable, sin backfill** — solo aplica a shipments futuros.
- **C. Hybrid: backfill cuando hay match unívoco, NULL si no.**

### Decisión 3 — Naming de la tabla `receipts`

- **A. `client_invoice_uploads`** — explícito, no choca con `warehouse_receipts_cn`. ⭐
- **B. `receipts`** — como pide el prompt, riesgo: el tenant tiene 2 conceptos "receipts".
- **C. `client_receipts`** — middle ground.

### Decisión 4 — `push_subscriptions`

- **A. Tabla standalone como pide el prompt** ⭐ (soporta N devices, platform).
- **B. Reusar `user_notification_prefs.push_subscription`** (refactorizar a jsonb array).

### Decisión 5 — Path scheme + policy del bucket `receipt-photos`

Path propuesto del prompt: `tenants/{tenant_id}/clients/{client_id}/{uuid}.jpg`.

¿Sumamos policy fina que limite al cliente a leer solo `clients/{auth.uid()}/*`? ⭐ Recomiendo sí.

### Decisión 6 — Auth guard del portal cliente

- **A. Layout `app/m/cliente/layout.tsx` + page-level guards** (NO tocar proxy.ts) ⭐.
- **B. Extender `proxy.ts` matcher con `"/m/cliente/:path*"`** (cuidado de NO pescar `/m/cn` ni `/m/ve`).

### Decisión 7 — VAPID keys

¿Las claves ya están generadas y en `.env.local`? Si no, en Fase 2.3 las genero con `npx web-push generate-vapid-keys` y pido pegar en Vercel.

---

## 9. Lo que ya está aprovechable y NO hay que reinventar

- ✅ Bucket privado `receipt-photos` con policies por tenant.
- ✅ Tabla `clients` con catálogo + MARKBOX autogenerado + RLS por tenant.
- ✅ Tabla `shipments` + `shipment_events` con state machine + soft delete + RLS.
- ✅ Patrón Server Components + Client Components + Server Actions + `useActionState`.
- ✅ Layout PWA mobile con tokens.css del Studio + service worker register + manifest.
- ✅ Componentes mobile reusables (`MobileHeader`, `BigButton`, `KpiCard`, `PwaRegister`).
- ✅ `web-push` instalado.
- ✅ Tokens de marca (color, tipografía, spacing) — solo `var(--*)` desde `app/studio/tokens.css`.
- ✅ Iconografía centralizada en `app/studio/_components/icons.tsx`.
- ✅ Tracking público `/track/[code]` con mocks (extensible al portal autenticado).
- ✅ `BrandMark` component oficial (v3.0 con 4 variantes).
- ✅ Catálogo VE público (24 estados + ~98 ciudades + IPOSTEL) en `ve_locality_catalog` — útil para perfil cliente con autocompletado de dirección.

---

## 10. Estado de PASO 1.1

- [x] Estructura `app/m/` documentada.
- [x] Flow PIN auth `/m/cn` documentado (server actions + cookie + RPCs).
- [x] `proxy.ts` y refresh JWT documentados + recomendación de extensión.
- [x] Esquema `user_tenants` + ausencia de `back_user_roles` aclarada.
- [x] `shipments` / `shipment_events` documentados con diff vs prompt.
- [x] `receipts` y `push_subscriptions` ausentes — propuestas de naming.
- [x] Bucket `receipt-photos` + path scheme documentado.
- [x] RLS existentes documentadas.
- [x] Patrón Server vs Client + recomendación para portal cliente.
- [x] Stack mobile: instalado vs faltante.
- [x] 7 decisiones identificadas para PASO 1.2.

**Status:** ✅ PASO 1.1 completado. Esperando feedback del founder para arrancar PASO 1.2 (migración SQL).
