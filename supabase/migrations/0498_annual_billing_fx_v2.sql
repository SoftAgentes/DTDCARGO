-- 0498 · SDD-0572-b · Expansión compatible, MIGRATE-FIRST; no aplicar sin OK nominal.
-- Solo DDL. No recalcula ni escribe facturas. Conserva v1 y campos Portal legados.
-- Requiere 0404/0411, la frontera actual 0414, tenant inequívoco 0453 y to_usd 0495.
-- Ejecutar en una transacción. Postflight no sustituye comprobación HTTP de caché.
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
declare v_signature text;
begin
  if pg_catalog.to_regnamespace('annual_billing_private') is not null
     or pg_catalog.to_regprocedure('public.studio_client_annual_billing_v2(date)') is not null then
    raise exception '0498: instalación previa o parcial; revisar antes de aplicar';
  end if;
  foreach v_signature in array array['public.to_usd(numeric,text,numeric)', 'public.get_user_tenant_id()', 'public.current_studio_role()', 'auth.uid()'] loop
    if pg_catalog.to_regprocedure(v_signature) is null then raise exception '0498: falta prerrequisito %', v_signature; end if;
  end loop;
  if pg_catalog.to_regclass('public.studio_role_module_overrides') is null
     or not exists (select 1 from pg_catalog.pg_policies where schemaname='public' and tablename='invoices' and policyname='invoices_accounting_select' and cmd='SELECT')
     or exists (select 1 from pg_catalog.pg_policies where schemaname='public' and tablename='invoices' and policyname='invoices_team_select') then
    raise exception '0498: requiere frontera de lectura actual 0414';
  end if;
  foreach v_signature in array array['public.get_portal_referral_program()', 'public.studio_client_annual_billing(date)'] loop
    if not exists (select 1 from pg_catalog.pg_proc where oid=pg_catalog.to_regprocedure(v_signature)
      and prosecdef and provolatile='s' and proowner='postgres'::regrole and proconfig @> array['search_path=""']) then
      raise exception '0498: fachada previa con forma o propietario inesperado: %', v_signature;
    end if;
  end loop;
  if pg_catalog.pg_get_function_result('public.studio_client_annual_billing(date)'::regprocedure) <> 'TABLE(client_markbox text, billed_usd numeric)'
     or pg_catalog.pg_get_function_result('public.get_portal_referral_program()'::regprocedure) <> 'jsonb' then
    raise exception '0498: retorno legado inesperado';
  end if;
  if (select pg_catalog.md5(prosrc) from pg_catalog.pg_proc where oid='public.get_portal_referral_program()'::regprocedure) <> 'd023e42273069a42f5d6a45705560378' then
    raise exception '0498: cuerpo Portal distinto de 0404; revisar compatibilidad';
  end if;
end;
$preflight$;

create temporary table annual_billing_0498_before on commit drop as
select oid, proowner, proacl, pg_catalog.pg_get_functiondef(oid) as definition
from pg_catalog.pg_proc where oid in ('public.get_portal_referral_program()'::regprocedure, 'public.studio_client_annual_billing(date)'::regprocedure);

create schema annual_billing_private authorization postgres;
revoke all on schema annual_billing_private from public, anon, authenticated, service_role;

-- Clasificador puro y privado. El orden y el redondeo pertenecen SOLO a to_usd.
create function annual_billing_private.convertir_factura_anual_usd(p_amount numeric, p_currency text, p_rate numeric)
returns table (usd numeric, fx_state text)
language plpgsql immutable security invoker set search_path = ''
as $classify$
declare v_message text; v_hint text;
begin
  usd := public.to_usd(p_amount, p_currency, p_rate);
  fx_state := 'completo';
  return next;
exception when sqlstate '22023' then
  get stacked diagnostics v_message = message_text, v_hint = pg_exception_hint;
  if v_hint is distinct from 'dtd-fx' or v_message not in ('FX_AMOUNT_INVALID', 'FX_RATE_MISSING', 'FX_CURRENCY_UNKNOWN') then raise; end if;
  usd := null;
  fx_state := case when v_message = 'FX_RATE_MISSING' then 'sin_tasa' else 'datos_invalidos' end;
  return next;
end;
$classify$;
alter function annual_billing_private.convertir_factura_anual_usd(numeric,text,numeric) owner to postgres;
revoke all on function annual_billing_private.convertir_factura_anual_usd(numeric,text,numeric) from public, anon, authenticated, service_role;

