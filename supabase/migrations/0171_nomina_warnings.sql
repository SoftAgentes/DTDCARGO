-- ─────────────────────────────────────────────────────────────
-- SDD-0103 (Slice C): Nómina / RRHH — Amonestaciones (Art. 79 LOTTT)
--
-- Acta disciplinaria que documenta una falta del empleado: causal (las
-- causas justificadas del Art. 79 LOTTT), relato del hecho, testigos y
-- severidad. Es la pieza #6 del roadmap (§6 del spec). El asistente del
-- Norte la arma por pasos: causa → relato → testigos → acta.
--
-- Es NÓMINA = PII de empleados. Mismas 3 capas de seguridad de 0160:
--   - RLS ESTRICTA por tenant Y rol (admin + accounting) vía nomina_can_access().
--   - Gate de rol app-level (requireModuleView / moduleEditDenial) = 2ª capa.
--   - cero PII real en git: el seed es DEMO FICTICIO.
--
-- Aditiva. text+check para los enums (extensible, sin landmine de cast
-- enum↔text). RPC correlativo next_warning_code (AM-NNNN), patrón de
-- next_employee_code (0160). Reusa nomina_can_access() y touch_updated_at().
--
-- NO aplicar a prod (lo hace la coordinación / founder).
-- ─────────────────────────────────────────────────────────────

create table public.nomina_warnings (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  employee_id        uuid not null references public.nomina_employees(id) on delete cascade,
  warning_code       text not null,                       -- AM-NNNN (next_warning_code)
  issued_on          date not null default current_date,  -- fecha de emisión del acta
  -- Contenido del acta.
  cause              text not null,                       -- causal Art. 79 LOTTT (o falta interna)
  narrative          text not null,                       -- relato del hecho
  witnesses          text,                                -- testigos (texto libre)
  severity           text not null default 'leve'
    check (severity in ('leve', 'grave', 'muy_grave')),
  status             text not null default 'emitida'
    check (status in ('emitida', 'anulada')),
  notes              text,
  created_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  unique (tenant_id, warning_code)
);

comment on table public.nomina_warnings is
  'SDD-0103 Slice C: amonestaciones (acta disciplinaria, Art. 79 LOTTT). PII de empleados. RLS por tenant Y rol (admin/accounting). Soft delete.';
comment on column public.nomina_warnings.cause is
  'Causal de la amonestación (una de las causas justificadas del Art. 79 LOTTT, o falta de régimen interno).';
comment on column public.nomina_warnings.warning_code is
  'Correlativo AM-NNNN por tenant (next_warning_code). El unique (tenant_id, warning_code) protege la carrera.';

-- Índices: listado por estado, amonestaciones por empleado / fecha.
create index nomina_warnings_tenant_status_idx
  on public.nomina_warnings (tenant_id, status)
  where deleted_at is null;

create index nomina_warnings_employee_idx
  on public.nomina_warnings (tenant_id, employee_id, issued_on desc)
  where deleted_at is null;

-- ── Correlativo AM-NNNN ───────────────────────────────────────
-- MAX(num)+1 por tenant (mismo patrón que next_employee_code, sin año).
-- assert_tenant_match exige tenant autenticado = el suyo. El unique
-- (tenant_id, warning_code) protege la carrera (2.º insert → 23505).
create or replace function public.next_warning_code(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max int;
begin
  perform public.assert_tenant_match(p_tenant_id);

  select coalesce(max((regexp_match(warning_code, '^AM-(\d+)$'))[1]::int), 0) + 1
    into v_max
    from public.nomina_warnings
   where tenant_id = p_tenant_id;

  return 'AM-' || lpad(v_max::text, 4, '0');
end;
$$;

comment on function public.next_warning_code is
  'SDD-0103: próximo código de amonestación AM-NNNN para el tenant (assert_tenant_match). MAX(num)+1, padding 4.';

revoke all on function public.next_warning_code(uuid) from public;
revoke execute on function public.next_warning_code(uuid) from anon;
grant execute on function public.next_warning_code(uuid) to authenticated;

-- ── Trigger de coherencia · el empleado pertenece al mismo tenant ──
-- security definer (patrón nomina_contractor_payment_check, 0161): defensa en
-- profundidad aunque la RLS with-check ya fuerza new.tenant_id = get_user_tenant_id().
create or replace function public.nomina_warning_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.nomina_employees e
    where e.id = new.employee_id and e.tenant_id = new.tenant_id
  ) then
    raise exception 'employee_id % no pertenece al tenant %', new.employee_id, new.tenant_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

comment on function public.nomina_warning_check is
  'SDD-0103: valida que la amonestación referencie un empleado del mismo tenant (coherencia + defensa en profundidad).';

revoke execute on function public.nomina_warning_check() from public, anon;

drop trigger if exists nomina_warning_check_trg on public.nomina_warnings;
create trigger nomina_warning_check_trg
  before insert or update on public.nomina_warnings
  for each row execute function public.nomina_warning_check();

-- Trigger updated_at (reusa touch_updated_at de 0002/0012).
create trigger nomina_warnings_touch
  before update on public.nomina_warnings
  for each row execute function public.touch_updated_at();

-- ── GRANTS explícitos (auto-expose new tables OFF) ────────────
grant select, insert, update, delete on public.nomina_warnings to authenticated;

-- ── RLS por tenant Y rol (admin/accounting) · reusa nomina_can_access() ──
alter table public.nomina_warnings enable row level security;

create policy "nomina_warnings by tenant and role"
  on public.nomina_warnings for all
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and deleted_at is null
    and (select public.nomina_can_access())
  )
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.nomina_can_access())
  );

-- ── Seed DEMO FICTICIO (tenant 'dtd') ─────────────────────────
-- Amonestación inventada (NO es personal real) atada al empleado demo EMP-0002
-- del seed de 0160. created_by = null (seed corre como postgres). Idempotente
-- por (tenant, warning_code).
insert into public.nomina_warnings
  (tenant_id, employee_id, warning_code, issued_on, cause, narrative, witnesses, severity, status, notes)
select
  e.tenant_id, e.id, 'AM-0001', '2026-05-18'::date,
  'Inasistencia injustificada (Art. 79, lit. f)',
  'No se presentó a su jornada el 15/05 ni notificó al supervisor. Acta demo ficticia.',
  'Supervisor de almacén (demo)',
  'leve', 'emitida', 'Registro demo ficticio.'
from public.nomina_employees e
join public.tenants t on t.id = e.tenant_id and t.slug = 'dtd'
where e.employee_code = 'EMP-0002'
  and not exists (
    select 1 from public.nomina_warnings w
    where w.tenant_id = e.tenant_id and w.warning_code = 'AM-0001'
  );
