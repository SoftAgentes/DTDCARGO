-- ─────────────────────────────────────────────────────────────
-- 0057 · seo_drafts brief fields (Plan v5 — Brief primero)
--
-- El wizard /studio/marketing/noticias-web invierte el orden del flow:
-- Step 0 pasa de "elegir Tipo editorial" a "Brief" (tema + links de
-- referencia + ángulo). Tipo + Categoría se derivan del brief via
-- detectBriefIntent().
--
-- Persistencia: dos columnas opcionales nuevas en seo_drafts. El
-- resto del schema (topic, tone, tipo, categoria, headlines, bullets,
-- article_markdown, focus_keyword, etc.) queda intacto.
--
-- brief_refs:   array de URLs de referencia (max 3 en UI, no enforced
--               aquí — la validación vive en lib/news + action).
-- brief_angle:  ángulo editorial en 1 oración, max 280 chars en UI.
--
-- Default '[]'::jsonb para refs garantiza que rows existentes (pre-v5)
-- queden con array vacío en lugar de NULL — el cliente puede asumir
-- array siempre.
-- ─────────────────────────────────────────────────────────────

alter table public.seo_drafts
  add column if not exists brief_refs jsonb not null default '[]'::jsonb,
  add column if not exists brief_angle text;

comment on column public.seo_drafts.brief_refs is
  'Links de referencia opcionales que el operador pegó en el step 0 Brief (max 3 en UI). Plan v5.';

comment on column public.seo_drafts.brief_angle is
  'Ángulo editorial en 1 oración — qué se debe llevar el lector (max 280 chars en UI). Plan v5.';
