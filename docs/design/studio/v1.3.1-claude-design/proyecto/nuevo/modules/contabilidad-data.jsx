/* global React */
/* ── DTD ERP · Contabilidad · Datos & helpers ───────────────── */
/* Plan de cuentas (CoA) freight-forwarder VE + asientos seed.   */
/* Libros en USD · VES de referencia con tasa del día.           */

const CONTABILIDAD_LS_KEY = 'dtd_contab_v1';

// ── Plan de cuentas · 4 niveles ───────────────────────────────
// Estructura típica freight forwarder VE adaptada a DTD-Cargo.
// type: A (Activo) · P (Pasivo) · PT (Patrimonio) · I (Ingreso) · CGS (Costo Directo) · G (Gasto Op.) · OR (Otros Resultados)
const CHART_OF_ACCOUNTS = [
  // ── 1. ACTIVO ───────────────────────────────
  { code: '1',          name: 'ACTIVO',                                level: 1, type: 'A',  parent: null },
  { code: '1.1',        name: 'Activo Corriente',                       level: 2, type: 'A',  parent: '1' },
  { code: '1.1.01',     name: 'Banco Mercantil · USD',                  level: 3, type: 'A',  parent: '1.1' },
  { code: '1.1.02',     name: 'Banco Banesco · VES',                    level: 3, type: 'A',  parent: '1.1' },
  { code: '1.1.03',     name: 'USDT · TRC20',                           level: 3, type: 'A',  parent: '1.1' },
  { code: '1.1.04',     name: 'Caja Chica USD',                         level: 3, type: 'A',  parent: '1.1' },
  { code: '1.1.05',     name: 'Caja Chica VES',                         level: 3, type: 'A',  parent: '1.1' },
  { code: '1.1.10',     name: 'Cuentas por Cobrar Comerciales',         level: 3, type: 'A',  parent: '1.1' },
  { code: '1.1.11',     name: 'Anticipos a Proveedores',                level: 3, type: 'A',  parent: '1.1' },
  { code: '1.1.15',     name: 'IVA Crédito Fiscal',                     level: 3, type: 'A',  parent: '1.1' },
  { code: '1.1.20',     name: 'Inventario en tránsito CN',              level: 3, type: 'A',  parent: '1.1' },
  { code: '1.2',        name: 'Activo No Corriente',                    level: 2, type: 'A',  parent: '1' },
  { code: '1.2.01',     name: 'Flota propia · vehículos',               level: 3, type: 'A',  parent: '1.2' },
  { code: '1.2.02',     name: 'Mobiliario y equipos oficina',           level: 3, type: 'A',  parent: '1.2' },
  { code: '1.2.03',     name: 'Depreciación acumulada (CR)',            level: 3, type: 'A',  parent: '1.2', contra: true },

  // ── 2. PASIVO ───────────────────────────────
  { code: '2',          name: 'PASIVO',                                 level: 1, type: 'P',  parent: null },
  { code: '2.1',        name: 'Pasivo Corriente',                       level: 2, type: 'P',  parent: '2' },
  { code: '2.1.01',     name: 'Cuentas por Pagar Comerciales',          level: 3, type: 'P',  parent: '2.1' },
  { code: '2.1.05',     name: 'Anticipos de Clientes',                  level: 3, type: 'P',  parent: '2.1' },
  { code: '2.1.10',     name: 'IVA Débito Fiscal',                      level: 3, type: 'P',  parent: '2.1' },
  { code: '2.1.11',     name: 'Retenciones IVA por pagar',              level: 3, type: 'P',  parent: '2.1' },
  { code: '2.1.12',     name: 'ISLR por pagar',                         level: 3, type: 'P',  parent: '2.1' },
  { code: '2.1.15',     name: 'Sueldos y prestaciones por pagar',       level: 3, type: 'P',  parent: '2.1' },
  { code: '2.2',        name: 'Pasivo No Corriente',                    level: 2, type: 'P',  parent: '2' },
  { code: '2.2.01',     name: 'Préstamos bancarios LP',                 level: 3, type: 'P',  parent: '2.2' },

  // ── 3. PATRIMONIO ───────────────────────────
  { code: '3',          name: 'PATRIMONIO',                             level: 1, type: 'PT', parent: null },
  { code: '3.1.01',     name: 'Capital social',                         level: 3, type: 'PT', parent: '3' },
  { code: '3.1.10',     name: 'Utilidades retenidas',                   level: 3, type: 'PT', parent: '3' },
  { code: '3.1.20',     name: 'Resultado del ejercicio',                level: 3, type: 'PT', parent: '3' },
  { code: '3.1.30',     name: 'Ajuste por diferencia cambiaria',        level: 3, type: 'PT', parent: '3' },

  // ── 4. INGRESOS ─────────────────────────────
  { code: '4',          name: 'INGRESOS',                               level: 1, type: 'I',  parent: null },
  { code: '4.1.01',     name: 'Ingresos por flete marítimo',            level: 3, type: 'I',  parent: '4' },
  { code: '4.1.02',     name: 'Ingresos por flete aéreo',               level: 3, type: 'I',  parent: '4' },
  { code: '4.1.03',     name: 'Ingresos por servicio DDP',              level: 3, type: 'I',  parent: '4' },
  { code: '4.1.05',     name: 'Ingresos por seguro de carga',           level: 3, type: 'I',  parent: '4' },
  { code: '4.1.10',     name: 'Ingresos por almacenaje',                level: 3, type: 'I',  parent: '4' },
  { code: '4.1.20',     name: 'Otros ingresos operativos',              level: 3, type: 'I',  parent: '4' },

  // ── 5. COSTOS DIRECTOS (CGS) ────────────────
  { code: '5',          name: 'COSTOS DIRECTOS',                        level: 1, type: 'CGS', parent: null },
  { code: '5.1.01',     name: 'Flete naviero (compra)',                 level: 3, type: 'CGS', parent: '5' },
  { code: '5.1.02',     name: 'Flete aéreo (compra)',                   level: 3, type: 'CGS', parent: '5' },
  { code: '5.1.05',     name: 'Honorarios agente aduanal',              level: 3, type: 'CGS', parent: '5' },
  { code: '5.1.06',     name: 'Aranceles y derechos · SENIAT',          level: 3, type: 'CGS', parent: '5' },
  { code: '5.1.10',     name: 'Transporte interno VE',                  level: 3, type: 'CGS', parent: '5' },
  { code: '5.1.15',     name: 'Almacenaje (compra)',                    level: 3, type: 'CGS', parent: '5' },
  { code: '5.1.20',     name: 'Combustible flota propia',               level: 3, type: 'CGS', parent: '5' },
  { code: '5.1.25',     name: 'Salarios choferes',                      level: 3, type: 'CGS', parent: '5' },

  // ── 6. GASTOS OPERATIVOS ────────────────────
  { code: '6',          name: 'GASTOS OPERATIVOS',                      level: 1, type: 'G',  parent: null },
  { code: '6.1.01',     name: 'Salarios administrativos',               level: 3, type: 'G',  parent: '6' },
  { code: '6.1.02',     name: 'Alquiler oficina',                       level: 3, type: 'G',  parent: '6' },
  { code: '6.1.03',     name: 'Servicios · luz, agua, internet',        level: 3, type: 'G',  parent: '6' },
  { code: '6.1.05',     name: 'Marketing y publicidad',                 level: 3, type: 'G',  parent: '6' },
  { code: '6.1.10',     name: 'Gastos de viaje · China',                level: 3, type: 'G',  parent: '6' },
  { code: '6.1.11',     name: 'Viáticos comerciales',                   level: 3, type: 'G',  parent: '6' },
  { code: '6.1.15',     name: 'Comisiones bancarias',                   level: 3, type: 'G',  parent: '6' },
  { code: '6.1.20',     name: 'Software y licencias',                   level: 3, type: 'G',  parent: '6' },
  { code: '6.1.25',     name: 'Depreciación',                           level: 3, type: 'G',  parent: '6' },
  { code: '6.1.30',     name: 'Otros gastos operativos',                level: 3, type: 'G',  parent: '6' },

  // ── 7. OTROS RESULTADOS ─────────────────────
  { code: '7',          name: 'OTROS RESULTADOS',                       level: 1, type: 'OR', parent: null },
  { code: '7.1.01',     name: 'Diferencia cambiaria · ganancia',        level: 3, type: 'OR', parent: '7' },
  { code: '7.1.02',     name: 'Diferencia cambiaria · pérdida',         level: 3, type: 'OR', parent: '7' },
  { code: '7.1.10',     name: 'Intereses ganados',                      level: 3, type: 'OR', parent: '7' },
  { code: '7.1.15',     name: 'Intereses pagados',                      level: 3, type: 'OR', parent: '7' },
];

