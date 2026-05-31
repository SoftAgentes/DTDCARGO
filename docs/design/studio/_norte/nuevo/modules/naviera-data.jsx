/* global React */
/* ── DTD ERP · Naviera · Datos & helpers ────────────────────── */
/* Cierra el círculo logístico: la naviera como entidad.         */
/* Itinerarios (sailings) · reservas de espacio (bookings) ·     */
/* consolidación de contenedor LCL→FCL con optimización de CBM.  */

// ── Navieras (carriers) ───────────────────────────────────────
const CARRIERS = [
  { id: 'cosco',  name: 'COSCO Shipping Lines', cn: '中远海运',  scac: 'COSU', tone: 'wine',    lanes: ['Ningbo→Puerto Cabello', 'Yantian→La Guaira'] },
  { id: 'maersk', name: 'Maersk Line',          cn: null,        scac: 'MAEU', tone: 'info',    lanes: ['Yantian→Puerto Cabello'] },
  { id: 'msc',    name: 'MSC',                  cn: null,        scac: 'MSCU', tone: 'neutral', lanes: ['Shanghai→La Guaira'] },
  { id: 'evergreen', name: 'Evergreen Line',    cn: '長榮海運',  scac: 'EGLV', tone: 'success', lanes: ['Nansha→Puerto Cabello'] },
];

// ── Puertos ───────────────────────────────────────────────────
const PORTS = {
  NGB: { code: 'NGB', name: 'Ningbo',         cn: '宁波',  country: 'CN' },
  YTN: { code: 'YTN', name: 'Yantian',        cn: '盐田',  country: 'CN' },
  SHA: { code: 'SHA', name: 'Shanghai',       cn: '上海',  country: 'CN' },
  NSA: { code: 'NSA', name: 'Nansha',         cn: '南沙',  country: 'CN' },
  PBL: { code: 'PBL', name: 'Puerto Cabello', cn: null,    country: 'VE' },
  LGU: { code: 'LGU', name: 'La Guaira',      cn: null,    country: 'VE' },
};

// ── Tipos de contenedor · capacidad útil ──────────────────────
const CONTAINER_TYPES = {
  "20GP":  { label: "20' GP",  cbm: 33, kg: 28000 },
  "40GP":  { label: "40' GP",  cbm: 67, kg: 26500 },
  "40HC":  { label: "40' HC",  cbm: 76, kg: 26500 },
};

// ── Itinerarios (sailings) ────────────────────────────────────
// cutoff = fecha límite de carga (cargo cut-off). status según fecha.
const SAILINGS = [
  { id: 'NGBPBL-2218', carrier: 'cosco',  vessel: 'COSCO FORTUNE',   voyage: '048W', pol: 'NGB', pod: 'PBL', etd: '2026-05-30', eta: '2026-07-02', cutoff: '2026-05-27', transit: 33, status: 'cutoff', space: 'media' },
  { id: 'YTNLGU-1184', carrier: 'maersk', vessel: 'MAERSK SELETAR',  voyage: '522W', pol: 'YTN', pod: 'LGU', etd: '2026-06-03', eta: '2026-07-08', cutoff: '2026-05-31', transit: 35, status: 'abierto', space: 'alta' },
  { id: 'SHALGU-0907', carrier: 'msc',    vessel: 'MSC LORETO',      voyage: '331A', pol: 'SHA', pod: 'LGU', etd: '2026-06-06', eta: '2026-07-14', cutoff: '2026-06-03', transit: 38, status: 'abierto', space: 'alta' },
  { id: 'NSAPBL-0442', carrier: 'evergreen', vessel: 'EVER GIVEN',   voyage: '129W', pol: 'NSA', pod: 'PBL', etd: '2026-06-10', eta: '2026-07-11', cutoff: '2026-06-07', transit: 31, status: 'abierto', space: 'baja' },
  { id: 'NGBPBL-2209', carrier: 'cosco',  vessel: 'COSCO HARMONY',   voyage: '047W', pol: 'NGB', pod: 'PBL', etd: '2026-05-22', eta: '2026-06-24', cutoff: '2026-05-19', transit: 33, status: 'zarpado', space: 'cerrada' },
  { id: 'YTNPBL-1102', carrier: 'maersk', vessel: 'MAERSK CABO',     voyage: '519W', pol: 'YTN', pod: 'PBL', etd: '2026-05-15', eta: '2026-06-19', cutoff: '2026-05-12', transit: 35, status: 'transito', space: 'cerrada' },
];

