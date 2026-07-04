-- ─────────────────────────────────────────────────────────────
-- SDD-0146 · Bitácora — enums transversales (Fase 1)
--
-- SEPARADA de 0213 a propósito (gotcha Postgres: un valor de enum agregado
-- con ALTER TYPE ... ADD VALUE no se puede USAR en la misma transacción).
-- Se aplica JUNTO a 0213 (misma tanda del founder, transacción aparte).
--
--   1. document_entity_type + 'bitacora_task' + recreate del helper
--      document_entity_in_tenant() (0097) con el CASE nuevo → los adjuntos de
--      tarea van al hub documents (Fase 4).
--   2. bug_notif_type + 'bitacora_task' y 'bitacora_digest' (0028) → eventos
--      de notificación de Bitácora sobre la infra SDD-0036 (Fase 5).
--   3. CHECK de comments.entity_type + 'bitacora_task' y CASE nuevo en
--      comment_entity_in_tenant() (0090/0093) → comentarios en tareas (Fase 4).
--      (Es text+check, no enum — podría vivir en 0213; queda acá para tener
--      TODO lo transversal en un solo archivo.)
--
-- Aditiva. Sin DDL destructivo (el drop del CHECK se recrea ampliado en el
-- mismo statement-block). NO aplicar a prod (lo hace el founder).
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. documents · entity_type 'bitacora_task'                 ║
-- ╚═══════════════════════════════════════════════════════════╝
alter type document_entity_type add value if not exists 'bitacora_task';

-- Recreate del helper polimórfico (0097) sumando la rama bitacora_task.
-- (plpgsql parsea el body en el primer uso → el valor nuevo del enum solo se
-- referencia como literal del CASE, sin usarlo en esta transacción.)
create or replace function public.document_entity_in_tenant(
  p_type   document_entity_type,
  p_id     uuid,
  p_tenant uuid
) returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  ok boolean := false;
begin
  if p_type = 'none' or p_id is null then
    return true;
  end if;

  case p_type
    when 'shipment' then
      select exists(select 1 from public.shipments where id = p_id and tenant_id = p_tenant and deleted_at is null) into ok;
    when 'invoice' then
      select exists(select 1 from public.invoices where id = p_id and tenant_id = p_tenant and deleted_at is null) into ok;
    when 'supplier_bill' then
      select exists(select 1 from public.supplier_bills where id = p_id and tenant_id = p_tenant and deleted_at is null) into ok;
    when 'supplier_payment' then
      select exists(select 1 from public.supplier_payments where id = p_id and tenant_id = p_tenant and deleted_at is null) into ok;
    when 'journal_entry' then
      select exists(select 1 from public.journal_entries where id = p_id and tenant_id = p_tenant and deleted_at is null) into ok;
    when 'client' then
      select exists(select 1 from public.clients where id = p_id and tenant_id = p_tenant and deleted_at is null) into ok;
    when 'supplier' then
      select exists(select 1 from public.suppliers where id = p_id and tenant_id = p_tenant and deleted_at is null) into ok;
    when 'consolidation' then
      select exists(select 1 from public.consolidations where id = p_id and tenant_id = p_tenant and deleted_at is null) into ok;
    when 'booking' then
      select exists(select 1 from public.bookings where id = p_id and tenant_id = p_tenant and deleted_at is null) into ok;
    when 'bitacora_task' then
      -- SDD-0146: bitacora_tasks no tiene deleted_at (ciclo de vida = estado).
      select exists(select 1 from public.bitacora_tasks where id = p_id and tenant_id = p_tenant) into ok;
    else
      ok := false; -- tipo desconocido → rechaza (fail-closed; el enum ya acota el set)
  end case;

  return ok;
end;
$$;

comment on function public.document_entity_in_tenant is
  'SDD-0049 (+SDD-0146 bitacora_task): ¿(entity_type, entity_id) existe, es del tipo correcto y del tenant? Polimórfico (sin FK). none/null → true. Defiende contra entity_id forjado vía PostgREST directo.';

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. bug_notif_type · eventos de Bitácora (infra SDD-0036)   ║
-- ╚═══════════════════════════════════════════════════════════╝
alter type bug_notif_type add value if not exists 'bitacora_task';
alter type bug_notif_type add value if not exists 'bitacora_digest';

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. comments · entity_type 'bitacora_task' (text + CHECK)   ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Nombre auto-generado del CHECK inline de 0090.
alter table public.comments
  drop constraint if exists comments_entity_type_check;

alter table public.comments
  add constraint comments_entity_type_check check (entity_type in (
    'shipment',
    'client',
    'invoice',
    'quote',
    'dispatch_order',
    'supplier_bill',
    'warehouse_receipt_cn',
    'warehouse_receipt_ve',
    'bitacora_task'
  ));

-- Recreate del helper de comentarios (0093) sumando la rama bitacora_task.
create or replace function public.comment_entity_in_tenant(
  p_entity_type text,
  p_entity_id   uuid,
  p_tenant_id   uuid
) returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  ok boolean := false;
begin
  case p_entity_type
    when 'shipment' then
      select exists(select 1 from public.shipments where id = p_entity_id and tenant_id = p_tenant_id) into ok;
    when 'client' then
      select exists(select 1 from public.clients where id = p_entity_id and tenant_id = p_tenant_id) into ok;
    when 'invoice' then
      select exists(select 1 from public.invoices where id = p_entity_id and tenant_id = p_tenant_id) into ok;
    when 'quote' then
      select exists(select 1 from public.quotes where id = p_entity_id and tenant_id = p_tenant_id) into ok;
    when 'dispatch_order' then
      select exists(select 1 from public.dispatch_orders where id = p_entity_id and tenant_id = p_tenant_id) into ok;
    when 'supplier_bill' then
      select exists(select 1 from public.supplier_bills where id = p_entity_id and tenant_id = p_tenant_id) into ok;
    when 'warehouse_receipt_cn' then
      select exists(select 1 from public.warehouse_receipts_cn where id = p_entity_id and tenant_id = p_tenant_id) into ok;
    when 'warehouse_receipt_ve' then
      select exists(select 1 from public.warehouse_receipts_ve where id = p_entity_id and tenant_id = p_tenant_id) into ok;
    when 'bitacora_task' then
      -- SDD-0146: comentarios sobre tareas de Bitácora (Fase 4).
      select exists(select 1 from public.bitacora_tasks where id = p_entity_id and tenant_id = p_tenant_id) into ok;
    else
      ok := false; -- tipo desconocido → rechaza (fail-closed; el CHECK ya acota el set)
  end case;
  return ok;
end;
$$;

comment on function public.comment_entity_in_tenant is
  'SDD-0045 (+SDD-0146 bitacora_task): ¿la entidad comentada existe y es del tenant? Fail-closed. Lo usa comments_validate_entity_trg.';

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0214_bitacora_enums.sql
-- ─────────────────────────────────────────────────────────────
