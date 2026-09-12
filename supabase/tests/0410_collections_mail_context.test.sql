\set ON_ERROR_STOP on

-- Contrato desechable de 0410. Identidades y emails ficticios; rollback total.
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
    create role service_role nologin bypassrls;
  end if;
end;
$roles$;

grant usage on schema public to anon, authenticated, service_role;
create schema auth;
grant usage on schema auth to authenticated, service_role;

create function auth.uid() returns uuid
language sql stable set search_path = '' as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table public.user_tenants (
  user_id uuid not null,
  tenant_id uuid not null,
  role text not null,
  disabled_at timestamptz,
  primary key (user_id, tenant_id)
);
create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = public as $$
  select ut.tenant_id from public.user_tenants as ut
  where ut.user_id = (select auth.uid()) and ut.disabled_at is null limit 1
$$;
create function public.current_studio_role() returns text
language sql stable security definer set search_path = public as $$
  select ut.role from public.user_tenants as ut
  where ut.user_id = (select auth.uid()) and ut.disabled_at is null limit 1
$$;

create table public.invoices (
  id uuid primary key,
  tenant_id uuid not null,
  client_markbox text not null,
  deleted_at timestamptz
);
create table public.clients (
  id uuid primary key,
  tenant_id uuid not null,
  markbox text not null,
  email text,
  deleted_at timestamptz
);
create table public.mail_logs (
  id uuid primary key,
  tenant_id uuid not null,
  to_email text,
  complained_at timestamptz,
  sent_at timestamptz,
  metadata jsonb
);

grant select on public.mail_logs to authenticated;
grant all on public.invoices, public.clients, public.mail_logs to service_role;
alter table public.mail_logs enable row level security;
create policy "mail_logs_tenant_select" on public.mail_logs for select to authenticated
  using (tenant_id = public.get_user_tenant_id());
create policy "mail_logs_no_insert_authenticated" on public.mail_logs for insert to authenticated with check (false);
create policy "mail_logs_no_update_authenticated" on public.mail_logs for update to authenticated using (false);
create policy "mail_logs_no_delete" on public.mail_logs for delete using (false);
create policy "mail_logs_service_role" on public.mail_logs for all to service_role using (true) with check (true);

insert into public.user_tenants (user_id, tenant_id, role, disabled_at) values
  ('aaaaaaaa-3000-0000-0000-000000000001', '10000000-3000-0000-0000-000000000001', 'admin', null),
  ('aaaaaaaa-3000-0000-0000-000000000002', '10000000-3000-0000-0000-000000000001', 'accounting', null),
  ('aaaaaaaa-3000-0000-0000-000000000003', '10000000-3000-0000-0000-000000000001', 'commercial', null),
  ('aaaaaaaa-3000-0000-0000-000000000004', '10000000-3000-0000-0000-000000000001', 'accounting', now()),
  ('bbbbbbbb-3000-0000-0000-000000000001', '20000000-3000-0000-0000-000000000002', 'accounting', null);

insert into public.clients (id, tenant_id, markbox, email) values
  ('51000000-3000-0000-0000-000000000001', '10000000-3000-0000-0000-000000000001', 'DTD-0001', 'uno@example.test'),
  ('51000000-3000-0000-0000-000000000002', '10000000-3000-0000-0000-000000000001', 'DTD-0002', null),
  ('52000000-3000-0000-0000-000000000001', '20000000-3000-0000-0000-000000000002', 'DTD-9001', 'otro@example.test');
insert into public.invoices (id, tenant_id, client_markbox) values
  ('53000000-3000-0000-0000-000000000001', '10000000-3000-0000-0000-000000000001', 'DTD-0001'),
  ('53000000-3000-0000-0000-000000000002', '10000000-3000-0000-0000-000000000001', 'DTD-0002'),
  ('54000000-3000-0000-0000-000000000001', '20000000-3000-0000-0000-000000000002', 'DTD-9001');