// ── Bookings (reservas de espacio) ────────────────────────────
const BOOKINGS = [
  { id: 'BKG-2026-0418', carrier: 'cosco',  sailing: 'NGBPBL-2218', bl: null,            type: '40HC', mode: 'FCL', container: 'cont-501', shipper: 'Industrial CN Group', commodity: 'Electrodomésticos', cbm: 68.2, weight: 22100, status: 'confirmado', shipments: ['DTDU-419032'] },
  { id: 'BKG-2026-0417', carrier: 'maersk', sailing: 'YTNLGU-1184', bl: null,            type: '40HC', mode: 'LCL', container: 'cont-502', shipper: 'DTD-Cargo Consol', commodity: 'Carga consolidada', cbm: 0, weight: 0, status: 'abierto', shipments: [] },
  { id: 'BKG-2026-0416', carrier: 'cosco',  sailing: 'NGBPBL-2209', bl: 'COSU6620041X', type: '20GP', mode: 'FCL', container: 'cont-503', shipper: 'Yiwu Standard Trading', commodity: 'Bazar general', cbm: 28.4, weight: 12400, status: 'zarpado', shipments: ['DTDU-472816'] },
  { id: 'BKG-2026-0415', carrier: 'maersk', sailing: 'YTNPBL-1102', bl: 'MAEU772210Y',  type: '40GP', mode: 'LCL', container: 'cont-504', shipper: 'DTD-Cargo Consol', commodity: 'Carga consolidada', cbm: 61.4, weight: 19800, status: 'transito', shipments: ['DTDU-388157', 'DTDU-412908', 'DTDU-398770'] },
  { id: 'BKG-2026-0414', carrier: 'evergreen', sailing: 'NSAPBL-0442', bl: null,         type: '40HC', mode: 'LCL', container: 'cont-505', shipper: 'DTD-Cargo Consol', commodity: 'Carga consolidada', cbm: 0, weight: 0, status: 'abierto', shipments: [] },
];

// ── Contenedores / consolidación LCL→FCL ──────────────────────
// Cada contenedor agrupa embarques chicos. items = piezas asignadas.
const CONTAINERS = [
  {
    id: 'cont-502', ref: 'DTD-CONSOL-0502', type: '40HC', booking: 'BKG-2026-0417', sailing: 'YTNLGU-1184',
    status: 'consolidando',
    items: [
      { markbox: 'DTD-5418', client: 'Imp. Pereira',     cbm: 8.2,  weight: 3400, pieces: 14, supplier: 'Shenzhen Lights' },
      { markbox: 'DTD-5371', client: 'Tech Solutions',   cbm: 4.6,  weight: 1800, pieces: 6,  supplier: 'Shanghai Tech' },
      { markbox: 'DTD-5215', client: 'Ortiz Cosmetics',  cbm: 6.8,  weight: 2100, pieces: 22, supplier: 'SZ Beauty' },
      { markbox: 'DTD-5298', client: 'Vargas & Asoc',    cbm: 5.4,  weight: 2600, pieces: 9,  supplier: 'Yiwu Standard' },
    ],
  },
  {
    id: 'cont-505', ref: 'DTD-CONSOL-0505', type: '40HC', booking: 'BKG-2026-0414', sailing: 'NSAPBL-0442',
    status: 'consolidando',
    items: [
      { markbox: 'DTD-5277', client: 'BriceñoTex',       cbm: 6.2,  weight: 2400, pieces: 11, supplier: 'GZ Textile' },
      { markbox: 'DTD-5340', client: 'Dist. Andina',     cbm: 12.4, weight: 5200, pieces: 18, supplier: 'Yiwu Trade Mall' },
    ],
  },
  {
    id: 'cont-504', ref: 'DTD-CONSOL-0504', type: '40GP', booking: 'BKG-2026-0415', sailing: 'YTNPBL-1102',
    status: 'cerrado',
    items: [
      { markbox: 'DTD-5418', client: 'Imp. Pereira',     cbm: 8.2,  weight: 3400, pieces: 14, supplier: 'Shenzhen Lights' },
      { markbox: 'DTD-5371', client: 'Tech Solutions',   cbm: 4.6,  weight: 1800, pieces: 6,  supplier: 'Shanghai Tech' },
      { markbox: 'DTD-5277', client: 'BriceñoTex',       cbm: 28.4, weight: 9400, pieces: 31, supplier: 'GZ Textile' },
      { markbox: 'DTD-5340', client: 'Dist. Andina',     cbm: 20.2, weight: 5200, pieces: 24, supplier: 'Yiwu Trade Mall' },
    ],
  },
];

