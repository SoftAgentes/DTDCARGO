-- ─────────────────────────────────────────────────────────────
-- SDD-0140 (Fase 2): vínculo empleado ↔ puesto
--
-- Enlaza la ficha del empleado con su PERFIL de puesto (nomina_positions, 0204).
-- El puesto define el perfil (rol RBAC sugerido, disparadores, KPI…) desacoplado
-- de la persona; el empleado apunta a UN puesto. on delete set null: si se borra
-- el puesto, la ficha queda sin puesto (no se pierde el empleado).
--
-- El vínculo empleado ↔ USUARIO del sistema ya existe: nomina_employees.auth_user_id
-- (migr 0181, SDD-0113). El alta unificada (Fase 2) invita al usuario con el rol
-- que sugiere el puesto; el auth_user_id se completa al aceptar la invitación
-- (backfill por email en el accept flow).
--
-- Aditiva. NO aplicar a prod (lo hace la coordinación / founder).
-- ─────────────────────────────────────────────────────────────

alter table public.nomina_employees
  add column if not exists position_id uuid references public.nomina_positions(id) on delete set null;

comment on column public.nomina_employees.position_id is
  'SDD-0140: puesto (perfil) al que pertenece el empleado. FK a nomina_positions. El rol RBAC del usuario se sugiere desde el puesto en el alta unificada.';

-- Índice para "empleados de este puesto" (derivar el titular actual).
create index if not exists nomina_employees_position_idx
  on public.nomina_employees (position_id)
  where deleted_at is null and position_id is not null;
