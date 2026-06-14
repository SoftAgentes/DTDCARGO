-- ─────────────────────────────────────────────────────────────
-- 0130 · SDD-0076 Fase 2 · Configuración de servicios (contenido editable)
--
-- Materializa el CONTENIDO editable de los servicios en la DB del ERP. La
-- ESTRUCTURA/claves viven en código (lib/shared/service-catalog.ts, Fase 1);
-- esta tabla guarda lo que el founder edita SIN deploy: descripción, alcance,
-- precio, cómo se cobra, métodos de pago, adicionales, FAQ (públicas+internas),
-- notas internas, mapeo contable y el flag `is_public`.
--
-- 4 tablas (todas por tenant, RLS, soft-delete donde aplica):
--   · service_configs        — una fila por servicio (PK tenant_id+service_key)
--   · service_faqs           — FAQ públicas e internas
--   · service_addons         — adicionales (ADS): almacenaje, entrega fuera de casco…
--   · service_price_history  — historial de precios (los núcleo ya historizan en `rates`)
--
-- Capa pública vs interna: columnas separadas (*_public vs notes_internal).
-- El sitio NUNCA lee estas tablas directo (frontera) — solo vía las RPCs
-- public_servicios() / public_service_faqs(), que aplican WHITELIST de columnas
-- (no proyectan nada interno) y filtran is_public=true. Patrón de 0103.
--
-- service_role: cubierto por 0033 (default privileges). Lo crítico es el
-- `revoke all … from anon`: la capa interna debe ser inalcanzable salvo por RPC.
--
-- Idempotente (create if not exists / create or replace). NO aplicar a prod desde
-- la rama — la aplica la ventana de coordinación (regla de la ventana secundaria).
-- ─────────────────────────────────────────────────────────────

-- ── 1) service_configs ───────────────────────────────────────
create table if not exists public.service_configs (
  tenant_id            uuid not null references public.tenants(id) on delete cascade,
  service_key          text not null,                       -- clave canónica (código)
  shipment_service     public.shipment_service,             -- NULL en add-ons; poblado en núcleo
  -- capa PÚBLICA (lo que ve el cliente)
  title_public         text not null default '',
  description_public   text not null default '',            -- '' = pendiente, no renderiza
  includes_public      text[] not null default '{}',
  excludes_public      text[] not null default '{}',
  price_text           text not null default '',
  price_table          jsonb,                               -- {columnas[],filas[][],nota?}
  charge_moment        text,                                -- en qué parte se cobra
  payment_methods      text[] not null default '{}',        -- validado en app vs PAYMENT_METHODS
  how_to_request       text not null default '',
  timelines_public     text not null default '',
  note_public          text,
  condiciones_politicas text,                               -- T&C base + cláusulas de adicionales
  -- capa INTERNA (nunca sale al sitio)
  notes_internal       text,
  internal_price_ref   text,                                -- ej. ~550/CBM, no se publica
  mapeo_contable       text,                                -- categoría de ingreso
  -- publicación + estado
  is_public            boolean not null default false,
  service_state        text not null default 'activo',
  updated_at           timestamptz not null default now(),
  updated_by           uuid references auth.users(id),
  deleted_at           timestamptz,
  primary key (tenant_id, service_key),
  constraint service_configs_charge_moment_chk
    check (charge_moment is null or charge_moment in ('prepago','contra_entrega','por_hito','a_cotizar')),
  constraint service_configs_state_chk
    check (service_state in ('activo','suspendido','a-pedido','proximamente'))
);

comment on table public.service_configs is
  'Contenido editable de cada servicio (SDD-0076 Fase 2). Una fila por (tenant, service_key). La estructura/claves viven en código (lib/shared/service-catalog.ts). Capa pública (*_public) vs interna (notes_internal/internal_price_ref). La sirve public_servicios() con whitelist; el sitio nunca la lee directo.';

grant select, insert, update on public.service_configs to authenticated;
revoke all on public.service_configs from anon;  -- capa interna: solo via RPC

alter table public.service_configs enable row level security;
create policy "service_configs by tenant" on public.service_configs for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());

create trigger service_configs_touch
  before update on public.service_configs
  for each row execute function public.touch_updated_at();

