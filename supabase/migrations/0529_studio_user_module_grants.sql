-- ─────────────────────────────────────────────────────────────
-- 0529 · SDD-0622 · Accesos adicionales por persona (rol base + extras)
--
-- QUÉ RESUELVE: cada persona tiene un solo rol (`user_tenants.role`) y la
-- matriz rol×módulo (`lib/studio/rbac.ts`, desvíos por rol de la 0357) no
-- permite darle a UNA persona un módulo que su rol no trae. Caso real: alguien
-- de contabilidad que además atiende el CRM.
--
-- DISEÑO (SDD-0622 §5.1):
--   · `studio_user_module_grants`: una fila por (tenant, persona, módulo) con
--     ver / ver y editar, motivo obligatorio y vencimiento opcional. SOLO SUMA:
--     nunca quita lo que el rol ya da.
--   · Escritura únicamente por `studio_grant_user_module` y
--     `studio_revoke_user_module_grant` (security definer). authenticated no
--     tiene INSERT/UPDATE/DELETE. Lee la propia persona y el admin del tenant.
--   · Módulos sensibles (dinero ∪ solo-administrador = LOCKED_MODULES de
--     rbac.ts) SÍ se conceden, con doble aviso: la RPC exige
--     `p_confirm_sensitive = true` y la versión de la lista de efectos que vio
--     quien concede; la tabla repite el candado con un CHECK sobre
--     `sensitive_confirmed_at`. El CHECK de la 0357 (desvíos por rol) NO se toca.
--   · R1 (decisión del Director con la propuesta de la spec): concede sólo el
--     rol `admin` de la base; nadie se concede extras a sí mismo; un extra sobre
--     `users`/`admin` es de sólo lectura efectiva (la RPC no acepta edición).
--   · R2: los 4 módulos del superadministrador sólo los concede quien cumple
--     `is_platform_admin()`; el receptor sigue pasando el segundo candado (la
--     0355/0356 y `rbac-guard.ts` no cambian).
--   · Las capabilities (`CAPABILITIES` de rbac.ts) no se conceden por aquí.
--
-- REVOCAR = BORRAR LA FILA, con evento de auditoría. Se eligió borrar y no una
-- columna `revoked_at` porque: (1) la PK (tenant, persona, módulo) sigue
-- significando «lo que esta persona tiene hoy», sin filtros que olvidar en cada
-- lectura (la del gate, la de la RLS y la de `user_has_module`); (2) el rastro
-- completo —quién, cuándo, motivo, permisos antes— queda en `entity_audit_log`,
-- que es append-only (0267) y es donde el Studio ya busca la historia; (3)
-- volver a conceder es un upsert limpio. Un extra VENCIDO no se borra: queda
-- visible para el filtro «vencidos» de la pantalla y deja de contar solo.
--
-- `user_has_module(p_module, p_edit)`: la decisión efectiva en SQL, con el
-- mismo orden que `canAccessModule`/`canEditModule` (§5.2): admin → rol (desvío
-- por rol o default de código) → extra vigente; `support` nunca edita; el scope
-- de almacén (0202) se aplica encima. La matriz default está DUPLICADA aquí
-- (`studio_module_default_roles`), igual que el candado de la 0357: la prueba
-- `lib/studio/__tests__/user-module-grants.migration.test.ts` compara este
-- archivo con `ROLE_MODULE_ACCESS`, `LOCKED_MODULES` y
-- `SUPERADMIN_ONLY_MODULES` para que no se desincronicen.
--
-- No toca datos: tabla nueva y vacía = cero cambio de comportamiento.
-- ─────────────────────────────────────────────────────────────

