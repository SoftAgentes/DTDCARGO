-- SDD-0673 · Desarme de la 0563: quita «Corregir medidas», «Partir embarque» y el grupo de WeChat.
-- ⚠️ NO ES UNA MIGRACIÓN TODAVÍA. Vive fuera de supabase/migrations/ y sin número, para que nada la
--    aplique ni la empaquete. Usarla exige OK nominal de Sam: se copia a supabase/migrations/ con el
--    siguiente número libre y se aplica con el runbook de producción.
-- Ensayo: supabase/tests/0563_partir_embarque_y_medidas.test.sql y
--   lib/studio/__tests__/partir-embarque-y-medidas.migration.test.ts.
--
-- QUITA las dos funciones y la columna shipments.group_reference (con su texto: respaldarlo antes si
-- hace falta). NO deshace correcciones ni particiones ya hechas: cada una quedó con su evento en
-- entity_audit_log y se revierte con otra corrección ANTES de desarmar. Con la app nueva y sin las
-- funciones, los modales dicen que la acción no está disponible.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

drop function if exists public.correct_shipment_measures(uuid, integer, numeric, numeric, text, boolean);
drop function if exists public.split_shipment(uuid, uuid, integer, numeric, numeric, text, text[], boolean);
alter table public.shipments drop constraint if exists shipments_group_reference_len;
alter table public.shipments drop column if exists group_reference;

notify pgrst, 'reload schema';
