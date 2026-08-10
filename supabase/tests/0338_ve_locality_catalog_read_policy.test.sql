-- Contrato de 0338 · el catálogo de localidades se puede LEER (SDD-0241).
--
-- El bug no era "falta una política": era que `authenticated` veía CERO filas
-- teniendo el GRANT. Por eso este contrato no comprueba que la política
-- exista —eso sería comprobar la cura, no la enfermedad— sino que **las filas
-- se leen desde el rol real**, con `set role`.
--
-- Un contrato que sólo mirara `pg_policies` seguiría verde si alguien escribe
-- una política con un `using` que no matchea nada.

\set ON_ERROR_STOP on
begin;

do $$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;

create table public.ve_locality_catalog (
  state_code    text not null,
  state_name    text not null,
  state_region  text not null,
  state_capital text not null,
  municipio     text not null,
  city          text not null,
  postal_code   text not null,
  parroquias    text[] not null default '{}',
  barrios       text[] not null default '{}',
  primary key (state_code, city)
);

insert into public.ve_locality_catalog
  (state_code, state_name, state_region, state_capital, municipio, city, postal_code)
values
  ('CAR', 'Carabobo', 'Centro', 'Valencia', 'Valencia', 'Valencia', '2001'),
  ('DTO', 'Distrito Capital', 'Capital', 'Caracas', 'Libertador', 'Caracas', '1010');

\ir ../migrations/0338_ve_locality_catalog_read_policy.sql

-- ─── Caso 1 · RLS quedó ACTIVA ───────────────────────────────
-- Apagar RLS también "arreglaría" la lectura, pero reabre el aviso del
-- advisor que originó el problema. La cura tiene que ser la política.
do $$ begin
  if not (select relrowsecurity from pg_class where relname = 've_locality_catalog') then
    raise exception 'RLS quedó apagada: la cura no puede ser desactivarla';
  end if;
end $$;

-- ─── Caso 2 · `authenticated` LEE las filas ──────────────────
set local role authenticated;
do $$
declare v_n int;
begin
  select count(*) into v_n from public.ve_locality_catalog;
  if v_n <> 2 then
    raise exception 'authenticated ve % fila(s), esperaba 2 · el cascade Estado→Municipio→Ciudad→CP de /studio/admin/rutas queda vacío', v_n;
  end if;
end $$;
reset role;

-- ─── Caso 3 · `anon` también lee (lo usa el sitio público) ───
set local role anon;
do $$
declare v_n int;
begin
  select count(*) into v_n from public.ve_locality_catalog;
  if v_n <> 2 then
    raise exception 'anon ve % fila(s), esperaba 2', v_n;
  end if;
end $$;
reset role;

-- ─── Caso 4 · sigue siendo INMUTABLE para authenticated ──────
-- Sin políticas de escritura, un INSERT tiene que fallar. Si alguien
-- "arregla" el acceso con un `for all using (true)`, esto se pone rojo.
set local role authenticated;
do $$ begin
  begin
    insert into public.ve_locality_catalog
      (state_code, state_name, state_region, state_capital, municipio, city, postal_code)
    values ('XXX', 'Inventado', 'Nada', 'X', 'X', 'X', '0000');
    raise exception 'authenticated pudo ESCRIBIR en el catálogo: debe ser sólo lectura';
  exception
    when insufficient_privilege then null;  -- lo esperado
    when others then
      if sqlerrm like '%row-level security%' or sqlerrm like '%permission denied%' then
        null;
      else
        raise;
      end if;
  end;
end $$;
reset role;

rollback;