do $preflight$
begin
  if to_regclass('public.tenants') is null
     or to_regclass('public.user_tenants') is null
     or to_regclass('public.studio_role_module_overrides') is null
     or to_regclass('public.audit_entity_types') is null
     or to_regclass('public.entity_audit_log') is null then
    raise exception '0529 requiere tenants, user_tenants, studio_role_module_overrides (0357), audit_entity_types (0258) y entity_audit_log';
  end if;
  if pg_catalog.to_regprocedure('public.get_user_tenant_id()') is null
     or pg_catalog.to_regprocedure('public.is_tenant_admin()') is null
     or pg_catalog.to_regprocedure('public.is_platform_admin()') is null
     or pg_catalog.to_regprocedure(
       'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
     ) is null then
    raise exception '0529 requiere get_user_tenant_id(), is_tenant_admin(), is_platform_admin() y append_audit_event (0294)';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid = 'public.user_tenants'::regclass
      and attname = 'warehouse_scope' and not attisdropped
  ) then
    raise exception '0529 requiere user_tenants.warehouse_scope (0202)';
  end if;
  if to_regclass('public.studio_user_module_grants') is not null then
    raise exception '0529 no aplica: studio_user_module_grants ya existe';
  end if;
end;
$preflight$;

-- ─── 1. Catálogo de módulos en SQL (copia de rbac.ts) ──────────────────────
-- Default de código: roles NO-admin que ven cada módulo. null = módulo
-- desconocido (falla cerrado). `[]` = solo admin.
create function public.studio_module_default_roles(p_module_id text)
returns text[]
language sql
immutable
security invoker
set search_path = ''
as $$
  select v.roles
  from (values
    ('dashboard', array['commercial', 'operations', 'accounting', 'warehouse', 'support', 'marketing']::text[]),
    ('shipments', array['commercial', 'operations', 'accounting', 'warehouse', 'support']::text[]),
    ('tracking', array['commercial', 'operations', 'accounting', 'warehouse', 'support']::text[]),
    ('calendar', array['commercial', 'operations', 'accounting', 'warehouse', 'support', 'marketing']::text[]),
    ('bitacora', array['commercial', 'operations', 'accounting', 'warehouse', 'support', 'marketing']::text[]),
    ('cn', array['operations', 'warehouse', 'support']::text[]),
    ('qrqueue', array['operations', 'warehouse']::text[]),
    ('labels', array['operations', 'warehouse']::text[]),
    ('ve', array['operations', 'warehouse', 'support']::text[]),
    ('inventory', array['operations', 'warehouse', 'support']::text[]),
    ('naviera', array['operations', 'accounting']::text[]),
    ('seniat', array['operations', 'accounting']::text[]),
    ('tms', array['operations', 'warehouse']::text[]),
    ('despacho', array['operations', 'warehouse']::text[]),
    ('despacho-rules', array['operations']::text[]),
    ('despacho-dashboard', array['operations', 'warehouse']::text[]),
    ('admin-rutas', array['operations']::text[]),
    ('reclamos', array['commercial', 'operations', 'accounting', 'support']::text[]),
    ('inspecciones', array['operations', 'commercial', 'support']::text[]),
    ('quotes', array['commercial', 'operations', 'accounting', 'support']::text[]),
    ('clients', array['commercial', 'operations', 'accounting', 'support']::text[]),
    ('conversaciones', array['commercial', 'operations', 'support']::text[]),
    ('bandeja', array['commercial', 'support']::text[]),
    ('kommo', array['commercial']::text[]),
    ('suppliers', array['commercial', 'operations']::text[]),
    ('purchase-orders', array['commercial', 'operations', 'accounting']::text[]),
    ('sales-orders', array['commercial', 'operations', 'accounting']::text[]),
    ('service-catalog', array['commercial', 'operations', 'accounting']::text[]),
    ('rates', array['commercial', 'accounting']::text[]),
    ('fidelizacion', array['commercial', 'support']::text[]),
    ('academia', array['commercial', 'accounting', 'support']::text[]),
    ('club', array['commercial', 'support']::text[]),
    ('direccion', array[]::text[]),
    ('expenses', array['accounting', 'operations', 'warehouse']::text[]),
    ('invoices', array['accounting']::text[]),
    ('accounting', array['accounting']::text[]),
    ('collections', array['accounting']::text[]),
    ('renditions', array[]::text[]),
    ('treasury', array['accounting']::text[]),
    ('fiscal', array['accounting']::text[]),
    ('financiero-china', array[]::text[]),
    ('documents', array['commercial', 'operations', 'accounting', 'warehouse', 'support', 'marketing']::text[]),
    ('reports', array['accounting']::text[]),
    ('costing', array['accounting']::text[]),
    ('nomina', array['accounting']::text[]),
    ('marketing', array['marketing', 'commercial', 'support']::text[]),
    ('noticias-web', array['commercial', 'support', 'marketing']::text[]),
    ('marketing-docs', array['marketing', 'commercial', 'support']::text[]),
    ('mentions', array['commercial', 'operations', 'accounting', 'warehouse', 'support', 'marketing']::text[]),
    ('mailing', array[]::text[]),
    ('no-olvidar', array[]::text[]),
    ('legal', array[]::text[]),
    ('users', array[]::text[]),
    ('operarios', array['operations']::text[]),
    ('bugs', array['commercial', 'operations', 'accounting', 'warehouse', 'support', 'marketing']::text[]),
    ('mis-bugs', array['commercial', 'operations', 'accounting', 'warehouse', 'support', 'marketing']::text[]),
    ('admin', array[]::text[])
  ) as v(module_id, roles)
  where v.module_id = p_module_id
