---
sdd: "0042"
title: "Portal del Cliente — auth de cliente + mis envíos (V1)"
status: in-progress
author: "founder"
created: 2026-06-02
updated: 2026-06-02
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
### Fase 3 — Facturas (ver) + estado de cuenta (integra SDD-0021).
### Fase 4 — Modo Cliente (impersonación admin) + notificaciones al cliente.

Cada (sub)fase: `node scripts/verify.mjs` verde + commit aislado + `ui-ux-designer` en las visuales.

---

## Diseño (referencia)
Mockups del Norte vigente (Cloud Design v2.4): `docs/design/studio/_norte/Portal del Cliente.html`, `Portal Cliente Mobile.html`, `Modo Cliente.html`. Tokens/branding: `BRAND.md` + `lib/shared/shipment-public.ts` (labels/colores de estado, fuente única público↔ERP).
