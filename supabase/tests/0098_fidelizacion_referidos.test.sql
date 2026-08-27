\set ON_ERROR_STOP on

-- Contrato del programa de referidos (SDD-0051 · migr 0098).
-- Fixtures ficticios y rollback: no toca prod.
--
-- ── POR QUÉ IMPORTA ───────────────────────────────────────────────────────
--
-- Un referido es la promesa de pagarle a un cliente por traer a otro. Si el
-- vínculo se corrompe —el referidor equivocado, o el referidor perdido— no hay
-- error en pantalla: hay un crédito que se le acredita a quien no fue, o que no
-- se le acredita a nadie. Y quien reclama es el cliente que trajo al otro.
--
-- ── QUÉ SE PROTEGE ────────────────────────────────────────────────────────
--
--   1. 🔴 Ni el referidor ni el referido pueden ser de OTRO tenant. Se prueban
--      las DOS puntas: el trigger las valida por separado, así que un contrato
--      que mirara sólo una dejaría la otra abierta.
--   2. 🔴 Tampoco un cliente dado de baja: el helper exige `deleted_at is null`.
--   3. El referido SIN cliente pasa — es el estado en que nacen todos: alguien
--      a quien todavía no le vendimos nada.
--   4. 🔴 **El referido sobrevive al borrado del cliente referidor.** La FK es
--      `on delete set null` y `referrer_markbox` es NOT NULL y denormalizado:
--      borrar al cliente suelta el vínculo pero **no borra el referido ni pierde
--      de quién era**. Si alguien cambiara la FK a `cascade`, se irían con él
--      todos los referidos que trajo — y con ellos, la prueba de que los trajo.
--   5. El enum acota el vocabulario del estado (`invitado` → `registrado` →
--      `primer-embarque` → `acreditado`).
--   6. El código REF-YYYY-NNNN es único por tenant y el contador no se comparte.
--
-- Las afirmaciones miran el ESTADO DE LA FILA después del intento, no el texto
-- de la excepción.
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

create table public.clients (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null,
  markbox    text,
  name       text,
  deleted_at timestamptz
);

create or replace function public.get_user_tenant_id()
returns uuid language sql stable as $gut$ select null::uuid $gut$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $touch$
begin
  new.updated_at := now();
  return new;
end;
$touch$;

\ir ../migrations/0098_fidelizacion_referidos.sql

-- ── Fixtures ──────────────────────────────────────────────────────────────
\set t1 '11111111-1111-1111-1111-111111111111'
\set t2 '22222222-2222-2222-2222-222222222222'
insert into public.tenants (id, slug) values (:'t1', 'dtd'), (:'t2', 'otro');

\set c1 'ca111111-1111-1111-1111-111111111111'
\set c2 'cb222222-2222-2222-2222-222222222222'
\set cx 'cc999999-9999-9999-9999-999999999999'
insert into public.clients (id, tenant_id, markbox, name, deleted_at) values
  (:'c1', :'t1', 'DTD-5452', 'El que refiere',   null),
  (:'c2', :'t2', 'DTD-0001', 'De otro tenant',   null),
  (:'cx', :'t1', 'DTD-9999', 'Dado de baja',     now());

create or replace function pg_temp.n_referidos() returns int language sql as $n$
  select count(*)::int from public.referrals
$n$;

-- ── 1 · 🔴 Las DOS puntas rechazan al cliente de otro tenant ─────────────
do $$
begin
  -- (a) referidor ajeno
  begin
    insert into public.referrals
      (tenant_id, referral_code, referrer_client_id, referrer_markbox, referred_name)
    values ('11111111-1111-1111-1111-111111111111', 'REF-2026-9001',
            'cb222222-2222-2222-2222-222222222222',   -- cliente del tenant 2
            'DTD-0001', 'Un amigo');
  exception when others then null;
  end;

  -- (b) referido ajeno
  begin
    insert into public.referrals
      (tenant_id, referral_code, referrer_client_id, referrer_markbox,
       referred_name, referred_client_id)
    values ('11111111-1111-1111-1111-111111111111', 'REF-2026-9002',
            'ca111111-1111-1111-1111-111111111111', 'DTD-5452', 'Un amigo',
            'cb222222-2222-2222-2222-222222222222');  -- cliente del tenant 2
  exception when others then null;
  end;

  if pg_temp.n_referidos() <> 0 then
    raise exception
      'CONTRATO 1 ROTO: entraron % referidos atados a un cliente de OTRO tenant — el credito va a quien no fue',
      pg_temp.n_referidos();
  end if;
end;
$$;

-- ── 2 · 🔴 Ni un cliente dado de baja ─────────────────────────────────────
do $$
begin
  begin
    insert into public.referrals
      (tenant_id, referral_code, referrer_client_id, referrer_markbox, referred_name)
    values ('11111111-1111-1111-1111-111111111111', 'REF-2026-9003',
            'cc999999-9999-9999-9999-999999999999', 'DTD-9999', 'Un amigo');
  exception when others then null;
  end;

  if pg_temp.n_referidos() <> 0 then
    raise exception 'CONTRATO 2 ROTO: se le acredito un referido a un cliente dado de baja';
  end if;
end;
$$;