-- ── 2) service_faqs ──────────────────────────────────────────
create table if not exists public.service_faqs (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  service_key  text not null,
  question     text not null,
  answer       text not null,
  audience     text not null default 'public',
  is_public    boolean not null default false,
  sort_order   integer not null default 0,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users(id),
  deleted_at   timestamptz,
  foreign key (tenant_id, service_key)
    references public.service_configs (tenant_id, service_key) on delete cascade,
  constraint service_faqs_audience_chk check (audience in ('public','internal')),
  -- una FAQ interna NUNCA puede quedar marcada como pública
  constraint service_faqs_internal_not_public check (audience = 'public' or is_public = false)
);

comment on table public.service_faqs is
  'FAQ por servicio (SDD-0076). audience=public lo ve el cliente (si is_public); audience=internal es del equipo y nunca se publica (CHECK lo fuerza).';

grant select, insert, update on public.service_faqs to authenticated;
revoke all on public.service_faqs from anon;

alter table public.service_faqs enable row level security;
create policy "service_faqs by tenant" on public.service_faqs for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());

create index if not exists service_faqs_lookup
  on public.service_faqs (tenant_id, service_key, is_public) where deleted_at is null;

create trigger service_faqs_touch
  before update on public.service_faqs
  for each row execute function public.touch_updated_at();

-- ── 3) service_addons (ADS modulares) ────────────────────────
create table if not exists public.service_addons (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  service_key   text not null,
  nombre        text not null,
  condicion     text,                  -- "tras 7 días gratis en bodega"
  tarifa        text,                  -- "$X/CBM/día" (texto: tarifas heterogéneas)
  politica_texto text,                 -- se inyecta en condiciones del servicio
  aplica_a      text[] not null default '{}',
  is_public     boolean not null default false,
  sort_order    integer not null default 0,
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users(id),
  deleted_at    timestamptz,
  foreign key (tenant_id, service_key)
    references public.service_configs (tenant_id, service_key) on delete cascade
);

comment on table public.service_addons is
  'Adicionales (ADS) que se cuelgan de un servicio (SDD-0076): almacenaje/bodegaje, entrega fuera del casco, etc. Cargo + condición + política que se inyecta en las condiciones del servicio padre.';

grant select, insert, update on public.service_addons to authenticated;
revoke all on public.service_addons from anon;

alter table public.service_addons enable row level security;
create policy "service_addons by tenant" on public.service_addons for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());

create trigger service_addons_touch
  before update on public.service_addons
  for each row execute function public.touch_updated_at();

-- ── 4) service_price_history ─────────────────────────────────
create table if not exists public.service_price_history (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  service_key  text not null,
  monto_texto  text not null,          -- "$50/orden", "8% comisión", etc. (heterogéneo)
  moneda       text not null default 'USD',
  valid_from   date not null default current_date,
  nota         text,
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id),
  foreign key (tenant_id, service_key)
    references public.service_configs (tenant_id, service_key) on delete cascade
);

comment on table public.service_price_history is
  'Historial de precios por servicio (SDD-0076). Append-only (sin updated_at/deleted_at). Los núcleo de transporte también historizan en `rates` (valid_from/until); esto cubre add-ons y cambios de condición.';

grant select, insert on public.service_price_history to authenticated;
revoke all on public.service_price_history from anon;

alter table public.service_price_history enable row level security;
create policy "service_price_history by tenant" on public.service_price_history for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());

create index if not exists service_price_history_lookup
  on public.service_price_history (tenant_id, service_key, valid_from desc);

-- ── 5) Seed grounded ─────────────────────────────────────────
-- Vuelca el contenido ACTUAL de lib/servicios-detalle.ts (SDD-0063) para no
-- perderlo. TODO nace is_public=false → el founder decide qué publicar.
-- charge_moment / payment_methods / adicionales quedan vacíos (no existen hoy:
-- regla de oro, no se inventan). Cursos = fila base sin contenido.
insert into public.service_configs (
  tenant_id, service_key, shipment_service, title_public, description_public,
  includes_public, excludes_public, price_text, price_table, how_to_request,
  timelines_public, note_public, service_state, is_public
)
select t.id, v.service_key, v.shipment_service::public.shipment_service, v.title_public,
  v.description_public, v.includes_public, v.excludes_public, v.price_text,
  v.price_table, v.how_to_request, v.timelines_public, v.note_public, v.service_state, false
