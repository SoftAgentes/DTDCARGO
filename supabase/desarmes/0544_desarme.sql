-- SDD-0626 §3.3 · Desarme de la 0544: quita el filtro nivel 1 de la bandeja del cable.
-- ⚠️ NO ES UNA MIGRACIÓN TODAVÍA. Vive fuera de supabase/migrations/ y sin número, para que nada la
--    aplique ni la empaquete. Usarla exige OK nominal de Sam: se copia a supabase/migrations/ con el
--    siguiente número libre y se aplica con el runbook de producción.
-- Ensayo: supabase/tests/0544_oficina_filtro_bandeja.test.sql y
--   lib/studio/__tests__/oficina-filtro-bandeja.migration.test.ts.
--
-- QUITA office_filtrar_bandeja(integer), el índice event_inbox_triaje_en_idx y la columna event_inbox.triaje_en.
-- NO TOCA nada de la 0541: las filas de event_inbox quedan; solo se pierde la hora en que cada una pasó a «triaje».
-- ORDEN: antes que el desarme de la 0541 (que borra event_inbox entera).
set local lock_timeout = '5s';
set local statement_timeout = '30s';

drop function if exists public.office_filtrar_bandeja(integer);
drop index if exists public.event_inbox_triaje_en_idx;
alter table if exists public.event_inbox drop column if exists triaje_en;

notify pgrst, 'reload schema';
