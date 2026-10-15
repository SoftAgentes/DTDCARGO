\set ON_ERROR_STOP on
-- SDD-0526: bandeja de avisos del Portal (migración 0479).
-- Sólo datos sintéticos, PostgreSQL desechable, BEGIN/ROLLBACK. Sin Cloud ni
-- datos reales. Aplica las migraciones REALES de la cola (0247 y 0389) sobre un
-- esquema mínimo y después 0479.
--
-- El fixture es infeliz a propósito: junto a los avisos de cada cliente hay
-- filas que cumplen todo menos UNA condición (otro tenant en la cola, otro
-- tenant en el ancla, otro Shipping Mark en la cola o en el ancla, ancla
-- eliminada, estado distinto de 'sent', sent_at nulo, regla oculta). Cada
-- condición de la RPC tiene su fila que sólo ella excluye.
--
-- RED:  psql -v apply_0479=false -f /sb/tests/0479_portal_bandeja_avisos.test.sql
-- Sólo el fixture, sin transacción (para medir locks):
--       psql -v en_transaccion=false -v solo_fixture=true -f …
\if :{?apply_0479}
\else
\set apply_0479 true
\endif
\if :{?en_transaccion}
\else
\set en_transaccion true
\endif
\if :en_transaccion
begin;
\endif

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$roles$;

-- ── Esquema mínimo (forma real de 0080, 0002, 0105, 0006) ────
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table public.tenants (id uuid primary key);
-- La policy de 0247 la nombra; acá no gobierna nada.
create function public.get_user_tenant_id()
returns uuid language sql stable set search_path = '' as $$ select null::uuid $$;

create table public.clients (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id),
  markbox text not null,
  deleted_at timestamptz,
  unique (tenant_id, markbox)
);
-- Sin el unique (auth_user_id) de 0080 A PROPÓSITO: la RPC no se apoya en él
-- (con dos vínculos activos no elige ninguno, como 0453).
create table public.client_users (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id),
  client_id uuid not null references public.clients(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  status text not null check (status in ('invited', 'active', 'revoked')),
  updated_at timestamptz not null default now(),
  unique (tenant_id, client_id)
);
create table public.shipments (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id),
  code text not null,
  client_markbox text,
  deleted_at timestamptz,
  unique (tenant_id, code)
);
create table public.prealertas (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id),
  client_markbox text not null,
  code text not null,
  deleted_at timestamptz,
  unique (tenant_id, code)
);
alter table public.clients enable row level security;
alter table public.client_users enable row level security;
alter table public.shipments enable row level security;
alter table public.prealertas enable row level security;

\ir ../migrations/0247_client_notifications.sql
\ir ../migrations/0389_aviso_que_cuelga_de_la_compra.sql

-- ── Identificadores legibles ────────────────────────────────
create temporary table fx (label text primary key, id uuid not null unique);
create function pg_temp.fid(label text) returns uuid language plpgsql as $$
declare v uuid;
begin
  if label is null then return null; end if;
  v := md5('0479:' || label)::uuid;
  insert into fx (label, id) values (label, v) on conflict do nothing;
  return v;
end;
$$;

-- ── Datos sintéticos ─────────────────────────────────────────
insert into public.tenants (id) values (pg_temp.fid('T-A')), (pg_temp.fid('T-B'));
insert into auth.users (id)
select pg_temp.fid(u) from unnest(array[
  'u-a', 'u-a2', 'u-b', 'u-rev', 'u-del', 'u-staff', 'u-c', 'u-c2', 'u-cross', 'u-dos'
]) as u;

insert into public.clients (id, tenant_id, markbox, deleted_at) values
  (pg_temp.fid('c-a'),    pg_temp.fid('T-A'), 'DTD-0001', null),
  (pg_temp.fid('c-a2'),   pg_temp.fid('T-A'), 'DTD-0002', null),
  (pg_temp.fid('c-b'),    pg_temp.fid('T-B'), 'DTD-0001', null),  -- mismo Shipping Mark, otro tenant
  (pg_temp.fid('c-rev'),  pg_temp.fid('T-A'), 'DTD-0003', null),
  (pg_temp.fid('c-del'),  pg_temp.fid('T-A'), 'DTD-0004', now()),
  (pg_temp.fid('c-c'),    pg_temp.fid('T-A'), 'DTD-0005', null),
  (pg_temp.fid('c-dos1'), pg_temp.fid('T-A'), 'DTD-0006', null),
  (pg_temp.fid('c-dos2'), pg_temp.fid('T-A'), 'DTD-0007', null);

