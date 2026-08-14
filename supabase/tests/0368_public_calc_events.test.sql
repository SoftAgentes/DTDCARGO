-- Contrato de 0368 · la telemetría de la calculadora es ANÓNIMA y CERRADA (SDD-0259).
--
-- Dos cosas que este contrato NO hace, a propósito:
--
--  1. No comprueba que exista una política de RLS. La tabla **no debe tener
--     ninguna**: RLS activa sin políticas niega todo, y ésa es justamente la
--     cerradura. Comprobar la existencia de una política sería comprobar lo
--     contrario de lo que queremos.
--  2. No se conforma con mirar `information_schema.role_table_grants`. Un
--     GRANT ausente no prueba que el rol no pueda leer: prueba lo que dice el
--     catálogo. Acá se hace `set role anon` y se intenta leer y escribir de
--     verdad — la enfermedad, no la cura.
--
-- Y vigila la regla que hace que todo esto sea legal: **ninguna columna que
-- pueda contener un dato personal**. Si mañana alguien agrega `email` o `ip`,
-- este contrato se pone rojo antes de que la migración llegue a producción.

\set ON_ERROR_STOP on
begin;

do $$ begin
  if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);
insert into public.tenants default values;

\ir ../migrations/0368_public_calc_events.sql

-- ─── Caso 1 · RLS quedó ACTIVA ───────────────────────────────
do $$ begin
  if not (select relrowsecurity from pg_class where relname = 'public_calc_events') then
    raise exception 'FALLO: public_calc_events quedó sin RLS';
  end if;
end $$;

-- ─── Caso 2 · CERO políticas: eso es la cerradura ────────────
do $$
declare n int;
begin
  select count(*) into n from pg_policies
   where schemaname='public' and tablename='public_calc_events';
  if n <> 0 then
    raise exception 'FALLO: public_calc_events tiene % política(s). Con RLS activa y sin políticas se niega todo, que es lo que queremos; una política acá abre la tabla.', n;
  end if;
end $$;

-- ─── Caso 3 · `anon` NO puede leer (medido desde el rol) ─────
do $$
declare n int;
begin
  set local role anon;
  begin
    select count(*) into n from public.public_calc_events;
    reset role;
    raise exception 'FALLO: anon pudo LEER public_calc_events (devolvió % filas)', n;
  exception when insufficient_privilege then
    reset role;  -- correcto: el GRANT está cerrado
  end;
end $$;

-- ─── Caso 4 · `anon` NO puede escribir ───────────────────────
do $$
begin
  set local role anon;
  begin
    insert into public.public_calc_events (tenant_id, modo, cbm)
    values ((select id from public.tenants limit 1), 'ddp', 1);
    reset role;
    raise exception 'FALLO: anon pudo INSERTAR en public_calc_events';
  exception when insufficient_privilege then
    reset role;
  end;
end $$;

-- ─── Caso 5 · `authenticated` tampoco ────────────────────────
-- No es telemetría del ERP: ni un empleado logueado la toca por la Data API.
do $$
begin
  set local role authenticated;
  begin
    insert into public.public_calc_events (tenant_id, modo, cbm)
    values ((select id from public.tenants limit 1), 'ddp', 1);
    reset role;
    raise exception 'FALLO: authenticated pudo INSERTAR en public_calc_events';
  exception when insufficient_privilege then
    reset role;
  end;
end $$;

-- ─── Caso 6 · service_role SÍ escribe (si no, la ruta no sirve) ──
insert into public.public_calc_events (tenant_id, modo, cbm, weight_kg)
values ((select id from public.tenants limit 1), 'ddp', 12, null);

-- ─── Caso 7 · el peso NULL es legal: es la métrica de SDD-0257 ──
do $$
declare n int;
begin
  select count(*) into n from public.public_calc_events where weight_kg is null;
  if n <> 1 then
    raise exception 'FALLO: no se pudo guardar un evento sin peso (weight_kg null). Ese caso ES el dato que la tabla existe para medir.';
  end if;
end $$;

-- ─── Caso 8 · CERO columnas que puedan ser dato personal ────
-- La regla que mantiene esta tabla fuera del régimen de datos personales.
do $$
declare cols text;
begin
  select string_agg(column_name, ', ') into cols
  from information_schema.columns
  where table_schema='public' and table_name='public_calc_events'
    and column_name ~* '(email|correo|phone|tel|whatsapp|nombre|name|ip|cookie|session|user|agent|device)';
  if cols is not null then
    raise exception 'FALLO: public_calc_events tiene columna(s) que pueden ser dato personal: %. Eso saca la tabla del régimen anónimo — el cambio tiene que pasar por /revisar-datos-ve.', cols;
  end if;
end $$;

-- ─── Caso 9 · el CBM es obligatorio y positivo ───────────────
do $$
begin
  begin
    insert into public.public_calc_events (tenant_id, modo, cbm)
    values ((select id from public.tenants limit 1), 'ddp', 0);
    raise exception 'FALLO: se aceptó un evento con cbm = 0';
  exception when check_violation then
    null;  -- correcto
  end;
end $$;

rollback;
