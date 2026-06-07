/* global React */
/* ── DTD-Cargo · Calculadora LCL DDP (China → Venezuela) ───────────
   Spec del cliente (2026-06): tarifa CBM editable (default $800, la
   genera el sistema), peso con excedente y densidad, embalaje, baterías,
   destino Casco Central, carga especial → asesor. Piso $50 con punto de
   cruce derivado (50/tarifa). Visual: contenedor 40'HC que se llena con
   el CBM. CTA = WhatsApp con la cotización armada.                    */

const { useState } = React;

// Oculta los spinners nativos de input[type=number]. Inyección única.
if (typeof document !== 'undefined' && !document.getElementById('cbm-calc-css')) {
  const _s = document.createElement('style');
  _s.id = 'cbm-calc-css';
  _s.textContent = 'input[type=number]::-webkit-outer-spin-button,input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}input[type=number]{-moz-appearance:textfield;appearance:textfield}'
    + '@keyframes dtd-cta-pulse{0%,100%{box-shadow:0 10px 22px rgba(37,211,102,0.30)}50%{box-shadow:0 14px 32px rgba(37,211,102,0.52)}}'
    + '@keyframes dtd-cta-wiggle{0%,84%,100%{transform:translateX(0) rotate(0deg)}87%{transform:translateX(-2px) rotate(-0.6deg)}90%{transform:translateX(2px) rotate(0.6deg)}93%{transform:translateX(-2px) rotate(-0.6deg)}96%{transform:translateX(1px) rotate(0.3deg)}}'
    + '@keyframes dtd-cta-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(4px)}}'
    + '@media (prefers-reduced-motion: no-preference){.dtd-cta-pulse{animation:dtd-cta-pulse 2.2s ease-in-out infinite}.dtd-cta-nudge{animation:dtd-cta-wiggle 3.4s ease-in-out infinite}.dtd-cta-arrow{animation:dtd-cta-bounce 1.3s ease-in-out infinite}}';
  document.head.appendChild(_s);
}

// ── Parámetros de negocio (única fuente · editable) ───────────────
const DTD_WA_PHONE   = '584121668021';   // +58 412 166 8021 · número central DTD-Cargo
const TARIFA_DEFAULT = 800;              // $/CBM · la genera el sistema, el cliente la ajusta
const MIN_FACT       = 50;              // mínimo facturable (piso)
const KG_INCL_CBM    = 500;             // kg incluidos sin recargo por CBM
const KG_EXTRA_USD   = 1;               // $/kg excedente
const DENS_MAX       = 600;             // kg/CBM máximo
const EMBALAJE_USD   = 50;              // embalaje especial
const BAT_MULT       = 1.5;             // multiplicador por baterías
const CBM_MAX        = 68;              // m³ máximo (1 contenedor 40'HC)
const PESO_MAX       = 27000;           // kg máximo por contenedor
const CONT_40HC      = 68;              // CBM aprox · 40'HC (para el dibujo)
const DESTINOS       = ['Valencia', 'Maracay', 'Caracas']; // Casco Central · sin recargo

// ── Helpers ────────────────────────────────────────────────────────
function fmtCBM(n) { n = n || 0; return n.toFixed(n < 10 ? 2 : 1); }
function money(n) { return '$' + Math.round(n || 0).toLocaleString('en-US'); }
function usd(n) { return 'US$' + Math.round(n || 0).toLocaleString('en-US'); }
function fmtKg(n) { return (n || 0).toLocaleString('en-US') + ' kg'; }
function trimNum(n) { return parseFloat((n || 0).toFixed(4)).toString(); }
function waLink(msg) { return 'https://wa.me/' + DTD_WA_PHONE + '?text=' + encodeURIComponent(msg); }

