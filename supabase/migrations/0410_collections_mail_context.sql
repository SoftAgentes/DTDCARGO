-- ─────────────────────────────────────────────────────────────
-- 0410 · SDD-0353 · Cobranzas: contexto de correo minimizado
--
-- HALLAZGO: Cobranzas necesitaba tres señales para decidir recordatorios, pero
-- leía directamente email, metadata y todo el histórico tenant-wide de
-- mail_logs. Eso impedía cerrar el SELECT del dominio Mailing a su rol admin.
--
-- ESTE SLICE:
--   · crea una RPC sin tenant arbitrario y limitada a facturas solicitadas;
--   · devuelve sólo markbox, flags y fecha del último recordatorio;
--   · exige accounting|admin y tenant activo dentro de SECURITY DEFINER;
--   · conserva el SELECT histórico durante la expansión (SDD-0358);
--   · preserva service_role para envío, webhook y salud de correo.
--
-- 0415 restringe el SELECT a admin DESPUÉS de desplegar/verificar el facade.
-- Corrección previa a publicación/aplicación; no es una migración histórica.
-- NO aplicar a Cloud/Producción desde esta rama. Gate individual obligatorio.
-- ─────────────────────────────────────────────────────────────

do $preflight$
begin
  if pg_catalog.to_regclass('public.mail_logs') is null
     or pg_catalog.to_regclass('public.invoices') is null
     or pg_catalog.to_regclass('public.clients') is null then
    raise exception '0410 requiere mail_logs, invoices y clients';
  end if;
  if pg_catalog.to_regprocedure('public.get_user_tenant_id()') is null
     or pg_catalog.to_regprocedure('public.current_studio_role()') is null then
    raise exception '0410 requiere helpers activos de tenant y rol';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'mail_logs'
      and policyname = 'mail_logs_tenant_select' and cmd = 'SELECT'
  ) then
    raise exception '0410 abortada: mail_logs_tenant_select ausente o con drift';
  end if;
end;
$preflight$;

create or replace function public.collections_mail_context(p_invoice_ids uuid[])
returns table (
  invoice_id uuid,
  client_markbox text,
  has_email boolean,
  complained boolean,
  last_reminder_on date
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := public.get_user_tenant_id();
  v_role text := public.current_studio_role();
begin
  if v_tenant is null or v_role is null or v_role not in ('accounting', 'admin') then
    raise exception 'Acceso no autorizado a contexto de cobranza'
      using errcode = '42501';
  end if;

  if coalesce(pg_catalog.cardinality(p_invoice_ids), 0) = 0 then
    return;
  end if;
  if pg_catalog.cardinality(p_invoice_ids) > 1000 then
    raise exception 'Demasiadas facturas solicitadas'
      using errcode = '22023';
  end if;

  return query
  with requested as (
    select i.id as invoice_id, i.client_markbox
    from public.invoices as i
    where i.tenant_id = v_tenant
      and i.deleted_at is null
      and i.id = any(p_invoice_ids)
  ), context as (
    select
      r.invoice_id,
      r.client_markbox,
      nullif(pg_catalog.btrim(c.email), '') as email
    from requested as r
    left join public.clients as c
      on c.tenant_id = v_tenant
     and c.markbox = r.client_markbox
     and c.deleted_at is null
  )
  select
    context.invoice_id,
    context.client_markbox,
    context.email is not null as has_email,
    context.email is not null and exists (
      select 1
      from public.mail_logs as complaint_log
      where complaint_log.tenant_id = v_tenant
        and complaint_log.complained_at is not null
        and pg_catalog.lower(complaint_log.to_email) = pg_catalog.lower(context.email)
    ) as complained,
    (
      select pg_catalog.max((reminder_log.sent_at at time zone 'UTC')::date)
      from public.mail_logs as reminder_log
      where reminder_log.tenant_id = v_tenant
        and reminder_log.metadata ->> 'event' = 'invoice_overdue'
        and reminder_log.metadata #>> '{source_ref,id}' = context.invoice_id::text
    ) as last_reminder_on
  from context
  order by context.invoice_id;
end;
$$;

revoke all on function public.collections_mail_context(uuid[])
  from public, anon, authenticated;
grant execute on function public.collections_mail_context(uuid[])
  to authenticated, service_role;

comment on function public.collections_mail_context(uuid[]) is
  'SDD-0353: contexto mínimo de recordatorios para accounting|admin. Sin tenant, email ni metadata en la respuesta; las facturas se acotan al tenant activo.';

do $postflight$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'mail_logs'
      and policyname = 'mail_logs_tenant_select' and cmd = 'SELECT'
  ) then
    raise exception '0410: se perdió la lectura compatible durante la expansión';
  end if;
  if not has_function_privilege('authenticated', 'public.collections_mail_context(uuid[])', 'EXECUTE')
     or has_function_privilege('anon', 'public.collections_mail_context(uuid[])', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.collections_mail_context(uuid[])', 'EXECUTE') then
    raise exception '0410: ACL de collections_mail_context inválida';
  end if;
  if not has_table_privilege('authenticated', 'public.mail_logs', 'SELECT')
     or has_table_privilege('authenticated', 'public.mail_logs', 'INSERT')
     or has_table_privilege('authenticated', 'public.mail_logs', 'UPDATE')
     or has_table_privilege('authenticated', 'public.mail_logs', 'DELETE')
     or has_table_privilege('authenticated', 'public.mail_logs', 'TRUNCATE') then
    raise exception '0410: ACL final de mail_logs inválida';
  end if;
end;
$postflight$;
