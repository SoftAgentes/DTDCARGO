/* global React */
/* ── DTD ERP · Tesorería · Datos & helpers ──────────────────── */
/* La otra mitad del libro: lo que DTD-Cargo PAGA.               */
/* Caja multi-moneda (USD · VES · CNY · USDT) · Cuentas por      */
/* pagar (proveedores CN, navieras, aduana) · órdenes de pago.   */

const TESORERIA_LS_KEY = 'dtd_tesoreria_v1';

// ── Tasas locales adicionales ─────────────────────────────────
// ERPRates ya maneja BCV/paralelo/CNY (USD/CNY). Tesorería suma
// formato CNY y conversiones de remesas a China.
function fmtCny(n) {
  if (n === null || n === undefined || n === '') return '—';
  const v = Math.round(Number(n) || 0);
  return '¥ ' + v.toLocaleString('es-VE').replace(/,/g, '.');
}
function usdToCny(usd) {
  const r = (window.ERPRates?.read?.() || {}).cny || 7.18;
  return (Number(usd) || 0) * r;
}
function cnyToUsd(cny) {
  const r = (window.ERPRates?.read?.() || {}).cny || 7.18;
  return (Number(cny) || 0) / r;
}

// ── Cuentas de tesorería · saldos por moneda ──────────────────
// balanceUsd = saldo expresado en USD (moneda funcional).
const CASH_ACCOUNTS = [
  { id: 'acc-usd-merc',  name: 'Banco Mercantil · USD',   short: 'Mercantil USD', currency: 'USD',  coa: '1.1.01', balance: 184260, balanceUsd: 184260, tone: 'wine',    kind: 'banco',  detail: 'Cuenta operativa principal · cobros de clientes' },
  { id: 'acc-ves-banesco', name: 'Banco Banesco · VES',   short: 'Banesco VES',   currency: 'VES',  coa: '1.1.02', balance: 9842000, balanceUsd: 270014, tone: 'info',  kind: 'banco',  detail: 'Pagos locales · nómina · servicios VE' },
  { id: 'acc-usdt',      name: 'USDT · TRC20',            short: 'USDT TRC20',    currency: 'USDT', coa: '1.1.03', balance: 96400,  balanceUsd: 96400,  tone: 'success', kind: 'cripto', detail: 'Wallet corporativa · remesas rápidas a China' },
  { id: 'acc-cny-boc',   name: 'Bank of China · CNY',     short: 'BoC CNY',       currency: 'CNY',  coa: '1.1.06', balance: 421800, balanceUsd: 58747,  tone: 'warning', kind: 'banco',  detail: 'Cuenta puente en China · pago a proveedores 中国' },
  { id: 'acc-cny-alipay', name: 'Alipay Business · CNY',  short: 'Alipay CNY',    currency: 'CNY',  coa: '1.1.07', balance: 88600,  balanceUsd: 12340,  tone: 'neutral', kind: 'cripto', detail: 'Pagos chicos a fábricas · 1688 / Alibaba' },
  { id: 'acc-cash-usd',  name: 'Caja Chica · USD',        short: 'Caja USD',      currency: 'USD',  coa: '1.1.04', balance: 4200,   balanceUsd: 4200,   tone: 'neutral', kind: 'caja',   detail: 'Gastos menores oficina Valencia' },
];

