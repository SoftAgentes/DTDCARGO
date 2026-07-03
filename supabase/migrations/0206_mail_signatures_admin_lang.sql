-- ─────────────────────────────────────────────────────────────
-- SDD-0143 · Mailing al Norte — Firmas (Slice B)
--
-- 1. mail_signatures.lang: idioma por defecto de la firma (es/en/zh).
--    El editor de firma del Norte lo expone como "Idioma por defecto".
-- 2. Acceso admin a nivel tenant: el módulo Mailing es admin-only en la
--    capa app (page.tsx redirige a no-admin + moduleEditDenial en actions).
--    La vista Firmas del Norte lista/edita las firmas de TODO el equipo,
--    no solo la propia. Se agregan policies tenant-scoped (permissive,
--    conviven con las owner-scoped de 0018) siguiendo la regla de la casa:
--    "RLS por tenant, gating de rol en la capa app". Mismo patrón que
--    mail_logs_tenant_select (ya en prod).
--
-- Prereq: 0018_mailing.sql (tabla + enum + policies owner-scoped),
--         public.get_user_tenant_id() (helper del Studio).
-- ─────────────────────────────────────────────────────────────

-- ── 1. Columna lang ──────────────────────────────────────────
alter table public.mail_signatures
  add column if not exists lang text not null default 'es';

alter table public.mail_signatures
  drop constraint if exists mail_signatures_lang_check;
alter table public.mail_signatures
  add constraint mail_signatures_lang_check check (lang in ('es', 'en', 'zh'));

comment on column public.mail_signatures.lang is
  'Idioma por defecto de la firma (es/en/zh). Editable en Mailing → Firmas.';

-- ── 2. Acceso tenant-wide (admin del módulo Mailing) ─────────
-- Permissive: se suman a las owner-scoped de 0018 (una fila es accesible
-- si sos el dueño O sos miembro del tenant). El gating a rol admin lo hace
-- la app (módulo admin-only). No exponen datos de otros tenants.
drop policy if exists "mail_signatures_tenant_select" on public.mail_signatures;
create policy "mail_signatures_tenant_select"
  on public.mail_signatures for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()));

drop policy if exists "mail_signatures_tenant_insert" on public.mail_signatures;
create policy "mail_signatures_tenant_insert"
  on public.mail_signatures for insert to authenticated
  with check (tenant_id = (select public.get_user_tenant_id()));

drop policy if exists "mail_signatures_tenant_update" on public.mail_signatures;
create policy "mail_signatures_tenant_update"
  on public.mail_signatures for update to authenticated
  using (tenant_id = (select public.get_user_tenant_id()))
  with check (tenant_id = (select public.get_user_tenant_id()));

drop policy if exists "mail_signatures_tenant_delete" on public.mail_signatures;
create policy "mail_signatures_tenant_delete"
  on public.mail_signatures for delete to authenticated
  using (tenant_id = (select public.get_user_tenant_id()));
