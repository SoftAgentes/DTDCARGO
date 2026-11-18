-- ─────────────────────────────────────────────────────────────────────────────
-- 0554 · SDD-0650 F2 — Lista de uniones chat ↔ ficha (decisión D4 de Sam,
-- 2026-11-16: «b»).
--
-- ⚠️ NO APLICADA A PRODUCCIÓN NI A NINGÚN ENTORNO. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicarla en
--    producción exige el OK de Sam NOMBRANDO este archivo, el runbook
--    aplicar-migraciones-prod y el Director General; en staging, el OK de Sam
--    con aviso previo al DG. Fusionar la PR NO autoriza aplicarla.
--    El código funciona con o sin ella: sin la 0554 la ficha muestra la tarjeta
--    de la F1 (las conversaciones que cruzó el teléfono, sin texto) y el webhook
--    sigue igual.
--
-- ── Qué crea ────────────────────────────────────────────────
-- 1. public.chatwoot_contact_links: qué contacto de Chatwoot es de qué ficha.
--    SOLO IDS: tenant, ficha, contacto, origen (webhook | kommo | manual), quién
--    y cuándo. Ni nombres, ni teléfonos, ni texto. Un contacto es de UNA ficha
--    y de UN tenant (llave: el contacto): hay una sola cuenta de Chatwoot, así
--    que un id de contacto no puede ser de dos tenants. Una ficha puede tener
--    varios contactos.
--    RLS: la leen, de su tenant, los que abren el módulo Bandeja
--    (user_has_module('bandeja'), 0538). Nadie la escribe directo: solo las
--    funciones de abajo y service_role.
-- 2. Funciones (search_path vacío, SECURITY DEFINER):
--    · chatwoot_unir_contactos(tenant, origen, pares): SOLO service_role. La
--      llaman el webhook (origen webhook, cuando el teléfono cruzó con UNA ficha,
--      0504) y el relleno único del Archivo Kommo (origen kommo, en el VPS, con
--      el client_id que dejó el cargador). Nunca pisa una unión que ya existe.
--    · chatwoot_unir_contacto_manual(ficha, contacto, motivo): «Unir este chat a
--      la ficha». authenticated que EDITA la Bandeja; auditada.
--    · chatwoot_quitar_union(ficha, contacto, motivo): deshace una unión
--      equivocada. Igual permiso; auditada.
-- 3. Al borrar la ficha (borrado físico) sus uniones se van en cascada; al
--    borrarla lógicamente (deleted_at, SDD-0509) un disparador las borra y deja
--    UNA fila de auditoría con los ids de los contactos. Restaurar la ficha NO
--    restaura sus uniones: se vuelven a unir (webhook, relleno o a mano).
-- 4. Catálogo de auditoría: chatwoot_contact_link.
--
-- ── Qué tenant puede usarla ─────────────────────────────────
-- La cuenta de Chatwoot es una y pertenece a un tenant (CHATWOOT_TENANT_ID, en
-- el entorno del servidor). La base no lo sabe: no hay tabla con ese dato, y
-- crearla para esto sería otra fuente de verdad que puede divergir del entorno.
-- Por eso el acotamiento al tenant dueño vive en la app (chatwootFichaConfigPara
-- y las acciones de unir y quitar), y la base pone lo que sí puede: la RLS por
-- tenant y la llave por contacto (un contacto no se une en dos tenants).
--
-- ── Qué NO toca ──────────────────────────────────────────────
-- Ninguna fila existente. Ni chatwoot_conversations ni chatwoot_registrar_evento
-- (0504). Solo agrega un disparador AFTER UPDATE OF deleted_at a clients.
--
-- ── Locks ───────────────────────────────────────────────────
-- CREATE TRIGGER sobre clients toma SHARE ROW EXCLUSIVE un instante (sin
-- reescritura). lock_timeout 5 s: si hay espera, falla y se reintenta.
--
-- ── Idempotente ─────────────────────────────────────────────
-- create table if not exists, create or replace, drop … if exists antes de
-- cada policy y disparador, y el catálogo con on conflict.
--
-- ── Deshacer ────────────────────────────────────────────────
-- supabase/desarmes/0554_desarme.sql (sin número; usarlo exige OK nominal de
-- Sam). Pierde las uniones; las fichas y las conversaciones quedan.
-- ─────────────────────────────────────────────────────────────────────────────
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
begin
  if to_regclass('public.tenants') is null
     or to_regclass('public.clients') is null
     or to_regclass('public.user_tenants') is null
     or to_regclass('public.audit_entity_types') is null
     or to_regclass('public.entity_audit_log') is null then
    raise exception '0554 requiere tenants, clients, user_tenants, audit_entity_types (0258) y entity_audit_log';
  end if;
  if pg_catalog.to_regprocedure('public.get_user_tenant_id()') is null
     or pg_catalog.to_regprocedure('public.user_has_module(text,boolean)') is null
     or pg_catalog.to_regprocedure(
       'public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'
     ) is null then
    raise exception '0554 requiere get_user_tenant_id(), user_has_module (0538) y append_audit_event (0294)';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid = 'public.clients'::regclass and attname = 'deleted_at' and not attisdropped
  ) then
    raise exception '0554 requiere clients.deleted_at (SDD-0509)';
  end if;
