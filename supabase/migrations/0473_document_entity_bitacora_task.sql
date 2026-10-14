-- ─────────────────────────────────────────────────────────────────────────────
-- 0473 · SDD-0506 — document_entity_in_tenant() vuelve a aceptar 'bitacora_task'.
--
-- ⚠️ NO APLICADA A PRODUCCIÓN. Declarada como espera en
--    supabase/migrations-baseline.json › pendingBelowCutoff. Aplicar exige OK
--    de Sam NOMBRANDO este archivo (docs/runbooks/aplicar-migraciones-prod.md).
--    Desde el 2026-10-14 producción es el Supabase self-hosted del servidor
--    propio (docs/runbooks/servidor-contabo.md), no Supabase Cloud. ORDEN: libre
--    respecto de la PR (no hay código nuevo que dependa de ella): hasta que se
--    aplique, «Prueba de avance» de Bitácora sigue fallando como hoy.
--
-- ── El defecto ──────────────────────────────────────────────
-- Bitácora → editar tarea → «Prueba de avance» → «Subir foto o documento» falla
-- con «documento sobre entidad inexistente, de otro tipo o ajena al tenant:
-- bitacora_task/<id>» aunque la tarea exista y sea del tenant. El trigger
-- documents_validate_entity_trg (0097) llama a document_entity_in_tenant(), y
-- su CASE no tiene rama 'bitacora_task': cae en `else ok := false`.
--
-- ── Cómo se perdió la rama ──────────────────────────────────
-- 0215 (SDD-0146) agregó 'bitacora_task' al enum y la rama al CASE. 0314
-- (SDD-0224, Gastos) volvió a escribir la función para sumar 'expense' a partir
-- del CASE de 0097, sin la rama de 0215, y la perdió. Medido el 2026-10-14 en
-- Supabase Cloud y en el servidor propio: md5(prosrc) =
-- fe0e86178dfd646dc7d58b46ef404949, que es exactamente el cuerpo de 0314; en
-- Cloud no hay ninguna fila de documents con entity_type 'bitacora_task': la
-- subida nunca funcionó en producción. El enum y la autorización sí conocen el
-- tipo (0215; 0443/0444 con document_entity_authorized('bitacora_task', …)).
--
-- ── Qué cambia ──────────────────────────────────────────────
-- Una línea: la rama 'bitacora_task' antes del `else`. bitacora_tasks no tiene
-- deleted_at (0214: el ciclo de vida es `estado` y authenticated no tiene
-- DELETE), así que la rama filtra id y tenant y nada más, igual que la de 0215.
-- El preflight aborta si la tabla llegara a tener deleted_at: entonces la rama
-- tendría que filtrarlo. El resto del cuerpo se copia VERBATIM de 0314 (líneas
-- 13-38): SECURITY DEFINER, STABLE, search_path vacío, el mismo `none`/null →
-- true y las once ramas con su filtro. `create or replace` conserva oid, dueño
-- (postgres) y ACL; el revoke/grant de abajo repite el de 0209 para que el
-- archivo se lea solo. lib/studio/__tests__/document-entity-bitacora-task.migration.test.ts
-- compara este texto contra 0314 línea a línea.
--
-- comments_validate_entity() NO necesita lo mismo: comment_entity_in_tenant()
-- se definió por última vez en 0215, con su rama 'bitacora_task' y el filtro
-- de tenant; ningún archivo posterior la reescribe y el cuerpo vivo en Cloud la
-- tiene (leído el 2026-10-14; su md5 difiere del de 0215 sólo porque al
-- aplicarla se perdieron dos comentarios).
--
-- ── Preflight / postflight ──────────────────────────────────
-- Aborta sin cambiar nada si la función no existe, si no es DEFINER/STABLE con
-- search_path vacío, o si su md5(prosrc) no es el de 0314 ni el de esta
-- migración (que la deja re-aplicable); si el enum no tiene 'bitacora_task'; o
-- si bitacora_tasks no tiene id y tenant_id, o tiene deleted_at. El postflight
-- exige el cuerpo de 0473 por md5, la misma forma y EXECUTE sólo para
-- authenticated y service_role. LOCKS: sólo de catálogo (pg_proc); ninguno
-- sobre tablas y ninguna fila tocada. ROLLBACK: volver a correr el
-- `create or replace` de 0314 (líneas 13-38), que deja la subida rota como hoy.
-- ─────────────────────────────────────────────────────────────────────────────

set lock_timeout = '5s';
set statement_timeout = '30s';

do $preflight$
declare
  v_fn regprocedure := pg_catalog.to_regprocedure(
    'public.document_entity_in_tenant(public.document_entity_type,uuid,uuid)');