// ── Asientos seed (libro diario) ──────────────────────────────
// Cubren ~30 días con mix de facturas, pagos USD, pagos VES con diferencia
// cambiaria, gastos directos, gastos operativos. Todos contabilizados.
const JOURNAL_ENTRIES = [
  // ── Facturas emitidas
  { id: 'AS-2026-0421', date: '2026-05-22', concept: 'Factura emitida · F-2026-0391 · Industrias Polar', ref: 'F-2026-0391', refType: 'invoice', status: 'contabilizado',
    user: 'Andrés B.', createdAt: '2026-05-22 14:18',
    lines: [
      { account: '1.1.10', debit: 156800, credit: 0,      memo: 'CxC Industrias Polar' },
      { account: '4.1.01', debit: 0,      credit: 135172, memo: 'Flete marítimo MAR' },
      { account: '2.1.10', debit: 0,      credit: 21628,  memo: 'IVA Débito Fiscal 16%' },
    ],
  },
  { id: 'AS-2026-0420', date: '2026-05-20', concept: 'Factura emitida · F-2026-0398 · Castro Hermanos', ref: 'F-2026-0398', refType: 'invoice', status: 'contabilizado',
    user: 'Andrés B.', createdAt: '2026-05-20 11:05',
    lines: [
      { account: '1.1.10', debit: 48200, credit: 0,     memo: 'CxC Castro Hermanos' },
      { account: '4.1.03', debit: 0,     credit: 41552, memo: 'Servicio DDP Punto Fijo' },
      { account: '2.1.10', debit: 0,     credit: 6648,  memo: 'IVA Débito Fiscal 16%' },
    ],
  },
  { id: 'AS-2026-0419', date: '2026-05-14', concept: 'Factura emitida · F-2026-0418 · Acindar Comercial', ref: 'F-2026-0418', refType: 'invoice', status: 'contabilizado',
    user: 'Andrés B.', createdAt: '2026-05-14 09:32',
    lines: [
      { account: '1.1.10', debit: 84200, credit: 0,     memo: 'CxC Acindar Comercial' },
      { account: '4.1.01', debit: 0,     credit: 72586, memo: 'Flete marítimo PBL' },
      { account: '2.1.10', debit: 0,     credit: 11614, memo: 'IVA Débito Fiscal 16%' },
    ],
  },

  // ── Pagos recibidos USD
  { id: 'AS-2026-0418', date: '2026-05-22', concept: 'Pago recibido USD · F-2026-0391 · Polar', ref: 'WIRE-9982', refType: 'payment', status: 'contabilizado',
    user: 'Andrés B.', createdAt: '2026-05-22 15:42',
    lines: [
      { account: '1.1.01', debit: 156800, credit: 0,      memo: 'Banco Mercantil · transferencia' },
      { account: '1.1.10', debit: 0,      credit: 156800, memo: 'Cancelación CxC Polar' },
    ],
  },
  { id: 'AS-2026-0417', date: '2026-05-15', concept: 'Pago recibido USD · F-2026-0398 · Castro Hermanos', ref: 'WIRE-9954', refType: 'payment', status: 'contabilizado',
    user: 'Andrés B.', createdAt: '2026-05-15 10:18',
    lines: [
      { account: '1.1.01', debit: 48200, credit: 0,     memo: 'Banco Mercantil' },
      { account: '1.1.10', debit: 0,     credit: 48200, memo: 'Cancelación CxC Castro' },
    ],
  },

  // ── Pago recibido VES (con conversión a USD a tasa BCV) ─────
  { id: 'AS-2026-0416', date: '2026-05-19', concept: 'Pago recibido VES · F-2026-0382 · Acindar (parcial)', ref: 'TRF-VES-8841', refType: 'payment-ves', status: 'contabilizado',
    user: 'Andrés B.', createdAt: '2026-05-19 16:22',
    forex: { originalAmount: 671320, originalCurrency: 'VES', rate: 36.45, rateSource: 'bcv' },
    lines: [
      { account: '1.1.02', debit: 18416, credit: 0,     memo: 'Banesco VES · Bs. 671.320 @ 36,45' },
      { account: '1.1.10', debit: 0,     credit: 18416, memo: 'Cancelación parcial CxC Acindar' },
    ],
  },

  // ── Gastos directos (CGS)
  { id: 'AS-2026-0415', date: '2026-05-22', concept: 'Pago naviera COSCO · DTDU-501228', ref: 'TX-44182', refType: 'expense', status: 'contabilizado',
    user: 'Andrés B.', createdAt: '2026-05-22 17:00',
    lines: [
      { account: '5.1.01', debit: 28400, credit: 0,     memo: 'Flete naviero COSCO' },
      { account: '1.1.01', debit: 0,     credit: 28400, memo: 'Banco Mercantil USD' },
    ],
  },
  { id: 'AS-2026-0414', date: '2026-05-19', concept: 'Honorarios Aduanas Carabobo · mayo', ref: 'TX-44158', refType: 'expense', status: 'contabilizado',
    user: 'Andrés B.', createdAt: '2026-05-19 14:08',
    lines: [
      { account: '5.1.05', debit: 4820, credit: 0,    memo: 'Honorarios agente a-001' },
      { account: '1.1.01', debit: 0,    credit: 4820, memo: 'Banco Mercantil USD' },
    ],
  },
  { id: 'AS-2026-0413', date: '2026-05-10', concept: 'Maersk · freight DTDU-419032', ref: 'TX-44062', refType: 'expense', status: 'contabilizado',
    user: 'Andrés B.', createdAt: '2026-05-10 09:14',
    lines: [
      { account: '5.1.01', debit: 41200, credit: 0,     memo: 'Flete naviero Maersk' },
      { account: '1.1.01', debit: 0,     credit: 41200, memo: 'Banco Mercantil USD' },
    ],
  },

  // ── Gastos operativos
  { id: 'AS-2026-0412', date: '2026-05-14', concept: 'Salarios quincena · choferes flota', ref: 'TX-44102', refType: 'expense', status: 'contabilizado',
    user: 'Andrés B.', createdAt: '2026-05-14 18:30',
    lines: [
      { account: '5.1.25', debit: 8400, credit: 0,    memo: 'Salarios choferes Q1 mayo' },
      { account: '1.1.01', debit: 0,    credit: 8400, memo: 'Banco Mercantil USD' },
    ],
  },
  { id: 'AS-2026-0411', date: '2026-05-17', concept: 'Combustible flota PBL', ref: 'TX-44128', refType: 'expense', status: 'contabilizado',
    user: 'Andrés B.', createdAt: '2026-05-17 12:00',
    lines: [
      { account: '5.1.20', debit: 1240, credit: 0,    memo: 'PDV · combustible' },
      { account: '1.1.01', debit: 0,    credit: 1240, memo: 'Banco Mercantil USD' },
    ],
  },
  { id: 'AS-2026-0410', date: '2026-05-15', concept: 'Alquiler oficina Valencia · mayo', ref: 'TX-44099', refType: 'expense', status: 'contabilizado',
    user: 'Andrés B.', createdAt: '2026-05-15 08:00',
    lines: [
      { account: '6.1.02', debit: 1800, credit: 0,    memo: 'Alquiler mayo' },
      { account: '1.1.01', debit: 0,    credit: 1800, memo: 'Banco Mercantil USD' },
    ],
  },
  { id: 'AS-2026-0409', date: '2026-05-12', concept: 'Salarios administrativos · quincena', ref: 'TX-44085', refType: 'expense', status: 'contabilizado',
    user: 'Andrés B.', createdAt: '2026-05-12 18:00',
    lines: [
      { account: '6.1.01', debit: 4200, credit: 0,    memo: 'Nómina admin Q1' },
      { account: '1.1.01', debit: 0,    credit: 4200, memo: 'Banco Mercantil USD' },
    ],
  },
  { id: 'AS-2026-0408', date: '2026-05-08', concept: 'Comisiones bancarias · mayo', ref: 'TX-44044', refType: 'expense', status: 'contabilizado',
    user: 'Sistema',  createdAt: '2026-05-08 06:00',
    lines: [
      { account: '6.1.15', debit: 220, credit: 0,   memo: 'Banco · comisiones' },
      { account: '1.1.01', debit: 0,   credit: 220, memo: 'Banco Mercantil USD' },
    ],
  },

  // ── Asiento borrador (en proceso de conciliación)
  { id: 'AS-2026-0422', date: '2026-05-12', concept: 'TRX-INET digital · cargo a clasificar', ref: 'TX-44081', refType: 'unclassified', status: 'borrador',
    user: 'Andrés B.', createdAt: '2026-05-24 09:20',
    lines: [
      { account: '6.1.30', debit: 380, credit: 0,   memo: 'Por clasificar · investigar' },
      { account: '1.1.01', debit: 0,   credit: 380, memo: 'Banco Mercantil USD' },
    ],
    flagged: true,
  },
];

