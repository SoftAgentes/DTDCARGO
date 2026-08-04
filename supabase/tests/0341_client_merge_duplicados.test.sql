\set ON_ERROR_STOP on

-- Contrato desechable SDD-0246. Fixtures ficticios y rollback: no toca prod.
--
-- Lo que este test defiende, que es justo lo que puede romperse en silencio:
--   1. el markbox retirado SIGUE RESOLVIENDO al superviviente (si no, una caja
--      ya rotulada con ese código llega huérfana a Yiwu),
--   2. el markbox retirado NO SE LIBERA (la fila lo retiene soft-deleted),
--   3. los huecos del superviviente se rellenan con los datos limpios del
--      registro — incluido el documento, que es el orden peligroso de la
--      migración (soft-delete ANTES de copiar, o el índice único parcial choca),
--   4. legal_acceptances NO se mueve,
--   5. los índices únicos de acceso, direcciones, conversaciones y solicitudes
--      no revientan la fusión.

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$roles$;

create schema auth;
create function auth.uid() returns uuid language sql stable set search_path = ''
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table public.tenants (id uuid primary key);
create table public.user_tenants (
  user_id uuid not null, tenant_id uuid not null, role text not null,
  disabled_at timestamptz
);

create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = public as $$
  select ut.tenant_id from public.user_tenants ut
   where ut.user_id = auth.uid() and ut.disabled_at is null limit 1;
$$;

create function public.assert_tenant_match(p_tenant_id uuid) returns void
language plpgsql stable security definer set search_path = public as $$
declare v_t uuid := public.get_user_tenant_id();
begin
  if v_t is null then
    raise exception 'Authenticated tenant required' using errcode = '42501';
  end if;
  if v_t <> p_tenant_id then
    raise exception 'Tenant mismatch' using errcode = '42501';
  end if;
end;
$$;

-- clients con TODAS las columnas que lee merge_clients + los índices únicos que
-- de verdad existen en prod (son los que hacen peligrosa la fusión).
create table public.clients (
  id uuid primary key,
  tenant_id uuid not null,
  markbox text,
  name text not null,
  email text, phone text, address text, address_reference text, rif text,
  tier text not null default 'regular',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  lat numeric, lng numeric,
  facade_photo_url text,
  portal_approved_at timestamptz,
  cedula_photo_path text,
  registration_channel text not null default 'studio',
  doc_kind text,
  doc_verify_status text, doc_verify_source text, doc_registry_name text,
  doc_verified_at timestamptz, doc_verified_by uuid,
  kommo_lead_id bigint,
  email_marketing_optin_at timestamptz, email_optin_source text,
  whatsapp_marketing_optin_at timestamptz,
  advisor_id uuid, person_id uuid, contact_name text, avatar_path text
);
create unique index clients_tenant_id_markbox_key on public.clients (tenant_id, markbox);
create unique index clients_tenant_doc_unique on public.clients
  (tenant_id, upper(regexp_replace(rif, '[^A-Za-z0-9]', '', 'g')))
  where rif is not null and btrim(rif) <> '' and deleted_at is null;

create table public.client_users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null, client_id uuid not null references public.clients(id),
  email text, auth_user_id uuid, status text not null default 'active',
  token text, bound_at timestamptz
);
create unique index client_users_tenant_id_client_id_key
  on public.client_users (tenant_id, client_id);

create table public.client_delivery_addresses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null, client_id uuid not null references public.clients(id),
  label text, is_default boolean not null default false, deleted_at timestamptz
);
create unique index client_delivery_addresses_default_uidx
  on public.client_delivery_addresses (client_id) where is_default and deleted_at is null;

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null, client_id uuid references public.clients(id),
  channel text not null, deleted_at timestamptz
);
create unique index conversations_client_channel_live_idx
  on public.conversations (tenant_id, client_id, channel) where deleted_at is null;

create table public.conversation_monthly_digests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null, client_id uuid references public.clients(id)
);
create table public.client_notification_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null, client_id uuid references public.clients(id),
  trigger_event text not null
);
create unique index client_notif_rules_override_uniq
  on public.client_notification_rules (tenant_id, client_id, trigger_event)
  where client_id is not null;