create function public.studio_client_annual_billing_v2(p_as_of date)
returns table (
  client_markbox text,
  subtotal_usd text,
  sin_tasa_count bigint,
  conversion_state text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := public.get_user_tenant_id();
  v_role text := public.current_studio_role();
  v_allowed boolean;
begin
  if v_tenant is null
     or v_role is null
     or v_role not in ('commercial', 'operations', 'accounting', 'warehouse', 'support', 'marketing', 'admin') then
    raise exception 'Acceso no autorizado a facturación anual'
      using errcode = '42501';
  end if;

  -- Reportes es MONEY_MODULE: accounting/admin, candado sin overrides.
  -- Fidelización y CRM sí son editables (SDD-0252). Fila ausente = defaults
  -- de rbac.ts; una revocación explícita NO debe reabrirse por el default.
  v_allowed := v_role in ('accounting', 'admin');
  if not v_allowed then
    select
      coalesce((
        select o.can_view
        from public.studio_role_module_overrides as o
        where o.tenant_id = v_tenant and o.role = v_role
          and o.module_id = 'fidelizacion'
      ), v_role in ('commercial', 'support'))
      or coalesce((
        select o.can_view
        from public.studio_role_module_overrides as o
        where o.tenant_id = v_tenant and o.role = v_role
          and o.module_id = 'kommo'
      ), v_role = 'commercial')
    into v_allowed;
  end if;
  if not v_allowed then
    raise exception 'Acceso no autorizado a facturación anual'
      using errcode = '42501';
  end if;

  -- El parámetro existe para alinear el reloj del servidor web con Postgres,
  -- no para consultar ventanas históricas arbitrarias.
  if p_as_of is null
     or p_as_of < current_date - 1
     or p_as_of > current_date + 1 then
    raise exception 'Fecha de referencia no permitida'
      using errcode = '22023';
  end if;

  return query
  with converted as materialized (
    select i.client_markbox, c.usd, c.fx_state
    from public.invoices i
    cross join lateral annual_billing_private.convertir_factura_anual_usd(i.total_amount, i.currency::text, i.fx_rate) c
    where i.tenant_id = v_tenant and i.deleted_at is null and i.client_markbox <> ''
      and i.status in ('emitida', 'parcial', 'pagada', 'vencida')
      and coalesce(i.issued_at, (i.created_at at time zone 'UTC')::date) >= (p_as_of - interval '1 year')::date
      and coalesce(i.issued_at, (i.created_at at time zone 'UTC')::date) <= p_as_of
  )
  select c.client_markbox,
    case when bool_or(c.fx_state = 'datos_invalidos') then null else (coalesce(sum(c.usd),0)::numeric(1000,2))::text end,
    count(*) filter (where c.fx_state = 'sin_tasa'),
    case when bool_or(c.fx_state = 'datos_invalidos') then 'datos_invalidos'
         when bool_or(c.fx_state = 'sin_tasa') then 'sin_tasa' else 'completo' end
  from converted c group by c.client_markbox order by c.client_markbox;
end;
$$;
alter function public.studio_client_annual_billing_v2(date) owner to postgres;
revoke all on function public.studio_client_annual_billing_v2(date) from public, anon, authenticated, service_role;
grant execute on function public.studio_client_annual_billing_v2(date) to authenticated;
comment on function public.studio_client_annual_billing_v2(date) is 'SDD-0572: subtotal anual exacto y estado por Shipping Mark; tasa congelada, tenant de sesión y permisos efectivos de 0411. V1 se conserva.';

create or replace function public.get_portal_referral_program()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  with principal as (
    select c.tenant_id, pg_catalog.upper(pg_catalog.btrim(c.markbox)) as markbox
    from public.client_users as cu
    join public.clients as c
      on c.id = cu.client_id
     and c.tenant_id = cu.tenant_id
     and c.deleted_at is null
    where cu.auth_user_id = (select auth.uid())
      and cu.status = 'active'
    limit 1
  )
  select pg_catalog.jsonb_build_object(
    'markbox', p.markbox,
    'billing_v2', (
      with converted as materialized (
        select c.usd, c.fx_state from public.invoices i
        cross join lateral annual_billing_private.convertir_factura_anual_usd(i.total_amount, i.currency::text, i.fx_rate) c
        where i.tenant_id = p.tenant_id
          and pg_catalog.upper(pg_catalog.btrim(i.client_markbox)) = p.markbox
          and i.deleted_at is null and i.status::text in ('emitida', 'parcial', 'pagada', 'vencida')
          and coalesce(i.issued_at, i.created_at::date) >= (current_date - interval '1 year')::date
      )
      select pg_catalog.jsonb_build_object(
        'version', 2,
        'subtotal_usd', case when bool_or(c.fx_state = 'datos_invalidos') then null else (coalesce(sum(c.usd),0)::numeric(1000,2))::text end,
        'sin_tasa_count', count(*) filter (where c.fx_state = 'sin_tasa'),
        'conversion_state', case when bool_or(c.fx_state = 'datos_invalidos') then 'datos_invalidos'
          when bool_or(c.fx_state = 'sin_tasa') then 'sin_tasa' else 'completo' end
      ) from converted c
    ),
    'billed_usd', coalesce((
      select sum(case i.currency::text
        when 'USD' then i.total_amount
        when 'USDT' then i.total_amount
        when 'VES' then case when i.fx_rate > 0 then i.total_amount / i.fx_rate else 0 end
        else 0
      end)
      from public.invoices as i
      where i.tenant_id = p.tenant_id
        and pg_catalog.upper(pg_catalog.btrim(i.client_markbox)) = p.markbox
        and i.deleted_at is null
        and i.status::text in ('emitida', 'parcial', 'pagada', 'vencida')
        and coalesce(i.issued_at, i.created_at::date)
          >= (current_date - interval '1 year')::date
    ), 0),
    'referrer_reward_usd', coalesce(rs.referrer_reward_usd, 80),
    'referred_reward_usd', coalesce(rs.referred_reward_usd, 60),
    'referrals', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', recent.id,
          'referred_name', recent.referred_name,
          'referred_company', recent.referred_company,
          'status', recent.status,
          'reward_usd', recent.reward_usd,
          'created_at', recent.created_at
        ) order by recent.created_at desc
      )
      from (
        select r.id, r.referred_name, r.referred_company, r.status,
          r.reward_usd, r.created_at
        from public.referrals as r
        where r.tenant_id = p.tenant_id
          and pg_catalog.upper(pg_catalog.btrim(r.referrer_markbox)) = p.markbox
          and r.deleted_at is null
        order by r.created_at desc
        limit 200
      ) as recent
    ), '[]'::jsonb)
  )
  from principal as p
  left join public.referral_settings as rs on rs.tenant_id = p.tenant_id
