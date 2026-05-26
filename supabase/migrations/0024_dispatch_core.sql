-- ─────────────────────────────────────────────────────────────
-- SDD-0029 Fase 1: Módulo Despacho · core (admin web)
--
-- Pipeline 3-actor (Admin/Bodeguero/Camionero) sobre Órdenes de
-- Despacho (ODs). Esta migración cubre SOLO el lado Admin (Fase 1).
-- Las apps móviles de bodeguero+camionero llegan en SDD-0030.
--
-- Cubre:
--   - 6 enums (status OD · hub · payment policy · route type · split reason · incident severity)
--   - Catálogo VE público (ve_locality_catalog): 24 estados · ~98 ciudades · IPOSTEL
--   - 5 tablas per-tenant: dispatch_orders · dispatch_order_packages
--                          dispatch_routes · dispatch_city_catalog
--                          dispatch_rules
--   - Extensión aditiva: warehouse_receipts_cn.description NULLABLE
--     (Wang Hua YIW-A1 y el wizard /m/cn/nueva siguen idénticos)
--   - 4 RPCs: next_dispatch_order_code · next_route_code
--             upsert_dispatch_rules · seed_tenant_cities_from_ve_catalog
--   - Trigger guard de transición de status
--   - RLS por tenant_id en las 5 tablas privadas
--
-- 100% aditivo y no destructivo. Catálogo VE es global (sin RLS, solo lectura).
-- ─────────────────────────────────────────────────────────────

-- ── ENUMS ────────────────────────────────────────────────────

create type dispatch_order_status as enum (
  'creada',
  'cargando',
  'lista',
  'en_ruta',
  'entregada',
  'cerrada',
  'cancelada'
);

create type dispatch_hub as enum (
  'valencia',
  'la_guaira',
  'punto_fijo',
  'maracaibo'
);

create type dispatch_payment_policy as enum (
  'estricto',
  'hold',
  'credito_whitelist'
);

create type dispatch_route_type as enum (
  'directa',
  'intermedias'
);

create type dispatch_split_reason as enum (
  'falta_volumen',
  'cliente_pidio_esperar',
  'dano_caja',
  'documentacion_pendiente',
  'otro'
);

create type dispatch_incident_severity as enum (
  'baja',
  'media',
  'alta',
  'critica'
);

-- ─────────────────────────────────────────────────────────────
-- 1. ve_locality_catalog (PÚBLICO · sin RLS · solo lectura)
-- ─────────────────────────────────────────────────────────────

create table public.ve_locality_catalog (
  state_code      text not null,             -- 'CAR'
  state_name      text not null,             -- 'Carabobo'
  state_region    text not null,             -- 'Centro'
  state_capital   text not null,
  municipio       text not null,             -- 'Valencia'
  city            text not null,             -- 'Valencia'
  postal_code     text not null,             -- '2001' (IPOSTEL)
  parroquias      text[] not null default '{}',
  barrios         text[] not null default '{}',
  primary key (state_code, city)
);

comment on table public.ve_locality_catalog is
  'Catálogo público inmutable de localidades VE (24 estados + ~98 ciudades + CP IPOSTEL). Referencia inicial para dispatch_city_catalog per-tenant.';

create index ve_locality_catalog_postal_idx
  on public.ve_locality_catalog (postal_code);

create index ve_locality_catalog_region_idx
  on public.ve_locality_catalog (state_region);

grant select on public.ve_locality_catalog to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- Seed catálogo VE (24 estados · ~98 ciudades · IPOSTEL)
-- ─────────────────────────────────────────────────────────────

insert into public.ve_locality_catalog
  (state_code, state_name, state_region, state_capital, municipio, city, postal_code, parroquias, barrios)
