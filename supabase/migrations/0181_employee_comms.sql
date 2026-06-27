-- ─────────────────────────────────────────────────────────────
-- SDD-0113 Slice B (Comunicaciones): nomina_employee_comms
--
-- Comunicación de RRHH dirigida a UN empleado, con acuse de recibo in-app.
-- La tabla que NO existía. type espeja COMM_TYPES del Norte (recibo/aviso/
-- llamado/amonestacion). ref_kind/ref_id = puntero POLIMÓRFICO opcional a la
-- entidad origen (un payroll_run_line, una nomina_warnings).
--
-- Defensa-en-DB (money + PII, patrón SDD-0102/0107):
--   - helper employee_in_tenant(p_employee_id, p_tenant_id) SECURITY DEFINER,
--     fail-closed, set search_path = public, revoke from public/anon + grant a
--     authenticated.
--   - trigger employee_comms_same_tenant BEFORE INSERT/UPDATE: rechaza un
--     employee_id de otro tenant Y, si ref_id apunta a otra tabla conocida,
--     valida que esa fila sea del MISMO tenant (no se confía solo en la action).
--
-- RLS DOBLE LADO:
--   - admin/accounting (nomina_can_access, 0160): crear/listar/soft-delete (RRHH).
--   - empleado DUEÑO (get_employee_id_for_user, 0182): leer + marcar read_at/
--     acked_at SOLO de los suyos; with check IMPIDE que el empleado cree comms o
--     mueva un comm a otro empleado.
--
-- Aditiva. text+check para los enums. NO aplicar a prod (lo hace la coordinación).
--
-- DEPENDE de: enlace auth empleado (nomina_employees.auth_user_id) +
-- get_employee_id_for_user() — definidos ACÁ ARRIBA porque las policies de
-- employee_comms los referencian (Postgres resuelve la función al crear la policy).
-- El RPC get_my_payslip() va en 0182.
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ Enlace auth del empleado (patrón Portal Cliente, SDD-0042) ║
-- ╚═══════════════════════════════════════════════════════════╝
-- El empleado es un auth.users REAL. auth_user_id enlaza la ficha con su login;
-- lo setea approveRegistrationAction al aprobar (crea/enlaza el auth.user). Único
-- (1 empleado por auth.user). Aditiva sobre 0160.
alter table public.nomina_employees
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

comment on column public.nomina_employees.auth_user_id is
  'SDD-0113 Slice C: enlace al auth.users del empleado (login propio de /m/emp, patrón Portal Cliente). null = sin acceso. Único por auth.user.';

-- Un auth.user = a lo sumo un empleado vivo (mismo patrón que client_users).
create unique index if not exists nomina_employees_auth_user_uniq
  on public.nomina_employees (auth_user_id)
  where auth_user_id is not null and deleted_at is null;

-- get_employee_id_for_user(): resuelve auth.uid() → nomina_employees.id (o NULL).
-- Patrón get_portal_client_id (SDD-0042). stable, security definer, fail-closed.
-- Solo empleados activos/inactivos NO egresados y NO soft-deleted obtienen acceso.
create or replace function public.get_employee_id_for_user()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select e.id from public.nomina_employees e
  where e.auth_user_id = (select auth.uid())
    and e.deleted_at is null
    and e.status <> 'egresado'
  limit 1
$$;

comment on function public.get_employee_id_for_user is
  'SDD-0113: nomina_employees.id enlazado al auth.uid() actual, o NULL. Patrón get_portal_client_id. NO toca get_user_tenant_id(). fail-closed (egresado/soft-deleted → sin acceso).';

revoke all on function public.get_employee_id_for_user() from public;
revoke execute on function public.get_employee_id_for_user() from anon;
grant execute on function public.get_employee_id_for_user() to authenticated;

-- Policy ADITIVA sobre nomina_employees: el empleado DUEÑO LEE su propia ficha
-- (la app /m/emp la consume con la sesión del empleado, NO un rol Studio). La
-- escritura del empleado NO usa policy de UPDATE self (sería superficie amplia):
-- va por RPCs angostas SECURITY DEFINER en 0182 (update_my_contact = phone/email;
-- request_my_bank_change = staging). Solo-lectura acá, a propósito.
create policy "nomina_employees self read"
  on public.nomina_employees for select
  to authenticated
  using (
    deleted_at is null
    and id = (select public.get_employee_id_for_user())
  );

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ Helper: ¿el empleado pertenece al tenant? (fail-closed)    ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Reutilizable por el trigger de coherencia. SECURITY DEFINER para poder leer
-- nomina_employees sin que la RLS del caller (que podría ser el propio empleado)
-- lo recorte. Fail-closed: null in → false.
create or replace function public.employee_in_tenant(p_employee_id uuid, p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (p_employee_id is not null and p_tenant_id is not null and exists (
      select 1 from public.nomina_employees e
      where e.id = p_employee_id and e.tenant_id = p_tenant_id
    )),
    false
  );
