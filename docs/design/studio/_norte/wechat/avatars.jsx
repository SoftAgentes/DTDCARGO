/* global React */
/* ── DTD-Cargo · Opciones de foto de perfil (头像) para WeChat ───────
   Reto: el avatar se ve diminuto (lista de chats ~48px, perfil ~200px).
   Por eso el mensaje central es 门到门 (puerta a puerta) — 3 caracteres
   que tu audiencia china lee incluso muy chico. Marca: isólogo oficial
   + paleta navy/wine. Diseñado para recorte CIRCULAR (nada clave en las
   esquinas).                                                            */

const AC = {
  wine: '#7F0F1A', wineSoft: '#C2747F', wineMid: '#A8323E',
  ink: '#0F1E3D', ink2: '#1F3055', paper: '#FBFAF7', cream: '#F2F0EC',
};
const AFB = "'Archivo', system-ui, sans-serif";
const AFBB = "'Archivo Black', 'Archivo', sans-serif";
const AFCN = "'Noto Sans SC', 'Archivo', sans-serif";

function AIso({ variant, h }) {
  const src = variant === 'reverse' ? 'assets/dtdcargo-isologo-reverse.png' : 'assets/dtdcargo-isologo-primary.png';
  return <img src={src} alt="DTD-Cargo" style={{ height: h, width: 'auto', display: 'block' }} />;
}

// ── A · 门到门 protagonista (navy) ─────────────────────────────────
function AvHero() {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'radial-gradient(circle at 50% 38%, ' + AC.ink2 + ' 0%, ' + AC.ink + ' 72%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {/* anillo de borde para el círculo */}
      <div style={{ position: 'absolute', inset: 54, borderRadius: '50%', border: '6px solid rgba(194,116,127,0.35)' }} />
      <div style={{ font: '900 56px/1 ' + AFB, letterSpacing: '0.02em', color: '#fff', display: 'flex', alignItems: 'baseline' }}>
        <span style={{ color: AC.wineSoft }}>DTD</span><span style={{ width: '0.16em' }} /><span>Cargo</span>
      </div>
      <div style={{ font: '900 340px/0.86 ' + AFCN, color: '#fff', margin: '14px 0 0', letterSpacing: '0.02em', textShadow: '0 6px 30px rgba(0,0,0,0.4)' }}>门到门</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 18 }}>
        <span style={{ width: 56, height: 4, background: AC.wineSoft, borderRadius: 2 }} />
        <span style={{ font: '800 34px/1 ' + AFB, letterSpacing: '0.16em', textTransform: 'uppercase', color: AC.wineSoft }}>Puerta a Puerta</span>
        <span style={{ width: 56, height: 4, background: AC.wineSoft, borderRadius: 2 }} />
      </div>
      <div style={{ font: '700 30px/1 ' + AFB, letterSpacing: '0.14em', color: 'rgba(242,240,236,0.62)', marginTop: 22 }}>CHINA → VENEZUELA</div>
    </div>
  );
}

// ── B · Isólogo + 门到门 ───────────────────────────────────────────
function AvIso() {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'linear-gradient(150deg, ' + AC.ink + ' 0%, ' + AC.ink2 + ' 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 60, borderRadius: '50%', border: '5px solid rgba(194,116,127,0.22)' }} />
      <AIso variant="reverse" h={420} />
      <div style={{ font: '900 150px/1 ' + AFCN, color: AC.wineSoft, marginTop: 6, letterSpacing: '0.04em' }}>门到门</div>
      <div style={{ font: '800 30px/1 ' + AFB, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(242,240,236,0.7)', marginTop: 14 }}>Puerta a Puerta</div>
    </div>
  );
}

// ── C · Con foto del contenedor + 门到门 ───────────────────────────
function AvPhoto() {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: AC.ink, overflow: 'hidden' }}>
      <image-slot id="avatar-photo-fill" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} shape="rect" fit="cover" placeholder="Arrastra aquí una foto/render del contenedor"></image-slot>
      {/* degradado inferior para legibilidad */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '58%', background: 'linear-gradient(180deg, rgba(15,30,61,0) 0%, rgba(15,30,61,0.62) 48%, rgba(15,30,61,0.95) 100%)' }} />
      <div style={{ position: 'absolute', top: 50, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
        <AIso variant="reverse" h={150} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 150, textAlign: 'center' }}>
        <div style={{ font: '900 230px/0.9 ' + AFCN, color: '#fff', letterSpacing: '0.02em', textShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>门到门</div>
        <div style={{ font: '800 38px/1 ' + AFB, letterSpacing: '0.16em', textTransform: 'uppercase', color: AC.wineSoft, marginTop: 10 }}>Puerta a Puerta</div>
      </div>
    </div>
  );
}

// ── D · Insignia de ruta CN→VE (wine) ──────────────────────────────
function AvRoute() {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'radial-gradient(circle at 50% 40%, ' + AC.wineMid + ' 0%, ' + AC.wine + ' 60%, #5E0A12 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 54, borderRadius: '50%', border: '6px solid rgba(255,255,255,0.28)' }} />
      <AIso variant="reverse" h={300} />
      <div style={{ font: '900 110px/0.9 ' + AFCN, color: '#fff', marginTop: 18 }}>门到门</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14, font: '900 46px/1 ' + AFBB, color: '#fff', letterSpacing: '0.02em' }}>
        <span>CN</span>
        <svg width="80" height="26" viewBox="0 0 80 26" fill="none"><path d="M2 13h66" stroke="#F2C9CF" strokeWidth="4" strokeDasharray="2 9" strokeLinecap="round"/><path d="M62 4l14 9-14 9" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        <span>VE</span>
      </div>
    </div>
  );
}

Object.assign(window, { AvHero, AvIso, AvPhoto, AvRoute });
