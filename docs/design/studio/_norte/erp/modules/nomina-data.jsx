/* global React */
/* ── DTD ERP · Nómina · Datos & helpers · v2.5 ──────────────── */
/* Sueldos indexados en USD (referencia), pago en BOLÍVARES, y    */
/* contabilidad en USD funcional (con forex a tasa BCV).          */
/* Aportes VE: SSO 4% · RPE 0,5% · FAOV 1% (deducción empleado).  */

const NOMINA_EMP_KEY = 'dtd_nomina_emp_v25';
const NOMINA_RUN_KEY = 'dtd_nomina_runs_v25';

// Tasas de ley (deducción del trabajador) · Venezuela
const NOMINA_RATES = { sso: 0.04, rpe: 0.005, faov: 0.01 };

// ── Reglas de cálculo · ÚNICA fuente de verdad de los parámetros ──
// El sistema trae las reglas ya configuradas según la ley vigente.
// Si la ley cambia (o la empresa aplica otra política), se editan
// acá y el cálculo de toda la nómina se actualiza. Cada corte
// congela las reglas vigentes (auditable).
const NOMINA_RULES_KEY = 'dtd_nomina_rules_v25';
const NOMINA_RULES_DEFAULTS = {
  vigencia: '2026-05-01',           // estos parámetros rigen desde…

  // 1 · Base de cálculo
  metodoDias: 30,                   // divisor del salario diario: 30 (comercial) | 'reales'
  jornadaHoras: 8,                  // horas por jornada
  horasSemana: 44,                  // jornada semanal LOTTT
  frecuenciaPago: 'mensual',        // 'mensual' | 'quincenal' | 'semanal' · unidad del corte

  // 2 · Parámetros del Estado (cambian por decreto) · montos en Bs
  salarioMinimoBs: 130,             // salario mínimo nacional
  cestaticketBs: 1000,              // bono de alimentación (NO salarial)
  bonoGuerraBs: 9000,               // bono de guerra económica (NO salarial)

  // 3 · Deducciones del trabajador (%) · aplican al cálculo del recibo
  ssoPct: 4,                        // Seguro Social Obligatorio (IVSS)
  rpePct: 0.5,                      // Régimen Prestacional de Empleo (paro forzoso)
  faovPct: 1,                       // Política Habitacional (FAOV)
  ssoTopeSM: 5,                     // tope de cotización IVSS, en salarios mínimos
  rpeTopeSM: 10,                    // tope de cotización RPE/paro, en salarios mínimos

  // 4 · Aportes patronales (%) · informativo · costo empresa
  ssoPatronalPct: 9,
  rpePatronalPct: 1.7,
  faovPatronalPct: 2,
  incesPct: 2,

  // 5 · Horas extra y recargos (%)
  recargoExtraDiurna: 50,           // hora extra diurna
  recargoNocturno: 30,              // bono nocturno
  recargoFeriado: 50,               // día feriado/descanso trabajado
  topeExtraSemana: 10,              // tope horas extra por semana
  topeExtraAnio: 100,               // tope horas extra por año

  // 6 · Beneficios y provisiones (días)
  vacacionesDias: 15,               // base de vacaciones
  vacacionesAdicXAnio: 1,           // día adicional por año de servicio
  vacacionesTope: 30,               // tope de días
  bonoVacacionalDias: 15,           // base bono vacacional
  utilidadesDiasMin: 30,            // utilidades · mínimo legal
  utilidadesDiasMax: 120,           // utilidades · máximo

  // 7 · Prestaciones sociales (Art. 142 LOTTT)
  garantiaTrimestralDias: 15,       // garantía por trimestre
  diasAdicXAnio: 2,                 // días adicionales por año (desde el 2º)
  prestacionesMetodo: 'mayor',      // 'mayor' (retroactivo vs garantía) | 'garantia' | 'retroactivo'
};

function loadRules() {
  let o = {};
  try { o = JSON.parse(localStorage.getItem(NOMINA_RULES_KEY)) || {}; } catch (e) {}
  return { ...NOMINA_RULES_DEFAULTS, ...o };
}
function saveRules(patch) {
  const next = { ...loadRules(), ...patch };
  try { localStorage.setItem(NOMINA_RULES_KEY, JSON.stringify(next)); } catch (e) {}
  window.dispatchEvent(new CustomEvent('dtd-nomina-changed'));
  return next;
}
function resetRules() {
  try { localStorage.removeItem(NOMINA_RULES_KEY); } catch (e) {}
  window.dispatchEvent(new CustomEvent('dtd-nomina-changed'));
  return { ...NOMINA_RULES_DEFAULTS };
}
function rulesDiff() {
  const cur = loadRules(); const out = [];
  Object.keys(NOMINA_RULES_DEFAULTS).forEach(k => {
    if (String(cur[k]) !== String(NOMINA_RULES_DEFAULTS[k])) out.push({ key: k, from: NOMINA_RULES_DEFAULTS[k], to: cur[k] });
  });
  return out;
}

// Cuentas contables de la nómina
const NOMINA_COA = {
  gasto:     '6.09.04',  // Gastos de Nómina
  pasivo:    '2.08',     // Payroll liabilities (aportes/retenciones por pagar)
  bancoVes:  '1.01.02',  // Banesco JM · VES (pago a empleados)
};

// ── Empleados (seed) · sueldo mensual indexado en USD ─────────
const EMP_SEED = [
  { id: 'emp-001', name: 'Yolanda Méndez',   cargo: 'Gerente de Operaciones', cedula: 'V-12.884.221', phone: '+58 412 5528841', salarioUsd: 820, dept: 'Operación', startDate: '2019-03-04', tenantId: 'dtd' },
  { id: 'emp-002', name: 'Andrés Briceño',   cargo: 'Contabilidad',           cedula: 'V-15.220.114', phone: '+58 414 2201188', salarioUsd: 560, dept: 'Finanzas', startDate: '2021-08-16', tenantId: 'dtd' },
  { id: 'emp-003', name: 'Sam Liang',        cargo: 'Coordinador China',      cedula: 'E-84.112.009', phone: '+58 424 9992200', salarioUsd: 640, dept: 'China', startDate: '2020-11-02', tenantId: 'dtd' },
  { id: 'emp-004', name: 'Daniela Pérez',    cargo: 'Atención al Cliente',    cedula: 'V-22.118.554', phone: '+58 416 7784477', salarioUsd: 320, dept: 'Comercial', startDate: '2023-02-20', tenantId: 'dtd' },
  { id: 'emp-005', name: 'José Castillo',    cargo: 'Almacén Valencia',       cedula: 'V-18.554.903', phone: '+58 412 3361902', salarioUsd: 300, dept: 'Almacén', startDate: '2022-06-13', tenantId: 'dtd' },
  { id: 'emp-006', name: 'Luis Ramos',       cargo: 'Chofer de Reparto',      cedula: 'V-19.770.512', phone: '+58 414 8851230', salarioUsd: 300, dept: 'Transporte', startDate: '2024-09-09', tenantId: 'dtd' },
  // Andes Import CA (empresa aparte · multi-tenant)
  { id: 'emp-a01', name: 'Rosa Villalba',    cargo: 'Administradora',         cedula: 'V-14.009.882', phone: '+58 412 7741200', salarioUsd: 480, dept: 'Administración', startDate: '2021-01-18', tenantId: 'andes' },
  { id: 'emp-a02', name: 'Pedro Quintero',   cargo: 'Almacenista',            cedula: 'V-20.551.337', phone: '+58 416 3392011', salarioUsd: 290, dept: 'Almacén', startDate: '2023-07-04', tenantId: 'andes' },
  { id: 'emp-a03', name: 'Marisol Duarte',   cargo: 'Atención al Cliente',    cedula: 'V-19.118.640', phone: '+58 424 5582910', salarioUsd: 300, dept: 'Comercial', startDate: '2024-03-22', tenantId: 'andes' },
  // Pacífico Logística (empresa aparte)
  { id: 'emp-p01', name: 'Gustavo Mejías',   cargo: 'Coordinador de Flota',   cedula: 'V-13.667.451', phone: '+58 414 2218890', salarioUsd: 520, dept: 'Transporte', startDate: '2020-09-14', tenantId: 'pacifico' },
  { id: 'emp-p02', name: 'Carla Nieto',      cargo: 'Contabilidad',           cedula: 'V-21.004.778', phone: '+58 412 6650121', salarioUsd: 450, dept: 'Finanzas', startDate: '2022-11-30', tenantId: 'pacifico' },
];

