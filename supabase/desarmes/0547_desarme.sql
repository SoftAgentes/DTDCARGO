-- SDD-0626 Paso 3a · Desarme de la 0547: quita el despachador mínimo del cable.
-- ⚠️ NO ES UNA MIGRACIÓN TODAVÍA. Vive fuera de supabase/migrations/ y sin número, para que nada la
--    aplique ni la empaquete. Usarla exige OK nominal de Sam: se copia a supabase/migrations/ con el
--    siguiente número libre y se aplica con el runbook de producción.
-- Ensayo: supabase/tests/0547_oficina_despachador.test.sql y
--   lib/studio/__tests__/oficina-despachador.migration.test.ts.
--
-- QUITA las funciones del despachador, office_borradores (y sus borradores), office_despachador (el turno)
-- y el índice office_tasks_evento_unico.
-- NO TOCA nada de la 0541 ni de la 0544: las tareas, la bitácora, la bandeja y la bandera quedan.
-- ORDEN: antes que los desarmes de la 0544 y de la 0541.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

drop function if exists public.office_purgar_borradores_viejos();
drop function if exists public.office_autopausar_por_tope(numeric, numeric);
drop function if exists public.office_gasto_del_mes();
drop function if exists public.office_recuperar_corridas(text, integer);
drop function if exists public.office_soltar_corrida(uuid, uuid, text);
drop function if exists public.office_entregar_corrida(uuid, uuid, text, text, text, text, smallint, text, text);
drop function if exists public.office_corrida_en_curso(uuid, uuid);
drop function if exists public.office_tomar_tarea(text, integer, integer);
drop function if exists public.office_tipos_de_cierre();
drop function if exists public.office_convertir_triaje(text, integer);
drop function if exists public.office_despachador_soltar(uuid);
drop function if exists public.office_despachador_turno(uuid, integer);
drop function if exists public.office_agente_valido(text);
drop table if exists public.office_borradores;
drop table if exists public.office_despachador;
drop index if exists public.office_tasks_evento_unico;

notify pgrst, 'reload schema';
