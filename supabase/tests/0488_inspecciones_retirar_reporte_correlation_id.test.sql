\set ON_ERROR_STOP on

-- SDD-0534 · contrato de 0488 con el writer AUD-01 REAL.
--
-- El contrato de 0323 simula append_audit_event sin validar el correlation_id
-- y usa referencias cortas ('inspection-retire-0001'). La pantalla
-- (InspeccionesClient.tsx:506) manda `inspection-report-retirement:<id>:<uuid>`,
-- 102 caracteres, y la 0323 arma con ella un correlation_id de 168. Este
-- contrato monta el writer de verdad (_audit-writer-real.sql: 0267 y 0294
-- reales), la fixture del contrato 0323 sin su writer simulado, y después 0323
-- y 0488. Sin 0488 cae en el escenario 2 con 22023 «audit: correlation_id
-- inválido»: ése es el control rojo.
--
-- Termina siempre en ROLLBACK. No imprime payloads.
begin;

\ir _audit-writer-real.sql

-- ── Inspecciones: la fixture del contrato 0323 ──────────────────────────────
create table public.user_tenants (
  user_id uuid not null, tenant_id uuid not null, role text not null,
  disabled_at timestamptz
);
create table public.inspection_reports (
  id uuid primary key, tenant_id uuid not null, report_no text not null,
  type text not null, client_id uuid, client_name text, title text not null,
  product text, inspection_date date, duration_mandays numeric, score integer,
  conclusion text, status text not null, payload jsonb not null default '{}',
  provider_internal text, created_by uuid, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), deleted_at timestamptz
);
create table public.inspection_report_photos (
  id uuid primary key, tenant_id uuid not null, report_id uuid not null,
  category text, caption text, storage_path text not null, redacted boolean not null default false,
  sort integer not null default 0, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), deleted_at timestamptz
);

grant select, update, delete on public.inspection_reports to authenticated;
grant select, update, delete on public.inspection_report_photos to authenticated;

\ir ../migrations/0323_inspection_report_retirement_governance.sql
\ir ../migrations/0488_inspecciones_retirar_reporte_correlation_id.sql

grant select on public.entity_audit_log to authenticated;

insert into public.tenants values ('10000000-0000-0000-0000-000000000001');
insert into public.user_tenants values
  ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','operations',null);
insert into public.inspection_reports (
  id, tenant_id, report_no, type, title, status
) values
  ('30000000-0000-4000-8000-000000000001','10000000-0000-0000-0000-000000000001','DTD-QC-0001','product_psi','PSI principal','draft'),
  ('30000000-0000-4000-8000-000000000002','10000000-0000-0000-0000-000000000001','DTD-QC-0002','product_psi','PSI umbral','draft'),
  ('30000000-0000-4000-8000-000000000003','10000000-0000-0000-0000-000000000001','DTD-QC-0003','product_psi','PSI máxima','draft');
insert into public.inspection_report_photos (
  id, tenant_id, report_id, storage_path
) values
  ('40000000-0000-4000-8000-000000000001','10000000-0000-0000-0000-000000000001','30000000-0000-4000-8000-000000000001','1000/inspection/1/a.jpg'),
  ('40000000-0000-4000-8000-000000000002','10000000-0000-0000-0000-000000000001','30000000-0000-4000-8000-000000000002','1000/inspection/2/a.jpg'),
  ('40000000-0000-4000-8000-000000000003','10000000-0000-0000-0000-000000000001','30000000-0000-4000-8000-000000000003','1000/inspection/3/a.jpg');

-- ── Escenarios ──────────────────────────────────────────────────────────────
create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0488: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;

-- Retira como el operador de la fixture, igual que la Server Action. Devuelve
-- el outcome del jsonb.
create function pg_temp.ejecutar(p_id uuid, p_ref text) returns text language plpgsql as $$
declare v_result jsonb;
begin
  perform set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
  set local role authenticated;
  v_result := public.retire_inspection_report_governed(
    p_id, 'draft', 'Reporte duplicado confirmado', p_ref
  );
  reset role;
  return v_result->>'outcome';
end;
$$;

-- Lo que el retiro tiene que dejar, con la referencia que se le dio.
create function pg_temp.assert_hecho(p_id uuid, p_ref text, p_result text, p_label text)
returns void language plpgsql as $$
declare
  v_correlation text;
  v_events integer;