// ── Helpers ───────────────────────────────────────────────────
function getAccount(code) {
  return CHART_OF_ACCOUNTS.find(a => a.code === code);
}

function getAccountChildren(parentCode) {
  return CHART_OF_ACCOUNTS.filter(a => a.parent === parentCode);
}

// Suma debe/haber por cuenta (incluyendo sub-cuentas si es padre)
function accountMovements(code, entries) {
  const list = entries || JOURNAL_ENTRIES.filter(e => e.status === 'contabilizado');
  const result = [];
  list.forEach(e => {
    e.lines.forEach(l => {
      if (l.account === code) {
        result.push({ ...l, entryId: e.id, date: e.date, concept: e.concept, ref: e.ref });
      }
    });
  });
  return result;
}

function accountBalance(code, entries) {
  const acc = getAccount(code);
  if (!acc) return 0;
  // Si es agregada (level 1 o 2), suma children recursivo
  const isAggregate = acc.level <= 2;
  if (isAggregate) {
    const children = CHART_OF_ACCOUNTS.filter(a => a.parent === code || (a.parent && getAccount(a.parent)?.parent === code));
    return children.filter(c => c.level === 3).reduce((s, c) => s + accountBalance(c.code, entries), 0);
  }
  const movs = accountMovements(code, entries);
  const debits = movs.reduce((s, m) => s + (m.debit || 0), 0);
  const credits = movs.reduce((s, m) => s + (m.credit || 0), 0);
  // Activos/Gastos/CGS: saldo deudor (D - C); Pasivos/Patrimonio/Ingresos: saldo acreedor (C - D)
  if (acc.contra) return credits - debits;
  if (['A', 'G', 'CGS'].includes(acc.type)) return debits - credits;
  return credits - debits;
}

