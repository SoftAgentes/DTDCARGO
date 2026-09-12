-- ─────────────────────────────────────────────────────────────
-- 0408 · SDD-0351 · Mailing: RBAC admin-only en la base
--
-- HALLAZGO: la aplicación declara el módulo Mailing como admin-only, pero las
-- tablas de administración seguían con RLS sólo por tenant. Cualquier sesión
-- authenticated activa podía saltar las Server Actions por PostgREST y leer o
-- mutar plantillas, firmas, reglas, configuración, blacklist y programados.
-- Los replays históricos también devolvieron EXECUTE a authenticated sobre dos
-- RPC security definer que el runtime actual sólo usa con service_role.
--
-- ESTE SLICE:
--   · exige current_studio_role() = admin en las seis tablas administrativas;
--   · fija una ACL mínima y elimina privilegios implícitos como TRUNCATE;
--   · reserva las dos RPC internas a service_role;
--   · no cambia mail_logs: Cobranzas consume esa lectura tenant-wide y necesita
--     un facade minimizado antes de poder cerrarla sin romper operación.
--
-- NO aplicar a Cloud/Producción desde esta rama. Gate individual obligatorio:
-- docs/runbooks/aplicar-migraciones-prod.md.
-- ─────────────────────────────────────────────────────────────

do $preflight$
declare
  v_missing text;
begin
  select pg_catalog.string_agg(required.object_name, ', ' order by required.object_name)
  into v_missing
  from (
    values
      ('table public.mail_templates', pg_catalog.to_regclass('public.mail_templates') is not null),
      ('table public.mail_signatures', pg_catalog.to_regclass('public.mail_signatures') is not null),
      ('table public.mail_rules', pg_catalog.to_regclass('public.mail_rules') is not null),
      ('table public.mail_config', pg_catalog.to_regclass('public.mail_config') is not null),
      ('table public.mail_blacklist', pg_catalog.to_regclass('public.mail_blacklist') is not null),
      ('table public.mail_scheduled', pg_catalog.to_regclass('public.mail_scheduled') is not null),
      ('function public.get_user_tenant_id()', pg_catalog.to_regprocedure('public.get_user_tenant_id()') is not null),
      ('function public.current_studio_role()', pg_catalog.to_regprocedure('public.current_studio_role()') is not null),
      ('function public.mail_increment_template_metrics(uuid,text,integer)', pg_catalog.to_regprocedure('public.mail_increment_template_metrics(uuid,text,integer)') is not null),
      ('function public.mail_check_blacklist(uuid,text)', pg_catalog.to_regprocedure('public.mail_check_blacklist(uuid,text)') is not null)
  ) as required(object_name, present)
  where not required.present;

  if v_missing is not null then
    raise exception '0408 requiere objetos ausentes: %', v_missing;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'mail_templates'
      and policyname = 'mail_templates_by_tenant' and cmd = 'ALL'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'mail_rules'
      and policyname = 'mail_rules_by_tenant' and cmd = 'ALL'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'mail_blacklist'
      and policyname = 'mail_blacklist_by_tenant' and cmd = 'ALL'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'mail_scheduled'
      and policyname = 'mail_scheduled_by_tenant' and cmd = 'ALL'
  ) then
    raise exception '0408 abortada: policies ALL históricas ausentes o con drift';
  end if;
end;
$preflight$;

-- Plantillas
drop policy "mail_templates_by_tenant" on public.mail_templates;

create policy mail_templates_admin_select
  on public.mail_templates for select to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) = 'admin'
  );
create policy mail_templates_admin_insert
  on public.mail_templates for insert to authenticated
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) = 'admin'
  );
create policy mail_templates_admin_update
  on public.mail_templates for update to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) = 'admin'
  )
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) = 'admin'
  );
create policy mail_templates_admin_delete
  on public.mail_templates for delete to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) = 'admin'
  );

-- Firmas: 0018 creó policies owner-scoped y 0206 agregó policies tenant-wide
-- permisivas. El módulo vigente las administra para todo el equipo y es admin-only.
drop policy if exists "mail_signatures_owner_select" on public.mail_signatures;
drop policy if exists "mail_signatures_owner_insert" on public.mail_signatures;
drop policy if exists "mail_signatures_owner_update" on public.mail_signatures;
drop policy if exists "mail_signatures_owner_delete" on public.mail_signatures;
drop policy if exists "mail_signatures_tenant_select" on public.mail_signatures;
drop policy if exists "mail_signatures_tenant_insert" on public.mail_signatures;
drop policy if exists "mail_signatures_tenant_update" on public.mail_signatures;
drop policy if exists "mail_signatures_tenant_delete" on public.mail_signatures;

create policy mail_signatures_admin_select
  on public.mail_signatures for select to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) = 'admin'
  );
create policy mail_signatures_admin_insert
  on public.mail_signatures for insert to authenticated
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) = 'admin'
  );
create policy mail_signatures_admin_update
  on public.mail_signatures for update to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) = 'admin'
  )
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) = 'admin'
  );
create policy mail_signatures_admin_delete
  on public.mail_signatures for delete to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) = 'admin'
  );

-- Reglas
drop policy "mail_rules_by_tenant" on public.mail_rules;

create policy mail_rules_admin_select
  on public.mail_rules for select to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) = 'admin'
  );
create policy mail_rules_admin_insert
  on public.mail_rules for insert to authenticated
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) = 'admin'
  );
