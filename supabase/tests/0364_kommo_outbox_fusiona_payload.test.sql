\set ON_ERROR_STOP on

-- Contrato desechable de la migración 0364. Fixtures ficticios + rollback.
--
-- Valida con MUTACIÓN en el sentido fuerte: primero REPRODUCE el bug con la
-- función vieja (y falla si NO se reproduce), y recién después instala la nueva
-- y comprueba que lo arregla. Un test que sólo ejercita la versión buena no
-- prueba que la vieja estuviera mal.

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$roles$;

grant usage on schema public to anon, authenticated, service_role;

create table public.tenants (id uuid primary key);
insert into public.tenants values ('11111111-1111-1111-1111-111111111111');

-- ── Estado PREVIO (migración 0136) ──────────────────────────────────────────
create table public.kommo_writeback_outbox (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  kommo_lead_id   bigint,
  kommo_contact_id bigint,
  op              text not null,
  payload         jsonb not null,
  idempotency_key text not null,
  status          text not null default 'pending' check (status in ('pending','sent','skipped','error')),
  attempts        int not null default 0,
  last_error      text,
  kommo_updated_at_at_enqueue timestamptz,
  created_at      timestamptz not null default now(),
  sent_at         timestamptz
);

create unique index kommo_writeback_outbox_pending_idem
  on public.kommo_writeback_outbox (tenant_id, idempotency_key)
  where status = 'pending';

-- La versión VIEJA: pisa el payload.
create function public.enqueue_kommo_writeback(
  p_tenant_id uuid, p_kommo_lead_id bigint, p_op text, p_payload jsonb,
  p_kommo_updated_at timestamptz default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_key text := p_kommo_lead_id::text || ':' || p_op;
begin
  insert into public.kommo_writeback_outbox
    (tenant_id, kommo_lead_id, op, payload, idempotency_key, kommo_updated_at_at_enqueue)
  values (p_tenant_id, p_kommo_lead_id, p_op, p_payload, v_key, p_kommo_updated_at)
  on conflict (tenant_id, idempotency_key) where status = 'pending'
  do update set payload = excluded.payload, attempts = 0, last_error = null, created_at = now()
  returning id into v_id;
  return v_id;
end; $$;

-- ── 1) El BUG existe: con la versión vieja, el Shipping Mark se pierde ──────
select public.enqueue_kommo_writeback(
  '11111111-1111-1111-1111-111111111111', 555, 'patch_lead',
  '{"custom_fields_values":[{"field_id":1570535,"values":[{"value":"DTD-0412"}]}]}'::jsonb);
select public.enqueue_kommo_writeback(
  '11111111-1111-1111-1111-111111111111', 555, 'patch_lead',
  '{"name":"Juan Perez"}'::jsonb);

do $$
declare v jsonb;
begin
  select payload into v from public.kommo_writeback_outbox
   where kommo_lead_id = 555 and status = 'pending';
  if v ? 'custom_fields_values' then
    raise exception 'MUTACION INUTIL: la version vieja NO perdio el Shipping Mark (%). El test no discrimina.', v;
  end if;
  if not (v ? 'name') then
    raise exception 'estado inesperado: tampoco quedo el nombre (%)', v;
  end if;
end; $$;

-- Limpio para probar la versión nueva sobre el mismo escenario.
delete from public.kommo_writeback_outbox;

-- ── Migración 0364 ──────────────────────────────────────────────────────────
-- Se carga el ARCHIVO REAL, no una copia inlineada. El resto de los tests de
-- esta carpeta copian el DDL adentro, y eso tiene un agujero: la copia puede
-- driftear de la migración y el contrato seguiría verde probando código muerto.
-- `run-sql-tests.mjs` monta `supabase/` en `/sb`, así que la ruta es absoluta.
\i /sb/migrations/0364_kommo_outbox_fusiona_payload.sql

-- ── 2) Arreglado: Shipping Mark PRIMERO, nombre DESPUÉS → sobreviven los dos ─
select public.enqueue_kommo_writeback(
  '11111111-1111-1111-1111-111111111111', 555, 'patch_lead',
  '{"custom_fields_values":[{"field_id":1570535,"values":[{"value":"DTD-0412"}]}]}'::jsonb);
select public.enqueue_kommo_writeback(
  '11111111-1111-1111-1111-111111111111', 555, 'patch_lead',
  '{"name":"Juan Perez"}'::jsonb);

