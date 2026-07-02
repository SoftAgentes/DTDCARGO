-- ─────────────────────────────────────────────────────────────
-- SDD-0138 · Mi Perfil del cliente — Slice B · direcciones de entrega múltiples
--
-- Hoy la dirección de entrega es UN string (`clients.address`, migr 0006),
-- administrado por el asesor. El Norte (PortalProfile) asume VARIAS direcciones
-- con una PREDETERMINADA. Esta tabla las modela como recurso propio del cliente,
-- editable desde DOS superficies sobre el MISMO esquema (recordatorio founder):
--   · Portal del cliente  → el cliente edita LAS SUYAS (RLS self por markbox).
--   · Studio ERP           → el asesor edita las de cualquier cliente del tenant.
--
-- Modelo espejo de payment_reports (0195, portal-facing): tenant_id + markbox
-- denormalizado para la RLS del portal + trigger de validación en DB que sella la
-- coherencia client↔tenant↔markbox (lección SDD-0045: la server action valida,
-- pero un PostgREST directo la saltaría → el trigger defiende a TODO cliente).
--
-- NO se aplica a prod desde acá (lo hace el Director / MCP; dry-run begin…rollback
-- en prod antes). Número 0198.
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. TABLA client_delivery_addresses                         ║
-- ╚═══════════════════════════════════════════════════════════╝
create table public.client_delivery_addresses (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  client_id      uuid not null references public.clients(id) on delete cascade,
  client_markbox text not null,                 -- denormalizado para la RLS del portal
  label          text,                          -- "Casa", "Oficina", "Depósito"…
  line           text not null,                 -- dirección (calle, edificio, nº)
  city           text,
  state          text,                          -- estado/provincia VE
  reference      text,                          -- punto de referencia / last-mile
  is_default     boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz                    -- soft delete
);

comment on table public.client_delivery_addresses is
  'SDD-0138 Slice B: direcciones de entrega del cliente (múltiples, una predeterminada). client_markbox denormalizado para la RLS del portal. Editable desde el portal (self por markbox) y el Studio (equipo por tenant). Soft delete via deleted_at.';

-- Una sola predeterminada por cliente (índice único parcial · guía skill postgres).
create unique index client_delivery_addresses_default_uidx
  on public.client_delivery_addresses (client_id)
  where is_default and deleted_at is null;

-- Listado del cliente (portal) y del asesor (studio).
create index client_delivery_addresses_client_idx
  on public.client_delivery_addresses (tenant_id, client_id)
  where deleted_at is null;

create index client_delivery_addresses_markbox_idx
  on public.client_delivery_addresses (client_markbox)
  where deleted_at is null;

-- GRANTS explícitos (auto-expose new tables OFF).
grant select, insert, update, delete on public.client_delivery_addresses to authenticated;
grant all on public.client_delivery_addresses to service_role;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. RLS · equipo por tenant + portal self por markbox       ║
-- ╚═══════════════════════════════════════════════════════════╝
alter table public.client_delivery_addresses enable row level security;

-- Equipo (Studio): CRUD por tenant. Regla ⭐ RLS por TENANT (no por rol, SDD-0085);
-- el gating por rol/módulo lo hace la capa de app (canAccessModule).
create policy "client_delivery_addresses by tenant"
  on public.client_delivery_addresses for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id() and deleted_at is null)
  with check (tenant_id = public.get_user_tenant_id());

-- service_role: full (server actions con admin client, workers).
create policy "client_delivery_addresses service_role all"
  on public.client_delivery_addresses for all
  to service_role
  using (true)
  with check (true);

-- Cliente del portal: LEE las suyas por markbox (aditiva).
create policy "client_delivery_addresses portal self read"
  on public.client_delivery_addresses for select
  to authenticated
  using (
    deleted_at is null
    and client_markbox is not null
    and client_markbox = public.get_portal_client_markbox()
  );

