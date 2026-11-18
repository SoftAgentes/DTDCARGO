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
--    · chatwoot_unir_contacto_manual(tenant, actor, ficha, contacto, motivo):
--      «Unir este chat a la ficha». SOLO service_role: la llama el ERP después
--      de su candado, y la base vuelve a comprobar que el actor tiene membresía
--      activa en ese tenant y edita la Bandeja (chatwoot_contact_links_actor_puede);
--      auditada con el actor real.
--    · chatwoot_quitar_union(tenant, actor, ficha, contacto, motivo): deshace una
--      unión equivocada. Igual; auditada.
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
-- Por eso la elección del tenant dueño vive en la app (chatwootFichaConfigPara
-- y las acciones de unir y quitar), y la base pone lo que sí puede: la RLS por
-- tenant, la llave por contacto (un contacto no se une en dos tenants) y que
-- ninguna sesión escriba uniones: unir y quitar son solo de service_role, así
-- que nadie de otro tenant las llama directo por la API saltándose el ERP.
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
-- cada policy y disparador, y el catálogo con on conflict. Como la tabla usa
-- «if not exists» y su llave cambió entre versiones de la PR, el preflight
-- aborta si la tabla ya existe con otra llave primaria que (chatwoot_contact_id).
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
  -- La llave cambió entre versiones de la PR: una tabla vieja no se reusa en silencio.
  if to_regclass('public.chatwoot_contact_links') is not null
     and coalesce((
       select pg_catalog.string_agg(a.attname, ',' order by a.attname)
       from pg_catalog.pg_index i
       join pg_catalog.pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
       where i.indrelid = to_regclass('public.chatwoot_contact_links') and i.indisprimary
     ), '') <> 'chatwoot_contact_id' then
    raise exception '0554: chatwoot_contact_links ya existe con otra llave primaria (se espera solo chatwoot_contact_id). Es de una versión anterior de la PR: quitarla con el desarme y volver a aplicar.';
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

