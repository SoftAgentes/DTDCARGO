---
sdd: "0004"
title: "DoorTuDoor — Fase 1: Studio shell + Auth"
status: done
author: "founder"
created: 2026-05-23
updated: 2026-05-23
supersedes: null
superseded_by: null
related: ["0003"]
---

# DTD-0004 — Fase 1: Studio shell + Auth

> **Depende de SDD-0003** (arquitectura DoorTuDoor). Este es el primer slice implementable.

---

## 1. Resumen en una línea

Studio backend mínimo navegable: instalar deps Supabase, correr migración inicial de tenancy, montar layout aislado del sitio público en `/studio`, login con email+password, y dashboard placeholder vacío. **Cero módulos funcionales todavía** — eso viene en SDD-0005 (Tracking).

---

## 2. Scope

### Incluye
- Instalar `@supabase/supabase-js` + `@supabase/ssr` en `package.json`
- Migración `0001_init_tenancy.sql` (tablas `tenants` + `user_tenants` + helper function + RLS + seed tenant DTD)
- Seed local: crear 1 admin user vía Supabase Auth (vos)
- Clientes Supabase: `lib/db/client.ts` (browser) + `lib/db/server.ts` (SSR)
- Auth helpers: `lib/auth/session.ts` + `middleware.ts` (guard de `/studio/**`)
- Layout aislado: `app/studio/layout.tsx` + `app/studio/studio.css`
- Página de login: `app/studio/(auth)/login/page.tsx` con form server action
- Layout autenticado: `app/studio/(app)/layout.tsx` (sidebar + topbar)
- Dashboard placeholder: `app/studio/(app)/resumen/page.tsx` (vacío con mensaje "agregá envíos en Tracking")
- Página placeholder Ajustes: `app/studio/(app)/ajustes/page.tsx` (vacío)

### NO incluye (SDDs futuros)
- Módulo Tracking (envíos + estados + dashboard real) → SDD-0005
- Reset password flow → SDD-0006 o cuando sea necesario
- Realtime → diferido
- Multi-tenant UI (selector de tenant, switching) → DTD es único tenant, no se necesita
- Roles avanzados → solo "admin" por ahora
- i18n → solo español

---

## 3. Cambios en `package.json` (zona frontera, justificado)

Agregar a `dependencies`:
```json
"@supabase/supabase-js": "^2.45.0",
"@supabase/ssr": "^0.5.0"
```

**Justificación commit:** ambas son deps backend para DoorTuDoor (SDD-0004). No tocan deps del sitio público. Payload deps se mantienen aunque dormidas.

---

## 4. Migración Supabase — `supabase/migrations/0001_init_tenancy.sql`

```sql
-- ─────────────────────────────────────────────────────────────
-- SDD-0004 Fase 1: tenancy mínimo para DoorTuDoor
-- ─────────────────────────────────────────────────────────────

-- Tabla tenants: empresas que usan el ERP. DTD es la primera.
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  display_name text not null,
  brand_primary text not null default '#7F0F1A',
  brand_secondary text not null default '#0F1E3D',
  base_currency text not null default 'USD',
  created_at timestamptz not null default now()
);

comment on table public.tenants is 'Empresas que usan el ERP. Cada una es un tenant aislado por RLS.';

-- Asociación user ↔ tenant. Hoy es 1:1, preparada para N:M en HailuWay.
create table public.user_tenants (
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  role text not null default 'admin',
  created_at timestamptz not null default now(),
  primary key (user_id, tenant_id)
);

comment on table public.user_tenants is 'Membresía de usuarios en tenants. Role granular vendrá en SDDs futuros.';

-- Helper: devuelve el tenant_id del usuario actual (cacheable en SQL stable)
create or replace function public.get_user_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id
  from public.user_tenants
  where user_id = auth.uid()
  limit 1;
$$;

comment on function public.get_user_tenant_id is
  'Helper para RLS policies. Devuelve el tenant_id del usuario autenticado (uno solo por ahora).';

-- RLS: nadie ve nada hasta que se escriba policy explícita (failclosed)
alter table public.tenants enable row level security;
alter table public.user_tenants enable row level security;

create policy "users see their tenant"
  on public.tenants for select
  to authenticated
  using (id = public.get_user_tenant_id());

create policy "users see their own user_tenants"
  on public.user_tenants for select
  to authenticated
  using (user_id = auth.uid());

-- Seed: tenant DTD (el único hoy)
insert into public.tenants (slug, display_name)
values ('dtd', 'DTD·CARGO')
on conflict (slug) do nothing;
```

---

## 5. Estructura de archivos a crear (12 nuevos)

```
package.json                              [editar — agregar 2 deps]

supabase/
├── migrations/
│   └── 0001_init_tenancy.sql             [nuevo]
└── config.toml                           [nuevo, autogenerado por supabase init]

lib/
├── db/
│   ├── client.ts                         [nuevo] createBrowserClient
│   └── server.ts                         [nuevo] createServerClient con cookies
├── auth/
│   └── session.ts                        [nuevo] getSession() helper
└── studio/
    └── (vacía por ahora, se llena en SDD-0005)

middleware.ts                             [nuevo] guard /studio/** sin sesión → /studio/login

app/
└── studio/
    ├── layout.tsx                        [nuevo] layout raíz Studio, NO importa globals.css
    ├── studio.css                        [nuevo] CSS scope propio del Studio
    ├── (auth)/
    │   └── login/
    │       ├── page.tsx                  [nuevo] form login
    │       └── actions.ts                [nuevo] server action signIn
    └── (app)/
        ├── layout.tsx                    [nuevo] sidebar + topbar + auth guard
        ├── page.tsx                      [nuevo] redirect a /studio/resumen
        ├── resumen/
        │   └── page.tsx                  [nuevo] dashboard placeholder vacío
        └── ajustes/
            └── page.tsx                  [nuevo] placeholder vacío
```

