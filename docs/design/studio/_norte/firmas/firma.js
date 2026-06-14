/* ── Generador de firmas de email · DTD-Cargo ──────────────────────
   Standalone de marca. 3 layouts. Copia HTML enriquecido al portapapeles
   (pegable directo en Gmail/Outlook). Isólogo embebido en base64. */
(function () {
  'use strict';

  const WINE = '#7F0F1A', NAVY = '#0F1E3D', INK = '#0F1E3D', SOFT = '#6B6B6B', MUTE = '#9B9B9B', LINE = '#E8E6E2';
  const FF = "Archivo, 'Helvetica Neue', Arial, sans-serif";
  const FF_BRAND = "'Archivo Black', Archivo, 'Helvetica Neue', Arial, sans-serif";
  const FF_MONO = "'JetBrains Mono', Consolas, monospace";

  const DEFAULTS = {
    layout: 'horizontal',
    name: 'Nombre Apellido',
    role: 'Cargo',
    mobile: '+58 412 000 0000',
    office: '+58 241 414 7886',
    email: 'nombre@dtdcargo.com',
    site: 'dtdcargo.com',
    city: 'Valencia, Venezuela',
    showTagline: true,
    showAddr: true
  };

  let state = load();
  let isoDataUri = '';

  function load() {
    try { const r = localStorage.getItem('dtd-firma'); if (r) return Object.assign({}, DEFAULTS, JSON.parse(r)); } catch (e) {}
    return Object.assign({}, DEFAULTS);
  }
  function save() { try { localStorage.setItem('dtd-firma', JSON.stringify(state)); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }

  const wordmark = (px) => '<span style="font-family:' + FF_BRAND + ';font-weight:900;font-size:' + px + 'px;letter-spacing:-0.02em;">' +
    '<span style="color:' + WINE + ';">DTD</span><span style="display:inline-block;width:0.14em;"></span><span style="color:' + NAVY + ';">Cargo</span></span>';

  const iso = (px) => isoDataUri ? '<img src="' + isoDataUri + '" width="' + px + '" height="' + px + '" alt="DTD Cargo" style="display:block;border:0;width:' + px + 'px;height:' + px + 'px;" />' : '';

  function contactRows(small) {
    const fs = small ? 11.5 : 12.5;
    const r = [];
    r.push('<span style="font-family:' + FF + ';font-size:' + fs + 'px;color:' + SOFT + ';">✉ <a href="mailto:' + esc(state.email) + '" style="color:' + SOFT + ';text-decoration:none;">' + esc(state.email) + '</a></span>');
    const tels = [];
    if (state.mobile) tels.push('<span style="font-family:' + FF_MONO + ';font-size:' + fs + 'px;color:' + SOFT + ';">' + esc(state.mobile) + '</span>');
    if (state.office) tels.push('<span style="font-family:' + FF_MONO + ';font-size:' + fs + 'px;color:' + SOFT + ';">' + esc(state.office) + '</span>');
    return { email: r[0], tels: tels.join('<span style="color:' + MUTE + ';"> · </span>') };
  }

  // ── Layouts (table-based, inline styles for email) ──
  function layoutHorizontal() {
    const c = contactRows(false);
    return '' +
    '<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr>' +
      '<td style="vertical-align:middle;padding-right:18px;">' + iso(58) + '</td>' +
      '<td style="vertical-align:middle;border-left:2px solid ' + WINE + ';padding-left:18px;">' +
        '<div style="font-family:' + FF + ';font-size:16px;font-weight:700;color:' + INK + ';line-height:1.2;">' + esc(state.name) + '</div>' +
        '<div style="font-family:' + FF + ';font-size:12.5px;color:' + WINE + ';font-weight:600;line-height:1.4;margin-bottom:6px;">' + esc(state.role) + '</div>' +
        '<div style="line-height:1.7;">' + c.email + '</div>' +
        (c.tels ? '<div style="line-height:1.7;">' + c.tels + '</div>' : '') +
        '<div style="margin-top:4px;"><a href="https://' + esc(state.site) + '" style="font-family:' + FF_BRAND + ';font-size:10.5px;font-weight:900;color:' + WINE + ';letter-spacing:0.12em;text-decoration:none;text-transform:uppercase;">' + esc(state.site) + '</a></div>' +
      '</td>' +
    '</tr></table>' + footer();
  }

  function layoutCompact() {
    const c = contactRows(true);
    return '' +
    '<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr>' +
      '<td style="vertical-align:middle;padding-right:12px;">' + iso(40) + '</td>' +
      '<td style="vertical-align:middle;">' +
        '<div style="font-family:' + FF + ';font-size:13.5px;line-height:1.3;"><b style="color:' + INK + ';">' + esc(state.name) + '</b> <span style="color:' + MUTE + ';">·</span> <span style="color:' + WINE + ';font-weight:600;">' + esc(state.role) + '</span></div>' +
        '<div style="line-height:1.6;">' + c.email + (c.tels ? '<span style="color:' + MUTE + ';"> · </span>' + c.tels : '') + '</div>' +
        '<div style="font-family:' + FF_BRAND + ';font-size:9.5px;font-weight:900;color:' + WINE + ';letter-spacing:0.14em;text-transform:uppercase;margin-top:2px;">' + esc(state.site) + '</div>' +
      '</td>' +
    '</tr></table>' + footer();
  }

  function layoutCard() {
    const c = contactRows(false);
    return '' +
    '<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border-left:3px solid ' + WINE + ';padding:0;"><tr>' +
      '<td style="padding:2px 0 2px 16px;">' +
        '<div style="margin-bottom:8px;">' + wordmark(18) + '</div>' +
        '<div style="font-family:' + FF + ';font-size:16px;font-weight:700;color:' + INK + ';line-height:1.2;">' + esc(state.name) + '</div>' +
        '<div style="font-family:' + FF + ';font-size:12.5px;color:' + WINE + ';font-weight:600;line-height:1.4;margin-bottom:7px;">' + esc(state.role) + '</div>' +
        '<div style="line-height:1.8;">' + c.email + '</div>' +
        (c.tels ? '<div style="line-height:1.8;">' + c.tels + '</div>' : '') +
      '</td>' +
    '</tr></table>' + footer();
  }

  function footer() {
    let out = '';
    if (state.showTagline) {
      out += '<div style="font-family:' + FF + ';font-size:11px;color:' + WINE + ';font-weight:700;margin-top:10px;">Con Confianza, de China a tu puerta.</div>';
    }
    if (state.showAddr) {
      out += '<div style="font-family:' + FF + ';font-size:10px;color:' + MUTE + ';margin-top:4px;line-height:1.5;">' +
        esc(state.city) + ' · Av. Bolívar Norte 14 · RIF J-50648869-8</div>';
    }
    return out ? '<div style="margin-top:2px;">' + out + '</div>' : '';
  }

  function buildSignature() {
    if (state.layout === 'compact') return layoutCompact();
    if (state.layout === 'card') return layoutCard();
    return layoutHorizontal();
  }

  function render() {
    const html = buildSignature();
    document.getElementById('preview').innerHTML = html;
    document.getElementById('code').textContent = html;
  }

  // ── load isólogo as base64 ──
  async function loadIso() {
    try {
      const res = await fetch('dtdcargo-isologo-primary.png');
      const blob = await res.blob();
      isoDataUri = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
    } catch (e) { isoDataUri = 'dtdcargo-isologo-primary.png'; }
    render();
  }

  function bind(id, key) {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.type === 'checkbox') { el.checked = !!state[key]; el.addEventListener('change', () => { state[key] = el.checked; save(); render(); }); }
    else { el.value = state[key]; el.addEventListener('input', () => { state[key] = el.value; save(); render(); }); }
  }

  async function copyRich() {
    const html = buildSignature();
    const btn = document.getElementById('copy');
    try {
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([state.name + ' · ' + state.role + '\n' + state.email + ' · ' + state.mobile + '\n' + state.site], { type: 'text/plain' })
      });
      await navigator.clipboard.write([item]);
      flash(btn, 'Copiada ✓');
    } catch (e) {
      try { await navigator.clipboard.writeText(html); flash(btn, 'HTML copiado ✓'); }
      catch (e2) { flash(btn, 'No se pudo'); }
    }
  }
  async function copyCode() {
    const btn = document.getElementById('copy-code');
    try { await navigator.clipboard.writeText(buildSignature()); flash(btn, 'HTML copiado ✓'); }
    catch (e) { flash(btn, 'No se pudo'); }
  }
  function flash(btn, txt) { const o = btn.textContent; btn.textContent = txt; btn.classList.add('ok'); setTimeout(() => { btn.textContent = o; btn.classList.remove('ok'); }, 1800); }

  function init() {
    [['f-name','name'],['f-role','role'],['f-mobile','mobile'],['f-office','office'],['f-email','email'],['f-site','site'],['f-city','city'],['f-tagline','showTagline'],['f-addr','showAddr']].forEach(([id, k]) => bind(id, k));
    document.querySelectorAll('.lbtn').forEach(b => {
      b.classList.toggle('on', b.dataset.l === state.layout);
      b.addEventListener('click', () => { state.layout = b.dataset.l; save(); document.querySelectorAll('.lbtn').forEach(x => x.classList.toggle('on', x.dataset.l === state.layout)); render(); });
    });
    document.getElementById('copy').addEventListener('click', copyRich);
    document.getElementById('copy-code').addEventListener('click', copyCode);
    loadIso();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
