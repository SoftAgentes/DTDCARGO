-- ─────────────────────────────────────────────────────────────
-- SDD-0105 · Conciliación bancaria (sub-pestaña de Contabilidad)
--
-- Cierra el hueco #3 del Norte (parte 1): subir el extracto del banco y
-- cruzar cada movimiento contra el libro diario que ya existe (SDD-0040).
--
--   bank_statements       — cabecera del extracto (1 por cuenta+período)
--   bank_statement_lines  — movimientos del extracto (cruce ↔ asiento)
--
-- REGLA DURA de alcance V1: conciliar SOLO setea el vínculo
-- (bank_statement_lines.matched_entry_id + estado del movimiento). NO crea
-- ni muta asientos del mayor → cero write-path a journal_entries/journal_lines
-- desde acá. El único punto que toca el mayor es el posteo de depreciación
-- (migr 0168). Por eso `journal_entries` NO necesita columna nueva: el vínculo
-- asiento↔movimiento vive en bank_statement_lines.matched_entry_id.
--
-- Estados como text + check (NO enums nuevos → se evita el dolor de backfill;
-- los check se amplían con un drop/add constraint). La anti-doble-conciliación
-- vive en un índice único parcial; la integridad cross-tenant del vínculo
-- (matched_entry_id) la fuerza un trigger + helper security-definer (sección 6,
-- hardening A1 de la auditoría) → ese SÍ lleva revoke execute from public, anon.
-- updated_at reusa la función existente public.touch_updated_at() (0002).
--
-- Reusa: accounts (0078) para la cuenta banco/caja del plan, journal_entries
-- (0078) para el asiento ligado, get_user_tenant_id() (0001) para RLS,
-- touch_updated_at() (0002) para updated_at.
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. bank_statements — cabecera del extracto                ║
-- ╚═══════════════════════════════════════════════════════════╝

create table public.bank_statements (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  -- Cuenta banco/caja del plan (1.1.1.x). on delete restrict: no se borra una
  -- cuenta con extractos cargados.
  account_id      uuid not null references public.accounts(id) on delete restrict,
  period_label    text not null,                              -- "2026-05"
  period_start    date,
  period_end      date,
  bank_name       text,                                       -- display, "Banesco USD"
  statement_ref   text,                                       -- nº de extracto / archivo
  opening_balance numeric(14,2) not null default 0,
  closing_balance numeric(14,2) not null default 0,
  currency        text not null default 'USD',
  status          text not null default 'open'
                  check (status in ('open', 'reconciled', 'archived')),
  notes           text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tenant_id, account_id, period_label)
);

comment on table public.bank_statements is
  'SDD-0105: cabecera del extracto bancario, 1 por (cuenta, período). account_id = cuenta banco/caja del plan (1.1.1.x). status open→reconciled→archived (text+check). RLS por tenant_id. La conciliación de sus líneas no muta el mayor (solo vincula).';

create index bank_statements_tenant_idx  on public.bank_statements (tenant_id);
create index bank_statements_account_idx on public.bank_statements (account_id);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. bank_statement_lines — movimientos del extracto        ║
-- ╚═══════════════════════════════════════════════════════════╝

