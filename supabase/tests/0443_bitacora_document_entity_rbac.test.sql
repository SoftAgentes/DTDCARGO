\set ON_ERROR_STOP on
-- SDD-0411: RED support escribe Bitácora tras 0442; GREEN en metadata + bucket.
\if :{?apply_fix}
\else
\set apply_fix true
\endif

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$roles$;
grant usage on schema public to anon, authenticated, service_role;
create schema auth;
create schema storage;
grant usage on schema auth, storage to authenticated, service_role;
create function auth.uid() returns uuid
language sql stable set search_path = '' as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create function storage.foldername(p_name text) returns text[]
language sql immutable set search_path = '' as $$
  select case
    when pg_catalog.array_length(pg_catalog.string_to_array(p_name, '/'), 1) > 1
      then (pg_catalog.string_to_array(p_name, '/'))[
        1:pg_catalog.array_length(pg_catalog.string_to_array(p_name, '/'), 1) - 1
      ]
    else array[]::text[]
  end
$$;

create table public.user_tenants (
  user_id uuid primary key, tenant_id uuid not null, role text not null,
  disabled_at timestamptz
);
create table public.studio_role_module_overrides (
  tenant_id uuid not null, role text not null, module_id text not null,
  can_view boolean not null, can_edit boolean not null,
  primary key (tenant_id, role, module_id)
);
create table storage.objects (
  id uuid primary key, bucket_id text not null, name text not null unique
);
create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select ut.tenant_id from public.user_tenants ut
  where ut.user_id = (select auth.uid()) and ut.disabled_at is null limit 1
$$;

-- Estado exacto posterior a 0442.
create function public.document_entity_module_contract(p_entity_type text)
returns table(module_id text, default_roles text[])
language sql immutable security invoker set search_path = '' as $$
  select v.module_id, v.default_roles
  from (values
    ('expense', 'expenses', array['accounting', 'operations', 'warehouse']::text[]),
    ('shipment', 'tracking', array['commercial', 'operations', 'accounting', 'warehouse', 'support']::text[]),
    ('client', 'clients', array['commercial', 'operations', 'accounting', 'support']::text[]),
    ('supplier', 'suppliers', array['commercial', 'operations']::text[]),
    ('consolidation', 'naviera', array['operations', 'accounting']::text[]),
    ('booking', 'naviera', array['operations', 'accounting']::text[])
  ) as v(entity_type, module_id, default_roles)
  where v.entity_type = pg_catalog.lower(pg_catalog.btrim(coalesce(p_entity_type, '')))
$$;
comment on function public.document_entity_module_contract(text) is
  'SDD-0410: mapa interno entidad documental → módulo/defaults. Sin EXECUTE para roles de API; document_entity_authorized es la única interfaz.';
revoke all on function public.document_entity_module_contract(text)
  from public, anon, authenticated, service_role;

create function public.document_entity_authorized(
  p_entity_type text, p_tenant_id uuid, p_access text
) returns boolean language sql stable security definer set search_path = '' as $$
  with normalized as (
    select pg_catalog.lower(pg_catalog.btrim(coalesce(p_entity_type, ''))) entity_type,
      pg_catalog.lower(pg_catalog.btrim(coalesce(p_access, ''))) access
  ), membership as (
    select pg_catalog.lower(pg_catalog.btrim(ut.role)) role
    from public.user_tenants ut where ut.user_id = (select auth.uid())
      and ut.tenant_id = p_tenant_id and ut.disabled_at is null limit 1
  ), decision as (
    select n.entity_type, n.access, m.role, c.module_id, c.default_roles,
      o.can_view, o.can_edit
    from normalized n cross join membership m
    left join lateral public.document_entity_module_contract(n.entity_type) c on true
    left join public.studio_role_module_overrides o on o.tenant_id = p_tenant_id
      and pg_catalog.lower(pg_catalog.btrim(o.role)) = m.role
      and o.module_id = c.module_id
  )
  select coalesce((select case
    when d.access not in ('view', 'edit') then false
    when d.entity_type in ('invoice','supplier_bill','supplier_payment','journal_entry')
      then d.role in ('accounting','admin')
    when d.module_id is not null and d.role = 'admin' then true
    when d.module_id is not null and d.access = 'view'
      then coalesce(d.can_view, d.role = any(d.default_roles))
    when d.module_id is not null and d.access = 'edit'
      then d.role <> 'support' and coalesce(d.can_edit, d.role = any(d.default_roles))
    else true end from decision d), false)
$$;
comment on function public.document_entity_authorized(text,uuid,text) is
  'SDD-0410: autorización documental tenant-aware. Tipos financieros quedan accounting/admin; expense, shipment, client, supplier, consolidation y booking heredan sus módulos.';