begin
  if v_fn is null then
    raise exception '0473 abortado: public.document_entity_in_tenant(document_entity_type, uuid, uuid) no existe';
  end if;
  if not exists (select 1 from pg_catalog.pg_proc p
    where p.oid = v_fn
      and p.prosecdef
      and p.provolatile = 's'
      and p.prorettype = 'pg_catalog.bool'::pg_catalog.regtype
      and p.proconfig = array['search_path=""']::text[]
      and pg_catalog.md5(p.prosrc) in (
        'fe0e86178dfd646dc7d58b46ef404949',  -- 0314, medido en producción
        '333626d3c6fc4a6b2490f7a4607abab9'))  -- esta migración: re-aplicar no cambia nada
  then
    raise exception '0473 abortado: document_entity_in_tenant tiene drift respecto a 0314 (md5 de prosrc, DEFINER, STABLE o search_path)';
  end if;
  if not exists (select 1 from pg_catalog.pg_enum e
    join pg_catalog.pg_type t on t.oid = e.enumtypid
    join pg_catalog.pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'document_entity_type'
      and e.enumlabel = 'bitacora_task') then
    raise exception '0473 abortado: el enum document_entity_type no tiene bitacora_task (0215)';
  end if;
  if (select pg_catalog.count(*) from pg_catalog.pg_attribute a
      where a.attrelid = pg_catalog.to_regclass('public.bitacora_tasks')
        and a.attname in ('id', 'tenant_id') and a.attnum > 0 and not a.attisdropped) <> 2 then
    raise exception '0473 abortado: public.bitacora_tasks no existe o no tiene id y tenant_id (0214)';
  end if;
  if exists (select 1 from pg_catalog.pg_attribute a
    where a.attrelid = pg_catalog.to_regclass('public.bitacora_tasks')
      and a.attname = 'deleted_at' and a.attnum > 0 and not a.attisdropped) then
    raise exception '0473 abortado: public.bitacora_tasks tiene deleted_at y la rama no lo filtra';
  end if;
end;
$preflight$;

-- ── document_entity_in_tenant: 0314 líneas 13-38 + la rama bitacora_task ─────
create or replace function public.document_entity_in_tenant(
  p_type public.document_entity_type,
  p_id uuid,
  p_tenant uuid
) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  ok boolean := false;
begin
  if p_type::text = 'none' or p_id is null then return true; end if;
  case p_type::text
    when 'shipment' then select exists(select 1 from public.shipments where id=p_id and tenant_id=p_tenant and deleted_at is null) into ok;
    when 'invoice' then select exists(select 1 from public.invoices where id=p_id and tenant_id=p_tenant and deleted_at is null) into ok;
    when 'supplier_bill' then select exists(select 1 from public.supplier_bills where id=p_id and tenant_id=p_tenant and deleted_at is null) into ok;
    when 'supplier_payment' then select exists(select 1 from public.supplier_payments where id=p_id and tenant_id=p_tenant and deleted_at is null) into ok;
    when 'journal_entry' then select exists(select 1 from public.journal_entries where id=p_id and tenant_id=p_tenant and deleted_at is null) into ok;
    when 'client' then select exists(select 1 from public.clients where id=p_id and tenant_id=p_tenant and deleted_at is null) into ok;
    when 'supplier' then select exists(select 1 from public.suppliers where id=p_id and tenant_id=p_tenant and deleted_at is null) into ok;
    when 'consolidation' then select exists(select 1 from public.consolidations where id=p_id and tenant_id=p_tenant and deleted_at is null) into ok;
    when 'booking' then select exists(select 1 from public.bookings where id=p_id and tenant_id=p_tenant and deleted_at is null) into ok;
    when 'expense' then select exists(select 1 from public.expenses where id=p_id and tenant_id=p_tenant and deleted_at is null) into ok;
    when 'bitacora_task' then select exists(select 1 from public.bitacora_tasks where id=p_id and tenant_id=p_tenant) into ok;
    else ok := false;
  end case;
  return ok;
end;
$$;

comment on function public.document_entity_in_tenant(public.document_entity_type, uuid, uuid) is
  'SDD-0049 (+SDD-0146 bitacora_task, SDD-0224 expense; SDD-0506 devuelve bitacora_task, perdida en 0314): ¿(entity_type, entity_id) existe, es del tipo correcto y del tenant? Polimórfico (sin FK). none/null → true. Defiende contra entity_id forjado vía PostgREST directo.';

-- `create or replace` conserva la ACL; se repite la de 0209 para leer el archivo solo.
revoke execute on function public.document_entity_in_tenant(p_type public.document_entity_type, p_id uuid, p_tenant uuid) from public, anon;
grant execute on function public.document_entity_in_tenant(p_type public.document_entity_type, p_id uuid, p_tenant uuid) to authenticated, service_role;

do $postflight$
begin
  if not exists (select 1 from pg_catalog.pg_proc p
    where p.oid = pg_catalog.to_regprocedure(
        'public.document_entity_in_tenant(public.document_entity_type,uuid,uuid)')
      and p.prosecdef
      and p.provolatile = 's'
      and p.prorettype = 'pg_catalog.bool'::pg_catalog.regtype
      and p.proconfig = array['search_path=""']::text[]
      and pg_catalog.md5(p.prosrc) = '333626d3c6fc4a6b2490f7a4607abab9'
      and pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE')
      and not pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE')
      and not exists (select 1 from pg_catalog.aclexplode(p.proacl) a
        where a.grantee = 0 and a.privilege_type = 'EXECUTE')) then
    raise exception '0473: postflight — document_entity_in_tenant no quedó con el cuerpo de 0473, DEFINER, STABLE, search_path vacío o la ACL esperada';
  end if;
end;
$postflight$;
-- ─────────────────────────────────────────────────────────────────────────────
-- Fin migración 0473_document_entity_bitacora_task.sql
-- Aplicar SÓLO con OK nominal de Sam nombrando este archivo, con el runbook
-- docs/runbooks/aplicar-migraciones-prod.md y el name exacto
-- 0473_document_entity_bitacora_task. Fusionar la PR NO lo autoriza.
-- ─────────────────────────────────────────────────────────────────────────────
