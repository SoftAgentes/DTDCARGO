-- ============================================================================
-- 0332 · SDD-0237 — Siembra del tarifario de Benito y los 178 destinos
-- ============================================================================
-- SDD-0236 dejó las tablas `freight_carriers` y `carrier_tariffs` construidas y
-- aplicadas (migración 0330), pero VACÍAS: `public_carrier_tariffs()` devolvía
-- 0 filas y la calculadora pública seguía cobrando `max(0, km - 200) x $1`, una
-- fórmula que no corresponde a ningún modelo real.
--
-- Esta migración mete los datos y con eso se apaga la fórmula por kilómetro.
--
-- DE DÓNDE SALEN LOS NÚMEROS. Del formulario que **Benito Transporte Express,
-- C.A** (RIF J-50266334-7) confirmó por escrito el 31-jul-2026, firmado por
-- Mariotsy Mendoza, Gerente General. Ficha completa con trazabilidad en
-- `docs/operaciones/transporte-nacional/benito-transporte-express.md`.
--
-- POR QUÉ LA VENTA NO SALE DEL COSTO. `cost_usd_cbm` es lo que le pagamos;
-- `price_usd_cbm` es lo que cobramos. La venta salió de la PRIMERA oferta de
-- Benito en pie cúbico ($3,00 / $3,50 / $5,00 x 35,3147) y se sostiene aunque
-- el costo suba. Es un seguro, no un margen (SDD-0236). Recalcularla como
-- `costo x (1 + margen)` rompe la decisión del founder.
--
-- LA ZONA SIN COSTO NO ES UNA TARIFA EN $0. Las 8 ciudades donde el cliente no
-- paga entrega (Valencia, Naguanagua, San Diego, Guacara, Maracay, Caracas,
-- Barquisimeto, Acarigua) guardan su tarifa REAL acá — DTD sí le paga ese tramo
-- al fletero. Lo que hace que el cliente vea $0 es `calculator_cities.casco`,
-- que ya existía. Así el ERP no pierde de vista lo que cuesta esa adquisición
-- de clientes.
--
-- IDEMPOTENTE. Se puede correr dos veces sin duplicar nada. `km` NO se pisa en
-- las ciudades que ya existían: sus distancias reales siguen alimentando el
-- copy de `lib/geo-zonas.ts` aunque ya no fijen precio.
--
-- Aditiva. Sin DDL. Sin borrado duro.
-- ============================================================================

do $$
declare
  v_tenant  uuid;
  v_carrier uuid;
  v_ciudades int;
  v_tarifas  int;
