\set ON_ERROR_STOP on

-- Contrato del hardening de comentarios (SDD-0045 · migr 0093).
-- Fixtures ficticios y rollback: no toca prod.
--
-- ── POR QUÉ IMPORTA ───────────────────────────────────────────────────────
--
-- La 0093 nació de una revisión adversarial: la server action validaba bien,
-- pero un cliente autenticado puede saltarse la action y escribir directo por
-- PostgREST. Esa es toda la razón de que estos guards vivan en la base — y
-- justamente por eso no alcanzan los tests de la app para probarlos: hay que
-- escribir en la tabla como lo haría el atacante.
--
-- ── QUÉ SE PROTEGE ────────────────────────────────────────────────────────
--
--   1. 🔴 No se comenta sobre una entidad de OTRO tenant. El comentario es
--      texto libre de un operador: colgarlo de un envío ajeno es escribir en
--      el expediente de otra empresa.
--   2. 🔴 Ni sobre una entidad inexistente. Sin FK (es polimórfico), un UUID
--      inventado colaría basura que después nadie sabe de qué era.
--   3. 🔴 Un `entity_type` desconocido cae en `false` — fail-closed. Es la
--      rama `else` del CASE: la que se olvida al agregar una tabla comentable.
--   4. 🔴 No se menciona a alguien fuera del tenant, ni a un usuario
--      deshabilitado.
--   5. 🔴 De una mención sólo se puede tocar `read_at`.
--   6. Y `read_at` SÍ se puede escribir — sin eso, marcar como leído no anda.
--
-- ⚠️ **El guard de menciones NO lanza excepción: revierte en silencio.** El
-- trigger reasigna `new.* := old.*` y devuelve la fila. El UPDATE dice que
-- tocó una fila y no cambió nada. Un contrato que esperara un error saldría
-- ROJO con la protección puesta; uno que esperara éxito saldría VERDE con la
-- protección quitada. Por eso el contrato 5 afirma sobre el VALOR guardado.
--
-- ── LO QUE ESTE CONTRATO NO CUBRE ─────────────────────────────────────────
--
-- La inmutabilidad de `comments` (no de `comment_mentions`) la puso la
-- migración 0090, que sigue sin contrato propio. Acá `comments` es un stub.
--
-- Cada contrato se validó rompiéndolo a propósito.

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$roles$;

\ir _supabase-platform-stubs.sql

-- ── Esqueleto mínimo ──────────────────────────────────────────────────────
create table public.tenants (id uuid primary key, slug text);

create table public.user_tenants (
  user_id     uuid,
  tenant_id   uuid,
  role        text,
  disabled_at timestamptz
);

-- Las 8 tablas comentables. Sólo hace falta (id, tenant_id): el helper no mira
-- nada más.
create table public.shipments             (id uuid primary key default gen_random_uuid(), tenant_id uuid);
create table public.clients               (id uuid primary key default gen_random_uuid(), tenant_id uuid);
create table public.invoices              (id uuid primary key default gen_random_uuid(), tenant_id uuid);
create table public.quotes                (id uuid primary key default gen_random_uuid(), tenant_id uuid);
create table public.dispatch_orders       (id uuid primary key default gen_random_uuid(), tenant_id uuid);
create table public.supplier_bills        (id uuid primary key default gen_random_uuid(), tenant_id uuid);
create table public.warehouse_receipts_cn (id uuid primary key default gen_random_uuid(), tenant_id uuid);
create table public.warehouse_receipts_ve (id uuid primary key default gen_random_uuid(), tenant_id uuid);

-- comments / comment_mentions vienen de la 0090 (fuera de alcance acá).
create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null,
  entity_type text not null,
  entity_id   uuid not null,
  body        text not null default '',
  created_at  timestamptz not null default now()
);

create table public.comment_mentions (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null,
  comment_id        uuid not null references public.comments(id),
  mentioned_user_id uuid not null,
  read_at           timestamptz,
  created_at        timestamptz not null default now()
);

\ir ../migrations/0093_comments_hardening.sql

-- ── Fixtures ──────────────────────────────────────────────────────────────
\set t1 '11111111-1111-1111-1111-111111111111'
\set t2 '22222222-2222-2222-2222-222222222222'
insert into public.tenants (id, slug) values (:'t1', 'dtd'), (:'t2', 'otro');

\set e1 'ea111111-1111-1111-1111-111111111111'
\set e2 'eb222222-2222-2222-2222-222222222222'
insert into public.shipments (id, tenant_id) values (:'e1', :'t1'), (:'e2', :'t2');

\set u1 'aa111111-1111-1111-1111-111111111111'
\set u2 'ab222222-2222-2222-2222-222222222222'
\set u3 'ac333333-3333-3333-3333-333333333333'
insert into public.user_tenants (user_id, tenant_id, role, disabled_at) values
  (:'u1', :'t1', 'admin', null),
  (:'u2', :'t2', 'admin', null),
  (:'u3', :'t1', 'operativo', now());   -- del tenant 1, pero deshabilitado

-- Un comentario legítimo (y de paso: el camino feliz existe).
\set k1 'cc111111-1111-1111-1111-111111111111'
insert into public.comments (id, tenant_id, entity_type, entity_id, body)
values (:'k1', :'t1', 'shipment', :'e1', 'La caja llegó rota, ver foto.');

-- ¿Cuántos comentarios hay? Se afirma sobre el conteo, no sobre el mensaje.
create or replace function pg_temp.n_comentarios() returns int
language sql as $n$ select count(*)::int from public.comments $n$;

