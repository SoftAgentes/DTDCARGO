# aliado-tenant-coherence — Coherencia de tenant en `clients.aliado_id` (SDD-0456 / migración 0450)

Fecha: 2026-09-11. Task ID: `aliado-tenant-coherence`. Estado de tarea: en-progreso.
Owner / sesión escritora: `admiring-pascal-832793-fd-b54374` (sesión Claude `admiring-pascal-832793-fd`).
Repositorio: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO`.
Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/aliado-tenant-coherence`.
Rama: `codex/aliado-tenant-coherence`. Base: `07d000970011ee12364e31124ebe4b301f064b40` (origin/main al crear).

## Asignación (Director, sesión `dtdcargo-5f`)

- SDD-0456, reservada localmente por el Director en `codex/sdd-reserve-0456-aliado-tenant-coherence` (`efde2001`), incorporada por cherry-pick.
- Migración 0450, la siguiente libre según el inventario de 217 refs y worktrees.
- Base `main` (opción B): la FK compuesta no se ata a la PR #82 (migrate-first).
- El filtro explícito de `get_portal_brand()` (0401, PR #82) queda fuera de alcance, como seguimiento para cuando 0401 esté en main.
- Sin cambios TS: la FK garantiza la coherencia. No se toca `lib/studio/aliados/brand-resolve.ts` (#82 también lo modifica).

## Objetivo

Impedir en la base que `clients.aliado_id` apunte a un aliado de otro tenant, sin romper datos existentes. Preflight que falla sin DML si ya hay filas incoherentes, reportando solo el conteo.

## Aceptación

- Migración 0450 con preflight sin DML, `unique (tenant_id, id)` en `aliados` y FK compuesta `(tenant_id, aliado_id) → aliados (tenant_id, id)`. MATCH SIMPLE, ON DELETE RESTRICT y ON UPDATE NO ACTION, como la FK simple de 0362, que se conserva.
- Contrato SQL en `supabase/tests/`: RED, preflight, idempotencia, catálogo, comportamiento, y borrado de un aliado con clientes igual antes y después.
- Espera `0450_clients_aliado_mismo_tenant` en `supabase/migrations-baseline.json`.
- Validación: `check-schema-rebuild`, contratos SQL, `sdd:check`, `docs:check`, `check-pending-migration-symbols` y `corepack pnpm verify`.

## Alcance (allowlist)

`supabase/migrations/0450_clients_aliado_mismo_tenant.sql`, `supabase/tests/0450_clients_aliado_mismo_tenant.test.sql`, `supabase/migrations-baseline.json` (solo la espera 0450), `docs/specs/0456-aliado-tenant-coherence/spec.md`, `docs/specs/README.md` (generado) y este handoff.

## Permisos

Commits locales selectivos. Publicar la rama o abrir la PR draft requiere la autorización de Sam en esta sesión. Sin merge, sin producción, sin leer filas de negocio.