// Empresa (tenant) activa · respeta el selector global del ERP
function _curTenant() { try { return (window.ERPData && window.ERPData.currentTenant) ? window.ERPData.currentTenant() : 'dtd'; } catch (e) { return 'dtd'; } }
function _inTenant(row) { const t = _curTenant(); if (t === 'all') return true; const rt = row && row.tenantId; return rt == null ? t === 'dtd' : rt === t; }

const EMPLOYEES = [];
function _rebuildEmployees() {
  let added = [], edits = {}, inactive = [];
  try { const o = JSON.parse(localStorage.getItem(NOMINA_EMP_KEY)) || {}; added = o.added || []; edits = o.edits || {}; inactive = o.inactive || []; } catch (e) {}
  EMPLOYEES.length = 0;
  EMP_SEED.concat(added).filter(_inTenant).forEach(e => {
    const merged = edits[e.id] ? { ...e, ...edits[e.id] } : e;
    EMPLOYEES.push({ ...merged, inactive: inactive.includes(e.id) });
  });
}
function _loadEmpOverlay() { try { return JSON.parse(localStorage.getItem(NOMINA_EMP_KEY)) || { added: [], edits: {}, inactive: [] }; } catch (e) { return { added: [], edits: {}, inactive: [] }; } }
function _saveEmpOverlay(o) { try { localStorage.setItem(NOMINA_EMP_KEY, JSON.stringify(o)); } catch (e) {} _rebuildEmployees(); window.dispatchEvent(new CustomEvent('dtd-nomina-changed')); }
function createEmployee(emp) {
  const o = _loadEmpOverlay();
  o.added = o.added || [];
  o.added.push({ id: 'emp-' + Date.now(), tenantId: _curTenant(), ...emp });
  _saveEmpOverlay(o);
}
function updateEmployee(id, patch) { const o = _loadEmpOverlay(); o.edits = o.edits || {}; o.edits[id] = { ...(o.edits[id] || {}), ...patch }; _saveEmpOverlay(o); }
function setEmployeeActive(id, active) {
  const o = _loadEmpOverlay(); o.inactive = o.inactive || [];
  if (active) o.inactive = o.inactive.filter(x => x !== id); else if (!o.inactive.includes(id)) o.inactive.push(id);
  _saveEmpOverlay(o);
}

// ── Cálculo de un recibo (todo en USD; el VES se deriva a tasa) ─
// Período = una unidad de pago (mensual por defecto). Los componentes
// definidos por mes (sueldo, deducciones, cestaticket, bono guerra)
// se prorratean por la frecuencia; el bono voluntario, las horas extra
// y la cuota de préstamo son montos del propio período.
function calcRecibo(emp, bonoUsd) {
  const R = loadRules();
  const rate = (window.ERPRates && window.ERPRates.read) ? (window.ERPRates.read().bcv || 36.45) : 36.45;
  const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const pf = R.frecuenciaPago === 'quincenal' ? 0.5 : R.frecuenciaPago === 'semanal' ? (12 / 52) : 1;

  const sueldoMensual = Number(emp.salarioUsd) || 0;
  const sueldo = r2(sueldoMensual * pf);          // sueldo del período
  const bono = Number(bonoUsd) || 0;              // bono voluntario del período

  // Horas extra del período · monetizadas con recargo LOTTT ──────
  const att = (typeof attSummary === 'function') ? attSummary(emp.id, 2026, 4) : { extra: 0, resta: 0 };
  const valorHora = (sueldoMensual / 30) / (Number(R.jornadaHoras) || 8);
  const pagoExtra = (Number(att.extra) || 0) * valorHora * (1 + (Number(R.recargoExtraDiurna) || 0) / 100);
  const descHoras = (Number(att.resta) || 0) * valorHora;  // horas no trabajadas, a tarifa normal
  const extras = r2(pagoExtra - descHoras);

  const asignaciones = r2(sueldo + bono + extras);

  // Deducciones del trabajador · con tope de cotización (en SM) ───
  const smUsd = rate > 0 ? (Number(R.salarioMinimoBs) || 0) / rate : 0;
  const baseSso = Math.min(sueldo, (Number(R.ssoTopeSM) || 5) * smUsd * pf);   // IVSS tope 5 SM
  const baseRpe = Math.min(sueldo, (Number(R.rpeTopeSM) || 10) * smUsd * pf);  // RPE tope 10 SM
  const sso = r2(baseSso * (Number(R.ssoPct) || 0) / 100);
  const rpe = r2(baseRpe * (Number(R.rpePct) || 0) / 100);
  const faov = r2(sueldo * (Number(R.faovPct) || 0) / 100);                    // FAOV sin tope
  const deducciones = r2(sso + rpe + faov);
  const neto = r2(asignaciones - deducciones);   // neto salarial de ley (sin préstamo)

  // Cuota de préstamo (descuento automático en nómina) ──────────
  const prestamo = r2(activeLoanCuota(emp.id));
  const netoFinal = r2(neto - prestamo);          // lo que efectivamente cobra

  // Asignaciones NO salariales (montos por decreto, en Bs) · prorrateadas
  const cestaticketBs = r2((Number(R.cestaticketBs) || 0) * pf);
  const bonoGuerraBs = r2((Number(R.bonoGuerraBs) || 0) * pf);
  const noSalBs = r2(cestaticketBs + bonoGuerraBs);
  return { sueldo, bono, extras, asignaciones, sso, rpe, faov, deducciones, neto, prestamo, netoFinal, cestaticketBs, bonoGuerraBs, noSalBs };
}
// Total a cobrar en Bs = neto final salarial (USD→Bs) + no salariales (Bs).
function totalCobrarVes(r, rate) {
  const base = (r.netoFinal != null ? r.netoFinal : r.neto) || 0;
  return Math.round(base * (Number(rate) || 1)) + (Number(r.noSalBs) || 0);
}
function payrollRows(bonoUsd) {
  return EMPLOYEES.filter(e => !e.inactive).map(e => ({ emp: e, r: calcRecibo(e, bonoUsd) }));
}
function payrollTotals(bonoUsd) {
  const rows = payrollRows(bonoUsd);
  return {
    asignaciones: rows.reduce((s, x) => s + x.r.asignaciones, 0),
    deducciones: rows.reduce((s, x) => s + x.r.deducciones, 0),
    neto: rows.reduce((s, x) => s + x.r.neto, 0),
    empleados: rows.length,
  };
}

