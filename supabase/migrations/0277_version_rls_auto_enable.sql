-- ─────────────────────────────────────────────────────────────
-- Versionar `rls_auto_enable()` + el event trigger `ensure_rls`
--
-- POR QUÉ: esta función vive en producción desde hace meses, creada FUERA DE
-- BANDA — ninguna migración la creaba. Las 0209 y 0211 le hacen revoke/grant
-- dando por sentado que existe. Consecuencias de eso:
--   · su código no estaba versionado → nadie lo podía revisar ni auditar;
--   · una reconstrucción de la base (o un branch de Supabase) la perdía, y con
--     ella la garantía de que toda tabla nueva nace con RLS;
--   · el gate `schema-rebuild` la reportaba como la única función huérfana del
--     repo (referenciada por grant/revoke, creada por nadie).
--
-- Esta migración NO cambia el comportamiento: es la definición EXACTA que hoy
-- corre en prod (recuperada con pg_get_functiondef el 2026-07-29), escrita de
-- forma idempotente. Aplicarla a prod sólo deja el ledger y el repo alineados.
--
-- QUÉ HACE la función: es un event trigger `ddl_command_end` que, ante
-- CREATE TABLE / CREATE TABLE AS / SELECT INTO en el schema `public`, ejecuta
-- `alter table ... enable row level security`. Es el cinturón que garantiza que
-- ninguna tabla nueva quede sin RLS por olvido. No sustituye a las policies:
-- una tabla con RLS y sin policy no la lee nadie (salvo BYPASSRLS).
-- ─────────────────────────────────────────────────────────────

create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

comment on function public.rls_auto_enable is
  'Event trigger (ddl_command_end): habilita RLS automáticamente en toda tabla nueva de public. Creada fuera de banda en prod; versionada acá en 0277 para que sea auditable y sobreviva a una reconstrucción. La usa el event trigger ensure_rls.';

-- El event trigger no admite IF NOT EXISTS.
do $ensure_rls$
begin
  if not exists (select 1 from pg_event_trigger where evtname = 'ensure_rls') then
    create event trigger ensure_rls
      on ddl_command_end
      when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      execute function public.rls_auto_enable();
  end if;
end
$ensure_rls$;

-- Las ACL que 0209 y 0211 ya fijaron (idempotente, por si esto corre sobre una
-- base reconstruida donde aquellas se aplicaron antes de que la función existiera).
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
grant  execute on function public.rls_auto_enable() to service_role;