begin
  perform pg_temp.assert_true(p_result = 'transitioned', p_label || ': la RPC transiciona');
  perform pg_temp.assert_true(exists (
    select 1 from public.inspection_reports r
    where r.id = p_id and r.deleted_at is not null
      and not exists (
        select 1 from public.inspection_report_photos p
        where p.report_id = r.id and p.deleted_at is null
      )
  ), p_label || ': el reporte y la metadata de sus fotos quedan retirados');
  select count(*), max(correlation_id) into v_events, v_correlation
  from public.entity_audit_log
  where entity_id = p_id and event_type = 'inspection_report_retired';
  perform pg_temp.assert_true(v_events = 1, p_label || ': exactamente un AUD-01');
  perform pg_temp.assert_true(
    v_correlation = 'inspection-report-retirement:' || p_id::text || ':' || md5(p_ref),
    p_label || ': correlation_id = prefijo, id y md5 de la referencia');
  perform pg_temp.assert_true(char_length(v_correlation) = 98,
    p_label || ': correlation_id de 98 caracteres');
  perform pg_temp.assert_true(exists (
    select 1 from public.entity_audit_log
    where entity_id = p_id and event_type = 'inspection_report_retired'
      and payload->>'request_ref' = p_ref
  ), p_label || ': payload.request_ref conserva la referencia completa');
end;
$$;

-- 1. El writer de este contrato es el real: rechaza un correlation_id de 129.
do $writer_real$
declare v_state text; v_message text;
begin
  begin
    perform public.append_audit_event(
      '10000000-0000-0000-0000-000000000001', 'inspection_report',
      '30000000-0000-4000-8000-000000000001', 'system', null,
      'inspection_report_probe', 'rpc', 'succeeded', null, null, null, '{}'::jsonb,
      repeat('a', 129), 1, 'internal'
    );
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
  end;
  perform pg_temp.assert_true(v_state = '22023' and v_message = 'audit: correlation_id inválido',
    'el writer AUD-01 rechaza un correlation_id de 129');
  perform pg_temp.assert_true(not exists (
    select 1 from public.entity_audit_log where event_type = 'inspection_report_probe'
  ), 'la sonda rechazada no deja evento');
end;
$writer_real$;

-- 2. La referencia que arma la pantalla (InspeccionesClient.tsx:506): 102.
do $pantalla$
declare
  v_id uuid := '30000000-0000-4000-8000-000000000001';
  v_ref text := 'inspection-report-retirement:' || v_id::text || ':' || gen_random_uuid()::text;
begin
  perform pg_temp.assert_true(char_length(v_ref) = 102, 'la referencia de la pantalla mide 102');
  perform pg_temp.assert_true(
    char_length('inspection-report-retirement:' || v_id::text || ':' || v_ref) = 168,
    'con la 0323 el correlation_id mediría 168');
  perform pg_temp.assert_hecho(v_id, v_ref, pg_temp.ejecutar(v_id, v_ref), 'pantalla');

  -- 3. Replay idéntico: misma respuesta y ningún evento nuevo.
  perform pg_temp.assert_true(
    pg_temp.ejecutar(v_id, v_ref) = 'replayed'
    and (select count(*) from public.entity_audit_log
         where entity_id = v_id and event_type = 'inspection_report_retired') = 1,
    'el replay con la misma referencia no escribe otro AUD-01');
end;
$pantalla$;

-- 4. Umbral: 63 es la referencia más corta que la 0323 rechazaba (129).
do $umbral$
declare
  v_id uuid := '30000000-0000-4000-8000-000000000002';
  v_ref text := 'r' || repeat('0', 62);
begin
  perform pg_temp.assert_true(
    char_length('inspection-report-retirement:' || v_id::text || ':' || v_ref) = 129,
    'con la 0323 una referencia de 63 da un correlation_id de 129');
  perform pg_temp.assert_hecho(v_id, v_ref, pg_temp.ejecutar(v_id, v_ref), 'referencia de 63');
end;
$umbral$;

-- 5. Máxima: 128 es la referencia más larga que la RPC acepta.
do $maxima$
declare
  v_id uuid := '30000000-0000-4000-8000-000000000003';
  v_ref text := 'inspection-report-retirement:' || v_id::text || ':' || repeat('f', 128 - 66);
begin
  perform pg_temp.assert_true(char_length(v_ref) = 128, 'la referencia máxima mide 128');
  perform pg_temp.assert_hecho(v_id, v_ref, pg_temp.ejecutar(v_id, v_ref), 'referencia de 128');
end;
$maxima$;

-- 6. La RPC instalada es la de 0488 (su comentario lo dice).
do $catalogo$
begin
  perform pg_temp.assert_true(
    obj_description('public.retire_inspection_report_governed(uuid,text,text,text)'::regprocedure, 'pg_proc')
      like '%SDD-0534%',
    'el comentario de la RPC nombra la SDD-0534');
end;
$catalogo$;

select 'TEST 0488 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;
rollback;
