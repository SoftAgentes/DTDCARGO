---
sdd: "0042"
title: "Portal del Cliente — auth de cliente + mis envíos (V1)"
status: done
author: "founder"
created: 2026-06-02
updated: 2026-06-27
supersedes: null
superseded_by: null
related: ["0010", "0013", "0021", "0024", "0026"]
confidencialidad: interno
---

# DTD-0042 — Portal del Cliente · V1

> **Área autenticada para que un cliente externo entre con su email y vea SUS envíos** (y, en fases siguientes, sus facturas y documentos). Es una **5ª superficie** (`/portal`), backed por Supabase como el Studio y las PWAs `/m` — **NO** es el sitio público de marketing. El alta de credenciales es **mediada por el admin** (igual que el modelo de cliente: el admin habilita el portal), reusando el patrón de invitación de SDD-0024.

---

## 1. Resumen en una línea

`dtdcargo.com/portal` deja que un cliente se autentique con su email (magic-link de Supabase Auth), quede vinculado a su registro `clients` vía una tabla `client_users`, y vea **solo SUS** envíos en read-only — con RLS por `client_id` (helper nuevo `get_portal_client_id()`, **separado** del de equipo `get_user_tenant_id()`). El admin habilita el portal de un cliente desde `/studio/clientes` (acción "Invitar al portal").

---

## 2. Las 4 → 5 superficies

Hoy el repo tiene 4 superficies (sitio público, Studio, Móvil PWA, Back CMS). El portal es la **5ª**:

| Superficie | Rutas | Backend | Auth |
|---|---|---|---|
| **Portal del Cliente** (nuevo) | `app/portal/` | Supabase (`lib/db`, `lib/portal/`) | **Cliente** (Supabase Auth + `client_users`) |

- **NO** viola la frontera público↔ERP: la frontera es *sitio de marketing ↔ ERP*. El portal es una superficie **autenticada** que legítimamente usa Supabase, igual que `app/m/*` ("reusa lib/studio, permitido") y `app/back/*`.
- El **sitio de marketing** (`app/{cotizar,track,...}`) sigue sin tocar Supabase. El link a `/portal` desde el sitio público es solo un `<Link href>` (navegación), no un import.

---

## 3. Scope

### Incluye

#### 3.1 Schema (migración `0080_portal_cliente.sql`)

- **Tabla nueva `client_users`** (link auth.user ↔ cliente, con estado de invitación):
  ```
  client_users (
    id          uuid PK default gen_random_uuid(),
    tenant_id   uuid NOT NULL references tenants(id) on delete cascade,
    client_id   uuid NOT NULL references clients(id) on delete cascade,
    email       text NOT NULL,                 -- lower-case, copiado del cliente al invitar
    auth_user_id uuid references auth.users(id) on delete set null,  -- NULL hasta que reclama
    token       text UNIQUE,                    -- claim token (32 chars url-safe), NULL tras bind
    status      text NOT NULL default 'invited' check (status in ('invited','active','revoked')),
    invited_by  uuid references auth.users(id),
    invited_at  timestamptz NOT NULL default now(),
    bound_at    timestamptz,                    -- cuando auth_user_id se vinculó
    revoked_at  timestamptz,
    last_login_at timestamptz,
    created_at  timestamptz NOT NULL default now(),
    updated_at  timestamptz NOT NULL default now(),
    unique (tenant_id, client_id),              -- 1 acceso de portal por cliente (V1)
    unique (auth_user_id)                       -- 1 cliente por auth.user
  );
  ```

- **Helper SQL nuevo `get_portal_client_id()`** (SECURITY DEFINER, `search_path=public`):
  ```sql
  -- Devuelve el client_id del cliente vinculado al auth.uid() actual, o NULL.
  -- SEPARADO de get_user_tenant_id() — un cliente NUNCA tiene row en user_tenants,
  -- así que las policies del Studio (que filtran por get_user_tenant_id()) NUNCA
  -- le dan datos. Esta es la única vía por la que un cliente lee data.
  select client_id from public.client_users
  where auth_user_id = auth.uid() and status = 'active'
  limit 1
  ```
  Y un companion **`get_portal_client_markbox()`** (mismo lookup, join a `clients`, devuelve `markbox`) porque **`shipments` linkea al cliente por `client_markbox` (text), no por FK** (ver 5.8).
  > ⚠️ **No tocar `get_user_tenant_id()` ni la RLS de `user_tenants`** (incidente 2026-05-27, ver `feedback_rls_policies_maybesingle_anti_pattern`). El portal usa SU propio helper, aislado.

- **Policies RLS aditivas** (permissive = OR con las de equipo existentes):
  - `clients`: policy SELECT "portal: own client row" `using (id = get_portal_client_id())`.
  - `shipments`: policy SELECT "portal: own shipments" `using (deleted_at is null and client_markbox is not null and client_markbox = get_portal_client_markbox())`.
  - `client_users`:
    - SELECT: el propio cliente ve su row (`auth_user_id = auth.uid()`) **O** admin del tenant (`tenant_id = get_user_tenant_id()`).
    - INSERT/UPDATE: solo vía RPC (invite / bind / revoke). DELETE bloqueado.
  - **Read-only para el cliente**: cero policies de INSERT/UPDATE/DELETE para el principal-cliente sobre `clients`/`shipments`. Solo SELECT.

- **3 RPCs**:
  - `portal_invite_client(p_client_id)` → `{ client_user_id, token, email }`
    · Solo admin del tenant (chequea `get_user_tenant_id()` = tenant del cliente).
    · Toma el `email` del cliente (falla si el cliente no tiene email).
    · Crea/reusa row `client_users` status `invited` + token random 32 chars.
    · Si ya está `active`, devuelve sin re-tokenizar.
  - `portal_bind_session()` → `{ client_id, bound }`
    · La llama el callback de login: matchea el `email` del auth.uid() actual contra un `client_users` invited del mismo email → setea `auth_user_id`, `status='active'`, `bound_at`. Idempotente.
    · Si no hay invited match → no vincula (devuelve `bound=false`); el cliente ve "tu acceso no está habilitado, contactá a tu asesor".
  - `portal_revoke_client(p_client_id)` → bool · solo admin · status `revoked`, limpia `auth_user_id`.

- **Trigger** `client_users_touch` (updated_at) reusando `touch_updated_at()`.
- **Grants** explícitos (auto-expose OFF, como el resto del repo).

