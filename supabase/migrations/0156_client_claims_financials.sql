-- ─────────────────────────────────────────────────────────────
-- SDD-0101 Slice C: resolución financiera del reclamo del cliente.
--
-- Dos controles que la auditoría adversarial exigió poner EN LA DB (no solo en
-- la server action, porque PostgREST directo evade el código TS):
--
--  1. GATE DE PAGO (crítico). La RLS de client_claims (0152) es `for all` por
--     tenant → cualquier authenticated del tenant (operations/commercial/support)
--     podría `update status='pagado'` directo, saltándose advanceClaimStatusAction.
--     Acá un trigger BEFORE INSERT/UPDATE bloquea la transición a 'pagado' salvo
--     que el rol del caller sea accounting/admin (current_studio_role()). Cubre
--     A/B/C: ninguna transición a 'pagado' escapa el control de poderes.
--
--  2. AISLAMIENTO DE LOS DATOS FINANCIEROS (alto). La policy portal de
--     client_claims da SELECT de la FILA completa → si los campos financieros
--     vivieran en client_claims, el cliente los leería por PostgREST (cobertura,
--     deducible, fault_party='dtd' = admisión de culpa, recupero del proveedor).
--     Por eso van en una TABLA SEPARADA `client_claim_financials` con RLS SOLO
--     equipo (sin policy portal) — el cliente nunca la ve.
--
-- ADVISORY: no crea asientos contables (eso es C2: motor de SDD-0079 + auditoría).
-- NO aplicar a prod (lo hace la coordinación / founder).
-- ─────────────────────────────────────────────────────────────

-- ── Helper: rol del caller en su tenant (para el gate en la DB) ──
create or replace function public.current_studio_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.user_tenants where user_id = auth.uid() limit 1
$$;

comment on function public.current_studio_role is
  'SDD-0101 C: rol del usuario logueado en su tenant (para gates de poderes en triggers).';

revoke all on function public.current_studio_role() from public, anon;
grant execute on function public.current_studio_role() to authenticated;

-- ── 1. Gate de pago en la DB (cierra el bypass PostgREST) ──
create or replace function public.client_claims_guard_pago()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'pagado'
     and (tg_op = 'INSERT' or old.status is distinct from 'pagado') then
    if coalesce(public.current_studio_role(), '') not in ('accounting', 'admin') then
      raise exception 'Solo Contabilidad puede marcar una indemnizacion como pagada'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.client_claims_guard_pago() from public, anon;

drop trigger if exists client_claims_guard_pago_trg on public.client_claims;
create trigger client_claims_guard_pago_trg
  before insert or update of status on public.client_claims
  for each row execute function public.client_claims_guard_pago();

-- ── 2. Tabla separada de datos financieros (solo equipo) ──
create table public.client_claim_financials (
  claim_id                 uuid primary key references public.client_claims(id) on delete cascade,
  tenant_id                uuid not null references public.tenants(id) on delete cascade,
  fault_party              text
    check (fault_party in ('proveedor', 'dtd', 'transportista', 'cliente', 'indeterminado')),
  supplier_claim_offset_id uuid references public.supplier_claim_offsets(id) on delete set null,
  insured_amount_usd       numeric(12,2),
  policy_deductible_usd    numeric(12,2),
  insurer_claim_ref        text,
  updated_at               timestamptz not null default now(),
  updated_by               uuid references auth.users(id) on delete set null
);

comment on table public.client_claim_financials is
  'SDD-0101 C: resolución financiera del reclamo (culpa, recupero del proveedor, póliza). Tabla SEPARADA de client_claims a propósito: RLS solo-equipo, el portal NUNCA la ve.';

create index client_claim_financials_tenant_idx
  on public.client_claim_financials (tenant_id);
create index client_claim_financials_offset_idx
  on public.client_claim_financials (tenant_id, supplier_claim_offset_id)
  where supplier_claim_offset_id is not null;

-- Trigger de coherencia: el claim y el offset deben ser del mismo tenant.
create or replace function public.client_claim_financials_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.client_claims c
    where c.id = new.claim_id and c.tenant_id = new.tenant_id
  ) then
    raise exception 'claim_id % no pertenece al tenant %', new.claim_id, new.tenant_id
      using errcode = 'check_violation';
  end if;

  if new.supplier_claim_offset_id is not null then
    if not exists (
      select 1 from public.supplier_claim_offsets o
      where o.id = new.supplier_claim_offset_id and o.tenant_id = new.tenant_id
    ) then
      raise exception 'supplier_claim_offset_id % no pertenece al tenant %',
        new.supplier_claim_offset_id, new.tenant_id
        using errcode = 'check_violation';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.client_claim_financials_check() from public, anon;

drop trigger if exists client_claim_financials_check_trg on public.client_claim_financials;
create trigger client_claim_financials_check_trg
  before insert or update on public.client_claim_financials
  for each row execute function public.client_claim_financials_check();

-- GRANTS (auto-expose new tables OFF)
grant select, insert, update, delete on public.client_claim_financials to authenticated;

-- RLS: SOLO equipo por tenant. SIN policy portal (el cliente no ve estos datos).
alter table public.client_claim_financials enable row level security;

create policy "client_claim_financials by tenant"
  on public.client_claim_financials for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());
