\set ON_ERROR_STOP on

-- Contrato del finiquito de egreso (SDD-0109 · migr 0179).
-- Fixtures ficticios y rollback: no toca prod.
--
-- ── POR QUÉ IMPORTA ───────────────────────────────────────────────────────
--
-- El finiquito es lo que se le paga a una persona cuando deja de trabajar acá,
-- calculado según la causa de terminación que manda la LOTTT. Es plata que sale
-- hacia alguien, con su nombre adentro. Dos errores lo arruinan sin dar señal:
-- liquidar dos veces al mismo empleado, y que la antigüedad salga mal porque el
-- egreso quedó antes del ingreso.
--
-- ── QUÉ SE PROTEGE ────────────────────────────────────────────────────────
--
--   1. 🔴 UN solo finiquito vivo por empleado. Un segundo finiquito no anulado
--      es pagarle dos veces la misma liquidación. Y anular sí libera: un
--      finiquito mal calculado tiene que poder rehacerse.
--   2. 🔴 El egreso NUNCA antes del ingreso. La antigüedad sale de esa resta;
--      invertida, las prestaciones salen absurdas y nadie lo ve hasta el pago.
--   3. 🔴 El empleado tiene que ser del mismo tenant, y el renglón del desglose
--      tiene que colgar de un finiquito del mismo tenant. Dos triggers
--      distintos: se prueban los dos.
--   4. 🔴 No se borra un empleado con finiquito (`on delete restrict`). El
--      finiquito es la prueba de lo que se le pagó.
--   5. 🔴 **RLS por tenant Y por ROL.** Es PII de egreso más plata: un usuario
--      del mismo tenant que no sea admin/accounting **no ve nada**. Se prueba
--      con RLS puesta y los dos roles.
--   6. El desglose se va con su finiquito (`on delete cascade`): un renglón
--      huérfano es un monto sin de qué.
--   7. El vocabulario está acotado — causa LOTTT, estado y tipo de renglón.
--   8. El correlativo LIQ-NNNN no se comparte entre tenants.
--
-- Cada contrato se validó rompiéndolo a propósito.

begin;

\ir _supabase-platform-stubs.sql

-- ── Esqueleto mínimo ──────────────────────────────────────────────────────
create table public.tenants (id uuid primary key, slug text);

create table public.user_tenants (
  user_id     uuid,
  tenant_id   uuid,
  role        text,
  disabled_at timestamptz
);

create table public.nomina_employees (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null,
  code       text,
  full_name  text,
  deleted_at timestamptz
);

create table public.nomina_payroll_rules (
  id        uuid primary key default gen_random_uuid(),
  tenant_id uuid not null
);

create table public.journal_entries (
  id        uuid primary key default gen_random_uuid(),
  tenant_id uuid
);

create or replace function public.get_user_tenant_id()
returns uuid language sql stable security definer set search_path = public as $g$
  select tenant_id from public.user_tenants where user_id = (select auth.uid()) limit 1;
$g$;

-- El gate de rol de Nómina (0160). Acá se modela por el rol de `user_tenants`,
-- que es lo que decide en producción: sólo admin y accounting.
create or replace function public.nomina_can_access()
returns boolean language sql stable security definer set search_path = public as $n$
  select exists (
    select 1 from public.user_tenants
     where user_id = (select auth.uid())
       and role in ('admin', 'accounting')
       and disabled_at is null
  );
$n$;

create or replace function public.assert_tenant_match(p_tenant_id uuid)
returns void language plpgsql security definer set search_path = public as $a$
declare v_caller uuid := public.get_user_tenant_id();
begin
  if p_tenant_id is null or v_caller is null or p_tenant_id <> v_caller then
    raise exception 'Tenant mismatch' using errcode = '42501';
  end if;
end;
$a$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $t$
begin new.updated_at := now(); return new; end;
$t$;

\ir ../migrations/0179_nomina_settlements.sql

