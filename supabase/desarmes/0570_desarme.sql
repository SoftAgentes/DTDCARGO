-- SDD-0704 · Desarme de la 0570: quita el catálogo, las cuentas, las tarifas y los topes de la pantalla «IA», y las
-- columnas de tokens de task_events.
-- ⚠️ NO ES UNA MIGRACIÓN TODAVÍA. Vive fuera de supabase/migrations/ y sin número, para que nada lo aplique ni lo
--    empaquete. Usarlo exige el OK nominal de Sam: se copia a supabase/migrations/ con el siguiente número libre y se
--    aplica con el runbook de producción.
-- Ensayo: supabase/tests/0570_ia_catalogo_y_costo.test.sql (CONTRATO 12: deja la base sin ningún objeto de la 0570 y
-- repetirlo no falla).
-- Qué se pierde: la configuración de la pantalla (cuentas, tarifas, topes) y los tokens por llamada de task_events. El
-- costo de cada llamada (task_events.costo_usd) y el modelo (modelo_usado) quedan. Los eventos de auditoría quedan
-- (entity_audit_log es de solo agregar); el tipo ia_config pasa a «deprecated». Después del desarme el despachador
-- vuelve a las variables de entorno (avisa una vez «falta la 0570»).
set local lock_timeout = '5s';
set local statement_timeout = '30s';

drop function if exists public.ia_gasto_del_mes();
drop function if exists public.ia_oficina_autopausar_por_llamadas(integer, numeric);
drop function if exists public.ia_oficina_llamadas_del_mes();
drop function if exists public.ia_costo_oficina();
drop function if exists public.ia_borrar_tope(text, text);
drop function if exists public.ia_guardar_tope(text, numeric, text);
drop function if exists public.ia_borrar_modelo(uuid, text);
drop function if exists public.ia_guardar_modelo(uuid, text, numeric, numeric, text);
drop function if exists public.ia_guardar_cuenta(uuid, text, text, text, text, integer, text);
drop function if exists public.ia_exigir_aal2_si(boolean);
drop function if exists public.ia_contexto_de_escritura(text);

drop table if exists public.ia_topes;
drop table if exists public.ia_modelos;
drop table if exists public.ia_cuentas;
drop table if exists public.ia_catalogo_modelos;

drop function if exists public.ia_modelos_coherente();
drop function if exists public.ia_cuentas_coherente();

do $tokens$
begin
  if pg_catalog.to_regclass('public.task_events') is not null then
    alter table public.task_events drop constraint if exists task_events_tokens_validos;
    alter table public.task_events drop column if exists tokens_entrada;
    alter table public.task_events drop column if exists tokens_salida;
  end if;
end
$tokens$;

do $auditoria$
begin
  if pg_catalog.to_regclass('public.audit_entity_types') is not null then
    update public.audit_entity_types
       set status = 'deprecated', deprecated_at = coalesce(deprecated_at, pg_catalog.now())
     where entity_type = 'ia_config';
  end if;
end
$auditoria$;
