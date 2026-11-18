-- ─────────────────────────────────────────────────────────────────────────────
-- 0556 · SDD-0653 fase A2b — Reglas de nómina con vigencia, fuente legal, monedas
-- explícitas, aportes del patrono, retención del INCES, escalas por antigüedad y
-- guardado atómico de una versión nueva.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicarla exige el
--    OK nominal de Sam NOMBRANDO este archivo, el runbook
--    docs/runbooks/aplicar-migraciones-prod.md y el Director General, de a una,
--    con el name exacto `0556_nomina_reglas_vigencia_y_aportes`. Fusionar la PR
--    NO autoriza aplicarla. Aplicarla NO carga valores legales nuevos: eso es la
--    fase A4 (otra versión de las reglas, con el visto bueno del contador).
--    ORDEN: indistinto. Con la app de antes y la migración aplicada no cambia
--    nada visible. Con la app nueva y sin la migración, la pestaña Reglas sigue
--    como en la fase A2a: lee y guarda las columnas de la 0162 (y las que ya
--    leía), y el formulario avisa que los campos nuevos esperan la 0556
--    (lib/studio/nomina/payroll-rules-queries.ts).
--
-- ── Qué agrega a nomina_payroll_rules (todo aditivo, ninguna fila se toca) ───
-- · vigente_desde date NULL y fuente_legal text NULL: «desde cuándo rige esta
--   versión de las reglas» y «qué norma la respalda». Es INFORMATIVA: el corte de
--   nómina toma siempre la versión vigente (status = 'vigente'), no elige versión
--   por esta fecha. Las filas NUEVAS nacen con la fecha de HOY EN CARACAS (no
--   current_date, que sigue la zona horaria de la sesión); las que ya existen
--   quedan en NULL = «sin fecha de vigencia registrada»: no se inventa la fecha en
--   que se aplicó la migración y no hay UPDATE. (La spec 0653 §5 decía NOT NULL.)
-- · cestaticket_moneda y bono_guerra_moneda ('VES'|'USD', NOT NULL default 'VES'):
--   las filas existentes siguen leyéndose como Bs, sin reinterpretar nada. Si una
--   versión nueva no trae la moneda, hereda la de la vigente (D4).
-- · Todo lo que SE CONFIGURA y antes no existía queda NULLABLE y SIN DEFAULT: las
--   versiones existentes quedan en NULL = «sin configurar» y la pantalla no las
--   cuenta como cumplidas. No se inventan valores: ingreso_minimo_integral_usd (USD,
--   D4); los aportes del PATRONO (D5) sso_patronal_pct, rpe_patronal_pct,
--   faov_patronal_pct e inces_patronal_pct; la contribución especial para las
--   pensiones pension_contrib_pct (tope legal 15, Art. 7 de la Ley de Protección
--   de las Pensiones); y las escalas por antigüedad (D10) vacaciones_extra_max
--   (LOTTT Art. 190) y bono_vacacional_max_days (Art. 192). Son configuración para
--   el costo de la nómina; no se descuentan al trabajador. La pantalla muestra los
--   valores de la norma solo como placeholder (por confirmar, D8): no se guardan salvo
--   que quien edita pulse «Usar la propuesta».
-- · inces_utilidades_pct es una RETENCIÓN AL TRABAJADOR (el patrono retiene 0,5 %
--   de las utilidades anuales para el INCES), no un aporte del patrono; también
--   NULL = sin configurar.
-- · CHECK utilidades_days entre 30 y 120 (LOTTT Art. 131).
-- · nomina_guardar_reglas(jsonb): guarda una versión nueva ATÓMICAMENTE (archiva la
--   vigente e inserta la siguiente en una sola transacción). SECURITY INVOKER: corre
--   con la RLS de quien llama y comprueba además, de forma explícita, que haya tenant
--   y acceso a nómina. «vigente_desde» llega como AAAA-MM-DD, desde 2000-01-01 y no
--   posterior a hoy en Caracas. Si el insert falla (un CHECK, un desborde de numeric,
--   un dato mal formado) el archivado se deshace y el tenant conserva su versión
--   vigente. Sin esta función la app archiva y luego inserta en dos pasos y, si el
--   segundo falla, restaura la versión archivada.
--
-- ── Qué NO toca ─────────────────────────────────────────────────────────────
-- Ninguna fila (sin UPDATE ni backfill), la RLS (la policy «nomina_payroll_rules
-- by tenant and role» sigue igual y hereda nomina_can_access()), los grants de la
-- tabla, los triggers, el índice de una sola versión vigente por tenant ni los
-- cortes de nómina (cada uno conserva su rules_snapshot). El motor de cálculo y los
-- finiquitos no leen estas columnas: solo se guardan y se muestran.
--
-- ── Locks ───────────────────────────────────────────────────────────────────
-- ALTER TABLE sobre nomina_payroll_rules: ACCESS EXCLUSIVE breve (tabla chica: una
-- versión vigente y su historial por tenant). Las columnas nuevas nacen sin default
-- (NULL) o con una constante ('VES'), así que no hay reescritura. El default de
-- vigente_desde (hoy en Caracas) se agrega aparte, después de la columna: se evalúa
-- en CADA insert y NO rellena las filas que ya existen (quedan en NULL). El CHECK de
-- utilidades valida la tabla entera dentro del mismo lock.
-- lock_timeout 5 s, statement_timeout 30 s.
--
-- ── Idempotencia ────────────────────────────────────────────────────────────
-- ADD COLUMN IF NOT EXISTS, restricciones con guarda y CREATE OR REPLACE de la
-- función: reaplicar no falla ni duplica. El postflight comprueba la forma de cada
-- columna y de cada CHECK, la función, y que la RLS y los grants quedaron intactos.
--
-- ── Deshacer ────────────────────────────────────────────────────────────────
-- supabase/desarmes/0556_desarme.sql (sin número; usarlo exige OK nominal de Sam).
-- Pierde lo que se haya guardado en las columnas nuevas.
-- ─────────────────────────────────────────────────────────────────────────────
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
declare
  v_req text;
  v_malas bigint;
