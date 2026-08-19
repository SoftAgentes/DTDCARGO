\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0386 (SDD-0271).
-- Fixtures ficticios y rollback: no toca prod.
--
-- Lo que se protege acá son cinco cosas que no revientan nunca hasta el día que
-- pasan:
--   1. Que un chat NO pueda ser dos destinos del mismo tenant — si pudiera, una
--      categoría ruteada a los dos volvería a duplicar el aviso, que es
--      exactamente el bug que esta migración cierra.
--   2. Que un destino no quede "medio enlazado" (chat sin fecha, o al revés).
--   3. Que una ruta no pueda apuntar al destino de OTRO tenant — o sea, mandarle
--      los avisos de una empresa al Telegram de otra.
--   4. Que un empleado que no es admin NO vea los chats a los que le suena el
--      teléfono al founder.
--   5. Que un admin de otro tenant tampoco los vea.
--
-- Cada contrato se validó rompiéndolo a propósito: un contrato verde que sigue
-- verde con la protección apagada es decorado, no contrato.

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$roles$;

create schema extensions;
create function extensions.gen_random_uuid() returns uuid
language sql volatile as $$ select gen_random_uuid() $$;

create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable set search_path = ''
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;

create table public.tenants (id uuid primary key);
create table public.user_tenants (
  user_id uuid not null, tenant_id uuid not null, role text not null, disabled_at timestamptz
);
create table public.user_profiles (
  user_id uuid primary key,
  telegram_chat_id text,
  telegram_username text
);

create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = public as $$
  select ut.tenant_id from public.user_tenants ut
   where ut.user_id = auth.uid() and ut.disabled_at is null limit 1;
$$;
grant execute on function public.get_user_tenant_id() to authenticated;

create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

-- Dos empresas. En la primera, DOS admins comparten el mismo telegram_chat_id
-- — la situación real de producción que originó la spec.
insert into public.tenants values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

insert into public.user_tenants values
  ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','admin',null),
  ('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','admin',null),
  ('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','warehouse',null),
  ('44444444-4444-4444-8444-444444444444','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','admin',null);

insert into public.user_profiles values
  ('11111111-1111-4111-8111-111111111111','6512220774','SamDTD'),
  ('22222222-2222-4222-8222-222222222222','6512220774','SamDTD'),
  ('33333333-3333-4333-8333-333333333333',null,null),
  ('44444444-4444-4444-8444-444444444444','999',null);

\ir ../migrations/0386_telegram_rutas_de_alerta.sql

-- ─── 0. La siembra: un destino enlazado + uno pendiente, por tenant ──────────
-- Y UNO solo enlazado aunque los dos admins compartan chat: si la siembra
-- creara una fila por admin, el índice único reventaría la migración entera.
do $$
declare n integer;
begin
  select count(*) into n from public.telegram_destinations
   where tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and chat_id = '6512220774';
  if n <> 1 then raise exception '0386: esperaba 1 destino enlazado sembrado, obtuvo %', n; end if;

  select count(*) into n from public.telegram_destinations
   where tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and chat_id is null;
  if n <> 1 then raise exception '0386: esperaba 1 destino pendiente sembrado, obtuvo %', n; end if;

  -- El brief diario va a los DOS destinos; el registro sólo al comercial.
  select count(*) into n from public.telegram_alert_routes
   where tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and category = 'reportes';
  if n <> 2 then raise exception '0386: esperaba `reportes` en 2 destinos, obtuvo %', n; end if;

  select count(*) into n from public.telegram_alert_routes r
    join public.telegram_destinations d on d.id = r.destination_id
   where r.category = 'registro' and d.label = 'Comercial y clientes';
  if n <> 2 then raise exception '0386: `registro` debía quedar en el comercial de los 2 tenants, obtuvo %', n; end if;

  select count(*) into n from public.telegram_alert_routes r
    join public.telegram_destinations d on d.id = r.destination_id
   where r.category = 'registro' and d.label = 'Operaciones y bugs';
  if n <> 0 then raise exception '0386: `registro` NO debía tocar el destino de operaciones, obtuvo %', n; end if;
end $$;

-- Limpiamos la siembra para que los contratos de abajo midan sólo lo suyo.
delete from public.telegram_alert_routes;
delete from public.telegram_destinations;

insert into public.telegram_destinations (id, tenant_id, label, chat_id, linked_at)
values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Operaciones','111',now());
insert into public.telegram_destinations (id, tenant_id, label)
values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Ajeno');

-- ─── 1. Un chat no puede ser dos destinos del mismo tenant ──────────────────
do $$
begin
  insert into public.telegram_destinations (tenant_id, label, chat_id, linked_at)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Duplicado','111',now());
  raise exception '0386: el índice único dejó pasar dos destinos con el mismo chat';
exception when unique_violation then null;
end $$;

-- ─── 2. Nada de destinos a medio enlazar ────────────────────────────────────
do $$
begin
  insert into public.telegram_destinations (tenant_id, label, chat_id)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Sin fecha','222');
  raise exception '0386: dejó pasar un destino con chat pero sin linked_at';
exception when check_violation then null;
end $$;

-- ─── 3. Una ruta no cruza de tenant ─────────────────────────────────────────
do $$
begin
  insert into public.telegram_alert_routes (tenant_id, category, destination_id)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','registro','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
  raise exception '0386: dejó rutear los avisos de un tenant al chat de otro';
exception when check_violation then null;
end $$;

-- ─── 4. Un empleado que no es admin no ve los chats ─────────────────────────
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
set local role authenticated;
do $$
declare n integer;
begin
  select count(*) into n from public.telegram_destinations;
  if n <> 0 then raise exception '0386: un no-admin vio % destino(s)', n; end if;
end $$;
reset role;

-- ─── 5. Un admin de otro tenant tampoco ─────────────────────────────────────
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
set local role authenticated;
do $$
declare n integer;
begin
  select count(*) into n from public.telegram_destinations;
  -- Ve el suyo ('Ajeno'), nunca el del tenant A.
  if n <> 1 then raise exception '0386: un admin ajeno vio % destino(s), esperaba 1 (el propio)', n; end if;
end $$;
reset role;

-- ─── 6. El admin propio SÍ ve y SÍ escribe ──────────────────────────────────
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set local role authenticated;
do $$
declare n integer;
begin
  select count(*) into n from public.telegram_destinations;
  if n <> 1 then raise exception '0386: el admin propio vio % destino(s), esperaba 1', n; end if;

  insert into public.telegram_alert_routes (tenant_id, category, destination_id)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','bugs','dddddddd-dddd-4ddd-8ddd-dddddddddddd');
end $$;
reset role;

rollback;