create table public.bank_statement_lines (
  id               uuid primary key default gen_random_uuid(),
  statement_id     uuid not null references public.bank_statements(id) on delete cascade,
  -- tenant_id denormalizado para RLS directa (sin join al statement padre).
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  line_date        date not null,
  description      text not null,
  reference        text,                                      -- ref bancaria del movimiento
  -- crédito = entrada de dinero · débito = salida.
  direction        text not null check (direction in ('credit', 'debit')),
  amount           numeric(14,2) not null check (amount >= 0),
  status           text not null default 'pending'
                   check (status in ('pending', 'matched', 'manual', 'ignored')),
  -- Asiento del diario al que se liga el movimiento (V1: asiento EXISTENTE).
  -- on delete set null: si el asiento se borra, el movimiento vuelve a quedar
  -- sin ligar (no se pierde el movimiento del extracto).
  matched_entry_id uuid references public.journal_entries(id) on delete set null,
  match_confidence text check (match_confidence in ('high', 'medium', 'low')),
  note             text,
  reconciled_at    timestamptz,
  reconciled_by    uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.bank_statement_lines is
  'SDD-0105: movimientos de un extracto. status pending→matched|manual|ignored. matched_entry_id liga a un asiento EXISTENTE del diario (V1 no crea asientos). RLS por tenant_id (denormalizado). Un asiento no puede ligarse a dos movimientos (unique parcial sobre matched_entry_id).';

create index bsl_statement_idx     on public.bank_statement_lines (statement_id);
create index bsl_tenant_status_idx on public.bank_statement_lines (tenant_id, status);
create index bsl_matched_entry_idx on public.bank_statement_lines (matched_entry_id)
  where matched_entry_id is not null;

-- Anti doble-conciliación (1:1 asiento↔movimiento): un asiento del diario no
-- puede quedar ligado a dos movimientos a la vez. El check app-side (matchLine)
-- ya lo evita en el caso normal; este índice cierra la carrera de doble-submit.
create unique index bsl_one_movement_per_entry
  on public.bank_statement_lines (tenant_id, matched_entry_id)
  where matched_entry_id is not null;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. GRANTS explícitos (auto-expose new tables OFF)         ║
-- ╚═══════════════════════════════════════════════════════════╝

grant select, insert, update, delete on public.bank_statements      to authenticated;
grant select, insert, update, delete on public.bank_statement_lines to authenticated;
grant all on public.bank_statements      to service_role;
grant all on public.bank_statement_lines to service_role;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 4. RLS por tenant                                         ║
-- ╚═══════════════════════════════════════════════════════════╝

alter table public.bank_statements      enable row level security;
alter table public.bank_statement_lines enable row level security;

-- bank_statements: tenant del usuario (for all = SELECT/INSERT/UPDATE/DELETE).
create policy "bank_statements by tenant"
  on public.bank_statements for all
  to authenticated
  using (tenant_id = (select public.get_user_tenant_id()))
  with check (tenant_id = (select public.get_user_tenant_id()));

create policy "service_role_all_bank_statements"
  on public.bank_statements for all
  to service_role using (true) with check (true);

-- bank_statement_lines: mismo patrón (tiene tenant_id propio denormalizado).
create policy "bank_statement_lines by tenant"
  on public.bank_statement_lines for all
  to authenticated
  using (tenant_id = (select public.get_user_tenant_id()))
  with check (tenant_id = (select public.get_user_tenant_id()));

create policy "service_role_all_bank_statement_lines"
  on public.bank_statement_lines for all
  to service_role using (true) with check (true);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 5. Triggers updated_at (reusa touch_updated_at de 0002)   ║
-- ╚═══════════════════════════════════════════════════════════╝

create trigger bank_statements_touch
  before update on public.bank_statements
  for each row execute function public.touch_updated_at();

create trigger bank_statement_lines_touch
  before update on public.bank_statement_lines
  for each row execute function public.touch_updated_at();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 6. Integridad cross-tenant del vínculo (hardening A1)     ║
-- ╚═══════════════════════════════════════════════════════════╝
-- La RLS valida el tenant de la PROPIA línea, pero NO que matched_entry_id
-- apunte a un asiento del MISMO tenant. Sin esto, un PATCH directo vía PostgREST
-- (saltándose la action matchLine) podría ligar una línea propia a un asiento de
-- OTRO tenant: la FK pasa y la RLS de la línea pasa. No corrompe el mayor ajeno
-- (conciliar nunca muta asientos), pero rompe la integridad referencial
-- cross-tenant. Patrón espejo de 0093_comments_hardening (helper *_in_tenant +
-- trigger BEFORE INSERT/UPDATE) y de la regla del repo: el guard de integridad
-- del dinero vive en la DB, no solo en la action (que es forjable vía REST).

-- Helper compartido (lo reusa 0168 para fixed_asset_depreciation.entry_id):
-- ¿el asiento existe y es del tenant? security definer para no depender del
-- grant SELECT, con el tenant pasado explícito → sin fuga cross-tenant (el
-- trigger pasa NEW.tenant_id, que RLS ya forzó = tenant del caller).
create or replace function public.journal_entry_in_tenant(
  p_entry_id  uuid,
  p_tenant_id uuid
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.journal_entries je
    where je.id = p_entry_id and je.tenant_id = p_tenant_id
  );
$$;

comment on function public.journal_entry_in_tenant(uuid, uuid) is
  'SDD-0105: ¿el asiento p_entry_id pertenece a p_tenant_id? Lo usan los triggers de integridad cross-tenant de bank_statement_lines.matched_entry_id (0167) y fixed_asset_depreciation.entry_id (0168). Hardening A1.';

revoke execute on function public.journal_entry_in_tenant(uuid, uuid) from public, anon;
grant execute on function public.journal_entry_in_tenant(uuid, uuid) to authenticated;
grant execute on function public.journal_entry_in_tenant(uuid, uuid) to service_role;

-- Trigger: rechaza ligar un movimiento a un asiento de otro tenant (cualquier cliente).
create or replace function public.bank_statement_lines_validate_match()
returns trigger
language plpgsql
as $$
begin
  if new.matched_entry_id is not null
     and not public.journal_entry_in_tenant(new.matched_entry_id, new.tenant_id) then
    raise exception
      'movimiento ligado a un asiento inexistente o de otro tenant: %', new.matched_entry_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.bank_statement_lines_validate_match() from public, anon;

drop trigger if exists bank_statement_lines_validate_match_trg on public.bank_statement_lines;
create trigger bank_statement_lines_validate_match_trg
  before insert or update on public.bank_statement_lines
  for each row execute function public.bank_statement_lines_validate_match();

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0167_bank_reconciliation.sql
-- Aplicar (coordinación, NO en esta ventana): supabase migration apply 0167
-- ─────────────────────────────────────────────────────────────
