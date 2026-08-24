\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0389 (SDD-0283).
-- Fixtures ficticios y rollback: no toca prod.
--
-- Lo que se protege son cuatro cosas que no revientan nunca hasta el día que
-- pasan, y ese día el síntoma le llega al cliente, no a nosotros:
--
--   1. Que un aviso pueda colgar de una COMPRA sin envío. Es la razón de ser de
--      la migración: hoy `shipment_id` es not null y el aviso de "tu carga llegó
--      a Yiwu" se descarta justo cuando el cliente más lo espera.
--   2. Que NO pueda colgar de las dos anclas a la vez. Una fila así se dedupe
--      por una y se entrega por la otra.
--   3. Que NO pueda quedar sin ninguna. Esa fila es un zombi: el drain la
--      levanta en cada pasada y nunca resuelve destino.
--   4. Que la idempotencia siga funcionando POR ANCLA. Es el contrato más sutil
--      y el más fácil de perder: con `shipment_id` nullable, el índice único
--      original deja de deduplicar las compras —dos NULL no colisionan en
--      Postgres— y el cliente recibiría el mismo aviso una vez por caja.
--
-- Cada contrato se validó rompiéndolo a propósito (quitando el CHECK, y dejando
-- el índice único original en vez de los dos parciales): un contrato verde que
-- sigue verde con la protección apagada es decorado, no contrato.

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$roles$;

-- ── Esqueleto mínimo: sólo lo que la 0389 toca o referencia ────────────────
create table public.tenants (id uuid primary key);

create table public.shipments (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade
);

create table public.prealertas (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade
);

create table public.client_notification_rules (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade
);

-- Réplica de la tabla tal como la dejó la 0247 (el estado ANTES de la 0389).
create table public.client_notification_schedule (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  shipment_id    uuid not null references public.shipments(id) on delete cascade,
  client_markbox text not null,
  rule_id        uuid not null references public.client_notification_rules(id) on delete restrict,
  trigger_event  text not null,
  channel        text not null check (channel in ('email', 'push', 'both')),
  template_key   text,
  custom_title   text,
  custom_body    text,
  scheduled_for  timestamptz not null,
  payload        jsonb not null default '{}'::jsonb,
  status         text not null default 'scheduled'
                   check (status in ('scheduled', 'sent', 'skipped', 'canceled', 'failed')),
  sent_at        timestamptz,
  attempts       int not null default 0,
  error          text,
  created_at     timestamptz not null default now()
);

create unique index client_notif_sched_idem_uniq
  on public.client_notification_schedule (shipment_id, trigger_event, rule_id)
  where status <> 'canceled';

insert into public.tenants values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into public.shipments values
  ('55555555-5555-4555-8555-555555555555','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into public.prealertas values
  ('66666666-6666-4666-8666-666666666666','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('77777777-7777-4777-8777-777777777777','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into public.client_notification_rules values
  ('99999999-9999-4999-8999-999999999999','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

-- Una fila PREEXISTENTE, anclada a un envío: la migración tiene que poder
-- correr con datos vivos, no sólo sobre una tabla vacía.
insert into public.client_notification_schedule
  (tenant_id, shipment_id, client_markbox, rule_id, trigger_event, channel, scheduled_for)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','55555555-5555-4555-8555-555555555555',
   'DTD-1','99999999-9999-4999-8999-999999999999','status:in_warehouse','email', now());

\ir ../migrations/0389_aviso_que_cuelga_de_la_compra.sql

-- ─── 1. El aviso PUEDE colgar de una compra sin envío ───────────────────────
do $$
begin
  insert into public.client_notification_schedule
    (tenant_id, prealerta_id, client_markbox, rule_id, trigger_event, channel, scheduled_for)
  values
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','66666666-6666-4666-8666-666666666666',
     'DTD-2','99999999-9999-4999-8999-999999999999','status:in_warehouse','email', now());
exception when others then
  raise exception '0389: un aviso anclado a una compra debía entrar y falló: %', sqlerrm;
end $$;

-- La fila preexistente sobrevivió intacta.
do $$
declare n integer;
begin
  select count(*) into n from public.client_notification_schedule
   where shipment_id = '55555555-5555-4555-8555-555555555555';
  if n <> 1 then raise exception '0389: la fila preexistente se perdió (quedaron %)', n; end if;
end $$;

-- ─── 2. NO puede colgar de las DOS anclas ───────────────────────────────────
do $$
begin
  insert into public.client_notification_schedule
    (tenant_id, shipment_id, prealerta_id, client_markbox, rule_id, trigger_event, channel, scheduled_for)
  values
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','55555555-5555-4555-8555-555555555555',
     '66666666-6666-4666-8666-666666666666','DTD-3',
     '99999999-9999-4999-8999-999999999999','status:shipped','email', now());
  raise exception '0389: se aceptó un aviso con DOS anclas — se dedupe por una y se entrega por la otra';