$$;

comment on function public.employee_in_tenant is
  'SDD-0113: ¿el empleado pertenece al tenant? fail-closed. Lo usa el trigger de coherencia de employee_comms (defensa-en-DB polimórfica). SECURITY DEFINER porque el caller puede ser el propio empleado con RLS acotada.';

revoke all on function public.employee_in_tenant(uuid, uuid) from public;
revoke execute on function public.employee_in_tenant(uuid, uuid) from anon;
grant execute on function public.employee_in_tenant(uuid, uuid) to authenticated;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ Comunicación de RRHH → empleado (con acuse)                ║
-- ╚═══════════════════════════════════════════════════════════╝
create table public.nomina_employee_comms (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  employee_id  uuid not null references public.nomina_employees(id) on delete cascade,

  type         text not null
    check (type in ('recibo', 'aviso', 'llamado', 'amonestacion')),
  title        text not null,
  body         text not null,

  -- Puntero POLIMÓRFICO opcional a la entidad origen. ref_kind acota qué tabla
  -- (el trigger valida same-tenant para los kinds conocidos).
  ref_kind     text check (ref_kind in ('payroll_run_line', 'warning', 'loan', 'payroll_run')),
  ref_id       uuid,

  -- llamado/amonestacion → requires_ack=true (botón "Acuso recibo").
  requires_ack boolean not null default false,
  read_at      timestamptz,                 -- el empleado lo abrió
  acked_at     timestamptz,                 -- el empleado tocó "Acuso recibo"

  created_by   uuid references auth.users(id) on delete set null,  -- quién lo envió (RRHH)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,                 -- soft-delete

  -- Coherencia: si hay ref_id debe haber ref_kind y viceversa.
  constraint nomina_employee_comms_ref_pair check (
    (ref_kind is null and ref_id is null) or (ref_kind is not null and ref_id is not null)
  )
);

comment on table public.nomina_employee_comms is
  'SDD-0113 Slice B: comunicación de RRHH a UN empleado, con acuse in-app (read_at/acked_at). type espeja COMM_TYPES del Norte. ref_kind/ref_id = puntero polimórfico opcional (defensa-en-DB same-tenant por trigger). RLS DOBLE: admin (nomina_can_access) + empleado dueño (get_employee_id_for_user). Soft delete.';
comment on column public.nomina_employee_comms.acked_at is
  'Timestamp del acuse in-app (NO firma legal cualificada). Rastro legal-light de notificación.';

-- Inbox del empleado: por empleado, no leídos primero.
create index nomina_employee_comms_employee_idx
  on public.nomina_employee_comms (tenant_id, employee_id)
  where deleted_at is null;

-- Listado admin por tenant/estado de acuse.
create index nomina_employee_comms_tenant_idx
  on public.nomina_employee_comms (tenant_id)
  where deleted_at is null;

create trigger nomina_employee_comms_touch
  before update on public.nomina_employee_comms
  for each row execute function public.touch_updated_at();

-- ── Trigger de coherencia same-tenant (defensa-en-DB polimórfica) ──
-- (1) employee_id debe ser del mismo tenant. (2) Si ref_id apunta a una tabla
-- conocida (ref_kind), esa fila debe ser del MISMO tenant — no se confía en la
-- action. security definer (lee tablas que el caller-empleado no ve por RLS).
create or replace function public.nomina_employee_comm_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- (1) El empleado pertenece al tenant del comm.
  if not public.employee_in_tenant(new.employee_id, new.tenant_id) then
    raise exception 'employee_id % no pertenece al tenant %', new.employee_id, new.tenant_id
      using errcode = 'check_violation';
  end if;

  -- (2) El puntero polimórfico, si existe, es del mismo tenant.
  if new.ref_kind is not null and new.ref_id is not null then
    if new.ref_kind = 'payroll_run_line' then
      if not exists (
        select 1 from public.nomina_payroll_run_lines l
        where l.id = new.ref_id and l.tenant_id = new.tenant_id
      ) then
        raise exception 'ref_id % (payroll_run_line) no pertenece al tenant %', new.ref_id, new.tenant_id
          using errcode = 'check_violation';
      end if;
    elsif new.ref_kind = 'payroll_run' then
      if not exists (
        select 1 from public.nomina_payroll_runs r
        where r.id = new.ref_id and r.tenant_id = new.tenant_id
      ) then
        raise exception 'ref_id % (payroll_run) no pertenece al tenant %', new.ref_id, new.tenant_id
          using errcode = 'check_violation';
      end if;
    elsif new.ref_kind = 'warning' then
      if not exists (
        select 1 from public.nomina_warnings w
        where w.id = new.ref_id and w.tenant_id = new.tenant_id
      ) then
        raise exception 'ref_id % (warning) no pertenece al tenant %', new.ref_id, new.tenant_id
          using errcode = 'check_violation';
      end if;
    elsif new.ref_kind = 'loan' then
      if not exists (
        select 1 from public.nomina_loans ln
        where ln.id = new.ref_id and ln.tenant_id = new.tenant_id
      ) then
        raise exception 'ref_id % (loan) no pertenece al tenant %', new.ref_id, new.tenant_id
          using errcode = 'check_violation';
      end if;
    end if;
  end if;

  return new;
