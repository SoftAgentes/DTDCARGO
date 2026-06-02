/* global React */
/* ── DTD ERP · Mock data ────────────────────────────────────── */
/* Data verosímil de DTD-Cargo · corredor CN → VE.              */

const _origins = [
  { code: 'YIW', name: 'Yiwu', cn: '义乌', port: 'Ningbo', country: 'CN' },
  { code: 'CAN', name: 'Guangzhou', cn: '广州', port: 'Nansha', country: 'CN' },
  { code: 'SZX', name: 'Shenzhen', cn: '深圳', port: 'Yantian', country: 'CN' },
  { code: 'SHA', name: 'Shanghai', cn: '上海', port: 'Shanghai', country: 'CN' },
];
const _destinations = [
  { code: 'PBL', name: 'Puerto Cabello', state: 'Carabobo', country: 'VE' },
  { code: 'LGU', name: 'La Guaira', state: 'La Guaira', country: 'VE' },
  { code: 'MAR', name: 'Maracaibo', state: 'Zulia', country: 'VE' },
  { code: 'PFI', name: 'Punto Fijo', state: 'Falcón', country: 'VE' },
];

// ── Clientes ─────────────────────────────────────────────────
const CLIENTS = [
  { markbox: 'DTD-5452', name: 'Carlos Méndez',     company: 'Acindar Comercial CA',    rif: 'J-30182554-9', segment: 'Industrial',  shipments: 24, billed: 184500, status: 'active',  city: 'Valencia',   tier: 'Gold',    since: '2019-03', email: 'cmendez@acindar.ve',   phone: '+58 412 166 8021', whatsapp: true,  lastLogin: '2026-05-21' },
  { markbox: 'DTD-5418', name: 'Adriana Pereira',    company: 'Importadora Pereira',     rif: 'J-29874512-3', segment: 'Retail',      shipments: 18, billed: 96400,  status: 'active',  city: 'Caracas',    tier: 'Silver',  since: '2020-11', email: 'apereira@imp-pereira.com', phone: '+58 414 220 5611', whatsapp: true,  lastLogin: '2026-05-22' },
  { markbox: 'DTD-5392', name: 'Luis Fernández',     company: 'Industrias Polar SA',     rif: 'J-00041234-5', segment: 'Industrial',  shipments: 41, billed: 412800, status: 'active',  city: 'Caracas',    tier: 'Platinum',since: '2017-06', email: 'lfernandez@polar.com.ve', phone: '+58 212 949 1100', whatsapp: false, lastLogin: '2026-05-23' },
  { markbox: 'DTD-5371', name: 'María González',     company: 'Tech Solutions VE',       rif: 'J-31125789-1', segment: 'Tecnología',  shipments: 11, billed: 64200,  status: 'active',  city: 'Maracaibo',  tier: 'Silver',  since: '2021-09', email: 'mgonzalez@techsol.ve', phone: '+58 416 778 3322', whatsapp: true,  lastLogin: '2026-05-20' },
  { markbox: 'DTD-5354', name: 'Roberto Castro',     company: 'Castro Hermanos CA',      rif: 'J-30449182-7', segment: 'Mayorista',   shipments: 33, billed: 248600, status: 'active',  city: 'Punto Fijo', tier: 'Gold',    since: '2018-02', email: 'rcastro@castrohnos.com', phone: '+58 426 559 8800', whatsapp: true,  lastLogin: '2026-05-22' },
  { markbox: 'DTD-5340', name: 'Patricia Rojas',     company: 'Distribuidora Andina',    rif: 'J-30776541-2', segment: 'Mayorista',   shipments: 22, billed: 152300, status: 'active',  city: 'Mérida',     tier: 'Silver',  since: '2019-12', email: 'projas@distandina.ve',  phone: '+58 414 332 1188', whatsapp: false, lastLogin: '2026-05-19' },
  { markbox: 'DTD-5321', name: 'Eduardo Salazar',    company: 'Salazar Trading',         rif: 'J-31298074-4', segment: 'Comercial',   shipments: 7,  billed: 38200,  status: 'pending', city: 'Caracas',    tier: 'Bronze',  since: '2024-01', email: 'esalazar@salazartrading.com', phone: '+58 412 887 4421', whatsapp: true, lastLogin: '2026-05-18' },
  { markbox: 'DTD-5298', name: 'Carolina Vargas',    company: 'Vargas & Asoc',           rif: 'J-30558712-6', segment: 'Servicios',   shipments: 14, billed: 78600,  status: 'active',  city: 'Valencia',   tier: 'Silver',  since: '2020-04', email: 'cvargas@vargasasoc.com', phone: '+58 424 661 9090', whatsapp: true,  lastLogin: '2026-05-15' },
  { markbox: 'DTD-5277', name: 'Andrés Briceño',     company: 'BriceñoTex Manufactura',  rif: 'J-30992145-8', segment: 'Textil',      shipments: 19, billed: 127400, status: 'active',  city: 'Barquisimeto',tier:'Gold',    since: '2018-09', email: 'abriceno@bricenotex.ve', phone: '+58 416 245 1188', whatsapp: false, lastLogin: '2026-05-23' },
  { markbox: 'DTD-5263', name: 'Sofía Linares',      company: 'Comercial Linares',       rif: 'J-31443298-2', segment: 'Retail',      shipments: 5,  billed: 18900,  status: 'inactive',city: 'Caracas',    tier: 'Bronze',  since: '2023-07', email: 'slinares@coml.ve',     phone: '+58 414 008 7621', whatsapp: true,  lastLogin: '2026-03-12' },
  { markbox: 'DTD-5241', name: 'José Hernández',     company: 'Industrias Hernández',    rif: 'J-30115442-1', segment: 'Industrial',  shipments: 28, billed: 198700, status: 'active',  city: 'Maturín',    tier: 'Gold',    since: '2018-11', email: 'jhernandez@indh.ve',   phone: '+58 426 884 2218', whatsapp: true,  lastLogin: '2026-05-21' },
  { markbox: 'DTD-5215', name: 'Valentina Ortiz',    company: 'Ortiz Cosmetics CA',      rif: 'J-31662481-9', segment: 'Belleza',     shipments: 16, billed: 89400,  status: 'active',  city: 'Caracas',    tier: 'Silver',  since: '2021-03', email: 'vortiz@ortizcosm.com', phone: '+58 412 332 7780', whatsapp: true,  lastLogin: '2026-05-22' },
];

// ── Embarques ────────────────────────────────────────────────
const STATUS_FLOW = ['cotizado', 'confirmado', 'recibido CN', 'consolidado', 'zarpado', 'tránsito', 'aduana VE', 'liberado', 'entregado'];
const STATUS_TONE = {
  'cotizado': 'neutral',
  'confirmado': 'info',
  'recibido CN': 'info',
  'consolidado': 'info',
  'zarpado': 'wine',
  'tránsito': 'wine',
  'aduana VE': 'warning',
  'liberado': 'success',
  'entregado': 'success',
  'demorado': 'danger',
  'cancelado': 'danger',
};

const SHIPMENTS = [
  { id: 'DTDU-472816', type: 'FCL 20\'', client: 'DTD-5452', clientName: 'Acindar Comercial', origin: 'YIW', destination: 'PBL', cbm: 28.4, weight: 12400, value: 84200, status: 'tránsito', etd: '2026-05-14', eta: '2026-06-12', progress: 42, vessel: 'COSCO PISCES', invoice: 'F-2026-0418', billed: true, paid: false, alert: null },
  { id: 'DTDU-419032', type: 'FCL 40\'HC', client: 'DTD-5392', clientName: 'Industrias Polar', origin: 'CAN', destination: 'MAR', cbm: 68.2, weight: 22100, value: 156800, status: 'aduana VE', etd: '2026-04-22', eta: '2026-06-02', progress: 88, vessel: 'MSC TIANSHAN', invoice: 'F-2026-0391', billed: true, paid: true, alert: 'ETA +2 días estimados' },
  { id: 'DTDU-388157', type: 'LCL DDP', client: 'DTD-5418', clientName: 'Imp. Pereira', origin: 'SZX', destination: 'LGU', cbm: 8.2, weight: 3400, value: 12600, status: 'liberado', etd: '2026-04-08', eta: '2026-05-24', progress: 96, vessel: 'CMA CGM JUPITER', invoice: 'F-2026-0354', billed: true, paid: true, alert: null },
  { id: 'DTDU-365044', type: 'FCL 40\'', client: 'DTD-5354', clientName: 'Castro Hermanos', origin: 'YIW', destination: 'PFI', cbm: 56.0, weight: 18900, value: 124500, status: 'entregado', etd: '2026-03-12', eta: '2026-05-15', progress: 100, vessel: 'EVERGREEN ACE', invoice: 'F-2026-0312', billed: true, paid: true, alert: null },
  { id: 'DTDU-412908', type: 'LCL DDP', client: 'DTD-5371', clientName: 'Tech Solutions', origin: 'SHA', destination: 'PBL', cbm: 4.6, weight: 1800, value: 8400, status: 'zarpado', etd: '2026-05-19', eta: '2026-06-22', progress: 22, vessel: 'ONE COMMITMENT', invoice: 'F-2026-0432', billed: true, paid: false, alert: null },
  { id: 'DTDU-401234', type: 'FCL 20\'', client: 'DTD-5340', clientName: 'Dist. Andina', origin: 'CAN', destination: 'PBL', cbm: 26.8, weight: 11400, value: 68900, status: 'consolidado', etd: '2026-05-28', eta: '2026-06-30', progress: 14, vessel: 'pendiente', invoice: 'F-2026-0441', billed: true, paid: false, alert: null },
  { id: 'DTDU-398770', type: 'LCL DDP', client: 'DTD-5277', clientName: 'BriceñoTex', origin: 'YIW', destination: 'PBL', cbm: 6.2, weight: 2400, value: 11200, status: 'recibido CN', etd: null, eta: '2026-06-28', progress: 10, vessel: 'pendiente', invoice: null, billed: false, paid: false, alert: null },
  { id: 'DTDU-388501', type: 'FCL 40\'HC', client: 'DTD-5241', clientName: 'Ind. Hernández', origin: 'CAN', destination: 'MAR', cbm: 64.8, weight: 21800, value: 142000, status: 'confirmado', etd: null, eta: '2026-07-04', progress: 6, vessel: 'pendiente', invoice: null, billed: false, paid: false, alert: null },
  { id: 'Q-2026-0110', type: 'LCL DDP', client: 'DTD-5215', clientName: 'Ortiz Cosmetics', origin: 'SZX', destination: 'LGU', cbm: 3.4, weight: 1200, value: 6800, status: 'cotizado', etd: null, eta: null, progress: 0, vessel: null, invoice: null, billed: false, paid: false, alert: null },
  { id: 'Q-2026-0188', type: 'LCL DDP', client: 'DTD-5452', clientName: 'Acindar Comercial', origin: 'YIW', destination: 'PBL', cbm: 6.4, weight: 2600, value: 4820, status: 'cotizado', etd: null, eta: null, progress: 0, vessel: null, container: null, invoice: null, billed: false, paid: false, alert: null },
  { id: 'Q-2026-1245', type: 'LCL DDP', client: 'DTD-5452', clientName: 'Acindar Comercial', origin: 'YIW', destination: 'PBL', cbm: 8.1, weight: 3150, value: 6480, status: 'recibido CN', etd: null, eta: null, progress: 10, vessel: 'pendiente', container: null, invoice: null, billed: false, paid: false, alert: null },
  { id: 'Q-2026-2310', type: 'LCL DDP', client: 'DTD-5452', clientName: 'Acindar Comercial', origin: 'YIW', destination: 'PBL', cbm: 9.2, weight: 3600, value: 7360, status: 'recibido CN', etd: null, eta: null, progress: 10, vessel: 'pendiente', container: null, invoice: null, billed: false, paid: false, alert: null },
  { id: 'DTDU-364299', type: 'FCL 20\'', client: 'DTD-5298', clientName: 'Vargas & Asoc', origin: 'YIW', destination: 'PBL', cbm: 24.2, weight: 9800, value: 54300, status: 'tránsito', etd: '2026-05-06', eta: '2026-06-04', progress: 62, vessel: 'YANG MING WORTH', invoice: 'F-2026-0405', billed: true, paid: true, alert: null },
];

// ── Cost templates por ruta (default cost structure) ─────────
const ROUTE_COST_TEMPLATES = {
  'YIW-PBL-LCL':    { name: 'Yiwu → Pto Cabello · LCL DDP',  freight: 4200, customs: 1800, transport: 1100, handling: 580, insurance: 280, commission: 630, other: 420 },
  'YIW-PBL-FCL20':  { name: 'Yiwu → Pto Cabello · FCL 20\'',  freight: 18400, customs: 8400, transport: 3200, handling: 1800, insurance: 1200, commission: 2940, other: 1400 },
  'YIW-PBL-FCL40':  { name: 'Yiwu → Pto Cabello · FCL 40\'',  freight: 32200, customs: 14800, transport: 5200, handling: 2900, insurance: 2100, commission: 4720, other: 2000 },
  'CAN-MAR-FCL40':  { name: 'Guangzhou → Maracaibo · FCL 40\'', freight: 38400, customs: 16800, transport: 6200, handling: 3400, insurance: 2400, commission: 5640, other: 2200 },
  'SZX-LGU-LCL':    { name: 'Shenzhen → La Guaira · LCL DDP', freight: 4400, customs: 1300, transport: 1000, handling: 520, insurance: 240, commission: 580, other: 380 },
  'YIW-PFI-FCL20':  { name: 'Yiwu → Punto Fijo · FCL 20\'',    freight: 19200, customs: 9100, transport: 4100, handling: 1850, insurance: 1300, commission: 3115, other: 1500 },
  'SHA-PBL-LCL':    { name: 'Shanghai → Pto Cabello · LCL DDP', freight: 3800, customs: 1100, transport: 1050, handling: 480, insurance: 220, commission: 540, other: 360 },
};
const TRUCKS = [
  { id: 'T-001', plate: 'AC542XK', type: 'Semi 40\'',      brand: 'Volvo FH',       owned: true,  capacityKg: 30000, capacityCBM: 76, hub: 'PBL', status: 'en ruta',   km: 184500, lastService: '2026-04-12', driver: 'd-001', fuel: 'diesel', mpg: 6.2 },
  { id: 'T-002', plate: 'AD188PL', type: 'Furgón 24\'',    brand: 'Mercedes Atego', owned: true,  capacityKg: 12000, capacityCBM: 38, hub: 'PBL', status: 'disponible', km: 92400,  lastService: '2026-05-02', driver: 'd-002', fuel: 'diesel', mpg: 8.4 },
  { id: 'T-003', plate: 'AE204JR', type: 'Furgón 18\'',    brand: 'Iveco Daily',    owned: true,  capacityKg: 7000,  capacityCBM: 22, hub: 'LGU', status: 'disponible', km: 64200,  lastService: '2026-04-28', driver: 'd-003', fuel: 'diesel', mpg: 11.2 },
  { id: 'T-004', plate: 'AF678WV', type: 'Semi 40\'',      brand: 'Scania R',       owned: false, capacityKg: 30000, capacityCBM: 76, hub: 'MAR', status: 'en ruta',   km: 215800, lastService: '2026-03-14', driver: 'd-004', fuel: 'diesel', mpg: 5.8 },
  { id: 'T-005', plate: 'AG991QM', type: 'Camión 350',     brand: 'Hino 300',       owned: true,  capacityKg: 5000,  capacityCBM: 16, hub: 'LGU', status: 'mantenimiento', km: 142000, lastService: '2026-05-22', driver: null,    fuel: 'diesel', mpg: 12.5 },
  { id: 'T-006', plate: 'AH445BR', type: 'Semi 40\'HC',    brand: 'Kenworth T880',  owned: false, capacityKg: 30000, capacityCBM: 92, hub: 'PBL', status: 'cargando',  km: 308400, lastService: '2026-04-20', driver: 'd-005', fuel: 'diesel', mpg: 5.6 },
  { id: 'T-007', plate: 'AI223GH', type: 'Furgón 24\'',    brand: 'Mercedes Atego', owned: true,  capacityKg: 12000, capacityCBM: 38, hub: 'PFI', status: 'disponible', km: 48200,  lastService: '2026-05-08', driver: 'd-006', fuel: 'diesel', mpg: 8.7 },
];

const DRIVERS = [
  { id: 'd-001', name: 'Luis Hernández',  license: 'A · B · C · D · E', phone: '+58 414 552 1188', hub: 'PBL', exp: 18, status: 'en ruta',     trips30d: 22, rating: 4.9, lastTrip: 'DTDU-472816 · Valencia' },
  { id: 'd-002', name: 'José Velásquez',  license: 'A · B · C',          phone: '+58 412 884 7700', hub: 'PBL', exp: 9,  status: 'disponible', trips30d: 18, rating: 4.7, lastTrip: 'DTDU-388157 · Caracas' },
  { id: 'd-003', name: 'Carlos Salinas',  license: 'A · B · C · D',     phone: '+58 416 339 5512', hub: 'LGU', exp: 12, status: 'disponible', trips30d: 16, rating: 4.8, lastTrip: 'DTDU-419032 · Caracas' },
  { id: 'd-004', name: 'Pedro Marquina',  license: 'A · B · C · D · E', phone: '+58 426 771 4488', hub: 'MAR', exp: 22, status: 'en ruta',     trips30d: 24, rating: 4.9, lastTrip: 'DTDU-419032 · Maracaibo' },
  { id: 'd-005', name: 'Mario Castillo',  license: 'A · B · C · D',     phone: '+58 412 668 2200', hub: 'PBL', exp: 8,  status: 'cargando',   trips30d: 14, rating: 4.6, lastTrip: 'DTDU-401234 · Valencia' },
  { id: 'd-006', name: 'Ramón Briceño',   license: 'A · B · C · D',     phone: '+58 414 998 7711', hub: 'PFI', exp: 15, status: 'disponible', trips30d: 12, rating: 4.7, lastTrip: 'DTDU-365044 · Punto Fijo' },
  { id: 'd-007', name: 'Jorge Peña',      license: 'A · B · C',          phone: '+58 426 220 5544', hub: 'PBL', exp: 6,  status: 'descanso',   trips30d: 11, rating: 4.5, lastTrip: 'DTDU-388157 · Maracay' },
];