revoke all on function public.document_entity_authorized(text,uuid,text) from public, anon;
grant execute on function public.document_entity_authorized(text,uuid,text) to authenticated, service_role;
create function public.document_entity_allowed_for_current_role(p_entity_type text)
returns boolean language sql stable set search_path = '' as $$
  select public.document_entity_authorized(p_entity_type, (select public.get_user_tenant_id()), 'view')
$$;
comment on function public.document_entity_allowed_for_current_role(text) is
  'SDD-0410: wrapper de compatibilidad de vista; las policies y guards activos usan document_entity_authorized(text,uuid,text).';

grant select, insert, delete on storage.objects to authenticated;
grant all on storage.objects to service_role;
alter table storage.objects enable row level security;
create policy "bitacora service_role all storage" on storage.objects for all
  to service_role using (bucket_id = 'bitacora') with check (bucket_id = 'bitacora');
create policy "bitacora tenant insert storage" on storage.objects for insert
  to authenticated with check (
    bucket_id = 'bitacora'
    and (storage.foldername(name))[1] = (public.get_user_tenant_id())::text
  );
create policy "bitacora tenant read storage" on storage.objects for select
  to authenticated using (
    bucket_id = 'bitacora'
    and (storage.foldername(name))[1] = (public.get_user_tenant_id())::text
  );
create policy "bitacora tenant delete storage" on storage.objects for delete
  to authenticated using (
    bucket_id = 'bitacora'
    and (storage.foldername(name))[1] = (public.get_user_tenant_id())::text
  );

insert into public.user_tenants values
  ('aaaaaaaa-4430-4000-8000-000000000001','10000000-4430-4000-8000-000000000001','admin',null),
  ('aaaaaaaa-4430-4000-8000-000000000002','10000000-4430-4000-8000-000000000001','commercial',null),
  ('aaaaaaaa-4430-4000-8000-000000000003','10000000-4430-4000-8000-000000000001','operations',null),
  ('aaaaaaaa-4430-4000-8000-000000000004','10000000-4430-4000-8000-000000000001','accounting',null),
  ('aaaaaaaa-4430-4000-8000-000000000005','10000000-4430-4000-8000-000000000001','support',null),
  ('aaaaaaaa-4430-4000-8000-000000000006','10000000-4430-4000-8000-000000000001','warehouse',null),
  ('aaaaaaaa-4430-4000-8000-000000000007','10000000-4430-4000-8000-000000000001','marketing',null),
  ('aaaaaaaa-4430-4000-8000-000000000008','10000000-4430-4000-8000-000000000001','operations',now()),
  ('bbbbbbbb-4430-4000-8000-000000000001','20000000-4430-4000-8000-000000000002','operations',null);

-- RED: support es read-only en aplicación, pero 0442 aún permite metadata y bucket.
set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4430-4000-8000-000000000005';
do $red$
begin
  if not public.document_entity_authorized('bitacora_task','10000000-4430-4000-8000-000000000001','edit') then
    raise exception 'TEST 0443: no reprodujo metadata abierta para support';
  end if;
  insert into storage.objects values (
    '30000000-4430-4000-8000-000000000001', 'bitacora',
    '10000000-4430-4000-8000-000000000001/bitacora_task/40000000-4430-4000-8000-000000000001/red.pdf'
  );
  delete from storage.objects where id = '30000000-4430-4000-8000-000000000001';
  raise notice 'TEST 0443 RED baseline: support escribe metadata y bucket bitacora';
end;
$red$;
reset role;

\if :apply_fix
\ir ../migrations/0443_bitacora_document_entity_rbac.sql
\else
do $expected_red$
begin
  raise exception 'TEST 0443 RED esperado: falta RBAC de Bitácora';
end;
$expected_red$;
\endif

do $catalog$
begin
  if pg_catalog.obj_description('public.document_entity_module_contract(text)'::regprocedure,'pg_proc') not like 'SDD-0411:%'
     or pg_catalog.obj_description('public.document_entity_authorized(text,uuid,text)'::regprocedure,'pg_proc') not like 'SDD-0411:%'
     or pg_catalog.has_function_privilege('authenticated','public.document_entity_module_contract(text)','EXECUTE')
     or pg_catalog.has_function_privilege('service_role','public.document_entity_module_contract(text)','EXECUTE')
     or (
       select count(*) from pg_catalog.pg_policies
       where schemaname = 'storage' and tablename = 'objects'
         and policyname in (
           'bitacora tenant insert storage',
           'bitacora tenant read storage',
           'bitacora tenant delete storage'
         )
         and coalesce(qual, with_check) like '%document_entity_authorized%'
     ) <> 3 then
    raise exception 'TEST 0443: mapa, grants o policies inválidos';
  end if;
end;
$catalog$;

