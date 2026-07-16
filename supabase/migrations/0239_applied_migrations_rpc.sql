-- ─────────────────────────────────────────────────────────────
-- 0239 · Ledger de migraciones legible por service_role
--
-- POR QUÉ EXISTE: la 0228 estuvo DOS rondas /GOLD perdida (archivo en el repo,
-- nunca aplicada en prod) y se construyó el scorecard encima; se descubrió sola
-- cuando la 0236 reventó con `column s.industry does not exist`. El ledger de
-- prod saltaba de 0227 a 0229 y nadie lo miraba. La 0169 sigue perdida HOY por
-- lo mismo (ver `supabase/migrations-baseline.json`).
--
-- `scripts/check-migrations-applied.mjs` cierra ese hueco desde el gate, pero
-- necesita LEER el ledger. Y no puede:
--   · service_role NO tiene USAGE sobre el schema `supabase_migrations`
--     (verificado 2026-07-16: has_schema_privilege → false), y PostgREST solo
--     expone `public` → la tabla es inalcanzable desde el repo.
--   · La CLI (`supabase migration list`) exige o un PAT (`SUPABASE_ACCESS_TOKEN`)
--     o una DATABASE_URL. El PAT está PROHIBIDO en el árbol del proyecto
--     (AGENTS.md) y `DATABASE_URL` está vacía en `.env.local`.
-- Queda esta RPC: la única vía que no obliga a guardar un secreto nuevo.
--
-- SOLO LECTURA y SOLO service_role. No expone nada sensible de por sí (son
-- nombres de migración), pero igual se cierra a anon/authenticated: el mapa de
-- migraciones le dibuja a un atacante la superficie entera del schema, y la
-- regla del repo es revoke explícito en toda RPC nueva (migr 0209-0211).
--
-- `statements` y `rollback` NO se devuelven a propósito: son el SQL crudo de
-- cada migración (incluye grants, policies y nombres de objetos internos). El
-- check solo necesita saber QUÉ se aplicó, no CÓMO.
--
-- Aditiva, idempotente, sin DDL destructivo.
-- ─────────────────────────────────────────────────────────────

create or replace function public.applied_migration_names()
returns table (version text, name text)
language sql
security definer
-- search_path vacío → todo va calificado con su schema (convención del repo:
-- una RPC security definer con search_path mutable es escalable por el caller).
set search_path = ''
stable
as $$
  select m.version, m.name
  from supabase_migrations.schema_migrations m
  order by m.version
$$;

comment on function public.applied_migration_names is
  'Ledger de migraciones aplicadas (version + name), solo lectura, solo service_role. Lo consume scripts/check-migrations-applied.mjs desde el gate para cazar archivos del repo que nunca se aplicaron a prod (el caso 0228/0169). NO devuelve `statements` ni `rollback`: son el SQL crudo. security definer porque service_role no tiene USAGE sobre supabase_migrations.';

-- Cerrada a todo el mundo salvo service_role. `public` incluye a anon y
-- authenticated, pero se nombran igual: explícito > implícito, y si mañana
-- alguien hace GRANT a public por error, este revoke queda como documentación
-- de la intención.
revoke all on function public.applied_migration_names() from public, anon, authenticated;
grant execute on function public.applied_migration_names() to service_role;
