-- 0433 · SDD-0401 · Realtime Portal por principal y tenant coherentes.
-- Agrega una función booleana mínima y sustituye una policy SELECT. Sin DML,
-- cambios de ACL de tablas o acceso a contenido. Aplicación Cloud individual.

do $preflight$
declare v_table text; v_qual text;
begin
  if pg_catalog.to_regprocedure('auth.uid()') is null then
    raise exception '0433 requiere auth.uid()';
  end if;

  foreach v_table in array array[
    'clients', 'client_users', 'conversations', 'conversation_messages'
  ] loop
    if not exists (
      select 1 from pg_catalog.pg_class
      where oid = pg_catalog.to_regclass('public.' || v_table)
        and relkind in ('r', 'p') and relrowsecurity
    ) then
      raise exception '0433: tabla ausente o sin RLS: %', v_table;
    end if;
  end loop;

  if exists (
    with expected(policyname, cmd, role_name) as (values
      ('conversation_messages by tenant', 'ALL', 'authenticated'),
      ('conversation_messages service_role all', 'ALL', 'service_role'),
      ('conv_messages portal client read own', 'SELECT', 'authenticated')
    ), actual as (
      select * from pg_catalog.pg_policies
      where schemaname = 'public' and tablename = 'conversation_messages'
    )
    select 1 from expected e full join actual a using (policyname)
    where e.policyname is null or a.policyname is null
      or a.cmd <> e.cmd
      or a.roles <> array[e.role_name]::name[]
      or a.permissive <> 'PERMISSIVE'
  ) then
    raise exception '0433: inventario de policies ausente o con drift';
  end if;

  select qual into v_qual from pg_catalog.pg_policies
  where schemaname = 'public' and tablename = 'conversation_messages'
    and policyname = 'conv_messages portal client read own';
  if v_qual is null or v_qual not like '%get_portal_client_id%' then
    raise exception '0433: definición histórica de policy con drift';
  end if;
end;
$preflight$;

create or replace function public.portal_can_read_conversation_message(
  p_conversation_id uuid,
  p_message_tenant uuid
) returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.client_users cu
    join public.clients client
      on client.id = cu.client_id
     and client.tenant_id = cu.tenant_id
     and client.deleted_at is null
    join public.conversations conversation
      on conversation.client_id = cu.client_id
     and conversation.tenant_id = cu.tenant_id
     and conversation.channel = 'portal'
     and conversation.deleted_at is null
    where cu.auth_user_id = (select auth.uid())
      and cu.status = 'active'
      and conversation.id = p_conversation_id
      and conversation.tenant_id = p_message_tenant
  )
$function$;

revoke all on function public.portal_can_read_conversation_message(uuid, uuid)
  from public, anon, service_role;
grant execute on function public.portal_can_read_conversation_message(uuid, uuid)
  to authenticated;

comment on function public.portal_can_read_conversation_message(uuid, uuid) is
  'SDD-0401: autorización booleana de un mensaje Realtime del Portal. No devuelve contenido ni ids; exige principal activo, cliente vivo, tenant coherente y canal portal.';

alter policy "conv_messages portal client read own"
  on public.conversation_messages
  using (
    public.portal_can_read_conversation_message(conversation_id, tenant_id)
  );

do $postflight$
declare
  v_rpc oid := pg_catalog.to_regprocedure(
    'public.portal_can_read_conversation_message(uuid,uuid)'
  );
  v_definition text;
  v_qual text;
begin
  select pg_catalog.lower(pg_catalog.pg_get_functiondef(p.oid))
  into v_definition
  from pg_catalog.pg_proc p
  where p.oid = v_rpc and p.prokind = 'f'
    and p.prorettype = 'boolean'::pg_catalog.regtype
    and p.prosecdef and p.provolatile = 's'
    and exists (
      select 1
      from pg_catalog.unnest(coalesce(p.proconfig, '{}'::text[])) config
      where config ~ '^search_path=("")?$'
    );

  if v_definition is null
     or v_definition not like '%from public.client_users%'
     or v_definition not like '%client.tenant_id = cu.tenant_id%'
     or v_definition not like '%conversation.tenant_id = cu.tenant_id%'
     or v_definition not like '%conversation.tenant_id = p_message_tenant%'
     or v_definition not like '%conversation.channel = ''portal''%'
     or v_definition not like '%auth.uid()%'
     or v_definition not like '%client.deleted_at is null%'
     or v_definition not like '%conversation.deleted_at is null%' then
    raise exception '0433: helper booleana final inválida';
  end if;

  if pg_catalog.has_function_privilege('anon', v_rpc, 'execute')
     or not pg_catalog.has_function_privilege('authenticated', v_rpc, 'execute')
     or pg_catalog.has_function_privilege('service_role', v_rpc, 'execute')
     or exists (
       select 1 from pg_catalog.pg_proc p,
         lateral pg_catalog.aclexplode(coalesce(
           p.proacl, pg_catalog.acldefault('f', p.proowner)
         )) a
       where p.oid = v_rpc and a.grantee = 0 and a.privilege_type = 'EXECUTE'
     ) then
    raise exception '0433: ACL final de helper booleana inválida';
  end if;

  select qual into v_qual from pg_catalog.pg_policies
  where schemaname = 'public' and tablename = 'conversation_messages'
    and policyname = 'conv_messages portal client read own'
    and cmd = 'SELECT' and roles = array['authenticated']::name[];
  if v_qual is null
     or v_qual not like '%portal_can_read_conversation_message%'
     or v_qual like '%get_portal_client_id%' then
    raise exception '0433: policy Realtime final inválida';
  end if;
end;
$postflight$;