create table public.client_change_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null, client_id uuid references public.clients(id),
  status text not null default 'pending'
);
create unique index client_change_requests_one_open
  on public.client_change_requests (client_id) where status = 'pending';

create table public.client_claims (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null, client_id uuid references public.clients(id)
);
create table public.bitacora_meetings (
  id uuid primary key default gen_random_uuid(), client_id uuid references public.clients(id));
create table public.bitacora_tasks (
  id uuid primary key default gen_random_uuid(), client_id uuid references public.clients(id));
create table public.currency_conversions (
  id uuid primary key default gen_random_uuid(), client_id uuid references public.clients(id));
create table public.inspection_reports (
  id uuid primary key default gen_random_uuid(), client_id uuid references public.clients(id));
create table public.supplier_claim_offsets (
  id uuid primary key default gen_random_uuid(), client_id uuid references public.clients(id));
create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_client_id uuid references public.clients(id),
  referred_client_id uuid references public.clients(id));
create table public.legal_acceptances (
  id uuid primary key default gen_random_uuid(), client_id uuid references public.clients(id));

grant select, insert, update, delete on public.clients to authenticated;

\ir ../migrations/0341_client_merge_duplicados.sql
-- 0344 es la corrección de los teléfonos de relleno. Va acá y no en un archivo
-- aparte porque comparte fixture y son un solo contrato: el dedup de SDD-0246.
\ir ../migrations/0344_phone_match_key_relleno.sql

-- ── Fixture ──────────────────────────────────────────────────
-- Calca el caso real DTD-Y009 / DTD-9009: el legado tiene el documento
-- corrompido por Excel y el registro nuevo lo trae limpio.

insert into public.tenants (id) values ('11111111-1111-1111-1111-111111111111');
insert into public.user_tenants (user_id, tenant_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'admin');

insert into public.clients (id, tenant_id, markbox, name, email, phone, rif, registration_channel, notes)
values
  ('c0000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111',
   'DTD-Y009', 'ELIAS ACOSTA', null, null, null, 'studio', 'Cliente del legado'),
  ('c0000000-0000-0000-0000-00000000000b', '11111111-1111-1111-1111-111111111111',
   'DTD-9009', 'Elias Acosta', 'eliasmoes@hotmail.com', '+58 4140538566', 'V-20108108',
   'portal', 'Se registró solo');

insert into public.legal_acceptances (client_id) values ('c0000000-0000-0000-0000-00000000000b');
insert into public.client_users (tenant_id, client_id, email, auth_user_id)
values ('11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-00000000000b',
        'eliasmoes@hotmail.com', 'dddddddd-0000-0000-0000-000000000001');
insert into public.conversations (tenant_id, client_id, channel) values
  ('11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-00000000000a', 'whatsapp'),
  ('11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-00000000000b', 'whatsapp'),
  ('11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-00000000000b', 'email');
insert into public.client_change_requests (tenant_id, client_id, status) values
  ('11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-00000000000a', 'pending'),
  ('11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-00000000000b', 'pending');

-- ── El detector propone el par ───────────────────────────────
-- Corre como usuario autenticado: el detector saca el tenant de la SESIÓN, no de
-- un parámetro. Si lo recibiera por parámetro, al ser security definer cualquiera
-- podría pedir los duplicados —con nombres y códigos— de otro tenant.
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $candidatos$
declare v_row record;
begin
  select * into v_row from public.client_duplicate_candidates();
  if v_row.legacy_markbox is distinct from 'DTD-Y009'
     or v_row.new_markbox is distinct from 'DTD-9009' then
    raise exception 'TEST 0341: no propuso el par legado↔nuevo (%, %)',
      v_row.legacy_markbox, v_row.new_markbox;
  end if;
  -- El documento del legado está corrompido ('2108108.0' en el caso real, aquí
  -- directamente ausente): la coincidencia NO puede venir por documento.
  if v_row.match_document then
    raise exception 'TEST 0341: coincidió por documento y no debía';
  end if;
  if not v_row.match_name then
    raise exception 'TEST 0341: debía coincidir por nombre';
  end if;