values
  -- Distrito Capital
  ('DTF', 'Distrito Capital', 'Capital', 'Caracas', 'Libertador', 'Caracas (Centro)', '1010', ARRAY['Catedral','San José','La Pastora','El Recreo'], ARRAY['El Silencio','San Bernardino','Cotiza','La Candelaria']),
  ('DTF', 'Distrito Capital', 'Capital', 'Caracas', 'Libertador', 'Caracas (Oeste)',  '1020', ARRAY['Antímano','Caricuao','La Vega','Macarao'], ARRAY['Caricuao','Antímano','La Yaguara']),
  ('DTF', 'Distrito Capital', 'Capital', 'Caracas', 'Libertador', 'Caracas (Sur)',    '1080', ARRAY['El Valle','Coche','Santa Rosalía'], ARRAY['El Valle','Coche','Las Acacias']),

  -- Caracas Metropolitana (virtual · 4 alcaldías)
  ('CCS', 'Caracas Metropolitana', 'Capital', 'Caracas', 'Chacao',     'Chacao (Caracas)',  '1060', ARRAY['Chacao'], ARRAY['Chacao','La Castellana','Country Club','Altamira']),
  ('CCS', 'Caracas Metropolitana', 'Capital', 'Caracas', 'Baruta',     'Baruta (Caracas)',  '1080', ARRAY['Baruta','El Cafetal','Las Minas'], ARRAY['Las Mercedes','Santa Mónica','Sorocaima']),
  ('CCS', 'Caracas Metropolitana', 'Capital', 'Caracas', 'Sucre',      'Petare',            '1070', ARRAY['Petare','Caucagüita','Filas de Mariche','La Dolorita','Leoncio Martínez'], ARRAY['Petare','Mariperez','Cumbres de Curumo']),
  ('CCS', 'Caracas Metropolitana', 'Capital', 'Caracas', 'El Hatillo', 'El Hatillo',        '1083', ARRAY['El Hatillo'], ARRAY['El Hatillo','La Lagunita','Oripoto']),

  -- Amazonas
  ('AMA', 'Amazonas', 'Guayana', 'Puerto Ayacucho', 'Atures', 'Puerto Ayacucho', '7101', ARRAY['Atures'], ARRAY['Centro']),

  -- Anzoátegui
  ('ANZ', 'Anzoátegui', 'Oriente', 'Barcelona', 'Simón Bolívar',              'Barcelona',         '6001', ARRAY['Bergantín','El Carmen','San Cristóbal'], ARRAY['Centro','Boyacá']),
  ('ANZ', 'Anzoátegui', 'Oriente', 'Barcelona', 'Sotillo',                    'Puerto La Cruz',    '6023', ARRAY['Pozuelos'], ARRAY['Centro','Lechería']),
  ('ANZ', 'Anzoátegui', 'Oriente', 'Barcelona', 'Diego Bautista Urbaneja',    'Lechería',          '6016', ARRAY['Lechería'], ARRAY['Lechería','El Morro']),
  ('ANZ', 'Anzoátegui', 'Oriente', 'Barcelona', 'Anaco',                      'Anaco',             '6003', ARRAY['Anaco'], ARRAY['Centro']),
  ('ANZ', 'Anzoátegui', 'Oriente', 'Barcelona', 'Pedro María Freites',        'Cantaura',          '6004', ARRAY['Cantaura'], ARRAY[]::text[]),
  ('ANZ', 'Anzoátegui', 'Oriente', 'Barcelona', 'Independencia',              'Soledad',           '6010', ARRAY['Mamo'], ARRAY[]::text[]),

  -- Apure
  ('APU', 'Apure', 'Llanos', 'San Fernando de Apure', 'San Fernando', 'San Fernando de Apure', '7001', ARRAY['San Fernando'], ARRAY['Centro']),
  ('APU', 'Apure', 'Llanos', 'San Fernando de Apure', 'Páez',         'Guasdualito',           '7011', ARRAY['Guasdualito'], ARRAY[]::text[]),

  -- Aragua
  ('ARA', 'Aragua', 'Centro', 'Maracay', 'Girardot',                  'Maracay',     '2101', ARRAY['Las Delicias','José Casanova Godoy','Joaquín Crespo'], ARRAY['San Jacinto','Las Delicias','El Castaño','Caña de Azúcar','La Soledad']),
  ('ARA', 'Aragua', 'Centro', 'Maracay', 'Mario Briceño Iragorry',    'El Limón',    '2105', ARRAY['Caña de Azúcar'], ARRAY['El Limón']),
  ('ARA', 'Aragua', 'Centro', 'Maracay', 'Santiago Mariño',           'Turmero',     '2115', ARRAY['Turmero'], ARRAY['Centro']),
  ('ARA', 'Aragua', 'Centro', 'Maracay', 'Sucre',                     'Cagua',       '2122', ARRAY['Cagua'], ARRAY['Centro']),
  ('ARA', 'Aragua', 'Centro', 'Maracay', 'José Ángel Lamas',          'Santa Cruz',  '2128', ARRAY['Santa Cruz'], ARRAY[]::text[]),
  ('ARA', 'Aragua', 'Centro', 'Maracay', 'Linares Alcántara',         'Santa Rita',  '2123', ARRAY['Santa Rita'], ARRAY[]::text[]),

  -- Barinas
  ('BAR', 'Barinas', 'Llanos', 'Barinas', 'Barinas',                    'Barinas', '5201', ARRAY['Barinas','Alto Barinas'], ARRAY['Centro','Alto Barinas']),
  ('BAR', 'Barinas', 'Llanos', 'Barinas', 'Antonio José de Sucre',      'Socopó',  '5212', ARRAY['Socopó'], ARRAY[]::text[]),

  -- Bolívar
  ('BOL', 'Bolívar', 'Guayana', 'Ciudad Bolívar', 'Heres',  'Ciudad Bolívar',                 '8001', ARRAY['Catedral','Vista Hermosa'], ARRAY['Centro','Vista Hermosa','Sabana del Hueso']),
  ('BOL', 'Bolívar', 'Guayana', 'Ciudad Bolívar', 'Caroní', 'Ciudad Guayana / Puerto Ordaz',  '8050', ARRAY['Cachamay','Universidad','Unare','Vista al Sol','Once de Abril'], ARRAY['Alta Vista','Castillito','Los Olivos','Villa Bolívar']),
  ('BOL', 'Bolívar', 'Guayana', 'Ciudad Bolívar', 'Piar',   'Upata',                          '8021', ARRAY['Upata'], ARRAY['Centro']),

  -- Carabobo
  ('CAR', 'Carabobo', 'Centro', 'Valencia', 'Valencia',       'Valencia',       '2001', ARRAY['San José','San Blas','Catedral','Candelaria'], ARRAY['El Viñedo','Trigal Norte','San José','Prebo','El Recreo','La Granja']),
  ('CAR', 'Carabobo', 'Centro', 'Valencia', 'Naguanagua',     'Naguanagua',     '2005', ARRAY['Naguanagua'], ARRAY['Mañongo','La Granja','Bárbula']),
  ('CAR', 'Carabobo', 'Centro', 'Valencia', 'San Diego',      'San Diego',      '2006', ARRAY['San Diego'], ARRAY['Yuma','Castillito']),
  ('CAR', 'Carabobo', 'Centro', 'Valencia', 'Los Guayos',     'Los Guayos',     '2014', ARRAY['Los Guayos'], ARRAY[]::text[]),
  ('CAR', 'Carabobo', 'Centro', 'Valencia', 'Guacara',        'Guacara',        '2015', ARRAY['Guacara'], ARRAY['Centro']),
  ('CAR', 'Carabobo', 'Centro', 'Valencia', 'Puerto Cabello', 'Puerto Cabello', '2050', ARRAY['Fraternidad','Bartolomé Salom','Goaigoaza'], ARRAY['Centro','Cumboto']),

  -- Cojedes
  ('COJ', 'Cojedes', 'Llanos', 'San Carlos', 'Ezequiel Zamora', 'San Carlos',  '2201', ARRAY['San Carlos'], ARRAY['Centro']),
  ('COJ', 'Cojedes', 'Llanos', 'San Carlos', 'Tinaquillo',      'Tinaquillo',  '2204', ARRAY['Tinaquillo'], ARRAY['Centro']),

  -- Delta Amacuro
  ('DEL', 'Delta Amacuro', 'Guayana', 'Tucupita', 'Tucupita', 'Tucupita', '9001', ARRAY['Tucupita'], ARRAY['Centro']),

  -- Falcón
  ('FAL', 'Falcón', 'Occidente', 'Coro', 'Miranda',     'Coro',                       '4101', ARRAY['Santa Ana','San Antonio'], ARRAY['Centro','Cruz Verde','Curazaito']),
  ('FAL', 'Falcón', 'Occidente', 'Coro', 'Carirubana',  'Punto Fijo',                 '4102', ARRAY['Carirubana','Norte','Punta Cardón'], ARRAY['Centro','Las Pioneras','Cardón']),
  ('FAL', 'Falcón', 'Occidente', 'Coro', 'Los Taques',  'Santa Cruz de Los Taques',   '4106', ARRAY['Los Taques'], ARRAY[]::text[]),
  ('FAL', 'Falcón', 'Occidente', 'Coro', 'Federación',  'Churuguara',                 '4115', ARRAY['Churuguara'], ARRAY[]::text[]),

  -- Guárico
  ('GUA', 'Guárico', 'Llanos', 'San Juan de los Morros', 'Juan Germán Roscio',     'San Juan de los Morros',  '2301', ARRAY['San Juan'], ARRAY['Casco Central','Pariata','La Toscana']),
  ('GUA', 'Guárico', 'Llanos', 'San Juan de los Morros', 'Francisco de Miranda',   'Calabozo',                '2312', ARRAY['Calabozo'], ARRAY['Centro']),
  ('GUA', 'Guárico', 'Llanos', 'San Juan de los Morros', 'Camaguán',               'Camaguán',                '2317', ARRAY['Camaguán'], ARRAY[]::text[]),
  ('GUA', 'Guárico', 'Llanos', 'San Juan de los Morros', 'José Tadeo Monagas',     'Altagracia de Orituco',   '2304', ARRAY['Altagracia'], ARRAY[]::text[]),

  -- La Guaira
  ('LAG', 'La Guaira', 'Capital', 'La Guaira', 'Vargas', 'La Guaira',     '1163', ARRAY['Catia La Mar','Maiquetía','La Guaira'], ARRAY['Maiquetía','Macuto']),
  ('LAG', 'La Guaira', 'Capital', 'La Guaira', 'Vargas', 'Catia La Mar',  '1162', ARRAY['Catia La Mar'], ARRAY['Centro','Puerto Viejo']),
  ('LAG', 'La Guaira', 'Capital', 'La Guaira', 'Vargas', 'Maiquetía',     '1161', ARRAY['Maiquetía'], ARRAY['Centro']),

  -- Lara
  ('LAR', 'Lara', 'Centro-Occidente', 'Barquisimeto', 'Iribarren',  'Barquisimeto', '3001', ARRAY['Catedral','Concepción','Tamaca','El Cuji'], ARRAY['Centro','El Tostado','Las Trinitarias','Patarata']),
  ('LAR', 'Lara', 'Centro-Occidente', 'Barquisimeto', 'Palavecino', 'Cabudare',     '3023', ARRAY['Cabudare'], ARRAY['Centro']),
  ('LAR', 'Lara', 'Centro-Occidente', 'Barquisimeto', 'Crespo',     'Duaca',        '3050', ARRAY['Duaca'], ARRAY[]::text[]),
  ('LAR', 'Lara', 'Centro-Occidente', 'Barquisimeto', 'Torres',     'Carora',       '3040', ARRAY['Carora'], ARRAY['Centro']),

  -- Mérida
  ('MER', 'Mérida', 'Andes', 'Mérida', 'Libertador',       'Mérida',     '5101', ARRAY['El Llano','Milla','Domingo Peña','Mariano Picón Salas'], ARRAY['La Hechicera','Belensate','Glorias Patrias','Mérida Centro']),
  ('MER', 'Mérida', 'Andes', 'Mérida', 'Campo Elías',      'Ejido',      '5113', ARRAY['Ejido'], ARRAY['Centro']),
  ('MER', 'Mérida', 'Andes', 'Mérida', 'Tovar',            'Tovar',      '5131', ARRAY['Tovar'], ARRAY['Centro']),
  ('MER', 'Mérida', 'Andes', 'Mérida', 'Alberto Adriani',  'El Vigía',   '5145', ARRAY['El Vigía'], ARRAY['Centro']),

  -- Miranda
  ('MIR', 'Miranda', 'Capital', 'Los Teques', 'Guaicaipuro',     'Los Teques',        '1201', ARRAY['Los Teques','San Pedro'], ARRAY['Centro','San Pedro','Lomas de Urquía']),
  ('MIR', 'Miranda', 'Capital', 'Los Teques', 'Plaza',           'Guarenas',          '1220', ARRAY['Guarenas'], ARRAY['Centro','Camatagua']),
  ('MIR', 'Miranda', 'Capital', 'Los Teques', 'Zamora',          'Guatire',           '1221', ARRAY['Guatire'], ARRAY['Centro']),
  ('MIR', 'Miranda', 'Capital', 'Los Teques', 'Cristóbal Rojas', 'Charallave',        '1210', ARRAY['Charallave'], ARRAY['Centro']),
  ('MIR', 'Miranda', 'Capital', 'Los Teques', 'Urdaneta',        'Cúa',               '1213', ARRAY['Cúa'], ARRAY['Centro']),
  ('MIR', 'Miranda', 'Capital', 'Los Teques', 'Brión',           'Higuerote',         '1240', ARRAY['Higuerote'], ARRAY['Centro']),
  ('MIR', 'Miranda', 'Capital', 'Los Teques', 'Lander',          'Ocumare del Tuy',   '1211', ARRAY['Ocumare'], ARRAY['Centro']),

  -- Monagas
  ('MON', 'Monagas', 'Oriente', 'Maturín', 'Maturín',   'Maturín',     '6201', ARRAY['San Simón','San Vicente','Las Cocuizas'], ARRAY['La Floresta','Tipuro','Las Avenidas','Los Pinos']),
  ('MON', 'Monagas', 'Oriente', 'Maturín', 'Caripe',    'Caripe',      '6225', ARRAY['Caripe'], ARRAY[]::text[]),
  ('MON', 'Monagas', 'Oriente', 'Maturín', 'Punceres',  'Quiriquire',  '6213', ARRAY['Quiriquire'], ARRAY[]::text[]),

  -- Nueva Esparta
  ('NES', 'Nueva Esparta', 'Insular', 'La Asunción', 'Arismendi', 'La Asunción', '6301', ARRAY['La Asunción'], ARRAY['Centro']),
  ('NES', 'Nueva Esparta', 'Insular', 'La Asunción', 'Mariño',    'Porlamar',    '6313', ARRAY['Porlamar'], ARRAY['Centro','4 de Mayo','Genovés']),
  ('NES', 'Nueva Esparta', 'Insular', 'La Asunción', 'Maneiro',   'Pampatar',    '6315', ARRAY['Pampatar'], ARRAY['Centro','La Caranta']),
  ('NES', 'Nueva Esparta', 'Insular', 'La Asunción', 'Gómez',     'Santa Ana',   '6311', ARRAY['Santa Ana'], ARRAY[]::text[]),

  -- Portuguesa
  ('POR', 'Portuguesa', 'Llanos', 'Guanare', 'Guanare', 'Guanare',  '3322', ARRAY['Guanare','San Juan de Guanaguanare'], ARRAY['Centro','Mesa de Cavacas']),
  ('POR', 'Portuguesa', 'Llanos', 'Guanare', 'Páez',    'Acarigua', '3301', ARRAY['Acarigua'], ARRAY['Centro','Bolívar']),
  ('POR', 'Portuguesa', 'Llanos', 'Guanare', 'Araure',  'Araure',   '3303', ARRAY['Araure'], ARRAY['Centro']),
  ('POR', 'Portuguesa', 'Llanos', 'Guanare', 'Sucre',   'Biscucuy', '3330', ARRAY['Biscucuy'], ARRAY[]::text[]),

  -- Sucre
  ('SUC', 'Sucre', 'Oriente', 'Cumaná', 'Sucre',    'Cumaná',       '6101', ARRAY['Altagracia','Santa Inés','Valentín Valiente','Ayacucho'], ARRAY['Centro','Boca de Sabana','Los Tarales']),
  ('SUC', 'Sucre', 'Oriente', 'Cumaná', 'Bermúdez', 'Carúpano',     '6150', ARRAY['Santa Rosa','Santa Catalina'], ARRAY['Centro']),
  ('SUC', 'Sucre', 'Oriente', 'Cumaná', 'Cajigal',  'Yaguaraparo',  '6173', ARRAY['Yaguaraparo'], ARRAY[]::text[]),
  ('SUC', 'Sucre', 'Oriente', 'Cumaná', 'Valdez',   'Güiria',       '6164', ARRAY['Güiria'], ARRAY[]::text[]),

  -- Táchira
  ('TAC', 'Táchira', 'Andes', 'San Cristóbal', 'San Cristóbal',         'San Cristóbal',              '5001', ARRAY['La Concordia','Pedro María Morantes','San Juan Bautista'], ARRAY['Centro','Pirineos','Las Lomas']),
  ('TAC', 'Táchira', 'Andes', 'San Cristóbal', 'Cárdenas',              'Táriba',                     '5009', ARRAY['Táriba'], ARRAY['Centro']),
  ('TAC', 'Táchira', 'Andes', 'San Cristóbal', 'Bolívar',               'San Antonio del Táchira',    '5004', ARRAY['San Antonio'], ARRAY['Centro']),
  ('TAC', 'Táchira', 'Andes', 'San Cristóbal', 'Pedro María Ureña',     'Ureña',                      '5005', ARRAY['Ureña'], ARRAY[]::text[]),
  ('TAC', 'Táchira', 'Andes', 'San Cristóbal', 'Junín',                 'Rubio',                      '5030', ARRAY['Rubio'], ARRAY['Centro']),

  -- Trujillo
  ('TRU', 'Trujillo', 'Andes', 'Trujillo', 'Trujillo', 'Trujillo', '3101', ARRAY['Trujillo'], ARRAY['Centro']),
  ('TRU', 'Trujillo', 'Andes', 'Trujillo', 'Valera',   'Valera',   '3102', ARRAY['Valera','Mendoza'], ARRAY['Centro','La Plata','Plata III']),
  ('TRU', 'Trujillo', 'Andes', 'Trujillo', 'Boconó',   'Boconó',   '3104', ARRAY['Boconó'], ARRAY['Centro']),

  -- Yaracuy
  ('YAR', 'Yaracuy', 'Centro-Occidente', 'San Felipe', 'San Felipe',    'San Felipe',    '3201', ARRAY['San Felipe','Albarico'], ARRAY['Centro','La Trinidad']),
  ('YAR', 'Yaracuy', 'Centro-Occidente', 'San Felipe', 'Independencia', 'Independencia', '3206', ARRAY['Independencia'], ARRAY[]::text[]),
  ('YAR', 'Yaracuy', 'Centro-Occidente', 'San Felipe', 'Veroes',        'Farriar',       '3214', ARRAY['Farriar'], ARRAY[]::text[]),
  ('YAR', 'Yaracuy', 'Centro-Occidente', 'San Felipe', 'Bolívar',       'Aroa',          '3211', ARRAY['Aroa'], ARRAY[]::text[]),

  -- Zulia
  ('ZUL', 'Zulia', 'Occidente', 'Maracaibo', 'Maracaibo',              'Maracaibo',                '4001', ARRAY['Chiquinquirá','Coquivacoa','Cristo de Aranza','Bolívar','Santa Lucía'], ARRAY['Bella Vista','Tierra Negra','El Milagro','Indio Mara','Sabaneta']),
  ('ZUL', 'Zulia', 'Occidente', 'Maracaibo', 'San Francisco',          'San Francisco',            '4002', ARRAY['San Francisco','Marcial Hernández'], ARRAY['Sierra Maestra','San Francisco Centro']),
  ('ZUL', 'Zulia', 'Occidente', 'Maracaibo', 'Cabimas',                'Cabimas',                  '4013', ARRAY['Cabimas','Punta Gorda','Ambrosio'], ARRAY['Centro','Las Cabillas','La Rosa']),
  ('ZUL', 'Zulia', 'Occidente', 'Maracaibo', 'Lagunillas',             'Ciudad Ojeda',             '4019', ARRAY['Ciudad Ojeda'], ARRAY['Centro']),
  ('ZUL', 'Zulia', 'Occidente', 'Maracaibo', 'Mara',                   'San Rafael del Moján',     '4012', ARRAY['Mara'], ARRAY[]::text[]),
  ('ZUL', 'Zulia', 'Occidente', 'Maracaibo', 'Machiques de Perijá',    'Machiques',                '4045', ARRAY['Machiques'], ARRAY['Centro']),
  ('ZUL', 'Zulia', 'Occidente', 'Maracaibo', 'Santa Rita',             'Santa Rita',               '4030', ARRAY['Santa Rita'], ARRAY[]::text[]),

  -- Dependencias Federales
  ('DEP', 'Dependencias Federales', 'Insular', 'Gran Roque', 'Los Roques',  'Gran Roque',  '1990', ARRAY[]::text[], ARRAY[]::text[]),
  ('DEP', 'Dependencias Federales', 'Insular', 'Gran Roque', 'La Tortuga',  'Tortuga',     '1990', ARRAY[]::text[], ARRAY[]::text[]);

