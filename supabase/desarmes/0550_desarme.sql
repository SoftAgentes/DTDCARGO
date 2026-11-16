-- SDD-0637 fase 2 · Desarme de la 0550: quita el registro de Faro.
-- ⚠️ NO ES UNA MIGRACIÓN TODAVÍA. Vive fuera de supabase/migrations/ y sin número, para que nada la
--    aplique ni la empaquete. Usarla exige OK nominal de Sam: se copia a supabase/migrations/ con el
--    siguiente número libre y se aplica con el runbook de producción.
-- Ensayo: lib/studio/asistente/__tests__/faro-0550.migration.test.ts (0550 → desarme → 0550).
--
-- QUITA las funciones y las siete tablas de Faro, con TODO lo guardado: conversaciones, mensajes, eventos,
-- lecturas, llamadas, cuotas y constancias de purga. DROP TABLE no pasa por el trigger de solo inserción.
-- NO QUITA el valor 'asistente_alerta' del enum bug_notif_type: Postgres no borra valores de un enum. Si hay
-- avisos con ese tipo en bug_notifications, quedan.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

drop function if exists public.asistente_leer_conversacion(uuid);
drop function if exists public.asistente_listar_conversaciones(integer, timestamptz);
drop function if exists public.asistente_purgar_usuario(uuid, uuid, uuid, text);
drop function if exists public.asistente_purgar_vencidos();
drop function if exists public.asistente_gasto_del_mes(uuid);
drop function if exists public.asistente_reservar_pregunta(uuid, uuid, integer);
drop table if exists public.asistente_mensajes;
drop table if exists public.asistente_conversaciones;
drop table if exists public.asistente_eventos;
drop table if exists public.asistente_lecturas;
drop table if exists public.asistente_llamadas;
drop table if exists public.asistente_cuotas;
drop table if exists public.asistente_purgas;
drop function if exists public.asistente_solo_insercion();

notify pgrst, 'reload schema';