insert into public.client_users (id, tenant_id, client_id, auth_user_id, status) values
  (pg_temp.fid('cu-a'),     pg_temp.fid('T-A'), pg_temp.fid('c-a'),    pg_temp.fid('u-a'),     'active'),
  (pg_temp.fid('cu-a2'),    pg_temp.fid('T-A'), pg_temp.fid('c-a2'),   pg_temp.fid('u-a2'),    'active'),
  (pg_temp.fid('cu-b'),     pg_temp.fid('T-B'), pg_temp.fid('c-b'),    pg_temp.fid('u-b'),     'active'),
  (pg_temp.fid('cu-rev'),   pg_temp.fid('T-A'), pg_temp.fid('c-rev'),  pg_temp.fid('u-rev'),   'revoked'),
  (pg_temp.fid('cu-del'),   pg_temp.fid('T-A'), pg_temp.fid('c-del'),  pg_temp.fid('u-del'),   'active'),
  (pg_temp.fid('cu-c'),     pg_temp.fid('T-A'), pg_temp.fid('c-c'),    pg_temp.fid('u-c'),     'active'),
  -- Vínculo incoherente: el tenant del vínculo no es el del cliente.
  (pg_temp.fid('cu-cross'), pg_temp.fid('T-B'), pg_temp.fid('c-a2'),   pg_temp.fid('u-cross'), 'active'),
  -- Una persona con dos vínculos activos.
  (pg_temp.fid('cu-dos1'),  pg_temp.fid('T-A'), pg_temp.fid('c-dos1'), pg_temp.fid('u-dos'),   'active'),
  (pg_temp.fid('cu-dos2'),  pg_temp.fid('T-A'), pg_temp.fid('c-dos2'), pg_temp.fid('u-dos'),   'active');

insert into public.shipments (id, tenant_id, code, client_markbox, deleted_at) values
  (pg_temp.fid('s-a1'),    pg_temp.fid('T-A'), 'ENV-A1',   'DTD-0001', null),
  (pg_temp.fid('s-a-del'), pg_temp.fid('T-A'), 'ENV-ADEL', 'DTD-0001', now()),
  (pg_temp.fid('s-a2'),    pg_temp.fid('T-A'), 'ENV-A2',   'DTD-0002', null),
  (pg_temp.fid('s-b'),     pg_temp.fid('T-B'), 'ENV-B',    'DTD-0001', null),
  (pg_temp.fid('s-rev'),   pg_temp.fid('T-A'), 'ENV-REV',  'DTD-0003', null),
  (pg_temp.fid('s-del'),   pg_temp.fid('T-A'), 'ENV-DEL',  'DTD-0004', null),
  (pg_temp.fid('s-dos1'),  pg_temp.fid('T-A'), 'ENV-DOS1', 'DTD-0006', null);
insert into public.shipments (id, tenant_id, code, client_markbox)
select pg_temp.fid('s-c-' || n), pg_temp.fid('T-A'), 'ENV-C-' || n, 'DTD-0005'
from generate_series(1, 55) as n;

insert into public.prealertas (id, tenant_id, client_markbox, code, deleted_at) values
  (pg_temp.fid('p-a1'),    pg_temp.fid('T-A'), 'DTD-0001', 'DTD-0001-1-1', null),
  (pg_temp.fid('p-a1b'),   pg_temp.fid('T-A'), 'DTD-0001', 'DTD-0001-1-2', null),
  (pg_temp.fid('p-a-del'), pg_temp.fid('T-A'), 'DTD-0001', 'DTD-0001-1-3', now()),
  (pg_temp.fid('p-a2'),    pg_temp.fid('T-A'), 'DTD-0002', 'DTD-0002-1-1', null),
  (pg_temp.fid('p-b'),     pg_temp.fid('T-B'), 'DTD-0001', 'DTD-0001-1-1', null);

