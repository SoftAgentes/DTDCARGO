-- ─────────────────────────────────────────────────────────────────────────────
-- 0556 · SDD-0653 fase A2b — Reglas de nómina con vigencia, fuente legal, monedas
-- explícitas, aportes patronales y escalas por antigüedad.
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
--    como en la fase A2a: lee y guarda solo las columnas de la 0162 y la 0179, y
--    el formulario avisa que los campos nuevos esperan la 0556
--    (lib/studio/nomina/payroll-rules-queries.ts).
--
-- ── Qué agrega a nomina_payroll_rules (todo aditivo, ninguna fila se toca) ───
-- · vigente_desde date NULL (default current_date para las filas NUEVAS) y
--   fuente_legal text NULL: «desde cuándo rige esta versión de las reglas» y «qué
--   norma la respalda». Las versiones que ya existen quedan con vigente_desde
--   NULL = «sin fecha de vigencia registrada»: no se inventa la fecha en que se
--   aplicó la migración y no hay UPDATE. (La spec 0653 §5 decía NOT NULL; con
--   filas existentes eso obligaba a rellenarlas con la fecha de aplicación.)
-- · ingreso_minimo_integral_usd numeric(14,2) NOT NULL default 0, en USD (D4).
-- · cestaticket_moneda y bono_guerra_moneda ('VES'|'USD', default 'VES'): las
--   filas existentes siguen leyéndose como Bs, sin reinterpretar nada. El contador
--   corrige el monto y la moneda al crear la versión nueva (D4).
-- · Aportes del patrono (D5), en % y solo como configuración para el costo de la
--   nómina; no se descuentan al trabajador: sso_patronal_pct (9), rpe_patronal_pct
--   (2), faov_patronal_pct (2), inces_patronal_pct (2), inces_utilidades_pct (0,5)
--   y pension_contrib_pct (9, tope legal 15). Los defaults son la norma conocida,
--   marcada «por confirmar» en lib/studio/nomina/ley/parametros.ts: lo confirma el
--   contador antes de usarlos (D8).
-- · Escalas por antigüedad (D10): vacaciones_extra_max (15, LOTTT Art. 190) y
--   bono_vacacional_max_days (30, Art. 192).
-- · CHECK utilidades_days entre 30 y 120 (LOTTT Art. 131).
--
-- ── Qué NO toca ─────────────────────────────────────────────────────────────
-- Ninguna fila (sin UPDATE ni backfill), la RLS (la policy «nomina_payroll_rules
-- by tenant and role» sigue igual y hereda nomina_can_access()), los grants, los
-- triggers, el índice de una sola versión vigente por tenant ni los cortes de
-- nómina (cada uno conserva su rules_snapshot). El motor de cálculo no lee estas
-- columnas: solo se guardan y se muestran.
--
-- ── Locks ───────────────────────────────────────────────────────────────────
-- ALTER TABLE sobre nomina_payroll_rules: ACCESS EXCLUSIVE breve (tabla chica: una
-- versión vigente y su historial por tenant). Todos los defaults son constantes o
-- current_date (estable, se evalúa una vez), así que no hay reescritura. El CHECK
-- de utilidades valida la tabla entera dentro del mismo lock. lock_timeout 5 s,
-- statement_timeout 30 s.
--
-- ── Idempotencia ────────────────────────────────────────────────────────────
-- ADD COLUMN IF NOT EXISTS y constraints con guarda: reaplicar no falla ni duplica.
-- El postflight comprueba la forma de cada columna y de cada CHECK, y que la RLS y
-- los grants quedaron intactos.
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

  -- Las columnas de la 0162 y la 0179 que esta migración consulta o respalda.
  foreach v_req in array array[
    'id', 'tenant_id', 'version', 'status', 'deleted_at',
    'min_salary', 'cestaticket', 'bono_guerra', 'utilidades_days',
    'vacaciones_days', 'bono_vacacional_days'
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
alter table public.nomina_payroll_rules
  add column if not exists vigente_desde               date,
  add column if not exists fuente_legal                text,
  add column if not exists ingreso_minimo_integral_usd numeric(14,2) not null default 0,
  add column if not exists cestaticket_moneda          text not null default 'VES',
  add column if not exists bono_guerra_moneda          text not null default 'VES',
  add column if not exists sso_patronal_pct            numeric(5,2) not null default 9,
  add column if not exists rpe_patronal_pct            numeric(5,2) not null default 2,
  add column if not exists faov_patronal_pct           numeric(5,2) not null default 2,
  add column if not exists inces_patronal_pct          numeric(5,2) not null default 2,
  add column if not exists inces_utilidades_pct        numeric(5,2) not null default 0.5,
  add column if not exists pension_contrib_pct         numeric(5,2) not null default 9,
  add column if not exists vacaciones_extra_max        int not null default 15,
  add column if not exists bono_vacacional_max_days    int not null default 30;

-- Solo las versiones NUEVAS nacen con la fecha de hoy; las existentes quedan en NULL.
alter table public.nomina_payroll_rules
  alter column vigente_desde set default current_date;

-- ── 2. Restricciones (con guarda: reaplicar no falla) ────────────────────────
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
      ('nomina_payroll_rules_aportes_patronales_rango',
       'check (sso_patronal_pct between 0 and 100 and rpe_patronal_pct between 0 and 100 '
       || 'and faov_patronal_pct between 0 and 100 and inces_patronal_pct between 0 and 100 '
       || 'and inces_utilidades_pct between 0 and 100)'),
      -- Tope legal de la contribución de pensiones: 15 % (Ley de Protección de las Pensiones, Art. 9).
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

-- ── 3. Comentarios ───────────────────────────────────────────────────────────
comment on column public.nomina_payroll_rules.vigente_desde is
  'SDD-0653 · 0556: desde cuándo rige esta versión de las reglas (AAAA-MM-DD). NULL = versión anterior a la 0556, sin fecha de vigencia registrada. Cada cambio legal es una versión nueva (D2); los cortes viejos conservan su rules_snapshot.';
comment on column public.nomina_payroll_rules.fuente_legal is
  'SDD-0653 · 0556: la norma que respalda esta versión, texto corto («G.O. 6.691 Ext., Decreto 4.653»). Sin datos de personas.';
comment on column public.nomina_payroll_rules.ingreso_minimo_integral_usd is
  'SDD-0653 · 0556: ingreso mínimo integral en USD indexado a la tasa BCV (D4). Base mínima por trabajador de la contribución de pensiones. numeric → llega a TS como string, coercer con num().';
comment on column public.nomina_payroll_rules.cestaticket_moneda is
  'SDD-0653 · 0556: moneda del monto de cestaticket (VES | USD). Las versiones anteriores a la 0556 quedan en VES: no se reinterpretan (D4).';
comment on column public.nomina_payroll_rules.bono_guerra_moneda is
  'SDD-0653 · 0556: moneda del monto del bono de guerra (VES | USD). Las versiones anteriores a la 0556 quedan en VES (D4).';
comment on column public.nomina_payroll_rules.sso_patronal_pct is
  'SDD-0653 · 0556 (D5): aporte del patrono al IVSS, en %: 9, 10 u 11 según el riesgo de la empresa. Config para el costo de la nómina; no se descuenta al trabajador. Por confirmar con el contador (D8).';
comment on column public.nomina_payroll_rules.rpe_patronal_pct is
  'SDD-0653 · 0556 (D5): aporte del patrono al Régimen Prestacional de Empleo, en % (2). Por confirmar (D8).';
comment on column public.nomina_payroll_rules.faov_patronal_pct is
  'SDD-0653 · 0556 (D5): aporte del patrono al FAOV, en % (2). Por confirmar (D8).';
comment on column public.nomina_payroll_rules.inces_patronal_pct is
  'SDD-0653 · 0556 (D5): aporte del patrono al INCES, en % del salario normal (2, con 5 o más trabajadores). Por confirmar (D8).';
comment on column public.nomina_payroll_rules.inces_utilidades_pct is
  'SDD-0653 · 0556 (D5): retención del INCES sobre las utilidades anuales, en % (0,5); la retiene el patrono. Por confirmar (D8).';
comment on column public.nomina_payroll_rules.pension_contrib_pct is
  'SDD-0653 · 0556 (D5): contribución especial para las pensiones, en % de lo pagado a los trabajadores (9; tope legal 15). Decreto 4.952, G.O. 42.880.';
comment on column public.nomina_payroll_rules.vacaciones_extra_max is
  'SDD-0653 · 0556 (D10): días adicionales máximos de vacaciones por antigüedad, 1 por año de servicio (15; LOTTT Art. 190).';
comment on column public.nomina_payroll_rules.bono_vacacional_max_days is
  'SDD-0653 · 0556 (D10): máximo de días de bono vacacional con la antigüedad, 15 + 1 por año (30; LOTTT Art. 192).';

-- ── 4. Postflight: la forma de lo creado y lo que no se tocó ─────────────────
do $postflight$
declare
  v record;
begin
  for v in
    select * from (values
      ('vigente_desde',               'date',    'YES'),
      ('fuente_legal',                'text',    'YES'),
      ('ingreso_minimo_integral_usd', 'numeric', 'NO'),
      ('cestaticket_moneda',          'text',    'NO'),
      ('bono_guerra_moneda',          'text',    'NO'),
      ('sso_patronal_pct',            'numeric', 'NO'),
      ('rpe_patronal_pct',            'numeric', 'NO'),
      ('faov_patronal_pct',           'numeric', 'NO'),
      ('inces_patronal_pct',          'numeric', 'NO'),
      ('inces_utilidades_pct',        'numeric', 'NO'),
      ('pension_contrib_pct',         'numeric', 'NO'),
      ('vacaciones_extra_max',        'integer', 'NO'),
      ('bono_vacacional_max_days',    'integer', 'NO')
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
                         'nomina_payroll_rules_aportes_patronales_rango', 'nomina_payroll_rules_pension_contrib_tope',
                         'nomina_payroll_rules_escalas_no_negativas', 'nomina_payroll_rules_utilidades_rango')) <> 8 then
    raise exception '0556 postflight: faltan restricciones CHECK de nomina_payroll_rules';
  end if;

  -- La RLS y los grants quedaron como en la 0162.
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