// ── Asiento contable de la nómina (USD funcional · forex VES) ──
// Débito 6.09.04 (gasto) · Crédito 2.08 (aportes por pagar) ·
// Crédito 1.01.02 banco VES por el neto (con forex a tasa BCV).
function buildPayrollEntry(periodLabel, date, rate, bonoUsd) {
  const t = payrollTotals(bonoUsd);
  if (!t.asignaciones) return null;
  const r = Number(rate) || 1;
  const netVes = Math.round(t.neto * r * 100) / 100;
  const lines = [
    { account: NOMINA_COA.gasto, debit: Math.round(t.asignaciones * 100) / 100, credit: 0, memo: `Nómina ${periodLabel} · ${t.empleados} empleados` },
  ];
  if (t.deducciones) lines.push({ account: NOMINA_COA.pasivo, debit: 0, credit: t.deducciones, memo: 'Aportes retenidos (SSO/RPE/FAOV)' });
  lines.push({ account: NOMINA_COA.bancoVes, debit: 0, credit: Math.round(t.neto * 100) / 100, memo: `Pago neto · Bs. ${netVes.toLocaleString('es-VE')} @ ${r.toFixed(2)}` });
  return {
    date, concept: `Nómina ${periodLabel}`, ref: 'NOM-' + periodLabel.replace(/\s+/g, '-'), refType: 'expense',
    forex: { originalAmount: netVes, originalCurrency: 'VES', rate: r, rateSource: 'bcv' },
    lines,
  };
}

// ── Registro de corridas de nómina contabilizadas ─────────────
function payrollRuns() { try { return JSON.parse(localStorage.getItem(NOMINA_RUN_KEY)) || []; } catch (e) { return []; } }
function recordPayrollRun(run) {
  const arr = payrollRuns(); arr.unshift(run);
  try { localStorage.setItem(NOMINA_RUN_KEY, JSON.stringify(arr)); } catch (e) {}
  window.dispatchEvent(new CustomEvent('dtd-nomina-changed'));
}

// ── Mensaje de recibo para WhatsApp ───────────────────────────
function waPhone(phone) { return String(phone || '').replace(/[^\d]/g, ''); }
function reciboWhatsApp(emp, bonoUsd, rate, periodLabel) {
  const r = calcRecibo(emp, bonoUsd);
  const rt = Number(rate) || 1;
  const bs = (usd) => 'Bs. ' + Math.round(usd * rt).toLocaleString('es-VE');
  const L = [
    '*DTD Cargo · Recibo de pago*',
    `Período: ${periodLabel}`,
    `Empleado: ${emp.name} — ${emp.cargo}`,
    '',
    '*Asignaciones salariales*',
    `Sueldo base: ${bs(r.sueldo)}`,
  ];
  if (r.bono > 0) L.push(`Bono: ${bs(r.bono)}`);
  if (r.extras !== 0) L.push(`Horas extra: ${bs(r.extras)}`);
  L.push(
    `Total: ${bs(r.asignaciones)}`,
    '',
    '*Deducciones*',
    `SSO: ${bs(r.sso)}`,
    `RPE: ${bs(r.rpe)}`,
    `FAOV: ${bs(r.faov)}`,
    `Total: ${bs(r.deducciones)}`,
  );
  if (r.prestamo > 0) L.push(`Cuota de préstamo: ${bs(r.prestamo)}`);
  L.push(
    '',
    `Neto salarial: ${bs(r.netoFinal)} (ref. $${r.netoFinal.toFixed(2)} · BCV ${rt.toFixed(2)})`,
    '',
    '*Asignaciones no salariales*',
    `Cestaticket: Bs. ${r.cestaticketBs.toLocaleString('es-VE')}`,
    `Bono de guerra: Bs. ${r.bonoGuerraBs.toLocaleString('es-VE')}`,
    '',
    `*Total a cobrar: Bs. ${totalCobrarVes(r, rt).toLocaleString('es-VE')}*`,
    '',
    'Con Confianza, de China a tu puerta.',
  );
  return L.join('\n');
}
function waLink(emp, bonoUsd, rate, periodLabel) {
  return `https://wa.me/${waPhone(emp.phone)}?text=${encodeURIComponent(reciboWhatsApp(emp, bonoUsd, rate, periodLabel))}`;
}

