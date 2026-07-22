-- SDD-0167 · Newsletter público por email para /noticias.
--
-- Crea almacenamiento privado para suscriptores de Actualidad.
-- La web pública NO lee ni escribe esta tabla directamente: el formulario llama
-- /api/newsletter/subscribe y el handler usa service_role con validación,
-- honeypot, rate limit e idempotencia.

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  status text not null default 'subscribed'
    check (status in ('subscribed', 'unsubscribed')),
  origin text not null default 'noticias'
    check (origin in ('noticias', 'noticias-articulo', 'footer', 'admin')),
  consent_text text not null,
  consent_at timestamptz not null default now(),
  consent_ip_hash text,
  user_agent text,
  last_delivered_at timestamptz,
  unsubscribed_at timestamptz,
  unsubscribe_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, email)
);

comment on table public.newsletter_subscribers is
  'Suscriptores privados del newsletter de Actualidad. Sin grants anon/authenticated; acceso público solo por route handler validado.';

create index if not exists newsletter_subscribers_tenant_status_idx
  on public.newsletter_subscribers (tenant_id, status, created_at desc);

create index if not exists newsletter_subscribers_email_idx
  on public.newsletter_subscribers (tenant_id, email);

create index if not exists newsletter_subscribers_active_delivery_idx
  on public.newsletter_subscribers (tenant_id, last_delivered_at)
  where status = 'subscribed';

grant all on public.newsletter_subscribers to service_role;
revoke all on public.newsletter_subscribers from anon;
revoke all on public.newsletter_subscribers from authenticated;

alter table public.newsletter_subscribers enable row level security;

drop policy if exists "newsletter_subscribers_no_anon_read" on public.newsletter_subscribers;
create policy "newsletter_subscribers_no_anon_read"
  on public.newsletter_subscribers for select to anon
  using (false);

drop policy if exists "newsletter_subscribers_no_authenticated_read" on public.newsletter_subscribers;
create policy "newsletter_subscribers_no_authenticated_read"
  on public.newsletter_subscribers for select to authenticated
  using (false);
