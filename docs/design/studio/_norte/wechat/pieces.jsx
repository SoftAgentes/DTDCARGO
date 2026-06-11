/* global React */
/* ── DTD-Cargo · Piezas para perfil de WeChat ──────────────────────
   Branding oficial v1.0: isólogo D+P (navy/wine), wordmark "DTD Cargo"
   (Archivo Black, DOS palabras), paleta navy + wine. Bilingüe ES / 中文
   para la audiencia china de WeChat. Sin "DTDCARGO" (prohibido).        */

// ── Tokens de marca (subset) ───────────────────────────────────────
const C = {
  wine: '#7F0F1A', wineDeep: '#5E0A12', wineSoft: '#C2747F',
  ink: '#0F1E3D', ink2: '#1F3055', paper: '#FBFAF7', cream: '#F2F0EC',
  inkSoft: '#6B6B6B', border: '#E8E6E2',
};
const FB = "'Archivo', system-ui, sans-serif";
const FBB = "'Archivo Black', 'Archivo', sans-serif";
const FCN = "'Noto Sans SC', 'Archivo', sans-serif";
const FM = "'JetBrains Mono', ui-monospace, monospace";

// ── QR real de WeChat (sobre tarjeta crema para que escanee siempre) ─
function QR({ size }) {
  size = size || 156;
  return (
    <div style={{ width: size, height: size, background: '#fff', borderRadius: 14, padding: size * 0.06, boxSizing: 'border-box', boxShadow: '0 6px 18px rgba(0,0,0,0.25)' }}>
      <img src="wechat/qr-wechat.png" alt="QR WeChat DTD-Cargo" style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }} />
    </div>
  );
}

// ── Isólogo (imagen oficial) ───────────────────────────────────────
function Iso({ variant, h }) {
  const src = variant === 'reverse' ? 'assets/dtdcargo-isologo-reverse.png'
    : variant === 'mono-light' ? 'assets/dtdcargo-isologo-mono-light.png'
    : 'assets/dtdcargo-isologo-primary.png';
  return <img src={src} alt="DTD-Cargo" style={{ height: h, width: 'auto', display: 'block' }} />;
}

// ── Wordmark "DTD Cargo" (DOS palabras · Archivo Black) ─────────────
function Wordmark({ size, onDark }) {
  return (
    <span style={{ font: '900 ' + size + 'px/1 ' + FBB, letterSpacing: '-0.02em', display: 'inline-flex', alignItems: 'baseline', whiteSpace: 'nowrap' }}>
      <span style={{ color: onDark ? '#fff' : C.wine }}>DTD</span>
      <span style={{ display: 'inline-block', width: '0.15em' }}></span>
      <span style={{ color: onDark ? '#F2F0EC' : C.ink }}>Cargo</span>
    </span>
  );
}

// ── Módulo de ruta China → Venezuela (geométrico, escalable) ───────
function RouteArc({ light }) {
  const fg = light ? C.ink : '#fff';
  const sub = C.wineSoft;
  return (
    <svg viewBox="0 0 920 300" style={{ width: '100%', height: 'auto', display: 'block' }} aria-label="Ruta China a Venezuela">
      {/* línea de ruta */}
      <path d="M140,185 Q460,40 780,185" fill="none" stroke={sub} strokeWidth="3.5" strokeDasharray="2 13" strokeLinecap="round" opacity="0.9" />
      {/* endpoint origen */}
      <circle cx="140" cy="185" r="13" fill="none" stroke={sub} strokeWidth="3" />
      <circle cx="140" cy="185" r="6" fill={sub} />
      {/* endpoint destino */}
      <circle cx="780" cy="185" r="13" fill="none" stroke={sub} strokeWidth="3" />
      <circle cx="780" cy="185" r="6" fill={sub} />
      {/* marcador CBM en el ápice */}
      <circle cx="460" cy="62" r="44" fill={C.wine} stroke={sub} strokeWidth="3" />
      <text x="460" y="58" textAnchor="middle" style={{ font: '900 26px ' + FBB, fill: '#fff', letterSpacing: '0.02em' }}>CBM</text>
      <text x="460" y="80" textAnchor="middle" style={{ font: '700 14px ' + FM, fill: '#F4C9CF' }}>m³</text>
      {/* etiqueta origen */}
      <text x="140" y="232" textAnchor="middle" style={{ font: '800 24px ' + FB, fill: fg }}>GUANGZHOU</text>
      <text x="140" y="262" textAnchor="middle" style={{ font: '700 20px ' + FCN, fill: sub }}>广州 · 中国</text>
      {/* etiqueta destino */}
      <text x="780" y="232" textAnchor="middle" style={{ font: '800 24px ' + FB, fill: fg }}>VALENCIA</text>
      <text x="780" y="262" textAnchor="middle" style={{ font: '700 20px ' + FB, fill: sub }}>VENEZUELA</text>
    </svg>
  );
}