insert into public.client_notification_rules (id, tenant_id, client_id, trigger_event, visible_in_portal) values
  (pg_temp.fid('r-a-wh'),        pg_temp.fid('T-A'), null, 'status:in_warehouse', true),
  (pg_temp.fid('r-a-ship'),      pg_temp.fid('T-A'), null, 'status:shipped', true),
  (pg_temp.fid('r-a-customs'),   pg_temp.fid('T-A'), null, 'status:in_customs', false),
  (pg_temp.fid('r-a-delivered'), pg_temp.fid('T-A'), null, 'status:delivered', true),
  (pg_temp.fid('r-a-ofd'),       pg_temp.fid('T-A'), null, 'status:out_for_delivery', true),
  (pg_temp.fid('r-a-lm'),        pg_temp.fid('T-A'), null, 'status:last_mile', true),
  (pg_temp.fid('r-a-transit'),   pg_temp.fid('T-A'), null, 'status:in_transit', true),
  (pg_temp.fid('r-a-cons'),      pg_temp.fid('T-A'), null, 'consolidated', true),
  (pg_temp.fid('r-a-eta'),       pg_temp.fid('T-A'), null, 'eta_set', true),
  (pg_temp.fid('r-a-recv'),      pg_temp.fid('T-A'), null, 'received_ve', true),
  -- Overrides del cliente A: muestra aduana (oculta por defecto), oculta entregado.
  (pg_temp.fid('r-a-customs-ca'),   pg_temp.fid('T-A'), pg_temp.fid('c-a'), 'status:in_customs', true),
  (pg_temp.fid('r-a-delivered-ca'), pg_temp.fid('T-A'), pg_temp.fid('c-a'), 'status:delivered', false),
  -- Tenant B oculta «embarcado»: no puede ocultarle nada a A.
  (pg_temp.fid('r-b-ship'),      pg_temp.fid('T-B'), null, 'status:shipped', false),
  (pg_temp.fid('r-b-delivered'), pg_temp.fid('T-B'), null, 'status:delivered', true),
  (pg_temp.fid('r-b-wh'),        pg_temp.fid('T-B'), null, 'status:in_warehouse', true),
  -- Tenant B oculta «excepción»; A no tiene regla para ese evento.
  (pg_temp.fid('r-b-exception'), pg_temp.fid('T-B'), null, 'status:exception', false);

create function pg_temp.aviso(
  label text, tenant text, markbox text, envio text, compra text, regla text,
  evento text, estado text, enviado timestamptz, payload jsonb default null
) returns void language sql as $$
  insert into public.client_notification_schedule (
    id, tenant_id, client_markbox, shipment_id, prealerta_id, rule_id, trigger_event,
    channel, scheduled_for, payload, status, sent_at
  ) values (
    pg_temp.fid(label), pg_temp.fid(tenant), markbox, pg_temp.fid(envio), pg_temp.fid(compra),
    pg_temp.fid(regla), evento, 'email', '2026-10-10 12:00:00+00',
    coalesce(payload, jsonb_build_object(
      'title', 'Título ' || label, 'body', 'Texto ' || label, 'clientName', 'Nombre privado')),
    estado, enviado
  )
$$;

