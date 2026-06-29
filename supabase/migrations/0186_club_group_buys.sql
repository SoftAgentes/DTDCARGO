-- ─────────────────────────────────────────────────────────────
-- 0186 · SDD-0116 · Club DTD — Slice B: compra grupal (el motor)
--   club_group_buys + club_group_buy_participants
--
-- "Rondas de consolidación comunitaria": miembros del Club juntan volumen
-- (CBM) para bajar el costo por CBM. El Club AGREGA INTENCIÓN; la operación la
-- ejecuta el flujo de embarques (consolidación real, SDD-0047).
--
-- Decisiones del founder (2026-06-28):
--   D5 · entrar a una compra grupal exige ser MIEMBRO del Club → participants
--        referencia club_members(id) (la compra grupal es gancho de membresía).
--   D7 · 100% INTENCIÓN: participants guarda solo CBM/valor ESTIMADO, CERO montos
--        cobrables. El cobro va por facturas (SDD-0077) al facturar la
--        consolidación — aislamiento financiero (lección SDD-0102). Sin pasarela.
--
-- `committed_cbm` NO se persiste: es DERIVADO (suma de participaciones vivas) en
-- la capa de lectura — no es verdad financiera, no debe poder driftear.
--
-- Convención del repo: enums lógicos = text + CHECK. RLS por tenant. Soft-delete.
-- Defensa-en-DB same-tenant en cada FK (la FK no cubre el tenant): group_buy,
-- member y consolidation deben ser del MISMO tenant y estar vivos.
--
-- Aditiva e idempotente. NO aplicar a prod desde la rama — la aplica
-- coordinación / founder. Skills Supabase (seguridad + postgres) seguidos.
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1) club_group_buys — la ronda de consolidación comunitaria ║
-- ╚═══════════════════════════════════════════════════════════╝
create table if not exists public.club_group_buys (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,

  title            text not null,
  slug             text not null,
  summary          text,

  status           text not null default 'abierta'
    constraint club_group_buys_status_chk
      check (status in ('abierta', 'cerrada', 'en_consolidacion', 'completada', 'cancelada')),

  opens_at         timestamptz not null default now(),
  closes_at        timestamptz,                       -- ventana para unirse (null = sin fecha)

  target_cbm       numeric(12,3),                     -- meta de volumen (null = sin meta). committed = DERIVADO.

  origin           text,                              -- ruta CN→VE (texto libre)
  destination      text,

  -- Al cerrar la ronda → FK al embarque/consolidación real (SDD-0047) que la
  -- ejecuta. null hasta entonces. Defensa same-tenant vía trigger.
  consolidation_id uuid references public.consolidations(id) on delete set null,

  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

comment on table public.club_group_buys is
  'SDD-0116 Slice B: ronda de consolidación comunitaria del Club. Agrega INTENCIÓN de volumen; la operación la ejecuta la consolidación real (SDD-0047) vía consolidation_id. committed_cbm es DERIVADO en lectura (no se persiste). RLS por tenant. Soft delete.';
comment on column public.club_group_buys.consolidation_id is
  'SDD-0116: consolidación real (SDD-0047) que ejecuta la ronda al cerrarse. null hasta el cierre. Defendido same-tenant por trigger.';

create unique index if not exists club_group_buys_slug_uniq
  on public.club_group_buys (tenant_id, slug) where deleted_at is null;
create index if not exists club_group_buys_tenant_status_idx
  on public.club_group_buys (tenant_id, status) where deleted_at is null;

grant select, insert, update on public.club_group_buys to authenticated;
revoke all on public.club_group_buys from anon;

alter table public.club_group_buys enable row level security;
drop policy if exists "club_group_buys by tenant" on public.club_group_buys;
create policy "club_group_buys by tenant" on public.club_group_buys for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());

drop trigger if exists club_group_buys_touch on public.club_group_buys;
create trigger club_group_buys_touch
  before update on public.club_group_buys
  for each row execute function public.touch_updated_at();

-- Defensa same-tenant: consolidation_id (si se setea) debe ser consolidación
-- viva del MISMO tenant. SECURITY DEFINER, fail-closed.
create or replace function public.club_group_buys_validate_refs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.consolidation_id is not null then
    if not exists (
      select 1 from public.consolidations c
      where c.id = new.consolidation_id
        and c.tenant_id = new.tenant_id
        and c.deleted_at is null
    ) then
      raise exception
        'club_group_buys: consolidation_id % inexistente, borrada o de otro tenant', new.consolidation_id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