#### 3.2 Lib (`lib/portal/`)

- `lib/portal/portal-types.ts`: `PortalClient`, `PortalShipmentRow`, `ClientUserStatus` + helpers de label/estado (reusa `SERVICE_LABELS`/`STATUS_LABELS`/`STATUS_COLORS` de `lib/shared/shipment-public.ts`).
- `lib/portal/portal-queries.ts` (funciones puras que reciben `SupabaseClient`):
  - `getPortalClient(supabase)` — el cliente del auth.uid actual (vía RLS) o null.
  - `listMyShipments(supabase, filters?)` — envíos del cliente (RLS por client_id), orden por updated_at desc, paginado.
  - `getMyShipment(supabase, code)` — un envío propio (Fase 2).
- `lib/studio/portal-admin-queries.ts` o extensión de `client-queries.ts`: `getClientPortalAccess(supabase, clientId)` para mostrar estado del portal en el detalle del cliente.

#### 3.3 Surface `app/portal/`

- `app/portal/(auth)/login/page.tsx` — pide email → magic-link de Supabase Auth (OTP/`signInWithOtp`). Copy: "Entrá con el email registrado con tu asesor".
- `app/portal/(auth)/callback/route.ts` — callback de Supabase Auth → `portal_bind_session()` → redirect a `/portal` (o a "acceso no habilitado").
- `app/portal/(app)/layout.tsx` — server: resuelve `getPortalClient()`. Si null → redirect `/portal/login`. Header con `<BrandMark>` + MARKBOX del cliente + logout. **NO** comparte layout con el Studio.
- `app/portal/(app)/page.tsx` — **"Mis envíos"**: lista read-only de envíos con estado (badge por `STATUS_COLORS`), origen→destino, ETA, código de tracking. EmptyState si no hay.
- `app/portal/_components/` — `PortalHeader`, `ShipmentCard`/`ShipmentRow`, `StatusBadge` (reusa tonos de `lib/shared`).

#### 3.4 Admin: habilitar portal (en Studio)

- `app/studio/(app)/clientes/[markbox]/` — agregar sección "Acceso al portal": estado (sin invitar / invitado / activo / revocado) + botón **"Invitar al portal"** → server action `invitePortalAction` → RPC `portal_invite_client` → email con link magic (vía SDD-0026 Mailing; fallback: mostrar el link para compartir manual, igual que 0024). + "Revocar acceso".
- `app/studio/(app)/clientes/actions.ts` — `invitePortalAction`, `revokePortalAction`.

#### 3.5 Link desde el sitio público

- `components/Nav.tsx` y/o `components/Footer.tsx`: link "Portal" → `/portal`. (Decidir nav vs footer — ver open questions.)

#### 3.6 Headers / middleware

- `next.config.ts`: `/portal/*` necesita Supabase en `connect-src` (igual que el Studio ya lo tiene en el catch-all). Verificar que el catch-all ya lo cubre (sí: `connect-src 'self' https://*.supabase.co wss://*.supabase.co`). **Sin cambios** salvo que el portal necesite algo extra.

### NO incluye (diferido a fases siguientes)

- **Facturas** (ver / pagar) → Fase 3 (depende de SDD-0021).
- **Documentos** (BL, POD) → Fase 2/3 (Storage).
- **Detalle de envío con timeline** → Fase 2.
- **Perfil del cliente** editable (cambiar email/teléfono) → Fase 2.
- **Modo Cliente** (impersonación admin `?as=`) → Fase 4.
- **Notificaciones push/email** al cliente → Fase 4 (depende SDD-0026/web-push).
- **Self-serve** (cliente pide acceso solo con su email sin invitación admin) → V1.5 (ver open questions).
- **Password** (login con contraseña) → no V1; passwordless magic-link. Supabase cubre el resto.
- **Multi-cliente por persona** (un email que maneja varias empresas/MARKBOX) → V2.
- **2FA** del portal → V2.

---

## 4. Archivos a crear / editar

### Nuevos
```
docs/specs/0042-portal-cliente/spec.md                 (este archivo)
supabase/migrations/0080_portal_cliente.sql
lib/portal/portal-types.ts
lib/portal/portal-queries.ts
app/portal/(auth)/login/page.tsx
app/portal/(auth)/callback/route.ts
app/portal/(app)/layout.tsx
app/portal/(app)/page.tsx
app/portal/_components/{PortalHeader,ShipmentRow,StatusBadge}.tsx
```

### Editados
```
app/studio/(app)/clientes/[markbox]/page.tsx           + sección "Acceso al portal"
app/studio/(app)/clientes/actions.ts                   + invite/revoke portal actions
lib/studio/client-queries.ts                           + getClientPortalAccess
components/Footer.tsx (o Nav.tsx)                       + link "Portal"
docs/architecture/module-sdd-map.md                    + fila Portal del Cliente
```

---

## 5. Decisiones de diseño

### 5.1 Portal = 5ª superficie, no el sitio público
El portal necesita auth + datos reales → vive con el backend (Supabase), como `/m` y `/back`. La frontera dura es *marketing ↔ ERP*; el portal es ERP-adyacente autenticado, no marketing. Así no se rompe ESLint `no-restricted-imports`.

### 5.2 Auth: Supabase Auth passwordless (magic-link) — NO password custom
Reusa la infra que ya existe (`@supabase/ssr`, Resend de SDD-0026). Cero gestión de contraseñas de cliente. El cliente entra con el email que ya tiene en su registro. MARKBOX se **muestra** pero no es credencial.

### 5.3 Aislamiento por helper separado `get_portal_client_id()` (NO tocar el de equipo)
Un cliente jamás tiene row en `user_tenants` → las policies del Studio (filtran por `get_user_tenant_id()`) le devuelven vacío. El portal agrega policies **aditivas** que filtran por `get_portal_client_id()`. **No** se modifica `get_user_tenant_id()` ni la RLS de `user_tenants` (incidente conocido). Dos principales, dos helpers, cero solapamiento.

### 5.4 Alta mediada por admin (invitación), no self-serve — V1
**Por qué:** alineado al modelo de DTD (el admin controla quién es cliente y asigna el MARKBOX) y a la preferencia de exposición controlada del founder. Reusa el patrón probado de SDD-0024 (token + email + claim). Self-serve (cualquiera con un email de cliente pide magic-link) queda para V1.5 si se quiere bajar fricción. **← decisión principal a confirmar en review.**

