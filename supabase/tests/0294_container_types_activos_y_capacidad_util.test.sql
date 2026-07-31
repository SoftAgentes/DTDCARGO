\set ON_ERROR_STOP on

-- Contrato de 0294 (SDD-0184): el catálogo de contenedores dice la verdad.
--
-- Lo que se ancla acá, y por qué cada cosa:
--   · La capacidad pasa de GEOMÉTRICA a ÚTIL en los tres tipos. Si alguien vuelve
--     a sembrar 76 para el 40'HC, el plan de carga miente hacia abajo y el
--     operario cree que le cabe más de lo que le cabe.
--   · `active` nace en false: un tipo nuevo no se ofrece hasta que alguien lo
--     decida. Hoy solo 20GP y 40HC.
--   · `cbm_alert_ceiling` no puede superar a `cbm_capacity` — un techo de aviso
--     por encima de la capacidad no avisaría nunca.
--   · `zone_layout` sin altura (ny=1): el modelo por lotes de SDD-0155 no la usa.
--   · La migración es IDEMPOTENTE y NO DESTRUCTIVA: correrla dos veces no cambia
--     nada, y un valor ya ajustado a mano se respeta.
--
-- Fixture PostgreSQL desechable. Toda la prueba termina en ROLLBACK.

begin;

do $roles$
begin
  if to_regclass('public.container_types') is not null then
    raise exception 'Fixture 0294 rechazada: los objetos reales ya existen';
  end if;
end
$roles$;

-- ── Fixture: container_types tal como queda tras 0096 + 0241 ──

create table public.container_types (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null,
  code          text not null,
  label         text not null,
  cbm_capacity  numeric(10,3) not null,
  kg_capacity   numeric(12,2) not null,
  display_order int not null default 0,
  created_at    timestamptz not null default now(),
  zone_layout   jsonb not null default '{"nx": 3, "ny": 2, "nz": 3}'::jsonb,
  unique (tenant_id, code)
);

alter table public.container_types
  add constraint container_types_zone_layout_shape check (
    (zone_layout->>'nx')::int between 1 and 10 and
    (zone_layout->>'ny')::int between 1 and 6  and
    (zone_layout->>'nz')::int between 1 and 6
  );

-- Seed EXACTO de 0096: los tres valores GEOMÉTRICOS que 0294 tiene que corregir.
insert into public.container_types (tenant_id, code, label, cbm_capacity, kg_capacity, display_order)
values
  ('11111111-1111-1111-1111-111111111111', '20GP', '20'' GP', 33, 28000, 10),
  ('11111111-1111-1111-1111-111111111111', '40GP', '40'' GP', 67, 26500, 20),
  ('11111111-1111-1111-1111-111111111111', '40HC', '40'' HC', 76, 26500, 30),
  -- Un tenant distinto, para probar que la corrección no es tenant-específica.
  ('22222222-2222-2222-2222-222222222222', '40HC', '40'' HC', 76, 26500, 30);

-- Un tipo con la capacidad YA ajustada a mano: 0294 no debe pisarlo.
insert into public.container_types (tenant_id, code, label, cbm_capacity, kg_capacity, display_order)
values
  ('11111111-1111-1111-1111-111111111111', '45HC', '45'' HC', 84.5, 26500, 40);

\ir ../migrations/0294_container_types_activos_y_capacidad_util.sql

-- Segunda pasada: la migración tiene que ser IDEMPOTENTE.
\ir ../migrations/0294_container_types_activos_y_capacidad_util.sql

-- ── Aserciones ───────────────────────────────────────────────

do $t$
declare
  v_cap  numeric;
  v_ceil numeric;
  v_act  boolean;
  v_zl   jsonb;
  v_n    int;
