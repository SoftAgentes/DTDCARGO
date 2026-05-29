-- ─────────────────────────────────────────────────────────────
-- 0066 · Foundation v3 · Consolidación pre-sprints v3
--
-- Una sola migración que prepara el terreno para los sprints:
--   D · Multi-rol Modos selector (usa operario_pins.roles[])
--   2 · Bodeguero Despacho v1.7 (usa entity_audit_log, warehouse_location, operario_action)
--   3 · Camionero v1.7 completo (usa clients.facade_photo_url, address_reference, tms_truck_locations)
--   E · Recepción VE bodeguero (usa entity_audit_log)
--   4 · Push background (usa outbox_push_events)
--
-- Reduce 6 migraciones del plan v2 a 1 consolidada. Aditivo, sin breaking.
--
-- Bloques:
--   1. operario_pins.roles text[] + backfill desde role singular
--   2. entity_audit_log (genérico cross-entity)
--   3. outbox_push_events (vacía hasta Sprint 4)
--   4. clients.address_reference + facade_photo_url + bucket client-facades
--   5. tms_truck_locations (GPS live separado del POD)
--   6. dispatch_order_packages.warehouse_location jsonb + feature flag
--   7. RPC operario_action(p_operario_id, p_action_type, p_payload jsonb)
--   8. verify_operario_pin extendida para retornar roles[]
-- ─────────────────────────────────────────────────────────────

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. MULTI-ROL · operario_pins.roles text[]                ║
-- ╚═══════════════════════════════════════════════════════════╝

alter table public.operario_pins
  add column if not exists roles text[] not null default '{}';

-- CHECK que cada elemento esté en el set permitido.
-- Constraint nombrado para poder droppearlo si en el futuro se suma rol nuevo.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'operario_pins_roles_check'
  ) then
    alter table public.operario_pins
      add constraint operario_pins_roles_check
      check (
        roles <@ ARRAY['operario','supervisor','bodeguero','camionero']::text[]
      );
  end if;
end $$;

-- Backfill: rows existentes obtienen ARRAY[role] = [su rol único actual]
update public.operario_pins
  set roles = ARRAY[role]
  where coalesce(array_length(roles, 1), 0) = 0
    and role is not null;

comment on column public.operario_pins.roles is
  'Sprint F v3: array de roles disponibles para el operario. Si length>1, el login muestra selector "Modos". role singular se mantiene como "primary mode" default. Backfill 2026-05-28.';

create index if not exists operario_pins_roles_idx
  on public.operario_pins using gin (roles)
  where active = true;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. ENTITY_AUDIT_LOG · log genérico cross-entity          ║
-- ╚═══════════════════════════════════════════════════════════╝

create table if not exists public.entity_audit_log (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  entity_type   text not null check (entity_type in (
    'shipment',
    'dispatch_order',
    'dispatch_order_package',
    'warehouse_receipt_cn',
    'warehouse_receipt_ve'
  )),
  entity_id     uuid not null,
  actor_type    text not null check (actor_type in ('user','operario','system')),
  actor_id      uuid,                                     -- nullable si actor_type='system'
  event_type    text not null,                            -- 'edited','status_change','split','reassign','partial_delivery','sealed', etc.
  payload       jsonb not null default '{}'::jsonb,
  occurred_at   timestamptz not null default now()
);

comment on table public.entity_audit_log is
  'Sprint F v3: audit log genérico para mutaciones cross-entity. Reemplaza la idea de dispatch_order_events paralela a warehouse_receipt_events. 1 sola RLS, 1 Realtime channel.';

create index if not exists entity_audit_log_entity_idx
  on public.entity_audit_log (entity_type, entity_id, occurred_at desc);

create index if not exists entity_audit_log_tenant_idx
  on public.entity_audit_log (tenant_id, occurred_at desc);

alter table public.entity_audit_log enable row level security;

create policy "entity_audit_log_tenant_select"
  on public.entity_audit_log for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()));

-- Insert solo via RPC (operario_action) con service_role · no expone INSERT a authenticated
create policy "entity_audit_log_service_role_all"
  on public.entity_audit_log for all to service_role using (true) with check (true);

grant select on public.entity_audit_log to authenticated;
grant all on public.entity_audit_log to service_role;

-- Realtime publication (idempotente)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'entity_audit_log'
  ) then
    alter publication supabase_realtime add table public.entity_audit_log;
  end if;
end $$;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. OUTBOX_PUSH_EVENTS · vacía hasta Sprint 4             ║
-- ╚═══════════════════════════════════════════════════════════╝

