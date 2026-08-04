\set ON_ERROR_STOP on

-- Contrato desechable SDD-0244 rebanada B (migración 0344). Fixtures ficticios
-- + rollback. Valida con MUTACIÓN: cada invariante se prueba INTENTANDO
-- violarlo; si el INSERT pasa, el test falla. Un test que sólo inserta lo
-- correcto no prueba nada.
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

-- ── Estado PREVIO a la migración (0136 + 0342) ──────────────────────────────
create table public.kommo_writeback_outbox (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  kommo_lead_id bigint not null,
  op            text not null,
  payload       jsonb not null,
  idempotency_key text not null,
  status        text not null default 'pending' check (status in ('pending','sent','skipped','error')),
  attempts      int not null default 0,
  last_error    text,
  kommo_updated_at_at_enqueue timestamptz,
  created_at    timestamptz not null default now(),
  sent_at       timestamptz
);

-- El CHECK de op ya admite patch_contact desde la 0342 (aplicada).
alter table public.kommo_writeback_outbox
  add constraint kommo_writeback_outbox_op_check
  check (op in ('patch_price', 'patch_stage', 'patch_lead', 'patch_contact'));

create unique index kommo_writeback_outbox_pending_idem
  on public.kommo_writeback_outbox (tenant_id, idempotency_key)
  where status = 'pending';

create table public.kommo_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  markbox_field_id bigint
);

insert into public.tenants (id) values ('11111111-1111-1111-1111-111111111111');

-- Fila HISTÓRICA, creada antes de la migración: debe seguir siendo válida después.
insert into public.kommo_writeback_outbox (tenant_id, kommo_lead_id, op, payload, idempotency_key)
values ('11111111-1111-1111-1111-111111111111', 999, 'patch_stage', '{}'::jsonb, '999:patch_stage');

-- ── DDL bajo prueba (idéntico a 0344_kommo_writeback_contact_target.sql) ────
alter table public.kommo_connections
  add column if not exists markbox_contact_field_id bigint;

alter table public.kommo_writeback_outbox
  add column if not exists kommo_contact_id bigint;

alter table public.kommo_writeback_outbox
  alter column kommo_lead_id drop not null;

alter table public.kommo_writeback_outbox
  drop constraint if exists kommo_writeback_outbox_target_check;
alter table public.kommo_writeback_outbox
  add constraint kommo_writeback_outbox_target_check check (
    case when op = 'patch_contact'
      then kommo_contact_id is not null and kommo_lead_id is null
      else kommo_lead_id is not null and kommo_contact_id is null
    end
  );

