-- SDD-0167 · Campañas manuales y aprobadas del newsletter de Actualidad.
--
-- Tablas privadas: ni anon ni authenticated acceden directamente. Las acciones
-- del Studio validan sesión/tenant/rol y recién entonces usan service_role.

create table if not exists public.newsletter_campaigns (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  internal_name text not null check (char_length(internal_name) between 3 and 120),
  subject text not null check (char_length(subject) between 3 and 150),
  preview_text text not null default '' check (char_length(preview_text) <= 180),
  heading text not null check (char_length(heading) between 3 and 160),
  body_text text not null check (char_length(body_text) between 20 and 12000),
  cta_label text check (cta_label is null or char_length(cta_label) between 2 and 50),
  cta_url text check (cta_url is null or cta_url ~ '^https://'),
  status text not null default 'draft'
    check (status in ('draft', 'pending_approval', 'approved', 'sending', 'sent', 'partial', 'failed', 'cancelled')),
  content_hash text not null,
  approved_content_hash text,
  recipient_count integer not null default 0 check (recipient_count >= 0),
  sent_count integer not null default 0 check (sent_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  send_requested_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  send_requested_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((cta_label is null and cta_url is null) or (cta_label is not null and cta_url is not null)),
  check (approved_content_hash is null or approved_at is not null)
);

create table if not exists public.newsletter_campaign_recipients (
  id uuid primary key default extensions.gen_random_uuid(),
  campaign_id uuid not null references public.newsletter_campaigns(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  subscriber_id uuid not null references public.newsletter_subscribers(id) on delete restrict,
  email text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed', 'skipped')),
  dispatch_key uuid,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  mail_log_id uuid references public.mail_logs(id) on delete set null,
  resend_message_id text,
  error text,
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,
  complained_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, subscriber_id)
);

comment on table public.newsletter_campaigns is
  'Campañas manuales de Actualidad. Requieren aprobación admin y nunca se envían al publicar una noticia.';
comment on table public.newsletter_campaign_recipients is
  'Snapshot privado de destinatarios tomado al aprobar una campaña; conserva trazabilidad de envío y baja.';

create index if not exists newsletter_campaigns_tenant_created_idx
  on public.newsletter_campaigns (tenant_id, created_at desc);
create index if not exists newsletter_campaigns_tenant_status_idx
  on public.newsletter_campaigns (tenant_id, status, updated_at desc);
create index if not exists newsletter_campaign_recipients_campaign_status_idx
  on public.newsletter_campaign_recipients (campaign_id, status, created_at);
create index if not exists newsletter_campaign_recipients_resend_idx
  on public.newsletter_campaign_recipients (resend_message_id)
  where resend_message_id is not null;
create index if not exists newsletter_campaign_recipients_dispatch_idx
  on public.newsletter_campaign_recipients (campaign_id, dispatch_key)
  where status = 'processing';

drop trigger if exists newsletter_campaigns_touch_updated_at on public.newsletter_campaigns;
create trigger newsletter_campaigns_touch_updated_at
  before update on public.newsletter_campaigns
  for each row execute function public.touch_updated_at();

drop trigger if exists newsletter_campaign_recipients_touch_updated_at on public.newsletter_campaign_recipients;
create trigger newsletter_campaign_recipients_touch_updated_at
  before update on public.newsletter_campaign_recipients
  for each row execute function public.touch_updated_at();

grant all on public.newsletter_campaigns to service_role;
grant all on public.newsletter_campaign_recipients to service_role;
revoke all on public.newsletter_campaigns from anon, authenticated;
revoke all on public.newsletter_campaign_recipients from anon, authenticated;

alter table public.newsletter_campaigns enable row level security;
alter table public.newsletter_campaign_recipients enable row level security;

drop policy if exists "newsletter_campaigns_no_anon" on public.newsletter_campaigns;
create policy "newsletter_campaigns_no_anon" on public.newsletter_campaigns
  for all to anon using (false) with check (false);
drop policy if exists "newsletter_campaigns_no_authenticated" on public.newsletter_campaigns;
create policy "newsletter_campaigns_no_authenticated" on public.newsletter_campaigns
  for all to authenticated using (false) with check (false);
drop policy if exists "newsletter_campaign_recipients_no_anon" on public.newsletter_campaign_recipients;
create policy "newsletter_campaign_recipients_no_anon" on public.newsletter_campaign_recipients
  for all to anon using (false) with check (false);
drop policy if exists "newsletter_campaign_recipients_no_authenticated" on public.newsletter_campaign_recipients;
create policy "newsletter_campaign_recipients_no_authenticated" on public.newsletter_campaign_recipients
  for all to authenticated using (false) with check (false);

-- Reclama de forma atómica un lote de hasta 100 destinatarios. Si una ejecución
-- se corta después de llamar a Resend, el siguiente intento recupera el mismo
-- dispatch_key y reutiliza el Idempotency-Key del proveedor.
create or replace function public.newsletter_claim_campaign_batch(
  p_campaign_id uuid,
  p_tenant_id uuid,
  p_limit integer default 100
)
returns table (
  id uuid,
  subscriber_id uuid,
  email text,
  dispatch_key uuid,
  mail_log_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dispatch uuid;
begin
  if p_limit < 1 or p_limit > 100 then
    raise exception 'p_limit debe estar entre 1 y 100';
  end if;

  select r.dispatch_key into v_dispatch
  from public.newsletter_campaign_recipients r
  where r.campaign_id = p_campaign_id
    and r.tenant_id = p_tenant_id
    and r.status = 'processing'
    and r.dispatch_key is not null
  order by r.updated_at asc
  limit 1;

  if v_dispatch is null then
    v_dispatch := extensions.gen_random_uuid();
    with candidates as (
      select r.id
      from public.newsletter_campaign_recipients r
      where r.campaign_id = p_campaign_id
        and r.tenant_id = p_tenant_id
        and r.status = 'pending'
      order by r.created_at, r.id
      limit p_limit
      for update skip locked
    )
    update public.newsletter_campaign_recipients r
      set status = 'processing', dispatch_key = v_dispatch,
          attempt_count = attempt_count + 1, error = null
    from candidates c
    where r.id = c.id;
  end if;

  return query
  select r.id, r.subscriber_id, r.email, r.dispatch_key, r.mail_log_id
  from public.newsletter_campaign_recipients r
  where r.campaign_id = p_campaign_id
    and r.tenant_id = p_tenant_id
    and r.status = 'processing'
    and r.dispatch_key = v_dispatch
  order by r.created_at, r.id
  limit p_limit;
end;
$$;

revoke all on function public.newsletter_claim_campaign_batch(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.newsletter_claim_campaign_batch(uuid, uuid, integer) to service_role;

-- Lectura mínima para la pantalla administrativa. La función valida que el JWT
-- pertenezca al tenant; no expone la tabla de destinatarios ni sus emails.
create or replace function public.newsletter_list_campaigns(p_tenant_id uuid)
returns setof public.newsletter_campaigns
language sql
stable
security definer
set search_path = ''
as $$
  select c.*
  from public.newsletter_campaigns c
  where c.tenant_id = p_tenant_id
    and exists (
      select 1 from public.user_tenants ut
      where ut.tenant_id = p_tenant_id
        and ut.user_id = auth.uid()
        and ut.disabled_at is null
        and ut.role in ('admin', 'marketing', 'commercial', 'support')
    )
  order by c.created_at desc;
$$;

revoke all on function public.newsletter_list_campaigns(uuid) from public, anon;
grant execute on function public.newsletter_list_campaigns(uuid) to authenticated, service_role;