// ── Beneficiarios (a quién le pagamos) ────────────────────────
// Tipos: supplier (proveedor CN), carrier (naviera), customs (agente
// aduanal), transport (transporte interno), service (gasto operativo).
const PAYEES = [
  { id: 'pay-sup-001', type: 'supplier', name: 'Yiwu Standard Trading Co', cn: '义乌标准贸易', ref: 'sup-001', channel: 'USDT · TRC20',      country: 'CN' },
  { id: 'pay-sup-004', type: 'supplier', name: 'Shanghai Tech Industries', cn: '上海科技工业', ref: 'sup-004', channel: 'Wire · Bank of China', country: 'CN' },
  { id: 'pay-sup-007', type: 'supplier', name: 'Industrial CN Group',      cn: '中国工业集团', ref: 'sup-007', channel: 'Wire · Bank of China', country: 'CN' },
  { id: 'pay-sup-003', type: 'supplier', name: 'Guangzhou Textile Mfg',    cn: '广州纺织制造', ref: 'sup-003', channel: 'Alipay · CNY',        country: 'CN' },
  { id: 'pay-car-cosco', type: 'carrier', name: 'COSCO Shipping Lines',    cn: '中远海运',     ref: 'carrier', channel: 'Wire · USD',          country: 'CN' },
  { id: 'pay-car-maersk', type: 'carrier', name: 'Maersk Line',            cn: null,           ref: 'carrier', channel: 'Wire · USD',          country: 'DK' },
  { id: 'pay-car-msc',   type: 'carrier', name: 'MSC Mediterranean',       cn: null,           ref: 'carrier', channel: 'Wire · USD',          country: 'CH' },
  { id: 'pay-cus-001',   type: 'customs', name: 'Aduanas Carabobo · Agente a-001', cn: null,    ref: 'agent',  channel: 'Transferencia · VES', country: 'VE' },
  { id: 'pay-trn-001',   type: 'transport', name: 'Transporte Interno · Flota propia', cn: null, ref: 'tms',  channel: 'Caja · VES',          country: 'VE' },
  { id: 'pay-srv-rent',  type: 'service', name: 'Inmobiliaria Valencia · Alquiler', cn: null,   ref: 'service', channel: 'Transferencia · VES', country: 'VE' },
];

const PAYEE_TYPE = {
  supplier:  { label: 'Proveedor CN', tone: 'wine',    icon: 'cn' },
  carrier:   { label: 'Naviera',      tone: 'info',    icon: 'box' },
  customs:   { label: 'Aduana',       tone: 'warning', icon: 'shield' },
  transport: { label: 'Transporte',   tone: 'neutral', icon: 'truck' },
  service:   { label: 'Servicio',     tone: 'neutral', icon: 'doc' },
};