end;
$candidatos$;

reset role;

-- ── El dedup del registro mira las TRES llaves ───────────────
-- Éste es el agujero real: el legado no tiene documento (o lo tiene corrompido
-- por Excel), así que un dedup que sólo mire el documento lo deja pasar.
do $dedup$
declare v_row record;
begin
  -- Por documento.
  select * into v_row from public.find_duplicate_client_service(
    '11111111-1111-1111-1111-111111111111', 'V-20108108', null, null);
  if v_row.matched_by is distinct from 'documento' then
    raise exception 'TEST 0341: no encontró por documento (%)', v_row.matched_by;
  end if;

  -- Por correo, con otra caja de mayúsculas (el legado guarda 'X@Gmail.com').
  select * into v_row from public.find_duplicate_client_service(
    '11111111-1111-1111-1111-111111111111', null, 'ELIASMOES@hotmail.com', null);
  if v_row.matched_by is distinct from 'correo' then
    raise exception 'TEST 0341: no encontró por correo (%)', v_row.matched_by;
  end if;

  -- Por teléfono escrito distinto: '04140538566' (legado) vs '+58 4140538566'
  -- (registro). Los últimos 7 dígitos son los mismos.
  select * into v_row from public.find_duplicate_client_service(
    '11111111-1111-1111-1111-111111111111', null, null, '0414-0538566');
  if v_row.matched_by is distinct from 'telefono' then
    raise exception 'TEST 0341: no encontró por teléfono (%)', v_row.matched_by;
  end if;

  -- Un teléfono de menos de 7 dígitos NO puede hacer match de nadie.
  if exists (select 1 from public.find_duplicate_client_service(
      '11111111-1111-1111-1111-111111111111', null, null, '414')) then
    raise exception 'TEST 0341: hizo match con un teléfono demasiado corto';
  end if;

  -- 🔴 Teléfonos de RELLENO (0342). En prod hay fichas con '0000000',
  -- '8888888', '9999999' y '1234567'. No identifican a nadie: usarlos como
  -- llave le bloquea el registro a un cliente nuevo real, que es el error más
  -- caro de los dos (el duplicado se fusiona; el bloqueado se va).
  -- Este caso salió en una prueba funcional contra prod, NO en los tests.
  if exists (select 1 from public.find_duplicate_client_service(
      '11111111-1111-1111-1111-111111111111', null, null, '+58 4120000000')) then
    raise exception 'TEST 0341: un teléfono de relleno (0000000) bloqueó a un cliente nuevo';
  end if;
  if exists (select 1 from public.find_duplicate_client_service(
      '11111111-1111-1111-1111-111111111111', null, null, '+58 4121234567')) then
    raise exception 'TEST 0341: la secuencia 1234567 bloqueó a un cliente nuevo';
  end if;

  -- Y la llave saneada sigue devolviendo los teléfonos de verdad.
  if public.phone_match_key('0414-0538566') is distinct from '0538566'
     or public.phone_match_key('+58 4140538566') is distinct from '0538566' then
    raise exception 'TEST 0341: la llave de teléfono dejó de reconocer un número real';
  end if;
  if public.phone_match_key('04120000000') is not null
     or public.phone_match_key('414') is not null then
    raise exception 'TEST 0341: la llave de teléfono aceptó relleno o número corto';
  end if;

  -- Sin ninguna llave, no devuelve nada (no puede ser un listado de clientes).
  if exists (select 1 from public.find_duplicate_client_service(
      '11111111-1111-1111-1111-111111111111', null, null, null)) then
    raise exception 'TEST 0341: devolvió filas sin ninguna llave de búsqueda';
  end if;

  -- Un cliente de otro tenant no aparece.
  if exists (select 1 from public.find_duplicate_client_service(
      '22222222-2222-2222-2222-222222222222', 'V-20108108', null, null)) then
    raise exception 'TEST 0341: cruzó la frontera de tenant';
  end if;
