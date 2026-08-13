\set ON_ERROR_STOP on

-- Contrato desechable de la migración 0365 (SDD-0256 · Fase 4).
-- Fixtures ficticios + rollback. Valida con MUTACIÓN: cada invariante se prueba
-- INTENTANDO violarlo.
--
-- ⚠️ Lo que este test NO puede probar: dos drenajes SIMULTÁNEOS, porque psql es
-- una sola sesión. Lo que sí prueba —y es la propiedad de la que depende la
-- seguridad— es que una fila reservada **deja de estar disponible**: el segundo
-- claim no la ve. `FOR UPDATE SKIP LOCKED` sólo agrega que el segundo no se
-- quede esperando; la exclusión la da la transición de estado, y eso sí se mide.

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
end;
$roles$;

grant usage on schema public to anon, authenticated, service_role;

create table public.tenants (id uuid primary key);
insert into public.tenants values ('11111111-1111-1111-1111-111111111111');

-- Estado PREVIO (0136 + 0344): sin 'processing', sin claimed_at.
create table public.kommo_writeback_outbox (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  kommo_lead_id    bigint,
  kommo_contact_id bigint,
  op               text not null
    constraint kommo_writeback_outbox_op_check
    check (op in ('patch_price','patch_stage','patch_lead','patch_contact')),
  payload          jsonb not null,
  idempotency_key  text not null,
  status           text not null default 'pending'
    constraint kommo_writeback_outbox_status_check
    check (status in ('pending','sent','skipped','error')),
  attempts         int not null default 0,
  last_error       text,
  kommo_updated_at_at_enqueue timestamptz,
  created_at       timestamptz not null default now(),
  sent_at          timestamptz
);

\i /sb/migrations/0365_kommo_outbox_claim.sql

-- ── 1) Las ops nuevas se aceptan; una inventada NO ─────────────────────────
insert into public.kommo_writeback_outbox (tenant_id, kommo_lead_id, op, payload, idempotency_key)
values ('11111111-1111-1111-1111-111111111111', 1, 'patch_owner', '{"responsible_user_id":7}', '1:patch_owner'),
       ('11111111-1111-1111-1111-111111111111', 2, 'patch_tags',  '{"tags_to_add":["vip"]}',   '2:patch_tags'),
       ('11111111-1111-1111-1111-111111111111', 3, 'patch_stage', '{"status_id":142}',         '3:patch_stage');

do $$
begin
  begin
    insert into public.kommo_writeback_outbox (tenant_id, kommo_lead_id, op, payload, idempotency_key)
    values ('11111111-1111-1111-1111-111111111111', 9, 'borrar_todo', '{}', '9:borrar_todo');
    raise exception 'MUTACION: el CHECK acepto una op inventada';
  exception when check_violation then null;
  end;
end; $$;

-- ── 2) Reservar: pasa a processing e incrementa attempts ───────────────────
do $$
declare n int;
begin
  select count(*) into n from public.claim_kommo_writeback_batch(
    '11111111-1111-1111-1111-111111111111', 100);
  if n <> 3 then raise exception 'el claim reservo % de 3', n; end if;

  if exists (select 1 from public.kommo_writeback_outbox where status <> 'processing') then
    raise exception 'quedaron filas fuera de processing';
  end if;
  if exists (select 1 from public.kommo_writeback_outbox where attempts <> 1) then
    raise exception 'el claim no incremento attempts a 1';
  end if;
  if exists (select 1 from public.kommo_writeback_outbox where claimed_at is null) then
    raise exception 'el claim no sello claimed_at';
  end if;
end; $$;

-- ── 3) ⭐ Un SEGUNDO drenaje NO ve nada: la exclusión es real ───────────────
do $$
declare n int;
begin
  select count(*) into n from public.claim_kommo_writeback_batch(
    '11111111-1111-1111-1111-111111111111', 100);
  if n <> 0 then
    raise exception 'EL SEGUNDO DRENAJE TOMO % filas ya reservadas — esto duplica envios', n;
  end if;
