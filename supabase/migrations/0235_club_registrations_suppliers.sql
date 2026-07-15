-- ─────────────────────────────────────────────────────────────
-- 0235 · SDD-0116 · Club DTD — cierre: Slice C.2 (inscripciones a
--        eventos) + Slice D (Proveedor del mes) + wiring de portal.
--
-- Cierra lo que quedó diferido del Club:
--   · C.2 · club_event_registrations — inscripción de un MIEMBRO del Club a un
--     EVENTO (academy_cohorts context='club', SDD-0116 D9). El evento no ancla al
--     miembro por client_markbox (academy_enrollments no sirve, ver 0188), así que
--     se modela aparte, anclado a club_members. Estados: inscrito | asistio |
--     no_asistio (crear evento → inscribir miembro → marcar asistencia, criterio C).
--   · D · club_featured_suppliers — "Proveedor del mes" (D8: derivado de una
--     inspección VERIFICADA de SDD-0066; white-label obligatorio — el nombre
--     mostrado es supplier_name, NUNCA provider_internal del reporte crudo). Único
--     por (tenant_id, period).
--   · wiring · policies de PORTAL (SDD-0042/0116 Slice E) additivas y SOLO SELECT:
--     el miembro ve los eventos del Club de su tenant, sus propias inscripciones y
--     el proveedor del mes publicado.
--
-- Convención del repo: enums lógicos = text + CHECK. RLS por tenant (Studio) +
-- policies de portal additivas (OR). Soft-delete. Defensa-en-DB: trigger
-- same-tenant por cada FK (la FK sola no garantiza tenant). GRANT antes de policy.
--
-- Aditiva e idempotente. NO aplicar a prod desde la rama — la aplica coordinación
-- / founder. Skills Supabase (seguridad + postgres-best-practices) seguidos.
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ C.2 · club_event_registrations — inscripciones a eventos    ║
-- ╚═══════════════════════════════════════════════════════════╝
create table if not exists public.club_event_registrations (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,

  -- El evento es una cohorte de Academia con context='club' (SDD-0116 D9). El
  -- trigger valida que sea del mismo tenant y realmente un evento del Club.
  event_id      uuid not null references public.academy_cohorts(id) on delete cascade,

  -- El inscrito ES un miembro del Club (no un client_markbox suelto).
  member_id     uuid not null references public.club_members(id) on delete cascade,

  status        text not null default 'inscrito'
    constraint club_event_registrations_status_chk
      check (status in ('inscrito', 'asistio', 'no_asistio')),

  note          text,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

comment on table public.club_event_registrations is
  'SDD-0116 Slice C.2: inscripción de un miembro del Club (club_members) a un evento (academy_cohorts context=''club''). Estados inscrito/asistio/no_asistio. RLS por tenant; defensa same-tenant por trigger. Soft delete.';

-- Un miembro = una inscripción VIVA por evento.
create unique index if not exists club_event_regs_one_live_per_member
  on public.club_event_registrations (event_id, member_id)
  where deleted_at is null;

create index if not exists club_event_regs_event_idx
  on public.club_event_registrations (event_id) where deleted_at is null;
create index if not exists club_event_regs_member_idx
  on public.club_event_registrations (member_id) where deleted_at is null;

grant select, insert, update on public.club_event_registrations to authenticated;
revoke all on public.club_event_registrations from anon;

alter table public.club_event_registrations enable row level security;

create policy "club_event_registrations by tenant" on public.club_event_registrations for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());

create trigger club_event_registrations_touch
  before update on public.club_event_registrations
  for each row execute function public.touch_updated_at();

-- Defensa-en-DB: event_id (evento del Club vivo, mismo tenant) + member_id
-- (miembro vivo, mismo tenant). La FK garantiza existencia, NO tenant ni contexto.
create or replace function public.club_event_registrations_validate_refs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.academy_cohorts c
    where c.id = new.event_id
      and c.tenant_id = new.tenant_id
      and c.context = 'club'
      and c.deleted_at is null
  ) then
    raise exception
      'club_event_registrations: event_id % no es un evento del Club vivo del tenant %', new.event_id, new.tenant_id
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from public.club_members m
    where m.id = new.member_id
      and m.tenant_id = new.tenant_id
      and m.deleted_at is null
  ) then
    raise exception
      'club_event_registrations: member_id % no es un miembro vivo del tenant %', new.member_id, new.tenant_id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

comment on function public.club_event_registrations_validate_refs() is
  'SDD-0116 C.2: valida que event_id (evento del Club, context=''club'') y member_id sean del MISMO tenant y estén vivos (defensa en profundidad; la FK no cubre tenant/contexto). SECURITY DEFINER, fail-closed.';

revoke execute on function public.club_event_registrations_validate_refs() from public, anon;

drop trigger if exists club_event_registrations_refs_same_tenant on public.club_event_registrations;
create trigger club_event_registrations_refs_same_tenant
  before insert or update of event_id, member_id, tenant_id on public.club_event_registrations
  for each row execute function public.club_event_registrations_validate_refs();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ D · club_featured_suppliers — Proveedor del mes            ║