from public.tenants t
cross join (values
  (
    'puerta-a-puerta-ddp', 'puerta_a_puerta_DDP',
    $s$Puerta a puerta DDP · Pagas al llegar$s$,
    $s$Nuestro servicio principal: traemos tu mercancía de China hasta tu puerta en Venezuela, todo incluido (DDP). Consolidamos, embarcamos, nacionalizamos a nuestro nombre y entregamos — tú solo recibes y pagas cuando la carga llega.$s$,
    array[$i$Flete marítimo internacional desde China hasta Venezuela.$i$,$i$Aduana e impuestos a nuestro nombre (DDP): sin cobros sorpresa.$i$,$i$Entrega puerta a puerta — incluida hasta el casco central de la ciudad.$i$,$i$Pagas al llegar: pagas cuando la carga llega a Venezuela, no por adelantado (pueden aplicar restricciones).$i$,$i$Consolidación en nuestra bodega de Yiwu de la mercancía de tus proveedores.$i$]::text[],
    array[$e$El seguro de carga: se contrata aparte.$e$,$e$Entregas fuera del casco central de la ciudad: tienen un costo adicional.$e$]::text[],
    $s$Se calcula por volumen (CBM) y ciudad de destino. Sácalo al instante en la calculadora o pídele la cotización formal a un asesor.$s$,
    null::jsonb,
    $s$Calcula tu estimado en dtdcargo.com/calculadora, regístrate en dtdcargo.com/registro para tu Shipping Mark, o escríbenos por WhatsApp.$s$,
    $s$60 a 90 días puerta a puerta: flete interno en China + espera de la próxima salida (cada 15-21 días) + travesía marítima + aduana y entrega en Venezuela.$s$,
    $s$Es el servicio insignia de DTD; el resto de los servicios son complementarios o variantes de transporte.$s$,
    'activo'
  ),
  (
    'lcl-consolidado', 'consolidacion',
    $s$LCL Consolidado (carga compartida, con BL propio)$s$,
    $s$Una opción más económica de carga marítima compartida: tu mercancía viaja consolidada con la de otros clientes y recibes tu propio Bill of Lading. El servicio te lleva hasta la entrega de ese BL en Venezuela; de ahí en adelante haces tu trámite de aduana (o lo sumas con nosotros como servicio adicional).$s$,
    array[$i$Consolidación de tu carga en nuestra bodega de Yiwu.$i$,$i$Flete marítimo internacional de China a Venezuela.$i$,$i$Tu propio Bill of Lading, separado dentro del Bill Master del contenedor.$i$]::text[],
    array[$e$Aduana e impuestos en Venezuela: los gestionas tú, o los sumas aparte (servicio de aduana).$e$,$e$Servicios portuarios, transporte interno y demás gastos hasta el destino.$e$]::text[],
    $s$Se cotiza por volumen (CBM) con un asesor por WhatsApp.$s$,
    null::jsonb,
    $s$Escríbenos por WhatsApp para cotizar tu carga consolidada LCL.$s$,
    $s$60 a 90 días hasta que tu carga llega a Venezuela y te entregamos el Bill of Lading.$s$,
    $s$El servicio de DTD llega hasta entregarte el Bill of Lading en Venezuela; el desaduanaje es un servicio adicional opcional.$s$,
    'activo'
  ),
  (
    'fcl-bodega', 'reserva_FCL',
    $s$FCL Consolidado en Bodega (contenedor completo)$s$,
    $s$Llenamos tu contenedor completo en nuestra bodega de Yiwu con la mercancía de varios de tus proveedores. Hacemos el despacho de exportación en China y la reserva del contenedor y el flete. En Venezuela, tú manejas la recepción (o sumas nuestro servicio de aduana).$s$,
    array[$i$Recepción de la mercancía de tus distintos proveedores en la bodega de Yiwu.$i$,$i$Carga y consolidación del contenedor completo (FCL).$i$,$i$Despacho de exportación en China.$i$,$i$Reserva del contenedor y del flete.$i$,$i$Almacenaje gratis los primeros 7 días en la bodega de Yiwu.$i$]::text[],
    array[$e$Gestión en Venezuela (aduana, transporte): la manejas tú, o la sumas como servicio de aduana opcional.$e$,$e$Almacenaje después de los primeros 7 días gratis: tiene un costo adicional.$e$]::text[],
    $s$Se cotiza con un asesor por WhatsApp.$s$,
    null::jsonb,
    $s$El FCL se cotiza con un asesor (no está en la calculadora pública). Escríbenos por WhatsApp.$s$,
    $s$40 a 55 días aproximados: al ser contenedor completo, no espera la próxima salida consolidada.$s$,
    null,
    'activo'
  ),
  (
    'fcl-directo', 'reserva_FCL',
    $s$FCL Directo Fábrica (contenedor cargado en origen)$s$,
    $s$Tu contenedor completo se carga directamente en la fábrica de tu proveedor (uno o dos fabricantes), sin pasar por nuestra bodega. Hacemos la reserva del contenedor y del buque con la naviera; el Bill of Lading sale a nombre de nuestra empresa en China como shipper, contigo como consignatario — así tu proveedor no puede cambiar el destino ni desviar el contenedor.$s$,
    array[$i$Reserva del contenedor y del buque con la naviera.$i$,$i$Bill of Lading a nombre de nuestra empresa china (shipper), contigo como consignatario.$i$,$i$Coordinación de la carga en la fábrica de tu proveedor.$i$]::text[],
    array[$e$Gestión en Venezuela (aduana, transporte): la manejas tú, o la sumas como servicio de aduana opcional.$e$]::text[],
    $s$Se cotiza con un asesor por WhatsApp.$s$,
    null::jsonb,
    $s$Se cotiza con un asesor. Escríbenos por WhatsApp.$s$,
    $s$40 a 55 días aproximados: al ser contenedor completo, no espera la próxima salida consolidada.$s$,
    $s$Seguridad: al salir el BL a nuestro nombre como shipper, el proveedor no puede desviar ni cambiar el destino del contenedor.$s$,
    'activo'
  ),
  (
    'transporte-terrestre', 'transporte_terrestre',
    $s$Transporte terrestre nacional$s$,
    $s$Transporte de carga por vía terrestre dentro de Venezuela, para mover tu mercancía entre ciudades o hasta tu destino final.$s$,
    array[]::text[], array[]::text[], $s$$s$, null::jsonb, $s$$s$, $s$$s$,
    $s$Disponible próximamente.$s$,
    'proximamente'
  ),
  (
    'transito-aduana', null,
    $s$Tránsito de aduana y desaduanaje (servicio adicional)$s$,
    $s$Gestionamos el paso de tu mercancía por la aduana venezolana y su nacionalización. Es un servicio adicional opcional para las cargas LCL y FCL (en el puerta a puerta DDP ya va incluido). Tú pagas tus planillas directamente a la aduana; nosotros te representamos como tu agente con tu carta poder.$s$,
    array[$i$Gestión del paso por aduana y nacionalización de tu carga.$i$,$i$Representación ante la aduana como tu agente (con tu carta poder).$i$,$i$Documentos de importación: facturas de embarque, declaraciones, certificados y normativa.$i$]::text[],
    array[$e$El pago de las planillas de aduana e impuestos: lo pagas tú directamente a la aduana.$e$,$e$Servicios portuarios y transporte interno, que se facturan aparte.$e$]::text[],
    $s$El costo se cotiza según el valor del contenedor (por valorización de la factura). Como intervienen muchos factores, un asesor te da el aproximado por WhatsApp.$s$,
    null::jsonb,
    $s$Súmalo a tu carga LCL o FCL: escríbenos por WhatsApp con tu nombre o el de tu empresa para iniciar el trámite.$s$,
    $s$Nacionalización de 5 a 6 días hábiles.$s$,
    $s$Incluido en el servicio puerta a puerta DDP; opcional (adicional) en LCL y FCL.$s$,
    'activo'
  ),
  (
    'documentos-importacion', null,
    $s$Documentos de importación$s$,
    $s$Elaboramos, revisamos y tramitamos la documentación de tu importación: facturas de embarque, declaraciones, certificados y requerimientos normativos. Va de la mano del servicio de aduana.$s$,
    array[$i$Elaboración y revisión de facturas de embarque, declaraciones y certificados.$i$,$i$Gestión de los requerimientos normativos de importación.$i$]::text[],
    array[]::text[],
    $s$$s$, null::jsonb,
    $s$Va dentro del servicio de aduana. Escríbenos por WhatsApp.$s$,
    $s$$s$,
    $s$Forma parte del servicio de aduana; no se contrata por separado.$s$,
    'activo'
  ),
  (
    'revision-recepcion', null,
    $s$Revisión de mercancía al recibir$s$,
    $s$A pedido, al recibir tu mercancía en la bodega de Yiwu abrimos las cajas, revisamos la mercancía y verificamos que la cantidad coincida con tu factura. Por defecto no abrimos las cajas; este es un servicio adicional. Te entregamos un reporte con fotos.$s$,
    array[$i$Apertura y revisión de las cajas al recibir.$i$,$i$Conteo y chequeo de la cantidad recibida contra tu factura.$i$,$i$Reporte con fotos.$i$]::text[],
    array[]::text[],
    $s$$s$, null::jsonb,
    $s$Pídelo por WhatsApp antes de que tu mercancía llegue a la bodega.$s$,
    $s$$s$,
    $s$Servicio de recepción en bodega — distinto de la inspección de calidad en fábrica.$s$,
    'activo'
  ),
  (
    'etiquetado-piezas', null,
    $s$Etiquetado por pieza$s$,
    $s$Etiquetamos y marcamos tus piezas en la bodega de Yiwu según tus requerimientos o la normativa de destino. Se cobra por pieza. Te entregamos un reporte con fotos.$s$,
    array[$i$Etiquetado y marcado de las piezas en bodega.$i$,$i$Reporte con fotos.$i$]::text[],
    array[]::text[],
    $s$$s$, null::jsonb,
    $s$Pídelo por WhatsApp e indícanos el etiquetado que necesitas.$s$,
    $s$$s$, null,
    'activo'
  ),
  (
    'reempaque-defectuosas', null,
    $s$Cajas defectuosas y reempaque$s$,
    $s$Cuando una caja llega defectuosa a la bodega, la reempacamos para que tu mercancía viaje protegida. Te entregamos un reporte con fotos.$s$,
    array[$i$Reempaque de las cajas que llegan defectuosas.$i$,$i$Reporte con fotos.$i$]::text[],
    array[]::text[],
    $s$$s$, null::jsonb,
    $s$Lo gestionamos al recibir tu mercancía; te avisamos si hace falta. Escríbenos por WhatsApp.$s$,
    $s$$s$, null,
    'activo'
  ),
  (
    'inspeccion-calidad', null,
    $s$Inspección de calidad$s$,
    $s$Verificación física de tu mercancía contra la ficha técnica, en la fábrica y antes del embarque. Parte de nuestra línea completa de inspección de calidad en China.$s$,
    array[$i$Verificación física del producto contra la ficha técnica.$i$,$i$Inspección pre-embarque en la fábrica.$i$]::text[],
    array[]::text[],
    $s$$s$, null::jsonb,
    $s$Conoce el detalle en /servicios/inspeccion y solicita tu cotización por WhatsApp; un asesor te pasa los servicios de inspección y un ejemplo del reporte.$s$,
    $s$$s$,
    $s$Precios de inspección: los confirma un asesor (no se publican aún).$s$,
    'activo'
  ),
  (
    'verificacion-proveedores', null,
    $s$Verificación de proveedores$s$,
    $s$Validamos proveedores y fábricas en China para que compres seguro: auditoría de legitimidad (validez legal, capacidad, instalaciones) e inspección pre-producción y pre-embarque.$s$,
    array[$i$Auditoría de legitimidad del proveedor (validez legal, capacidad, instalaciones).$i$,$i$Inspección pre-producción y pre-embarque.$i$]::text[],
    array[]::text[],
    $s$$s$, null::jsonb,
    $s$Escríbenos por WhatsApp con los datos de tu proveedor; un asesor te pasa los servicios con sus precios y un ejemplo del reporte.$s$,
    $s$$s$, null,
    'activo'
  ),
  (
    'auditoria-calidad', null,
    $s$Auditoría y control de calidad$s$,
    $s$Auditorías de fábrica online o presenciales y control de calidad bajo estándares internacionales, ejecutadas por nuestro equipo en China.$s$,
    array[]::text[], array[]::text[], $s$$s$, null::jsonb,
    $s$Conoce el detalle en /servicios/inspeccion y cotiza por WhatsApp.$s$,
    $s$$s$, null,
    'activo'
  ),
  (
    'lab-permisologia', null,
    $s$Lab testing y permisología en China$s$,
    $s$Coordinamos pruebas de laboratorio (RoHS, CE, FDA y otros, según el mercado de destino) y la gestión de permisos requeridos para exportación.$s$,
    array[]::text[], array[]::text[], $s$$s$, null::jsonb,
    $s$Cotiza por WhatsApp indicando tu producto y mercado de destino.$s$,
    $s$$s$, null,
    'activo'
  ),
  (
    'compra-asistida', null,
    $s$Compra asistida / sourcing$s$,
    $s$Somos tu departamento de compras en China, en dos modalidades: sourcing completo —te conseguimos el proveedor, negociamos y gestionamos la compra— o sobre tu propio proveedor —si ya lo tienes pero temes que te estafen, lo verificamos y gestionamos la compra como tu comprador de confianza—. En ambas, la verificación del proveedor va incluida y te acompañamos hasta que la compra se completa.$s$,
    array[$i$Modalidad A (sourcing): ubicamos el producto y el proveedor, negociamos y gestionamos la compra por ti.$i$,$i$Modalidad B (tu proveedor): si ya tienes proveedor y precios, lo verificamos y gestionamos la compra entrando como tu comprador de confianza.$i$,$i$En ambas: verificación del proveedor incluida y seguimiento hasta que la compra se completa.$i$]::text[],
    array[$e$El pago al proveedor: es un servicio adicional. Si quieres que paguemos por ti, primero nos pagas a nosotros.$e$,$e$El costo de la mercancía: lo pagas tú.$e$,$e$Los fletes internacionales.$e$,$e$Los fletes nacionales.$e$]::text[],
    $s$La comisión baja a medida que sube el monto de tu compra; mínimo $50 por orden, con la verificación del proveedor incluida.$s$,
    $json${"columnas":["Monto (USD)","A · sourcing","B · tu proveedor"],"filas":[["hasta $2.000","10%","5%"],["~$5.000","8%","4%"],["~$10.000","6%","3%"],["~$20.000","5%","2,5%"],["~$50.000","4%","2%"],["$100.000+","3%","1,5%"]],"nota":"Mínimo $50 por orden. La verificación del proveedor va incluida en ambas modalidades."}$json$::jsonb,
    $s$Mándanos tu lista de productos con su ficha técnica por WhatsApp; un asesor te confirma viabilidad, modalidad y costo.$s$,
    $s$Modalidad A: desde que nos pasas el producto con su ficha técnica, mínimo 1 semana para confirmarte el producto y hasta 15 días para sondear varios proveedores, verificar las especificaciones técnicas y validar que las fuentes sean buenas. Modalidad B: la misma ventana, normalmente más rápido porque verificamos un proveedor que ya tienes.$s$,
    $s$El servicio llega hasta completar la compra y verificar que todo salga bien; lo que viene después —consolidación, flete, aduana y entrega— son servicios complementarios.$s$,
    'activo'
  ),
  (
    'asesoria-pagos', null,
    $s$Asesoría en pagos a proveedores$s$,
    $s$Facilitamos transacciones seguras a tus proveedores chinos (Yuan vía Alipay, WeChat Pay, transferencia o efectivo en China), para que pagues con respaldo.$s$,
    array[]::text[], array[]::text[], $s$$s$, null::jsonb,
    $s$Escríbenos por WhatsApp y un asesor te orienta de forma segura.$s$,
    $s$$s$, null,
    'activo'
  ),
  (
    'muestras-courier', null,
    $s$Envío de muestras y documentos (courier express)$s$,
    $s$Envíos urgentes por DHL, UPS o FedEx desde Yiwu para muestras pre-producción, documentos y lotes pequeños críticos.$s$,
    array[$i$Courier express de muestras, documentos y paquetes pequeños desde China.$i$]::text[],
    array[$e$No es flete aéreo de carga: la carga grande va por vía marítima (LCL/FCL). El aéreo de carga está temporalmente suspendido.$e$]::text[],
    $s$$s$, null::jsonb,
    $s$Escríbenos por WhatsApp con qué necesitas enviar y a dónde.$s$,
    $s$$s$,
    $s$Courier de muestras y documentos: activo. Distinto del flete aéreo de carga (suspendido).$s$,
    'activo'
  ),
  (
    'visado-chino', null,
    $s$Gestión de visado de negocios chino$s$,
    $s$Asesoría documental, diligencia de formularios, coordinación con el consulado y toma de fotografía en nuestras oficinas. Todo el trámite desde Valencia: no necesitas ir a China.$s$,
    array[$i$Asesoría documental y diligencia de formularios.$i$,$i$Coordinación con el consulado.$i$,$i$Toma de fotografía en nuestras oficinas de Valencia.$i$]::text[],
    array[]::text[],
    $s$$s$, null::jsonb,
    $s$Escríbenos por WhatsApp para agendar y conocer los requisitos.$s$,
    $s$$s$, null,
    'activo'
  ),
  (
    'registro-marca-cn', null,
    $s$Registro de marca en China (CNIPA)$s$,
    $s$Protección de tu propiedad intelectual ante las autoridades chinas (CNIPA). Preparamos documentos, traducciones y asesoría estratégica desde Venezuela, y coordinamos internamente la gestión legal en China.$s$,
    array[$i$Preparación de documentos y traducciones.$i$,$i$Asesoría estratégica y seguimiento del trámite desde Venezuela.$i$,$i$Coordinación de la gestión legal ante CNIPA en China.$i$]::text[],
    array[]::text[],
    $s$$s$, null::jsonb,
    $s$Escríbenos por WhatsApp con tu marca y rubro.$s$,
    $s$$s$, null,
    'activo'
  ),
  (
    'cursos-importacion', null,
    $s$Cursos de importación$s$,
    $s$$s$,
    array[]::text[], array[]::text[], $s$$s$, null::jsonb, $s$$s$, $s$$s$,
    $s$En desarrollo — atado al curso de importación (coordinación aparte).$s$,
    'proximamente'
  )
) as v(
  service_key, shipment_service, title_public, description_public, includes_public,
  excludes_public, price_text, price_table, how_to_request, timelines_public,
  note_public, service_state
)
where t.slug = 'dtd'
on conflict (tenant_id, service_key) do nothing;

