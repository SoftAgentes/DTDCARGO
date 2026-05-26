-- ─────────────────────────────────────────────────────────────
-- SDD-0030 Fase 2: Apps móviles bodeguero VE + camionero VE
--
-- Extiende operario_pins.role para soportar los 2 roles nuevos del
-- pipeline de Despacho (bodeguero arma camiones, camionero entrega).
-- + Tabla dispatch_pods (proofs of delivery).
-- + 4 RPCs operario: bodeguero_advance_od · bodeguero_split_p2
--   camionero_advance_od · camionero_pod
-- + Update verify_operario_pin para devolver region.
--
-- 100% aditivo. NO toca operarios CN existentes (Wang Hua YIW-A1 sigue
-- idéntica · role='operario', region='cn').
-- ─────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────
-- 1. Extender CHECK constraint del role
-- ─────────────────────────────────────────────────────────────

alter table public.operario_pins drop constraint operario_pins_role_check;

alter table public.operario_pins
  add constraint operario_pins_role_check
  check (role in ('operario', 'supervisor', 'bodeguero', 'camionero'));

-- Constraint nuevo: bodeguero/camionero requieren region='ve'
alter table public.operario_pins
  add constraint operario_pins_ve_role_requires_ve_region
  check (
    region = 've'
    or role not in ('bodeguero', 'camionero')
  );

comment on column public.operario_pins.role is
  'Rol del operario · operario|supervisor (CN almacén) o bodeguero|camionero (VE despacho). Bodeguero arma camiones; camionero entrega. SDD-0030.';

-- ─────────────────────────────────────────────────────────────
-- 2. Tabla dispatch_pods (proofs of delivery)
-- ─────────────────────────────────────────────────────────────

create table public.dispatch_pods (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants(id) on delete cascade,
  od_id                    uuid not null references public.dispatch_orders(id) on delete cascade,
  package_id               uuid,                                  -- nullable: POD por paquete (V2)
  photo_path               text,                                  -- 'pod/<tenant>/<od>/<ts>.jpg'
  signature_path           text,                                  -- 'firma/<tenant>/<od>/<ts>.png'
  received_by              text not null,
  received_doc             text,                                  -- cédula opcional
  notes                    text,
  created_by_operario_id   uuid references public.operario_pins(id) on delete set null,
  created_at               timestamptz not null default now()
);

comment on table public.dispatch_pods is
  'Proofs of Delivery (POD) de Órdenes de Despacho. 1 fila por entrega confirmada por el camionero PWA. Photo + signature paths apuntan al bucket receipt-photos con prefijos pod/ y firma/.';

create index dispatch_pods_od_idx
  on public.dispatch_pods (od_id, created_at desc);
create index dispatch_pods_tenant_idx
  on public.dispatch_pods (tenant_id, created_at desc);

alter table public.dispatch_pods enable row level security;

-- Admins del tenant pueden leer todos los PODs (consulta auditable)
create policy dispatch_pods_select on public.dispatch_pods
  for select using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

-- Inserts vienen via RPC (security definer · service_role bypass)
-- No exponemos insert a authenticated.

grant select on public.dispatch_pods to authenticated;
grant select, insert, update, delete on public.dispatch_pods to service_role;

-- ─────────────────────────────────────────────────────────────
-- 3. Update RPC verify_operario_pin · agregar region en el return
-- ─────────────────────────────────────────────────────────────

drop function if exists public.verify_operario_pin(text);

