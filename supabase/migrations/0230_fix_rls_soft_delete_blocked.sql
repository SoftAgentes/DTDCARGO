-- SDD n/a (bugfix): las policies "<tabla> by tenant" (FOR ALL) combinan, en el
-- mismo USING, tenant_id = get_user_tenant_id() AND deleted_at IS NULL. Postgres,
-- para una policy FOR ALL con USING+WITH CHECK distintos, exige que la fila
-- resultante de un UPDATE siga cumpliendo el USING (no solo el WITH CHECK) —
-- asi que cualquier UPDATE que ponga deleted_at de NULL a un timestamp (el
-- soft-delete) queda bloqueado con "new row violates row-level security policy",
-- para CUALQUIER usuario, siempre. Confirmado en vivo (transacciones con
-- rollback, sin escritura real) para public.clients y reproducido/arreglado
-- ahi mismo antes de aplicar esto a las ~60 tablas con el mismo patron.
--
-- Fix: sacar "AND deleted_at IS NULL" del USING de la policy FOR ALL (que
-- gobierna escritura + lectura). El filtro de "no mostrar borrados" ya lo hace
-- la capa de aplicacion en cada query (`.is("deleted_at", null)` en
-- lib/studio/*-queries.ts) — la policy FOR ALL solo necesita aislar por tenant.
-- Las policies de SELECT dedicadas para portal (ej. "clients portal self
-- read", con su propio deleted_at IS NULL) NO se tocan: siguen ocultando
-- filas borradas en esos paths de solo lectura.
--
-- agent_tool_grants matchea el filtro por casualidad (su EXISTS referencia
-- agents.deleted_at, no un deleted_at propio — la tabla no tiene esa columna)
-- asi que el regexp no le pega y el ALTER POLICY es un no-op para ella.
do $$
declare
  r record;
  new_using text;
begin
  for r in
    select tablename, policyname, qual
    from pg_policies
    where schemaname = 'public'
      and cmd = 'ALL'
      and qual ilike '%deleted_at%'
      and (with_check is null or with_check not ilike '%deleted_at%')
  loop
    new_using := regexp_replace(r.qual, '\s*AND \(deleted_at IS NULL\)', '', 'i');
    execute format('alter policy %I on public.%I using (%s)', r.policyname, r.tablename, new_using);
  end loop;
end $$;
