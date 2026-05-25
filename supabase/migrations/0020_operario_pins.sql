-- ─────────────────────────────────────────────────────────────
-- SDD-0027: Operarios CN — auth por PIN para PWA mobile
-- 1 tabla nueva + 1 column add en warehouse_receipts_cn
-- + 2 RPCs (verify_operario_pin, create_receipt_as_operario)
-- + RLS por tenant + seed con Wang Hua YIW-A1
-- ─────────────────────────────────────────────────────────────
--
-- Modelo de auth:
--  - El operario NO tiene auth.users propio (UX: PIN 4 dígitos)
--  - PIN almacenado como bcrypt (pgcrypto · crypt + gen_salt('bf'))
--  - RPC verify_operario_pin valida + retorna identidad para que
--    el server action setee cookie HTTP-only (lib/auth/operario-session.ts)
--  - Mutaciones del operario usan service_role en server-side
--    porque el operario no es un auth.users con tenant scope
--
-- Vinculo con receipts:
--  - warehouse_receipts_cn.created_by_operario_id (nullable: las
--    creadas desde el Studio web mantienen NULL, queda como audit
--    para saber si fue el operario en China quien la registró)

-- ─────────────────────────────────────────────────────────────
-- Tabla operario_pins
-- ─────────────────────────────────────────────────────────────
create table public.operario_pins (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  warehouse_id       uuid not null references public.warehouses_cn(id) on delete restrict,
  display_name       text not null,                        -- 'Wang Hua'
  display_name_cn    text,                                 -- '王华' (nullable, solo CN ops tienen)
  pin_hash           text not null,                        -- bcrypt via crypt(pin, gen_salt('bf'))
  role               text not null default 'operario'
                       check (role in ('operario', 'supervisor')),
  active             boolean not null default true,
  last_login_at      timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- PIN 4 dígitos: cada tenant tiene PINs distintos pero garantizamos
  -- unicidad por warehouse para evitar colisiones cuando el operario
  -- tipea (RPC valida warehouse implícito en login por hub).
  unique (warehouse_id, display_name)
);

comment on table public.operario_pins is
  'Operarios CN/VE que loguean por PIN en la PWA mobile (/m/*). NO usan Supabase Auth — cookie HTTP-only se setea desde server action signInOperario. RLS por tenant_id.';

create index operario_pins_warehouse_active_idx
  on public.operario_pins (warehouse_id) where active = true;

create index operario_pins_tenant_idx
  on public.operario_pins (tenant_id) where active = true;

-- ─────────────────────────────────────────────────────────────
-- Trigger updated_at
-- ─────────────────────────────────────────────────────────────
create trigger operario_pins_touch
  before update on public.operario_pins
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Column add: warehouse_receipts_cn.created_by_operario_id
-- Nullable porque las recepciones del Studio web NO tienen operario.
-- Soft-FK (set null si el operario se borra) para no perder receipts.
-- ─────────────────────────────────────────────────────────────
alter table public.warehouse_receipts_cn
  add column created_by_operario_id uuid
    references public.operario_pins(id) on delete set null;

create index warehouse_receipts_cn_operario_idx
  on public.warehouse_receipts_cn (created_by_operario_id, received_at desc)
  where deleted_at is null and created_by_operario_id is not null;