end;
$$;

comment on function public.nomina_employee_comm_check is
  'SDD-0113: valida que el comm referencie un empleado (y un ref_id polimórfico, si está) del MISMO tenant. Defensa-en-DB: no se confía en la action.';

revoke execute on function public.nomina_employee_comm_check() from public, anon;

drop trigger if exists nomina_employee_comm_check_trg on public.nomina_employee_comms;
create trigger nomina_employee_comm_check_trg
  before insert or update on public.nomina_employee_comms
  for each row execute function public.nomina_employee_comm_check();

-- ── GRANTS explícitos (auto-expose new tables OFF) ────────────
grant select, insert, update, delete on public.nomina_employee_comms to authenticated;

-- ── RLS DOBLE LADO ────────────────────────────────────────────
alter table public.nomina_employee_comms enable row level security;

-- (A) Lado ADMIN/RRHH: crear, listar, soft-delete dentro del tenant + rol.
create policy "nomina_employee_comms admin manage"
  on public.nomina_employee_comms for all
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.nomina_can_access())
  )
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.nomina_can_access())
  );

-- (B) Lado EMPLEADO DUEÑO: LEER solo los suyos.
create policy "nomina_employee_comms self read"
  on public.nomina_employee_comms for select
  to authenticated
  using (
    deleted_at is null
    and employee_id = (select public.get_employee_id_for_user())
  );

-- (C) Lado EMPLEADO DUEÑO: UPDATE solo de los suyos (marcar read_at/acked_at).
-- with check exige que SIGA siendo suyo → no puede reasignar el comm a otro
-- empleado. NO hay policy de INSERT/DELETE para el empleado → no puede crear ni
-- borrar comms (solo el admin via policy A). La RLS no distingue COLUMNAS → el
-- allowlist de columnas lo fuerza el trigger de guard de abajo (defensa-en-DB),
-- no solo la action: un PostgREST directo del empleado tampoco puede reescribir
-- el contenido del acta.
create policy "nomina_employee_comms self update"
  on public.nomina_employee_comms for update
  to authenticated
  using (
    deleted_at is null
    and employee_id = (select public.get_employee_id_for_user())
  )
  with check (
    deleted_at is null
    and employee_id = (select public.get_employee_id_for_user())
  );

-- ── Guard de columnas para el empleado dueño (allowlist-en-DB) ──
-- La policy C deja al empleado actualizar SU fila, pero RLS no restringe columnas.
-- Sin esto, vía PostgREST directo el empleado podría reescribir body/title de una
-- amonestación recibida (acta Art. 79 LOTTT) o poner requires_ack=false/acked_at=null
-- antes de acusar → repudio/manipulación de evidencia. Este trigger congela todo
-- salvo read_at/acked_at cuando el caller NO es admin (nomina_can_access()=false).
-- Mismo patrón que el guard del perfil (update_my_contact/self_guard).
create or replace function public.nomina_employee_comm_update_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Admin/RRHH (nomina_can_access) gestiona libremente.
  if (select public.nomina_can_access()) then
    return new;
  end if;
  -- Empleado: SOLO read_at/acked_at pueden cambiar. El resto, congelado.
  if new.type        is distinct from old.type
     or new.title    is distinct from old.title
     or new.body     is distinct from old.body
     or new.requires_ack is distinct from old.requires_ack
     or new.ref_kind is distinct from old.ref_kind
     or new.ref_id   is distinct from old.ref_id
     or new.employee_id is distinct from old.employee_id
     or new.tenant_id is distinct from old.tenant_id
     or new.created_by is distinct from old.created_by
     or new.deleted_at is distinct from old.deleted_at then
    raise exception 'el empleado solo puede marcar leído/acuse de su comunicación'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

comment on function public.nomina_employee_comm_update_guard is
  'SDD-0113 (defensa-en-DB): para el empleado dueño (no admin) congela todo salvo read_at/acked_at en un UPDATE de su comm. Impide reescribir el acta/amonestación o falsear requires_ack/acked_at vía PostgREST directo.';

revoke execute on function public.nomina_employee_comm_update_guard() from public, anon;

drop trigger if exists nomina_employee_comm_update_guard_trg on public.nomina_employee_comms;
create trigger nomina_employee_comm_update_guard_trg
  before update on public.nomina_employee_comms
  for each row execute function public.nomina_employee_comm_update_guard();

-- Sin seed: las comunicaciones las genera RRHH desde el Studio.
