-- 0295 · SDD-0184 · Fase 3 · Plan de carga del contenedor, versionado
--
-- QUÉ GUARDA: el reparto de los lotes en las áreas del contenedor, tal como lo
-- calculó `planificarCarga()` (lib/shared/estiba-plan.ts). No es una tabla de
-- posiciones — eso es `consolidation_box_positions`, que guarda la REALIDAD.
-- Acá vive la HIPÓTESIS: dónde debería ir cada lote.
--
-- POR QUÉ VERSIONADO E INMUTABLE (calca packing_list_submissions, 0147):
-- recalcular no pisa, crea una versión nueva. Sin eso no se puede responder
-- "¿el operario cargó distinto al plan, o el plan cambió después de que cargó?"
-- — que es justo lo que la Fase 4 necesita para el diff plan ↔ realidad.
--
-- POR QUÉ jsonb Y NO FILAS: el resultado del motor es un árbol (pasos → áreas)
-- y se consume ENTERO o no se consume. Normalizarlo en dos tablas obligaría a
-- reconstruirlo en cada lectura sin ganar una sola consulta que hoy haga falta.
-- El motor es la fuente de verdad de la forma; la DB solo lo persiste. Si algún
-- día hace falta consultar por área, se agrega una vista o columnas generadas.
--
-- `input` se guarda además del `result` a propósito: sin él no se puede saber si
-- una diferencia entre dos versiones vino de que cambió la carga o de que cambió
-- el algoritmo. `algorithm_version` cierra ese mismo hueco del otro lado.
--
-- Aditiva. RLS fail-closed por tenant. Sin RPC: el versionado lo hace la server
-- action en una transacción lógica (flip is_current → insert), igual que el
-- resto del Studio; el índice único parcial es la red de seguridad real.
--
-- ⚠️ NO aplicar a prod desde acá (lo hace el founder, runbook
--    docs/runbooks/aplicar-migraciones-prod.md).

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. Tabla                                                  ║
-- ╚═══════════════════════════════════════════════════════════╝

create table if not exists public.consolidation_plans (
  id                uuid primary key default extensions.gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  consolidation_id  uuid not null references public.consolidations(id) on delete cascade,

  -- Versionado de la cadena (cadena = consolidation_id dentro del tenant).
  version_no        int not null default 1,
  is_current        boolean not null default true,

  -- Snapshot del espacio contra el que se calculó. Si mañana cambia la capacidad
  -- del catálogo, el plan viejo sigue explicándose solo.
  container_type    text not null,
  cbm_capacity      numeric(10,3) not null,
  zone_layout       jsonb not null,

  -- Qué entró y qué salió del motor.
  input             jsonb not null,   -- Lote[]
  result            jsonb not null,   -- PlanCarga (pasos, sinUbicar, stats, avisos)

  -- De qué versión del algoritmo salió: una diferencia entre planes puede venir
  -- de la carga o del motor, y sin esto no se distinguen.
  algorithm_version text not null default 'estiba-plan@1',

  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

comment on table public.consolidation_plans is
  'SDD-0184: plan de carga por volumen de una consolidación. Versionado inmutable: recalcular crea versión nueva. Es la HIPÓTESIS (dónde debería ir cada lote); la realidad vive en consolidation_box_positions.';
comment on column public.consolidation_plans.input is
  'SDD-0184: los lotes que entraron al motor (Lote[]). Se guarda para poder distinguir si una diferencia entre versiones vino de la carga o del algoritmo.';
comment on column public.consolidation_plans.result is
  'SDD-0184: la salida de planificarCarga() (PlanCarga). jsonb porque se consume entera; el motor es la fuente de verdad de la forma.';
comment on column public.consolidation_plans.cbm_capacity is
  'SDD-0184: capacidad ÚTIL usada al calcular. Snapshot: si el catálogo cambia, el plan viejo sigue siendo legible.';

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. Índices                                                ║
-- ╚═══════════════════════════════════════════════════════════╝

-- Invariante: a lo sumo UNA versión vigente por consolidación (no borrada).
create unique index if not exists consolidation_plans_one_current
  on public.consolidation_plans (consolidation_id)
  where is_current and deleted_at is null;

-- Historial: navegar la cadena de una consolidación por versión.
create index if not exists consolidation_plans_chain_idx
  on public.consolidation_plans (tenant_id, consolidation_id, version_no)
  where deleted_at is null;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. GRANTS + RLS                                           ║
-- ╚═══════════════════════════════════════════════════════════╝

grant select, insert, update, delete on public.consolidation_plans to authenticated;
grant all on public.consolidation_plans to service_role;

alter table public.consolidation_plans enable row level security;

-- Equipo (Studio): CRUD por tenant; lectura solo no-borradas.
create policy "consolidation_plans by tenant"
  on public.consolidation_plans for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

-- service_role: la PWA del operario lee el plan a través de server actions que
-- corren con admin client (el operario no es auth.users).
create policy "consolidation_plans service_role all"
  on public.consolidation_plans for all
  to service_role
  using (true)
  with check (true);

-- Sin policy anon/public: el plan es interno, nunca se expone al cliente final.

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 4. Coherencia de tenant con su consolidación              ║
-- ╚═══════════════════════════════════════════════════════════╝
-- La FK sola no impide colgar un plan de una consolidación de OTRO tenant: son
-- dos columnas independientes. Es el mismo helper que ya usan las tablas
-- polimórficas del repo.

create or replace function public.consolidation_plan_same_tenant()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not exists (
    select 1
    from public.consolidations c
    where c.id = new.consolidation_id
      and c.tenant_id = new.tenant_id
  ) then
    raise exception
      'consolidation_plans: la consolidación % no pertenece al tenant %',
      new.consolidation_id, new.tenant_id
      using errcode = '23514';
  end if;
  return new;
end;
$$;

comment on function public.consolidation_plan_same_tenant() is
  'SDD-0184: impide colgar un plan de una consolidación de otro tenant. Las dos FK son independientes, así que la coherencia no la da el schema.';

drop trigger if exists consolidation_plans_same_tenant on public.consolidation_plans;
create trigger consolidation_plans_same_tenant
  before insert or update of consolidation_id, tenant_id
  on public.consolidation_plans
  for each row
  execute function public.consolidation_plan_same_tenant();

revoke execute on function public.consolidation_plan_same_tenant() from public;
revoke execute on function public.consolidation_plan_same_tenant() from anon;
revoke execute on function public.consolidation_plan_same_tenant() from authenticated;

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0295_consolidation_plans.sql