-- ─────────────────────────────────────────────────────────────
-- 2. dispatch_routes (per-tenant)
-- ─────────────────────────────────────────────────────────────

create table public.dispatch_routes (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants (id) on delete cascade,
  route_code            text not null,                          -- 'R-002'
  name                  text not null,
  route_type            dispatch_route_type not null default 'directa',
  hub                   dispatch_hub not null,
  origin_city           text not null,
  destination_city      text not null,
  intermediate_cities   jsonb not null default '[]'::jsonb,     -- [{city, radius_km, order}]
  sla_hours             numeric not null check (sla_hours > 0),
  active                boolean not null default true,
  notes                 text,
  created_by            uuid,
  updated_by            uuid,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,
  unique (tenant_id, route_code)
);

comment on table public.dispatch_routes is
  'Catálogo de rutas operativas per-tenant. Directa (origen→destino) o intermedias (con ciudades intermedias en jsonb). RLS por tenant. Soft-delete.';

create index dispatch_routes_tenant_hub_idx
  on public.dispatch_routes (tenant_id, hub)
  where deleted_at is null and active = true;

create index dispatch_routes_tenant_active_idx
  on public.dispatch_routes (tenant_id, active)
  where deleted_at is null;

-- ─────────────────────────────────────────────────────────────
-- 3. dispatch_city_catalog (per-tenant)
-- ─────────────────────────────────────────────────────────────

