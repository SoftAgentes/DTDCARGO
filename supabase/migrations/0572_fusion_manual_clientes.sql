-- 0572_fusion_manual_clientes.sql — SDD-0712
--
-- BÚSQUEDA AMPLIA Y FUSIÓN MANUAL DE CLIENTES.
-- ⚠️ ESCRITA, NO APLICADA. Aplicarla en producción pide el OK nominal de Sam y el
-- runbook docs/runbooks/aplicar-migraciones-prod.md.
--
-- POR QUÉ NO SE TOCA `merge_clients`. Ya sirve para dos fichas cualesquiera
-- (el superviviente lo elige quien llama) y se ha reescrito tres veces con
-- tropiezos (ver la cabecera de la 0361: una copia vieja borró en silencio el
-- candado de rol). Aquí solo se AGREGAN tres funciones que la rodean:
--
--   1. client_search_for_merge(p_q)       busca en TODA la base del tenant, sin
--                                         acentos ni mayúsculas, por Shipping Mark
--                                         (también los códigos anteriores),
--                                         nombre, correo, teléfono y documento.
--   2. client_merge_preview(s, m)         vista previa: datos de contacto, conteos
--                                         y avisos de las dos fichas. Solo lee.
--                                         SIN montos.
--   3. merge_clients_manual(s, m, motivo, confirmar)
--                                         exige motivo, exige escribir el Shipping
--                                         Mark que se anula, fija dtd.audit_reason
--                                         (el trigger de la 0455 ya escribe
--                                         `client_merged` y toma ese motivo) y deja
--                                         además un evento `client_merge_manual`
--                                         en la ficha que se queda, con el par.
--
-- Las tres: SECURITY DEFINER, search_path vacío, tenant de la SESIÓN (nunca por
-- parámetro), rol de la matriz `clients` vía assert_studio_role, anon sin
-- EXECUTE. Los aliados quedan fuera: la búsqueda no los devuelve y el trigger de
-- la 0362 (§9) impide fusionarlos aunque alguien llame la RPC directo.

set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
begin
  if pg_catalog.to_regprocedure('public.merge_clients(uuid,uuid)') is null then
    raise exception '0572 requiere public.merge_clients(uuid,uuid) (0361)';
  end if;
  if pg_catalog.to_regprocedure('public.assert_studio_role(text[])') is null then
    raise exception '0572 requiere public.assert_studio_role(text[]) (0351)';
  end if;
  if pg_catalog.to_regprocedure('public.get_user_tenant_id()') is null then
    raise exception '0572 requiere public.get_user_tenant_id()';
  end if;
  if pg_catalog.to_regclass('public.client_markbox_history') is null then
    raise exception '0572 requiere public.client_markbox_history (0367)';
  end if;
  if pg_catalog.to_regprocedure(
       'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)') is null then
    raise exception '0572 requiere public.append_audit_event (0267/0294)';
  end if;
  if not exists (select 1 from public.audit_entity_types
                  where entity_type = 'client' and status = 'active') then
    raise exception '0572 abortada: el tipo de entidad client no está activo; cada fusión fallaría';
  end if;
end;
$preflight$;