const TMS_ROUTES = [
  { id: 'R-2026-0142', shipment: 'DTDU-472816', truck: 'T-001', driver: 'd-001', stops: ['PBL · Terminal Bolipuertos', 'Valencia · ZI Acindar'], distance: 168, eta: '2026-05-24 14:30', status: 'en ruta', progress: 62 },
  { id: 'R-2026-0141', shipment: 'DTDU-419032', truck: 'T-004', driver: 'd-004', stops: ['MAR · Puerto Maracaibo', 'Maracaibo · Polar Planta Sur'], distance: 24, eta: '2026-05-24 09:15', status: 'en ruta', progress: 88 },
  { id: 'R-2026-0140', shipment: 'DTDU-388157', truck: 'T-002', driver: 'd-002', stops: ['LGU · La Guaira', 'Caracas · Imp. Pereira Galpón'], distance: 32, eta: '2026-05-23 17:00', status: 'completado', progress: 100 },
  { id: 'R-2026-0143', shipment: 'DTDU-401234', truck: 'T-006', driver: 'd-005', stops: ['PBL · Terminal', 'Valencia · Dist. Andina', 'Maracay · Cliente Final'], distance: 142, eta: '2026-05-25 11:00', status: 'planificado', progress: 0 },
];

const TMS_INCIDENTS = [
  { id: 'INC-001', truck: 'T-005', date: '2026-05-22', type: 'mantenimiento', desc: 'Cambio aceite + filtros · revisión frenos', cost: 480, status: 'en taller' },
  { id: 'INC-002', truck: 'T-004', date: '2026-05-18', type: 'multa',         desc: 'Exceso velocidad · ruta Maracaibo', cost: 120, status: 'pagada' },
  { id: 'INC-003', truck: 'T-001', date: '2026-05-10', type: 'combustible',   desc: 'Tanque lleno · estación PDVSA Valencia', cost: 280, status: 'registrado' },
];
const SHIPMENT_COSTS = {
  'DTDU-472816': { freight: 28400, customs: 12800, transport: 4200, handling: 2100, insurance: 1850, commission: 4220, other: 1800 },
  'DTDU-419032': { freight: 58200, customs: 21400, transport: 6800, handling: 3900, insurance: 3800, commission: 7840, other: 2600 },
  'DTDU-388157': { freight:  5400, customs:  1200, transport: 1100, handling:  580, insurance:  280, commission:  630, other:  420 },
  'DTDU-365044': { freight: 42800, customs: 18400, transport: 5600, handling: 3200, insurance: 2900, commission: 6225, other: 2100 },
  'DTDU-412908': { freight:  3200, customs:   780, transport:  850, handling:  420, insurance:  180, commission:  420, other:  280 },
  'DTDU-401234': { freight: 24800, customs:  9200, transport: 3800, handling: 1900, insurance: 1450, commission: 3445, other: 1500 },
  'DTDU-398770': { freight:  4200, customs:  1100, transport:  920, handling:  490, insurance:  220, commission:  560, other:  340 },
  'DTDU-388501': { freight: 52400, customs: 19800, transport: 6400, handling: 3700, insurance: 3500, commission: 7100, other: 2400 },
  'Q-2026-0110': { freight:  2400, customs:   620, transport:  780, handling:  380, insurance:  140, commission:  340, other:  220 },
  'DTDU-364299': { freight: 18900, customs:  7400, transport: 3200, handling: 1600, insurance: 1100, commission: 2715, other: 1200 },
};

// Helper: compute revenue/cost/margin
function shipmentEconomics(s) {
  const c = SHIPMENT_COSTS[s.id] || { freight: 0, customs: 0, transport: 0, handling: 0, insurance: 0, commission: 0, other: 0 };
  const totalCost = c.freight + c.customs + c.transport + c.handling + c.insurance + c.commission + c.other;
  const revenue = s.value || 0;
  const margin = revenue - totalCost;
  const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;
  return { ...c, totalCost, revenue, margin, marginPct };
}
const QUOTES = [
  { id: 'Q-2026-0418', client: 'DTD-5215', clientName: 'Ortiz Cosmetics', type: 'LCL DDP', origin: 'SZX', destination: 'LGU', cbm: 3.4, weight: 1200, totalUSD: 6800, ratePerCBM: 800, status: 'enviada', created: '2026-05-22', validUntil: '2026-06-21', items: 4, agent: 'Martina Acuña' },
  { id: 'Q-2026-0419', client: 'DTD-5418', clientName: 'Imp. Pereira', type: 'LCL DDP', origin: 'YIW', destination: 'PBL', cbm: 11.2, weight: 4400, totalUSD: 14200, ratePerCBM: 800, status: 'aceptada', created: '2026-05-22', validUntil: '2026-06-21', items: 8, agent: 'Diego Núñez' },
  { id: 'Q-2026-0420', client: 'DTD-5277', clientName: 'BriceñoTex', type: 'FCL 20\'', origin: 'CAN', destination: 'PBL', cbm: 28.0, weight: 11000, totalUSD: 38400, ratePerCBM: null, status: 'enviada', created: '2026-05-23', validUntil: '2026-06-22', items: 1, agent: 'Martina Acuña' },
  { id: 'Q-2026-0421', client: 'DTD-5371', clientName: 'Tech Solutions', type: 'LCL DDP', origin: 'SHA', destination: 'MAR', cbm: 6.8, weight: 2800, totalUSD: 9200, ratePerCBM: 800, status: 'borrador', created: '2026-05-23', validUntil: '2026-06-22', items: 5, agent: 'Diego Núñez' },
  { id: 'Q-2026-0417', client: 'DTD-5340', clientName: 'Dist. Andina', type: 'LCL DDP', origin: 'YIW', destination: 'PFI', cbm: 5.4, weight: 2100, totalUSD: 7400, ratePerCBM: 800, status: 'rechazada', created: '2026-05-19', validUntil: '2026-06-18', items: 3, agent: 'Martina Acuña' },
  { id: 'Q-2026-0416', client: 'DTD-5354', clientName: 'Castro Hermanos', type: 'FCL 40\'HC', origin: 'YIW', destination: 'PFI', cbm: 67.0, weight: 23000, totalUSD: 78200, ratePerCBM: null, status: 'aceptada', created: '2026-05-18', validUntil: '2026-06-17', items: 1, agent: 'Diego Núñez' },
];

// ── Facturas ─────────────────────────────────────────────────
const INVOICES = [
  { id: 'F-2026-0418', client: 'DTD-5452', clientName: 'Acindar Comercial', shipment: 'DTDU-472816', amount: 84200, currency: 'USD', issued: '2026-05-14', due: '2026-06-13', status: 'vencida', paid: 0, balance: 84200 },
  { id: 'F-2026-0391', client: 'DTD-5392', clientName: 'Industrias Polar', shipment: 'DTDU-419032', amount: 156800, currency: 'USD', issued: '2026-04-22', due: '2026-05-22', status: 'pagada', paid: 156800, balance: 0 },
  { id: 'F-2026-0354', client: 'DTD-5418', clientName: 'Imp. Pereira', shipment: 'DTDU-388157', amount: 12600, currency: 'USD', issued: '2026-04-08', due: '2026-05-08', status: 'pagada', paid: 12600, balance: 0 },
  { id: 'F-2026-0312', client: 'DTD-5354', clientName: 'Castro Hermanos', shipment: 'DTDU-365044', amount: 124500, currency: 'USD', issued: '2026-03-12', due: '2026-04-11', status: 'pagada', paid: 124500, balance: 0 },
  { id: 'F-2026-0432', client: 'DTD-5371', clientName: 'Tech Solutions', shipment: 'DTDU-412908', amount: 8400, currency: 'USD', issued: '2026-05-19', due: '2026-06-18', status: 'emitida', paid: 0, balance: 8400 },
  { id: 'F-2026-0441', client: 'DTD-5340', clientName: 'Dist. Andina', shipment: 'DTDU-401234', amount: 68900, currency: 'USD', issued: '2026-05-22', due: '2026-06-21', status: 'emitida', paid: 0, balance: 68900 },
  { id: 'F-2026-0405', client: 'DTD-5298', clientName: 'Vargas & Asoc', shipment: 'DTDU-364299', amount: 54300, currency: 'USD', issued: '2026-05-06', due: '2026-06-05', status: 'parcial', paid: 25000, balance: 29300 },
];

// ── Almacén CN (recepciones) ─────────────────────────────────
const WAREHOUSE_CN = [
  { id: 'CN-2026-2841', client: 'DTD-5452', clientName: 'Acindar', supplier: 'Yiwu Standard Co', boxes: 12, cbm: 6.4, weight: 980, received: '2026-05-22', warehouse: 'YIW-A2', status: 'pendiente consolidación', shipment: null, hsCode: '8517.12', description: 'Cables eléctricos blindados 2.5mm + conectores industriales · 12 cajas estandarizadas' },
  { id: 'CN-2026-2840', client: 'DTD-5418', clientName: 'Imp. Pereira', supplier: 'Shenzhen Lights Ltd', boxes: 8, cbm: 4.2, weight: 620, received: '2026-05-22', warehouse: 'SZX-B1', status: 'pendiente consolidación', shipment: null, hsCode: '9405.40', description: 'Lámparas LED 30W cuerpo blanco (4 cajas) + LED 50W panel rectangular (4 cajas) · con drivers incluidos' },
  { id: 'CN-2026-2839', client: 'DTD-5371', clientName: 'Tech Solutions', supplier: 'Shanghai Tech Corp', boxes: 24, cbm: 4.6, weight: 1800, received: '2026-05-21', warehouse: 'SHA-A1', status: 'consolidado', shipment: 'DTDU-412908', hsCode: '8471.30', description: 'Laptops Lenovo IdeaPad 3 · 15" · i5 / 8GB / 512GB SSD · 24 unidades en cajas individuales con accesorios' },
  { id: 'CN-2026-2838', client: 'DTD-5277', clientName: 'BriceñoTex', supplier: 'Guangzhou Textile', boxes: 22, cbm: 6.2, weight: 2400, received: '2026-05-21', warehouse: 'CAN-C1', status: 'pendiente consolidación', shipment: null, hsCode: '5208.32', description: 'Tela de algodón crudo 100% · bobinas de 50m × 1.5m ancho · 22 rollos protegidos con plástico industrial' },
  { id: 'CN-2026-2837', client: 'DTD-5340', clientName: 'Dist. Andina', supplier: 'Yiwu Trade Mall', boxes: 14, cbm: 5.4, weight: 2100, received: '2026-05-20', warehouse: 'YIW-A1', status: 'pendiente consolidación', shipment: null, hsCode: '4202.92', description: 'Bolsos de cuero sintético · 7 modelos × 2 colores (negro/marrón) · 14 cajas con 50 unidades c/u' },
  { id: 'CN-2026-2836', client: 'DTD-5215', clientName: 'Ortiz Cosmetics', supplier: 'Shenzhen Beauty', boxes: 6, cbm: 3.4, weight: 1200, received: '2026-05-19', warehouse: 'SZX-A2', status: 'incidencia', shipment: null, hsCode: '3304.99', description: 'Maquillaje · labiales 4 tonos (3 cajas) + sombras paleta 12-pan (3 cajas) · ⚠ faltan 30 labiales según packing list' },
  { id: 'CN-2026-2835', client: 'DTD-5392', clientName: 'Polar', supplier: 'Industrial CN Grp', boxes: 42, cbm: 28.4, weight: 12400, received: '2026-05-18', warehouse: 'YIW-A1', status: 'consolidado', shipment: 'DTDU-472816', hsCode: '8418.50', description: 'Heladeras industriales vitrina 600L · acero inox · 42 unidades en pallets con espuma protectora · sello Polar' },
];

// ── Almacén VE (entregas) ────────────────────────────────────
const WAREHOUSE_VE = [
  { id: 'VE-2026-1182', client: 'DTD-5418', clientName: 'Imp. Pereira', shipment: 'DTDU-388157', boxes: 8, cbm: 8.2, port: 'LGU', received: '2026-05-23', delivery: 'pendiente', address: 'Av. Libertador, Caracas', status: 'liberado · listo para retiro' },
  { id: 'VE-2026-1181', client: 'DTD-5354', clientName: 'Castro Hermanos', shipment: 'DTDU-365044', boxes: 22, cbm: 56.0, port: 'PFI', received: '2026-05-14', delivery: '2026-05-15', address: 'Zona Industrial, Punto Fijo', status: 'entregado' },
  { id: 'VE-2026-1180', client: 'DTD-5298', clientName: 'Vargas & Asoc', shipment: 'DTDU-364299', boxes: 14, cbm: 24.2, port: 'PBL', received: null, delivery: null, address: 'Valencia, Carabobo', status: 'en tránsito' },
  { id: 'VE-2026-1179', client: 'DTD-5392', clientName: 'Polar', shipment: 'DTDU-419032', boxes: 38, cbm: 68.2, port: 'MAR', received: null, delivery: null, address: 'Maracaibo, Zulia', status: 'en aduana' },
];

// ── Leads CRM ────────────────────────────────────────────────
const LEADS = [
  { id: 'L-0148', name: 'Manuel Quintero',   company: 'Quintero Importaciones', source: 'Web · cotizador', stage: 'cotización', value: 14200, lastTouch: 'hace 2 días', owner: 'Martina Acuña', whatsapp: true,  city: 'Caracas',    notes: 'Interesado en LCL Yiwu→PBL mensual', industry: 'Retail' },
  { id: 'L-0147', name: 'Andrea Silva',       company: 'AS Comercial',           source: 'Instagram',       stage: 'demo',       value: 38400, lastTouch: 'hace 4 días', owner: 'Diego Núñez',   whatsapp: true,  city: 'Valencia',   notes: 'Mostró interés en FCL 20\' a Pto Cabello', industry: 'Mayorista' },
  { id: 'L-0146', name: 'Felipe Acosta',      company: 'F. Acosta Trading',      source: 'Referido',        stage: 'nuevo',      value: null,  lastTouch: 'hace 1 día',  owner: 'Martina Acuña', whatsapp: false, city: 'Maracaibo',  notes: 'Referido por Castro Hnos', industry: 'Comercial' },
  { id: 'L-0145', name: 'Lorena Bracho',      company: 'BrachoTex',              source: 'LinkedIn',        stage: 'propuesta',  value: 64200, lastTouch: 'hace 6 días', owner: 'Diego Núñez',   whatsapp: true,  city: 'Caracas',    notes: 'Textiles · negociando volumen anual', industry: 'Textil' },
  { id: 'L-0144', name: 'Ricardo Núñez',      company: 'RNT Logística',          source: 'Google Ads',      stage: 'descartado', value: null,  lastTouch: 'hace 2 sem',  owner: 'Martina Acuña', whatsapp: false, city: 'Barquisimeto', notes: 'No tenía volumen suficiente', industry: 'Servicios' },
  { id: 'L-0143', name: 'Camila Rivero',      company: 'Rivero & Hnos',          source: 'Web · cotizador', stage: 'ganado',     value: 28400, lastTouch: 'hace 1 sem',  owner: 'Diego Núñez',   whatsapp: true,  city: 'Valencia',   notes: 'Convertido · MARKBOX DTD-5476 asignado', industry: 'Retail' },
  { id: 'L-0142', name: 'Roberto Méndez',     company: 'Méndez Trading SA',      source: 'Web · cotizador', stage: 'nuevo',      value: null,  lastTouch: 'hace 5 h',    owner: 'Martina Acuña', whatsapp: true,  city: 'Caracas',    notes: 'Pidió cotización para electrónicos', industry: 'Tecnología' },
  { id: 'L-0141', name: 'Patricia Sánchez',   company: 'Sánchez Cosmetics',      source: 'Instagram',       stage: 'cotización', value: 22600, lastTouch: 'hace 3 días', owner: 'Martina Acuña', whatsapp: true,  city: 'Valencia',   notes: 'Cosmética desde Guangzhou', industry: 'Belleza' },
  { id: 'L-0140', name: 'Jorge Calderón',     company: 'Calderón Industrial',    source: 'Referido',        stage: 'demo',       value: 88200, lastTouch: 'hace 5 días', owner: 'Diego Núñez',   whatsapp: false, city: 'Maturín',    notes: 'Industrial · potencial Platinum', industry: 'Industrial' },
  { id: 'L-0139', name: 'Daniela Linares',    company: 'DL Importaciones',       source: 'LinkedIn',        stage: 'cotización', value: 18400, lastTouch: 'hace 1 día',  owner: 'Diego Núñez',   whatsapp: true,  city: 'Caracas',    notes: 'Decoración + muebles ligeros', industry: 'Retail' },
  { id: 'L-0138', name: 'Esteban Rojas',      company: 'Rojas Tech',             source: 'Web · cotizador', stage: 'propuesta',  value: 42800, lastTouch: 'hace 4 días', owner: 'Martina Acuña', whatsapp: true,  city: 'Mérida',     notes: 'Electrónica + accesorios', industry: 'Tecnología' },
  { id: 'L-0137', name: 'Adriana Castillo',   company: 'Castillo & Asoc.',       source: 'Google Ads',      stage: 'nuevo',      value: null,  lastTouch: 'hace 8 h',    owner: 'Martina Acuña', whatsapp: true,  city: 'Caracas',    notes: 'Distribución regional', industry: 'Mayorista' },
  { id: 'L-0136', name: 'Mariana Suárez',     company: 'Suárez Beauty',          source: 'Instagram',       stage: 'demo',       value: 16200, lastTouch: 'hace 7 días', owner: 'Diego Núñez',   whatsapp: true,  city: 'Caracas',    notes: 'Cosmética y cuidado personal', industry: 'Belleza' },
  { id: 'L-0135', name: 'Pedro Mejías',       company: 'Mejías Construcción',    source: 'Referido',        stage: 'ganado',     value: 54600, lastTouch: 'hace 2 sem',  owner: 'Martina Acuña', whatsapp: false, city: 'Valencia',   notes: 'MARKBOX DTD-5478 · primera importación lista', industry: 'Industrial' },
  { id: 'L-0134', name: 'Iván Pérez',         company: 'IP Comercializadora',    source: 'LinkedIn',        stage: 'descartado', value: null,  lastTouch: 'hace 3 sem',  owner: 'Diego Núñez',   whatsapp: false, city: 'Puerto La Cruz', notes: 'No respondió a propuesta', industry: 'Comercial' },
  { id: 'L-0133', name: 'Carolina Mendoza',   company: 'Mendoza Imports',        source: 'Web · cotizador', stage: 'propuesta',  value: 36800, lastTouch: 'hace 9 días', owner: 'Diego Núñez',   whatsapp: true,  city: 'Punto Fijo', notes: 'Cerrando negociación tarifa anual', industry: 'Retail' },
];

