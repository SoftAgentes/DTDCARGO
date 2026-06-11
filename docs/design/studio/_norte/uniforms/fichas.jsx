/* global React, window */
/* ── DTD-Cargo · Tarjeta de uniforme (lookbook) ────────────────────
   Logo estampado directo sobre la prenda (sin cotas encima). Medidas
   y specs limpias abajo. 3 variantes de espalda (A/B/C).             */
const U = window._UNI;
const Iso = window._uniIso, Word = window._uniWord, QR = window._uniQR;
const G = window.UNIv2;

const GARMENT = { tee: G.Tee, polo: G.Polo, shirt: G.Shirt, vest: G.Vest, cap: G.Cap };

// Sombra de piso para dar volumen (presentable, no foto)
function Floor() {
  return <ellipse cx="200" cy="360" rx="120" ry="13" fill="rgba(15,30,61,0.07)" />;
}

// ── Panel de prenda (garment + estampado encima) ───────────────────
function Panel({ garmentKey, side, label, children, cap }) {
  const Garment = GARMENT[garmentKey];
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ font: '800 10px/1 ' + U.FB, letterSpacing: '0.2em', textTransform: 'uppercase', color: U.SOFT, textAlign: 'center', marginBottom: 10 }}>{label}</div>
      <div style={{ background: '#fff', border: '1px solid #ECEAE5', borderRadius: 12, padding: '14px 6px 6px' }}>
        <svg viewBox={cap ? '0 0 400 300' : '0 0 400 400'} style={{ width: '100%', display: 'block' }}>
          {!cap && <Floor />}
          <Garment fill={window.__ufill} side={side} />
          {children}
        </svg>
      </div>
    </div>
  );
}

// ── Estampado FRENTE · isólogo pecho (lado del que mira: derecha) ──
function FrontPrint({ dark }) {
  return <Iso x={228} y={130} w={44} dark={dark} />;
}

// ── Estampados ESPALDA ─────────────────────────────────────────────
function BackA({ dark }) { // Institucional
  return (
    <g>
      <Word cx={200} y={196} size={30} dark={dark} />
      <text x={200} y={222} textAnchor="middle" style={{ font: '600 12px ' + U.FB, fill: dark ? '#C2747F' : U.WINE }}>Con Confianza, de China a tu puerta.</text>
      <text x={200} y={242} textAnchor="middle" style={{ font: '700 10px ' + U.FB, fill: dark ? 'rgba(255,255,255,0.6)' : U.SOFT, letterSpacing: '0.1em' }}>WWW.DTDCARGO.COM</text>
    </g>
  );
}
function BackB({ dark }) { // Captación · QR
  return (
    <g>
      <Iso x={176} y={138} w={48} dark={dark} />
      <Word cx={200} y={214} size={18} dark={dark} />
      <QR x={150} y={228} w={48} />
      <text x={210} y={250} textAnchor="start" style={{ font: '700 11px ' + U.FB, fill: dark ? '#fff' : U.INK, letterSpacing: '0.02em' }}>Escanea</text>
      <text x={210} y={266} textAnchor="start" style={{ font: '700 10px ' + U.FCN, fill: dark ? '#C2747F' : U.WINE }}>扫码咨询</text>
      <text x={200} y={296} textAnchor="middle" style={{ font: '700 9.5px ' + U.FB, fill: dark ? 'rgba(255,255,255,0.6)' : U.SOFT, letterSpacing: '0.08em' }}>WWW.DTDCARGO.COM</text>
    </g>
  );
}
function BackC({ dark }) { // Bilingüe · China
  return (
    <g>
      <text x={200} y={194} textAnchor="middle" style={{ font: '900 50px ' + U.FCN, fill: dark ? '#fff' : U.INK }}>门到门</text>
      <text x={200} y={222} textAnchor="middle" style={{ font: '900 18px ' + U.FBB, fill: dark ? '#C2747F' : U.WINE, letterSpacing: '0.03em' }}>PUERTA A PUERTA</text>
      <text x={200} y={244} textAnchor="middle" style={{ font: '700 11px ' + U.FB, fill: dark ? 'rgba(242,240,236,0.82)' : U.SOFT, letterSpacing: '0.06em' }}>海运 · CHINA → VENEZUELA</text>
      <text x={200} y={266} textAnchor="middle" style={{ font: '700 9.5px ' + U.FB, fill: dark ? 'rgba(255,255,255,0.55)' : U.SOFT, letterSpacing: '0.08em' }}>WWW.DTDCARGO.COM</text>
    </g>
  );
}
const BACKS = { A: BackA, B: BackB, C: BackC };
const BACK_NAME = { A: 'Institucional', B: 'Captación · QR', C: 'Bilingüe · China' };