-- Fila visible para probar lectura de support y bloqueo por override.
insert into storage.objects values (
  '30000000-4430-4000-8000-000000000002', 'bitacora',
  '10000000-4430-4000-8000-000000000001/bitacora_task/40000000-4430-4000-8000-000000000001/read.pdf'
);

set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4430-4000-8000-000000000005';
do $support$
declare
  v_count integer;
  v_blocked boolean := false;
begin
  if not public.document_entity_authorized('bitacora_task','10000000-4430-4000-8000-000000000001','view')
     or public.document_entity_authorized('bitacora_task','10000000-4430-4000-8000-000000000001','edit') then
    raise exception 'TEST 0443: support no quedó read-only';
  end if;
  select count(*) into v_count from storage.objects
    where id = '30000000-4430-4000-8000-000000000002';
  if v_count <> 1 then raise exception 'TEST 0443: support perdió lectura'; end if;
  begin
    insert into storage.objects values (
      '30000000-4430-4000-8000-000000000003', 'bitacora',
      '10000000-4430-4000-8000-000000000001/bitacora_task/40000000-4430-4000-8000-000000000001/support.pdf'
    );
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  if not v_blocked then raise exception 'TEST 0443: support insertó en bucket'; end if;
end;
$support$;
reset role;

set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4430-4000-8000-000000000003';
do $operations$
begin
  insert into storage.objects values (
    '30000000-4430-4000-8000-000000000004', 'bitacora',
    '10000000-4430-4000-8000-000000000001/bitacora_meeting/40000000-4430-4000-8000-000000000002/audio.mp4'
  );
  if not exists (
    select 1 from storage.objects where id = '30000000-4430-4000-8000-000000000004'
  ) then raise exception 'TEST 0443: operations perdió bucket'; end if;
  delete from storage.objects where id = '30000000-4430-4000-8000-000000000004';
end;
$operations$;
reset role;

insert into public.studio_role_module_overrides values
  ('10000000-4430-4000-8000-000000000001','marketing','bitacora',false,false),
  ('10000000-4430-4000-8000-000000000001','support','bitacora',true,true);

set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-4430-4000-8000-000000000007';
do $negative_override$
declare
  v_count integer;
  v_blocked boolean := false;
begin
  select count(*) into v_count from storage.objects
    where id = '30000000-4430-4000-8000-000000000002';
  if v_count <> 0 then raise exception 'TEST 0443: override no cerró lectura'; end if;
  begin
    insert into storage.objects values (
      '30000000-4430-4000-8000-000000000005', 'bitacora',
      '10000000-4430-4000-8000-000000000001/bitacora_task/40000000-4430-4000-8000-000000000001/marketing.pdf'
    );
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  if not v_blocked then raise exception 'TEST 0443: override no cerró escritura'; end if;
end;
$negative_override$;

set local "request.jwt.claim.sub" = 'aaaaaaaa-4430-4000-8000-000000000005';
do $support_override$
begin
  if public.document_entity_authorized('bitacora_task','10000000-4430-4000-8000-000000000001','edit') then
    raise exception 'TEST 0443: override rompió support read-only';
  end if;
end;
$support_override$;

set local "request.jwt.claim.sub" = 'aaaaaaaa-4430-4000-8000-000000000008';
do $disabled$
begin
  if public.document_entity_authorized('bitacora_task','10000000-4430-4000-8000-000000000001','view') then
    raise exception 'TEST 0443: usuario desactivado conserva Bitácora';
  end if;
end;
$disabled$;

set local "request.jwt.claim.sub" = 'aaaaaaaa-4430-4000-8000-000000000003';
do $regression$
declare
  v_blocked boolean := false;
begin
  if not public.document_entity_authorized('booking','10000000-4430-4000-8000-000000000001','edit')
     or not public.document_entity_authorized('supplier','10000000-4430-4000-8000-000000000001','edit')
     or public.document_entity_authorized('invoice','10000000-4430-4000-8000-000000000001','view')
     or public.document_entity_authorized('bitacora_task','20000000-4430-4000-8000-000000000002','view')
     or public.document_entity_authorized('bitacora_task','10000000-4430-4000-8000-000000000001','unknown') then
    raise exception 'TEST 0443: regresión previa, cruce de tenant o acción abierta';
  end if;
  begin
    insert into storage.objects values (
      '30000000-4430-4000-8000-000000000006', 'bitacora',
      '20000000-4430-4000-8000-000000000002/bitacora_task/40000000-4430-4000-8000-000000000001/cross.pdf'
    );
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  if not v_blocked then raise exception 'TEST 0443: bucket cruzó tenant'; end if;
end;
$regression$;
reset role;

rollback;
select true as bitacora_document_entity_rbac_0443_fixture_rolled_back;
