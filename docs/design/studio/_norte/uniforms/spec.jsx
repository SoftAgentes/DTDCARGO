/* global React, window */
/* ── DTD-Cargo · Ficha técnica · cotas + zonas de estampado ────────
   Todo en el viewBox 0 0 400 460 del garment para alinear cotas.    */
const INK = '#0F1E3D', WINE = '#7F0F1A', MUTE = '#9B9B9B', SOFT = '#6B6B6B';
const FB = "'Archivo', system-ui, sans-serif";
const FBB = "'Archivo Black', 'Archivo', sans-serif";
const FCN = "'Noto Sans SC','Archivo',sans-serif";

// ── Cota horizontal ────────────────────────────────────────────────
function DimH({ x1, x2, y, label }) {
  return (
    <g>
      <line x1={x1} y1={y - 5} x2={x1} y2={y + 5} stroke={WINE} strokeWidth="1.2" />
      <line x1={x2} y1={y - 5} x2={x2} y2={y + 5} stroke={WINE} strokeWidth="1.2" />
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={WINE} strokeWidth="1.2" />
      <rect x={(x1 + x2) / 2 - 20} y={y - 9} width="40" height="14" fill="#fff" />
      <text x={(x1 + x2) / 2} y={y + 1} textAnchor="middle" style={{ font: '700 11px ' + FB, fill: WINE }}>{label}</text>
    </g>
  );
}
// ── Cota vertical ──────────────────────────────────────────────────
function DimV({ y1, y2, x, label }) {
  return (
    <g>
      <line x1={x - 5} y1={y1} x2={x + 5} y2={y1} stroke={WINE} strokeWidth="1.2" />
      <line x1={x - 5} y1={y2} x2={x + 5} y2={y2} stroke={WINE} strokeWidth="1.2" />
      <line x1={x} y1={y1} x2={x} y2={y2} stroke={WINE} strokeWidth="1.2" />
      <rect x={x - 20} y={(y1 + y2) / 2 - 7} width="40" height="14" fill="#fff" />
      <text x={x} y={(y1 + y2) / 2 + 1} textAnchor="middle" style={{ font: '700 11px ' + FB, fill: WINE }}>{label}</text>
    </g>
  );
}
// ── Zona de estampado (caja punteada) ──────────────────────────────
function Zone({ x, y, w, h }) {
  return <rect x={x} y={y} width={w} height={h} fill="none" stroke={WINE} strokeWidth="1.4" strokeDasharray="5 3" opacity="0.85" />;
}

// ── Marca dentro de la zona ────────────────────────────────────────
// isovariant: 'primary' (sobre claro) | 'reverse'/'mono-light' (sobre oscuro)
function IsoMark({ x, y, w, dark }) {
  const src = dark ? 'assets/dtdcargo-isologo-reverse.png' : 'assets/dtdcargo-isologo-primary.png';
  const h = w * (764 / 741);
  return <image href={src} x={x} y={y} width={w} height={h} preserveAspectRatio="xMidYMid meet" />;
}
function WordMark({ cx, y, size, dark }) {
  // Dos <text> separados (no tspan): el fill por-tspan se pierde al exportar a PNG/PDF.
  const cDTD = dark ? '#fff' : WINE;
  const cCargo = dark ? '#F2F0EC' : INK;
  const f = '900 ' + size + 'px ' + FBB;
  const gap = size * 0.16;
  return (
    <g>
      <text x={cx - gap} y={y} textAnchor="end" style={{ font: f, letterSpacing: '-0.02em', fill: cDTD }}>DTD</text>
      <text x={cx + gap} y={y} textAnchor="start" style={{ font: f, letterSpacing: '-0.02em', fill: cCargo }}>Cargo</text>
    </g>
  );
}
function QRMark({ x, y, w }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={w} fill="#fff" stroke={INK} strokeWidth="1.5" rx="3" />
      <image href="wechat/qr-wechat.png" x={x + w * 0.08} y={y + w * 0.08} width={w * 0.84} height={w * 0.84} preserveAspectRatio="xMidYMid meet" />
    </g>
  );
}

Object.assign(window, { _uniDimH: DimH, _uniDimV: DimV, _uniZone: Zone, _uniIso: IsoMark, _uniWord: WordMark, _uniQR: QRMark,
  _UNI: { INK, WINE, MUTE, SOFT, FB, FBB, FCN } });
