-- SDD-0626 Paso 3b · Desarme de la 0549: quita la revisión de Sam y el envío desde el ERP.
-- ⚠️ NO ES UNA MIGRACIÓN TODAVÍA. Vive fuera de supabase/migrations/ y sin número, para que nada la
--    aplique ni la empaquete. Usarla exige OK nominal de Sam: se copia a supabase/migrations/ con el
--    siguiente número libre y se aplica con el runbook de producción.
-- Ensayo: supabase/tests/0549_oficina_revisiones_envio.test.sql y
--   lib/studio/__tests__/oficina-revisiones.migration.test.ts.
--
-- QUITA las funciones de la 0549, office_envios, office_revisiones (y sus filas: se pierden las revisiones
-- de Sam y el registro de envíos) y office_sesiones_por_borrar.
-- NO TOCA nada de la 0541, la 0544 ni la 0548: tareas, bitácora, bandeja, bandera y borradores quedan.
-- Los mensajes ya enviados siguen en Chatwoot.
-- ORDEN: antes que el desarme de la 0548. Como las tablas son de solo agregar, el DROP TABLE lo hace el dueño
-- (postgres) en su propia sesión.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

drop function if exists public.office_quitar_sesion_por_borrar(text);
drop function if exists public.office_sesiones_por_borrar();
drop function if exists public.office_anotar_sesion_por_borrar(text, integer);
drop function if exists public.office_cerrar_envio(uuid, text, text, bigint);
drop function if exists public.office_marcar_envio_incierto(uuid, text);
drop function if exists public.office_bloquear_envio(uuid, text, integer);
drop function if exists public.office_reservar_envio(uuid, text, integer, bigint);
drop function if exists public.office_bloquear(uuid, uuid, uuid, text, integer, text);
drop function if exists public.office_envios_por_hacer(integer);
drop function if exists public.office_pendientes_conteo();
drop function if exists public.office_conteo_revisiones(smallint);
drop function if exists public.office_revisar_borrador(uuid, text, boolean, boolean, boolean, boolean, boolean, text, smallint);
drop function if exists public.office_borradores_pendientes();
drop function if exists public.office_exigir_admin(text);
drop table if exists public.office_envios;
drop table if exists public.office_revisiones;
drop table if exists public.office_sesiones_por_borrar;
drop function if exists public.office_huella_borrador(text, text, text, text, smallint);

notify pgrst, 'reload schema';
