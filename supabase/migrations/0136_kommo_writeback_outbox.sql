-- SDD-0083 (implementa SDD-0062 Slice A): fundación del write-back ERP→Kommo.
-- Cola (outbox) de PATCHes a Kommo + gate dry-run. Aditiva, idempotente.
--
-- Modelo de seguridad (SDD-0043): el ERP solo ENCOLA acá; la edge function
-- kommo-writeback drena la cola, lee el token de Vault y hace el PATCH. El token
-- NUNCA entra al runtime de la app. Guardrail 0107: el write-back jamás escribe el
-- espejo (kommo_leads) — ERP→PATCH Kommo→webhook→upsert con updated_at autoritativo.

-- ── Gate de escritura en la conexión (nace APAGADO) ──────────────
-- Booleans con default constante → ADD COLUMN metadata-only (PG 11+, sin reescritura).
alter table public.kommo_connections
  add column if not exists writeback_enabled boolean not null default false,
  add column if not exists writeback_dry_run boolean not null default true;

comment on column public.kommo_connections.writeback_enabled is
  'SDD-0083: master switch del write-back ERP->Kommo. false (default) = nunca escribe.';
comment on column public.kommo_connections.writeback_dry_run is
  'SDD-0083: si true (default), el drain solo loguea el PATCH que haria (no escribe). Escribe de verdad solo con writeback_enabled=true AND writeback_dry_run=false.';

-- ── Outbox de write-back ─────────────────────────────────────────
create table if not exists public.kommo_writeback_outbox (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  kommo_lead_id bigint not null,
  op          text not null check (op in ('patch_price', 'patch_stage', 'patch_lead')),
  payload     jsonb not null,
  -- Idempotencia: 1 op pendiente por lead (ej "12345:patch_price"). Re-encolar
  -- actualiza el payload (gana el ultimo valor) en vez de duplicar.
  idempotency_key text not null,
  status      text not null default 'pending' check (status in ('pending', 'sent', 'skipped', 'error')),
  attempts    int not null default 0,
  last_error  text,
  -- Snapshot del updated_at del lead al encolar (trazabilidad anti-overwrite).
  kommo_updated_at_at_enqueue timestamptz,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);

comment on table public.kommo_writeback_outbox is
  'SDD-0083: cola de PATCHes ERP->Kommo. La drena la edge function kommo-writeback (dry-run por default). Service-role only.';

-- Drain: pendientes del tenant, mas viejo primero (indice parcial = liviano).
create index if not exists kommo_writeback_outbox_drain_idx
  on public.kommo_writeback_outbox (tenant_id, created_at)
  where status = 'pending';

-- Idempotencia: 1 op pendiente por (tenant, idempotency_key).
create unique index if not exists kommo_writeback_outbox_pending_idem
  on public.kommo_writeback_outbox (tenant_id, idempotency_key)
  where status = 'pending';

-- RLS: service-role only (se encola via RPC con admin client; se drena con la edge
-- function service_role). authenticated/anon NO tienen grant → sin acceso directo.
alter table public.kommo_writeback_outbox enable row level security;
create policy "kommo_writeback_outbox_service_all"
  on public.kommo_writeback_outbox for all to service_role using (true) with check (true);
grant all on public.kommo_writeback_outbox to service_role;

-- Lectura para el tablero (SDD-0078 · panel de visibilidad del write-back):
-- authenticated ve la outbox de SU tenant, SOLO lectura. El enqueue/drain siguen
-- siendo service_role (no hay grant insert/update a authenticated).
grant select on public.kommo_writeback_outbox to authenticated;
create policy "kommo_writeback_outbox_tenant_select"
  on public.kommo_writeback_outbox for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()));