create or replace function public.verify_operario_pin(
  p_pin text
)
returns table (
  operario_id      uuid,
  tenant_id        uuid,
  warehouse_id     uuid,             -- nullable desde SDD-0023 (chofer/bodeguero VE no necesariamente)
  display_name     text,
  display_name_cn  text,
  role             text,
  region           operario_region   -- NUEVO en SDD-0030
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_matches int;
begin
  -- Sanity: PIN no vacío + 4 dígitos numéricos
  if p_pin is null or length(p_pin) <> 4 or p_pin !~ '^\d{4}$' then
    return;
  end if;

  -- Contar matches (improbable colisión pero auditable)
  select count(*) into v_matches
  from public.operario_pins
  where active = true
    and pin_hash = crypt(p_pin, pin_hash);

  if v_matches <> 1 then
    return;
  end if;

  return query
  update public.operario_pins op
     set last_login_at = now()
   where op.active = true
     and op.pin_hash = crypt(p_pin, op.pin_hash)
  returning op.id, op.tenant_id, op.warehouse_id,
            op.display_name, op.display_name_cn, op.role, op.region;
end;
$$;

comment on function public.verify_operario_pin(text) is
  'Valida PIN del operario (4 dígitos plain). Retorna identidad incluyendo region (cn|ve) para que el server action de login redirija a la app correcta. SDD-0030 extiende SDD-0027.';

revoke all on function public.verify_operario_pin(text) from public, anon, authenticated;
grant execute on function public.verify_operario_pin(text) to service_role;

-- ─────────────────────────────────────────────────────────────
-- 4. RPC bodeguero_advance_od
--
-- Transiciones permitidas para el bodeguero:
--   creada → cargando        (al abrir la OD)
--   cargando → lista         ("Cerrar carga")
--
-- Validaciones:
--   - operario activo + role='bodeguero' (o supervisor VE legacy)
--   - OD existe + tenant match
--   - Transición permitida por trigger guard (deja que el trigger valide)
-- ─────────────────────────────────────────────────────────────

create or replace function public.bodeguero_advance_od(
  p_operario_id    uuid,
  p_od_id          uuid,
  p_status         dispatch_order_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id  uuid;
  v_role       text;
  v_region     operario_region;
  v_active     boolean;
  v_od_tenant  uuid;
begin
  -- 1. Validar operario
  select tenant_id, role, region, active
    into v_tenant_id, v_role, v_region, v_active
    from public.operario_pins
   where id = p_operario_id;

  if v_tenant_id is null then
    raise exception 'Operario no encontrado' using errcode = 'P0001';
  end if;
  if not v_active then
    raise exception 'Operario inactivo' using errcode = 'P0002';
  end if;
  if v_region <> 've' then
    raise exception 'Solo operarios VE pueden actuar sobre Despacho' using errcode = 'P0003';
  end if;
  if v_role not in ('bodeguero', 'supervisor') then
    raise exception 'Solo bodeguero/supervisor puede avanzar carga' using errcode = 'P0004';
  end if;

  -- 2. Validar OD tenant
  select tenant_id into v_od_tenant
    from public.dispatch_orders
   where id = p_od_id;

  if v_od_tenant is null then
    raise exception 'OD no encontrada' using errcode = 'P0005';
  end if;
  if v_od_tenant <> v_tenant_id then
    raise exception 'Tenant mismatch' using errcode = 'P0006';
  end if;

  -- 3. Validar transición esperada (whitelist bodeguero)
  if p_status not in ('cargando', 'lista') then
    raise exception 'Transición % no permitida para bodeguero', p_status using errcode = 'P0007';
  end if;

  -- 4. Update (trigger guard valida la transición real desde el current)
  update public.dispatch_orders
     set status = p_status,
         updated_by = null,                    -- operario no tiene auth.uid
         updated_at = now()
   where id = p_od_id;
end;
$$;

comment on function public.bodeguero_advance_od(uuid, uuid, dispatch_order_status) is
  'Advance OD desde la PWA del bodeguero. Solo permite creada→cargando→lista. Resto bloqueado por el trigger guard.';

revoke all on function public.bodeguero_advance_od(uuid, uuid, dispatch_order_status)
  from public, anon, authenticated;
grant execute on function public.bodeguero_advance_od(uuid, uuid, dispatch_order_status)
  to service_role;

-- ─────────────────────────────────────────────────────────────
-- 5. RPC bodeguero_split_p2
--
-- Fracciona un paquete: actualiza la fila junction existente con
-- boxes_shipped < boxes_total y motivo, y crea una OD nueva (P2)
-- con parent_od_id apuntando a la P1.
--
-- La P2 queda con status='creada' sin camión/chofer (admin la asigna).
-- ─────────────────────────────────────────────────────────────

create or replace function public.bodeguero_split_p2(
  p_operario_id        uuid,
  p_od_id              uuid,
  p_package_id         uuid,
  p_boxes_shipped      int,
  p_split_reason       dispatch_split_reason,
  p_split_reason_text  text
)
returns uuid           -- id de la OD P2 creada
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id      uuid;
  v_role           text;
  v_region         operario_region;
  v_active         boolean;
  v_pkg            public.dispatch_order_packages%rowtype;
  v_od             public.dispatch_orders%rowtype;
  v_remaining      int;
  v_new_od_id      uuid;
  v_new_code       text;
begin
  -- 1. Validar operario (igual pattern que bodeguero_advance_od)
  select tenant_id, role, region, active
    into v_tenant_id, v_role, v_region, v_active
    from public.operario_pins
   where id = p_operario_id;
  if v_tenant_id is null then raise exception 'Operario no encontrado' using errcode = 'P0001'; end if;
  if not v_active then raise exception 'Operario inactivo' using errcode = 'P0002'; end if;
  if v_region <> 've' then raise exception 'Solo operarios VE' using errcode = 'P0003'; end if;
  if v_role not in ('bodeguero', 'supervisor') then
    raise exception 'Solo bodeguero/supervisor puede fraccionar' using errcode = 'P0004';
  end if;

  -- 2. Lock + leer el paquete
  select * into v_pkg
    from public.dispatch_order_packages
   where od_id = p_od_id and package_id = p_package_id
   for update;
  if v_pkg.od_id is null then
    raise exception 'Paquete no encontrado en la OD' using errcode = 'P0008';
  end if;

  -- 3. Validar boxes_shipped
  if p_boxes_shipped <= 0 or p_boxes_shipped >= v_pkg.boxes_total then
    raise exception 'boxes_shipped debe estar entre 1 y boxes_total-1' using errcode = 'P0009';
  end if;

  v_remaining := v_pkg.boxes_total - p_boxes_shipped;

  -- 4. Validar OD tenant
  select * into v_od from public.dispatch_orders where id = p_od_id;
  if v_od.tenant_id <> v_tenant_id then
    raise exception 'Tenant mismatch' using errcode = 'P0006';
  end if;

  -- 5. Update el junction P1: boxes_shipped + motivo
  update public.dispatch_order_packages
     set boxes_shipped = p_boxes_shipped,
         split_reason = p_split_reason,
         split_reason_text = p_split_reason_text
   where od_id = p_od_id and package_id = p_package_id;

  -- 6. Generar code P2 via RPC (no llamamos next_dispatch_order_code porque
  --    chequea auth.uid; usamos la lógica inline acá)
  declare
    v_year text := to_char(now() at time zone 'America/Caracas', 'YYYY');
    v_max  int;
  begin
    select coalesce(max((substring(order_code from 'OD-' || v_year || '-(\d+)$'))::int), 0)
      into v_max
      from public.dispatch_orders
     where tenant_id = v_tenant_id
       and order_code like 'OD-' || v_year || '-%';
    v_new_code := 'OD-' || v_year || '-' || lpad((v_max + 1)::text, 4, '0');
  end;

  -- 7. Crear OD P2 (sin camión/chofer · status='creada')
  insert into public.dispatch_orders (
    tenant_id, order_code, status, hub,
    route_id, truck_id, driver_id,
    total_kg, total_cbm, package_count,
    cities_ordered,
    parent_od_id
  ) values (
    v_tenant_id,
    v_new_code,
    'creada',
    v_od.hub,
    v_od.route_id,
    null,                                              -- admin reasigna
    null,
    round((v_pkg.weight_kg * v_remaining / v_pkg.boxes_total)::numeric, 2),
    round((v_pkg.cbm        * v_remaining / v_pkg.boxes_total)::numeric, 3),
    1,
    array[v_pkg.city]::text[],
    p_od_id
  )
  returning id into v_new_od_id;

  -- 8. Insertar junction de la P2
  insert into public.dispatch_order_packages (
    od_id, package_kind, package_id, markbox, client_name, city, pay,
    description, boxes_total, boxes_shipped, weight_kg, cbm,
    hs_code, aes_code
  ) values (
    v_new_od_id, v_pkg.package_kind, v_pkg.package_id, v_pkg.markbox,
    v_pkg.client_name, v_pkg.city, v_pkg.pay,
    v_pkg.description, v_remaining, v_remaining,
    round((v_pkg.weight_kg * v_remaining / v_pkg.boxes_total)::numeric, 2),
    round((v_pkg.cbm        * v_remaining / v_pkg.boxes_total)::numeric, 3),
    v_pkg.hs_code, v_pkg.aes_code
  );

  return v_new_od_id;
end;
$$;

comment on function public.bodeguero_split_p2(uuid, uuid, uuid, int, dispatch_split_reason, text) is
  'Fracciona un paquete en la OD actual (P1) y crea OD nueva (P2) con el remanente. La P2 queda creada sin camión/chofer para que el admin la reasigne.';

revoke all on function public.bodeguero_split_p2(uuid, uuid, uuid, int, dispatch_split_reason, text)
  from public, anon, authenticated;
grant execute on function public.bodeguero_split_p2(uuid, uuid, uuid, int, dispatch_split_reason, text)
  to service_role;

-- ─────────────────────────────────────────────────────────────
-- 6. RPC camionero_advance_od
--
-- Transiciones permitidas para el camionero:
--   lista → en_ruta         ("Iniciar ruta")
--   en_ruta → entregada     (cuando hizo la última POD)
-- ─────────────────────────────────────────────────────────────

create or replace function public.camionero_advance_od(
  p_operario_id    uuid,
  p_od_id          uuid,
  p_status         dispatch_order_status,
  p_progress       int,
  p_current_city   text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id  uuid;
  v_role       text;
  v_region     operario_region;
  v_active     boolean;
  v_od_tenant  uuid;
begin
  select tenant_id, role, region, active
    into v_tenant_id, v_role, v_region, v_active
    from public.operario_pins
   where id = p_operario_id;
  if v_tenant_id is null then raise exception 'Operario no encontrado' using errcode = 'P0001'; end if;
  if not v_active then raise exception 'Operario inactivo' using errcode = 'P0002'; end if;
  if v_region <> 've' then raise exception 'Solo operarios VE' using errcode = 'P0003'; end if;
  if v_role not in ('camionero', 'supervisor') then
    raise exception 'Solo camionero/supervisor puede avanzar ruta' using errcode = 'P0004';
  end if;

  select tenant_id into v_od_tenant from public.dispatch_orders where id = p_od_id;
  if v_od_tenant is null then raise exception 'OD no encontrada' using errcode = 'P0005'; end if;
  if v_od_tenant <> v_tenant_id then raise exception 'Tenant mismatch' using errcode = 'P0006'; end if;

  if p_status not in ('en_ruta', 'entregada') then
    raise exception 'Transición % no permitida para camionero', p_status using errcode = 'P0007';
  end if;

  update public.dispatch_orders
     set status = p_status,
         progress_pct = coalesce(p_progress, progress_pct),
         current_city = coalesce(p_current_city, current_city),
         updated_at = now()
   where id = p_od_id;
end;
$$;

comment on function public.camionero_advance_od is
  'Advance OD desde la PWA del camionero. Solo permite lista→en_ruta y en_ruta→entregada.';

revoke all on function public.camionero_advance_od(uuid, uuid, dispatch_order_status, int, text)
  from public, anon, authenticated;
grant execute on function public.camionero_advance_od(uuid, uuid, dispatch_order_status, int, text)
  to service_role;

-- ─────────────────────────────────────────────────────────────
-- 7. RPC camionero_pod
--
-- Crea fila dispatch_pods con foto/firma/receptor. No cambia status
-- automáticamente — eso lo hace camionero_advance_od cuando es la
-- última entrega.
-- ─────────────────────────────────────────────────────────────

create or replace function public.camionero_pod(
  p_operario_id      uuid,
  p_od_id            uuid,
  p_package_id       uuid,                    -- nullable
  p_photo_path       text,
  p_signature_path   text,
  p_received_by      text,
  p_received_doc     text,
  p_notes            text
)
returns uuid          -- id del POD creado
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id  uuid;
  v_role       text;
  v_region     operario_region;
  v_active     boolean;
  v_od_tenant  uuid;
  v_pod_id     uuid;
begin
  select tenant_id, role, region, active
    into v_tenant_id, v_role, v_region, v_active
    from public.operario_pins
   where id = p_operario_id;
  if v_tenant_id is null then raise exception 'Operario no encontrado' using errcode = 'P0001'; end if;
  if not v_active then raise exception 'Operario inactivo' using errcode = 'P0002'; end if;
  if v_region <> 've' then raise exception 'Solo operarios VE' using errcode = 'P0003'; end if;
  if v_role not in ('camionero', 'supervisor') then
    raise exception 'Solo camionero/supervisor puede confirmar POD' using errcode = 'P0004';
  end if;

  select tenant_id into v_od_tenant from public.dispatch_orders where id = p_od_id;
  if v_od_tenant is null then raise exception 'OD no encontrada' using errcode = 'P0005'; end if;
  if v_od_tenant <> v_tenant_id then raise exception 'Tenant mismatch' using errcode = 'P0006'; end if;

  if p_received_by is null or length(trim(p_received_by)) = 0 then
    raise exception 'Receptor obligatorio' using errcode = 'P0010';
  end if;
  if p_photo_path is null or length(trim(p_photo_path)) = 0 then
    raise exception 'Foto del POD obligatoria' using errcode = 'P0011';
  end if;
  if p_signature_path is null or length(trim(p_signature_path)) = 0 then
    raise exception 'Firma del POD obligatoria' using errcode = 'P0012';
  end if;

  insert into public.dispatch_pods (
    tenant_id, od_id, package_id, photo_path, signature_path,
    received_by, received_doc, notes, created_by_operario_id
  ) values (
    v_tenant_id, p_od_id, p_package_id, p_photo_path, p_signature_path,
    trim(p_received_by), nullif(trim(coalesce(p_received_doc, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    p_operario_id
  )
  returning id into v_pod_id;

  return v_pod_id;
end;
$$;

comment on function public.camionero_pod is
  'Confirma POD (Proof of Delivery) de una entrega: foto + firma + receptor. Llamada desde la PWA del camionero.';

revoke all on function public.camionero_pod(uuid, uuid, uuid, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.camionero_pod(uuid, uuid, uuid, text, text, text, text, text)
  to service_role;
