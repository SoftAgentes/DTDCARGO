/* ── Packing List + Factura (2 en 1) · DTD-Cargo ───────────────────
   Documento proveedor → DTD. Bilingüe 中文 / Español. Totales auto.
   Persistencia en localStorage('dtd-packlist'). */
(function () {
  'use strict';

  function isoToday() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  const FIELDS = ['brand','code','zh','es','hs','carton','ctns','perctn','unit','wkg','cbm'];
  function emptyRow() { return { brand:'', code:'', zh:'', es:'', hs:'', carton:'', ctns:'', perctn:'', unit:'', wkg:'', cbm:'' }; }

  const DEFAULTS = {
    folio: 'DTD-2026-0001',
    empresa: '', mark: 'DTD-', cliente: '', email: '', wechat: '', fecha: isoToday(),
    contacto: '吴小姐 (Srta. Wu)', tel: '18606891419',
    currency: 'USD',
    rows: [emptyRow(), emptyRow(), emptyRow()]
  };

  let state = load();
  function load() {
    try { const r = localStorage.getItem('dtd-packlist'); if (r) return Object.assign({}, DEFAULTS, JSON.parse(r)); } catch (e) {}
    return JSON.parse(JSON.stringify(DEFAULTS));
  }
  function save() { try { localStorage.setItem('dtd-packlist', JSON.stringify(state)); } catch (e) {} }

  // ── calculator-style numeric eval (32+1 → 33) ──
  function num(v) {
    if (v == null || v === '') return 0;
    const s = String(v).trim();
    if (/^[-+]?[\d.\s+\-*/]+$/.test(s) && /[+\-*/]/.test(s.replace(/^[-+]/, ''))) {
      try { const r = Function('"use strict";return (' + s + ')')(); if (isFinite(r)) return r; } catch (e) {}
    }
    const f = parseFloat(s.replace(/,/g, '.'));
    return isFinite(f) ? f : 0;
  }
  const fmtInt = n => (Math.round(n * 100) / 100).toLocaleString('es-VE', { maximumFractionDigits: 2 });
  const fmtMoney = n => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtW = n => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  const fmtCbm = n => n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 4 });

  function rowCalc(r) {
    const ctns = num(r.ctns), perctn = num(r.perctn), unit = num(r.unit), wkg = num(r.wkg), cbm = num(r.cbm);
    const qty = ctns * perctn;
    return { qty, amount: qty * unit, weight: ctns * wkg, vol: ctns * cbm };
  }
  function totals() {
    let ctns = 0, qty = 0, amount = 0, weight = 0, vol = 0;
    state.rows.forEach(r => { const c = rowCalc(r); ctns += num(r.ctns); qty += c.qty; amount += c.amount; weight += c.weight; vol += c.vol; });
    return { ctns, qty, amount, weight, vol };
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }

  // ── render goods rows ──
  function renderRows() {
    const tb = document.getElementById('rows');
    tb.innerHTML = state.rows.map((r, i) => {
      const c = rowCalc(r);
      const inp = (f, cls) => '<input class="cell ' + (cls||'') + '" data-i="' + i + '" data-f="' + f + '" value="' + esc(r[f]) + '">';
      return '<tr>' +
        '<td class="c-idx">' + (i + 1) + '</td>' +
        '<td>' + inp('brand') + '</td>' +
        '<td>' + inp('code','mono') + '</td>' +
        '<td>' + inp('zh','zh') + '</td>' +
        '<td>' + inp('es') + '</td>' +
        '<td>' + inp('hs','mono') + '</td>' +
        '<td>' + inp('carton','mono num') + '</td>' +
        '<td>' + inp('ctns','num') + '</td>' +
        '<td>' + inp('perctn','num') + '</td>' +
        '<td class="calc" data-c="qty-' + i + '">' + fmtInt(c.qty) + '</td>' +
        '<td>' + inp('unit','num') + '</td>' +
        '<td class="calc" data-c="amount-' + i + '">' + fmtMoney(c.amount) + '</td>' +
        '<td>' + inp('wkg','num') + '</td>' +
        '<td class="calc" data-c="weight-' + i + '">' + fmtW(c.weight) + '</td>' +
        '<td>' + inp('cbm','num') + '</td>' +
        '<td class="calc" data-c="vol-' + i + '">' + fmtCbm(c.vol) + '</td>' +
        '<td class="c-del"><button class="rowdel" data-del="' + i + '" title="Eliminar fila">×</button></td>' +
      '</tr>';
    }).join('');
    bindCells();
    renderTotals();
  }

  function renderTotals() {
    const t = totals();
    document.getElementById('t-ctns').textContent = fmtInt(t.ctns);
    document.getElementById('t-qty').textContent = fmtInt(t.qty);
    document.getElementById('t-amount').textContent = state.currency + ' ' + fmtMoney(t.amount);
    document.getElementById('t-weight').textContent = fmtW(t.weight) + ' kg';
    document.getElementById('t-vol').textContent = fmtCbm(t.vol) + ' m³';
    document.getElementById('cur-label').textContent = state.currency;
  }

  function bindCells() {
    document.querySelectorAll('#rows .cell').forEach(el => {
      el.addEventListener('input', () => {
        const i = +el.dataset.i, f = el.dataset.f;
        state.rows[i][f] = el.value; save();
        const c = rowCalc(state.rows[i]);
        const set = (k, v) => { const t = document.querySelector('[data-c="' + k + '-' + i + '"]'); if (t) t.textContent = v; };
        set('qty', fmtInt(c.qty)); set('amount', fmtMoney(c.amount)); set('weight', fmtW(c.weight)); set('vol', fmtCbm(c.vol));
        renderTotals();
      });
    });
    document.querySelectorAll('#rows .rowdel').forEach(b => {
      b.addEventListener('click', () => {
        const i = +b.dataset.del;
        if (state.rows.length <= 1) state.rows = [emptyRow()];
        else state.rows.splice(i, 1);
        save(); renderRows();
      });
    });
  }

  // ── header / supplier fields ──
  function bindField(id, key) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = state[key];
    el.addEventListener('input', () => { state[key] = el.value; save(); if (key === 'contacto' || key === 'tel') renderRule(); if (key === 'mark') renderMark(); });
  }
  function renderRule() {
    const el = document.getElementById('rule-contact');
    if (el) el.textContent = state.contacto + ' · ' + state.tel;
  }
  function renderMark() {
    const el = document.getElementById('sm-mark-mirror');
    if (el) el.textContent = state.mark || 'DTD-____';
  }

  function init() {
    [['f-folio','folio'],['f-empresa','empresa'],['f-mark','mark'],['f-cliente','cliente'],
     ['f-email','email'],['f-wechat','wechat'],['f-fecha','fecha'],['f-contacto','contacto'],['f-tel','tel']]
      .forEach(([id, k]) => bindField(id, k));

    const cur = document.getElementById('f-currency');
    if (cur) { cur.value = state.currency; cur.addEventListener('change', () => { state.currency = cur.value; save(); renderTotals(); }); }

    document.getElementById('add-row').addEventListener('click', () => { state.rows.push(emptyRow()); save(); renderRows(); });
    document.getElementById('add-5').addEventListener('click', () => { for (let k=0;k<5;k++) state.rows.push(emptyRow()); save(); renderRows(); });
    document.getElementById('btn-print').addEventListener('click', () => window.print());
    document.getElementById('btn-reset').addEventListener('click', () => {
      if (confirm('¿Vaciar el documento? / 清空文档？')) { state = JSON.parse(JSON.stringify(DEFAULTS)); save(); location.reload(); }
    });

    renderRule();
    renderMark();
    renderRows();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