begin
  select id into v_tenant from public.tenants where slug = 'dtd';
  if v_tenant is null then
    raise notice '0332: no existe el tenant dtd — nada que sembrar';
    return;
  end if;

  -- ───────────────────────────────────────────────────────────
  -- 1. El transportista predeterminado
  -- ───────────────────────────────────────────────────────────
  -- El índice único parcial `freight_carriers_one_default_per_tenant` garantiza
  -- que sólo haya UNO vivo por tenant, así que si el founder ya lo cargó a mano
  -- desde el Admin, acá lo reusamos en vez de chocar.
  select id into v_carrier
    from public.freight_carriers
   where tenant_id = v_tenant
     and deleted_at is null
     and (is_default or lower(name) like 'benito%')
   order by is_default desc
   limit 1;

  if v_carrier is null then
    insert into public.freight_carriers
      (tenant_id, name, legal_name, tax_id, contact, notes, is_default, active)
    values (
      v_tenant,
      'Benito',
      'BENITO TRANSPORTE EXPRESS, C.A',
      'J-50266334-7',
      'Mariotsy Mendoza · Gerente General',
      'Proveedor n.º 1 del transporte terrestre nacional. Tarifario confirmado '
      'por escrito el 31-jul-2026. Salidas desde Valencia. Cobra por CBM, sin '
      'mínimo por despacho y sin cargos aparte (ni seguro, ni IVA, ni manejo, '
      'ni estiba, ni entrega a domicilio). Pago en efectivo en dólares, todos '
      'los viernes. Vigencia hasta nuevo aviso, con 1 semana de aviso previo '
      'si sube.',
      true,
      true
    )
    returning id into v_carrier;
  end if;

  -- ───────────────────────────────────────────────────────────
  -- 2. Los 178 destinos del selector público
  -- ───────────────────────────────────────────────────────────
  -- Las 9 sin cobertura también entran: el cliente tiene que poder escoger su
  -- ciudad y que le digamos "no llegamos hasta ahí, pero sí hasta X". Se
  -- reconocen porque NO tienen fila en carrier_tariffs.
  with entrada (slug, label, casco, sort_order) as (
    values
  ('acarigua', 'Acarigua', true, 0),
  ('barquisimeto', 'Barquisimeto', true, 1),
  ('caracas', 'Caracas', true, 2),
  ('guacara', 'Guacara', true, 3),
  ('maracay', 'Maracay', true, 4),
  ('naguanagua', 'Naguanagua', true, 5),
  ('san-diego', 'San Diego', true, 6),
  ('valencia', 'Valencia (sede)', true, 7),
  ('abejales', 'Abejales', false, 8),
  ('achaguas', 'Achaguas', false, 9),
  ('anaco', 'Anaco', false, 10),
  ('araure', 'Araure', false, 11),
  ('bailadores', 'Bailadores', false, 12),
  ('barbacoa', 'Barbacoa', false, 13),
  ('barcelona', 'Barcelona', false, 14),
  ('barinas', 'Barinas', false, 15),
  ('barinitas', 'Barinitas', false, 16),
  ('bejuma', 'Bejuma', false, 17),
  ('biruaca', 'Biruaca', false, 18),
  ('biscucuy', 'Biscucuy', false, 19),
  ('boca-de-aroa', 'Boca de Aroa', false, 20),
  ('boca-de-uchire', 'Boca de Uchire', false, 21),
  ('bocono', 'Boconó', false, 22),
  ('cabimas', 'Cabimas', false, 23),
  ('cabudare', 'Cabudare', false, 24),
  ('cagua', 'Cagua', false, 25),
  ('caja-seca', 'Caja Seca', false, 26),
  ('calabozo', 'Calabozo', false, 27),
  ('camaguan', 'Camaguán', false, 28),
  ('camatagua', 'Camatagua', false, 29),
  ('cantaura', 'Cantaura', false, 30),
  ('caraballeda', 'Caraballeda', false, 31),
  ('carayaca', 'Carayaca', false, 32),
  ('cariaco', 'Cariaco', false, 33),
  ('caripe', 'Caripe', false, 34),
  ('caripito', 'Caripito', false, 35),
  ('carora', 'Carora', false, 36),
  ('carrizal', 'Carrizal', false, 37),
  ('carupano', 'Carúpano', false, 38),
  ('catia-la-mar', 'Catia La Mar', false, 39),
  ('chabasquen', 'Chabasquén', false, 40),
  ('chaguaramas', 'Chaguaramas', false, 41),
  ('charallave', 'Charallave', false, 42),
  ('chichiriviche', 'Chichiriviche', false, 43),
  ('chivacoa', 'Chivacoa', false, 44),
  ('ciudad-bolivia', 'Ciudad Bolivia', false, 45),
  ('ciudad-bolivar', 'Ciudad Bolívar', false, 46),
  ('ciudad-ojeda', 'Ciudad Ojeda', false, 47),
  ('clarines', 'Clarines', false, 48),
  ('coloncito', 'Coloncito', false, 49),
  ('colonia-tovar', 'Colonia Tovar', false, 50),
  ('coro', 'Coro', false, 51),
  ('cumanacoa', 'Cumanacoa', false, 52),
  ('cumana', 'Cumaná', false, 53),
  ('cumarebo', 'Cumarebo', false, 54),
  ('cua', 'Cúa', false, 55),
  ('dabajuro', 'Dabajuro', false, 56),
  ('dividive', 'Dividive', false, 57),
  ('duaca', 'Duaca', false, 58),
  ('ejido', 'Ejido', false, 59),
  ('el-callao', 'El Callao', false, 60),
  ('el-dorado', 'El Dorado', false, 61),
  ('el-manteco', 'El Manteco', false, 62),
  ('el-nula', 'El Nula', false, 63),
  ('el-pilar', 'El Pilar', false, 64),
  ('el-pinal', 'El Piñal', false, 65),
  ('el-socorro', 'El Socorro', false, 66),
  ('el-sombrero', 'El Sombrero', false, 67),
  ('el-tigre', 'El Tigre', false, 68),
  ('el-tigrito', 'El Tigrito', false, 69),
  ('el-tocuyo', 'El Tocuyo', false, 70),
  ('el-venado', 'El Venado', false, 71),
  ('el-vigia', 'El Vigía', false, 72),
  ('elorza', 'Elorza', false, 73),
  ('flor-de-patria', 'Flor de Patria', false, 74),
  ('guanare', 'Guanare', false, 75),
  ('guanarito', 'Guanarito', false, 76),
  ('guanta', 'Guanta', false, 77),
  ('guarenas', 'Guarenas', false, 78),
  ('guasdualito', 'Guasdualito', false, 79),
  ('guasipati', 'Guasipati', false, 80),
  ('guatire', 'Guatire', false, 81),
  ('guiria', 'Güiria', false, 82),
  ('higuerote', 'Higuerote', false, 83),
  ('margarita', 'Isla Margarita', false, 84),
  ('km-88', 'KM 88', false, 85),
  ('la-concordia', 'La Concordia', false, 86),
  ('la-fria', 'La Fría', false, 87),
  ('la-grita', 'La Grita', false, 88),
  ('la-guaira', 'La Guaira', false, 89),
  ('la-miel', 'La Miel', false, 90),
  ('la-tendida', 'La Tendida', false, 91),
  ('la-vela', 'La Vela', false, 92),
  ('la-victoria', 'La Victoria', false, 93),
  ('la-villa-aragua', 'La Villa (Aragua)', false, 94),
  ('la-villa-zulia', 'La Villa (Zulia)', false, 95),
  ('lagunillas', 'Lagunillas', false, 96),
  ('las-mercedes', 'Las Mercedes', false, 97),
  ('libertad', 'Libertad', false, 98),
  ('los-llanitos-de-tabay', 'Los Llanitos de Tabay', false, 99),
  ('los-teques', 'Los Teques', false, 100),
  ('machiques', 'Machiques', false, 101),
  ('maiquetia', 'Maiquetía', false, 102),
  ('maracaibo', 'Maracaibo', false, 103),
  ('maturin', 'Maturín', false, 104),
  ('michelena', 'Michelena', false, 105),
  ('miranda', 'Miranda', false, 106),
  ('mirimire', 'Mirimire', false, 107),
  ('montalban', 'Montalbán', false, 108),
  ('moron', 'Morón', false, 109),
  ('mucuchies', 'Mucuchíes', false, 110),
  ('merida', 'Mérida', false, 111),
  ('naranjales', 'Naranjales', false, 112),
  ('nirgua', 'Nirgua', false, 113),
  ('nueva-bolivia', 'Nueva Bolivia', false, 114),
  ('ocumare-del-tuy', 'Ocumare del Tuy', false, 115),
  ('ospino', 'Ospino', false, 116),
  ('pampanito', 'Pampanito', false, 117),
  ('pampan', 'Pampán', false, 118),
  ('pariaguan', 'Pariaguán', false, 119),
  ('pedraza', 'Pedraza', false, 120),
  ('pueblo-llano', 'Pueblo Llano', false, 121),
  ('puerto-cabello', 'Puerto Cabello', false, 122),
  ('puerto-la-cruz', 'Puerto La Cruz', false, 123),
  ('puerto-ordaz', 'Puerto Ordaz', false, 124),
  ('puerto-piritu', 'Puerto Píritu', false, 125),
  ('punta-de-mata', 'Punta de Mata', false, 126),
  ('punto-fijo', 'Punto Fijo', false, 127),
  ('quibor', 'Quíbor', false, 128),
  ('rubio', 'Rubio', false, 129),
  ('sabana-de-mendoza', 'Sabana de Mendoza', false, 130),
  ('sabana-de-parra', 'Sabana de Parra', false, 131),
  ('sabaneta', 'Sabaneta', false, 132),
  ('san-antonio', 'San Antonio', false, 133),
  ('san-antonio-del-golfo', 'San Antonio del Golfo', false, 134),
  ('san-carlos', 'San Carlos', false, 135),
  ('san-cristobal', 'San Cristóbal', false, 136),
  ('san-felipe', 'San Felipe', false, 137),
  ('san-fernando', 'San Fernando de Apure', false, 138),
  ('san-felix', 'San Félix', false, 139),
  ('san-juan-de-los-morros', 'San Juan de los Morros', false, 140),
  ('san-rafael-de-onoto', 'San Rafael de Onoto', false, 141),
  ('sanare', 'Sanare', false, 142),
  ('santa-barbara', 'Santa Bárbara', false, 143),
  ('santa-barbara-de-barinas', 'Santa Bárbara de Barinas', false, 144),
  ('santa-cruz-de-mora', 'Santa Cruz de Mora', false, 145),
  ('santa-elena-de-uairen', 'Santa Elena de Uairén', false, 146),
  ('santa-lucia', 'Santa Lucía', false, 147),
  ('santa-maria-de-ipire', 'Santa María de Ipire', false, 148),
  ('santa-rita', 'Santa Rita', false, 149),
  ('santa-teresa-del-tuy', 'Santa Teresa del Tuy', false, 150),
  ('santo-domingo', 'Santo Domingo', false, 151),
  ('sarare', 'Sarare', false, 152),
  ('socopo', 'Socopó', false, 153),
  ('soledad', 'Soledad', false, 154),
  ('tabay', 'Tabay', false, 155),
  ('tejerias', 'Tejerías', false, 156),
  ('temblador', 'Temblador', false, 157),
  ('timotes', 'Timotes', false, 158),
  ('tinaco', 'Tinaco', false, 159),
  ('tinaquillo', 'Tinaquillo', false, 160),
  ('tocuyito', 'Tocuyito', false, 161),
  ('tovar', 'Tovar', false, 162),
  ('tucacas', 'Tucacas', false, 163),
  ('tucani', 'Tucaní', false, 164),
  ('tucupido', 'Tucupido', false, 165),
  ('tucupita', 'Tucupita', false, 166),
  ('tumeremo', 'Tumeremo', false, 167),
  ('turmero', 'Turmero', false, 168),
  ('turen', 'Turén', false, 169),
  ('tariba', 'Táriba', false, 170),
  ('upata', 'Upata', false, 171),
  ('valera', 'Valera', false, 172),
  ('valle-de-la-pascua', 'Valle de la Pascua', false, 173),
  ('yaracal', 'Yaracal', false, 174),
  ('yaritagua', 'Yaritagua', false, 175),
  ('zaraza', 'Zaraza', false, 176),
  ('zea', 'Zea', false, 177)
  )
  insert into public.calculator_cities (tenant_id, slug, label, casco, sort_order)
  select v_tenant, e.slug, e.label, e.casco, e.sort_order from entrada e
  on conflict (tenant_id, slug) where deleted_at is null
  do update set
    label      = excluded.label,
    casco      = excluded.casco,
    sort_order = excluded.sort_order,
    updated_at = now();
  get diagnostics v_ciudades = row_count;

  -- La opción agrupada muere: el cliente escoge SU ciudad y el sistema decide
  -- (founder, 1-ago-2026). Al quitarla, la preseleccionada cae sola a la
  -- primera de la lista, que es Valencia.
  update public.calculator_cities
     set deleted_at = now(), updated_at = now()
   where tenant_id = v_tenant
     and slug = 'casco-central'
     and deleted_at is null;

  -- ───────────────────────────────────────────────────────────
  -- 3. El tarifario (169 destinos cubiertos)
  -- ───────────────────────────────────────────────────────────
  -- min_charge_usd va NULL a propósito: Benito confirmó por escrito que no hay
  -- mínimo por despacho — "no aplica al método de cobro utilizado".
  with entrada (
    city_slug, cost_usd_cbm, price_usd_cbm, price_usd_ft3,
    dispatch_frequency_days, departure_frequency, transit_days
  ) as (
    values
  ('acarigua', 80.00, 123.60, 3.5000, 3, '2 veces por semana · lunes y miércoles', '24 a 72 horas'),
  ('barquisimeto', 70.00, 105.94, 3.0000, 2, '3 veces por semana · lunes, miércoles y viernes', '24 a 72 horas'),
  ('caracas', 70.00, 105.94, 3.0000, 3, '2 veces por semana · lunes y miércoles', '24 a 72 horas'),
  ('guacara', 70.00, 105.94, 3.0000, 2, '3 veces por semana · lunes, miércoles y viernes', '24 a 72 horas'),
  ('maracay', 70.00, 105.94, 3.0000, 1, 'Todos los días', 'Mismo día'),
  ('naguanagua', 70.00, 105.94, 3.0000, 2, '3 veces por semana · lunes, miércoles y viernes', '24 a 72 horas'),
  ('san-diego', 70.00, 105.94, 3.0000, 2, '3 veces por semana · lunes, miércoles y viernes', '24 a 72 horas'),
  ('valencia', 70.00, 105.94, 3.0000, 1, 'Todos los días', 'Mismo día'),
  ('abejales', 80.00, 123.60, 3.5000, 7, '1 vez por semana', '48 a 72 horas'),
  ('achaguas', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '48 a 72 horas'),
  ('anaco', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '24 a 48 horas'),
  ('araure', 80.00, 123.60, 3.5000, 3, '2 veces por semana · lunes y miércoles', '24 a 72 horas'),
  ('bailadores', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '48 a 72 horas'),
  ('barbacoa', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '48 a 72 horas'),
  ('barcelona', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '24 a 48 horas'),
  ('barinas', 80.00, 123.60, 3.5000, 3, '2 veces por semana · lunes y miércoles', '24 a 72 horas'),
  ('barinitas', 80.00, 123.60, 3.5000, 7, '1 vez por semana', '24 a 72 horas'),
  ('bejuma', 70.00, 105.94, 3.0000, 2, '3 veces por semana · lunes, miércoles y viernes', '24 a 72 horas'),
  ('biruaca', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '48 a 72 horas'),
  ('biscucuy', 80.00, 123.60, 3.5000, 7, '1 vez por semana', '24 a 72 horas'),
  ('boca-de-aroa', 80.00, 123.60, 3.5000, 3, '2 veces por semana · lunes y miércoles', '24 a 72 horas'),
  ('boca-de-uchire', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '24 a 48 horas'),
  ('bocono', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '48 a 72 horas'),
  ('cabimas', 80.00, 123.60, 3.5000, 7, '1 vez por semana', '24 a 48 horas'),
  ('cabudare', 70.00, 105.94, 3.0000, 2, '3 veces por semana', '24 a 48 horas'),
  ('cagua', 70.00, 105.94, 3.0000, 1, 'Todos los días', 'Mismo día'),
  ('caja-seca', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '48 a 72 horas'),
  ('calabozo', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '48 a 72 horas'),
  ('camaguan', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '48 a 72 horas'),
  ('camatagua', 70.00, 105.94, 3.0000, 15, '1 vez cada 15 días', 'con zonas especiales de despachos'),
  ('cantaura', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '24 a 48 horas'),
  ('caraballeda', 70.00, 105.94, 3.0000, 3, '2 veces por semana · miércoles y viernes', '24 a 48 horas'),
  ('carayaca', 70.00, 105.94, 3.0000, 3, '2 veces por semana · miércoles y viernes', '24 a 48 horas'),
  ('caripe', 80.00, 123.60, 3.5000, 15, '1 vez cada 15 días', 'zona especial de despacho'),
  ('caripito', 80.00, 123.60, 3.5000, 15, '1 vez cada 15 días', 'zona especial de despacho'),
  ('carora', 70.00, 105.94, 3.0000, 7, '1 vez por semana', 'los viernes'),
  ('carrizal', 70.00, 105.94, 3.0000, 2, '3 veces por semana · lunes, miércoles y viernes', '24 a 72 horas'),
  ('carupano', 80.00, 176.57, 5.0000, 7, '1 vez por semana', '48 a 72 horas'),
  ('catia-la-mar', 70.00, 105.94, 3.0000, 3, '2 veces por semana · miércoles y viernes', '24 a 48 horas'),
  ('chabasquen', 80.00, 123.60, 3.5000, 7, '1 vez por semana', '24 a 72 horas'),
  ('chaguaramas', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '48 a 72 horas'),
  ('charallave', 70.00, 105.94, 3.0000, 3, '2 veces por semana · martes y jueves', '24 a 72 horas'),
  ('chichiriviche', 80.00, 123.60, 3.5000, 7, '1 vez por semana', '24 a 48 horas'),
  ('chivacoa', 70.00, 105.94, 3.0000, 2, '3 veces por semana · lunes, miércoles y viernes', '24 a 72 horas'),
  ('ciudad-bolivia', 80.00, 123.60, 3.5000, 7, '1 vez por semana', '24 a 72 horas'),
  ('ciudad-bolivar', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '24 a 48 horas'),
  ('ciudad-ojeda', 80.00, 123.60, 3.5000, 7, '1 vez por semana', '24 a 48 horas'),
  ('clarines', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '24 a 48 horas'),
  ('coloncito', 80.00, 123.60, 3.5000, 7, '1 vez por semana', '48 a 72 horas'),
  ('colonia-tovar', 70.00, 105.94, 3.0000, 7, '1 vez por semana', '24 a 72 horas'),
  ('coro', 80.00, 123.60, 3.5000, 3, '2 veces por semana · lunes y miércoles', '24 a 72 horas'),
  ('cumana', 80.00, 123.60, 3.5000, 7, '1 vez por semana · martes', '48 a 72 horas'),
  ('cumarebo', 80.00, 123.60, 3.5000, 3, '2 veces por semana · lunes y miércoles', '24 a 72 horas'),
  ('cua', 70.00, 105.94, 3.0000, 3, '2 veces por semana · martes y jueves', '24 a 72 horas'),
  ('dabajuro', 80.00, 123.60, 3.5000, 15, '1 vez cada 15 días', 'zona especial de despacho'),
  ('dividive', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '48 a 72 horas'),
  ('duaca', 70.00, 105.94, 3.0000, 3, '2 veces por semana', '24 a 48 horas'),
  ('ejido', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '48 a 72 horas'),
  ('el-nula', 80.00, 123.60, 3.5000, 15, '1 vez cada 15 días', '48 a 72 horas'),
  ('el-pinal', 80.00, 123.60, 3.5000, 7, '1 vez por semana', '48 a 72 horas'),
  ('el-socorro', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '48 a 72 horas'),
  ('el-sombrero', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '48 a 72 horas'),
  ('el-tigre', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '24 a 48 horas'),
  ('el-tigrito', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '24 a 48 horas'),
  ('el-tocuyo', 70.00, 105.94, 3.0000, 7, '1 vez por semana', 'los viernes'),
  ('el-venado', 80.00, 123.60, 3.5000, 15, '1 vez cada 15 días', '24 a 48 horas'),
  ('el-vigia', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '48 a 72 horas'),
  ('elorza', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '48 a 72 horas'),
  ('flor-de-patria', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '48 a 72 horas'),
  ('guanare', 80.00, 123.60, 3.5000, 3, '2 veces por semana · lunes y miércoles', '24 a 72 horas'),
  ('guanarito', 80.00, 123.60, 3.5000, 7, '1 vez por semana', '24 a 72 horas'),
  ('guanta', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '24 a 48 horas'),
  ('guarenas', 70.00, 105.94, 3.0000, 3, '2 veces por semana · lunes y miércoles', '24 a 72 horas'),
  ('guasdualito', 80.00, 123.60, 3.5000, 15, '1 vez cada 15 días', 'zona especial de entrega'),
  ('guasipati', 80.00, 123.60, 3.5000, 15, '1 vez cada 15 días', '24 a 72 horas'),
  ('guatire', 70.00, 105.94, 3.0000, 3, '2 veces por semana · lunes y miércoles', '24 a 72 horas'),
  ('higuerote', 70.00, 105.94, 3.0000, 7, '1 vez por semana', '24 a 72 horas'),
  ('margarita', 80.00, 176.57, 5.0000, 7, '1 vez por semana · martes', '48 a 72 horas'),
  ('la-concordia', 80.00, 123.60, 3.5000, 3, '2 veces por semana · lunes y miércoles', '24 a 72 horas'),
  ('la-fria', 80.00, 123.60, 3.5000, 7, '1 vez por semana', '48 a 72 horas'),
  ('la-grita', 80.00, 123.60, 3.5000, 7, '1 vez por semana', '48 a 72 horas'),
  ('la-guaira', 70.00, 105.94, 3.0000, 3, '2 veces por semana · miércoles y viernes', '24 a 48 horas'),
  ('la-miel', 70.00, 105.94, 3.0000, 7, '1 vez por semana', 'los viernes'),
  ('la-tendida', 80.00, 123.60, 3.5000, 7, '1 vez por semana', '48 a 72 horas'),
  ('la-vela', 80.00, 123.60, 3.5000, 3, '2 veces por semana · lunes y miércoles', '24 a 72 horas'),
  ('la-victoria', 70.00, 105.94, 3.0000, 2, '3 veces por semana · lunes, miércoles y viernes', '24 a 72 horas'),
  ('la-villa-aragua', 70.00, 105.94, 3.0000, 2, '3 veces por semana · lunes, miércoles y viernes', '24 a 72 horas'),
  ('la-villa-zulia', 80.00, 123.60, 3.5000, 15, '1 vez cada 15 días', '24 a 72 horas'),
  ('lagunillas', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '48 a 72 horas'),
  ('las-mercedes', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '48 a 72 horas'),
  ('libertad', 80.00, 123.60, 3.5000, 15, '1 vez cada 15 días', 'zona especial de entrega'),
  ('los-llanitos-de-tabay', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '48 a 72 horas'),
  ('los-teques', 70.00, 105.94, 3.0000, 2, '3 veces por semana · lunes, miércoles y viernes', '24 a 72 horas'),
  ('machiques', 80.00, 123.60, 3.5000, 15, '1 vez cada 15 días', '24 a 72 horas'),
  ('maiquetia', 70.00, 105.94, 3.0000, 3, '2 veces por semana · lunes y miércoles', '24 a 72 horas'),
  ('maracaibo', 80.00, 123.60, 3.5000, 3, '2 veces por semana · lunes y miércoles', '24 a 72 horas'),
  ('maturin', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '24 a 48 horas'),
  ('michelena', 80.00, 123.60, 3.5000, 7, '1 vez por semana', '48 a 72 horas'),
  ('miranda', 70.00, 105.94, 3.0000, 2, '3 veces por semana · lunes, miércoles y viernes', '24 a 72 horas'),
  ('mirimire', 80.00, 123.60, 3.5000, 7, '1 vez por semana', '24 a 48 horas'),
  ('montalban', 70.00, 105.94, 3.0000, 2, '3 veces por semana · lunes, miércoles y viernes', '24 a 72 horas'),
  ('moron', 70.00, 105.94, 3.0000, 2, '3 veces por semana · lunes, miércoles y viernes', '24 a 72 horas'),
  ('mucuchies', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '48 a 72 horas'),
  ('merida', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '48 a 72 horas'),
  ('naranjales', 80.00, 123.60, 3.5000, 7, '1 vez por semana', '48 a 72 horas'),
  ('nirgua', 70.00, 105.94, 3.0000, 2, '3 veces por semana · lunes, miércoles y viernes', '24 a 72 horas'),
  ('nueva-bolivia', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '48 a 72 horas'),
  ('ocumare-del-tuy', 70.00, 105.94, 3.0000, 3, '2 veces por semana · martes y jueves', '24 a 72 horas'),
  ('ospino', 80.00, 123.60, 3.5000, 7, '1 vez por semana', '24 a 72 horas'),
  ('pampanito', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '48 a 72 horas'),
  ('pampan', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '48 a 72 horas'),
  ('pariaguan', 80.00, 123.60, 3.5000, 15, '1 vez cada 15 días', '24 a 48 horas'),
  ('pedraza', 80.00, 123.60, 3.5000, 7, '1 vez por semana', '24 a 72 horas'),
  ('pueblo-llano', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '48 a 72 horas'),
  ('puerto-cabello', 70.00, 105.94, 3.0000, 2, '3 veces por semana · lunes, miércoles y viernes', '24 a 72 horas'),
  ('puerto-la-cruz', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '24 a 48 horas'),
  ('puerto-ordaz', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '24 a 48 horas'),
  ('puerto-piritu', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '24 a 48 horas'),
  ('punta-de-mata', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '24 a 48 horas'),
  ('punto-fijo', 80.00, 123.60, 3.5000, 3, '2 veces por semana · lunes y miércoles', '24 a 72 horas'),
  ('quibor', 70.00, 105.94, 3.0000, 7, '1 vez por semana', 'los viernes'),
  ('rubio', 80.00, 123.60, 3.5000, 7, '1 vez por semana', '48 a 72 horas'),
  ('sabana-de-mendoza', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '48 a 72 horas'),
  ('sabana-de-parra', 70.00, 105.94, 3.0000, 2, '3 veces por semana · lunes, miércoles y viernes', '24 a 72 horas'),
  ('sabaneta', 80.00, 123.60, 3.5000, 15, '1 vez cada 15 días', 'zona especial de entrega'),
  ('san-antonio', 70.00, 105.94, 3.0000, 2, '3 veces por semana · lunes, miércoles y viernes', '24 a 72 horas'),
  ('san-antonio-del-golfo', 80.00, 123.60, 3.5000, 7, '1 vez por semana · martes', '48 a 72 horas'),
  ('san-carlos', 80.00, 123.60, 3.5000, 3, '2 veces por semana · lunes y miércoles', '24 a 72 horas'),
  ('san-cristobal', 80.00, 123.60, 3.5000, 3, '2 veces por semana · lunes y miércoles', '24 a 72 horas'),
  ('san-felipe', 70.00, 105.94, 3.0000, 2, '3 veces por semana · lunes, miércoles y viernes', '24 a 72 horas'),
  ('san-fernando', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '48 a 72 horas'),
  ('san-felix', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '24 a 72 horas'),
  ('san-juan-de-los-morros', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '48 a 72 horas'),
  ('san-rafael-de-onoto', 80.00, 123.60, 3.5000, 3, '2 veces por semana · lunes y miércoles', '24 a 72 horas'),
  ('sanare', 70.00, 105.94, 3.0000, 7, '1 vez por semana', 'los viernes'),
  ('santa-barbara', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '48 a 72 horas'),
  ('santa-barbara-de-barinas', 80.00, 123.60, 3.5000, 3, '2 veces por semana · lunes y miércoles', '24 a 72 horas'),
  ('santa-cruz-de-mora', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '48 a 72 horas'),
  ('santa-lucia', 70.00, 105.94, 3.0000, 3, '2 veces por semana · martes y jueves', '24 a 72 horas'),
  ('santa-maria-de-ipire', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '48 a 72 horas'),
  ('santa-rita', 80.00, 123.60, 3.5000, 7, '1 vez por semana', '24 a 48 horas'),
  ('santa-teresa-del-tuy', 70.00, 105.94, 3.0000, 3, '2 veces por semana · martes y jueves', '24 a 72 horas'),
  ('santo-domingo', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '48 a 72 horas'),
  ('sarare', 70.00, 105.94, 3.0000, 7, '1 vez por semana', 'los viernes'),
  ('socopo', 80.00, 123.60, 3.5000, 3, '2 veces por semana · lunes y miércoles', '24 a 72 horas'),
  ('soledad', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '24 a 48 horas'),
  ('tabay', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '48 a 72 horas'),
  ('tejerias', 70.00, 105.94, 3.0000, 2, '3 veces por semana · lunes, miércoles y viernes', '24 a 72 horas'),
  ('temblador', 80.00, 123.60, 3.5000, 15, '1 vez cada 15 días', 'zona especial de despacho'),
  ('timotes', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '48 a 72 horas'),
  ('tinaco', 80.00, 123.60, 3.5000, 3, '2 veces por semana · lunes y miércoles', '24 a 72 horas'),
  ('tinaquillo', 80.00, 123.60, 3.5000, 3, '2 veces por semana · lunes y miércoles', '24 a 72 horas'),
  ('tocuyito', 70.00, 105.94, 3.0000, 1, 'Todos los días', 'Mismo día'),
  ('tovar', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '48 a 72 horas'),
  ('tucacas', 80.00, 123.60, 3.5000, 7, '1 vez por semana', '24 a 48 horas'),
  ('tucani', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '48 a 72 horas'),
  ('tucupido', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '48 a 72 horas'),
  ('tucupita', 80.00, 176.57, 5.0000, 15, '1 vez cada 15 días', '42 a 72 horas'),
  ('tumeremo', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '24 a 72 horas'),
  ('turmero', 70.00, 105.94, 3.0000, 1, 'Todos los días', 'Mismo día'),
  ('turen', 80.00, 123.60, 3.5000, 3, '2 veces por semana · lunes y miércoles', '24 a 72 horas'),
  ('tariba', 80.00, 123.60, 3.5000, 3, '2 veces por semana · lunes y miércoles', '24 a 72 horas'),
  ('upata', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '24 a 72 horas'),
  ('valera', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '48 a 72 horas'),
  ('valle-de-la-pascua', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '48 a 72 horas'),
  ('yaracal', 80.00, 123.60, 3.5000, 3, '2 veces por semana · lunes y miércoles', '24 a 72 horas'),
  ('yaritagua', 70.00, 105.94, 3.0000, 1, 'Todos los días', 'Mismo día'),
  ('zaraza', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '48 a 72 horas'),
  ('zea', 80.00, 123.60, 3.5000, 7, '1 vez por semana · lunes', '48 a 72 horas')
  )
  insert into public.carrier_tariffs (
    tenant_id, carrier_id, city_slug, cost_usd_cbm, price_usd_cbm,
    price_usd_ft3, min_charge_usd, dispatch_frequency_days,
    departure_frequency, transit_days, valid_from, valid_to
  )
  select v_tenant, v_carrier, e.city_slug,
         e.cost_usd_cbm, e.price_usd_cbm, e.price_usd_ft3,
         null, e.dispatch_frequency_days,
         e.departure_frequency, e.transit_days,
         date '2026-07-31', date '2027-07-31'
    from entrada e
  on conflict (tenant_id, carrier_id, city_slug) where deleted_at is null
  do update set
    cost_usd_cbm            = excluded.cost_usd_cbm,
    price_usd_cbm           = excluded.price_usd_cbm,
    price_usd_ft3           = excluded.price_usd_ft3,
    dispatch_frequency_days = excluded.dispatch_frequency_days,
    departure_frequency     = excluded.departure_frequency,
    transit_days            = excluded.transit_days,
    valid_from              = excluded.valid_from,
    valid_to                = excluded.valid_to,
    updated_at              = now();
  get diagnostics v_tarifas = row_count;

  raise notice '0332: % ciudades, % tarifas, transportista %',
    v_ciudades, v_tarifas, v_carrier;
end $$;