$$;

comment on function public.studio_module_default_roles(text) is
  'SDD-0622: copia SQL de ROLE_MODULE_ACCESS (lib/studio/rbac.ts). null = módulo desconocido. La prueba de la 0529 la compara con el código.';

-- Módulos sensibles = LOCKED_MODULES (MONEY_MODULES ∪ ADMIN_ONLY_MODULES).
create function public.studio_module_is_sensitive(p_module_id text)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select p_module_id = any (array[
    -- MONEY_MODULES
    'invoices', 'accounting', 'collections', 'treasury', 'fiscal', 'costing', 'reports', 'nomina',
    -- ADMIN_ONLY_MODULES
    'users', 'admin', 'direccion', 'renditions', 'financiero-china', 'legal', 'no-olvidar', 'mailing'
  ]::text[])
$$;

comment on function public.studio_module_is_sensitive(text) is
  'SDD-0622: LOCKED_MODULES de lib/studio/rbac.ts (dinero ∪ solo-administrador). Un extra sobre estos pide doble aviso.';

-- SUPERADMIN_ONLY_MODULES: los concede sólo is_platform_admin() (R2).
create function public.studio_module_is_superadmin_only(p_module_id text)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select p_module_id = any (array['financiero-china', 'legal', 'no-olvidar', 'renditions']::text[])
$$;

comment on function public.studio_module_is_superadmin_only(text) is
  'SDD-0622 R2: SUPERADMIN_ONLY_MODULES de lib/studio/rbac.ts. Sólo los concede is_platform_admin().';

revoke all on function public.studio_module_default_roles(text) from public, anon;
revoke all on function public.studio_module_is_sensitive(text) from public, anon;
revoke all on function public.studio_module_is_superadmin_only(text) from public, anon;
grant execute on function public.studio_module_default_roles(text) to authenticated, service_role;
grant execute on function public.studio_module_is_sensitive(text) to authenticated, service_role;
grant execute on function public.studio_module_is_superadmin_only(text) to authenticated, service_role;

-- ─── 2. Tabla ─────────────────────────────────────────────────────────────
create table public.studio_user_module_grants (
  tenant_id               uuid not null references public.tenants(id) on delete cascade,
  user_id                 uuid not null references auth.users(id) on delete cascade,
  module_id               text not null,
  can_view                boolean not null default true,
  can_edit                boolean not null default false,
  reason                  text not null,
  expires_at              timestamptz,
  granted_by              uuid references auth.users(id) on delete set null,
  sensitive_confirmed_at  timestamptz,
  effects_version         text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  primary key (tenant_id, user_id, module_id),
  constraint studio_user_module_grants_module_format
    check (module_id ~ '^[a-z][a-z0-9-]{0,63}$'),
  -- Un extra siempre deja ver: «sin ver» no suma nada y solo confunde.
  constraint studio_user_module_grants_view_required check (can_view),
  constraint studio_user_module_grants_edit_implies_view check (not can_edit or can_view),
  constraint studio_user_module_grants_reason_length
    check (pg_catalog.char_length(pg_catalog.btrim(reason)) between 5 and 500),
  -- Doble candado de los módulos sensibles: sin confirmación no hay fila. La
  -- lista va literal (igual que el CHECK de la 0357) para que la restricción no
  -- dependa de una función.
  constraint studio_user_module_grants_sensitive_confirmed
    check (
      module_id not in (
        'invoices', 'accounting', 'collections', 'treasury', 'fiscal', 'costing', 'reports', 'nomina',
        'users', 'admin', 'direccion', 'renditions', 'financiero-china', 'legal', 'no-olvidar', 'mailing'
      )
      or (sensitive_confirmed_at is not null and effects_version is not null)
    ),
  -- R1: un extra sobre la gestión de usuarios o el panel de administración es
  -- de solo lectura.
  constraint studio_user_module_grants_keystone_read_only
    check (not (module_id in ('users', 'admin') and can_edit))
);