begin
  if pg_catalog.to_regclass('public.nomina_payroll_rules') is null then
    raise exception '0556 requiere public.nomina_payroll_rules (0162)';
  end if;
  if pg_catalog.to_regprocedure('public.nomina_can_access()') is null then
    raise exception '0556 requiere public.nomina_can_access() (0160)';
  end if;
  if pg_catalog.to_regprocedure('public.get_user_tenant_id()') is null then
    raise exception '0556 requiere public.get_user_tenant_id()';
  end if;

  -- Las columnas de la 0162 que esta migración consulta, respalda o inserta.
  foreach v_req in array array[
    'id', 'tenant_id', 'version', 'status', 'deleted_at', 'pay_frequency', 'day_method',
    'min_salary', 'cestaticket', 'bono_guerra', 'sso_pct', 'rpe_pct', 'faov_pct',
    'sso_cap_sm', 'rpe_cap_sm', 'overtime_pct', 'night_pct', 'holiday_pct',
    'utilidades_days', 'vacaciones_days', 'bono_vacacional_days', 'salarial_bonuses',
    'notes', 'created_by'
  ] loop
    if not exists (
      select 1 from pg_catalog.pg_attribute
      where attrelid = 'public.nomina_payroll_rules'::pg_catalog.regclass
        and attname = v_req and attnum > 0 and not attisdropped
    ) then
      raise exception '0556 requiere la columna nomina_payroll_rules.%', v_req;
    end if;
  end loop;

  -- La frontera de la tabla: RLS encendida y la policy de la 0162 (tenant Y rol).
  if not exists (
    select 1 from pg_catalog.pg_class
    where oid = 'public.nomina_payroll_rules'::pg_catalog.regclass and relrowsecurity
  ) then
    raise exception '0556 requiere RLS en nomina_payroll_rules';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_policy
    where polrelid = 'public.nomina_payroll_rules'::pg_catalog.regclass
      and polname = 'nomina_payroll_rules by tenant and role'
  ) then
    raise exception '0556 requiere la policy «nomina_payroll_rules by tenant and role» (0162)';
  end if;

  -- El CHECK de utilidades (30 a 120) no puede dejar filas fuera: se cuenta, no se lee.
  select pg_catalog.count(*) into v_malas
  from public.nomina_payroll_rules
  where utilidades_days < 30 or utilidades_days > 120;
  if v_malas > 0 then
    raise exception '0556 abortada: % versión(es) de reglas con utilidades_days fuera de 30 a 120; el contador las corrige antes', v_malas;
  end if;