do $$
declare v jsonb;
begin
  select payload into v from public.kommo_writeback_outbox
   where kommo_lead_id = 555 and status = 'pending';
  if v->>'name' is distinct from 'Juan Perez' then
    raise exception 'se perdio el nombre (%)', v;
  end if;
  if v->'custom_fields_values'->0->'values'->0->>'value' is distinct from 'DTD-0412' then
    raise exception 'SE PERDIO EL SHIPPING MARK — es el bug que esta migracion arregla (%)', v;
  end if;
  if (select count(*) from public.kommo_writeback_outbox where kommo_lead_id = 555) <> 1 then
    raise exception 'la idempotencia se rompio: hay mas de una fila pendiente';
  end if;
end; $$;

-- ── 3) Dos custom fields DISTINTOS → no se pisan el array ───────────────────
delete from public.kommo_writeback_outbox;
select public.enqueue_kommo_writeback('11111111-1111-1111-1111-111111111111', 777, 'patch_lead',
  '{"custom_fields_values":[{"field_id":1,"values":[{"value":"uno"}]}]}'::jsonb);
select public.enqueue_kommo_writeback('11111111-1111-1111-1111-111111111111', 777, 'patch_lead',
  '{"custom_fields_values":[{"field_id":2,"values":[{"value":"dos"}]}]}'::jsonb);

do $$
declare n int;
begin
  select jsonb_array_length(payload->'custom_fields_values') into n
    from public.kommo_writeback_outbox where kommo_lead_id = 777;
  if n <> 2 then
    raise exception 'el || superficial se comio un custom field: quedaron % de 2', n;
  end if;
end; $$;

-- ── 4) El MISMO campo dos veces → gana el nuevo, sin duplicar ───────────────
delete from public.kommo_writeback_outbox;
select public.enqueue_kommo_writeback('11111111-1111-1111-1111-111111111111', 888, 'patch_lead',
  '{"custom_fields_values":[{"field_id":9,"values":[{"value":"VIEJO"}]}]}'::jsonb);
select public.enqueue_kommo_writeback('11111111-1111-1111-1111-111111111111', 888, 'patch_lead',
  '{"custom_fields_values":[{"field_id":9,"values":[{"value":"NUEVO"}]}]}'::jsonb);

do $$
declare v jsonb;
begin
  select payload->'custom_fields_values' into v
    from public.kommo_writeback_outbox where kommo_lead_id = 888;
  if jsonb_array_length(v) <> 1 then
    raise exception 'se duplico el campo en vez de ganar el nuevo (%)', v;
  end if;
  if v->0->'values'->0->>'value' is distinct from 'NUEVO' then
    raise exception 'gano el valor VIEJO (%)', v;
  end if;
end; $$;

-- ── 5) Un escalar sigue ganando el último (no se rompió lo que ya andaba) ───
delete from public.kommo_writeback_outbox;
select public.enqueue_kommo_writeback('11111111-1111-1111-1111-111111111111', 999, 'patch_stage',
  '{"status_id":100}'::jsonb);
select public.enqueue_kommo_writeback('11111111-1111-1111-1111-111111111111', 999, 'patch_stage',
  '{"status_id":200}'::jsonb);

do $$
declare v jsonb;
begin
  select payload into v from public.kommo_writeback_outbox where kommo_lead_id = 999;
  if (v->>'status_id')::int <> 200 then
    raise exception 'un escalar debe seguir ganando el ultimo (%)', v;
  end if;
end; $$;

-- ── 6) Una fila ya ENVIADA no se fusiona: la nueva orden abre fila propia ───
update public.kommo_writeback_outbox set status = 'sent', sent_at = now() where kommo_lead_id = 999;
select public.enqueue_kommo_writeback('11111111-1111-1111-1111-111111111111', 999, 'patch_stage',
  '{"status_id":300}'::jsonb);

do $$
begin
  if (select count(*) from public.kommo_writeback_outbox where kommo_lead_id = 999) <> 2 then
    raise exception 'la fila enviada se fusiono en vez de abrir una nueva';
  end if;
  if (select payload->>'status_id' from public.kommo_writeback_outbox
       where kommo_lead_id = 999 and status = 'pending') <> '300' then
    raise exception 'la fila nueva no quedo con la orden nueva';
  end if;
end; $$;

-- ── 7) anon/authenticated NO pueden encolar ─────────────────────────────────
do $$
begin
  if has_function_privilege('anon',
       'public.enqueue_kommo_writeback(uuid,bigint,text,jsonb,timestamptz)', 'execute')
  or has_function_privilege('authenticated',
       'public.enqueue_kommo_writeback(uuid,bigint,text,jsonb,timestamptz)', 'execute')
  or has_function_privilege('anon', 'public.kommo_merge_custom_fields(jsonb,jsonb)', 'execute') then
    raise exception 'anon/authenticated pueden encolar o fusionar: el revoke no quedo';
  end if;
end; $$;

rollback;
