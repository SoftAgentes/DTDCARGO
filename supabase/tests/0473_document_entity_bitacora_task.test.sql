\set ON_ERROR_STOP on
-- SDD-0506 · Contrato de 0473: document_entity_in_tenant() acepta una tarea de
-- Bitácora del mismo tenant, sigue rechazando la de otro tenant y conserva las
-- once ramas de 0314. Fixture sintético aislado; no ejecutar sobre una DB real.
-- Termina en ROLLBACK.
-- RED: psql -v apply_fix=false -f /sb/tests/0473_document_entity_bitacora_task.test.sql
--
-- No se hace \ir de 0097/0215/0314: arrastran el bucket de Storage, las policies
-- de storage.objects y la tabla de Gastos con sus RPC. El ANTES son copias
-- VERBATIM de lo que corre hoy en producción: document_entity_in_tenant() de
-- 0314:13-38 (md5 fe0e86178dfd646dc7d58b46ef404949, medido el 2026-10-14), su
-- comentario de 0215 y su ACL de 0209; y el trigger documents_validate_entity de
-- 0097 con el search_path de 0210. El envoltorio
-- lib/studio/__tests__/document-entity-bitacora-task.migration.test.ts comprueba
-- que las copias siguen iguales a los archivos. Las tablas de entidad sólo tienen
-- las columnas que la función lee; bitacora_tasks, como en 0214, sin deleted_at.
\if :{?apply_fix}
\else
\set apply_fix true
\endif
begin;
do $fixture_guard$
begin
  if to_regclass('public.tenants') is not null
     or to_regclass('public.documents') is not null
     or to_regtype('public.document_entity_type') is not null then
    raise exception 'TEST 0473: fixture rechazada, la base ya contiene objetos de aplicación';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$fixture_guard$;
grant usage on schema public to anon, authenticated, service_role;

-- El enum en el orden de producción: 0097, + bitacora_task (0215), + expense (0314).
create type public.document_entity_type as enum (
  'shipment', 'invoice', 'supplier_bill', 'supplier_payment', 'journal_entry',
  'client', 'supplier', 'consolidation', 'booking', 'none', 'bitacora_task', 'expense'
);

create table public.tenants (id uuid primary key);

do $entity_tables$
declare v_table text;
begin
  foreach v_table in array array['shipments', 'invoices', 'supplier_bills', 'supplier_payments',
    'journal_entries', 'clients', 'suppliers', 'consolidations', 'bookings', 'expenses'] loop
    execute format('create table public.%I (id uuid primary key, tenant_id uuid not null references public.tenants(id), deleted_at timestamptz)', v_table);
  end loop;
end;
$entity_tables$;

-- 0214: sin deleted_at; el ciclo de vida es `estado`.
create table public.bitacora_tasks (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'en_curso', 'en_revision', 'hecho'))
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  entity_type public.document_entity_type not null default 'none',
  entity_id uuid,
  name text not null,
  constraint documents_entity_id_coherent check (
    (entity_type = 'none' and entity_id is null)
    or (entity_type <> 'none' and entity_id is not null)
  )
);
-- Los grants de 0097 sobre documents; authenticated NO tiene grants sobre las
-- tablas de entidad: si la función ve la tarea es porque es DEFINER.
grant select, insert, update on public.documents to authenticated;

-- ── ANTES: 0314 líneas 13-38, copia verbatim ────────────────
create or replace function public.document_entity_in_tenant(
  p_type public.document_entity_type,
  p_id uuid,
  p_tenant uuid
) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  ok boolean := false;
begin
  if p_type::text = 'none' or p_id is null then return true; end if;
  case p_type::text
    when 'shipment' then select exists(select 1 from public.shipments where id=p_id and tenant_id=p_tenant and deleted_at is null) into ok;
    when 'invoice' then select exists(select 1 from public.invoices where id=p_id and tenant_id=p_tenant and deleted_at is null) into ok;
    when 'supplier_bill' then select exists(select 1 from public.supplier_bills where id=p_id and tenant_id=p_tenant and deleted_at is null) into ok;
    when 'supplier_payment' then select exists(select 1 from public.supplier_payments where id=p_id and tenant_id=p_tenant and deleted_at is null) into ok;
    when 'journal_entry' then select exists(select 1 from public.journal_entries where id=p_id and tenant_id=p_tenant and deleted_at is null) into ok;
    when 'client' then select exists(select 1 from public.clients where id=p_id and tenant_id=p_tenant and deleted_at is null) into ok;
    when 'supplier' then select exists(select 1 from public.suppliers where id=p_id and tenant_id=p_tenant and deleted_at is null) into ok;
    when 'consolidation' then select exists(select 1 from public.consolidations where id=p_id and tenant_id=p_tenant and deleted_at is null) into ok;
    when 'booking' then select exists(select 1 from public.bookings where id=p_id and tenant_id=p_tenant and deleted_at is null) into ok;
    when 'expense' then select exists(select 1 from public.expenses where id=p_id and tenant_id=p_tenant and deleted_at is null) into ok;
    else ok := false;
  end case;
  return ok;