-- t0 = 2026-10-10 12:00 UTC.
-- Cliente A (T-A · DTD-0001)
select pg_temp.aviso('n-a-envio',    'T-A', 'DTD-0001', 's-a1', null, 'r-a-ship', 'status:shipped', 'sent', '2026-10-10 17:00:00+00');
select pg_temp.aviso('n-a-compra',   'T-A', 'DTD-0001', null, 'p-a1',  'r-a-wh', 'status:in_warehouse', 'sent', '2026-10-10 13:00:00+00');
select pg_temp.aviso('n-a-compra-2', 'T-A', 'DTD-0001', null, 'p-a1b', 'r-a-wh', 'status:in_warehouse', 'sent', '2026-10-10 13:00:00+00');
select pg_temp.aviso('n-a-aduana',   'T-A', 'DTD-0001', 's-a1', null, 'r-a-customs-ca', 'status:in_customs', 'sent', '2026-10-10 18:00:00+00');
select pg_temp.aviso('n-a-entregado','T-A', 'DTD-0001', 's-a1', null, 'r-a-delivered-ca', 'status:delivered', 'sent', '2026-10-10 19:00:00+00');
select pg_temp.aviso('n-a-programado','T-A','DTD-0001', 's-a1', null, 'r-a-ofd', 'status:out_for_delivery', 'scheduled', '2026-10-10 20:00:00+00');
select pg_temp.aviso('n-a-fallido',  'T-A', 'DTD-0001', 's-a1', null, 'r-a-lm', 'status:last_mile', 'failed', '2026-10-10 20:00:00+00');
select pg_temp.aviso('n-a-saltado',  'T-A', 'DTD-0001', 's-a1', null, 'r-a-transit', 'status:in_transit', 'skipped', '2026-10-10 20:00:00+00');
select pg_temp.aviso('n-a-cancelado','T-A', 'DTD-0001', 's-a1', null, 'r-a-cons', 'consolidated', 'canceled', '2026-10-10 20:00:00+00');
-- La regla de esta fila es de otro evento (la editaron después de programar): A no
-- tiene regla para 'status:exception' y el aviso se ve.
select pg_temp.aviso('n-a-sin-regla','T-A', 'DTD-0001', 's-a1', null, 'r-a-eta', 'status:exception', 'sent', '2026-10-10 14:00:00+00');
select pg_temp.aviso('n-a-sin-fecha','T-A', 'DTD-0001', 's-a1', null, 'r-a-eta', 'eta_set', 'sent', null);
select pg_temp.aviso('n-a-envio-borrado',  'T-A', 'DTD-0001', 's-a-del', null, 'r-a-ship', 'status:shipped', 'sent', '2026-10-10 21:00:00+00');
select pg_temp.aviso('n-a-compra-borrada', 'T-A', 'DTD-0001', null, 'p-a-del', 'r-a-wh', 'status:in_warehouse', 'sent', '2026-10-10 21:00:00+00');
-- Filas incoherentes: cada una cumple todo menos UNA condición.
select pg_temp.aviso('n-x-envio-de-otro-cliente', 'T-A', 'DTD-0001', 's-a2', null, 'r-a-wh', 'status:in_warehouse', 'sent', '2026-10-10 15:00:00+00');
select pg_temp.aviso('n-x-envio-de-otro-tenant',  'T-A', 'DTD-0001', 's-b',  null, 'r-a-wh', 'status:in_warehouse', 'sent', '2026-10-10 15:00:00+00');
select pg_temp.aviso('n-x-cola-de-otro-tenant',   'T-B', 'DTD-0001', 's-a1', null, 'r-b-wh', 'status:in_warehouse', 'sent', '2026-10-10 15:00:00+00');
select pg_temp.aviso('n-x-compra-de-otro-cliente','T-A', 'DTD-0001', null, 'p-a2', 'r-a-ship', 'status:shipped', 'sent', '2026-10-10 15:00:00+00');
select pg_temp.aviso('n-x-compra-de-otro-tenant', 'T-A', 'DTD-0001', null, 'p-b',  'r-a-wh', 'status:in_warehouse', 'sent', '2026-10-10 15:00:00+00');
-- Cliente A2 (T-A · DTD-0002)
select pg_temp.aviso('n-a2-envio',     'T-A', 'DTD-0002', 's-a2', null, 'r-a-ship', 'status:shipped', 'sent', '2026-10-10 16:00:00+00');
select pg_temp.aviso('n-a2-aduana',    'T-A', 'DTD-0002', 's-a2', null, 'r-a-customs', 'status:in_customs', 'sent', '2026-10-10 17:00:00+00');
select pg_temp.aviso('n-a2-entregado', 'T-A', 'DTD-0002', 's-a2', null, 'r-a-delivered', 'status:delivered', 'sent', '2026-10-10 16:30:00+00', '{}'::jsonb);
select pg_temp.aviso('n-a2-compra',    'T-A', 'DTD-0002', null, 'p-a2', 'r-a-wh', 'status:in_warehouse', 'sent', '2026-10-10 12:30:00+00',
  jsonb_build_object('title', '   ', 'body', 'Recibimos tu mercancía en Yiwu.'));
-- Cliente B (T-B · DTD-0001)
select pg_temp.aviso('n-b-embarcado', 'T-B', 'DTD-0001', 's-b', null, 'r-b-ship', 'status:shipped', 'sent', '2026-10-10 14:00:00+00');
select pg_temp.aviso('n-b-entregado', 'T-B', 'DTD-0001', 's-b', null, 'r-b-delivered', 'status:delivered', 'sent', '2026-10-10 15:00:00+00');
select pg_temp.aviso('n-b-compra',    'T-B', 'DTD-0001', null, 'p-b', 'r-b-wh', 'status:in_warehouse', 'sent', '2026-10-10 13:00:00+00');
-- Vínculo revocado, cliente eliminado y persona con dos vínculos: tienen avisos.
select pg_temp.aviso('n-rev',  'T-A', 'DTD-0003', 's-rev',  null, 'r-a-ship', 'status:shipped', 'sent', '2026-10-10 14:00:00+00');
select pg_temp.aviso('n-del',  'T-A', 'DTD-0004', 's-del',  null, 'r-a-ship', 'status:shipped', 'sent', '2026-10-10 14:00:00+00');
select pg_temp.aviso('n-dos1', 'T-A', 'DTD-0006', 's-dos1', null, 'r-a-ship', 'status:shipped', 'sent', '2026-10-10 14:00:00+00');
-- Cliente C: 55 avisos para el tope.
select pg_temp.aviso('n-c-' || n, 'T-A', 'DTD-0005', 's-c-' || n, null, 'r-a-ship', 'status:shipped', 'sent',
  '2026-10-10 12:00:00+00'::timestamptz + make_interval(mins => n))