comment on table public.studio_user_module_grants is
  'SDD-0622: accesos adicionales por persona (solo suman al rol). Escritura únicamente vía studio_grant_user_module / studio_revoke_user_module_grant; revocar borra la fila y deja el rastro en entity_audit_log.';

create index studio_user_module_grants_user_idx
  on public.studio_user_module_grants (tenant_id, user_id);

alter table public.studio_user_module_grants enable row level security;

-- Lectura: el admin del tenant (pantalla de Usuarios) y la propia persona
-- (para que sepa qué tiene y por qué).
create policy studio_user_module_grants_read
  on public.studio_user_module_grants
  for select to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (user_id = (select auth.uid()) or (select public.is_tenant_admin()))
  );

create policy studio_user_module_grants_service_role_all
  on public.studio_user_module_grants
  for all to service_role using (true) with check (true);

revoke all on public.studio_user_module_grants from public, anon, authenticated;
grant select on public.studio_user_module_grants to authenticated;
grant all on public.studio_user_module_grants to service_role;

-- ─── 3. Catálogo de auditoría ─────────────────────────────────────────────
insert into public.audit_entity_types (
  entity_type, status, domain_code, contract_version, introduced_by_ref
)
values ('studio_user_module_grant', 'active', 'governance', 1, 'migration:0529')
on conflict (entity_type) do update
set status = excluded.status,
    domain_code = excluded.domain_code,
    contract_version = greatest(public.audit_entity_types.contract_version, excluded.contract_version);

-- ─── 4. Decisión efectiva ─────────────────────────────────────────────────
create function public.user_has_module(p_module_id text, p_edit boolean default false)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_uid     uuid := (select auth.uid());
  v_tenant  uuid := (select public.get_user_tenant_id());
  v_module  text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_module_id, '')));
  v_edit    boolean := coalesce(p_edit, false);
  v_role    text;
  v_scope   text;
  v_side    text;
  v_default text[];
  v_by_role boolean;
  v_o_view  boolean;
  v_o_edit  boolean;
begin
  if v_uid is null or v_tenant is null or v_module = '' then
    return false;
  end if;

  select pg_catalog.lower(pg_catalog.btrim(ut.role)), ut.warehouse_scope
    into v_role, v_scope
  from public.user_tenants ut
  where ut.user_id = v_uid and ut.tenant_id = v_tenant and ut.disabled_at is null
  limit 1;
  if v_role is null then
    return false;
  end if;

  -- 1. admin ve y edita todo (como canAccessModule/canEditModule).
  if v_role = 'admin' then
    return true;
  end if;
  -- 2. support es de solo lectura, también con extras.
  if v_edit and v_role = 'support' then
    return false;
  end if;

  v_default := public.studio_module_default_roles(v_module);
  if v_default is null then
    return false; -- módulo desconocido: falla cerrado
  end if;

  -- 3. Scope de almacén (0202): un extra no salta el lado CN/VE.
  v_side := case v_module
    when 'cn' then 'cn' when 'qrqueue' then 'cn' when 'labels' then 'cn'
    when 've' then 've'
  end;
  if v_side is not null and coalesce(v_scope, 'all') not in ('all', v_side) then
    return false;
  end if;

  -- 4. Por rol: desvío por rol (0357, nunca sobre módulos sensibles) o default.
  if not public.studio_module_is_sensitive(v_module) then
    select o.can_view, o.can_edit into v_o_view, v_o_edit
    from public.studio_role_module_overrides o
    where o.tenant_id = v_tenant and o.role = v_role and o.module_id = v_module;
    if found then
      v_by_role := case when v_edit then v_o_edit else v_o_view end;
    end if;
  end if;
  if v_by_role is null then
    v_by_role := v_role = any (v_default);
  end if;
  if v_by_role then
    return true;
  end if;

  -- 5. Extra vigente de la persona.
  return exists (
    select 1
    from public.studio_user_module_grants g
    where g.tenant_id = v_tenant
      and g.user_id = v_uid
      and g.module_id = v_module
      and (g.expires_at is null or g.expires_at > pg_catalog.now())
      and (not public.studio_module_is_sensitive(v_module) or g.sensitive_confirmed_at is not null)
      and case when v_edit then g.can_edit and v_module not in ('users', 'admin') else g.can_view end
  );