end;
$preflight$;

-- ─── 1. La tabla ──────────────────────────────────────────────────────────
create table if not exists public.chatwoot_contact_links (
  tenant_id           uuid        not null references public.tenants(id) on delete cascade,
  client_id           uuid        not null references public.clients(id) on delete cascade,
  chatwoot_contact_id bigint      not null check (chatwoot_contact_id > 0),
  origen              text        not null check (origen in ('webhook', 'kommo', 'manual')),
  created_by          uuid        null,
  created_at          timestamptz not null default pg_catalog.now(),
  -- Una sola cuenta de Chatwoot: un contacto es de una ficha y de un tenant.
  constraint chatwoot_contact_links_pkey primary key (chatwoot_contact_id),
  -- Una unión manual siempre dice quién la hizo; las automáticas, nadie.
  constraint chatwoot_contact_links_autor check ((origen = 'manual') = (created_by is not null))
);

-- La lectura de la ficha (tenant y ficha) y el borrado por ficha (disparador y
-- la cascada desde clients) van por client_id.
create index if not exists chatwoot_contact_links_client_idx
  on public.chatwoot_contact_links (client_id, tenant_id);

comment on table public.chatwoot_contact_links is
  'SDD-0650 F2 (D4): qué contacto de Chatwoot es de qué ficha. Solo ids: sin nombres, teléfonos ni texto. La escriben chatwoot_unir_contactos (service_role: webhook y relleno del Archivo Kommo), chatwoot_unir_contacto_manual y chatwoot_quitar_union (auditadas). La leen los que abren la Bandeja.';

alter table public.chatwoot_contact_links enable row level security;

drop policy if exists chatwoot_contact_links_select_bandeja on public.chatwoot_contact_links;
create policy chatwoot_contact_links_select_bandeja on public.chatwoot_contact_links
  for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id())
         and (select public.user_has_module('bandeja', false)));

drop policy if exists chatwoot_contact_links_service_role_all on public.chatwoot_contact_links;
create policy chatwoot_contact_links_service_role_all on public.chatwoot_contact_links
  for all to service_role using (true) with check (true);

revoke all on public.chatwoot_contact_links from public, anon, authenticated;
grant select on public.chatwoot_contact_links to authenticated;
grant all on public.chatwoot_contact_links to service_role;

-- ─── 2. Catálogo de auditoría ─────────────────────────────────────────────
insert into public.audit_entity_types (entity_type, status, domain_code, contract_version, introduced_by_ref)
values ('chatwoot_contact_link', 'active', 'crm', 1, 'migration:0554')
on conflict (entity_type) do update
set status = excluded.status,
    domain_code = excluded.domain_code,
    contract_version = greatest(public.audit_entity_types.contract_version, excluded.contract_version);