**Total: 13 archivos nuevos + 1 editado (package.json).** Cero archivos del sitio público tocados.

---

## 6. Pasos de implementación (orden)

1. **Instalar deps**: `pnpm add @supabase/supabase-js @supabase/ssr`
2. **Verificar build no rompe**: `pnpm build` + `pnpm typecheck`
3. **Crear migración** `supabase/migrations/0001_init_tenancy.sql`
4. **Aplicar migración al Supabase cloud**:
   - Opción A: copiar el SQL y pegarlo en Supabase Studio → SQL Editor → Run
   - Opción B: instalar Supabase CLI local + `supabase db push` (más limpio, recomendado a futuro)
   - **Para MVP-0 usamos Opción A** — más rápida, sin instalar CLI
5. **Crear admin user**: Supabase Studio → Authentication → Users → Add user → "Create new user" con tu email + password. Confirmar email manual (o usar "Auto Confirm User" toggle).
6. **Crear membresía DTD ↔ user** en SQL Editor:
   ```sql
   insert into public.user_tenants (user_id, tenant_id, role)
   select u.id, t.id, 'admin'
   from auth.users u, public.tenants t
   where u.email = 'TU_EMAIL_AQUI' and t.slug = 'dtd';
   ```
7. **Crear archivos backend**: `lib/db/client.ts`, `lib/db/server.ts`, `lib/auth/session.ts`, `middleware.ts`
8. **Crear UI Studio**: `app/studio/layout.tsx`, `studio.css`, login + actions, layout app, resumen, ajustes
9. **Verificar aislamiento**: `pnpm dev` → ir a `/`, `/calculadora`, `/cotizar`, `/servicios`, `/contacto`, `/track/TEST123` → todo se ve **idéntico** que antes
10. **Verificar Studio**: ir a `/studio` → redirige a `/studio/login` → logueás con tu user → ves layout autenticado con sidebar
11. **Commit**: 1 commit con prefijo `feat(studio):` o varios atómicos (`feat(db):`, `feat(auth):`, `feat(studio):`)

---

## 7. Criterios done (acceptance)

- [ ] `pnpm build` y `pnpm typecheck` pasan
- [ ] Sitio público (`/`, `/calculadora`, `/cotizar`, etc.) **se ve idéntico** antes y después
- [ ] Ir a `/studio` sin sesión redirige a `/studio/login`
- [ ] Login con email+password de Supabase funciona, redirige a `/studio/resumen`
- [ ] El layout del Studio NO hereda estilos del sitio (fondos, fuentes, colores propios)
- [ ] El sidebar muestra: Resumen / Tracking / Ajustes (Tracking y Ajustes pueden ser placeholders)
- [ ] El dashboard de Resumen muestra mensaje "Empezá agregando envíos en Tracking (próximamente)"
- [ ] Logout funciona y devuelve a `/studio/login`
- [ ] En SQL Editor: `select * from public.tenants` devuelve 1 fila (DTD); `select * from public.user_tenants` devuelve 1 fila (tu usuario ↔ DTD)
- [ ] Probar RLS: lograrte de la SDK con anon key + `select * from tenants` → devuelve solo el tenant DTD (no leak)

---

## 8. Riesgos específicos de Fase 1

| Riesgo | Mitigación |
|---|---|
| `@supabase/ssr` cambió mucho en últimas versiones — código viejo de internet rompe | Pinear `^0.5.0` y seguir docs oficiales para Next.js 15+/16 con App Router |
| Middleware corre en Edge — algunos imports server-only fallan ahí | Mantener `middleware.ts` mínimo: solo verifica cookie de sesión Supabase, redirige si no existe. Lógica pesada en server components |
| El layout del Studio termina heredando estilos del sitio sin querer | Test manual: abrir DevTools en `/studio/login`, inspeccionar `body` y ver que las fuentes y colores son los del Studio, no del sitio |
| Crear el admin user manualmente desde Supabase Studio puede ser cumbersome | Documentar en este spec los 2 SQLs exactos: crear user + crear membresía |
| Conflicto entre Payload deps viejas y nuevas Supabase deps | Test: `pnpm build` debe pasar. Si hay conflicto de versions, hacer ajustes en SDD aparte |

---

## 9. Lo que viene (preview de SDD-0005)

Una vez aprobado y mergeado SDD-0004:
- **SDD-0005 — Tracking module:** migración `0002_shipments.sql` con enums + tablas, CRUD de envíos, dashboard con KPIs reales leyendo de `shipments`, máquina de estados por servicio, seed de 5-10 envíos sintéticos cubriendo los 4 servicios comerciales.

Después:
- SDD-0006 — conexión `/track/[code]` del sitio público al backend (requiere autorización extra)
- SDD-0007 — Calculadora editor (factores volumétricos editables)
- SDD-0008 — Mailing
- SDD-0009 — Portal Cliente con MARKBOX login

---

## 10. La asignación (Fase 1)

Cuando este SDD esté `approved`:

1. Yo te paso turno por turno cada uno de los 13 archivos nuevos con código listo para pegar (rutas explícitas).
2. Vos los pegás y corrés `pnpm install` cuando toque.
3. Al final, juntos verificamos los criterios done de sec. 7.

El primer turno arranca con: `pnpm add @supabase/supabase-js @supabase/ssr` + crear el archivo `supabase/migrations/0001_init_tenancy.sql`.