insert into public.mail_logs (id, tenant_id, to_email, complained_at, sent_at, metadata) values
  ('55000000-3000-0000-0000-000000000001', '10000000-3000-0000-0000-000000000001', 'uno@example.test', now(), null, '{}'),
  ('55000000-3000-0000-0000-000000000002', '10000000-3000-0000-0000-000000000001', 'uno@example.test', null, '2026-08-20T10:00:00Z', '{"event":"invoice_overdue","source_ref":{"id":"53000000-3000-0000-0000-000000000001"}}'),
  ('55000000-3000-0000-0000-000000000003', '10000000-3000-0000-0000-000000000001', 'uno@example.test', null, '2026-08-30T10:00:00Z', '{"event":"invoice_overdue","source_ref":{"id":"53000000-3000-0000-0000-000000000001"}}'),
  ('56000000-3000-0000-0000-000000000001', '20000000-3000-0000-0000-000000000002', 'otro@example.test', null, null, '{}');

-- Importación L10: normalización del email en un tenant C con su propio
-- accounting. La lista es la de String.prototype.trim() de JS, en decimal, y
-- tiene que quitarse igual en clients.email y en mail_logs.to_email.
select pg_catalog.set_config(
  'test.trim_blancos',
  '{9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279}',
  true
);

insert into public.user_tenants (user_id, tenant_id, role, disabled_at) values
  ('cccccccc-3000-0000-0000-000000000001', '30000000-3000-0000-0000-000000000003', 'accounting', null);

-- Casos con nombre. N008-N010 son controles negativos: trim() de JS NO quita
-- U+200B, U+0085 ni U+180E, así que una queja registrada sin ellos no aplica.
insert into public.clients (id, tenant_id, markbox, email) values
  ('57000000-3000-0000-0000-000000000001', '30000000-3000-0000-0000-000000000003', 'DTD-N001', E'salto@example.test\n'),
  ('57000000-3000-0000-0000-000000000002', '30000000-3000-0000-0000-000000000003', 'DTD-N002', E'\ttab@example.test'),
  ('57000000-3000-0000-0000-000000000003', '30000000-3000-0000-0000-000000000003', 'DTD-N003', pg_catalog.chr(160) || 'nbsp@example.test' || pg_catalog.chr(160)),
  ('57000000-3000-0000-0000-000000000004', '30000000-3000-0000-0000-000000000003', 'DTD-N004', pg_catalog.chr(65279) || 'bom@example.test' || pg_catalog.chr(65279)),
  ('57000000-3000-0000-0000-000000000005', '30000000-3000-0000-0000-000000000003', 'DTD-N005', 'ideografico@example.test' || pg_catalog.chr(12288)),
  ('57000000-3000-0000-0000-000000000006', '30000000-3000-0000-0000-000000000003', 'DTD-N006', E'\t'),
  ('57000000-3000-0000-0000-000000000007', '30000000-3000-0000-0000-000000000003', 'DTD-N007', 'Mixto@Example.test'),
  ('57000000-3000-0000-0000-000000000008', '30000000-3000-0000-0000-000000000003', 'DTD-N008', pg_catalog.chr(8203) || 'zw@example.test'),
  ('57000000-3000-0000-0000-000000000009', '30000000-3000-0000-0000-000000000003', 'DTD-N009', 'nel@example.test' || pg_catalog.chr(133)),
  ('57000000-3000-0000-0000-000000000010', '30000000-3000-0000-0000-000000000003', 'DTD-N010', 'mvs@example.test' || pg_catalog.chr(6158));
insert into public.invoices (id, tenant_id, client_markbox)
select ('58000000-3000-0000-0000-' || pg_catalog.lpad(n::text, 12, '0'))::uuid,
       '30000000-3000-0000-0000-000000000003'::uuid,
       'DTD-N' || pg_catalog.lpad(n::text, 3, '0')
