-- ─────────────────────────────────────────────────────────────
-- SDD-0149 · Resumen mensual de conversaciones (IA)
--
-- Complemento de la retención (SDD-0148): el cliente ve 90 días, la empresa guarda
-- todo. Esta tabla guarda, por conversación×mes, un RESUMEN con IA de lo dialogado
-- ese mes ("Conversaciones de <mes>"). Navegable por mes o histórico en el ERP.
--
-- Idempotente: unique (conversation_id, period) → el cron se re-corre sin duplicar
-- (upsert). No toca conversation_messages (capa aparte). RLS: equipo del tenant lee;
-- el cron escribe con service_role. Aditiva. NO aplicar a prod desde acá (founder).
-- ─────────────────────────────────────────────────────────────

create table if not exists public.conversation_monthly_digests (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  client_id       uuid not null references public.clients(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  period          date not null,                       -- primer día del mes resumido
  summary         text not null,                       -- resumen (markdown) del mes
  message_count   int  not null default 0,
  in_count        int  not null default 0,             -- mensajes del cliente
  out_count       int  not null default 0,             -- respuestas del equipo
  model           text,                                -- modelo de IA usado (o 'mock')
  generated_at    timestamptz not null default now(),
  unique (conversation_id, period)
);

comment on table public.conversation_monthly_digests is
  'SDD-0149: resumen mensual con IA de una conversación (por conversation×mes). El hilo completo vive en conversation_messages; esto es una capa de histórico condensado para el ERP. Idempotente por (conversation_id, period). Escrito por el cron con service_role.';

create index if not exists conv_digests_tenant_period_idx
  on public.conversation_monthly_digests (tenant_id, period desc);
create index if not exists conv_digests_client_period_idx
  on public.conversation_monthly_digests (client_id, period desc);

alter table public.conversation_monthly_digests enable row level security;

-- Lectura: el equipo del tenant (mismo patrón que el resto del Studio).
grant select on public.conversation_monthly_digests to authenticated;
drop policy if exists "conv_digests tenant read" on public.conversation_monthly_digests;
create policy "conv_digests tenant read"
  on public.conversation_monthly_digests for select to authenticated
  using (tenant_id = public.get_user_tenant_id());

-- Escritura: solo el cron (service_role).
grant all on public.conversation_monthly_digests to service_role;
drop policy if exists "conv_digests service_role all" on public.conversation_monthly_digests;
create policy "conv_digests service_role all"
  on public.conversation_monthly_digests for all
  to service_role using (true) with check (true);

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0219_conversation_monthly_digests.sql
-- ─────────────────────────────────────────────────────────────