// ── Chip ───────────────────────────────────────────────────────────
function Chip({ children, onDark }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 10,
      font: '800 18px/1 ' + FB, letterSpacing: '0.02em',
      color: onDark ? '#fff' : C.ink,
      background: onDark ? 'rgba(255,255,255,0.07)' : '#fff',
      border: '1.5px solid ' + (onDark ? 'rgba(194,116,127,0.5)' : C.border),
      borderRadius: 999, padding: '12px 20px',
    }}>{children}</span>
  );
}

// ── Eyebrow ─────────────────────────────────────────────────────────
function Eyebrow({ children, color }) {
  return (
    <div style={{ font: '800 20px/1 ' + FB, letterSpacing: '0.32em', textTransform: 'uppercase', color: color || C.wineSoft }}>{children}</div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 1 · PORTADA MOMENTS · typográfica navy (1080 × 1920)
// ══════════════════════════════════════════════════════════════════
function CoverNavy() {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'linear-gradient(160deg, ' + C.ink + ' 0%, ' + C.ink2 + ' 100%)', color: '#fff', fontFamily: FB, overflow: 'hidden' }}>
      {/* textura sutil de longitudes */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 120px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: -160, right: -160, width: 620, height: 620, borderRadius: '50%', border: '2px solid rgba(194,116,127,0.18)' }} />
      <div style={{ position: 'absolute', top: -90, right: -90, width: 460, height: 460, borderRadius: '50%', border: '2px solid rgba(194,116,127,0.12)' }} />

      <div style={{ position: 'absolute', inset: 0, padding: '92px 84px', display: 'flex', flexDirection: 'column' }}>
        {/* marca */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <Iso variant="reverse" h={104} />
          <Wordmark size={50} onDark />
        </div>

        <div style={{ marginTop: 64 }}>
          <Eyebrow>Carga marítima · 海运 · China → Venezuela</Eyebrow>
          <h1 style={{ font: '900 158px/0.9 ' + FBB, letterSpacing: '-0.035em', margin: '30px 0 0', color: '#fff' }}>
            PUERTA<br />A PUERTA
          </h1>
          <div style={{ font: '900 104px/1 ' + FCN, color: C.wineSoft, marginTop: 22, letterSpacing: '0.04em' }}>门到门</div>
          <p style={{ font: '500 31px/1.5 ' + FB, color: 'rgba(242,240,236,0.82)', margin: '34px 0 0', maxWidth: '20ch' }}>
            Tú compras en China, nosotros lo llevamos hasta tu puerta en Venezuela. Financiamiento 100%, pagas al llegar.
          </p>
        </div>

        {/* ruta */}
        <div style={{ marginTop: 'auto', marginBottom: 8 }}>
          <RouteArc />
        </div>

        {/* chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 30 }}>
          <Chip onDark>Cotiza tu CBM</Chip>
          <Chip onDark>Sin intermediarios</Chip>
          <Chip onDark>DDP · todo incluido</Chip>
        </div>

        {/* tagline */}
        <div style={{ marginTop: 40, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
          <div style={{ font: '800 34px/1.25 ' + FB, color: '#fff', maxWidth: '14ch' }}>
            Con Confianza,<br /><span style={{ color: C.wineSoft }}>de China a tu puerta.</span>
          </div>
          <div style={{ flexShrink: 0, textAlign: 'center' }}>
            <QR size={168} />
            <div style={{ font: '700 15px/1.2 ' + FB, color: 'rgba(255,255,255,0.6)', marginTop: 12, letterSpacing: '0.04em' }}>ESCANEA · 扫码咨询</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 2 · PORTADA MOMENTS · con foto del contenedor (1080 × 1920)
// ══════════════════════════════════════════════════════════════════
function CoverPhoto() {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: C.paper, fontFamily: FB, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* zona superior · foto */}
      <div style={{ position: 'relative', height: 1040, flexShrink: 0, background: 'linear-gradient(180deg, #EAF0F4 0%, ' + C.paper + ' 100%)' }}>
        <div style={{ position: 'absolute', top: 64, left: 72, right: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 2 }}>
          <Wordmark size={46} />
          <Iso variant="primary" h={108} />
        </div>
        <image-slot id="wechat-container" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} shape="rect" fit="cover" placeholder="Arrastra aquí tu render del contenedor" src="wechat/container-real.jpg"></image-slot>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 220, background: 'linear-gradient(180deg, rgba(251,250,247,0) 0%, ' + C.paper + ' 92%)', pointerEvents: 'none' }} />
      </div>

      {/* zona inferior · mensaje */}
      <div style={{ flex: 1, background: 'linear-gradient(160deg, ' + C.ink + ' 0%, ' + C.ink2 + ' 100%)', color: '#fff', padding: '60px 72px 76px', display: 'flex', flexDirection: 'column' }}>
        <Eyebrow>#ServiciosDTD · Carga marítima · 海运</Eyebrow>
        <h1 style={{ font: '900 132px/0.9 ' + FBB, letterSpacing: '-0.035em', margin: '24px 0 0' }}>
          PUERTA <span style={{ color: C.wineSoft }}>A PUERTA</span>
        </h1>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 20, marginTop: 18 }}>
          <span style={{ font: '900 72px/1 ' + FCN, color: '#fff', whiteSpace: 'nowrap', flexShrink: 0 }}>门到门</span>
          <span style={{ font: '700 30px/1 ' + FB, color: C.wineSoft, letterSpacing: '0.04em' }}>China ⇄ Venezuela</span>
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <div style={{ font: '800 32px/1.25 ' + FB, maxWidth: '16ch' }}>Con Confianza, <span style={{ color: C.wineSoft }}>de China a tu puerta.</span></div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <Chip onDark>Cotiza tu CBM</Chip>
              <Chip onDark>DDP · financiado</Chip>
            </div>
          </div>
          <div style={{ flexShrink: 0, textAlign: 'center' }}>
            <QR size={156} />
            <div style={{ font: '700 14px/1.2 ' + FB, color: 'rgba(255,255,255,0.6)', marginTop: 11, letterSpacing: '0.04em' }}>扫码咨询</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 3 · AVATARES (1080 × 1080 · se ven CHICOS en WeChat → texto enorme)
