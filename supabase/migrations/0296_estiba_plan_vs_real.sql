-- 0296 · SDD-0184 · Fase 4 · El lazo: plan ↔ realidad
--
-- QUÉ CIERRA: hasta acá el plan (0295) y la realidad
-- (`consolidation_box_positions`, 0241/0246) vivían separados. Estas dos columnas
-- los atan: contra QUÉ plan se cargó, y si se cargó COMO decía.
--
-- POR QUÉ IMPORTA MÁS QUE EL PLAN MISMO: SDD-0163 diagnosticó por qué el escaneo
-- tiene ~0% de adopción — al operario no le devolvía nada. Con el plan, escanear
-- le dice qué hacer; y el desvío queda registrado sin pedirle un paso extra.
--
-- ⚠️ NO SE TOCA `stuff_lot_as_operario`. Agregarle parámetros con CREATE OR
-- REPLACE dejaría DOS aridades vivas en pg_proc, cada una con sus propios grants,
-- y la nueva nacería sin los `revoke` de public/anon — que es exactamente la
-- deuda que el repo ya cerró una vez (ver project_rpc_anon_execute_debt). El
-- server action marca las filas recién montadas con un UPDATE posterior; si ese
-- UPDATE falla, la estiba igual quedó registrada y solo se pierde la traza del
-- plan, que es el lado seguro de fallar.
--
-- Aditiva. Sin RLS nueva (la tabla ya la tiene de 0241). Sin funciones nuevas.
--
-- ⚠️ NO aplicar a prod desde acá (lo hace el founder, runbook
--    docs/runbooks/aplicar-migraciones-prod.md).

alter table public.consolidation_box_positions
  add column if not exists plan_id uuid
  references public.consolidation_plans(id) on delete set null;

-- Tri-estado a propósito:
--   true  → el operario confirmó la posición que proponía el plan
--   false → la cambió (hay desvío que mirar)
--   null  → se estibó sin plan calculado, o el marcado falló. NO es lo mismo que
--           "se desvió", y contarlo como desvío inventaría un problema que no
--           existe.
alter table public.consolidation_box_positions
  add column if not exists siguio_plan boolean;

comment on column public.consolidation_box_positions.plan_id is
  'SDD-0184: contra qué versión del plan se estibó esta caja. null = se estibó sin plan calculado. Con `on delete set null` para que borrar un plan no borre la realidad.';
comment on column public.consolidation_box_positions.siguio_plan is
  'SDD-0184: true = el operario confirmó la posición del plan · false = la cambió (desvío) · null = no había plan o el marcado falló. null NO es desvío.';

-- El diff plan↔realidad de una consolidación: se filtra por consolidación y se
-- mira el desvío. Parcial sobre vivas, igual que el resto de índices de la tabla.
create index if not exists consolidation_box_positions_plan_idx
  on public.consolidation_box_positions (consolidation_id, siguio_plan)
  where unstuffed_at is null;

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0296_estiba_plan_vs_real.sql