create or replace function public.enqueue_kommo_contact_writeback(
  p_tenant_id uuid,
  p_kommo_contact_id bigint,
  p_op text,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id  uuid;
  v_key text := 'c:' || p_kommo_contact_id::text || ':' || p_op;
begin
  insert into public.kommo_writeback_outbox
    (tenant_id, kommo_contact_id, op, payload, idempotency_key)
  values
    (p_tenant_id, p_kommo_contact_id, p_op, p_payload, v_key)
  on conflict (tenant_id, idempotency_key) where status = 'pending'
  do update set
    payload    = excluded.payload,
    attempts   = 0,
    last_error = null,
    created_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.enqueue_kommo_contact_writeback(uuid, bigint, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.enqueue_kommo_contact_writeback(uuid, bigint, text, jsonb)
  to service_role;

-- ═══ CONTRATOS ══════════════════════════════════════════════════════════════
do $t$
declare
  v_tenant uuid := '11111111-1111-1111-1111-111111111111';
  v_a uuid;
  v_b uuid;
  v_n int;
begin
  -- 1) La columna del campo de contacto existe y es independiente del de leads.
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='kommo_connections'
      and column_name='markbox_contact_field_id'
  ) then
    raise exception 'FALLO: falta kommo_connections.markbox_contact_field_id';
  end if;

  -- 2) La fila histórica sobrevivió al constraint nuevo.
  select count(*) into v_n from public.kommo_writeback_outbox where kommo_lead_id = 999;
  if v_n <> 1 then
    raise exception 'FALLO: el constraint nuevo invalidó filas históricas';
  end if;

  -- 3) MUTACIÓN — un patch_contact SIN contacto debe ser rechazado.
  begin
    insert into public.kommo_writeback_outbox
      (tenant_id, kommo_lead_id, op, payload, idempotency_key)
    values (v_tenant, 555, 'patch_contact', '{}'::jsonb, 'x1');
    raise exception 'FALLO: se aceptó un patch_contact apuntando a un LEAD';
  exception when check_violation then null;
  end;

  -- 4) MUTACIÓN — un patch_stage apuntando a un CONTACTO debe ser rechazado.
  begin
    insert into public.kommo_writeback_outbox
      (tenant_id, kommo_contact_id, op, payload, idempotency_key)
    values (v_tenant, 555, 'patch_stage', '{}'::jsonb, 'x2');
    raise exception 'FALLO: se aceptó un patch_stage apuntando a un CONTACTO';
  exception when check_violation then null;
  end;

  -- 5) MUTACIÓN — apuntar a los DOS a la vez debe ser rechazado.
  begin
    insert into public.kommo_writeback_outbox
      (tenant_id, kommo_lead_id, kommo_contact_id, op, payload, idempotency_key)
    values (v_tenant, 1, 2, 'patch_lead', '{}'::jsonb, 'x3');
    raise exception 'FALLO: se aceptó una fila con lead Y contacto';
  exception when check_violation then null;
  end;

  -- 6) MUTACIÓN — sin ningún destino debe ser rechazado.
  begin
    insert into public.kommo_writeback_outbox
      (tenant_id, op, payload, idempotency_key)
    values (v_tenant, 'patch_lead', '{}'::jsonb, 'x4');
    raise exception 'FALLO: se aceptó una fila sin destino';
  exception when check_violation then null;
  end;

  -- 7) El camino feliz: la RPC encola un patch_contact.
  v_a := public.enqueue_kommo_contact_writeback(v_tenant, 777, 'patch_contact', '{"v":1}'::jsonb);
  if v_a is null then raise exception 'FALLO: la RPC no devolvió id'; end if;

  -- 8) IDEMPOTENCIA: re-encolar el mismo contacto refresca, no duplica.
  v_b := public.enqueue_kommo_contact_writeback(v_tenant, 777, 'patch_contact', '{"v":2}'::jsonb);
  if v_a <> v_b then
    raise exception 'FALLO: re-encolar duplicó en vez de refrescar (% vs %)', v_a, v_b;
  end if;
  select count(*) into v_n
    from public.kommo_writeback_outbox
   where kommo_contact_id = 777 and status = 'pending';
  if v_n <> 1 then raise exception 'FALLO: quedaron % filas pendientes para el contacto', v_n; end if;
  if (select payload->>'v' from public.kommo_writeback_outbox where id = v_a) <> '2' then
    raise exception 'FALLO: el re-encolado no refrescó el payload';
  end if;

  -- 9) La clave del contacto va NAMESPACED ('c:'). Hoy el target_check ya impide
  --    que una misma op apunte a las dos entidades, así que la colisión no puede
  --    ocurrir por ese lado; el prefijo es la defensa para cuando exista una op
  --    que valga para ambas. Se afirma la clave y que ambos números coexisten.
  if (select idempotency_key from public.kommo_writeback_outbox where id = v_a)
     <> 'c:777:patch_contact' then
    raise exception 'FALLO: la clave del contacto no está namespaced con c:';
  end if;
  insert into public.kommo_writeback_outbox
    (tenant_id, kommo_lead_id, op, payload, idempotency_key)
  values (v_tenant, 777, 'patch_stage', '{}'::jsonb, '777:patch_stage');
  select count(*) into v_n
    from public.kommo_writeback_outbox
   where idempotency_key in ('c:777:patch_contact', '777:patch_stage');
  if v_n <> 2 then
    raise exception 'FALLO: el lead 777 y el contacto 777 no coexisten (% filas)', v_n;
  end if;

  -- 10) La RPC no es ejecutable por anon/authenticated.
  if has_function_privilege('anon',
       'public.enqueue_kommo_contact_writeback(uuid,bigint,text,jsonb)', 'execute') then
    raise exception 'FALLO: anon puede ejecutar la RPC de encolado';
  end if;
  if has_function_privilege('authenticated',
       'public.enqueue_kommo_contact_writeback(uuid,bigint,text,jsonb)', 'execute') then
    raise exception 'FALLO: authenticated puede ejecutar la RPC de encolado';
  end if;
  if not has_function_privilege('service_role',
       'public.enqueue_kommo_contact_writeback(uuid,bigint,text,jsonb)', 'execute') then
    raise exception 'FALLO: service_role NO puede ejecutar la RPC de encolado';
  end if;

  raise notice 'OK 0344 — destino contacto en la outbox: 10 contratos verdes';
end;
$t$;

rollback;
