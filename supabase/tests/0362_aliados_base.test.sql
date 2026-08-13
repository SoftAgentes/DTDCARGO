\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0362 (SDD-0255, aliados white-label).
-- Fixtures ficticios y rollback: no toca prod.
--
-- Lo que defiende, que es exactamente lo que puede romperse en silencio:
--   1. no se puede reclamar un prefijo reservado (DTD, ITS, AD, LEG),
--   2. dos aliados no pueden compartir prefijo — si pasara, la forma IMPRESA
--      del código (que omite la raíz) sería ambigua en el papel,
--   3. la jerarquía no admite ciclos,
--   4. el correlativo del aliado es por CADENA exacta: DC-FA no empuja a DC,
--   5. ⭐ meter clientes de aliado NO mueve el correlativo DTD-NNNN — es la
--      razón por la que esta migración no toca `next_markbox`,
--   6. anon y service_role no pueden emitir un código de aliado (el registro
--      público anónimo no puede pedir "emíteme un HR-"),
--   7. ⭐ el detector de duplicados no ve a los clientes de aliado — sin esto
--      HR-0001 cae en `es_legado` y sale propuesto para fusión contra los 361,
--      y `merge_clients` es irreversible,
--   8. un cliente nuevo no puede llevar una insignia que no le corresponde,
--   9. adoptar un cliente existente CONSERVA su código (renumerar es imposible:
--      33 columnas guardan el markbox como texto y no hay una sola FK),
--  10. un aliado o un cliente de aliado no se puede fusionar.

begin;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$roles$;

create schema extensions;
create function extensions.gen_random_uuid() returns uuid
language sql volatile as $$ select gen_random_uuid() $$;

create schema auth;
create table auth.users (id uuid primary key);
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

create function public.assert_tenant_match(p_tenant_id uuid) returns void
language plpgsql stable security definer set search_path = public as $$
declare v_t uuid := public.get_user_tenant_id();
begin
  if v_t is null then raise exception 'Authenticated tenant required' using errcode = '42501'; end if;
  if v_t <> p_tenant_id then raise exception 'Tenant mismatch' using errcode = '42501'; end if;
end;
$$;

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  markbox text,
  name text not null,
  email text, phone text, rif text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  merged_into_client_id uuid
);
create unique index clients_tenant_id_markbox_key on public.clients (tenant_id, markbox);