comment on function public.club_group_buys_validate_refs() is
  'SDD-0116: valida que consolidation_id sea una consolidación viva del MISMO tenant (defensa en profundidad; la FK no cubre tenant). SECURITY DEFINER, fail-closed.';

revoke execute on function public.club_group_buys_validate_refs() from public, anon;

drop trigger if exists club_group_buys_refs_same_tenant on public.club_group_buys;
create trigger club_group_buys_refs_same_tenant
  before insert or update of consolidation_id, tenant_id on public.club_group_buys
  for each row execute function public.club_group_buys_validate_refs();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2) club_group_buy_participants — intención de volumen      ║
-- ╚═══════════════════════════════════════════════════════════╝
-- D7: guarda INTENCIÓN (CBM/valor estimado), NUNCA montos cobrables. Cualquier
-- cobro/seña va por facturas (SDD-0077), tabla aparte — aislamiento financiero.
create table if not exists public.club_group_buy_participants (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,

  group_buy_id        uuid not null references public.club_group_buys(id) on delete cascade,
  -- D5: hay que ser miembro del Club. on delete restrict: no perder la
  -- participación en silencio si alguien intenta borrar la membresía.
  member_id           uuid not null references public.club_members(id) on delete restrict,

  estimated_cbm       numeric(12,3),                  -- INTENCIÓN, no factura
  estimated_value_usd numeric(14,2),                  -- INTENCIÓN, no cobrable

  status              text not null default 'interesado'
    constraint club_gb_participant_status_chk
      check (status in ('interesado', 'confirmado', 'retirado')),

  note                text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

comment on table public.club_group_buy_participants is
  'SDD-0116 Slice B: participación de un MIEMBRO (D5) en una compra grupal. Guarda INTENCIÓN de volumen (CBM/valor ESTIMADO), CERO montos cobrables (D7, aislamiento financiero SDD-0102). RLS por tenant. Soft delete.';
comment on column public.club_group_buy_participants.estimated_value_usd is
  'SDD-0116 D7: valor ESTIMADO declarado (intención), NO un monto cobrable. El cobro vive en facturas (SDD-0077), tabla aparte.';

-- Un miembro participa una vez por ronda (viva).
create unique index if not exists club_gb_participants_one_live_per_member
  on public.club_group_buy_participants (group_buy_id, member_id) where deleted_at is null;
create index if not exists club_gb_participants_tenant_gb_idx
  on public.club_group_buy_participants (tenant_id, group_buy_id) where deleted_at is null;
create index if not exists club_gb_participants_member_idx
  on public.club_group_buy_participants (member_id) where deleted_at is null;

grant select, insert, update on public.club_group_buy_participants to authenticated;
revoke all on public.club_group_buy_participants from anon;

alter table public.club_group_buy_participants enable row level security;
drop policy if exists "club_gb_participants by tenant" on public.club_group_buy_participants;
create policy "club_gb_participants by tenant" on public.club_group_buy_participants for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());

drop trigger if exists club_gb_participants_touch on public.club_group_buy_participants;
create trigger club_gb_participants_touch
  before update on public.club_group_buy_participants
  for each row execute function public.touch_updated_at();

-- Defensa same-tenant: la ronda y el miembro deben ser del MISMO tenant y estar
-- vivos. SECURITY DEFINER, fail-closed.
create or replace function public.club_gb_participants_validate_refs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.club_group_buys g
    where g.id = new.group_buy_id
      and g.tenant_id = new.tenant_id
      and g.deleted_at is null
  ) then
    raise exception
      'club_gb_participants: group_buy_id % inexistente, borrada o de otro tenant', new.group_buy_id
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from public.club_members m
    where m.id = new.member_id
      and m.tenant_id = new.tenant_id
      and m.deleted_at is null
  ) then
    raise exception
      'club_gb_participants: member_id % inexistente, borrado o de otro tenant', new.member_id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

comment on function public.club_gb_participants_validate_refs() is
  'SDD-0116: valida que group_buy_id y member_id sean del MISMO tenant que la participación y estén vivos (defensa en profundidad; la FK no cubre tenant). SECURITY DEFINER, fail-closed.';

revoke execute on function public.club_gb_participants_validate_refs() from public, anon;

drop trigger if exists club_gb_participants_refs_same_tenant on public.club_group_buy_participants;
create trigger club_gb_participants_refs_same_tenant
  before insert or update of group_buy_id, member_id, tenant_id on public.club_group_buy_participants
  for each row execute function public.club_gb_participants_validate_refs();