// ── Motor de cálculo ───────────────────────────────────────────────
function computeQuote(inp) {
  const tarifa = Math.max(parseFloat(inp.tarifa) || 0, 0);
  const cbm = Math.max(parseFloat(inp.cbm) || 0, 0);
  const peso = Math.max(parseFloat(inp.peso) || 0, 0);
  const crossPoint = tarifa > 0 ? MIN_FACT / tarifa : 0;

  // Estados de borde
  const incomplete = cbm <= 0 || peso <= 0;          // F
  const overCBM = cbm > CBM_MAX;                       // B
  const overPeso = peso > PESO_MAX;                    // C
  const especial = !!inp.especial;                     // E
  const density = cbm > 0 ? peso / cbm : 0;
  const overDensity = density > DENS_MAX;              // D
  const belowCross = !incomplete && !overCBM && cbm < crossPoint; // A

  const reasons = [];
  if (especial) reasons.push('Carga especial / alto valor');
  if (overCBM) reasons.push('CBM supera ' + CBM_MAX + ' m³ (más que un contenedor)');
  if (overPeso) reasons.push('Peso supera ' + PESO_MAX.toLocaleString('en-US') + ' kg');
  const derive = especial || overCBM || overPeso;
  const asesoria = derive || overDensity; // todo lo que enruta al asesor (incl. densidad alta)

  // Precio
  const base = cbm * tarifa;
  const pesoIncluido = KG_INCL_CBM * cbm;
  const excedenteKg = Math.max(peso - pesoIncluido, 0);
  const excedenteCost = excedenteKg * KG_EXTRA_USD;
  const embalajeCost = inp.embalaje ? EMBALAJE_USD : 0;
  const fletePre = base + excedenteCost + embalajeCost;          // (base + excedente + embalaje)
  const fleteBatt = inp.baterias ? fletePre * BAT_MULT : fletePre; // × baterías
  const total = Math.max(fleteBatt, MIN_FACT);                   // piso $50
  const ajusteMin = total - fleteBatt;                          // >0 cuando muerde el piso

  return {
    tarifa, cbm, peso, crossPoint, incomplete, overCBM, overPeso, especial, derive, reasons,
    density, overDensity, belowCross,
    base, pesoIncluido, excedenteKg, excedenteCost, embalajeCost, fletePre, fleteBatt, total, ajusteMin,
    asesoria,
    batMult: inp.baterias ? (fletePre * (BAT_MULT - 1)) : 0,
  };
}

// Texto de la alerta que enruta al asesor (orden de prioridad).
function alertText(r) {
  if (r.especial) return 'Para carga especial, peligrosa o que requiere permisos de exportación, consultá con tu asesor — la cotizamos a medida.';
  if (r.overCBM) return 'Eso es más que un contenedor. Consulte a su asesor.';
  if (r.overPeso) return 'Esto es más que el peso permitido por contenedor; consulte a su asesor.';
  if (r.overDensity) return 'Tu carga tiene ' + Math.round(r.density) + ' kg/CBM, supera el máximo de ' + DENS_MAX + ' kg/CBM. Necesitás FCL o cotización personalizada — escribinos por WhatsApp.';
  return null;
}

// ── Mensaje de WhatsApp · dos versiones (spec del cliente) ─────────
function waMessage(inp, r) {
  const datos = [
    '• CBM total: ' + fmtCBM(r.cbm) + ' m³',
    '• Peso total: ' + r.peso.toLocaleString('en-US') + ' kg',
    '• Embalaje: ' + (inp.embalaje ? 'Caja especial (madera o paleta)' : 'Caja estándar'),
    '• Baterías: ' + (inp.baterias ? 'Sí' : 'No'),
    '• Destino: ' + inp.destino,
  ];
  if (r.asesoria) {
    // B) Deriva al asesor
    return ['Acabo de cotizar en tu calculadora y necesito asesoría con mi carga:', '']
      .concat(datos, ['', alertText(r), '', '¿Me ayudan con una cotización a medida?']).join('\n');
  }
  // A) Cotización normal
  return ['Acabo de cotizar en tu calculadora. Esto es lo que estoy calculando:', '']
    .concat(datos, ['• Estimado web: ' + usd(r.total), '', '¿Me confirman la tarifa final y los tiempos? (Financiamiento 100%, pago al llegar)']).join('\n');
}