### 5.5 Read-only para el cliente (V1)
El cliente solo **lee** sus envíos. Cero policies de escritura para el principal-cliente sobre datos operativos. Acciones (cambiar destino, etc.) siguen siendo del Studio. Esto reduce drásticamente la superficie de riesgo de la primera versión.

### 5.6 Layout/route guard propio
`app/portal/(app)/layout.tsx` corta si `getPortalClient()` es null. Defensa en profundidad: aunque un cliente forzara `/studio`, el layout del Studio ya exige membresía de equipo (no la tiene) → rebote. Probar ambos sentidos en aceptación.

### 5.7 Numeración de migración
`0080_` (las últimas en prod son `0078_contabilidad` y `0079_cobranzas`; verificado vía `list_migrations`). Aditiva (tabla + policies nuevas), sin DDL destructivo.

### 5.8 Shipments linkean por `client_markbox` (text), no por `client_id`
El esquema real (`0002_shipments.sql`) referencia al cliente por `client_markbox text` ("DTD-XXXX"), no por FK a `clients.id`. Por eso la RLS del portal sobre `shipments` filtra por markbox vía `get_portal_client_markbox()`. El MARKBOX es único por tenant y hoy hay un solo tenant → alcanza; multi-tenant futuro = el helper de markbox también scopearía por tenant. Migrar shipments a un `client_id` FK es deuda aparte, fuera de este SDD.

---

## 6. Criterios de aceptación

### Funcional
- [ ] `/portal/login` pide email y dispara magic-link (Supabase OTP).
- [ ] Click en el link → sesión → `portal_bind_session()` vincula al cliente correcto → `/portal`.
- [ ] Email sin invitación → "acceso no habilitado", sin ver datos.
- [ ] `/portal` lista **solo** los envíos del cliente logueado, con estado/origen/destino/ETA/código.
- [ ] Admin en `/studio/clientes/[markbox]` ve estado del portal y puede **Invitar** (genera link/email) y **Revocar**.
- [ ] Cliente revocado pierde acceso (próximo request → login).
- [ ] Link "Portal" visible desde el sitio público.

### Sistema / seguridad (lo crítico)
- [ ] `node scripts/verify.mjs` verde (typecheck + build + lint + tests).
- [ ] Migración `0080` corre limpia; `client_users` + helper + policies creados.
- [ ] **RLS aislamiento**: cliente A NO ve envíos del cliente B (test con 2 client_users).
- [ ] **RLS cruzado**: un cliente logueado NO ve NADA del Studio (clients de otros, ningún módulo); un user de equipo NO entra a `/portal` como cliente.
- [ ] `get_portal_client_id()` no rompe ninguna query existente del Studio (las policies viejas siguen igual).
- [ ] El sitio de marketing sigue sin importar Supabase (ESLint frontera verde).
- [ ] Componentes del portal pasan `ui-ux-designer`.
- [ ] BRAND-CHECK: MARKBOX (no "Shipping Mark") de cara al cliente; voseo VE; tokens.

---

## 7. Open questions

### A confirmar en review
- **Alta: mediada (admin invita) vs self-serve (email → magic-link).** Recomendado V1: **mediada** (5.4). Si el founder quiere self-serve desde el arranque, es un cambio chico (quitar el gate de invitación y permitir bind por email-match con cualquier cliente que tenga email). 
- **Link al portal: nav vs footer del sitio público.** Sugerido: nav (acción de cliente recurrente, al lado de Contáctanos) **o** footer si se quiere bajo perfil. Default propuesto: footer + un botón "Portal / Mi cuenta" en el nav.

### Diferidas
- ¿Un email que representa varias empresas (varios MARKBOX)? → V2 (selector de cuenta). V1: 1 cliente ↔ 1 acceso.
- ¿El cliente puede auto-cambiar su email? → no V1 (lo hace el admin; cambiar email = re-invitar).
- ¿Sesión del cliente expira al revocar? → no automático; próximo request detecta status≠active y rebota (igual que 0024 §6).

---

## 8. Plan de implementación por fases

### Fase 1 — Auth + "Mis envíos" (vertical slice mínima) ← arrancamos acá
- Migración `0078` (client_users + helper + RLS + 3 RPCs).
- `lib/portal/{portal-types,portal-queries}.ts`.
- `app/portal/(auth)/{login,callback}` + `app/portal/(app)/{layout,page}` (mis envíos read-only).
- Admin: "Invitar al portal" + "Revocar" en `/studio/clientes/[markbox]` (con fallback de link manual si Mailing OFF).
- Link "Portal" en el sitio público.
- **Sub-fase 1a (mergeable sola, sin UI):** ✅ **HECHA y aplicada a prod (2026-06-02).** Migraciones `0080_portal_cliente` + `0081_portal_harden_grants` aplicadas vía MCP y validadas: rollback-test (corre limpio), **aislamiento probado** (un cliente simulado ve 1/10 envíos y 1/6 clientes, 0 de otros), advisors `anon_security_definer_*` cerrados (anon no ejecuta las funciones del portal). `lib/portal/*` typecheck + lint OK. *(Branching no disponible: el proyecto Vercel-managed no es Pro → validé con rollback-transaction sobre prod.)* **Nota authz:** `portal_invite_client`/`portal_revoke_client` chequean **membresía de tenant** (no rol `admin` estricto) → tightening a admin-only = V1.5.
- **Sub-fase 1b:** ✅ **HECHA (2026-06-02).** Pantallas `/portal` (login magic-link + callback `portal_bind_session` + guard `getPortalClient` blindado vía `get_portal_client_id()` + "mis envíos" read-only), admin "Acceso al portal" (invitar/revocar via RPCs) en `/studio/clientes/[markbox]`, link "Acceder" en nav/footer + cross-links login↔registro. typecheck 0; `getPortalClient` endurecido contra fuga a user de equipo; `ui-ux-designer` sin hallazgos Alta (+ focus-visible global en `.btn`). **⚠️ Setup founder pendiente para que el magic-link funcione:** en Supabase → Auth → habilitar Email provider + agregar `{SITE_URL}/portal/callback` a **Redirect URLs** (+ SMTP/Resend para entrega real de los enlaces; el built-in tiene rate-limit bajo).