$function$;

-- CREATE OR REPLACE preserva OID, propietario y ACL Portal; no se reescribe v1.
do $postflight$
declare v_role text;
begin
  if exists (
    select 1 from annual_billing_0498_before b left join pg_catalog.pg_proc p on p.oid=b.oid
    where p.oid is null or p.proowner <> b.proowner or p.proacl is distinct from b.proacl
      or (b.oid='public.studio_client_annual_billing(date)'::regprocedure and pg_catalog.pg_get_functiondef(p.oid) <> b.definition)
  ) then raise exception '0498: identidad, ACL o definición v1 alterada'; end if;
  foreach v_role in array array['anon', 'service_role'] loop
    if pg_catalog.has_function_privilege(v_role,'public.studio_client_annual_billing_v2(date)','EXECUTE') then
      raise exception '0498: ACL pública v2 inválida';
    end if;
  end loop;
  foreach v_role in array array['anon','authenticated','service_role'] loop
    if pg_catalog.has_schema_privilege(v_role,'annual_billing_private','USAGE')
       or pg_catalog.has_function_privilege(v_role,'annual_billing_private.convertir_factura_anual_usd(numeric,text,numeric)','EXECUTE') then
      raise exception '0498: clasificador privado expuesto';
    end if;
  end loop;
  if not pg_catalog.has_function_privilege('authenticated','public.studio_client_annual_billing_v2(date)','EXECUTE')
     or pg_catalog.pg_get_function_result('public.studio_client_annual_billing_v2(date)'::regprocedure) <> 'TABLE(client_markbox text, subtotal_usd text, sin_tasa_count bigint, conversion_state text)' then
    raise exception '0498: forma o ACL v2 inválida';
  end if;
end;
$postflight$;
notify pgrst, 'reload schema';