-- ─── 3. Uniones automáticas (webhook y relleno del Archivo Kommo) ─────────
-- p_pares: [{"client_id": "<uuid>", "contact_id": <entero>}], hasta 5000.
-- Una ficha de otro tenant o borrada cuenta como sin_ficha y no se une. Un
-- contacto ya unido no se toca: ya_estaba (misma ficha) u otra_ficha.
create or replace function public.chatwoot_unir_contactos(p_tenant_id uuid, p_origen text, p_pares jsonb)
returns table (unidos integer, ya_estaban integer, otra_ficha integer, sin_ficha integer)
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_par      jsonb;
  v_client   uuid;
  v_contact  bigint;
  v_actual   uuid;
  v_unidos   integer := 0;
  v_ya       integer := 0;
  v_otra     integer := 0;
  v_sin      integer := 0;
begin
  if p_tenant_id is null or not exists (select 1 from public.tenants t where t.id = p_tenant_id) then
    raise exception 'chatwoot_unir_contactos: tenant inexistente' using errcode = '22023';
  end if;
  if p_origen is null or p_origen not in ('webhook', 'kommo') then
    raise exception 'chatwoot_unir_contactos: origen inválido (webhook | kommo)' using errcode = '22023';
  end if;
  if p_pares is null or pg_catalog.jsonb_typeof(p_pares) <> 'array' or pg_catalog.jsonb_array_length(p_pares) > 5000 then
    raise exception 'chatwoot_unir_contactos: pares debe ser un arreglo de hasta 5000' using errcode = '22023';
  end if;

  for v_par in select value from pg_catalog.jsonb_array_elements(p_pares) loop
    if pg_catalog.jsonb_typeof(v_par) <> 'object'
       or coalesce(v_par ->> 'client_id', '') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
       or coalesce(v_par ->> 'contact_id', '') !~ '^[1-9][0-9]{0,17}$' then
      raise exception 'chatwoot_unir_contactos: par inválido' using errcode = '22023';
    end if;
    v_client := (v_par ->> 'client_id')::uuid;
    v_contact := (v_par ->> 'contact_id')::bigint;

    if not exists (
      select 1 from public.clients c
      where c.id = v_client and c.tenant_id = p_tenant_id and c.deleted_at is null
    ) then
      v_sin := v_sin + 1;
      continue;
    end if;

    insert into public.chatwoot_contact_links (tenant_id, client_id, chatwoot_contact_id, origen, created_by)
    values (p_tenant_id, v_client, v_contact, p_origen, null)
    on conflict (chatwoot_contact_id) do nothing;
    if found then
      v_unidos := v_unidos + 1;
    else
      -- Ya unido: a esta misma ficha, o a otra (de este tenant o de otro; no se dice cuál).
      select l.client_id into v_actual
      from public.chatwoot_contact_links l
      where l.chatwoot_contact_id = v_contact and l.tenant_id = p_tenant_id;
      if v_actual = v_client then v_ya := v_ya + 1; else v_otra := v_otra + 1; end if;
    end if;
  end loop;

  return query select v_unidos, v_ya, v_otra, v_sin;
end;
$fn$;

comment on function public.chatwoot_unir_contactos(uuid, text, jsonb) is
  'SDD-0650 F2 (D4): une contactos de Chatwoot con fichas del tenant (webhook o relleno del Archivo Kommo). Solo service_role. Nunca pisa una unión existente; devuelve solo conteos.';