// ── Spec abajo (limpio, medidas en texto) ──────────────────────────
function Spec({ label, value, mono }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ font: '700 9px/1 ' + U.FB, letterSpacing: '0.12em', textTransform: 'uppercase', color: U.SOFT, marginBottom: 6 }}>{label}</div>
      <div style={{ font: (mono ? '600 11.5px/1.4 ' : '600 12px/1.4 ') + (mono ? "'JetBrains Mono',monospace" : U.FB), color: U.INK }}>{value}</div>
    </div>
  );
}

// ── TARJETA ─────────────────────────────────────────────────────────
function Card({ codigo, prenda, rol, colorName, fill, dark, garmentKey, fabric, tecnica, tallas, variant, estampado }) {
  window.__ufill = fill;
  const Back = BACKS[variant];
  const isCap = garmentKey === 'cap';
  return (
    <div style={{ background: '#FBFAF7', fontFamily: U.FB, color: U.INK, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '24px 28px 18px' }}>
        <div>
          <div style={{ font: '800 9.5px/1 ' + U.FB, letterSpacing: '0.2em', textTransform: 'uppercase', color: U.WINE }}>Uniforme DTD-Cargo</div>
          <div style={{ font: '900 27px/1.04 ' + U.FBB, letterSpacing: '-0.02em', marginTop: 8 }}>{prenda}</div>
          <div style={{ font: '600 12.5px/1.3 ' + U.FB, color: U.SOFT, marginTop: 6 }}>{rol}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ font: '700 11px/1 ' + "'JetBrains Mono',monospace", color: U.SOFT }}>{codigo}</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 10, padding: '6px 12px', background: '#fff', border: '1px solid #ECEAE5', borderRadius: 999 }}>
            <span style={{ width: 15, height: 15, borderRadius: '50%', background: fill, border: '1px solid rgba(0,0,0,0.18)' }}></span>
            <span style={{ font: '700 11px/1 ' + U.FB, color: U.INK }}>{colorName}</span>
          </div>
        </div>
      </div>

      {/* prendas */}
      <div style={{ display: 'flex', gap: 16, padding: '0 28px 18px' }}>
        {isCap ? (
          <Panel garmentKey="cap" side="side" label="Perfil · bordado frontal" cap>
            <Iso x={176} y={150} w={46} dark={dark} />
          </Panel>
        ) : (
          <React.Fragment>
            <Panel garmentKey={garmentKey} side="front" label="Frente"><FrontPrint dark={dark} /></Panel>
            <Panel garmentKey={garmentKey} side="back" label={'Espalda · ' + BACK_NAME[variant]}><Back dark={dark} /></Panel>
          </React.Fragment>
        )}
      </div>

      {/* specs abajo */}
      <div style={{ marginTop: 'auto', borderTop: '1px solid #ECEAE5', padding: '18px 28px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 28px' }}>
        <Spec label="Tela" value={fabric} />
        <Spec label="Técnica" value={tecnica} />
        <Spec label="Estampado / bordado" value={estampado} />
        <Spec label="Tallas" value={tallas} mono />
        <Spec label="Color · token" value={dark ? 'navy · var(--ink) · #0F1E3D' : (colorName === 'Blanco' ? 'blanco · #FFFFFF' : 'crema · var(--bg-elevated) · #F2F0EC')} mono />
        <Spec label="Marca" value={'Isólogo oficial + wordmark «DTD Cargo»'} />
      </div>
    </div>
  );
}

Object.assign(window, { UniCard: Card, UniBackName: BACK_NAME });