### Fase 2 — Detalle de envío (timeline) + documentos (BL/POD) + perfil read.
- **Slice 2.1 — Detalle de envío con timeline de estado (read-only):** ✅ **HECHO (2026-06-02).**
  Ruta `app/portal/(app)/envios/[code]/page.tsx` (server, `notFound()` si el `code` no es del cliente — la RLS `shipments portal self read` por `client_markbox` de la migr 0080 ya lo aísla, **sin migración nueva**). Muestra `code` (mono), StatusBadge, servicio (SERVICE_LABELS), ruta origen→destino, ETA estimada / llegada real (`arrived_destination_at`; `shipments` no tiene columnas ETA/ETD), CBM/peso si existen, y el **timeline de estado**. El `ShipmentRow` de "Mis envíos" ahora linkea a `/portal/envios/[code]`. CTA secundario a WhatsApp del asesor (`buildWhatsAppLink`) + "← Volver a mis envíos".
  - **Reuso del timeline:** la derivación `buildTimeline(status, service)` (pasos done/active/pending/exception según el flow canónico por servicio) **YA existía** en `lib/studio/tracking-progress.ts` (la usa el Studio y conceptualmente el tracking público) — el portal la **reusa tal cual** vía re-export en `lib/portal/portal-types.ts` (el portal está fuera de la frontera ESLint público↔ERP, igual que `app/m/*`, así que importa de `lib/studio` legítimamente). El nuevo componente `PortalTimeline` sólo cambia la PIEL (brand del sitio público: paper/wine/Archivo, tokens `var(--*)`), no la lógica. **NO se tocó** `lib/studio/tracking-progress.ts`.
  - Nuevos: `app/portal/(app)/envios/[code]/page.tsx`, `app/portal/_components/PortalTimeline.tsx`, `lib/portal/__tests__/shipment-detail.test.ts`. Editados: `lib/portal/portal-queries.ts` (+`getMyShipment`), `lib/portal/portal-types.ts` (+`PortalShipmentDetail`, `estimatePortalEta`, re-export del derivador), `app/portal/_components/ShipmentRow.tsx` (link a detalle).
  - Tests Vitest (9): `buildTimeline` para status inicial / intermedio / entregado / exception + flow terrestre corto; `estimatePortalEta` (tránsito → futuro, terminal/ya-en-bodega → null). `node scripts/verify.mjs` VERDE (lint 0 errores, typecheck, 265 tests, docs:check).
- **Slice 2.2 — Mi cuenta / perfil (read-only):** ✅ **HECHO (2026-06-03).**
  Ruta `app/portal/(app)/cuenta/page.tsx` (server). Perfil read-only del cliente logueado: **MARKBOX prominente** (mono, es SU identificador), nombre/empresa, email, teléfono y **dirección/ciudad de entrega**. El cliente NO edita (modelo mediado por admin) → nota "¿algún dato desactualizado? Escribile a tu asesor" + CTA WhatsApp (`buildWhatsAppLink`). **Sin migración** (reusa la RLS del portal 0080: el cliente lee SU fila de `clients` vía `get_portal_client_id()`).
  - **El valor de la página** es la sección "Tu MARKBOX para tus proveedores": explica que el cliente le pasa su MARKBOX al proveedor en China, que lo escribe en cada caja como **Shipping Mark (唛头)**, así la mercancía llega identificada a la bodega de Yiwu. Copy adaptado del paso 03 de `app/registro/page.tsx` + glosario `id "markbox"`. Terminología: de cara al cliente siempre **MARKBOX**; "Shipping Mark" sólo al nombrar lo que hace el proveedor.
  - **Dato nuevo necesario:** la **dirección** del cliente. `getPortalClient` ahora trae `address` (columna `clients.address`, migr 0006 — ya existía, **ninguna migración nueva**) y `PortalClient` suma `address: string|null`. Helper puro nuevo `buildPortalSupplierMark(markbox)` en `portal-types.ts` (la marca que va en la caja ES el MARKBOX, normalizado a mayúsculas/sin espacios; sin prefijos ni PII).
  - **Alcanzable:** link **"Mi cuenta"** en `PortalHeader` (la identidad nombre+MARKBOX y un botón "Mi cuenta" linkean a `/portal/cuenta`, junto a "Cerrar sesión").
  - Nuevos: `app/portal/(app)/cuenta/page.tsx`, `lib/portal/__tests__/account.test.ts`. Editados: `lib/portal/portal-queries.ts` (+`address` en el select de `getPortalClient`), `lib/portal/portal-types.ts` (+`address` en `PortalClient`, +`buildPortalSupplierMark`), `app/portal/_components/PortalHeader.tsx` (+link "Mi cuenta").
  - Tests Vitest (8): `getPortalClient` mapea `address` (fila completa + null-safety cuando el admin no lo cargó) + aislamiento (sin `client_id` del portal → null **sin** consultar `clients`; error de RPC/fila → null); `buildPortalSupplierMark` (la marca ES el MARKBOX, mayúsculas, trim). `node scripts/verify.mjs` VERDE (lint 0 errores, typecheck, 273 tests, docs:check). UI brand-checked (tokens `var(--*)`, radius ≤18px, voseo, MARKBOX-no-"Shipping Mark"); `ui-ux-designer` agendado.
  - **Pendiente del resto de Fase 2:** documentos (BL/POD vía Storage).
### Fase 3 — Facturas (ver) + estado de cuenta (integra SDD-0021).
### Fase 4 — Modo Cliente (impersonación admin) + notificaciones al cliente.

Cada (sub)fase: `node scripts/verify.mjs` verde + commit aislado + `ui-ux-designer` en las visuales.

---

## 9. Fase 5 (Norte) — Inicio/Dashboard del cliente + gate de activación

> Origen: el founder mostró el Norte (`portal/app.jsx` → `PortalHome`) como target ("así debería quedar", 2026-06-02). Trae el **dashboard rico de Inicio** + el **gate de activación**. Se construye **sobre el auth actual (magic-link)**; el cambio a MARKBOX+contraseña+auto-registro es fase fundacional aparte (§9.5). Decisión de sesión: **dashboard primero, auth después**.