// ── Documentos imprimibles (PDF vía print) ────────────────────
// Hoja con la marca DTD. El usuario imprime → "Guardar como PDF".
const _docCss = `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;700&family=Archivo+Black&family=JetBrains+Mono:wght@500;700&display=swap');
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Archivo',system-ui,sans-serif; color:#0F1E3D; background:#fff; padding:48px 56px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.wm { font-family:'Archivo Black',sans-serif; font-size:22px; letter-spacing:-0.02em; }
.wm .c1 { color:#7F0F1A; } .wm .c2 { color:#0F1E3D; }
.eyebrow { font:700 10px/1 'Archivo',sans-serif; letter-spacing:0.16em; text-transform:uppercase; color:#9B9B9B; }
.mono { font-family:'JetBrains Mono',ui-monospace,monospace; }
.h1 { font-family:'Archivo Black',sans-serif; font-size:26px; letter-spacing:-0.02em; margin-top:4px; }
.sub { font:500 13px/1.5 'Archivo'; color:#6B6B6B; margin-top:6px; }
table { width:100%; border-collapse:collapse; margin-top:8px; }
td { padding:9px 0; border-top:1px solid #E8E6E2; font:500 13px/1.4 'Archivo'; }
td.r { text-align:right; } .mono.r { font-weight:700; }
.sec { font:700 10px/1 'Archivo'; letter-spacing:0.14em; text-transform:uppercase; color:#7F0F1A; margin:26px 0 2px; }
.tag { font:700 8.5px/1 'Archivo'; letter-spacing:0.06em; text-transform:uppercase; padding:3px 7px; border-radius:999px; margin-left:8px; }
.tot { display:flex; justify-content:space-between; align-items:center; margin-top:24px; padding:16px 18px; border-radius:10px; background:#0F1E3D; color:#fff; }
.tot .v { font-family:'Archivo Black',sans-serif; font-size:22px; }
.foot { margin-top:34px; padding-top:16px; border-top:1px solid #E8E6E2; font:500 11px/1.6 'Archivo'; color:#9B9B9B; }
.row2 { display:flex; gap:40px; margin-top:18px; }
.row2 .lbl { font:700 9px/1 'Archivo'; letter-spacing:0.1em; text-transform:uppercase; color:#9B9B9B; }
.row2 .val { font:600 13px/1.4 'Archivo'; margin-top:5px; }
@media print { body { padding:0; } @page { margin:18mm; } }
`;
function _docShell(title, inner) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${title}</title><style>${_docCss}</style></head><body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0F1E3D;padding-bottom:16px;">
    <div><div class="wm"><span class="c1">DTD</span> <span class="c2">Cargo</span></div><div class="eyebrow" style="margin-top:7px;">Logística puerta a puerta · China → Venezuela</div></div>
    <div style="text-align:right;"><div class="eyebrow">${title}</div></div>
  </div>${inner}
  <div class="foot">Con Confianza, de China a tu puerta. · El pago se realiza en bolívares a la tasa BCV indicada. · Documento generado por DTD Studio.</div>
  <script>window.onload=function(){setTimeout(function(){window.print();},250);};<\/script>
  </body></html>`;
}
function _money(usd, rate) { return 'Bs. ' + Math.round((Number(usd) || 0) * rate).toLocaleString('es-VE'); }

function reciboHtml(emp, bonoUsd, rate, periodLabel) {
  const r = calcRecibo(emp, bonoUsd);
  const rt = Number(rate) || 1;
  const bs = (u) => _money(u, rt);
  const usd = (u) => 'USD ' + (Math.round((Number(u) || 0) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const line = (lbl, u, neg) => `<tr><td>${lbl}</td><td class="r mono">${neg ? '−' : ''}${bs(u)}</td><td class="r mono" style="color:#9B9B9B;">${neg ? '−' : ''}${usd(u)}</td></tr>`;
  let asign = line('Sueldo base', r.sueldo);
  if (r.bono > 0) asign += line('Bono', r.bono);
  if (r.extras !== 0) asign += line('Horas extra', r.extras);
  asign += `<tr><td style="font-weight:700;">Total asignaciones</td><td class="r mono" style="font-weight:800;">${bs(r.asignaciones)}</td><td class="r mono" style="color:#9B9B9B;">${usd(r.asignaciones)}</td></tr>`;
  let deduc = line('Seguro Social · IVSS', r.sso, true) + line('Paro forzoso · RPE', r.rpe, true) + line('FAOV · vivienda', r.faov, true);
  if (r.prestamo > 0) deduc += line('Cuota de préstamo', r.prestamo, true);
  deduc += `<tr><td style="font-weight:700;">Neto salarial</td><td class="r mono" style="font-weight:800;">${bs(r.netoFinal)}</td><td class="r mono" style="color:#9B9B9B;">${usd(r.netoFinal)}</td></tr>`;
  const inner = `
  <div class="eyebrow" style="margin-top:24px;">Recibo de pago</div>
  <div class="h1">${periodLabel}</div>
  <div class="row2">
    <div><div class="lbl">Empleado</div><div class="val">${emp.name}</div></div>
    <div><div class="lbl">Cargo</div><div class="val">${emp.cargo}</div></div>
    <div><div class="lbl">Cédula</div><div class="val mono">${emp.cedula || '—'}</div></div>
    <div><div class="lbl">Tasa BCV</div><div class="val mono">${rt.toFixed(2)}</div></div>
  </div>
  <div class="sec">Asignaciones <span class="tag" style="background:#E8EEF7;color:#2A6FDB;">Salarial</span></div>
  <table>${asign}</table>
  <div class="sec">Deducciones de ley</div>
  <table>${deduc}</table>
  <div class="sec">Otras asignaciones <span class="tag" style="background:#E6F2EB;color:#1F8A5B;">No salarial</span></div>
  <table><tr><td>Cestaticket</td><td class="r mono">Bs. ${r.cestaticketBs.toLocaleString('es-VE')}</td><td></td></tr><tr><td>Bono de guerra</td><td class="r mono">Bs. ${r.bonoGuerraBs.toLocaleString('es-VE')}</td><td></td></tr></table>
  <div class="tot"><span style="font-weight:700;letter-spacing:0.04em;text-transform:uppercase;font-size:12px;">Total a cobrar</span><span class="v">Bs. ${totalCobrarVes(r, rt).toLocaleString('es-VE')}</span></div>`;
  return _docShell('Recibo · ' + emp.name, inner);
}

function finiquitoHtml(emp, L, fecha, rate) {
  const rt = Number(rate) || 1;
  const usd = (u) => 'USD ' + (Math.round((Number(u) || 0) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const rows = L.rows.map(r => `<tr><td>${r.concepto}<div style="font:500 10px/1.2 'Archivo';color:#9B9B9B;margin-top:2px;">${r.sub}</div></td><td class="r mono">${r.dias.toFixed(1)}</td><td class="r mono">${usd(r.legal)}</td><td class="r mono" style="color:#B8893A;">${usd(r.cont)}</td></tr>`).join('');
  const inner = `
  <div class="eyebrow" style="margin-top:24px;">Finiquito de prestaciones</div>
  <div class="h1">${emp.name}</div>
  <div class="row2">
    <div><div class="lbl">Cargo</div><div class="val">${emp.cargo}</div></div>
    <div><div class="lbl">Cédula</div><div class="val mono">${emp.cedula || '—'}</div></div>
    <div><div class="lbl">Causa de egreso</div><div class="val">${L.causa.label} · ${L.causa.art}</div></div>
    <div><div class="lbl">Fecha de egreso</div><div class="val mono">${fecha}</div></div>
    <div><div class="lbl">Antigüedad</div><div class="val">${L.fullYears} a ${L.fracMonths} m</div></div>
  </div>
  <table style="margin-top:22px;"><tr><td class="eyebrow">Concepto</td><td class="eyebrow r">Días</td><td class="eyebrow r">Legal</td><td class="eyebrow r">Contingente</td></tr>${rows}
  <tr><td style="font-weight:700;border-top:2px solid #0F1E3D;">Subtotal</td><td style="border-top:2px solid #0F1E3D;"></td><td class="r mono" style="font-weight:800;border-top:2px solid #0F1E3D;">${usd(L.totLegal)}</td><td class="r mono" style="font-weight:800;color:#B8893A;border-top:2px solid #0F1E3D;">${usd(L.totCont)}</td></tr>
  ${L.prestamos > 0 ? `<tr><td>(−) Préstamos pendientes</td><td></td><td class="r mono" style="color:#A8323E;">−${usd(L.prestamos)}</td><td class="r mono" style="color:#A8323E;">−${usd(L.prestamos)}</td></tr>` : ''}
  </table>
  <div class="tot"><span style="font-weight:700;letter-spacing:0.04em;text-transform:uppercase;font-size:12px;">Neto a liquidar (legal)</span><span class="v">${usd(L.netoLegal)}</span></div>
  <div style="margin-top:12px;font:500 11px/1.5 'Archivo';color:#6B6B6B;">Exposición contingente (si se reclasifican los bonos como salario): <b style="color:#0F1E3D;">${usd(L.exposicion)}</b>. Estimación según los parámetros vigentes; la liquidación final debe confirmarse con el contador antes de la firma.</div>`;
  return _docShell('Finiquito · ' + emp.name, inner);
}

function printDoc(html) {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.open(); w.document.write(html); w.document.close();
}

_rebuildEmployees();

// Reaccionar al cambio de empresa (selector global del ERP)
try {
  window.addEventListener('dtd-tenant-changed', function () {
    _rebuildEmployees();
    window.dispatchEvent(new CustomEvent('dtd-nomina-changed'));
  });
} catch (e) {}

// ── v2.5 · Comunicaciones al empleado (le llega a su app) ─────
// Tipos: 'recibo' (recibo de pago) · 'amonestacion' · 'llamado'
// (llamado de atención por inasistencia) · 'aviso' (informativo).
const COMM_KEY = 'dtd_nomina_comms_v25';
const COMM_TYPES = {
  recibo:       { label: 'Recibo de pago',       tone: 'success', icon: 'invoice' },
  aviso:        { label: 'Aviso',                 tone: 'info',    icon: 'bell' },
  llamado:      { label: 'Llamado de atención',   tone: 'warning', icon: 'clock' },
  amonestacion: { label: 'Amonestación',          tone: 'danger',  icon: 'shield' },
};
const COMM_SEED = [
  { id: 'cm-1003', empId: 'emp-006', type: 'llamado',      title: 'Inasistencia sin aviso', body: 'Se registró tu inasistencia del 21/05 sin notificación previa. Por favor justificá ante RRHH antes del cierre de la semana.', date: '2026-05-22', by: 'RRHH · Yolanda M.', read: false, ack: false, channel: 'app' },
  { id: 'cm-1002', empId: 'emp-004', type: 'aviso',        title: 'Cambio de horario', body: 'A partir del 1/06 el turno de atención al cliente arranca 8:30. Cualquier duda, escribinos.', date: '2026-05-20', by: 'RRHH · Yolanda M.', read: true,  ack: false, channel: 'app' },
  { id: 'cm-1001', empId: 'emp-001', type: 'recibo',       title: 'Recibo · 1ª quincena mayo 2026', body: 'Tu recibo de la 1ª quincena de mayo está disponible. Neto Bs. 14.842 (ref. $407,30 · BCV 36,45).', date: '2026-05-15', by: 'Nómina', read: true,  ack: true,  channel: 'app' },
];
function _loadComms() {
  let added = [], patch = {};
  try { const o = JSON.parse(localStorage.getItem(COMM_KEY)) || {}; added = o.added || []; patch = o.patch || {}; } catch (e) {}
  return COMM_SEED.concat(added).map(c => patch[c.id] ? { ...c, ...patch[c.id] } : c);
}
function _saveCommOverlay(o) { try { localStorage.setItem(COMM_KEY, JSON.stringify(o)); } catch (e) {} window.dispatchEvent(new CustomEvent('dtd-nomina-changed')); }
function commsFor(empId) { return _loadComms().filter(c => c.empId === empId).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)); }
function allComms() { return _loadComms().sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)); }
function createComm(comm) {
  let o = {}; try { o = JSON.parse(localStorage.getItem(COMM_KEY)) || {}; } catch (e) {}
  o.added = o.added || [];
  o.added.push({ id: 'cm-' + Date.now(), date: new Date().toISOString().slice(0, 10), by: 'RRHH', read: false, ack: false, channel: 'app', ...comm });
  _saveCommOverlay(o);
}
function markComm(id, patch) {
  let o = {}; try { o = JSON.parse(localStorage.getItem(COMM_KEY)) || {}; } catch (e) {}
  o.patch = o.patch || {}; o.patch[id] = { ...(o.patch[id] || {}), ...patch };
  _saveCommOverlay(o);
}
function commWhatsApp(emp, type, title, body) {
  const t = COMM_TYPES[type] || { label: 'Mensaje' };
  const L = [`*DTD Cargo · ${t.label}*`, `Para: ${emp.name}`, '', `*${title}*`, body, '', 'Podés ver el detalle en tu app de DTD Cargo.'];
  return L.join('\n');
}
function commWaLink(emp, type, title, body) {
  return `https://wa.me/${waPhone(emp.phone)}?text=${encodeURIComponent(commWhatsApp(emp, type, title, body))}`;
}