create policy mail_rules_admin_update
  on public.mail_rules for update to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) = 'admin'
  )
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) = 'admin'
  );
create policy mail_rules_admin_delete
  on public.mail_rules for delete to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) = 'admin'
  );

-- Configuración
drop policy "mail_config_by_tenant_select" on public.mail_config;
drop policy "mail_config_by_tenant_update" on public.mail_config;

create policy mail_config_admin_select
  on public.mail_config for select to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) = 'admin'
  );
create policy mail_config_admin_update
  on public.mail_config for update to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) = 'admin'
  )
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) = 'admin'
  );

-- Lista negra
drop policy "mail_blacklist_by_tenant" on public.mail_blacklist;

create policy mail_blacklist_admin_select
  on public.mail_blacklist for select to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) = 'admin'
  );
create policy mail_blacklist_admin_insert
  on public.mail_blacklist for insert to authenticated
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) = 'admin'
  );
create policy mail_blacklist_admin_delete
  on public.mail_blacklist for delete to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) = 'admin'
  );

-- Programados
drop policy "mail_scheduled_by_tenant" on public.mail_scheduled;

create policy mail_scheduled_admin_select
  on public.mail_scheduled for select to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) = 'admin'
  );
create policy mail_scheduled_admin_insert
  on public.mail_scheduled for insert to authenticated
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) = 'admin'
  );
create policy mail_scheduled_admin_update
  on public.mail_scheduled for update to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) = 'admin'
  )
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) = 'admin'
  );
create policy mail_scheduled_admin_delete
  on public.mail_scheduled for delete to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.current_studio_role()) = 'admin'
  );

-- ACL determinista: RLS decide el admin, pero ningún authenticated obtiene
-- TRUNCATE/REFERENCES/TRIGGER por drift de grants.
revoke all on public.mail_templates from authenticated;
grant select, insert, update, delete on public.mail_templates to authenticated;
revoke all on public.mail_signatures from authenticated;
grant select, insert, update, delete on public.mail_signatures to authenticated;
revoke all on public.mail_rules from authenticated;
grant select, insert, update, delete on public.mail_rules to authenticated;
revoke all on public.mail_config from authenticated;
grant select, update on public.mail_config to authenticated;
revoke all on public.mail_blacklist from authenticated;
grant select, insert, delete on public.mail_blacklist to authenticated;
revoke all on public.mail_scheduled from authenticated;
grant select, insert, update, delete on public.mail_scheduled to authenticated;

-- Son helpers internos de los orquestadores service_role. authenticated no
-- necesita elegir tenant/template ni ejecutar SECURITY DEFINER directamente.
revoke execute on function public.mail_increment_template_metrics(uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.mail_increment_template_metrics(uuid, text, integer)
  to service_role;
revoke execute on function public.mail_check_blacklist(uuid, text)
  from public, anon, authenticated;
grant execute on function public.mail_check_blacklist(uuid, text)
  to service_role;

comment on function public.mail_check_blacklist(uuid, text) is
  'SDD-0026/0351: helper interno de envío. Sólo service_role puede consultar la blacklist de un tenant elegido.';
comment on table public.mail_scheduled is
  'SDD-0143/0351: cola de correos programados; authenticated requiere rol admin + tenant activo en RLS. service_role procesa la cola.';

do $postflight$
declare
  v_expected_policies constant text[] := array[
    'mail_templates_admin_select', 'mail_templates_admin_insert',
    'mail_templates_admin_update', 'mail_templates_admin_delete',
    'mail_signatures_admin_select', 'mail_signatures_admin_insert',
    'mail_signatures_admin_update', 'mail_signatures_admin_delete',
    'mail_rules_admin_select', 'mail_rules_admin_insert',
    'mail_rules_admin_update', 'mail_rules_admin_delete',
    'mail_config_admin_select', 'mail_config_admin_update',
    'mail_blacklist_admin_select', 'mail_blacklist_admin_insert',
    'mail_blacklist_admin_delete',
    'mail_scheduled_admin_select', 'mail_scheduled_admin_insert',
    'mail_scheduled_admin_update', 'mail_scheduled_admin_delete'
  ];
begin
  if (select count(*) from pg_policies
      where schemaname = 'public'
        and policyname = any(v_expected_policies)) <> pg_catalog.array_length(v_expected_policies, 1) then
    raise exception '0408: faltan policies admin-only';
  end if;

  if has_function_privilege('authenticated', 'public.mail_increment_template_metrics(uuid,text,integer)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.mail_check_blacklist(uuid,text)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.mail_increment_template_metrics(uuid,text,integer)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.mail_check_blacklist(uuid,text)', 'EXECUTE') then
    raise exception '0408: ACL de RPC internas inválida';
  end if;

  if has_table_privilege('authenticated', 'public.mail_templates', 'TRUNCATE')
     or has_table_privilege('authenticated', 'public.mail_signatures', 'TRUNCATE')
     or has_table_privilege('authenticated', 'public.mail_rules', 'TRUNCATE')
     or has_table_privilege('authenticated', 'public.mail_config', 'INSERT')
     or has_table_privilege('authenticated', 'public.mail_config', 'DELETE')
     or has_table_privilege('authenticated', 'public.mail_blacklist', 'UPDATE')
     or has_table_privilege('authenticated', 'public.mail_scheduled', 'TRUNCATE') then
    raise exception '0408: ACL de tablas administrativas inválida';
  end if;
end;
$postflight$;