### 9.1 Gate de activación (regla founder 2026-06-02)
- El registro self-service da **MARKBOX al instante** (lo necesita para marcar cajas en China YA), pero la cuenta queda **pendiente de revisión**.
- El cliente **puede entrar** (login OK) pero **no ve el dashboard** hasta activarse.
- **Activación = `clients.portal_approved_at IS NOT NULL` OR `(envíos con ese client_markbox) ≥ 1`** (cualquiera de las dos destraba). La primera carga = prueba de cliente real → auto-desbloqueo aunque no se haya revisado.
- No activada → **pantalla de bienvenida/espera** (copy: *"Todavía no puedes ver tu dashboard hasta que un asesor te apruebe o realices tu primera carga."*).
- Schema: migración `0087_portal_approval.sql` → `alter table public.clients add column portal_approved_at timestamptz` + RPC `portal_approve_client(p_client_id)` SECURITY DEFINER (admin del tenant) que lo setea. Sin tocar RLS existente. *(El correlativo real fue **0087**, no 0084 — la spec lo estimó antes de cargar Kommo 0082-0085 + shipment_documents 0086.)*
- Admin: botón **"Aprobar cuenta"** en `PortalAccessCard` (`/studio/clientes/[markbox]`) → llama la RPC. Muestra estado: pendiente / aprobada / (auto-activa por carga).

### 9.2 Slice 5.1 — Gate + pantalla de espera — ✅ HECHO (2026-06-04)
- `lib/portal/portal-queries.ts`: `getPortalActivation(supabase)` → `{ activated: boolean, reason: 'approved' | 'has_shipments' | null }` (resuelve `get_portal_client_id()` para leer `portal_approved_at`; si no, cuenta envíos por markbox vía `portalMarkbox` con `count: 'exact', head: true`).
- `app/portal/(app)/page.tsx` (Inicio): no activada → `<PortalPending>` (holding screen brand-correcto del portal: paper/wine, MARKBOX prominente + copy exacto *"Todavía no puedes ver tu dashboard hasta que un asesor te apruebe o realices tu primera carga."* + CTA WhatsApp al asesor); activada → `<PortalDashboard>` (slice 5.2).
- **Admin:** botón **"Aprobar cuenta"** (variant `dark`) en `PortalAccessCard` → `approvePortalAction` → RPC `portal_approve_client`. Badge de estado **Pendiente / Aprobada** (con fecha). El card explica que también se desbloquea sola con la primera carga.
- **Routing:** `(app)/page.tsx` pasó a ser Inicio; la lista "Mis envíos" se reubicó a `(app)/envios/page.tsx` (funcionalidad intacta; el detalle `envios/[code]` ya existía). `PortalNav` ahora: **Inicio · Mis envíos · Facturas · Documentos · Cuenta**.
- **Acceptance:** cliente sin aprobar y sin envíos → ve espera; al aprobarlo el admin **o** al crearle 1 envío → ve dashboard. Tests Vitest del gate (`activation.test.ts`, 4 casos: pendiente, aprobado, con-envíos, principal no-cliente).
- Nuevos: `supabase/migrations/0087_portal_approval.sql`, `app/portal/_components/PortalPending.tsx`, `app/portal/(app)/envios/page.tsx`, `lib/portal/__tests__/activation.test.ts`. Editados: `lib/portal/portal-queries.ts` (+`getPortalActivation`), `lib/portal/portal-types.ts` (+`PortalActivation`, +`TERMINAL_SHIPMENT_STATUSES`/`isActiveShipmentStatus`), `app/portal/(app)/page.tsx`, `app/portal/_components/PortalNav.tsx`, `app/studio/(app)/clientes/actions.ts` (+`approvePortalAction`), `app/studio/(app)/clientes/_components/PortalAccessCard.tsx`, `app/studio/(app)/clientes/[markbox]/page.tsx`, `lib/studio/client-queries.ts` (+`getClientPortalApprovedAt`).

### 9.3 Slice 5.2 — Inicio/Dashboard (con la data que SÍ existe) — ✅ HECHO (2026-06-04)
- `<PortalDashboard>` (`app/portal/(app)/_components/PortalDashboard.tsx`) con los widgets del Norte, **piel del portal** (paper/wine + clases del sitio público, sólo `var(--*)`; el PortalHome del Norte es referencia de LAYOUT, no de tipografía — NO se introdujo Sora/Nunito nuevo). Queries `getDashboardKpis` + `getNextArrival` en `portal-queries.ts` (reusan `listMyShipments`/`listMyInvoices`, filtrado por markbox). Saludo fecha es-VE + "Hola {primer nombre}" + "{N} envíos activos · {M} factura(s) pendiente(s)". 4 KPIs (activos no-terminal · entregados YTD · facturado Σ no-borrador moneda dominante · saldo Σ total−paid). "Próximo arribo" DEGRADADO (code/ruta/estado/ETA; SIN contenedor/buque/progreso/mapa = Tier 1 Naviera) ocultando lo ausente; preview 4 envíos (reusa `ShipmentRow`) + "Ver todos" → `/portal/envios`; card "Saldo pendiente" → `/portal/facturas`; card "Tu asesor" DEGRADADO (sin `clients.advisor_id` → contacto público CRM WhatsApp, TODO marcado). Botones "Nueva compra"/"Nueva cotización" presentes pero deshabilitados ("Próximamente" = slices 5.6/5.7). Tests Vitest `dashboard.test.ts` (KPIs + nextArrival, monedas mixtas, aislamiento).
- (Detalle original del slice abajo.)
- El Inicio del portal (`/portal`) con los widgets del Norte:
  - Saludo: fecha es-VE + "Hola {primer nombre}", "{N} envíos activos · {M} factura(s) pendiente(s)".
  - **4 KPIs:** Envíos activos (status no terminal) · Entregados YTD (`delivered` del año) · Facturado (Σ `total_amount` de invoices no-`borrador`) · Saldo pendiente (Σ `total_amount − paid_amount`).
  - **Card "Próximo arribo" (DEGRADADO):** próximo envío activo (code, ruta origen→destino, estado, ETA estimada vía `estimatePortalEta`). ⚠️ **Sin** contenedor `DTDU-…`/buque/progreso%/mapa animado — eso es **Tier 1 Naviera/Container (no construido)**; el card oculta lo ausente y no inventa data. Cuando llegue Naviera, se enriquece.
  - **"Tus envíos"** preview (3-4, link a Mis envíos + al detalle).
  - **Saldo pendiente** + botón "Ver facturas".
  - **Card "Tu agente" (DEGRADADO):** no hay campo asesor-asignado → usa el contacto único público (CRM WhatsApp `+58 412 166 8021`) hasta que exista `clients.advisor_id`. *(TODO marcado.)*
