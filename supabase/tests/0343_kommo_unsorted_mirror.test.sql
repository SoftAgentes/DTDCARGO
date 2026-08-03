\set ON_ERROR_STOP on

-- Contrato desechable SDD-0245 (migración 0343). Fixtures ficticios + rollback.
-- Valida con MUTACIÓN: un tenant intenta leer al otro y DEBE ver cero.
begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end;
$roles$;

grant usage on schema public to anon, authenticated, service_role;

create table public.tenants (id uuid primary key);

-- El tenant del usuario sale del claim del JWT (fixture del real).
create function public.get_user_tenant_id()
returns uuid language sql stable set search_path = ''
as $$ select nullif(current_setting('request.jwt.claim.tenant', true), '')::uuid $$;

-- ── DDL bajo prueba (idéntico a 0343_kommo_unsorted_mirror.sql) ──────────────
create table public.kommo_unsorted (
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  uid              text not null,
  category         text,
  source_name      text,
  pipeline_id      bigint,
  lead_id          bigint,
  contact_id       bigint,
  kommo_created_at timestamptz,
  raw              jsonb not null default '{}'::jsonb,
  synced_at        timestamptz not null default now(),
  primary key (tenant_id, uid)
);

create index kommo_unsorted_tenant_created_idx
  on public.kommo_unsorted (tenant_id, kommo_created_at desc);

grant select on public.kommo_unsorted to authenticated;
grant all    on public.kommo_unsorted to service_role;

alter table public.kommo_unsorted enable row level security;

create policy "kommo_unsorted tenant read"
  on public.kommo_unsorted for select to authenticated
  using (tenant_id = public.get_user_tenant_id());

create policy "kommo_unsorted service all"
  on public.kommo_unsorted for all to service_role
  using (true) with check (true);

-- ── Fixtures: dos tenants con una entrada cada uno ───────────────────────────
insert into public.tenants (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');

insert into public.kommo_unsorted (tenant_id, uid, category, lead_id) values
  ('11111111-1111-1111-1111-111111111111', 'uid-tenant-A', 'chats', 900001),
  ('22222222-2222-2222-2222-222222222222', 'uid-tenant-B', 'chats', 900002);

-- ── 1. MUTACIÓN: el tenant A NO puede ver al tenant B ────────────────────────
-- Si esto pasa, la RLS es decorativa y el espejo filtra datos entre empresas.
do $aislamiento$
declare
  visibles int;
  ajenos   int;
begin
  perform set_config('request.jwt.claim.tenant',
                     '11111111-1111-1111-1111-111111111111', true);
  set local role authenticated;

  select count(*) into visibles from public.kommo_unsorted;
  select count(*) into ajenos   from public.kommo_unsorted
   where tenant_id = '22222222-2222-2222-2222-222222222222';

  reset role;

  if visibles <> 1 then
    raise exception 'TEST 0343: el tenant A ve % filas, esperaba 1', visibles;
  end if;
  if ajenos <> 0 then
    raise exception 'TEST 0343: FUGA — el tenant A ve % filas del tenant B', ajenos;
  end if;
end;
$aislamiento$;

-- ── 2. MUTACIÓN: authenticated NO puede escribir el espejo ───────────────────
-- El espejo lo escribe SOLO el sync (service_role). Si authenticated puede
-- insertar, cualquiera con sesión inventa leads pendientes.
do $solo_lectura$
declare
  bloqueado boolean := false;
begin
  perform set_config('request.jwt.claim.tenant',
                     '11111111-1111-1111-1111-111111111111', true);
  set local role authenticated;

  begin
    insert into public.kommo_unsorted (tenant_id, uid)
    values ('11111111-1111-1111-1111-111111111111', 'uid-forjado');
  exception when insufficient_privilege or check_violation then
    bloqueado := true;
  end;

  reset role;

  if not bloqueado then
    raise exception 'TEST 0343: authenticated pudo INSERTAR en el espejo';
  end if;
end;
$solo_lectura$;

-- ── 3. MUTACIÓN: anon no ve absolutamente nada ──────────────────────────────
do $anon$
declare
  bloqueado boolean := false;
begin
  set local role anon;
  begin
    perform 1 from public.kommo_unsorted;
  exception when insufficient_privilege then
    bloqueado := true;
  end;
  reset role;

  if not bloqueado then
    raise exception 'TEST 0343: anon tiene acceso al espejo de la bandeja';
  end if;
end;
$anon$;

-- ── 4. El sync (service_role) sí puede reemplazar la cola ───────────────────
-- La bandeja DRENA: el sync debe poder borrar lo que ya no está. Si no puede,
-- se acumulan filas fantasma y el conteo miente al alza.
do $drenaje$
declare
  quedan int;
begin
  set local role service_role;
  delete from public.kommo_unsorted
   where tenant_id = '11111111-1111-1111-1111-111111111111'
     and uid = 'uid-tenant-A';
  select count(*) into quedan from public.kommo_unsorted
   where tenant_id = '11111111-1111-1111-1111-111111111111';
  reset role;

  if quedan <> 0 then
    raise exception 'TEST 0343: service_role no pudo drenar la cola (quedan %)', quedan;
  end if;
end;
$drenaje$;

rollback;
select true as kommo_unsorted_fixture_rolled_back;