end;
$fn$;

comment on function public.user_has_module(text, boolean) is
  'SDD-0622 §5.3: ¿el usuario de la sesión ve (p_edit=false) o edita el módulo? Mismo orden que canAccessModule/canEditModule de rbac.ts más el scope de almacén: admin, support sin edición, desvío por rol o default de código, extra vigente de la persona. No abre capabilities ni el segundo candado del superadministrador.';

revoke all on function public.user_has_module(text, boolean) from public, anon;
grant execute on function public.user_has_module(text, boolean) to authenticated, service_role;

-- ─── 5. RPC: conceder o cambiar ───────────────────────────────────────────
create function public.studio_grant_user_module(
  p_user_id           uuid,
  p_module_id         text,
  p_can_view          boolean,
  p_can_edit          boolean,
  p_reason            text,
  p_expires_at        timestamptz default null,
  p_confirm_sensitive boolean default false,
  p_effects_version   text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_tenant      uuid := (select public.get_user_tenant_id());
  v_actor       uuid := (select auth.uid());
  v_actor_role  text;
  v_target_role text;
  v_module      text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_module_id, '')));
  v_reason      text := pg_catalog.btrim(coalesce(p_reason, ''));
  v_sensitive   boolean;
  v_version     text := nullif(pg_catalog.btrim(coalesce(p_effects_version, '')), '');
  v_before      public.studio_user_module_grants%rowtype;
  v_had_before  boolean;
