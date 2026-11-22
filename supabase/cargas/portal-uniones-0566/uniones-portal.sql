-- supabase/cargas/portal-uniones-0566/uniones-portal.sql — SDD-0676, relleno posterior a la 0566.
--
-- ⚠️ NO ES UNA MIGRACIÓN y no entra al ledger: no cambia esquema, ESCRIBE FILAS. La 0566 deja el
--    registro único de vínculos (chatwoot_contact_links) listo para el chat del portal, pero NO migra los
--    contactos del portal que ya existían: eso lo hace este archivo, con un OK de Sam APARTE del de la
--    0566. Requiere la 0566 aplicada. Pasos y órdenes exactas: README.md de esta carpeta.
--
-- Qué hace `pg_temp.rellenar_uniones_portal(tenant, esperadas)`, todo o nada:
--   1. Por cada fila de chatwoot_portal_contactos con contacto de Chatwoot y ficha viva, crea su unión en
--      chatwoot_contact_links (origen y canal «portal»), si ese contacto todavía no tiene ninguna.
--   2. Audita cada unión creada (entity_audit_log, actor «system»), como hace chatwoot_portal_vincular.
--   3. Anota el contacto en las conversaciones del portal que no lo tienen (chatwoot_conversations.
--      chat_contact_id), siguiendo chatwoot_portal_hilos.
--   Si las uniones creadas no son exactamente `esperadas` (el número que dio el conteo), aborta.
--
-- Qué NO hace: no toca una unión que ya existe (aunque apunte a otra ficha: la informa el conteo, para
-- que una persona la resuelva), no crea uniones de fichas borradas, no cambia client_id de ninguna
-- conversación y no llama a Chatwoot.
--
-- Idempotente: la segunda vez no crea nada (esperadas = 0) y no vuelve a auditar.
-- No hace falta para que el portal siga funcionando: con la 0566 ningún evento le quita el cliente a una
-- conversación. Sirve para que el contacto del portal se reconozca por su unión, igual que los demás, y
-- para que la ficha del cliente muestre el chip «Portal».
--
-- Datos personales: lee y escribe solo ids (tenant, ficha, contacto, conversación). Devuelve conteos.
--
-- Ensayo: lib/studio/__tests__/chatwoot-vincular-canal.migration.test.ts («relleno de uniones del portal»).

-- ─── Conteo previo (solo lectura) ────────────────────────────────────────────
create or replace function pg_temp.contar_uniones_portal(p_tenant_id uuid)
returns table (dato text, cuantos bigint)
language sql
stable
as $function$
  with portal as (
    select k.client_id, k.chatwoot_contact_id, c.deleted_at is null as viva
    from public.chatwoot_portal_contactos k
    join public.clients c on c.id = k.client_id and c.tenant_id = k.tenant_id
    where k.tenant_id = p_tenant_id and k.chatwoot_contact_id is not null
  ), cruzado as (
    select p.*, l.client_id as unido_a, l.origen
    from portal p
    left join public.chatwoot_contact_links l on l.chatwoot_contact_id = p.chatwoot_contact_id
  )
  select '1. contactos del portal con contacto de Chatwoot', count(*) from cruzado
  union all
  select '2. ya unidos a su ficha (no se tocan)', count(*) from cruzado where unido_a = client_id
  union all
  select '3. unidos a OTRA ficha (no se tocan; los resuelve una persona)', count(*) from cruzado
    where unido_a is not null and unido_a <> client_id
  union all
  select '4. de una ficha borrada (no se crean)', count(*) from cruzado where unido_a is null and not viva
  union all
  select '5. ESPERADAS: uniones que el relleno va a crear', count(*) from cruzado where unido_a is null and viva
  union all
  select '6. conversaciones del portal sin contacto anotado', count(*)
  from public.chatwoot_portal_hilos h
  join public.conversations t on t.id = h.conversation_id and t.tenant_id = h.tenant_id
  join public.chatwoot_portal_contactos k on k.tenant_id = h.tenant_id and k.client_id = t.client_id
  join public.chatwoot_conversations cc on cc.tenant_id = h.tenant_id and cc.conversation_id = h.chatwoot_conversation_id
  where h.tenant_id = p_tenant_id and k.chatwoot_contact_id is not null and cc.chat_contact_id is null
  order by 1;