// ── Usuarios internos & roles ───────────────────────────────
const USERS = [
  { id: 'u-001', name: 'Carlos Vásquez',    email: 'cvasquez@dtdcargo.com',  role: 'Admin',             team: 'Dirección',     status: 'active',  lastLogin: 'hace 12 min',  twoFa: true,  avatar: 'CV', scope: { type: 'global', hubs: [] } },
  { id: 'u-002', name: 'Martina Acuña',     email: 'martina@dtdcargo.com',   role: 'Comercial',         team: 'Ventas',        status: 'active',  lastLogin: 'hace 4 min',   twoFa: true,  avatar: 'MA', scope: { type: 'global', hubs: [] } },
  { id: 'u-003', name: 'Diego Núñez',       email: 'diego@dtdcargo.com',     role: 'Comercial',         team: 'Ventas',        status: 'active',  lastLogin: 'hace 2 h',     twoFa: false, avatar: 'DN', scope: { type: 'global', hubs: [] } },
  { id: 'u-004', name: 'Luis Yáñez',        email: 'lyanez@dtdcargo.com',    role: 'Operaciones',       team: 'Op. CN',        status: 'active',  lastLogin: 'hace 38 min',  twoFa: true,  avatar: 'LY', scope: { type: 'scoped', hubs: ['YIW-A1','YIW-A2','CAN-C1','SZX-A2','SHA-A1'] } },
  { id: 'u-005', name: 'Yusneidy Pérez',    email: 'yperez@dtdcargo.com',    role: 'Operaciones',       team: 'Op. VE',        status: 'active',  lastLogin: 'hace 1 h',     twoFa: true,  avatar: 'YP', scope: { type: 'scoped', hubs: ['PBL','LGU','MAR','PFI'] } },
  { id: 'u-006', name: 'Andrés Briceño',    email: 'abriceno@dtdcargo.com',  role: 'Contabilidad',      team: 'Finanzas',      status: 'active',  lastLogin: 'hace 3 h',     twoFa: true,  avatar: 'AB', scope: { type: 'global', hubs: [] } },
  { id: 'u-007', name: 'Wang Hua',          email: 'wang@dtdcargo.com',      role: 'Almacén CN',        team: 'Op. CN',        status: 'active',  lastLogin: 'hace 24 min',  twoFa: false, avatar: 'WH', scope: { type: 'scoped', hubs: ['YIW-A1'] } },
  { id: 'u-008', name: 'Carolina Méndez',   email: 'cmendez@dtdcargo.com',   role: 'Soporte',           team: 'CX',            status: 'invited', lastLogin: '—',            twoFa: false, avatar: 'CM', scope: { type: 'global', hubs: [] } },
];

// ── Permisos por rol (qué módulos pueden ver) ───────────────
const ROLE_MODULES = {
  'Admin':        '*',  // todos
  'Comercial':    ['inicio', 'dashboard', 'shipments', 'tracking', 'calendar', 'quotes', 'clients', 'leads', 'suppliers', 'rates', 'invoices', 'cobranzas', 'documents', 'reports', 'mailing', 'conversaciones', 'fidelizacion'],
  'Operaciones':  ['inicio', 'dashboard', 'shipments', 'tracking', 'calendar', 'cn', 'qrqueue', 'labels', 've', 'despacho', 'despacho-rules', 'despacho-dashboard', 'seniat', 'tms', 'clients', 'documents', 'operarios', 'mailing', 'naviera'],
  'Contabilidad': ['inicio', 'dashboard', 'shipments', 'invoices', 'cobranzas', 'contab', 'reconcile', 'costing', 'documents', 'clients', 'reports', 'rates', 'tesoreria'],
  'Almacén CN':   ['inicio', 'dashboard', 'cn', 'qrqueue', 'labels', 'shipments', 'naviera'],
  'Almacén VE':   ['inicio', 'dashboard', 've', 'despacho', 'tracking', 'shipments'],
  'Soporte':      ['inicio', 'dashboard', 'shipments', 'tracking', 'clients', 'documents', 'mailing', 'conversaciones'],
};

// ── Tarifas ──────────────────────────────────────────────────
const RATES = [
  { id: 'r-01', service: 'LCL DDP', origin: 'YIW', destination: 'PBL', perCBM: 800, minCharge: 380, transit: 38, valid: '2026-12-31' },
  { id: 'r-02', service: 'LCL DDP', origin: 'YIW', destination: 'LGU', perCBM: 820, minCharge: 380, transit: 35, valid: '2026-12-31' },
  { id: 'r-03', service: 'LCL DDP', origin: 'YIW', destination: 'MAR', perCBM: 880, minCharge: 420, transit: 42, valid: '2026-12-31' },
  { id: 'r-04', service: 'LCL DDP', origin: 'YIW', destination: 'PFI', perCBM: 860, minCharge: 410, transit: 40, valid: '2026-12-31' },
  { id: 'r-05', service: 'LCL DDP', origin: 'CAN', destination: 'PBL', perCBM: 780, minCharge: 380, transit: 36, valid: '2026-12-31' },
  { id: 'r-06', service: 'LCL DDP', origin: 'SZX', destination: 'LGU', perCBM: 790, minCharge: 380, transit: 34, valid: '2026-12-31' },
  { id: 'r-07', service: 'LCL DDP', origin: 'SHA', destination: 'PBL', perCBM: 770, minCharge: 380, transit: 34, valid: '2026-12-31' },
  { id: 'r-08', service: 'FCL 20\'',  origin: 'YIW', destination: 'PBL', perCBM: null, flatRate: 3200, minCharge: null, transit: 32, valid: '2026-12-31' },
  { id: 'r-09', service: 'FCL 40\'',  origin: 'YIW', destination: 'PBL', perCBM: null, flatRate: 5400, minCharge: null, transit: 32, valid: '2026-12-31' },
  { id: 'r-10', service: 'FCL 40\'HC', origin: 'CAN', destination: 'MAR', perCBM: null, flatRate: 5800, minCharge: null, transit: 38, valid: '2026-12-31' },
];

// ── Documentos ───────────────────────────────────────────────
const DOCUMENTS = [
  { id: 'D-2026-0884', type: 'BL', shipment: 'DTDU-472816', client: 'DTD-5452', clientName: 'Acindar', issued: '2026-05-14', size: '482 KB', status: 'firmado' },
  { id: 'D-2026-0883', type: 'Packing List', shipment: 'DTDU-472816', client: 'DTD-5452', clientName: 'Acindar', issued: '2026-05-13', size: '124 KB', status: 'firmado' },
  { id: 'D-2026-0882', type: 'Factura comercial', shipment: 'DTDU-472816', client: 'DTD-5452', clientName: 'Acindar', issued: '2026-05-13', size: '88 KB',  status: 'firmado' },
  { id: 'D-2026-0881', type: 'BL', shipment: 'DTDU-419032', client: 'DTD-5392', clientName: 'Polar', issued: '2026-04-22', size: '496 KB', status: 'firmado' },
  { id: 'D-2026-0880', type: 'Packing List', shipment: 'DTDU-419032', client: 'DTD-5392', clientName: 'Polar', issued: '2026-04-21', size: '142 KB', status: 'firmado' },
  { id: 'D-2026-0879', type: 'POD', shipment: 'DTDU-365044', client: 'DTD-5354', clientName: 'Castro Hnos', issued: '2026-05-15', size: '218 KB', status: 'firmado' },
  { id: 'D-2026-0878', type: 'Factura comercial', shipment: 'DTDU-412908', client: 'DTD-5371', clientName: 'Tech Sol.', issued: '2026-05-19', size: '92 KB', status: 'pendiente firma' },
  { id: 'D-2026-0877', type: 'BL', shipment: 'DTDU-412908', client: 'DTD-5371', clientName: 'Tech Sol.', issued: '2026-05-19', size: '478 KB', status: 'pendiente firma' },
];

// ── Mailing templates (con body + i18n) ─────────────────────
const MAIL_TEMPLATES = [
  {
    id: 'm-01', name: 'Cotización enviada',
    subject: 'Tu cotización DTD-Cargo · {{quote_id}}',
    category: 'Cotizaciones', channel: 'email',
    sent: 248, opened: '78%',  clicked: '34%', updated: 'hace 2 días',
    active: true,
    langs: { es: true, en: true, zh: false },
    body: {
      es: `Hola {{client_name}},\n\nGracias por confiar en DTD-Cargo. Te paso la cotización para tu envío:\n\n**Cotización:** {{quote_id}}\n**Volumen:** {{cbm}} CBM\n**Total DDP:** ${'${{total_usd}}'}\n**Válida hasta:** {{valid_until}}\n\nLa tarifa incluye flete marítimo, aduana, impuestos y entrega final puerta a puerta.\n\n[Aceptar cotización →]({{accept_link}})\n\nQuedo a las órdenes,\n{{agent_name}}`,
      en: `Hi {{client_name}},\n\nThanks for choosing DTD-Cargo. Here's your shipping quote:\n\n**Quote:** {{quote_id}}\n**Volume:** {{cbm}} CBM\n**DDP Total:** ${'${{total_usd}}'}\n**Valid until:** {{valid_until}}\n\nRate includes sea freight, customs, taxes and final door delivery.\n\n[Accept quote →]({{accept_link}})\n\nBest,\n{{agent_name}}`,
    }
  },
  {
    id: 'm-02', name: 'Embarque confirmado',
    subject: 'Tu carga zarpó · {{shipment_id}}',
    category: 'Operativo', channel: 'email',
    sent: 184, opened: '92%', clicked: '61%', updated: 'hace 1 sem',
    active: true,
    langs: { es: true, en: true, zh: true },
    body: {
      es: `{{client_name}},\n\nTu embarque **{{shipment_id}}** zarpó hoy desde {{origin}} a bordo de **{{vessel}}**.\n\n**ETA {{destination}}:** {{eta}}\n**Días estimados:** {{transit_days}}\n\nSeguilo en vivo desde tu portal: [Tracking →]({{tracking_link}})\n\n— DTD-Cargo`,
      en: `{{client_name}},\n\nYour shipment **{{shipment_id}}** sailed today from {{origin}} aboard **{{vessel}}**.\n\n**ETA {{destination}}:** {{eta}}\n**Estimated days:** {{transit_days}}\n\nTrack it live: [Tracking →]({{tracking_link}})\n\n— DTD-Cargo`,
    }
  },
  {
    id: 'm-03', name: 'ETA en riesgo',
    subject: 'Demora prevista en {{shipment_id}} · +{{delay_days}} días',
    category: 'Alertas', channel: 'email',
    sent: 22, opened: '100%', clicked: '88%', updated: 'hace 3 sem',
    active: true,
    langs: { es: true, en: false, zh: false },
    body: { es: `{{client_name}},\n\nQueremos avisarte que tu embarque **{{shipment_id}}** podría demorarse aprox. **{{delay_days}} días** sobre la ETA original.\n\n**Motivo:** {{delay_reason}}\n**Nueva ETA estimada:** {{new_eta}}\n\nSeguimos monitoreando y te avisamos cualquier cambio.\n\n— {{agent_name}}` }
  },
  {
    id: 'm-04', name: 'POD firmado',
    subject: '{{shipment_id}} entregado · POD adjunto',
    category: 'Operativo', channel: 'email',
    sent: 142, opened: '84%', clicked: '46%', updated: 'hace 1 mes',
    active: true,
    langs: { es: true, en: true, zh: false },
    body: { es: `{{client_name}},\n\nTu embarque **{{shipment_id}}** fue entregado en {{destination}} y firmado por **{{signed_by}}**.\n\nAdjunto encontrás el POD (Proof of Delivery).\n\nGracias por elegir DTD-Cargo.` }
  },
  {
    id: 'm-05', name: 'Bienvenida MARKBOX',
    subject: 'Bienvenido a DTD-Cargo · tu código es {{markbox}}',
    category: 'Onboarding', channel: 'email',
    sent: 38, opened: '95%', clicked: '72%', updated: 'hace 2 sem',
    active: true,
    langs: { es: true, en: true, zh: true },
    body: { es: `¡Bienvenido {{client_name}}!\n\nTu cuenta en DTD-Cargo está activa.\n\n**Tu código MARKBOX:** \`{{markbox}}\`\n\nUsalo cuando coordines envíos desde China. Tus proveedores deben anotarlo en cada caja.\n\n**Acceso al portal:** [{{portal_link}}]({{portal_link}})\n\nDudas o ayuda → respondé este correo.` }
  },
  {
    id: 'm-06', name: 'Recordatorio de pago',
    subject: 'Factura {{invoice_id}} vencida hace {{days}} días',
    category: 'Finanzas', channel: 'email',
    sent: 12, opened: '83%', clicked: '41%', updated: 'hace 1 mes',
    active: true,
    langs: { es: true, en: false, zh: false },
    body: { es: `{{client_name}},\n\nTe recordamos que la factura **{{invoice_id}}** por **${'${{amount}}'}** se encuentra vencida hace **{{days}} días**.\n\nPodés regularizar el saldo desde el portal o contactando a finanzas@dtdcargo.com.\n\nGracias.` }
  },
  {
    id: 'm-07', name: 'Aviso ETA · WhatsApp',
    subject: '—',
    category: 'Operativo', channel: 'whatsapp',
    sent: 84, opened: '98%', clicked: '—', updated: 'hace 5 días',
    active: true,
    langs: { es: true, en: false, zh: false },
    body: { es: `📦 *DTD-Cargo*\n\nHola {{client_name}}, tu embarque {{shipment_id}} llegará a {{destination}} aprox. el *{{eta}}*.\n\nTrack: {{tracking_link}}` }
  },
];

// ── Firmas (una por usuario) ────────────────────────────────
const SIGNATURES = [
  { userId: 'u-001', layout: 'clasico',  active: true, name: 'Carlos Vásquez', role: 'Director · LATAM',           email: 'cvasquez@dtdcargo.com', phone: '+58 414 002 8854', photo: null, lang: 'es' },
  { userId: 'u-002', layout: 'foto',     active: true, name: 'Martina Acuña',  role: 'Account Director',           email: 'martina@dtdcargo.com',  phone: '+58 412 166 8021', photo: 'MA', lang: 'es' },
  { userId: 'u-003', layout: 'compacto', active: true, name: 'Diego Núñez',    role: 'Comercial',                  email: 'diego@dtdcargo.com',    phone: '+58 412 778 4421', photo: null, lang: 'es' },
  { userId: 'u-004', layout: 'vertical', active: true, name: 'Luis Yáñez',     role: 'Op. Manager · 中国',         email: 'lyanez@dtdcargo.com',   phone: '+86 137 5028 9114', photo: null, lang: 'es' },
  { userId: 'u-005', layout: 'minimo',   active: true, name: 'Yusneidy Pérez', role: 'Op. Manager · Venezuela',    email: 'yperez@dtdcargo.com',   phone: '+58 416 558 9012', photo: null, lang: 'es' },
];

const SIGNATURE_LAYOUTS = [
  { id: 'clasico',  name: 'Clásico',  desc: 'Logo + nombre + cargo + datos. El estándar de DTD.', width: 360 },
  { id: 'compacto', name: 'Compacto', desc: 'Una sola línea. Para emails operativos cortos.',     width: 460 },
  { id: 'vertical', name: 'Vertical', desc: 'Stack vertical con bordes. Más presencia visual.',   width: 280 },
  { id: 'minimo',   name: 'Mínimo',   desc: 'Solo nombre y email. Para internos.',                width: 280 },
  { id: 'foto',     name: 'Con foto', desc: 'Avatar circular a la izquierda. Para comercial.',    width: 420 },
];

// ── Proveedores chinos (suppliers) ──────────────────────────
const SUPPLIERS = [
  { id: 'sup-001', name: 'Yiwu Standard Trading Co', cn: '义乌标准贸易有限公司', city: 'Yiwu', cityCn: '义乌', province: 'Zhejiang', industry: 'General · Bazar', contactName: 'Wang Liu', contactCn: '王柳', phone: '+86 137 5728 4421', wechat: 'YiwuStd_Wang', email: 'wang@yiwustandard.com', address: '义乌市国际商贸城三区 5楼 218号', founded: 2008, employees: 42, rating: { onTime: 9.4, quality: 9.1, price: 8.7, comms: 9.5 }, status: 'preferido', shipments: 38, totalValue: 248000, lastDeal: '2026-05-22', notes: 'Excelente comunicación · acepta marcas y customización · paga MOQ bajo' },
  { id: 'sup-002', name: 'Shenzhen Lights Ltd',      cn: '深圳灯具有限公司',     city: 'Shenzhen',  cityCn: '深圳', province: 'Guangdong', industry: 'Iluminación LED', contactName: 'Zhang Min', contactCn: '张敏', phone: '+86 159 8842 1107', wechat: 'SZLights_Min', email: 'min@szlights.cn', address: '深圳市宝安区福永街道工业区 8栋', founded: 2014, employees: 86, rating: { onTime: 8.6, quality: 9.4, price: 8.2, comms: 8.0 }, status: 'aprobado', shipments: 22, totalValue: 142000, lastDeal: '2026-05-18', notes: 'Calidad consistente · packing impecable · WhatsApp lento, mejor WeChat' },
  { id: 'sup-003', name: 'Guangzhou Textile Mfg',    cn: '广州纺织制造',         city: 'Guangzhou', cityCn: '广州', province: 'Guangdong', industry: 'Textil · Indumentaria', contactName: 'Li Wei', contactCn: '李伟', phone: '+86 188 2266 9988', wechat: 'GZTextile_Wei', email: 'wei@gztextile.com.cn', address: '广州市番禺区市桥工业园 12号', founded: 2005, employees: 215, rating: { onTime: 9.0, quality: 8.8, price: 9.2, comms: 8.4 }, status: 'preferido', shipments: 31, totalValue: 198000, lastDeal: '2026-05-20', notes: 'MOQ alto · precios muy competitivos · cuidan al detalle el etiquetado' },
  { id: 'sup-004', name: 'Shanghai Tech Industries', cn: '上海科技工业',         city: 'Shanghai',  cityCn: '上海', province: 'Shanghai', industry: 'Electrónica',  contactName: 'Chen Jun', contactCn: '陈军', phone: '+86 134 8076 5544', wechat: 'SHTech_Chen', email: 'chen@shtech.cn', address: '上海市浦东新区张江高科技园区 18号', founded: 2011, employees: 124, rating: { onTime: 9.7, quality: 9.6, price: 7.8, comms: 9.2 }, status: 'preferido', shipments: 18, totalValue: 312000, lastDeal: '2026-05-21', notes: 'Tier alto · caro pero calidad asegurada · ideal para clientes Platinum' },
  { id: 'sup-005', name: 'Yiwu Trade Mall Wholesale', cn: '义乌商城批发',        city: 'Yiwu',      cityCn: '义乌', province: 'Zhejiang', industry: 'Mayorista bazar', contactName: 'Sun Hua', contactCn: '孙华', phone: '+86 180 0689 1419', wechat: 'YWTM_Sun',  email: 'sun@ywtm.cn',  address: '义乌市义乌港二期直通仓 2栋', founded: 2010, employees: 28, rating: { onTime: 8.2, quality: 7.8, price: 9.5, comms: 8.8 }, status: 'aprobado', shipments: 44, totalValue: 168000, lastDeal: '2026-05-22', notes: 'Coordina nuestro almacén YIW-A1 · precios muy bajos · cuidar control calidad' },
  { id: 'sup-006', name: 'Shenzhen Beauty Cosmetics', cn: '深圳美妆',           city: 'Shenzhen',  cityCn: '深圳', province: 'Guangdong', industry: 'Cosmética',    contactName: 'Lin Mei', contactCn: '林美', phone: '+86 138 2256 7700', wechat: 'SZBeauty_Lin', email: 'lin@szbeauty.cn', address: '深圳市龙岗区横岗街道工业园', founded: 2017, employees: 64, rating: { onTime: 8.4, quality: 8.6, price: 8.8, comms: 9.0 }, status: 'aprobado', shipments: 12, totalValue: 78000, lastDeal: '2026-05-19', notes: 'Requiere certificado sanitario VE · vencido en septiembre, renovar' },
  { id: 'sup-007', name: 'Industrial CN Group',      cn: '中国工业集团',         city: 'Guangzhou', cityCn: '广州', province: 'Guangdong', industry: 'Industrial pesado', contactName: 'Zhao Bo', contactCn: '赵博', phone: '+86 137 9988 4488', wechat: 'IndCN_Zhao', email: 'zhao@indcngroup.com', address: '广州市南沙区港前大道', founded: 2003, employees: 380, rating: { onTime: 9.2, quality: 9.0, price: 8.4, comms: 7.9 }, status: 'preferido', shipments: 24, totalValue: 412000, lastDeal: '2026-05-18', notes: 'Maneja cargas FCL grandes · contactos con navieras directos · clave para Polar' },
  { id: 'sup-008', name: 'Yiwu Lights Factory',      cn: '义乌灯具工厂',         city: 'Yiwu',      cityCn: '义乌', province: 'Zhejiang', industry: 'Iluminación · decoración', contactName: 'Wu Lan', contactCn: '吴兰', phone: '+86 156 4477 8821', wechat: 'YWLights_Lan', email: 'lan@ywlights.cn', address: '义乌市后宅街道双溪工业区', founded: 2015, employees: 38, rating: { onTime: 7.8, quality: 8.4, price: 9.1, comms: 8.2 }, status: 'observación', shipments: 8, totalValue: 42000, lastDeal: '2026-04-28', notes: '⚠ Dos demoras de 5+ días en Q1 · revisar performance antes de aceptar nuevos PO' },
];