from generate_series(1, 55) as n;

\if :{?solo_fixture}
\quit
\endif

\if :apply_0479
\ir ../migrations/0479_portal_bandeja_avisos.sql
\endif

-- ── Herramientas del contrato ───────────────────────────────
create temporary sequence aserciones;
create function pg_temp.ok(value boolean, label text) returns void language plpgsql as $$
begin
  if value is distinct from true then raise exception 'TEST 0479: %', label; end if;
  perform nextval('pg_temp.aserciones');
end;
$$;

-- La bandeja de `actor` como un principal real (authenticated), con etiquetas.
create function pg_temp.lista(actor text, compra text default null, lim integer default 20)
returns jsonb language plpgsql as $$
declare raw jsonb; result jsonb; v_compra uuid := pg_temp.fid(compra);
begin
  perform set_config('request.jwt.claim.sub', coalesce(pg_temp.fid(actor)::text, ''), true);
  execute 'set local role authenticated';
  select coalesce(jsonb_agg(to_jsonb(r) order by r.ord), '[]'::jsonb) into raw
  from public.portal_list_my_notifications(v_compra, lim)
    with ordinality as r(id, trigger_event, anchor_kind, anchor_code, title, body, channel, sent_at, unread, ord);
  reset role;
  select coalesce(jsonb_agg(x.e || jsonb_build_object('label', coalesce(fx.label, x.e ->> 'id')) order by x.ord), '[]'::jsonb)
    into result
  from jsonb_array_elements(raw) with ordinality as x(e, ord)
  left join fx on fx.id = (x.e ->> 'id')::uuid;
  return result;
exception when others then reset role; raise;
end;
$$;
create function pg_temp.etiquetas(j jsonb) returns text[] language sql as $$
  select coalesce(array_agg(e ->> 'label' order by ord), '{}') from jsonb_array_elements(j) with ordinality as x(e, ord)
$$;
create function pg_temp.no_leidos(j jsonb) returns text[] language sql as $$
  select coalesce(array_agg(e ->> 'label' order by ord), '{}')
  from jsonb_array_elements(j) with ordinality as x(e, ord) where (e ->> 'unread')::boolean
$$;
create function pg_temp.marcar(actor text, hasta timestamptz) returns timestamptz language plpgsql as $$
declare result timestamptz;
begin
  perform set_config('request.jwt.claim.sub', coalesce(pg_temp.fid(actor)::text, ''), true);
  execute 'set local role authenticated';
  select public.portal_mark_my_notifications_seen(hasta) into result;
  reset role;
  return result;
exception when others then reset role; raise;
end;
$$;
-- Rechazo exacto por SQLSTATE; nada cambia.
create function pg_temp.niega(label text, actor text, hasta timestamptz, expected text) returns void
language plpgsql as $$
declare code text; denied boolean := false; antes bigint; despues bigint;
begin
  select count(*) into antes from public.portal_notification_seen;
  begin
    perform pg_temp.marcar(actor, hasta);
  exception when others then
    get stacked diagnostics code = returned_sqlstate;
    if code <> expected then raise exception 'TEST 0479: % esperaba %, obtuvo %', label, expected, code; end if;
    denied := true;
  end;
  select count(*) into despues from public.portal_notification_seen;
  perform pg_temp.ok(denied and antes = despues, label || ': se esperaba ' || expected || ' sin escribir');
end;
$$;

-- ── 1. Forma y permisos ─────────────────────────────────────
select pg_temp.ok(to_regprocedure('public.portal_list_my_notifications(uuid,integer)') is not null,
  'la RPC de la bandeja no existe');
select pg_temp.ok(
  has_function_privilege('authenticated', 'public.portal_list_my_notifications(uuid,integer)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.portal_mark_my_notifications_seen(timestamptz)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.portal_list_my_notifications(uuid,integer)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.portal_mark_my_notifications_seen(timestamptz)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.portal_notification_seen_forget()', 'EXECUTE'),
  'ACL de las RPC');
select pg_temp.ok(
  not has_table_privilege('authenticated', 'public.portal_notification_seen', 'SELECT, INSERT, UPDATE, DELETE')
  and not has_table_privilege('anon', 'public.portal_notification_seen', 'SELECT, INSERT, UPDATE, DELETE'),
  'la tabla del visto no se lee ni se escribe desde la API');