from pg_catalog.generate_series(1, 10) as n;
insert into public.mail_logs (id, tenant_id, to_email, complained_at, sent_at, metadata) values
  ('59000000-3000-0000-0000-000000000001', '30000000-3000-0000-0000-000000000003', 'salto@example.test', now(), null, '{}'),
  ('59000000-3000-0000-0000-000000000002', '30000000-3000-0000-0000-000000000003', 'tab@example.test', now(), null, '{}'),
  ('59000000-3000-0000-0000-000000000003', '30000000-3000-0000-0000-000000000003', 'nbsp@example.test', now(), null, '{}'),
  ('59000000-3000-0000-0000-000000000004', '30000000-3000-0000-0000-000000000003', 'bom@example.test', now(), null, '{}'),
  ('59000000-3000-0000-0000-000000000005', '30000000-3000-0000-0000-000000000003', 'ideografico@example.test', now(), null, '{}'),
  ('59000000-3000-0000-0000-000000000007', '30000000-3000-0000-0000-000000000003', E'MIXTO@example.test\t', now(), null, '{}'),
  ('59000000-3000-0000-0000-000000000008', '30000000-3000-0000-0000-000000000003', 'zw@example.test', now(), null, '{}'),
  ('59000000-3000-0000-0000-000000000009', '30000000-3000-0000-0000-000000000003', 'nel@example.test', now(), null, '{}'),
  ('59000000-3000-0000-0000-000000000010', '30000000-3000-0000-0000-000000000003', 'mvs@example.test', now(), null, '{}');

-- Matriz completa: cada blanco a ambos lados del email (W) y un email que es
-- sólo ese blanco (B). La queja de W se registra ya limpia, como la guarda
-- send-email.ts. Los literales van casteados: en UNION ALL se resolverían a text.
insert into public.clients (id, tenant_id, markbox, email)
select ('5a000000-3000-0000-0000-' || pg_catalog.lpad(cp::text, 12, '0'))::uuid,
       '30000000-3000-0000-0000-000000000003'::uuid,
       'DTD-W' || cp,
       pg_catalog.chr(cp) || 'w' || cp || '@example.test' || pg_catalog.chr(cp)
from pg_catalog.unnest(pg_catalog.current_setting('test.trim_blancos')::integer[]) as cp
union all
select ('5d000000-3000-0000-0000-' || pg_catalog.lpad(cp::text, 12, '0'))::uuid,
       '30000000-3000-0000-0000-000000000003'::uuid,
       'DTD-B' || cp,
       pg_catalog.chr(cp)
from pg_catalog.unnest(pg_catalog.current_setting('test.trim_blancos')::integer[]) as cp;
insert into public.invoices (id, tenant_id, client_markbox)
select ('5b000000-3000-0000-0000-' || pg_catalog.lpad(cp::text, 12, '0'))::uuid,
       '30000000-3000-0000-0000-000000000003'::uuid,
       'DTD-W' || cp
from pg_catalog.unnest(pg_catalog.current_setting('test.trim_blancos')::integer[]) as cp
union all
select ('5e000000-3000-0000-0000-' || pg_catalog.lpad(cp::text, 12, '0'))::uuid,
       '30000000-3000-0000-0000-000000000003'::uuid,
       'DTD-B' || cp
from pg_catalog.unnest(pg_catalog.current_setting('test.trim_blancos')::integer[]) as cp;
insert into public.mail_logs (id, tenant_id, to_email, complained_at, sent_at, metadata)
select ('5c000000-3000-0000-0000-' || pg_catalog.lpad(cp::text, 12, '0'))::uuid,
       '30000000-3000-0000-0000-000000000003'::uuid,
       'w' || cp || '@example.test', now(), null, '{}'::jsonb
from pg_catalog.unnest(pg_catalog.current_setting('test.trim_blancos')::integer[]) as cp;

\ir ../migrations/0410_collections_mail_context.sql