// Cliente ↔ Proveedor relaciones
// wechatGroup = código del grupo WeChat de seguimiento de la compra:
// MARKBOX-N, donde N es el orden del proveedor dentro de la lista de ese cliente.
// El grupo es POR par cliente↔proveedor (cada cliente abre su propio grupo con cada supplier).
const SUPPLIER_CLIENTS = [
  { supplierId: 'sup-001', clientMarkbox: 'DTD-5452', favorite: true,  shipments: 14, totalValue: 84200, since: '2019-08', wechatGroup: 'DTD-5452-1' },
  { supplierId: 'sup-001', clientMarkbox: 'DTD-5340', favorite: false, shipments: 8,  totalValue: 38400, since: '2021-02', wechatGroup: 'DTD-5340-1' },
  { supplierId: 'sup-001', clientMarkbox: 'DTD-5298', favorite: false, shipments: 6,  totalValue: 28200, since: '2022-05', wechatGroup: 'DTD-5298-1' },
  { supplierId: 'sup-002', clientMarkbox: 'DTD-5418', favorite: true,  shipments: 12, totalValue: 78400, since: '2020-12', wechatGroup: 'DTD-5418-1' },
  { supplierId: 'sup-003', clientMarkbox: 'DTD-5277', favorite: true,  shipments: 18, totalValue: 128400, since: '2018-09', wechatGroup: 'DTD-5277-1' },
  { supplierId: 'sup-003', clientMarkbox: 'DTD-5263', favorite: false, shipments: 4,  totalValue: 18400, since: '2023-09', wechatGroup: 'DTD-5263-1' },
  { supplierId: 'sup-004', clientMarkbox: 'DTD-5371', favorite: true,  shipments: 11, totalValue: 158000, since: '2021-09', wechatGroup: 'DTD-5371-1' },
  { supplierId: 'sup-005', clientMarkbox: 'DTD-5452', favorite: false, shipments: 4,  totalValue: 16800, since: '2022-03', wechatGroup: 'DTD-5452-2' },
  { supplierId: 'sup-005', clientMarkbox: 'DTD-5340', favorite: true,  shipments: 22, totalValue: 88400, since: '2020-04', wechatGroup: 'DTD-5340-2' },
  { supplierId: 'sup-005', clientMarkbox: 'DTD-5354', favorite: false, shipments: 6,  totalValue: 24200, since: '2021-11', wechatGroup: 'DTD-5354-1' },
  { supplierId: 'sup-006', clientMarkbox: 'DTD-5215', favorite: true,  shipments: 8,  totalValue: 52400, since: '2021-04', wechatGroup: 'DTD-5215-1' },
  { supplierId: 'sup-007', clientMarkbox: 'DTD-5392', favorite: true,  shipments: 16, totalValue: 312000, since: '2017-08', wechatGroup: 'DTD-5392-1' },
  { supplierId: 'sup-007', clientMarkbox: 'DTD-5241', favorite: true,  shipments: 8,  totalValue: 98000, since: '2018-11', wechatGroup: 'DTD-5241-1' },
];

// ── Órdenes esperadas (mercancía en camino, registrada por el cliente) ──
// El cliente las crea al comprar en China. Código = MARKBOX-proveedor-compra,
// que ES el nombre del grupo WeChat de seguimiento (wechatGroup + nº de compra).
// El almacén CN solo VERIFICA sumatorias + docs; al confirmar pasa a recepción.
const ORDERS = [
  { code: 'DTD-5452-1-1', client: 'DTD-5452', supplierId: 'sup-001', boxes: 12, cbm: 6.4,  weight: 980,   packing: true,  invoice: true,  status: 'por verificar', eta: '2026-06-04', goods: 'Cables eléctricos + conectores' },
  { code: 'DTD-5392-1-2', client: 'DTD-5392', supplierId: 'sup-007', boxes: 42, cbm: 28.4, weight: 12400, packing: true,  invoice: true,  status: 'por verificar', eta: '2026-06-02', goods: 'Heladeras vitrina 600L' },
  { code: 'DTD-5418-1-1', client: 'DTD-5418', supplierId: 'sup-002', boxes: 8,  cbm: 4.2,  weight: 620,   packing: true,  invoice: false, status: 'en camino',     eta: '2026-06-10', goods: 'Lámparas LED 30/50W' },
  { code: 'DTD-5340-2-3', client: 'DTD-5340', supplierId: 'sup-005', boxes: 14, cbm: 5.4,  weight: 2100,  packing: false, invoice: true,  status: 'en camino',     eta: '2026-06-18', goods: 'Bolsos cuero sintético' },
  { code: 'DTD-5277-1-1', client: 'DTD-5277', supplierId: 'sup-003', boxes: 22, cbm: 6.2,  weight: 2400,  packing: true,  invoice: true,  status: 'verificada',    eta: '2026-06-06', goods: 'Tela algodón crudo · 22 rollos' },
];
const SMTP_PROVIDERS = [
  { id: 'gmail',    name: 'Google Workspace',   type: 'oauth', icon: 'mail',  configured: true,  active: true,  account: 'comercial@dtdcargo.com', sent30d: 1840 },
  { id: 'outlook',  name: 'Microsoft 365',      type: 'oauth', icon: 'mail',  configured: false, active: false, account: null, sent30d: 0 },
  { id: 'smtp',     name: 'SMTP genérico',      type: 'smtp',  icon: 'cog',   configured: true,  active: false, account: 'smtp.dtdcargo.com:587', sent30d: 0 },
  { id: 'sendgrid', name: 'SendGrid',           type: 'api',   icon: 'spark', configured: false, active: false, account: null, sent30d: 0 },
  { id: 'postmark', name: 'Postmark',           type: 'api',   icon: 'spark', configured: false, active: false, account: null, sent30d: 0 },
  { id: 'resend',   name: 'Resend',             type: 'api',   icon: 'spark', configured: false, active: false, account: null, sent30d: 0 },
  { id: 'whatsapp', name: 'WhatsApp Business',  type: 'api',   icon: 'globe', configured: true,  active: true,  account: '+58 412 DTD-CARG', sent30d: 84 },
];

// ── Blacklist destinatarios ─────────────────────────────────
const BLACKLIST = [
  { email: 'spam-test@example.com',     reason: 'rebote permanente',          added: '2026-04-12', addedBy: 'sistema' },
  { email: 'comunicaciones@expe.ve',    reason: 'unsubscribe manual',         added: '2026-04-22', addedBy: 'sistema' },
  { email: 'noreply@oldsupplier.cn',    reason: 'mailbox inexistente',        added: '2026-05-02', addedBy: 'sistema' },
  { email: 'ventas@competidor.com',     reason: 'agregado manualmente',       added: '2026-05-10', addedBy: 'Carlos V.' },
];

// ── Catálogo de variables ──────────────────────────────────
const TEMPLATE_VARIABLES = [
  { group: 'Cliente',   tag: '{{client_name}}',  desc: 'Nombre de contacto del cliente' },
  { group: 'Cliente',   tag: '{{client_company}}', desc: 'Razón social' },
  { group: 'Cliente',   tag: '{{markbox}}',      desc: 'Código MARKBOX (DTD-XXXX)' },
  { group: 'Cliente',   tag: '{{client_email}}', desc: 'Email del contacto' },
  { group: 'Cliente',   tag: '{{client_phone}}', desc: 'Teléfono' },
  { group: 'Cliente',   tag: '{{client_city}}',  desc: 'Ciudad' },
  { group: 'Embarque',  tag: '{{shipment_id}}',  desc: 'ID del embarque (DTDU-XXXXXX)' },
  { group: 'Embarque',  tag: '{{origin}}',       desc: 'Puerto/hub de origen' },
  { group: 'Embarque',  tag: '{{destination}}',  desc: 'Puerto de destino VE' },
  { group: 'Embarque',  tag: '{{vessel}}',       desc: 'Naviera asignada' },
  { group: 'Embarque',  tag: '{{etd}}',          desc: 'Fecha estimada de zarpe' },
  { group: 'Embarque',  tag: '{{eta}}',          desc: 'Fecha estimada de arribo' },
  { group: 'Embarque',  tag: '{{cbm}}',          desc: 'Volumen en CBM' },
  { group: 'Embarque',  tag: '{{transit_days}}', desc: 'Días de tránsito estimado' },
  { group: 'Embarque',  tag: '{{tracking_link}}',desc: 'URL al tracking del envío' },
  { group: 'Cotización',tag: '{{quote_id}}',     desc: 'ID de la cotización' },
  { group: 'Cotización',tag: '{{total_usd}}',    desc: 'Total cotización USD' },
  { group: 'Cotización',tag: '{{valid_until}}',  desc: 'Fecha de vencimiento' },
  { group: 'Cotización',tag: '{{accept_link}}',  desc: 'Link para aceptar' },
  { group: 'Facturación',tag: '{{invoice_id}}',   desc: 'ID de la factura' },
  { group: 'Facturación',tag: '{{amount}}',       desc: 'Monto total' },
  { group: 'Facturación',tag: '{{days}}',         desc: 'Días vencida' },
  { group: 'Sistema',    tag: '{{agent_name}}',   desc: 'Nombre del agente DTD' },
  { group: 'Sistema',    tag: '{{portal_link}}',  desc: 'URL al portal del cliente' },
  { group: 'Sistema',    tag: '{{signed_by}}',    desc: 'Persona que firmó el POD' },
  { group: 'Sistema',    tag: '{{delay_days}}',   desc: 'Días de demora' },
  { group: 'Sistema',    tag: '{{delay_reason}}', desc: 'Motivo de la demora' },
  { group: 'Sistema',    tag: '{{new_eta}}',      desc: 'Nueva ETA estimada' },
];

// ── Notificaciones (feed) ───────────────────────────────────
const NOTIFS = [
  { id: 'n-01', t: 'DTDU-472816 cruzó Canal de Panamá',  m: 'hace 3 min',  type: 'tracking', tone: 'wine' },
  { id: 'n-02', t: 'Cotización Q-2026-0419 aceptada',     m: 'hace 14 min', type: 'sales',    tone: 'success' },
  { id: 'n-03', t: 'Pago confirmado · F-2026-0391',       m: 'hace 1 h',    type: 'finance',  tone: 'success' },
  { id: 'n-04', t: 'DTDU-419032 · ETA +2 días',           m: 'hace 2 h',    type: 'alert',    tone: 'warning' },
  { id: 'n-05', t: 'Nuevo lead · F. Acosta Trading',      m: 'hace 3 h',    type: 'crm',      tone: 'info' },
  { id: 'n-06', t: 'CN-2026-2841 recibido en Yiwu',       m: 'hace 5 h',    type: 'warehouse',tone: 'info' },
];

// ── KPIs Dashboard ──────────────────────────────────────────
const KPIS = {
  shipmentsActive: { value: 24, delta: '+3', tone: 'wine' },
  onTime:          { value: '99.4%', delta: '+0.6 Q1', tone: 'success' },
  monthRevenue:    { value: '$284K', delta: '+12%',  tone: 'success' },
  newLeads:        { value: 18, delta: '+5 sem',     tone: 'info' },
  invoicesDue:     { value: 4,  delta: '$162K total', tone: 'warning' },
  cbmInTransit:    { value: 412, delta: 'CBM',       tone: 'neutral' },
};

// ── Multi-tenant ─────────────────────────────────────────────
// ── Multi-tenant (estructura "Highway") ──────────────────────
// Cada tenant es una EMPRESA distinta y aislada que usa el sistema
// (NO son sucursales de DTD). En DTD-Cargo el tenant es invisible:
// operamos como la empresa 'dtd'. "Cambiar de empresa" = salir de
// esta e ingresar a otra (no se muestran sucursales en la UI).
const HOME_TENANT = 'dtd';
const TENANTS = [
  { id: 'dtd',      name: 'DTD-Cargo',          short: 'DTD', region: 'Venezuela · CN→VE',        plan: 'Enterprise', prefix: 'DTD', home: true },
  { id: 'andes',    name: 'Andes Import CA',    short: 'AND', region: 'Empresa aparte · Highway', plan: 'Pro',        prefix: 'AND' },
  { id: 'pacifico', name: 'Pacífico Logística', short: 'PAC', region: 'Empresa aparte · Highway', plan: 'Pro',        prefix: 'PAC' },
];

// Toda la data de DTD pertenece a UNA empresa (tenant 'dtd').
const _cityTenant = () => HOME_TENANT;

// 1) CLIENTS
CLIENTS.forEach(c => { c.tenantId = HOME_TENANT; });
const _clientTenant = {};
CLIENTS.forEach(c => { _clientTenant[c.markbox] = c.tenantId; });
const _byClient = (markbox) => _clientTenant[markbox] || HOME_TENANT;

// 2) Entidades vinculadas a cliente (markbox)
SHIPMENTS.forEach(s => { s.tenantId = _byClient(s.client); });
INVOICES.forEach(i => { i.tenantId = _byClient(i.client); });
QUOTES.forEach(q => { q.tenantId = _byClient(q.client); });
WAREHOUSE_CN.forEach(w => { w.tenantId = _byClient(w.client); });
WAREHOUSE_VE.forEach(w => { w.tenantId = _byClient(w.client); });
DOCUMENTS.forEach(d => { d.tenantId = _byClient(d.client); });
SUPPLIER_CLIENTS.forEach(sc => { sc.tenantId = _byClient(sc.clientMarkbox); });
ORDERS.forEach(o => { o.tenantId = _byClient(o.client); });

// 3) LEADS por ciudad
LEADS.forEach(l => { l.tenantId = _cityTenant(l.city); });

// 4) SUPPLIERS: tenant = el que más le compra (mayoría de SUPPLIER_CLIENTS)
SUPPLIERS.forEach(sup => {
  const tally = {};
  SUPPLIER_CLIENTS.filter(sc => sc.supplierId === sup.id)
    .forEach(sc => { tally[sc.tenantId] = (tally[sc.tenantId] || 0) + (sc.shipments || 1); });
  sup.tenantId = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0] || HOME_TENANT;
});

// Estado global del tenant activo (mismo patrón que dtd-hide-values / flags)
const _TENANT_KEY = 'dtd-current-tenant';
function _initTenant() {
  try {
    const saved = localStorage.getItem(_TENANT_KEY);
    if (saved && TENANTS.some(t => t.id === saved)) return saved;
  } catch (e) {}
  return HOME_TENANT;   // DTD opera como su propia empresa (tenant invisible)
}
if (window.__currentTenant == null) window.__currentTenant = _initTenant();

const _tenantApi = {
  TENANTS,
  COMPANIES: TENANTS,
  HOME_TENANT,
  currentTenant: () => window.__currentTenant || HOME_TENANT,
  isHomeTenant: () => (window.__currentTenant || HOME_TENANT) === HOME_TENANT,
  tenant: (id) => TENANTS.find(t => t.id === id) || null,
  tenantCodePrefix: () => (TENANTS.find(t => t.id === window.__currentTenant)?.prefix) || 'DTD',
  setTenant: (id) => {
    window.__currentTenant = id;
    try { localStorage.setItem(_TENANT_KEY, id); } catch (e) {}
    window.dispatchEvent(new CustomEvent('dtd-tenant-changed', { detail: id }));
  },
  // Filtra por la empresa (tenant) activa. Filas sin tenantId pasan
  // (infra compartida: flota, plantillas). 'all' = sin filtro.
  byTenant: (rows) => {
    const t = window.__currentTenant || HOME_TENANT;
    if (t === 'all' || !Array.isArray(rows)) return rows;
    return rows.filter(r => !r || r.tenantId == null || r.tenantId === t);
  },
};