end; $$;

-- ── 4) Registrar el fallo NO vuelve a contar el intento ─────────────────────
do $$
declare v record;
begin
  select * into v from public.kommo_writeback_outbox where kommo_lead_id = 1;
  perform public.record_kommo_writeback_error(v.id, 'Kommo 500');
  select * into v from public.kommo_writeback_outbox where kommo_lead_id = 1;
  if v.attempts <> 1 then
    raise exception 'attempts quedo en % — el error conto el intento DOS veces', v.attempts;
  end if;
  if v.status <> 'pending' then
    raise exception 'no volvio a pending para reintentar (quedo en %)', v.status;
  end if;
  if v.claimed_at is not null then
    raise exception 'claimed_at quedo sellado tras el fallo';
  end if;
end; $$;

-- ── 5) A los 5 intentos se rinde, no gira para siempre ─────────────────────
do $$
declare v record;
begin
  update public.kommo_writeback_outbox set attempts = 5, status = 'processing'
   where kommo_lead_id = 1;
  select * into v from public.kommo_writeback_outbox where kommo_lead_id = 1;
  perform public.record_kommo_writeback_error(v.id, 'y van 5');
  select * into v from public.kommo_writeback_outbox where kommo_lead_id = 1;
  if v.status <> 'error' then
    raise exception 'con 5 intentos deberia rendirse, quedo en %', v.status;
  end if;
end; $$;

-- ── 6) El reaper suelta lo colgado: PATCH vuelve, lo demás se detiene ──────
do $$
declare n int;
begin
  update public.kommo_writeback_outbox
     set status = 'processing', claimed_at = now() - interval '1 hour', attempts = 1
   where kommo_lead_id in (2, 3);

  select public.reap_kommo_writeback_stale(
    '11111111-1111-1111-1111-111111111111', '10 minutes') into n;
  if n <> 2 then raise exception 'el reaper solto % de 2', n; end if;

  if exists (select 1 from public.kommo_writeback_outbox
              where kommo_lead_id in (2,3) and status <> 'pending') then
    raise exception 'una op PATCH no volvio a pending: es idempotente, debe reintentarse';
  end if;
end; $$;

-- ── 7) ⭐ El reaper falla CERRADO ante una op que no sabe reintentar ────────
do $$
declare n int; st text;
begin
  -- Simula la Fase 5: una op POST (repetirla CREA otra nota).
  alter table public.kommo_writeback_outbox drop constraint kommo_writeback_outbox_op_check;
  alter table public.kommo_writeback_outbox add constraint kommo_writeback_outbox_op_check
    check (op in ('patch_price','patch_stage','patch_lead','patch_contact',
                  'patch_owner','patch_tags','add_note'));
  insert into public.kommo_writeback_outbox
    (tenant_id, kommo_lead_id, op, payload, idempotency_key, status, claimed_at, attempts)
  values ('11111111-1111-1111-1111-111111111111', 4, 'add_note', '{"text":"hola"}',
          '4:add_note', 'processing', now() - interval '1 hour', 1);

  select public.reap_kommo_writeback_stale(
    '11111111-1111-1111-1111-111111111111', '10 minutes') into n;
  select status into st from public.kommo_writeback_outbox where kommo_lead_id = 4;
  if st <> 'error' then
    raise exception 'una op NO idempotente volvio a %: se enviaria dos veces y duplicaria', st;
  end if;
end; $$;

-- ── 8) Sólo el backend puede drenar ────────────────────────────────────────
do $$
begin
  if has_function_privilege('anon', 'public.claim_kommo_writeback_batch(uuid,int)', 'execute')
  or has_function_privilege('authenticated', 'public.claim_kommo_writeback_batch(uuid,int)', 'execute')
  or has_function_privilege('authenticated', 'public.reap_kommo_writeback_stale(uuid,interval)', 'execute') then
    raise exception 'anon/authenticated pueden drenar la cola: el revoke no quedo';
  end if;
end; $$;

rollback;
