/* global React, window */
/* ── DTD-Cargo · Prendas sobre MANIQUÍ v3 ──────────────────────────
   Busto neutro + prenda con volumen (gradientes) y caída de tela.
   viewBox 0 0 400 470. Cada garment recibe fill, side, id (único).
   El estampado lo pone el card encima.                               */

let _uid = 0;
const nextId = () => 'g' + (++_uid);

function gshade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.max(0, Math.min(255, Math.round(r + amt)));
  g = Math.max(0, Math.min(255, Math.round(g + amt)));
  b = Math.max(0, Math.min(255, Math.round(b + amt)));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
function glight(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) > 150;
}

// Maniquí (busto neutro) detrás de la prenda
function Bust() {
  return (
    <g style={{ pointerEvents: 'none' }}>
      <defs>
        <linearGradient id="bustG" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#B7B5B0" />
          <stop offset="0.5" stopColor="#D6D4CF" />
          <stop offset="1" stopColor="#B0AEA9" />
        </linearGradient>
      </defs>
      {/* cuello */}
      <path d="M176,40 Q176,86 168,104 L232,104 Q224,86 224,40 Q200,30 176,40 Z" fill="url(#bustG)" />
      {/* hombros/torso asomando */}
      <path d="M150,104 Q200,92 250,104 L262,150 Q200,140 138,150 Z" fill="url(#bustG)" />
      <ellipse cx="200" cy="438" rx="120" ry="14" fill="rgba(15,30,61,0.08)" />
    </g>
  );
}

// Gradientes de volumen para una prenda
function VolDefs({ id, fill }) {
  const light = glight(fill);
  const c = fill;
  const dk = gshade(fill, light ? -26 : -34);
  const dk2 = gshade(fill, light ? -14 : -20);
  const hi = gshade(fill, light ? 16 : 40);
  return (
    <defs>
      <linearGradient id={id + 'b'} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={dk} />
        <stop offset="0.18" stopColor={dk2} />
        <stop offset="0.5" stopColor={hi} />
        <stop offset="0.82" stopColor={dk2} />
        <stop offset="1" stopColor={dk} />
      </linearGradient>
      <radialGradient id={id + 'c'} cx="0.5" cy="0.32" r="0.5">
        <stop offset="0" stopColor={gshade(fill, light ? 22 : 52)} stopOpacity={light ? 0.5 : 0.55} />
        <stop offset="1" stopColor={hi} stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

// Contorno tee (sobre cuerpo): hombros caídos, mangas con caída, cintura
function teePath(side) {
  const neck = side === 'back' ? 'C170,108 230,108 232,96' : 'C170,120 230,120 232,96';
  return `M168,96 ${neck} L300,104 L356,150 L330,210 L292,182
    C296,250 300,320 294,372 Q200,386 106,372 C100,320 104,250 108,182
    L70,210 L44,150 L100,104 Z`;
}

function Tee({ fill, side, id }) {
  id = id || nextId();
  const stroke = gshade(fill, glight(fill) ? -40 : -50);
  const seam = glight(fill) ? gshade(fill, -20) : gshade(fill, 32);
  return (
    <g>
      <Bust />
      <VolDefs id={id} fill={fill} />
      <path d={teePath(side)} fill={fill} stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
      <path d={teePath(side)} fill={'url(#' + id + 'b)'} opacity="0.55" style={{ pointerEvents: 'none' }} />
      <path d={teePath(side)} fill={'url(#' + id + 'c)'} style={{ pointerEvents: 'none' }} />
      {/* ribbing cuello */}
      {side === 'front'
        ? <path d="M168,96 C170,120 230,120 232,96 C230,110 170,110 168,96 Z" fill="none" stroke={stroke} strokeWidth="2" />
        : <path d="M168,96 C170,108 230,108 232,96" fill="none" stroke={stroke} strokeWidth="2" />}
      {/* caída de tela / pliegues */}
      <path d="M150,210 Q160,300 158,370" fill="none" stroke={seam} strokeWidth="1.4" opacity="0.45" />
      <path d="M250,210 Q240,300 242,370" fill="none" stroke={seam} strokeWidth="1.4" opacity="0.45" />
      <path d="M120,300 Q130,250 150,232" fill="none" stroke={seam} strokeWidth="1.2" opacity="0.35" />
      <path d="M280,300 Q270,250 250,232" fill="none" stroke={seam} strokeWidth="1.2" opacity="0.35" />
      {/* dobladillos manga */}
      <path d="M44,150 L70,210" fill="none" stroke={seam} strokeWidth="1" opacity="0.3" />
      <path d="M356,150 L330,210" fill="none" stroke={seam} strokeWidth="1" opacity="0.3" />
    </g>
  );
}

function Polo({ fill, side, id }) {
  id = id || nextId();
  const stroke = gshade(fill, glight(fill) ? -40 : -50);
  const seam = glight(fill) ? gshade(fill, -20) : gshade(fill, 32);
  const collarFill = gshade(fill, glight(fill) ? -8 : 16);
  return (
    <g>
      <Bust />
      <VolDefs id={id} fill={fill} />
      <path d={teePath(side)} fill={fill} stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
      <path d={teePath(side)} fill={'url(#' + id + 'b)'} opacity="0.55" style={{ pointerEvents: 'none' }} />
      <path d={teePath(side)} fill={'url(#' + id + 'c)'} style={{ pointerEvents: 'none' }} />
      <path d="M150,210 Q160,300 158,370" fill="none" stroke={seam} strokeWidth="1.4" opacity="0.45" />
      <path d="M250,210 Q240,300 242,370" fill="none" stroke={seam} strokeWidth="1.4" opacity="0.45" />
      {side === 'front' ? (
        <g>
          <path d="M192,112 L192,178 M208,112 L208,178" fill="none" stroke={seam} strokeWidth="1.4" opacity="0.7" />
          <circle cx="200" cy="130" r="3" fill="none" stroke={seam} strokeWidth="1.3" />
          <circle cx="200" cy="156" r="3" fill="none" stroke={seam} strokeWidth="1.3" />
          <path d="M168,96 L200,124 L232,96 L222,86 L200,102 L178,86 Z" fill={collarFill} stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
        </g>
      ) : (
        <path d="M168,96 C170,110 230,110 232,96 L226,88 C226,98 174,98 174,88 Z" fill={collarFill} stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" />
      )}
    </g>
  );
}

window.UNIv3 = window.UNIv3 || {};
Object.assign(window.UNIv3, { Tee, Polo, _gshade: gshade, _glight: glight, _teePath: teePath, _Bust: Bust, _VolDefs: VolDefs, _nextId: nextId });
