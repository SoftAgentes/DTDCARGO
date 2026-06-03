-- ─────────────────────────────────────────────────────────────
-- SDD-0051 · Fidelización & Referidos — Slice A (foundation)
--
-- Construye la capa de RETENCIÓN del Bloque 5 (Comercial). Dos piezas:
--   · Niveles (tiers) = DERIVADOS de la facturación trailing-12m de invoices
--     → 0 tablas (se computan en lib/studio/fidelizacion/queries.ts). Esta
--     migración NO los toca.
--   · Referidos = tabla nueva `referrals` + enum `referral_status` + RPC
--     next_referral_code (REF-YYYY-NNNN, patrón next_quote_code de 0007).
--
-- + RLS fail-closed por tenant_id (patrón get_user_tenant_id, 0096/0090).
-- + Validación de integridad cross-tenant en la DB (lección [[0045]] / 0093):
--   helper referral_client_in_tenant() + trigger referrals_validate_clients
--   BEFORE INSERT OR UPDATE → un cliente PostgREST directo no puede vincular
--   un referidor/referido de otro tenant (la action no es la única defensa).
--
-- Aditiva: NO toca tablas existentes. FK salientes: referrer_client_id /
-- referred_client_id → clients(id) (nullable, on delete set null) — el
-- referrer_markbox queda denormalizado para sobrevivir al borrado del cliente.
-- Reusa get_user_tenant_id() (0001) + touch_updated_at() (0002).
--
-- Sin seed (los referidos los carga el operador; clientes/facturas ya existen).
--
-- ⚠️ NO se aplica a prod desde acá (lo hace el founder).
-- Número de migración: 0098 (siguiente libre tras 0097).
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. ENUM · referral_status                                 ║
-- ╚═══════════════════════════════════════════════════════════╝
create type referral_status as enum (
  'invitado',
  'registrado',
  'primer-embarque',
  'acreditado'
);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. REFERRALS · programa de referidos                      ║
-- ╚═══════════════════════════════════════════════════════════╝
-- El referidor es un cliente existente → FK real referrer_client_id (no
-- polimórfico); el referido aún no es cliente → referred_client_id nullable
-- hasta que se convierte. referrer_markbox denormalizado (display + sobrevive
-- al borrado del cliente). reward_usd se setea al acreditar (advisory en V1,
-- NO postea a CxC). referral_code = REF-YYYY-NNNN (único por tenant).
create table public.referrals (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  referral_code       text not null,                                  -- 'REF-2026-0001'
  referrer_client_id  uuid references public.clients(id) on delete set null,
  referrer_markbox    text not null,                                  -- 'DTD-5452' (denormalizado)
  referred_name       text not null,
  referred_company    text,
  referred_email      text,
  referred_phone      text,
  referred_client_id  uuid references public.clients(id) on delete set null,
  status              referral_status not null default 'invitado',
  reward_usd          numeric(12,2) not null default 0,               -- crédito al referidor (advisory)
  lead_id             text,                                           -- link opcional al CRM/Kommo
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  unique (tenant_id, referral_code)
);

comment on table public.referrals is
  'SDD-0051: programa de referidos. referrer = cliente existente (FK), referido = lead que aún no es cliente (referred_client_id nullable). status invitado→registrado→primer-embarque→acreditado. reward_usd advisory (NO postea a CxC en V1). Soft delete via deleted_at. RLS por tenant_id.';

create index referrals_tenant_status_idx
  on public.referrals (tenant_id, status) where deleted_at is null;

create index referrals_tenant_referrer_idx
  on public.referrals (tenant_id, referrer_markbox) where deleted_at is null;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. VALIDACIÓN cross-tenant en DB (lección [[0045]] / 0093)║
-- ╚═══════════════════════════════════════════════════════════╝
-- Helper: ¿el cliente existe y es del tenant? (null → true, FK opcional).
-- SECURITY DEFINER para no depender del grant SELECT de clients al rol caller;
-- el filtro por tenant_id es explícito (el trigger pasa NEW.tenant_id, que RLS
-- ya forzó = tenant del caller) → no hay fuga cross-tenant.
create or replace function public.referral_client_in_tenant(
  p_client uuid,
  p_tenant uuid
) returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_client is null then
    return true;
  end if;
  return exists (
    select 1 from public.clients
    where id = p_client and tenant_id = p_tenant and deleted_at is null
  );
end;
$$;

-- Trigger: rechaza referrer/referred de otro tenant o inexistente. Cubre
-- PostgREST directo, no sólo la server action.
create or replace function public.referrals_validate_clients()
returns trigger
language plpgsql
as $$
begin
  if not public.referral_client_in_tenant(new.referrer_client_id, new.tenant_id) then
    raise exception 'referidor inexistente o ajeno al tenant: %', new.referrer_client_id
      using errcode = 'check_violation';
  end if;
  if not public.referral_client_in_tenant(new.referred_client_id, new.tenant_id) then
    raise exception 'referido inexistente o ajeno al tenant: %', new.referred_client_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists referrals_validate_clients_trg on public.referrals;
create trigger referrals_validate_clients_trg
  before insert or update on public.referrals
  for each row execute function public.referrals_validate_clients();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 4. RPC · next_referral_code (REF-YYYY-NNNN)               ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Counter por año + tenant (calca next_quote_code de 0007). Si p_tenant es
-- null resuelve el tenant del caller vía get_user_tenant_id(). Padding 4; se
-- extiende solo si pasa de 9999 en un año.
create or replace function public.next_referral_code(p_tenant uuid default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := coalesce(p_tenant, public.get_user_tenant_id());
  v_year   int  := extract(year from current_date);
  v_max    int;
  v_padded text;
begin
  select coalesce(max((regexp_match(referral_code, '^REF-\d{4}-(\d+)$'))[1]::int), 0) + 1
  into v_max
  from public.referrals
  where tenant_id = v_tenant
    and referral_code like 'REF-' || v_year || '-%';

  v_padded := lpad(v_max::text, 4, '0');
  return 'REF-' || v_year || '-' || v_padded;
end;
$$;

comment on function public.next_referral_code is
  'SDD-0051: genera el próximo referral_code REF-YYYY-NNNN para el tenant del año actual (resuelve get_user_tenant_id() si p_tenant null).';

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 5. GRANTS EXPLÍCITOS (auto-expose new tables OFF)         ║
-- ╚═══════════════════════════════════════════════════════════╝
grant select, insert, update, delete on public.referrals to authenticated;
grant all on public.referrals to service_role;

grant execute on function public.next_referral_code(uuid) to authenticated;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 6. RLS · fail-closed por tenant_id (patrón 0096/0090)     ║
-- ╚═══════════════════════════════════════════════════════════╝
alter table public.referrals enable row level security;

create policy "referrals by tenant"
  on public.referrals for all to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

create policy "referrals service_role all"
  on public.referrals for all to service_role using (true) with check (true);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 7. TRIGGER updated_at (reusa touch_updated_at de 0002)    ║
-- ╚═══════════════════════════════════════════════════════════╝
create trigger referrals_touch
  before update on public.referrals
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0098_fidelizacion_referidos.sql
-- Aplicar con: supabase migration apply 0098 · o MCP apply_migration
-- (lo hace el founder; el harness NO aplica a prod).
-- ─────────────────────────────────────────────────────────────
