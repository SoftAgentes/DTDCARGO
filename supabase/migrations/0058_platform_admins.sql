-- ─────────────────────────────────────────────────────────────
-- 0058 · platform_admins (SDD-0037 Fase 1 · arrancado en Paso 0)
--
-- Rol de PLATAFORMA — ortogonal al rol del tenant. Un usuario puede ser
-- platform_admin (opera el SaaS, vendor HailuWay) Y admin de su tenant a
-- la vez (hoy Sam es ambos, dogfooding). NO se agrega al enum
-- StudioUserRole porque no es un rol más DENTRO del tenant: es una
-- dimensión cross-tenant.
--
-- Solo los platform_admins:
--   - ven el grupo PLATAFORMA en el sidenav de /studio/admin
--   - gestionan AI keys, model routing, debug, errores, bugs cross-tenant
--   - ven la franja dorada "MODO PLATAFORMA"
--
-- Gestión de la tabla: SOLO service_role (bootstrap + futuras altas vía
-- server action con admin client). El authenticated NO puede escribir
-- (un platform_admin no se auto-promueve por SQL del cliente).
-- ─────────────────────────────────────────────────────────────

create table if not exists public.platform_admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  granted_at  timestamptz not null default now(),
  granted_by  uuid references auth.users(id),
  notes       text
);

comment on table public.platform_admins is
  'Operadores de la plataforma (vendor HailuWay). Ortogonal al rol del tenant. Gestión solo service_role. SDD-0037.';

alter table public.platform_admins enable row level security;

-- SELECT: solo un platform_admin puede leer la tabla (incluido verse a sí mismo).
create policy "platform_admins_self_select" on public.platform_admins
  for select to authenticated
  using (
    exists (
      select 1 from public.platform_admins pa
      where pa.user_id = (select auth.uid())
    )
  );

-- service_role full (evita el gap force_rls sin policy — ver memoria
-- service_role_rls_gap). INSERT/UPDATE/DELETE de authenticated: sin policy
-- → negado por RLS. La gestión vive en service_role.
create policy "service_role_all_platform_admins" on public.platform_admins
  for all to service_role using (true) with check (true);

grant select on public.platform_admins to authenticated;
grant all on public.platform_admins to service_role;

-- ─── Helper para RLS de otras tablas (provider_credentials, etc.) ────
-- security definer + search_path=public: solo toca tablas de public,
-- no necesita qualifier de extensions.
create or replace function public.is_platform_admin()
  returns boolean
  language sql
  security definer
  stable
  set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins where user_id = (select auth.uid())
  );
$$;

grant execute on function public.is_platform_admin() to authenticated;

-- ─── Seed: primer platform_admin ─────────────────────────────
-- hailuway.com@gmail.com (user_id resuelto en Paso 0) = vendor / founder.
insert into public.platform_admins (user_id, notes)
values (
  '83c98d22-ea54-4d7a-b10f-a23098a2edbe',
  'Bootstrap inicial — founder / vendor HailuWay (Paso 0 SDD-0037)'
)
on conflict (user_id) do nothing;