// ── Cuentas por pagar (CxP) · pipeline ────────────────────────
// status: pendiente · programado · parcial · pagado · vencido
// amountUsd siempre presente (moneda funcional). amount/currency = original.
const PAYABLES = [
  { id: 'CXP-2026-0188', payee: 'pay-sup-004', concept: 'Mercadería PO-9981 · electrónica', currency: 'USD',  amount: 38400, amountUsd: 38400, paidUsd: 0,     dueDate: '2026-05-28', issueDate: '2026-05-08', status: 'programado', shipment: 'DTDU-419032', invoice: 'PI-SHTECH-1187', terms: '20 días', priority: 'alta' },
  { id: 'CXP-2026-0187', payee: 'pay-car-cosco', concept: 'Flete marítimo FCL 40HC · MAR', currency: 'USD',  amount: 28400, amountUsd: 28400, paidUsd: 0,     dueDate: '2026-05-26', issueDate: '2026-05-12', status: 'pendiente', shipment: 'DTDU-419032', invoice: 'COSCO-BL-77412', terms: 'contra BL', priority: 'alta' },
  { id: 'CXP-2026-0186', payee: 'pay-sup-007', concept: 'Anticipo 30% PO-9975 · industrial', currency: 'USDT', amount: 41200, amountUsd: 41200, paidUsd: 41200, dueDate: '2026-05-15', issueDate: '2026-05-02', status: 'pagado',    shipment: 'DTDU-388501', invoice: 'PI-INDCN-2204', terms: 'anticipo', priority: 'media' },
  { id: 'CXP-2026-0185', payee: 'pay-sup-001', concept: 'Saldo 70% PO-9962 · bazar', currency: 'USDT', amount: 18600, amountUsd: 18600, paidUsd: 0,     dueDate: '2026-05-24', issueDate: '2026-05-04', status: 'vencido',   shipment: 'DTDU-472816', invoice: 'PI-YIWU-3391', terms: 'contra embarque', priority: 'alta' },
  { id: 'CXP-2026-0184', payee: 'pay-sup-003', concept: 'Mercadería PO-9958 · textil', currency: 'CNY',  amount: 198400, amountUsd: 27632, paidUsd: 13816, dueDate: '2026-05-30', issueDate: '2026-05-06', status: 'parcial',   shipment: 'DTDU-398770', invoice: 'PI-GZTEX-8842', terms: '50/50', priority: 'media' },
  { id: 'CXP-2026-0183', payee: 'pay-car-maersk', concept: 'Flete marítimo FCL 20 · PBL', currency: 'USD',  amount: 14200, amountUsd: 14200, paidUsd: 0,     dueDate: '2026-06-02', issueDate: '2026-05-14', status: 'pendiente', shipment: 'DTDU-472816', invoice: 'MAERSK-BL-55218', terms: 'contra BL', priority: 'media' },
  { id: 'CXP-2026-0182', payee: 'pay-cus-001', concept: 'Honorarios despacho · mayo Q2', currency: 'VES',  amount: 175680, amountUsd: 4820, paidUsd: 0,     dueDate: '2026-05-27', issueDate: '2026-05-19', status: 'pendiente', shipment: null, invoice: 'AGT-CAR-0521', terms: '8 días', priority: 'baja' },
  { id: 'CXP-2026-0181', payee: 'pay-srv-rent', concept: 'Alquiler oficina Valencia · junio', currency: 'VES',  amount: 65610, amountUsd: 1800, paidUsd: 0,     dueDate: '2026-06-01', issueDate: '2026-05-20', status: 'pendiente', shipment: null, invoice: 'INM-VAL-0625', terms: 'mensual', priority: 'media' },
  { id: 'CXP-2026-0180', payee: 'pay-car-msc',  concept: 'Flete LCL consolidado · LGU', currency: 'USD',  amount: 8600,  amountUsd: 8600,  paidUsd: 0,     dueDate: '2026-06-05', issueDate: '2026-05-18', status: 'pendiente', shipment: 'DTDU-412908', invoice: 'MSC-BL-33907', terms: 'contra BL', priority: 'baja' },
  { id: 'CXP-2026-0179', payee: 'pay-sup-001', concept: 'Anticipo 30% PO-9988 · bazar', currency: 'USDT', amount: 9400,  amountUsd: 9400,  paidUsd: 9400,  dueDate: '2026-05-12', issueDate: '2026-05-01', status: 'pagado',    shipment: null, invoice: 'PI-YIWU-3402', terms: 'anticipo', priority: 'baja' },
];