-- ── Fixtures ──────────────────────────────────────────────────────────────
\set t1 '11111111-1111-1111-1111-111111111111'
\set t2 '22222222-2222-2222-2222-222222222222'
insert into public.tenants (id, slug) values (:'t1', 'dtd'), (:'t2', 'otro');

\set e1 'ea111111-1111-1111-1111-111111111111'
\set e2 'eb222222-2222-2222-2222-222222222222'
insert into public.nomina_employees (id, tenant_id, code, full_name) values
  (:'e1', :'t1', 'EMP-0001', 'Persona Uno'),
  (:'e2', :'t2', 'EMP-0001', 'De otro tenant');

-- Dos usuarios del MISMO tenant: uno con acceso a nómina y otro sin.
\set u_conta 'aa111111-1111-1111-1111-111111111111'
\set u_otro  'ab222222-2222-2222-2222-222222222222'
insert into auth.users (id, email) values
  (:'u_conta', 'contador@dtd.test'), (:'u_otro', 'operativo@dtd.test');
insert into public.user_tenants (user_id, tenant_id, role) values
  (:'u_conta', :'t1', 'accounting'),
  (:'u_otro',  :'t1', 'operativo');

create or replace function pg_temp.finiquitos(p_emp uuid) returns int
language sql as $f$
  select count(*)::int from public.nomina_settlements
   where employee_id = p_emp and deleted_at is null and status <> 'anulado'
$f$;

-- ── 1 · 🔴 Un solo finiquito vivo por empleado, y anular libera ───────────
\set f1 'fa111111-1111-1111-1111-111111111111'
do $$
begin
  insert into public.nomina_settlements
    (id, tenant_id, settlement_code, employee_id, employee_code, employee_name,
     termination_cause, hire_date, termination_date, base_salary_usd,
     rules_snapshot, total_net_usd)
  values ('fa111111-1111-1111-1111-111111111111',
          '11111111-1111-1111-1111-111111111111', 'LIQ-0001',
          'ea111111-1111-1111-1111-111111111111', 'EMP-0001', 'Persona Uno',
          'renuncia_76', '2022-01-15', '2026-06-30', 800.00,
          '{"utilidades_days": 30}'::jsonb, 4210.55);

  -- Un segundo finiquito vivo del mismo empleado sería pagarle dos veces.
  begin
    insert into public.nomina_settlements
      (tenant_id, settlement_code, employee_id, employee_code, employee_name,
       termination_cause, hire_date, termination_date, base_salary_usd, rules_snapshot)
    values ('11111111-1111-1111-1111-111111111111', 'LIQ-0002',
            'ea111111-1111-1111-1111-111111111111', 'EMP-0001', 'Persona Uno',
            'despido_injustificado_92', '2022-01-15', '2026-06-30', 800.00, '{}'::jsonb);
  exception when others then null;
  end;

  if pg_temp.finiquitos('ea111111-1111-1111-1111-111111111111') <> 1 then
    raise exception
      'CONTRATO 1 ROTO: el empleado tiene % finiquitos vivos — se le liquida dos veces',
      pg_temp.finiquitos('ea111111-1111-1111-1111-111111111111');
  end if;
end;
$$;

-- Anular sí libera: un finiquito mal calculado tiene que poder rehacerse.
do $$
begin
  update public.nomina_settlements set status = 'anulado'
   where id = 'fa111111-1111-1111-1111-111111111111';

  insert into public.nomina_settlements
    (tenant_id, settlement_code, employee_id, employee_code, employee_name,
     termination_cause, hire_date, termination_date, base_salary_usd, rules_snapshot)
  values ('11111111-1111-1111-1111-111111111111', 'LIQ-0002',
          'ea111111-1111-1111-1111-111111111111', 'EMP-0001', 'Persona Uno',
          'despido_injustificado_92', '2022-01-15', '2026-06-30', 800.00, '{}'::jsonb);

  if pg_temp.finiquitos('ea111111-1111-1111-1111-111111111111') <> 1 then
    raise exception 'CONTRATO 1 ROTO: anular no libero al empleado para rehacer el finiquito';
  end if;
