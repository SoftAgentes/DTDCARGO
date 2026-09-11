-- SDD-0377. Comando estrecho de borrado lógico Portal; sólo revisión local.
-- No amplía SELECT de históricos ni las políticas/grants de las tablas.
set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
declare v_table text;
begin
  if pg_catalog.to_regnamespace('portal_address_private') is not null
     or exists(select from pg_catalog.pg_proc
       where pronamespace='public'::regnamespace and proname='delete_portal_delivery_address') then
    raise exception '0427: namespace o RPC ya existe; revisar sin reemplazar';
  end if;
  foreach v_table in array array['clients','client_users','client_delivery_addresses',
    'entity_audit_log','audit_entity_types'] loop
    if not exists(select from pg_catalog.pg_class c join pg_catalog.pg_namespace n
      on n.oid=c.relnamespace where n.nspname='public' and c.relname=v_table and c.relrowsecurity) then
      raise exception '0427: requiere tabla con RLS public.%', v_table;
    end if;
  end loop;
  if pg_catalog.to_regprocedure('auth.uid()') is null or
     pg_catalog.to_regprocedure('public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)') is null then
    raise exception '0427: requiere auth.uid y writer audit 0267/0294';
  end if;
  if not exists(select from pg_catalog.pg_proc where
    oid='public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'::regprocedure
    and prosecdef and proowner='postgres'::regrole and proconfig @> array['search_path=""']) then
    raise exception '0427: writer audit no conserva owner/contexto seguro';
  end if;
  if exists(select from public.audit_entity_types where entity_type='client_delivery_address') then
    raise exception '0427: tipo audit ya registrado; revisar su procedencia';
  end if;
end;
$preflight$;

insert into public.audit_entity_types(entity_type, domain_code, introduced_by_ref)
values ('client_delivery_address', 'clients', 'migration:0427');

create schema portal_address_private authorization postgres;
revoke all on schema portal_address_private from public, anon, authenticated, service_role;
grant usage on schema portal_address_private to authenticated;

create function portal_address_private.delete_delivery_address(
  p_address_id uuid, p_correlation_id uuid
) returns boolean
language plpgsql
security definer
set search_path = ''
set lock_timeout = '2s'
as $function$
declare
  v_actor uuid := auth.uid();
  v_client_id uuid;
  v_tenant_id uuid;
  v_markbox text;
  v_address public.client_delivery_addresses%rowtype;
  v_deleted_at timestamptz;
  v_before jsonb;
  v_after jsonb;
  v_event uuid;
  v_reason text := pg_catalog.current_setting('dtd.audit_reason', true);
begin
  if p_address_id is null or p_correlation_id is null then
    raise exception '0427: identificadores requeridos' using errcode='22023';
  end if;
  if v_actor is null then return false; end if;

  -- SHARE bloquea también revocaciones/renombres no-key hasta el commit.
  select cu.client_id, cu.tenant_id into v_client_id, v_tenant_id
  from public.client_users cu
  where cu.auth_user_id=v_actor and cu.status='active'
  for share;
  if not found then return false; end if;

  select c.markbox into v_markbox from public.clients c
  where c.id=v_client_id and c.tenant_id=v_tenant_id and c.deleted_at is null
  for share;
  if not found then return false; end if;

  select a.* into v_address from public.client_delivery_addresses a
  where a.id=p_address_id and a.client_id=v_client_id
    and a.tenant_id=v_tenant_id and a.client_markbox=v_markbox
  for update;
  if not found then return false; end if;
  if v_address.deleted_at is not null then return true; end if;

  v_before := pg_catalog.jsonb_build_object('deleted_at', v_address.deleted_at,
    'is_default', v_address.is_default);
  update public.client_delivery_addresses set deleted_at=pg_catalog.clock_timestamp()
  where id=v_address.id
  returning deleted_at into v_deleted_at;
  if not found or v_deleted_at is null then
    raise exception '0427: borrado no confirmado' using errcode='23514';
  end if;
  v_after := pg_catalog.jsonb_build_object('deleted_at', v_deleted_at,
    'is_default', v_address.is_default);

  -- 0294 prioriza un GUC transaccional: no permitir que contenido arbitrario
  -- del caller sustituya la intención fija R2 o introduzca datos postales.
  perform pg_catalog.set_config('dtd.audit_reason', '', true);
  v_event := public.append_audit_event(
    p_tenant_id=>v_tenant_id, p_entity_type=>'client_delivery_address',
    p_entity_id=>v_address.id, p_actor_type=>'user', p_actor_id=>v_actor,
    p_event_type=>'portal_delivery_address_deleted', p_source=>'rpc',
    p_result=>'succeeded', p_reason=>'Solicitud del titular desde el Portal',
    p_before_data=>v_before, p_after_data=>v_after,
    p_payload=>pg_catalog.jsonb_build_object('surface','portal','permanence','P2',
      'recovery','support_review_required','consequence','removed_from_active_addresses',
      'related_files','[]'::jsonb),
    p_correlation_id=>p_correlation_id::text, p_schema_version=>1,
    p_sensitivity=>'restricted'
  );
  perform pg_catalog.set_config('dtd.audit_reason', coalesce(v_reason,''), true);
  if v_event is null or not exists(select from public.entity_audit_log e
    where e.id=v_event and e.tenant_id=v_tenant_id and e.entity_id=v_address.id
      and e.entity_type='client_delivery_address' and e.actor_type='user'
      and e.actor_id=v_actor and e.event_type='portal_delivery_address_deleted'
      and e.source='rpc' and e.result='succeeded'
      and e.correlation_id=p_correlation_id::text
      and e.before_data=v_before and e.after_data=v_after) then
    raise exception '0427: auditoría no confirmada' using errcode='23514';
  end if;
  return true;