end;
$$;

-- ── ANTES: comentario de 0215 y ACL de 0209 ─────────────────
comment on function public.document_entity_in_tenant is
  'SDD-0049 (+SDD-0146 bitacora_task): ¿(entity_type, entity_id) existe, es del tipo correcto y del tenant? Polimórfico (sin FK). none/null → true. Defiende contra entity_id forjado vía PostgREST directo.';
revoke execute on function public.document_entity_in_tenant(p_type document_entity_type, p_id uuid, p_tenant uuid) from public, anon;
grant execute on function public.document_entity_in_tenant(p_type document_entity_type, p_id uuid, p_tenant uuid) to authenticated, service_role;

-- ── ANTES: 0097 líneas 190-201, copia verbatim, + search_path de 0210 ──
create or replace function public.documents_validate_entity()
returns trigger
language plpgsql
as $$
begin
  if not public.document_entity_in_tenant(new.entity_type, new.entity_id, new.tenant_id) then
    raise exception 'documento sobre entidad inexistente, de otro tipo o ajena al tenant: %/%', new.entity_type, new.entity_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
alter function public.documents_validate_entity() set search_path = public;
create trigger documents_validate_entity_trg
  before insert or update on public.documents
  for each row execute function public.documents_validate_entity();

-- Semilla: por tipo, una fila viva del tenant A, una borrada del A y una viva
-- del B; tareas de Bitácora viva y hecha del A y viva del B.
create temporary table seed (entity_type text, tenant_id uuid, estado text, id uuid primary key);
do $seed$
declare
  v_a constant uuid := '0473aaaa-0000-4000-8000-000000000001';
  v_b constant uuid := '0473bbbb-0000-4000-8000-000000000002';
  v_type text; v_table text;
begin
  insert into public.tenants values (v_a), (v_b);
  for v_type, v_table in select * from (values
    ('shipment', 'shipments'), ('invoice', 'invoices'), ('supplier_bill', 'supplier_bills'),
    ('supplier_payment', 'supplier_payments'), ('journal_entry', 'journal_entries'),
    ('client', 'clients'), ('supplier', 'suppliers'), ('consolidation', 'consolidations'),
    ('booking', 'bookings'), ('expense', 'expenses')) v(t, tb)
  loop
    insert into pg_temp.seed select v_type, x.t, x.s, gen_random_uuid()
      from (values (v_a, 'viva'), (v_a, 'borrada'), (v_b, 'viva')) x(t, s);
    execute format('insert into public.%I (id, tenant_id, deleted_at) select id, tenant_id, case when estado = %L then now() end from pg_temp.seed where entity_type = %L',
      v_table, 'borrada', v_type);
  end loop;
  insert into pg_temp.seed select 'bitacora_task', x.t, x.s, gen_random_uuid()
    from (values (v_a, 'pendiente'), (v_a, 'hecho'), (v_b, 'pendiente')) x(t, s);
  insert into public.bitacora_tasks (id, tenant_id, estado)
    select id, tenant_id, estado from pg_temp.seed where entity_type = 'bitacora_task';
end;
$seed$;

-- Foto de pg_proc en public antes de 0473: la migración sólo puede tocar una.
create temporary table baseline_functions as
select p.oid, p.proname, p.proowner, to_jsonb(p) as definition
from pg_catalog.pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public';

-- Dos veces: el preflight acepta su propio cuerpo, así que re-aplicar es inocuo.
\if :apply_fix
\ir ../migrations/0473_document_entity_bitacora_task.sql
\ir ../migrations/0473_document_entity_bitacora_task.sql
\endif

create temporary sequence assertion_count;
create function pg_temp.assert_true(p_value boolean, p_label text) returns void language plpgsql as $$
begin
  if p_value is distinct from true then raise exception 'TEST 0473: %', p_label; end if;
  perform nextval('pg_temp.assertion_count');
end;
$$;
create function pg_temp.a() returns uuid language sql as $$ select '0473aaaa-0000-4000-8000-000000000001'::uuid $$;
create function pg_temp.b() returns uuid language sql as $$ select '0473bbbb-0000-4000-8000-000000000002'::uuid $$;
create function pg_temp.id_of(p_type text, p_tenant uuid, p_estado text) returns uuid language sql as $$
  select id from pg_temp.seed where entity_type = p_type and tenant_id = p_tenant and estado = p_estado
