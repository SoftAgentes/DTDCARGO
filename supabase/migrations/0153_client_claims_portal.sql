-- ─────────────────────────────────────────────────────────────
-- SDD-0101 Slice B: el CLIENTE reporta reclamos desde el Portal.
--
-- Aditiva sobre 0152. Agrega:
--   1. columna `source` (studio | portal) — marca quién originó el reclamo,
--   2. policy SELECT para el cliente del portal (ve los suyos por markbox),
--   3. `next_claim_code_service` — gemela de next_claim_code SIN
--      assert_tenant_match, para el path-servidor-de-confianza del portal
--      (patrón next_markbox_service, migr 0109).
--
-- El INSERT del cliente NO va por RLS a propósito: la action del portal usa el
-- ADMIN client (service_role) y CONTROLA los campos sensibles (amount_usd=0,
-- insured=false, status='reportado', source='portal'). Así el cliente no puede
-- forjar un monto/seguro/estado ni un reclamo de otro tenant. El cliente solo
-- VE (esta policy) — el equipo gestiona el ciclo de vida (Slice A).
--
-- NO aplicar a prod (lo hace la coordinación / founder).
-- ─────────────────────────────────────────────────────────────

-- 1. Origen del reclamo (aditiva, default 'studio' para las filas existentes).
alter table public.client_claims
  add column if not exists source text not null default 'studio'
    check (source in ('studio', 'portal'));

comment on column public.client_claims.source is
  'SDD-0101 Slice B: origen del reclamo — studio (equipo) | portal (lo reportó el cliente).';

-- 2. El cliente del portal VE sus reclamos (por markbox). Policy PERMISSIVE que
--    se suma a "client_claims by tenant": un cliente del portal (no está en
--    user_tenants) solo matchea esta; un user de equipo solo matchea la de
--    tenant. Las queries del portal filtran EXPLÍCITO por markbox además (defensa
--    en profundidad, criterio del resto del portal). Sin INSERT/UPDATE/DELETE:
--    el cliente no muta — la creación va por la action con admin client.
create policy "client_claims portal self read"
  on public.client_claims for select
  to authenticated
  using (
    deleted_at is null
    and client_markbox = public.get_portal_client_markbox()
  );

-- 3. Correlativo RC-YYYY-NNN para el portal. El cliente del portal NO está en
--    user_tenants → assert_tenant_match() fallaría. Esta gemela NO valida tenant
--    autenticado; solo service_role la ejecuta (la action del portal, server-side,
--    ya resolvió el tenant del cliente vía su client_id). Misma lógica de
--    correlativo que next_claim_code; el unique (tenant_id, claim_code) protege
--    contra carreras.
create or replace function public.next_claim_code_service(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year text := to_char(now(), 'YYYY');
  v_max  int;
begin
  if p_tenant_id is null then
    raise exception 'Tenant ID required' using errcode = '42501';
  end if;

  select coalesce(max((regexp_match(claim_code, '^RC-' || v_year || '-(\d+)$'))[1]::int), 0) + 1
    into v_max
    from public.client_claims
   where tenant_id = p_tenant_id;

  return 'RC-' || v_year || '-' || lpad(v_max::text, 3, '0');
end;
$$;

comment on function public.next_claim_code_service is
  'SDD-0101 Slice B: próximo RC-YYYY-NNN para el path-servidor-de-confianza del portal (sin assert_tenant_match). SOLO service_role.';

revoke all on function public.next_claim_code_service(uuid) from public;
revoke all on function public.next_claim_code_service(uuid) from anon;
revoke all on function public.next_claim_code_service(uuid) from authenticated;
grant execute on function public.next_claim_code_service(uuid) to service_role;