-- Importación L10: 0410 fija lock_timeout y statement_timeout antes de su
-- primer lock o DDL (lectura estática del archivo, sin comentarios) y los deja
-- vigentes en la transacción que la aplica.
do $lock_timeout_0410$
declare
  v_code text := pg_catalog.regexp_replace(
    pg_catalog.pg_read_file('/sb/migrations/0410_collections_mail_context.sql'),
    '--[^\n]*', '', 'g'
  );
  v_lock integer := pg_catalog.strpos(v_code, 'set local lock_timeout = ''5s'';');
  v_statement integer := pg_catalog.strpos(v_code, 'set local statement_timeout = ''60s'';');
  v_first integer := pg_catalog.regexp_instr(
    v_code,
    '^[[:space:]]*(do|create|alter|drop|grant|revoke|comment|lock|select|insert|update|delete|truncate)\M',
    1, 1, 0, 'in', 1
  );
begin
  if v_lock = 0 or v_statement = 0 or v_first = 0
     or v_lock > v_first or v_statement > v_first then
    raise exception 'TEST 0410: lock_timeout y statement_timeout deben ir antes del primer lock o DDL (lock_timeout=%, statement_timeout=%, primera sentencia=%)',
      v_lock, v_statement, v_first;
  end if;
  if pg_catalog.current_setting('lock_timeout') <> '5s'
     or pg_catalog.current_setting('statement_timeout') <> '1min' then
    raise exception 'TEST 0410: la migración no dejó lock_timeout 5s y statement_timeout 60s en su transacción (%, %)',
      pg_catalog.current_setting('lock_timeout'), pg_catalog.current_setting('statement_timeout');
  end if;
end;
$lock_timeout_0410$;

-- El runner 0415 repite la misma matriz DESPUÉS de la restricción. Sin esa
-- variable se prueba que expansión y consumidor antiguo son compatibles.
\if :{?apply_mail_logs_close}
  -- 0415 tiene que fijar sus propios timeouts: se anulan antes de incluirla.
  set local lock_timeout = 0;
  set local statement_timeout = 0;
  \ir ../migrations/0415_mail_logs_read_rbac.sql
  do $lock_timeout_0415$
  begin
    if pg_catalog.current_setting('lock_timeout') <> '5s'
       or pg_catalog.current_setting('statement_timeout') <> '1min' then
      raise exception 'TEST 0415: la migración no dejó lock_timeout 5s y statement_timeout 60s en su transacción (%, %)',
        pg_catalog.current_setting('lock_timeout'), pg_catalog.current_setting('statement_timeout');
    end if;
  end;
  $lock_timeout_0415$;
  select pg_catalog.set_config('test.mail_logs_closed', 'true', true);
\else
  select pg_catalog.set_config('test.mail_logs_closed', 'false', true);
\endif

do $catalog_contract$
begin
  if pg_catalog.pg_get_function_result(
       pg_catalog.to_regprocedure('public.collections_mail_context(uuid[])')
     ) like '%to_email%'
     or pg_catalog.pg_get_function_result(
       pg_catalog.to_regprocedure('public.collections_mail_context(uuid[])')
     ) like '%metadata%' then
    raise exception 'TEST 0410: la RPC expone email o metadata';
  end if;
  if (exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'mail_logs'
      and policyname = 'mail_logs_tenant_select'
  )) = pg_catalog.current_setting('test.mail_logs_closed')::boolean then
    raise exception 'TEST 0410/0415: policy incompatible con la fase del release';
  end if;
end;
$catalog_contract$;

set local role authenticated;

