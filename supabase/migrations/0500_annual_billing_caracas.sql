-- 0500 · SDD-0576 C2 · Día civil Caracas para lecturas anuales.
-- Solo las tres fachadas completas; reloj de transacción, sin DML ni grants.
-- MIGRATE-FIRST después de revisión y OK nominal. Las RPC ya existen:
-- una app anterior puede enviar UTC válido por ±1 y leer otra ventana.
-- Ejecutar íntegra en una transacción. No aplicar sobre DB real desde el Worker.
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
declare item record;
begin
  for item in select * from (values
    ('public.studio_client_annual_billing(date)', '7c2b0441e1de89bbf4f23054813acc5b', 'TABLE(client_markbox text, billed_usd numeric)'),
    ('public.studio_client_annual_billing_v2(date)', '6cf40c5a38865b2bba9b1bb5017cc620', 'TABLE(client_markbox text, subtotal_usd text, sin_tasa_count bigint, conversion_state text)'),
    ('public.get_portal_referral_program()', 'faa932bd5dac31bc560ed2085670432d', 'jsonb')
  ) expected(signature, body_md5, result_type) loop
    if not exists (select 1 from pg_catalog.pg_proc p where p.oid=pg_catalog.to_regprocedure(item.signature)
      and p.proowner='postgres'::regrole and p.prosecdef and p.provolatile='s'
      and p.proconfig @> array['search_path=""']
      and pg_catalog.pg_get_function_result(p.oid)=item.result_type
      and pg_catalog.md5(p.prosrc)=item.body_md5) then
      raise exception '0500: fachada previa distinta de base 0411/0498: %', item.signature;
    end if;
  end loop;
  if pg_catalog.to_regprocedure('annual_billing_private.convertir_factura_anual_usd(numeric,text,numeric)') is null
     or pg_catalog.to_regprocedure('public.to_usd(numeric,text,numeric)') is null
     or pg_catalog.to_regprocedure('public.get_user_tenant_id()') is null
     or pg_catalog.to_regprocedure('public.current_studio_role()') is null
     or not exists (select 1 from pg_catalog.pg_policies where schemaname='public' and tablename='invoices' and policyname='invoices_accounting_select' and cmd='SELECT')
     or exists (select 1 from pg_catalog.pg_policies where schemaname='public' and tablename='invoices' and policyname='invoices_team_select') then
    raise exception '0500: faltan prerrequisitos de base anual vigente';
  end if;
end;
$preflight$;

create temporary table annual_billing_0500_before on commit drop as
select p.oid, p.proowner, p.proacl, p.prosecdef, p.provolatile, p.proconfig, p.prolang,
       pg_catalog.pg_get_function_result(p.oid) as result_type,
       pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments,
       array(select pg_catalog.has_function_privilege(r,p.oid,'EXECUTE')
             from unnest(array['anon','authenticated','service_role']) r) as effective_acl
from pg_catalog.pg_proc p where p.oid in (
 'public.studio_client_annual_billing(date)'::regprocedure,
 'public.studio_client_annual_billing_v2(date)'::regprocedure,
 'public.get_portal_referral_program()'::regprocedure);
create temporary table annual_billing_0500_helpers on commit drop as
select oid, pg_catalog.pg_get_functiondef(oid) as definition, proowner, proacl
from pg_catalog.pg_proc where oid in (
 'public.to_usd(numeric,text,numeric)'::regprocedure,
 'annual_billing_private.convertir_factura_anual_usd(numeric,text,numeric)'::regprocedure,
 'public.get_user_tenant_id()'::regprocedure, 'public.current_studio_role()'::regprocedure);

