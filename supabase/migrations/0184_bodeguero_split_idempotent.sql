-- ─────────────────────────────────────────────────────────────
-- 0184 · bodeguero_split_p2 idempotente (SDD-0030 · cola offline)
--
-- Contexto: la PWA del bodeguero ahora encola el fraccionamiento en
-- localStorage cuando la red VE se cae, y un runner lo reintenta solo al
-- volver la señal. El caso peligroso es el "phantom-success": el split SÍ
-- entró en el server pero la respuesta se perdió por red → el item queda en
-- la cola y se reintenta. Sin guarda, ese reintento crearía una SEGUNDA OD
-- P2 (split duplicado).
--
-- Fix: guarda de idempotencia. El paquete P1 que ya se fraccionó tiene
-- `split_reason` no-null (lo setea el propio split, paso 5; y el CHECK de
-- 0024 `boxes_shipped = boxes_total or split_reason is not null` lo confirma
-- como discriminador canónico de "ya fraccionado"). La guarda corta el
-- reintento con P0013.
--
-- Concurrency-safe: la guarda corre DESPUÉS del `select ... for update` del
-- paquete (paso 2), así que dos intentos concurrentes (modal + runner) se
-- serializan: el primero setea split_reason y commitea; el segundo, al
-- liberarse el lock, lee el valor ya seteado y lanza P0013. No hay carrera.
--
-- 100% aditivo: misma firma, sin columna nueva. CREATE OR REPLACE preserva
-- privilegios, pero re-declaramos revoke/grant por defensa.
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

  -- 2b. Idempotencia (0184): si el paquete YA tiene split_reason, fue
  --     fraccionado antes. Un reintento de la cola offline (phantom-success)
  --     NO debe crear una segunda OD P2. Corre tras el FOR UPDATE → también
  --     bloquea carreras modal/runner concurrentes.
  if v_pkg.split_reason is not null then
    raise exception 'Paquete ya fraccionado' using errcode = 'P0013';
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

  -- 6. Generar code P2 via lógica inline (no next_dispatch_order_code · chequea auth.uid)
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
  'Fracciona un paquete en la OD actual (P1) y crea OD nueva (P2) con el remanente. La P2 queda creada sin camión/chofer para que el admin la reasigne. 0184: guarda de idempotencia (P0013 si el paquete ya tiene split_reason) para la cola offline del bodeguero.';

revoke all on function public.bodeguero_split_p2(uuid, uuid, uuid, int, dispatch_split_reason, text)
  from public, anon, authenticated;
grant execute on function public.bodeguero_split_p2(uuid, uuid, uuid, int, dispatch_split_reason, text)
  to service_role;