end
$preflight$;

-- ── 1. Columnas nuevas ───────────────────────────────────────────────────────
-- Sin default ni NOT NULL en lo que se configura: una versión que ya existe queda «sin configurar».
alter table public.nomina_payroll_rules
  add column if not exists vigente_desde               date,
  add column if not exists fuente_legal                text,
  add column if not exists ingreso_minimo_integral_usd numeric(14,2),
  add column if not exists cestaticket_moneda          text not null default 'VES',
  add column if not exists bono_guerra_moneda          text not null default 'VES',
  add column if not exists sso_patronal_pct            numeric(5,2),
  add column if not exists rpe_patronal_pct            numeric(5,2),
  add column if not exists faov_patronal_pct           numeric(5,2),
  add column if not exists inces_patronal_pct          numeric(5,2),
  add column if not exists inces_utilidades_pct        numeric(5,2),
  add column if not exists pension_contrib_pct         numeric(5,2),
  add column if not exists vacaciones_extra_max        int,
  add column if not exists bono_vacacional_max_days    int;

-- Solo las versiones NUEVAS nacen con la fecha de HOY EN CARACAS; las existentes quedan en NULL.
alter table public.nomina_payroll_rules
  alter column vigente_desde set default ((pg_catalog.now() at time zone 'America/Caracas')::date);

-- ── 2. Restricciones (con guarda: reaplicar no falla) ────────────────────────
-- Un NULL pasa todos los CHECK: «sin configurar» no es un valor fuera de rango.
do $checks$
declare
  v record;
begin
  for v in
    select * from (values
      ('nomina_payroll_rules_fuente_legal_corta',
       'check (fuente_legal is null or char_length(btrim(fuente_legal)) between 1 and 200)'),
      ('nomina_payroll_rules_imi_no_negativo',
       'check (ingreso_minimo_integral_usd >= 0)'),
      ('nomina_payroll_rules_cestaticket_moneda',
       'check (cestaticket_moneda in (''VES'', ''USD''))'),
      ('nomina_payroll_rules_bono_guerra_moneda',
       'check (bono_guerra_moneda in (''VES'', ''USD''))'),
      -- Aportes del patrono y retención del INCES sobre utilidades.
      ('nomina_payroll_rules_porcentajes_rango',
       'check (sso_patronal_pct between 0 and 100 and rpe_patronal_pct between 0 and 100 '
       || 'and faov_patronal_pct between 0 and 100 and inces_patronal_pct between 0 and 100 '
       || 'and inces_utilidades_pct between 0 and 100)'),
      -- Tope legal de la contribución de pensiones: 15 % (Ley de Protección de las Pensiones, Art. 7).
      ('nomina_payroll_rules_pension_contrib_tope',
       'check (pension_contrib_pct between 0 and 15)'),
      ('nomina_payroll_rules_escalas_no_negativas',
       'check (vacaciones_extra_max between 0 and 365 and bono_vacacional_max_days between 0 and 365)'),
      -- LOTTT Art. 131: mínimo 30 y máximo 120 días de utilidades.
      ('nomina_payroll_rules_utilidades_rango',
       'check (utilidades_days between 30 and 120)')
    ) as t(nombre, def)
  loop
    if not exists (
      select 1 from pg_catalog.pg_constraint
      where conrelid = 'public.nomina_payroll_rules'::pg_catalog.regclass and conname = v.nombre
    ) then
      execute pg_catalog.format('alter table public.nomina_payroll_rules add constraint %I %s', v.nombre, v.def);
    end if;
  end loop;
end
$checks$;

-- ── 3. Guardar una versión nueva, atómicamente ───────────────────────────────
create or replace function public.nomina_guardar_reglas(p_datos jsonb)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $function$
declare
  v_tenant uuid := public.get_user_tenant_id();
  v_prev   public.nomina_payroll_rules%rowtype;
  v_hoy    date := (pg_catalog.now() at time zone 'America/Caracas')::date;
  v_desde  date;
  v_id     uuid;