-- Un rol no financiero nunca ejecuta la RPC. Su lectura histórica sobre logs
-- sólo desaparece al aplicar 0415, no al crear el facade en 0410.
set local "request.jwt.claim.sub" = 'aaaaaaaa-3000-0000-0000-000000000003';
do $commercial_blocked$
declare v_blocked boolean := false; v_count bigint;
begin
  select count(*) into v_count from public.mail_logs;
  if v_count <> (case when pg_catalog.current_setting('test.mail_logs_closed')::boolean then 0 else 3 end) then
    raise exception 'TEST 0410/0415: lectura de commercial incompatible con la fase';
  end if;
  begin
    perform * from public.collections_mail_context(
      array['53000000-3000-0000-0000-000000000001'::uuid]
    );
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'TEST 0410: commercial ejecutó el contexto de Cobranzas';
  end if;
end;
$commercial_blocked$;

set local "request.jwt.claim.sub" = 'aaaaaaaa-3000-0000-0000-000000000004';
do $disabled_blocked$
declare v_blocked boolean := false;
begin
  begin
    perform * from public.collections_mail_context(
      array['53000000-3000-0000-0000-000000000001'::uuid]
    );
  exception when insufficient_privilege then
    v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'TEST 0410: accounting desactivado ejecutó la RPC';
  end if;
end;
$disabled_blocked$;

-- Accounting recibe sólo sus facturas y las señales mínimas correctas.
set local "request.jwt.claim.sub" = 'aaaaaaaa-3000-0000-0000-000000000002';
do $accounting_context$
declare v_count bigint;
begin
  select count(*) into v_count from public.mail_logs;
  if v_count <> (case when pg_catalog.current_setting('test.mail_logs_closed')::boolean then 0 else 3 end) then
    raise exception 'TEST 0410/0415: lectura de accounting incompatible con la fase';
  end if;
  if (select count(*) from public.collections_mail_context(array[
        '53000000-3000-0000-0000-000000000001'::uuid,
        '53000000-3000-0000-0000-000000000002'::uuid,
        '54000000-3000-0000-0000-000000000001'::uuid
      ])) <> 2 then
    raise exception 'TEST 0410: la RPC no acotó facturas por tenant';
  end if;
  if not exists (
    select 1 from public.collections_mail_context(array[
      '53000000-3000-0000-0000-000000000001'::uuid
    ]) as context
    where context.client_markbox = 'DTD-0001'
      and context.has_email
      and context.complained
      and context.last_reminder_on = date '2026-08-30'
  ) then
    raise exception 'TEST 0410: señales de DTD-0001 incorrectas';
  end if;
  if not exists (
    select 1 from public.collections_mail_context(array[
      '53000000-3000-0000-0000-000000000002'::uuid
    ]) as context
    where not context.has_email
      and not context.complained
      and context.last_reminder_on is null
  ) then
    raise exception 'TEST 0410: señales de DTD-0002 incorrectas';
  end if;
end;
$accounting_context$;

-- Otro tenant no puede forzar ids de tenant A.
set local "request.jwt.claim.sub" = 'bbbbbbbb-3000-0000-0000-000000000001';
do $other_tenant$
begin
  if (select count(*) from public.collections_mail_context(array[
        '53000000-3000-0000-0000-000000000001'::uuid
      ])) <> 0 then
    raise exception 'TEST 0410: tenant B obtuvo señales de tenant A';
  end if;
  if (select count(*) from public.collections_mail_context(array[
        '54000000-3000-0000-0000-000000000001'::uuid
      ])) <> 1 then
    raise exception 'TEST 0410: tenant B perdió su propia factura';
  end if;
end;
$other_tenant$;

-- Importación L10: la RPC limpia clients.email y mail_logs.to_email como
-- String.prototype.trim() de JS y compara en minúsculas. Acumula todos los casos
-- que fallan para que un control rojo los liste completos.
set local "request.jwt.claim.sub" = 'cccccccc-3000-0000-0000-000000000001';
do $email_normalization$
declare
  v_fallas text[] := array[]::text[];
  v_caso record;
  v_cp integer;