-- Stub de la migr 0342: normaliza el teléfono a sus últimos 7 dígitos.
create function public.phone_match_key(p text) returns text
language sql immutable set search_path = public as $$
  select nullif(right(regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g'), 7), '');
$$;

-- `next_markbox` copiado TEXTUAL del cuerpo VIVO en prod (migr 0012, verificado
-- con pg_get_functiondef el 2026-08-11). Está acá para poder afirmar el punto 5:
-- que meter clientes de aliado no lo mueve. Si algún día el cuerpo vivo cambia,
-- este contrato deja de medir lo que dice medir — por eso se copia entero y no
-- se resume.
create function public.next_markbox(p_tenant_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_max int;
  v_padded text;
begin
  perform public.assert_tenant_match(p_tenant_id);
  select coalesce(max((regexp_match(markbox, '^DTD-(\d+)$'))[1]::int), 0) + 1
  into v_max
  from public.clients
  where tenant_id = p_tenant_id;
  v_padded := lpad(v_max::text, 4, '0');
  return 'DTD-' || v_padded;
end;
$$;

-- La migración real.
\ir ../migrations/0362_aliados_base.sql

-- ── Fixture ─────────────────────────────────────────────────────────────────
-- Escenario: tenant DTD con 1 cliente directo (DTD-9058), 1 legado con código de
-- VENDEDOR (DTD-A101, que NO es aliado), y dos aliados: HR raíz, y DC raíz con
-- su sub-aliado FA.

insert into auth.users (id) values ('11111111-1111-1111-1111-111111111111');
insert into public.tenants (id) values ('aaaaaaaa-0000-0000-0000-000000000001');
insert into public.user_tenants (user_id, tenant_id, role)
values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'admin');

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

insert into public.clients (id, tenant_id, markbox, name, email, phone) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'DTD-9058', 'Cliente Directo', 'directo@ej.com', '04141112233'),
  ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'DTD-A101', 'Cliente Legado',  'legado@ej.com',  '04145556677'),
  -- Los dos clientes-padre que se van a marcar como aliados.
  ('cccccccc-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'DTD-9010', 'Herneka',       'hr@ej.com',      '04241110000'),
  ('cccccccc-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'DTD-9011', 'Dynasty Cargo', 'dc@ej.com',      '04242220000'),
  ('cccccccc-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', 'DTD-9012', 'Sub de Dynasty','fa@ej.com',      '04243330000');

insert into public.aliados (id, tenant_id, client_id, prefix, trade_name) values
  ('bbbbbbbb-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000003', 'HR', 'Herneka'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000004', 'DC', 'Dynasty Cargo');
insert into public.aliados (id, tenant_id, client_id, parent_aliado_id, prefix, trade_name) values
  ('bbbbbbbb-0000-0000-0000-00000000000f', 'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000005',
   'bbbbbbbb-0000-0000-0000-00000000000b', 'FA', 'Sub de Dynasty');

-- ── 1. Prefijos reservados ──────────────────────────────────────────────────
do $$
declare ok boolean;
begin
  foreach ok in array array[true] loop null; end loop;
  begin
    insert into public.aliados (tenant_id, client_id, prefix, trade_name)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'DTD', 'Impostor');
    raise exception 'HUECO: un aliado reclamó el prefijo DTD';
  exception when check_violation then null;
  end;

  begin
    insert into public.aliados (tenant_id, client_id, prefix, trade_name)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'ITS', 'Impostor');
    raise exception 'HUECO: un aliado reclamó el prefijo ITS, que ya existe suelto en el legado';
  exception when check_violation then null;
  end;

  -- Formato: una sola letra no alcanza (evita chocar con las series de vendedor).
  begin
    insert into public.aliados (tenant_id, client_id, prefix, trade_name)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', 'A', 'Impostor');
    raise exception 'HUECO: se aceptó un prefijo de una sola letra';
  exception when check_violation then null;
  end;
end;
$$;

-- ── 2. Prefijo único global ─────────────────────────────────────────────────
do $$
begin
  begin
    insert into public.aliados (tenant_id, client_id, parent_aliado_id, prefix, trade_name)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001',
            'bbbbbbbb-0000-0000-0000-00000000000a', 'FA', 'Otro FA bajo HR');
    raise exception 'HUECO: dos aliados con prefijo FA — la forma impresa FA-1232 sería ambigua';
  exception when unique_violation then null;
  end;
end;
$$;

-- ── 3. Sin ciclos ───────────────────────────────────────────────────────────
do $$
begin
  begin
    update public.aliados set parent_aliado_id = 'bbbbbbbb-0000-0000-0000-00000000000f'
     where id = 'bbbbbbbb-0000-0000-0000-00000000000b';
    raise exception 'HUECO: DC pudo colgar de su propio sub-aliado FA';
  exception when check_violation then null;
  end;

  begin
    update public.aliados set parent_aliado_id = 'bbbbbbbb-0000-0000-0000-00000000000a'
     where id = 'bbbbbbbb-0000-0000-0000-00000000000a';
    raise exception 'HUECO: un aliado colgó de sí mismo';
  exception when check_violation then null;
  end;
end;
$$;

-- ── 4. La cadena de prefijos ────────────────────────────────────────────────
do $$
declare v text;
begin
  v := public.aliado_prefix_chain('bbbbbbbb-0000-0000-0000-00000000000a');
  if v <> 'HR' then raise exception 'Cadena de un aliado raíz mal compuesta: %', v; end if;

  v := public.aliado_prefix_chain('bbbbbbbb-0000-0000-0000-00000000000f');
  if v <> 'DC-FA' then raise exception 'Cadena de sub-aliado mal compuesta: esperaba DC-FA, dio %', v; end if;
end;
$$;