// ── Carga suelta lista para consolidar (en almacén CN) ────────
// Piezas recibidas en almacén China, sin contenedor asignado.
const LOOSE_CARGO = [
  { markbox: 'DTD-5452', client: 'Acindar Comercial', cbm: 9.4,  weight: 4100, pieces: 16, supplier: 'Industrial CN', pol: 'NGB', readyDate: '2026-05-21' },
  { markbox: 'DTD-5263', client: 'Comercial Linares', cbm: 3.8,  weight: 1400, pieces: 7,  supplier: 'GZ Textile',   pol: 'NSA', readyDate: '2026-05-23' },
  { markbox: 'DTD-5321', client: 'Salazar Trading',   cbm: 5.1,  weight: 2200, pieces: 12, supplier: 'Yiwu Standard', pol: 'NGB', readyDate: '2026-05-24' },
  { markbox: 'DTD-5241', client: 'Ind. Hernández',    cbm: 14.6, weight: 6800, pieces: 21, supplier: 'Industrial CN', pol: 'YTN', readyDate: '2026-05-22' },
];

// ── Estados ───────────────────────────────────────────────────
const SAILING_STATUS = {
  abierto:  { label: 'Espacio abierto', tone: 'success' },
  cutoff:   { label: 'Cut-off próximo', tone: 'warning' },
  zarpado:  { label: 'Zarpado',         tone: 'info'    },
  transito: { label: 'En tránsito',     tone: 'info'    },
  arribado: { label: 'Arribado',        tone: 'neutral' },
};
const BOOKING_STATUS = {
  abierto:    { label: 'Abierto',    tone: 'warning' },
  solicitado: { label: 'Solicitado', tone: 'info'    },
  confirmado: { label: 'Confirmado', tone: 'success' },
  cerrado:    { label: 'Cerrado',    tone: 'wine'    },
  zarpado:    { label: 'Zarpado',    tone: 'info'    },
  transito:   { label: 'En tránsito', tone: 'info'   },
};
const CONTAINER_STATUS = {
  consolidando: { label: 'Consolidando', tone: 'warning' },
  cerrado:      { label: 'Cerrado',      tone: 'success' },
  zarpado:      { label: 'Zarpado',      tone: 'info'    },
};
const SPACE_TONE = { alta: 'success', media: 'warning', baja: 'danger', cerrada: 'neutral' };

// ── Helpers ───────────────────────────────────────────────────
const TODAY = '2026-05-24';

function carrier(id) { return CARRIERS.find(c => c.id === id); }
function sailing(id) { return SAILINGS.find(s => s.id === id); }
function booking(id) { return BOOKINGS.find(b => b.id === id); }
function port(code) { return PORTS[code]; }
function ctype(t) { return CONTAINER_TYPES[t]; }

function daysUntil(dateStr) {
  return Math.round((new Date(dateStr + 'T00:00:00') - new Date(TODAY + 'T00:00:00')) / 86400000);
}

// Métricas de utilización de un contenedor
function containerStats(c) {
  const cap = CONTAINER_TYPES[c.type];
  const usedCbm = c.items.reduce((s, i) => s + i.cbm, 0);
  const usedKg = c.items.reduce((s, i) => s + i.weight, 0);
  const pieces = c.items.reduce((s, i) => s + i.pieces, 0);
  return {
    cap, usedCbm, usedKg, pieces,
    cbmPct: (usedCbm / cap.cbm) * 100,
    kgPct: (usedKg / cap.kg) * 100,
    freeCbm: Math.max(0, cap.cbm - usedCbm),
    freeKg: Math.max(0, cap.kg - usedKg),
    clients: c.items.length,
  };
}

function openSailings() { return SAILINGS.filter(s => ['abierto', 'cutoff'].includes(s.status)); }
function consolidating() { return CONTAINERS.filter(c => c.status === 'consolidando'); }
function totalLooseCbm() { return LOOSE_CARGO.reduce((s, i) => s + i.cbm, 0); }

window.NavieraData = {
  CARRIERS, PORTS, CONTAINER_TYPES, SAILINGS, BOOKINGS, CONTAINERS, LOOSE_CARGO,
  SAILING_STATUS, BOOKING_STATUS, CONTAINER_STATUS, SPACE_TONE,
  carrier, sailing, booking, port, ctype, daysUntil,
  containerStats, openSailings, consolidating, totalLooseCbm, TODAY,
};