// ── Catálogo de Servicios y Tarifas (única fuente de verdad) ──
// Lo consumen: módulo Servicios y Tarifas, cotizador y facturación.
// Cada ítem tiene tarifa vigente (rate + from/to) e historial.
const CATALOG_ITEMS = [
  { id: 's1', type: 'servicio', code: 'SRV-LCL',     name: 'Flete marítimo LCL · DDP', unit: 'CBM',      desc: 'Consolidado puerta a puerta CN → VE', rate: 185, from: '2026-05-01', to: '2026-06-30',
    supplierRates: [
      { name: 'Evergreen', price: 175, to: '2026-06-10' },
      { name: 'MSC', price: 182, to: '2026-06-20' },
      { name: 'COSCO', price: 178, to: '2026-06-30' },
      { name: 'Maersk', price: 185, to: '2026-07-15' },
      { name: 'Hapag-Lloyd', price: 190, to: '2026-08-01' },
    ],
    history: [{ rate: 172, from: '2026-03-01', to: '2026-04-30' }, { rate: 165, from: '2026-01-01', to: '2026-02-28' }] },
  { id: 's2', type: 'servicio', code: 'SRV-ADU',     name: 'Despacho aduanal',         unit: 'envío',    desc: 'Gestión SENIAT + nacionalización', rate: 120, from: '2026-04-15', to: '2026-07-15', history: [{ rate: 110, from: '2026-01-15', to: '2026-04-14' }] },
  { id: 's3', type: 'servicio', code: 'SRV-ALM-CN',  name: 'Almacenaje en China',      unit: 'CBM/mes',  desc: 'Bodega Yiwu · primeros 15 días libres', rate: 8, from: '2026-05-01', to: '2026-06-12', history: [{ rate: 7, from: '2026-02-01', to: '2026-04-30' }] },
  { id: 's4', type: 'servicio', code: 'SRV-MILLA',   name: 'Última milla · Venezuela', unit: 'envío',    desc: 'Entrega nacional desde Valencia', rate: 35, from: '2026-03-01', to: '2026-05-20', history: [{ rate: 32, from: '2025-11-01', to: '2026-02-28' }] },
  { id: 's5', type: 'servicio', code: 'SRV-SEG',     name: 'Seguro de carga',          unit: '% valor',  desc: 'Cobertura todo riesgo sobre valor CIF', rate: 1.2, from: '2026-01-01', to: '2026-12-31', history: [] },

  { id: 'n1', type: 'no_inv', code: 'REC-BAF',   name: 'Recargo combustible (BAF)', unit: 'CBM',   desc: 'Ajuste por flete · variable mensual', rate: 14, from: '2026-05-01', to: '2026-05-31', history: [{ rate: 11, from: '2026-04-01', to: '2026-04-30' }] },
  { id: 'n2', type: 'no_inv', code: 'DOC-GEST',  name: 'Gestión documental',        unit: 'envío', desc: 'BL, packing list, certificados', rate: 18, from: '2026-01-01', to: '2026-12-31', history: [] },
  { id: 'n3', type: 'no_inv', code: 'INSP-3RO',  name: 'Inspección de terceros',    unit: 'envío', desc: 'Al costo · proveedor externo', rate: 45, from: '2026-02-01', to: '2026-08-01', history: [] },

  { id: 'i1', type: 'inventario', code: 'INV-CAJA',   name: 'Caja master 60×40×40', unit: 'unidad', desc: 'Cartón doble corrugado', rate: 2.5, cost: 1.4, stock: 320, reorder: 100, from: '2026-04-01', to: '2026-09-30', history: [] },
  { id: 'i2', type: 'inventario', code: 'INV-PALLET', name: 'Pallet de madera',     unit: 'unidad', desc: 'Estándar 1.2×1.0 m', rate: 12, cost: 7, stock: 28, reorder: 40, from: '2026-04-01', to: '2026-09-30', history: [] },
  { id: 'i3', type: 'inventario', code: 'INV-QR',     name: 'Etiqueta QR adhesiva', unit: 'unidad', desc: 'Trazabilidad de bultos', rate: 0.3, cost: 0.12, stock: 1500, reorder: 500, from: '2026-01-01', to: '2026-12-31', history: [] },
  { id: 'i4', type: 'inventario', code: 'INV-FILM',   name: 'Film stretch',         unit: 'rollo',  desc: 'Embalaje de pallets', rate: 6, cost: 3.5, stock: 14, reorder: 20, from: '2026-03-01', to: '2026-08-31', history: [] },

  { id: 'g1', type: 'grupo', code: 'GRP-DDP',  name: 'DDP Puerta a Puerta', unit: 'envío', desc: 'El combo estrella · todo incluido', components: ['SRV-LCL', 'SRV-ADU', 'SRV-MILLA', 'SRV-SEG'], from: '2026-05-01', to: '2026-06-30', history: [] },
  { id: 'g2', type: 'grupo', code: 'GRP-ECOM', name: 'Combo e-commerce',    unit: 'envío', desc: 'Para tiendas online · con materiales', components: ['SRV-LCL', 'SRV-MILLA', 'INV-CAJA', 'INV-QR'], from: '2026-05-01', to: '2026-07-31', history: [] },
];
const _catByCode = (c) => CATALOG_ITEMS.find(x => x.code === c);
const _catGroupTotal = (item) => (item.components || []).reduce((a, c) => a + (_catByCode(c)?.rate || 0), 0);
const _catDisplayRate = (item) => item && item.type === 'grupo' ? _catGroupTotal(item) : (item ? item.rate : 0);
const CATALOG = {
  ITEMS: CATALOG_ITEMS,
  INCOME_ACCTS: ['Ventas envío marítimo · CBM', 'Ventas envío marítimo · Consolidado China', 'Servicio de transporte · China', 'Servicio de transporte · Nacional', 'Peso extra', 'Ingresos de envío', 'Bodegaje', 'Comisión por envío de dinero', 'Compra asistida', 'Registro de marca', 'Trámite visa China', 'Validación de proveedores', 'Descuento en venta'],
  EXPENSE_ACCTS: ['Costos fletes · Envío marítimo', 'Costos fletes · Transporte China', 'Costos fletes · Extras en origen China', 'Costos fletes · Encomienda y despacho', 'Comisión envío dinero', 'Costo de inspección', 'Costo compra asistida', 'Costo registro de marca', 'Costo trámite visa China', 'Validación de proveedor', 'Gastos de oficina · Compras', 'Comisiones bancarias'],
  CATEGORIES: ['Envío marítimo', 'Transporte China', 'Transporte nacional', 'Peso extra', 'Bodegaje', 'Compra asistida', 'Registro de marca', 'Visa China', 'Validación de proveedores', 'Otros'],
  AUTHORS: ['Martina Acuña', 'Carlos Vásquez', 'Diego Núñez'],
  SUPPLIERS_CN: ['Yiwu Standard Trading', 'Shenzhen Lights Ltd', 'Guangzhou Textile Mfg', 'Industrial CN Group', 'Yiwu Trade Mall'],
  PROVIDERS: ['COSCO', 'Maersk', 'MSC', 'Evergreen', 'Hapag-Lloyd', 'ONE', 'CMA CGM', 'Yiwu Standard Trading'],
  byCode: _catByCode,
  groupTotal: _catGroupTotal,
  displayRate: _catDisplayRate,
  // Tarifa vigente de un código (grupo = suma de componentes)
  rateOf: (code) => _catDisplayRate(_catByCode(code)),
  // Ítems vendibles (servicios + no_inv + grupos + inventario), formato SearchSelect
  lineOptions: () => CATALOG_ITEMS.map(it => ({
    value: it.code,
    label: `${it.name}`,
    sub: `${it.code} · $${_catDisplayRate(it)}/${it.unit}`,
  })),
};

// ── Perfiles de usuario interno (movido desde usuario-perfil-data.jsx · v2.4) ─
/* ── Perfil de usuario interno · standalone ──────────────────── */
/* Abre al click en @mención (comments) u owner (Vault, asignados).  */
/* Patrón espejo de chofer-perfil / camion-perfil / agente-perfil.   */

// ── Líneas corporativas por departamento (dadas por el cliente) ─
const CORP_LINES = {
  'Dirección':  { label: 'CEO · Dirección',        phone: '0414 884 0000' },
  'Ventas':     { label: 'Comercial',              phone: '0412 454 5325' },
  'Op. CN':     { label: 'Logística',              phone: '0414 888 8805' },
  'Op. VE':     { label: 'Transporte',             phone: '0412 495 0884' },
  'Finanzas':   { label: 'Contabilidad',           phone: '0414 887 0000' },
  'CX':         { label: 'CRM · Atención cliente',  phone: '0412 166 8021', whatsappApi: true },
  'Admin':      { label: 'Administración',          phone: '0241 414 7886' },
};

// ── Extra mock data por usuario ───────────────────────────────
const USER_PROFILES = {
  'u-001': {
    avatarColor: 'wine', roleIcon: 'bigboss',
    phone: '0414 884 0000', location: 'Caracas · HQ', presence: 'online',
    lastActive: 'activo ahora', joined: '2019-02-01', title: 'Director General · CEO',
    activity: [
      { icon: 'check', text: 'Aprobó cierre de contenedor DTDU-419032', mod: 'cn', when: 'hace 8 min' },
      { icon: 'invoice', text: 'Autorizó nota de crédito F-2026-0418', mod: 'invoices', when: 'hace 1 h' },
      { icon: 'users', text: 'Creó usuario Carolina Méndez (Soporte)', mod: 'users', when: 'hace 3 h' },
      { icon: 'doc', text: 'Firmó BL DTDU472816-OR', mod: 'documents', when: 'ayer 17:40' },
    ],
    owns: { label: 'Aprobaciones pendientes', count: 3, mod: 'dashboard', items: ['Cierre contenedor CN', 'Límite crédito DTD-5392', 'Baja proveedor sup-007'] },
    note: 'Acceso total. Único rol que aprueba límites de crédito y bajas de proveedor.',
  },
  'u-002': {
    avatarColor: 'info', roleIcon: 'compras',
    phone: '0412 454 5325', location: 'Yiwu · CN (viaje)', presence: 'online',
    lastActive: 'activo ahora', joined: '2021-06-14', title: 'Ejecutiva comercial senior',
    activity: [
      { icon: 'box', text: 'Creó cotización Q-2026-0331 · DTD-5418', mod: 'quotes', when: 'hace 4 min' },
      { icon: 'users', text: 'Registró lead Comercial Linares', mod: 'leads', when: 'hace 2 h' },
      { icon: 'mail', text: 'Envió seguimiento a DTD-5371', mod: 'mailing', when: 'hace 5 h' },
    ],
    owns: { label: 'Clientes asignados', count: 12, mod: 'clients', items: ['DTD-5418 Imp. Pereira', 'DTD-5371 Tech Solutions', 'DTD-5263 Comercial Linares'] },
    note: 'De viaje en CN coordinando suppliers. Responde por WhatsApp.',
  },
  'u-003': {
    avatarColor: 'info', roleIcon: 'compras',
    phone: '0412 160 5202', location: 'Caracas · HQ', presence: 'away',
    lastActive: 'hace 2 h', joined: '2022-01-10', title: 'Ejecutivo comercial',
    activity: [
      { icon: 'box', text: 'Actualizó embarque DTDU-388157', mod: 'shipments', when: 'hace 2 h' },
      { icon: 'users', text: 'Movió lead a "negociación"', mod: 'leads', when: 'ayer' },
    ],
    owns: { label: 'Clientes asignados', count: 7, mod: 'clients', items: ['DTD-5298 Vargas & Asoc', 'DTD-5215 Ortiz Cosmetics'] },
    note: '',
  },
  'u-004': {
    avatarColor: 'success', roleIcon: 'logistica',
    phone: '0414 888 8805', location: 'Yiwu · Almacén CN', presence: 'online',
    lastActive: 'activo ahora', joined: '2020-09-22', title: 'Coordinador de operaciones CN',
    activity: [
      { icon: 'warehouse', text: 'Consolidó contenedor · 48.2 CBM', mod: 'cn', when: 'hace 12 min' },
      { icon: 'box', text: 'Procesó recepción de 34 cajas · DTD-5452', mod: 'cn', when: 'hace 1 h' },
      { icon: 'truck', text: 'Cerró despacho DESP-2026-0188', mod: 'despacho', when: 'hace 4 h' },
    ],
    owns: { label: 'Embarques en su hub', count: 9, mod: 'shipments', items: ['DTDU-472816 (consolidando)', 'DTDU-398770 (recibido CN)', 'DTDU-401234 (consolidado)'] },
    note: 'Líder del equipo de Yiwu. Maneja el modo despacho de contenedores.',
  },
  'u-005': {
    avatarColor: 'success', roleIcon: 'almacenista',
    phone: '0412 495 0884', location: 'Puerto Cabello · Almacén VE', presence: 'online',
    lastActive: 'activo ahora', joined: '2021-03-08', title: 'Coordinadora de operaciones VE',
    activity: [
      { icon: 'warehouse', text: 'Desconsolidó DTDU-365044 · 56 CBM', mod: 've', when: 'hace 30 min' },
      { icon: 'truck', text: 'Asignó chofer a entrega Valencia', mod: 'tms', when: 'hace 2 h' },
    ],
    owns: { label: 'Entregas activas', count: 5, mod: 've', items: ['DTDU-365044 → Punto Fijo', 'DTDU-419032 → Maracaibo'] },
    note: '',
  },
  'u-006': {
    avatarColor: 'wine', roleIcon: 'contabilidad',
    phone: '0414 887 0000', location: 'Caracas · HQ', presence: 'away',
    lastActive: 'hace 3 h', joined: '2020-05-18', title: 'Contador general',
    activity: [
      { icon: 'invoice', text: 'Concilió 14 movimientos bancarios', mod: 'reconcile', when: 'hace 3 h' },
      { icon: 'invoice', text: 'Emitió F-2026-0431 · DTD-5354', mod: 'invoices', when: 'ayer' },
      { icon: 'doc', text: 'Cerró período contable abril', mod: 'contab', when: 'hace 2 d' },
    ],
    owns: { label: 'Facturas por cobrar', count: 8, mod: 'invoices', items: ['F-2026-0418 vencida 10d', 'F-2026-0425 vence en 3d'] },
    note: 'Único con permiso de lock de período contable.',
  },
  'u-007': {
    avatarColor: 'neutral', roleIcon: 'almacenista',
    phone: '0414 888 8805', location: 'Yiwu · Almacén CN', presence: 'online',
    lastActive: 'activo ahora', joined: '2022-08-30', title: 'Almacenista CN',
    activity: [
      { icon: 'box', text: 'Escaneó grupo de 20 cajas · DTD-5277', mod: 'cn', when: 'hace 6 min' },
      { icon: 'warehouse', text: 'Etiquetó mercancía frágil', mod: 'cn', when: 'hace 1 h' },
    ],
    owns: { label: 'Recepciones de hoy', count: 6, mod: 'cn', items: ['DTD-5277 · 20 cajas', 'DTD-5452 · 34 cajas'] },
    note: 'Opera la app móvil de Operario CN (escaneo + recepción).',
  },
  'u-008': {
    avatarColor: 'wine', roleIcon: 'administracion',
    phone: '0412 166 8021', location: 'Caracas · HQ', presence: 'offline',
    lastActive: 'invitación pendiente', joined: '—', title: 'Atención al cliente · CRM',
    activity: [],
    owns: { label: 'Tickets asignados', count: 0, mod: 'dashboard', items: [] },
    note: 'Usuaria recién invitada — todavía no activó su cuenta.',
  },
};

const PRESENCE = {
  online:  { tone: 'success', label: 'En línea' },
  away:    { tone: 'warning', label: 'Ausente' },
  offline: { tone: 'neutral', label: 'Desconectado' },
};

// ── Hilos de comentarios (movido desde hilo-comentario.jsx · v2.4) ─
const THREADS = {
  't-472816': {
    record: { id: 'DTDU-472816', type: 'Embarque', mod: 'shipments', label: 'Acindar Comercial · FCL 20\' · Yiwu → Pto Cabello' },
    created: 'hace 2 días', status: 'abierto',
    root: {
      id: 'c1', author: 'u-002', at: 'hace 2 días',
      body: 'Yusneidy, este es el contenedor que está pasando por Panamá. Avisame cuando libere aduana así arranco el booking del flete interno. @Yusneidy P. ¿tenemos fecha tentativa de arribo a Pto Cabello?',
      mentions: ['u-005'], reactions: { '👍': ['u-005', 'u-001'] },
      replies: [
        { id: 'r1', author: 'u-005', at: 'hace 2 días', body: '@Martina A. recibido. Lo estoy monitoreando — ETA Pto Cabello sigue para el 12 jun. En cuanto el agente confirme liberación te aviso acá mismo.', mentions: ['u-002'], reactions: { '✓': ['u-002'] }, replies: [
          { id: 'r1a', author: 'u-002', at: 'hace 1 día', body: 'Perfecto, gracias. Dejo agendado el flete tentativo para el 13.', mentions: [], reactions: {}, replies: [] },
        ] },
        { id: 'r2', author: 'u-001', at: 'hace 6 h', body: 'Cliente confirmó disponibilidad de recepción en Valencia. @Diego N. asegurate que el reparto esté coordinado con el chofer asignado.', mentions: ['u-003'], reactions: { '👀': ['u-003'] }, replies: [
          { id: 'r2a', author: 'u-003', at: 'hace 5 h', body: 'Coordinado. Chofer Luis Hernández (T-001) confirmado para el 13 a primera hora.', mentions: [], reactions: { '🔥': ['u-001', 'u-002'] }, replies: [] },
        ] },
      ],
    },
  },
  't-0418': {
    record: { id: 'F-2026-0418', type: 'Factura', mod: 'invoices', label: 'Acindar Comercial · $84.2K · vencida hace 10 días' },
    created: 'hace 4 h', status: 'abierto',
    root: {
      id: 'c30', author: 'u-006', at: 'hace 4 h',
      body: 'Factura vencida hace 10 días. @Martina A. ¿podés llamar al cliente? Ya mandamos 2 recordatorios automáticos sin respuesta.',
      mentions: ['u-002'], reactions: {},
      replies: [
        { id: 'fr1', author: 'u-002', at: 'hace 3 h', body: 'Lo llamo hoy. Carlos me comentó la semana pasada que estaban esperando liberar el contenedor para pagar. @Andrés B. ¿le damos 5 días más?', mentions: ['u-006'], reactions: {}, replies: [] },
      ],
    },
  },
};


