-- ─────────────────────────────────────────────────────────────
-- 0512 · SDD-0599 — Reintentar un envío del portal no lo duplica.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Aplicar exige OK de Sam NOMBRANDO este archivo
--    (docs/runbooks/aplicar-migraciones-prod.md). Va antes que el código que la
--    usa (migrate-first), y después de la salida a producción en curso.
--
-- ── El hueco ─────────────────────────────────────────────────
-- Si se pierde la respuesta de un envío, el cliente no sabe si llegó. Al reenviar,
-- cada acción crea otra fila con otro correlativo. En compras es peor: el trigger
-- de 0244 crea además las cajas esperadas, con su código definitivo.
--
-- ── El arreglo ───────────────────────────────────────────────
-- · prealertas, quotes y client_claims: identificador del intento que genera el
--   navegador, con índice único parcial. El candado entra junto con la fila, así
--   que dos intentos simultáneos no pueden pasar los dos. Va por Shipping Mark: el
--   mismo identificador en otro cliente no choca ni revela nada.
-- · conversation_messages ya tiene external_msg_id y su índice único (0106), hecho
--   para esto. La firma nueva de portal_post_message, escrita desde la última
--   definición (0431), lo usa y dice si el mensaje ya estaba.
-- · La firma vieja queda viva: la web anterior la sigue llamando hasta publicar. Se
--   retira en otra migración.
--
-- ── Qué toca ─────────────────────────────────────────────────
-- Sin cambios de filas, RLS ni grants: las policies de estas tablas son por fila, y
-- sus privilegios, de tabla (0007, 0105, 0152). ADD COLUMN nullable sin default sólo
-- toca metadatos. Cada índice bloquea escrituras de su tabla mientras la recorre; con
-- la columna recién creada, todas las filas quedan fuera del índice.
-- ─────────────────────────────────────────────────────────────

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
declare
  v_table text;
  v_type text;
  v_default boolean;
  v_rpc oid := pg_catalog.to_regprocedure('public.portal_post_message(text)');
begin
  foreach v_table in array array[
    'prealertas', 'quotes', 'client_claims',
    'clients', 'client_users', 'conversations', 'conversation_messages'
  ] loop
    if not exists (
      select 1 from pg_catalog.pg_class
      where oid = pg_catalog.to_regclass('public.' || v_table)
        and relkind in ('r', 'p') and relrowsecurity
    ) then
      raise exception '0512: tabla ausente o sin RLS: %', v_table;
    end if;
  end loop;

  foreach v_table in array array['prealertas', 'quotes', 'client_claims'] loop
    if (
      select pg_catalog.count(*) from pg_catalog.pg_attribute
      where attrelid = pg_catalog.to_regclass('public.' || v_table)
        and attname in ('tenant_id', 'client_markbox') and not attisdropped
    ) <> 2 then
      raise exception '0512: % no tiene tenant_id y client_markbox', v_table;
    end if;

    select pg_catalog.format_type(a.atttypid, a.atttypmod), a.atthasdef
    into v_type, v_default
    from pg_catalog.pg_attribute a
    where a.attrelid = pg_catalog.to_regclass('public.' || v_table)
      and a.attname = 'client_request_id' and not a.attisdropped;
    if v_type is not null and (v_type <> 'uuid' or v_default) then
      raise exception '0512: %.client_request_id ya existe con otra forma', v_table;
    end if;
  end loop;

  if coalesce(pg_catalog.pg_get_indexdef(
       pg_catalog.to_regclass('public.conversation_messages_external_idx')
     ), '') not like 'CREATE UNIQUE INDEX %(tenant_id, external_msg_id) WHERE (external_msg_id IS NOT NULL)' then
    raise exception '0512: índice único de external_msg_id ausente o distinto de 0106';
  end if;

  if pg_catalog.to_regprocedure('auth.uid()') is null
    or pg_catalog.to_regprocedure('public.next_conversation_ref(uuid)') is null
    or v_rpc is null
    or not exists (
      select 1 from pg_catalog.pg_proc p
      where p.oid = v_rpc and p.prosecdef and p.prorettype = 'uuid'::pg_catalog.regtype
    ) then
    raise exception '0512: helpers o RPC de 0431 ausentes o con drift';
  end if;
end;
$preflight$;

alter table public.prealertas add column if not exists client_request_id uuid;
alter table public.quotes add column if not exists client_request_id uuid;
alter table public.client_claims add column if not exists client_request_id uuid;

create unique index if not exists prealertas_client_request_uidx
  on public.prealertas (tenant_id, client_markbox, client_request_id)
  where client_request_id is not null;