-- ── RPCs (security definer; SOLO service_role/edge function) ──────
-- Encola (o refresca el payload del pendiente). Devuelve el id de la fila.
create or replace function public.enqueue_kommo_writeback(
  p_tenant_id uuid,
  p_kommo_lead_id bigint,
  p_op text,
  p_payload jsonb,
  p_kommo_updated_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_key text := p_kommo_lead_id::text || ':' || p_op;
begin
  insert into public.kommo_writeback_outbox
    (tenant_id, kommo_lead_id, op, payload, idempotency_key, kommo_updated_at_at_enqueue)
  values
    (p_tenant_id, p_kommo_lead_id, p_op, p_payload, v_key, p_kommo_updated_at)
  on conflict (tenant_id, idempotency_key) where status = 'pending'
  do update set
    payload = excluded.payload,
    kommo_updated_at_at_enqueue = excluded.kommo_updated_at_at_enqueue,
    attempts = 0,
    last_error = null,
    created_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.mark_kommo_writeback_sent(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.kommo_writeback_outbox set status = 'sent', sent_at = now() where id = p_id;
$$;

-- Suma 1 intento; al 5º lo deja en 'error' (no se reintenta mas).
create or replace function public.bump_kommo_writeback_attempt(p_id uuid, p_error text default null)
returns void
language sql
security definer
set search_path = public
as $$
  update public.kommo_writeback_outbox
     set attempts = attempts + 1,
         last_error = p_error,
         status = case when attempts + 1 >= 5 then 'error' else 'pending' end
   where id = p_id;
$$;

-- Dry-run o no-aplicable → skipped (no es fallo, no se reintenta).
create or replace function public.mark_kommo_writeback_skipped(p_id uuid, p_reason text default null)
returns void
language sql
security definer
set search_path = public
as $$
  update public.kommo_writeback_outbox
     set status = 'skipped', last_error = p_reason, sent_at = now()
   where id = p_id;
$$;

-- Blindaje (memoria anon-execute-debt): revoca el EXECUTE PUBLIC por default;
-- estas RPCs SOLO las llama service_role (admin client / edge function).
revoke execute on function public.enqueue_kommo_writeback(uuid, bigint, text, jsonb, timestamptz) from public, anon, authenticated;
revoke execute on function public.mark_kommo_writeback_sent(uuid) from public, anon, authenticated;
revoke execute on function public.bump_kommo_writeback_attempt(uuid, text) from public, anon, authenticated;
revoke execute on function public.mark_kommo_writeback_skipped(uuid, text) from public, anon, authenticated;
grant execute on function public.enqueue_kommo_writeback(uuid, bigint, text, jsonb, timestamptz) to service_role;
grant execute on function public.mark_kommo_writeback_sent(uuid) to service_role;
grant execute on function public.bump_kommo_writeback_attempt(uuid, text) to service_role;
grant execute on function public.mark_kommo_writeback_skipped(uuid, text) to service_role;

-- ── Drain por pg_cron (clon de kommo_run_sync, migr 0084) ────────
-- search_path='' → todo calificado (vault., net.). Lee el cron key de Vault y
-- dispara la edge function kommo-writeback.
create or replace function public.kommo_run_writeback_drain()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key    text;
  v_req_id bigint;
begin
  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'kommo_cron_key'
  limit 1;

  if v_key is null then
    raise notice '[kommo_run_writeback_drain] kommo_cron_key no esta en Vault — salteo';
    return null;
  end if;

  select net.http_post(
    url     := 'https://xpfuzqombmjmxvprjgmi.supabase.co/functions/v1/kommo-writeback',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_key,
                 'apikey',        v_key
               ),
    body    := jsonb_build_object('tenant_id', '4ede88a0-b9c4-49ff-962b-e5a5014776e6')
  ) into v_req_id;

  return v_req_id;
end;
$$;

revoke execute on function public.kommo_run_writeback_drain() from public, anon, authenticated;
grant execute on function public.kommo_run_writeback_drain() to service_role;

-- COORDINACION: descomentar tras (1) deployar la edge function kommo-writeback y
-- (2) setear kommo_cron_key en Vault. Asi el drain no falla contra una funcion
-- inexistente. cron.schedule es idempotente por nombre de job.
-- select cron.schedule('kommo-writeback-drain-dtd', '*/15 * * * *', $job$select public.kommo_run_writeback_drain();$job$);