$$;
create function pg_temp.in_tenant(p_type text, p_id uuid, p_tenant uuid) returns boolean language sql as $$
  select public.document_entity_in_tenant(p_type::public.document_entity_type, p_id, p_tenant)
$$;
-- Corre una sentencia bajo un rol y devuelve {state, message} del rechazo, o null.
create function pg_temp.attempt(p_role text, p_sql text) returns jsonb language plpgsql as $$
declare v_state text; v_message text;
begin
  execute format('set local role %I', p_role);
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
  end;
  reset role;
  return case when v_state is null then null
    else jsonb_build_object('state', v_state, 'message', v_message) end;
end;
$$;

-- 1. Las once ramas de 0314 siguen como estaban: fila viva del tenant → true;
--    de otro tenant → false; con deleted_at → false. Pasan también sin 0473.
do $ramas_previas$
declare v_type text;
begin
  for v_type in select distinct entity_type from pg_temp.seed where entity_type <> 'bitacora_task' order by 1 loop
    perform pg_temp.assert_true(pg_temp.in_tenant(v_type, pg_temp.id_of(v_type, pg_temp.a(), 'viva'), pg_temp.a()),
      format('%s del mismo tenant se acepta', v_type));
    perform pg_temp.assert_true(not pg_temp.in_tenant(v_type, pg_temp.id_of(v_type, pg_temp.b(), 'viva'), pg_temp.a()),
      format('%s de otro tenant se rechaza', v_type));
    perform pg_temp.assert_true(not pg_temp.in_tenant(v_type, pg_temp.id_of(v_type, pg_temp.a(), 'borrada'), pg_temp.a()),
      format('%s con deleted_at se rechaza', v_type));
  end loop;
  perform pg_temp.assert_true(pg_temp.in_tenant('none', null, pg_temp.a())
    and pg_temp.in_tenant('shipment', null, pg_temp.a()),
    'none o entity_id null siguen pasando sin validar');
  perform pg_temp.assert_true(not pg_temp.in_tenant('invoice', pg_temp.id_of('shipment', pg_temp.a(), 'viva'), pg_temp.a()),
    'el id de un embarque presentado como factura se rechaza');
end;
$ramas_previas$;

-- 2. La rama nueva. Acá cae el control rojo: 0314 no tiene rama bitacora_task.
do $bitacora$
begin
  perform pg_temp.assert_true(pg_temp.in_tenant('bitacora_task', pg_temp.id_of('bitacora_task', pg_temp.a(), 'pendiente'), pg_temp.a()),
    'bitacora_task del mismo tenant se acepta');
  perform pg_temp.assert_true(pg_temp.in_tenant('bitacora_task', pg_temp.id_of('bitacora_task', pg_temp.a(), 'hecho'), pg_temp.a()),
    'una tarea hecha del mismo tenant también se acepta: el estado no es borrado');
  -- Inexistente antes que ajena: sin filtro de id cae acá; sin filtro de tenant, abajo.
  perform pg_temp.assert_true(not pg_temp.in_tenant('bitacora_task', gen_random_uuid(), pg_temp.a()),
    'bitacora_task inexistente se rechaza');
  perform pg_temp.assert_true(not pg_temp.in_tenant('bitacora_task', pg_temp.id_of('bitacora_task', pg_temp.b(), 'pendiente'), pg_temp.a()),
    'bitacora_task de otro tenant se rechaza');
  perform pg_temp.assert_true(not pg_temp.in_tenant('shipment', pg_temp.id_of('bitacora_task', pg_temp.a(), 'pendiente'), pg_temp.a()),
    'el id de una tarea presentado como embarque se rechaza');
  perform pg_temp.assert_true(not pg_temp.in_tenant('bitacora_task', pg_temp.id_of('shipment', pg_temp.a(), 'viva'), pg_temp.a()),
    'el id de un embarque presentado como tarea se rechaza');
end;
$bitacora$;

-- 3. El camino de la app: authenticated inserta en documents (como
--    registerTaskAttachmentAction) y el trigger de 0097 decide. Sin grant sobre
--    bitacora_tasks: la función lo ve por ser DEFINER.
do $trigger$
declare
  v_task_a uuid := pg_temp.id_of('bitacora_task', pg_temp.a(), 'pendiente');
  v_task_b uuid := pg_temp.id_of('bitacora_task', pg_temp.b(), 'pendiente');
  v_doc uuid := gen_random_uuid();
  v_result jsonb;
