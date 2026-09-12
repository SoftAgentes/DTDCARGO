-- 0404_portal_referidos_por_principal.sql — SDD-0339
--
-- Snapshot mínimo del programa de referidos. La identidad sale de auth.uid();
-- no acepta markbox, client_id ni tenant_id y omite contacto/notas del referido.
-- NO aplicar a Producción desde esta rama. Requiere autorización específica.

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

comment on function public.get_portal_referral_program() is
  'SDD-0339: snapshot mínimo de referidos del cliente Portal autenticado; '
  'identidad derivada de auth.uid(), sin ids de entrada ni PII de contacto.';

revoke all on function public.get_portal_referral_program()
  from public, anon, service_role;
grant execute on function public.get_portal_referral_program()
  to authenticated;