begin
  for v_caso in
    select *
    from (values
      ('58000000-3000-0000-0000-000000000001'::uuid, 'salto de línea al final', true, true),
      ('58000000-3000-0000-0000-000000000002'::uuid, 'tab al inicio', true, true),
      ('58000000-3000-0000-0000-000000000003'::uuid, 'NBSP a ambos lados', true, true),
      ('58000000-3000-0000-0000-000000000004'::uuid, 'BOM a ambos lados', true, true),
      ('58000000-3000-0000-0000-000000000005'::uuid, 'U+3000 al final', true, true),
      ('58000000-3000-0000-0000-000000000006'::uuid, 'email que es sólo un tab', false, false),
      ('58000000-3000-0000-0000-000000000007'::uuid, 'queja con mayúsculas y tab en to_email', true, true),
      ('58000000-3000-0000-0000-000000000008'::uuid, 'U+200B no se quita (control negativo)', true, false),
      ('58000000-3000-0000-0000-000000000009'::uuid, 'U+0085 no se quita (control negativo)', true, false),
      ('58000000-3000-0000-0000-000000000010'::uuid, 'U+180E no se quita (control negativo)', true, false)
    ) as esperado(invoice_id, caso, has_email, complained)
  loop
    if not exists (
      select 1
      from public.collections_mail_context(array[v_caso.invoice_id]) as context
      where context.has_email = v_caso.has_email
        and context.complained = v_caso.complained
    ) then
      v_fallas := v_fallas || v_caso.caso;
    end if;
  end loop;

  foreach v_cp in array pg_catalog.current_setting('test.trim_blancos')::integer[] loop
    if not exists (
      select 1
      from public.collections_mail_context(array[
        ('5b000000-3000-0000-0000-' || pg_catalog.lpad(v_cp::text, 12, '0'))::uuid
      ]) as context
      where context.has_email and context.complained
    ) then
      v_fallas := v_fallas || ('U+' || pg_catalog.upper(pg_catalog.lpad(pg_catalog.to_hex(v_cp), 4, '0')) || ' a ambos lados');
    end if;
    if not exists (
      select 1
      from public.collections_mail_context(array[
        ('5e000000-3000-0000-0000-' || pg_catalog.lpad(v_cp::text, 12, '0'))::uuid
      ]) as context
      where not context.has_email and not context.complained
    ) then
      v_fallas := v_fallas || ('email que es sólo U+' || pg_catalog.upper(pg_catalog.lpad(pg_catalog.to_hex(v_cp), 4, '0')));
    end if;
  end loop;

  if pg_catalog.cardinality(v_fallas) > 0 then
    raise exception 'TEST 0410: normalización del email distinta de trim() de JS en % caso(s): %',
      pg_catalog.cardinality(v_fallas), pg_catalog.array_to_string(v_fallas, '; ');
  end if;
end;
$email_normalization$;

-- Admin conserva la consola completa del tenant.
set local "request.jwt.claim.sub" = 'aaaaaaaa-3000-0000-0000-000000000001';
do $admin_allowed$
begin
  if (select count(*) from public.mail_logs) <> 3 then
    raise exception 'TEST 0410: admin no ve los logs de su tenant';
  end if;
  if (select count(*) from public.collections_mail_context(array[
        '53000000-3000-0000-0000-000000000001'::uuid
      ])) <> 1 then
    raise exception 'TEST 0410: admin no ejecuta el facade';
  end if;
end;
$admin_allowed$;

reset role;

set local role service_role;
do $service_role_kept$
begin
  -- 4 filas de los tenants A y B más 34 del tenant C de normalización
  -- (9 casos con nombre y 25 de la matriz).
  if (select count(*) from public.mail_logs) <> 38 then
    raise exception 'TEST 0410: service_role perdió mail_logs';
  end if;
end;
$service_role_kept$;
reset role;

rollback;

select pg_catalog.to_regclass('public.mail_logs') is null
  as collections_mail_context_0410_fixture_rolled_back;
