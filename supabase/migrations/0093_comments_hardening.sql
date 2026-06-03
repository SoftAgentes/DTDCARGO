-- ─────────────────────────────────────────────────────────────
-- SDD-0045 · Hardening de Comentarios (codex challenge)
--
-- Cierra los huecos que el review adversarial (codex) encontró sobre la
-- migración 0090. El patrón común: la server action validaba bien, pero un
-- cliente Supabase autenticado puede saltarse la action y escribir directo vía
-- PostgREST. Estas defensas viven en la DB → cubren TODO cliente.
--
-- 1. comment_entity_in_tenant()   · helper: ¿(entity_type, entity_id) existe y es del tenant?
-- 2. comments_validate_entity     · BEFORE INSERT en comments → rechaza entidad inexistente/ajena
-- 3. comment_mentions_validate    · BEFORE INSERT en comment_mentions → solo mencionar miembros del tenant
-- 4. comment_mentions_freeze      · BEFORE UPDATE en comment_mentions → solo read_at es mutable
--
-- (comments ya tenía su trigger de inmutabilidad — 0090 hardening. Acá se le
--  suma la validación de entidad, y comment_mentions recibe ambos.)
-- NO se aplica a prod desde acá (lo hace el founder / MCP). Número 0093
-- (cedidos 0091 portal · 0092 identidad a las otras ventanas).
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. Helper · ¿la entidad comentada existe y es del tenant? ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Polimórfico (entity_type + entity_id, sin FK por diseño). CASE sobre las 8
-- tablas comentables (todas con tenant_id). SECURITY DEFINER para no depender
-- del grant SELECT de cada tabla al rol authenticated; el filtro por tenant_id
-- es explícito (el trigger pasa NEW.tenant_id, que RLS ya forzó = tenant del
-- caller), así que no hay fuga cross-tenant.
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
    else
      ok := false; -- tipo desconocido → rechaza (fail-closed; el CHECK de 0090 ya acota el set)
  end case;
  return ok;
end;
$$;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. comments · validar entidad in-tenant en INSERT         ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Cierra el [P1] de codex: postComment / un cliente directo podía adjuntar un
-- comentario a un entity_id inexistente, de otro tipo, o de otro tenant (UUID
-- oracle + basura). El trigger lo rechaza para CUALQUIER cliente.
create or replace function public.comments_validate_entity()
returns trigger
language plpgsql
as $$
begin
  if not public.comment_entity_in_tenant(new.entity_type, new.entity_id, new.tenant_id) then
    raise exception 'comentario sobre entidad inexistente o ajena al tenant: %/%', new.entity_type, new.entity_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists comments_validate_entity_trg on public.comments;
create trigger comments_validate_entity_trg
  before insert on public.comments
  for each row execute function public.comments_validate_entity();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. comment_mentions · solo mencionar miembros del tenant  ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Cierra el [P1] de codex: la RLS de 0090 no validaba que mentioned_user_id
-- fuera del tenant; un cliente directo podía forjar menciones a cualquier uid.
-- (La fila vivía igual en el tenant del atacante y el SELECT RLS del víctima no
--  la veía, pero igual es basura/abuso intra-tenant.) BEFORE INSERT lo cierra.
create or replace function public.comment_mentions_validate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.user_tenants ut
    where ut.user_id = new.mentioned_user_id
      and ut.tenant_id = new.tenant_id
      and ut.disabled_at is null
  ) then
    raise exception 'no se puede mencionar a un usuario fuera del tenant: %', new.mentioned_user_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists comment_mentions_validate_trg on public.comment_mentions;
create trigger comment_mentions_validate_trg
  before insert on public.comment_mentions
  for each row execute function public.comment_mentions_validate();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 4. comment_mentions · inmutabilidad (solo read_at mutable)║
-- ╚═══════════════════════════════════════════════════════════╝
-- Cierra el [P2] de codex: el grant UPDATE + la policy dejaban al mencionado
-- mutar comment_id / created_at / id. Espejo del trigger de comments (0090
-- hardening). Solo read_at queda mutable (lo que markMentionsRead necesita).
create or replace function public.comment_mentions_freeze_immutable()
returns trigger
language plpgsql
as $$
begin
  new.id                := old.id;
  new.comment_id        := old.comment_id;
  new.tenant_id         := old.tenant_id;
  new.mentioned_user_id := old.mentioned_user_id;
  new.created_at        := old.created_at;
  return new; -- read_at es la única columna que un UPDATE puede cambiar
end;
$$;

drop trigger if exists comment_mentions_freeze_immutable_trg on public.comment_mentions;
create trigger comment_mentions_freeze_immutable_trg
  before update on public.comment_mentions
  for each row execute function public.comment_mentions_freeze_immutable();

-- ─────────────────────────────────────────────────────────────
-- Fin 0093_comments_hardening.sql
-- ─────────────────────────────────────────────────────────────