// ── Bloques consolidados v2.4 · movidos acá desde sus módulos/pantallas ─
// (antes vivían inline en qr-queue, dashboard, audit-log, conciliacion y
//  las pantallas de perfil; ahora fuente única vía window.ERPData)
const PRINT_ORDERS = [
  { id: 'QR-2026-1118', markbox: 'DTD-7842', client: 'Polar C.A.',           bultos: 18, warehouse: 'cn-yiwu',      supplier: 'Yiwu Trading Hub Co.',    sentBy: 'Liu Wei',    sentByPhone: '+86 138 8829', sentAt: '2026-05-24 09:42', priority: 'urgent', status: 'pendiente', notes: 'Cliente pasa esta tarde — armar paquete listo' },
  { id: 'QR-2026-1117', markbox: 'DTD-7842', client: 'Polar C.A.',           bultos: 24, warehouse: 'cn-yiwu',      supplier: 'Ningbo Textile Group',    sentBy: 'Liu Wei',    sentByPhone: '+86 138 8829', sentAt: '2026-05-24 09:38', priority: 'urgent', status: 'pendiente', notes: '' },
  { id: 'QR-2026-1116', markbox: 'DTD-9104', client: 'Acindar Industrial',   bultos: 12, warehouse: 'cn-guangzhou', supplier: 'Foshan Steel Parts',      sentBy: 'Chen Min',   sentByPhone: '+86 159 2147', sentAt: '2026-05-24 09:14', priority: 'normal', status: 'pendiente', notes: '' },
  { id: 'QR-2026-1115', markbox: 'DTD-5621', client: 'Tech Solutions',       bultos:  6, warehouse: 'cn-yiwu',      supplier: 'Shenzhen Electronics Ltd', sentBy: 'Liu Wei',    sentByPhone: '+86 138 8829', sentAt: '2026-05-24 08:51', priority: 'normal', status: 'pendiente', notes: 'Frágil — etiqueta verde extra' },
  { id: 'QR-2026-1114', markbox: 'DTD-3308', client: 'Distribuidora MAVECA', bultos: 30, warehouse: 'cn-yiwu',      supplier: 'Hangzhou Plastics',       sentBy: 'Wang Lei',   sentByPhone: '+86 187 4421', sentAt: '2026-05-24 08:33', priority: 'normal', status: 'imprimiendo', assignedPrinter: 'HP LaserJet · Oficina 2', notes: '' },
  { id: 'QR-2026-1113', markbox: 'DTD-7842', client: 'Polar C.A.',           bultos:  8, warehouse: 'cn-guangzhou', supplier: 'Foshan Steel Parts',      sentBy: 'Chen Min',   sentByPhone: '+86 159 2147', sentAt: '2026-05-24 08:12', priority: 'normal', status: 'imprimiendo', assignedPrinter: 'Zebra ZT411 · Oficina 1', notes: '' },
  { id: 'QR-2026-1112', markbox: 'DTD-2017', client: 'Farmacia La Vista',    bultos: 14, warehouse: 'cn-yiwu',      supplier: 'Yiwu Trading Hub Co.',    sentBy: 'Liu Wei',    sentByPhone: '+86 138 8829', sentAt: '2026-05-23 17:48', priority: 'normal', status: 'impreso',     assignedPrinter: 'HP LaserJet · Oficina 2', printedAt: '2026-05-23 18:05', printedBy: 'Andrea M.', notes: '' },
  { id: 'QR-2026-1111', markbox: 'DTD-9104', client: 'Acindar Industrial',   bultos: 22, warehouse: 'cn-guangzhou', supplier: 'Dongguan Hardware',       sentBy: 'Chen Min',   sentByPhone: '+86 159 2147', sentAt: '2026-05-23 16:22', priority: 'normal', status: 'impreso',     assignedPrinter: 'Zebra ZT411 · Oficina 1', printedAt: '2026-05-23 16:38', printedBy: 'Andrea M.', notes: '' },
  { id: 'QR-2026-1110', markbox: 'DTD-5621', client: 'Tech Solutions',       bultos: 10, warehouse: 'cn-yiwu',      supplier: 'Shenzhen Electronics Ltd', sentBy: 'Liu Wei',    sentByPhone: '+86 138 8829', sentAt: '2026-05-23 15:11', priority: 'normal', status: 'entregado',   assignedPrinter: 'HP LaserJet · Oficina 2', printedAt: '2026-05-23 15:28', printedBy: 'Andrea M.', deliveredAt: '2026-05-23 17:50', notes: '' },
  { id: 'QR-2026-1109', markbox: 'DTD-3308', client: 'Distribuidora MAVECA', bultos: 16, warehouse: 'cn-yiwu',      supplier: 'Hangzhou Plastics',       sentBy: 'Wang Lei',   sentByPhone: '+86 187 4421', sentAt: '2026-05-23 14:02', priority: 'normal', status: 'entregado',   assignedPrinter: 'HP LaserJet · Oficina 2', printedAt: '2026-05-23 14:17', printedBy: 'Andrea M.', deliveredAt: '2026-05-23 16:30', notes: '' },
];
const KPIS_EXTRA = {
  avgTransit:     { value: '38d',   delta: '↓ 2d vs Q1',     tone: 'info' },
  openIncidents:  { value: 3,       delta: '1 crítica',      tone: 'warning' },
  cnStock:        { value: 1284,    delta: 'bultos',         tone: 'neutral' },
  marginYTD:      { value: '24.6%', delta: '+1.8 pp',        tone: 'wine' },
  pendingCollect: { value: '$162K', delta: '4 fac. vencidas',tone: 'info' },
  wonQuotes:     { value: 11,       delta: '67% win rate',   tone: 'success' },
  activeClients: { value: 47,       delta: '+4 este mes',    tone: 'neutral' },
  avgTicket:     { value: '$24.8K', delta: '+$1.2K vs mes ant.', tone: 'wine' },
};
const AUDIT_LOG = [
  {
    id: 'AL-2026-4421', ts: '2026-05-24 09:56', timeRel: 'hace 4 min',
    actor: { name: 'Martina A.', role: 'Comercial', email: 'martina@dtdcargo.com', initials: 'MA' },
    action: 'edit', entity: 'Cotización', target: 'Q-2026-0421',
    summary: 'Cambió total de $8,400 a $9,200',
    ip: '190.142.88.214', city: 'Caracas, VE', browser: 'Chrome 124 · macOS',
    diff: [
      { field: 'total',          before: 8400,   after: 9200,  type: 'money' },
      { field: 'transport_cost', before: 320,    after: 420,   type: 'money' },
      { field: 'margin',         before: 0.265,  after: 0.298, type: 'pct' },
      { field: 'updated_at',     before: '2026-05-20 14:18', after: '2026-05-24 09:56', type: 'date' },
    ],
    related: [
      { id: 'AL-2026-4395', ts: '2026-05-20 14:18', summary: 'Martina A. creó la cotización' },
      { id: 'AL-2026-4318', ts: '2026-05-18 11:02', summary: 'Carlos V. asignó Martina como owner' },
    ],
  },
  {
    id: 'AL-2026-4420', ts: '2026-05-24 09:42', timeRel: 'hace 18 min',
    actor: { name: 'Carlos V.', role: 'Admin', email: 'carlos@dtdcargo.com', initials: 'CV' },
    action: 'create', entity: 'Cliente', target: 'DTD-5475',
    summary: 'Creó cliente: Mendoza & Cía CA',
    ip: '190.142.88.214', city: 'Caracas, VE', browser: 'Chrome 124 · macOS',
    diff: [
      { field: 'markbox',  before: null, after: 'DTD-5475',         type: 'text' },
      { field: 'company',  before: null, after: 'Mendoza & Cía CA',  type: 'text' },
      { field: 'rif',      before: null, after: 'J-31884201-7',      type: 'text' },
      { field: 'segment',  before: null, after: 'Comercial',         type: 'text' },
      { field: 'city',     before: null, after: 'Valencia',          type: 'text' },
      { field: 'status',   before: null, after: 'active',            type: 'text' },
    ],
    related: [],
  },
  {
    id: 'AL-2026-4419', ts: '2026-05-24 09:00', timeRel: 'hace 1 h',
    actor: { name: 'Yusneidy P.', role: 'Operaciones', email: 'yusneidy@dtdcargo.com', initials: 'YP' },
    action: 'edit', entity: 'Embarque', target: 'DTDU-419032',
    summary: 'Estado: aduana VE → liberado',
    ip: '190.124.40.182', city: 'Maracaibo, VE', browser: 'Edge 124 · Windows',
    diff: [
      { field: 'status',     before: 'aduana_ve',  after: 'liberado',  type: 'text' },
      { field: 'cleared_at', before: null,         after: '2026-05-24 09:00', type: 'date' },
      { field: 'duty_paid',  before: 4820,         after: 4820,        type: 'money', unchanged: true },
    ],
    related: [
      { id: 'AL-2026-4382', ts: '2026-05-22 14:22', summary: 'Yoel C. presentó DUA-VE-2026-088421' },
      { id: 'AL-2026-4361', ts: '2026-05-22 09:48', summary: 'Sistema: arribo a MAR confirmado' },
    ],
  },
  {
    id: 'AL-2026-4418', ts: '2026-05-24 08:02', timeRel: 'hace 2 h',
    actor: { name: 'Andrés B.', role: 'Contabilidad', email: 'andres@dtdcargo.com', initials: 'AB' },
    action: 'create', entity: 'Factura', target: 'F-2026-0445',
    summary: 'Emitida por $54,300',
    ip: '190.142.88.214', city: 'Caracas, VE', browser: 'Chrome 124 · macOS',
    diff: [
      { field: 'id',        before: null, after: 'F-2026-0445',  type: 'text' },
      { field: 'client',    before: null, after: 'DTD-5418',      type: 'text' },
      { field: 'amount',    before: null, after: 54300,           type: 'money' },
      { field: 'currency',  before: null, after: 'USD',           type: 'text' },
      { field: 'due',       before: null, after: '2026-06-23',    type: 'date' },
    ],
    related: [],
  },
  {
    id: 'AL-2026-4417', ts: '2026-05-24 07:00', timeRel: 'hace 3 h',
    actor: { name: 'Carlos V.', role: 'Admin', email: 'carlos@dtdcargo.com', initials: 'CV' },
    action: 'login', entity: 'Sesión', target: '—',
    summary: 'Login exitoso · IP 190.142.x.x · Caracas',
    ip: '190.142.88.214', city: 'Caracas, VE', browser: 'Chrome 124 · macOS',
    diff: [],
    related: [],
  },
  {
    id: 'AL-2026-4416', ts: '2026-05-24 06:02', timeRel: 'hace 4 h',
    actor: { name: 'Diego N.', role: 'Comercial', email: 'diego@dtdcargo.com', initials: 'DN' },
    action: 'edit', entity: 'Lead', target: 'L-0140',
    summary: 'Movió de "nuevo" a "demo"',
    ip: '186.94.40.118', city: 'Valencia, VE', browser: 'Chrome 124 · Windows',
    diff: [
      { field: 'stage',         before: 'nuevo', after: 'demo', type: 'text' },
      { field: 'demo_scheduled', before: null,    after: '2026-05-27 10:00', type: 'date' },
    ],
    related: [],
  },
  {
    id: 'AL-2026-4415', ts: '2026-05-24 05:00', timeRel: 'hace 5 h',
    actor: { name: 'Carlos V.', role: 'Admin', email: 'carlos@dtdcargo.com', initials: 'CV' },
    action: 'config', entity: 'Sistema', target: 'Mailing',
    summary: 'Activó proveedor Gmail Workspace',
    ip: '190.142.88.214', city: 'Caracas, VE', browser: 'Chrome 124 · macOS',
    diff: [
      { field: 'mail_provider', before: 'sendgrid',          after: 'gmail-workspace', type: 'text' },
      { field: 'mail_from',     before: 'no-reply@dtdcargo.com', after: 'hola@dtdcargo.com', type: 'text' },
      { field: 'mail_quota',    before: 10000,                after: 50000,             type: 'number' },
    ],
    related: [],
    sensitive: true,
  },
  {
    id: 'AL-2026-4414', ts: '2026-05-24 02:00', timeRel: 'hace 8 h',
    actor: { name: 'Wang H.', role: 'Almacén CN', email: 'wang@dtdcargo.cn', initials: 'WH' },
    action: 'create', entity: 'Recepción', target: 'CN-2026-2842',
    summary: 'Recibió 18 cajas en YIW-A1',
    ip: '120.241.18.55', city: 'Yiwu, CN', browser: 'WeChat Browser · Android',
    diff: [
      { field: 'boxes',     before: null, after: 18,      type: 'number' },
      { field: 'location',  before: null, after: 'YIW-A1', type: 'text' },
      { field: 'supplier',  before: null, after: 'Yiwu Trading Hub Co.', type: 'text' },
      { field: 'client',    before: null, after: 'DTD-7842', type: 'text' },
    ],
    related: [],
  },
  {
    id: 'AL-2026-4413', ts: '2026-05-23 17:42', timeRel: 'ayer 17:42',
    actor: { name: 'Martina A.', role: 'Comercial', email: 'martina@dtdcargo.com', initials: 'MA' },
    action: 'delete', entity: 'Cotización', target: 'Q-2026-0410',
    summary: 'Eliminó borrador',
    ip: '190.142.88.214', city: 'Caracas, VE', browser: 'Chrome 124 · macOS',
    diff: [
      { field: 'status', before: 'draft', after: 'deleted', type: 'text' },
    ],
    related: [],
    sensitive: true,
  },
  {
    id: 'AL-2026-4412', ts: '2026-05-23 16:18', timeRel: 'ayer 16:18',
    actor: { name: 'Carlos V.', role: 'Admin', email: 'carlos@dtdcargo.com', initials: 'CV' },
    action: 'config', entity: 'Usuario', target: 'u-008',
    summary: 'Invitó: Carolina Méndez (Soporte)',
    ip: '190.142.88.214', city: 'Caracas, VE', browser: 'Chrome 124 · macOS',
    diff: [
      { field: 'name',  before: null, after: 'Carolina Méndez', type: 'text' },
      { field: 'role',  before: null, after: 'Soporte',          type: 'text' },
      { field: 'email', before: null, after: 'c.mendez@dtdcargo.com', type: 'text' },
    ],
    related: [],
  },
  {
    id: 'AL-2026-4411', ts: '2026-05-23 14:05', timeRel: 'ayer 14:05',
    actor: { name: 'Andrés B.', role: 'Contabilidad', email: 'andres@dtdcargo.com', initials: 'AB' },
    action: 'edit', entity: 'Factura', target: 'F-2026-0391',
    summary: 'Registró pago $156,800 · saldo 0',
    ip: '190.142.88.214', city: 'Caracas, VE', browser: 'Chrome 124 · macOS',
    diff: [
      { field: 'paid',    before: 0,        after: 156800, type: 'money' },
      { field: 'balance', before: 156800,   after: 0,      type: 'money' },
      { field: 'status',  before: 'vencida', after: 'pagada', type: 'text' },
      { field: 'paid_at', before: null,     after: '2026-05-23 14:05', type: 'date' },
    ],
    related: [
      { id: 'AL-2026-4282', ts: '2026-05-14 10:00', summary: 'Andrés B. emitió F-2026-0391' },
    ],
  },
  {
    id: 'AL-2026-4410', ts: '2026-05-23 11:30', timeRel: 'ayer 11:30',
    actor: { name: 'Sistema', role: 'Cron', email: '—', initials: 'SY', system: true },
    action: 'auto', entity: 'Backup', target: 'S3 · diario',
    summary: 'Backup completo a S3 · 4.2GB',
    ip: '10.0.0.1', city: 'Servidor', browser: '—',
    diff: [
      { field: 'size_gb',   before: 4.1,  after: 4.2, type: 'number' },
      { field: 'duration_s', before: null, after: 142, type: 'number' },
    ],
    related: [],
  },
];
const BANK_STATEMENTS = {
  bank: 'Banesco · USD Cuenta Corriente',
  account: '0134-0892-XX-XXXX1442',
  period: '2026-05-08 → 2026-05-22',
  fileName: 'banesco-estadocuenta-may2026.pdf',
  uploadedAt: '2026-05-24 09:15',
  uploadedBy: 'Andrea M.',
  openingBalance: 184200,
  closingBalance: 312600,
  movements: [
    // CREDITS — payments from clients
    { id: 'M-001', date: '2026-05-22', kind: 'credit', ref: 'WIRE-9982', desc: 'Pago Industrias Polar · ref F-2026-0391',  amount: 156800, suggested: { type: 'invoice', ref: 'F-2026-0391', confidence: 'high', client: 'Industrias Polar' } },
    { id: 'M-002', date: '2026-05-20', kind: 'credit', ref: 'WIRE-9954', desc: 'Castro Hermanos C.A.',                      amount: 48200,  suggested: { type: 'invoice', ref: 'F-2026-0398', confidence: 'high', client: 'Castro Hermanos' } },
    { id: 'M-003', date: '2026-05-18', kind: 'credit', ref: 'WIRE-9941', desc: 'INDUSTRIAS POLAR S.A.',                       amount: 124400, suggested: { type: 'invoice', ref: 'F-2026-0357', confidence: 'high', client: 'Industrias Polar' } },
    { id: 'M-004', date: '2026-05-15', kind: 'credit', ref: 'WIRE-9933', desc: 'P.ROJAS DISTRIBUIDORA · pago parcial',          amount: 18400,  suggested: { type: 'invoice', ref: 'F-2026-0395', confidence: 'medium', client: 'Distribuidora Andina', partial: true } },
    { id: 'M-005', date: '2026-05-14', kind: 'credit', ref: 'DEP-3344',  desc: 'Depósito en efectivo USD',                       amount: 12000,  suggested: null, status: 'manual' },
    { id: 'M-006', date: '2026-05-12', kind: 'credit', ref: 'ZELLE-8841', desc: 'M GONZALEZ TECH SOLUTIONS',                     amount: 7600,   suggested: { type: 'invoice', ref: 'F-2026-0411', confidence: 'high', client: 'Tech Solutions' } },
    { id: 'M-007', date: '2026-05-08', kind: 'credit', ref: 'WIRE-9921', desc: 'ACINDAR COMERCIAL · pago parcial F-0382',         amount: 18400,  suggested: { type: 'invoice', ref: 'F-2026-0382', confidence: 'high', client: 'Acindar Comercial', partial: true } },
    // DEBITS — operational expenses
    { id: 'M-008', date: '2026-05-22', kind: 'debit',  ref: 'TX-44182',  desc: 'Pago naviera COSCO · DTDU-501228',                amount: 28400,  suggested: { type: 'expense', ref: 'EXP-COSCO-0142', confidence: 'high', vendor: 'COSCO' } },
    { id: 'M-009', date: '2026-05-19', kind: 'debit',  ref: 'TX-44158',  desc: 'Aduanas Carabobo · honorarios mayo',               amount: 4820,   suggested: { type: 'expense', ref: 'EXP-AGENT-a001', confidence: 'high', vendor: 'Aduanas Carabobo' } },
    { id: 'M-010', date: '2026-05-17', kind: 'debit',  ref: 'TX-44128',  desc: 'COMBUSTIBLE PDV flota PBL',                         amount: 1240,   suggested: { type: 'expense', ref: 'EXP-FUEL-0521', confidence: 'medium', vendor: 'Flota DTD · combustible' } },
    { id: 'M-011', date: '2026-05-14', kind: 'debit',  ref: 'TX-44102',  desc: 'Salarios quincena · choferes',                      amount: 8400,   suggested: { type: 'expense', ref: 'EXP-PAYROLL-Q1', confidence: 'high', vendor: 'Nómina · flota' } },
    { id: 'M-012', date: '2026-05-12', kind: 'debit',  ref: 'TX-44081',  desc: 'TRX-INET digital · cargo no identificado',           amount: 380,    suggested: null, status: 'manual', flagged: true },
    { id: 'M-013', date: '2026-05-10', kind: 'debit',  ref: 'TX-44062',  desc: 'Maersk · DTDU-419032 freight',                       amount: 41200,  suggested: { type: 'expense', ref: 'EXP-MAERSK-0118', confidence: 'high', vendor: 'Maersk' } },
    { id: 'M-014', date: '2026-05-08', kind: 'debit',  ref: 'TX-44044',  desc: 'COMISIONES BANCO mayo',                              amount: 220,    suggested: { type: 'expense', ref: 'EXP-BANK-MAY', confidence: 'high', vendor: 'Banco · comisiones' } },
  ],
};
const CLIENT_ACCOUNTS = {
  'DTD-5392': { // Industrias Polar — mostly paid, big
    creditLimit: 250000, creditDays: 45, discount: 2.0,
    fiscalAddress: 'Av. Cuatricentenaria, Edif. Industrias Polar · Caracas, Distrito Capital',
    billingContact: { name: 'Andrea Rodríguez', role: 'Tesorería corporativa', email: 'a.rodriguez@polar.com.ve', phone: '+58 212 446 9100' },
    paymentTerms: 'Net 45 · 2% descuento pago a 15 días',
    paymentMethods: [
      { kind: 'wire',  label: 'Transferencia USD (offshore)', count: 22, total: 308600 },
      { kind: 'usdt',  label: 'USDT · TRC20',                  count: 4,  total: 42800  },
      { kind: 'zelle', label: 'Zelle',                          count: 2,  total: 18400 },
    ],
    monthSummary: [
      { m: 'DIC', billed: 38400, collected: 38400 },
      { m: 'ENE', billed: 84200, collected: 84200 },
      { m: 'FEB', billed: 42800, collected: 42800 },
      { m: 'MAR', billed: 96800, collected: 78400 },
      { m: 'ABR', billed: 124400, collected: 124400 },
      { m: 'MAY', billed: 156800, collected: 156800 },
    ],
    dpp: 38, dppTarget: 45,
    lastReminder: null,
    nextDue: '2026-06-08',
    movements: [
      { date: '2026-05-22', kind: 'pago',           ref: 'WIRE-9982',     desc: 'Pago F-2026-0391 · transferencia USD',      debit: 0,      credit: 120000, balance: 0 },
      { date: '2026-05-22', kind: 'pago',           ref: 'TRF-VES-9001',  desc: 'Pago F-2026-0391 (parte) · transferencia Bs.', debit: 0,   credit: 36800, balance: 0, ccy: 'VES', amountBs: 1341360, rateUsed: 36.45, rateSource: 'bcv' },
      { date: '2026-05-20', kind: 'factura',        ref: 'F-2026-0391',   desc: 'DTDU-419032 · refrigeración Polar',          debit: 156800, credit: 0,      balance: 156800 },
      { date: '2026-05-12', kind: 'pago',           ref: 'WIRE-9941',     desc: 'Pago F-2026-0357 · transferencia USD',      debit: 0,      credit: 124400, balance: 0 },
      { date: '2026-04-22', kind: 'factura',        ref: 'F-2026-0357',   desc: 'DTDU-401234 · cadena de frío',                debit: 124400, credit: 0,      balance: 124400 },
      { date: '2026-04-15', kind: 'nota_credito',   ref: 'NC-2026-0118',  desc: 'Ajuste sobrecarga combustible',               debit: 0,      credit: 2400,   balance: 0 },
      { date: '2026-04-08', kind: 'pago',           ref: 'WIRE-9881',     desc: 'Pago F-2026-0341',                            debit: 0,      credit: 96800,  balance: 0 },
      { date: '2026-03-18', kind: 'factura',        ref: 'F-2026-0341',   desc: 'DTDU-388157 · vitrinas frigoríficas',         debit: 96800,  credit: 0,      balance: 96800 },
      { date: '2026-02-28', kind: 'pago',           ref: 'USDT-TX-4471',  desc: 'Pago F-2026-0312 · USDT TRC20',                debit: 0,      credit: 42800,  balance: 0 },
      { date: '2026-02-12', kind: 'factura',        ref: 'F-2026-0312',   desc: 'DTDU-365044 · equipos auxiliares',             debit: 42800,  credit: 0,      balance: 42800 },
    ],
    notes: 'Cliente A. Pagos predecibles. Renegociar Net 30 si se mantiene volumen.',
  },
  'DTD-5452': { // Acindar — has overdue
    creditLimit: 120000, creditDays: 30, discount: 0,
    fiscalAddress: 'ZI Valencia Sur, Galpón 12 · Valencia, Carabobo',
    billingContact: { name: 'Carlos Méndez', role: 'Dueño · firmante', email: 'carlos@acindar.com.ve', phone: '+58 241 884 0212' },
    paymentTerms: 'Net 30',
    paymentMethods: [
      { kind: 'wire',  label: 'Transferencia USD',  count: 14, total: 96400 },
      { kind: 'cash',  label: 'Efectivo USD',        count: 3,  total: 18800 },
      { kind: 'usdt',  label: 'USDT · TRC20',        count: 2,  total: 12200 },
    ],
    vesMovements: [
      { date: '2026-05-19', ref: 'TRF-VES-8841', desc: 'Transfer Banesco Bs. · pago parcial F-2026-0382', amountBs: 671320,  rateUsed: 36.45, rateSource: 'bcv',      equivalentUsd: 18416, linkInvoice: 'F-2026-0382' },
      { date: '2026-04-12', ref: 'PAGO-VES-552', desc: 'Pago retención IGTF · ajuste interno',              amountBs: 65610,   rateUsed: 36.45, rateSource: 'bcv',      equivalentUsd: 1800,  linkInvoice: 'ND-2026-0042' },
      { date: '2026-03-04', ref: 'TRF-VES-8722', desc: 'Transfer Mercantil Bs. · pago F-2026-0312',         amountBs: 1184400, rateUsed: 37.00, rateSource: 'parallel', equivalentUsd: 32011, linkInvoice: 'F-2026-0312' },
    ],
    monthSummary: [
      { m: 'DIC', billed: 18400, collected: 18400 },
      { m: 'ENE', billed: 26200, collected: 26200 },
      { m: 'FEB', billed: 31400, collected: 31400 },
      { m: 'MAR', billed: 42800, collected: 42800 },
      { m: 'ABR', billed: 38400, collected: 18400 },
      { m: 'MAY', billed: 84200, collected: 0 },
    ],
    dpp: 52, dppTarget: 30,
    lastReminder: '2026-05-20',
    nextDue: '2026-06-13',
    movements: [
      { date: '2026-05-14', kind: 'factura',        ref: 'F-2026-0418',   desc: 'DTDU-472816 · zapatillas deportivas',        debit: 84200, credit: 0,    balance: 84200, overdue: true },
      { date: '2026-05-05', kind: 'pago',           ref: 'WIRE-9921',     desc: 'Pago parcial F-2026-0382',                    debit: 0,     credit: 18400, balance: 0 },
      { date: '2026-04-22', kind: 'factura',        ref: 'F-2026-0382',   desc: 'DTDU-388157 · partes industriales',           debit: 38400, credit: 0,    balance: 38400 },
      { date: '2026-04-12', kind: 'nota_debito',    ref: 'ND-2026-0042',  desc: 'Cargo demora desalmacenaje',                  debit: 1800,  credit: 0,    balance: 1800 },
      { date: '2026-04-09', kind: 'pago',           ref: 'TRF-VES-7791',  desc: 'Pago F-2026-0354 (resto) · transferencia Bs.', debit: 0,  credit: 20000, balance: 0, ccy: 'VES', amountBs: 729000, rateUsed: 36.45, rateSource: 'bcv' },
      { date: '2026-04-08', kind: 'pago',           ref: 'CASH-8821',     desc: 'Pago F-2026-0354 · efectivo USD',              debit: 0,     credit: 22800, balance: 0 },
      { date: '2026-03-25', kind: 'factura',        ref: 'F-2026-0354',   desc: 'DTDU-365044 · acero estructural',              debit: 42800, credit: 0,    balance: 42800 },
      { date: '2026-03-15', kind: 'recordatorio',   ref: '—',             desc: 'Recordatorio de pago enviado · Mailing',       debit: 0,     credit: 0,    balance: 0 },
      { date: '2026-02-28', kind: 'pago',           ref: 'WIRE-9841',     desc: 'Pago F-2026-0331',                              debit: 0,     credit: 31400, balance: 0 },
      { date: '2026-02-10', kind: 'factura',        ref: 'F-2026-0331',   desc: 'DTDU-298311 · perfiles metálicos',             debit: 31400, credit: 0,    balance: 31400 },
    ],
    notes: 'Cliente histórico pero con desliz reciente. Llamar a Carlos para cobrar F-2026-0418 (10d vencida).',
  },
  'DTD-5354': { // Castro Hermanos — solid
    creditLimit: 180000, creditDays: 45, discount: 1.5,
    fiscalAddress: 'Av. Comercio 22 · Punto Fijo, Falcón',
    billingContact: { name: 'Roberto Castro', role: 'Director financiero', email: 'r.castro@castroh.com.ve', phone: '+58 269 778 2114' },
    paymentTerms: 'Net 45 · 1.5% descuento pago a 15 días',
    paymentMethods: [
      { kind: 'wire',  label: 'Transferencia USD', count: 28, total: 198400 },
      { kind: 'usdt',  label: 'USDT · TRC20',       count: 5,  total: 50200 },
    ],
    monthSummary: [
      { m: 'DIC', billed: 28400, collected: 28400 },
      { m: 'ENE', billed: 42800, collected: 42800 },
      { m: 'FEB', billed: 38200, collected: 38200 },
      { m: 'MAR', billed: 56400, collected: 56400 },
      { m: 'ABR', billed: 48200, collected: 48200 },
      { m: 'MAY', billed: 34600, collected: 0 },
    ],
    dpp: 42, dppTarget: 45,
    lastReminder: null,
    nextDue: '2026-06-22',
    movements: [
      { date: '2026-05-22', kind: 'factura',        ref: 'F-2026-0421',   desc: 'DTDU-401234 · televisores LED',                debit: 34600, credit: 0,    balance: 34600 },
      { date: '2026-05-15', kind: 'pago',           ref: 'WIRE-9954',     desc: 'Pago F-2026-0398',                              debit: 0,     credit: 48200, balance: 0 },
      { date: '2026-04-30', kind: 'factura',        ref: 'F-2026-0398',   desc: 'DTDU-388157 · maletas + accesorios',           debit: 48200, credit: 0,    balance: 48200 },
      { date: '2026-04-18', kind: 'pago',           ref: 'USDT-TX-4421',  desc: 'Pago F-2026-0371 · USDT',                       debit: 0,     credit: 56400, balance: 0 },
      { date: '2026-03-28', kind: 'factura',        ref: 'F-2026-0371',   desc: 'DTDU-365044 · estanterías metálicas',          debit: 56400, credit: 0,    balance: 56400 },
    ],
    notes: 'Roberto siempre paga en término. Excelente cliente.',
  },
  'DTD-5371': { // Tech Solutions — smaller, recent
    creditLimit: 80000, creditDays: 30, discount: 0,
    fiscalAddress: 'Av. Andrés Bello, Torre Tech, Piso 8 · Maracay, Aragua',
    billingContact: { name: 'María González', role: 'Cofundadora', email: 'maria@techsolutionsve.com', phone: '+58 243 552 8842' },
    paymentTerms: 'Net 30',
    paymentMethods: [
      { kind: 'zelle', label: 'Zelle', count: 8, total: 48400 },
      { kind: 'wire',  label: 'Transferencia USD', count: 4, total: 15800 },
    ],
    monthSummary: [
      { m: 'DIC', billed: 8400,  collected: 8400 },
      { m: 'ENE', billed: 12200, collected: 12200 },
      { m: 'FEB', billed: 9800,  collected: 9800 },
      { m: 'MAR', billed: 14400, collected: 14400 },
      { m: 'ABR', billed: 11800, collected: 11800 },
      { m: 'MAY', billed: 7600,  collected: 7600 },
    ],
    dpp: 22, dppTarget: 30,
    lastReminder: null,
    nextDue: '2026-06-04',
    movements: [
      { date: '2026-05-12', kind: 'pago',     ref: 'ZELLE-8841', desc: 'Pago F-2026-0411 · Zelle',     debit: 0,    credit: 7600,  balance: 0 },
      { date: '2026-05-05', kind: 'factura',  ref: 'F-2026-0411', desc: 'DTDU-419031 · notebooks',     debit: 7600, credit: 0,     balance: 7600 },
      { date: '2026-04-20', kind: 'pago',     ref: 'ZELLE-8821', desc: 'Pago F-2026-0388 · Zelle',     debit: 0,    credit: 11800, balance: 0 },
      { date: '2026-04-08', kind: 'factura',  ref: 'F-2026-0388', desc: 'DTDU-401234 · accesorios IT', debit: 11800, credit: 0,    balance: 11800 },
    ],
    notes: '',
  },
  'DTD-5340': { // Distribuidora Andina — slow payer
    creditLimit: 100000, creditDays: 30, discount: 0,
    fiscalAddress: 'Av. Las Américas, Edif. Andinos · Mérida, Mérida',
    billingContact: { name: 'Patricia Rojas', role: 'Dueña', email: 'patricia@distandina.ve', phone: '+58 274 220 8814' },
    paymentTerms: 'Net 30 · estricto',
    paymentMethods: [
      { kind: 'wire',  label: 'Transferencia USD', count: 12, total: 82400 },
      { kind: 'cash',  label: 'Efectivo USD',       count: 8,  total: 38400 },
    ],
    vesMovements: [
      { date: '2026-05-12', ref: 'TRF-VES-7711', desc: 'Pago F-2026-0388 (parcial) · Banco Mercantil Bs.', amountBs: 656100, rateUsed: 36.45, rateSource: 'bcv',      equivalentUsd: 18000, linkInvoice: 'F-2026-0388' },
      { date: '2026-04-08', ref: 'TRF-VES-7682', desc: 'Pago F-2026-0367 · transferencia Bs. (BCV+día)',   amountBs: 906980, rateUsed: 36.85, rateSource: 'parallel', equivalentUsd: 24612, linkInvoice: 'F-2026-0367' },
      { date: '2026-02-22', ref: 'TRF-VES-7501', desc: 'Pago F-2026-0298 · Banesco Bs.',                    amountBs: 488170, rateUsed: 35.10, rateSource: 'bcv',      equivalentUsd: 13908, linkInvoice: 'F-2026-0298' },
    ],
    monthSummary: [
      { m: 'DIC', billed: 18800, collected: 18800 },
      { m: 'ENE', billed: 22400, collected: 0 },
      { m: 'FEB', billed: 28200, collected: 22400 },
      { m: 'MAR', billed: 24600, collected: 28200 },
      { m: 'ABR', billed: 32200, collected: 24600 },
      { m: 'MAY', billed: 26100, collected: 18400 },
    ],
    dpp: 61, dppTarget: 30,
    lastReminder: '2026-05-15',
    nextDue: '2026-06-15',
    movements: [
      { date: '2026-05-18', kind: 'factura',      ref: 'F-2026-0424',   desc: 'DTDU-401234 · cosmética + accesorios',     debit: 26100, credit: 0,    balance: 26100, overdue: true },
      { date: '2026-05-15', kind: 'recordatorio', ref: '—',             desc: 'Segundo recordatorio · WhatsApp + email',   debit: 0,     credit: 0,    balance: 0 },
      { date: '2026-05-08', kind: 'pago',         ref: 'WIRE-9933',     desc: 'Pago parcial F-2026-0395',                  debit: 0,     credit: 18400, balance: 0 },
      { date: '2026-04-22', kind: 'factura',      ref: 'F-2026-0395',   desc: 'DTDU-388157 · maletas + bolsos',            debit: 32200, credit: 0,    balance: 32200 },
      { date: '2026-04-08', kind: 'pago',         ref: 'CASH-8842',     desc: 'Pago F-2026-0367 · efectivo USD',           debit: 0,     credit: 24600, balance: 0 },
    ],
    notes: 'Patricia tiende a atrasarse 30d. Mantener recordatorios automáticos. Bloquear nuevas órdenes si saldo > $30K.',
  },
  'DTD-5321': { // Salazar — problematic
    creditLimit: 0, creditDays: 0, discount: 0,
    fiscalAddress: 'Calle 8, Centro · Caracas',
    billingContact: { name: 'Eduardo Salazar', role: 'Dueño', email: 'esalazar@salazartrading.ve', phone: '+58 212 992 4421' },
    paymentTerms: 'Pago anticipado · sin línea de crédito',
    paymentMethods: [
      { kind: 'cash', label: 'Efectivo USD', count: 4, total: 16200 },
      { kind: 'usdt', label: 'USDT · TRC20',  count: 2, total: 8800 },
    ],
    vesMovements: [
      { date: '2026-05-10', ref: 'TRF-VES-8801', desc: 'Anticipo F-2026-0419 · Bs.',     amountBs: 218700, rateUsed: 36.45, rateSource: 'bcv', equivalentUsd: 6000, linkInvoice: 'F-2026-0419' },
      { date: '2026-04-22', ref: 'TRF-VES-8788', desc: 'Anticipo F-2026-0401 · Bs.',     amountBs: 466240, rateUsed: 36.40, rateSource: 'bcv', equivalentUsd: 12808, linkInvoice: 'F-2026-0401' },
    ],
    monthSummary: [
      { m: 'DIC', billed: 0,    collected: 0 },
      { m: 'ENE', billed: 4200, collected: 4200 },
      { m: 'FEB', billed: 6800, collected: 6800 },
      { m: 'MAR', billed: 8400, collected: 8400 },
      { m: 'ABR', billed: 12800, collected: 12800 },
      { m: 'MAY', billed: 6000, collected: 6000 },
    ],
    dpp: 0, dppTarget: 0,
    lastReminder: null,
    nextDue: null,
    movements: [
      { date: '2026-05-10', kind: 'pago',         ref: 'CASH-8851',     desc: 'Anticipo F-2026-0419 · efectivo',           debit: 0,    credit: 6000, balance: 0 },
      { date: '2026-05-10', kind: 'factura',      ref: 'F-2026-0419',   desc: 'DTDU-401234 · electrónica importada',       debit: 6000, credit: 0,    balance: 6000 },
    ],
    notes: 'Status pending hasta normalizar legal. Solo pago anticipado.',
  },
};
const TRUCK_PROFILES = {
  'T-001': {
    year: 2019, vin: 'YV2RT40A9KB823441', engine: 'D13K 460 CV · 6 cil.',
    dimensions: { length: 13.6, width: 2.5, height: 2.9 }, // metros
    tare: 8500, axles: 3,
    purchaseDate: '2019-08-14', purchaseValue: 145000,
    docs: {
      circulacion:  { expiry: '2026-12-31' },
      soat:         { expiry: '2026-09-15' },
      rtv:          { expiry: '2026-11-08' },
      seguroFlota:  { expiry: '2027-02-20' },
      rifVehicular: { expiry: null },
    },
    nextServiceKm: 200000, nextServiceDate: '2026-06-30',
    serviceHistory: [
      { date: '2026-04-12', km: 178200, type: 'preventivo', desc: 'Aceite + filtros · revisión frenos', cost: 480 },
      { date: '2026-02-08', km: 168400, type: 'preventivo', desc: 'Aceite + neumáticos delanteros', cost: 1240 },
      { date: '2025-12-15', km: 158100, type: 'correctivo', desc: 'Cambio embrague completo', cost: 2800 },
      { date: '2025-10-22', km: 148900, type: 'preventivo', desc: 'Aceite + filtros + frenos traseros', cost: 720 },
    ],
    costBreakdown: { fuel: 4820, maint: 480, salary: 1850, tolls: 420, other: 180 }, // último mes
    trips30d: 22, utilization: 84,
    incidents: [
      { date: '2026-04-30', type: 'menor', desc: 'Roce lateral en patio Polar · sin daños mayores', cost: 0, severity: 'low' },
    ],
    recentTrips: [
      { date: '2026-05-23', route: 'PBL → Valencia · ZI Acindar', driver: 'd-001', km: 168, fuel: 27, onTime: true },
      { date: '2026-05-21', route: 'PBL → Caracas · CCS Polar Center', driver: 'd-001', km: 215, fuel: 35, onTime: true },
      { date: '2026-05-19', route: 'PBL → Maracay · Tech Solutions', driver: 'd-001', km: 142, fuel: 23, onTime: false },
      { date: '2026-05-17', route: 'PBL → Valencia · ZI Acindar', driver: 'd-001', km: 168, fuel: 27, onTime: true },
      { date: '2026-05-15', route: 'PBL → Caracas · Farmacia La Vista', driver: 'd-001', km: 215, fuel: 36, onTime: true },
      { date: '2026-05-13', route: 'PBL → Valencia · MAVECA', driver: 'd-001', km: 168, fuel: 28, onTime: true },
    ],
    notes: 'Camión emblema de la flota. Volvo veterano pero muy confiable. Mantener el plan de servicios cada 10.000 km.',
  },
  'T-002': { year: 2021, vin: 'WDB9701141L228874', engine: 'OM 924 LA · 240 CV · 4 cil.', dimensions: { length: 9.2, width: 2.4, height: 2.7 }, tare: 4200, axles: 2, purchaseDate: '2021-03-22', purchaseValue: 68000, docs: { circulacion: { expiry: '2026-12-31' }, soat: { expiry: '2026-08-30' }, rtv: { expiry: '2027-01-14' }, seguroFlota: { expiry: '2027-02-20' }, rifVehicular: { expiry: null } }, nextServiceKm: 100000, nextServiceDate: '2026-08-15', serviceHistory: [{ date: '2026-05-02', km: 88200, type: 'preventivo', desc: 'Aceite + filtros', cost: 380 }], costBreakdown: { fuel: 3120, maint: 380, salary: 1850, tolls: 320, other: 120 }, trips30d: 18, utilization: 72, incidents: [], recentTrips: [], notes: '' },
  'T-003': { year: 2022, vin: 'ZCFC50AAA00582114', engine: '3.0 HPI · 170 CV', dimensions: { length: 7.4, width: 2.1, height: 2.5 }, tare: 2800, axles: 2, purchaseDate: '2022-07-08', purchaseValue: 52000, docs: { circulacion: { expiry: '2026-12-31' }, soat: { expiry: '2026-07-20' }, rtv: { expiry: '2026-10-12' }, seguroFlota: { expiry: '2027-02-20' }, rifVehicular: { expiry: null } }, nextServiceKm: 70000, nextServiceDate: '2026-07-04', serviceHistory: [{ date: '2026-04-28', km: 62400, type: 'preventivo', desc: 'Aceite + filtros + alineación', cost: 320 }], costBreakdown: { fuel: 2420, maint: 320, salary: 1850, tolls: 280, other: 100 }, trips30d: 16, utilization: 68, incidents: [], recentTrips: [], notes: '' },
  'T-004': { year: 2017, vin: 'YS2R6X20009422118', engine: 'DC13 · 450 CV · 6 cil.', dimensions: { length: 13.6, width: 2.5, height: 2.9 }, tare: 8800, axles: 3, purchaseDate: null, purchaseValue: null, docs: { circulacion: { expiry: '2026-12-31' }, soat: { expiry: '2026-08-04' }, rtv: { expiry: '2026-06-30' }, seguroFlota: { expiry: '2027-02-20' }, rifVehicular: { expiry: null } }, nextServiceKm: 220000, nextServiceDate: '2026-06-08', serviceHistory: [{ date: '2026-03-14', km: 208400, type: 'preventivo', desc: 'Aceite + filtros + revisión turbo', cost: 540 }], costBreakdown: { fuel: 5210, maint: 540, salary: 0, tolls: 480, other: 200 }, trips30d: 24, utilization: 91, incidents: [{ date: '2026-05-18', type: 'multa', desc: 'Exceso velocidad ruta MAR', cost: 120, severity: 'medium' }], recentTrips: [], notes: 'Camión contratado · revisar contrato Scania en septiembre.' },
  'T-005': { year: 2020, vin: 'JHFRR1JFLLKZ20088', engine: 'J05E-UF · 165 CV · 4 cil.', dimensions: { length: 6.2, width: 2.0, height: 2.3 }, tare: 2100, axles: 2, purchaseDate: '2020-11-30', purchaseValue: 38000, docs: { circulacion: { expiry: '2026-12-31' }, soat: { expiry: '2026-10-22' }, rtv: { expiry: '2026-09-04' }, seguroFlota: { expiry: '2027-02-20' }, rifVehicular: { expiry: null } }, nextServiceKm: 145000, nextServiceDate: '2026-06-22', serviceHistory: [{ date: '2026-05-22', km: 142000, type: 'correctivo', desc: 'Cambio bomba aceite · en taller hoy', cost: 1800 }], costBreakdown: { fuel: 1820, maint: 1800, salary: 1850, tolls: 220, other: 80 }, trips30d: 14, utilization: 58, incidents: [{ date: '2026-05-22', type: 'mecánica', desc: 'Falla bomba de aceite · en taller', cost: 1800, severity: 'high' }], recentTrips: [], notes: 'En taller esta semana. Falla en bomba de aceite.' },
  'T-006': { year: 2016, vin: '1XKAD49X4GJ455882', engine: 'Cummins X15 · 510 CV', dimensions: { length: 14.2, width: 2.5, height: 3.0 }, tare: 9200, axles: 3, purchaseDate: null, purchaseValue: null, docs: { circulacion: { expiry: '2026-12-31' }, soat: { expiry: '2026-11-18' }, rtv: { expiry: '2026-08-22' }, seguroFlota: { expiry: '2027-02-20' }, rifVehicular: { expiry: null } }, nextServiceKm: 315000, nextServiceDate: '2026-06-15', serviceHistory: [{ date: '2026-04-20', km: 298400, type: 'preventivo', desc: 'Aceite + 4 neumáticos traseros', cost: 1820 }], costBreakdown: { fuel: 6080, maint: 1820, salary: 0, tolls: 520, other: 220 }, trips30d: 20, utilization: 78, incidents: [], recentTrips: [], notes: 'Camión contratado · de alto kilometraje pero confiable.' },
  'T-007': { year: 2023, vin: 'WDB9701141L312441', engine: 'OM 924 LA · 240 CV · 4 cil.', dimensions: { length: 9.2, width: 2.4, height: 2.7 }, tare: 4200, axles: 2, purchaseDate: '2023-05-18', purchaseValue: 72000, docs: { circulacion: { expiry: '2026-12-31' }, soat: { expiry: '2026-12-04' }, rtv: { expiry: '2027-03-12' }, seguroFlota: { expiry: '2027-02-20' }, rifVehicular: { expiry: null } }, nextServiceKm: 60000, nextServiceDate: '2026-08-30', serviceHistory: [{ date: '2026-05-08', km: 44200, type: 'preventivo', desc: 'Aceite + filtros (primer service)', cost: 420 }], costBreakdown: { fuel: 1820, maint: 420, salary: 1850, tolls: 180, other: 100 }, trips30d: 12, utilization: 51, incidents: [], recentTrips: [], notes: 'El más nuevo de la flota.' },
};
const DRIVER_PROFILES = {
  'd-001': {
    initials: 'LH', avatarColor: 'wine',
    rif: 'V-9.234.117-5', dob: '1968-03-12', hireDate: '2008-11-04',
    email: 'l.hernandez@dtdcargo.com',
    address: 'Av. Bolívar, Puerto Cabello, Carabobo',
    emergencyContact: 'Marisol Hernández (esposa) · +58 414 552 1190',
    licenseExpiry: '2027-08-15', licenseCategories: ['A', 'B', 'C', 'D', 'E'],
    medicalExpiry: '2026-09-30', psychExpiry: '2026-11-12',
    certifications: [
      { name: 'IMDG · Cargas peligrosas', issuer: 'INEA', expiry: '2027-04-20' },
      { name: 'Manejo defensivo', issuer: 'INTT', expiry: '2026-12-01' },
      { name: 'Primeros auxilios', issuer: 'Cruz Roja', expiry: '2027-02-14' },
    ],
    assignedTruck: 'T-001',
    trips6mo: [16, 18, 20, 19, 22, 22], // ene-jun
    onTimePct: 96, kmTotal: 168400, fuelAvg: 3.2,
    incidents: [
      { date: '2026-04-12', type: 'mantenimiento', desc: 'Reportó ruido frenos · revisión preventiva OK', severity: 'low' },
    ],
    recentTrips: [
      { date: '2026-05-23', route: 'PBL → Valencia · ZI Acindar',      shipment: 'DTDU-472816', km: 168, onTime: true,  rating: 5 },
      { date: '2026-05-21', route: 'PBL → Caracas · CCS Polar Center', shipment: 'DTDU-419031', km: 215, onTime: true,  rating: 5 },
      { date: '2026-05-19', route: 'PBL → Maracay · Tech Solutions',   shipment: 'DTDU-388157', km: 142, onTime: false, rating: 4, delay: '+45min · tráfico' },
      { date: '2026-05-17', route: 'PBL → Valencia · ZI Acindar',      shipment: 'DTDU-401234', km: 168, onTime: true,  rating: 5 },
      { date: '2026-05-15', route: 'PBL → Caracas · Farmacia La Vista', shipment: 'DTDU-365044', km: 215, onTime: true, rating: 5 },
      { date: '2026-05-13', route: 'PBL → Valencia · MAVECA',          shipment: 'DTDU-298311', km: 168, onTime: true,  rating: 5 },
      { date: '2026-05-10', route: 'PBL → Maracay · Tech Solutions',   shipment: 'DTDU-285044', km: 142, onTime: true,  rating: 4 },
      { date: '2026-05-08', route: 'PBL → Caracas · CCS Polar Center', shipment: 'DTDU-271100', km: 215, onTime: true,  rating: 5 },
    ],
    notes: 'Excelente chofer veterano. Confianza absoluta para cargas premium y rutas largas. Buen rapport con clientes en planta Polar.',
  },
  'd-002': { initials: 'JV', avatarColor: 'info',    rif: 'V-12.884.331-2', dob: '1981-07-22', hireDate: '2015-03-12', email: 'j.velasquez@dtdcargo.com', address: 'Morón, Carabobo', emergencyContact: 'Yelitza Velásquez · +58 412 884 7711', licenseExpiry: '2026-11-08', licenseCategories: ['A', 'B', 'C'], medicalExpiry: '2026-07-15', psychExpiry: '2026-08-30', certifications: [{ name: 'Manejo defensivo', issuer: 'INTT', expiry: '2026-09-12' }], assignedTruck: 'T-002', trips6mo: [12, 14, 17, 18, 16, 18], onTimePct: 94, kmTotal: 84200, fuelAvg: 3.4, incidents: [], recentTrips: [{ date: '2026-05-22', route: 'PBL → Caracas · CCS Centro', shipment: 'DTDU-388157', km: 215, onTime: true, rating: 5 }], notes: '' },
  'd-003': { initials: 'CS', avatarColor: 'success', rif: 'V-14.221.554-8', dob: '1979-11-04', hireDate: '2014-06-20', email: 'c.salinas@dtdcargo.com', address: 'La Guaira, Vargas', emergencyContact: 'Ana Salinas · +58 416 339 5520', licenseExpiry: '2027-03-22', licenseCategories: ['A','B','C','D'], medicalExpiry: '2026-12-01', psychExpiry: '2027-01-15', certifications: [{ name: 'IMDG · Cargas peligrosas', issuer: 'INEA', expiry: '2026-10-30' }, { name: 'Manejo defensivo', issuer: 'INTT', expiry: '2027-02-08' }], assignedTruck: 'T-003', trips6mo: [13, 15, 14, 16, 15, 16], onTimePct: 95, kmTotal: 112800, fuelAvg: 3.3, incidents: [], recentTrips: [], notes: '' },
  'd-004': { initials: 'PM', avatarColor: 'warning', rif: 'V-7.882.044-1', dob: '1962-01-18', hireDate: '2003-09-14', email: 'p.marquina@dtdcargo.com', address: 'Maracaibo, Zulia', emergencyContact: 'Carmen Marquina · +58 426 771 4499', licenseExpiry: '2026-08-10', licenseCategories: ['A','B','C','D','E'], medicalExpiry: '2026-07-22', psychExpiry: '2026-10-05', certifications: [{ name: 'IMDG · Cargas peligrosas', issuer: 'INEA', expiry: '2027-01-14' }, { name: 'Manejo defensivo', issuer: 'INTT', expiry: '2026-12-12' }, { name: 'Primeros auxilios', issuer: 'Cruz Roja', expiry: '2027-03-08' }], assignedTruck: 'T-004', trips6mo: [20, 22, 21, 23, 24, 24], onTimePct: 97, kmTotal: 224500, fuelAvg: 3.1, incidents: [{ date: '2026-05-18', type: 'multa', desc: 'Exceso velocidad ruta MAR · ya pagada', severity: 'medium' }], recentTrips: [], notes: '22 años en DTD. Referente para rutas Zulia.' },
  'd-005': { initials: 'MC', avatarColor: 'neutral', rif: 'V-15.117.882-3', dob: '1983-05-30', hireDate: '2016-11-08', email: 'm.castillo@dtdcargo.com', address: 'Puerto Cabello, Carabobo', emergencyContact: 'Luisa Castillo · +58 412 668 2211', licenseExpiry: '2026-06-04', licenseCategories: ['A','B','C','D'], medicalExpiry: '2026-08-18', psychExpiry: '2026-09-22', certifications: [{ name: 'Manejo defensivo', issuer: 'INTT', expiry: '2026-11-30' }], assignedTruck: 'T-005', trips6mo: [10, 12, 13, 14, 13, 14], onTimePct: 91, kmTotal: 62400, fuelAvg: 3.5, incidents: [], recentTrips: [], notes: '' },
  'd-006': { initials: 'RB', avatarColor: 'wine',    rif: 'V-10.554.221-7', dob: '1973-08-09', hireDate: '2011-04-15', email: 'r.briceno@dtdcargo.com', address: 'Punto Fijo, Falcón', emergencyContact: 'Rosa Briceño · +58 414 998 7722', licenseExpiry: '2027-05-19', licenseCategories: ['A','B','C','D'], medicalExpiry: '2027-01-10', psychExpiry: '2027-02-22', certifications: [{ name: 'Manejo defensivo', issuer: 'INTT', expiry: '2027-04-04' }], assignedTruck: null, trips6mo: [9, 10, 11, 12, 11, 12], onTimePct: 93, kmTotal: 98700, fuelAvg: 3.3, incidents: [], recentTrips: [], notes: '' },
  'd-007': { initials: 'JP', avatarColor: 'info',    rif: 'V-17.882.114-9', dob: '1989-12-15', hireDate: '2020-02-03', email: 'j.pena@dtdcargo.com', address: 'Puerto Cabello, Carabobo', emergencyContact: 'Marta Peña · +58 426 220 5555', licenseExpiry: '2026-07-30', licenseCategories: ['A','B','C'], medicalExpiry: '2026-06-20', psychExpiry: '2026-12-14', certifications: [], assignedTruck: null, trips6mo: [7, 9, 10, 11, 10, 11], onTimePct: 89, kmTotal: 38200, fuelAvg: 3.6, incidents: [{ date: '2026-04-30', type: 'roce', desc: 'Roce menor en patio Polar · sin lesionados', severity: 'low' }], notes: 'En proceso de tramitar licencia D.' },
};
const CUSTOMS_AGENTS = [
  { id: 'a-001', name: 'Aduanas Carabobo CA',   rif: 'J-31002284-5', port: 'PBL', contact: 'Felipe Briceño', phone: '+58 412 552 8841', shipments: 84, rating: 4.8 },
  { id: 'a-002', name: 'Logística Aduanal VE',  rif: 'J-30884512-7', port: 'LGU', contact: 'Romina Salas',   phone: '+58 414 220 1188', shipments: 62, rating: 4.6 },
  { id: 'a-003', name: 'Zulia Aduanas SA',      rif: 'J-30551423-2', port: 'MAR', contact: 'Yoel Castillo',  phone: '+58 416 778 4477', shipments: 38, rating: 4.7 },
  { id: 'a-004', name: 'Falcón Customs',        rif: 'J-31884201-9', port: 'PFI', contact: 'Diana Méndez',   phone: '+58 424 999 2200', shipments: 24, rating: 4.9 },
];