begin
  if v_actor is null or v_tenant is null then
    raise exception 'Sin membership activo' using errcode = '42501';
  end if;

  select ut.role into v_actor_role
  from public.user_tenants ut
  where ut.user_id = v_actor and ut.tenant_id = v_tenant and ut.disabled_at is null;
  -- R1: el rol admin de la BASE, no un extra sobre `users`/`admin`.
  if v_actor_role is distinct from 'admin' then
    raise exception 'Solo un administrador concede accesos adicionales' using errcode = '42501';
  end if;

  if p_user_id is null or p_user_id = v_actor then
    raise exception 'No puedes concederte accesos a ti mismo' using errcode = '42501';
  end if;

  select ut.role into v_target_role
  from public.user_tenants ut
  where ut.user_id = p_user_id and ut.tenant_id = v_tenant and ut.disabled_at is null;
  if v_target_role is null then
    raise exception 'La persona no es miembro activo de tu equipo' using errcode = '22023';
  end if;
  if v_target_role = 'admin' then
    raise exception 'Un administrador ya tiene todos los módulos' using errcode = '22023';
  end if;

  if public.studio_module_default_roles(v_module) is null then
    raise exception 'Módulo desconocido: %', v_module using errcode = '22023';
  end if;
  if p_can_view is distinct from true then
    raise exception 'Un acceso adicional siempre deja ver el módulo' using errcode = '22023';
  end if;
  if coalesce(p_can_edit, false) and v_module in ('users', 'admin') then
    raise exception 'La gestión de usuarios y el panel de administración se conceden solo para ver' using errcode = '22023';
  end if;
  if pg_catalog.char_length(v_reason) not between 5 and 500 then
    raise exception 'El motivo es obligatorio (entre 5 y 500 caracteres)' using errcode = '22023';
  end if;
  if p_expires_at is not null and p_expires_at <= pg_catalog.now() then
    raise exception 'El vencimiento tiene que ser en el futuro' using errcode = '22023';
  end if;

  -- R2: los módulos del superadministrador solo los concede uno.
  if public.studio_module_is_superadmin_only(v_module) and not (select public.is_platform_admin()) then
    raise exception 'Ese módulo solo lo concede el superadministrador' using errcode = '42501';
  end if;

  v_sensitive := public.studio_module_is_sensitive(v_module);
  if v_sensitive and p_confirm_sensitive is distinct from true then
    raise exception 'Módulo sensible: falta la confirmación del doble aviso' using errcode = '22023';
  end if;
  if v_sensitive and (v_version is null or v_version !~ '^[0-9a-z.-]{1,32}$') then
    raise exception 'Módulo sensible: falta la versión de la lista de efectos' using errcode = '22023';
  end if;

  select * into v_before
  from public.studio_user_module_grants g
  where g.tenant_id = v_tenant and g.user_id = p_user_id and g.module_id = v_module
  for update;
  v_had_before := found;

  insert into public.studio_user_module_grants as g (
    tenant_id, user_id, module_id, can_view, can_edit, reason, expires_at,
    granted_by, sensitive_confirmed_at, effects_version, created_at, updated_at
  ) values (
    v_tenant, p_user_id, v_module, true, coalesce(p_can_edit, false), v_reason, p_expires_at,
    v_actor, case when v_sensitive then pg_catalog.now() end,
    case when v_sensitive then v_version end, pg_catalog.now(), pg_catalog.now()
  )
  on conflict (tenant_id, user_id, module_id) do update
    set can_view = excluded.can_view,
        can_edit = excluded.can_edit,
        reason = excluded.reason,
        expires_at = excluded.expires_at,
        granted_by = excluded.granted_by,
        sensitive_confirmed_at = excluded.sensitive_confirmed_at,
        effects_version = excluded.effects_version,
        updated_at = pg_catalog.now();

  perform public.append_audit_event(
    v_tenant,
    'studio_user_module_grant',
    p_user_id,
    'user',
    v_actor,
    case when v_had_before then 'user_module_grant_updated' else 'user_module_grant_created' end,
    'studio',
    'succeeded',
    v_reason,
    case when v_had_before then pg_catalog.jsonb_build_object(
      'module_id', v_before.module_id,
      'can_view', v_before.can_view,
      'can_edit', v_before.can_edit,
      'expires_at', v_before.expires_at
    ) end,
    pg_catalog.jsonb_build_object(
      'module_id', v_module,
      'can_view', true,
      'can_edit', coalesce(p_can_edit, false),
      'expires_at', p_expires_at
    ),
    pg_catalog.jsonb_build_object(
      'target_role', v_target_role,
      'sensitive', v_sensitive,
      'sensitive_confirmed', v_sensitive,
      'effects_version', case when v_sensitive then v_version end
    ),
    pg_catalog.concat('user-module-grant:', p_user_id::text, ':', v_module, ':', pg_catalog.txid_current()::text),
    1,
    'internal'
  );

  return true;
end;
$fn$;

comment on function public.studio_grant_user_module(uuid, text, boolean, boolean, text, timestamptz, boolean, text) is
  'SDD-0622: concede o cambia un acceso adicional. Solo rol admin de la base (R1), nunca a uno mismo ni a un admin; módulos sensibles con p_confirm_sensitive y versión de efectos; módulos del superadministrador solo por is_platform_admin() (R2); users/admin solo ver. Deja evento en entity_audit_log.';

revoke all on function public.studio_grant_user_module(uuid, text, boolean, boolean, text, timestamptz, boolean, text) from public, anon;
grant execute on function public.studio_grant_user_module(uuid, text, boolean, boolean, text, timestamptz, boolean, text) to authenticated;

