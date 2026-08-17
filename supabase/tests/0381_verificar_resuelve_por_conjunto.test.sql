\set ON_ERROR_STOP on

-- Contrato desechable de la migr 0381 (SDD-0258).
-- Fixtures ficticios y rollback: no toca prod.
--
-- /verificar tiene que reconocer las TRES formas de un Shipping Mark nuestro:
--   1. el codigo ACTUAL
--   2. cualquiera de sus JUBILADOS  ← 523 vivos en prod, y la pagina los NEGABA
--   3. la forma IMPRESA de un cliente de sub-aliado (FA-1232 / DC-FA-1232)
--
-- ⭐ Y el caso que impide pasarse de largo: `1232` pelado NO puede dar positivo.
-- Sin el guard de forma, el sufijo `%-1232` haria match y la pagina confirmaria
-- cualquier numero — un oraculo de existencia mucho mas ancho del que ya tiene.

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

create table public.tenants (id uuid primary key);
create table public.clients (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  markbox text, deleted_at timestamptz
);
create table public.client_markbox_history (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null, client_id uuid not null, markbox text not null,
  retired_at timestamptz not null default now()
);

\ir ../migrations/0381_verificar_resuelve_por_conjunto.sql

insert into public.tenants (id) values ('00000000-0000-0000-0000-00000000d7d1');
insert into public.clients (id, tenant_id, markbox) values
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000d7d1', 'DTD-8042'),
  -- Cliente de sub-aliado: guardado con la cadena, impreso sin la raiz.
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000d7d1', 'DC-FA-1232'),
  -- Una ficha borrada: no cuenta.
  ('00000000-0000-0000-0000-00000000c003', '00000000-0000-0000-0000-00000000d7d1', 'DTD-7777');
update public.clients set deleted_at = now() where id = '00000000-0000-0000-0000-00000000c003';

insert into public.client_markbox_history (tenant_id, client_id, markbox) values
  ('00000000-0000-0000-0000-00000000d7d1', '00000000-0000-0000-0000-00000000c001', 'DTD-A001'),
  ('00000000-0000-0000-0000-00000000d7d1', '00000000-0000-0000-0000-00000000c001', 'DTD-9066');

-- 1. El codigo actual.
do $$ begin
  assert public.markbox_existe_publico('DTD-8042'), 'no reconocio el codigo actual';
end $$;

-- 2. ⭐ Los JUBILADOS. Son 523 en prod y la pagina los negaba en titular.
do $$ begin
  assert public.markbox_existe_publico('DTD-A001'),
    'niega un codigo jubilado — el cliente tiene ese codigo en sus cajas y en sus correos';
  assert public.markbox_existe_publico('DTD-9066'),
    'niega el codigo intermedio de una ficha que se renombro dos veces';
end $$;

-- 3. ⭐ La forma IMPRESA de un cliente de sub-aliado.
do $$ begin
  assert public.markbox_existe_publico('FA-1232'),
    'niega la forma IMPRESA: es lo que dice la caja y lo que el cliente teclea';
  -- Y la guardada sigue valiendo (es la que lleva el QR).
  assert public.markbox_existe_publico('DC-FA-1232'), 'niega la forma guardada';
end $$;

-- 4. ⭐ EL GUARD: un numero pelado NO puede dar positivo.
do $$ begin
  assert not public.markbox_existe_publico('1232'),
    'un numero suelto dio positivo — el sufijo sin guard confirma cualquier cosa';
  assert not public.markbox_existe_publico('-1232'), 'un sufijo suelto dio positivo';
end $$;

-- 5. Lo que NO es nuestro sigue diciendo que no.
do $$ begin
  assert not public.markbox_existe_publico('DTD-0000'), 'confirmo un codigo inexistente';
  assert not public.markbox_existe_publico('XX-9999'), 'confirmo una insignia inexistente';
  assert not public.markbox_existe_publico(''), 'la cadena vacia dio positivo';
  assert not public.markbox_existe_publico(null), 'null dio positivo';
end $$;

-- 6. Una ficha BORRADA no cuenta como codigo vivo.
do $$ begin
  assert not public.markbox_existe_publico('DTD-7777'),
    'confirmo el codigo de una ficha eliminada';
end $$;

-- 7. Tolerante a mayusculas y espacios, como el resto del modulo.
do $$ begin
  assert public.markbox_existe_publico('  dtd-8042 '), 'no tolera minusculas ni espacios';
  assert public.markbox_existe_publico('fa-1232'), 'no tolera minusculas en la forma impresa';
end $$;

-- 8. La puede ejecutar anon: /verificar es una pagina PUBLICA.
do $$ begin
  assert has_function_privilege('anon', 'public.markbox_existe_publico(text)', 'execute'),
    'anon no puede ejecutarla y /verificar es publica';
end $$;

rollback;