end;
$$;

-- ── 2 · 🔴 El egreso nunca antes del ingreso ──────────────────────────────
--
-- La antigüedad sale de esa resta. Invertida, las prestaciones salen absurdas y
-- nadie lo nota hasta que se paga.
do $$
declare v_n int;
begin
  -- ⚠️ Va como 'anulado' a propósito. El empleado YA tiene un finiquito vivo,
  -- así que un insert normal lo rechazaría el índice de «uno solo vivo» y este
  -- contrato mediría esa otra protección: salía verde con el guard de fechas
  -- arrancado. Anulado, el índice no aplica y la única puerta que queda es la
  -- que se quiere probar.
  begin
    insert into public.nomina_settlements
      (tenant_id, settlement_code, employee_id, employee_code, employee_name,
       termination_cause, hire_date, termination_date, base_salary_usd, rules_snapshot, status)
    values ('11111111-1111-1111-1111-111111111111', 'LIQ-0900',
            'ea111111-1111-1111-1111-111111111111', 'EMP-0001', 'Persona Uno',
            'renuncia_76', '2026-06-30', '2022-01-15', 800.00, '{}'::jsonb, 'anulado');
  exception when others then null;
  end;

  select count(*) into v_n from public.nomina_settlements where settlement_code = 'LIQ-0900';
  if v_n <> 0 then
    raise exception 'CONTRATO 2 ROTO: entro un finiquito con el egreso ANTES del ingreso';
  end if;

  -- El mismo día sí (alguien que entró y salió el mismo día existe).
  insert into public.nomina_settlements
    (tenant_id, settlement_code, employee_id, employee_code, employee_name,
     termination_cause, hire_date, termination_date, base_salary_usd, rules_snapshot, status)
  values ('11111111-1111-1111-1111-111111111111', 'LIQ-0901',
          'ea111111-1111-1111-1111-111111111111', 'EMP-0001', 'Persona Uno',
          'renuncia_76', '2026-06-30', '2026-06-30', 800.00, '{}'::jsonb, 'anulado');
end;
$$;

-- ── 3 · 🔴 Empleado y renglón: los dos triggers, por separado ─────────────
do $$
declare v_n int; v_vivo uuid;
begin
  -- (a) empleado de otro tenant
  begin
    insert into public.nomina_settlements
      (tenant_id, settlement_code, employee_id, employee_code, employee_name,
       termination_cause, hire_date, termination_date, base_salary_usd, rules_snapshot)
    values ('11111111-1111-1111-1111-111111111111', 'LIQ-0902',
            'eb222222-2222-2222-2222-222222222222', 'EMP-0001', 'De otro tenant',
            'renuncia_76', '2022-01-15', '2026-06-30', 800.00, '{}'::jsonb);
  exception when others then null;
  end;
  select count(*) into v_n from public.nomina_settlements where settlement_code = 'LIQ-0902';
  if v_n <> 0 then
    raise exception 'CONTRATO 3 ROTO: se liquido a un empleado de OTRO tenant';
  end if;

  -- (b) renglón colgado de un finiquito de otro tenant
  select id into v_vivo from public.nomina_settlements
   where settlement_code = 'LIQ-0002';

  begin
    insert into public.nomina_settlement_lines
      (tenant_id, settlement_id, kind, label, amount_usd)
    values ('22222222-2222-2222-2222-222222222222', v_vivo,
            'prestaciones', 'colado', 999.00);
  exception when others then null;
  end;
  select count(*) into v_n from public.nomina_settlement_lines
   where tenant_id = '22222222-2222-2222-2222-222222222222';
  if v_n <> 0 then
    raise exception 'CONTRATO 3 ROTO: un renglon del tenant 2 se colgo de un finiquito del tenant 1';
  end if;

  -- Y el renglón legítimo sí entra.
  insert into public.nomina_settlement_lines
    (tenant_id, settlement_id, kind, label, days, base_usd, amount_usd)
  values ('11111111-1111-1111-1111-111111111111', v_vivo,
          'prestaciones', 'Prestaciones Art. 142', 135, 31.25, 4218.75),
         ('11111111-1111-1111-1111-111111111111', v_vivo,
          'deduccion_prestamo', 'Saldo de préstamo', null, null, -300.00);
