-- ─────────────────────────────────────────────────────────────
-- SDD-0059 · Financiero con el Socio Logístico China — Slice B1
-- (Backend de reconciliación, SIN UI)
--
-- Cierra el dolor de mayor ROI del dominio: la RECONCILIACIÓN periódica del
-- estado de cuenta del socio China contra los cargos (supplier_charges) y el
-- libro mayor (partner_ledger_entries) de Slice A. Importa el estado externo
-- línea por línea y persiste la decisión de match (el motor de match vive en
-- lib/studio/partner-finance/reconciliation.ts — PURO, sin DB). 2 tablas:
--   partner_statements       · cabecera del estado de cuenta importado
--                              (período, totales, status importado/reconciliando/
--                              cerrado, archivo fuente en documents — 0097).
--   partner_statement_lines  · cada línea del estado, con su match_status
--                              (sin_match/match_auto/match_manual/discrepancia/
--                              solo_en_estado/solo_en_erp) + a qué cargo o entry
--                              del ERP quedó atada + confianza (alta/media/baja).
--
-- + RLS fail-closed por tenant_id (patrón get_user_tenant_id, 0096/0100/0110).
-- + Validación de integridad cross-tenant en la DB (lección 0045/0093):
--   helper charge_in_tenant() + ledger_entry_in_tenant() + statement_in_tenant()
--   + triggers BEFORE INSERT/UPDATE → un cliente PostgREST directo no puede
--   colgar una línea de un statement/charge/entry de OTRO tenant.
-- + Cierra el FOLLOW-UP del review de Slice A: helper charge_in_tenant() +
--   trigger sobre supplier_credit_notes validando que charge_id sea del mismo
--   tenant (Slice A dejó la validación cross-tenant de credit_notes pendiente).
--
-- Aditiva: reusa get_user_tenant_id() (0001), touch_updated_at() (0002),
-- suppliers (0088), documents (0097), supplier_charges / partner_ledger_entries
-- (0110). Engancha supplier_charges.statement_line_id (que 0110 dejó SIN FK)
-- → ahora se le agrega la FK diferida a partner_statement_lines.
--
-- NO incluye: ninguna UI / server action / página → Slice B2.
--
-- ⚠️ NO se aplica a prod desde acá (lo hace el founder).
-- Número de migración: 0112 (0111 cedida a SDD-0060 Documentos Versionado).
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. PARTNER_STATEMENTS · cabecera del estado de cuenta     ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Un estado de cuenta importado del socio China para un período. totals (USD y
-- RMB) son del propio documento (referencia para cuadrar contra el ERP).
-- source_file_document_id → documents (0097), nullable (el archivo subido).
-- status: importado (recién subido) → reconciliando (en proceso) → cerrado.
create table public.partner_statements (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references public.tenants(id) on delete cascade,
  supplier_id             uuid not null references public.suppliers(id) on delete restrict,
  period_label            text not null,                       -- "2026-Q1" / "marzo 2026"
  imported_at             timestamptz not null default now(),
  source_file_document_id uuid references public.documents(id) on delete set null,
  total_usd               numeric(14,2) not null default 0,
  total_rmb               numeric(14,2) not null default 0,
  status                  text not null default 'importado',
  created_at              timestamptz not null default now(),
  deleted_at              timestamptz,
  constraint partner_statements_status_check
    check (status in ('importado', 'reconciliando', 'cerrado'))
);

comment on table public.partner_statements is
  'SDD-0059 Slice B1: cabecera de un estado de cuenta del Socio China importado para un período. totals = referencia del documento para cuadrar contra el ERP. status importado→reconciliando→cerrado. Soft delete via deleted_at. RLS por tenant_id.';

create index partner_statements_tenant_supplier_idx
  on public.partner_statements (tenant_id, supplier_id) where deleted_at is null;

create index partner_statements_tenant_status_idx
  on public.partner_statements (tenant_id, status) where deleted_at is null;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. PARTNER_STATEMENT_LINES · cada línea del estado        ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Una fila = una línea del estado de cuenta del socio. El motor de match