- Queries nuevas en `lib/portal/portal-queries.ts`: `getDashboardKpis`, `getNextArrival`. Reusa `listMyShipments` / `listMyInvoices`.
- Botones "Nueva compra" / "Nueva cotización" presentes pero a placeholder/"próximamente" (son slices 5.6/5.7).
- **Brand:** el portal es capa **sistema** del Norte → seguir guardrails (`var(--*)`, fuentes del sistema). Pasar por `ui-ux-designer` antes del commit.
- **Acceptance:** con DTD-1007 + 1 envío + 1 factura seed, los 4 KPIs cuadran, el card de próximo arribo muestra el envío, el preview lista, el saldo sale de invoices. `node scripts/verify.mjs` verde.

### 9.4 Slices siguientes (no en 5.1/5.2)
- **5.3** Tus proveedores · **5.4** Referidos · **5.5** Soporte · **5.6** "Nueva compra" (prealerta) · **5.7** "Nueva cotización". Cada uno su slice con verify+review.

### 9.5 Fuera de scope (fase fundacional aparte, §futuro)
- **Cambio de login a MARKBOX + contraseña** + **auto-registro 3 pasos** (datos + foto cédula/RIF → dirección VE → confirma, con MARKBOX secuencial automático) + "¿olvidaste tu contraseña?". Reemplaza el magic-link. Es lo que dispara el estado "pendiente" del gate de forma orgánica. Hoy, sin auto-registro, el "pendiente" se simula: admin invita → cuenta sin aprobar → espera hasta aprobar/primera carga.
- "Próximo arribo" completo (contenedor/buque/ETA real/progreso/mapa) → depende de **Tier 1 Naviera/Container**.
- Dedup/validación de identidad en el alta (RIF requerido + único) → SDD chico aparte.

---

## 10. Fase 6 — Registro self-service + auth MARKBOX/contraseña

> Decisión founder 2026-06-03 (reemplaza el magic-link como modelo principal). Referencia Norte: `docs/design/studio/_norte/portal/registro.jsx` (4 pasos) + `app.jsx` `PortalLogin`.

### 10.0 Decisiones fijadas
- ~~**Cuenta ACTIVA al registrarse** — el gate de Fase 5 queda EN STAND-BY; el registro setea `clients.portal_approved_at = now()` → el cliente entra directo.~~ → **REVERTIDO 2026-06-04 (ver §10.5).** La cuenta nace **PENDIENTE** (el registro NO setea `portal_approved_at`) → el gate de Fase 5 vuelve a estar ACTIVO: el cliente entra y ve `PortalPending` hasta que un asesor apruebe o llegue su 1ª carga. Reinstaura la regla founder original de §9.1 (2026-06-02).
- **Login = MARKBOX + contraseña.** Cédula (persona) / RIF (empresa) = **contraseña inicial**. Cambio de clave **OPCIONAL** (no forzado).
- **Email de bienvenida SIN la clave** (solo MARKBOX + instrucciones + link).
- **Identidad: foto de cédula/RIF OBLIGATORIA** (upload) + **revisión MANUAL** del asesor. CNE automático = diferido.
- **Dedup por cédula/RIF** (no duplicar clientes).
- **Superficie:** todo en `app/portal/(auth)/` (Supabase-backed). El público enlaza con `<Link href="/portal/registro">` (navegación, no import → no viola la frontera).

### 10.1 Slice — Registro self-service + cuenta activa — ✅ HECHO (2026-06-05)
- **Implementado** vía el harness `/feature` (implement→verify, gate VERDE). Form multi-paso `app/portal/(auth)/registro/{page.tsx,RegisterForm.tsx,actions.ts}` (4 pasos Datos+foto / Dirección VE / Confirmar / Listo) con la **estética real del portal** (paper/white card + `btn-primary` + JetBrains Mono scoped para códigos — NO el inline-style/Sora del Norte JSX, que es referencia de LAYOUT). `registerClientAction` corre TODO con **admin client** (el registrante es anónimo → bypass RLS para insert clients/client_users + upload de foto). Cuenta queda ACTIVA (`portal_approved_at = now()`), MARKBOX al instante, password inicial = cédula/RIF. Welcome email reusa `sendWelcomeEmail` (template `welcome_markbox`, que YA es sin-clave: sólo markbox + portal_link). Pantalla "Listo" muestra MARKBOX + Usuario(=MARKBOX)/Contraseña(=cédula, "recomendado cambiar") + "Ir al portal".
  - **Desvíos del plan (decisiones de implementación):**
    1. **Migración fue `0091_portal_self_register.sql`** (no "siguiente estimado" — los libres saltaban a 0091 tras 0090_comments). Aditiva: `clients.cedula_photo_path text` + bucket privado `client-docs` (8MB, imágenes) + storage RLS espejando `shipment-docs` (0086): service_role escribe (el alta sube con service_role), admin del tenant lee/borra por `tenant_id`=1er segmento del path, cero anon/público. **NO aplicada a prod.**
    2. **`tier` = `'regular'`, no `'standard'`** — el enum `client_tier` (0006) es `regular|vip|premium`; no existe `'standard'`. Se usa `'regular'` (el default de la tabla). *(La spec decía 'standard'; corregido al enum real.)*
    3. **Dedup contra `clients.rif`** — el módulo Clientes guarda el documento (cédula O RIF) en la columna `rif`. El alta normaliza el documento a canónico (`V-12345678` / `J-12345678-9`) y compara `ilike("rif", doc.toLowerCase())` scopeado al tenant. La cédula se persiste también en `rif` (consistente con el seed de 0006, que mete `V-12345678` en `rif`).
    4. **Foto OBLIGATORIA, entregada y funcionando** (sube a `client-docs` con path `{tenant}/{markbox}/{uuid}.{ext}`, rollback si falla el insert). La **revisión admin** de la foto sigue siendo trabajo futuro (§10.3).
    5. **Side-effects best-effort**: si `createUser` falla porque el email ya tiene cuenta de auth, el cliente IGUAL queda creado con MARKBOX → warning "entrá con tu MARKBOX o recuperá la clave"; el alta no se rompe. Idem el welcome email.
  - Nuevos: `supabase/migrations/0091_portal_self_register.sql`, `app/portal/(auth)/registro/{page,RegisterForm,actions}.tsx/.ts`, `lib/portal/register-types.ts`, `lib/portal/__tests__/register.test.ts`. Editado: `app/portal/(auth)/login/LoginForm.tsx` (link "Creá tu cuenta" → `/portal/registro`).
  - Tests Vitest (`register.test.ts`): validación persona/empresa, normalización del documento (=password) canónico, dedup case-insensitive colapsa el mismo doc, `composeAddress`.