create table public.dispatch_city_catalog (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants (id) on delete cascade,
  state_code          text not null,
  state_name          text not null,
  municipio           text not null,
  city                text not null,
  postal_code         text,
  default_radius_km   numeric not null default 5,
  is_hq               boolean not null default false,
  active              boolean not null default true,
  usage_count         int not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (tenant_id, state_code, city)
);

comment on table public.dispatch_city_catalog is
  'Catálogo de ciudades per-tenant. Se popula la primera vez con seed_tenant_cities_from_ve_catalog(). Tenant puede agregar ciudades custom o marcar is_hq.';

create index dispatch_city_catalog_tenant_active_idx
  on public.dispatch_city_catalog (tenant_id)
  where active = true;

-- ─────────────────────────────────────────────────────────────
-- 4. dispatch_rules (1 row por tenant)
-- ─────────────────────────────────────────────────────────────

create table public.dispatch_rules (
  tenant_id              uuid primary key references public.tenants (id) on delete cascade,
  payment_policy         dispatch_payment_policy not null default 'estricto',
  whitelist_markboxes    text[] not null default '{}',
  weights                jsonb not null default jsonb_build_object(
                           'valencia', 40,
                           'full_pay', 30,
                           'partial_pay', 15,
                           'fifo', 15,
                           'vip', 10,
                           'route_proximity', 5
                         ),
  optional_rules         jsonb not null default jsonb_build_object(
                           'tier', false,
                           'routes', true
                         ),
  vip_markboxes          text[] not null default '{}',
  updated_by             uuid,
  updated_at             timestamptz not null default now()
);

