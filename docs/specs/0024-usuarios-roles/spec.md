---
sdd: "0024"
title: "DoorTuDoor — Usuarios & Roles V1 simple (invitaciones + 6 roles globales)"
status: done
author: "founder"
created: 2026-05-24
updated: 2026-06-02
supersedes: null
superseded_by: null
related: ["0001", "0007", "0020", "0025", "0026"]
confidencialidad: interno
---

# DTD-0024 — Usuarios & Roles · V1 simple

> **Gestión de usuarios del Studio.** Reemplaza el `EmptyState` de
> `/studio/usuarios` por una tabla CRUD con invitaciones por email,
> 6 roles globales por tenant (Admin/Comercial/Operaciones/Contabilidad/
> Bodeguero/Soporte) y soft disable. Sin permisos por módulo, sin
> scope por almacén — eso es V1.5+ cuando aparezca caso real.

---

## 1. Resumen en una línea

`/studio/usuarios` lista los miembros del tenant del usuario logueado
con su rol + status + último login, permite invitar nuevos via email
(token + expira en 7 días), cambiar rol inline, desactivar (soft) y
ver detalle con perfil + audit de cambios. Roles son globales por
tenant: enforced via CHECK constraint en `user_tenants.role`.

---

## 2. Scope

### Incluye

#### Schema (migración 0019)

- 1 enum:
  - `studio_user_role`: `admin` / `commercial` / `operations` /
    `accounting` / `warehouse` / `support`

- ALTER en tabla existente `user_tenants`:
  - ADD CHECK constraint para que `role` solo acepte valores del enum
    (no se convierte a enum directo para no perder backward-compat con
    valores existentes — el CHECK se valida + un migration update
    normaliza valores actuales).
  - ADD `disabled_at timestamptz` (soft disable a nivel de tenant; el
    user puede estar activo en otro tenant).
  - ADD `last_login_at timestamptz` (actualizado via trigger
    `on_auth_login`).
  - ADD `invited_by uuid references auth.users(id)` (quién lo invitó).

- 2 tablas nuevas:
  - **`user_profiles`** (extensión de auth.users, 1:1):
    user_id uuid PK references auth.users on delete cascade,
    first_name text, last_name text,
    avatar_url text, phone text, position_label text (ej: "Gerente Comercial"),
    locale text default 'es-VE',
    timezone text default 'America/Caracas',
    created_at, updated_at

  - **`user_invitations`** (RLS por tenant):
    id uuid PK, tenant_id uuid FK, email text NOT NULL (lower-case),
    role studio_user_role NOT NULL,
    token text NOT NULL UNIQUE (32 chars random url-safe),
    invited_by uuid FK NOT NULL,
    expires_at timestamptz NOT NULL (now() + 7 days),
    accepted_at timestamptz, accepted_by uuid FK auth.users,
    revoked_at timestamptz, revoked_by uuid FK auth.users,
    created_at,
    UNIQUE(tenant_id, email) WHERE accepted_at IS NULL AND revoked_at IS NULL

- 3 RPCs:
  - `studio_invite_user(p_email, p_role)` → `{ invitation_id, token }`
    · Solo admins del tenant pueden invitar
    · Email se normaliza a lower-case
    · Genera token random 32 chars url-safe
    · Si ya existe invitation pendiente al mismo email + tenant,
      devuelve la existente (no duplica)
    · Falla si el email ya es miembro activo del tenant

  - `studio_accept_invitation(p_token, p_first_name, p_last_name)` →
    `{ user_id, tenant_id, role }`
    · Lookup invitation por token, valida no expirada ni revocada
    · El user que llama (auth.uid()) NO puede ser el invited_by (no se
      auto-invita)
    · Crea row en user_profiles si no existe
    · Crea row en user_tenants con role + invited_by de la invitation
    · Marca invitation como accepted_at = now(), accepted_by = auth.uid()

  - `studio_change_user_role(p_target_user_id, p_new_role)` → bool
    · Solo admins del tenant pueden cambiar roles
    · No se puede degradar al ÚLTIMO admin del tenant (evita lockout)
    · Audit log a tabla `studio_audit_log` (si existe, sino skip)

- Trigger:
  - `on_auth_login_update_last_login` — actualiza
    `user_tenants.last_login_at = now()` para todos los rows del user
    cuando hay nuevo login (handler en `auth.sessions` insert).

