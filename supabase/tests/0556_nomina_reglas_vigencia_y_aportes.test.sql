\set ON_ERROR_STOP on
-- SDD-0653 fase A2b · contrato de la 0556 (reglas de nómina con vigencia, monedas, aportes patronales y escalas).
-- Migraciones reales (0160, 0162 y 0556); fixtures sintéticos. Nunca conecta a producción.
-- Cubre: (1) las filas que ya existían no se tocan (vigente_desde NULL, monedas en VES, aportes y escalas en
-- NULL = «sin configurar», mismo updated_at); (2) las filas nuevas nacen con la fecha de HOY EN CARACAS;
-- (3) cada CHECK rechaza lo suyo; (4) reaplicar no cambia nada; (5) la RLS por tenant Y rol sigue igual: otro
-- tenant, un rol sin acceso, un admin deshabilitado y anon no ven ni escriben; (6) el catálogo (policy única,
-- grants, función) no cambió; (7) nomina_guardar_reglas es ATÓMICA: un fallo a mitad (CHECK, desborde de
-- numeric, dato que falta, fecha futura) deja la versión vigente intacta; hereda la moneda de la vigente;
-- respeta la RLS (operador, sin membership y anon fallan; cada tenant toca solo lo suyo).
begin;
do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$roles$;
grant usage on schema public to anon, authenticated, service_role;
create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable set search_path = '' as $$
  select nullif(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create table public.tenants (id uuid primary key, slug text unique);
create table public.user_tenants (
  user_id uuid primary key, tenant_id uuid not null, role text not null, disabled_at timestamptz
);
create function public.get_user_tenant_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select ut.tenant_id from public.user_tenants ut
  where ut.user_id = (select auth.uid()) and ut.disabled_at is null limit 1
$$;
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

insert into public.tenants (id, slug) values
  ('10000000-0653-0000-0000-000000000001', 'dtd'),
  ('20000000-0653-0000-0000-000000000002', 'otro');
insert into auth.users (id) values
  ('aaaaaaaa-0653-0000-0000-000000000001'), -- admin del tenant 1
  ('aaaaaaaa-0653-0000-0000-000000000002'), -- operador del tenant 1 (sin acceso a nómina)
  ('aaaaaaaa-0653-0000-0000-000000000003'), -- admin deshabilitado del tenant 1
  ('bbbbbbbb-0653-0000-0000-000000000001'), -- contador del tenant 2
  ('cccccccc-0653-0000-0000-000000000009'); -- sin membership
insert into public.user_tenants (user_id, tenant_id, role, disabled_at) values
  ('aaaaaaaa-0653-0000-0000-000000000001', '10000000-0653-0000-0000-000000000001', 'admin', null),
  ('aaaaaaaa-0653-0000-0000-000000000002', '10000000-0653-0000-0000-000000000001', 'operator', null),
  ('aaaaaaaa-0653-0000-0000-000000000003', '10000000-0653-0000-0000-000000000001', 'admin', now()),
  ('bbbbbbbb-0653-0000-0000-000000000001', '20000000-0653-0000-0000-000000000002', 'accounting', null);

-- nomina_can_access() sale de la 0160; las reglas (con su siembra demo del tenant dtd) de la 0162.
\ir ../migrations/0160_nomina_employees.sql
\ir ../migrations/0162_nomina_payroll_rules.sql

-- Una versión del tenant 2 (el otro tenant), con valores propios, para los negativos de aislamiento.
insert into public.nomina_payroll_rules (tenant_id, version, status, min_salary, notes)
values ('20000000-0653-0000-0000-000000000002', 1, 'vigente', 111.00, 'version de otro tenant');

-- Foto de las filas ANTES de la 0556: ni una sola puede cambiar.
create temp table foto as
  select id, ctid as fila, updated_at, version, min_salary, cestaticket, bono_guerra, utilidades_days
    from public.nomina_payroll_rules;

\ir ../migrations/0556_nomina_reglas_vigencia_y_aportes.sql

-- ── (1) Las filas existentes: intactas, con la lectura conservadora ──────────
do $existentes$
begin
  if (select count(*) from public.nomina_payroll_rules) <> 2 then
    raise exception 'TEST 0556: cambió el número de filas';
  end if;
  if exists (
    select 1 from public.nomina_payroll_rules r join foto f on f.id = r.id
    where r.ctid <> f.fila or r.updated_at <> f.updated_at or r.version <> f.version
       or r.min_salary <> f.min_salary or r.cestaticket <> f.cestaticket
       or r.bono_guerra <> f.bono_guerra or r.utilidades_days <> f.utilidades_days
  ) then
    raise exception 'TEST 0556: la migración tocó una fila existente';
  end if;
  if exists (select 1 from public.nomina_payroll_rules where vigente_desde is not null or fuente_legal is not null) then
    raise exception 'TEST 0556: una versión anterior quedó con fecha o fuente inventadas';
  end if;
  if exists (select 1 from public.nomina_payroll_rules
              where cestaticket_moneda <> 'VES' or bono_guerra_moneda <> 'VES') then
    raise exception 'TEST 0556: una versión anterior no quedó en bolívares';
  end if;
  -- Lo que se configura queda SIN CONFIGURAR (NULL), no con un valor inventado.
  if exists (select 1 from public.nomina_payroll_rules
              where ingreso_minimo_integral_usd is not null or sso_patronal_pct is not null
                 or rpe_patronal_pct is not null or faov_patronal_pct is not null
                 or inces_patronal_pct is not null or inces_utilidades_pct is not null
                 or pension_contrib_pct is not null or vacaciones_extra_max is not null
                 or bono_vacacional_max_days is not null) then
    raise exception 'TEST 0556: una versión anterior quedó con aportes o escalas inventados (deben ser NULL)';
  end if;
end;
$existentes$;

-- ── (2) Una versión NUEVA nace con la fecha de hoy ───────────────────────────
do $nuevas$
declare
  v_id uuid;
  v_hoy_caracas date := (now() at time zone 'America/Caracas')::date;
begin
  -- El default de la fecha es la de Caracas, no current_date (que sigue la zona de la sesión).
  if (select pg_get_expr(d.adbin, d.adrelid) from pg_attrdef d
       join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
      where d.adrelid = 'public.nomina_payroll_rules'::regclass and a.attname = 'vigente_desde') not like '%America/Caracas%' then
    raise exception 'TEST 0556: el default de vigente_desde no es la fecha de Caracas';
  end if;
  update public.nomina_payroll_rules set status = 'archivada'
   where tenant_id = '10000000-0653-0000-0000-000000000001' and status = 'vigente';
  insert into public.nomina_payroll_rules (tenant_id, version, status, fuente_legal, ingreso_minimo_integral_usd,
                                           cestaticket_moneda, bono_guerra_moneda, sso_patronal_pct)
  values ('10000000-0653-0000-0000-000000000001', 2, 'vigente', 'G.O. 6.691 Ext., Decreto 4.653', 240, 'USD', 'USD', 10)
  returning id into v_id;
  if (select vigente_desde from public.nomina_payroll_rules where id = v_id) is distinct from v_hoy_caracas then
    raise exception 'TEST 0556: una versión nueva no nació con vigente_desde = hoy en Caracas';
  end if;
  if (select cestaticket_moneda || bono_guerra_moneda || sso_patronal_pct::text from public.nomina_payroll_rules where id = v_id) <> 'USDUSD10.00' then
    raise exception 'TEST 0556: la versión nueva no guardó monedas y aporte';
  end if;
  -- Sin valores, una versión nueva tampoco inventa: aportes y escalas en NULL.
  if (select rpe_patronal_pct is not null or pension_contrib_pct is not null or vacaciones_extra_max is not null
        from public.nomina_payroll_rules where id = v_id) then
    raise exception 'TEST 0556: una versión nueva sin valores no quedó en NULL';
  end if;
  -- Una sola versión vigente por tenant sigue valiendo.
  begin
    insert into public.nomina_payroll_rules (tenant_id, version, status)
    values ('10000000-0653-0000-0000-000000000001', 3, 'vigente');
    raise exception 'TEST 0556: dos versiones vigentes en el mismo tenant';
  exception when unique_violation then null;
  end;
end;
$nuevas$;

-- ── (3) Cada CHECK rechaza lo suyo (y acepta el límite) ──────────────────────
do $checks$
declare
  v_caso record;
  v_malos int := 0;
  v_buenos int := 0;
begin
  for v_caso in
    select * from (values
      ('fuente vacía',                        'fuente_legal = ''   '''),
      ('fuente de 201 caracteres',            'fuente_legal = repeat(''x'', 201)'),
      ('ingreso mínimo negativo',             'ingreso_minimo_integral_usd = -1'),
      ('moneda de cestaticket EUR',           'cestaticket_moneda = ''EUR'''),
      ('moneda de bono en minúscula',         'bono_guerra_moneda = ''usd'''),
      ('aporte del IVSS en 101',              'sso_patronal_pct = 101'),
      ('aporte del RPE negativo',             'rpe_patronal_pct = -0.01'),
      ('aporte del FAOV en 100,01',           'faov_patronal_pct = 100.01'),
      ('aporte del INCES en 101',             'inces_patronal_pct = 101'),
      ('INCES de utilidades en 101',          'inces_utilidades_pct = 101'),
      ('contribución de pensiones en 15,01',  'pension_contrib_pct = 15.01'),
      ('contribución de pensiones negativa',  'pension_contrib_pct = -1'),
      ('vacaciones extra negativas',          'vacaciones_extra_max = -1'),
      ('vacaciones extra en 366',             'vacaciones_extra_max = 366'),
      ('bono vacacional máximo negativo',     'bono_vacacional_max_days = -1'),
      ('utilidades en 29',                    'utilidades_days = 29'),
      ('utilidades en 121',                   'utilidades_days = 121')
    ) as t(caso, asignacion)
  loop
    begin
      execute pg_catalog.format(
        'update public.nomina_payroll_rules set %s where tenant_id = %L and status = %L',
        v_caso.asignacion, '10000000-0653-0000-0000-000000000001', 'vigente');
      raise exception 'TEST 0556: el CHECK aceptó «%»', v_caso.caso;
    exception when check_violation then
      v_malos := v_malos + 1;
    end;
  end loop;
  if v_malos <> 17 then
    raise exception 'TEST 0556: se esperaban 17 rechazos y hubo %', v_malos;
  end if;

  -- Los límites que SÍ valen.
  for v_caso in
    select * from (values
      ('fuente de 200 caracteres',  'fuente_legal = repeat(''x'', 200)'),
      ('aporte en 0',               'sso_patronal_pct = 0'),
      ('aporte en 100',             'rpe_patronal_pct = 100'),
      ('pensiones en 15',           'pension_contrib_pct = 15'),
      ('pensiones en 0',            'pension_contrib_pct = 0'),
      ('escalas en 365',            'vacaciones_extra_max = 365, bono_vacacional_max_days = 365'),
      ('utilidades en 30',          'utilidades_days = 30'),
      ('utilidades en 120',         'utilidades_days = 120'),
      ('moneda USD',                'cestaticket_moneda = ''USD'''),
      ('fuente nula',               'fuente_legal = null')
    ) as t(caso, asignacion)
  loop
    execute pg_catalog.format(
      'update public.nomina_payroll_rules set %s where tenant_id = %L and status = %L',
      v_caso.asignacion, '10000000-0653-0000-0000-000000000001', 'vigente');
    v_buenos := v_buenos + 1;
  end loop;
  if v_buenos <> 10 then
    raise exception 'TEST 0556: los límites válidos no corrieron todos';
  end if;
end;
$checks$;

-- ── (4) Reaplicar no cambia nada ─────────────────────────────────────────────
create temp table forma_antes as
  select (select string_agg(column_name || ':' || data_type || ':' || is_nullable || ':' || coalesce(column_default, ''), ',' order by column_name)
            from information_schema.columns where table_schema = 'public' and table_name = 'nomina_payroll_rules') as columnas,
         (select string_agg(conname || ':' || pg_get_constraintdef(oid), ',' order by conname)
            from pg_constraint where conrelid = 'public.nomina_payroll_rules'::regclass) as restricciones,
         (select string_agg(id::text || version::text, ',' order by id) from public.nomina_payroll_rules) as filas;

\ir ../migrations/0556_nomina_reglas_vigencia_y_aportes.sql

do $idempotente$
begin
  if (select columnas from forma_antes) is distinct from
     (select string_agg(column_name || ':' || data_type || ':' || is_nullable || ':' || coalesce(column_default, ''), ',' order by column_name)
        from information_schema.columns where table_schema = 'public' and table_name = 'nomina_payroll_rules') then
    raise exception 'TEST 0556: reaplicar cambió las columnas';
  end if;
  if (select restricciones from forma_antes) is distinct from
     (select string_agg(conname || ':' || pg_get_constraintdef(oid), ',' order by conname)
        from pg_constraint where conrelid = 'public.nomina_payroll_rules'::regclass) then
    raise exception 'TEST 0556: reaplicar cambió las restricciones';
  end if;
  if (select filas from forma_antes) is distinct from (select string_agg(id::text || version::text, ',' order by id) from public.nomina_payroll_rules) then
    raise exception 'TEST 0556: reaplicar cambió las filas';
  end if;
end;
$idempotente$;

-- ── (6) El catálogo no cambió: una policy, los grants de la 0162 ─────────────
do $catalogo$
declare
  v_priv text;
begin
  if (select count(*) from pg_policy where polrelid = 'public.nomina_payroll_rules'::regclass) <> 1
     or not exists (select 1 from pg_policy where polrelid = 'public.nomina_payroll_rules'::regclass
                      and polname = 'nomina_payroll_rules by tenant and role') then
    raise exception 'TEST 0556: la policy de nomina_payroll_rules cambió';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.nomina_payroll_rules'::regclass) then
    raise exception 'TEST 0556: se apagó la RLS';
  end if;
  foreach v_priv in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
    if not has_table_privilege('authenticated', 'public.nomina_payroll_rules', v_priv) then
      raise exception 'TEST 0556: authenticated perdió % sobre nomina_payroll_rules', v_priv;
    end if;
    if has_table_privilege('anon', 'public.nomina_payroll_rules', v_priv) then
      raise exception 'TEST 0556: anon ganó % sobre nomina_payroll_rules', v_priv;
    end if;
  end loop;
  if has_table_privilege('authenticated', 'public.nomina_payroll_rules', 'TRUNCATE') then
    raise exception 'TEST 0556: authenticated puede TRUNCATE nomina_payroll_rules';
  end if;
  -- La función de guardado: invoker, search_path vacío, solo authenticated.
  if not exists (select 1 from pg_proc where oid = to_regprocedure('public.nomina_guardar_reglas(jsonb)')
                   and not prosecdef and proconfig @> array['search_path=""']::text[]) then
    raise exception 'TEST 0556: nomina_guardar_reglas no es SECURITY INVOKER con search_path vacío';
  end if;
  if not has_function_privilege('authenticated', 'public.nomina_guardar_reglas(jsonb)', 'EXECUTE')
     or has_function_privilege('anon', 'public.nomina_guardar_reglas(jsonb)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.nomina_guardar_reglas(jsonb)', 'EXECUTE') then
    raise exception 'TEST 0556: EXECUTE de nomina_guardar_reglas no es solo de authenticated';
  end if;
end;
$catalogo$;

-- ── (5) RLS por tenant Y rol, con las columnas nuevas ────────────────────────
-- Admin del tenant 1: ve su tenant (incluidas las columnas nuevas) y nada del otro.
do $admin$
declare
  v_n int;
  v_filas int;
  v_ajena uuid;
begin
  select id into v_ajena from public.nomina_payroll_rules where tenant_id = '20000000-0653-0000-0000-000000000002';
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0653-0000-0000-000000000001', true);

  select count(*) into v_n from public.nomina_payroll_rules;
  if v_n <> 2 then raise exception 'TEST 0556: el admin del tenant 1 ve % filas (esperaba las 2 suyas)', v_n; end if;
  select count(*) into v_n from public.nomina_payroll_rules
   where tenant_id = '20000000-0653-0000-0000-000000000002';
  if v_n <> 0 then raise exception 'TEST 0556: el admin del tenant 1 ve filas del tenant 2'; end if;
  select count(*) into v_n from public.nomina_payroll_rules
   where cestaticket_moneda in ('VES', 'USD') and bono_guerra_moneda in ('VES', 'USD');
  if v_n <> 2 then raise exception 'TEST 0556: el admin no lee las columnas nuevas de sus filas'; end if;

  -- No escribe en el tenant 2: ni insertar, ni modificar (0 filas), ni borrar (0 filas).
  begin
    insert into public.nomina_payroll_rules (tenant_id, version, status)
    values ('20000000-0653-0000-0000-000000000002', 9, 'archivada');
    raise exception 'TEST 0556: el admin del tenant 1 insertó una versión en el tenant 2';
  exception when insufficient_privilege then null;
  end;
  update public.nomina_payroll_rules set fuente_legal = 'intento ajeno' where id = v_ajena;
  get diagnostics v_filas = row_count;
  if v_filas <> 0 then raise exception 'TEST 0556: el admin del tenant 1 modificó una fila del tenant 2'; end if;
  delete from public.nomina_payroll_rules where id = v_ajena;
  get diagnostics v_filas = row_count;
  if v_filas <> 0 then raise exception 'TEST 0556: el admin del tenant 1 borró una fila del tenant 2'; end if;

  -- Sí escribe en el suyo, con los campos nuevos: nueva versión con vigencia y fuente (D2).
  update public.nomina_payroll_rules set status = 'archivada'
   where tenant_id = '10000000-0653-0000-0000-000000000001' and status = 'vigente';
  insert into public.nomina_payroll_rules (tenant_id, version, status, vigente_desde, fuente_legal, pension_contrib_pct)
  values ('10000000-0653-0000-0000-000000000001', 3, 'vigente', '2026-12-01', 'Decreto de prueba', 9);
  reset role;
end;
$admin$;

do $despues_admin$
begin
  if (select fuente_legal from public.nomina_payroll_rules where tenant_id = '20000000-0653-0000-0000-000000000002') is not null then
    raise exception 'TEST 0556: la fila del tenant 2 quedó modificada';
  end if;
  if (select count(*) from public.nomina_payroll_rules where tenant_id = '20000000-0653-0000-0000-000000000002') <> 1 then
    raise exception 'TEST 0556: cambió el número de versiones del tenant 2';
  end if;
  if (select vigente_desde from public.nomina_payroll_rules
       where tenant_id = '10000000-0653-0000-0000-000000000001' and version = 3) <> date '2026-12-01' then
    raise exception 'TEST 0556: la versión nueva no guardó vigente_desde';
  end if;
end;
$despues_admin$;

-- ── (7) nomina_guardar_reglas: atómica, hereda la moneda y respeta la RLS ────
do $guardar$
declare
  v_base jsonb := jsonb_build_object(
    'pay_frequency', 'mensual', 'day_method', '30', 'min_salary', 130, 'cestaticket', 40, 'bono_guerra', 200,
    'sso_pct', 4, 'rpe_pct', 0.5, 'faov_pct', 1, 'sso_cap_sm', 5, 'rpe_cap_sm', 10,
    'overtime_pct', 50, 'night_pct', 30, 'holiday_pct', 50,
    'utilidades_days', 30, 'bono_vacacional_days', 15, 'vacaciones_days', 15,
    'salarial_bonuses', '[]'::jsonb);
  v_t1 constant uuid := '10000000-0653-0000-0000-000000000001';
  v_t2 constant uuid := '20000000-0653-0000-0000-000000000002';
  v_hoy date := (now() at time zone 'America/Caracas')::date;
  v_vigente uuid;
  v_versiones int;
  v_id uuid;
  v_malo jsonb;
  v_caso text;
begin
  -- La vigente del tenant 1 (versión 3, la del bloque anterior) con el bono en USD y el cestaticket en Bs.
  update public.nomina_payroll_rules set bono_guerra_moneda = 'USD', cestaticket_moneda = 'VES'
   where tenant_id = v_t1 and status = 'vigente';
  select id into v_vigente from public.nomina_payroll_rules where tenant_id = v_t1 and status = 'vigente';
  select count(*) into v_versiones from public.nomina_payroll_rules where tenant_id = v_t1;

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', 'aaaaaaaa-0653-0000-0000-000000000001', true);

  -- Fallos a mitad: cada uno revierte el archivado y deja la vigente intacta.
  foreach v_caso in array array[
    'pension', 'desborde', 'falta-dato', 'fecha-futura', 'no-objeto', 'moneda',
    'fecha-epoch', 'fecha-menos-infinito', 'fecha-infinito', 'fecha-today', 'fecha-sin-ceros', 'fecha-compacta',
    'fecha-numero', 'fecha-vacia', 'fecha-anterior-a-2000', 'fecha-inexistente'
  ] loop
    v_malo := case v_caso
      when 'pension'      then v_base || jsonb_build_object('pension_contrib_pct', 20)
      when 'desborde'     then v_base || jsonb_build_object('ingreso_minimo_integral_usd', 1000000000000000)
      when 'falta-dato'   then v_base - 'min_salary'
      when 'fecha-futura' then v_base || jsonb_build_object('vigente_desde', (v_hoy + 1)::text)
      when 'no-objeto'    then '[1,2]'::jsonb
      when 'moneda'       then v_base || jsonb_build_object('cestaticket_moneda', 'EUR')
      -- B2: solo AAAA-MM-DD, desde 2000-01-01; el cast a date aceptaría muchas otras cosas.
      when 'fecha-epoch'           then v_base || jsonb_build_object('vigente_desde', 'epoch')
      when 'fecha-menos-infinito'  then v_base || jsonb_build_object('vigente_desde', '-infinity')
      when 'fecha-infinito'        then v_base || jsonb_build_object('vigente_desde', 'infinity')
      when 'fecha-today'           then v_base || jsonb_build_object('vigente_desde', 'today')
      when 'fecha-sin-ceros'       then v_base || jsonb_build_object('vigente_desde', '2026-1-5')
      when 'fecha-compacta'        then v_base || jsonb_build_object('vigente_desde', '20260105')
      when 'fecha-numero'          then v_base || jsonb_build_object('vigente_desde', 20260105)
      when 'fecha-vacia'           then v_base || jsonb_build_object('vigente_desde', '')
      when 'fecha-anterior-a-2000' then v_base || jsonb_build_object('vigente_desde', '1999-12-31')
      when 'fecha-inexistente'     then v_base || jsonb_build_object('vigente_desde', '2026-02-31')
    end;
    begin
      perform public.nomina_guardar_reglas(v_malo);
      raise exception 'TEST 0556: nomina_guardar_reglas aceptó el caso «%»', v_caso;
    exception
      when check_violation or numeric_value_out_of_range or not_null_violation or invalid_parameter_value
        or datetime_field_overflow then null;
    end;
    if (select id from public.nomina_payroll_rules where tenant_id = v_t1 and status = 'vigente') is distinct from v_vigente then
      raise exception 'TEST 0556: el caso «%» dejó al tenant sin su versión vigente', v_caso;
    end if;
    if (select count(*) from public.nomina_payroll_rules where tenant_id = v_t1) <> v_versiones then
      raise exception 'TEST 0556: el caso «%» dejó una versión a medias', v_caso;
    end if;
  end loop;

  -- Un guardado bueno: archiva la vigente, inserta la siguiente, la fecha es hoy en Caracas y las monedas se heredan.
  v_id := public.nomina_guardar_reglas(
    v_base || jsonb_build_object('tenant_id', v_t2, 'fuente_legal', '  Decreto de prueba  ', 'sso_patronal_pct', 9));
  if (select status from public.nomina_payroll_rules where id = v_vigente) <> 'archivada' then
    raise exception 'TEST 0556: el guardado no archivó la versión vigente';
  end if;
  if not exists (select 1 from public.nomina_payroll_rules
                  where id = v_id and tenant_id = v_t1 and status = 'vigente' and version = 4
                    and vigente_desde = v_hoy and fuente_legal = 'Decreto de prueba'
                    and sso_patronal_pct = 9 and rpe_patronal_pct is null and pension_contrib_pct is null
                    and bono_guerra_moneda = 'USD' and cestaticket_moneda = 'VES'
                    and created_by = 'aaaaaaaa-0653-0000-0000-000000000001') then
    raise exception 'TEST 0556: la versión guardada no tiene la forma esperada (o tomó el tenant del payload)';
  end if;
  -- Con moneda explícita manda la explícita; una fecha pasada vale.
  v_id := public.nomina_guardar_reglas(
    v_base || jsonb_build_object('cestaticket_moneda', 'USD', 'vigente_desde', '2026-01-15'));
  if not exists (select 1 from public.nomina_payroll_rules
                  where id = v_id and cestaticket_moneda = 'USD' and bono_guerra_moneda = 'USD'
                    and vigente_desde = date '2026-01-15' and version = 5) then
    raise exception 'TEST 0556: la moneda explícita o la fecha pasada no se respetaron';
  end if;
  -- Los límites de la fecha valen: el piso (2000-01-01), hoy en Caracas y un null explícito (= hoy).
  v_id := public.nomina_guardar_reglas(v_base || jsonb_build_object('vigente_desde', '2000-01-01'));
  if not exists (select 1 from public.nomina_payroll_rules where id = v_id and vigente_desde = date '2000-01-01' and version = 6) then
    raise exception 'TEST 0556: la fecha piso 2000-01-01 no se aceptó';
  end if;
  v_id := public.nomina_guardar_reglas(v_base || jsonb_build_object('vigente_desde', v_hoy::text));
  if not exists (select 1 from public.nomina_payroll_rules where id = v_id and vigente_desde = v_hoy and version = 7) then
    raise exception 'TEST 0556: la fecha de hoy en Caracas no se aceptó';
  end if;
  v_id := public.nomina_guardar_reglas(v_base || '{"vigente_desde": null}'::jsonb);
  if not exists (select 1 from public.nomina_payroll_rules where id = v_id and vigente_desde = v_hoy and version = 8) then
    raise exception 'TEST 0556: un vigente_desde null no quedó en hoy';
  end if;
  if (select count(*) from public.nomina_payroll_rules where tenant_id = v_t1 and status = 'vigente') <> 1 then
    raise exception 'TEST 0556: el tenant 1 no quedó con exactamente una versión vigente';
  end if;
  reset role;

  -- Cada tenant toca solo lo suyo: el contador del tenant 2 guarda su versión 2 y el tenant 1 no se mueve.
  select count(*) into v_versiones from public.nomina_payroll_rules where tenant_id = v_t1;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', 'bbbbbbbb-0653-0000-0000-000000000001', true);
  v_id := public.nomina_guardar_reglas(v_base);
  reset role;
  if not exists (select 1 from public.nomina_payroll_rules where id = v_id and tenant_id = v_t2 and version = 2) then
    raise exception 'TEST 0556: el contador del tenant 2 no guardó la versión 2 de su tenant';
  end if;
  if (select count(*) from public.nomina_payroll_rules where tenant_id = v_t1) <> v_versiones then
    raise exception 'TEST 0556: el guardado del tenant 2 movió el tenant 1';
  end if;
end;
$guardar$;

-- Sin acceso a la función: operador, admin deshabilitado, sin membership y anon.
-- B5: la comprobación EXPLÍCITA de la función (tenant y nomina_can_access()) se prueba por sí sola: el rechazo
-- tiene que ser el de la función («sin acceso a las reglas de nómina», 42501) y no el que daría la RLS al insertar
-- («new row violates row-level security policy», también 42501) ni un NOT NULL por un tenant vacío.
do $guardar_sin_acceso$
declare
  v_sub text;
  v_antes int;
  v_msg text;
begin
  select count(*) into v_antes from public.nomina_payroll_rules;
  foreach v_sub in array array[
    'aaaaaaaa-0653-0000-0000-000000000002',
    'aaaaaaaa-0653-0000-0000-000000000003',
    'cccccccc-0653-0000-0000-000000000009'
  ] loop
    begin
      set local role authenticated;
      perform set_config('request.jwt.claim.sub', v_sub, true);
      perform public.nomina_guardar_reglas('{"pay_frequency":"mensual"}'::jsonb);
      raise exception 'TEST 0556: % ejecutó nomina_guardar_reglas', v_sub;
    exception when insufficient_privilege then
      get stacked diagnostics v_msg = message_text;
      if v_msg <> 'sin acceso a las reglas de nómina' then
        raise exception 'TEST 0556: % fue rechazado por otra cosa que la comprobación de la función: %', v_sub, v_msg;
      end if;
    end;
    reset role;
  end loop;
  begin
    set local role anon;
    perform public.nomina_guardar_reglas('{}'::jsonb);
    raise exception 'TEST 0556: anon ejecutó nomina_guardar_reglas';
  exception when insufficient_privilege then null;
  end;
  reset role;
  if (select count(*) from public.nomina_payroll_rules) <> v_antes then
    raise exception 'TEST 0556: un llamador sin acceso cambió las versiones';
  end if;
end;
$guardar_sin_acceso$;

-- Sin acceso: operador, admin deshabilitado, sin membership y anon.
do $sin_acceso$
declare
  v_sub text;
  v_n int;
begin
  foreach v_sub in array array[
    'aaaaaaaa-0653-0000-0000-000000000002',  -- operador: rol sin acceso a nómina
    'aaaaaaaa-0653-0000-0000-000000000003',  -- admin deshabilitado
    'cccccccc-0653-0000-0000-000000000009'   -- sin membership
  ] loop
    begin
      set local role authenticated;
      perform set_config('request.jwt.claim.sub', v_sub, true);
      select count(*) into v_n from public.nomina_payroll_rules;
      if v_n <> 0 then raise exception 'TEST 0556: % ve % versiones de reglas', v_sub, v_n; end if;
      begin
        insert into public.nomina_payroll_rules (tenant_id, version, status)
        values ('10000000-0653-0000-0000-000000000001', 50, 'archivada');
        raise exception 'TEST 0556: % insertó una versión de reglas', v_sub;
      exception when insufficient_privilege then null;
      end;
      reset role;
    end;
  end loop;

  -- El contador del tenant 2 ve la suya y no las del tenant 1.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', 'bbbbbbbb-0653-0000-0000-000000000001', true);
  select count(*) into v_n from public.nomina_payroll_rules where tenant_id = '10000000-0653-0000-0000-000000000001';
  if v_n <> 0 then raise exception 'TEST 0556: el contador del tenant 2 ve versiones del tenant 1'; end if;
  select count(*) into v_n from public.nomina_payroll_rules;
  -- Sus dos versiones (la de arranque, archivada por el guardado, y la nueva) y ninguna del tenant 1.
  if v_n <> 2 then raise exception 'TEST 0556: el contador del tenant 2 no ve exactamente sus dos versiones'; end if;
  reset role;

  -- anon: ni leer ni escribir (la tabla nunca se le concedió).
  begin
    set local role anon;
    perform 1 from public.nomina_payroll_rules limit 1;
    raise exception 'TEST 0556: anon leyó nomina_payroll_rules';
  exception when insufficient_privilege then null;
  end;
  reset role;
end;
$sin_acceso$;

rollback;
select to_regclass('public.nomina_payroll_rules') is null as nomina_0556_fixture_rolled_back;
