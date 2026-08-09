-- ─────────────────────────────────────────────────────────────
-- 0357 · SDD-0252 · Matriz de permisos editable en DB
--
-- QUÉ RESUELVE: la matriz rol×módulo (`PermissionsSection.tsx`, SDD-0124) es
-- de sólo lectura, derivada 100% de `ROLE_MODULE_ACCESS` en código. SDD-0139
-- descartó formalmente volverla editable en DB, pero dejó cláusula de
-- reapertura: "revisar recién con el primer pedido real del founder, como
-- spec propia". Ese pedido llegó el 2026-08-07.
--
-- DISEÑO: la tabla SÓLO guarda DESVÍOS del default de código. Fila ausente =
-- aplica `ROLE_MODULE_ACCESS` tal como está hoy → tabla vacía = cero cambio
-- de comportamiento (mismo criterio que 0354 con los tokens de acceso).
--
-- EL CANDADO DE GOBERNANZA SE MUEVE A LA DB COMO INVARIANTE EJECUTABLE, igual
-- que ya lo es en TypeScript (`rbac.test.ts`, SDD-0139): un CHECK en la tabla
-- Y una validación explícita en el RPC rechazan cualquier `module_id` de
-- MONEY_MODULES ∪ ADMIN_ONLY_MODULES (`lib/studio/rbac.ts`). Doble capa a
-- propósito — si algún día alguien inserta directo con el admin client
-- (bypassa el RPC), el CHECK igual lo frena.
--
-- ⚠️ La lista de módulos candado está DUPLICADA acá y en `rbac.ts`
-- (`LOCKED_MODULES`). Es el mismo trade-off que ya aceptó 0355 (roles fijados
-- en 5 lugares de la base): mover el candado a un solo lugar cruzando
-- TypeScript↔SQL no es posible sin una función que lea `rbac.ts` en runtime.
-- `rbac.test.ts` es la fuente que ambas listas tienen que seguir — si se
-- agrega un módulo a MONEY_MODULES/ADMIN_ONLY_MODULES, esta migración necesita
-- una hermana que actualice el CHECK.
--
-- Sólo por ROL, no por usuario — los overrides por usuario siguen descartados
-- por SDD-0139 y exigen una spec propia que la supersede.
-- ─────────────────────────────────────────────────────────────

do $preflight$
begin
  if to_regclass('public.tenants') is null then
    raise exception '0357 requiere public.tenants';
  end if;
  if to_regclass('public.user_tenants') is null then
    raise exception '0357 requiere public.user_tenants';
  end if;
end;
$preflight$;

create table if not exists public.studio_role_module_overrides (
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  role        text not null,
  module_id   text not null,
  can_view    boolean not null default false,
  can_edit    boolean not null default false,
  updated_by  uuid references auth.users(id),
  updated_at  timestamptz not null default now(),
  primary key (tenant_id, role, module_id),
  constraint studio_role_module_overrides_role_check
    check (role in ('commercial', 'operations', 'accounting', 'warehouse', 'support', 'marketing')),
  -- Candado de gobernanza (SDD-0139), capa 1 de 2 — ver docstring de arriba.
  constraint studio_role_module_overrides_locked_check
    check (module_id not in (
      -- MONEY_MODULES
      'invoices', 'accounting', 'collections', 'treasury', 'fiscal', 'costing', 'reports', 'nomina',
      -- ADMIN_ONLY_MODULES
      'users', 'admin', 'direccion', 'renditions', 'financiero-china', 'legal', 'no-olvidar', 'mailing'
    )),
  -- Editar implica ver — igual semántica que `canEditModule` en TypeScript.
  constraint studio_role_module_overrides_edit_implies_view
    check (not can_edit or can_view)
);

comment on table public.studio_role_module_overrides is
  'Desvíos del default de ROLE_MODULE_ACCESS (rbac.ts), SÓLO por rol — SDD-0252. Fila ausente = aplica el default de código. Escritura únicamente vía studio_set_role_module_access(); authenticated no tiene INSERT/UPDATE/DELETE directo.';

create index if not exists studio_role_module_overrides_tenant_idx
  on public.studio_role_module_overrides (tenant_id);

alter table public.studio_role_module_overrides enable row level security;

-- Lectura: cualquier autenticado del tenant (la UI de la matriz y el gate real
-- necesitan leerla; es metadata de permisos, no un secreto).
grant select on public.studio_role_module_overrides to authenticated;
create policy studio_role_module_overrides_read_by_tenant
  on public.studio_role_module_overrides
  for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()));

-- Escritura: SOLO el RPC (security definer) y service_role. Sin policy de
-- escritura para authenticated → RLS activa sin política = negado, igual que
-- 0354 con los tokens de acceso.
create policy studio_role_module_overrides_service_role_all
  on public.studio_role_module_overrides
  for all to service_role using (true) with check (true);

revoke insert, update, delete on public.studio_role_module_overrides from public, anon, authenticated;
grant all on public.studio_role_module_overrides to service_role;