end;
$$;

-- ── 4 · 🔴 No se borra un empleado con finiquito ──────────────────────────
--
-- El finiquito es la prueba de lo que se le pagó a esa persona.
do $$
declare v_n int;
begin
  begin
    delete from public.nomina_employees where id = 'ea111111-1111-1111-1111-111111111111';
  exception when others then null;
  end;

  select count(*) into v_n from public.nomina_employees
   where id = 'ea111111-1111-1111-1111-111111111111';
  if v_n <> 1 then
    raise exception 'CONTRATO 4 ROTO: se borro un empleado con finiquito — se pierde la prueba del pago';
  end if;
end;
$$;

-- ── 5 · 🔴 RLS por tenant Y por ROL ───────────────────────────────────────
--
-- Es PII de egreso más plata. Un usuario del MISMO tenant que no sea
-- admin/accounting no puede ver ni un renglón — y el gate de rol de la app es
-- la segunda capa, no la única.
do $$
declare v_ve int;
begin
  set local role authenticated;

  -- (a) el contador sí ve
  perform set_config('test.uid', 'aa111111-1111-1111-1111-111111111111', true);
  select count(*) into v_ve from public.nomina_settlements;
  if v_ve = 0 then
    raise exception 'CONTRATO 5 ROTO: el contador NO ve los finiquitos de su tenant';
  end if;

  -- (b) el operativo del MISMO tenant no ve nada
  perform set_config('test.uid', 'ab222222-2222-2222-2222-222222222222', true);
  select count(*) into v_ve from public.nomina_settlements;
  if v_ve <> 0 then
    raise exception
      'CONTRATO 5 ROTO: un usuario sin rol de nomina ve % finiquitos — es PII de egreso y plata', v_ve;
  end if;

  select count(*) into v_ve from public.nomina_settlement_lines;
  if v_ve <> 0 then
    raise exception 'CONTRATO 5 ROTO: un usuario sin rol de nomina ve % renglones del desglose', v_ve;
  end if;

  -- Y tampoco puede escribir uno.
  begin
    insert into public.nomina_settlements
      (tenant_id, settlement_code, employee_id, employee_code, employee_name,
       termination_cause, hire_date, termination_date, base_salary_usd, rules_snapshot)
    values ('11111111-1111-1111-1111-111111111111', 'LIQ-0999',
            'ea111111-1111-1111-1111-111111111111', 'EMP-0001', 'Persona Uno',
            'despido_injustificado_92', '2022-01-15', '2026-06-30', 9999.00, '{}'::jsonb);
    raise exception 'CONTRATO 5 ROTO: un usuario sin rol de nomina creo un finiquito';
  exception
    when insufficient_privilege then null;  -- esperado
  end;

  reset role;
exception when others then
  reset role;
  raise;
end;
$$;

-- ── 6 · El desglose se va con su finiquito ────────────────────────────────
do $$
declare v_id uuid; v_n int;
begin
  select id into v_id from public.nomina_settlements where settlement_code = 'LIQ-0002';
  delete from public.nomina_settlements where id = v_id;

  select count(*) into v_n from public.nomina_settlement_lines where settlement_id = v_id;
  if v_n <> 0 then
    raise exception 'CONTRATO 6 ROTO: quedaron % renglones huerfanos — montos sin de que', v_n;
  end if;
end;
$$;