create unique index if not exists quotes_client_request_uidx
  on public.quotes (tenant_id, client_markbox, client_request_id)
  where client_request_id is not null;
create unique index if not exists client_claims_client_request_uidx
  on public.client_claims (tenant_id, client_markbox, client_request_id)
  where client_request_id is not null;

comment on column public.prealertas.client_request_id is
  'SDD-0599: identificador del intento, generado en el navegador. Un reintento encuentra la fila en vez de crear otra. NULL: envío sin identificador o anterior a 0512.';
comment on column public.quotes.client_request_id is
  'SDD-0599: identificador del intento, generado en el navegador. Un reintento encuentra la fila en vez de crear otra. NULL: envío sin identificador o anterior a 0512.';
comment on column public.client_claims.client_request_id is
  'SDD-0599: identificador del intento, generado en el navegador. Un reintento encuentra la fila en vez de crear otra. NULL: envío sin identificador o anterior a 0512.';

create or replace function public.portal_post_message(p_body text, p_request_id uuid)
returns jsonb
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
  v_message_id uuid;
  v_external text;
  v_body text := pg_catalog.btrim(coalesce(p_body, ''));
begin
  if p_request_id is null then
    raise exception 'Falta el identificador del intento' using errcode = '22023';
  end if;
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

  -- El índice de 0106 es por tenant: el cliente va en el valor, para que el mismo
  -- identificador en otro cliente no choque ni le diga que ya existe.
  v_external := 'portal:' || v_client_id::text || ':' || p_request_id::text;

  -- Antes de crear nada: un reintento no abre hilo ni gasta correlativo.
  select m.conversation_id into v_conv_id
  from public.conversation_messages m
  where m.tenant_id = v_tenant and m.external_msg_id = v_external;
  if v_conv_id is not null then
    return pg_catalog.jsonb_build_object('conversation_id', v_conv_id, 'replayed', true);
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

  -- Dos intentos a la vez: el segundo espera al primero y no inserta.
  insert into public.conversation_messages (
    tenant_id, conversation_id, direction, author_name, body, sent_at, external_msg_id
  ) values (
    v_tenant, v_conv_id, 'in', v_name, v_body, pg_catalog.now(), v_external
  )
  on conflict (tenant_id, external_msg_id) where external_msg_id is not null do nothing
  returning id into v_message_id;

  if v_message_id is null then
    return pg_catalog.jsonb_build_object('conversation_id', v_conv_id, 'replayed', true);
  end if;

  update public.conversations
  set last_message_at = pg_catalog.now(),
      unread_count = unread_count + 1,
      status = case when status = 'resuelto' then 'abierto' else status end
  where id = v_conv_id and tenant_id = v_tenant and client_id = v_client_id;

  return pg_catalog.jsonb_build_object('conversation_id', v_conv_id, 'replayed', false);
end;
$function$;

comment on function public.portal_post_message(text, uuid) is
  'SDD-0599: como portal_post_message(text) de 0431, pero un reintento con el mismo identificador no crea otro mensaje ni suma un no leído, y responde {conversation_id, replayed}.';

revoke execute on function public.portal_post_message(text, uuid) from public, anon;
grant execute on function public.portal_post_message(text, uuid) to authenticated, service_role;

do $postflight$
declare
  v_table text;
  v_rpc oid := pg_catalog.to_regprocedure('public.portal_post_message(text, uuid)');
begin
  foreach v_table in array array['prealertas', 'quotes', 'client_claims'] loop
    if coalesce(pg_catalog.pg_get_indexdef(
         pg_catalog.to_regclass('public.' || v_table || '_client_request_uidx')
       ), '') not like 'CREATE UNIQUE INDEX %(tenant_id, client_markbox, client_request_id) WHERE (client_request_id IS NOT NULL)' then
      raise exception '0512: índice de % no quedó instalado', v_table;
    end if;
  end loop;

  if not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid = v_rpc and p.prosecdef and p.prorettype = 'jsonb'::pg_catalog.regtype
      and p.proconfig = array['search_path=pg_catalog, public']
  ) then
    raise exception '0512: firma nueva del RPC no quedó instalada';
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
    raise exception '0512: ACL final del RPC no coincide con el contrato';
  end if;

  -- La web anterior sigue usando esta firma hasta publicar.
  if pg_catalog.to_regprocedure('public.portal_post_message(text)') is null then
    raise exception '0512: la firma vieja del RPC tiene que seguir viva';
  end if;
end;
$postflight$;