-- ── 1 · 🔴 No se comenta sobre una entidad de otro tenant ─────────────────
do $$
begin
  begin
    insert into public.comments (tenant_id, entity_type, entity_id, body)
    values ('11111111-1111-1111-1111-111111111111', 'shipment',
            'eb222222-2222-2222-2222-222222222222',   -- envío del tenant 2
            'comentario colado');
  exception when others then null;
  end;

  if pg_temp.n_comentarios() <> 1 then
    raise exception 'CONTRATO 1 ROTO: se comento sobre un envio de OTRO tenant';
  end if;
end;
$$;

-- ── 2 · 🔴 Ni sobre una entidad inexistente ───────────────────────────────
do $$
begin
  begin
    insert into public.comments (tenant_id, entity_type, entity_id, body)
    values ('11111111-1111-1111-1111-111111111111', 'shipment',
            'ff999999-9999-9999-9999-999999999999', 'sobre la nada');
  exception when others then null;
  end;

  if pg_temp.n_comentarios() <> 1 then
    raise exception 'CONTRATO 2 ROTO: entro un comentario sobre un UUID inventado';
  end if;
end;
$$;

-- ── 3 · 🔴 Un tipo desconocido cae en fail-closed ─────────────────────────
--
-- Es la rama `else` del CASE — la que se olvida el día que se agrega una tabla
-- comentable nueva. Si devolviera true, ese tipo entraría sin validar NADA.
do $$
begin
  begin
    insert into public.comments (tenant_id, entity_type, entity_id, body)
    values ('11111111-1111-1111-1111-111111111111', 'tabla_que_no_existe',
            'ea111111-1111-1111-1111-111111111111', 'tipo raro');
  exception when others then null;
  end;

  if pg_temp.n_comentarios() <> 1 then
    raise exception 'CONTRATO 3 ROTO: un entity_type desconocido entro sin validarse (fail-OPEN)';
  end if;
end;
$$;

-- Y el camino legítimo sigue funcionando (sin esto, un guard que rechace TODO
-- también pasaría los tres contratos de arriba).
do $$
begin
  insert into public.comments (tenant_id, entity_type, entity_id, body)
  values ('11111111-1111-1111-1111-111111111111', 'shipment',
          'ea111111-1111-1111-1111-111111111111', 'segundo comentario valido');
  if pg_temp.n_comentarios() <> 2 then
    raise exception 'CONTRATO 3 ROTO: un comentario VALIDO fue rechazado — el modulo queda mudo';
  end if;
end;
$$;

-- ── 4 · 🔴 Menciones: sólo miembros vivos del tenant ──────────────────────
do $$
declare v_n int;
begin
  -- (a) usuario de otro tenant
  begin
    insert into public.comment_mentions (tenant_id, comment_id, mentioned_user_id)
    values ('11111111-1111-1111-1111-111111111111',
            'cc111111-1111-1111-1111-111111111111',
            'ab222222-2222-2222-2222-222222222222');
  exception when others then null;
  end;

  -- (b) usuario del tenant pero DESHABILITADO
  begin
    insert into public.comment_mentions (tenant_id, comment_id, mentioned_user_id)
    values ('11111111-1111-1111-1111-111111111111',
            'cc111111-1111-1111-1111-111111111111',
            'ac333333-3333-3333-3333-333333333333');
  exception when others then null;
  end;

  select count(*) into v_n from public.comment_mentions;
  if v_n <> 0 then
    raise exception 'CONTRATO 4 ROTO: entraron % menciones forjadas', v_n;
  end if;

  -- Y el miembro vivo del tenant SÍ se puede mencionar.
  insert into public.comment_mentions (tenant_id, comment_id, mentioned_user_id)
  values ('11111111-1111-1111-1111-111111111111',
          'cc111111-1111-1111-1111-111111111111',
          'aa111111-1111-1111-1111-111111111111');
  select count(*) into v_n from public.comment_mentions;
  if v_n <> 1 then
    raise exception 'CONTRATO 4 ROTO: no se pudo mencionar a un miembro valido del tenant';
  end if;
end;
$$;

-- ── 5 · 🔴 De una mención sólo se toca read_at ────────────────────────────
--
-- ⚠️ El guard REVIERTE en silencio (new.* := old.*), no lanza. El UPDATE
-- "funciona" y no cambia nada. Por eso acá se afirma sobre el valor guardado:
-- esperar una excepción daría rojo con la protección puesta, y esperar éxito
-- daría verde con la protección quitada.
do $$
declare
  v_id     uuid;
  v_user   uuid;
  v_creado timestamptz;
begin
  select id, mentioned_user_id, created_at into v_id, v_user, v_creado
    from public.comment_mentions limit 1;

  update public.comment_mentions
     set mentioned_user_id = 'ab222222-2222-2222-2222-222222222222',
         created_at        = '2001-01-01'
   where id = v_id;

  if (select mentioned_user_id from public.comment_mentions where id = v_id) <> v_user then
    raise exception 'CONTRATO 5 ROTO: se reasigno la mencion a otro usuario';
  end if;
  if (select created_at from public.comment_mentions where id = v_id) <> v_creado then
    raise exception 'CONTRATO 5 ROTO: se reescribio la fecha de la mencion';
  end if;
end;
$$;

-- ── 6 · read_at SÍ se escribe ─────────────────────────────────────────────
do $$
declare v_id uuid;
begin
  select id into v_id from public.comment_mentions limit 1;

  update public.comment_mentions set read_at = now() where id = v_id;

  if (select read_at from public.comment_mentions where id = v_id) is null then
    raise exception 'CONTRATO 6 ROTO: read_at quedo congelado — marcar como leido no funciona';
  end if;
end;
$$;

rollback;
