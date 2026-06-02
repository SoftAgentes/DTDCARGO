-- ============================================================================
-- SEED · Portal del Cliente (SDD-0042) — datos demo para ver /portal con data
-- ----------------------------------------------------------------------------
-- Pegá TODO esto en Supabase → SQL Editor → Run.  Idempotente (re-corrible).
--
-- CONTEXTO REAL (descubierto 2026-06-02 vía MCP, prod "DoorTuDoor"):
--   El login de portal que YA existe y está `active` es  hailuway.com@gmail.com,
--   atado al cliente  DTD-1004 "Demo Pyme C.A."  → por eso sembramos AHÍ (no en
--   DTD-1001). No hace falta bindear nada ni esperar magic-link: con refrescar
--   /portal alcanza.
--
--   Si en el futuro querés sembrarle a OTRO cliente, cambiá v_markbox abajo y
--   asegurate de que ese cliente tenga un client_users `active` (acceso al portal
--   habilitado desde el Studio → cliente → "Acceso al portal").
-- ============================================================================
do $$
declare
  v_markbox text := 'DTD-1004';                 -- 👈 cliente a sembrar
  v_tenant  uuid;
  v_name    text;
begin
  select id into v_tenant from public.tenants where slug = 'dtd' limit 1;
  if v_tenant is null then
    raise exception 'No existe el tenant demo (slug=dtd).';
  end if;

  select name into v_name from public.clients
    where tenant_id = v_tenant and markbox = v_markbox and deleted_at is null;
  if v_name is null then
    raise exception 'No existe el cliente % en el tenant demo.', v_markbox;
  end if;

  -- dirección para "Mi cuenta" (si estaba null)
  update public.clients
    set address = coalesce(address, 'Av. Bolívar Norte, Valencia, Carabobo')
    where tenant_id = v_tenant and markbox = v_markbox;

  -- 7 envíos demo (variados en servicio + estado → lista, detalle, timeline, ETA)
  insert into public.shipments
    (tenant_id, code, client_name, client_markbox, origin, destination,
     shipment_service, status, weight_kg, volume_m3, arrived_destination_at,
     created_at, updated_at)
  select v_tenant, x.code, v_name, v_markbox, x.origin, x.destination,
         x.service::shipment_service, x.status::shipment_status,
         x.weight_kg, x.volume_m3, x.arrived_at, x.created_at, now()
  from (values
    ('DTD-2026-0401','Yiwu, China',      'Valencia, Venezuela',  'consolidacion',        'in_transit',            820.0,  3.250, null::timestamptz,          now() - interval '20 days'),
    ('DTD-2026-0402','Guangzhou, China', 'Caracas, Venezuela',   'puerta_a_puerta_DDP',  'in_customs',            540.5,  2.100, null::timestamptz,          now() - interval '35 days'),
    ('DTD-2026-0403','Shenzhen, China',  'Maracaibo, Venezuela', 'reserva_FCL',           'shipped',            12500.0, 58.000, null::timestamptz,          now() - interval '12 days'),
    ('DTD-2026-0404','Yiwu, China',      'Valencia, Venezuela',  'consolidacion',        'arrived_destination',   310.0,  1.050, now() - interval '6 days',  now() - interval '52 days'),
    ('DTD-2026-0405','Valencia, VE',     'Barquisimeto, VE',     'transporte_terrestre', 'out_for_delivery',      180.0,  0.900, null::timestamptz,          now() - interval '3 days'),
    ('DTD-2026-0406','Yiwu, China',      'Valencia, Venezuela',  'consolidacion',        'delivered',             450.0,  1.800, now() - interval '40 days', now() - interval '70 days'),
    ('DTD-2026-0407','Ningbo, China',    'Valencia, Venezuela',  'puerta_a_puerta_DDP',  'in_warehouse',          260.0,  1.200, null::timestamptz,          now() - interval '5 days')
  ) as x(code, origin, destination, service, status, weight_kg, volume_m3, arrived_at, created_at)
  on conflict (tenant_id, code) do update
    set status = excluded.status, shipment_service = excluded.shipment_service,
        origin = excluded.origin, destination = excluded.destination,
        weight_kg = excluded.weight_kg, volume_m3 = excluded.volume_m3,
        client_markbox = excluded.client_markbox,
        arrived_destination_at = excluded.arrived_destination_at, updated_at = now();

  raise notice 'Portal seed OK · client=% (%)', v_name, v_markbox;
end $$;

-- Verificación (esperado: status active + envios_total >= 7):
select c.markbox, c.name, c.address, cu.email as login_portal, cu.status,
       (select count(*) from public.shipments s
          where s.client_markbox = c.markbox and s.deleted_at is null) as envios_total
from public.clients c
join public.client_users cu on cu.client_id = c.id
where c.markbox = 'DTD-1004';