do $directo$
declare denied boolean := false;
begin
  perform set_config('request.jwt.claim.sub', md5('0479:u-a')::uuid::text, true);
  set local role authenticated;
  begin
    perform 1 from public.portal_notification_seen;
  exception when insufficient_privilege then denied := true;
  end;
  reset role;
  perform pg_temp.ok(denied, 'authenticated leyó la tabla del visto directo');
end;
$directo$;

-- ── 2. Sin principal válido, nada ───────────────────────────
select pg_temp.ok(pg_temp.lista(null) = '[]'::jsonb, 'sin sesión la bandeja devolvió avisos');
select pg_temp.ok(pg_temp.lista('u-staff') = '[]'::jsonb, 'un usuario sin vínculo vio avisos');
select pg_temp.ok(pg_temp.lista('u-rev') = '[]'::jsonb, 'un vínculo revocado vio avisos');
select pg_temp.ok(pg_temp.lista('u-del') = '[]'::jsonb, 'un cliente eliminado vio avisos');
select pg_temp.ok(pg_temp.lista('u-cross') = '[]'::jsonb, 'un vínculo de otro tenant vio los avisos del cliente');
select pg_temp.ok(pg_temp.lista('u-dos') = '[]'::jsonb, 'una persona con dos vínculos activos vio avisos');

-- ── 3. Sólo lo enviado ──────────────────────────────────────
select pg_temp.ok(
  not (pg_temp.etiquetas(pg_temp.lista('u-a')) && array['n-a-programado', 'n-a-fallido', 'n-a-saltado', 'n-a-cancelado']),
  'entró un aviso que no está en sent');
select pg_temp.ok(not ('n-a-sin-fecha' = any (pg_temp.etiquetas(pg_temp.lista('u-a')))),
  'entró un aviso sent sin sent_at');

-- ── 4. Anclas vivas ─────────────────────────────────────────
select pg_temp.ok(not ('n-a-envio-borrado' = any (pg_temp.etiquetas(pg_temp.lista('u-a')))),
  'entró el aviso de un envío eliminado');
select pg_temp.ok(not ('n-a-compra-borrada' = any (pg_temp.etiquetas(pg_temp.lista('u-a')))),
  'entró el aviso de una compra eliminada');

-- ── 5. Frontera de tenant y Shipping Mark ───────────────────
select pg_temp.ok(not ('n-x-cola-de-otro-tenant' = any (pg_temp.etiquetas(pg_temp.lista('u-a')))),
  'A vio una fila de la cola de otro tenant');
select pg_temp.ok(not ('n-x-envio-de-otro-tenant' = any (pg_temp.etiquetas(pg_temp.lista('u-a')))),
  'A vio un aviso colgado de un envío de otro tenant');
select pg_temp.ok(not ('n-x-envio-de-otro-cliente' = any (pg_temp.etiquetas(pg_temp.lista('u-a')))),
  'A vio un aviso colgado del envío de otro cliente');
select pg_temp.ok(not ('n-x-compra-de-otro-tenant' = any (pg_temp.etiquetas(pg_temp.lista('u-a')))),
  'A vio un aviso colgado de una compra de otro tenant');
select pg_temp.ok(not ('n-x-compra-de-otro-cliente' = any (pg_temp.etiquetas(pg_temp.lista('u-a')))),
  'A vio un aviso colgado de la compra de otro cliente');
select pg_temp.ok(
  not (pg_temp.etiquetas(pg_temp.lista('u-a2')) && array['n-x-envio-de-otro-cliente', 'n-x-compra-de-otro-cliente']),
  'A2 vio una fila de la cola con el Shipping Mark de A');
select pg_temp.ok(
  not (pg_temp.etiquetas(pg_temp.lista('u-b')) && array['n-x-cola-de-otro-tenant', 'n-a-envio', 'n-a-compra']),
  'B (mismo Shipping Mark, otro tenant) vio avisos de A');

-- ── 6. «Visible en el portal» ───────────────────────────────
select pg_temp.ok('n-a-aduana' = any (pg_temp.etiquetas(pg_temp.lista('u-a'))),
  'el override visible del cliente no le ganó al default oculto');
select pg_temp.ok(not ('n-a-entregado' = any (pg_temp.etiquetas(pg_temp.lista('u-a')))),
  'el override oculto del cliente no le ganó al default visible');
select pg_temp.ok('n-a2-entregado' = any (pg_temp.etiquetas(pg_temp.lista('u-a2'))),
  'el override de un cliente ocultó el aviso de otro');
