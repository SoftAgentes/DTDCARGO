-- SDD-0704 · Desarme de la 0571: quita la cadena de modelos por función y el registro de intentos.
-- ⚠️ NO ES UNA MIGRACIÓN TODAVÍA. Vive fuera de supabase/migrations/ y sin número, para que nada lo aplique ni lo
--    empaquete. Usarlo exige el OK nominal de Sam: se copia a supabase/migrations/ con el siguiente número libre y se
--    aplica con el runbook de producción.
-- Ensayo: supabase/tests/0571_ia_cadenas_y_eventos.test.sql (deja la base sin ningún objeto de la 0571 y repetirlo no
-- falla). La 0570 queda intacta.
-- Qué se pierde: la cadena elegida en la pantalla y el registro de intentos (ia_eventos). Los eventos de auditoría
-- quedan (entity_audit_log es de solo agregar). Después del desarme A1 y A2 vuelven al modelo por defecto del código.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

drop function if exists public.ia_registrar_evento(text, integer, text, text, text, integer, text, integer, integer);
drop function if exists public.ia_cadena_de(text);
drop function if exists public.ia_guardar_cadena(text, text[], text[], text);

drop table if exists public.ia_eventos;
drop table if exists public.ia_cadenas;

drop function if exists public.ia_cadenas_coherente();
