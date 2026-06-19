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
  function emptyRow() { return { brand:'', code:'', zh:'', es:'', hs:'', carton:'', ctns:'', perctn:'', unit:'', wkg:'', cbm:'', same:false, qtyDirect:'' }; }

  const DEFAULTS = {
    folio: 'DTD-2026-0001',
    empresa: '义乌市林冠进出口有限公司', mark: 'DTD-', cliente: '', clienteTel: '', clienteEmail: '', email: 'candywu@ywlgcanopy.com', wechat: '', direccion: '', ciudad: '义乌 / Yiwu', fecha: isoToday(),
    contacto: '吴小姐 (Srta. Wu)', tel: '18606891419',
    currency: 'USD',
    lang: 'en',
    files: [],
    photos: [],
    rows: [emptyRow(), emptyRow(), emptyRow()]
  };

  let state = load();
  function load() {
    try { const r = localStorage.getItem('dtd-packlist'); if (r) return Object.assign({}, DEFAULTS, JSON.parse(r)); } catch (e) {}
    return JSON.parse(JSON.stringify(DEFAULTS));
  }
  function save() { try { localStorage.setItem('dtd-packlist', JSON.stringify(state)); } catch (e) {} }

  // ── autoguardado + mini historial ──
  const HKEY = 'dtd-packlist-history';
  function loadHist() { try { return JSON.parse(localStorage.getItem(HKEY)) || []; } catch (e) { return []; } }
  function saveHist(h) { try { localStorage.setItem(HKEY, JSON.stringify(h)); } catch (e) {} }
  function fmtTs(ts) { const d = new Date(ts); return d.toLocaleString('es-VE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
  function snapshot(label) {
    const h = loadHist(); const data = JSON.stringify(state);
    if (h.length && h[0].data === data) return;
    h.unshift({ t: Date.now(), label: label || '', data }); if (h.length > 12) h.length = 12; saveHist(h);
  }
  function flashStatus(txt) { const el = document.getElementById('save-status'); if (el) { el.textContent = txt; el.classList.add('ok'); } }
  function renderHistory() {
    const p = document.getElementById('history-panel'); if (!p) return; const h = loadHist();
    p.innerHTML = '<h5>Versiones guardadas / 历史版本 (' + h.length + ')</h5>' +
      (h.length ? h.map((s, i) => '<div class="hitem"><span>' + fmtTs(s.t) + (s.label ? ' · ' + s.label : '') + '</span><button data-rest="' + i + '">Restaurar</button></div>').join('')
                : '<div style="font:500 12px var(--f-sans);color:var(--ink-mute);padding:6px">Sin versiones aún / 暂无</div>');
    p.querySelectorAll('[data-rest]').forEach(b => b.addEventListener('click', () => {
      const s = loadHist()[+b.dataset.rest]; if (s) { state = Object.assign({}, DEFAULTS, JSON.parse(s.data)); save(); location.reload(); }
    }));
  }

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
    const unit = num(r.unit);
    if (r.same) { const qty = num(r.qtyDirect); return { qty, amount: qty * unit, weight: 0, vol: 0 }; }
    const ctns = num(r.ctns), perctn = num(r.perctn), wkg = num(r.wkg), cbm = num(r.cbm);
    const qty = ctns * perctn;
    return { qty, amount: qty * unit, weight: ctns * wkg, vol: ctns * cbm };
  }
  function totals() {
    let ctns = 0, qty = 0, amount = 0, weight = 0, vol = 0;
    state.rows.forEach(r => { const c = rowCalc(r); if (!r.same) ctns += num(r.ctns); qty += c.qty; amount += c.amount; weight += c.weight; vol += c.vol; });
    return { ctns, qty, amount, weight, vol };
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }

  // ── agrupación por caja: la fila líder suma sus sub-ítems (filas .same) ──
  function leadOf(i) { while (i > 0 && state.rows[i] && state.rows[i].same) i--; return i; }
  function groupSum(lead) {
    const c0 = rowCalc(state.rows[lead]); let q = c0.qty, a = c0.amount, j = lead + 1;
    while (j < state.rows.length && state.rows[j].same) { const c = rowCalc(state.rows[j]); q += c.qty; a += c.amount; j++; }
    return { q, a };
  }

  const expanded = new Set();
  function applyCollapse() {
    document.querySelectorAll('#rows tr.child').forEach(tr => { tr.style.display = expanded.has(+tr.dataset.parent) ? '' : 'none'; });
    document.querySelectorAll('#rows .grpTog').forEach(b => b.classList.toggle('open', expanded.has(+b.dataset.lead)));
  }

  // ── render goods rows ──
  function renderRows() {
    const tb = document.getElementById('rows');
    tb.innerHTML = state.rows.map((r, i) => {
      const c = rowCalc(r);
      const gq = r.same ? c.qty : groupSum(i).q;
      const ga = r.same ? c.amount : groupSum(i).a;
      let childCount = 0; if (!r.same) { let k = i + 1; while (k < state.rows.length && state.rows[k].same) { childCount++; k++; } }
      const inp = (f, cls) => '<input class="cell ' + (cls||'') + '" data-i="' + i + '" data-f="' + f + '" value="' + esc(r[f]) + '">';
      const off = (f, cls) => '<input class="cell off ' + (cls||'') + '" data-i="' + i + '" data-f="' + f + '" value="' + esc(r[f]) + '" readonly tabindex="-1" title="Va en la fila líder de la caja / 填在本箱首行">';
      const qtyCell = r.same
        ? '<td>' + inp('qtyDirect','num') + '</td>'
        : '<td class="calc" data-c="qty-' + i + '">' + fmtInt(gq) + '</td>';
      return '<tr' + (r.same ? ' class="rsame child" data-parent="' + leadOf(i) + '"' : '') + '>' +
        '<td class="c-idx">' + (r.same ? '<span class="grp">\u2937</span>' : ((i + 1) + (childCount > 0 ? '<button class="grpTog" data-lead="' + i + '" title="Abrir / cerrar ítems de esta caja"><span class="chev"></span><span class="cnt">+' + childCount + '</span></button>' : ''))) + '</td>' +
        '<td>' + inp('brand') + '</td>' +
        '<td>' + inp('code','mono') + '</td>' +
        '<td>' + inp('zh','zh') + '</td>' +
        '<td>' + inp('es') + '</td>' +
        '<td>' + inp('hs','mono') + '</td>' +
        '<td class="calc cn" data-cn="' + i + '"></td>' +
        '<td>' + (r.same ? off('ctns','num') : inp('ctns','num')) + '</td>' +
        '<td>' + (r.same ? off('perctn','num') : inp('perctn','num')) + '</td>' +
        qtyCell +
        '<td>' + inp('unit','num') + '</td>' +
        '<td class="calc" data-c="amount-' + i + '">' + fmtMoney(ga) + '</td>' +
        '<td>' + (r.same ? off('wkg','num') : inp('wkg','num')) + '</td>' +
        '<td class="calc" data-c="weight-' + i + '">' + fmtW(c.weight) + '</td>' +
        '<td>' + (r.same ? off('cbm','num') : inp('cbm','num')) + '</td>' +
        '<td class="calc" data-c="vol-' + i + '">' + fmtCbm(c.vol) + '</td>' +
        '<td class="c-act"><button class="rowadd" data-add="' + i + '" title="Agregar ítem en esta caja / 同箱加货">+</button><button class="rowdel" data-del="' + i + '" title="Eliminar fila">\u00d7</button></td>' +
      '</tr>';
    }).join('');
    bindCells();
    recalcCartons();
    applyCollapse();
    renderTotals();
  }

  // ── N.º de caja automático (consecutivo por cantidad de cajas) ──
  function recalcCartons() {
    let start = 1, lastRange = '';
    state.rows.forEach((r, i) => {
      const cell = document.querySelector('[data-cn="' + i + '"]');
      if (r.same) { if (cell) cell.textContent = lastRange; return; }
      const n = Math.round(num(r.ctns));
      if (n > 0) { lastRange = (n === 1 ? String(start) : (start + '-' + (start + n - 1))); start += n; }
      else { lastRange = ''; }
      if (cell) cell.textContent = lastRange;
    });
  }

  function renderTotals() {
    const t = totals();
    document.getElementById('t-ctns').textContent = fmtInt(t.ctns);
    document.getElementById('t-qty').textContent = fmtInt(t.qty);
    document.getElementById('t-amount').textContent = state.currency + ' ' + fmtMoney(t.amount);
    document.getElementById('t-weight').textContent = fmtW(t.weight) + ' kg';
    document.getElementById('t-vol').textContent = fmtCbm(t.vol) + ' m³';
    document.getElementById('cur-label').textContent = state.currency;
    const ctnMirror = document.getElementById('sm-ctn-mirror');
    if (ctnMirror) ctnMirror.textContent = fmtInt(t.ctns);
  }

  function bindCells() {
    document.querySelectorAll('#rows .cell').forEach(el => {
      el.addEventListener('input', () => {
        const i = +el.dataset.i, f = el.dataset.f;
        state.rows[i][f] = el.value; save();
        const set = (k, v, idx) => { const t = document.querySelector('[data-c="' + k + '-' + idx + '"]'); if (t) t.textContent = v; };
        // si es sub-ítem, actualiza su propio importe
        if (state.rows[i].same) { const ci = rowCalc(state.rows[i]); set('amount', fmtMoney(ci.amount), i); }
        // recalcula los totales de la caja líder (suma ítem + sub-ítems)
        const lead = leadOf(i); const g = groupSum(lead); const lc = rowCalc(state.rows[lead]);
        set('qty', fmtInt(g.q), lead); set('amount', fmtMoney(g.a), lead);
        set('weight', fmtW(lc.weight), lead); set('vol', fmtCbm(lc.vol), lead);
        recalcCartons();
        renderTotals();
      });
    });
    document.querySelectorAll('#rows .grpTog').forEach(b => b.addEventListener('click', () => {
      const l = +b.dataset.lead; if (expanded.has(l)) expanded.delete(l); else expanded.add(l); applyCollapse();
    }));
    document.querySelectorAll('#rows .rowadd').forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.add; const lead = leadOf(i);
      const row = emptyRow(); row.same = true;
      state.rows.splice(i + 1, 0, row); expanded.add(lead); save(); renderRows();
    }));
    document.querySelectorAll('#rows .samechk').forEach(ch => ch.addEventListener('change', () => {
      const i = +ch.dataset.i; state.rows[i].same = ch.checked; save(); renderRows();
    }));
    document.querySelectorAll('#rows .rowdel').forEach(b => {
      b.addEventListener('click', () => {
        const i = +b.dataset.del; const r = state.rows[i];
        const hasData = ['brand','code','zh','es','hs','ctns','perctn','unit','wkg','cbm','qtyDirect'].some(f => String(r[f] == null ? '' : r[f]).trim() !== '');
        const doDelete = () => { if (state.rows.length <= 1) state.rows = [emptyRow()]; else state.rows.splice(i, 1); save(); renderRows(); };
        if (hasData) showConfirm('¿Está seguro que desea eliminar la fila ' + (i + 1) + ' que contiene información?\n确认删除第 ' + (i + 1) + ' 行（含数据）？', doDelete);
        else doDelete();
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
    if (el) { const tel = (state.tel || '').replace(/[^0-9+]/g, ''); el.innerHTML = esc(state.contacto) + ' · <a href="tel:' + tel + '" class="tel-link">' + esc(state.tel) + '</a>'; }
  }
  function renderMark() {
    const el = document.getElementById('sm-mark-mirror');
    if (el) el.textContent = state.mark || 'DTD-____';
  }

  // ── Herramienta de etiquetas Shipping Mark (1/N … N/N por caja) ──
  function qrSvg(text) {
    try { const qr = qrcode(0, 'M'); qr.addData(text); qr.make();
      return qr.createSvgTag({ cellSize: 2, margin: 0, scalable: true }).replace(/#000000/gi, '#0F1E3D'); }
    catch (e) { return ''; }
  }
  function buildLabels() {
    const grid = document.getElementById('labels-grid'); if (!grid) return 0;
    const t = totals(); const n = Math.round(t.ctns);
    const mark = (state.mark && state.mark !== 'DTD-') ? state.mark : 'DTD-____';
    grid.innerHTML = '';
    let idx = 0;
    state.rows.forEach(r => {
      if (r.same) return;
      const ctns = Math.round(num(r.ctns)); if (ctns <= 0) return;
      const itemNo = r.code || '—';
      const pcsCtn = num(r.perctn) ? fmtInt(num(r.perctn)) : '—';
      for (let k = 0; k < ctns; k++) {
        idx++;
        const div = document.createElement('div'); div.className = 'lbl';
        div.innerHTML =
          '<div class="lbl-top"><img class="lbl-iso" src="dtdcargo-isologo-primary.png" alt="DTD"><div class="lbl-qr">' + qrSvg('https://dtdcargo.com/verificar?c=' + encodeURIComponent(mark)) + '</div></div>' +
          '<div class="lbl-row"><span>MARK</span><span class="v">' + esc(mark) + '</span></div>' +
          '<div class="lbl-row"><span>ITEM NO</span><span class="v">' + esc(itemNo) + '</span></div>' +
          '<div class="lbl-row"><span>PCS/CTN</span><span class="v">' + pcsCtn + '</span></div>' +
          '<div class="lbl-row"><span>CARTON NO</span><span class="v">' + idx + ' / ' + n + '</span></div>';
        grid.appendChild(div);
      }
    });
    const cnt = document.getElementById('labels-count');
    if (cnt) cnt.textContent = n + ' × ' + mark;
    return n;
  }
  function openLabels() {
    const n = buildLabels();
    if (n <= 0) { showConfirmInfo('Primero indicá el número de cajas en la tabla (columna 件数/Cajas). · 请先在表格填写箱数。'); return; }
    document.getElementById('labels-sheet').style.display = 'block';
  }

  // ── confirmación gráfica interna (reemplaza confirm() nativo) ──
  function showConfirm(msg, onYes) {
    const m = document.getElementById('confirm-modal'), t = document.getElementById('confirm-text');
    if (!m || !t) { if (window.confirm(msg)) onYes(); return; }
    t.textContent = msg; m.style.display = 'flex';
    const yes = document.getElementById('confirm-yes'), no = document.getElementById('confirm-no');
    const close = () => { m.style.display = 'none'; yes.onclick = null; no.onclick = null; m.onclick = null; };
    yes.onclick = () => { close(); onYes(); };
    no.onclick = close;
    m.onclick = e => { if (e.target === m) close(); };
  }
  function showConfirmInfo(msg) {
    const m = document.getElementById('confirm-modal'), t = document.getElementById('confirm-text');
    if (!m || !t) { window.alert(msg); return; }
    t.textContent = msg; m.style.display = 'flex';
    const yes = document.getElementById('confirm-yes'), no = document.getElementById('confirm-no');
    yes.style.display = 'none'; no.textContent = 'OK / 好';
    const close = () => { m.style.display = 'none'; no.onclick = null; m.onclick = null; yes.style.display = ''; no.textContent = 'Cancelar / 取消'; };
    no.onclick = close; m.onclick = e => { if (e.target === m) close(); };
  }

  // ── Fecha en formato chino 年/月/日 ──
  function renderDateCN() {
    const el = document.getElementById('f-fecha-cn'); if (!el) return;
    const v = state.fecha; if (!v) { el.textContent = ''; return; }
    const p = v.split('-');
    if (p.length === 3) el.textContent = (+p[0]) + '年' + (+p[1]) + '月' + (+p[2]) + '日';
  }

  // ── Cliente reservado (solo DTD) ──
  // ── Descargar Excel vacío (CSV UTF-8 con BOM, abre en Excel) ──
  function downloadXls() {
    const headers = ['品牌/Marca','货号/Código','中文品名','英文品名/Nombre','材质HS/Material','箱号/N.caja','件数/Cajas','每箱装量/Uds caja','单价/P.unit','每箱重 kg','每箱体积 CBM'];
    const lines = [headers.join(',')];
    for (let i = 0; i < 15; i++) lines.push(headers.map(() => '').join(','));
    const csv = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'DTD-PackingList-vacio.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }

  // ── Adjuntos: documentos + fotos de producto (lista única, sin miniaturas) ──
  function addFiles(fileList) {
    [...fileList].forEach(f => {
      if (f.type && f.type.startsWith('image/')) {
        const r = new FileReader();
        r.onload = e => {
          const img = new Image();
          img.onload = () => {
            const max = 1000, sc = Math.min(1, max / Math.max(img.width, img.height));
            const cv = document.createElement('canvas'); cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
            cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
            state.files = state.files || [];
            state.files.push({ name: f.name, kind: 'img', data: cv.toDataURL('image/jpeg', 0.78) });
            save(); renderFiles();
          };
          img.src = e.target.result;
        };
        r.readAsDataURL(f);
      } else {
        state.files = state.files || [];
        state.files.push({ name: f.name, kind: 'doc' });
        save(); renderFiles();
      }
    });
  }

  // ── Adjuntos (documentos + fotos) ──
  let attachOpen = false;
  function renderFiles() {
    const ul = document.getElementById('attach-list'); if (!ul) return;
    const tog = document.getElementById('attach-toggle'), togLbl = document.getElementById('attach-toggle-label');
    const icoDoc = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
    const icoImg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>';
    const files = state.files || [];
    ul.innerHTML = files.map((f, i) => {
      const o = (typeof f === 'string') ? { name: f, kind: 'doc' } : f;
      const isImg = o.kind === 'img' && o.data;
      const label = isImg
        ? '<a class="nm nm-link" href="' + o.data + '" target="_blank" rel="noopener">' + icoImg + esc(o.name) + '</a>'
        : '<span class="nm">' + icoDoc + esc(o.name) + '</span>';
      return '<li>' + label + '<button class="rm" data-rm="' + i + '" title="Quitar">×</button></li>';
    }).join('');
    ul.querySelectorAll('.rm').forEach(b => b.addEventListener('click', () => {
      state.files.splice(+b.dataset.rm, 1); save(); renderFiles();
    }));
    if (tog && togLbl) {
      if (files.length) {
        tog.style.display = 'inline-flex';
        const imgs = files.filter(f => (typeof f !== 'string') && f.kind === 'img').length;
        const docs = files.length - imgs;
        togLbl.textContent = files.length + ' 附件 / attached' + (imgs ? ' (' + docs + ' doc · ' + imgs + ' 📷)' : '');
        tog.classList.toggle('open', attachOpen);
        ul.style.display = attachOpen ? 'flex' : 'none';
      } else {
        tog.style.display = 'none'; ul.style.display = 'none';
      }
    }
  }

  // ── Documento bilingüe 中文 / English (idioma fijo) ──
  function setLang(lang) {
    document.querySelectorAll('.i18n').forEach(el => { const v = el.dataset[lang]; if (v != null) el.textContent = v; });
    document.querySelectorAll('.i18n-h').forEach(el => { const v = el.dataset[lang]; if (v != null) el.innerHTML = v; });
    renderRule(); renderMark();
  }

  function init() {
    [['f-folio','folio'],['f-empresa','empresa'],['f-mark','mark'],['f-cliente','cliente'],['f-cliente-tel','clienteTel'],
     ['f-email','email'],['f-wechat','wechat'],['f-direccion','direccion'],['f-ciudad','ciudad'],['f-cliente-email','clienteEmail'],['f-fecha','fecha']]
      .forEach(([id, k]) => bindField(id, k));

    const cur = document.getElementById('f-currency');
    if (cur) { cur.value = state.currency; cur.addEventListener('change', () => { state.currency = cur.value; save(); renderTotals(); }); }

    renderDateCN();
    const fch = document.getElementById('f-fecha');
    if (fch) fch.addEventListener('input', renderDateCN);
    const fbtn = document.getElementById('f-fecha-btn');
    if (fbtn && fch) fbtn.addEventListener('click', () => { try { fch.showPicker(); } catch (e) { fch.focus(); fch.click(); } });
    renderFiles();
    const xls = document.getElementById('btn-xls'); if (xls) xls.addEventListener('click', downloadXls);
    const att = document.getElementById('btn-attach'), fin = document.getElementById('f-files');
    if (att && fin) {
      att.addEventListener('click', () => fin.click());
      ['dragenter','dragover'].forEach(ev => att.addEventListener(ev, e => { e.preventDefault(); att.classList.add('drag'); }));
      ['dragleave','drop'].forEach(ev => att.addEventListener(ev, e => { e.preventDefault(); att.classList.remove('drag'); }));
      att.addEventListener('drop', e => { if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files); });
      fin.addEventListener('change', () => { addFiles(fin.files); fin.value = ''; });
    }
    const aTog = document.getElementById('attach-toggle');
    if (aTog) aTog.addEventListener('click', () => { attachOpen = !attachOpen; renderFiles(); });

    document.getElementById('add-row').addEventListener('click', () => { state.rows.push(emptyRow()); save(); renderRows(); });
    document.getElementById('add-5').addEventListener('click', () => { for (let k=0;k<5;k++) state.rows.push(emptyRow()); save(); renderRows(); });
    document.getElementById('btn-print').addEventListener('click', () => window.print());
    const bLP = document.getElementById('btn-labels-print'), bLpdf = document.getElementById('btn-labels-pdf');
    if (bLP) bLP.addEventListener('click', () => { if (buildLabels() > 0) { document.getElementById('labels-sheet').style.display = 'block'; setTimeout(() => window.print(), 200); } else showConfirmInfo('Primero indicá el número de cajas en la tabla (件数/Cajas). · 请先在表格填写箱数。'); });
    if (bLpdf) bLpdf.addEventListener('click', openLabels);
    const bLclose = document.getElementById('labels-close'), bLdoprint = document.getElementById('labels-do-print');
    if (bLclose) bLclose.addEventListener('click', () => { document.getElementById('labels-sheet').style.display = 'none'; });
    if (bLdoprint) bLdoprint.addEventListener('click', () => window.print());
    const bCopyWh = document.getElementById('btn-copy-wh');
    if (bCopyWh) bCopyWh.addEventListener('click', () => {
      const txt = document.getElementById('wh-body').textContent;
      const done = () => { bCopyWh.classList.add('done'); const o = bCopyWh.innerHTML; bCopyWh.innerHTML = '✓ Copiado / 已复制'; const body = document.getElementById('wh-body'); if (body) { body.classList.remove('flash'); void body.offsetWidth; body.classList.add('flash'); } setTimeout(() => { bCopyWh.classList.remove('done'); bCopyWh.innerHTML = o; }, 1600); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done).catch(() => { fallbackCopy(txt); done(); });
      else { fallbackCopy(txt); done(); }
    });
    function fallbackCopy(txt) { const ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} document.body.removeChild(ta); }
    const bSave = document.getElementById('btn-save');
    if (bSave) bSave.addEventListener('click', () => {
      save(); snapshot('manual'); flashStatus('Guardado ' + fmtTs(Date.now()));
      bSave.classList.add('saved');
      const lbl = bSave.querySelector('.save-label'); const prev = lbl ? lbl.textContent : '';
      if (lbl) lbl.textContent = '✓ Guardado / 已保存';
      setTimeout(() => { bSave.classList.remove('saved'); if (lbl) lbl.textContent = prev; }, 1800);
    });
    const bHist = document.getElementById('btn-history');
    if (bHist) bHist.addEventListener('click', () => { const p = document.getElementById('history-panel'); if (p.style.display === 'none') { renderHistory(); p.style.display = 'block'; } else { p.style.display = 'none'; } });
    setInterval(() => { save(); flashStatus('Autoguardado ' + fmtTs(Date.now())); }, 8000);
    setInterval(() => snapshot('auto'), 60000);
    snapshot('apertura'); flashStatus('Guardado ' + fmtTs(Date.now()));

    renderRule();
    renderMark();
    renderRows();
    setLang('en');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