-- Cliente del portal: INSERTA direcciones SUYAS. La coherencia
-- client↔tenant↔markbox la fuerza el trigger (no confía en lo que mande el body).
create policy "client_delivery_addresses portal self insert"
  on public.client_delivery_addresses for insert
  to authenticated
  with check (
    client_markbox is not null
    and client_markbox = public.get_portal_client_markbox()
  );

-- Cliente del portal: EDITA/BORRA (soft) las suyas.
create policy "client_delivery_addresses portal self update"
  on public.client_delivery_addresses for update
  to authenticated
  using (
    client_markbox is not null
    and client_markbox = public.get_portal_client_markbox()
  )
  with check (client_markbox = public.get_portal_client_markbox());

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. Trigger updated_at (reusa touch_updated_at de 0002)     ║
-- ╚═══════════════════════════════════════════════════════════╝
create trigger client_delivery_addresses_touch
  before update on public.client_delivery_addresses
  for each row execute function public.touch_updated_at();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 4. Validación DB · la dirección apunta a un cliente real   ║
-- ║    del MISMO tenant, y sella tenant_id + client_markbox    ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Lección SDD-0045 (feedback_polymorphic_table_db_validation): defiende en la DB
-- contra un cliente que forje client_id/tenant_id/markbox vía PostgREST directo.
-- Sella tenant_id y client_markbox desde la fila de clients (fuente de verdad).
create or replace function public.client_delivery_addresses_validate_client()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant  uuid;
  v_markbox text;
begin
  select tenant_id, markbox into v_tenant, v_markbox
  from public.clients
  where id = new.client_id
    and deleted_at is null;

  if v_tenant is null then
    raise exception 'dirección sobre cliente inexistente o borrado (client %)', new.client_id
      using errcode = 'check_violation';
  end if;

  -- Un cliente del portal solo puede tocar SU markbox (lo garantiza la RLS con
  -- get_portal_client_markbox()); acá sellamos tenant + markbox desde la fuente,
  -- así el body no puede apuntar la fila a otro tenant/markbox.
  new.tenant_id      := v_tenant;
  new.client_markbox := v_markbox;
  return new;
end;
$$;

comment on function public.client_delivery_addresses_validate_client is
  'SDD-0138: valida que client_delivery_addresses.client_id exista y sella tenant_id + client_markbox desde clients. Defiende contra un cliente que forje esos campos vía PostgREST directo.';

drop trigger if exists client_delivery_addresses_validate_trg on public.client_delivery_addresses;
create trigger client_delivery_addresses_validate_trg
  before insert or update on public.client_delivery_addresses
  for each row execute function public.client_delivery_addresses_validate_client();

-- Convención de seguridad del repo (deuda rpc_anon_execute): revocar EXECUTE del
-- público/anon a la trigger fn SECURITY DEFINER (dispara igual como trigger).
revoke execute on function public.client_delivery_addresses_validate_client() from public, anon;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 5. Backfill · migrar clients.address a una 1ª predeterminada║
-- ╚═══════════════════════════════════════════════════════════╝
-- Semilla no destructiva: por cada cliente con `address` cargada y sin direcciones
-- todavía, se crea una fila predeterminada. `clients.address` queda como legacy
-- (no se dropea acá) hasta que la app corte del todo. El trigger sella
-- tenant_id/markbox, así que el insert solo necesita client_id + line.
insert into public.client_delivery_addresses (client_id, client_markbox, tenant_id, line, is_default)
select c.id, c.markbox, c.tenant_id, btrim(c.address), true
from public.clients c
where c.address is not null
  and btrim(c.address) <> ''
  and c.deleted_at is null
  and not exists (
    select 1 from public.client_delivery_addresses a where a.client_id = c.id
  );

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0198_client_delivery_addresses.sql
-- Aplicar con: MCP apply_migration (Director) · dry-run begin…rollback en prod antes.
-- Post-aplicación: get_advisors(type:"security") debe quedar limpio para esta tabla.
-- ─────────────────────────────────────────────────────────────
