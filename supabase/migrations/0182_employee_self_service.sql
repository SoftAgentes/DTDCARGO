-- ─────────────────────────────────────────────────────────────
-- SDD-0113 Slice C/D (App empleado): self-service acotado al dueño
--
-- Tres piezas, todas fail-closed y acotadas a get_employee_id_for_user() (0181):
--
-- 1) RPC get_my_payslip(p_period): el empleado LEE su renglón de nómina del
--    período SIN abrir la RLS de payroll_run_lines (eso expondría sueldos de
--    todos). SECURITY DEFINER, devuelve SOLO su renglón y SOLO de cortes
--    confirmado/pagado (NO borrador advisory). Decisión founder: confirmado/pagado.
--
-- 2) Staging de cambio bancario (nomina_employee_bank_changes) + RPC
--    request_my_bank_change(): decisión founder = el cambio de cuenta NO entra
--    directo, queda PENDIENTE DE VERIFICACIÓN del admin (riesgo: empleado cambia
--    cuenta justo antes del pago). El admin confirma con confirm_bank_change()
--    (que SÍ aplica a la ficha) o rechaza.
--
-- 3) RPC update_my_contact(): el empleado edita SOLO phone/email de su ficha.
--    Allowlist EN LA DB (la RPC solo toca esas 2 columnas) — backstop del
--    allowlist de la action. NO se da policy de UPDATE directa sobre
--    nomina_employees al empleado (evita que un PostgREST crudo toque salary_usd).
--
-- Defensa en profundidad (perfil): (1) UI oculta · (2) allowlist en la action ·
-- (3) la DB solo expone columnas seguras vía RPC (no UPDATE directo del empleado).
--
-- Aditiva. NO aplicar a prod (lo hace la coordinación / founder).
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1) RPC get_my_payslip — recibo del período (fail-closed)   ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Devuelve SOLO el renglón del empleado autenticado, SOLO de cortes
-- confirmado/pagado. SECURITY DEFINER → no abre RLS de payroll_run_lines. Si el
-- empleado no tiene ficha enlazada o el corte no está confirmado/pagado → 0 filas.
create or replace function public.get_my_payslip(p_period text)
returns table (
  line_id              uuid,
  run_id               uuid,
  period_label         text,
  run_status           text,
  paid_at              timestamptz,
  confirmed_at         timestamptz,
  employee_code        text,
  employee_name        text,
  base_salary_usd      numeric,
  worked_days          int,
  overtime_hours       numeric,
  night_hours          numeric,
  overtime_pay_usd     numeric,
  night_pay_usd        numeric,
  loan_deduction_usd   numeric,
  statutory_deductions_usd numeric,
  gross_usd            numeric,
  total_deductions_usd numeric,
  net_usd              numeric,
  breakdown            jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.id, l.run_id, r.period_label, r.status, r.paid_at, r.confirmed_at,
    l.employee_code, l.employee_name, l.base_salary_usd,
    l.worked_days, l.overtime_hours, l.night_hours,
    l.overtime_pay_usd, l.night_pay_usd, l.loan_deduction_usd, l.statutory_deductions_usd,
    l.gross_usd, l.total_deductions_usd, l.net_usd, l.breakdown
  from public.nomina_payroll_run_lines l
  join public.nomina_payroll_runs r on r.id = l.run_id
  where l.employee_id = (select public.get_employee_id_for_user())
    and r.deleted_at is null
    and r.status in ('confirmado', 'pagado')          -- NUNCA borrador/anulado
    and (p_period is null or r.period_label = p_period)
  order by r.period_end desc
  limit 1
$$;

comment on function public.get_my_payslip is
  'SDD-0113 Slice C: recibo del período del empleado autenticado. SOLO su renglón (get_employee_id_for_user), SOLO cortes confirmado/pagado. NO abre RLS de payroll_run_lines. p_period null → el más reciente confirmado/pagado.';

revoke all on function public.get_my_payslip(text) from public;
revoke execute on function public.get_my_payslip(text) from anon;
grant execute on function public.get_my_payslip(text) to authenticated;

-- RPC auxiliar: lista de períodos confirmado/pagado del empleado (para el selector).
create or replace function public.get_my_payslip_periods()
returns table (period_label text, run_status text, period_end date)
language sql
stable
security definer
set search_path = public
as $$
  select r.period_label, r.status, r.period_end
  from public.nomina_payroll_run_lines l
  join public.nomina_payroll_runs r on r.id = l.run_id
  where l.employee_id = (select public.get_employee_id_for_user())
    and r.deleted_at is null
    and r.status in ('confirmado', 'pagado')
  order by r.period_end desc
$$;

comment on function public.get_my_payslip_periods is
  'SDD-0113: períodos confirmado/pagado con recibo del empleado autenticado (selector de la app).';

revoke all on function public.get_my_payslip_periods() from public;
revoke execute on function public.get_my_payslip_periods() from anon;
grant execute on function public.get_my_payslip_periods() to authenticated;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2) Cambio bancario = pendiente de verificación (staging)   ║
-- ╚═══════════════════════════════════════════════════════════╝
create table public.nomina_employee_bank_changes (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  employee_id        uuid not null references public.nomina_employees(id) on delete cascade,

  bank_name          text,
  bank_account_type  text check (bank_account_type in ('corriente', 'ahorro')),
  bank_account       text,

  status             text not null default 'pendiente'
    check (status in ('pendiente', 'confirmado', 'rechazado')),
  requested_at       timestamptz not null default now(),
  reviewed_by        uuid references auth.users(id) on delete set null,
  reviewed_at        timestamptz,
  rejection_reason   text,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.nomina_employee_bank_changes is
  'SDD-0113 Slice C: solicitud de cambio de datos bancarios del empleado. Decisión founder: NO entra directo, queda PENDIENTE de verificación del admin (riesgo de cambio justo antes del pago). El admin confirma (aplica a la ficha) o rechaza.';

create index nomina_employee_bank_changes_employee_idx
  on public.nomina_employee_bank_changes (tenant_id, employee_id, status);

-- Una sola solicitud PENDIENTE por empleado (no acumular).
create unique index nomina_employee_bank_changes_one_pending
  on public.nomina_employee_bank_changes (employee_id)
  where status = 'pendiente';

create trigger nomina_employee_bank_changes_touch
  before update on public.nomina_employee_bank_changes
  for each row execute function public.touch_updated_at();

-- Coherencia same-tenant (reusa employee_in_tenant de 0181).
create or replace function public.nomina_employee_bank_change_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.employee_in_tenant(new.employee_id, new.tenant_id) then
    raise exception 'employee_id % no pertenece al tenant %', new.employee_id, new.tenant_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.nomina_employee_bank_change_check() from public, anon;

drop trigger if exists nomina_employee_bank_change_check_trg on public.nomina_employee_bank_changes;
create trigger nomina_employee_bank_change_check_trg
  before insert or update on public.nomina_employee_bank_changes
  for each row execute function public.nomina_employee_bank_change_check();

grant select, insert, update, delete on public.nomina_employee_bank_changes to authenticated;

alter table public.nomina_employee_bank_changes enable row level security;

-- Admin/RRHH gestiona (confirmar/rechazar) dentro del tenant + rol.
create policy "nomina_employee_bank_changes admin manage"
  on public.nomina_employee_bank_changes for all
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.nomina_can_access())
  )
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.nomina_can_access())
  );

