-- ─────────────────────────────────────────────────────────────
-- SDD-0113 Slice A (Onboarding admin): invitaciones + solicitudes de registro
--   nomina_employee_invites + nomina_employee_registrations
--
-- Abre el onboarding del empleado: el admin genera una INVITACIÓN (link con
-- token), el candidato se auto-registra (SOLICITUD en staging), el admin la
-- aprueba → materializa la ficha nomina_employees (con el sueldo que define la
-- EMPRESA, no el que pidió el candidato) o la rechaza con motivo.
--
-- Decisiones del founder (2026-06-27):
--   - Auth empleado = patrón Portal Cliente (auth.users real); el alta/enlace del
--     login se hace en Slice C (acá la aprobación solo materializa la ficha).
--   - Registro SOLO con token de invitación válido (registro abierto CERRADO):
--     por eso registrations.invite_id es NOT NULL. No hay endpoint anónimo sin token.
--
-- La solicitud es STAGING (NO es todavía un nomina_employees). El candidato no
-- gana acceso hasta que el admin aprueba. PII de candidato → RLS estricta + la
-- foto va a Storage (nunca en git).
--
-- Money/PII → 3 capas (igual que 0160/0175): RLS por tenant Y rol (admin/
-- accounting) vía nomina_can_access(); gate de rol app-level; triggers de
-- coherencia same-tenant security definer. El submit del candidato (sin sesión)
-- lo hace la action con cliente de servicio que valida el token (no por RLS anon).
--
-- Aditiva. text+check para los enums. Reusa nomina_can_access() (0160) y
-- touch_updated_at() (0002/0012). gen_random_bytes vía extensions (search_path
-- no incluye extensions — calificar explícito).
--
-- NO aplicar a prod (lo hace la coordinación / founder).
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ Invitación (link con token que genera el admin)            ║
-- ╚═══════════════════════════════════════════════════════════╝
create table public.nomina_employee_invites (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,

  -- Token aleatorio del link /m/emp/registro?inv=<token>. Solo precarga + marca
  -- "invitación válida"; NO autentica (el registro pasa por aprobación del admin).
  token         text not null default encode(extensions.gen_random_bytes(16), 'hex'),

  cargo         text,                                   -- cargo sugerido (precarga el form)
  department    text,                                   -- área sugerida

  status        text not null default 'activa'
    check (status in ('activa', 'usada', 'revocada', 'expirada')),
  expires_at    timestamptz not null default (now() + interval '14 days'),
  used_at       timestamptz,

  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (token)
);

comment on table public.nomina_employee_invites is
  'SDD-0113 Slice A: link de invitación (token) que el admin comparte para que un candidato se auto-registre. El token precarga + marca válido; NO autentica. Lifecycle activa→usada/revocada/expirada. RLS por tenant Y rol (admin/accounting).';
comment on column public.nomina_employee_invites.token is
  'Aleatorio (16 bytes hex). El link es /m/emp/registro?inv=<token>. Validado server-side por la action del candidato (sin sesión).';

create index nomina_employee_invites_tenant_status_idx
  on public.nomina_employee_invites (tenant_id, status);

create trigger nomina_employee_invites_touch
  before update on public.nomina_employee_invites
  for each row execute function public.touch_updated_at();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ Solicitud de registro (staging — NO es un empleado aún)    ║
-- ╚═══════════════════════════════════════════════════════════╝
-- token-only: invite_id NOT NULL (no hay registro sin invitación válida).
create table public.nomina_employee_registrations (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  invite_id          uuid not null references public.nomina_employee_invites(id) on delete restrict,

  -- Datos que envía el candidato (PII).
  full_name          text not null,
  national_id        text not null,                     -- cédula/pasaporte (V-/E-/P-) · cédula-aware
  birth_date         date,
  phone              text,
  email              text not null,                     -- login futuro
  cargo              text,                              -- propuesto (informativo)
  start_date         date,
  bank_name          text,
  bank_account_type  text check (bank_account_type in ('corriente', 'ahorro')),
  bank_account       text,
  photo_path         text,                              -- Supabase Storage, nunca en git

  status             text not null default 'pendiente'
    check (status in ('pendiente', 'aprobada', 'rechazada')),
  reviewed_by        uuid references auth.users(id) on delete set null,
  reviewed_at        timestamptz,
  -- Se setea al aprobar (materialización de la ficha). El sueldo lo define la empresa.
  employee_id        uuid references public.nomina_employees(id) on delete set null,
  rejection_reason   text,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
  -- Sin deleted_at: una solicitud rechazada queda como rastro (no se borra).
);

