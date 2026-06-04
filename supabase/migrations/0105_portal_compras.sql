-- ─────────────────────────────────────────────────────────────
-- SDD-0057: Portal · Compras (prealertas) + Proveedores del cliente
--
-- Dos entidades nuevas accesibles desde el PORTAL (el cliente crea/ve lo suyo) y
-- el STUDIO (el operador lee las entrantes del tenant):
--   - suppliers_cn : proveedores chinos del cliente (cierra D6 de SDD-0031).
--                    Cada proveedor tiene un número POR CLIENTE (supplier_seq:
--                    #1, #2, … del cliente).
--   - prealertas   : compras = aviso pre-arribo (cliente + proveedor + N cajas +
--                    estado), con código del Norte
--                    DTD-{clientNo}-{supplier_seq}-{order_seq} donde order_seq es
--                    el nº de compra para ESE (cliente, proveedor). Por caja se
--                    rotula el MISMO code + "Caja M/N" como texto (NO un 5º
--                    segmento) — ese es el shipping mark que imprime SDD-0031.
--
-- RLS DOBLE fail-closed (lección SDD-0042: el cliente del portal NO está en
-- user_tenants, así que las policies by-tenant del Studio jamás le dan datos):
--   - CLIENTE del portal  → CRUD (soft) de SUS filas (client_markbox =
--                           get_portal_client_markbox()), tenant_id forzado a su
--                           tenant (get_portal_client_tenant()).
--   - OPERADOR del tenant → SELECT de las del tenant (get_user_tenant_id()).
--   - service_role        → all.
--
-- Validación cross-tenant del supplier_id (lección SDD-0045/0093): helper
-- *_in_tenant + trigger BEFORE INSERT/UPDATE en prealertas (null permitido).
--
-- RPCs de secuencia (security definer, resuelven el tenant del caller):
--   - next_supplier_seq(client)         → próximo nº de proveedor del cliente.
--   - next_order_seq(client, supplier)  → próximo nº de compra de ese (cliente,
--                                         proveedor). Es el último segmento del code.
-- La race se tolera con los unique() — la action de Slice B REINTENTA el insert
-- de prealerta ante choque del code.
--
-- Aditiva · sin DDL destructivo · sin seed (las prealertas son data real del
-- cliente). Correlativo 0105 (main=0103, feat/calculadora=0104). NO se aplica a
-- prod desde acá (lo hace el founder).
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 0. Helper · tenant del cliente del portal actual          ║
-- ╚═══════════════════════════════════════════════════════════╝
-- El cliente del portal no está en user_tenants; su tenant vive en client_users.
-- Lo necesitamos para forzar tenant_id en los INSERT que hace el propio cliente.
create or replace function public.get_portal_client_tenant()
returns uuid language sql stable security definer set search_path = public as $$
  select tenant_id from public.client_users
  where auth_user_id = auth.uid() and status = 'active'
  limit 1
$$;
comment on function public.get_portal_client_tenant is
  'Portal (SDD-0057): tenant_id del cliente vinculado al auth.uid() actual, o NULL. Para forzar tenant_id en INSERT del cliente del portal.';

grant execute on function public.get_portal_client_tenant() to authenticated;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. suppliers_cn · proveedores chinos del cliente          ║
-- ╚═══════════════════════════════════════════════════════════╝
create table public.suppliers_cn (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  client_markbox text not null,                 -- dueño (MARKBOX del cliente)
  supplier_seq   int  not null,                 -- nº de proveedor POR CLIENTE (#1, #2, …)
  name           text not null,
  city           text,
  wechat         text,
  contact        text,
  notes          text,
  deleted_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (tenant_id, client_markbox, supplier_seq)
);

comment on table public.suppliers_cn is
  'SDD-0057: proveedores chinos del cliente (CRUD desde el Portal). supplier_seq = nº de proveedor por cliente (#1, #2, …) — segmento del code DTD-{clientNo}-{supplier_seq}-{order_seq}. Cierra D6 de SDD-0031. NO confundir con suppliers de tesorería (0088, vendors que DTD paga).';

create index suppliers_cn_tenant_client_idx
  on public.suppliers_cn (tenant_id, client_markbox) where deleted_at is null;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. prealertas · compras = aviso pre-arribo                ║
-- ╚═══════════════════════════════════════════════════════════╝
create table public.prealertas (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  client_markbox text not null,                 -- dueño (MARKBOX del cliente)
  supplier_id    uuid references public.suppliers_cn(id) on delete set null,
  code           text not null,                 -- "DTD-{clientNo}-{supplier_seq}-{order_seq}"
  description    text not null,
  tracking_cn    text,                          -- número de courier chino (solo se guarda)
  boxes          int not null check (boxes >= 1),
  est_value_usd  numeric(12,2),
  status         text not null default 'anunciada'
                   check (status in ('anunciada','en_camino','recibida','consolidada','cancelada')),
  received_at    timestamptz,
  shipment_id    uuid,                           -- link futuro al envío (nullable, Slice C)
  deleted_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (tenant_id, code)
);

comment on table public.prealertas is
  'SDD-0057: compras del cliente = prealertas (aviso pre-arribo). code DTD-{clientNo}-{supplier_seq}-{order_seq}: clientNo del MARKBOX, supplier_seq del proveedor por cliente, order_seq = nº de compra de ese (cliente, proveedor). Por caja se rotula el MISMO code + "Caja M/N" (shipping mark de SDD-0031). status anunciada→en_camino→recibida→consolidada/cancelada.';

create index prealertas_tenant_client_idx
  on public.prealertas (tenant_id, client_markbox) where deleted_at is null;

create index prealertas_tenant_status_idx
  on public.prealertas (tenant_id, status) where deleted_at is null;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. Validación cross-tenant del supplier_id (lección 0045) ║
-- ╚═══════════════════════════════════════════════════════════╝
-- supplier_id es FK a suppliers_cn(id) → garantiza existencia, pero NO que sea
-- del mismo tenant (un cliente directo vía PostgREST podría apuntar a un supplier
-- de otro tenant). El trigger lo rechaza (null permitido = sin proveedor).
create or replace function public.prealerta_supplier_in_tenant(
  p_supplier_id uuid,
  p_tenant_id   uuid
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.suppliers_cn
    where id = p_supplier_id
      and tenant_id = p_tenant_id
      and deleted_at is null
  );
$$;

create or replace function public.prealertas_validate_supplier()
returns trigger
language plpgsql
as $$
begin
  if new.supplier_id is not null
     and not public.prealerta_supplier_in_tenant(new.supplier_id, new.tenant_id) then
    raise exception 'proveedor inexistente o de otro tenant: %', new.supplier_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists prealertas_validate_supplier_trg on public.prealertas;
create trigger prealertas_validate_supplier_trg
  before insert or update on public.prealertas
  for each row execute function public.prealertas_validate_supplier();

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 4. RPCs de secuencia · supplier_seq + order_seq            ║
-- ╚═══════════════════════════════════════════════════════════╝
-- Ambas resuelven el tenant del caller (cliente del portal o user del equipo) y
-- cuentan sobre las filas vivas de ESE cliente. La race se tolera con los
-- unique() → la action de Slice B REINTENTA ante choque del code.

-- next_supplier_seq(client) → próximo nº de proveedor del cliente (#1, #2, …).
-- Cuenta sobre el máximo supplier_seq EXISTENTE (incluye borrados: no reusamos
-- números aunque se borre un proveedor, para que el code nunca colisione con uno
-- viejo todavía rotulado en cajas).
create or replace function public.next_supplier_seq(p_client_markbox text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_max int;
begin
  v_tenant := coalesce(public.get_portal_client_tenant(), public.get_user_tenant_id());
  if v_tenant is null then
    raise exception 'No se pudo resolver el tenant del caller' using errcode = '42501';
  end if;

  select coalesce(max(supplier_seq), 0) + 1
  into v_max
  from public.suppliers_cn
  where tenant_id = v_tenant
    and client_markbox = p_client_markbox;

  return v_max;
end;
$$;

comment on function public.next_supplier_seq is
  'SDD-0057: próximo nº de proveedor de un cliente (por client_markbox). Tolera la race con el unique(tenant, client_markbox, supplier_seq) — la action reintenta ante choque.';

-- next_order_seq(client, supplier) → próximo nº de compra de ese (cliente,
-- proveedor): cuenta las prealertas vivas de ese supplier_id de ese cliente + 1.
-- Es el último segmento del code DTD-{clientNo}-{supplier_seq}-{order_seq}.
create or replace function public.next_order_seq(
  p_client_markbox text,
  p_supplier_id    uuid
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_count int;
begin
  v_tenant := coalesce(public.get_portal_client_tenant(), public.get_user_tenant_id());
  if v_tenant is null then
    raise exception 'No se pudo resolver el tenant del caller' using errcode = '42501';
  end if;

  -- Contamos las compras vivas de ESE proveedor para ESE cliente. La numeración
  -- por (cliente, proveedor) arranca en 1; una compra cancelada/borrada deja su
  -- nº en circulación (el unique(tenant, code) es la red anti-colisión final).
  select count(*)
  into v_count
  from public.prealertas
  where tenant_id = v_tenant
    and client_markbox = p_client_markbox
    and supplier_id is not distinct from p_supplier_id
    and deleted_at is null;

  return v_count + 1;
end;
$$;

comment on function public.next_order_seq is
  'SDD-0057: próximo nº de compra (order_seq) de un (cliente, proveedor). Último segmento del code DTD-{clientNo}-{supplier_seq}-{order_seq}. Tolera la race con el unique(tenant, code) — la action reintenta ante choque.';

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 5. GRANTS EXPLÍCITOS (auto-expose new tables OFF)         ║
-- ╚═══════════════════════════════════════════════════════════╝
grant select, insert, update, delete on public.suppliers_cn to authenticated;
grant select, insert, update, delete on public.prealertas   to authenticated;

grant all on public.suppliers_cn to service_role;
grant all on public.prealertas   to service_role;

grant execute on function public.next_supplier_seq(text) to authenticated;
grant execute on function public.next_order_seq(text, uuid) to authenticated;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 6. RLS DOBLE · suppliers_cn                                ║
-- ╚═══════════════════════════════════════════════════════════╝
alter table public.suppliers_cn enable row level security;

-- CLIENTE del portal: CRUD (soft) de SUS proveedores. tenant_id forzado a su
-- tenant en el WITH CHECK; ownership por markbox.
create policy "suppliers_cn portal self select"
  on public.suppliers_cn for select to authenticated
  using (
    deleted_at is null
    and client_markbox = public.get_portal_client_markbox()
  );

create policy "suppliers_cn portal self insert"
  on public.suppliers_cn for insert to authenticated
  with check (
    tenant_id = public.get_portal_client_tenant()
    and client_markbox = public.get_portal_client_markbox()
  );

create policy "suppliers_cn portal self update"
  on public.suppliers_cn for update to authenticated
  using (client_markbox = public.get_portal_client_markbox())
  with check (
    tenant_id = public.get_portal_client_tenant()
    and client_markbox = public.get_portal_client_markbox()
  );

-- OPERADOR del tenant: SELECT de los proveedores del tenant (read-only acá).
create policy "suppliers_cn tenant read"
  on public.suppliers_cn for select to authenticated
  using (tenant_id = public.get_user_tenant_id());

-- service_role: all (workers, admin client scopeado de las actions del portal).
create policy "suppliers_cn service_role all"
  on public.suppliers_cn for all to service_role
  using (true) with check (true);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 7. RLS DOBLE · prealertas                                  ║
-- ╚═══════════════════════════════════════════════════════════╝
alter table public.prealertas enable row level security;

create policy "prealertas portal self select"
  on public.prealertas for select to authenticated
  using (
    deleted_at is null
    and client_markbox = public.get_portal_client_markbox()
  );

create policy "prealertas portal self insert"
  on public.prealertas for insert to authenticated
  with check (
    tenant_id = public.get_portal_client_tenant()
    and client_markbox = public.get_portal_client_markbox()
  );

create policy "prealertas portal self update"
  on public.prealertas for update to authenticated
  using (client_markbox = public.get_portal_client_markbox())
  with check (
    tenant_id = public.get_portal_client_tenant()
    and client_markbox = public.get_portal_client_markbox()
  );

create policy "prealertas tenant read"
  on public.prealertas for select to authenticated
  using (tenant_id = public.get_user_tenant_id());

create policy "prealertas service_role all"
  on public.prealertas for all to service_role
  using (true) with check (true);

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 8. Triggers updated_at (reusa touch_updated_at existente) ║
-- ╚═══════════════════════════════════════════════════════════╝
create trigger suppliers_cn_touch
  before update on public.suppliers_cn
  for each row execute function public.touch_updated_at();

create trigger prealertas_touch
  before update on public.prealertas
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Fin 0105_portal_compras.sql
-- ─────────────────────────────────────────────────────────────