-- ─── 4. ¿Este actor puede unir o quitar en este tenant? ───────────────────
-- Las dos funciones de abajo son SOLO de service_role (acotar por tenant en la
-- base): las llama el ERP después de su candado, con el actor y el tenant
-- explícitos, y la base no le cree al llamador. Comprueba que el actor tiene una
-- membresía ACTIVA en ese tenant y que, evaluado COMO ese actor, edita la
-- Bandeja: la misma decisión de user_has_module (0538: rol, desvíos por rol,
-- extras por persona y su vencimiento), sin copiarla. Para eso fija
-- request.jwt.claim.sub al actor durante la consulta y lo devuelve como estaba
-- (la postcondición verifica que auth.uid() lo lee).
create or replace function public.chatwoot_contact_links_actor_puede(p_tenant_id uuid, p_actor_user_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_antes text := pg_catalog.current_setting('request.jwt.claim.sub', true);
  v_ok    boolean;
begin
  if p_tenant_id is null or p_actor_user_id is null then
    return false;
  end if;
  if not exists (
    select 1 from public.user_tenants ut
    where ut.user_id = p_actor_user_id and ut.tenant_id = p_tenant_id and ut.disabled_at is null
  ) then
    return false;
  end if;

  perform pg_catalog.set_config('request.jwt.claim.sub', p_actor_user_id::text, true);
  begin
    v_ok := (select auth.uid()) = p_actor_user_id
            and (select public.get_user_tenant_id()) = p_tenant_id
            and (select public.user_has_module('bandeja', true));
  exception when others then
    perform pg_catalog.set_config('request.jwt.claim.sub', coalesce(v_antes, ''), true);
    raise;
  end;
  perform pg_catalog.set_config('request.jwt.claim.sub', coalesce(v_antes, ''), true);
  return coalesce(v_ok, false);
end;
$fn$;

comment on function public.chatwoot_contact_links_actor_puede(uuid, uuid) is
  'SDD-0650 F2: ¿el actor tiene membresía activa en el tenant y edita la Bandeja (user_has_module evaluado como él)? Solo la usan chatwoot_unir_contacto_manual y chatwoot_quitar_union.';

revoke all on function public.chatwoot_contact_links_actor_puede(uuid, uuid) from public, anon, authenticated, service_role;

-- ─── 5. «Unir este chat a la ficha» (manual, auditada) ────────────────────
-- Las firmas de versiones anteriores de esta PR (nunca aplicadas) se quitan por si acaso.
drop function if exists public.chatwoot_unir_contacto_manual(uuid, bigint, text);

create or replace function public.chatwoot_unir_contacto_manual(
  p_tenant_id uuid, p_actor_user_id uuid, p_client_id uuid, p_contact_id bigint, p_motivo text
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_motivo text := pg_catalog.btrim(coalesce(p_motivo, ''));
  v_actual uuid;
begin
  if not public.chatwoot_contact_links_actor_puede(p_tenant_id, p_actor_user_id) then
    raise exception 'No tienes permiso para realizar esta acción.' using errcode = '42501';
  end if;
  if p_contact_id is null or p_contact_id <= 0 then
    raise exception 'chatwoot_unir_contacto_manual: contacto inválido' using errcode = '22023';
  end if;
  if pg_catalog.char_length(v_motivo) not between 4 and 1000 then
    raise exception 'chatwoot_unir_contacto_manual: el motivo va de 4 a 1000 caracteres' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.clients c
    where c.id = p_client_id and c.tenant_id = p_tenant_id and c.deleted_at is null
  ) then
    raise exception 'chatwoot_unir_contacto_manual: ficha inexistente' using errcode = 'P0002';
  end if;

  select l.client_id into v_actual
  from public.chatwoot_contact_links l
  where l.tenant_id = p_tenant_id and l.chatwoot_contact_id = p_contact_id;
  if v_actual = p_client_id then
    return 'ya_estaba';
  elsif v_actual is not null then
    raise exception 'chatwoot_unir_contacto_manual: ese chat ya está unido a otra ficha' using errcode = '23505';
  end if;

  -- Si el contacto está unido en OTRO tenant, la llave lo rechaza con el mismo 23505
  -- que «otra ficha»: no se distingue un caso del otro.
  insert into public.chatwoot_contact_links (tenant_id, client_id, chatwoot_contact_id, origen, created_by)
  values (p_tenant_id, p_client_id, p_contact_id, 'manual', p_actor_user_id);

  perform public.append_audit_event(
    p_tenant_id, 'chatwoot_contact_link', p_client_id, 'user', p_actor_user_id,
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

comment on function public.chatwoot_unir_contacto_manual(uuid, uuid, uuid, bigint, text) is
  'SDD-0650 F2 (D4): «Unir este chat a la ficha». Solo service_role (el ERP, después de su candado): la base comprueba otra vez al actor (membresía activa en el tenant y edición de la Bandeja) y que la ficha sea de ese tenant y esté viva; motivo; auditada con el actor real. No mueve un chat unido a otra ficha.';

revoke all on function public.chatwoot_unir_contacto_manual(uuid, uuid, uuid, bigint, text) from public, anon, authenticated;
grant execute on function public.chatwoot_unir_contacto_manual(uuid, uuid, uuid, bigint, text) to service_role;

-- ─── 6. Quitar una unión equivocada (auditada) ────────────────────────────
drop function if exists public.chatwoot_quitar_union(uuid, bigint, text);

create or replace function public.chatwoot_quitar_union(
  p_tenant_id uuid, p_actor_user_id uuid, p_client_id uuid, p_contact_id bigint, p_motivo text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $fn$
declare
  v_motivo text := pg_catalog.btrim(coalesce(p_motivo, ''));
  v_fila   public.chatwoot_contact_links;
begin
  if not public.chatwoot_contact_links_actor_puede(p_tenant_id, p_actor_user_id) then
    raise exception 'No tienes permiso para realizar esta acción.' using errcode = '42501';
  end if;
  if pg_catalog.char_length(v_motivo) not between 4 and 1000 then
    raise exception 'chatwoot_quitar_union: el motivo va de 4 a 1000 caracteres' using errcode = '22023';
  end if;

  delete from public.chatwoot_contact_links l
  where l.tenant_id = p_tenant_id and l.client_id = p_client_id and l.chatwoot_contact_id = p_contact_id
  returning l.* into v_fila;
  if not found then
    return false;
  end if;

  perform public.append_audit_event(
    p_tenant_id, 'chatwoot_contact_link', p_client_id, 'user', p_actor_user_id,
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

comment on function public.chatwoot_quitar_union(uuid, uuid, uuid, bigint, text) is
  'SDD-0650 F2 (D4): deshace una unión chat ↔ ficha de cualquier origen. Solo service_role, con la misma comprobación del actor que unir; motivo; auditada con el actor real.';

revoke all on function public.chatwoot_quitar_union(uuid, uuid, uuid, bigint, text) from public, anon, authenticated;
grant execute on function public.chatwoot_quitar_union(uuid, uuid, uuid, bigint, text) to service_role;

-- ─── 7. Ficha borrada → sin uniones ───────────────────────────────────────
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
  if pg_catalog.has_function_privilege('authenticated', 'public.chatwoot_unir_contacto_manual(uuid,uuid,uuid,bigint,text)', 'EXECUTE')
     or pg_catalog.has_function_privilege('authenticated', 'public.chatwoot_quitar_union(uuid,uuid,uuid,bigint,text)', 'EXECUTE')
     or pg_catalog.has_function_privilege('anon', 'public.chatwoot_unir_contacto_manual(uuid,uuid,uuid,bigint,text)', 'EXECUTE')
     or pg_catalog.has_function_privilege('anon', 'public.chatwoot_quitar_union(uuid,uuid,uuid,bigint,text)', 'EXECUTE') then
    raise exception '0554: unir o quitar a mano quedó abierta a una sesión (solo service_role)';
  end if;
  if pg_catalog.has_function_privilege('authenticated', 'public.chatwoot_contact_links_actor_puede(uuid,uuid)', 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', 'public.chatwoot_contact_links_actor_puede(uuid,uuid)', 'EXECUTE') then
    raise exception '0554: chatwoot_contact_links_actor_puede quedó ejecutable fuera de las funciones';
  end if;
  if pg_catalog.to_regprocedure('public.chatwoot_unir_contacto_manual(uuid,bigint,text)') is not null
     or pg_catalog.to_regprocedure('public.chatwoot_quitar_union(uuid,bigint,text)') is not null then
    raise exception '0554: quedó una firma vieja de unir o quitar';
  end if;
end;
$post$;

-- La comprobación del actor fija request.jwt.claim.sub: auth.uid() tiene que leerlo.
do $post_uid$
declare
  v_antes  text := pg_catalog.current_setting('request.jwt.claim.sub', true);
  v_prueba uuid := '00000000-0000-4000-8000-000000000554';
  v_leido  uuid;
begin
  perform pg_catalog.set_config('request.jwt.claim.sub', v_prueba::text, true);
  v_leido := (select auth.uid());
  perform pg_catalog.set_config('request.jwt.claim.sub', coalesce(v_antes, ''), true);
  if v_leido is distinct from v_prueba then
    raise exception '0554: auth.uid() no lee request.jwt.claim.sub; la comprobación del actor no serviría';
  end if;
end;
$post_uid$;