- RLS:
  - `user_profiles`: SELECT a authenticated (todos ven todos los
    perfiles dentro del mismo tenant — útil para mostrar avatar+nombre
    en cualquier UI). UPDATE solo el dueño (`user_id = auth.uid()`).
    INSERT solo via trigger o RPC accept_invitation. DELETE bloqueado.
  - `user_invitations`: SELECT a authenticated del tenant (RLS por
    tenant_id). INSERT solo via RPC. UPDATE solo via RPC (accept/revoke).
    DELETE bloqueado.
  - `user_tenants`: SELECT del propio user O admin del tenant ven todo.
    INSERT solo via RPC accept_invitation. UPDATE solo via RPC
    change_role o admin desactivando. DELETE bloqueado (usar
    disabled_at).

- Seed: si no hay rows en `user_tenants` con role='admin' en algún
  tenant, NO sembramos automáticamente — eso es setup manual del
  founder (similar a KEK del No-Olvidar). El primer user del tenant viene
  via signup directo con metadata `tenant=dtd-cargo` + role='admin'
  hardcoded en trigger de Studio Shell.

#### Lib types + queries

- `lib/studio/user-types.ts`:
  - 1 enum `StudioUserRole` + LABELS castellano-VE
  - Types: `UserProfile`, `UserTenantMembership`, `UserMembershipWithProfile`,
    `UserInvitation`
  - badgeTone helpers por role
  - Validators: `validateInviteUserInput` (email + role), `validateProfileInput`
  - Helpers: `roleLabel`, `roleBadgeTone`, `roleDescription`

- `lib/studio/user-queries.ts`:
  - `listMembers(supabase, filters?)` — join user_tenants + user_profiles + auth.users (email), filtros por role/disabled/search
  - `getMember(supabase, userId)`
  - `getUserProfile(supabase, userId)`
  - `listInvitations(supabase, filters?)` — pending/accepted/revoked
  - `getInvitationByToken(supabase, token)` — para endpoint público de accept
  - `computeUserKpis(supabase)` — total_members, active_members, pending_invitations, admins_count

#### Endpoint público

- `app/api/studio/users/accept-invitation/route.ts`:
  - POST `{ token, first_name, last_name, password }`
  - Lookup invitation por token (sin auth, es público pero requiere
    token válido)
  - Crea user en auth.users via supabase.auth.admin.createUser
  - Llama RPC studio_accept_invitation
  - Redirect a `/studio/login` con success
  - Errores: 400 token inválido / expirado / revocado, 409 email ya
    registrado, 500 runtime

#### Pages (`app/studio/(app)/usuarios/`)

- `page.tsx` — REFACTOR del placeholder: server component con:
  - Header con título + botón "Invitar usuario"
  - KPIs row (4 cards)
  - Tabs (`?tab=members|invitations`)
  - Default `members`
  - Tab Members: tabla con avatar + nombre + email + rol badge + status + último login + acciones (cambiar rol / desactivar)
  - Tab Invitations: tabla con email + rol + invited_by + expires + status + acciones (reenviar / revocar)

- `app/(public)/invitar/[token]/page.tsx` — landing pública de
  invitación. Carga la invitation, muestra "Te invitó {invited_by} a
  unirte a DTD-Cargo como {role}. Aceptá creando tu cuenta.", form
  con nombre + apellido + password, submit a endpoint.

#### Components (`app/studio/(app)/usuarios/_components/`)

- `UserKpisRow.tsx` (server) — 4 KPI cards
- `MembersTable.tsx` (client — necesita interactividad inline para
  cambiar rol)
- `InviteUserDrawer.tsx` (client) — form: email + role select + send
- `InvitationsTable.tsx` — tabla + acciones revoke/reuse link
- `MemberRowActions.tsx` (client) — dropdown con "Cambiar rol" /
  "Desactivar" / "Ver perfil"
- `RoleBadge.tsx` — wrapper de Badge con tono por role

#### Server actions (`usuarios/actions.ts`)

- `inviteUserAction(prev, formData)` — RPC studio_invite_user +
  send email con link `/invitar/[token]` via mail (si SDD-0026 está
  implementado, sino solo devuelve token para que admin lo comparta
  manual)
- `changeUserRoleAction(userId, newRole)` — RPC + revalidate
- `disableUserAction(userId)` — UPDATE user_tenants SET disabled_at =
  now()
- `enableUserAction(userId)` — UPDATE disabled_at = NULL
- `updateProfileAction(prev, formData)` — UPDATE user_profiles del
  user logueado (no de otros)