// ════════════════════════════════════════════════════════════════
// v2.6 · Auto-registro de empleados con aprobación del admin
// El empleado se registra desde su app (link de invitación) → queda
// PENDIENTE → el admin revisa y aprueba (asigna sueldo) o rechaza.
// Al aprobar se crea la ficha del empleado + su login.
// ════════════════════════════════════════════════════════════════
const REGLINK_KEY = 'dtd_nomina_reglinks_v26';
const REG_KEY = 'dtd_nomina_regs_v26';

// Bancos de Venezuela (uso más común)
const VE_BANKS = [
  'Banesco', 'Mercantil', 'Banco de Venezuela', 'BBVA Provincial',
  'Banco Nacional de Crédito · BNC', 'Bancaribe', 'Banco del Tesoro',
  'Banco Exterior', 'Bancamiga', 'Banplus', '100% Banco',
  'Venezolano de Crédito', 'Banco Plaza', 'Banco Activo', 'BOD',
];
const CUENTA_TIPOS = ['Corriente', 'Ahorro'];

function _nowStr() { return new Date().toISOString().slice(0, 16).replace('T', ' '); }
function _initials(name) {
  const p = String(name || '').trim().split(/\s+/);
  const a = (p[0] && p[0][0]) || '';
  const b = (p[1] && p[1][0]) || '';
  return ((a + b) || '··').toUpperCase().slice(0, 2);
}

// crea empleado y devuelve el id (variante de createEmployee)
function createEmployeeReturning(emp) {
  const id = 'emp-' + Date.now();
  const o = _loadEmpOverlay();
  o.added = o.added || [];
  o.added.push({ id, tenantId: _curTenant(), ...emp });
  _saveEmpOverlay(o);
  return id;
}

// ── Links de invitación ───────────────────────────────────────
function _loadLinks() { try { return JSON.parse(localStorage.getItem(REGLINK_KEY)) || []; } catch (e) { return []; } }
function _saveLinks(a) { try { localStorage.setItem(REGLINK_KEY, JSON.stringify(a)); } catch (e) {} window.dispatchEvent(new CustomEvent('dtd-nomina-changed')); }
function regLinks() { return _loadLinks().filter(_inTenant); }
function regLinkByToken(token) { return _loadLinks().find(l => l.token === token) || null; }
function regLinkUrl(token) { return 'App del Empleado.html?reg=' + token; }
function createRegLink(opts) {
  opts = opts || {};
  const a = _loadLinks();
  const token = 'INV-' + Math.random().toString(36).slice(2, 6).toUpperCase() + Math.random().toString(36).slice(2, 4).toUpperCase();
  const link = { token, cargo: opts.cargo || '', dept: opts.dept || '', by: opts.by || 'Admin', tenantId: _curTenant(), createdAt: _nowStr(), active: true, uses: 0 };
  a.unshift(link); _saveLinks(a);
  return link;
}
function revokeRegLink(token) { _saveLinks(_loadLinks().map(l => l.token === token ? { ...l, active: false } : l)); }
function _bumpLinkUse(token) { if (!token) return; _saveLinks(_loadLinks().map(l => l.token === token ? { ...l, uses: (l.uses || 0) + 1 } : l)); }