-- ── 6) RPCs públicas (anon, security definer, whitelist de columnas) ──
drop function if exists public.public_servicios();
create or replace function public.public_servicios()
returns table (
  service_key text, shipment_service public.shipment_service, title_public text,
  description_public text, includes_public text[], excludes_public text[],
  price_text text, price_table jsonb, charge_moment text, payment_methods text[],
  how_to_request text, timelines_public text, note_public text,
  condiciones_politicas text, service_state text
)
language sql stable security definer set search_path = public as $$
  select sc.service_key, sc.shipment_service, sc.title_public, sc.description_public,
         sc.includes_public, sc.excludes_public, sc.price_text, sc.price_table,
         sc.charge_moment, sc.payment_methods, sc.how_to_request, sc.timelines_public,
         sc.note_public, sc.condiciones_politicas, sc.service_state
  from public.service_configs sc
  join public.tenants t on t.id = sc.tenant_id
  where t.slug = 'dtd' and sc.is_public = true and sc.deleted_at is null;
$$;

comment on function public.public_servicios() is
  'Endpoint público (anon) de los servicios publicados del tenant dtd (SDD-0076 Fase 3). Whitelist de columnas: NO proyecta notes_internal/internal_price_ref/mapeo_contable. Par de public_service_faqs(). Patrón de public_calculator_config().';

revoke all on function public.public_servicios() from public;
grant execute on function public.public_servicios() to anon, authenticated;

drop function if exists public.public_service_faqs();
create or replace function public.public_service_faqs()
returns table (service_key text, question text, answer text, sort_order integer)
language sql stable security definer set search_path = public as $$
  select f.service_key, f.question, f.answer, f.sort_order
  from public.service_faqs f
  join public.tenants t on t.id = f.tenant_id
  where t.slug = 'dtd' and f.audience = 'public' and f.is_public = true and f.deleted_at is null
  order by f.service_key, f.sort_order;
$$;

comment on function public.public_service_faqs() is
  'Endpoint público (anon) de las FAQ públicas publicadas (SDD-0076). Solo audience=public AND is_public. Las FAQ internas nunca salen.';

revoke all on function public.public_service_faqs() from public;
grant execute on function public.public_service_faqs() to anon, authenticated;
