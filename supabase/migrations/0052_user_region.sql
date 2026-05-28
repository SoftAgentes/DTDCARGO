-- ─────────────────────────────────────────────────────────────
-- SDD i18n CN Fase 1 · Region como atributo del user
--
-- Contenido:
--   - Enum public.user_region (ve | cn)
--   - Columna user_tenants.region default 've' (cubre backfill)
--   - Index user_tenants (tenant_id, region) para filtros frecuentes
--   - Columna bug_reports.reporter_locale default 'es-VE'
--     (sirve al Bug Reporter localizado: el triage VE sabe si
--      esperar texto CN o ES)
--
-- Decisión arquitectónica:
--   La oficina del user (region) es la única decisión que toma el
--   admin al invitar. De ahí se derivan locale, timezone, moneda
--   default — todo en lib/i18n/region.ts. NO se mezcla con
--   user_profiles.locale (que queda obsoleto para flow normal).
--
-- Backward-compat:
--   - Default 've' cubre todos los users existentes sin tocar nada.
--   - Schema reversible: drop column / drop type funciona si hay
--     que revertir.
-- ─────────────────────────────────────────────────────────────

-- ─── 1. Enum user_region ─────────────────────────────────────
create type public.user_region as enum ('ve', 'cn');

comment on type public.user_region is
  'Oficina del Studio user. ve=Venezuela (default), cn=China. Determina locale, timezone, moneda default y filtros UI.';

-- ─── 2. user_tenants.region ──────────────────────────────────
alter table public.user_tenants
  add column region public.user_region not null default 've';

comment on column public.user_tenants.region is
  'Oficina del user dentro del tenant. Default ve. Cambia con role separadamente — un user puede ser admin+ve o accounting+cn.';

create index user_tenants_region_idx
  on public.user_tenants (tenant_id, region);

-- ─── 3. bug_reports.reporter_locale ──────────────────────────
alter table public.bug_reports
  add column reporter_locale text not null default 'es-VE';

comment on column public.bug_reports.reporter_locale is
  'BCP-47 locale del user al momento de reportar. Usado por triage para saber si esperar texto CN o ES en title/description.';

-- ─── 4. Backfill explícito (defensivo) ───────────────────────
-- Los defaults ya cubren backfill, pero hacemos UPDATE explícito por
-- si en el futuro la migración corre en DB con rows pre-existentes
-- sin defaults aplicados.
update public.user_tenants
   set region = 've'
 where region is null;

update public.bug_reports
   set reporter_locale = 'es-VE'
 where reporter_locale is null;

-- ─── 5. user_profiles.locale nullable + nullificar default ───
-- user_profiles.locale debe ser NULL en el flow normal — region es la
-- fuente de verdad. Solo se setea como override avanzado real (caso
-- raro: admin VE que quiere ver Studio en zh-CN persistentemente).
--
-- La columna estaba NOT NULL DEFAULT 'es-VE' de la migración 0019.
-- Cambiamos a nullable y nullificamos los residuales 'es-VE' que
-- nunca fueron una decisión del user, solo el default automático.
alter table public.user_profiles
  alter column locale drop not null;

update public.user_profiles
   set locale = null
 where locale = 'es-VE';

comment on column public.user_profiles.locale is
  'Override avanzado del locale del user. NULL = derivado de user_tenants.region (flow normal). Solo se setea para casos extremos tipo "admin VE que quiere ver Studio en zh-CN persistentemente".';