// ── Solicitudes de registro ───────────────────────────────────
const REG_SEED = [
  { id: 'reg-seed-1', token: null, status: 'pendiente', tenantId: 'dtd', name: 'Génesis Salazar', cedula: 'V-26.554.901', birth: '1998-03-12', startDate: '2026-05-26', phone: '+58 412 9087734', email: 'gsalazar@dtdcargo.com', cargo: 'Asistente de Almacén', dept: 'Almacén', banco: 'Banesco', tipoCuenta: 'Corriente', cuenta: '0134 0000 00 0000000000', photo: null, createdAt: '2026-05-26 09:14' },
  { id: 'reg-seed-2', token: 'INV-DEMO01', status: 'pendiente', tenantId: 'dtd', name: 'Héctor Pulido', cedula: 'V-20.118.443', birth: '1994-11-02', startDate: '2026-06-01', phone: '+58 424 5512098', email: 'hpulido@dtdcargo.com', cargo: 'Chofer de Reparto', dept: 'Transporte', banco: 'Mercantil', tipoCuenta: 'Ahorro', cuenta: '0105 0000 00 0000000000', photo: null, createdAt: '2026-05-27 16:40' },
];
function _loadRegs() { try { const v = localStorage.getItem(REG_KEY); return v === null ? null : (JSON.parse(v) || []); } catch (e) { return null; } }
function _saveRegs(a) { try { localStorage.setItem(REG_KEY, JSON.stringify(a)); } catch (e) {} window.dispatchEvent(new CustomEvent('dtd-nomina-changed')); }
function _allRegsRaw() { const a = _loadRegs(); return a === null ? REG_SEED.slice() : a; }
function allRegs() { return _allRegsRaw().filter(_inTenant); }
function pendingRegs() { return allRegs().filter(r => r.status === 'pendiente'); }
function regById(id) { return allRegs().find(r => r.id === id) || null; }
function submitRegistration(payload) {
  const a = _allRegsRaw();
  const reg = {
    id: 'reg-' + Date.now(), token: null, status: 'pendiente', tenantId: (payload.token && regLinkByToken(payload.token) || {}).tenantId || _curTenant(),
    name: '', cedula: '', birth: '', startDate: '', phone: '', email: '',
    cargo: '', dept: '', banco: '', tipoCuenta: 'Corriente', cuenta: '', photo: null,
    ...payload, createdAt: _nowStr(),
  };
  a.unshift(reg); _saveRegs(a);
  if (reg.token) _bumpLinkUse(reg.token);
  return reg;
}
function approveRegistration(id, extra) {
  extra = extra || {};
  const a = _allRegsRaw();
  const reg = a.find(r => r.id === id);
  if (!reg || reg.status !== 'pendiente') return null;
  const empId = createEmployeeReturning({
    name: reg.name, cargo: reg.cargo, cedula: reg.cedula, phone: reg.phone, tenantId: reg.tenantId || _curTenant(),
    salarioUsd: Number(extra.salarioUsd) || 0, dept: extra.dept || reg.dept || '',
    email: reg.email, banco: reg.banco, tipoCuenta: reg.tipoCuenta, cuenta: reg.cuenta,
    birth: reg.birth, startDate: reg.startDate, photo: reg.photo,
  });
  _saveRegs(a.map(r => r.id === id ? { ...r, status: 'aprobado', empId, salarioUsd: Number(extra.salarioUsd) || 0, decidedAt: _nowStr(), decidedBy: extra.by || 'Admin' } : r));
  createComm({ empId, type: 'aviso', title: 'Te damos la bienvenida a DTD Cargo', body: `Tu registro fue aprobado. Ya podés ver tu recibo de pago y tus comunicaciones desde la app. Cargo: ${reg.cargo}. Cualquier duda, escribinos.`, by: 'RRHH' });
  return empId;
}
function rejectRegistration(id, motivo) {
  _saveRegs(_allRegsRaw().map(r => r.id === id ? { ...r, status: 'rechazado', motivo: motivo || '', decidedAt: _nowStr(), decidedBy: 'Admin' } : r));
}
// logins de empleados aprobados (se suman a los USERS rol Empleado)
function empLogins() {
  return allRegs().filter(r => r.status === 'aprobado' && r.empId).map(r => ({
    id: 'ureg-' + r.id, name: r.name, email: r.email, role: 'Empleado',
    avatar: _initials(r.name), empId: r.empId, photo: r.photo || null,
  }));
}

// ── Préstamos (descuento automático en nómina) ────────────────
const LOAN_KEY = 'dtd_nomina_loans_v26';
const LOAN_SEED = [
  { id: 'loan-1', empId: 'emp-001', monto: 300, cuota: 25, fecha: '2026-04-15', motivo: 'Adelanto personal', pagado: 100, status: 'activo', tenantId: 'dtd' },
  { id: 'loan-2', empId: 'emp-005', monto: 150, cuota: 15, fecha: '2026-05-02', motivo: 'Emergencia médica', pagado: 30, status: 'activo', tenantId: 'dtd' },
];
function _loadLoans() { try { const v = localStorage.getItem(LOAN_KEY); return v === null ? LOAN_SEED.slice() : (JSON.parse(v) || []); } catch (e) { return LOAN_SEED.slice(); } }
function _saveLoans(a) { try { localStorage.setItem(LOAN_KEY, JSON.stringify(a)); } catch (e) {} window.dispatchEvent(new CustomEvent('dtd-nomina-changed')); }
function allLoans() { return _loadLoans().filter(_inTenant); }
function loansFor(empId) { return allLoans().filter(l => l.empId === empId); }
function loanBalance(l) { return Math.max(0, Math.round((Number(l.monto) - Number(l.pagado || 0)) * 100) / 100); }
function activeLoansFor(empId) { return loansFor(empId).filter(l => l.status === 'activo' && loanBalance(l) > 0); }
function activeLoanCuota(empId) { return activeLoansFor(empId).reduce((s, l) => s + Math.min(Number(l.cuota) || 0, loanBalance(l)), 0); }
function createLoan(loan) {
  const a = _loadLoans();
  a.unshift({ id: 'loan-' + Date.now(), pagado: 0, status: 'activo', fecha: _nowStr().slice(0, 10), motivo: '', tenantId: _curTenant(), ...loan, monto: Number(loan.monto) || 0, cuota: Number(loan.cuota) || 0 });
  _saveLoans(a);
}
function registerLoanPayment(id, amount) {
  _saveLoans(_loadLoans().map(l => {
    if (l.id !== id) return l;
    const pagado = Math.min(Number(l.monto), Math.round((Number(l.pagado || 0) + (Number(amount) || 0)) * 100) / 100);
    return { ...l, pagado, status: pagado >= Number(l.monto) ? 'saldado' : 'activo' };
  }));
}
function cancelLoan(id) { _saveLoans(_loadLoans().map(l => l.id === id ? { ...l, status: 'saldado', pagado: l.monto } : l)); }