-- (lib/reconciliation.ts) propone match_status + matched ids + confianza; el
-- operador resuelve en Slice B2. matched_charge_id → supplier_charges (0110),
-- matched_ledger_entry_id → partner_ledger_entries (0110), ambos nullable y
-- set null si el destino se borra. statement_id cascade (borrar el estado
-- borra sus líneas).
create table public.partner_statement_lines (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references public.tenants(id) on delete cascade,
  statement_id           uuid not null references public.partner_statements(id) on delete cascade,
  raw_description        text not null,
  raw_description_cn     text,
  amount                 numeric(14,2) not null,
  currency               text not null default 'USD',          -- USD/USDT/RMB/VES
  line_date              date,
  match_status           text not null default 'sin_match',
  matched_charge_id      uuid references public.supplier_charges(id) on delete set null,
  matched_ledger_entry_id uuid references public.partner_ledger_entries(id) on delete set null,
  match_confidence       text,                                 -- alta/media/baja (nullable)
  note                   text,
  created_at             timestamptz not null default now(),
  deleted_at             timestamptz,
  constraint partner_statement_lines_currency_check
    check (currency in ('USD', 'USDT', 'RMB', 'VES')),
  constraint partner_statement_lines_match_status_check
    check (match_status in (
      'sin_match',
      'match_auto',
      'match_manual',
      'discrepancia',
      'solo_en_estado',
      'solo_en_erp'
    )),
  constraint partner_statement_lines_confidence_check
    check (match_confidence is null or match_confidence in ('alta', 'media', 'baja'))
);

comment on table public.partner_statement_lines is
  'SDD-0059 Slice B1: cada línea de un estado de cuenta del Socio China. match_status (sin_match/match_auto/match_manual/discrepancia/solo_en_estado/solo_en_erp) lo propone el motor de match (lib/reconciliation.ts) y lo resuelve el operador (Slice B2). matched_charge_id/matched_ledger_entry_id atan al ERP. Soft delete via deleted_at. RLS por tenant_id.';

create index psl_tenant_statement_idx
  on public.partner_statement_lines (tenant_id, statement_id) where deleted_at is null;

create index psl_match_status_idx
  on public.partner_statement_lines (statement_id, match_status) where deleted_at is null;

create index psl_matched_charge_idx
  on public.partner_statement_lines (matched_charge_id) where matched_charge_id is not null;

create index psl_matched_entry_idx
  on public.partner_statement_lines (matched_ledger_entry_id) where matched_ledger_entry_id is not null;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. FK diferida: supplier_charges.statement_line_id        ║
-- ╚═══════════════════════════════════════════════════════════╝
-- 0110 dejó supplier_charges.statement_line_id como uuid SIN FK porque la
-- tabla destino (partner_statement_lines) era de Slice B. Ahora existe → se
-- agrega la FK (set null si la línea del estado se borra). Idempotente.
do $$
begin
  alter table public.supplier_charges
    drop constraint if exists supplier_charges_statement_line_fk;
  alter table public.supplier_charges
    add constraint supplier_charges_statement_line_fk
    foreign key (statement_line_id)
    references public.partner_statement_lines(id) on delete set null;
end $$;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 4. VALIDACIÓN cross-tenant en DB (lección 0045 / 0093)    ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Helpers SECURITY DEFINER: ¿el charge / ledger_entry / statement existe y es
-- del tenant? (null → true; el FK opcional se respeta). El filtro por tenant_id
-- es explícito (el trigger pasa NEW.tenant_id, que RLS ya forzó = tenant del
-- caller) → no hay fuga cross-tenant. Cubre PostgREST directo, no sólo la
-- server action (Slice B2).

create or replace function public.charge_in_tenant(
  p_charge uuid,
  p_tenant uuid
) returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_charge is null then
    return true;
  end if;
  return exists (
    select 1 from public.supplier_charges
    where id = p_charge and tenant_id = p_tenant and deleted_at is null
  );
end;
$$;

create or replace function public.ledger_entry_in_tenant(
  p_entry  uuid,
  p_tenant uuid
) returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_entry is null then
    return true;
  end if;
  return exists (
    select 1 from public.partner_ledger_entries
    where id = p_entry and tenant_id = p_tenant and deleted_at is null
  );
end;
$$;

create or replace function public.statement_in_tenant(
  p_statement uuid,
  p_tenant    uuid
) returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_statement is null then
    return true;
  end if;
  return exists (
    select 1 from public.partner_statements
    where id = p_statement and tenant_id = p_tenant and deleted_at is null
  );
