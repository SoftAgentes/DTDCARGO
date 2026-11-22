-- SDD-0653 · Desarme de la 0556: quita de nomina_payroll_rules las columnas y restricciones que agregó.
-- ⚠️ NO ES UNA MIGRACIÓN TODAVÍA. Vive fuera de supabase/migrations/ y sin número, para que nada la
--    aplique ni la empaquete. Usarla exige OK nominal de Sam: se copia a supabase/migrations/ con el
--    siguiente número libre y se aplica con el runbook de producción.
-- Ensayo: supabase/tests/0556_nomina_reglas_vigencia_y_aportes.test.sql y
--   lib/studio/nomina/__tests__/nomina-0556.migration.test.ts.
--
-- QUITA la función nomina_guardar_reglas, las 8 restricciones CHECK y las 13 columnas de la 0556: vigente_desde, fuente_legal,
-- ingreso_minimo_integral_usd, cestaticket_moneda, bono_guerra_moneda, sso_patronal_pct,
-- rpe_patronal_pct, faov_patronal_pct, inces_patronal_pct, inces_utilidades_pct,
-- pension_contrib_pct, vacaciones_extra_max y bono_vacacional_max_days.
-- PIERDE lo que se haya guardado en ellas: la fecha de vigencia, la fuente legal, las monedas y los
-- aportes de cada versión. Las versiones de reglas, sus montos de la 0162 y los cortes de nómina (que
-- guardan su propio rules_snapshot) no se tocan. Una versión con cestaticket o bono en USD vuelve a
-- leerse en Bs: ANTES de desarmar, el contador anota o corrige esos montos.
-- La app vuelve sola al comportamiento de la fase A2a: sin las columnas ni la función, la pestaña Reglas lee y
-- guarda las de la 0162 (archiva la versión vigente, inserta la siguiente y, si el insert falla, la restaura;
-- lib/studio/nomina/payroll-rules-queries.ts).
-- NO quita el CHECK de utilidades por separado: va con el resto (era nuevo en la 0556).
set local lock_timeout = '5s';
set local statement_timeout = '30s';

drop function if exists public.nomina_guardar_reglas(jsonb);

alter table public.nomina_payroll_rules
  drop constraint if exists nomina_payroll_rules_utilidades_rango,
  drop constraint if exists nomina_payroll_rules_escalas_no_negativas,
  drop constraint if exists nomina_payroll_rules_pension_contrib_tope,
  drop constraint if exists nomina_payroll_rules_porcentajes_rango,
  drop constraint if exists nomina_payroll_rules_bono_guerra_moneda,
  drop constraint if exists nomina_payroll_rules_cestaticket_moneda,
  drop constraint if exists nomina_payroll_rules_imi_no_negativo,
  drop constraint if exists nomina_payroll_rules_fuente_legal_corta;

alter table public.nomina_payroll_rules
  drop column if exists bono_vacacional_max_days,
  drop column if exists vacaciones_extra_max,
  drop column if exists pension_contrib_pct,
  drop column if exists inces_utilidades_pct,
  drop column if exists inces_patronal_pct,
  drop column if exists faov_patronal_pct,
  drop column if exists rpe_patronal_pct,
  drop column if exists sso_patronal_pct,
  drop column if exists bono_guerra_moneda,
  drop column if exists cestaticket_moneda,
  drop column if exists ingreso_minimo_integral_usd,
  drop column if exists fuente_legal,
  drop column if exists vigente_desde;

notify pgrst, 'reload schema';
