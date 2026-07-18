-- ─────────────────────────────────────────────────────────────
-- SDD-0159 · Configurar referidos — montos del programa editables desde el ERP
--
-- Los dos montos del programa de referidos (SDD-0051) estaban HARDCODEADOS:
--   · REFERRAL_RULES (lib/studio/fidelizacion/types.ts) → front del cliente + correo.
--   · reward_usd = 80 FIJO dentro del trigger accredit_referral_on_first_invoice
--     (0197) → la acreditación real, que alimenta el asiento contable (SDD-0137).
--
-- Esta migración los saca al Studio: una fila por tenant (singleton, tenant_id PK,
-- mismo patrón que calculator_settings 0103) que el admin edita en
-- Fidelización › Configurar referidos. Los tres consumidores la leen con fallback
-- a $80/$60 (cero regresión si no hay fila).
--
-- CONGELADO POR FILA: cambiar la config afecta SOLO referidos nuevos. Los que ya
-- acreditaron conservan su referrals.reward_usd (columna, no config viva) → el
-- asiento contable no se toca retroactivamente.
--
-- Aditiva: crea 1 tabla nueva + reescribe el trigger de 0197 con create or replace
-- (append-only; 0197 NO se edita). CHECKs de cordura (montos ≥ 0).
--
-- ⚠️ NO se aplica a prod desde acá (lo hace el founder; runbook
--    aplicar-migraciones-prod.md · OK nombrando el archivo · de a UNA).
-- Número de migración: 0250 (siguiente libre tras 0249).
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. TABLA · referral_settings (singleton por tenant)       ║
-- ╚═══════════════════════════════════════════════════════════╝
create table if not exists public.referral_settings (
  tenant_id           uuid primary key references public.tenants(id) on delete cascade,
  referrer_reward_usd numeric(12,2) not null default 80,   -- crédito al referidor al acreditarse
  referred_reward_usd numeric(12,2) not null default 60,   -- descuento al referido en su 1er embarque
  updated_at          timestamptz not null default now(),
  updated_by          uuid references auth.users(id),
  constraint referral_settings_referrer_nonneg check (referrer_reward_usd >= 0),
  constraint referral_settings_referred_nonneg check (referred_reward_usd >= 0)
);

comment on table public.referral_settings is
  'SDD-0159: montos del programa de referidos, editables desde el ERP (Fidelización). Una fila por tenant. La leen el front del cliente, el correo de invitación y el trigger accredit_referral_on_first_invoice. Sin fila → fallback $80/$60 (REFERRAL_RULES). Los referidos ya acreditados conservan su reward_usd congelado.';

-- GRANTS EXPLÍCITOS (auto-expose new tables OFF en este proyecto Supabase).
grant select, insert, update on public.referral_settings to authenticated;
grant all on public.referral_settings to service_role;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. RLS · por tenant (patrón calculator_settings 0103)     ║
-- ╚═══════════════════════════════════════════════════════════╝
alter table public.referral_settings enable row level security;

create policy "referral_settings by tenant"
  on public.referral_settings for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());

create policy "referral_settings service_role all"
  on public.referral_settings for all to service_role using (true) with check (true);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. TRIGGER updated_at (reusa touch_updated_at de 0002)    ║
-- ╚═══════════════════════════════════════════════════════════╝
create trigger referral_settings_touch
  before update on public.referral_settings
  for each row execute function public.touch_updated_at();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 4. SEED · fila default para el tenant dtd                 ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Sin esto el programa igual anda (los consumidores caen al fallback $80/$60),
-- pero el form del Studio arranca poblado en vez de vacío.
insert into public.referral_settings (tenant_id)
select t.id from public.tenants t where t.slug = 'dtd'
on conflict (tenant_id) do nothing;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 5. TRIGGER de acreditación · reward_usd desde la config   ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Reescribe accredit_referral_on_first_invoice (0197): el monto que estampa deja
-- de ser 80 fijo y pasa a leer referral_settings.referrer_reward_usd del tenant,
-- con fallback 80 (= REFERRAL_RULES.referrerReward) si aún no hay fila. Todo lo
-- demás (idempotencia por estado, resolución del cliente por markbox, guardas) es
-- IDÉNTICO a 0197. SECURITY DEFINER: lee referral_settings sin depender del grant
-- del rol caller, scopeado explícito por new.tenant_id.
create or replace function public.accredit_referral_on_first_invoice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client uuid;
  v_reward numeric(12,2);
begin
  if new.deleted_at is not null then
    return new;
  end if;
  if new.status::text not in ('emitida', 'parcial', 'pagada', 'vencida') then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;

  -- Resolver el cliente por markbox (shipments/invoices no tienen client_id).
  select id into v_client
  from public.clients
  where markbox = new.client_markbox
    and tenant_id = new.tenant_id
    and deleted_at is null
  limit 1;

  if v_client is null then
    return new;
  end if;

  -- SDD-0159: monto del crédito desde la config del tenant (fallback 80).
  select rs.referrer_reward_usd into v_reward
  from public.referral_settings rs
  where rs.tenant_id = new.tenant_id;
  v_reward := coalesce(v_reward, 80);

  -- Acreditar idempotente por estado: solo referidos aún pendientes de este
  -- cliente. La 1ª factura los pasa a 'acreditado'; las siguientes no matchean.
  update public.referrals
     set status     = 'acreditado',
         reward_usd = v_reward,
         updated_at = now()
   where referred_client_id = v_client
     and tenant_id = new.tenant_id
     and status in ('registrado', 'primer-embarque')
     and deleted_at is null;

  return new;
end;
$$;

comment on function public.accredit_referral_on_first_invoice is
  'SDD-0051 Fase 2 (+ SDD-0159): en la 1ª factura billable de un cliente referido, acredita al referidor (referrals.status=acreditado + reward_usd desde referral_settings, fallback 80). Advisory: NO postea a CxC. Idempotente por estado.';

-- SECURITY DEFINER → revocar EXECUTE del público (convención de seguridad del
-- repo; el trigger dispara igual). Idempotente.
revoke execute on function public.accredit_referral_on_first_invoice() from public, anon;

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0250_referral_settings.sql
-- Aplicar con: supabase migration apply 0250 · o MCP apply_migration
-- (lo hace el founder; el harness NO aplica a prod).
-- ─────────────────────────────────────────────────────────────