comment on table public.dispatch_rules is
  'Configuración del motor de scoring por tenant. 1 row por tenant. Editable desde /studio/despacho/reglas. Defaults aplicados si no existe row.';

-- ─────────────────────────────────────────────────────────────
-- 5. dispatch_orders (entidad central)
-- ─────────────────────────────────────────────────────────────

create table public.dispatch_orders (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants (id) on delete cascade,
  order_code               text not null,                                   -- 'OD-2026-0142'
  status                   dispatch_order_status not null default 'creada',
  hub                      dispatch_hub not null,

  -- Assignment (todos required al crear)
  route_id                 uuid references public.dispatch_routes (id),
  truck_id                 uuid references public.tms_trucks (id),
  driver_id                uuid references public.tms_drivers (id),

  -- Capacity snapshots (al crear · auditable post-cambio en TMS)
  capacity_kg_snapshot     numeric,
  capacity_cbm_snapshot    numeric,

  -- Totals (aggregate del junction)
  total_kg                 numeric not null default 0,
  total_cbm                numeric not null default 0,
  package_count            int not null default 0,

  -- Cities visit order
  cities_ordered           text[] not null default '{}',

  -- Lifecycle
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  departed_at              timestamptz,
  completed_at             timestamptz,
  closed_at                timestamptz,
  cancelled_at             timestamptz,
  reassigned_at            timestamptz,

  -- Progress runtime (lo escribe el camionero en SDD-0030)
  progress_pct             int not null default 0 check (progress_pct >= 0 and progress_pct <= 100),
  current_city             text,

  -- Cancel + Splits
  cancel_reason            text,
  parent_od_id             uuid references public.dispatch_orders (id),     -- si es P2

  -- Audit
  created_by               uuid,
  updated_by               uuid,
  cancelled_by             uuid,

  unique (tenant_id, order_code)
);