-- ╚═══════════════════════════════════════════════════════════╝
create table if not exists public.club_featured_suppliers (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,

  -- Mes destacado, formato YYYY-MM (un proveedor del mes por período).
  period         text not null
    constraint club_featured_suppliers_period_chk check (period ~ '^\d{4}-\d{2}$'),

  -- White-label: nombre PÚBLICO del proveedor (curaduría DTD). NUNCA el
  -- provider_internal del reporte de inspección crudo (regla SDD-0066).
  supplier_name  text not null,

  -- D8: derivado de una inspección verificada (SDD-0066). Nullable pero es el eje
  -- del slice; el trigger valida que sea del mismo tenant si se setea.
  inspection_id  uuid references public.inspection_reports(id) on delete set null,

  category       text,
  blurb          text,                 -- curaduría editorial (por qué se destaca)
  cover_path     text,                 -- objeto en bucket (opcional)

  status         text not null default 'borrador'
    constraint club_featured_suppliers_status_chk check (status in ('borrador', 'publicado')),

  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

comment on table public.club_featured_suppliers is
  'SDD-0116 Slice D: "Proveedor del mes" del Club (D8: derivado de inspección verificada SDD-0066). supplier_name es WHITE-LABEL (nunca provider_internal crudo). Único por (tenant_id, period). RLS por tenant. Soft delete.';
comment on column public.club_featured_suppliers.supplier_name is
  'White-label (SDD-0066): nombre PÚBLICO curado por DTD. NUNCA el proveedor de inspección crudo (provider_internal).';
comment on column public.club_featured_suppliers.inspection_id is
  'SDD-0116 D8: inspección verificada (SDD-0066) que respalda al proveedor. Defendida same-tenant por trigger.';

-- Un proveedor del mes VIVO por período.
create unique index if not exists club_featured_suppliers_one_live_per_period
  on public.club_featured_suppliers (tenant_id, period)
  where deleted_at is null;

create index if not exists club_featured_suppliers_published_idx
  on public.club_featured_suppliers (tenant_id, period desc)
  where status = 'publicado' and deleted_at is null;

grant select, insert, update on public.club_featured_suppliers to authenticated;
revoke all on public.club_featured_suppliers from anon;

alter table public.club_featured_suppliers enable row level security;

create policy "club_featured_suppliers by tenant" on public.club_featured_suppliers for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());

create trigger club_featured_suppliers_touch
  before update on public.club_featured_suppliers
  for each row execute function public.touch_updated_at();

-- Defensa-en-DB: inspection_id, si se setea, debe ser un reporte vivo del mismo tenant.
create or replace function public.club_featured_suppliers_validate_refs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.inspection_id is not null then
    if not exists (
      select 1 from public.inspection_reports r
      where r.id = new.inspection_id
        and r.tenant_id = new.tenant_id
        and r.deleted_at is null
    ) then
      raise exception
        'club_featured_suppliers: inspection_id % no es un reporte vivo del tenant %', new.inspection_id, new.tenant_id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

comment on function public.club_featured_suppliers_validate_refs() is
  'SDD-0116 D: valida que inspection_id (si viene) sea un reporte de inspección vivo del MISMO tenant (SDD-0066). SECURITY DEFINER, fail-closed.';

revoke execute on function public.club_featured_suppliers_validate_refs() from public, anon;

drop trigger if exists club_featured_suppliers_refs_same_tenant on public.club_featured_suppliers;
create trigger club_featured_suppliers_refs_same_tenant
  before insert or update of inspection_id, tenant_id on public.club_featured_suppliers
  for each row execute function public.club_featured_suppliers_validate_refs();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ wiring · policies de PORTAL (Slice E) — additivas, SELECT   ║
-- ╚═══════════════════════════════════════════════════════════╝
-- El miembro del portal (get_portal_person_id, migr 0187) ve, ADEMÁS de su
-- membresía y sus rondas: los eventos del Club de su tenant, SUS inscripciones y
-- el proveedor del mes publicado. Solo si es miembro ACTIVO (mismo gate que 0187).

-- 1) academy_cohorts → eventos del Club (context='club') del tenant del miembro.
drop policy if exists "club_events portal read" on public.academy_cohorts;
create policy "club_events portal read" on public.academy_cohorts for select
  to authenticated
  using (
    deleted_at is null
    and context = 'club'
    and exists (
      select 1 from public.club_members m
      where m.tenant_id = academy_cohorts.tenant_id
        and m.person_id = public.get_portal_person_id()
        and m.status = 'activa'
        and m.deleted_at is null
    )
  );

-- 2) club_event_registrations → SOLO las propias (por su membresía).
drop policy if exists "club_event_registrations portal read" on public.club_event_registrations;
create policy "club_event_registrations portal read" on public.club_event_registrations for select
  to authenticated
  using (
    deleted_at is null
    and exists (
      select 1 from public.club_members m
      where m.id = club_event_registrations.member_id
        and m.person_id = public.get_portal_person_id()
        and m.deleted_at is null
    )
  );

-- 3) club_featured_suppliers → proveedor del mes PUBLICADO del tenant del miembro.
drop policy if exists "club_featured_suppliers portal read" on public.club_featured_suppliers;
create policy "club_featured_suppliers portal read" on public.club_featured_suppliers for select
  to authenticated
  using (
    deleted_at is null
    and status = 'publicado'
    and exists (
      select 1 from public.club_members m
      where m.tenant_id = club_featured_suppliers.tenant_id
        and m.person_id = public.get_portal_person_id()
        and m.status = 'activa'
        and m.deleted_at is null
    )
  );