-- ─── RPC: studio_set_role_module_access ───────────────────────
-- Admin del tenant (mismo nivel que hoy abre /studio/admin — NO se sube a
-- superadmin: 0355 fue deliberadamente chica y esto vive dentro del módulo
-- `admin`, ya admin-only). Guarda el par (view, edit) EXACTO como override,
-- incluido (false, false) — es una revocación explícita, distinta de "sin
-- override" (fila ausente = default de código). Volver al default es
-- `studio_reset_role_module_access`, un RPC aparte.
create or replace function public.studio_set_role_module_access(
  p_role text,
  p_module_id text,
  p_can_view boolean,
  p_can_edit boolean
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tenant_id uuid := public.get_user_tenant_id();
  v_actor uuid := auth.uid();
  v_actor_role text;
begin
  if v_tenant_id is null then
    raise exception 'Sin membership activo' using errcode = '42501';
  end if;

  select role into v_actor_role
  from public.user_tenants
  where user_id = v_actor and tenant_id = v_tenant_id and disabled_at is null;
  if v_actor_role is distinct from 'admin' then
    raise exception 'Solo admins pueden editar la matriz de permisos' using errcode = '42501';
  end if;

  if p_role not in ('commercial', 'operations', 'accounting', 'warehouse', 'support', 'marketing') then
    raise exception 'Rol inválido para la matriz: %', p_role using errcode = '22023';
  end if;

  -- Candado de gobernanza, capa 2 de 2 — mensaje explícito antes que el
  -- usuario se tope con la violación cruda del CHECK.
  if p_module_id in (
    'invoices', 'accounting', 'collections', 'treasury', 'fiscal', 'costing', 'reports', 'nomina',
    'users', 'admin', 'direccion', 'renditions', 'financiero-china', 'legal', 'no-olvidar', 'mailing'
  ) then
    raise exception 'Ese módulo tiene candado de gobernanza — no se edita desde la matriz' using errcode = '42501';
  end if;

  if p_module_id is null or length(p_module_id) < 1 or length(p_module_id) > 64 then
    raise exception 'p_module_id inválido' using errcode = '22023';
  end if;

  -- (p_can_view, p_can_edit) = (false, false) SÍ se guarda tal cual: es un
  -- override real y explícito ("este rol NO ve este módulo aunque el default
  -- de código lo conceda"), distinto de "sin fila" (aplica el default). Para
  -- volver al default se usa `studio_reset_role_module_access`, no esto.
  insert into public.studio_role_module_overrides
    (tenant_id, role, module_id, can_view, can_edit, updated_by, updated_at)
  values
    (v_tenant_id, p_role, p_module_id, p_can_view, p_can_edit, v_actor, now())
  on conflict (tenant_id, role, module_id) do update
    set can_view = excluded.can_view,
        can_edit = excluded.can_edit,
        updated_by = excluded.updated_by,
        updated_at = now();

  return true;
end;
$function$;

grant execute on function public.studio_set_role_module_access(text, text, boolean, boolean) to authenticated;

-- ─── RPC: studio_reset_role_module_access ─────────────────────
-- Borra el override y vuelve al default de código — separado de
-- `studio_set_role_module_access` a propósito: (false,false) es un override
-- real (revocar por debajo del default), NO es sinónimo de "sin override".
create or replace function public.studio_reset_role_module_access(
  p_role text,
  p_module_id text
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tenant_id uuid := public.get_user_tenant_id();
  v_actor uuid := auth.uid();
  v_actor_role text;
begin
  if v_tenant_id is null then
    raise exception 'Sin membership activo' using errcode = '42501';
  end if;

  select role into v_actor_role
  from public.user_tenants
  where user_id = v_actor and tenant_id = v_tenant_id and disabled_at is null;
  if v_actor_role is distinct from 'admin' then
    raise exception 'Solo admins pueden editar la matriz de permisos' using errcode = '42501';
  end if;

  delete from public.studio_role_module_overrides
  where tenant_id = v_tenant_id and role = p_role and module_id = p_module_id;

  return true;
end;
$function$;

grant execute on function public.studio_reset_role_module_access(text, text) to authenticated;

-- ─── Postcondiciones ─────────────────────────────────────────
do $post$
begin
  if to_regclass('public.studio_role_module_overrides') is null then
    raise exception '0357: la tabla no quedó creada';
  end if;

  if not exists (
    select 1 from pg_tables
    where schemaname = 'public' and tablename = 'studio_role_module_overrides' and rowsecurity
  ) then
    raise exception '0357: la RLS no quedó activa';
  end if;

  if has_table_privilege('authenticated', 'public.studio_role_module_overrides', 'INSERT') then
    raise exception '0357: authenticated no debe poder INSERT directo en la tabla';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'studio_set_role_module_access'
  ) then
    raise exception '0357: no quedó el RPC studio_set_role_module_access';
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'studio_reset_role_module_access'
  ) then
    raise exception '0357: no quedó el RPC studio_reset_role_module_access';
  end if;
end;
$post$;
