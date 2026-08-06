\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0349. Fixtures ficticios y rollback: no toca prod.
--
-- Lo que defiende, que es exactamente lo que puede romperse en silencio:
--   1. un par legado↔legado APARECE (los 6 invisibles que motivaron el cambio),
--   2. sale UNA sola fila por par — sin el espejo A↔B / B↔A,
--   3. el par legado↔nuevo conserva su orientación de siempre (el legado de
--      `legacy_*`), que es lo que la UI ya asume,
--   4. no se compara una ficha consigo misma,
--   5. las fusionadas y las borradas no reaparecen,
--   6. un par sin ninguna coincidencia no entra.

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$roles$;

create schema auth;
create function auth.uid() returns uuid language sql stable set search_path = ''
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table public.tenants (id uuid primary key);
create table public.user_tenants (
  user_id uuid not null, tenant_id uuid not null, role text not null,
  disabled_at timestamptz
);

create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = public as $$
  select ut.tenant_id from public.user_tenants ut
   where ut.user_id = auth.uid() and ut.disabled_at is null limit 1;
$$;

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  markbox text not null,
  name text,
  email text,
  phone text,
  rif text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  merged_into_client_id uuid
);

-- Últimos 7 dígitos del teléfono (mismo criterio que la 0342 en prod).
create function public.phone_match_key(p text) returns text
language sql immutable set search_path = public as $$
  select nullif(right(regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g'), 7), '');
$$;

\ir ../migrations/0349_duplicados_dentro_del_legado.sql

-- ── Fixtures ────────────────────────────────────────────────────────────────
do $seed$
declare
  t uuid := '11111111-1111-1111-1111-111111111111';
  u uuid := '22222222-2222-2222-2222-222222222222';
  -- Todo el legado se importó el MISMO día: por eso el desempate real es el
  -- markbox. Se replica a propósito para que el test viva en ese mundo.
  imp timestamptz := '2026-06-12 10:00:00+00';
begin
  insert into public.tenants values (t);
  insert into public.user_tenants values (u, t, 'admin', null);
  perform set_config('request.jwt.claim.sub', u::text, true);

  -- Par LEGADO ↔ LEGADO (el caso nuevo). Mismo teléfono.
  insert into public.clients (tenant_id, markbox, name, phone, created_at) values
    (t, 'DTD-Y040', 'Maria Perez',  '+58 412 5550001', imp),
    (t, 'DTD-A119', 'Maria Pérez H','0412-5550001',    imp);

  -- Par LEGADO ↔ NUEVO (el caso viejo). Mismo correo.
  insert into public.clients (tenant_id, markbox, name, email, created_at) values
    (t, 'DTD-J066', 'Pedro Gil', 'pedro@ejemplo.com', imp),
    (t, 'DTD-9001', 'Pedro Gil', 'PEDRO@ejemplo.com', imp + interval '30 days');

  -- Sin ninguna coincidencia: no debe salir.
  insert into public.clients (tenant_id, markbox, name, email, phone, created_at) values
    (t, 'DTD-Z900', 'Ana Solo', 'ana@ejemplo.com', '+58 424 9999999', imp);

  -- Fusionada y borrada: no deben reaparecer aunque coincidan con Ana.
  insert into public.clients (tenant_id, markbox, name, email, created_at, merged_into_client_id) values
    (t, 'DTD-Z901', 'Ana Solo', 'ana@ejemplo.com', imp, gen_random_uuid());
  insert into public.clients (tenant_id, markbox, name, email, created_at, deleted_at) values
    (t, 'DTD-Z902', 'Ana Solo', 'ana@ejemplo.com', imp, now());
end;
$seed$;

-- ── 1 + 2. El par legado↔legado aparece UNA vez, no dos ─────────────────────
do $t1$
declare n int; surv text; abs text;
begin
  select count(*) into n from public.client_duplicate_candidates()
   where 'DTD-A119' in (legacy_markbox, new_markbox)
     and 'DTD-Y040' in (legacy_markbox, new_markbox);
  if n <> 1 then
    raise exception 'El par legado↔legado debe salir UNA vez, salieron %', n;
  end if;

  -- Orientación estable: entre dos legados con la misma fecha gana el markbox menor.
  select legacy_markbox, new_markbox into surv, abs
    from public.client_duplicate_candidates()
   where 'DTD-A119' in (legacy_markbox, new_markbox)
     and 'DTD-Y040' in (legacy_markbox, new_markbox);
  if surv <> 'DTD-A119' or abs <> 'DTD-Y040' then
    raise exception 'Orientación inesperada: % / %', surv, abs;
  end if;
end;
$t1$;

-- ── 3. El par legado↔nuevo conserva su orientación (legado en legacy_*) ─────
do $t2$
declare surv text; abs text; n int;
begin
  select count(*) into n from public.client_duplicate_candidates()
   where 'DTD-J066' in (legacy_markbox, new_markbox)
     and 'DTD-9001' in (legacy_markbox, new_markbox);
  if n <> 1 then raise exception 'legado↔nuevo debe salir UNA vez, salieron %', n; end if;

  select legacy_markbox, new_markbox into surv, abs
    from public.client_duplicate_candidates()
   where 'DTD-J066' in (legacy_markbox, new_markbox);
  -- La UI asume que legacy_* es la ficha con historia. Si esto se invierte, el
  -- operador fusionaría al revés y se perdería el historial del legado.
  if surv <> 'DTD-J066' or abs <> 'DTD-9001' then
    raise exception 'legado↔nuevo se invirtió: % / %', surv, abs;
  end if;
end;
$t2$;

-- ── 4. Nunca se compara una ficha consigo misma ─────────────────────────────
do $t3$
declare n int;
begin
  select count(*) into n from public.client_duplicate_candidates()
   where legacy_id = new_id;
  if n <> 0 then raise exception 'Se comparó una ficha consigo misma (% filas)', n; end if;
end;
$t3$;

-- ── 5 + 6. Ni fusionadas, ni borradas, ni pares sin coincidencia ────────────
do $t4$
declare n int;
begin
  select count(*) into n from public.client_duplicate_candidates()
   where 'DTD-Z901' in (legacy_markbox, new_markbox)
      or 'DTD-Z902' in (legacy_markbox, new_markbox);
  if n <> 0 then
    raise exception 'Una fusionada o borrada reapareció como candidata (% filas)', n;
  end if;

  select count(*) into n from public.client_duplicate_candidates()
   where 'DTD-Z900' in (legacy_markbox, new_markbox);
  if n <> 0 then
    raise exception 'Ana Solo no coincide con nadie vivo y salió igual (% filas)', n;
  end if;
end;
$t4$;

rollback;