// ── Glifo WhatsApp ─────────────────────────────────────────────────
function WAGlyph(size, color) {
  size = size || 18; color = color || '#fff';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.97L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 1.67a8.2 8.2 0 0 1 5.82 2.42 8.18 8.18 0 0 1 2.42 5.82c0 4.54-3.7 8.24-8.25 8.24a8.2 8.2 0 0 1-4.26-1.17l-.3-.18-3.12.82.83-3.04-.2-.32a8.2 8.2 0 0 1-1.26-4.36c0-4.54 3.7-8.24 8.25-8.24zm-4.6 4.43c-.22 0-.57.08-.87.4-.3.33-1.15 1.12-1.15 2.73s1.18 3.17 1.34 3.39c.16.22 2.32 3.55 5.62 4.97.79.34 1.4.54 1.88.69.79.25 1.51.21 2.08.13.63-.09 1.95-.8 2.22-1.57.27-.76.27-1.42.19-1.56-.08-.13-.3-.21-.63-.37-.33-.16-1.95-.96-2.25-1.07-.3-.11-.52-.16-.74.17-.22.33-.85 1.07-1.04 1.29-.19.22-.38.25-.71.08-.33-.16-1.39-.51-2.65-1.64-.98-.87-1.64-1.95-1.83-2.28-.19-.33-.02-.5.14-.67.15-.15.33-.38.49-.58.16-.19.22-.33.33-.55.11-.22.05-.41-.03-.58-.08-.16-.74-1.78-1.01-2.44-.27-.64-.54-.55-.74-.56l-.63-.01z" />
    </svg>
  );
}

// ── Wordmark ───────────────────────────────────────────────────────
function Wordmark({ size }) {
  size = size || 18;
  return (
    <span style={{ font: '900 ' + size + 'px/1 var(--f-brand-display)', letterSpacing: '-0.02em', display: 'inline-flex', alignItems: 'baseline' }}>
      <span style={{ color: 'var(--wine)' }}>DTD</span>
      <span style={{ display: 'inline-block', width: '0.15em' }}></span>
      <span style={{ color: 'var(--ink)' }}>Cargo</span>
    </span>
  );
}

// ── Contenedor 40'HC que se llena con el CBM ───────────────────────
function Container40HC({ cbm }) {
  const pct = Math.min((cbm || 0) / CONT_40HC, 1);
  const over = cbm > CONT_40HC;
  const lit = pct > 0.46;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ font: '700 10px/1 var(--f-sans)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>En un contenedor 40'HC</span>
        <span style={{ font: '700 11px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{CONT_40HC} CBM</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 6 }}>
        <div style={{ position: 'relative', flex: 1, height: 120, border: '2.5px solid var(--ink)', borderRadius: 'var(--r-sm)', background: 'var(--bg-elevated)', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '100%', transformOrigin: 'left center', transform: 'scaleX(' + pct + ')', background: 'var(--wine)', transition: 'transform 360ms var(--ease)' }} />
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(90deg, rgba(15,30,61,0.10) 0 2px, transparent 2px 16px)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ font: '800 30px/1 var(--f-display)', letterSpacing: '-0.03em', color: lit ? '#fff' : 'var(--ink)', transition: 'color 200ms var(--ease)' }}>{over ? '100%+' : Math.round(pct * 100) + '%'}</div>
            <div style={{ font: '700 9px/1 var(--f-sans)', letterSpacing: '0.14em', textTransform: 'uppercase', color: lit ? 'rgba(255,255,255,0.75)' : 'var(--ink-mute)', marginTop: 5 }}>lleno</div>
          </div>
        </div>
        <div style={{ width: 22, height: 120, border: '2.5px solid var(--ink)', borderRadius: 'var(--r-sm)', background: pct >= 1 ? 'var(--wine)' : 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, transition: 'background 360ms var(--ease)' }}>
          <span style={{ width: 2, height: 60, background: 'var(--ink)', opacity: 0.4 }} />
          <span style={{ width: 2, height: 60, background: 'var(--ink)', opacity: 0.4 }} />
        </div>
      </div>
    </div>
  );
}