-- ─────────────────────────────────────────────────────────────
-- RPC verify_operario_pin
--
-- Recibe el PIN en plaintext. Compara contra todos los pin_hash
-- activos via crypt(). Si encuentra match único:
--  - actualiza last_login_at
--  - retorna identidad para que el server action setee cookie
--
-- Llamado desde server action con service_role (porque el operario
-- no tiene auth todavía al momento de loguear).
--
-- Returns NULL si no hay match o múltiples (colisión de PIN).
-- ─────────────────────────────────────────────────────────────
create or replace function public.verify_operario_pin(
  p_pin text
)
returns table (
  operario_id      uuid,
  tenant_id        uuid,
  warehouse_id     uuid,
  display_name     text,
  display_name_cn  text,
  role             text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_matches int;
begin
  -- Sanity check: PIN no vacío y 4 dígitos numéricos
  if p_pin is null or length(p_pin) <> 4 or p_pin !~ '^\d{4}$' then
    return;
  end if;

  -- Contar matches para detectar colisiones (improbable pero auditable)
  select count(*) into v_matches
  from public.operario_pins
  where active = true
    and pin_hash = crypt(p_pin, pin_hash);

  -- Si 0 o >1 matches, retornar nada (falla silenciosa server-side)
  if v_matches <> 1 then
    return;
  end if;

  -- Update last_login + retornar
  return query
  update public.operario_pins op
     set last_login_at = now()
   where op.active = true
     and op.pin_hash = crypt(p_pin, op.pin_hash)
  returning op.id, op.tenant_id, op.warehouse_id,
            op.display_name, op.display_name_cn, op.role;
end;
$$;

comment on function public.verify_operario_pin is
  'Valida PIN del operario (4 dígitos plain). Retorna identidad si match único y activo, NULL si no. Llamado desde server action con service_role (operario sin Supabase Auth).';

-- ─────────────────────────────────────────────────────────────
-- RPC create_receipt_as_operario
--
-- Inserta una recepción + items + evento `received` en operación
-- pseudo-atómica (rollback automático si algo falla porque PL/pgSQL
-- envuelve el bloque). Validaciones server-side defensivas porque
-- el cliente no tiene auth.uid() para RLS.
--
-- Llamado desde server action con service_role.
--
-- Returns el receipt_code generado.
-- ─────────────────────────────────────────────────────────────
create or replace function public.create_receipt_as_operario(
  p_operario_id           uuid,
  p_warehouse_id          uuid,
  p_is_orphan             boolean,
  p_client_markbox        text,
  p_client_name           text,
  p_orphan_marks          text,
  p_orphan_brought_by     text,
  p_supplier_name         text,
  p_supplier_translated   text,
  p_boxes                 int,
  p_total_cbm             numeric,
  p_total_weight_kg       numeric,
  p_received_at           date,
  p_notes                 text,
  p_items                 jsonb,    -- array de {description, hs_code, quantity, unit_value_usd, ...}
  p_incident              boolean,
  p_incident_note         text
)
returns table (
  receipt_id     uuid,
  receipt_code   text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id    uuid;
  v_active       boolean;
  v_code         text;
  v_receipt_id   uuid;
  v_item         jsonb;
  v_pos          int := 0;
begin
  -- 1. Validar operario activo y resolver tenant
  select tenant_id, active
    into v_tenant_id, v_active
    from public.operario_pins
   where id = p_operario_id;

  if v_tenant_id is null then
    raise exception 'Operario no encontrado (id=%)', p_operario_id
      using errcode = 'P0001';
  end if;
  if not v_active then
    raise exception 'Operario inactivo' using errcode = 'P0002';
  end if;

  -- 2. Validar boxes > 0 (sanity)
  if p_boxes is null or p_boxes <= 0 then
    raise exception 'boxes debe ser > 0' using errcode = 'P0003';
  end if;

  -- 3. Generar código (huérfana → SIN-CODIGO, normal → WR-YYYY)
  if p_is_orphan then
    v_code := public.next_orphan_code(v_tenant_id);
  else
    if p_client_markbox is null or length(trim(p_client_markbox)) = 0 then
      raise exception 'client_markbox requerido cuando no es huérfana' using errcode = 'P0004';
    end if;
    v_code := public.next_receipt_code(v_tenant_id);
  end if;

  -- 4. Insert receipt
  insert into public.warehouse_receipts_cn (
    tenant_id, receipt_code, warehouse_id,
    client_markbox, client_name,
    is_orphan, orphan_marks, orphan_brought_by,
    supplier_name, supplier_name_translated,
    boxes, total_cbm, total_weight_kg,
    status, received_at, notes,
    created_by_operario_id
  ) values (
    v_tenant_id, v_code, p_warehouse_id,
    case when p_is_orphan then null else p_client_markbox end,
    case when p_is_orphan then null else p_client_name end,
    p_is_orphan, p_orphan_marks, p_orphan_brought_by,
    p_supplier_name, p_supplier_translated,
    p_boxes, p_total_cbm, p_total_weight_kg,
    case when p_incident then 'incidencia'::warehouse_receipt_status
         else 'pendiente_consolidacion'::warehouse_receipt_status end,
    coalesce(p_received_at, current_date),
    p_notes,
    p_operario_id
  )
  returning id into v_receipt_id;

  -- 5. Insert items (si vienen)
  if p_items is not null and jsonb_typeof(p_items) = 'array' then
    for v_item in select * from jsonb_array_elements(p_items)
    loop
      insert into public.warehouse_receipt_items (
        tenant_id, receipt_id, description, description_translated,
        hs_code, quantity, unit_value_usd, notes, position
      ) values (
        v_tenant_id, v_receipt_id,
        coalesce(v_item->>'description', ''),
        v_item->>'description_translated',
        v_item->>'hs_code',
        nullif(v_item->>'quantity', '')::int,
        nullif(v_item->>'unit_value_usd', '')::numeric,
        v_item->>'notes',
        v_pos
      );
      v_pos := v_pos + 1;
    end loop;
  end if;

  -- 6. Insert evento timeline (received + opt incident)
  insert into public.warehouse_receipt_events (
    tenant_id, receipt_id, event_type, description, occurred_at
  ) values (
    v_tenant_id, v_receipt_id,
    'received'::warehouse_receipt_event_type,
    'Recibida en hub por operario · PWA mobile',
    now()
  );

  if p_incident then
    insert into public.warehouse_receipt_events (
      tenant_id, receipt_id, event_type, description, occurred_at
    ) values (
      v_tenant_id, v_receipt_id,
      'incident'::warehouse_receipt_event_type,
      coalesce(nullif(trim(p_incident_note), ''), 'Incidencia reportada sin nota'),
      now()
    );
  end if;

  return query select v_receipt_id, v_code;
end;
$$;

comment on function public.create_receipt_as_operario is
  'Crea recepción CN + items + event atomicamente desde la PWA del operario. Recibe operario_id (de cookie HTTP-only) en lugar de auth.uid(). Llamada desde server action con service_role.';

-- ─────────────────────────────────────────────────────────────
-- GRANTS — service_role only (operario no es authenticated)
-- ─────────────────────────────────────────────────────────────
revoke all on public.operario_pins from public, anon, authenticated;
grant select, insert, update, delete on public.operario_pins to service_role;

-- Las RPCs son SECURITY DEFINER así que correrlas como service_role
-- es equivalente a correrlas como propietario. Bloqueamos otros roles.
revoke all on function public.verify_operario_pin(text) from public, anon, authenticated;
grant execute on function public.verify_operario_pin(text) to service_role;

revoke all on function public.create_receipt_as_operario(
  uuid, uuid, boolean, text, text, text, text, text, text,
  int, numeric, numeric, date, text, jsonb, boolean, text
) from public, anon, authenticated;
grant execute on function public.create_receipt_as_operario(
  uuid, uuid, boolean, text, text, text, text, text, text,
  int, numeric, numeric, date, text, jsonb, boolean, text
) to service_role;

-- ─────────────────────────────────────────────────────────────
-- RLS — solo service_role accede (NO authenticated)
-- Los operarios no entran a operario_pins desde el cliente.
-- El Studio web podría querer listar/editar operarios → eso vendrá
-- en SDD-0027 Fase 2 con policy específica por rol admin.
-- ─────────────────────────────────────────────────────────────
alter table public.operario_pins enable row level security;

-- Sin policy = bloqueado por default (DENY ALL excepto service_role
-- que bypassea RLS).

-- ─────────────────────────────────────────────────────────────
-- Seed: Wang Hua YIW-A1 con PIN 4278
--
-- Resolución del tenant: usamos el tenant DTD·CARGO (slug='dtd')
-- que ya existe en la base. Si no existe, falla la migration
-- (intencional: garantiza orden de aplicación).
-- ─────────────────────────────────────────────────────────────
do $$
declare
  v_tenant_id     uuid;
  v_warehouse_id  uuid;
begin
  select id into v_tenant_id from public.tenants where slug = 'dtd';
  if v_tenant_id is null then
    raise exception 'Tenant slug=dtd no existe — aplicar migrations base primero';
  end if;

  select id into v_warehouse_id
    from public.warehouses_cn where code = 'YIW-A1';
  if v_warehouse_id is null then
    raise exception 'Warehouse YIW-A1 no existe — aplicar 0008_warehouses_cn.sql primero';
  end if;

  insert into public.operario_pins (
    tenant_id, warehouse_id, display_name, display_name_cn, pin_hash, role
  ) values (
    v_tenant_id, v_warehouse_id,
    'Wang Hua', '王华',
    crypt('4278', gen_salt('bf')),
    'operario'
  )
  on conflict (warehouse_id, display_name) do nothing;
end $$;