-- ── 3 · El referido sin cliente entra (así nacen todos) ───────────────────
--
-- Y de paso: sin este contrato, un guard que rechazara TODO también pasaría
-- los dos de arriba y el módulo quedaría inutilizable.
\set r1 'ea111111-1111-1111-1111-111111111111'
do $$
begin
  insert into public.referrals
    (id, tenant_id, referral_code, referrer_client_id, referrer_markbox,
     referred_name, referred_email)
  values ('ea111111-1111-1111-1111-111111111111',
          '11111111-1111-1111-1111-111111111111', 'REF-2026-0001',
          'ca111111-1111-1111-1111-111111111111', 'DTD-5452',
          'Comercial del Centro', 'contacto@ejemplo.test');

  if pg_temp.n_referidos() <> 1 then
    raise exception 'CONTRATO 3 ROTO: un referido LEGITIMO fue rechazado';
  end if;
  if (select status from public.referrals where id = 'ea111111-1111-1111-1111-111111111111')::text
     <> 'invitado' then
    raise exception 'CONTRATO 3 ROTO: el referido no nace en «invitado»';
  end if;
end;
$$;

-- ── 4 · 🔴 El referido SOBREVIVE al borrado del cliente referidor ─────────
--
-- El vínculo se suelta (FK `on delete set null`) pero la fila queda, y
-- `referrer_markbox` —NOT NULL y denormalizado— conserva de quién era. Con un
-- `cascade` se irían con el cliente todos los referidos que trajo, y con ellos
-- la prueba de que los trajo.
do $$
declare v_mark text; v_fk uuid;
begin
  delete from public.clients where id = 'ca111111-1111-1111-1111-111111111111';

  if pg_temp.n_referidos() <> 1 then
    raise exception
      'CONTRATO 4 ROTO: borrar al cliente se llevo sus referidos — se pierde la prueba de que los trajo';
  end if;

  select referrer_markbox, referrer_client_id into v_mark, v_fk
    from public.referrals where id = 'ea111111-1111-1111-1111-111111111111';

  if v_mark is distinct from 'DTD-5452' then
    raise exception 'CONTRATO 4 ROTO: se perdio de quien era el referido (markbox = %)', v_mark;
  end if;
  if v_fk is not null then
    raise exception 'CONTRATO 4 ROTO: la FK quedo apuntando a un cliente que ya no existe';
  end if;
end;
$$;

-- Y sin markbox no se puede crear: es lo único que sobrevive al borrado.
do $$
begin
  insert into public.referrals (tenant_id, referral_code, referrer_markbox, referred_name)
  values ('11111111-1111-1111-1111-111111111111', 'REF-2026-9004', null, 'Sin dueño');
  raise exception 'CONTRATO 4 ROTO: entro un referido SIN markbox del referidor';
exception
  when not_null_violation then null;  -- esperado
end;
$$;

-- ── 5 · El vocabulario del estado está acotado ────────────────────────────
do $$
begin
  begin
    update public.referrals set status = 'casi'
     where id = 'ea111111-1111-1111-1111-111111111111';
    raise exception 'CONTRATO 5 ROTO: entro un status inventado';
  exception
    when invalid_text_representation then null;  -- esperado (enum)
  end;

  -- Los cuatro válidos sí.
  update public.referrals set status = 'acreditado', reward_usd = 80
   where id = 'ea111111-1111-1111-1111-111111111111';
  if (select reward_usd from public.referrals where id = 'ea111111-1111-1111-1111-111111111111')
     <> 80 then
    raise exception 'CONTRATO 5 ROTO: no se pudo acreditar el premio';
  end if;
end;
$$;

-- ── 6 · 🔴 El código es único por tenant, y el contador no se comparte ────
do $$
declare v1 text; v2 text; v_n int;
begin
  -- Repetir el código dentro del mismo tenant no entra.
  begin
    insert into public.referrals (tenant_id, referral_code, referrer_markbox, referred_name)
    values ('11111111-1111-1111-1111-111111111111', 'REF-2026-0001', 'DTD-5452', 'Repetido');
  exception when others then null;
  end;
  select count(*) into v_n from public.referrals where referral_code = 'REF-2026-0001';
  if v_n <> 1 then
    raise exception 'CONTRATO 6 ROTO: el codigo REF-2026-0001 existe % veces en el mismo tenant', v_n;
  end if;

  -- Pero el OTRO tenant sí puede tener el suyo con el mismo número.
  insert into public.referrals (tenant_id, referral_code, referrer_markbox, referred_name)
  values ('22222222-2222-2222-2222-222222222222', 'REF-2026-0001', 'DTD-0001', 'Del otro');

  -- ⚠️ Y el tenant 1 lleva uno MÁS ALTO, a propósito. Con un solo código por
  -- tenant, filtrar o no filtrar da la misma respuesta —ambos irían por el
  -- 0002— y el contrato pasaba en verde con el filtro arrancado. Hace falta que
  -- los dos contadores estén en números DISTINTOS para que la diferencia se vea.
  insert into public.referrals (tenant_id, referral_code, referrer_markbox, referred_name)
  values ('11111111-1111-1111-1111-111111111111', 'REF-2026-0007', 'DTD-5452', 'El septimo');

  v1 := public.next_referral_code('11111111-1111-1111-1111-111111111111');
  v2 := public.next_referral_code('22222222-2222-2222-2222-222222222222');

  if v1 !~ '^REF-[0-9]{4}-[0-9]{4}$' then
    raise exception 'CONTRATO 6 ROTO: el codigo no tiene forma REF-YYYY-NNNN (es %)', v1;
  end if;
  if v1 not like '%-0008' then
    raise exception 'CONTRATO 6 ROTO: el tenant 1 iba por 0008 y dio %', v1;
  end if;
  -- El tenant 2 sólo tiene el 0001: va por el 0002, no arrastra el 0007 ajeno.
  if v2 not like '%-0002' then
    raise exception
      'CONTRATO 6 ROTO: el contador se comparte entre tenants — el tenant 2 dio % en vez de 0002', v2;
  end if;
end;
$$;

rollback;