create table if not exists public.outbox_push_events (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  target_type text not null check (target_type in ('operario','user')),
  target_id   uuid not null,
  payload     jsonb not null,                              -- {title, body, url, ...}
  created_at  timestamptz not null default now(),
  sent_at     timestamptz,                                 -- nullable hasta que el worker lo envía
  attempts    int not null default 0
);

comment on table public.outbox_push_events is
  'Sprint F v3 (creada vacía, consumida en Sprint 4): cola de pushes pendientes. Worker poll cada 30s, envía via web-push, marca sent_at. Idempotency en target+payload.';

create index if not exists outbox_push_pending_idx
  on public.outbox_push_events (created_at)
  where sent_at is null;

alter table public.outbox_push_events enable row level security;

create policy "outbox_push_service_role_all"
  on public.outbox_push_events for all to service_role using (true) with check (true);

grant all on public.outbox_push_events to service_role;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 4. CLIENTS · address_reference + facade_photo_url        ║
-- ╚═══════════════════════════════════════════════════════════╝

alter table public.clients
  add column if not exists address_reference text,
  add column if not exists facade_photo_url text;

comment on column public.clients.address_reference is
  'Sprint F v3: referencia visual de la dirección. Ej: "Frente a la panadería La Espiga". Captura del handoff camionero.jsx.';

comment on column public.clients.facade_photo_url is
  'Sprint F v3: path en bucket client-facades a la foto de fachada del cliente. Subida via 3 caminos: cliente al onboarding portal, camionero 1ra visita, o cliente actualiza después.';

-- Bucket client-facades · privado, max 5MB, imágenes solo
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-facades',
  'client-facades',
  false,
  5 * 1024 * 1024,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage policies para client-facades
-- Path scheme: {tenant_id}/{client_id}/{uuid}.jpg
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'client-facades service_role all'
  ) then
    create policy "client-facades service_role all"
      on storage.objects for all to service_role
      using (bucket_id = 'client-facades')
      with check (bucket_id = 'client-facades');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'client-facades authenticated read by tenant'
  ) then
    create policy "client-facades authenticated read by tenant"
      on storage.objects for select to authenticated
      using (
        bucket_id = 'client-facades'
        and (storage.foldername(name))[1] = (public.get_user_tenant_id())::text
      );
  end if;
end $$;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 5. TMS_TRUCK_LOCATIONS · GPS live del camión             ║
-- ╚═══════════════════════════════════════════════════════════╝

create table if not exists public.tms_truck_locations (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  truck_id      uuid not null references public.tms_trucks(id) on delete cascade,
  driver_id     uuid references public.tms_drivers(id) on delete set null,
  lat           numeric not null,
  lng           numeric not null,
  accuracy_m    numeric,
  recorded_at   timestamptz not null default now(),
  source        text not null default 'camionero_ping'  -- 'camionero_ping' | 'manual' | 'ais' (futuro)
);

comment on table public.tms_truck_locations is
  'Sprint F v3: pings GPS live del camión durante una ruta. SEPARADA de dispatch_pods (POD = snapshot puntual, esta tabla = stream). Endpoint POST /api/m/tms/ping cada 30s desde la PWA camionero. Retention 7 días.';

create index if not exists tms_truck_locations_truck_idx
  on public.tms_truck_locations (truck_id, recorded_at desc);

create index if not exists tms_truck_locations_tenant_recent_idx
  on public.tms_truck_locations (tenant_id, recorded_at desc);

alter table public.tms_truck_locations enable row level security;

create policy "tms_truck_locations_tenant_select"
  on public.tms_truck_locations for select to authenticated
  using (tenant_id = (select public.get_user_tenant_id()));

create policy "tms_truck_locations_service_role_all"
  on public.tms_truck_locations for all to service_role using (true) with check (true);

grant select on public.tms_truck_locations to authenticated;
grant all on public.tms_truck_locations to service_role;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 6. WAREHOUSE_LOCATION en dispatch_order_packages         ║
-- ╚═══════════════════════════════════════════════════════════╝

alter table public.dispatch_order_packages
  add column if not exists warehouse_location jsonb;

comment on column public.dispatch_order_packages.warehouse_location is
  'Sprint F v3: ubicación física en bodega VE · {pasillo, zona, estante}. NULL si la bodega no está zoneada. Feature flag dispatch.show_warehouse_location controla la visibilidad en mobile.';

-- Feature flag seed para tenants existentes · default OFF (bodega no zoneada por default)
do $$
declare
  v_tenant uuid;
