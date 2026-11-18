-- SDD-0626 §3.1 · Desarme de la 0541: quita las tres tablas del cable y la bandera office_paused.
-- ⚠️ NO ES UNA MIGRACIÓN TODAVÍA. Vive fuera de supabase/migrations/ y sin número, para que nada la
--    aplique ni la empaquete. Usarla exige OK nominal de Sam: se copia a supabase/migrations/ con el
--    siguiente número libre y se aplica con el runbook de producción.
-- Ensayo: lib/studio/__tests__/oficina-cable-tablas.migration.test.ts («desarme») y el contrato
--   supabase/tests/0541_oficina_cable_tablas.test.sql, que aplica la 0541, este desarme y otra vez la 0541.
--
-- QUITA las funciones office_vaciar_resumenes_viejos, office_cambiar_pausa, office_esta_pausada y
--   office_solo_insertar, y las tablas
--   task_events, office_tasks, event_inbox y office_paused con sus índices, disparadores y secuencia.
-- NO TOCA is_platform_admin, platform_admins, agents, agent_runs, agent_approvals ni ninguna otra tabla,
--   función, policy o grant.
--
-- PIERDE todas las filas de las cuatro tablas: las tareas, la bitácora de solo agregar (task_events), la
--   bandeja y el historial de la bandera. Si hace falta conservarlos, exportarlos antes con OK de Sam:
--   la bitácora es evidencia de AUD-01. Ningún código del ERP depende todavía de estas tablas.
-- DROP TABLE no dispara el disparador de solo agregar (no es UPDATE, DELETE ni TRUNCATE): lo corre el dueño.
set local lock_timeout = '5s'; -- local: valen hasta el COMMIT, también para la fila del ledger
set local statement_timeout = '30s';

do $preflight$
begin
  -- Solo desarma lo que puso la 0541: si una tabla existe con otra forma, parar.
  if (pg_catalog.to_regclass('public.office_tasks') is not null
      and not exists (select 1 from information_schema.columns
                       where table_schema = 'public' and table_name = 'office_tasks'
                         and column_name = 'meta_datos'))
     or (pg_catalog.to_regclass('public.task_events') is not null
      and not exists (select 1 from information_schema.columns
                       where table_schema = 'public' and table_name = 'task_events'
                         and column_name = 'modelo_usado'))
     or (pg_catalog.to_regclass('public.event_inbox') is not null
      and not exists (select 1 from information_schema.columns
                       where table_schema = 'public' and table_name = 'event_inbox'
                         and column_name = 'clave_dedupe'))
     or (pg_catalog.to_regclass('public.office_paused') is not null
      and not exists (select 1 from information_schema.columns
                       where table_schema = 'public' and table_name = 'office_paused'
                         and column_name = 'cambiado_por')) then
    raise exception 'desarme 0541: una de las tablas existe con otra forma';
  end if;
end
$preflight$;

drop function if exists public.office_vaciar_resumenes_viejos();
drop function if exists public.office_cambiar_pausa(boolean, text);
drop function if exists public.office_esta_pausada();
drop table if exists public.task_events;
drop table if exists public.office_tasks;
drop table if exists public.event_inbox;
drop table if exists public.office_paused;
drop function if exists public.office_solo_insertar();

notify pgrst, 'reload schema';
