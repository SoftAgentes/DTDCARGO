-- ─────────────────────────────────────────────────────────────
-- SDD-0036 P1-1 fix: bug_tech_data SELECT solo admin del tenant
--
-- Hallazgo de codex review (2026-05-26):
--   La policy original `bug_tech_data_select` permitia que el reporter
--   leyera su propio tech_data (`b.reporter_id = auth.uid()`). Esto
--   rompe la decision D3 (auto-captura invisible) y, una vez que Fase 4
--   capture console + network + replay, expone potencialmente
--   passwords/tokens/secrets al propio reportador.
--
--   Esta migracion reemplaza la policy: ahora SOLO los admins del
--   tenant del bug pueden hacer SELECT a bug_tech_data. Reporter ya
--   no ve los datos tecnicos de su propio reporte (consistente con D3).
--
-- Idempotente: drop if exists antes de crear.
-- Aditivo: no toca otras policies del modulo, no toca datos.
-- ─────────────────────────────────────────────────────────────

drop policy if exists "bug_tech_data_select" on public.bug_tech_data;

create policy "bug_tech_data_admin_select"
  on public.bug_tech_data for select to authenticated
  using (
    exists (
      select 1
        from public.bug_reports b
        join public.user_tenants ut on ut.tenant_id = b.tenant_id
       where b.id = bug_tech_data.bug_id
         and ut.user_id = (select auth.uid())
         and ut.role = 'admin'
         and ut.disabled_at is null
    )
  );

comment on policy "bug_tech_data_admin_select" on public.bug_tech_data is
  'SDD-0036 P1-1 (codex review): solo admin del tenant del bug puede leer datos tecnicos. Reporter NO ve su propio tech_data (consistente con D3 auto-captura invisible).';