-- ── 5. El correlativo del aliado, por cadena exacta ─────────────────────────
do $$
declare v text;
begin
  v := public.next_markbox_aliado('bbbbbbbb-0000-0000-0000-00000000000a');
  if v <> 'HR-0001' then raise exception 'Primer código de HR: esperaba HR-0001, dio %', v; end if;

  insert into public.clients (tenant_id, markbox, name, aliado_id)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'HR-0001', 'Cliente de Herneka', 'bbbbbbbb-0000-0000-0000-00000000000a');

  v := public.next_markbox_aliado('bbbbbbbb-0000-0000-0000-00000000000a');
  if v <> 'HR-0002' then raise exception 'Segundo código de HR: esperaba HR-0002, dio %', v; end if;

  -- El sub-aliado numera aparte y lleva la cadena completa.
  v := public.next_markbox_aliado('bbbbbbbb-0000-0000-0000-00000000000f');
  if v <> 'DC-FA-0001' then raise exception 'Primer código de FA: esperaba DC-FA-0001, dio %', v; end if;

  insert into public.clients (tenant_id, markbox, name, aliado_id)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'DC-FA-0001', 'Cliente de FA', 'bbbbbbbb-0000-0000-0000-00000000000f');

  -- Y no empuja el contador de su padre: DC sigue en su primero.
  v := public.next_markbox_aliado('bbbbbbbb-0000-0000-0000-00000000000b');
  if v <> 'DC-0001' then raise exception 'DC-FA-0001 empujó el contador de DC: esperaba DC-0001, dio %', v; end if;
end;
$$;

-- ── 6. ⭐ El correlativo DTD no se mueve ────────────────────────────────────
-- Es la afirmación central de la migración: los namespaces son disjuntos por
-- construcción, así que `next_markbox` no hay que tocarlo.
--
-- ⚠️ El número del cliente de aliado tiene que ser MAYOR que el mayor DTD-NNNN,
-- o esta prueba no discrimina: con HR-0001 y DTD-9058, hasta un regex que
-- contara todo daría igual 9059 y el contrato pasaría en verde sin medir nada.
-- Verificado con mutación el 2026-08-11: sin este HR-9900 la prueba sobrevive a
-- un `next_markbox` que cuenta cualquier cadena.
do $$
declare v text;
begin
  insert into public.clients (tenant_id, markbox, name, aliado_id)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'HR-9900', 'Cliente alto de Herneka',
          'bbbbbbbb-0000-0000-0000-00000000000a');

  v := public.next_markbox('aaaaaaaa-0000-0000-0000-000000000001');
  if v <> 'DTD-9059' then
    raise exception 'REGRESIÓN: con clientes de aliado presentes, next_markbox dio % en vez de DTD-9059', v;
  end if;

  -- Y al revés: el correlativo de HR sigue su propia serie, sin ver los DTD.
  v := public.next_markbox_aliado('bbbbbbbb-0000-0000-0000-00000000000a');
  if v <> 'HR-9901' then
    raise exception 'El correlativo de HR dio % en vez de HR-9901', v;
  end if;
end;
$$;

-- ── 7. anon y service_role no emiten códigos de aliado ──────────────────────
do $$
declare ok boolean := false;
begin
  set local role anon;
  begin
    perform public.next_markbox_aliado('bbbbbbbb-0000-0000-0000-00000000000a');
  exception when insufficient_privilege then ok := true;
  end;
  reset role;
  if not ok then raise exception 'HUECO: anon puede emitir un Shipping Mark de aliado'; end if;

  ok := false;
  set local role service_role;
  begin
    perform public.next_markbox_aliado('bbbbbbbb-0000-0000-0000-00000000000a');
  exception when insufficient_privilege then ok := true;
  end;
  reset role;
  if not ok then
    raise exception 'HUECO: service_role puede emitir un Shipping Mark de aliado — es el camino del registro público anónimo';
  end if;
end;
$$;