$function$;

-- ─── El relleno ──────────────────────────────────────────────────────────────
create or replace function pg_temp.rellenar_uniones_portal(p_tenant_id uuid, p_esperadas integer)
returns setof text
language plpgsql
as $function$
declare
  r           record;
  v_creadas   integer := 0;
  v_anotadas  integer := 0;
begin
  if p_tenant_id is null or p_esperadas is null or p_esperadas < 0 then
    raise exception 'relleno 0566: faltan el tenant o las uniones esperadas (el dato 5 del conteo)';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid = 'public.chatwoot_contact_links'::regclass and attname = 'canal_chat' and not attisdropped
  ) or not exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid = 'public.chatwoot_conversations'::regclass and attname = 'chat_contact_id' and not attisdropped
  ) then
    raise exception 'relleno 0566: falta la migración 0566';
  end if;

  for r in
    select k.client_id, k.chatwoot_contact_id
    from public.chatwoot_portal_contactos k
    join public.clients c on c.id = k.client_id and c.tenant_id = k.tenant_id and c.deleted_at is null
    where k.tenant_id = p_tenant_id
      and k.chatwoot_contact_id is not null
      and not exists (
        select 1 from public.chatwoot_contact_links l where l.chatwoot_contact_id = k.chatwoot_contact_id
      )
    order by k.chatwoot_contact_id
  loop
    insert into public.chatwoot_contact_links (tenant_id, client_id, chatwoot_contact_id, origen, created_by, canal_chat)
    values (p_tenant_id, r.client_id, r.chatwoot_contact_id, 'portal', null, 'portal');
    perform public.append_audit_event(
      p_tenant_id, 'chatwoot_contact_link', r.client_id, 'system', null,
      'chatwoot_contact_linked', 'rpc', 'succeeded', 'Relleno de la 0566: el contacto del portal queda unido a su ficha',
      null,
      pg_catalog.jsonb_build_object('chatwoot_contact_id', r.chatwoot_contact_id, 'origen', 'portal', 'canal', 'portal'),
      pg_catalog.jsonb_build_object('relleno', '0566'),
      pg_catalog.concat('chatwoot-contact-link:', r.client_id::text, ':', r.chatwoot_contact_id::text, ':relleno-0566:', pg_catalog.txid_current()::text),
      1,
      'internal'
    );
    v_creadas := v_creadas + 1;
  end loop;

  if v_creadas <> p_esperadas then
    raise exception 'relleno 0566: se esperaban % uniones y salieron %. No se guardó nada: corre el conteo de nuevo.', p_esperadas, v_creadas;
  end if;

  update public.chatwoot_conversations cc
  set chat_contact_id = k.chatwoot_contact_id
  from public.chatwoot_portal_hilos h
  join public.conversations t on t.id = h.conversation_id and t.tenant_id = h.tenant_id
  join public.chatwoot_portal_contactos k on k.tenant_id = h.tenant_id and k.client_id = t.client_id
  where h.tenant_id = p_tenant_id
    and cc.tenant_id = h.tenant_id
    and cc.conversation_id = h.chatwoot_conversation_id
    and k.chatwoot_contact_id is not null
    and cc.chat_contact_id is null;
  get diagnostics v_anotadas = row_count;

  return next pg_catalog.format('HECHO uniones del portal creadas: %s', v_creadas);
  return next pg_catalog.format('HECHO conversaciones del portal con su contacto anotado: %s', v_anotadas);
end;
$function$;
