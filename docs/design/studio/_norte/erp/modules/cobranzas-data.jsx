/* global React */
/* ── DTD ERP · Cobranzas · Datos & helpers ──────────────────── */
/* Cola de cuentas por cobrar (CxC) vencidas con seguimiento:    */
/* contacto, promesa de pago, recordatorios. Sobre el aging real */
/* (ERPData.INVOICES con saldo). Gestión persistida en localStg. */

const COBRANZAS_KEY = 'dtd_cobranzas_v1';
const COB_TODAY = '2026-05-24';

const COB_STAGES = {
  'al-dia':     { label: 'Al día',          tone: 'success', step: 0 },
  'vencido':    { label: 'Vencido',         tone: 'danger',  step: 1 },
  'contactado': { label: 'Contactado',      tone: 'warning', step: 2 },
  'promesa':    { label: 'Promesa de pago', tone: 'info',    step: 3 },
  'pagado':     { label: 'Pagado',          tone: 'success', step: 4 },
};

const COB_ACTION = {
  contacto:     { label: 'Contacto', icon: 'chat' },
  promesa:      { label: 'Promesa de pago', icon: 'clock' },
  recordatorio: { label: 'Recordatorio enviado', icon: 'mail' },
  pago:         { label: 'Pago registrado', icon: 'check' },
  nota:         { label: 'Nota', icon: 'edit' },
};

function _cobDays(dueStr) {
  try { return Math.round((new Date(COB_TODAY + 'T00:00:00') - new Date(dueStr + 'T00:00:00')) / 86400000); } catch (e) { return 0; }
}

function _cobReadOverlay() { try { return JSON.parse(localStorage.getItem(COBRANZAS_KEY) || '{}'); } catch (e) { return {}; } }
function _cobWriteOverlay(o) { try { localStorage.setItem(COBRANZAS_KEY, JSON.stringify(o)); } catch (e) {} window.dispatchEvent(new CustomEvent('dtd-cobranzas-changed')); }

// Ítems de cobranza = facturas con saldo, fusionadas con la gestión guardada.
function cobItems() {
  const invs = ((window.ERPData?.byTenant?.(window.ERPData.INVOICES)) || window.ERPData?.INVOICES || []).filter(i => (i.balance || 0) > 0);
  const overlay = _cobReadOverlay();
  return invs.map(i => {
    const over = overlay[i.id] || {};
    const collectedUsd = over.collectedUsd || 0;
    const balance = Math.max(0, (i.balance || 0) - collectedUsd);
    const days = _cobDays(i.due);
    const baseStage = days > 0 ? 'vencido' : 'al-dia';
    const stage = over.stage || baseStage;
    return {
      ...i,
      balance,
      paid: (i.paid || 0) + collectedUsd,
      collectedUsd,
      status: balance <= 0 ? 'pagado' : (collectedUsd > 0 ? 'parcial' : i.status),
      days, stage,
      promiseDate: over.promiseDate || null,
      log: over.log || [],
      lastAction: (over.log && over.log.length) ? over.log[over.log.length - 1] : null,
    };
  }).sort((a, b) => b.days - a.days);
}

function cobSetStage(invId, stage) {
  const o = _cobReadOverlay(); o[invId] = { ...(o[invId] || {}), stage }; _cobWriteOverlay(o);
}
function cobAddAction(invId, type, text, extra) {
  const o = _cobReadOverlay();
  const entry = { at: new Date().toISOString().slice(0, 16).replace('T', ' '), type, text };
  const cur = o[invId] || {};
  cur.log = [...(cur.log || []), entry];
  // efectos por tipo de acción
  if (type === 'contacto' && (!cur.stage || cur.stage === 'vencido' || cur.stage === 'al-dia')) cur.stage = 'contactado';
  if (type === 'promesa') { cur.stage = 'promesa'; if (extra?.date) cur.promiseDate = extra.date; }
  if (type === 'pago') cur.stage = 'pagado';
  o[invId] = cur; _cobWriteOverlay(o);
}

// Registrar un cobro: baja el saldo de la factura (overlay) + deposita en la
// caja elegida (Tesorería) + log de gestión. Soporta abono parcial.
function cobRegisterPayment(invId, { amountUsd, accountId, method, currency, amountOriginal, rate, ref, clientName }) {
  const o = _cobReadOverlay();
  const cur = o[invId] || {};
  cur.collectedUsd = (cur.collectedUsd || 0) + (Number(amountUsd) || 0);

  // saldo restante (sobre el balance original de la factura)
  const inv = (window.ERPData?.INVOICES || []).find(i => i.id === invId);
  const origBalance = inv ? (inv.balance || 0) : 0;
  const remaining = Math.max(0, origBalance - cur.collectedUsd);
  cur.stage = remaining <= 0 ? 'pagado' : (cur.stage === 'al-dia' || cur.stage === 'vencido' ? 'contactado' : cur.stage);

  const acct = window.TesoreriaData?.getAccount?.(accountId);
  const inCur = currency && currency !== 'USD'
    ? `${acct ? acct.short : currency} (${(acct ? acct.currency : currency)})`
    : (acct ? acct.short : 'USD');
  const entry = {
    at: new Date().toISOString().slice(0, 16).replace('T', ' '),
    type: 'pago',
    text: `Cobro ${remaining <= 0 ? 'total' : 'parcial'} de $${Math.round(Number(amountUsd)).toLocaleString('en-US')} · ${method} → ${inCur}${ref ? ' · ' + ref : ''}`,
  };
  cur.log = [...(cur.log || []), entry];
  o[invId] = cur;
  _cobWriteOverlay(o);

  // Ingreso a la caja de Tesorería
  if (window.TesoreriaData?.cashDeposit && accountId) {
    window.TesoreriaData.cashDeposit({
      accountId, amountUsd: Number(amountUsd) || 0,
      amountOriginal: Number(amountOriginal) || Number(amountUsd) || 0,
      currency: currency || 'USD', rate: Number(rate) || 1,
      method, ref: ref || null, invoice: invId, concept: `Cobro factura ${invId}${clientName ? ' · ' + clientName : ''}`,
    });
  }
  return remaining;
}

function cobTotals() {
  const items = cobItems();
  const porCobrar = items.filter(i => i.stage !== 'pagado').reduce((s, i) => s + i.balance, 0);
  const vencido = items.filter(i => i.days > 0 && i.stage !== 'pagado').reduce((s, i) => s + i.balance, 0);
  const promesa = items.filter(i => i.stage === 'promesa').reduce((s, i) => s + i.balance, 0);
  const casos = items.filter(i => i.stage !== 'pagado').length;
  return { porCobrar, vencido, promesa, casos };
}

window.CobranzasData = {
  COB_STAGES, COB_ACTION, COB_TODAY,
  cobItems, cobSetStage, cobAddAction, cobRegisterPayment, cobTotals, cobDays: _cobDays,
};