select pg_temp.ok(not ('n-a2-aduana' = any (pg_temp.etiquetas(pg_temp.lista('u-a2')))),
  'el default oculto del tenant no ocultó el aviso');
select pg_temp.ok('n-a-sin-regla' = any (pg_temp.etiquetas(pg_temp.lista('u-a'))),
  'sin regla propia el aviso no se vio, o lo ocultó la regla de otro tenant');
select pg_temp.ok(not ('n-b-embarcado' = any (pg_temp.etiquetas(pg_temp.lista('u-b')))),
  'el default oculto del tenant B no ocultó su aviso');

-- ── 7. Una compra ───────────────────────────────────────────
select pg_temp.ok(pg_temp.etiquetas(pg_temp.lista('u-a', 'p-a1')) = array['n-a-compra'],
  'el filtro por compra no acotó a esa compra');
select pg_temp.ok(pg_temp.etiquetas(pg_temp.lista('u-a', 'p-a1b')) = array['n-a-compra-2'],
  'el filtro por compra no acotó a la segunda compra');
select pg_temp.ok(pg_temp.lista('u-a', 'p-a2') = '[]'::jsonb, 'el filtro por compra abrió la compra de otro cliente');
select pg_temp.ok(pg_temp.lista('u-a', 'p-a-del') = '[]'::jsonb, 'el filtro por compra abrió una compra eliminada');

-- ── 8. Lista exacta, orden y forma ──────────────────────────
select pg_temp.ok(
  pg_temp.etiquetas(pg_temp.lista('u-a')) = array['n-a-aduana', 'n-a-envio', 'n-a-sin-regla']
    || case when pg_temp.fid('n-a-compra') > pg_temp.fid('n-a-compra-2')
            then array['n-a-compra', 'n-a-compra-2'] else array['n-a-compra-2', 'n-a-compra'] end,
  'la bandeja de A no es la esperada, del más nuevo al más viejo (empate por id)');
select pg_temp.ok(pg_temp.etiquetas(pg_temp.lista('u-a2')) = array['n-a2-entregado', 'n-a2-envio', 'n-a2-compra'],
  'la bandeja de A2 no es la esperada');
select pg_temp.ok(pg_temp.etiquetas(pg_temp.lista('u-b')) = array['n-b-entregado', 'n-b-compra'],
  'la bandeja de B no es la esperada');
select pg_temp.ok(
  (select e from jsonb_array_elements(pg_temp.lista('u-a')) as e where e ->> 'label' = 'n-a-envio')
    @> jsonb_build_object('anchor_kind', 'envio', 'anchor_code', 'ENV-A1', 'title', 'Título n-a-envio',
                          'body', 'Texto n-a-envio', 'channel', 'email', 'trigger_event', 'status:shipped'),
  'forma del aviso de envío');
select pg_temp.ok(
  (select e from jsonb_array_elements(pg_temp.lista('u-a')) as e where e ->> 'label' = 'n-a-compra')
    @> jsonb_build_object('anchor_kind', 'compra', 'anchor_code', 'DTD-0001-1-1'),
  'forma del aviso de compra');
select pg_temp.ok(
  (select e ->> 'title' is null and e ->> 'body' is null
   from jsonb_array_elements(pg_temp.lista('u-a2')) as e where e ->> 'label' = 'n-a2-entregado')
  and (select e ->> 'title' is null and e ->> 'body' = 'Recibimos tu mercancía en Yiwu.'
   from jsonb_array_elements(pg_temp.lista('u-a2')) as e where e ->> 'label' = 'n-a2-compra'),
  'título o texto vacío no vuelven como null');
select pg_temp.ok(pg_temp.lista('u-a')::text !~ 'Nombre privado', 'la bandeja devolvió datos del payload que no son el aviso');

-- ── 9. Tope ─────────────────────────────────────────────────
select pg_temp.ok(jsonb_array_length(pg_temp.lista('u-c')) = 20, 'por defecto no devuelve 20');
select pg_temp.ok(jsonb_array_length(pg_temp.lista('u-c', null, null)) = 20, 'con límite nulo no devuelve 20');
select pg_temp.ok(jsonb_array_length(pg_temp.lista('u-c', null, 1000)) = 50, 'el tope no es 50');
select pg_temp.ok(jsonb_array_length(pg_temp.lista('u-c', null, 0)) = 1, 'el mínimo no es 1');