// Estado de Resultados (P&L) del período
function calculatePL(entries) {
  const list = entries || JOURNAL_ENTRIES.filter(e => e.status === 'contabilizado');
  const ingresos = CHART_OF_ACCOUNTS.filter(a => a.type === 'I' && a.level === 3).map(a => ({
    account: a, balance: accountBalance(a.code, list),
  }));
  const cgs = CHART_OF_ACCOUNTS.filter(a => a.type === 'CGS' && a.level === 3).map(a => ({
    account: a, balance: accountBalance(a.code, list),
  }));
  const gastos = CHART_OF_ACCOUNTS.filter(a => a.type === 'G' && a.level === 3).map(a => ({
    account: a, balance: accountBalance(a.code, list),
  }));
  const otros = CHART_OF_ACCOUNTS.filter(a => a.type === 'OR' && a.level === 3).map(a => ({
    account: a, balance: accountBalance(a.code, list),
  }));
  const totalIngresos = ingresos.reduce((s, r) => s + r.balance, 0);
  const totalCgs = cgs.reduce((s, r) => s + r.balance, 0);
  const utilidadBruta = totalIngresos - totalCgs;
  const totalGastos = gastos.reduce((s, r) => s + r.balance, 0);
  const utilidadOperativa = utilidadBruta - totalGastos;
  const totalOtros = otros.reduce((s, r) => s + r.balance, 0);
  const utilidadNeta = utilidadOperativa + totalOtros;
  return { ingresos, cgs, gastos, otros, totalIngresos, totalCgs, utilidadBruta, totalGastos, utilidadOperativa, totalOtros, utilidadNeta };
}