- **(Diseño original del slice, abajo.)** **`app/portal/(auth)/registro/`** — form multi-paso (estética del portal, reusa componentes):
  - **Paso 1 DATOS:** tipo persona/empresa · nombre (+ razón social si empresa) · cédula/RIF (mono) · **foto cédula/RIF (upload obligatorio)** · email (obligatorio) · WhatsApp (obligatorio) · tel. oficina (opcional). **Dedup en vivo** por documento.
  - **Paso 2 DIRECCIÓN VE:** cascada estado→municipio→ciudad→CP→barrio→dirección (reusa **`lib/data/venezuela-catalog.ts`**) + referencia (opcional).
  - **Paso 3 CONFIRMAR** · **Paso 4 LISTO:** muestra MARKBOX + Usuario(=MARKBOX) / Contraseña(=cédula, "recomendado cambiar") + "Ir al portal". *(2026-06-04: el copy AHORA SÍ dice **"cuenta en revisión"** — gate reactivado, §10.5. El MARKBOX igual va en las cajas ya.)*
- **Server action `registerClientAction`** (`app/portal/(auth)/registro/actions.ts`):
  1. valida (validate*Input propio, no Zod) → 2. **dedup** (clients por `lower(cedula/rif)` del tenant; si existe → error + opción recuperar/reset) → 3. resolver **tenant** (el único operativo de DTD; multi-tenant signup = futuro) → 4. `rpc('next_markbox', {p_tenant_id})` → 5. subir foto a **Storage privado** → 6. insert `clients` **activo** (`portal_approved_at = now()`, tier 'standard') → 7. `auth.admin.createUser({ email, password: cedula, email_confirm: true })` (patrón de `app/invitar/[token]/actions.ts`) → 8. insert `client_users` (auth_user_id, status 'active', email, markbox) → 9. **welcome email SIN clave** (reusa el mailing existente) → devuelve markbox.
- **Migración** (correlativo siguiente libre): `alter table clients add column if not exists cedula_photo_path text` + bucket privado de Storage `client-docs` (insert en `storage.buckets`) + policies (`storage.objects`: admin del tenant lee; cero acceso público/anon). Patrón de storage ya existe (expenses receipt / bug replays).
- **Tests:** dedup bloquea doc repetido · registro crea client activo + markbox + client_users active · password = cédula.

### 10.2 Slice — Login MARKBOX + contraseña — ✅ HECHO (2026-06-05)
- **Implementado.** `app/portal/(auth)/login/{LoginForm,actions}.ts(x)`: el form **MARKBOX + contraseña** es ahora el método **primario** (el magic-link por email quedó como alternativa colapsable). `loginWithMarkbox`: lookup `email` por markbox → `signInWithPassword` (cookies SSR vía server client) → `redirect("/portal")` server-side en éxito. Errores **genéricos** ("MARKBOX o contraseña incorrectos") tanto si el markbox no existe como si la clave falla (anti-enumeración). **"¿Olvidaste tu contraseña?"** (`resetPasswordByMarkbox`) pide el MARKBOX y manda `resetPasswordForEmail` al correo asociado; responde SIEMPRE "revisá tu correo" sin revelar si existe.
- **Lookup extraído a `lib/portal/portal-queries.ts` (`lookupEmailByMarkbox`)** — query pura `(SupabaseClient, markbox) → email|null` (sólo `client_users` con `status='active'`, embebe `clients!inner(markbox)`, normaliza markbox a mayúsculas). La server action le pasa el admin client (el lookup es pre-sesión). Hacerla pura la vuelve testeable con el stub estándar de la suite (sin `vi.mock`, que el repo no usa).
- **Cambio de contraseña OPCIONAL** desde "Mi cuenta": `changePortalPasswordAction` (`app/portal/actions.ts`, `auth.updateUser({password})`, mín. 8 chars + confirmación) + `ChangePasswordCard` (colapsable) en `app/portal/(app)/cuenta/page.tsx`. No forzado: la clave inicial (cédula/RIF) vale indefinidamente.
  - Nuevos: `app/portal/(app)/cuenta/ChangePasswordCard.tsx`. Editados: `app/portal/(auth)/login/{LoginForm.tsx,actions.ts}` (+`loginWithMarkbox`/`resetPasswordByMarkbox`), `app/portal/actions.ts` (+`changePortalPasswordAction`), `app/portal/(app)/cuenta/page.tsx` (+card), `lib/portal/portal-queries.ts` (+`lookupEmailByMarkbox`).
  - Tests Vitest (`login-markbox.test.ts`): lookup markbox→email (filtros `status=active` + `clients.markbox`), normaliza a mayúsculas, markbox inexistente/vacío/error → null (→ error genérico aguas arriba).
- **⚠️ Setup founder pendiente para el E2E real:** Supabase → Auth → SMTP/Resend para que los emails (welcome, reset, magic-link) entreguen + `{SITE_URL}/portal/callback` en Redirect URLs (ya pedido en Fase 1b; el reset y el magic-link lo necesitan). El login MARKBOX+contraseña NO depende de email para entrar.
- **(Diseño original del slice, abajo.)**
- **`app/portal/(auth)/login/`** — agregar form **MARKBOX + contraseña** (primario). Server action: lookup `email` por `markbox` (admin client, clients por markbox) → `signInWithPassword(email, password)` → cookies SSR. **"¿Olvidaste tu contraseña?"** → reset por email (Supabase `resetPasswordForEmail`). Mantener el magic-link existente como alternativa/fallback.
- **Cambio de contraseña OPCIONAL** desde "Mi cuenta" (`updateUser({password})`), no forzado.
- **Tests:** lookup markbox→email · login OK con cédula · markbox inexistente → error genérico.