end;
$dedup$;

-- ── La fusión ────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

do $fusion$
declare v_res jsonb;
begin
  v_res := public.merge_clients(
    'c0000000-0000-0000-0000-00000000000a',
    'c0000000-0000-0000-0000-00000000000b'
  );
  if (v_res->>'ok') is distinct from 'true' then
    raise exception 'TEST 0341: la fusión no reportó ok: %', v_res;
  end if;
  if (v_res->>'retired_markbox') is distinct from 'DTD-9009' then
    raise exception 'TEST 0341: no retiró el código nuevo: %', v_res;
  end if;
  -- El acceso estaba libre en el superviviente → se muda, no se revoca.
  if (v_res->>'access') not like '%mudado%' then
    raise exception 'TEST 0341: el acceso no se mudó: %', v_res->>'access';
  end if;
  -- Había hilo de WhatsApp en las dos fichas → uno se archiva, no revienta.
  if (v_res#>>'{needs_review,conversations_archived}')::int <> 1 then
    raise exception 'TEST 0341: no archivó el hilo duplicado: %', v_res;
  end if;
  -- Las dos tenían solicitud pendiente → la del duplicado se queda atrás.
  if (v_res#>>'{needs_review,change_requests_left_behind}')::int <> 1 then
    raise exception 'TEST 0341: no reportó la solicitud dejada atrás: %', v_res;
  end if;
end;
$fusion$;

reset role;

-- ── Lo que tiene que haber quedado ───────────────────────────
do $verificacion$
declare v_c public.clients; v_m public.clients; v_r record;
begin
  select * into v_c from public.clients where id = 'c0000000-0000-0000-0000-00000000000a';
  select * into v_m from public.clients where id = 'c0000000-0000-0000-0000-00000000000b';

  -- 1. El superviviente conserva SU código. Nunca se renumera.
  if v_c.markbox <> 'DTD-Y009' then
    raise exception 'TEST 0341: al superviviente le cambiaron el código: %', v_c.markbox;
  end if;

  -- 2. La ficha fusionada RETIENE su markbox soft-deleted. Si alguien lo pusiera
  --    a null "para liberarlo", el correlativo lo reemitiría y dos clientes
  --    distintos terminarían con el mismo Shipping Mark.
  if v_m.markbox is distinct from 'DTD-9009' or v_m.deleted_at is null
     or v_m.merged_into_client_id is distinct from v_c.id then
    raise exception 'TEST 0341: la ficha fusionada no quedó retirada correctamente';
  end if;

  -- 3. Los huecos se rellenaron con los datos limpios del registro. El documento
  --    es el que prueba el ORDEN de la migración: si se copiara antes del
  --    soft-delete, clients_tenant_doc_unique habría abortado la fusión.
  if v_c.rif is distinct from 'V-20108108'
     or v_c.email is distinct from 'eliasmoes@hotmail.com'
     or v_c.phone is distinct from '+58 4140538566' then
    raise exception 'TEST 0341: no se rellenaron los huecos (rif=%, email=%)', v_c.rif, v_c.email;
  end if;

  -- 4. legal_acceptances NO se movió: está atada a quién aceptó.
  if exists (select 1 from public.legal_acceptances
              where client_id = 'c0000000-0000-0000-0000-00000000000a') then
    raise exception 'TEST 0341: se movió una aceptación legal';
  end if;

  -- 5. El acceso quedó en el superviviente.
  if not exists (select 1 from public.client_users
                  where client_id = v_c.id and status = 'active') then
    raise exception 'TEST 0341: el acceso no quedó en el superviviente';
  end if;

  -- 6. El código retirado SIGUE RESOLVIENDO. Esta es la caja que ya venía
  --    rotulada desde Yiwu con el código que anularon.
  select * into v_r from public.resolve_markbox(
    '11111111-1111-1111-1111-111111111111', 'DTD-9009');
  if v_r.client_id is distinct from v_c.id or not v_r.was_redirected
     or v_r.canonical_markbox is distinct from 'DTD-Y009' then
    raise exception 'TEST 0341: el código retirado no resolvió al superviviente';
  end if;

  -- 7. El código vigente resuelve sin marcar redirección.
  select * into v_r from public.resolve_markbox(
    '11111111-1111-1111-1111-111111111111', 'DTD-Y009');
  if v_r.client_id is distinct from v_c.id or v_r.was_redirected then
    raise exception 'TEST 0341: el código vigente se marcó como redirigido';
  end if;

end;
$verificacion$;

-- 8. Ya fusionado, el par desaparece de los candidatos (si no, el operador
--    volvería a ver el mismo caso para siempre).
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';
do $sin_candidatos$
begin
  if exists (select 1 from public.client_duplicate_candidates()) then
    raise exception 'TEST 0341: el par fusionado sigue apareciendo como candidato';
  end if;
end;
$sin_candidatos$;
reset role;

-- 8b. Un usuario de OTRO tenant no ve NINGÚN candidato de este. El detector es
--     security definer: sin el filtro por sesión, vería los de todos.
set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';
do $candidatos_ajenos$
begin
  if exists (select 1 from public.client_duplicate_candidates()) then
    raise exception 'TEST 0341: el detector cruzó la frontera de tenant';
  end if;
end;
$candidatos_ajenos$;
reset role;

-- ── Guardas ──────────────────────────────────────────────────
do $guardas$
declare v_dummy jsonb;
begin
  set local role authenticated;
  set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

  -- No se fusiona consigo mismo.
  begin
    v_dummy := public.merge_clients(
      'c0000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-00000000000a');
    raise exception 'TEST 0341: dejó fusionar un cliente consigo mismo';
  exception when others then
    if sqlerrm like 'TEST 0341%' then raise; end if;
  end;

  -- No se refusiona una ficha ya fusionada.
  begin
    v_dummy := public.merge_clients(
      'c0000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-00000000000b');
    raise exception 'TEST 0341: dejó refusionar una ficha ya fusionada';
  exception when others then
    if sqlerrm like 'TEST 0341%' then raise; end if;
  end;
end;
$guardas$;

reset role;

-- Un usuario de OTRO tenant no puede fusionar fichas ajenas.
do $ajeno$
declare v_dummy jsonb;
begin
  set local role authenticated;
  set local request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';
  begin
    v_dummy := public.merge_clients(
      'c0000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-00000000000b');
    raise exception 'TEST 0341: otro tenant pudo fusionar';
  exception when others then
    if sqlerrm like 'TEST 0341%' then raise; end if;
  end;
end;
$ajeno$;

reset role;

do $acl$
begin
  if pg_catalog.has_function_privilege('anon', 'public.merge_clients(uuid,uuid)', 'EXECUTE')
     or pg_catalog.has_function_privilege('anon', 'public.resolve_markbox(uuid,text)', 'EXECUTE')
     or pg_catalog.has_function_privilege('anon', 'public.client_duplicate_candidates()', 'EXECUTE')
     or not pg_catalog.has_function_privilege(
          'authenticated', 'public.merge_clients(uuid,uuid)', 'EXECUTE') then
    raise exception 'TEST 0341: ACL inválida';
  end if;

  -- El dedup del registro corre con service_role (el registrante es anónimo).
  -- Si 'authenticated' o 'anon' pudieran ejecutarlo, se volvería un oráculo de
  -- "¿este correo tiene cuenta en DTD?" consultable desde el navegador.
  if pg_catalog.has_function_privilege(
       'anon', 'public.find_duplicate_client_service(uuid,text,text,text)', 'EXECUTE')
     or pg_catalog.has_function_privilege(
       'authenticated', 'public.find_duplicate_client_service(uuid,text,text,text)', 'EXECUTE')
     or not pg_catalog.has_function_privilege(
       'service_role', 'public.find_duplicate_client_service(uuid,text,text,text)', 'EXECUTE') then
    raise exception 'TEST 0341: el dedup del registro no está restringido a service_role';
  end if;
end;
$acl$;

rollback;
select true as client_merge_fixture_rolled_back;