// Balance General
function calculateBS(entries) {
  const list = entries || JOURNAL_ENTRIES.filter(e => e.status === 'contabilizado');
  const activosC = CHART_OF_ACCOUNTS.filter(a => a.parent === '1.1').map(a => ({ account: a, balance: accountBalance(a.code, list) }));
  const activosNC = CHART_OF_ACCOUNTS.filter(a => a.parent === '1.2').map(a => ({ account: a, balance: accountBalance(a.code, list) }));
  const pasivosC = CHART_OF_ACCOUNTS.filter(a => a.parent === '2.1').map(a => ({ account: a, balance: accountBalance(a.code, list) }));
  const pasivosNC = CHART_OF_ACCOUNTS.filter(a => a.parent === '2.2').map(a => ({ account: a, balance: accountBalance(a.code, list) }));
  const patrimonio = CHART_OF_ACCOUNTS.filter(a => a.type === 'PT' && a.level === 3).map(a => ({ account: a, balance: accountBalance(a.code, list) }));
  const pl = calculatePL(list);
  // Inyectar utilidad del ejercicio
  patrimonio.push({ account: { code: '3.1.20', name: 'Resultado del ejercicio (calculado)' }, balance: pl.utilidadNeta, calculated: true });
  const totalActivosC = activosC.reduce((s, r) => s + r.balance, 0);
  const totalActivosNC = activosNC.reduce((s, r) => s + r.balance, 0);
  const totalActivos = totalActivosC + totalActivosNC;
  const totalPasivosC = pasivosC.reduce((s, r) => s + r.balance, 0);
  const totalPasivosNC = pasivosNC.reduce((s, r) => s + r.balance, 0);
  const totalPasivos = totalPasivosC + totalPasivosNC;
  const totalPatrimonio = patrimonio.reduce((s, r) => s + r.balance, 0);
  return { activosC, activosNC, pasivosC, pasivosNC, patrimonio, totalActivosC, totalActivosNC, totalActivos, totalPasivosC, totalPasivosNC, totalPasivos, totalPatrimonio };
}