comment on table public.dispatch_orders is
  'Órdenes de Despacho (ODs). Entidad central del pipeline 3-actor. State machine cerrada (creada→cargando→lista→en_ruta→entregada→cerrada, terminal cancelada). Code OD-YYYY-NNNN.';

create index dispatch_orders_tenant_status_idx
  on public.dispatch_orders (tenant_id, status)
  where status not in ('cerrada', 'cancelada');

create index dispatch_orders_hub_status_idx
  on public.dispatch_orders (tenant_id, hub, status);

create index dispatch_orders_driver_active_idx
  on public.dispatch_orders (tenant_id, driver_id)
  where status = 'lista';

create index dispatch_orders_parent_idx
  on public.dispatch_orders (parent_od_id)
  where parent_od_id is not null;

-- ─────────────────────────────────────────────────────────────
-- 6. dispatch_order_packages (junction OD ↔ paquetes)
-- ─────────────────────────────────────────────────────────────

create table public.dispatch_order_packages (
  od_id              uuid not null references public.dispatch_orders (id) on delete cascade,
  package_kind       text not null check (package_kind in ('warehouse_receipt_cn', 'warehouse_receipt_ve')),
  package_id         uuid not null,                                         -- FK polimórfico (FK explícito en SDD-0030)
  markbox            text not null,
  client_name        text not null,
  city               text not null,
  pay                text not null check (pay in ('pagado', 'parcial', 'pendiente')),
  description        text,
  boxes_total        int not null check (boxes_total > 0),
  boxes_shipped      int not null check (boxes_shipped > 0 and boxes_shipped <= boxes_total),
  weight_kg          numeric not null,
  cbm                numeric not null,
  hs_code            text,
  aes_code           text,
  split_reason       dispatch_split_reason,
  split_reason_text  text,                                                  -- texto libre si reason = 'otro'
  added_at           timestamptz not null default now(),
  primary key (od_id, package_id),

  -- Si está fraccionado (boxes_shipped < boxes_total), motivo es obligatorio
  constraint dispatch_order_packages_split_requires_reason
    check (boxes_shipped = boxes_total or split_reason is not null)
);