revoke all on function public.chatwoot_unir_contactos(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.chatwoot_unir_contactos(uuid, text, jsonb) to service_role;

-- ─── 4. «Unir este chat a la ficha» (manual, auditada) ────────────────────
create or replace function public.chatwoot_unir_contacto_manual(p_client_id uuid, p_contact_id bigint, p_motivo text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_uid    uuid := (select auth.uid());
  v_tenant uuid := (select public.get_user_tenant_id());
  v_motivo text := pg_catalog.btrim(coalesce(p_motivo, ''));
  v_actual uuid;
begin
  if v_uid is null or v_tenant is null or not (select public.user_has_module('bandeja', true)) then
    raise exception 'chatwoot_unir_contacto_manual: sin permiso' using errcode = '42501';
  end if;
  if p_contact_id is null or p_contact_id <= 0 then
    raise exception 'chatwoot_unir_contacto_manual: contacto inválido' using errcode = '22023';
  end if;
  if pg_catalog.char_length(v_motivo) not between 4 and 1000 then
    raise exception 'chatwoot_unir_contacto_manual: el motivo va de 4 a 1000 caracteres' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.clients c
    where c.id = p_client_id and c.tenant_id = v_tenant and c.deleted_at is null
  ) then
    raise exception 'chatwoot_unir_contacto_manual: ficha inexistente' using errcode = 'P0002';
  end if;

  select l.client_id into v_actual
  from public.chatwoot_contact_links l
  where l.tenant_id = v_tenant and l.chatwoot_contact_id = p_contact_id;
  if v_actual = p_client_id then
    return 'ya_estaba';
  elsif v_actual is not null then
    raise exception 'chatwoot_unir_contacto_manual: ese chat ya está unido a otra ficha' using errcode = '23505';
  end if;

  -- Si el contacto está unido en OTRO tenant, la llave lo rechaza con el mismo 23505
  -- que «otra ficha»: no se distingue un caso del otro.
  insert into public.chatwoot_contact_links (tenant_id, client_id, chatwoot_contact_id, origen, created_by)
  values (v_tenant, p_client_id, p_contact_id, 'manual', v_uid);

  perform public.append_audit_event(
    v_tenant, 'chatwoot_contact_link', p_client_id, 'user', v_uid,
    'chatwoot_contact_linked', 'studio', 'succeeded', v_motivo,
    null,
    pg_catalog.jsonb_build_object('chatwoot_contact_id', p_contact_id, 'origen', 'manual'),
    '{}'::jsonb,
    pg_catalog.concat('chatwoot-contact-link:', p_client_id::text, ':', p_contact_id::text, ':', pg_catalog.txid_current()::text),
    1,
    'internal'
  );
  return 'unido';
end;
$fn$;

comment on function public.chatwoot_unir_contacto_manual(uuid, bigint, text) is
  'SDD-0650 F2 (D4): «Unir este chat a la ficha». Quien edita la Bandeja, en su tenant, con motivo; auditada. No mueve un chat unido a otra ficha.';

revoke all on function public.chatwoot_unir_contacto_manual(uuid, bigint, text) from public, anon;
grant execute on function public.chatwoot_unir_contacto_manual(uuid, bigint, text) to authenticated;

-- ─── 5. Quitar una unión equivocada (auditada) ────────────────────────────
create or replace function public.chatwoot_quitar_union(p_client_id uuid, p_contact_id bigint, p_motivo text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_uid    uuid := (select auth.uid());
  v_tenant uuid := (select public.get_user_tenant_id());
  v_motivo text := pg_catalog.btrim(coalesce(p_motivo, ''));
  v_fila   public.chatwoot_contact_links;
begin
  if v_uid is null or v_tenant is null or not (select public.user_has_module('bandeja', true)) then
    raise exception 'chatwoot_quitar_union: sin permiso' using errcode = '42501';
  end if;
  if pg_catalog.char_length(v_motivo) not between 4 and 1000 then
    raise exception 'chatwoot_quitar_union: el motivo va de 4 a 1000 caracteres' using errcode = '22023';
  end if;

  delete from public.chatwoot_contact_links l
  where l.tenant_id = v_tenant and l.client_id = p_client_id and l.chatwoot_contact_id = p_contact_id
  returning l.* into v_fila;
  if not found then
    return false;
  end if;

  perform public.append_audit_event(
    v_tenant, 'chatwoot_contact_link', p_client_id, 'user', v_uid,
    'chatwoot_contact_unlinked', 'studio', 'succeeded', v_motivo,
    pg_catalog.jsonb_build_object('chatwoot_contact_id', v_fila.chatwoot_contact_id, 'origen', v_fila.origen),
    null,
    '{}'::jsonb,
    pg_catalog.concat('chatwoot-contact-unlink:', p_client_id::text, ':', p_contact_id::text, ':', pg_catalog.txid_current()::text),
    1,
    'internal'
  );
  return true;
end;
$fn$;

comment on function public.chatwoot_quitar_union(uuid, bigint, text) is
  'SDD-0650 F2 (D4): deshace una unión chat ↔ ficha de cualquier origen. Quien edita la Bandeja, en su tenant, con motivo; auditada.';

revoke all on function public.chatwoot_quitar_union(uuid, bigint, text) from public, anon;
grant execute on function public.chatwoot_quitar_union(uuid, bigint, text) to authenticated;

-- ─── 6. Ficha borrada → sin uniones ───────────────────────────────────────
create or replace function public.chatwoot_contact_links_al_borrar_ficha()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid       uuid := (select auth.uid());
  v_contactos bigint[];
begin
  if new.deleted_at is not null and old.deleted_at is null then
    with borradas as (
      delete from public.chatwoot_contact_links l where l.client_id = new.id
      returning l.chatwoot_contact_id
    )
    select pg_catalog.array_agg(b.chatwoot_contact_id order by b.chatwoot_contact_id) into v_contactos from borradas b;

    -- Una fila de auditoría por ficha borrada, solo con los ids de los contactos.
    -- Restaurar la ficha no restaura las uniones.
    if v_contactos is not null then
      perform public.append_audit_event(
        new.tenant_id, 'chatwoot_contact_link', new.id,
        case when v_uid is null then 'system' else 'user' end, v_uid,
        'chatwoot_contact_unlinked', 'rpc', 'succeeded', 'Ficha borrada: sus chats dejan de estar unidos',
        pg_catalog.jsonb_build_object('chatwoot_contact_ids', pg_catalog.to_jsonb(v_contactos), 'motivo', 'ficha_borrada'),
        null,
        '{}'::jsonb,
        pg_catalog.concat('chatwoot-contact-unlink:', new.id::text, ':ficha-borrada:', pg_catalog.txid_current()::text),
        1,
        'internal'
      );
    end if;
  end if;
  return null;
end;
$fn$;

revoke all on function public.chatwoot_contact_links_al_borrar_ficha() from public, anon, authenticated;

drop trigger if exists chatwoot_contact_links_al_borrar_ficha on public.clients;
create trigger chatwoot_contact_links_al_borrar_ficha
  after update of deleted_at on public.clients
  for each row
  when (new.deleted_at is not null and old.deleted_at is null)
  execute function public.chatwoot_contact_links_al_borrar_ficha();

-- ─── Postcondiciones ──────────────────────────────────────────────────────
do $post$
begin
  if not (select c.relrowsecurity from pg_catalog.pg_class c where c.oid = 'public.chatwoot_contact_links'::regclass) then
    raise exception '0554: chatwoot_contact_links sin RLS';
  end if;
  if pg_catalog.has_table_privilege('authenticated', 'public.chatwoot_contact_links', 'INSERT,UPDATE,DELETE,TRUNCATE')
     or pg_catalog.has_table_privilege('anon', 'public.chatwoot_contact_links', 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception '0554: chatwoot_contact_links quedó escribible por authenticated o legible por anon';
  end if;
  if pg_catalog.has_function_privilege('authenticated', 'public.chatwoot_unir_contactos(uuid,text,jsonb)', 'EXECUTE') then
    raise exception '0554: chatwoot_unir_contactos quedó abierta a authenticated';
  end if;
end;
$post$;