// ── Órdenes de pago / remesas ejecutadas ──────────────────────
// method: wire-usd · usdt · alipay-cny · wire-cny · transfer-ves · cash
const PAYMENT_ORDERS = [
  { id: 'OP-2026-0312', date: '2026-05-15', payable: 'CXP-2026-0186', payee: 'pay-sup-007', method: 'usdt',        fromAccount: 'acc-usdt',     amountUsd: 41200, currency: 'USDT', amountOriginal: 41200,  rate: 1,      status: 'completado', approvedBy: 'Carlos V. (Admin)', reference: 'TRC20·0x8f...a21', concept: 'Anticipo 30% PO-9975 · Industrial CN Group' },
  { id: 'OP-2026-0311', date: '2026-05-12', payable: 'CXP-2026-0179', payee: 'pay-sup-001', method: 'usdt',        fromAccount: 'acc-usdt',     amountUsd: 9400,  currency: 'USDT', amountOriginal: 9400,   rate: 1,      status: 'completado', approvedBy: 'Andrés B. (Contab.)', reference: 'TRC20·0x3b...d07', concept: 'Anticipo 30% PO-9988 · Yiwu Standard' },
  { id: 'OP-2026-0310', date: '2026-05-20', payable: 'CXP-2026-0184', payee: 'pay-sup-003', method: 'alipay-cny',  fromAccount: 'acc-cny-alipay', amountUsd: 13816, currency: 'CNY',  amountOriginal: 99200,  rate: 7.18,   status: 'completado', approvedBy: 'Andrés B. (Contab.)', reference: 'ALI·202605200847', concept: 'Pago 50% PO-9958 · Guangzhou Textile' },
  { id: 'OP-2026-0309', date: '2026-05-22', payable: 'CXP-2026-0187', payee: 'pay-car-cosco', method: 'wire-usd',  fromAccount: 'acc-usd-merc', amountUsd: 28400, currency: 'USD',  amountOriginal: 28400,  rate: 1,      status: 'en-proceso', approvedBy: 'Carlos V. (Admin)', reference: 'WIRE·SWIFT-44182', concept: 'Flete marítimo COSCO · DTDU-419032' },
  { id: 'OP-2026-0308', date: '2026-05-19', payable: 'CXP-2026-0182', payee: 'pay-cus-001', method: 'transfer-ves', fromAccount: 'acc-ves-banesco', amountUsd: 4820, currency: 'VES', amountOriginal: 175680, rate: 36.45,  status: 'en-proceso', approvedBy: 'Andrés B. (Contab.)', reference: 'TRF·VES-8841', concept: 'Honorarios aduana · pendiente de confirmación' },
];

const PO_METHOD = {
  'wire-usd':     { label: 'Wire · USD',     tone: 'wine'    },
  'usdt':         { label: 'USDT · TRC20',   tone: 'success' },
  'alipay-cny':   { label: 'Alipay · CNY',   tone: 'info'    },
  'wire-cny':     { label: 'Wire · CNY',     tone: 'warning' },
  'transfer-ves': { label: 'Transfer · VES', tone: 'info'    },
  'cash':         { label: 'Caja',           tone: 'neutral' },
};

const PAYABLE_STATUS = {
  pendiente:  { label: 'Pendiente',  tone: 'neutral' },
  programado: { label: 'Programado', tone: 'info'    },
  parcial:    { label: 'Parcial',    tone: 'warning' },
  pagado:     { label: 'Pagado',     tone: 'success' },
  vencido:    { label: 'Vencido',    tone: 'danger'  },
};

const PO_STATUS = {
  'borrador':    { label: 'Borrador',    tone: 'neutral' },
  'en-proceso':  { label: 'En proceso',  tone: 'warning' },
  'completado':  { label: 'Completado',  tone: 'success' },
  'rechazado':   { label: 'Rechazado',   tone: 'danger'  },
};

// ── Helpers ───────────────────────────────────────────────────
const TODAY = '2026-05-24';

function getPayee(id) { return PAYEES.find(p => p.id === id); }
function getAccount(id) { return CASH_ACCOUNTS.find(a => a.id === id); }

function daysUntil(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const t = new Date(TODAY + 'T00:00:00');
  return Math.round((d - t) / 86400000);
}

function outstandingUsd(p) { return Math.max(0, (p.amountUsd || 0) - (p.paidUsd || 0)); }

