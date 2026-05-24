-- ─────────────────────────────────────────────────────────────
-- SDD-0011: Cotizador
-- Tabla quotes + enum quote_status + función next_quote_code() + RLS
-- Reusa shipment_service enum y touch_updated_at()
-- ─────────────────────────────────────────────────────────────

create type quote_status as enum ('draft', 'sent', 'accepted', 'rejected', 'expired');

create table public.quotes (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants(id) on delete cascade,
  quote_code               text not null,                    -- "Q-2026-0001"
  client_markbox           text not null,                    -- lookup textual (no FK)
  client_name              text not null,                    -- snapshot al momento
  service                  shipment_service not null,        -- reusa enum existente
  origin                   text not null,
  destination              text not null,
  cbm                      numeric(10,3),
  weight_kg                numeric(10,2),
  boxes                    int,
  packaging                text not null default 'carton',   -- carton/paleta/madera
  rate_per_cbm             numeric(10,2),
  flat_rate                numeric(10,2),
  rate_used_id             uuid references public.rates(id) on delete set null,
  subtotal_usd             numeric(10,2) not null,
  packaging_cost           numeric(10,2) not null default 0,
  total_usd                numeric(10,2) not null,
  status                   quote_status not null default 'draft',
  valid_until              date not null default (current_date + interval '30 days'),
  sent_at                  timestamptz,
  accepted_at              timestamptz,
  converted_to_shipment_id uuid references public.shipments(id) on delete set null,
  notes                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  deleted_at               timestamptz,
  unique (tenant_id, quote_code)
);

comment on table public.quotes is
  'Cotizaciones operativas. State machine draft → sent → accepted/rejected. Soft delete via deleted_at. RLS por tenant_id.';

create index quotes_tenant_status_idx
  on public.quotes (tenant_id, status) where deleted_at is null;

create index quotes_tenant_client_idx
  on public.quotes (tenant_id, client_markbox) where deleted_at is null;

-- Función next_quote_code: formato Q-YYYY-NNNN, counter por año + tenant.
-- Si pasa de 9999 en un año el padding se extiende automáticamente.
create or replace function public.next_quote_code(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year int := extract(year from current_date);
  v_max int;
  v_padded text;
begin
  select coalesce(max((regexp_match(quote_code, '^Q-\d{4}-(\d+)$'))[1]::int), 0) + 1
  into v_max
  from public.quotes
  where tenant_id = p_tenant_id
    and quote_code like 'Q-' || v_year || '-%';

  v_padded := lpad(v_max::text, 4, '0');
  return 'Q-' || v_year || '-' || v_padded;
end;
$$;

comment on function public.next_quote_code is
  'Genera el próximo quote_code Q-YYYY-NNNN para el tenant del año actual.';

-- GRANTS EXPLÍCITOS (auto-expose new tables OFF)
grant select, insert, update, delete on public.quotes to authenticated;
grant execute on function public.next_quote_code(uuid) to authenticated;

-- RLS por tenant
alter table public.quotes enable row level security;

create policy "quotes by tenant"
  on public.quotes for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

-- Trigger updated_at
create trigger quotes_touch
  before update on public.quotes
  for each row execute function public.touch_updated_at();