begin
  for v_tenant in select id from public.tenants
  loop
    insert into public.feature_flags (tenant_id, key, enabled, description)
    values (
      v_tenant,
      'dispatch.show_warehouse_location',
      false,
      'Mostrar pasillo/zona/estante del paquete en bodeguero PWA. Activar solo cuando la bodega esté zoneada y los paquetes tengan warehouse_location populado.'
    )
    on conflict (tenant_id, key) do nothing;
  end loop;
end $$;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 7. RPC operario_action(p_operario_id, p_action_type, ...) ║
-- ║    Switch genérico para mutaciones operario               ║
-- ╚═══════════════════════════════════════════════════════════╝

create or replace function public.operario_action(
  p_operario_id  uuid,
  p_action_type  text,
  p_payload      jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_operario   record;
  v_result     jsonb := '{}'::jsonb;
begin
  -- 1. Validar operario activo · obtener identidad
  select id, tenant_id, role, roles, region, active
    into v_operario
    from public.operario_pins
   where id = p_operario_id;

  if v_operario.id is null then
    raise exception 'Operario no encontrado' using errcode = 'P0001';
  end if;
  if not v_operario.active then
    raise exception 'Operario inactivo' using errcode = 'P0002';
  end if;

  -- 2. Switch por action_type
  -- NOTA · stubs para sprints futuros. Cada sprint implementa su branch.
  case p_action_type
    when 'edit_receipt' then
      -- Sprint 1 · CN polish (implementar acá)
      raise exception 'edit_receipt branch pendiente · Sprint 1' using errcode = 'P0100';

    when 'reassign_od' then
      -- Sprint 2 · Bodeguero (implementar acá)
      raise exception 'reassign_od branch pendiente · Sprint 2' using errcode = 'P0101';

    when 'partial_delivery' then
      -- Sprint 3 · Camionero (implementar acá)
      raise exception 'partial_delivery branch pendiente · Sprint 3' using errcode = 'P0102';

    when 'seal_reception' then
      -- Sprint E · Recepción VE (implementar acá)
      raise exception 'seal_reception branch pendiente · Sprint E' using errcode = 'P0103';

    when 'scan_box' then
      -- Sprint E · Recepción VE (implementar acá)
      raise exception 'scan_box branch pendiente · Sprint E' using errcode = 'P0104';

    else
      raise exception 'action_type % desconocido', p_action_type using errcode = 'P0105';
  end case;

  return v_result;
end;
$$;

comment on function public.operario_action(uuid, text, jsonb) is
  'Sprint F v3: RPC genérica para mutaciones operario. Switch interno por action_type. Branches stubs (raise exception) hasta que cada sprint implemente. SECURITY DEFINER + service_role only.';

revoke all on function public.operario_action(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.operario_action(uuid, text, jsonb) to service_role;

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 8. UPDATE verify_operario_pin · retorna roles[]          ║
-- ╚═══════════════════════════════════════════════════════════╝

drop function if exists public.verify_operario_pin(text);

create or replace function public.verify_operario_pin(
  p_pin text
)
returns table (
  operario_id      uuid,
  tenant_id        uuid,
  warehouse_id     uuid,
  display_name     text,
  display_name_cn  text,
  role             text,                                    -- primary mode (singular, compat)
  roles            text[],                                  -- Sprint F v3 · multi-rol
  region           operario_region,
  tms_driver_id    uuid                                     -- Sprint 0
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_matches int;
begin
  -- Sanity: PIN 4 dígitos numéricos
  if p_pin is null or length(p_pin) <> 4 or p_pin !~ '^\d{4}$' then
    return;
  end if;

  -- Contar matches activos
  select count(*) into v_matches
  from public.operario_pins
  where active = true
    and pin_hash = extensions.crypt(p_pin, pin_hash);

  if v_matches <> 1 then
    return;
  end if;

  return query
  update public.operario_pins op
     set last_login_at = now()
   where op.active = true
     and op.pin_hash = extensions.crypt(p_pin, op.pin_hash)
  returning op.id, op.tenant_id, op.warehouse_id,
            op.display_name, op.display_name_cn,
            op.role, op.roles, op.region, op.tms_driver_id;
end;
$$;

comment on function public.verify_operario_pin(text) is
  'Sprint F v3: extendida para retornar roles text[] (multi-rol). Mantiene compat con role singular.';

revoke all on function public.verify_operario_pin(text) from public, anon, authenticated;
grant execute on function public.verify_operario_pin(text) to service_role;

-- ─────────────────────────────────────────────────────────────
-- Fin migración 0066_foundation_v3.sql
-- Aplicar con: supabase migration apply 0066 · o MCP apply_migration
-- ─────────────────────────────────────────────────────────────