//     Comunican "puerta a puerta" en una sola imagen.
// ══════════════════════════════════════════════════════════════════

// A · Isólogo + 门到门 grande (lo más legible en miniatura)
function AvatarMenDao() {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'linear-gradient(150deg, ' + C.ink + ' 0%, ' + C.ink2 + ' 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', fontFamily: FB }}>
      <div style={{ position: 'absolute', top: -120, width: 900, height: 900, borderRadius: '50%', border: '4px solid rgba(194,116,127,0.16)' }} />
      <Iso variant="reverse" h={300} />
      <div style={{ font: '900 280px/0.86 ' + FCN, color: '#fff', letterSpacing: '0.02em', marginTop: 24, textAlign: 'center' }}>门到门</div>
      <div style={{ font: '800 46px/1 ' + FB, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.wineSoft, marginTop: 28 }}>Puerta a Puerta</div>
    </div>
  );
}

// B · Anillo "CHINA → VENEZUELA" alrededor del isólogo
function AvatarRing() {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'linear-gradient(150deg, ' + C.ink + ' 0%, ' + C.ink2 + ' 100%)', overflow: 'hidden' }}>
      <svg viewBox="0 0 1080 1080" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <defs>
          <path id="ringTop" d="M 540,540 m -376,0 a 376,376 0 1,1 752,0" fill="none" />
          <path id="ringBot" d="M 164,540 a 376,376 0 0,0 752,0" fill="none" />
        </defs>
        <circle cx="540" cy="540" r="470" fill="none" stroke="rgba(194,116,127,0.16)" strokeWidth="4" />
        <circle cx="540" cy="540" r="430" fill="none" stroke="rgba(194,116,127,0.30)" strokeWidth="3" />
        <text style={{ font: '900 70px ' + FB, fill: '#fff', letterSpacing: '0.14em' }}>
          <textPath href="#ringTop" startOffset="50%" textAnchor="middle">CHINA → VENEZUELA</textPath>
        </text>
        <text style={{ font: '800 58px ' + FB, fill: C.wineSoft, letterSpacing: '0.22em' }}>
          <textPath href="#ringBot" startOffset="50%" textAnchor="middle">PUERTA A PUERTA</textPath>
        </text>
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Iso variant="reverse" h={300} />
        <div style={{ font: '900 150px/0.9 ' + FCN, color: '#fff', marginTop: 18 }}>门到门</div>
      </div>
    </div>
  );
}

// C · Banda wine inferior "门到门 · PUERTA A PUERTA"
function AvatarBand() {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'linear-gradient(150deg, ' + C.ink + ' 0%, ' + C.ink2 + ' 100%)', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: FB }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        <Iso variant="reverse" h={330} />
        <div style={{ font: '900 230px/0.86 ' + FCN, color: '#fff' }}>门到门</div>
      </div>
      <div style={{ background: C.wine, padding: '40px 0 46px', textAlign: 'center' }}>
        <div style={{ font: '900 72px/1 ' + FBB, color: '#fff', letterSpacing: '-0.01em' }}>PUERTA A PUERTA</div>
        <div style={{ font: '800 40px/1 ' + FB, color: '#F4C9CF', letterSpacing: '0.16em', marginTop: 16 }}>CHINA ⇄ VENEZUELA</div>
      </div>
    </div>
  );
}

