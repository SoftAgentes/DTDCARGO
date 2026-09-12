-- 0431 · SDD-0385 · Mensajes Portal por principal y tenant coherentes.
-- Sólo redefine public.portal_post_message(text). Sin tablas, filas, RLS ni
-- correlativos. Aplicación Cloud individual requiere autorización nominal.

do $preflight$
declare
  v_rpc oid := pg_catalog.to_regprocedure('public.portal_post_message(text)');
  v_table text;
begin
  if pg_catalog.to_regprocedure('auth.uid()') is null
    or pg_catalog.to_regprocedure('public.next_conversation_ref(uuid)') is null
    or v_rpc is null then
    raise exception '0431: helpers o RPC esperados ausentes';
  end if;

  foreach v_table in array array[
    'clients', 'client_users', 'conversations', 'conversation_messages'
  ] loop
    if not exists (
      select 1 from pg_catalog.pg_class
      where oid = pg_catalog.to_regclass('public.' || v_table)
        and relkind in ('r', 'p') and relrowsecurity
    ) then
      raise exception '0431: tabla ausente o sin RLS: %', v_table;
    end if;
  end loop;

  if not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid = v_rpc and p.prokind = 'f'
      and p.prorettype = 'uuid'::pg_catalog.regtype and p.prosecdef
  ) then
    raise exception '0431: firma, retorno o SECURITY DEFINER del RPC con drift';
  end if;

  if pg_catalog.has_function_privilege('anon', v_rpc, 'execute')
    or not pg_catalog.has_function_privilege('authenticated', v_rpc, 'execute')
    or not pg_catalog.has_function_privilege('service_role', v_rpc, 'execute')
    or exists (
      select 1
      from pg_catalog.pg_proc p,
        lateral pg_catalog.aclexplode(coalesce(
          p.proacl, pg_catalog.acldefault('f', p.proowner)
        )) a
      where p.oid = v_rpc and a.grantee = 0 and a.privilege_type = 'EXECUTE'
    ) then
    raise exception '0431: ACL efectivo del RPC con drift';
  end if;
end;
$preflight$;

create or replace function public.portal_post_message(p_body text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_client_id uuid;
  v_tenant uuid;
  v_name text;
  v_matches bigint;
  v_conv_id uuid;
  v_ref text;
  v_body text := pg_catalog.btrim(coalesce(p_body, ''));
begin
  if v_body = '' then
    raise exception 'El mensaje no puede estar vacío';
  end if;
  if pg_catalog.length(v_body) > 4000 then
    raise exception 'El mensaje es demasiado largo (máx 4000)';
  end if;

  -- Una sola resolución: sesión → vínculo activo → mismo tenant → cliente vivo.
  select principal.client_id, principal.tenant_id, principal.name, principal.matches
  into v_client_id, v_tenant, v_name, v_matches
  from (
    select cu.client_id, cu.tenant_id, c.name,
      pg_catalog.count(*) over () as matches
    from public.client_users cu
    join public.clients c
      on c.id = cu.client_id
     and c.tenant_id = cu.tenant_id
     and c.deleted_at is null
    where cu.auth_user_id = (select auth.uid())
      and cu.status = 'active'
  ) principal
  limit 1;

  if v_matches is distinct from 1 or v_client_id is null or v_tenant is null then
    raise exception 'No autorizado: la sesión no es un cliente válido del portal'
      using errcode = '42501';
  end if;

  select c.id into v_conv_id
  from public.conversations c
  where c.tenant_id = v_tenant and c.client_id = v_client_id
    and c.channel = 'portal' and c.deleted_at is null
  limit 1;

  if v_conv_id is null then
    v_ref := public.next_conversation_ref(v_tenant);
    insert into public.conversations (
      tenant_id, client_id, ref, channel, status, last_message_at, unread_count
    ) values (
      v_tenant, v_client_id, v_ref, 'portal', 'abierto', pg_catalog.now(), 0
    ) returning id into v_conv_id;
  end if;

  insert into public.conversation_messages (
    tenant_id, conversation_id, direction, author_name, body, sent_at
  ) values (
    v_tenant, v_conv_id, 'in', v_name, v_body, pg_catalog.now()
  );

  update public.conversations
  set last_message_at = pg_catalog.now(),
      unread_count = unread_count + 1,
      status = case when status = 'resuelto' then 'abierto' else status end
  where id = v_conv_id and tenant_id = v_tenant and client_id = v_client_id;

  return v_conv_id;
end;
$function$;

comment on function public.portal_post_message(text) is
  'SDD-0385: inbound Portal fail-closed. Resuelve auth.uid contra client_users activo y cliente vivo con tenant coherente; crea/reusa sólo su hilo Portal, inserta inbound, incrementa unread y reabre resuelto.';

revoke execute on function public.portal_post_message(text) from public, anon;
grant execute on function public.portal_post_message(text) to authenticated, service_role;

do $postflight$
declare
  v_rpc oid := pg_catalog.to_regprocedure('public.portal_post_message(text)');
  v_definition text;
begin
  select pg_catalog.lower(pg_catalog.pg_get_functiondef(p.oid))
  into v_definition
  from pg_catalog.pg_proc p
  where p.oid = v_rpc and p.prokind = 'f'
    and p.prorettype = 'uuid'::pg_catalog.regtype and p.prosecdef
    and p.proconfig = array['search_path=pg_catalog, public'];

  if v_definition is null
    or v_definition not like '%from public.client_users%'
    or v_definition not like '%c.tenant_id = cu.tenant_id%'
    or v_definition not like '%c.deleted_at is null%'
    or v_definition not like '%auth.uid()%'
    or v_definition like '%get_portal_client_id%' then
    raise exception '0431: definición endurecida del RPC no quedó instalada';
  end if;

  if pg_catalog.has_function_privilege('anon', v_rpc, 'execute')
    or not pg_catalog.has_function_privilege('authenticated', v_rpc, 'execute')
    or not pg_catalog.has_function_privilege('service_role', v_rpc, 'execute')
    or exists (
      select 1
      from pg_catalog.pg_proc p,
        lateral pg_catalog.aclexplode(coalesce(
          p.proacl, pg_catalog.acldefault('f', p.proowner)
        )) a
      where p.oid = v_rpc and a.grantee = 0 and a.privilege_type = 'EXECUTE'
    ) then
    raise exception '0431: ACL final del RPC no coincide con el contrato';
  end if;
end;
$postflight$;