// ── Campo numérico ─────────────────────────────────────────────────
function NumField({ label, tag, value, onChange, prefix, suffix, big, hint, hintTone }) {
  const [foc, setFoc] = useState(false);
  const hc = hintTone === 'danger' ? 'var(--danger)' : hintTone === 'info' ? 'var(--wine)' : 'var(--ink-mute)';
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ font: '700 10px/1 var(--f-sans)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>{label}</span>
        {tag && <span style={{ font: '700 8.5px/1 var(--f-sans)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--wine)', background: 'var(--wine-tint)', padding: '3px 6px', borderRadius: 'var(--r-pill)' }}>{tag}</span>}
      </span>
      <span style={{
        display: 'flex', alignItems: 'center', gap: 7,
        background: 'var(--bg-surface)', border: '1.5px solid ' + (foc ? 'var(--wine)' : (hintTone === 'danger' ? 'var(--danger)' : 'var(--border)')),
        borderRadius: 'var(--r-md)', padding: big ? '13px 15px' : '11px 13px', transition: 'border-color 140ms var(--ease)',
      }}>
        {prefix && <span style={{ font: '700 ' + (big ? 17 : 14) + 'px/1 var(--f-mono)', color: 'var(--ink-soft)', flexShrink: 0 }}>{prefix}</span>}
        <input type="number" inputMode="decimal" min="0" value={value}
          onFocus={() => setFoc(true)} onBlur={() => setFoc(false)} onChange={(e) => onChange(e.target.value)}
          style={{ width: '100%', minWidth: 0, border: 0, background: 'transparent', font: '700 ' + (big ? 22 : 16) + 'px/1 var(--f-mono)', color: 'var(--ink)', outline: 'none' }} />
        {suffix && <span style={{ font: '600 ' + (big ? 13 : 12) + 'px/1 var(--f-mono)', color: 'var(--ink-mute)', flexShrink: 0 }}>{suffix}</span>}
      </span>
      {hint && <span style={{ display: 'block', font: '600 11px/1.4 var(--f-sans)', color: hc, marginTop: 6 }}>{hint}</span>}
    </label>
  );
}

// ── Toggle ─────────────────────────────────────────────────────────
function Toggle({ on, onToggle, title, sub, badge }) {
  return (
    <button onClick={onToggle} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
      padding: '12px 14px', borderRadius: 'var(--r-md)',
      background: on ? 'var(--wine-tint)' : 'var(--bg-surface)',
      border: '1.5px solid ' + (on ? 'var(--wine)' : 'var(--border)'), transition: 'all 140ms var(--ease)',
    }}>
      <span style={{ width: 40, height: 23, borderRadius: 'var(--r-pill)', flexShrink: 0, position: 'relative', background: on ? 'var(--wine)' : 'var(--border-strong)', transition: 'background 160ms var(--ease)' }}>
        <span style={{ position: 'absolute', top: 3, left: on ? 20 : 3, width: 17, height: 17, borderRadius: '50%', background: '#fff', transition: 'left 160ms var(--ease)', boxShadow: 'var(--shadow-sm)' }} />
      </span>
      <span style={{ flex: 1 }}>
        <span style={{ display: 'block', font: '700 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{title}</span>
        {sub && <span style={{ display: 'block', font: '500 10.5px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 3 }}>{sub}</span>}
      </span>
      {badge && <span style={{ font: '800 12px/1 var(--f-mono)', color: on ? 'var(--wine)' : 'var(--ink-mute)', flexShrink: 0 }}>{badge}</span>}
    </button>
  );
}

// ── Select destino ─────────────────────────────────────────────────
function DestinoSelect({ value, onChange }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', font: '700 10px/1 var(--f-sans)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 8 }}>Destino · Casco Central</span>
      <span style={{ position: 'relative', display: 'block' }}>
        <select value={value} onChange={(e) => onChange(e.target.value)} style={{
          width: '100%', appearance: 'none', WebkitAppearance: 'none',
          background: 'var(--bg-surface)', border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)',
          padding: '11px 36px 11px 13px', font: '700 14px/1 var(--f-sans)', color: 'var(--ink)', cursor: 'pointer', outline: 'none',
        }}>
          {DESTINOS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--ink-mute)', font: '700 11px/1 var(--f-sans)' }}>▾</span>
      </span>
    </label>
  );
}

// ── Fila de desglose ───────────────────────────────────────────────
function Row({ label, value, sub, strong, accent }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, padding: strong ? '4px 0 0' : '0' }}>
      <span style={{ font: (strong ? '700 ' : '500 ') + '12.5px/1.5 var(--f-sans)', color: accent ? 'var(--wine)' : (strong ? 'var(--ink)' : 'var(--ink-soft)') }}>
        {label}{sub && <span style={{ display: 'block', font: '500 10.5px/1.3 var(--f-sans)', color: 'var(--ink-mute)' }}>{sub}</span>}
      </span>
      <span className="mono" style={{ font: (strong ? '800 ' : '700 ') + (strong ? 14 : 12.5) + 'px/1 var(--f-mono)', color: accent ? 'var(--wine)' : 'var(--ink)', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );
}

