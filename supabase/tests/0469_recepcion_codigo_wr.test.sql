\set ON_ERROR_STOP on

-- Contrato desechable de la 0469 (SDD-0491). Fixtures ficticios + rollback.
-- Aplica la 0449 real (la recepción de la prealerta, que numera WR- con la tabla
-- tomada) y encima la 0469, y demuestra que una recepción creada desde el Studio
-- sin receipt_code sale numerada por la base:
--   · WR-YYYY-NNNN en la serie compartida con la prealerta y el operario;
--   · SIN-CODIGO-NNNN si es huérfana;
--   · contando las recepciones borradas, que la RLS del Studio esconde;
--   · por tenant y por año, sin truncar pasado 9999;
--   · sin tocar la que trae su código.
-- CONTROL ROJO: con `-v apply_fix=false` la 0469 no se aplica y la primera
-- aserción falla, porque la columna es NOT NULL y nadie la llena. La
-- concurrencia (dos altas a la vez) la prueban sesiones reales en
-- 0469_recepcion_codigo_wr_carrera.test.sql.
\if :{?apply_fix}
\else
\set apply_fix true
\endif
begin;
do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$roles$;
create schema if not exists auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('test.uid', true), '')::uuid
$$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
create table public.tenants (id uuid primary key);
create table public.user_tenants (user_id uuid, tenant_id uuid, role text, disabled_at timestamptz);
grant select on public.user_tenants to authenticated;
create function public.get_user_tenant_id() returns uuid language sql stable as $$
  select tenant_id from public.user_tenants where user_id = auth.uid() and disabled_at is null limit 1
$$;
grant execute on function public.get_user_tenant_id() to authenticated;
create type public.warehouse_receipt_status as enum ('pendiente_consolidacion');
create type public.warehouse_receipt_event_type as enum ('received', 'note');
create table public.operario_pins (id uuid, tenant_id uuid, region text, active boolean, warehouse_id uuid);
create table public.prealertas (id uuid primary key, tenant_id uuid, code text, client_markbox text,
  supplier_id uuid, status text, deleted_at timestamptz, boxes integer, received_at timestamptz);
create table public.suppliers_cn (id uuid, name text);
-- Las columnas de la 0008 que usan la 0449, la 0469 y el Studio, con sus NOT NULL
-- y el unique (tenant_id, receipt_code). RLS y grants como la 0008 y la 0012.
create table public.warehouse_receipts_cn (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  receipt_code text not null,
  warehouse_id uuid,
  client_markbox text,
  client_name text,
  is_orphan boolean not null default false,
  supplier_name text,
  boxes integer not null default 0,
  status public.warehouse_receipt_status not null default 'pendiente_consolidacion',
  received_at date not null default current_date,
  created_by_operario_id uuid,
  prealerta_id uuid,
  notes text,
  deleted_at timestamptz,
  unique (tenant_id, receipt_code)
);
alter table public.warehouse_receipts_cn enable row level security;
create policy "warehouse_receipts_cn by tenant"
  on public.warehouse_receipts_cn for all to authenticated
  using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null)
  with check (tenant_id = (select public.get_user_tenant_id()));
grant select, insert, update, delete on public.warehouse_receipts_cn to authenticated;
create table public.warehouse_boxes (id uuid primary key default gen_random_uuid(), tenant_id uuid,
  prealerta_id uuid, receipt_id uuid, status text, code text, markbox text, deleted_at timestamptz, seq integer);
create table public.warehouse_receipt_events (tenant_id uuid, receipt_id uuid,
  event_type public.warehouse_receipt_event_type, description text, occurred_at timestamptz);
create table public.packing_list_submissions (id uuid default gen_random_uuid(), tenant_id uuid,
  prealerta_id uuid, total_ctns numeric, is_current boolean, deleted_at timestamptz);
\ir ../migrations/0449_prealerta_exact_box_reception.sql

create function pg_temp.fid(p_label text) returns uuid language sql immutable as $$
  select md5('0469-contrato-' || p_label)::uuid