-- ── 1. Normalizador de búsqueda ──────────────────────────────────────────────
-- No hay `unaccent` instalada en el proyecto: se baja a minúsculas y se cambian
-- las vocales acentuadas y la ñ. Suficiente para nombres en español. Las
-- mayúsculas acentuadas van también en la tabla: `lower()` no las baja si la
-- base corre con locale C.
create or replace function public.norm_busqueda(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.translate(pg_catalog.lower(coalesce(p_text, '')),
                              'áàäâéèëêíìïîóòöôúùüûñÁÀÄÂÉÈËÊÍÌÏÎÓÒÖÔÚÙÜÛÑ',
                              'aaaaeeeeiiiioooouuuunaaaaeeeeiiiioooouuuun');
$$;

revoke all on function public.norm_busqueda(text) from public, anon;
grant execute on function public.norm_busqueda(text) to authenticated;

-- ── 2. Búsqueda en toda la base del tenant ───────────────────────────────────
-- Dos formas de comparar: el texto normalizado (nombre, correo) y el texto sin
-- separadores (`v_alnum`), para que «dtd 9001», «DTD9001» y «V19695856» encuentren
-- «DTD-9001» y «V-19.695.856».
create or replace function public.client_search_for_merge(p_q text)
returns table (
  client_id uuid,
  markbox text,
  nombre text,
  email text,
  phone text,
  rif text,
  created_at timestamptz,
  matched_by text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_q text := public.norm_busqueda(pg_catalog.btrim(coalesce(p_q, '')));
  v_digits text := pg_catalog.regexp_replace(coalesce(p_q, ''), '[^0-9]', '', 'g');
  v_alnum text;
  v_like text;
  v_like_alnum text;
  v_like_tel text;
begin
  perform public.assert_studio_role(
    array['admin', 'commercial', 'operations', 'accounting', 'support']
  );
  v_tenant := public.get_user_tenant_id();
  if v_tenant is null or pg_catalog.char_length(v_q) < 2 then
    return;
  end if;

  -- Los comodines del usuario son texto, no patrón.
  v_like := '%' || pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(
              v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  -- Sin separadores: solo letras y dígitos, así que no quedan comodines. Menos
  -- de 3 caracteres no busca por código ni documento (traería media base).
  v_alnum := pg_catalog.regexp_replace(v_q, '[^a-z0-9]', '', 'g');
  v_like_alnum := case when pg_catalog.char_length(v_alnum) >= 3 then '%' || v_alnum || '%' end;
  v_like_tel := case when pg_catalog.char_length(v_digits) >= 4 then '%' || v_digits || '%' end;

  return query
  select f.id, f.markbox, f.name, f.email, f.phone, f.rif, f.created_at,
         pg_catalog.array_remove(array[
           case when f.por_codigo then 'Shipping Mark' end,
           case when f.por_nombre then 'nombre' end,
           case when f.por_correo then 'correo' end,
           case when f.por_telefono then 'teléfono' end,
           case when f.por_documento then 'documento' end
         ], null)
    from (
      select c.id, c.markbox, c.name, c.email, c.phone, c.rif, c.created_at,
             (pg_catalog.regexp_replace(public.norm_busqueda(c.markbox), '[^a-z0-9]', '', 'g') like v_like_alnum
              or exists (select 1 from public.client_markbox_history h
                          where h.client_id = c.id and h.tenant_id = v_tenant
                            and pg_catalog.regexp_replace(public.norm_busqueda(h.markbox), '[^a-z0-9]', '', 'g')
                                like v_like_alnum)) is true                                   as por_codigo,
             public.norm_busqueda(c.name) like v_like escape '\'                              as por_nombre,
             public.norm_busqueda(c.email) like v_like escape '\'                             as por_correo,
             (pg_catalog.regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g') like v_like_tel) is true
                                                                                              as por_telefono,
             (pg_catalog.regexp_replace(public.norm_busqueda(c.rif), '[^a-z0-9]', '', 'g') like v_like_alnum) is true
                                                                                              as por_documento
        from public.clients c
       where c.tenant_id = v_tenant
         and c.deleted_at is null
         and c.merged_into_client_id is null
         and c.aliado_id is null
    ) f
   where f.por_codigo or f.por_nombre or f.por_correo or f.por_telefono or f.por_documento
   order by (pg_catalog.regexp_replace(public.norm_busqueda(f.markbox), '[^a-z0-9]', '', 'g') = v_alnum) desc,
            f.por_codigo desc,
            (public.norm_busqueda(f.name) like v_q || '%' escape '\') desc,
            f.name, f.markbox
   limit 25;
end;
$$;

comment on function public.client_search_for_merge(text) is
  'SDD-0712: busca clientes vivos del tenant de la sesión por Shipping Mark (incluye códigos anteriores), nombre, correo, teléfono (>=4 dígitos) y documento, sin acentos, mayúsculas ni separadores. Tope 25. Excluye aliados, borrados y fusionados.';

revoke all on function public.client_search_for_merge(text) from public, anon;
grant execute on function public.client_search_for_merge(text) to authenticated;

-- ── 3. Vista previa de la fusión ─────────────────────────────────────────────
-- Solo lee. Trae de cada ficha lo que el operador necesita para decidir si son
-- la misma persona (documento, correo, teléfono: lo mismo que ya ve en el
-- listado de Clientes), conteos y avisos. Nunca montos.
--
-- LOS AVISOS DEL PORTAL CALCAN A `merge_clients` (0361 §5.1), que mira si la
-- ficha tiene FILA en client_users, esté activa o revocada:
--   · la que se anula tiene fila y la que se queda NO  → el acceso se muda;
--   · las dos tienen fila                               → el de la que se anula se
--     revoca. Si además la fila de la que se queda ya estaba revocada, NADIE queda
--     con acceso (`portalLost`): conviene invertir cuál se queda.
create or replace function public.client_merge_preview(p_survivor_id uuid, p_merged_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  s record;
  m record;
  v_blockers text[] := '{}';
  v_sides jsonb := '{}'::jsonb;
  v_side jsonb;
  v_c record;
  v_s_fila boolean;
  v_s_activo boolean;
  v_m_activo boolean;
  v_mismo_doc boolean;
  v_mismo_correo boolean;
  v_mismo_tel boolean;
  v_mismo_nombre boolean;
begin
  perform public.assert_studio_role(
    array['admin', 'commercial', 'operations', 'accounting', 'support']
  );
  v_tenant := public.get_user_tenant_id();
  if v_tenant is null or p_survivor_id is null or p_merged_id is null then
    raise exception 'Hacen falta las dos fichas para ver la vista previa' using errcode = '22023';
  end if;
  if p_survivor_id = p_merged_id then
    raise exception 'No se puede fusionar un cliente consigo mismo' using errcode = '22023';
  end if;

  select * into s from public.clients where id = p_survivor_id and tenant_id = v_tenant;
  select * into m from public.clients where id = p_merged_id and tenant_id = v_tenant;
  if s.id is null or m.id is null then
    raise exception 'No existe alguna de las dos fichas' using errcode = 'P0002';
  end if;

  if s.deleted_at is not null or m.deleted_at is not null then
    v_blockers := pg_catalog.array_append(v_blockers, 'Alguna de las fichas está eliminada.'::text);
  end if;
  if s.merged_into_client_id is not null or m.merged_into_client_id is not null then
    v_blockers := pg_catalog.array_append(v_blockers, 'Alguna de las fichas ya fue fusionada.'::text);
  end if;
  if s.aliado_id is not null or m.aliado_id is not null
     or exists (select 1 from public.aliados a
                 where a.client_id in (s.id, m.id) and a.deleted_at is null) then
    v_blockers := pg_catalog.array_append(v_blockers, 'Un aliado o un cliente de aliado no se puede fusionar.'::text);
  end if;

  v_s_fila := exists (select 1 from public.client_users u where u.client_id = s.id);
  v_s_activo := exists (select 1 from public.client_users u
                         where u.client_id = s.id and u.status <> 'revoked');
  v_m_activo := exists (select 1 from public.client_users u
                         where u.client_id = m.id and u.status <> 'revoked');

  -- Qué une a las dos fichas. NULL o vacío nunca cuenta como coincidencia.
  v_mismo_doc := coalesce(
    nullif(pg_catalog.upper(pg_catalog.regexp_replace(coalesce(s.rif, ''), '[^A-Za-z0-9]', '', 'g')), '')
    = nullif(pg_catalog.upper(pg_catalog.regexp_replace(coalesce(m.rif, ''), '[^A-Za-z0-9]', '', 'g')), ''), false);
  v_mismo_correo := coalesce(
    nullif(pg_catalog.lower(pg_catalog.btrim(coalesce(s.email, ''))), '')
    = nullif(pg_catalog.lower(pg_catalog.btrim(coalesce(m.email, ''))), ''), false);
  v_mismo_tel := coalesce(public.phone_match_key(s.phone) = public.phone_match_key(m.phone), false);
  v_mismo_nombre := coalesce(
    nullif(public.norm_busqueda(pg_catalog.btrim(s.name)), '')
    = nullif(public.norm_busqueda(pg_catalog.btrim(m.name)), ''), false);

  for v_c in select * from (values ('survivor', s.id), ('merged', m.id)) t(side, cid) loop
    select pg_catalog.jsonb_build_object(
             'id', c.id,
             'markbox', c.markbox,
             'name', c.name,
             'document', nullif(pg_catalog.btrim(coalesce(c.rif, '')), ''),
             'email', nullif(pg_catalog.btrim(coalesce(c.email, '')), ''),
             'phone', nullif(pg_catalog.btrim(coalesce(c.phone, '')), ''),
             'createdAt', c.created_at,
             'hasPortal', exists (select 1 from public.client_users u
                                   where u.client_id = c.id and u.status <> 'revoked'),
             'counts', pg_catalog.jsonb_build_object(
               'shipments', (select pg_catalog.count(*) from public.shipments x
                              where x.tenant_id = v_tenant and x.client_markbox = c.markbox
                                and x.deleted_at is null),
               'invoices', (select pg_catalog.count(*) from public.invoices x
                             where x.tenant_id = v_tenant and x.client_markbox = c.markbox
                               and x.deleted_at is null),
               'addresses', (select pg_catalog.count(*) from public.client_delivery_addresses x
                              where x.client_id = c.id and x.deleted_at is null),
               'conversations', (select pg_catalog.count(*) from public.conversations x
                                  where x.client_id = c.id and x.deleted_at is null)
             )
           )
      into v_side
      from public.clients c where c.id = v_c.cid;
    v_sides := v_sides || pg_catalog.jsonb_build_object(v_c.side, v_side);
  end loop;

  return pg_catalog.jsonb_build_object(
    'ok', pg_catalog.cardinality(v_blockers) = 0,
    'blockers', pg_catalog.to_jsonb(v_blockers),
    'survivor', v_sides -> 'survivor',
    'merged', v_sides -> 'merged',
    'matches', pg_catalog.jsonb_build_object(
      'document', v_mismo_doc, 'email', v_mismo_correo, 'phone', v_mismo_tel, 'name', v_mismo_nombre),
    'warnings', pg_catalog.jsonb_build_object(
      'portalRevoked', v_s_activo and v_m_activo,
      'portalLost', v_s_fila and (not v_s_activo) and v_m_activo,
      'portalMoved', (not v_s_fila) and v_m_activo,
      'documentNotPassed', pg_catalog.btrim(coalesce(s.rif, '')) <> ''
                           and pg_catalog.btrim(coalesce(m.rif, '')) <> '' and not v_mismo_doc,
      'emailNotPassed', pg_catalog.btrim(coalesce(s.email, '')) <> ''
                        and pg_catalog.btrim(coalesce(m.email, '')) <> '' and not v_mismo_correo,
      'phoneNotPassed', pg_catalog.btrim(coalesce(s.phone, '')) <> ''
                        and pg_catalog.btrim(coalesce(m.phone, '')) <> '' and not v_mismo_tel,
      -- Lo único que las une es el nombre.
      'sameNameOnly', v_mismo_nombre and not (v_mismo_doc or v_mismo_correo or v_mismo_tel),
      -- Nada las une: son, hasta donde se ve, dos personas distintas.
      'nothingInCommon', not (v_mismo_nombre or v_mismo_doc or v_mismo_correo or v_mismo_tel)
    )
  );
end;
$$;

comment on function public.client_merge_preview(uuid, uuid) is
  'SDD-0712: vista previa de fusionar dos fichas (datos de contacto, conteos y avisos; sin montos). Solo lee.';

revoke all on function public.client_merge_preview(uuid, uuid) from public, anon;
grant execute on function public.client_merge_preview(uuid, uuid) to authenticated;

-- ── 4. Fusión manual con motivo, confirmación y rastro ───────────────────────
create or replace function public.merge_clients_manual(
  p_survivor_id uuid,
  p_merged_id uuid,
  p_reason text,
  p_confirm_markbox text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_tenant uuid;
  v_reason text := pg_catalog.btrim(coalesce(p_reason, ''));
  v_reason_prev text := pg_catalog.current_setting('dtd.audit_reason', true);
  s record;
  m record;
  v_res jsonb;
begin
  perform public.assert_studio_role(
    array['admin', 'commercial', 'operations', 'accounting', 'support']
  );
  v_tenant := public.get_user_tenant_id();
  if v_actor is null or v_tenant is null then
    raise exception 'fusionar: autenticación requerida' using errcode = '42501';
  end if;
  if p_survivor_id is null or p_merged_id is null then
    raise exception 'Hacen falta los dos clientes para fusionar' using errcode = '22023';
  end if;
  if pg_catalog.char_length(v_reason) not between 4 and 1000 then
    raise exception 'audit: reason debe tener entre 4 y 1000 caracteres' using errcode = '22023';
  end if;

  if p_survivor_id = p_merged_id then
    raise exception 'No se puede fusionar un cliente consigo mismo' using errcode = '22023';
  end if;

  select c.id, c.markbox, c.name, c.aliado_id into s
    from public.clients c where c.id = p_survivor_id and c.tenant_id = v_tenant;
  select c.id, c.markbox, c.name, c.aliado_id into m
    from public.clients c where c.id = p_merged_id and c.tenant_id = v_tenant;
  if s.id is null or m.id is null then
    raise exception 'No existe alguna de las dos fichas' using errcode = 'P0002';
  end if;

  -- Los aliados no se fusionan. El trigger de la 0362 (§9) ya lo impide; se repite
  -- aquí para dar el mensaje antes de pedir nada más y no depender de un trigger.
  if s.aliado_id is not null or m.aliado_id is not null
     or exists (select 1 from public.aliados a
                 where a.client_id in (s.id, m.id) and a.deleted_at is null) then
    raise exception 'Un aliado o un cliente de aliado no se puede fusionar' using errcode = '23514';
  end if;

  -- Escribir el Shipping Mark que se anula: confirma que se leyó cuál se pierde.
  if pg_catalog.upper(pg_catalog.btrim(coalesce(p_confirm_markbox, '')))
       is distinct from pg_catalog.upper(m.markbox) then
    raise exception 'Para fusionar, escribe el Shipping Mark que se anula (%)', m.markbox
      using errcode = '22023';
  end if;

  -- El trigger de la 0455 (`client_merged`) lee este motivo en la misma transacción.
  perform pg_catalog.set_config('dtd.audit_reason', v_reason, true);

  v_res := public.merge_clients(p_survivor_id, p_merged_id);

  perform public.append_audit_event(
    v_tenant,
    'client',
    s.id,
    'user',
    v_actor,
    'client_merge_manual',
    'rpc',
    'succeeded',
    v_reason,
    pg_catalog.jsonb_build_object('merged_markbox', m.markbox, 'merged_client_id', m.id),
    pg_catalog.jsonb_build_object('survivor_markbox', s.markbox, 'survivor_client_id', s.id),
    pg_catalog.jsonb_build_object(
      'permanence', 'P2',
      'consequence', 'retired_by_manual_merge',
      'recovery', 'no_studio_restore',
      'moved', v_res -> 'moved',
      'access', v_res ->> 'access'),
    pg_catalog.concat('sdd-0712:merge:', s.id::text, ':', m.id::text, ':',
                      pg_catalog.txid_current()::text),
    1,
    'restricted'
  );

  perform pg_catalog.set_config('dtd.audit_reason', coalesce(v_reason_prev, ''), true);
  return v_res;
end;
$$;

comment on function public.merge_clients_manual(uuid, uuid, text, text) is
  'SDD-0712: fusión manual de dos fichas cualesquiera. Exige rol, motivo 4-1000 y escribir el Shipping Mark que se anula; envuelve merge_clients (0361) sin reescribirla y deja el evento client_merge_manual.';

revoke all on function public.merge_clients_manual(uuid, uuid, text, text) from public, anon;
grant execute on function public.merge_clients_manual(uuid, uuid, text, text) to authenticated;

-- ── Rollback ─────────────────────────────────────────────────────────────────
-- drop function public.merge_clients_manual(uuid, uuid, text, text);
-- drop function public.client_merge_preview(uuid, uuid);
-- drop function public.client_search_for_merge(text);
-- drop function public.norm_busqueda(text);
-- No toca datos ni funciones previas: soltarlas solo apaga la pantalla nueva.
