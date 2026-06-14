/* global React */
/* ── DTD ERP · Tasas de cambio · helper global (v1.1) ───────── */
/* Single source of truth para conversión USD/VES en todo el     */
/* ERP y las pantallas standalone. Valores iniciales coinciden  */
/* con lo que muestra Admin → Tasas de cambio.                   */
/* Al editarlos en Admin (TODO consolidar), persistir acá.       */

const DTD_RATES_KEY = 'dtd_rates_v1';

const DEFAULT_RATES = {
  bcv:        36.45, // USD/VES · BCV oficial (scrape diario)
  parallel:   37.20, // USD/VES · monitor paralelo
  cny:        7.18,  // USD/CNY · interno
  source:     'bcv',           // 'bcv' | 'parallel' | 'avg' · default contable
  lastUpdate: '2026-05-24 09:00',
  scrapeLast: '2026-05-24 09:00',
};

function readRates() {
  try {
    const raw = localStorage.getItem(DTD_RATES_KEY);
    if (raw) return { ...DEFAULT_RATES, ...JSON.parse(raw) };
  } catch (e) {}
  return { ...DEFAULT_RATES };
}

function writeRates(patch) {
  const next = { ...readRates(), ...patch };
  try { localStorage.setItem(DTD_RATES_KEY, JSON.stringify(next)); } catch (e) {}
  window.dispatchEvent(new CustomEvent('dtd-rates-changed', { detail: next }));
  return next;
}

function rateOf(source) {
  const r = readRates();
  if (source === 'parallel') return r.parallel;
  if (source === 'avg')      return (r.bcv + r.parallel) / 2;
  return r.bcv;
}

function usdToVes(amount, source) {
  if (amount === 0 || amount === null || amount === undefined) return 0;
  const r = readRates();
  const rate = source ? rateOf(source) : rateOf(r.source);
  return amount * rate;
}

function vesToUsd(amount, source) {
  if (amount === 0 || amount === null || amount === undefined) return 0;
  const r = readRates();
  const rate = source ? rateOf(source) : rateOf(r.source);
  return amount / rate;
}

// Formatters siguiendo Brand Book v3.7 · sin decimales · . miles
function fmtUsd(n) {
  if (n === null || n === undefined || n === '') return '—';
  const abs = Math.abs(Math.round(Number(n) || 0));
  const sign = n < 0 ? '-' : '';
  return `${sign}USD ${abs.toLocaleString('es-VE')}`;
}

function fmtBs(n) {
  if (n === null || n === undefined || n === '') return '—';
  const abs = Math.abs(Math.round(Number(n) || 0));
  const sign = n < 0 ? '-' : '';
  return `${sign}Bs. ${abs.toLocaleString('es-VE')}`;
}

// Subscribe-to-rates hook
function useRates() {
  const [rates, setRates] = React.useState(readRates);
  React.useEffect(() => {
    const handler = (e) => setRates(e.detail || readRates());
    const storageHandler = (e) => { if (e.key === DTD_RATES_KEY) setRates(readRates()); };
    window.addEventListener('dtd-rates-changed', handler);
    window.addEventListener('storage', storageHandler);
    return () => {
      window.removeEventListener('dtd-rates-changed', handler);
      window.removeEventListener('storage', storageHandler);
    };
  }, []);
  return [rates, writeRates];
}

window.ERPRates = {
  read: readRates, write: writeRates,
  rateOf, usdToVes, vesToUsd,
  fmtUsd, fmtBs, useRates,
  DEFAULT_RATES,
};