begin
  v_result := pg_temp.attempt('authenticated', format(
    'insert into public.documents (id, tenant_id, entity_type, entity_id, name) values (%L, %L, %L, %L, %L)',
    v_doc, pg_temp.a(), 'bitacora_task', v_task_a, 'foto de avance'));
  perform pg_temp.assert_true(v_result is null
    and exists (select 1 from public.documents where id = v_doc and entity_id = v_task_a),
    'authenticated adjunta un documento a una tarea de su tenant');
  v_result := pg_temp.attempt('authenticated', format(
    'insert into public.documents (tenant_id, entity_type, entity_id, name) values (%L, %L, %L, %L)',
    pg_temp.a(), 'bitacora_task', v_task_b, 'foto ajena'));
  perform pg_temp.assert_true(v_result->>'state' = '23514'
    and v_result->>'message' = format('documento sobre entidad inexistente, de otro tipo o ajena al tenant: bitacora_task/%s', v_task_b),
    'el trigger rechaza adjuntar a una tarea de otro tenant con check_violation y el mensaje de 0097');
  v_result := pg_temp.attempt('authenticated', format(
    'update public.documents set entity_id = %L where id = %L', v_task_b, v_doc));
  perform pg_temp.assert_true(v_result->>'state' = '23514'
    and (select entity_id from public.documents where id = v_doc) = v_task_a,
    'el trigger rechaza mover un adjunto a una tarea de otro tenant');
  v_result := pg_temp.attempt('authenticated', format(
    'insert into public.documents (tenant_id, entity_type, entity_id, name) values (%L, %L, %L, %L)',
    pg_temp.b(), 'bitacora_task', v_task_b, 'foto del B'));
  perform pg_temp.assert_true(v_result is null,
    'la tarea del tenant B se acepta cuando el documento es del tenant B');
end;
$trigger$;

-- 4. Forma y ACL: mismo oid y dueño, DEFINER, STABLE, boolean, search_path
--    vacío; EXECUTE para authenticated y service_role, ni anon ni PUBLIC.
do $catalogo$
declare v_fn oid := to_regprocedure('public.document_entity_in_tenant(public.document_entity_type,uuid,uuid)');
begin
  perform pg_temp.assert_true(
    (select oid from baseline_functions where proname = 'document_entity_in_tenant') = v_fn
    and (select proowner from baseline_functions where proname = 'document_entity_in_tenant')
      = (select proowner from pg_catalog.pg_proc where oid = v_fn),
    'la función conserva su oid y su dueño: se reemplaza, no se recrea');
  perform pg_temp.assert_true(exists (select 1 from pg_catalog.pg_proc p
    where p.oid = v_fn and p.prosecdef and p.provolatile = 's'
      and p.prorettype = 'pg_catalog.bool'::regtype
      and p.proconfig = array['search_path=""']::text[]),
    'sigue DEFINER, STABLE, boolean y con search_path vacío');
  perform pg_temp.assert_true(has_function_privilege('authenticated', v_fn, 'EXECUTE')
    and has_function_privilege('service_role', v_fn, 'EXECUTE')
    and not has_function_privilege('anon', v_fn, 'EXECUTE')
    and not exists (select 1 from pg_catalog.aclexplode((select proacl from pg_catalog.pg_proc where oid = v_fn)) a
      where a.grantee = 0 and a.privilege_type = 'EXECUTE'),
    'EXECUTE sólo para authenticated y service_role');
  perform pg_temp.assert_true(pg_temp.attempt('anon',
      'select public.document_entity_in_tenant(''none'', null, null)')->>'state' = '42501',
    'anon no ejecuta la función');
end;
$catalogo$;

-- 5. El comentario dice qué pasó: es lo que ve quien lea el catálogo.
do $comentario$
begin
  perform pg_temp.assert_true(
    obj_description(to_regprocedure('public.document_entity_in_tenant(public.document_entity_type,uuid,uuid)'), 'pg_proc')
      like 'SDD-0049 %SDD-0506 devuelve bitacora_task%',
    'el comentario nombra la SDD-0506 y la rama devuelta');
end;
$comentario$;

-- 6. 0473 no toca ninguna otra función de public (el trigger de 0097 incluido).
do $sin_danos$
begin
  perform pg_temp.assert_true(not exists (
    select 1 from baseline_functions b
    full join (select p.oid, p.proname, to_jsonb(p) as definition
               from pg_catalog.pg_proc p join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public') c on c.oid = b.oid
    where coalesce(b.proname, c.proname) <> 'document_entity_in_tenant'
      and (b.oid is null or c.oid is null or b.definition <> c.definition)),
    '0473 no toca ninguna otra función de public');
end;
$sin_danos$;

select 'TEST 0473 GREEN: ' || currval('pg_temp.assertion_count') || ' aserciones' as resultado;
rollback;