-- ── 8. ⭐ El detector de duplicados no ve a los aliados ─────────────────────
-- Se fabrica el peor caso a propósito: un cliente de HR con el MISMO correo,
-- teléfono y nombre que el cliente directo. Sin el parche saldría con score alto.
do $$
declare n int;
begin
  insert into public.clients (tenant_id, markbox, name, email, phone, aliado_id)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'HR-0002', 'Cliente Directo', 'directo@ej.com', '04141112233',
          'bbbbbbbb-0000-0000-0000-00000000000a');

  select count(*) into n from public.client_duplicate_candidates()
   where legacy_markbox like 'HR-%' or new_markbox like 'HR-%'
      or legacy_markbox like 'DC-%' or new_markbox like 'DC-%';
  if n <> 0 then
    raise exception 'HUECO: el detector propuso % par(es) con un cliente de aliado — merge_clients es irreversible', n;
  end if;

  -- Y el detector sigue haciendo su trabajo con el legado: el par que SÍ debe ver.
  insert into public.clients (tenant_id, markbox, name, email)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'DTD-9060', 'Cliente Legado', 'legado@ej.com');
  select count(*) into n from public.client_duplicate_candidates();
  if n = 0 then
    raise exception 'REGRESIÓN: el detector dejó de ver los duplicados del legado';
  end if;
end;
$$;

-- ── 9. Coherencia markbox ↔ aliado ──────────────────────────────────────────
do $$
begin
  -- Cliente nuevo bajo un aliado, con código de la casa: no.
  begin
    insert into public.clients (tenant_id, markbox, name, aliado_id)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'DTD-7777', 'Colado', 'bbbbbbbb-0000-0000-0000-00000000000a');
    raise exception 'HUECO: un cliente nuevo de HR se creó con Shipping Mark DTD-';
  exception when check_violation then null;
  end;

  -- Cliente nuevo bajo un aliado, con la insignia de OTRO aliado: no.
  begin
    insert into public.clients (tenant_id, markbox, name, aliado_id)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'DC-0009', 'Colado', 'bbbbbbbb-0000-0000-0000-00000000000a');
    raise exception 'HUECO: un cliente de HR se creó con la insignia de DC';
  exception when check_violation then null;
  end;

  -- Cliente SIN aliado con insignia de aliado: no.
  begin
    insert into public.clients (tenant_id, markbox, name)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'HR-9999', 'Colado');
    raise exception 'HUECO: un cliente sin aliado se creó con la insignia HR-';
  exception when check_violation then null;
  end;

  -- Los códigos de VENDEDOR del legado siguen entrando sin problema: no son
  -- insignias de aliado y esta migración no los toca.
  insert into public.clients (tenant_id, markbox, name)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'DTD-J099', 'Legado nuevo');
end;
$$;

-- ── 10. Adoptar conserva el código ──────────────────────────────────────────
-- Renumerar es imposible: 33 columnas guardan el markbox como texto y no hay una
-- sola FK por markbox (ver migr 0341). Así que la adopción NO puede exigir que
-- el código cambie.
do $$
declare v text;
begin
  update public.clients set aliado_id = 'bbbbbbbb-0000-0000-0000-00000000000a'
   where id = 'cccccccc-0000-0000-0000-000000000001';

  select markbox into v from public.clients where id = 'cccccccc-0000-0000-0000-000000000001';
  if v <> 'DTD-9058' then
    raise exception 'La adopción cambió el Shipping Mark a %, y eso desincroniza 33 columnas en silencio', v;
  end if;
end;
$$;

-- ── 11. Un aliado no se fusiona ─────────────────────────────────────────────
do $$
begin
  -- El cliente-padre de un aliado.
  begin
    update public.clients set merged_into_client_id = 'cccccccc-0000-0000-0000-000000000002'
     where id = 'cccccccc-0000-0000-0000-000000000003';
    raise exception 'HUECO: se fusionó el cliente-padre de un aliado';
  exception when check_violation then null;
  end;

  -- Un cliente DE un aliado.
  begin
    update public.clients set merged_into_client_id = 'cccccccc-0000-0000-0000-000000000002'
     where markbox = 'HR-0001';
    raise exception 'HUECO: se fusionó un cliente de aliado';
  exception when check_violation then null;
  end;

  -- Y tampoco CONTRA un aliado.
  begin
    update public.clients set merged_into_client_id = 'cccccccc-0000-0000-0000-000000000003'
     where id = 'cccccccc-0000-0000-0000-000000000002';
    raise exception 'HUECO: se fusionó un cliente normal contra el cliente-padre de un aliado';
  exception when check_violation then null;
  end;

  -- La fusión entre dos clientes normales sigue funcionando.
  update public.clients set merged_into_client_id = 'cccccccc-0000-0000-0000-000000000002'
   where markbox = 'DTD-9060';
end;
$$;

rollback;