create or replace function public.studio_client_annual_billing(p_as_of date)
returns table (
  client_markbox text,
  billed_usd numeric
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
     or p_as_of < (pg_catalog.transaction_timestamp() at time zone 'America/Caracas')::date - 1
     or p_as_of > (pg_catalog.transaction_timestamp() at time zone 'America/Caracas')::date + 1 then
    raise exception 'Fecha de referencia no permitida'
      using errcode = '22023';
  end if;

  return query
  select
    i.client_markbox,
    pg_catalog.sum(
      case
        when i.currency in ('USD', 'USDT') then i.total_amount
        when i.currency = 'VES' and i.fx_rate > 0
          then i.total_amount / i.fx_rate
        else 0::numeric
      end
    ) as billed_usd
  from public.invoices as i
  where i.tenant_id = v_tenant
    and i.deleted_at is null
    and i.client_markbox <> ''
    and i.status in ('emitida', 'parcial', 'pagada', 'vencida')
    and coalesce(
      i.issued_at,
      (i.created_at at time zone 'America/Caracas')::date
    ) >= (p_as_of - interval '1 year')::date
    and coalesce(
      i.issued_at,
      (i.created_at at time zone 'America/Caracas')::date
    ) <= p_as_of
  group by i.client_markbox
  having pg_catalog.sum(
    case
      when i.currency in ('USD', 'USDT') then i.total_amount
      when i.currency = 'VES' and i.fx_rate > 0
        then i.total_amount / i.fx_rate
      else 0::numeric
    end
  ) > 0
  order by i.client_markbox;
end;
$$;

create or replace function public.studio_client_annual_billing_v2(p_as_of date)
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
     or p_as_of < (pg_catalog.transaction_timestamp() at time zone 'America/Caracas')::date - 1
     or p_as_of > (pg_catalog.transaction_timestamp() at time zone 'America/Caracas')::date + 1 then
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
      and coalesce(i.issued_at, (i.created_at at time zone 'America/Caracas')::date) >= (p_as_of - interval '1 year')::date
      and coalesce(i.issued_at, (i.created_at at time zone 'America/Caracas')::date) <= p_as_of
  )
  select c.client_markbox,
    case when bool_or(c.fx_state = 'datos_invalidos') then null else (coalesce(sum(c.usd),0)::numeric(1000,2))::text end,
    count(*) filter (where c.fx_state = 'sin_tasa'),
    case when bool_or(c.fx_state = 'datos_invalidos') then 'datos_invalidos'
         when bool_or(c.fx_state = 'sin_tasa') then 'sin_tasa' else 'completo' end
  from converted c group by c.client_markbox order by c.client_markbox;
end;
$$;

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
          and coalesce(i.issued_at, (i.created_at at time zone 'America/Caracas')::date) >= ((pg_catalog.transaction_timestamp() at time zone 'America/Caracas')::date - interval '1 year')::date
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
        and coalesce(i.issued_at, (i.created_at at time zone 'America/Caracas')::date)
          >= ((pg_catalog.transaction_timestamp() at time zone 'America/Caracas')::date - interval '1 year')::date
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

-- CREATE OR REPLACE preserva las ACL diferenciadas: v1 conserva el default
-- service_role de0033; Portal/v2 lo revocaron. No se homogeneizan privilegios.
do $postflight$
begin
  if exists (select 1 from annual_billing_0500_before b left join pg_catalog.pg_proc p on p.oid=b.oid
    where p.oid is null or (p.proowner,p.prosecdef,p.provolatile,p.prolang) is distinct from (b.proowner,b.prosecdef,b.provolatile,b.prolang)
      or p.proacl is distinct from b.proacl or p.proconfig is distinct from b.proconfig
      or pg_catalog.pg_get_function_result(p.oid)<>b.result_type
      or pg_catalog.pg_get_function_identity_arguments(p.oid)<>b.arguments
      or array(select pg_catalog.has_function_privilege(r,p.oid,'EXECUTE') from unnest(array['anon','authenticated','service_role']) r) is distinct from b.effective_acl)
    or exists (select 1 from annual_billing_0500_helpers b left join pg_catalog.pg_proc p on p.oid=b.oid
      where p.oid is null or pg_catalog.pg_get_functiondef(p.oid)<>b.definition or p.proowner<>b.proowner or p.proacl is distinct from b.proacl) then
    raise exception '0500: identidad, contrato, seguridad o helpers alterados';
  end if;
end;
$postflight$;
notify pgrst, 'reload schema';
