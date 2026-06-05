-- SDD-0058: puente Kommo lead → cliente. Aditiva, sin DDL destructivo.
--
-- Vincula un cliente del ERP (clients) con el lead de Kommo del que se convirtió,
-- para trazabilidad CRM→ERP. La columna es nullable (la mayoría de los clientes no
-- vienen de Kommo). Un lead mapea a UN cliente vivo como máximo (índice único parcial).

alter table public.clients
  add column if not exists kommo_lead_id bigint;

comment on column public.clients.kommo_lead_id is
  'SDD-0058: lead de Kommo (kommo_leads.id) del que se convirtió este cliente. Trazabilidad CRM->ERP. NULL = no vino de Kommo.';

-- FK compuesta: el espejo kommo_leads tiene PK (tenant_id, id). Si el lead se borra
-- del espejo (webhook delete de Kommo), el cliente SOBREVIVE y pierde solo el link
-- (on delete set null). MATCH SIMPLE (default): con kommo_lead_id NULL no se valida.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clients_kommo_lead_fk'
  ) then
    alter table public.clients
      add constraint clients_kommo_lead_fk
      foreign key (tenant_id, kommo_lead_id)
      references public.kommo_leads (tenant_id, id)
      on delete set null;
  end if;
end $$;

-- Idempotencia del puente: un lead → un cliente vivo por tenant.
create unique index if not exists clients_kommo_lead_unique
  on public.clients (tenant_id, kommo_lead_id)
  where kommo_lead_id is not null and deleted_at is null;