end;
$$;

-- Trigger de validación de las líneas del estado: statement_id (obligatorio) +
-- matched_charge_id / matched_ledger_entry_id (opcionales) deben ser del mismo
-- tenant que la línea.
create or replace function public.partner_statement_line_validate_refs()
returns trigger
language plpgsql
as $$
begin
  if not public.statement_in_tenant(new.statement_id, new.tenant_id) then
    raise exception 'estado de cuenta inexistente o ajeno al tenant: %', new.statement_id
      using errcode = 'check_violation';
  end if;

  if not public.charge_in_tenant(new.matched_charge_id, new.tenant_id) then
    raise exception 'cargo inexistente o ajeno al tenant: %', new.matched_charge_id
      using errcode = 'check_violation';
  end if;

  if not public.ledger_entry_in_tenant(new.matched_ledger_entry_id, new.tenant_id) then
    raise exception 'entry inexistente o ajena al tenant: %', new.matched_ledger_entry_id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists psl_validate_refs_trg on public.partner_statement_lines;
create trigger psl_validate_refs_trg
  before insert or update on public.partner_statement_lines
  for each row execute function public.partner_statement_line_validate_refs();

-- Trigger de validación de la cabecera del estado: supplier_id del mismo
-- tenant. Reusa supplier_in_tenant() (0110).
create or replace function public.partner_statement_validate_refs()
returns trigger
language plpgsql
as $$
begin
  if not public.supplier_in_tenant(new.supplier_id, new.tenant_id) then
    raise exception 'proveedor inexistente o ajeno al tenant: %', new.supplier_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists partner_statements_validate_refs_trg on public.partner_statements;
create trigger partner_statements_validate_refs_trg
  before insert or update on public.partner_statements
  for each row execute function public.partner_statement_validate_refs();

-- ── FOLLOW-UP review Slice A: cross-tenant en supplier_credit_notes ──
-- Slice A dejó supplier_credit_notes SIN trigger cross-tenant (el charge_id
-- estaba garantizado sólo por la server action). Ahora que existe
-- charge_in_tenant(), se cierra: charge_id debe ser un cargo del mismo tenant.
create or replace function public.supplier_credit_note_validate_refs()
returns trigger
language plpgsql
as $$
begin
  if not public.charge_in_tenant(new.charge_id, new.tenant_id) then
    raise exception 'cargo inexistente o ajeno al tenant: %', new.charge_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists supplier_credit_notes_validate_refs_trg on public.supplier_credit_notes;
create trigger supplier_credit_notes_validate_refs_trg
  before insert or update on public.supplier_credit_notes
  for each row execute function public.supplier_credit_note_validate_refs();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 5. GRANTS EXPLÍCITOS (auto-expose new tables OFF)         ║
-- ╚═══════════════════════════════════════════════════════════╝
grant select, insert, update, delete on public.partner_statements      to authenticated;
grant select, insert, update, delete on public.partner_statement_lines to authenticated;

grant all on public.partner_statements      to service_role;
grant all on public.partner_statement_lines to service_role;

grant execute on function public.charge_in_tenant(uuid, uuid)        to authenticated;
grant execute on function public.ledger_entry_in_tenant(uuid, uuid)  to authenticated;
grant execute on function public.statement_in_tenant(uuid, uuid)     to authenticated;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 6. RLS · fail-closed por tenant_id (patrón 0096/0100/0110)║
-- ╚═══════════════════════════════════════════════════════════╝
alter table public.partner_statements      enable row level security;
alter table public.partner_statement_lines enable row level security;

-- partner_statements
create policy "partner_statements by tenant"
  on public.partner_statements for all to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());
create policy "partner_statements service_role all"
  on public.partner_statements for all to service_role using (true) with check (true);

-- partner_statement_lines
create policy "partner_statement_lines by tenant"
  on public.partner_statement_lines for all to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());
create policy "partner_statement_lines service_role all"
  on public.partner_statement_lines for all to service_role using (true) with check (true);

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0112_partner_statements.sql
-- Aplicar con: supabase migration apply 0112 · o MCP apply_migration
-- (lo hace el founder; el harness NO aplica a prod).
-- ─────────────────────────────────────────────────────────────
