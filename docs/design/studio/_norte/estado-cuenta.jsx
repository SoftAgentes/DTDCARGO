/* global React */
/* ── Estado de Cuenta del Cliente · standalone ──────────────── */

// ── Datos contables detallados por cliente ───────────────────
// TODO al consolidar: mover a erp/data.jsx · CLIENT_ACCOUNTS
const ACCOUNT_PROFILES = {
  'DTD-5392': { // Industrias Polar — mostly paid, big
    creditLimit: 250000, creditDays: 45, discount: 2.0,
    fiscalAddress: 'Av. Cuatricentenaria, Edif. Industrias Polar · Caracas, Distrito Capital',
    billingContact: { name: 'Andrea Rodríguez', role: 'Tesorería corporativa', email: 'a.rodriguez@polar.com.ve', phone: '+58 212 446 9100' },
    paymentTerms: 'Net 45 · 2% descuento pago a 15 días',
    paymentMethods: [
    { kind: 'wire', label: 'Transferencia USD (offshore)', count: 22, total: 308600 },
    { kind: 'usdt', label: 'USDT · TRC20', count: 4, total: 42800 },
    { kind: 'zelle', label: 'Zelle', count: 2, total: 18400 }],

    monthSummary: [
    { m: 'DIC', billed: 38400, collected: 38400 },
    { m: 'ENE', billed: 84200, collected: 84200 },
    { m: 'FEB', billed: 42800, collected: 42800 },
    { m: 'MAR', billed: 96800, collected: 78400 },
    { m: 'ABR', billed: 124400, collected: 124400 },
    { m: 'MAY', billed: 156800, collected: 156800 }],

    dpp: 38, dppTarget: 45,
    lastReminder: null,
    nextDue: '2026-06-08',
    movements: [
    { date: '2026-05-22', kind: 'pago', ref: 'WIRE-9982', desc: 'Pago F-2026-0391 · transferencia USD', debit: 0, credit: 156800, balance: 0 },
    { date: '2026-05-20', kind: 'factura', ref: 'F-2026-0391', desc: 'DTDU-419032 · refrigeración Polar', debit: 156800, credit: 0, balance: 156800 },
    { date: '2026-05-12', kind: 'pago', ref: 'WIRE-9941', desc: 'Pago F-2026-0357 · transferencia USD', debit: 0, credit: 124400, balance: 0 },
    { date: '2026-04-22', kind: 'factura', ref: 'F-2026-0357', desc: 'DTDU-401234 · cadena de frío', debit: 124400, credit: 0, balance: 124400 },
    { date: '2026-04-15', kind: 'nota_credito', ref: 'NC-2026-0118', desc: 'Ajuste sobrecarga combustible', debit: 0, credit: 2400, balance: 0 },
    { date: '2026-04-08', kind: 'pago', ref: 'WIRE-9881', desc: 'Pago F-2026-0341', debit: 0, credit: 96800, balance: 0 },
    { date: '2026-03-18', kind: 'factura', ref: 'F-2026-0341', desc: 'DTDU-388157 · vitrinas frigoríficas', debit: 96800, credit: 0, balance: 96800 },
    { date: '2026-02-28', kind: 'pago', ref: 'USDT-TX-4471', desc: 'Pago F-2026-0312 · USDT TRC20', debit: 0, credit: 42800, balance: 0 },
    { date: '2026-02-12', kind: 'factura', ref: 'F-2026-0312', desc: 'DTDU-365044 · equipos auxiliares', debit: 42800, credit: 0, balance: 42800 }],

    notes: 'Cliente A. Pagos predecibles. Renegociar Net 30 si se mantiene volumen.'
  },
  'DTD-5452': { // Acindar — has overdue
    creditLimit: 120000, creditDays: 30, discount: 0,
    fiscalAddress: 'ZI Valencia Sur, Galpón 12 · Valencia, Carabobo',
    billingContact: { name: 'Carlos Méndez', role: 'Dueño · firmante', email: 'carlos@acindar.com.ve', phone: '+58 241 884 0212' },
    paymentTerms: 'Net 30',
    paymentMethods: [
    { kind: 'wire', label: 'Transferencia USD', count: 14, total: 96400 },
    { kind: 'cash', label: 'Efectivo USD', count: 3, total: 18800 },
    { kind: 'usdt', label: 'USDT · TRC20', count: 2, total: 12200 }],

    vesMovements: [
    { date: '2026-05-19', ref: 'TRF-VES-8841', desc: 'Transfer Banesco Bs. · pago parcial F-2026-0382', amountBs: 671320, rateUsed: 36.45, rateSource: 'bcv', equivalentUsd: 18416, linkInvoice: 'F-2026-0382' },
    { date: '2026-04-12', ref: 'PAGO-VES-552', desc: 'Pago retención IGTF · ajuste interno', amountBs: 65610, rateUsed: 36.45, rateSource: 'bcv', equivalentUsd: 1800, linkInvoice: 'ND-2026-0042' },
    { date: '2026-03-04', ref: 'TRF-VES-8722', desc: 'Transfer Mercantil Bs. · pago F-2026-0312', amountBs: 1184400, rateUsed: 37.00, rateSource: 'parallel', equivalentUsd: 32011, linkInvoice: 'F-2026-0312' }],

    monthSummary: [
    { m: 'DIC', billed: 18400, collected: 18400 },
    { m: 'ENE', billed: 26200, collected: 26200 },
    { m: 'FEB', billed: 31400, collected: 31400 },
    { m: 'MAR', billed: 42800, collected: 42800 },
    { m: 'ABR', billed: 38400, collected: 18400 },
    { m: 'MAY', billed: 84200, collected: 0 }],

    dpp: 52, dppTarget: 30,
    lastReminder: '2026-05-20',
    nextDue: '2026-06-13',
    movements: [
    { date: '2026-05-14', kind: 'factura', ref: 'F-2026-0418', desc: 'DTDU-472816 · zapatillas deportivas', debit: 84200, credit: 0, balance: 84200, overdue: true },
    { date: '2026-05-05', kind: 'pago', ref: 'WIRE-9921', desc: 'Pago parcial F-2026-0382', debit: 0, credit: 18400, balance: 0 },
    { date: '2026-04-22', kind: 'factura', ref: 'F-2026-0382', desc: 'DTDU-388157 · partes industriales', debit: 38400, credit: 0, balance: 38400 },
    { date: '2026-04-12', kind: 'nota_debito', ref: 'ND-2026-0042', desc: 'Cargo demora desalmacenaje', debit: 1800, credit: 0, balance: 1800 },
    { date: '2026-04-08', kind: 'pago', ref: 'CASH-8821', desc: 'Pago F-2026-0354 · efectivo USD', debit: 0, credit: 42800, balance: 0 },
    { date: '2026-03-25', kind: 'factura', ref: 'F-2026-0354', desc: 'DTDU-365044 · acero estructural', debit: 42800, credit: 0, balance: 42800 },
    { date: '2026-03-15', kind: 'recordatorio', ref: '—', desc: 'Recordatorio de pago enviado · Mailing', debit: 0, credit: 0, balance: 0 },
    { date: '2026-02-28', kind: 'pago', ref: 'WIRE-9841', desc: 'Pago F-2026-0331', debit: 0, credit: 31400, balance: 0 },
    { date: '2026-02-10', kind: 'factura', ref: 'F-2026-0331', desc: 'DTDU-298311 · perfiles metálicos', debit: 31400, credit: 0, balance: 31400 }],

    notes: 'Cliente histórico pero con desliz reciente. Llamar a Carlos para cobrar F-2026-0418 (10d vencida).'
  },
  'DTD-5354': { // Castro Hermanos — solid
    creditLimit: 180000, creditDays: 45, discount: 1.5,
    fiscalAddress: 'Av. Comercio 22 · Punto Fijo, Falcón',
    billingContact: { name: 'Roberto Castro', role: 'Director financiero', email: 'r.castro@castroh.com.ve', phone: '+58 269 778 2114' },
    paymentTerms: 'Net 45 · 1.5% descuento pago a 15 días',
    paymentMethods: [
    { kind: 'wire', label: 'Transferencia USD', count: 28, total: 198400 },
    { kind: 'usdt', label: 'USDT · TRC20', count: 5, total: 50200 }],

    monthSummary: [
    { m: 'DIC', billed: 28400, collected: 28400 },
    { m: 'ENE', billed: 42800, collected: 42800 },
    { m: 'FEB', billed: 38200, collected: 38200 },
    { m: 'MAR', billed: 56400, collected: 56400 },
    { m: 'ABR', billed: 48200, collected: 48200 },
    { m: 'MAY', billed: 34600, collected: 0 }],

    dpp: 42, dppTarget: 45,
    lastReminder: null,
    nextDue: '2026-06-22',
    movements: [
    { date: '2026-05-22', kind: 'factura', ref: 'F-2026-0421', desc: 'DTDU-401234 · televisores LED', debit: 34600, credit: 0, balance: 34600 },
    { date: '2026-05-15', kind: 'pago', ref: 'WIRE-9954', desc: 'Pago F-2026-0398', debit: 0, credit: 48200, balance: 0 },
    { date: '2026-04-30', kind: 'factura', ref: 'F-2026-0398', desc: 'DTDU-388157 · maletas + accesorios', debit: 48200, credit: 0, balance: 48200 },
    { date: '2026-04-18', kind: 'pago', ref: 'USDT-TX-4421', desc: 'Pago F-2026-0371 · USDT', debit: 0, credit: 56400, balance: 0 },
    { date: '2026-03-28', kind: 'factura', ref: 'F-2026-0371', desc: 'DTDU-365044 · estanterías metálicas', debit: 56400, credit: 0, balance: 56400 }],

    notes: 'Roberto siempre paga en término. Excelente cliente.'
  },
  'DTD-5371': { // Tech Solutions — smaller, recent
    creditLimit: 80000, creditDays: 30, discount: 0,
    fiscalAddress: 'Av. Andrés Bello, Torre Tech, Piso 8 · Maracay, Aragua',
    billingContact: { name: 'María González', role: 'Cofundadora', email: 'maria@techsolutionsve.com', phone: '+58 243 552 8842' },
    paymentTerms: 'Net 30',
    paymentMethods: [
    { kind: 'zelle', label: 'Zelle', count: 8, total: 48400 },
    { kind: 'wire', label: 'Transferencia USD', count: 4, total: 15800 }],

    monthSummary: [
    { m: 'DIC', billed: 8400, collected: 8400 },
    { m: 'ENE', billed: 12200, collected: 12200 },
    { m: 'FEB', billed: 9800, collected: 9800 },
    { m: 'MAR', billed: 14400, collected: 14400 },
    { m: 'ABR', billed: 11800, collected: 11800 },
    { m: 'MAY', billed: 7600, collected: 7600 }],

    dpp: 22, dppTarget: 30,
    lastReminder: null,
    nextDue: '2026-06-04',
    movements: [
    { date: '2026-05-12', kind: 'pago', ref: 'ZELLE-8841', desc: 'Pago F-2026-0411 · Zelle', debit: 0, credit: 7600, balance: 0 },
    { date: '2026-05-05', kind: 'factura', ref: 'F-2026-0411', desc: 'DTDU-419031 · notebooks', debit: 7600, credit: 0, balance: 7600 },
    { date: '2026-04-20', kind: 'pago', ref: 'ZELLE-8821', desc: 'Pago F-2026-0388 · Zelle', debit: 0, credit: 11800, balance: 0 },
    { date: '2026-04-08', kind: 'factura', ref: 'F-2026-0388', desc: 'DTDU-401234 · accesorios IT', debit: 11800, credit: 0, balance: 11800 }],

    notes: ''
  },
  'DTD-5340': { // Distribuidora Andina — slow payer
    creditLimit: 100000, creditDays: 30, discount: 0,
    fiscalAddress: 'Av. Las Américas, Edif. Andinos · Mérida, Mérida',
    billingContact: { name: 'Patricia Rojas', role: 'Dueña', email: 'patricia@distandina.ve', phone: '+58 274 220 8814' },
    paymentTerms: 'Net 30 · estricto',
    paymentMethods: [
    { kind: 'wire', label: 'Transferencia USD', count: 12, total: 82400 },
    { kind: 'cash', label: 'Efectivo USD', count: 8, total: 38400 }],

    vesMovements: [
    { date: '2026-05-12', ref: 'TRF-VES-7711', desc: 'Pago F-2026-0388 (parcial) · Banco Mercantil Bs.', amountBs: 656100, rateUsed: 36.45, rateSource: 'bcv', equivalentUsd: 18000, linkInvoice: 'F-2026-0388' },
    { date: '2026-04-08', ref: 'TRF-VES-7682', desc: 'Pago F-2026-0367 · transferencia Bs. (BCV+día)', amountBs: 906980, rateUsed: 36.85, rateSource: 'parallel', equivalentUsd: 24612, linkInvoice: 'F-2026-0367' },
    { date: '2026-02-22', ref: 'TRF-VES-7501', desc: 'Pago F-2026-0298 · Banesco Bs.', amountBs: 488170, rateUsed: 35.10, rateSource: 'bcv', equivalentUsd: 13908, linkInvoice: 'F-2026-0298' }],

    monthSummary: [
    { m: 'DIC', billed: 18800, collected: 18800 },
    { m: 'ENE', billed: 22400, collected: 0 },
    { m: 'FEB', billed: 28200, collected: 22400 },
    { m: 'MAR', billed: 24600, collected: 28200 },
    { m: 'ABR', billed: 32200, collected: 24600 },
    { m: 'MAY', billed: 26100, collected: 18400 }],

    dpp: 61, dppTarget: 30,
    lastReminder: '2026-05-15',
    nextDue: '2026-06-15',
    movements: [
    { date: '2026-05-18', kind: 'factura', ref: 'F-2026-0424', desc: 'DTDU-401234 · cosmética + accesorios', debit: 26100, credit: 0, balance: 26100, overdue: true },
    { date: '2026-05-15', kind: 'recordatorio', ref: '—', desc: 'Segundo recordatorio · WhatsApp + email', debit: 0, credit: 0, balance: 0 },
    { date: '2026-05-08', kind: 'pago', ref: 'WIRE-9933', desc: 'Pago parcial F-2026-0395', debit: 0, credit: 18400, balance: 0 },
    { date: '2026-04-22', kind: 'factura', ref: 'F-2026-0395', desc: 'DTDU-388157 · maletas + bolsos', debit: 32200, credit: 0, balance: 32200 },
    { date: '2026-04-08', kind: 'pago', ref: 'CASH-8842', desc: 'Pago F-2026-0367 · efectivo USD', debit: 0, credit: 24600, balance: 0 }],

    notes: 'Patricia tiende a atrasarse 30d. Mantener recordatorios automáticos. Bloquear nuevas órdenes si saldo > $30K.'
  },
  'DTD-5321': { // Salazar — problematic
    creditLimit: 0, creditDays: 0, discount: 0,
    fiscalAddress: 'Calle 8, Centro · Caracas',
    billingContact: { name: 'Eduardo Salazar', role: 'Dueño', email: 'esalazar@salazartrading.ve', phone: '+58 212 992 4421' },
    paymentTerms: 'Pago anticipado · sin línea de crédito',
    paymentMethods: [
    { kind: 'cash', label: 'Efectivo USD', count: 4, total: 16200 },
    { kind: 'usdt', label: 'USDT · TRC20', count: 2, total: 8800 }],

    vesMovements: [
    { date: '2026-05-10', ref: 'TRF-VES-8801', desc: 'Anticipo F-2026-0419 · Bs.', amountBs: 218700, rateUsed: 36.45, rateSource: 'bcv', equivalentUsd: 6000, linkInvoice: 'F-2026-0419' },
    { date: '2026-04-22', ref: 'TRF-VES-8788', desc: 'Anticipo F-2026-0401 · Bs.', amountBs: 466240, rateUsed: 36.40, rateSource: 'bcv', equivalentUsd: 12808, linkInvoice: 'F-2026-0401' }],

    monthSummary: [
    { m: 'DIC', billed: 0, collected: 0 },
    { m: 'ENE', billed: 4200, collected: 4200 },
    { m: 'FEB', billed: 6800, collected: 6800 },
    { m: 'MAR', billed: 8400, collected: 8400 },
    { m: 'ABR', billed: 12800, collected: 12800 },
    { m: 'MAY', billed: 6000, collected: 6000 }],

    dpp: 0, dppTarget: 0,
    lastReminder: null,
    nextDue: null,
    movements: [
    { date: '2026-05-10', kind: 'pago', ref: 'CASH-8851', desc: 'Anticipo F-2026-0419 · efectivo', debit: 0, credit: 6000, balance: 0 },
    { date: '2026-05-10', kind: 'factura', ref: 'F-2026-0419', desc: 'DTDU-401234 · electrónica importada', debit: 6000, credit: 0, balance: 6000 }],

    notes: 'Status pending hasta normalizar legal. Solo pago anticipado.'
  }
};

