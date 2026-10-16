-- ─────────────────────────────────────────────────────────────────────────────
-- infra/ops/staging/plataforma-prueba-cierre.sql — cierre de plataforma-prueba.sql
-- (SDD-0540, Fase 1). Lo corre resetear-base-prueba.sh como supabase_admin
-- después de la última migración y antes de la semilla.
--
-- Vuelve a encender la RLS en EXACTAMENTE las tablas que plataforma-prueba.sql
-- apagó para que la 0038 pudiera correr (cron.*, auth.* y storage.*: las anotó
-- en prueba_reset.rls_apagada), comprueba que quedaron encendidas y borra el
-- esquema auxiliar. Si falta la lista, falla: la base no salió de la plataforma.
-- ─────────────────────────────────────────────────────────────────────────────
\set ON_ERROR_STOP on

\connect postgres supabase_admin

do $cierre_rls$
declare
  r record;
  n int := 0;
begin
  if pg_catalog.to_regclass('prueba_reset.rls_apagada') is null then
    raise exception 'plataforma-prueba-cierre: falta prueba_reset.rls_apagada (¿corrió plataforma-prueba.sql?)';
  end if;
  for r in select tabla from prueba_reset.rls_apagada loop
    execute format('alter table %s enable row level security', r.tabla);
    n := n + 1;
  end loop;
  if exists (select 1 from prueba_reset.rls_apagada a join pg_class c on c.oid = a.tabla where not c.relrowsecurity) then
    raise exception 'plataforma-prueba-cierre: quedaron tablas sin RLS';
  end if;
  raise notice 'plataforma-prueba-cierre: RLS encendida otra vez en % tablas', n;
end
$cierre_rls$;

drop schema prueba_reset cascade;