$$;
insert into public.tenants values (pg_temp.fid('tenant-A')), (pg_temp.fid('tenant-B'));
insert into auth.users values (pg_temp.fid('admin-A')), (pg_temp.fid('admin-B'));
insert into public.user_tenants values
  (pg_temp.fid('admin-A'), pg_temp.fid('tenant-A'), 'admin', null),
  (pg_temp.fid('admin-B'), pg_temp.fid('tenant-B'), 'admin', null);
insert into public.operario_pins values
  (pg_temp.fid('operario-A'), pg_temp.fid('tenant-A'), 'cn', true, pg_temp.fid('almacen-A'));
insert into public.prealertas values (pg_temp.fid('prealerta-A'), pg_temp.fid('tenant-A'), 'DTD-0469-1-1',
  'DTD-0469', null, 'anunciada', null, 1, null);
insert into public.warehouse_boxes (tenant_id, prealerta_id, status, code, markbox, seq)
values (pg_temp.fid('tenant-A'), pg_temp.fid('prealerta-A'), 'esperada', 'DTD-B-046901', 'DTD-0469', 1);

\if :apply_fix
\ir ../migrations/0469_recepcion_codigo_wr.sql
\endif

-- ── Aserciones ──────────────────────────────────────────────
create temporary sequence aserciones;
create function pg_temp.afirmar(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'TEST 0469: %', p_msg; end if;
  perform nextval('pg_temp.aserciones');
end;
$$;

-- Lo que hace createReceiptAction: INSERT por PostgREST, como el usuario del
-- Studio, sin receipt_code, y lee el código de vuelta.
create function pg_temp.alta_studio(p_usuario text, p_tenant text, p_huerfana boolean,
  p_codigo text default null) returns text language plpgsql as $$
declare
  v_codigo text;
begin
  perform set_config('test.uid', pg_temp.fid(p_usuario)::text, true);
  set local role authenticated;
  if p_codigo is null then
    insert into public.warehouse_receipts_cn (tenant_id, warehouse_id, client_markbox, client_name, is_orphan, boxes)
    values (pg_temp.fid(p_tenant), pg_temp.fid('almacen-A'),
            case when p_huerfana then null else 'DTD-0469' end,
            case when p_huerfana then null else 'Cliente 0469' end, p_huerfana, 1)
    returning receipt_code into v_codigo;
  else
    insert into public.warehouse_receipts_cn (tenant_id, receipt_code, warehouse_id, is_orphan, boxes)
    values (pg_temp.fid(p_tenant), p_codigo, pg_temp.fid('almacen-A'), p_huerfana, 1)
    returning receipt_code into v_codigo;
  end if;
  reset role;
  return v_codigo;
end;
$$;

do $contrato$
declare
  v_anio text := to_char(current_date, 'YYYY');
  v_codigo text;
  r jsonb;
begin
  -- 1. Dos altas del Studio: WR- del año, correlativas.
  perform pg_temp.afirmar(pg_temp.alta_studio('admin-A', 'tenant-A', false) = 'WR-' || v_anio || '-0001',
    'la primera alta del Studio no salió WR-' || v_anio || '-0001');
  perform pg_temp.afirmar(pg_temp.alta_studio('admin-A', 'tenant-A', false) = 'WR-' || v_anio || '-0002',
    'la segunda alta del Studio no siguió la serie');

  -- 2. La prealerta (0449) numera con su propia regla sobre la misma serie.
  r := public.receive_prealerta_boxes_as_operario(pg_temp.fid('operario-A'), 'DTD-B-046901', array['DTD-B-046901']);
  perform pg_temp.afirmar(r ->> 'receipt_code' = 'WR-' || v_anio || '-0003',
    'la prealerta no continuó la serie compartida: ' || coalesce(r ->> 'receipt_code', 'null'));
  perform pg_temp.afirmar(pg_temp.alta_studio('admin-A', 'tenant-A', false) = 'WR-' || v_anio || '-0004',
    'el Studio no continuó después de la prealerta');

  -- 3. Una recepción borrada con el número más alto también cuenta: el unique la
  --    incluye aunque la RLS del Studio no la muestre.
  insert into public.warehouse_receipts_cn (tenant_id, receipt_code, is_orphan, deleted_at)
  values (pg_temp.fid('tenant-A'), 'WR-' || v_anio || '-0009', false, now());
  perform pg_temp.afirmar(pg_temp.alta_studio('admin-A', 'tenant-A', false) = 'WR-' || v_anio || '-0010',
    'el Studio reusó el número de una recepción borrada');

  -- 4. Huérfanas: SIN-CODIGO-, en su propia serie.
  perform pg_temp.afirmar(pg_temp.alta_studio('admin-A', 'tenant-A', true) = 'SIN-CODIGO-0001',
    'la primera huérfana no salió SIN-CODIGO-0001');
  perform pg_temp.afirmar(pg_temp.alta_studio('admin-A', 'tenant-A', true) = 'SIN-CODIGO-0002',
    'la segunda huérfana no siguió su serie');

  -- 5. Un código que llega se respeta, y el vacío se numera.
  perform pg_temp.afirmar(pg_temp.alta_studio('admin-A', 'tenant-A', false, 'WR-' || v_anio || '-0500')
      = 'WR-' || v_anio || '-0500', 'el trigger pisó un código que llegó hecho');
  perform pg_temp.afirmar(pg_temp.alta_studio('admin-A', 'tenant-A', false, '  ') = 'WR-' || v_anio || '-0501',
    'un código en blanco no se numeró');

  -- 6. Por tenant: B empieza su serie.
  perform pg_temp.afirmar(pg_temp.alta_studio('admin-B', 'tenant-B', false) = 'WR-' || v_anio || '-0001',
    'el tenant B no empezó su propia serie');

  -- 7. El año anterior no cuenta, y pasado 9999 no trunca.
  insert into public.warehouse_receipts_cn (tenant_id, receipt_code, is_orphan)
  values (pg_temp.fid('tenant-B'), 'WR-' || (v_anio::int - 1) || '-7000', false),
         (pg_temp.fid('tenant-B'), 'WR-' || v_anio || '-9999', false);
  perform pg_temp.afirmar(pg_temp.alta_studio('admin-B', 'tenant-B', false) = 'WR-' || v_anio || '-10000',
    'pasado 9999 el código no siguió (lpad trunca)');

  -- 8. La función es interna: DEFINER, de postgres, search_path vacío, sin
  --    EXECUTE para los roles de la API, y el trigger BEFORE INSERT por fila.
  perform pg_temp.afirmar(exists (
      select 1 from pg_proc p
       where p.oid = 'public.warehouse_receipts_cn_assign_code()'::regprocedure
         and p.prosecdef and p.proowner = 'postgres'::regrole
         and p.proconfig = array['search_path=""']::text[]),
    'la función de numeración no es DEFINER de postgres con search_path vacío');
  perform pg_temp.afirmar(not has_function_privilege('authenticated', 'public.warehouse_receipts_cn_assign_code()', 'EXECUTE')
      and not has_function_privilege('anon', 'public.warehouse_receipts_cn_assign_code()', 'EXECUTE')
      and not has_function_privilege('service_role', 'public.warehouse_receipts_cn_assign_code()', 'EXECUTE'),
    'la función de numeración quedó ejecutable por un rol de la API');
  perform pg_temp.afirmar(exists (
      select 1 from pg_trigger t
       where t.tgrelid = 'public.warehouse_receipts_cn'::regclass
         and t.tgname = 'warehouse_receipts_cn_assign_code' and t.tgenabled = 'O'
         and (t.tgtype & 7) = 7 and (t.tgtype & 24) = 0),
    'el trigger no es BEFORE INSERT FOR EACH ROW');

  raise notice 'TEST 0469 OK: % aserciones', currval('pg_temp.aserciones');
end;
$contrato$;

rollback;