exception when check_violation then
  null; -- correcto
end $$;

-- ─── 3. NO puede quedar SIN ancla (la fila zombi de la cola) ────────────────
do $$
begin
  insert into public.client_notification_schedule
    (tenant_id, client_markbox, rule_id, trigger_event, channel, scheduled_for)
  values
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','DTD-4',
     '99999999-9999-4999-8999-999999999999','status:shipped','email', now());
  raise exception '0389: se aceptó un aviso SIN ancla — el drain lo levantaría por siempre sin destino';
exception when check_violation then
  null; -- correcto
end $$;

-- ─── 4. La idempotencia sigue viva, POR ANCLA ───────────────────────────────
-- 4a · misma compra + mismo evento + misma regla → choca.
do $$
begin
  insert into public.client_notification_schedule
    (tenant_id, prealerta_id, client_markbox, rule_id, trigger_event, channel, scheduled_for)
  values
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','66666666-6666-4666-8666-666666666666',
     'DTD-2','99999999-9999-4999-8999-999999999999','status:in_warehouse','email', now());
  raise exception '0389: se duplicó el aviso de la MISMA compra — el cliente lo recibiría una vez por caja';
exception when unique_violation then
  null; -- correcto
end $$;

-- 4b · OTRA compra, mismo evento y regla → SÍ entra (no es un duplicado).
do $$
begin
  insert into public.client_notification_schedule
    (tenant_id, prealerta_id, client_markbox, rule_id, trigger_event, channel, scheduled_for)
  values
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','77777777-7777-4777-8777-777777777777',
     'DTD-2','99999999-9999-4999-8999-999999999999','status:in_warehouse','email', now());
exception when others then
  raise exception '0389: se bloqueó el aviso de OTRA compra — la dedupe está de más: %', sqlerrm;
end $$;

-- 4c · el ancla de ENVÍO conserva su propia idempotencia.
do $$
begin
  insert into public.client_notification_schedule
    (tenant_id, shipment_id, client_markbox, rule_id, trigger_event, channel, scheduled_for)
  values
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','55555555-5555-4555-8555-555555555555',
     'DTD-1','99999999-9999-4999-8999-999999999999','status:in_warehouse','email', now());
  raise exception '0389: se duplicó el aviso del MISMO envío — la migración rompió la dedupe que ya había';
exception when unique_violation then
  null; -- correcto
end $$;

-- 4d · un aviso 'canceled' no bloquea al siguiente (el parcial excluye cancelados).
do $$
begin
  update public.client_notification_schedule
     set status = 'canceled'
   where prealerta_id = '66666666-6666-4666-8666-666666666666';

  insert into public.client_notification_schedule
    (tenant_id, prealerta_id, client_markbox, rule_id, trigger_event, channel, scheduled_for)
  values
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','66666666-6666-4666-8666-666666666666',
     'DTD-2','99999999-9999-4999-8999-999999999999','status:in_warehouse','email', now());
exception when others then
  raise exception '0389: un aviso cancelado bloqueó al reemplazo: %', sqlerrm;
end $$;

-- ─── 5. Borrar la compra se lleva su agenda (no deja punteros a un fantasma) ─
do $$
declare n integer;
begin
  delete from public.prealertas where id = '77777777-7777-4777-8777-777777777777';
  select count(*) into n from public.client_notification_schedule
   where prealerta_id = '77777777-7777-4777-8777-777777777777';
  if n <> 0 then raise exception '0389: quedaron % aviso(s) apuntando a una compra borrada', n; end if;
end $$;

rollback;
