-- ─────────────────────────────────────────────────────────────
-- SDD-0110 · Cablear el posting contable del Financiero China
--            (extiende SDD-0059 / migr 0114)
--
-- El dominio Socio China ya construía el asiento (DR/CR) en
-- lib/studio/partner-finance/posting.ts pero NUNCA lo insertaba: las
-- server actions no llamaban al poster → journal_entry_id quedaba
-- siempre NULL y los cargos / conversiones / cruces no se contabilizaban.
--
-- Esta feature cablea el posting. Para que la fila origen apunte a su
-- asiento (back-pointer simétrico al journal_entries.{charge_id,
-- conversion_id, claim_offset_id} que ya creó 0114), agregamos la columna
-- journal_entry_id a las 2 tablas que NO la tenían:
--   - supplier_charges        · cargo del socio  → asiento de causación
--   - supplier_claim_offsets  · cruce contable   → asiento de neutralización
--
-- currency_conversions YA tiene journal_entry_id desde 0114 (no se toca).
--
-- ADITIVA y NO destructiva:
--   - Columna nullable (las filas viejas quedan NULL → asiento se puede
--     re-postear desde el back-fill / re-alta; idempotente por el índice
--     de journal_entries.charge_id / .claim_offset_id que ya existe).
--   - FK on delete set null (anular un asiento no rompe la fila origen).
--   - Índice parcial para el join asiento↔origen.
--   - RLS: NO se toca (las policies por tenant_id de 0114 ya cubren la
--     columna nueva; un ALTER ADD COLUMN no las altera).
--   - Sin DROP, sin ALTER de columna existente, sin backfill destructivo.
--
-- ⚠️ NO se aplica a prod desde acá (lo hace el founder).
-- Número de migración: 0178 (siguiente libre mirando TODAS las ramas).
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. supplier_charges.journal_entry_id (back-pointer)        ║
-- ╚═══════════════════════════════════════════════════════════╝
alter table public.supplier_charges
  add column if not exists journal_entry_id uuid
    references public.journal_entries(id) on delete set null;

comment on column public.supplier_charges.journal_entry_id is
  'SDD-0110: asiento de causación del cargo (DR 5.10 costo / CR 2.1.7 cuenta corriente socio). Back-pointer simétrico de journal_entries.charge_id. NULL = aún no asentado (re-posteable, idempotente).';

create index if not exists supplier_charges_journal_entry_idx
  on public.supplier_charges (journal_entry_id)
  where journal_entry_id is not null;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. supplier_claim_offsets.journal_entry_id (back-pointer)  ║
-- ╚═══════════════════════════════════════════════════════════╝
alter table public.supplier_claim_offsets
  add column if not exists journal_entry_id uuid
    references public.journal_entries(id) on delete set null;

comment on column public.supplier_claim_offsets.journal_entry_id is
  'SDD-0110: asiento de neutralización del cruce (DR 2.1.7 cuenta corriente socio / CR 5.10 reversa de costo). Back-pointer simétrico de journal_entries.claim_offset_id. NULL = aún no asentado (re-posteable, idempotente).';

create index if not exists claim_offset_journal_entry_idx
  on public.supplier_claim_offsets (journal_entry_id)
  where journal_entry_id is not null;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. UNIQUE parcial · 1 asiento vivo por origen (idempotencia)║
-- ╚═══════════════════════════════════════════════════════════╝
-- El poster (posting.ts) es read-then-write: chequea si ya hay asiento y recién
-- inserta. Eso es TOCTOU — dos altas casi simultáneas del mismo origen podían
-- crear DOS asientos. Los índices de 0114 (je_charge_idx, etc.) NO son únicos.
-- Estos UNIQUE parciales cierran la carrera en la DB: a lo sumo UN asiento vivo
-- (deleted_at is null) por cada origen. La segunda inserción concurrente choca
-- con unique-violation (23505) → el poster lo trata como "ya existe" + re-SELECT
-- + write-back (no falla). Anular (deleted_at) libera el slot para re-asentar.
--
-- Seguro de aplicar: charge_id / conversion_id / claim_offset_id en
-- journal_entries nunca se posteó antes de SDD-0110 → cero filas previas que
-- pudieran violar el unique. El partial-where excluye los asientos previos sin
-- origen (charge_id null, etc.) y los anulados.
create unique index if not exists je_charge_unique
  on public.journal_entries (tenant_id, charge_id)
  where charge_id is not null and deleted_at is null;

create unique index if not exists je_conversion_unique
  on public.journal_entries (tenant_id, conversion_id)
  where conversion_id is not null and deleted_at is null;

create unique index if not exists je_claim_offset_unique
  on public.journal_entries (tenant_id, claim_offset_id)
  where claim_offset_id is not null and deleted_at is null;

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0178_partner_finance_journal_link.sql
-- Aplicar con: supabase migration apply 0178 · o MCP apply_migration
-- (lo hace el founder; el harness NO aplica a prod).
-- ─────────────────────────────────────────────────────────────
