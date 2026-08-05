-- SDD-0244 rebanada B · la marca del cliente pasa a vivir en el CONTACTO.
--
-- Hoy el Shipping Mark se escribe en un custom field del LEAD. Funciona para que
-- el asesor lo vea en el trato del momento, pero el lead se cierra y se lleva la
-- marca: la próxima vez que el cliente escriba, Kommo vuelve a no saber quién es.
-- El contacto, en cambio, es permanente.
--
-- La outbox sólo sabía apuntar a leads: `kommo_lead_id` era `not null` y el drain
-- pega fijo a `/api/v4/leads/{id}`. Esta migración le enseña el destino contacto.
--
-- ⚠️ Invariante nuevo: cada fila apunta a EXACTAMENTE UN destino, y al que le
-- corresponde a su `op`. Sin eso, un `patch_contact` sin contacto se drenaría
-- silenciosamente contra `/api/v4/leads/null`.
--
-- Aditiva e idempotente. NO reescribe la tabla: `add column` de una columna
-- anulable y `drop not null` son metadata-only (PG 11+).

set lock_timeout = '5s';
set statement_timeout = '60s';

-- ── 1) Campo de CONTACTO donde va el Shipping Mark ───────────────
-- Hermano de `markbox_field_id` (SDD-0086, que apunta al campo de leads).
-- Null = inerte: sin campo configurado no se encola ningún patch_contact.
alter table public.kommo_connections
  add column if not exists markbox_contact_field_id bigint;

comment on column public.kommo_connections.markbox_contact_field_id is
  'SDD-0244: custom field de CONTACTO donde va el Shipping Mark. Null = inerte. Hermano de markbox_field_id (que es el de leads y muere con el trato).';

-- ── 2) La outbox aprende a apuntar a un contacto ─────────────────
alter table public.kommo_writeback_outbox
  add column if not exists kommo_contact_id bigint;

comment on column public.kommo_writeback_outbox.kommo_contact_id is
  'SDD-0244: destino cuando op = patch_contact. Excluyente con kommo_lead_id.';

-- Un patch_contact no tiene lead destino → kommo_lead_id deja de ser obligatorio.
alter table public.kommo_writeback_outbox
  alter column kommo_lead_id drop not null;

-- Exactamente un destino, y el que corresponde a la op.
-- Las filas históricas (lead not null, contact null) satisfacen la rama `else`.
alter table public.kommo_writeback_outbox
  drop constraint if exists kommo_writeback_outbox_target_check;
alter table public.kommo_writeback_outbox
  add constraint kommo_writeback_outbox_target_check check (
    case when op = 'patch_contact'
      then kommo_contact_id is not null and kommo_lead_id is null
      else kommo_lead_id is not null and kommo_contact_id is null
    end
  );

-- ── 3) RPC de encolado con destino CONTACTO ──────────────────────
-- Hermana de enqueue_kommo_writeback (migr 0136). No se toca aquélla: es el path
-- probado en producción del write-back de leads.
--
-- ⚠️ La clave de idempotencia lleva prefijo 'c:' — los ids de lead y de contacto
-- son espacios distintos y pueden coincidir en número. Sin el prefijo, el lead
-- 123 y el contacto 123 competirían por la misma fila pendiente.
create or replace function public.enqueue_kommo_contact_writeback(
  p_tenant_id uuid,
  p_kommo_contact_id bigint,
  p_op text,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id  uuid;
  v_key text := 'c:' || p_kommo_contact_id::text || ':' || p_op;
begin
  insert into public.kommo_writeback_outbox
    (tenant_id, kommo_contact_id, op, payload, idempotency_key)
  values
    (p_tenant_id, p_kommo_contact_id, p_op, p_payload, v_key)
  on conflict (tenant_id, idempotency_key) where status = 'pending'
  do update set
    payload    = excluded.payload,
    attempts   = 0,
    last_error = null,
    created_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

-- Blindaje (deuda anon-execute): sólo service_role la ejecuta.
revoke execute on function public.enqueue_kommo_contact_writeback(uuid, bigint, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.enqueue_kommo_contact_writeback(uuid, bigint, text, jsonb)
  to service_role;
