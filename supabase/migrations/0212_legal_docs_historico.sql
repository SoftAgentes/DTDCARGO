-- ─────────────────────────────────────────────────────────────
-- SDD-0054 (parity Norte) · legal_docs — histórico de versiones + Cambios
--
-- Lleva el repositorio legal al Norte (docs/design/studio/_norte/erp/modules/
-- admin-legal.jsx):
--   1. Columna `change_note` → la columna "Cambios" del histórico (qué cambió
--      en cada versión). Antes el repo mostraba "Secciones" (redundante).
--   2. Seed del histórico ARCHIVADO que faltaba: la DB solo tenía las 2 filas
--      vigentes (tyc v2.1 + operador v1.4), así que el "histórico de versiones"
--      mostraba una sola fila por doc. Se agregan las versiones anteriores
--      (archivadas) con su nota de cambios.
--
-- El TEXTO histórico (body) NO se conserva en el repositorio: de las versiones
-- viejas guardamos la traza (versión, vigencia, secciones, cambios), no el
-- articulado — por eso `body = '[]'` y las archivadas no tienen botón "Ver".
--
-- Aditiva y segura: solo ADD COLUMN (nullable) + INSERT idempotente. No toca
-- RLS, triggers ni datos vigentes. El índice parcial legal_docs_current_uniq
-- (≤1 vigente por tenant,key) no se afecta: las nuevas filas son 'archivada'.
-- ⚠️ NO se aplica a prod desde acá (lo hace el founder).
-- ─────────────────────────────────────────────────────────────

alter table public.legal_docs
  add column if not exists change_note text;

comment on column public.legal_docs.change_note is
  'SDD-0054 (Norte): nota de cambios de esta versión — columna "Cambios" del repositorio versionado.';

-- Notas de cambio de las versiones VIGENTES existentes (parity Norte LEGAL_DOCS).
update public.legal_docs
  set change_note = 'Añadidas cláusulas de naturaleza del servicio (comisionista) y subcontratación del operador.'
  where key = 'tyc' and version = 'v2.1' and change_note is null;

update public.legal_docs
  set change_note = 'Añadidas avería gruesa (York-Amberes) e identificación por Shipping Mark.'
  where key = 'operador' and version = 'v1.4' and change_note is null;

-- Histórico archivado (body vacío: se conserva la traza de versión, no el texto).
insert into public.legal_docs
  (tenant_id, key, name, audience, version, effective_date, status, sections, change_note, body)
select t.id, x.key, x.name, 'cliente', x.version, x.effective_date::date, 'archivada', x.sections, x.change_note, '[]'::jsonb
from public.tenants t
cross join (values
  ('tyc',      'Términos y Condiciones de DTD',              'v2.0', '2026-01-10', 9, 'Reescritura DDP + límite de responsabilidad al flete.'),
  ('tyc',      'Términos y Condiciones de DTD',              'v1.0', '2025-08-01', 6, 'Versión inicial.'),
  ('operador', 'Condiciones del Operador de Consolidación',  'v1.3', '2025-11-20', 7, 'Consolidación parcial P1/P2.'),
  ('operador', 'Condiciones del Operador de Consolidación',  'v1.0', '2025-06-01', 5, 'Versión inicial.')
) as x(key, name, version, effective_date, sections, change_note)
where t.slug = 'dtd'
on conflict (tenant_id, key, version) do nothing;

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0212_legal_docs_historico.sql
-- Aplicar con: MCP apply_migration · o supabase migration apply 0212
-- (lo hace el founder; el harness NO aplica a prod).
-- ─────────────────────────────────────────────────────────────