-- ── 10. No leídos y marcar como visto ───────────────────────
select pg_temp.ok(pg_temp.no_leidos(pg_temp.lista('u-a')) = pg_temp.etiquetas(pg_temp.lista('u-a')),
  'sin visto, todos los avisos deben estar sin leer');
select pg_temp.ok(pg_temp.marcar('u-a', '2026-10-10 17:00:00+00') = '2026-10-10 17:00:00+00',
  'marcar devolvió otra fecha');
select pg_temp.ok(pg_temp.no_leidos(pg_temp.lista('u-a')) = array['n-a-aduana'],
  'visto hasta el aviso de las 17:00 deja sin leer sólo el posterior');
select pg_temp.ok(pg_temp.marcar('u-a', '2026-10-10 13:00:00+00') = '2026-10-10 17:00:00+00',
  'el visto retrocedió');
select pg_temp.ok(pg_temp.no_leidos(pg_temp.lista('u-a')) = array['n-a-aduana'],
  'un visto más viejo cambió los no leídos');
select pg_temp.ok(pg_temp.no_leidos(pg_temp.lista('u-a2')) = pg_temp.etiquetas(pg_temp.lista('u-a2')),
  'el visto de A cambió los no leídos de A2');
select pg_temp.ok(pg_temp.marcar('u-a', now() + interval '1 year') = now(), 'el visto futuro no se recortó a now()');
select pg_temp.aviso('n-a-nuevo', 'T-A', 'DTD-0001', 's-a1', null, 'r-a-recv', 'received_ve', 'sent', now() + interval '1 minute');
select pg_temp.ok(pg_temp.no_leidos(pg_temp.lista('u-a')) = array['n-a-nuevo'],
  'un aviso posterior al visto recortado no quedó sin leer');
select pg_temp.niega('marcar sin sesión', null, now(), '42501');
select pg_temp.niega('marcar sin vínculo', 'u-staff', now(), '42501');
select pg_temp.niega('marcar con vínculo revocado', 'u-rev', now(), '42501');
select pg_temp.niega('marcar con cliente eliminado', 'u-del', now(), '42501');
select pg_temp.niega('marcar con vínculo de otro tenant', 'u-cross', now(), '42501');
select pg_temp.niega('marcar con dos vínculos', 'u-dos', now(), '42501');
select pg_temp.niega('marcar sin fecha', 'u-a', null, '22004');

-- ── 11. El visto no sobrevive al vínculo ────────────────────
select pg_temp.marcar('u-a2', '2026-10-10 16:00:00+00');
update public.client_users set updated_at = now() + interval '1 second' where id = pg_temp.fid('cu-a2');
select pg_temp.ok(exists (select 1 from public.portal_notification_seen where client_user_id = pg_temp.fid('cu-a2')),
  'otro cambio del vínculo borró el visto');
update public.client_users set status = 'revoked' where id = pg_temp.fid('cu-a2');
select pg_temp.ok(not exists (select 1 from public.portal_notification_seen where client_user_id = pg_temp.fid('cu-a2'))
  and exists (select 1 from public.portal_notification_seen where client_user_id = pg_temp.fid('cu-a')),
  'revocar el vínculo no borró su visto, o borró el de otro');
-- Un visto que haya quedado colgado de un vínculo revocado no lo hereda quien lo reactive.
insert into public.portal_notification_seen (client_user_id, last_seen_at)
values (pg_temp.fid('cu-a2'), '2030-01-01 00:00:00+00');
update public.client_users set status = 'active' where id = pg_temp.fid('cu-a2');
select pg_temp.ok(not exists (select 1 from public.portal_notification_seen where client_user_id = pg_temp.fid('cu-a2'))
  and pg_temp.no_leidos(pg_temp.lista('u-a2')) = pg_temp.etiquetas(pg_temp.lista('u-a2')),
  'reactivar el vínculo heredó un visto viejo');
select pg_temp.marcar('u-c', now());
update public.client_users set auth_user_id = pg_temp.fid('u-c2') where id = pg_temp.fid('cu-c');
select pg_temp.ok(not exists (select 1 from public.portal_notification_seen where client_user_id = pg_temp.fid('cu-c')),
  'cambiar la persona del vínculo no borró el visto');

do $fin$
begin
  raise notice 'TEST 0479 GREEN: % aserciones', currval('pg_temp.aserciones');
end;
$fin$;

reset role;
\if :en_transaccion
rollback;
\endif

select pg_catalog.to_regprocedure('public.portal_list_my_notifications(uuid,integer)') is null
  as portal_bandeja_avisos_0479_fixture_rolled_back;
