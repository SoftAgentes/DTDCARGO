/* global React */
/* ── DTD ERP · Fiscal · SENIAT · Datos & helpers ────────────── */
/* Cumplimiento VE: Libro de Ventas / Compras (IVA), retenciones */
/* IVA e ISLR, y resumen de declaración. Montos en USD funcional */
/* + VES @ BCV (la declaración formal es en bolívares).          */

const IVA_RATE = 0.16;          // alícuota general IVA Venezuela
const RET_IVA_PCT = 0.75;       // retención de IVA (contribuyente especial)
const RET_ISLR_HONORARIOS = 0.03; // retención ISLR honorarios

// ── Libro de Ventas (IVA débito fiscal) ───────────────────────
// Alimentado por las facturas emitidas. base + iva = total (USD).
const VENTAS = [
  { date: '2026-05-22', factura: 'F-2026-0391', control: '00-0012891', cliente: 'Industrias Polar SA',  rif: 'J-00041234-5', base: 135172, iva: 21628, total: 156800, tipo: 'gravado' },
  { date: '2026-05-20', factura: 'F-2026-0398', control: '00-0012898', cliente: 'Castro Hermanos CA',    rif: 'J-30449182-7', base: 41552,  iva: 6648,  total: 48200,  tipo: 'gravado' },
  { date: '2026-05-18', factura: 'F-2026-0402', control: '00-0012905', cliente: 'Importadora Pereira',   rif: 'J-29874512-3', base: 10862,  iva: 1738,  total: 12600,  tipo: 'gravado' },
  { date: '2026-05-14', factura: 'F-2026-0418', control: '00-0012912', cliente: 'Acindar Comercial CA',  rif: 'J-30182554-9', base: 72586,  iva: 11614, total: 84200,  tipo: 'gravado' },
  { date: '2026-05-10', factura: 'F-2026-0421', control: '00-0012918', cliente: 'Tech Solutions VE',     rif: 'J-31125789-1', base: 8400,   iva: 0,     total: 8400,   tipo: 'exento', nota: 'Flete marítimo internacional' },
];

// ── Libro de Compras (IVA crédito fiscal) ─────────────────────
const COMPRAS = [
  { date: '2026-05-22', doc: 'COSCO-INV-4471', control: '—',          prov: 'COSCO Shipping Lines',       rif: 'E-80012233-0', base: 28400, iva: 0,   total: 28400, tipo: 'exento',  concepto: 'Flete marítimo internacional' },
  { date: '2026-05-19', doc: 'AGT-CAR-0521',   control: '00-0044821', prov: 'Aduanas Carabobo · Agente',  rif: 'J-31556677-0', base: 4155,  iva: 665, total: 4820,  tipo: 'gravado', concepto: 'Honorarios agente aduanal' },
  { date: '2026-05-15', doc: 'INM-VAL-0625',   control: '00-0098114', prov: 'Inmobiliaria Valencia C.A.', rif: 'J-30998812-4', base: 1552,  iva: 248, total: 1800,  tipo: 'gravado', concepto: 'Alquiler oficina' },
  { date: '2026-05-12', doc: 'SFT-2026-031',   control: '00-0001442', prov: 'Software & Licencias SRL',   rif: 'J-40221567-8', base: 690,   iva: 110, total: 800,   tipo: 'gravado', concepto: 'Licencias software' },
  { date: '2026-05-08', doc: 'TX-44044',       control: '—',          prov: 'Banco Mercantil',            rif: 'J-00002961-0', base: 190,   iva: 30,  total: 220,   tipo: 'gravado', concepto: 'Comisiones bancarias' },
];

// ── Retenciones emitidas (DTD como agente de retención) ───────
const RETENCIONES = [
  { date: '2026-05-19', tipo: 'IVA',  comprobante: '20260500004821', prov: 'Aduanas Carabobo · Agente',  rif: 'J-31556677-0', base: 665, pct: 75, monto: 499, doc: 'AGT-CAR-0521' },
  { date: '2026-05-19', tipo: 'ISLR', comprobante: '20260500004822', prov: 'Aduanas Carabobo · Agente',  rif: 'J-31556677-0', base: 4155, pct: 3,  monto: 125, doc: 'AGT-CAR-0521' },
  { date: '2026-05-15', tipo: 'IVA',  comprobante: '20260500004810', prov: 'Inmobiliaria Valencia C.A.', rif: 'J-30998812-4', base: 248, pct: 75, monto: 186, doc: 'INM-VAL-0625' },
  { date: '2026-05-12', tipo: 'IVA',  comprobante: '20260500004805', prov: 'Software & Licencias SRL',   rif: 'J-40221567-8', base: 110, pct: 75, monto: 83,  doc: 'SFT-2026-031' },
];

// ── Helpers ───────────────────────────────────────────────────
function sum(arr, k) { return arr.reduce((s, x) => s + (x[k] || 0), 0); }

function ventasTotals() {
  return { base: sum(VENTAS, 'base'), iva: sum(VENTAS, 'iva'), total: sum(VENTAS, 'total'),
    gravado: VENTAS.filter(v => v.tipo === 'gravado').reduce((s, v) => s + v.base, 0),
    exento: VENTAS.filter(v => v.tipo === 'exento').reduce((s, v) => s + v.base, 0) };
}
function comprasTotals() {
  return { base: sum(COMPRAS, 'base'), iva: sum(COMPRAS, 'iva'), total: sum(COMPRAS, 'total') };
}
function retencionesTotals() {
  return { iva: RETENCIONES.filter(r => r.tipo === 'IVA').reduce((s, r) => s + r.monto, 0),
    islr: RETENCIONES.filter(r => r.tipo === 'ISLR').reduce((s, r) => s + r.monto, 0) };
}

// Resumen de declaración de IVA del período (estructura forma SENIAT).
function declaracionIVA() {
  const debito = sum(VENTAS, 'iva');                 // IVA cobrado en ventas
  const credito = sum(COMPRAS, 'iva');               // IVA pagado en compras
  const cuota = debito - credito;                    // cuota tributaria
  const retSoportadas = Math.round(debito * RET_IVA_PCT); // clientes nos retuvieron 75%
  const aPagar = Math.max(0, cuota - retSoportadas);
  const excedente = Math.max(0, retSoportadas - cuota);
  return { debito, credito, cuota, retSoportadas, aPagar, excedente };
}

window.FiscalData = {
  IVA_RATE, RET_IVA_PCT, RET_ISLR_HONORARIOS,
  VENTAS, COMPRAS, RETENCIONES,
  ventasTotals, comprasTotals, retencionesTotals, declaracionIVA,
};
