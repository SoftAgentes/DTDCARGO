\set ON_ERROR_STOP on

-- Contrato desechable SDD-0244 (migración 0342). Fixtures ficticios + rollback.
-- Valida con MUTACIÓN: intenta violar cada contrato y exige que falle.
begin;

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  phone text,
  markbox text
);

create table public.kommo_writeback_outbox (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  op text not null check (op in ('patch_price', 'patch_stage', 'patch_lead')),
  payload jsonb not null default '{}'::jsonb
);

-- ── DDL bajo prueba (idéntico a supabase/migrations/0342_kommo_contact_link.sql)
alter table public.clients
  add column if not exists kommo_contact_id bigint;

create index if not exists clients_kommo_contact_idx
  on public.clients (tenant_id, kommo_contact_id)
  where kommo_contact_id is not null;

create index if not exists clients_phone_last10_idx
  on public.clients (
    tenant_id,
    pg_catalog."right"(
      pg_catalog.regexp_replace(coalesce(phone, ''), '\D', '', 'g'),
      10
    )
  )
  where phone is not null and phone <> '';

alter table public.kommo_writeback_outbox
  drop constraint if exists kommo_writeback_outbox_op_check;

alter table public.kommo_writeback_outbox
  add constraint kommo_writeback_outbox_op_check
  check (op in ('patch_price', 'patch_stage', 'patch_lead', 'patch_contact'));

-- ── 1. La columna y los índices existen ──────────────────────────────────────
do $estructura$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clients'
      and column_name = 'kommo_contact_id' and data_type = 'bigint'
  ) then
    raise exception 'TEST 0342: falta clients.kommo_contact_id bigint';
  end if;

  if not exists (select 1 from pg_indexes
                 where schemaname = 'public' and indexname = 'clients_kommo_contact_idx') then
    raise exception 'TEST 0342: falta clients_kommo_contact_idx';
  end if;

  if not exists (select 1 from pg_indexes
                 where schemaname = 'public' and indexname = 'clients_phone_last10_idx') then
    raise exception 'TEST 0342: falta clients_phone_last10_idx';
  end if;
end;
$estructura$;

-- ── 2. MUTACIÓN: la outbox acepta patch_contact y rechaza lo demás ───────────
do $op_check$
declare
  t uuid := gen_random_uuid();
  rechazo_ok boolean := false;
begin
  -- La op nueva DEBE entrar. Si no, el enrutador no puede escribirle al contacto.
  insert into public.kommo_writeback_outbox (tenant_id, op) values (t, 'patch_contact');

  -- Las tres viejas siguen vivas (no se rompió SDD-0083/0084/0086).
  insert into public.kommo_writeback_outbox (tenant_id, op) values (t, 'patch_price');
  insert into public.kommo_writeback_outbox (tenant_id, op) values (t, 'patch_stage');
  insert into public.kommo_writeback_outbox (tenant_id, op) values (t, 'patch_lead');

  -- Y una op inventada DEBE reventar: si pasa, el CHECK es decorativo.
  begin
    insert into public.kommo_writeback_outbox (tenant_id, op) values (t, 'patch_cualquier_cosa');
  exception when check_violation then
    rechazo_ok := true;
  end;

  if not rechazo_ok then
    raise exception 'TEST 0342: el CHECK de op acepta ops invalidas — es decorativo';
  end if;
end;
$op_check$;

-- ── 3. MUTACIÓN: el índice de teléfono normaliza como phonesMatch ────────────
-- phonesMatch (lib/studio/estimado-linking.ts) compara los ULTIMOS 10 DIGITOS.
-- Si la expresión del índice no coincide con esa semántica, el auto-sanado del
-- enrutador falla en silencio: el cliente existe pero nunca se le encuentra.
do $telefono$
declare
  t uuid := gen_random_uuid();
  clave text;
  encontrados int;
begin
  insert into public.clients (tenant_id, phone, markbox) values
    (t, '+58 412-555-0101', 'DTD-0001'),   -- con prefijo país y separadores
    (t, '04125550101',      'DTD-0002'),   -- formato local, mismo número
    (t, '+58 414-999-8888', 'DTD-0003');   -- otro número

  clave := pg_catalog."right"(
             pg_catalog.regexp_replace('58 412 555 0101', '\D', '', 'g'), 10);

  select count(*) into encontrados
  from public.clients
  where tenant_id = t
    and phone is not null and phone <> ''
    and pg_catalog."right"(
          pg_catalog.regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10
        ) = clave;

  -- Los DOS primeros son el mismo número escrito distinto → deben matchear ambos.
  if encontrados <> 2 then
    raise exception
      'TEST 0342: el indice de telefono no normaliza como phonesMatch (esperaba 2, dio %)',
      encontrados;
  end if;
end;
$telefono$;

-- ── 4. MUTACIÓN: el índice parcial NO indexa filas sin teléfono ──────────────
-- Si indexara los NULL, el enrutador podría "encontrar" clientes sin teléfono y
-- vincularlos al contacto equivocado.
do $parcial$
declare
  pred text;
begin
  select pg_catalog.pg_get_expr(i.indpred, i.indrelid) into pred
  from pg_catalog.pg_index i
  join pg_catalog.pg_class c on c.oid = i.indexrelid
  where c.relname = 'clients_phone_last10_idx';

  if pred is null then
    raise exception 'TEST 0342: clients_phone_last10_idx no es parcial — indexa filas sin telefono';
  end if;
end;
$parcial$;

rollback;
select true as kommo_contact_link_fixture_rolled_back;