comment on table public.nomina_employee_registrations is
  'SDD-0113 Slice A: solicitud de registro del candidato (STAGING — no es un empleado). El admin aprueba → materializa nomina_employees (sueldo lo fija la empresa) o rechaza con motivo. token-only: invite_id NOT NULL. RLS por tenant Y rol (admin/accounting); el submit del candidato sin sesión lo hace la action con service client validando el token.';
comment on column public.nomina_employee_registrations.employee_id is
  'null hasta aprobar. Al aprobar apunta al nomina_employees materializado.';

-- Una sola solicitud PENDIENTE por (tenant, email normalizado): evita doble envío.
create unique index nomina_employee_registrations_one_pending_per_email
  on public.nomina_employee_registrations (tenant_id, lower(email))
  where status = 'pendiente';

create index nomina_employee_registrations_tenant_status_idx
  on public.nomina_employee_registrations (tenant_id, status);

create index nomina_employee_registrations_invite_idx
  on public.nomina_employee_registrations (invite_id);

create trigger nomina_employee_registrations_touch
  before update on public.nomina_employee_registrations
  for each row execute function public.touch_updated_at();

-- ── Trigger de coherencia: la solicitud referencia una invitación (y, si está,
-- un empleado) del mismo tenant. security definer (patrón nomina_payroll_run_line_check).
create or replace function public.nomina_employee_registration_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.nomina_employee_invites i
    where i.id = new.invite_id and i.tenant_id = new.tenant_id
  ) then
    raise exception 'invite_id % no pertenece al tenant %', new.invite_id, new.tenant_id
      using errcode = 'check_violation';
  end if;
  if new.employee_id is not null and not exists (
    select 1 from public.nomina_employees e
    where e.id = new.employee_id and e.tenant_id = new.tenant_id
  ) then
    raise exception 'employee_id % no pertenece al tenant %', new.employee_id, new.tenant_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

comment on function public.nomina_employee_registration_check is
  'SDD-0113: valida que la solicitud referencie una invitación (y empleado, si está) del mismo tenant (coherencia + defensa en profundidad).';

revoke execute on function public.nomina_employee_registration_check() from public, anon;

drop trigger if exists nomina_employee_registration_check_trg on public.nomina_employee_registrations;
create trigger nomina_employee_registration_check_trg
  before insert or update on public.nomina_employee_registrations
  for each row execute function public.nomina_employee_registration_check();

-- ── GRANTS explícitos (auto-expose new tables OFF) ────────────
grant select, insert, update, delete on public.nomina_employee_invites to authenticated;
grant select, insert, update, delete on public.nomina_employee_registrations to authenticated;

-- ── RLS por tenant Y rol (admin/accounting) · reusa nomina_can_access() (0160) ──
alter table public.nomina_employee_invites enable row level security;
alter table public.nomina_employee_registrations enable row level security;

create policy "nomina_employee_invites by tenant and role"
  on public.nomina_employee_invites for all
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.nomina_can_access())
  )
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.nomina_can_access())
  );

create policy "nomina_employee_registrations by tenant and role"
  on public.nomina_employee_registrations for all
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.nomina_can_access())
  )
  with check (
    tenant_id = (select public.get_user_tenant_id())
    and (select public.nomina_can_access())
  );

-- Sin seed: las invitaciones y solicitudes las generan el admin y el candidato
-- desde la app. Nada de PII de candidatos adivinada en git.