begin
  -- 1. Capacidad ÚTIL en los tres tipos, en TODOS los tenants.
  select count(*) into v_n
  from public.container_types
  where (code = '20GP' and cbm_capacity <> 30)
     or (code = '40GP' and cbm_capacity <> 60)
     or (code = '40HC' and cbm_capacity <> 68);
  if v_n > 0 then
    raise exception 'TEST 0294: % fila(s) siguen con la capacidad geométrica en vez de la útil', v_n;
  end if;

  -- El 40HC del segundo tenant también se corrigió (no es tenant-específico).
  select cbm_capacity into v_cap
  from public.container_types
  where tenant_id = '22222222-2222-2222-2222-222222222222' and code = '40HC';
  if v_cap is distinct from 68 then
    raise exception 'TEST 0294: el 40HC del segundo tenant quedó en % en vez de 68', v_cap;
  end if;

  -- 2. NO DESTRUCTIVA: el 45HC ajustado a mano sigue intacto.
  select cbm_capacity into v_cap
  from public.container_types
  where code = '45HC';
  if v_cap is distinct from 84.5 then
    raise exception 'TEST 0294: se pisó una capacidad ajustada a mano (45HC quedó en %)', v_cap;
  end if;

  -- 3. Techo real: solo el 40HC lo tiene, y vale 66,4.
  select cbm_alert_ceiling into v_ceil
  from public.container_types
  where tenant_id = '11111111-1111-1111-1111-111111111111' and code = '40HC';
  if v_ceil is distinct from 66.4 then
    raise exception 'TEST 0294: el techo real del 40HC quedó en % en vez de 66,4', v_ceil;
  end if;

  select count(*) into v_n
  from public.container_types
  where code <> '40HC' and cbm_alert_ceiling is not null;
  if v_n > 0 then
    raise exception 'TEST 0294: % tipo(s) sin medición propia tienen techo inventado', v_n;
  end if;

  -- 4. Activos: SOLO 20GP y 40HC.
  select count(*) into v_n
  from public.container_types
  where active and code not in ('20GP', '40HC');
  if v_n > 0 then
    raise exception 'TEST 0294: quedaron % tipo(s) activos fuera de 20GP/40HC', v_n;
  end if;

  select count(*) into v_n
  from public.container_types
  where not active and code in ('20GP', '40HC');
  if v_n > 0 then
    raise exception 'TEST 0294: % fila(s) de 20GP/40HC quedaron apagadas', v_n;
  end if;

  -- El 45HC, que no estaba en la lista, quedó apagado (default false).
  select active into v_act from public.container_types where code = '45HC';
  if v_act then
    raise exception 'TEST 0294: un tipo fuera de la lista nació activo';
  end if;

  -- 5. zone_layout SIN altura.
  select count(*) into v_n
  from public.container_types
  where code in ('20GP', '40GP', '40HC')
    and (zone_layout->>'ny')::int <> 1;
  if v_n > 0 then
    raise exception 'TEST 0294: % fila(s) siguen con altura en zone_layout', v_n;
  end if;

  select zone_layout into v_zl
  from public.container_types
  where tenant_id = '11111111-1111-1111-1111-111111111111' and code = '40HC';
  if v_zl is distinct from '{"nx": 3, "ny": 1, "nz": 3}'::jsonb then
    raise exception 'TEST 0294: el layout del 40HC quedó en % en vez de 3x1x3', v_zl;
  end if;

  select zone_layout into v_zl
  from public.container_types
  where code = '20GP';
  if v_zl is distinct from '{"nx": 2, "ny": 1, "nz": 3}'::jsonb then
    raise exception 'TEST 0294: el layout del 20GP quedó en % en vez de 2x1x3', v_zl;
  end if;

  -- 6. El índice del filtro de activos existe.
  if to_regclass('public.container_types_tenant_active_idx') is null then
    raise exception 'TEST 0294: falta el índice (tenant_id, active, display_order)';
  end if;
end
$t$;

-- 7. El CHECK rechaza un techo por encima de la capacidad (no avisaría nunca).
do $t$
begin
  begin
    update public.container_types
       set cbm_alert_ceiling = cbm_capacity + 1
     where code = '40HC';
    raise exception 'TEST 0294: el CHECK aceptó un techo mayor que la capacidad';
  exception
    when check_violation then null;  -- esperado
  end;
end
$t$;

-- 8. Y acepta null (tipos sin medición propia).
do $t$
begin
  update public.container_types
     set cbm_alert_ceiling = null
   where code = '40HC';
exception
  when check_violation then
    raise exception 'TEST 0294: el CHECK rechazó un techo null';
end
$t$;

rollback;

select
  to_regclass('public.container_types') is null
  as container_types_fixture_rolled_back;
