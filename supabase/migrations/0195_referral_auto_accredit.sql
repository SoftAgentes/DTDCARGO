-- ─────────────────────────────────────────────────────────────
-- SDD-0051 · Fidelización & Referidos — Fase 2 (acreditación automática)
--
-- Cierra el lazo del programa de referidos: cuando el cliente REFERIDO emite su
-- PRIMERA FACTURA (primera compra real), se acredita AUTOMÁTICO el crédito al
-- REFERIDOR — sin intervención del operador.
--
-- Decisiones del founder (2026-07-01):
--   · Señal de "primera compra" = primera factura en estado billable
--     (emitida/parcial/pagada/vencida). NO el embarque.
--   · "Acreditar" = REGISTRAR el crédito (status='acreditado' + reward_usd=80,
--     visible en el portal del referidor). Es ADVISORY: el asesor lo aplica en la
--     próxima factura. El trigger NO postea a CxC/facturación ni mueve plata.
--
-- Idempotente POR ESTADO: solo la 1ª factura encuentra el referido en
-- 'registrado' y lo acredita; las siguientes lo ven 'acreditado' y no hacen nada
-- (no hace falta contar "es la primera"). El link referido↔cliente lo setea el
-- registro con ?ref= (Fase A · referred_client_id + status='registrado').
--
-- Aditiva: NO toca tablas existentes salvo un índice nuevo en referrals. Reusa
-- el enum referral_status + tabla referrals (0098). shipments/invoices linkean por
-- client_markbox → se resuelve a clients.id → referrals.referred_client_id.
--
-- Patrón de trigger: 0003_shipment_events_on_insert.sql (AFTER INSERT, SECURITY
-- DEFINER, search_path=public). FK index: buenas prácticas Postgres (el trigger
-- filtra referrals por referred_client_id, que hoy no tenía índice).
--
-- ⚠️ NO se aplica a prod desde acá (lo hace el Director/founder).
-- Número de migración: 0195 (siguiente libre tras 0194).
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. ÍNDICE FK · referrals.referred_client_id               ║
-- ╚═══════════════════════════════════════════════════════════╝
-- El trigger actualiza referrals filtrando por referred_client_id; sin índice
-- sería un scan por cada factura emitida. Parcial (solo filas vivas).
create index if not exists referrals_referred_client_idx
  on public.referrals (referred_client_id)
  where deleted_at is null and referred_client_id is not null;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. FUNCIÓN · acreditar al referidor en la 1ª factura      ║
-- ╚═══════════════════════════════════════════════════════════╝
-- SECURITY DEFINER: lee clients + actualiza referrals sin depender de los grants
-- del rol caller. Scopeado EXPLÍCITO por NEW.tenant_id (que RLS ya forzó = tenant
-- del caller) → sin fuga cross-tenant. reward_usd = 80 (REFERRAL_RULES.referrerReward).
create or replace function public.accredit_referral_on_first_invoice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client uuid;
begin
  -- Solo facturas "billable" y vivas. En UPDATE, solo si el status cambió
  -- (evita re-disparos por otras ediciones de la factura).
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

  -- Acreditar idempotente por estado: solo referidos aún pendientes de este
  -- cliente. La 1ª factura los pasa a 'acreditado'; las siguientes no matchean.
  update public.referrals
     set status     = 'acreditado',
         reward_usd = 80,               -- REFERRAL_RULES.referrerReward (USD)
         updated_at = now()
   where referred_client_id = v_client
     and tenant_id = new.tenant_id
     and status in ('registrado', 'primer-embarque')
     and deleted_at is null;

  return new;
end;
$$;

comment on function public.accredit_referral_on_first_invoice is
  'SDD-0051 Fase 2: en la 1ª factura billable de un cliente referido, acredita al referidor (referrals.status=acreditado + reward_usd=80). Advisory: NO postea a CxC. Idempotente por estado.';

-- Función trigger · NO se expone a la API. Revocar EXECUTE del público (convención
-- de seguridad del repo; SECURITY DEFINER). Los triggers disparan igual (no
-- dependen del EXECUTE del rol invocante). Llamarla directo, además, ya falla
-- ("trigger functions can only be called as triggers").
revoke execute on function public.accredit_referral_on_first_invoice() from public, anon;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. TRIGGER · AFTER INSERT OR UPDATE OF status en invoices ║
-- ╚═══════════════════════════════════════════════════════════╝
drop trigger if exists invoices_accredit_referral on public.invoices;
create trigger invoices_accredit_referral
  after insert or update of status on public.invoices
  for each row execute function public.accredit_referral_on_first_invoice();

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0195_referral_auto_accredit.sql
-- Aplicar con: supabase migration apply 0195 · o MCP apply_migration
-- (lo hace el Director/founder; el harness NO aplica a prod).
-- ─────────────────────────────────────────────────────────────
