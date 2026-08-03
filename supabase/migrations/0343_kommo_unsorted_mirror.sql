-- SDD-0245 · Espejo de la bandeja de entrada de Kommo (unsorted).
--
-- El ERP no ve los leads que llegan por WhatsApp hasta que alguien los acepta:
-- `/api/v4/leads` no los devuelve. Medido 2026-08-03: de 11 leads con actividad
-- de ese día, 8 no existían en el espejo, y `kommo_leads` llevaba congelado en
-- 2.877 desde el 30-jul mientras `kommo_contacts` seguía creciendo.
--
-- Consecuencia: TODA métrica del ERP sobre kommo_leads subestima el embudo.
--
-- Esta tabla es un espejo READ-ONLY de la cola. No acepta ni rechaza nada: eso
-- es una decisión comercial de una persona.
--
-- ⚠️ La bandeja es una COLA, no un registro: una entrada desaparece cuando se
-- acepta o se rechaza. Por eso el sync hace REEMPLAZO TOTAL por tenant (upsert
-- de lo visto + delete de lo que ya no está). Un upsert puro acumularía filas
-- fantasma y el conteo mentiría al alza — el error opuesto al de hoy.

set lock_timeout = '5s';
set statement_timeout = '60s';

do $preflight$
begin
  if to_regclass('public.tenants') is null then
    raise exception '0343 requiere public.tenants';
  end if;
  if to_regprocedure('public.get_user_tenant_id()') is null then
    raise exception '0343 requiere get_user_tenant_id() para la RLS del espejo';
  end if;
end;
$preflight$;

create table if not exists public.kommo_unsorted (
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  uid              text not null,
  category         text,
  source_name      text,
  pipeline_id      bigint,
  lead_id          bigint,
  contact_id       bigint,
  kommo_created_at timestamptz,
  raw              jsonb not null default '{}'::jsonb,
  synced_at        timestamptz not null default now(),
  primary key (tenant_id, uid)
);

comment on table public.kommo_unsorted is
  'SDD-0245: espejo de GET /api/v4/leads/unsorted — los leads que llegaron y NADIE '
  'ha aceptado todavia. NO son leads: no existen en /api/v4/leads ni en kommo_leads. '
  'Es una COLA que drena: el sync la reemplaza completa en cada corrida.';

comment on column public.kommo_unsorted.lead_id is
  'SDD-0245: el lead PENDIENTE. Mientras la entrada viva aca, ese id NO esta en '
  'kommo_leads. Cuando alguien acepta, la fila desaparece y el lead aparece alla.';

-- Para "¿cuántos esperan y desde cuándo?" sin escanear la tabla.
create index if not exists kommo_unsorted_tenant_created_idx
  on public.kommo_unsorted (tenant_id, kommo_created_at desc);

-- ── Permisos ────────────────────────────────────────────────────────────────
grant select on public.kommo_unsorted to authenticated;
grant all    on public.kommo_unsorted to service_role;

-- ── RLS (patrón del resto del espejo, migración 0082) ───────────────────────
alter table public.kommo_unsorted enable row level security;

-- authenticated: SOLO su tenant, read-only. Sin policies de INSERT/UPDATE/DELETE.
drop policy if exists "kommo_unsorted tenant read" on public.kommo_unsorted;
create policy "kommo_unsorted tenant read"
  on public.kommo_unsorted for select to authenticated
  using (tenant_id = public.get_user_tenant_id());

-- service_role: ALL (defense-in-depth, patrón 0033). NO es el USING(true)
-- prohibido — ese sería para anon/authenticated.
drop policy if exists "kommo_unsorted service all" on public.kommo_unsorted;
create policy "kommo_unsorted service all"
  on public.kommo_unsorted for all to service_role
  using (true) with check (true);
