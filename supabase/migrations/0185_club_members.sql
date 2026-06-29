-- ─────────────────────────────────────────────────────────────
-- 0185 · SDD-0116 · Club DTD — Slice A: membresía
--   club_members
--
-- El Club DTD es el "motor de dinero recurrente" de la Academia (SDD-0093): la
-- comunidad de importadores que importan CON DTD. Slice A modela SOLO la
-- membresía, anclada a `persons` (identidad por cédula, SDD-0106/0107).
--
-- Decisiones del founder (2026-06-28) reflejadas acá:
--   D1 · miembro del Club = miembro de la Academia (el gate de elegibilidad lo
--        da Academia; NO hay escalón de pago aparte).
--   D3 · planes = comunidad | importador | mayorista.
--   D4 · SIN cuota (gratis): se monetiza vía logística/compra grupal. Por eso
--        esta tabla NO modela cobro ni vigencia — `current_period_end` queda
--        nullable y sin uso (placeholder si cambia D4); `status` se reduce a
--        activa | pausada | cancelada (sin 'vencida', que solo tenía sentido con
--        cuota). D2 de facto: el `plan` vive acá, no se deriva de fidelización.
--   D6 · administra commercial + support (RLS por tenant; el rol lo gatea el RBAC
--        app-level, SDD-0085).
--
-- Convención del repo: enums lógicos = text + CHECK. RLS por tenant (Studio).
-- Soft-delete. Una persona = una membresía viva por tenant. Defensa-en-DB:
-- `person_in_tenant()` (0107) + trigger same-tenant (la FK sola no garantiza el
-- tenant); idem client_markbox si se setea.
--
-- Aditiva e idempotente. NO aplicar a prod desde la rama — la aplica
-- coordinación / founder. Skills Supabase (seguridad + postgres-best-practices)
-- seguidos.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.club_members (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,

  -- El miembro ES una persona (SDD-0106). on delete restrict: no perdemos la
  -- membresía en silencio si alguien intenta borrar la persona.
  person_id           uuid not null references public.persons(id) on delete restrict,

  -- Vínculo opcional al perfil de carga (Shipping Mark): un miembro puede ser
  -- academia-only sin carga todavía. text → clients.markbox (mismo tenant, trigger).
  client_markbox      text,

  -- Plan / tier (D3). El precio NO vive acá (D4: gratis).
  plan                text not null default 'comunidad'
    constraint club_members_plan_chk check (plan in ('comunidad', 'importador', 'mayorista')),

  -- Estado de la membresía (D4: sin 'vencida', no hay cuota).
  status              text not null default 'activa'
    constraint club_members_status_chk check (status in ('activa', 'pausada', 'cancelada')),

  joined_at           timestamptz not null default now(),
  -- Placeholder de vigencia: nullable y SIN USO en Slice A (D4 = gratis). Si una
  -- futura recurrencia cambia D4, acá vive el fin de período vigente.
  current_period_end  date,

  source              text,                          -- de dónde entró: academia | referido | evento | manual (libre)
  notes               text,

  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

comment on table public.club_members is
  'SDD-0116 Slice A: membresía del Club DTD anclada a persons (SDD-0106). D4: gratis → NO modela cobro/vigencia (current_period_end placeholder sin uso); registra plan (tier) + status por persona. RLS por tenant; rol gateado por RBAC app-level. Soft delete.';
comment on column public.club_members.person_id is
  'SDD-0116: el miembro ES una persona (identidad por cédula, SDD-0106). on delete restrict. Defendido same-tenant por trigger (la FK no garantiza tenant).';
comment on column public.club_members.current_period_end is
  'SDD-0116 D4 (gratis): placeholder de vigencia, nullable y SIN USO en Slice A. Reservado por si una futura recurrencia reintroduce cuota.';

-- Una persona = una membresía VIVA por tenant.
create unique index if not exists club_members_one_live_per_person
  on public.club_members (tenant_id, person_id)
  where deleted_at is null;

-- Índice FK persona (patrón fk_indexes del repo).
create index if not exists club_members_person_idx
  on public.club_members (person_id) where deleted_at is null;

-- Listado por estado/plan.
create index if not exists club_members_tenant_status_idx
  on public.club_members (tenant_id, status) where deleted_at is null;

-- ── Grants explícitos (auto-expose OFF). Soft-delete → sin delete. ──
grant select, insert, update on public.club_members to authenticated;
revoke all on public.club_members from anon;

-- ── RLS por tenant ────────────────────────────────────────────
alter table public.club_members enable row level security;
create policy "club_members by tenant" on public.club_members for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());

create trigger club_members_touch
  before update on public.club_members
  for each row execute function public.touch_updated_at();

-- ── Defensa-en-DB: refs del MISMO tenant ──────────────────────
-- La FK garantiza que person_id existe, NO que sea del mismo tenant que la
-- membresía (ni que esté viva). Idem client_markbox. Helper person_in_tenant()
-- viene de 0107 (SECURITY DEFINER, fail-closed). Cerramos el hueco para TODO
-- cliente PostgREST autenticado (patrón polimórfico del repo).
create or replace function public.club_members_validate_refs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- person_id (NOT NULL) debe ser persona viva del mismo tenant.
  if not public.person_in_tenant(new.person_id, new.tenant_id) then
    raise exception
      'club_members: person_id % inexistente, borrada o de otro tenant', new.person_id
      using errcode = 'check_violation';
  end if;

  -- client_markbox, si se setea, debe ser un cliente vivo del mismo tenant.
  if new.client_markbox is not null and btrim(new.client_markbox) <> '' then
    if not exists (
      select 1 from public.clients c
      where c.tenant_id = new.tenant_id
        and c.markbox = new.client_markbox
        and c.deleted_at is null
    ) then
      raise exception
        'club_members: client_markbox % no es un cliente vivo del tenant %', new.client_markbox, new.tenant_id
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.club_members_validate_refs() is
  'SDD-0116: valida que person_id (y client_markbox si viene) sean del MISMO tenant que la membresía y estén vivos (defensa en profundidad; la FK no cubre tenant). SECURITY DEFINER, fail-closed.';

revoke execute on function public.club_members_validate_refs() from public, anon;

drop trigger if exists club_members_refs_same_tenant on public.club_members;
create trigger club_members_refs_same_tenant
  before insert or update of person_id, tenant_id, client_markbox on public.club_members
  for each row execute function public.club_members_validate_refs();

-- Sin seed: las membresías las da de alta el operador desde el botón
-- "+ Nuevo miembro" (EmptyState cubre el vacío). Nada de PII adivinada en git.
