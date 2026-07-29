-- SDD-0118 · hacer autosuficiente el replay histórico de 0209.
-- Sólo antepone al ledger la definición versionada por 0277; no ejecuta ese DDL.
-- 0209 conserva su payload y pasa a tener dos statements ordenados.

do $sdd0118_rls_history_preflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260703234254'
      and name = '0209_revoke_anon_rpc_sweep'
      and (
        (
          cardinality(statements) = 1
          and md5(statements[1]) = 'c6c722efdb7ff79ef037e0d826739205'
        )
        or (
          cardinality(statements) = 2
          and md5(statements[1]) = '3be131a05cb2d712fc92996004ae8b33'
          and md5(statements[2]) = 'c6c722efdb7ff79ef037e0d826739205'
        )
      )
  ) then
    raise exception 'SDD-0118 rls history: drift en 20260703234254 0209_revoke_anon_rpc_sweep';
  end if;
end
$sdd0118_rls_history_preflight$;

update supabase_migrations.schema_migrations
set statements = array[
  $sdd0118_rls_bootstrap$create or replace function public.rls_auto_enable()
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

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
grant  execute on function public.rls_auto_enable() to service_role;$sdd0118_rls_bootstrap$
] || statements
where version = '20260703234254'
  and name = '0209_revoke_anon_rpc_sweep'
  and cardinality(statements) = 1
  and md5(statements[1]) = 'c6c722efdb7ff79ef037e0d826739205';

do $sdd0118_rls_history_postflight$
begin
  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260703234254'
      and name = '0209_revoke_anon_rpc_sweep'
      and cardinality(statements) = 2
      and md5(statements[1]) = '3be131a05cb2d712fc92996004ae8b33'
      and md5(statements[2]) = 'c6c722efdb7ff79ef037e0d826739205'
  ) then
    raise exception 'SDD-0118 rls history: postcondición falló en 20260703234254 0209_revoke_anon_rpc_sweep';
  end if;
end
$sdd0118_rls_history_postflight$;