window.ERPData = {
  PRINT_ORDERS, KPIS_EXTRA, AUDIT_LOG, BANK_STATEMENTS, CLIENT_ACCOUNTS, TRUCK_PROFILES, DRIVER_PROFILES, CUSTOMS_AGENTS,
  CORP_LINES, USER_PROFILES, PRESENCE, THREADS,
  CLIENTS, SHIPMENTS, QUOTES, INVOICES, WAREHOUSE_CN, WAREHOUSE_VE,
  LEADS, USERS, RATES, DOCUMENTS, MAIL_TEMPLATES, NOTIFS, KPIS,
  SIGNATURES, SIGNATURE_LAYOUTS, SMTP_PROVIDERS, BLACKLIST, TEMPLATE_VARIABLES,
  SHIPMENT_COSTS, shipmentEconomics, ROUTE_COST_TEMPLATES,
  SUPPLIERS, SUPPLIER_CLIENTS, ORDERS,
  TRUCKS, DRIVERS, TMS_ROUTES, TMS_INCIDENTS,
  ROLE_MODULES,
  STATUS_FLOW, STATUS_TONE,
  CATALOG,
  ORIGINS: _origins, DESTINATIONS: _destinations,
  byMarkbox: (m) => CLIENTS.find(c => c.markbox === m),
  origin: (code) => _origins.find(o => o.code === code) || { name: code, cn: '', country: 'CN' },
  dest: (code) => _destinations.find(d => d.code === code) || { name: code, country: 'VE' },
};
Object.assign(window.ERPData, _tenantApi);