end;
$function$;

alter function portal_address_private.delete_delivery_address(uuid,uuid) owner to postgres;
revoke all on function portal_address_private.delete_delivery_address(uuid,uuid)
  from public, anon, authenticated, service_role;
grant execute on function portal_address_private.delete_delivery_address(uuid,uuid)
  to authenticated;

create function public.delete_portal_delivery_address(p_address_id uuid, p_correlation_id uuid)
returns boolean language sql security invoker set search_path = ''
as $function$
  select portal_address_private.delete_delivery_address(p_address_id, p_correlation_id);
$function$;
alter function public.delete_portal_delivery_address(uuid,uuid) owner to postgres;
revoke all on function public.delete_portal_delivery_address(uuid,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.delete_portal_delivery_address(uuid,uuid) to authenticated;

comment on function public.delete_portal_delivery_address(uuid,uuid) is
  'SDD-0377: borrado lógico propio + auditoría atómica; históricos siguen ocultos; idempotente.';
comment on schema portal_address_private is
  'SDD-0377: no exponer en PostgREST; comandos privados sellados, sin CREATE para roles API.';

do $postflight$
declare v_function regprocedure;
begin
  foreach v_function in array array[
    'public.delete_portal_delivery_address(uuid,uuid)'::regprocedure,
    'portal_address_private.delete_delivery_address(uuid,uuid)'::regprocedure
  ] loop
    if not pg_catalog.has_function_privilege('authenticated',v_function,'EXECUTE')
       or pg_catalog.has_function_privilege('anon',v_function,'EXECUTE')
       or pg_catalog.has_function_privilege('service_role',v_function,'EXECUTE')
       or exists(select from pg_catalog.pg_proc p,
         lateral pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f',p.proowner))) a
         where p.oid=v_function and
           (a.grantee not in (p.proowner,'authenticated'::regrole) or a.is_grantable)) then
      raise exception '0427: ACL de función inválida';
    end if;
  end loop;
  if pg_catalog.has_schema_privilege('authenticated','portal_address_private','CREATE')
     or pg_catalog.has_schema_privilege('anon','portal_address_private','USAGE')
     or pg_catalog.has_schema_privilege('service_role','portal_address_private','USAGE')
     or exists(select from pg_catalog.pg_namespace n,
       lateral pg_catalog.aclexplode(n.nspacl) a
       where n.nspname='portal_address_private' and
         (a.grantee not in(n.nspowner,'authenticated'::regrole) or a.is_grantable
           or (a.grantee='authenticated'::regrole and a.privilege_type<>'USAGE'))) then
    raise exception '0427: ACL de schema inválida';
  end if;
end;
$postflight$;
reset statement_timeout;
reset lock_timeout;