- `revokeInvitationAction(invitationId)`
- `reissueInvitationLinkAction(invitationId)` — re-genera token con
  nuevo expires

#### Sidebar
- **Sin cambios.** "Usuarios" ya existe en `StudioSidebar.tsx:57`.

#### Env y deps
- NO nuevas deps (todo con stdlib + Supabase + crypto.randomBytes para token)
- NO env vars nuevas

### NO incluye (diferidos)

- **Permisos por módulo** (matriz role × módulo con read/write/approve)
  → V1.5 si aparece caso real
- **Scope por almacén** (Bodeguero CN solo ve almacén CN) → V1.5
- **2FA TOTP** para login del Studio → V2 (el No-Olvidar tiene su propio
  2FA en SDD-0025)
- **SSO / OAuth** (Google / Microsoft) → V2 cuando se abra a tenants
  externos
- **Audit log granular** de cambios (quien cambió qué rol cuándo) →
  V1.5 cuando esté tabla `studio_audit_log` global
- **Bulk invite** (import CSV de N emails) → backlog
- **Magic link login** (passwordless) → V2
- **Custom roles** por tenant → backlog mayor
- **Group/teams** (subgrupos dentro del tenant) → backlog
- **Activity feed por user** (qué hizo cada user en últimos 30d) → V2
  cuando esté audit log global