-- ── 7 · El vocabulario está acotado ───────────────────────────────────────
do $$
declare v_n int;
begin
  begin
    insert into public.nomina_settlements
      (tenant_id, settlement_code, employee_id, employee_code, employee_name,
       termination_cause, hire_date, termination_date, base_salary_usd, rules_snapshot)
    values ('11111111-1111-1111-1111-111111111111', 'LIQ-0903',
            'ea111111-1111-1111-1111-111111111111', 'EMP-0001', 'Persona Uno',
            'lo_echaron_nomas', '2022-01-15', '2026-06-30', 800.00, '{}'::jsonb);
  exception when others then null;
  end;
  select count(*) into v_n from public.nomina_settlements where settlement_code = 'LIQ-0903';
  if v_n <> 0 then
    raise exception 'CONTRATO 7 ROTO: entro una causa de terminacion fuera de la LOTTT';
  end if;

  -- Y las cuatro de la ley sí, cada una anulada para no chocar con el índice.
  insert into public.nomina_settlements
    (tenant_id, settlement_code, employee_id, employee_code, employee_name,
     termination_cause, hire_date, termination_date, base_salary_usd, rules_snapshot, status)
  select '11111111-1111-1111-1111-111111111111', 'LIQ-C' || c,
         'ea111111-1111-1111-1111-111111111111', 'EMP-0001', 'Persona Uno',
         c, '2022-01-15', '2026-06-30', 800.00, '{}'::jsonb, 'anulado'
    from unnest(array['renuncia_76', 'ajena_78',
                      'despido_justificado_79', 'despido_injustificado_92']) as c;
end;
$$;

-- ── 8 · El correlativo no se comparte entre tenants ───────────────────────
do $$
declare v1 text; v2 text; v_esperado text;
begin
  -- ⚠️ El tenant 2 lleva un correlativo MÁS ALTO, a propósito: si los dos
  -- estuvieran en números parecidos, filtrar o no filtrar por tenant daría la
  -- misma respuesta y el contrato pasaría con el filtro arrancado.
  insert into public.nomina_settlements
    (tenant_id, settlement_code, employee_id, employee_code, employee_name,
     termination_cause, hire_date, termination_date, base_salary_usd, rules_snapshot)
  values ('22222222-2222-2222-2222-222222222222', 'LIQ-5000',
          'eb222222-2222-2222-2222-222222222222', 'EMP-0001', 'De otro tenant',
          'renuncia_76', '2022-01-15', '2026-06-30', 800.00, '{}'::jsonb);

  -- Lo esperado se DERIVA de los datos, no se hardcodea: así el contrato no se
  -- rompe cada vez que un escenario de arriba agrega o rechaza un código.
  select 'LIQ-' || lpad((coalesce(max((regexp_match(settlement_code, '^LIQ-(\d+)$'))[1]::int), 0) + 1)::text, 4, '0')
    into v_esperado
    from public.nomina_settlements
   where tenant_id = '11111111-1111-1111-1111-111111111111';

  set local role authenticated;
  perform set_config('test.uid', 'aa111111-1111-1111-1111-111111111111', true);
  v1 := public.next_settlement_code('11111111-1111-1111-1111-111111111111');

  if v1 <> v_esperado then
    raise exception
      'CONTRATO 8 ROTO: el correlativo del tenant 1 dio % y le tocaba % — cuenta finiquitos ajenos',
      v1, v_esperado;
  end if;

  -- Y pedir el de OTRO tenant no se puede: assert_tenant_match lo frena.
  begin
    v2 := public.next_settlement_code('22222222-2222-2222-2222-222222222222');
    raise exception 'CONTRATO 8 ROTO: se leyo el correlativo de finiquitos de OTRO tenant (%)', v2;
  exception
    when insufficient_privilege then null;  -- esperado (42501)
  end;

  reset role;
exception when others then
  reset role;
  raise;
end;
$$;

rollback;
