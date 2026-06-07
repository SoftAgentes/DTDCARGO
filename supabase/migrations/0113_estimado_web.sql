-- ─────────────────────────────────────────────────────────────
-- SDD-0061 Fase B1: captura del estimado web en el ERP
--
-- Aditiva sobre public.quotes (0007). El estimado de un PROSPECTO (todavía sin
-- MARKBOX) entra como una quote con source='web', sin client_markbox, y con los
-- datos de contacto + nota que el visitante dejó en la calculadora pública.
--
-- · client_markbox pasa a NULLABLE — un prospecto web aún no tiene cuenta.
-- · prospect_name / prospect_email / prospect_whatsapp / nota — datos del visitante.
-- · source ('studio' | 'web', default 'studio') — las quotes existentes quedan
--   cubiertas por el default; NO se tocan.
-- · RPC next_estimate_code() → EST-YYYY-NNNN (cuenta solo códigos 'EST-%').
--
-- El insert lo hace el route handler público con el admin client (service_role),
-- que bypassa RLS → NO hace falta policy nueva. quotes NO tiene FORCE RLS, así
-- que service_role pasa limpio (verificado contra 0007). La RLS de lectura del
-- Studio (policy "quotes by tenant") queda intacta.
--
-- Los demás NOT NULL de quotes (client_name, service, origin, destination,
-- subtotal_usd, total_usd, packaging) NO se aflojan: el route handler los llena
-- desde los datos de la calculadora o con defaults sensatos (decisión SDD-0061).
-- DDL aditivo, sin DROP de columna, sin pérdida de datos.
-- ─────────────────────────────────────────────────────────────

-- 1. client_markbox NULLABLE (un prospecto web aún no tiene MARKBOX).
alter table public.quotes
  alter column client_markbox drop not null;

-- 2. Columnas del prospecto web + clasificación de origen.
alter table public.quotes
  add column if not exists prospect_name     text,
  add column if not exists prospect_email    text,
  add column if not exists prospect_whatsapp text,
  add column if not exists nota              text,
  add column if not exists source            text not null default 'studio'
    check (source in ('studio', 'web'));

comment on column public.quotes.prospect_name is
  'SDD-0061: nombre del prospecto web (estimado sin MARKBOX). NULL para quotes del Studio.';
comment on column public.quotes.prospect_email is
  'SDD-0061: email del prospecto web. NULL para quotes del Studio.';
comment on column public.quotes.prospect_whatsapp is
  'SDD-0061: WhatsApp/teléfono del prospecto web. NULL para quotes del Studio.';
comment on column public.quotes.nota is
  'SDD-0061: nota libre que el visitante dejó al estimar (ej "Tengo la mercancía lista").';
comment on column public.quotes.source is
  'SDD-0061: origen del estimado. studio = creado por un asesor; web = capturado de la calculadora pública.';

-- Índice para la cola "web · por revisar" (Slice B2 lo consume; aditivo, barato).
create index if not exists quotes_tenant_source_idx
  on public.quotes (tenant_id, source) where deleted_at is null;

-- 3. RPC next_estimate_code: formato EST-YYYY-NNNN, counter por año + tenant.
--    Modelado sobre next_quote_code (0007): cuenta SOLO los códigos que empiezan
--    con 'EST-' (no colisiona con la serie Q- existente). Padding 4; si pasa de
--    9999 en un año el padding se extiende solo.
create or replace function public.next_estimate_code(p_tenant_id uuid)
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
  select coalesce(max((regexp_match(quote_code, '^EST-\d{4}-(\d+)$'))[1]::int), 0) + 1
  into v_max
  from public.quotes
  where tenant_id = p_tenant_id
    and quote_code like 'EST-' || v_year || '-%';

  v_padded := lpad(v_max::text, 4, '0');
  return 'EST-' || v_year || '-' || v_padded;
end;
$$;

comment on function public.next_estimate_code is
  'SDD-0061: genera el próximo estimate_code EST-YYYY-NNNN para el tenant del año actual (solo cuenta códigos EST-).';

-- GRANTS explícitos (auto-expose OFF). El route handler público corre con
-- service_role; authenticated lo necesita para el módulo Estimados (Fase C).
grant execute on function public.next_estimate_code(uuid) to authenticated;
grant execute on function public.next_estimate_code(uuid) to service_role;