comment on table public.dispatch_order_packages is
  'Junction OD ↔ paquetes. Soporta carga fraccionada (boxes_shipped < boxes_total) con motivo obligatorio. FK polimórfico via package_kind + package_id (FK explícito en Fase 2 SDD-0030).';

create index dispatch_order_packages_markbox_idx
  on public.dispatch_order_packages (markbox);

create index dispatch_order_packages_package_idx
  on public.dispatch_order_packages (package_kind, package_id);

-- ─────────────────────────────────────────────────────────────
-- 7. Extensión aditiva: warehouse_receipts_cn.description NULLABLE
-- ─────────────────────────────────────────────────────────────

alter table public.warehouse_receipts_cn
  add column description text;

comment on column public.warehouse_receipts_cn.description is
  'Descripción de mercancía requerida por SENIAT (Aduana VE) + chofer entrega. NULLABLE en Fase 1 SDD-0029 para no romper el wizard /m/cn/nueva del operario CN existente. Una fase posterior decidirá NOT NULL con 5to step opcional.';

-- ─────────────────────────────────────────────────────────────
-- 8. RPCs
-- ─────────────────────────────────────────────────────────────

-- 8.1 · next_dispatch_order_code: secuencial OD-YYYY-NNNN por tenant
create or replace function public.next_dispatch_order_code(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year text := to_char(now() at time zone 'America/Caracas', 'YYYY');
  v_max int;
  v_next text;
begin
  if not exists (
    select 1 from public.user_tenants
    where user_id = auth.uid() and tenant_id = p_tenant_id
  ) then
    raise exception 'No autorizado para tenant %', p_tenant_id;
  end if;

  select coalesce(max((substring(order_code from 'OD-' || v_year || '-(\d+)$'))::int), 0)
    into v_max
  from public.dispatch_orders
  where tenant_id = p_tenant_id
    and order_code like 'OD-' || v_year || '-%';

  v_next := 'OD-' || v_year || '-' || lpad((v_max + 1)::text, 4, '0');
  return v_next;
end;
$$;

comment on function public.next_dispatch_order_code(uuid) is
  'Genera el próximo código OD-YYYY-NNNN para el tenant. Verifica que auth.uid() esté en user_tenants.';

grant execute on function public.next_dispatch_order_code(uuid) to authenticated;

-- 8.2 · next_route_code: secuencial R-NNN por tenant (sin año)
create or replace function public.next_route_code(p_tenant_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max int;
  v_next text;
begin
  if not exists (
    select 1 from public.user_tenants
    where user_id = auth.uid() and tenant_id = p_tenant_id
  ) then
    raise exception 'No autorizado para tenant %', p_tenant_id;
  end if;

  select coalesce(max((substring(route_code from 'R-(\d+)$'))::int), 0)
    into v_max
  from public.dispatch_routes
  where tenant_id = p_tenant_id
    and route_code like 'R-%';

  v_next := 'R-' || lpad((v_max + 1)::text, 3, '0');
  return v_next;
end;
$$;

comment on function public.next_route_code(uuid) is
  'Genera el próximo código R-NNN para el tenant. Verifica autorización.';

grant execute on function public.next_route_code(uuid) to authenticated;

-- 8.3 · upsert_dispatch_rules: idempotente, last-write-wins
create or replace function public.upsert_dispatch_rules(
  p_tenant_id uuid,
  p_payload jsonb
)
returns public.dispatch_rules
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.dispatch_rules;
begin
  if not exists (
    select 1 from public.user_tenants
    where user_id = auth.uid() and tenant_id = p_tenant_id
  ) then
    raise exception 'No autorizado para tenant %', p_tenant_id;
  end if;

  insert into public.dispatch_rules (
    tenant_id, payment_policy, whitelist_markboxes,
    weights, optional_rules, vip_markboxes, updated_by, updated_at
  )
  values (
    p_tenant_id,
    coalesce((p_payload->>'payment_policy')::dispatch_payment_policy, 'estricto'),
    coalesce(
      (select array_agg(value) from jsonb_array_elements_text(p_payload->'whitelist_markboxes') as value),
      '{}'
    ),
    coalesce(p_payload->'weights', jsonb_build_object(
      'valencia', 40, 'full_pay', 30, 'partial_pay', 15,
      'fifo', 15, 'vip', 10, 'route_proximity', 5
    )),
    coalesce(p_payload->'optional_rules', jsonb_build_object('tier', false, 'routes', true)),
    coalesce(
      (select array_agg(value) from jsonb_array_elements_text(p_payload->'vip_markboxes') as value),
      '{}'
    ),
    auth.uid(),
    now()
  )
  on conflict (tenant_id) do update set
    payment_policy       = excluded.payment_policy,
    whitelist_markboxes  = excluded.whitelist_markboxes,
    weights              = excluded.weights,
    optional_rules       = excluded.optional_rules,
    vip_markboxes        = excluded.vip_markboxes,
    updated_by           = excluded.updated_by,
    updated_at           = excluded.updated_at
  returning * into v_row;

  return v_row;
end;
$$;

comment on function public.upsert_dispatch_rules(uuid, jsonb) is
  'Upsert idempotente de dispatch_rules. Last-write-wins, sin lock optimista en Fase 1.';

grant execute on function public.upsert_dispatch_rules(uuid, jsonb) to authenticated;

-- 8.4 · seed_tenant_cities_from_ve_catalog: copia inicial del catálogo público
create or replace function public.seed_tenant_cities_from_ve_catalog(p_tenant_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if not exists (
    select 1 from public.user_tenants
    where user_id = auth.uid() and tenant_id = p_tenant_id
  ) then
    raise exception 'No autorizado para tenant %', p_tenant_id;
  end if;

  insert into public.dispatch_city_catalog (
    tenant_id, state_code, state_name, municipio, city, postal_code,
    default_radius_km, is_hq, active
  )
  select
    p_tenant_id, state_code, state_name, municipio, city, postal_code,
    5, false, true
  from public.ve_locality_catalog
  on conflict (tenant_id, state_code, city) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.seed_tenant_cities_from_ve_catalog(uuid) is
  'Copia idempotente las ~98 ciudades del catálogo VE público a dispatch_city_catalog del tenant. Devuelve cuántas filas se insertaron (0 si ya estaban).';

grant execute on function public.seed_tenant_cities_from_ve_catalog(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 9. Trigger guard de transición de status
-- ─────────────────────────────────────────────────────────────

create or replace function public.dispatch_orders_status_transition_guard()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'UPDATE' and old.status <> new.status then
    -- Prohibido modificar status desde terminales
    if old.status in ('cerrada', 'cancelada') then
      raise exception 'No se puede modificar status desde % (terminal)', old.status;
    end if;

    -- entregada solo puede ir a cerrada
    if old.status = 'entregada' and new.status not in ('cerrada') then
      raise exception 'Desde entregada solo se puede ir a cerrada (intentado: %)', new.status;
    end if;

    -- lista no puede retroceder a cargando
    if old.status = 'lista' and new.status = 'cargando' then
      raise exception 'No se puede retroceder de lista a cargando';
    end if;

    -- en_ruta no puede retroceder a lista
    if old.status = 'en_ruta' and new.status = 'lista' then
      raise exception 'No se puede retroceder de en_ruta a lista';
    end if;

    -- Auto-stamp timestamps
    if new.status = 'en_ruta' and new.departed_at is null then
      new.departed_at := now();
    elsif new.status = 'entregada' and new.completed_at is null then
      new.completed_at := now();
    elsif new.status = 'cerrada' and new.closed_at is null then
      new.closed_at := now();
    elsif new.status = 'cancelada' and new.cancelled_at is null then
      new.cancelled_at := now();
      new.cancelled_by := coalesce(new.cancelled_by, auth.uid());
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger dispatch_orders_status_guard
  before update on public.dispatch_orders
  for each row execute function public.dispatch_orders_status_transition_guard();

-- ─────────────────────────────────────────────────────────────
-- 10. RLS · tenant isolation
-- ─────────────────────────────────────────────────────────────

alter table public.dispatch_orders enable row level security;
alter table public.dispatch_order_packages enable row level security;
alter table public.dispatch_routes enable row level security;
alter table public.dispatch_city_catalog enable row level security;
alter table public.dispatch_rules enable row level security;

-- dispatch_orders: select + insert + update + delete via tenant_id
create policy dispatch_orders_select on public.dispatch_orders
  for select using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_orders_insert on public.dispatch_orders
  for insert with check (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_orders_update on public.dispatch_orders
  for update using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_orders_delete on public.dispatch_orders
  for delete using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

-- dispatch_order_packages: tenant via JOIN al OD
create policy dispatch_order_packages_select on public.dispatch_order_packages
  for select using (
    exists (
      select 1 from public.dispatch_orders d
      where d.id = dispatch_order_packages.od_id
        and d.tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
    )
  );

create policy dispatch_order_packages_insert on public.dispatch_order_packages
  for insert with check (
    exists (
      select 1 from public.dispatch_orders d
      where d.id = dispatch_order_packages.od_id
        and d.tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
    )
  );

create policy dispatch_order_packages_update on public.dispatch_order_packages
  for update using (
    exists (
      select 1 from public.dispatch_orders d
      where d.id = dispatch_order_packages.od_id
        and d.tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
    )
  );

create policy dispatch_order_packages_delete on public.dispatch_order_packages
  for delete using (
    exists (
      select 1 from public.dispatch_orders d
      where d.id = dispatch_order_packages.od_id
        and d.tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
    )
  );

-- dispatch_routes
create policy dispatch_routes_select on public.dispatch_routes
  for select using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_routes_insert on public.dispatch_routes
  for insert with check (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_routes_update on public.dispatch_routes
  for update using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_routes_delete on public.dispatch_routes
  for delete using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

-- dispatch_city_catalog
create policy dispatch_city_catalog_select on public.dispatch_city_catalog
  for select using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_city_catalog_insert on public.dispatch_city_catalog
  for insert with check (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_city_catalog_update on public.dispatch_city_catalog
  for update using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_city_catalog_delete on public.dispatch_city_catalog
  for delete using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

-- dispatch_rules
create policy dispatch_rules_select on public.dispatch_rules
  for select using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_rules_insert on public.dispatch_rules
  for insert with check (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

create policy dispatch_rules_update on public.dispatch_rules
  for update using (
    tenant_id in (select tenant_id from public.user_tenants where user_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────
-- 11. Grants
-- ─────────────────────────────────────────────────────────────

grant select, insert, update, delete on public.dispatch_orders to authenticated;
grant select, insert, update, delete on public.dispatch_order_packages to authenticated;
grant select, insert, update, delete on public.dispatch_routes to authenticated;
grant select, insert, update, delete on public.dispatch_city_catalog to authenticated;
grant select, insert, update on public.dispatch_rules to authenticated;
