-- ─────────────────────────────────────────────────────────────
-- SDD-0033: Cola de impresión QR · vista oficina
--
-- Tabla qr_print_orders que recibe órdenes del operario CN PWA
-- (push via RPC con cookie HTTP-only) y consume admin web en
-- /studio/cola-qr para imprimir + marcar entregado.
--
-- 2 enums + 1 tabla + 2 RPCs (next code + push as operario) +
-- trigger guard de transición + RLS por tenant + Realtime ready.
-- ─────────────────────────────────────────────────────────────

-- ENUMS

create type qr_order_status as enum (
  'pendiente',
  'imprimiendo',
  'impreso',
  'entregado',
  'cancelado'
);

create type qr_order_priority as enum ('urgent', 'normal');

-- ─────────────────────────────────────────────────────────────
-- Tabla qr_print_orders
-- ─────────────────────────────────────────────────────────────

create table public.qr_print_orders (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants(id) on delete cascade,
  order_code               text not null,                                     -- 'QR-2026-0142'
  warehouse_id             uuid references public.warehouses_cn(id),
  markbox                  text not null,
  client_name              text not null,                                     -- denorm
  supplier_name            text,
  bultos                   int not null check (bultos > 0),

  -- Quién la mandó
  sent_by_operario_id      uuid references public.operario_pins(id) on delete set null,
  sent_by_name             text not null,                                     -- denorm snapshot
  sent_by_phone            text,
  sent_at                  timestamptz not null default now(),

  -- Estado
  priority                 qr_order_priority not null default 'normal',
  status                   qr_order_status not null default 'pendiente',
  assigned_printer         text,                                              -- label libre · sin tabla printers V1

  -- Lifecycle
  printed_at               timestamptz,
  printed_by               uuid references auth.users(id) on delete set null,
  delivered_at             timestamptz,
  delivered_by             uuid references auth.users(id) on delete set null,
  cancelled_at             timestamptz,
  cancelled_by             uuid references auth.users(id) on delete set null,
  cancel_reason            text,

  notes                    text,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  unique (tenant_id, order_code)
);

comment on table public.qr_print_orders is
  'Cola de impresión de QR. Operario CN pushea via RPC (cookie HTTP-only · sin auth.uid). Admin web consume en /studio/cola-qr y marca como impreso/entregado.';

create index qr_print_orders_tenant_status_idx
  on public.qr_print_orders (tenant_id, status, sent_at desc)
  where status not in ('entregado', 'cancelado');

create index qr_print_orders_tenant_all_idx
  on public.qr_print_orders (tenant_id, sent_at desc);

create index qr_print_orders_markbox_idx
  on public.qr_print_orders (tenant_id, markbox, sent_at desc);

-- ─────────────────────────────────────────────────────────────
-- RPC next_qr_order_code · secuencial QR-YYYY-NNNN por tenant
-- ─────────────────────────────────────────────────────────────

