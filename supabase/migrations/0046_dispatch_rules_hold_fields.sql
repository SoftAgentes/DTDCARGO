-- ─────────────────────────────────────────────────────────────
-- Hold mode para dispatch_rules · Tier 2.2 FULL
--
-- Cuando payment_policy='hold', el admin puede definir hasta cuándo
-- dura la suspensión + razón visible al equipo. Vencida la fecha, la
-- política vuelve automáticamente a 'estricto' (interpretado por el
-- scoring engine).
--
-- Aditivo · NULLABLE · backward-compat.
-- ─────────────────────────────────────────────────────────────

alter table public.dispatch_rules
  add column if not exists hold_until date,
  add column if not exists hold_reason text;

comment on column public.dispatch_rules.hold_until is
  'Fecha hasta la cual el modo hold está activo. NULL si no aplica. Vencida, scoring trata como estricto.';

comment on column public.dispatch_rules.hold_reason is
  'Texto libre explicando por qué se activó el hold · visible al equipo.';

-- ─────────────────────────────────────────────────────────────
-- upsert_dispatch_rules · ahora persiste hold_until + hold_reason
-- ─────────────────────────────────────────────────────────────

create or replace function public.upsert_dispatch_rules(
  p_tenant_id uuid,
  p_payload jsonb
)
returns public.dispatch_rules
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.dispatch_rules;
begin
  if not exists (
    select 1 from public.user_tenants
    where user_id = auth.uid() and tenant_id = p_tenant_id
  ) then
    raise exception 'No autorizado para tenant %', p_tenant_id;
  end if;

  insert into public.dispatch_rules (
    tenant_id, payment_policy, whitelist_markboxes,
    weights, optional_rules, vip_markboxes,
    hold_until, hold_reason,
    updated_by, updated_at
  )
  values (
    p_tenant_id,
    coalesce((p_payload->>'payment_policy')::dispatch_payment_policy, 'estricto'),
    coalesce(
      (select array_agg(value) from jsonb_array_elements_text(p_payload->'whitelist_markboxes') as value),
      '{}'
    ),
    coalesce(p_payload->'weights', jsonb_build_object(
      'valencia', 40, 'full_pay', 30, 'partial_pay', 15,
      'fifo', 15, 'vip', 10, 'route_proximity', 5
    )),
    coalesce(p_payload->'optional_rules', jsonb_build_object('tier', false, 'routes', true)),
    coalesce(
      (select array_agg(value) from jsonb_array_elements_text(p_payload->'vip_markboxes') as value),
      '{}'
    ),
    nullif(p_payload->>'hold_until', '')::date,
    nullif(trim(p_payload->>'hold_reason'), ''),
    auth.uid(),
    now()
  )
  on conflict (tenant_id) do update set
    payment_policy       = excluded.payment_policy,
    whitelist_markboxes  = excluded.whitelist_markboxes,
    weights              = excluded.weights,
    optional_rules       = excluded.optional_rules,
    vip_markboxes        = excluded.vip_markboxes,
    hold_until           = excluded.hold_until,
    hold_reason          = excluded.hold_reason,
    updated_by           = excluded.updated_by,
    updated_at           = excluded.updated_at
  returning * into v_row;

  return v_row;
end;
$$;

comment on function public.upsert_dispatch_rules(uuid, jsonb) is
  'Upsert idempotente de dispatch_rules con hold_until + hold_reason (Tier 2.2 FULL). Last-write-wins.';

grant execute on function public.upsert_dispatch_rules(uuid, jsonb) to authenticated;
