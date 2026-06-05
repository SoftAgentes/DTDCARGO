-- ─────────────────────────────────────────────────────────────
-- SDD-0043 Alcance B · guard de orden para webhooks de Kommo
--
-- Los webhooks pueden llegar DESORDENADOS (Kommo no garantiza orden, y un
-- "delete" + re-fetch del pull diario pueden cruzarse). Sin esto, un webhook
-- viejo (o un upsert de reconciliación con datos más antiguos) pisaría una fila
-- ya más nueva. Este trigger lo evita: si el UPDATE trae un kommo_updated_at
-- ESTRICTAMENTE más viejo que el de la fila existente, se descarta (RETURN NULL)
-- y la fila más nueva se conserva.
--
-- Arregla la deuda conocida #2 del spec 0043 (en Alcance A era no-op).
--
-- Una sola función trigger reusada por kommo_leads y kommo_contacts. No es
-- SECURITY DEFINER (corre con los privilegios del que dispara el UPDATE, que ya
-- pasó RLS). Sin DDL destructivo. NO se aplica a prod desde acá (lo hace el
-- founder / MCP).
-- ─────────────────────────────────────────────────────────────

create or replace function public.kommo_discard_stale_update()
returns trigger
language plpgsql
as $$
begin
  -- Solo descarta si AMBOS timestamps existen y el entrante es más viejo.
  -- (Si OLD o NEW es null, dejamos pasar: no hay base para comparar orden.)
  if new.kommo_updated_at is not null
     and old.kommo_updated_at is not null
     and new.kommo_updated_at < old.kommo_updated_at then
    return null; -- descarta el UPDATE → conserva la fila más nueva
  end if;
  return new;
end;
$$;

drop trigger if exists kommo_leads_discard_stale on public.kommo_leads;
create trigger kommo_leads_discard_stale
  before update on public.kommo_leads
  for each row execute function public.kommo_discard_stale_update();

drop trigger if exists kommo_contacts_discard_stale on public.kommo_contacts;
create trigger kommo_contacts_discard_stale
  before update on public.kommo_contacts
  for each row execute function public.kommo_discard_stale_update();

comment on function public.kommo_discard_stale_update() is
  'SDD-0043 Alcance B: descarta UPDATEs de webhook con kommo_updated_at más viejo (orden fuera de secuencia). Reusado por kommo_leads y kommo_contacts.';

-- ─────────────────────────────────────────────────────────────
-- Fin 0107_kommo_webhook_guard.sql
-- ─────────────────────────────────────────────────────────────