### 10.3 Fuera de scope (próximo / a planear)
- **Vista admin "clientes nuevos / revisión"** (CRM: cómo llegó el lead + interés) + **botón "Verificar con CNE"** (corresponde / no corresponde / página caída) → se PLANEA aparte (idea founder 2026-06-03). ~~La aprobación admin NO es gate (el cliente ya está activo)~~ → **2026-06-04: la aprobación admin SÍ ES el gate** (§10.5): el botón "Aprobar cuenta" (que ya existe en `PortalAccessCard`) destraba el dashboard del cliente pendiente.
- **CNE automático** (consulta on-demand, sin hostear el padrón).
- ~~Reconciliar el público `app/registro/` (lead) con el `/portal/registro` (cuenta real)~~ → **✅ HECHO 2026-06-04 (§10.5)**: el `/registro` público funnelea al `/portal/registro` real.

### 10.4 Slice — Anti-abuso del registro público (honeypot + throttle por IP) — ✅ HECHO (2026-06-03)
> Decisión founder 2026-06-03: el endpoint `/portal/registro` está LIVE y es público (registrante anónimo, corre con service_role). Anti-abuso **gratis, sin keys, sin fricción** para usuarios reales. Scope acotado: **solo** honeypot + throttle por IP en DB (sin Turnstile/captcha — diferido).

Dos capas que corren **antes del trabajo pesado** en `registerClientAction`:
- **Honeypot** — `RegisterForm.tsx` tiene un campo trampa oculto `name="empresa_web"` (off-screen `left:-9999px`, `tabIndex=-1`, `autoComplete="off"`, `aria-hidden` — NO `display:none`, que algunos bots detectan). Un humano nunca lo llena; un bot naive sí. La action lee el campo **primero de todo**: si llega no-vacío → **early return** `{ error: "No pudimos procesar tu registro. Probá de nuevo." }` genérico (no revela la trampa) **SIN escribir nada** (ni clients, ni auth, ni storage, ni throttle).
- **Throttle por IP** — después de validar input + honeypot y de tener el admin client, antes de `next_markbox`/upload/inserts: lee la IP de `headers()` (`x-forwarded-for`[0] → `x-real-ip` → `"unknown"`), cuenta los intentos de esa IP en la última hora en `portal_registro_throttle`; si llegó al límite (**`REGISTRO_IP_LIMIT = 5` / `REGISTRO_WINDOW_MINUTES = 60`**, consts tuneables arriba del archivo) → `{ error: "Demasiados registros desde tu conexión. Probá de nuevo en un rato." }` sin crear nada. Si está por debajo → inserta la fila del intento y sigue el flujo normal. **Fail-open**: un error de lectura del throttle NO bloquea un alta legítima.
- **Migración `0094_portal_registro_throttle.sql`** (aditiva, NO aplicada a prod): tabla `public.portal_registro_throttle` (`id uuid` / `ip text` / `created_at timestamptz`) + índice `(ip, created_at)` para el conteo por ventana. **Tabla privilegiada**: RLS **habilitada SIN policy** → cero acceso anon/authenticated; solo service_role la toca (bypassa RLS), espejando el patrón de buckets privados sin policy de INSERT pública. **Sin `tenant_id`** a propósito: el throttle es pre-cuenta (el cliente todavía no tiene tenant/MARKBOX) y la IP es global al endpoint público.
- Editados: `app/portal/(auth)/registro/{actions.ts,RegisterForm.tsx}`. Nuevos: `supabase/migrations/0094_portal_registro_throttle.sql`, `app/portal/(auth)/registro/__tests__/register-antiabuse.test.ts`.
- Tests Vitest (`register-antiabuse.test.ts`): honeypot lleno → rechazo benigno + CERO writes (no clients/createUser/upload/throttle); throttle `>= LIMIT` → rechazo sin writes (consulta el throttle pero no inserta el intento ni hace trabajo pesado); `< LIMIT` → registra el intento y procede (next_markbox + upload + insert clients). Mock de `next/headers` para la IP + fake admin client (sin red ni DB).

### 10.5 Gate reactivado + reconciliación del `/registro` público — ✅ HECHO (2026-06-04)

> **Decisión founder 2026-06-04 (supersede la de 2026-06-03 "cuenta activa", §10.0).** Reinstaura el gate de
> activación de §9.1 (2026-06-02) para el registro self-service + conecta el `/registro` público con el flujo real.
> **Sin migración** (solo comportamiento + copy). Gate verde · `ui-ux-designer` OK.

**1 · El gate vuelve a gatear** (`app/portal/(auth)/registro/actions.ts`): el insert de `clients` **ya NO setea
`portal_approved_at = now()`** → la cuenta nace **PENDIENTE**. `getPortalActivation()` (Fase 5.1) resuelve `null` →
`{activated:false}` → el cliente entra (login MARKBOX+contraseña OK) y ve `PortalPending` (que ya existía, escrito para
este modelo) hasta que un asesor pulse **"Aprobar cuenta"** (`approvePortalAction`/`portal_approve_client`, ya existentes)
**o** llegue su 1ª carga (auto-desbloqueo por `≥1 envío`). Copy alineado: `RegisterForm` Paso 3 (confirmar) y Paso 4
(Listo) dicen **"cuenta en revisión"** en vez de "activa", con nota de que el MARKBOX ya sirve para las cajas. Los tests
del registro no asertaban `portal_approved_at` → siguen verdes.

**2 · El `/registro` público funnelea al flujo real** (`app/registro/page.tsx`): el form **mock**
(`components/RegistroForm.tsx`, que generaba un `DTD-REG` falso + handoff de WhatsApp y **no persistía nada**) se
**eliminó**; en su lugar un **CTA** ("Empezar registro" → `<Link href="/portal/registro">`) + "Acceder" → `/portal/login`.
Copy del explainer/hero/metadata actualizado al modelo self-service ("MARKBOX al instante · cuenta en revisión"). El
sitio público **no toca Supabase** (frontera): solo navega por URL al `/portal/registro` (superficie Supabase-backed). Cierra
el pendiente de §10.3.

---

## Diseño (referencia)
Mockups del Norte vigente (Cloud Design v2.4): `docs/design/studio/_norte/Portal del Cliente.html`, `Portal Cliente Mobile.html`, `Modo Cliente.html`. El dashboard de Fase 5 = `docs/design/studio/_norte/portal/app.jsx` (`PortalHome`/`PortalTopbar`). Tokens/branding: `BRAND.md` + `lib/shared/shipment-public.ts` (labels/colores de estado, fuente única público↔ERP).