// ── Depósitos de caja (ingresos por cobranza) · overlay persistente ──
// Los cobros registrados en Cobranzas aterrizan acá y suman al saldo de
// la cuenta elegida. Persistido en localStorage; evento dtd-tesoreria-changed.
const CASH_LS_KEY = 'dtd_cash_deposits_v1';
function cashDeposits() { try { return JSON.parse(localStorage.getItem(CASH_LS_KEY) || '[]'); } catch (e) { return []; } }
function _cashWriteDeposits(arr) {
  try { localStorage.setItem(CASH_LS_KEY, JSON.stringify(arr)); } catch (e) {}
  window.dispatchEvent(new CustomEvent('dtd-tesoreria-changed'));
}
function accountDepositsOrig(id) { return cashDeposits().filter(d => d.accountId === id).reduce((s, d) => s + (Number(d.amountOriginal) || 0), 0); }
function accountDepositsUsd(id)  { return cashDeposits().filter(d => d.accountId === id).reduce((s, d) => s + (Number(d.amountUsd) || 0), 0); }
function accBalance(acc)    { return (acc.balance || 0) + accountDepositsOrig(acc.id); }
function accBalanceUsd(acc) { return (acc.balanceUsd || 0) + accountDepositsUsd(acc.id); }
function cashDeposit(entry) {
  const arr = cashDeposits();
  arr.push({ id: 'DEP-' + Date.now(), date: TODAY, ...entry });
  _cashWriteDeposits(arr);
}

// Posición de caja por moneda (agregada)
function cashByCurrency() {
  const map = {};
  CASH_ACCOUNTS.forEach(a => {
    if (!map[a.currency]) map[a.currency] = { currency: a.currency, balance: 0, balanceUsd: 0, accounts: 0 };
    map[a.currency].balance += accBalance(a);
    map[a.currency].balanceUsd += accBalanceUsd(a);
    map[a.currency].accounts += 1;
  });
  return Object.values(map).sort((a, b) => b.balanceUsd - a.balanceUsd);
}

function totalCashUsd() { return CASH_ACCOUNTS.reduce((s, a) => s + accBalanceUsd(a), 0); }

// CxP abiertas (no pagadas)
function openPayables() { return PAYABLES.filter(p => p.status !== 'pagado'); }
function totalOpenUsd() { return openPayables().reduce((s, p) => s + outstandingUsd(p), 0); }
function overduePayables() { return PAYABLES.filter(p => p.status === 'vencido' || (p.status !== 'pagado' && daysUntil(p.dueDate) < 0)); }
function dueSoon(days = 7) { return openPayables().filter(p => { const d = daysUntil(p.dueDate); return d >= 0 && d <= days; }); }

// Agrupar CxP abiertas por tipo de beneficiario
function openByType() {
  const map = {};
  openPayables().forEach(p => {
    const t = getPayee(p.payee)?.type || 'service';
    if (!map[t]) map[t] = { type: t, count: 0, usd: 0 };
    map[t].count += 1;
    map[t].usd += outstandingUsd(p);
  });
  return Object.values(map).sort((a, b) => b.usd - a.usd);
}

// Proyección de salidas de caja 4 semanas
function cashOutForecast() {
  const weeks = [
    { label: 'Sem 1 · 24–30 may', from: 0,  to: 6,  usd: 0 },
    { label: 'Sem 2 · 31–06 jun', from: 7,  to: 13, usd: 0 },
    { label: 'Sem 3 · 07–13 jun', from: 14, to: 20, usd: 0 },
    { label: 'Sem 4 · 14–20 jun', from: 21, to: 27, usd: 0 },
  ];
  openPayables().forEach(p => {
    const d = daysUntil(p.dueDate);
    const w = weeks.find(w => d >= w.from && d <= w.to);
    if (w) w.usd += outstandingUsd(p);
    else if (d < 0) weeks[0].usd += outstandingUsd(p); // vencidos caen en sem 1
  });
  return weeks;
}

window.TesoreriaData = {
  CASH_ACCOUNTS, PAYEES, PAYABLES, PAYMENT_ORDERS,
  PAYEE_TYPE, PAYABLE_STATUS, PO_STATUS, PO_METHOD,
  getPayee, getAccount, daysUntil, outstandingUsd,
  cashByCurrency, totalCashUsd, openPayables, totalOpenUsd,
  cashDeposits, cashDeposit, accBalance, accBalanceUsd, accountDepositsUsd, accountDepositsOrig,
  overduePayables, dueSoon, openByType, cashOutForecast,
  fmtCny, usdToCny, cnyToUsd, TODAY, TESORERIA_LS_KEY,
};