- **Anti-impersonation** para soporte ("login como otro user para
  debuggear") → backlog con consideraciones de seguridad
- **Recuperación de password olvidada** ya está cubierta por Supabase
  Auth nativo (`auth.resetPasswordForEmail`)

---

## 3. Archivos a crear / editar

### Nuevos

```
docs/specs/0024-usuarios-roles/spec.md                  (este archivo)
supabase/migrations/0019_users_roles.sql
lib/studio/user-types.ts
lib/studio/user-queries.ts
app/studio/(app)/usuarios/actions.ts
app/studio/(app)/usuarios/_components/
├── UserKpisRow.tsx
├── MembersTable.tsx
├── InviteUserDrawer.tsx
├── InvitationsTable.tsx
├── MemberRowActions.tsx
└── RoleBadge.tsx
app/api/studio/users/accept-invitation/route.ts
app/(public)/invitar/[token]/page.tsx
```

### Editados

```
app/studio/(app)/usuarios/page.tsx                       REFACTOR del EmptyState
```

---

## 4. Decisiones de diseño

### 4.1 Roles globales por tenant (no por módulo)

**Por qué:** simplicidad operacional. El founder tiene 6-12 empleados,
no 600. Cada uno tiene UN rol que define qué puede hacer. Matriz
role × módulo es overkill V1 — empuja complejidad sin ganancia real.

Cuando aparezca un caso ("este comercial no debería ver márgenes",
"este bodeguero no debería ver tarifas"), abrir V1.5 con la matriz.
Mientras tanto, los 6 roles cubren el modelo organizacional actual.

### 4.2 6 roles enumerados (no custom)

**Por qué:** los nombres en castellano-VE están alineados al
organigrama actual (Admin, Comercial, Operaciones, Contabilidad,
Bodeguero, Soporte). Custom roles requieren UI extra + complejidad
en RLS dinámica. No vale V1.

### 4.3 CHECK constraint en lugar de enum

**Por qué:** la tabla `user_tenants` ya existe con `role text` y
datos reales. ALTER text → enum requiere DROP + CREATE columna, lo
cual rompe los datos existentes momentáneamente. CHECK constraint es
backward-compat y idempotente.

```sql
ALTER TABLE user_tenants
  ADD CONSTRAINT user_tenants_role_check
  CHECK (role IN ('admin', 'commercial', 'operations',
                  'accounting', 'warehouse', 'support'));
```

Pre-CHECK: UPDATE existing rows si tienen `role` que no matchea (ej:
'Admin' con mayúscula → 'admin').

### 4.4 Invitations con token + email (no signup abierto)

**Por qué:** sin invitación, cualquiera con un signup form puede
crear cuenta y ver datos del tenant. Invitations garantizan que solo
gente autorizada por un admin se une.

Flow:
1. Admin clickea "Invitar" → form email + role
2. Server crea row en user_invitations + envía email con link
   `/invitar/[token]`
3. Invitado abre link → ve "Te invitó X como Y, creá tu cuenta"
4. Submit del form → crea user en auth.users + ejecuta accept_invitation
5. User puede loginear con sus credenciales nuevas + queda con role
   pre-asignado

Token: 32 chars url-safe (`crypto.randomBytes(24).toString('base64url')`),
expira en 7 días, single-use.

### 4.5 Soft disable per-tenant (no per-user)

**Por qué:** un user puede estar activo en tenant A y desactivado en
tenant B (caso multi-tenant futuro). Disabling a nivel de auth.users
es nuclear.

V1: `user_tenants.disabled_at` per-membership. El login en Supabase
sigue funcionando, pero al resolver tenant si `disabled_at IS NOT
NULL` → redirect a página "Tu acceso fue desactivado por un admin".

Enable: setear `disabled_at = NULL`.

### 4.6 No se puede degradar al último admin (anti-lockout)

**Por qué:** si todos los admins son degradados a otro rol, nadie
puede invitar/gestionar usuarios y el tenant queda atrapado.

RPC `studio_change_user_role` chequea:
```sql
IF p_new_role <> 'admin' AND (
  SELECT count(*) FROM user_tenants
  WHERE tenant_id = (current admin's tenant)
    AND role = 'admin' AND disabled_at IS NULL
) <= 1 THEN
  raise exception 'No se puede degradar al último admin del tenant';
END IF;
```

Similar protección para `disable_user_action` si target es último
admin.

### 4.7 user_profiles separado de user_tenants

**Por qué:** un user puede estar en N tenants (V2) pero su perfil
personal (nombre, avatar, idioma preferido) es uno solo. Separar
evita duplicación + permite cambiar perfil sin tocar membresías.

V1 single-tenant: igual mantenemos la separación para evitar refactor
después.

### 4.8 last_login_at via trigger en auth.sessions

**Por qué:** queremos mostrar "Último login: hace 2h" en la tabla
sin queries pesadas a `auth.sessions` cada vez.

Trigger después de INSERT en `auth.sessions`:
```sql
UPDATE public.user_tenants
SET last_login_at = NEW.created_at
WHERE user_id = NEW.user_id;
```

Si el user está en N tenants, actualiza todos sus rows. Es OK V1
(actividad real = login).

### 4.9 Endpoint accept-invitation público (sin auth)

**Por qué:** quien acepta la invitación todavía no tiene cuenta. El
endpoint público es la única forma de crear su user + assignar tenant
en una sola transacción.

Mitigaciones contra abuse:
- Token de 32 chars random (no enumerable)
- Token single-use (accepted_at se setea)
- Expira 7 días
- Rate limit por IP (V1.5)

### 4.10 Email de invitación via SDD-0026

**Por qué:** ya tenemos Mailing en pipeline. El email es plantilla
`team_invitation` (que sumo al seed de SDD-0026 cuando se implemente).

V1: si SDD-0026 todavía no está corriendo, el `inviteUserAction`
loggea el link en consola + lo devuelve al admin en UI para que lo
comparta manual via WhatsApp/email externo.

---

## 5. Criterios de aceptación

### Funcional

- [ ] `/studio/usuarios` carga con tabla de members + tab invitations + botón "Invitar usuario"
- [ ] KPIs: total members, active, pending invitations, admins count
- [ ] Tabla members: avatar + nombre + email + role badge wine si admin / info si commercial / warning si ops / success si accounting / neutral resto + status badge + último login formateado
- [ ] Filtro por role + search en nombre/email funciona
- [ ] Botón "Invitar usuario" abre drawer con form email + role select (6 opciones)
- [ ] Submit crea invitation + devuelve link (si Mailing OFF) o envía email (si Mailing ON)
- [ ] Tab Invitations muestra pending/accepted/revoked con acciones revoke + reissue
- [ ] Cambiar rol inline desde dropdown (RoleSelect en MemberRowActions)
- [ ] Degradar al último admin del tenant tira error 409 con mensaje claro
- [ ] Desactivar user pone disabled_at + el user al loguearse ve mensaje "Acceso desactivado"
- [ ] Endpoint público `/api/studio/users/accept-invitation` con token válido + form crea user + assigna role
- [ ] Token inválido / expirado / ya usado devuelve 400 con mensaje específico
- [ ] Email duplicado (ya tiene cuenta) devuelve 409 con sugerencia "Iniciá sesión con esa cuenta"
- [ ] `last_login_at` se actualiza al loguearse (verificable refrescando la tabla después de login con otra cuenta)

### Sistema

- [ ] `pnpm typecheck` exit 0
- [ ] `pnpm build` pasa
- [ ] `pnpm lint` pasa
- [ ] Migración 0019 corre limpia en Supabase + CHECK constraint funciona
- [ ] RLS: user de tenant A no ve members de tenant B
- [ ] RLS: user no-admin no puede invitar (RPC tira error 42501)
- [ ] RLS: invitation token único previene duplicados
- [ ] Trigger last_login_at funciona post-login
- [ ] RPC change_role bloquea degrade del último admin
- [ ] Componentes pasan revisión por agente `ui-ux-designer`
- [ ] BRAND-CHECK: castellano-VE, sentence case en CTAs, badges en 6 tonos oficiales

---

## 6. Out of scope / open questions

### Out V1 (cubierto en sección 2)

Permisos por módulo, scope por almacén, 2FA Studio, SSO/OAuth, audit
log granular, bulk invite, magic link, custom roles, groups/teams,
activity feed por user, impersonation, change-password (Supabase Auth
nativo).

### Open questions resueltas

- ✅ Granularidad → V1 simple (decisión founder 2026-05-24)
- ✅ Custom roles → no V1 (los 6 cubren organigrama actual)
- ✅ CHECK constraint vs enum → CHECK (backward-compat con datos existentes)
- ✅ Invitations vs signup abierto → invitations only
- ✅ Disable per-tenant vs per-user → per-tenant
- ✅ Anti-lockout último admin → RPC check
- ✅ Email vía SDD-0026 (Mailing) con fallback de link manual si Mailing no está activo

### Open questions diferidas

- **¿Qué pasa si el user invitado ya tiene cuenta en otro tenant?**
  V1: el accept-invitation falla con 409 y le dice "ya tenés cuenta,
  pedile a admin que te assigne via UI" (que admin haga UPDATE
  user_tenants ADD row). V2 si crece: flow de "joinear tenant
  existente con cuenta existente".