begin
  if v_tenant is null or not public.nomina_can_access() then
    raise exception 'sin acceso a las reglas de nómina' using errcode = '42501';
  end if;
  if p_datos is null or pg_catalog.jsonb_typeof(p_datos) <> 'object' then
    raise exception 'datos de reglas no válidos' using errcode = '22023';
  end if;

  -- «Rige desde» es informativa: llega como AAAA-MM-DD (nada de 'epoch', '-infinity', 'today' ni otros
  -- formatos que el cast a date aceptaría), desde 2000-01-01 y no posterior a hoy en Caracas.
  if p_datos ? 'vigente_desde' and pg_catalog.jsonb_typeof(p_datos -> 'vigente_desde') <> 'null' then
    if pg_catalog.jsonb_typeof(p_datos -> 'vigente_desde') <> 'string'
       or (p_datos ->> 'vigente_desde') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'la fecha de vigencia debe ser AAAA-MM-DD' using errcode = '22023';
    end if;
    v_desde := (p_datos ->> 'vigente_desde')::date;
    if v_desde < date '2000-01-01' then
      raise exception 'la fecha de vigencia no puede ser anterior a 2000-01-01' using errcode = '22023';
    end if;
    if v_desde > v_hoy then
      raise exception 'la fecha de vigencia no puede ser posterior a hoy' using errcode = '22023';
    end if;
  end if;

  -- La versión vigente del tenant, bloqueada; la RLS la limita a su tenant.
  select * into v_prev
    from public.nomina_payroll_rules r
   where r.tenant_id = v_tenant and r.status = 'vigente' and r.deleted_at is null
     for update;

  if found then
    update public.nomina_payroll_rules set status = 'archivada' where id = v_prev.id;
  end if;

  insert into public.nomina_payroll_rules (
    tenant_id, version, status, pay_frequency, day_method,
    min_salary, cestaticket, bono_guerra, sso_pct, rpe_pct, faov_pct, sso_cap_sm, rpe_cap_sm,
    overtime_pct, night_pct, holiday_pct, utilidades_days, bono_vacacional_days, vacaciones_days,
    salarial_bonuses, notes, created_by,
    vigente_desde, fuente_legal, ingreso_minimo_integral_usd, cestaticket_moneda, bono_guerra_moneda,
    sso_patronal_pct, rpe_patronal_pct, faov_patronal_pct, inces_patronal_pct, inces_utilidades_pct,
    pension_contrib_pct, vacaciones_extra_max, bono_vacacional_max_days
  ) values (
    v_tenant, coalesce(v_prev.version, 0) + 1, 'vigente',
    p_datos ->> 'pay_frequency', p_datos ->> 'day_method',
    (p_datos ->> 'min_salary')::numeric, (p_datos ->> 'cestaticket')::numeric, (p_datos ->> 'bono_guerra')::numeric,
    (p_datos ->> 'sso_pct')::numeric, (p_datos ->> 'rpe_pct')::numeric, (p_datos ->> 'faov_pct')::numeric,
    (p_datos ->> 'sso_cap_sm')::numeric, (p_datos ->> 'rpe_cap_sm')::numeric,
    (p_datos ->> 'overtime_pct')::numeric, (p_datos ->> 'night_pct')::numeric, (p_datos ->> 'holiday_pct')::numeric,
    (p_datos ->> 'utilidades_days')::int, (p_datos ->> 'bono_vacacional_days')::int, (p_datos ->> 'vacaciones_days')::int,
    coalesce(p_datos -> 'salarial_bonuses', '[]'::jsonb), nullif(pg_catalog.btrim(p_datos ->> 'notes'), ''),
    (select auth.uid()),
    coalesce(v_desde, v_hoy), nullif(pg_catalog.btrim(p_datos ->> 'fuente_legal'), ''),
    (p_datos ->> 'ingreso_minimo_integral_usd')::numeric,
    -- Una moneda que no llega se hereda de la versión vigente; nunca se impone USD.
    coalesce(p_datos ->> 'cestaticket_moneda', v_prev.cestaticket_moneda, 'VES'),
    coalesce(p_datos ->> 'bono_guerra_moneda', v_prev.bono_guerra_moneda, 'VES'),
    (p_datos ->> 'sso_patronal_pct')::numeric, (p_datos ->> 'rpe_patronal_pct')::numeric,
    (p_datos ->> 'faov_patronal_pct')::numeric, (p_datos ->> 'inces_patronal_pct')::numeric,
    (p_datos ->> 'inces_utilidades_pct')::numeric, (p_datos ->> 'pension_contrib_pct')::numeric,
    (p_datos ->> 'vacaciones_extra_max')::int, (p_datos ->> 'bono_vacacional_max_days')::int
  )
  returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function public.nomina_guardar_reglas(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.nomina_guardar_reglas(jsonb) to authenticated;

-- ── 4. Comentarios ───────────────────────────────────────────────────────────
comment on function public.nomina_guardar_reglas(jsonb) is
  'SDD-0653 · 0556: guarda una versión nueva de las reglas del tenant del caller en UNA transacción (archiva la vigente e inserta la siguiente; si el insert falla, el archivado se deshace). SECURITY INVOKER: la RLS de nomina_payroll_rules y nomina_can_access() mandan. Una moneda que no llega se hereda de la versión vigente; vigente_desde llega como AAAA-MM-DD, desde 2000-01-01 y no posterior a hoy en Caracas; si no llega, es hoy en Caracas. Devuelve el id de la versión nueva.';
comment on column public.nomina_payroll_rules.vigente_desde is
  'SDD-0653 · 0556: desde cuándo rige esta versión de las reglas (AAAA-MM-DD, informativa: el corte usa siempre la versión vigente). Default: hoy en Caracas. NULL = versión anterior a la 0556, sin fecha de vigencia registrada. Cada cambio legal es una versión nueva (D2); los cortes viejos conservan su rules_snapshot.';
comment on column public.nomina_payroll_rules.fuente_legal is
  'SDD-0653 · 0556: la norma que respalda esta versión, texto corto («G.O. 6.691 Ext., Decreto 4.653»). Sin datos de personas.';
comment on column public.nomina_payroll_rules.ingreso_minimo_integral_usd is
  'SDD-0653 · 0556: ingreso mínimo integral en USD indexado a la tasa BCV (D4). NULL = sin configurar. Base mínima por trabajador de la contribución de pensiones. numeric → llega a TS como string, coercer con num().';
comment on column public.nomina_payroll_rules.cestaticket_moneda is
  'SDD-0653 · 0556: moneda del monto de cestaticket (VES | USD). Las versiones anteriores a la 0556 quedan en VES: no se reinterpretan (D4). Una versión nueva sin moneda hereda la de la vigente.';
comment on column public.nomina_payroll_rules.bono_guerra_moneda is
  'SDD-0653 · 0556: moneda del monto del bono de guerra (VES | USD). Las versiones anteriores a la 0556 quedan en VES (D4). Una versión nueva sin moneda hereda la de la vigente.';
comment on column public.nomina_payroll_rules.sso_patronal_pct is
  'SDD-0653 · 0556 (D5): aporte del patrono al IVSS, en %: 9, 10 u 11 según el riesgo de la empresa. NULL = sin configurar. Config para el costo de la nómina; no se descuenta al trabajador. Por confirmar con el contador (D8).';
comment on column public.nomina_payroll_rules.rpe_patronal_pct is
  'SDD-0653 · 0556 (D5): aporte del patrono al Régimen Prestacional de Empleo, en % (2 según la norma conocida). NULL = sin configurar. Por confirmar (D8).';
comment on column public.nomina_payroll_rules.faov_patronal_pct is
  'SDD-0653 · 0556 (D5): aporte del patrono al FAOV, en % (2 según la norma conocida). NULL = sin configurar. Por confirmar (D8).';
comment on column public.nomina_payroll_rules.inces_patronal_pct is
  'SDD-0653 · 0556 (D5): aporte del patrono al INCES, en % del salario normal (2, con 5 o más trabajadores). NULL = sin configurar. Por confirmar (D8).';
comment on column public.nomina_payroll_rules.inces_utilidades_pct is
  'SDD-0653 · 0556: retención del INCES al TRABAJADOR sobre sus utilidades anuales, en % (0,5 según la norma conocida); la retiene el patrono. No es un aporte del patrono. NULL = sin configurar. Por confirmar (D8).';
comment on column public.nomina_payroll_rules.pension_contrib_pct is
  'SDD-0653 · 0556 (D5): contribución especial para las pensiones, en % de lo pagado a los trabajadores (9 según el Decreto 4.952, G.O. 42.880; tope legal 15, Art. 7 de la Ley de Protección de las Pensiones). NULL = sin configurar.';
comment on column public.nomina_payroll_rules.vacaciones_extra_max is
  'SDD-0653 · 0556 (D10): días adicionales máximos de vacaciones por antigüedad, 1 por año de servicio (15 según LOTTT Art. 190). NULL = sin configurar.';
comment on column public.nomina_payroll_rules.bono_vacacional_max_days is
  'SDD-0653 · 0556 (D10): máximo de días de bono vacacional con la antigüedad, 15 + 1 por año (30 según LOTTT Art. 192). NULL = sin configurar.';

-- ── 5. Postflight: la forma de lo creado y lo que no se tocó ─────────────────
do $postflight$
declare
  v record;
begin
  for v in
    select * from (values
      ('vigente_desde',               'date',    'YES'),
      ('fuente_legal',                'text',    'YES'),
      ('ingreso_minimo_integral_usd', 'numeric', 'YES'),
      ('cestaticket_moneda',          'text',    'NO'),
      ('bono_guerra_moneda',          'text',    'NO'),
      ('sso_patronal_pct',            'numeric', 'YES'),
      ('rpe_patronal_pct',            'numeric', 'YES'),
      ('faov_patronal_pct',           'numeric', 'YES'),
      ('inces_patronal_pct',          'numeric', 'YES'),
      ('inces_utilidades_pct',        'numeric', 'YES'),
      ('pension_contrib_pct',         'numeric', 'YES'),
      ('vacaciones_extra_max',        'integer', 'YES'),
      ('bono_vacacional_max_days',    'integer', 'YES')
    ) as t(col, tipo, nulo)
  loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'nomina_payroll_rules'
        and column_name = v.col and data_type = v.tipo and is_nullable = v.nulo
    ) then
      raise exception '0556 postflight: nomina_payroll_rules.% no tiene la forma esperada (% / null %)', v.col, v.tipo, v.nulo;
    end if;
  end loop;

  if (select pg_catalog.count(*) from pg_catalog.pg_constraint
       where conrelid = 'public.nomina_payroll_rules'::pg_catalog.regclass and contype = 'c'
         and conname in ('nomina_payroll_rules_fuente_legal_corta', 'nomina_payroll_rules_imi_no_negativo',
                         'nomina_payroll_rules_cestaticket_moneda', 'nomina_payroll_rules_bono_guerra_moneda',
                         'nomina_payroll_rules_porcentajes_rango', 'nomina_payroll_rules_pension_contrib_tope',
                         'nomina_payroll_rules_escalas_no_negativas', 'nomina_payroll_rules_utilidades_rango')) <> 8 then
    raise exception '0556 postflight: faltan restricciones CHECK de nomina_payroll_rules';
  end if;

  -- La función de guardado: invoker, search_path vacío y solo authenticated la ejecuta.
  if not exists (
    select 1 from pg_catalog.pg_proc
    where oid = pg_catalog.to_regprocedure('public.nomina_guardar_reglas(jsonb)')
      and not prosecdef and proconfig @> array['search_path=""']::text[]
  ) then
    raise exception '0556 postflight: nomina_guardar_reglas no es SECURITY INVOKER con search_path vacío';
  end if;
  if not pg_catalog.has_function_privilege('authenticated', 'public.nomina_guardar_reglas(jsonb)', 'EXECUTE')
     or pg_catalog.has_function_privilege('anon', 'public.nomina_guardar_reglas(jsonb)', 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', 'public.nomina_guardar_reglas(jsonb)', 'EXECUTE') then
    raise exception '0556 postflight: EXECUTE de nomina_guardar_reglas no es solo de authenticated';
  end if;

  -- La RLS y los grants de la tabla quedaron como en la 0162.
  if not exists (select 1 from pg_catalog.pg_class
                  where oid = 'public.nomina_payroll_rules'::pg_catalog.regclass and relrowsecurity)
     or (select pg_catalog.count(*) from pg_catalog.pg_policy
          where polrelid = 'public.nomina_payroll_rules'::pg_catalog.regclass) <> 1 then
    raise exception '0556 postflight: la RLS de nomina_payroll_rules cambió';
  end if;
  if pg_catalog.has_table_privilege('anon', 'public.nomina_payroll_rules', 'SELECT')
     or pg_catalog.has_table_privilege('anon', 'public.nomina_payroll_rules', 'INSERT') then
    raise exception '0556 postflight: anon tiene privilegios sobre nomina_payroll_rules';
  end if;
end
$postflight$;

notify pgrst, 'reload schema';