const PAYMENT_KIND_META = {
  wire: { color: 'var(--wine)', label: 'Transfer USD' },
  zelle: { color: 'var(--success)', label: 'Zelle' },
  usdt: { color: 'var(--info)', label: 'USDT TRC20' },
  cash: { color: 'var(--warning)', label: 'Efectivo USD' }
};

const MOVEMENT_KIND_META = {
  factura: { tone: 'wine', label: 'Factura' },
  pago: { tone: 'success', label: 'Pago recibido' },
  nota_credito: { tone: 'info', label: 'Nota crédito' },
  nota_debito: { tone: 'warning', label: 'Nota débito' },
  ajuste: { tone: 'neutral', label: 'Ajuste' },
  recordatorio: { tone: 'neutral', label: 'Recordatorio' }
};

function fmtMoney(n) {
  if (n === 0) return '—';
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toLocaleString('es-VE')}`;
}
function daysUntilEC(dateStr) {
  if (!dateStr) return null;
  return Math.round((new Date(dateStr).getTime() - new Date('2026-05-24').getTime()) / 86400000);
}

// ════════════════════════════════════════════════════════════════
function EstadoCuenta() {
  const D = window.ERPData;
  const U = window.ERPUI;
  const I = window.Icon;
  const R = window.ERPRates;
  const [rates] = R.useRates();
  const eligibleClients = D.CLIENTS.filter((c) => ACCOUNT_PROFILES[c.markbox]);

  const initialId = React.useMemo(() => {
    try {
      const id = new URLSearchParams(window.location.search).get('id');
      return id && ACCOUNT_PROFILES[id] ? id : 'DTD-5452';
    } catch (e) {return 'DTD-5452';}
  }, []);

  const [markbox, setMarkbox] = React.useState(initialId);
  const [filter, setFilter] = React.useState('all');

  const client = D.CLIENTS.find((c) => c.markbox === markbox);
  const acc = ACCOUNT_PROFILES[markbox];

  if (!client || !acc) return <div style={{ padding: 40 }}>Cliente no encontrado.</div>;

  // Compute saldo, deuda vencida, aging
  const saldo = acc.movements.reduce((s, m) => s + (m.debit || 0) - (m.credit || 0), 0);
  const overdueInvoices = acc.movements.filter((m) => m.kind === 'factura' && m.overdue);
  const overdueAmount = overdueInvoices.reduce((s, m) => s + (m.debit || 0), 0);
  const creditAvailable = Math.max(0, acc.creditLimit - saldo);

  // Aging buckets (días vencido)
  const today = new Date('2026-05-24').getTime();
  const openInvoices = acc.movements.filter((m) => m.kind === 'factura' && m.balance > 0);
  const aging = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  openInvoices.forEach((inv) => {
    const dueDate = new Date(inv.date).getTime() + acc.creditDays * 86400000;
    const daysOverdue = Math.max(0, Math.round((today - dueDate) / 86400000));
    const amt = inv.balance;
    if (daysOverdue <= 30) aging['0-30'] += amt;else
    if (daysOverdue <= 60) aging['31-60'] += amt;else
    if (daysOverdue <= 90) aging['61-90'] += amt;else
    aging['90+'] += amt;
  });
  const agingTotal = Object.values(aging).reduce((a, b) => a + b, 0) || 1;

  const filteredMovs = filter === 'all' ? acc.movements : acc.movements.filter((m) => m.kind === filter);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <ECTopBar markbox={markbox} setMarkbox={setMarkbox} clients={eligibleClients} />
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 32px 60px' }} data-comment-anchor="1d704d3e63-div-279-7">
        <ECHero client={client} acc={acc} saldo={saldo} overdueAmount={overdueAmount} />

        <RatesBanner rates={rates} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 'var(--s-6)' }}>
          <U.KPI label="Saldo actual" value={fmtMoney(saldo)} delta={saldo > 0 ? R.fmtBs(R.usdToVes(saldo)) : 'Sin saldo'} tone={saldo > 0 ? 'wine' : 'success'} icon={I.invoice(18)} />
          <U.KPI label="Deuda vencida" value={fmtMoney(overdueAmount)} delta={overdueAmount > 0 ? `${R.fmtBs(R.usdToVes(overdueAmount))} @ BCV` : 'Sin vencimientos'} tone={overdueAmount > 0 ? 'danger' : 'success'} icon={I.warn(18)} />
          <U.KPI label="Crédito disponible" value={fmtMoney(creditAvailable)} delta={`Límite $${acc.creditLimit.toLocaleString('es-VE')}`} tone="info" icon={I.shield(18)} />
          <U.KPI label="DPP · días de pago" value={`${acc.dpp}d`} delta={`Meta ${acc.dppTarget}d`} tone={acc.dpp <= acc.dppTarget ? 'success' : 'warning'} icon={I.chart(18)} />
        </div>

        <AgingChart aging={aging} total={agingTotal} />

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18, marginTop: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <MonthlySummary acc={acc} />
            <MovementsTable movements={filteredMovs} filter={filter} setFilter={setFilter} />
            <VESMovementsCard acc={acc} />
            <PaymentMethodsCard acc={acc} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <BillingContactCard client={client} acc={acc} />
            <CreditTermsCard acc={acc} />
            <ActionsHistoryCard acc={acc} />
            <AdminActions />
          </div>
        </div>
      </div>
    </div>);

}

// ── Top bar ──────────────────────────────────────────────────
function ECTopBar({ markbox, setMarkbox, clients }) {
  const I = window.Icon;
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 40,
      background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)',
      padding: '12px 32px', display: 'flex', alignItems: 'center', gap: 16
    }}>
      <a href="../../DTD Studio · ERP.html" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '600 12px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>
        {I.arrowL(13)} ERP
      </a>
      <span style={{ color: 'var(--ink-mute)' }}>/</span>
      <span style={{ font: '500 12px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>Clientes</span>
      <span style={{ color: 'var(--ink-mute)' }}>/</span>
      <span style={{ font: '700 12px/1 var(--f-sans)', color: 'var(--ink)' }}>Estado de cuenta</span>
      <span style={{ color: 'var(--ink-mute)' }}>/</span>
      <select value={markbox} onChange={(e) => {setMarkbox(e.target.value);history.replaceState(null, '', `?id=${e.target.value}`);}}
      style={{
        padding: '6px 28px 6px 10px',
        background: 'var(--bg-elevated) url("data:image/svg+xml;utf8,<svg xmlns=\\\"http://www.w3.org/2000/svg\\\" width=\\\"10\\\" height=\\\"6\\\" viewBox=\\\"0 0 10 6\\\"><path d=\\\"M1 1l4 4 4-4\\\" stroke=\\\"%236B6B6B\\\" stroke-width=\\\"1.6\\\" fill=\\\"none\\\" stroke-linecap=\\\"round\\\"/></svg>") no-repeat right 10px center',
        border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
        font: '700 12.5px/1 var(--f-sans)', color: 'var(--ink)',
        appearance: 'none', outline: 'none', cursor: 'pointer'
      }}>
        {clients.map((c) => <option key={c.markbox} value={c.markbox}>{c.markbox} · {c.company}</option>)}
      </select>
      <div style={{ flex: 1 }} />
      <span style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Estado de cuenta · v1.1</span>
    </header>);

}

// ── Hero ─────────────────────────────────────────────────────
function ECHero({ client, acc, saldo, overdueAmount }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const statusTone = client.status === 'active' ? 'success' : client.status === 'pending' ? 'warning' : 'neutral';
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-lg)', padding: '24px 28px',
      marginBottom: 'var(--s-6)',
      display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 24, alignItems: 'center'
    }}>
      <U.Avatar initials={client.company.split(' ').map((w) => w[0]).slice(0, 2).join('')} color="wine" size={88} />
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          <U.Badge tone={statusTone} dot>{client.status === 'active' ? 'Activo' : client.status === 'pending' ? 'Pendiente legal' : 'Inactivo'}</U.Badge>
          <U.Badge tone="wine" size="sm">{client.segment}</U.Badge>
          {overdueAmount > 0 && <U.Badge tone="danger" size="sm">⚠ Mora</U.Badge>}
          <span className="eyebrow">MARKBOX <code style={{ font: '700 11px/1 var(--f-mono)', color: 'var(--wine)' }}>{client.markbox}</code></span>
        </div>
        <h1 style={{ font: '900 30px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: 0 }}>{client.company}</h1>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginTop: 10, font: '500 13px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>
          <span>RIF <strong style={{ color: 'var(--ink)' }}>{client.rif}</strong></span>
          <span>·</span>
          <span><strong style={{ color: 'var(--ink)' }}>{client.shipments}</strong> embarques · facturado total <strong style={{ color: 'var(--ink)' }}>${(client.billed / 1000).toFixed(0)}K</strong></span>
          <span>·</span>
          <span>{client.city}</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
        <U.Btn variant="primary" icon={I.download(13)}>Generar PDF</U.Btn>
        <U.Btn variant="secondary" icon={I.plus(13)}>Registrar pago</U.Btn>
        <U.Btn variant="secondary" icon={I.mail(13)}>Enviar recordatorio</U.Btn>
      </div>
    </div>);

}

// ── Aging buckets ────────────────────────────────────────────
function AgingChart({ aging, total }) {
  const U = window.ERPUI;
  const buckets = [
  { k: '0-30', label: 'No vencido', tone: 'success' },
  { k: '31-60', label: '1–30d vencido', tone: 'warning' },
  { k: '61-90', label: '31–60d', tone: 'danger' },
  { k: '90+', label: '+60d', tone: 'danger' }];

  return (
    <U.Card padded>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div className="eyebrow eyebrow-wine">AGING · ANTIGÜEDAD DE LA DEUDA</div>
          <div style={{ font: '900 18px/1.1 var(--f-display)', color: 'var(--ink)', marginTop: 6, letterSpacing: '-0.01em' }}>Distribución por bucket</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ font: '900 20px/1 var(--f-display)', color: 'var(--wine)' }}>${total > 1 ? total.toLocaleString('es-VE') : 0}</div>
          <div style={{ font: '600 10px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', marginTop: 4 }}>SALDO PENDIENTE</div>
        </div>
      </div>
      <div style={{ display: 'flex', height: 18, borderRadius: 'var(--r-pill)', overflow: 'hidden', background: 'var(--bg-elevated)', marginBottom: 14 }}>
        {buckets.map((b) => {
          const v = aging[b.k];
          const w = v / total * 100;
          return v > 0 ? <div key={b.k} style={{ width: `${w}%`, background: `var(--${b.tone})` }} title={`${b.label}: $${v}`} /> : null;
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {buckets.map((b) => {
          const v = aging[b.k];
          const pct = total > 1 ? (v / total * 100).toFixed(0) : 0;
          return (
            <div key={b.k} style={{ padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: `var(--${b.tone})` }} />
                <span style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{b.label}</span>
              </div>
              <div style={{ font: '900 18px/1 var(--f-display)', color: v > 0 ? `var(--${b.tone})` : 'var(--ink-mute)' }}>${v.toLocaleString('es-VE')}</div>
              <div style={{ font: '500 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 4 }}>{pct}%</div>
            </div>);

        })}
      </div>
    </U.Card>);

}

// ── Monthly summary ──────────────────────────────────────────
function MonthlySummary({ acc }) {
  const U = window.ERPUI;
  const data = acc.monthSummary;
  const max = Math.max(...data.flatMap((d) => [d.billed, d.collected]));
  const totalBilled = data.reduce((s, d) => s + d.billed, 0);
  const totalCollected = data.reduce((s, d) => s + d.collected, 0);
  return (
    <U.Card padded>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div className="eyebrow eyebrow-wine">RESUMEN MENSUAL · 6 MESES</div>
          <div style={{ font: '900 18px/1.1 var(--f-display)', color: 'var(--ink)', marginTop: 6 }}>Facturado vs cobrado</div>
        </div>
        <div style={{ display: 'flex', gap: 16, font: '500 11px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--wine)' }} /> Facturado
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--success)' }} /> Cobrado
          </span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${data.length}, 1fr)`, gap: 12, alignItems: 'end', height: 140, marginBottom: 8 }}>
        {data.map((d, i) =>
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
            <div style={{ display: 'flex', gap: 3, alignItems: 'end', width: '100%', height: '100%' }}>
              <div style={{ flex: 1, height: `${d.billed / max * 100}%`, background: 'var(--wine)', borderRadius: 'var(--r-sm) var(--r-sm) 0 0', opacity: 0.85 }} title={`Facturado: $${d.billed}`} />
              <div style={{ flex: 1, height: `${d.collected / max * 100}%`, background: 'var(--success)', borderRadius: 'var(--r-sm) var(--r-sm) 0 0', opacity: 0.85 }} title={`Cobrado: $${d.collected}`} />
            </div>
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${data.length}, 1fr)`, gap: 12 }}>
        {data.map((d, i) =>
        <div key={i} style={{ textAlign: 'center', font: '600 10px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.08em' }}>{d.m}</div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ font: '900 16px/1 var(--f-display)', color: 'var(--wine)' }}>${(totalBilled / 1000).toFixed(0)}K</div>
          <div style={{ font: '600 10px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', marginTop: 4 }}>FACTURADO SEMESTRE</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ font: '900 16px/1 var(--f-display)', color: 'var(--success)' }}>${(totalCollected / 1000).toFixed(0)}K</div>
          <div style={{ font: '600 10px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', marginTop: 4 }}>COBRADO</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ font: '900 16px/1 var(--f-display)', color: totalBilled > totalCollected ? 'var(--warning)' : 'var(--success)' }}>
            {totalBilled > 0 ? `${(totalCollected / totalBilled * 100).toFixed(0)}%` : '—'}
          </div>
          <div style={{ font: '600 10px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', marginTop: 4 }}>EFECTIVIDAD COBRO</div>
        </div>
      </div>
    </U.Card>);

}

// ── Movements table ──────────────────────────────────────────
function MovementsTable({ movements, filter, setFilter }) {
  const U = window.ERPUI;
  const R = window.ERPRates;
  const filters = [
  { k: 'all', label: 'Todos' },
  { k: 'factura', label: 'Facturas' },
  { k: 'pago', label: 'Pagos' },
  { k: 'nota_credito', label: 'NC/ND' },
  { k: 'recordatorio', label: 'Recordatorios' }];

  let running = 0;
  // Calculate running balance forward in time
  const movsAsc = [...movements].reverse();
  const movsWithBalance = movsAsc.map((m) => {
    running += (m.debit || 0) - (m.credit || 0);
    return { ...m, runBalance: running };
  });
  const display = [...movsWithBalance].reverse();

  return (
    <U.Card padded={false}>
      <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="eyebrow eyebrow-wine">CUENTA CORRIENTE · {movements.length} movimientos</div>
          <div style={{ font: '900 14px/1 var(--f-display)', color: 'var(--ink)', marginTop: 6 }}>Movimientos detallados</div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {filters.map((f) =>
          <button key={f.k} onClick={() => setFilter(f.k)} style={{
            padding: '5px 10px', borderRadius: 'var(--r-sm)',
            background: filter === f.k ? 'var(--wine-tint)' : 'transparent',
            color: filter === f.k ? 'var(--wine)' : 'var(--ink-soft)',
            font: '600 11px/1 var(--f-sans)'
          }}>{f.label}</button>
          )}
        </div>
      </div>
      <div>
        {display.map((m, i) => {
          const meta = MOVEMENT_KIND_META[m.kind] || MOVEMENT_KIND_META.ajuste;
          return (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '90px 110px 1fr 90px 90px 110px',
              gap: 14, alignItems: 'center',
              padding: '12px 20px',
              borderTop: i > 0 ? '1px solid var(--border)' : 0,
              background: m.overdue ? 'var(--danger-bg)' : 'transparent'
            }}>
              <div style={{ font: '700 11px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{m.date.slice(5)}</div>
              <U.Badge tone={meta.tone} size="sm" dot>{meta.label}</U.Badge>
              <div>
                <div style={{ font: '600 12.5px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{m.desc}</div>
                <code style={{ font: '500 10.5px/1 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 3, display: 'inline-block' }}>{m.ref}</code>
              </div>
              <div style={{ textAlign: 'right', font: '700 12px/1 var(--f-mono)', color: m.debit > 0 ? 'var(--ink)' : 'var(--ink-mute)' }}>{fmtMoney(m.debit || 0)}</div>
              <div style={{ textAlign: 'right', font: '700 12px/1 var(--f-mono)', color: m.credit > 0 ? 'var(--success)' : 'var(--ink-mute)' }}>{fmtMoney(m.credit || 0)}</div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ font: '800 12px/1 var(--f-mono)', color: m.runBalance > 0 ? 'var(--wine)' : 'var(--ink)' }}>{fmtMoney(m.runBalance)}</div>
                {m.runBalance !== 0 &&
                <div style={{ font: '500 9.5px/1 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 4 }}>{R.fmtBs(R.usdToVes(m.runBalance))}</div>
                }
              </div>
            </div>);

        })}
        {display.length === 0 &&
        <div style={{ padding: '24px 20px', textAlign: 'center', font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-mute)' }}>Sin movimientos con este filtro.</div>
        }
      </div>
    </U.Card>);

}

// ── Payment methods ──────────────────────────────────────────
function PaymentMethodsCard({ acc }) {
  const U = window.ERPUI;
  const total = acc.paymentMethods.reduce((s, p) => s + p.total, 0);
  return (
    <U.Card padded>
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>MÉTODOS DE PAGO HISTÓRICOS</div>
      <div style={{ display: 'flex', height: 12, borderRadius: 'var(--r-pill)', overflow: 'hidden', background: 'var(--bg-elevated)', marginBottom: 14 }}>
        {acc.paymentMethods.map((p) =>
        <div key={p.kind} style={{ width: `${p.total / total * 100}%`, background: PAYMENT_KIND_META[p.kind].color }} title={`${p.label}: $${p.total}`} />
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {acc.paymentMethods.map((p) =>
        <div key={p.kind} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: PAYMENT_KIND_META[p.kind].color, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{p.label}</div>
              <div style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 3 }}>{p.count} operaciones</div>
            </div>
            <div style={{ font: '800 13px/1 var(--f-display)', color: 'var(--ink)' }}>${p.total.toLocaleString('es-VE')}</div>
          </div>
        )}
      </div>
    </U.Card>);

}

// ── Billing contact ──────────────────────────────────────────
function BillingContactCard({ client, acc }) {
  const U = window.ERPUI;
  return (
    <U.Card padded>
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>CONTACTO DE FACTURACIÓN</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <U.Field label="Nombre" value={acc.billingContact.name} />
        <U.Field label="Rol" value={acc.billingContact.role} />
        <U.Field label="Email" value={acc.billingContact.email} />
        <U.Field label="Teléfono" value={acc.billingContact.phone} mono />
        <U.Field label="Dirección fiscal" value={acc.fiscalAddress} />
      </div>
    </U.Card>);

}

// ── Credit terms ─────────────────────────────────────────────
function CreditTermsCard({ acc }) {
  const U = window.ERPUI;
  return (
    <U.Card padded>
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>CONDICIONES DE CRÉDITO</div>
      <div style={{
        padding: '12px 14px', background: acc.creditLimit > 0 ? 'var(--wine-tint)' : 'var(--bg-elevated)',
        borderRadius: 'var(--r-md)', marginBottom: 14
      }}>
        <div style={{ font: '900 20px/1 var(--f-display)', color: acc.creditLimit > 0 ? 'var(--wine)' : 'var(--ink-mute)' }}>
          {acc.creditLimit > 0 ? `$${acc.creditLimit.toLocaleString('es-VE')}` : 'Sin línea'}
        </div>
        <div style={{ font: '500 11px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>Límite aprobado</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <U.Field label="Plazo" value={acc.creditDays > 0 ? `${acc.creditDays} días` : 'Pago anticipado'} />
        <U.Field label="Descuento pronto pago" value={acc.discount > 0 ? `${acc.discount}%` : 'Sin descuento'} />
        <U.Field label="Términos" value={acc.paymentTerms} />
      </div>
    </U.Card>);

}

// ── Actions history ──────────────────────────────────────────
function ActionsHistoryCard({ acc }) {
  const U = window.ERPUI;
  const dNext = daysUntilEC(acc.nextDue);
  return (
    <U.Card padded>
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>SEGUIMIENTO</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Último recordatorio</div>
          <div style={{ font: '600 12.5px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{acc.lastReminder || 'Nunca enviado'}</div>
        </div>
        <div>
          <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Próximo vencimiento</div>
          <div style={{ font: '600 12.5px/1.3 var(--f-sans)', color: 'var(--ink)' }}>
            {acc.nextDue || '—'}
            {dNext !== null &&
            <U.Badge tone={dNext < 0 ? 'danger' : dNext < 7 ? 'warning' : 'success'} size="sm" style={{ marginLeft: 8 }}>
                {dNext < 0 ? `${Math.abs(dNext)}d vencido` : `en ${dNext}d`}
              </U.Badge>
            }
          </div>
        </div>
      </div>
    </U.Card>);

}

function AdminActions() {
  const U = window.ERPUI;
  return (
    <U.Card padded>
      <div className="eyebrow" style={{ marginBottom: 10, color: 'var(--ink-soft)' }}>ACCIONES ADMIN</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <U.Btn variant="ghost" full>Cambiar límite de crédito</U.Btn>
        <U.Btn variant="ghost" full>Editar términos de pago</U.Btn>
        <U.Btn variant="ghost" full style={{ color: 'var(--warning)' }}>Marcar como moroso</U.Btn>
        <U.Btn variant="ghost" full style={{ color: 'var(--danger)' }}>Suspender línea de crédito</U.Btn>
      </div>
    </U.Card>);

}

// ── Rates banner (BCV + Paralelo) ────────────────────────────
function RatesBanner({ rates }) {
  const U = window.ERPUI;
  const I = window.Icon;
  return (
    <div style={{
      background: 'var(--ink)', color: '#fff',
      borderRadius: 'var(--r-md)', padding: '12px 18px',
      marginBottom: 'var(--s-6)',
      display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr auto', gap: 24, alignItems: 'center'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: 'var(--wine-soft)' }}>{I.chart(18)}</span>
        <div>
          <div style={{ font: '700 10px/1 var(--f-sans)', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Tasas vigentes</div>
          <div style={{ font: '500 10.5px/1.2 var(--f-mono)', color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>{rates.lastUpdate}</div>
        </div>
      </div>
      <div>
        <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>BCV oficial</div>
        <div style={{ font: '900 18px/1 var(--f-display)' }}>Bs. {rates.bcv.toFixed(2)}</div>
        <div style={{ font: '500 10px/1 var(--f-mono)', color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>1 USD · scrape diario</div>
      </div>
      <div>
        <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--warning)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Paralelo</div>
        <div style={{ font: '900 18px/1 var(--f-display)' }}>Bs. {rates.parallel.toFixed(2)}</div>
        <div style={{ font: '500 10px/1 var(--f-mono)', color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>1 USD · monitor</div>
      </div>
      <div>
        <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Spread</div>
        <div style={{ font: '900 18px/1 var(--f-display)' }}>+{(rates.parallel - rates.bcv).toFixed(2)}</div>
        <div style={{ font: '500 10px/1 var(--f-mono)', color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>{((rates.parallel - rates.bcv) / rates.bcv * 100).toFixed(2)}% diferencial</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{
          padding: '6px 10px', background: 'var(--wine)', color: '#fff',
          borderRadius: 'var(--r-sm)', font: '700 10.5px/1 var(--f-sans)',
          letterSpacing: '0.08em', textTransform: 'uppercase', display: 'inline-block'
        }}>
          Asientos contables · @ {rates.source.toUpperCase()}
        </div>
      </div>
    </div>);

}

// ── VES Movements card ───────────────────────────────────────
function VESMovementsCard({ acc }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const R = window.ERPRates;
  const vesMovs = acc.vesMovements || [];

  if (vesMovs.length === 0) {
    return (
      <U.Card padded>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>TRANSACCIONES EN BOLÍVARES</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
          <span style={{ color: 'var(--ink-mute)' }}>{I.invoice(15)}</span>
          <span style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink-mute)' }}>Este cliente paga únicamente en USD. Sin movimientos en VES.</span>
        </div>
      </U.Card>);

  }

  const totalBs = vesMovs.reduce((s, m) => s + m.amountBs, 0);
  const totalUsd = vesMovs.reduce((s, m) => s + m.equivalentUsd, 0);
  const avgRate = totalBs / totalUsd;

  return (
    <U.Card padded={false}>
      <div style={{
        padding: '16px 20px 14px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12
      }}>
        <div>
          <div className="eyebrow eyebrow-wine">TRANSACCIONES EN BOLÍVARES · {vesMovs.length}</div>
          <div style={{ font: '900 16px/1.1 var(--f-display)', color: 'var(--ink)', marginTop: 6, letterSpacing: '-0.01em' }}>
            Pagos cobrados en Bs. · conversión a USD por tasa del día
          </div>
        </div>
        <div style={{ display: 'flex', gap: 18, textAlign: 'right' }}>
          <div>
            <div style={{ font: '900 16px/1 var(--f-display)', color: 'var(--ink)' }}>{R.fmtBs(totalBs)}</div>
            <div style={{ font: '600 10px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', marginTop: 4 }}>BS. TOTAL</div>
          </div>
          <div>
            <div style={{ font: '900 16px/1 var(--f-display)', color: 'var(--success)' }}>{R.fmtUsd(totalUsd)}</div>
            <div style={{ font: '600 10px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', marginTop: 4 }}>EQ. USD</div>
          </div>
          <div>
            <div style={{ font: '900 16px/1 var(--f-display)', color: 'var(--wine)' }}>{avgRate.toFixed(2)}</div>
            <div style={{ font: '600 10px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', marginTop: 4 }}>TASA PROMEDIO</div>
          </div>
        </div>
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: '90px 130px 1fr 130px 90px 130px 100px',
        padding: '10px 20px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-elevated)',
        font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)',
        letterSpacing: '0.1em', textTransform: 'uppercase', gap: 14
      }}>
        <span>Fecha</span>
        <span>Ref. Bs.</span>
        <span>Descripción</span>
        <span style={{ textAlign: 'right' }}>Monto Bs.</span>
        <span style={{ textAlign: 'center' }}>Tasa</span>
        <span style={{ textAlign: 'right' }}>Eq. USD</span>
        <span style={{ textAlign: 'right' }}>Factura</span>
      </div>
      {vesMovs.map((m, i) => {
        const tone = m.rateSource === 'parallel' ? 'warning' : 'wine';
        return (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '90px 130px 1fr 130px 90px 130px 100px',
            padding: '12px 20px', gap: 14, alignItems: 'center',
            borderTop: i > 0 ? '1px solid var(--border)' : 0
          }}>
            <div style={{ font: '700 11px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{m.date.slice(5)}</div>
            <code style={{ font: '600 11px/1 var(--f-mono)', color: 'var(--ink)' }}>{m.ref}</code>
            <div style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink)' }}>{m.desc}</div>
            <div style={{ textAlign: 'right', font: '800 13px/1 var(--f-mono)', color: 'var(--ink)' }}>
              {R.fmtBs(m.amountBs)}
            </div>
            <div style={{ textAlign: 'center' }}>
              <U.Badge tone={tone} size="sm">@ {m.rateUsed.toFixed(2)}</U.Badge>
              <div style={{ font: '500 9.5px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 4 }}>
                {m.rateSource === 'parallel' ? 'paralelo' : 'BCV'}
              </div>
            </div>
            <div style={{ textAlign: 'right', font: '800 13px/1 var(--f-mono)', color: 'var(--success)' }}>
              {R.fmtUsd(m.equivalentUsd)}
            </div>
            <div style={{ textAlign: 'right' }}>
              <code style={{ font: '600 11px/1 var(--f-mono)', color: 'var(--wine)' }}>{m.linkInvoice}</code>
            </div>
          </div>);

      })}
      <div style={{
        padding: '12px 20px', background: 'var(--bg-elevated)',
        borderTop: '1px solid var(--border)',
        font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)',
        display: 'flex', alignItems: 'center', gap: 10
      }}>
        <span style={{ color: 'var(--info)' }}>{I.shield(13)}</span>
        Cada pago en Bs. se asienta con la tasa BCV/Paralelo vigente al día de la transacción. La conversión a USD queda en libros como historial fiscal · no se re-cotiza.
      </div>
    </U.Card>);

}

window.EstadoCuenta = EstadoCuenta;