- **¿Disabled user puede aceptar nueva invitation al mismo tenant?**
  V1: sí, accept_invitation hace UPSERT en user_tenants con
  `disabled_at = NULL`. Es reactivación.

- **¿Expira la sesión del user cuando lo desactivan?**
  V1: NO automáticamente. Próximo refresh / API call detecta
  `disabled_at IS NOT NULL` y forza logout. Si urgente, admin puede
  llamar Supabase Auth admin API para revocar sesiones (V1.5).

- **¿Quién ve perfiles de quién?**
  V1: todos los authenticated del tenant ven todos los perfiles (para
  mostrar avatar+nombre en cualquier UI). Si privacidad importa
  (V1.5), agregar `private` flag.

---

## 7. Plan post-SDD-0024

**SDD-0024.1** — Cuando aparezca caso real:
- Permisos por módulo (matriz)
- Scope por almacén
- 2FA TOTP para login del Studio

**Integración con SDD-0026** (Mailing):
- Template `team_invitation` con vars `{{invited_by_name}}` /
  `{{role}}` / `{{tenant_name}}` / `{{accept_url}}`
- Rule auto-send en evento `user_invited` (cuando llegue SDD-0021)

**Integración con SDD-0025** (No-Olvidar):
- El campo `no_olvidar_user_keys.role` (member/admin) ya existe y es
  independiente del rol del Studio. Un user puede ser Comercial en
  el Studio pero admin del No-Olvidar, o viceversa.

---

## 8. Plan de implementación por fases

### Fase 1 — Schema + Types + Queries (sin UI)

- Migración 0019_users_roles.sql
- lib/studio/user-types.ts
- lib/studio/user-queries.ts

Mergeable solo. NO incluye UI ni server actions. Cubre el 50% del SDD
y permite que otros módulos consuman roles/profiles si los necesitan.

### Fase 2 — UI + Server Actions + Endpoint público

- app/studio/(app)/usuarios/page.tsx (refactor)
- actions.ts (7 server actions)
- 6 componentes
- Endpoint `/api/studio/users/accept-invitation`
- Página pública `/invitar/[token]`

### Fase 3 — Wiring con Mailing (depende de SDD-0026 Fase 2/3)

- Agregar template `team_invitation` al seed de mailing
- `inviteUserAction` llama `sendEmail({ templateSlug: 'team_invitation', ... })`
- Si Mailing falla, fallback al return manual del link

Cada fase typecheck + commit aislado.