// ── Liquidación / desvinculación (LOTTT) · legal vs contingente ─
// Legal: sobre el SALARIO BASE. Contingente: sobre el INGRESO REAL
// (base + bono voluntario + no salariales) — la exposición si un
// tribunal reclasifica los bonos como salario.
const LIQ_CAUSAS = {
  art76: { label: 'Mutuo acuerdo', art: 'Art. 76', indemn: false },
  art78: { label: 'Renuncia', art: 'Art. 78', indemn: false },
  art79: { label: 'Despido justificado', art: 'Art. 79', indemn: false },
  art92: { label: 'Despido injustificado', art: 'Art. 92', indemn: true },
};
function calcLiquidacion(emp, opts) {
  opts = opts || {};
  const R = loadRules();
  const rate = Number(opts.rate) || 1;
  const start = new Date((emp.startDate || '2024-01-15') + 'T00:00:00');
  const end = new Date((opts.fechaEgreso || new Date().toISOString().slice(0, 10)) + 'T00:00:00');
  const dias = Math.max(0, (end - start) / 86400000);
  const years = dias / 365.25;
  const fullYears = Math.floor(years);
  const months = dias / 30.44;
  const fracMonths = Math.max(0, Math.round(months - fullYears * 12));
  const fracYear = Math.min(1, Math.max(0, (months - fullYears * 12) / 12));
  const causa = LIQ_CAUSAS[opts.causa] || LIQ_CAUSAS.art76;

  const baseMensual = Number(emp.salarioUsd) || 0;
  const bonoVol = Number(opts.bonoVoluntario != null ? opts.bonoVoluntario : 40) || 0;
  const noSalUsd = ((Number(R.cestaticketBs) || 0) + (Number(R.bonoGuerraBs) || 0)) / rate;
  const realMensual = baseMensual + bonoVol + noSalUsd;
  const baseDia = baseMensual / 30;
  const realDia = realMensual / 30;

  const garantiaDias = Math.floor(months / 3) * (Number(R.garantiaTrimestralDias) || 15) + Math.max(0, fullYears - 1) * (Number(R.diasAdicXAnio) || 2);
  const retroDias = years * 30;
  const prestDias = R.prestacionesMetodo === 'garantia' ? garantiaDias : R.prestacionesMetodo === 'retroactivo' ? retroDias : Math.max(garantiaDias, retroDias);
  const vacAnio = Math.min((Number(R.vacacionesDias) || 15) + fullYears * (Number(R.vacacionesAdicXAnio) || 1), Number(R.vacacionesTope) || 30);
  const vacDias = vacAnio * fracYear;
  const bonoVacDias = (Number(R.bonoVacacionalDias) || 15) * fracYear;
  const utilDias = (Number(R.utilidadesDiasMin) || 30) * fracYear;

  const rows = [
    { concepto: 'Prestaciones sociales', sub: R.prestacionesMetodo === 'mayor' ? 'el mayor (garantía vs retroactivo)' : R.prestacionesMetodo, dias: prestDias },
    { concepto: 'Vacaciones fraccionadas', sub: `${vacAnio} días/año · ${fracMonths} m`, dias: vacDias },
    { concepto: 'Bono vacacional fraccionado', sub: `${R.bonoVacacionalDias} días/año`, dias: bonoVacDias },
    { concepto: 'Utilidades fraccionadas', sub: `${R.utilidadesDiasMin} días/año`, dias: utilDias },
  ];
  if (causa.indemn) rows.push({ concepto: 'Indemnización Art. 92', sub: 'igual a prestaciones', dias: prestDias });
  rows.forEach(r => { r.legal = Math.round(r.dias * baseDia * 100) / 100; r.cont = Math.round(r.dias * realDia * 100) / 100; });

  const totLegal = Math.round(rows.reduce((s, r) => s + r.legal, 0) * 100) / 100;
  const totCont = Math.round(rows.reduce((s, r) => s + r.cont, 0) * 100) / 100;
  const exposicion = Math.round((totCont - totLegal) * 100) / 100;
  const prestamos = activeLoansFor(emp.id).reduce((s, l) => s + loanBalance(l), 0);
  const netoLegal = Math.round((totLegal - prestamos) * 100) / 100;
  const netoCont = Math.round((totCont - prestamos) * 100) / 100;

  return { causa, years, fullYears, fracMonths, baseMensual, realMensual, baseDia, realDia, rows, totLegal, totCont, exposicion, prestamos, netoLegal, netoCont };
}

// ── Asistencia / calendario ───────────────────────────────────
const ATT_KEY = 'dtd_nomina_att_v26';
const ATT_STATES = {
  trabajado: { label: 'Trabajado', tone: 'success', short: 'T' },
  ausente:   { label: 'Ausente', tone: 'danger', short: 'A' },
  libre:     { label: 'Libre', tone: 'neutral', short: 'L' },
  feriado:   { label: 'Feriado trabajado', tone: 'info', short: 'F' },
};
function _loadAtt() { try { return JSON.parse(localStorage.getItem(ATT_KEY)) || {}; } catch (e) { return {}; } }
function _saveAtt(o) { try { localStorage.setItem(ATT_KEY, JSON.stringify(o)); } catch (e) {} window.dispatchEvent(new CustomEvent('dtd-nomina-changed')); }
function attDefaultEstado(dateISO) { const wd = new Date(dateISO + 'T00:00:00').getDay(); return (wd === 0 || wd === 6) ? 'libre' : 'trabajado'; }
function getAtt(empId, dateISO) { const r = (_loadAtt()[empId] || {})[dateISO]; return r || { estado: attDefaultEstado(dateISO), extra: 0, resta: 0 }; }
function setAtt(empId, dateISO, patch) {
  const o = _loadAtt(); o[empId] = o[empId] || {};
  const cur = o[empId][dateISO] || { estado: attDefaultEstado(dateISO), extra: 0, resta: 0 };
  o[empId][dateISO] = { ...cur, ...patch }; _saveAtt(o);
}
function attMonth(empId, y, m) {
  const days = new Date(y, m + 1, 0).getDate(); const out = [];
  for (let d = 1; d <= days; d++) { const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; out.push({ date: iso, day: d, ...getAtt(empId, iso) }); }
  return out;
}
function attSummary(empId, y, m) {
  const days = attMonth(empId, y, m);
  return {
    trabajado: days.filter(x => x.estado === 'trabajado').length,
    ausente: days.filter(x => x.estado === 'ausente').length,
    libre: days.filter(x => x.estado === 'libre').length,
    feriado: days.filter(x => x.estado === 'feriado').length,
    extra: days.reduce((s, x) => s + (Number(x.extra) || 0), 0),
    resta: days.reduce((s, x) => s + (Number(x.resta) || 0), 0),
  };
}