create or replace function public.next_qr_order_code(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year text := to_char(now() at time zone 'America/Caracas', 'YYYY');
  v_max  int;
begin
  if not exists (
    select 1 from public.user_tenants
    where user_id = auth.uid() and tenant_id = p_tenant_id
  ) then
    -- También permitir service_role (operario · sin auth.uid)
    if auth.uid() is not null then
      raise exception 'No autorizado para tenant %', p_tenant_id;
    end if;
  end if;

  select coalesce(max((substring(order_code from 'QR-' || v_year || '-(\d+)$'))::int), 0)
    into v_max
  from public.qr_print_orders
  where tenant_id = p_tenant_id
    and order_code like 'QR-' || v_year || '-%';

  return 'QR-' || v_year || '-' || lpad((v_max + 1)::text, 4, '0');
end;
$$;

comment on function public.next_qr_order_code(uuid) is
  'Genera próximo QR-YYYY-NNNN para el tenant. Mismo patrón que next_dispatch_order_code. Permite caller con auth.uid o service_role.';

grant execute on function public.next_qr_order_code(uuid) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────
-- RPC push_qr_order_as_operario
--
-- Llamado desde server action /m/cn/* con service_role. Recibe
-- operario_id (de cookie HTTP-only) y crea la orden con status
-- 'pendiente'. Denormaliza display_name y phone del operario.
-- ─────────────────────────────────────────────────────────────

create or replace function public.push_qr_order_as_operario(
  p_operario_id     uuid,
  p_warehouse_id    uuid,                              -- nullable · puede sacarse del operario
  p_markbox         text,
  p_client_name     text,
  p_supplier_name   text,
  p_bultos          int,
  p_priority        qr_order_priority,
  p_notes           text
)
returns table (
  id          uuid,
  order_code  text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id  uuid;
  v_role       text;
  v_active     boolean;
  v_op_name    text;
  v_op_phone   text;
  v_wh_id      uuid;
  v_code       text;
  v_new_id     uuid;
begin
  -- 1. Validar operario
  select tenant_id, role, active, display_name, last_login_at
    into v_tenant_id, v_role, v_active, v_op_name, v_op_phone
    from public.operario_pins
   where id = p_operario_id;

  if v_tenant_id is null then
    raise exception 'Operario no encontrado' using errcode = 'P0001';
  end if;
  if not v_active then
    raise exception 'Operario inactivo' using errcode = 'P0002';
  end if;

  -- 2. Sanity
  if p_markbox is null or length(trim(p_markbox)) = 0 then
    raise exception 'markbox requerido' using errcode = 'P0003';
  end if;
  if p_bultos is null or p_bultos <= 0 then
    raise exception 'bultos debe ser > 0' using errcode = 'P0004';
  end if;

  -- 3. Warehouse: si no vino, lee el del operario
  if p_warehouse_id is null then
    select warehouse_id into v_wh_id
      from public.operario_pins where id = p_operario_id;
  else
    v_wh_id := p_warehouse_id;
  end if;

  -- 4. Generar code
  v_code := public.next_qr_order_code(v_tenant_id);

  -- 5. Insert
  insert into public.qr_print_orders (
    tenant_id, order_code, warehouse_id,
    markbox, client_name, supplier_name, bultos,
    sent_by_operario_id, sent_by_name, sent_by_phone,
    priority, status, notes
  ) values (
    v_tenant_id, v_code, v_wh_id,
    trim(p_markbox), trim(coalesce(p_client_name, '—')),
    nullif(trim(coalesce(p_supplier_name, '')), ''),
    p_bultos,
    p_operario_id, v_op_name, nullif(trim(coalesce(v_op_phone, '')), ''),
    coalesce(p_priority, 'normal'),
    'pendiente',
    nullif(trim(coalesce(p_notes, '')), '')
  )
  returning qr_print_orders.id into v_new_id;

  return query select v_new_id, v_code;
end;
$$;

comment on function public.push_qr_order_as_operario is
  'Operario CN pushea una orden de impresión desde el PWA /m/cn. security definer · invocado con service_role desde server action.';

revoke all on function public.push_qr_order_as_operario(
  uuid, uuid, text, text, text, int, qr_order_priority, text
) from public, anon, authenticated;
grant execute on function public.push_qr_order_as_operario(
  uuid, uuid, text, text, text, int, qr_order_priority, text
) to service_role;

-- ─────────────────────────────────────────────────────────────
-- Trigger guard de transición
-- ─────────────────────────────────────────────────────────────

create or replace function public.qr_print_orders_status_guard()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'UPDATE' and old.status <> new.status then
    -- Prohibido desde terminal
    if old.status in ('entregado', 'cancelado') then
      raise exception 'No se puede modificar status desde % (terminal)', old.status;
    end if;

    -- impreso solo puede ir a entregado o cancelado
    if old.status = 'impreso' and new.status not in ('entregado', 'cancelado') then
      raise exception 'Desde impreso solo se puede ir a entregado o cancelado';
    end if;

    -- imprimiendo no puede retroceder a pendiente
    if old.status = 'imprimiendo' and new.status = 'pendiente' then
      raise exception 'No se puede retroceder de imprimiendo a pendiente';
    end if;

    -- Auto-stamp
    if new.status = 'impreso' and new.printed_at is null then
      new.printed_at := now();
      new.printed_by := coalesce(new.printed_by, auth.uid());
    elsif new.status = 'entregado' and new.delivered_at is null then
      new.delivered_at := now();
      new.delivered_by := coalesce(new.delivered_by, auth.uid());
    elsif new.status = 'cancelado' and new.cancelled_at is null then
      new.cancelled_at := now();
      new.cancelled_by := coalesce(new.cancelled_by, auth.uid());
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger qr_print_orders_status_guard
  before update on public.qr_print_orders
  for each row execute function public.qr_print_orders_status_guard();

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────

alter table public.qr_print_orders enable row level security;

create policy qr_print_orders_select on public.qr_print_orders
  for select using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy qr_print_orders_update on public.qr_print_orders
  for update using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

-- INSERT NO desde authenticated · solo service_role (vía push_qr_order_as_operario)
create policy qr_print_orders_no_insert_auth on public.qr_print_orders
  for insert to authenticated with check (false);

-- DELETE NO desde authenticated · admin cancela cambiando status
create policy qr_print_orders_no_delete_auth on public.qr_print_orders
  for delete to authenticated using (false);

grant select, update on public.qr_print_orders to authenticated;
grant select, insert, update, delete on public.qr_print_orders to service_role;

-- ─────────────────────────────────────────────────────────────
-- Realtime publication (V2: cliente se suscribe al channel)
-- ─────────────────────────────────────────────────────────────

-- Agregar tabla a la publicación si la pub existe (Supabase la crea por default)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.qr_print_orders';
  end if;
exception when others then
  raise notice 'No se pudo agregar qr_print_orders a supabase_realtime (probablemente ya está o la pub no existe): %', SQLERRM;
end $$;