// ── Aviso de derivación / alerta ───────────────────────────────────
function Notice({ tone, title, body }) {
  const c = tone === 'danger' ? 'var(--danger)' : tone === 'warning' ? 'var(--warning)' : 'var(--info)';
  const bg = tone === 'danger' ? 'var(--danger-bg)' : tone === 'warning' ? 'var(--warning-bg)' : 'var(--info-bg)';
  return (
    <div style={{ padding: '14px 16px', background: bg, borderRadius: 'var(--r-md)', borderLeft: '3px solid ' + c }}>
      {title && <div style={{ font: '700 9.5px/1 var(--f-sans)', letterSpacing: '0.12em', textTransform: 'uppercase', color: c, marginBottom: 6 }}>{title}</div>}
      <div style={{ font: '600 12.5px/1.5 var(--f-sans)', color: 'var(--ink)' }}>{body}</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// Calculadora LCL DDP
// ══════════════════════════════════════════════════════════════════
function CalcLCL() {
  const [tarifa, setTarifa] = useState(String(TARIFA_DEFAULT));
  const [cbm, setCbm] = useState('12');
  const [peso, setPeso] = useState('4800');
  const [embalaje, setEmbalaje] = useState(false);
  const [baterias, setBaterias] = useState(false);
  const [especial, setEspecial] = useState(false);
  const [destino, setDestino] = useState(DESTINOS[0]);
  const [leadSent, setLeadSent] = useState(false);
  const lastSig = React.useRef(null);

  const inp = { tarifa, cbm, peso, embalaje, baterias, especial, destino };
  const r = computeQuote(inp);

  // Si cambian los datos, se resetea la confirmación de "registrado".
  React.useEffect(() => { setLeadSent(false); }, [tarifa, cbm, peso, embalaje, baterias, especial, destino]);

  // Publica la cotización al ERP/CRM (lead + badge) además de abrir WhatsApp.
  // Lead anónimo de la calculadora pública (sin MARKBOX todavía → tenant 'dtd').
  function publishLead() {
    try {
      if (!(window.DTDData && window.DTDData.pushPortalEvent)) return; // standalone sin bridge → no-op
      const sig = JSON.stringify([r.cbm, r.peso, r.tarifa, embalaje, baterias, especial, destino, r.asesoria]);
      if (sig === lastSig.current) { setLeadSent(true); return; } // evita duplicar el mismo lead
      lastSig.current = sig;
      window.DTDData.pushPortalEvent({
        kind: 'cotizacion', tone: r.asesoria ? 'warning' : 'info', markbox: null,
        title: 'Calculadora · ' + fmtCBM(r.cbm) + ' CBM' + (r.asesoria ? ' · asesoría' : ''),
        detail: fmtKg(r.peso) + ' · ' + destino + (r.asesoria ? ' · revisar carga' : ' · est. ' + usd(r.total)),
        channel: 'calculadora-web',
        meta: { cbm: r.cbm, peso: r.peso, tarifa: r.tarifa, embalaje, baterias, destino, total: r.asesoria ? null : r.total, asesoria: r.asesoria, alert: r.asesoria ? alertText(r) : null },
      });
      setLeadSent(true);
    } catch (e) { console.error('[calculadora] pushPortalEvent falló:', e); }
  }

  // Hints de campo
  const cbmHint = r.overCBM ? 'Eso es más que un contenedor. Consulte a su asesor'
    : (r.belowCross ? ('Nuestro mínimo de carga es ' + trimNum(r.crossPoint) + ' m³ — por debajo, el envío sale ' + money(MIN_FACT) + '.') : null);
  const cbmTone = r.overCBM ? 'danger' : (r.belowCross ? 'info' : null);
  // PESO · 3 niveles (spec): c) tope contenedor → b) demasiado denso/FCL → a) excedente con recargo.
  let pesoHint = null, pesoTone = null;
  if (r.overPeso) {
    pesoHint = 'Esto es más que el peso permitido por contenedor; consulte a su asesor';
    pesoTone = 'danger';
  } else if (r.overDensity) {
    pesoHint = 'Para ' + trimNum(r.cbm) + ' m³, más de ' + Math.round(r.cbm * DENS_MAX).toLocaleString('en-US') + ' kg es demasiado denso — consultá con tu asesor (FCL).';
    pesoTone = 'danger';
  } else if (r.cbm > 0 && r.excedenteKg > 0) {
    pesoHint = 'El máximo de peso sin recargo para ' + trimNum(r.cbm) + ' m³ es ' + Math.round(r.pesoIncluido).toLocaleString('en-US') + ' kg. Te pasás por ' + Math.round(r.excedenteKg).toLocaleString('en-US') + ' kg → +' + money(r.excedenteCost) + ' ($1/kg extra).';
    pesoTone = 'info';
  }

  return (
    <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--r-xl)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', fontFamily: 'var(--f-sans)', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
      {/* ENTRADA */}
      <div style={{ padding: 'var(--s-8)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--s-6)' }}>
          <Wordmark size={17} />
          <span style={{ font: '700 9.5px/1 var(--f-sans)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--wine)' }}>Calculadora LCL DDP</span>
        </div>
        <h2 style={{ font: '800 25px/1.06 var(--f-display)', letterSpacing: '-0.025em', color: 'var(--ink)', margin: '0 0 6px' }}>Cotizá tu carga China → Venezuela</h2>
        <p style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '0 0 22px', maxWidth: '44ch' }}>Puerta a puerta, financiamiento 100%. Indicá tu volumen y peso y te damos un estimado al instante.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <NumField label="Tarifa de CBM" tag="auto · editable" value={tarifa} onChange={setTarifa} prefix="$" suffix="USD/CBM"
            hint="La genera el sistema. Ajustala si tu cotización es distinta." />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <NumField label="CBM total" value={cbm} onChange={setCbm} suffix="m³" big hint={cbmHint} hintTone={cbmTone} />
            <NumField label="Peso total" value={peso} onChange={setPeso} suffix="kg" big hint={pesoHint} hintTone={pesoTone} />
          </div>

          <Toggle on={embalaje} onToggle={() => setEmbalaje(!embalaje)} title="Embalaje especial" sub="Madera o paleta" badge={'+' + money(EMBALAJE_USD)} />
          <Toggle on={baterias} onToggle={() => setBaterias(!baterias)} title="Lleva baterías" sub="Recargo por manejo de litio" badge={'×' + BAT_MULT} />
          <Toggle on={especial} onToggle={() => setEspecial(!especial)} title="Carga especial o de alto valor" sub="Frágil, peligrosa o con permisos — la vemos a medida" />

          <DestinoSelect value={destino} onChange={setDestino} />
        </div>
      </div>

      {/* RESULTADO */}
      <div style={{ padding: 'var(--s-8)', background: 'var(--bg-base)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 'var(--s-5)' }}>
        <Container40HC cbm={r.cbm} />

        {/* Estados de borde / desglose */}
        {r.incomplete ? (
          <Notice tone="info" title="Faltan datos" body="El CBM total y el peso deben ser mayores a cero." />
        ) : r.especial ? (
          <Notice tone="warning" title="Derivar al asesor" body="Para carga especial, peligrosa o que requiere permisos de exportación, consultá con tu asesor — la cotizamos a medida." />
        ) : r.overCBM ? (
          <Notice tone="danger" title="Excede un contenedor" body="Eso es más que un contenedor. Consulte a su asesor." />
        ) : r.overPeso ? (
          <Notice tone="danger" title="Excede el peso" body="Esto es más que el peso permitido por contenedor; consulte a su asesor." />
        ) : (
          <React.Fragment>
            {/* Total */}
            <div style={{ background: 'linear-gradient(135deg, var(--ink), #1F3055)', borderRadius: 'var(--r-lg)', padding: 'var(--s-6)', color: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ font: '700 9.5px/1 var(--f-sans)', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--wine-soft)' }}>Total estimado</div>
                  <div style={{ font: '800 40px/1 var(--f-display)', letterSpacing: '-0.03em', marginTop: 8 }}>{money(r.total)}</div>
                </div>
                <div style={{ textAlign: 'right', font: '500 10.5px/1.4 var(--f-sans)', color: 'rgba(255,255,255,0.55)' }}>aprox · DDP<br />puerta a puerta</div>
              </div>
            </div>

            {/* Desglose */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 2px' }}>
              <Row label={'Volumen base'} sub={fmtCBM(r.cbm) + ' CBM × ' + money(r.tarifa)} value={money(r.base)} />
              {r.excedenteCost > 0 && <Row label="Excedente de peso" sub={Math.round(r.excedenteKg).toLocaleString('en-US') + ' kg sobre ' + Math.round(r.pesoIncluido).toLocaleString('en-US') + ' kg incl.'} value={'+' + money(r.excedenteCost)} />}
              {r.embalajeCost > 0 && <Row label="Embalaje especial" value={'+' + money(r.embalajeCost)} />}
              {baterias && <Row label={'Baterías × ' + BAT_MULT} value={'+' + money(r.batMult)} />}
              {r.ajusteMin > 0.5 && <Row label="Ajuste a mínimo facturable" sub={'Piso de ' + money(MIN_FACT)} value={'+' + money(r.ajusteMin)} accent />}
              <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
              <Row label="Total estimado" value={money(r.total)} strong />
            </div>

            {/* Alerta densidad */}
            {r.overDensity && (
              <Notice tone="warning" title="Densidad alta" body={'Tu carga tiene ' + Math.round(r.density) + ' kg/CBM, supera el máximo de ' + DENS_MAX + ' kg/CBM. Necesitás FCL o cotización personalizada — escribinos por WhatsApp.'} />
            )}
          </React.Fragment>
        )}

        {/* Badge financiamiento */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--success-bg)', borderRadius: 'var(--r-md)' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }} />
          <span style={{ font: '700 11.5px/1.3 var(--f-sans)', color: 'var(--ink)' }}>Financiamiento 100%<span style={{ color: 'var(--wine)' }}>*</span> · pagás al llegar a Venezuela</span>
        </div>

        {/* CTA */}
        <div style={{ marginTop: 'auto' }}>
          {!r.incomplete && !r.asesoria && (
            <div style={{ marginBottom: 10 }}>
              <div className="dtd-cta-nudge" style={{ background: 'var(--ink)', color: '#fff', borderRadius: 'var(--r-md)', padding: '11px 16px', textAlign: 'center', font: '600 12.5px/1.35 var(--f-sans)' }}>
                Tu cotización ya está lista — <b style={{ fontWeight: 800 }}>solo falta enviarla.</b>
              </div>
              <div className="dtd-cta-arrow" style={{ width: 0, height: 0, margin: '0 auto', borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderTop: '7px solid var(--ink)' }}></div>
            </div>
          )}
          <a href={r.incomplete ? undefined : waLink(waMessage(inp, r))} target="_blank" rel="noopener noreferrer"
            className={r.incomplete ? undefined : 'dtd-cta-pulse'}
            onClick={(e) => { if (r.incomplete) { e.preventDefault(); return; } publishLead(); }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%',
              padding: '16px 22px', borderRadius: 'var(--r-md)',
              /* WhatsApp brand green · identidad de plataforma (precedente: operario/almacenista.jsx) */
              background: r.incomplete ? 'var(--border-strong)' : '#25D366',
              color: r.incomplete ? 'var(--ink-mute)' : '#fff',
              font: '800 15px/1 var(--f-sans)', letterSpacing: '-0.01em',
              boxShadow: r.incomplete ? 'none' : '0 10px 22px rgba(37,211,102,0.30)', cursor: r.incomplete ? 'not-allowed' : 'pointer',
            }}>
            {WAGlyph(19, r.incomplete ? 'var(--ink-mute)' : '#fff')}
            {r.asesoria ? 'Consultar con un asesor' : 'Cotizar por WhatsApp'}
          </a>
          <p style={{ font: '500 11px/1.4 var(--f-sans)', color: 'var(--ink-mute)', margin: '10px 0 0', textAlign: 'center' }}>Tu mensaje se arma solo con estos datos. Con Confianza, de China a tu puerta.</p>
          {leadSent && (
            <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, font: '700 11px/1.3 var(--f-sans)', color: 'var(--success)', margin: '8px 0 0', textAlign: 'center' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }}></span>
              Registramos tu consulta — un asesor puede contactarte.
            </p>
          )}
        </div>
      </div>

      {/* Nota al pie · ancho completo */}
      <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border)', padding: 'var(--s-5) var(--s-8)', background: 'var(--bg-surface)' }}>
        <p style={{ font: '500 11px/1.55 var(--f-sans)', color: 'var(--ink-mute)', margin: 0 }}>
          <span style={{ color: 'var(--wine)', fontWeight: 700 }}>*</span> Financiamiento 100%: pagás el flete al llegar a Venezuela. <b style={{ color: 'var(--ink-soft)', fontWeight: 700 }}>Aplican restricciones.</b> Este estimado es aproximado y refleja nuestra tarifa base DDP (puerta a puerta).
        </p>
      </div>
    </div>
  );
}

Object.assign(window, { CalcLCL });