// ── Feriados (nacionales VE + propios) ────────────────────────
const FERIADOS_KEY = 'dtd_nomina_feriados_v26';
const FERIADOS_SEED = [
  { date: '2026-01-01', name: 'Año Nuevo', nac: true },
  { date: '2026-02-16', name: 'Lunes de Carnaval', nac: true },
  { date: '2026-02-17', name: 'Martes de Carnaval', nac: true },
  { date: '2026-04-02', name: 'Jueves Santo', nac: true },
  { date: '2026-04-03', name: 'Viernes Santo', nac: true },
  { date: '2026-04-19', name: 'Firma del Acta de Independencia', nac: true },
  { date: '2026-05-01', name: 'Día del Trabajador', nac: true },
  { date: '2026-06-24', name: 'Batalla de Carabobo', nac: true },
  { date: '2026-07-05', name: 'Día de la Independencia', nac: true },
  { date: '2026-07-24', name: 'Natalicio de Bolívar', nac: true },
  { date: '2026-10-12', name: 'Día de la Resistencia Indígena', nac: true },
  { date: '2026-12-24', name: 'Nochebuena', nac: true },
  { date: '2026-12-25', name: 'Navidad', nac: true },
  { date: '2026-12-31', name: 'Fin de Año', nac: true },
];
function feriados() {
  let added = [], removed = [];
  try { const o = JSON.parse(localStorage.getItem(FERIADOS_KEY)) || {}; added = o.added || []; removed = o.removed || []; } catch (e) {}
  return FERIADOS_SEED.concat(added).filter(f => !removed.includes(f.date)).sort((a, b) => a.date.localeCompare(b.date));
}
function feriadoOn(dateISO) { return feriados().find(f => f.date === dateISO) || null; }
function _saveFeriados(o) { try { localStorage.setItem(FERIADOS_KEY, JSON.stringify(o)); } catch (e) {} window.dispatchEvent(new CustomEvent('dtd-nomina-changed')); }
function addFeriado(date, name) {
  let o = {}; try { o = JSON.parse(localStorage.getItem(FERIADOS_KEY)) || {}; } catch (e) {}
  o.added = (o.added || []).filter(f => f.date !== date); o.added.push({ date, name, nac: false });
  o.removed = (o.removed || []).filter(d => d !== date);
  _saveFeriados(o);
}
function removeFeriado(date) {
  let o = {}; try { o = JSON.parse(localStorage.getItem(FERIADOS_KEY)) || {}; } catch (e) {}
  o.added = (o.added || []).filter(f => f.date !== date);
  o.removed = (o.removed || []); if (!o.removed.includes(date)) o.removed.push(date);
  _saveFeriados(o);
}

// ── Servicios / prestadores (pagos por sesión a freelance) ────
const PREST_KEY = 'dtd_nomina_prest_v26';
const PREST_PAY_KEY = 'dtd_nomina_prestpay_v26';
const PREST_SEED = [
  { id: 'pr-1', name: 'María Tovar', servicio: 'Limpieza / doméstica', phone: '+58 412 1102233', tarifa: 15, tenantId: 'dtd' },
  { id: 'pr-2', name: 'Jesús Marcano', servicio: 'Plomería', phone: '+58 414 5567788', tarifa: 30, tenantId: 'dtd' },
  { id: 'pr-3', name: 'Eduardo Rangel', servicio: 'Electricidad', phone: '+58 424 9988776', tarifa: 35, tenantId: 'dtd' },
];
const PREST_PAY_SEED = [
  { id: 'pp-1', prestId: 'pr-1', fecha: '2026-05-20', concepto: 'Limpieza oficina (jornada)', monto: 15, tenantId: 'dtd' },
  { id: 'pp-2', prestId: 'pr-2', fecha: '2026-05-12', concepto: 'Reparación de baño', monto: 30, tenantId: 'dtd' },
];
function _load(k, seed) { try { const v = localStorage.getItem(k); return v === null ? seed.slice() : (JSON.parse(v) || []); } catch (e) { return seed.slice(); } }
function _save(k, a) { try { localStorage.setItem(k, JSON.stringify(a)); } catch (e) {} window.dispatchEvent(new CustomEvent('dtd-nomina-changed')); }
function prestadores() { return _load(PREST_KEY, PREST_SEED).filter(_inTenant); }
function createPrestador(p) { const a = _load(PREST_KEY, PREST_SEED); a.unshift({ id: 'pr-' + Date.now(), tarifa: 0, tenantId: _curTenant(), ...p, tarifa: Number(p.tarifa) || 0 }); _save(PREST_KEY, a); }
function prestPagos() { return _load(PREST_PAY_KEY, PREST_PAY_SEED).filter(_inTenant).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))); }
function createPrestPago(p) { const a = _load(PREST_PAY_KEY, PREST_PAY_SEED); a.unshift({ id: 'pp-' + Date.now(), fecha: new Date().toISOString().slice(0, 10), tenantId: _curTenant(), ...p, monto: Number(p.monto) || 0 }); _save(PREST_PAY_KEY, a); }

// ── Estado del corte de nómina (borrador → confirmado → pagado) ─
const PERIOD_STATUS_KEY = 'dtd_nomina_pstatus_v26';
function getPeriodStatus(label) { try { return (JSON.parse(localStorage.getItem(PERIOD_STATUS_KEY)) || {})[label] || { status: 'borrador', comprobante: null }; } catch (e) { return { status: 'borrador', comprobante: null }; } }
function setPeriodStatus(label, patch) {
  let o = {}; try { o = JSON.parse(localStorage.getItem(PERIOD_STATUS_KEY)) || {}; } catch (e) {}
  o[label] = { ...(o[label] || { status: 'borrador', comprobante: null }), ...patch };
  try { localStorage.setItem(PERIOD_STATUS_KEY, JSON.stringify(o)); } catch (e) {} window.dispatchEvent(new CustomEvent('dtd-nomina-changed'));
}

window.NominaData = {
  NOMINA_RATES, NOMINA_COA, EMPLOYEES, EMP_SEED,
  NOMINA_RULES_DEFAULTS, loadRules, saveRules, resetRules, rulesDiff,
  feriados, feriadoOn, addFeriado, removeFeriado,
  prestadores, createPrestador, prestPagos, createPrestPago, getPeriodStatus, setPeriodStatus,
  createEmployee, updateEmployee, setEmployeeActive, createEmployeeReturning,
  calcRecibo, totalCobrarVes, payrollRows, payrollTotals, buildPayrollEntry,
  payrollRuns, recordPayrollRun,
  reciboWhatsApp, waLink, waPhone,
  reciboHtml, finiquitoHtml, printDoc,
  COMM_TYPES, commsFor, allComms, createComm, markComm, commWhatsApp, commWaLink,
  VE_BANKS, CUENTA_TIPOS,
  regLinks, regLinkByToken, regLinkUrl, createRegLink, revokeRegLink,
  allRegs, pendingRegs, regById, submitRegistration, approveRegistration, rejectRegistration, empLogins,
  allLoans, loansFor, loanBalance, activeLoansFor, activeLoanCuota, createLoan, registerLoanPayment, cancelLoan,
  LIQ_CAUSAS, calcLiquidacion,
  ATT_STATES, getAtt, setAtt, attMonth, attSummary,
};