// Lock state / permisos
function readLock() {
  try {
    const raw = localStorage.getItem(CONTABILIDAD_LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { locked: true, unlockedBy: null, unlockedUntil: null };
}

function writeLock(state) {
  try { localStorage.setItem(CONTABILIDAD_LS_KEY, JSON.stringify(state)); } catch (e) {}
  window.dispatchEvent(new CustomEvent('dtd-contab-lock', { detail: state }));
  return state;
}

function isUnlocked() {
  const s = readLock();
  if (!s.locked) return true;
  if (s.unlockedUntil && new Date(s.unlockedUntil).getTime() > Date.now()) return true;
  return false;
}

// Type display helpers
const TYPE_LABEL = {
  A:   { label: 'Activo',      tone: 'wine' },
  P:   { label: 'Pasivo',      tone: 'warning' },
  PT:  { label: 'Patrimonio',  tone: 'info' },
  I:   { label: 'Ingreso',     tone: 'success' },
  CGS: { label: 'Costo dir.',   tone: 'wine' },
  G:   { label: 'Gasto op.',    tone: 'warning' },
  OR:  { label: 'Otros',       tone: 'neutral' },
};

window.ContabilidadData = {
  CHART_OF_ACCOUNTS,
  JOURNAL_ENTRIES,
  getAccount, getAccountChildren, accountMovements, accountBalance,
  calculatePL, calculateBS,
  readLock, writeLock, isUnlocked,
  TYPE_LABEL,
  CONTABILIDAD_LS_KEY,
};