-- El empleado dueño LEE el estado de sus solicitudes (no INSERT directo: la RPC
-- request_my_bank_change valida y crea).
create policy "nomina_employee_bank_changes self read"
  on public.nomina_employee_bank_changes for select
  to authenticated
  using (employee_id = (select public.get_employee_id_for_user()));

-- ── RPC request_my_bank_change: el empleado solicita el cambio (staging) ──
-- SECURITY DEFINER → inserta en staging por el propio empleado, sin policy de
-- INSERT directa. Reemplaza cualquier pendiente anterior (un pendiente por
-- empleado). NO toca la ficha: el admin confirma.
create or replace function public.request_my_bank_change(
  p_bank_name text,
  p_bank_account_type text,
  p_bank_account text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp uuid;
  v_tenant uuid;
  v_id uuid;
begin
  v_emp := public.get_employee_id_for_user();
  if v_emp is null then
    raise exception 'No autorizado: sin ficha de empleado enlazada' using errcode = '42501';
  end if;

  if p_bank_account_type is not null and p_bank_account_type not in ('corriente', 'ahorro') then
    raise exception 'Tipo de cuenta inválido' using errcode = 'check_violation';
  end if;

  select tenant_id into v_tenant from public.nomina_employees where id = v_emp;

  -- Cancela el pendiente anterior (si lo hay) para respetar el unique parcial.
  update public.nomina_employee_bank_changes
    set status = 'rechazado',
        rejection_reason = 'reemplazado por una solicitud nueva',
        reviewed_at = now()
    where employee_id = v_emp and status = 'pendiente';

  insert into public.nomina_employee_bank_changes
    (tenant_id, employee_id, bank_name, bank_account_type, bank_account, status)
  values
    (v_tenant, v_emp, p_bank_name, p_bank_account_type, p_bank_account, 'pendiente')
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.request_my_bank_change is
  'SDD-0113 Slice C: el empleado solicita cambio bancario → staging PENDIENTE (no toca la ficha). Reemplaza el pendiente anterior. El admin confirma con confirm_bank_change().';

revoke all on function public.request_my_bank_change(text, text, text) from public;
revoke execute on function public.request_my_bank_change(text, text, text) from anon;
grant execute on function public.request_my_bank_change(text, text, text) to authenticated;

-- ── RPC confirm_bank_change: el ADMIN confirma → aplica a la ficha ──
create or replace function public.confirm_bank_change(p_change_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_change public.nomina_employee_bank_changes;
  v_admin_tenant uuid;
begin
  v_admin_tenant := public.get_user_tenant_id();
  if v_admin_tenant is null or not public.nomina_can_access() then
    raise exception 'Solo admin/accounting puede confirmar' using errcode = '42501';
  end if;

  select * into v_change from public.nomina_employee_bank_changes where id = p_change_id;
  if v_change.id is null then
    raise exception 'Solicitud no encontrada';
  end if;
  if v_change.tenant_id <> v_admin_tenant then
    raise exception 'La solicitud pertenece a otro tenant' using errcode = '42501';
  end if;
  if v_change.status <> 'pendiente' then
    raise exception 'La solicitud ya fue revisada';
  end if;

  update public.nomina_employees
    set bank_name = v_change.bank_name,
        bank_account_type = v_change.bank_account_type,
        bank_account = v_change.bank_account
    where id = v_change.employee_id and tenant_id = v_admin_tenant;

  update public.nomina_employee_bank_changes
    set status = 'confirmado', reviewed_by = (select auth.uid()), reviewed_at = now()
    where id = p_change_id;

  return true;
end;
$$;

comment on function public.confirm_bank_change is
  'SDD-0113: el admin confirma un cambio bancario → aplica a nomina_employees. Gate de rol nomina_can_access + same-tenant.';

revoke all on function public.confirm_bank_change(uuid) from public;
revoke execute on function public.confirm_bank_change(uuid) from anon;
grant execute on function public.confirm_bank_change(uuid) to authenticated;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3) RPC update_my_contact — phone/email (allowlist EN DB)   ║
-- ╚═══════════════════════════════════════════════════════════╝
-- El empleado edita SOLO phone/email. La RPC SECURITY DEFINER toca ÚNICAMENTE
-- esas 2 columnas → aunque la action mande salary_usd/cargo, la DB no los expone.
-- NO se da policy de UPDATE directa al empleado sobre nomina_employees.
create or replace function public.update_my_contact(p_phone text, p_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp uuid;
begin
  v_emp := public.get_employee_id_for_user();
  if v_emp is null then
    raise exception 'No autorizado: sin ficha de empleado enlazada' using errcode = '42501';
  end if;

  update public.nomina_employees
    set phone = p_phone, email = p_email
    where id = v_emp;

  return true;
end;
$$;

comment on function public.update_my_contact is
  'SDD-0113 Slice C: el empleado actualiza SOLO phone/email de su ficha. Allowlist EN LA DB (la RPC no toca más columnas). Backstop del allowlist de updateMyProfileAction.';

revoke all on function public.update_my_contact(text, text) from public;
revoke execute on function public.update_my_contact(text, text) from anon;
grant execute on function public.update_my_contact(text, text) to authenticated;
