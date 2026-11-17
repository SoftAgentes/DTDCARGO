-- SDD-0645 · Desarme de la 0551: quita «Pasar a otro cliente» de la base.
-- ⚠️ NO ES UNA MIGRACIÓN TODAVÍA. Vive fuera de supabase/migrations/ y sin número, para que nada la
--    aplique ni la empaquete. Usarla exige OK nominal de Sam: se copia a supabase/migrations/ con el
--    siguiente número libre y se aplica con el runbook de producción.
-- Ensayo: supabase/tests/0551_pasar_embarque_a_otro_cliente.test.sql y
--   lib/studio/__tests__/pasar-embarque-a-otro-cliente.migration.test.ts.
--
-- QUITA la función reassign_shipment_client. NO deshace los cambios de dueño ya hechos: cada uno quedó
-- con su evento shipment_client_reassigned en entity_audit_log, y se revierte pasando el embarque de
-- vuelta ANTES de desarmar. Con la app nueva y sin la función, el modal dice que la acción no está
-- disponible.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

drop function if exists public.reassign_shipment_client(uuid, uuid, text, boolean);

notify pgrst, 'reload schema';