// ── Contenedor llenándose · ILUSTRACIÓN de marca (no es una foto) ───
function ContainerFill({ pct }) {
  pct = pct == null ? 0.72 : pct;
  // dibujo isométrico simple de un contenedor con cajas apiladas
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'linear-gradient(160deg, ' + C.ink + ' 0%, ' + C.ink2 + ' 100%)', fontFamily: FB, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'absolute', top: 56, left: 60, right: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 2 }}>
        <Wordmark size={42} onDark />
        <Iso variant="reverse" h={96} />
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '180px 70px 40px' }}>
        <svg viewBox="0 0 900 460" style={{ width: '100%', height: 'auto' }}>
          {/* piso */}
          <path d="M120,400 L780,400" stroke="rgba(255,255,255,0.18)" strokeWidth="3" />
          {/* contenedor · caja */}
          <rect x="150" y="120" width="600" height="280" fill="rgba(255,255,255,0.04)" stroke="#fff" strokeWidth="4" rx="6" />
          {/* corrugado */}
          {Array.from({ length: 13 }).map((_, i) => (
            <line key={i} x1={180 + i * 45} y1="120" x2={180 + i * 45} y2="400" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
          ))}
          {/* relleno wine (cajas) */}
          <clipPath id="cont"><rect x="150" y="120" width="600" height="280" rx="6" /></clipPath>
          <g clipPath="url(#cont)">
            <rect x="150" y={120 + 280 * (1 - pct)} width="600" height={280 * pct} fill={C.wine} opacity="0.92" />
            {/* líneas de cajas */}
            {Array.from({ length: 6 }).map((_, r) => Array.from({ length: 10 }).map((_, c2) => (
              <rect key={r + '-' + c2} x={158 + c2 * 60} y={128 + r * 45} width="54" height="40" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
            )))}
          </g>
          {/* puertas */}
          <line x1="450" y1="120" x2="450" y2="400" stroke="#fff" strokeWidth="3" opacity="0.5" />
          {/* % */}
          <text x="450" y="270" textAnchor="middle" style={{ font: '900 120px ' + FBB, fill: '#fff', letterSpacing: '-0.03em' }}>{Math.round(pct * 100)}%</text>
        </svg>
      </div>
      <div style={{ background: C.wine, padding: '44px 60px 50px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 30 }}>
        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
          <div style={{ font: '900 52px/1.05 ' + FBB, color: '#fff', letterSpacing: '-0.02em' }}>LLENA TU<br />CBM</div>
          <div style={{ font: '700 28px/1 ' + FCN, color: '#F4C9CF', marginTop: 20 }}>装柜 · 拼箱 LCL</div>
        </div>
        <div style={{ font: '800 25px/1.4 ' + FB, color: '#fff', textAlign: 'right', letterSpacing: '0.04em', width: 200, flexShrink: 0 }}>Pagas solo<br />tu volumen</div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 4 · POST #ServiciosDTD (1080 × 1080) · versión corregida de marca
// ══════════════════════════════════════════════════════════════════
function PostServicios() {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'linear-gradient(180deg, #EAF0F4 0%, ' + C.paper + ' 60%)', fontFamily: FB, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'absolute', top: 56, left: 60, right: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 2 }}>
        <Wordmark size={42} />
        <Iso variant="primary" h={96} />
      </div>

      <div style={{ position: 'relative', flex: 1, marginTop: 150 }}>
        <image-slot id="wechat-post-container" style={{ position: 'absolute', inset: '0 40px', width: 'auto', height: '100%', display: 'block' }} shape="rect" fit="cover" placeholder="Arrastra tu render del contenedor" src="wechat/container-real.jpg"></image-slot>
      </div>

      <div style={{ background: 'linear-gradient(160deg, ' + C.ink + ' 0%, ' + C.ink2 + ' 100%)', color: '#fff', padding: '46px 60px 54px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
        <div>
          <div style={{ font: '800 26px/1 ' + FB, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.wineSoft }}>#ServiciosDTD</div>
          <div style={{ font: '900 92px/0.92 ' + FBB, letterSpacing: '-0.03em', marginTop: 14 }}>
            CARGA <span style={{ color: C.wineSoft }}>MARÍTIMA</span>
          </div>
          <div style={{ font: '700 30px/1 ' + FCN, color: 'rgba(242,240,236,0.8)', marginTop: 14 }}>海运 · 门到门</div>
        </div>
        <div style={{ flexShrink: 0, textAlign: 'center' }}>
          <QR size={150} />
          <div style={{ font: '700 13px/1.2 ' + FB, color: 'rgba(255,255,255,0.6)', marginTop: 10, letterSpacing: '0.04em' }}>扫码咨询</div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { CoverNavy, CoverPhoto, AvatarMenDao, AvatarRing, AvatarBand, ContainerFill, PostServicios });
