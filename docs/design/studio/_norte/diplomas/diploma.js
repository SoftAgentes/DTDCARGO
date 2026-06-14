/* ── Generador de Diplomas · DTD-Cargo ─────────────────────────────
   Vanilla JS. Carga lista de alumnos, navega y genera todos.
   3 variantes: A (minimal asimétrico), B (clásico centrado), C (banda navy).
   Persistencia en localStorage('dtd-diplomas'). */
(function () {
  'use strict';

  const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

  const DEFAULTS = {
    variant: 'A',
    issuer: 'DTD-Cargo · Programa de Formación',
    course: 'Asesoría de Compras en China',
    desc: '',
    hours: '16',
    dateISO: isoToday(),
    place: 'Valencia, Venezuela',
    folioPrefix: 'DTD-2026-',
    folioStart: '1',
    dirName: '',
    dirRole: 'Dirección General',
    insName: '',
    insRole: 'Instructor del programa',
    verifyUrl: 'https://dtdcargo.com/verificar',
    roster: 'María Fernanda Rodríguez\nCarlos Eduardo Pérez\nAndreína Gómez Salazar'
  };

  function isoToday() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function fmtDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return d + ' de ' + MESES[(m - 1) % 12] + ' de ' + y;
  }
  function pad(n, w) { return String(n).padStart(w, '0'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  // ── state ──
  let state = load();
  let idx = 0;

  function load() {
    try {
      const raw = localStorage.getItem('dtd-diplomas');
      if (raw) return Object.assign({}, DEFAULTS, JSON.parse(raw));
    } catch (e) {}
    return Object.assign({}, DEFAULTS);
  }
  function save() {
    try { localStorage.setItem('dtd-diplomas', JSON.stringify(state)); } catch (e) {}
  }

  // ── roster parsing ── lines: "Nombre" or "Nombre | folio"
  function students() {
    const start = parseInt(state.folioStart, 10) || 1;
    return state.roster.split('\n').map(s => s.trim()).filter(Boolean).map((line, i) => {
      let name = line, folio = null;
      const m = line.split('|');
      if (m.length > 1) { name = m[0].trim(); folio = m[1].trim(); }
      if (!folio) folio = state.folioPrefix + pad(start + i, 4);
      return { name, folio };
    });
  }

  // ── QR ──
  function qrSvg(text) {
    try {
      const qr = qrcode(0, 'M');
      qr.addData(text);
      qr.make();
      let svg = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
      svg = svg.replace(/#000000/gi, '#0F1E3D').replace(/fill="black"/gi, 'fill="#0F1E3D"');
      return svg;
    } catch (e) { return ''; }
  }

  // ── reusable bits ──
  function wordmark(theme) {
    return '<span class="wm' + (theme === 'dark' ? ' wm--dark' : '') + '"><span class="wm-d">DTD</span><span class="wm-sp"></span><span class="wm-c">Cargo</span></span>';
  }
  function sealHTML(theme) {
    const dark = theme === 'dark';
    const iso = dark ? 'dtdcargo-isologo-reverse.png' : 'dtdcargo-isologo-primary.png';
    return (
      '<div class="seal' + (dark ? ' seal--dark' : '') + '">' +
        '<svg class="seal-ring" viewBox="0 0 200 200" aria-hidden="true">' +
          '<circle cx="100" cy="100" r="96" fill="none" stroke="var(--seal-stroke)" stroke-width="2"/>' +
          '<circle cx="100" cy="100" r="88" fill="none" stroke="var(--seal-stroke)" stroke-width="1" stroke-dasharray="2 4"/>' +
          '<path id="sealtop" d="M100,100 m -72,0 a 72,72 0 1,1 144,0" fill="none"/>' +
          '<path id="sealbot" d="M100,100 m 72,0 a 72,72 0 1,1 -144,0" fill="none"/>' +
          '<text class="seal-txt"><textPath href="#sealtop" startOffset="50%" text-anchor="middle">CON CONFIANZA · DE CHINA A TU PUERTA</textPath></text>' +
          '<text class="seal-txt"><textPath href="#sealbot" startOffset="50%" text-anchor="middle">· CERTIFICADO OFICIAL · DTD-CARGO ·</textPath></text>' +
        '</svg>' +
        '<img class="seal-iso" src="' + iso + '" alt="" />' +
      '</div>'
    );
  }
  function qrBlock(folio) {
    const url = state.verifyUrl + (state.verifyUrl.indexOf('?') >= 0 ? '&' : '?') + 'c=' + encodeURIComponent(folio);
    return (
      '<div class="qrwrap">' +
        '<div class="qr">' + qrSvg(url) + '</div>' +
        '<div class="qr-cap"><span class="qr-l">Verifica este certificado</span>' +
        '<span class="qr-f">' + esc(folio) + '</span></div>' +
      '</div>'
    );
  }
  function sigBlock(name, role) {
    return (
      '<div class="sig">' +
        (name ? '<div class="sig-nm">' + esc(name) + '</div>' : '<div class="sig-nm sig-nm--empty"></div>') +
        '<div class="sig-line"></div>' +
        '<div class="sig-rl">' + esc(role) + '</div>' +
      '</div>'
    );
  }

  // ── body copy ──
  function bodyCtx(student) {
    return {
      name: student.name,
      folio: student.folio,
      course: state.course,
      hours: state.hours,
      place: state.place,
      date: fmtDate(state.dateISO),
      desc: state.desc.trim(),
      issuer: state.issuer
    };
  }
  function metaLine(c) {
    const parts = [];
    if (c.hours) parts.push('Duración: ' + esc(c.hours) + ' horas');
    if (c.place) parts.push(esc(c.place));
    if (c.date) parts.push(esc(c.date));
    return parts.join('  ·  ');
  }

  // ════════ VARIANTE A · minimal asimétrico ════════
  function variantA(c) {
    return (
      '<div class="diploma v-a">' +
        '<div class="va-top">' +
          '<div class="va-brand">' + wordmark() +
            '<div class="va-issuer">' + esc(c.issuer) + '</div>' +
          '</div>' +
          qrBlock(c.folio) +
        '</div>' +
        '<div class="va-body">' +
          '<div class="va-eyebrow">Diploma de participación</div>' +
          '<div class="va-rule"></div>' +
          '<div class="va-label">Se otorga el presente diploma a</div>' +
          '<h1 class="va-name">' + esc(c.name) + '</h1>' +
          '<p class="va-lead">por haber completado satisfactoriamente el curso de</p>' +
          '<div class="va-course">' + esc(c.course) + '</div>' +
          '<div class="va-meta">' + metaLine(c) + '</div>' +
          (c.desc ? '<p class="va-desc">' + esc(c.desc) + '</p>' : '') +
        '</div>' +
        '<div class="va-foot">' +
          '<div class="sigs">' + sigBlock(state.dirName, state.dirRole) + sigBlock(state.insName, state.insRole) + '</div>' +
          sealHTML() +
        '</div>' +
      '</div>'
    );
  }

  // ════════ VARIANTE B · clásico centrado ════════
  function variantB(c) {
    return (
      '<div class="diploma v-b">' +
        '<div class="vb-frame"></div>' +
        '<div class="vb-inner">' +
          '<img class="vb-iso" src="dtdcargo-isologo-primary.png" alt="" />' +
          '<div class="vb-wm">' + wordmark() + '</div>' +
          '<div class="vb-issuer">' + esc(c.issuer) + '</div>' +
          '<div class="vb-eyebrow">Diploma de participación</div>' +
          '<div class="vb-label">Se otorga el presente diploma a</div>' +
          '<h1 class="vb-name">' + esc(c.name) + '</h1>' +
          '<div class="vb-namerule"></div>' +
          '<p class="vb-lead">por haber completado satisfactoriamente el curso de <b>' + esc(c.course) + '</b>' +
            (c.desc ? '. ' + esc(c.desc) : '') + '</p>' +
          '<div class="vb-meta">' + metaLine(c) + '</div>' +
          '<div class="vb-foot">' +
            sigBlock(state.dirName, state.dirRole) +
            sealHTML() +
            sigBlock(state.insName, state.insRole) +
          '</div>' +
        '</div>' +
        '<div class="vb-corner">' + qrBlock(c.folio) + '</div>' +
      '</div>'
    );
  }

  // ════════ VARIANTE C · banda navy ════════
  function variantC(c) {
    return (
      '<div class="diploma v-c">' +
        '<div class="vc-band">' +
          '<img class="vc-iso" src="dtdcargo-isologo-reverse.png" alt="DTD Cargo" />' +
          '<div class="vc-tag">Con Confianza,<br/>de China a tu puerta.</div>' +
          '<div class="vc-bandfoot">' + qrBlock(c.folio) + '</div>' +
        '</div>' +
        '<div class="vc-main">' +
          '<div class="vc-issuer">' + esc(c.issuer) + '</div>' +
          '<div class="vc-eyebrow">Diploma de participación</div>' +
          '<div class="vc-label">Se otorga el presente diploma a</div>' +
          '<h1 class="vc-name">' + esc(c.name) + '</h1>' +
          '<p class="vc-lead">por haber completado satisfactoriamente el curso de</p>' +
          '<div class="vc-course">' + esc(c.course) + '</div>' +
          '<div class="vc-meta">' + metaLine(c) + '</div>' +
          (c.desc ? '<p class="vc-desc">' + esc(c.desc) + '</p>' : '') +
          '<div class="vc-foot">' +
            '<div class="sigs">' + sigBlock(state.dirName, state.dirRole) + sigBlock(state.insName, state.insRole) + '</div>' +
            sealHTML() +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  // ════════ VARIANTE D · clásico elegante (marco ornamental) ════════
  function ornFrame() {
    return (
      '<svg class="vd-orn" viewBox="0 0 1123 794" preserveAspectRatio="none" aria-hidden="true">' +
        '<rect x="30" y="30" width="1063" height="734" fill="none" stroke="var(--ink)" stroke-width="1.5"/>' +
        '<rect x="40" y="40" width="1043" height="714" fill="none" stroke="var(--wine)" stroke-width="1"/>' +
      '</svg>' +
      cornerMotifs()
    );
  }
  function cornerMotifs() {
    const c = '<svg class="vd-corner" viewBox="0 0 60 60" aria-hidden="true"><path d="M2,30 Q2,2 30,2" fill="none" stroke="var(--wine)" stroke-width="1.5"/><path d="M10,30 Q10,10 30,10" fill="none" stroke="var(--wine-soft)" stroke-width="1"/><circle cx="14" cy="14" r="2.4" fill="var(--wine)"/></svg>';
    return '<div class="vd-c tl">' + c + '</div><div class="vd-c tr">' + c + '</div><div class="vd-c bl">' + c + '</div><div class="vd-c br">' + c + '</div>';
  }
  function flourish() {
    return '<svg class="vd-fl" viewBox="0 0 220 14" aria-hidden="true"><line x1="0" y1="7" x2="92" y2="7" stroke="var(--wine-soft)" stroke-width="1"/><path d="M104,7 l6,-5 6,5 -6,5 z" fill="none" stroke="var(--wine)" stroke-width="1.2"/><circle cx="110" cy="7" r="1.6" fill="var(--wine)"/><line x1="128" y1="7" x2="220" y2="7" stroke="var(--wine-soft)" stroke-width="1"/></svg>';
  }
  function variantD(c) {
    return (
      '<div class="diploma v-d">' +
        ornFrame() +
        '<div class="vd-inner">' +
          '<img class="vd-iso" src="dtdcargo-isologo-primary.png" alt="" />' +
          '<div class="vd-wm">' + wordmark() + '</div>' +
          '<div class="vd-issuer">' + esc(c.issuer) + '</div>' +
          '<div class="vd-eyebrow">' + flourish() + '<span>Diploma de Participación</span>' + flourish() + '</div>' +
          '<div class="vd-label">Se otorga el presente diploma a</div>' +
          '<h1 class="vd-name">' + esc(c.name) + '</h1>' +
          '<p class="vd-lead">por haber completado satisfactoriamente el curso de <b>' + esc(c.course) + '</b>' +
            (c.desc ? '. ' + esc(c.desc) : '') + '</p>' +
          '<div class="vd-meta">' + metaLine(c) + '</div>' +
          '<div class="vd-foot">' +
            sigBlock(state.dirName, state.dirRole) +
            sealHTML() +
            sigBlock(state.insName, state.insRole) +
          '</div>' +
        '</div>' +
        '<div class="vd-corner-qr">' + qrBlock(c.folio) + '</div>' +
      '</div>'
    );
  }

  // ════════ VARIANTE E · navy premium (fondo oscuro) ════════ ELIMINADA

  function renderOne(student) {
    const c = bodyCtx(student);
    if (state.variant === 'B') return variantB(c);
    if (state.variant === 'C') return variantC(c);
    if (state.variant === 'D') return variantD(c);
    return variantA(c);
  }

  // ── live preview ──
  function renderPreview() {
    const list = students();
    if (idx >= list.length) idx = Math.max(0, list.length - 1);
    const stage = document.getElementById('sheet');
    if (!list.length) {
      stage.innerHTML = '<div class="empty">Agregá al menos un alumno en la lista.</div>';
      updateNav(0, 0);
      return;
    }
    stage.innerHTML = renderOne(list[idx]);
    fitStage();
    updateNav(idx + 1, list.length);
  }

  function fitStage() {
    const wrap = document.getElementById('stage');
    const sheet = document.getElementById('sheet');
    const dip = document.querySelector('#sheet .diploma');
    if (!dip) return;
    const pad = 56;
    const s = Math.min((wrap.clientWidth - pad) / 1123, (wrap.clientHeight - pad) / 794);
    dip.style.transformOrigin = 'top left';
    dip.style.transform = 'scale(' + s + ')';
    sheet.style.width = (1123 * s) + 'px';
    sheet.style.height = (794 * s) + 'px';
  }

  function updateNav(cur, total) {
    document.getElementById('counter').textContent = total ? (cur + ' / ' + total) : '0 / 0';
  }

  // ── print ──
  function buildPrint(scope) {
    const list = students();
    const root = document.getElementById('print-root');
    const set = scope === 'current' ? [list[idx]].filter(Boolean) : list;
    root.innerHTML = set.map(st => '<div class="page">' + renderOne(st) + '</div>').join('');
  }
  function printScope(scope) {
    buildPrint(scope);
    document.body.classList.add('printing');
    window.print();
  }
  window.addEventListener('afterprint', () => {
    document.body.classList.remove('printing');
    document.getElementById('print-root').innerHTML = '';
  });

  // ── wiring ──
  function bind(id, key) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = state[key];
    el.addEventListener('input', () => {
      state[key] = el.value;
      save();
      renderPreview();
    });
  }

  function init() {
    if (['A','B','C','D'].indexOf(state.variant) < 0) state.variant = 'A';
    [['f-issuer','issuer'],['f-course','course'],['f-desc','desc'],['f-hours','hours'],
     ['f-date','dateISO'],['f-place','place'],['f-prefix','folioPrefix'],['f-start','folioStart'],
     ['f-dirname','dirName'],['f-dirrole','dirRole'],['f-insname','insName'],['f-insrole','insRole'],
     ['f-verify','verifyUrl'],['f-roster','roster']].forEach(([id, k]) => bind(id, k));

    // variant buttons
    document.querySelectorAll('.vbtn').forEach(b => {
      b.classList.toggle('on', b.dataset.v === state.variant);
      b.addEventListener('click', () => {
        state.variant = b.dataset.v; save();
        document.querySelectorAll('.vbtn').forEach(x => x.classList.toggle('on', x.dataset.v === state.variant));
        renderPreview();
      });
    });

    document.getElementById('prev').addEventListener('click', () => { idx = Math.max(0, idx - 1); renderPreview(); });
    document.getElementById('next').addEventListener('click', () => { idx = Math.min(students().length - 1, idx + 1); renderPreview(); });
    document.getElementById('print-all').addEventListener('click', () => printScope('all'));
    document.getElementById('print-one').addEventListener('click', () => printScope('current'));

    window.addEventListener('resize', fitStage);
    window.addEventListener('beforeprint', () => { if (!document.getElementById('print-root').innerHTML) buildPrint('all'); });

    renderPreview();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