-- ─── 6. RPC: quitar ───────────────────────────────────────────────────────
create function public.studio_revoke_user_module_grant(
  p_user_id   uuid,
  p_module_id text,
  p_reason    text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_tenant     uuid := (select public.get_user_tenant_id());
  v_actor      uuid := (select auth.uid());
  v_actor_role text;
  v_module     text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_module_id, '')));
  v_reason     text := pg_catalog.btrim(coalesce(p_reason, ''));
  v_before     public.studio_user_module_grants%rowtype;
begin
  if v_actor is null or v_tenant is null then
    raise exception 'Sin membership activo' using errcode = '42501';
  end if;
  select ut.role into v_actor_role
  from public.user_tenants ut
  where ut.user_id = v_actor and ut.tenant_id = v_tenant and ut.disabled_at is null;
  if v_actor_role is distinct from 'admin' then
    raise exception 'Solo un administrador quita accesos adicionales' using errcode = '42501';
  end if;
  if pg_catalog.char_length(v_reason) not between 5 and 500 then
    raise exception 'El motivo es obligatorio (entre 5 y 500 caracteres)' using errcode = '22023';
  end if;

  delete from public.studio_user_module_grants g
  where g.tenant_id = v_tenant and g.user_id = p_user_id and g.module_id = v_module
  returning * into v_before;
  if not found then
    return false;
  end if;

  perform public.append_audit_event(
    v_tenant,
    'studio_user_module_grant',
    p_user_id,
    'user',
    v_actor,
    'user_module_grant_revoked',
    'studio',
    'succeeded',
    v_reason,
    pg_catalog.jsonb_build_object(
      'module_id', v_before.module_id,
      'can_view', v_before.can_view,
      'can_edit', v_before.can_edit,
      'expires_at', v_before.expires_at
    ),
    null,
    pg_catalog.jsonb_build_object(
      'sensitive', public.studio_module_is_sensitive(v_module),
      'expired', v_before.expires_at is not null and v_before.expires_at <= pg_catalog.now()
    ),
    pg_catalog.concat('user-module-revoke:', p_user_id::text, ':', v_module, ':', pg_catalog.txid_current()::text),
    1,
    'internal'
  );
  return true;
end;
$fn$;

comment on function public.studio_revoke_user_module_grant(uuid, text, text) is
  'SDD-0622: quita un acceso adicional (borra la fila) con motivo; el rastro queda en entity_audit_log. Solo rol admin de la base. false = no había fila.';

revoke all on function public.studio_revoke_user_module_grant(uuid, text, text) from public, anon;
grant execute on function public.studio_revoke_user_module_grant(uuid, text, text) to authenticated;

-- ─── 7. Postcondiciones ───────────────────────────────────────────────────
do $post$
begin
  if not exists (
    select 1 from pg_catalog.pg_tables
    where schemaname = 'public' and tablename = 'studio_user_module_grants' and rowsecurity
  ) then
    raise exception '0529: la RLS no quedó activa';
  end if;
  if pg_catalog.has_table_privilege('authenticated', 'public.studio_user_module_grants', 'INSERT')
     or pg_catalog.has_table_privilege('authenticated', 'public.studio_user_module_grants', 'UPDATE')
     or pg_catalog.has_table_privilege('authenticated', 'public.studio_user_module_grants', 'DELETE') then
    raise exception '0529: authenticated no debe escribir directo en la tabla';
  end if;
  if pg_catalog.has_function_privilege('anon', 'public.user_has_module(text, boolean)', 'EXECUTE')
     or pg_catalog.has_function_privilege('anon', 'public.studio_grant_user_module(uuid, text, boolean, boolean, text, timestamptz, boolean, text)', 'EXECUTE')
     or pg_catalog.has_function_privilege('anon', 'public.studio_revoke_user_module_grant(uuid, text, text)', 'EXECUTE') then
    raise exception '0529: anon no debe ejecutar las funciones de accesos';
  end if;
  if not exists (
    select 1 from public.audit_entity_types
    where entity_type = 'studio_user_module_grant' and status = 'active'
  ) then
    raise exception '0529: falta el tipo de entidad de auditoría';
  end if;
  if public.studio_module_default_roles('kommo') is distinct from array['commercial']::text[]
     or public.studio_module_default_roles('no-existe') is not null then
    raise exception '0529: el catálogo de módulos no quedó bien';
  end if;
end;
$post$;
