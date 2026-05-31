/* ── Iconos de Grupo/Departamento · DTD-Cargo ────────────────── */
/* Sumamos al sistema 7 individuales: 4 íconos de grupo o área.  */

// Extend the theme with new group entries
Object.assign(window.ROLE_THEME || (window.ROLE_THEME = {}), ROLE_THEME, {
  oficina:       { bg: '#0F1E3D', fg: '#FBFAF7', accent: '#C2747F', label: 'Oficina',           tag: 'Grupo · todos' },
  despachos:     { bg: '#F2F0EC', fg: '#0F1E3D', accent: '#7F0F1A', label: 'Despachos',         tag: 'Shipping team' },
  marketing:     { bg: '#7F0F1A', fg: '#FBFAF7', accent: '#FBFAF7', label: 'Marketing & Estrategia', tag: 'Growth · brand' },
  redessociales: { bg: '#0F1E3D', fg: '#FBFAF7', accent: '#C2747F', label: 'Redes Sociales',    tag: 'IG · TT · LinkedIn' },
  crm:           { bg: '#0F1E3D', fg: '#FBFAF7', accent: '#7F0F1A', label: 'CRM · Atención al Cliente', tag: 'Línea oficial' },
  alianzas:      { bg: '#0F1E3D', fg: '#FBFAF7', accent: '#7F0F1A', label: 'Alianzas Estratégicas', tag: 'Partners · B2B' },
  comunidad:     { bg: '#7F0F1A', fg: '#FBFAF7', accent: '#FBFAF7', label: 'Comunidad',         tag: 'Clients · network' },
});

/* ── 8 · OFICINA · grupo con 4 mini avatares ──────────────────── */
function GlyphOficina() {
  // 4 mini avatars composed in a circle, each with a small badge representing a role
  // Centered around (200, 200), radius 90
  const cx = 200, cy = 200, r = 90;
  // 4 positions: top, right, bottom, left
  const avatars = [
    { x: cx,      y: cy - r, color: '#FBFAF7', glyph: 'A' },   // Almacenista
    { x: cx + r,  y: cy,     color: '#7F0F1A', glyph: 'L' },   // Logística (wine bg)
    { x: cx,      y: cy + r, color: '#FBFAF7', glyph: 'C' },   // Contabilidad
    { x: cx - r,  y: cy,     color: '#C2747F', glyph: 'M' },   // Mgmt/CEO
  ];
  return (
    <g>
      {/* Center connecting ring */}
      <circle cx={cx} cy={cy} r={56} fill="none" stroke="#C2747F" strokeWidth="2" strokeDasharray="3 4" opacity="0.4" />
      <text x={cx} y={cy + 6} textAnchor="middle" fontFamily="Archivo Black, sans-serif" fontWeight="900" fontSize="22" fill="#FBFAF7" letterSpacing="-0.02em">DTD</text>
      {/* Connecting lines from center to each avatar */}
      {avatars.map((a, i) => (
        <line key={'ln'+i} x1={cx} y1={cy} x2={a.x} y2={a.y} stroke="#C2747F" strokeWidth="1.5" opacity="0.25" />
      ))}
      {/* Avatars */}
      {avatars.map((a, i) => (
        <g key={i} className={'of-av-' + (i+1)} style={{ animationDelay: (i * 0.15) + 's' }}>
          <circle cx={a.x} cy={a.y} r={40} fill={a.color} />
          <circle cx={a.x} cy={a.y - 8} r={14} fill="#0F1E3D" />
          <path d={`M ${a.x - 22} ${a.y + 26} Q ${a.x} ${a.y + 8} ${a.x + 22} ${a.y + 26} L ${a.x + 22} ${a.y + 38} L ${a.x - 22} ${a.y + 38} Z`} fill="#0F1E3D"/>
          <text x={a.x} y={a.y - 4} textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontWeight="700" fontSize="9" fill={a.color}>{a.glyph}</text>
        </g>
      ))}
    </g>
  );
}

/* ── 9 · DESPACHOS · package + stamp + tracking ──────────────── */
function GlyphDespachos() {
  return (
    <g>
      {/* Conveyor / table */}
      <line x1="60" y1="290" x2="340" y2="290" stroke="#0F1E3D" strokeOpacity="0.25" strokeWidth="3" />
      <line x1="60" y1="290" x2="340" y2="290" stroke="#7F0F1A" strokeWidth="3" strokeDasharray="10 8" className="d-belt"/>

      {/* Package box */}
      <g className="d-box">
        <rect x="118" y="172" width="164" height="120" rx="6" fill="#FBFAF7" stroke="#0F1E3D" strokeWidth="3"/>
        {/* Tape strap (vertical) */}
        <rect x="186" y="172" width="28" height="120" fill="#C2747F" opacity="0.55"/>
        {/* Label rectangle */}
        <rect x="132" y="190" width="100" height="30" fill="#0F1E3D" opacity="0.06"/>
        <text x="142" y="208" fontFamily="JetBrains Mono, monospace" fontSize="11" fontWeight="700" fill="#0F1E3D" letterSpacing="0.08em">DTDU-472</text>
        {/* Address lines */}
        <line x1="132" y1="234" x2="232" y2="234" stroke="#0F1E3D" strokeWidth="2" opacity="0.25"/>
        <line x1="132" y1="248" x2="218" y2="248" stroke="#0F1E3D" strokeWidth="2" opacity="0.25"/>
        <line x1="132" y1="262" x2="240" y2="262" stroke="#0F1E3D" strokeWidth="2" opacity="0.25"/>
      </g>

      {/* Despacho stamp · ENVIADO */}
      <g className="d-stamp">
        <g transform="translate(248 142) rotate(-8)">
          <rect x="-58" y="-22" width="116" height="44" rx="4" fill="none" stroke="#7F0F1A" strokeWidth="3.5"/>
          <rect x="-54" y="-18" width="108" height="36" rx="2" fill="none" stroke="#7F0F1A" strokeWidth="1.5"/>
          <text textAnchor="middle" y="6" fontFamily="Archivo Black, sans-serif" fontSize="18" fontWeight="900" fill="#7F0F1A" letterSpacing="0.06em">ENVIADO</text>
        </g>
      </g>

      {/* Outgoing arrow */}
      <g className="d-arrow">
        <path d="M 280 320 L 340 320 M 326 308 L 340 320 L 326 332" stroke="#7F0F1A" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      </g>
    </g>
  );
}

/* ── 10 · MARKETING & ESTRATEGIA · chart + flecha ascendente ──── */
function GlyphMarketing() {
  const fg = '#FBFAF7';
  // bars (4) with growing heights
  const bars = [
    { x: 92,  h: 60, delay: 0.0 },
    { x: 142, h: 100, delay: 0.15 },
    { x: 192, h: 140, delay: 0.3 },
    { x: 242, h: 188, delay: 0.45 },
  ];
  return (
    <g>
      {/* Axis */}
      <line x1="72" y1="320" x2="320" y2="320" stroke={fg} strokeOpacity="0.4" strokeWidth="2"/>
      <line x1="72" y1="320" x2="72" y2="100" stroke={fg} strokeOpacity="0.4" strokeWidth="2"/>

      {/* Bars */}
      {bars.map((b, i) => (
        <rect key={i}
          className="m-bar"
          style={{ animationDelay: b.delay + 's', transformOrigin: 'bottom' }}
          x={b.x} y={320 - b.h}
          width="32" height={b.h}
          fill={fg}
          opacity={0.6 + (i * 0.1)}
          rx="2"
        />
      ))}

      {/* Trending arrow */}
      <g className="m-arrow">
        <path d="M 92 280 L 132 230 L 172 200 L 212 160 L 252 124 L 292 90"
              stroke="#FBFAF7" strokeWidth="5" fill="none"
              strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray="400" strokeDashoffset="400"
        />
        {/* Arrowhead */}
        <path d="M 278 86 L 296 86 L 296 104"
              stroke="#FBFAF7" strokeWidth="5" fill="none"
              strokeLinecap="round" strokeLinejoin="round"/>
      </g>

      {/* Megaphone hint top-left */}
      <g className="m-mega" opacity="0.85">
        <g transform="translate(76 78) rotate(-22)">
          <path d="M 0 -8 L 24 -16 L 24 16 L 0 8 Z" fill={fg}/>
          <rect x="22" y="-10" width="14" height="20" rx="2" fill={fg}/>
          <line x1="40" y1="-14" x2="48" y2="-18" stroke={fg} strokeWidth="2" strokeLinecap="round"/>
          <line x1="40" y1="0" x2="50" y2="0" stroke={fg} strokeWidth="2" strokeLinecap="round"/>
          <line x1="40" y1="14" x2="48" y2="18" stroke={fg} strokeWidth="2" strokeLinecap="round"/>
        </g>
      </g>
    </g>
  );
}

/* ── 11 · CRM · ATENCIÓN AL CLIENTE · headset + speech bubbles ── */
function GlyphCRM() {
  const fg = '#FBFAF7';
  const accent = '#7F0F1A';
  return (
    <g>
      {/* Headset band */}
      <path d="M 110 200 C 110 130, 170 90, 200 90 C 230 90, 290 130, 290 200"
            stroke={fg} strokeWidth="14" fill="none" strokeLinecap="round"/>

      {/* Ear cushions */}
      <g>
        <rect x="86" y="190" width="44" height="64" rx="10" fill={fg}/>
        <rect x="92" y="196" width="32" height="52" rx="6" fill="#0F1E3D" opacity="0.6"/>
        <circle cx="108" cy="222" r="6" fill={accent}/>
      </g>
      <g>
        <rect x="270" y="190" width="44" height="64" rx="10" fill={fg}/>
        <rect x="276" y="196" width="32" height="52" rx="6" fill="#0F1E3D" opacity="0.6"/>
        <circle cx="292" cy="222" r="6" fill={accent}/>
      </g>

      {/* Microphone arm */}
      <path d="M 130 250 Q 150 296, 196 304" stroke={fg} strokeWidth="6" fill="none" strokeLinecap="round"/>
      <circle cx="196" cy="306" r="10" fill={accent}/>
      <circle cx="196" cy="306" r="5" fill={fg}/>

      {/* Speech bubble left */}
      <g className="crm-bubble-left">
        <path d="M 30 110 L 78 110 Q 88 110, 88 120 L 88 154 Q 88 164, 78 164 L 50 164 L 36 178 L 40 164 L 30 164 Q 20 164, 20 154 L 20 120 Q 20 110, 30 110 Z"
              fill={fg}/>
        <circle cx="36" cy="137" r="3" fill="#0F1E3D"/>
        <circle cx="54" cy="137" r="3" fill="#0F1E3D"/>
        <circle cx="72" cy="137" r="3" fill="#0F1E3D"/>
      </g>

      {/* Speech bubble right */}
      <g className="crm-bubble-right">
        <path d="M 322 110 L 370 110 Q 380 110, 380 120 L 380 154 Q 380 164, 370 164 L 358 164 L 362 178 L 348 164 L 322 164 Q 312 164, 312 154 L 312 120 Q 312 110, 322 110 Z"
              fill={accent}/>
        <circle cx="328" cy="137" r="3" fill="#FBFAF7"/>
        <circle cx="346" cy="137" r="3" fill="#FBFAF7"/>
        <circle cx="364" cy="137" r="3" fill="#FBFAF7"/>
      </g>

      {/* "24/7" badge subtle */}
      <text x="200" y="346" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontWeight="700" fontSize="11" fill={accent} letterSpacing="0.18em" opacity="0.9">24 / 7 · ES · 中文</text>
    </g>
  );
}

Object.assign(window, {
  GlyphOficina, GlyphDespachos, GlyphMarketing, GlyphCRM,
  GlyphAlianzas, GlyphComunidad, GlyphRedesSociales,
});

/* ── 14 · REDES SOCIALES · phone con engagement ─────────────── */
function GlyphRedesSociales() {
  const fg = '#FBFAF7';
  const accent = '#C2747F';
  const wine = '#7F0F1A';
  return (
    <g>
      {/* Phone frame */}
      <g className="rs-phone">
        <rect x="130" y="80" width="140" height="240" rx="20" fill={fg} stroke="#0F1E3D" strokeWidth="3"/>
        <rect x="138" y="100" width="124" height="200" rx="4" fill="#0F1E3D"/>
        {/* Camera notch */}
        <rect x="186" y="86" width="28" height="6" rx="3" fill="#0F1E3D"/>

        {/* Post image placeholder */}
        <rect x="146" y="108" width="108" height="84" rx="3" fill={accent} opacity="0.5"/>
        <circle cx="170" cy="138" r="14" fill={fg}/>
        <path d="M 198 168 L 218 148 L 240 168" stroke={fg} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        <text x="186" y="184" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fill={fg} letterSpacing="0.1em">@DTDCARGO</text>

        {/* Engagement row */}
        <g transform="translate(146 208)">
          {/* Heart filled */}
          <path d="M 8 4 C 4 0, -4 0, -4 8 C -4 16, 8 20, 8 20 C 8 20, 20 16, 20 8 C 20 0, 12 0, 8 4 Z"
                fill={wine}/>
          <text x="28" y="14" fontFamily="JetBrains Mono, monospace" fontWeight="700" fontSize="9" fill={fg} letterSpacing="0.04em">2.4K</text>
          {/* Speech bubble */}
          <path d="M 64 6 L 90 6 Q 96 6, 96 12 L 96 22 Q 96 28, 90 28 L 78 28 L 74 34 L 76 28 L 64 28 Q 58 28, 58 22 L 58 12 Q 58 6, 64 6 Z"
                fill="none" stroke={fg} strokeWidth="2"/>
          <text x="106" y="22" fontFamily="JetBrains Mono, monospace" fontWeight="700" fontSize="9" fill={fg} letterSpacing="0.04em">182</text>
        </g>

        {/* Action bar */}
        <g transform="translate(146 246)">
          <text fontFamily="Archivo, sans-serif" fontWeight="700" fontSize="11" fill={fg}>DTD-Cargo</text>
          <text x="0" y="14" fontFamily="Archivo, sans-serif" fontSize="9" fill={fg} opacity="0.65">Movemos el mundo de tu negocio</text>
          <rect x="0" y="22" width="108" height="22" rx="11" fill={wine}/>
          <text x="54" y="37" textAnchor="middle" fontFamily="Archivo, sans-serif" fontWeight="700" fontSize="10" fill={fg} letterSpacing="0.08em">SEGUIR</text>
        </g>
      </g>

      {/* Floating hearts + likes */}
      <g className="rs-float-1" opacity="0.9">
        <path d="M 78 130 C 70 122, 56 122, 56 138 C 56 152, 78 166, 78 166 C 78 166, 100 152, 100 138 C 100 122, 86 122, 78 130 Z"
              fill={accent} opacity="0.85"/>
      </g>
      <g className="rs-float-2">
        <circle cx="316" cy="146" r="20" fill={fg}/>
        <text x="316" y="151" textAnchor="middle" fontFamily="Archivo Black, sans-serif" fontWeight="900" fontSize="14" fill={wine}>+1</text>
      </g>
      <g className="rs-float-3">
        <circle cx="328" cy="236" r="16" fill={accent}/>
        <path d="M 322 232 L 322 240 L 326 240 L 326 244 L 334 236 L 326 228 L 326 232 Z" fill={fg}/>
      </g>
    </g>
  );
}

/* ── 12 · ALIANZAS ESTRATÉGICAS · 2 D's enlazadas ────────────── */
function GlyphAlianzas() {
  const fg = '#FBFAF7';
  const accent = '#7F0F1A';
  return (
    <g>
      {/* Left D (DTD) */}
      <g className="al-left" transform="translate(94 156)">
        <path d="M 0 0 L 60 0 C 102 0, 130 28, 130 70 C 130 112, 102 140, 60 140 L 0 140 Z M 16 16 L 16 124 L 60 124 C 92 124, 114 102, 114 70 C 114 38, 92 16, 60 16 Z"
              fill={fg} fillRule="evenodd"/>
        {/* Tiny "DTD" label */}
        <text x="56" y="80" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontWeight="700" fontSize="12" fill="#0F1E3D" letterSpacing="0.08em">DTD</text>
      </g>

      {/* Right D mirrored (Partner) */}
      <g className="al-right" transform="translate(306 156) scale(-1 1)">
        <path d="M 0 0 L 60 0 C 102 0, 130 28, 130 70 C 130 112, 102 140, 60 140 L 0 140 Z M 16 16 L 16 124 L 60 124 C 92 124, 114 102, 114 70 C 114 38, 92 16, 60 16 Z"
              fill={accent} fillRule="evenodd"/>
        {/* Partner placeholder */}
        <text x="56" y="80" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontWeight="700" fontSize="12" fill="#FBFAF7" letterSpacing="0.08em" transform="scale(-1 1) translate(-112 0)">B2B</text>
      </g>

      {/* Center link · chain link icon */}
      <g className="al-link">
        <circle cx="200" cy="226" r="22" fill={fg}/>
        <circle cx="200" cy="226" r="14" fill="#0F1E3D"/>
        <path d="M 188 226 L 212 226 M 200 214 L 200 238" stroke={fg} strokeWidth="3" strokeLinecap="round"/>
      </g>

      {/* Subtle pulse rings */}
      <circle className="al-pulse" cx="200" cy="226" r="36" fill="none" stroke={accent} strokeWidth="2" opacity="0"/>

      {/* Bottom label */}
      <text x="200" y="338" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontWeight="700" fontSize="10" fill="#C2747F" letterSpacing="0.22em" opacity="0.95">DTD × PARTNER</text>
    </g>
  );
}

/* ── 13 · COMUNIDAD · red de nodos alrededor del hub DTD ────── */
function GlyphComunidad() {
  const fg = '#FBFAF7';
  const accent = '#FBFAF7';
  const cx = 200, cy = 200;
  // 7 nodes around the center at varying radii (network feel)
  const nodes = [
    { angle: 270, r: 92,  delay: 0.0 },  // top
    { angle: 320, r: 110, delay: 0.1 },  // top-right
    { angle: 10,  r: 96,  delay: 0.2 },  // right
    { angle: 60,  r: 116, delay: 0.3 },  // bottom-right
    { angle: 110, r: 88,  delay: 0.4 },  // bottom
    { angle: 160, r: 108, delay: 0.5 },  // bottom-left
    { angle: 210, r: 96,  delay: 0.6 },  // top-left
    { angle: 240, r: 116, delay: 0.7 },  // top-left-lower
  ];
  return (
    <g>
      {/* Inter-node connections (subtle web) */}
      {nodes.map((n, i) => {
        const a = (n.angle) * Math.PI / 180;
        const x = cx + Math.cos(a) * n.r;
        const y = cy + Math.sin(a) * n.r;
        return (
          <g key={'l'+i} className={'co-spoke co-spoke-' + (i+1)} style={{ animationDelay: n.delay + 's' }}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke={fg} strokeWidth="1.5" opacity="0.3" strokeDasharray="3 4"/>
          </g>
        );
      })}
      {/* Center hub · DTD */}
      <circle cx={cx} cy={cy} r="46" fill={fg}/>
      <text x={cx} y={cy + 6} textAnchor="middle" fontFamily="Archivo Black, sans-serif" fontWeight="900" fontSize="20" fill="#7F0F1A" letterSpacing="-0.02em">DTD</text>

      {/* Outer nodes (people) */}
      {nodes.map((n, i) => {
        const a = (n.angle) * Math.PI / 180;
        const x = cx + Math.cos(a) * n.r;
        const y = cy + Math.sin(a) * n.r;
        return (
          <g key={'n'+i} className={'co-node co-node-' + (i+1)} style={{ animationDelay: n.delay + 's' }}>
            {/* Person body */}
            <circle cx={x} cy={y - 4} r="9" fill={fg}/>
            <path d={`M ${x - 14} ${y + 22} Q ${x} ${y + 8} ${x + 14} ${y + 22} L ${x + 14} ${y + 24} L ${x - 14} ${y + 24} Z`} fill={fg}/>
          </g>
        );
      })}

      {/* Count badge */}
      <g transform="translate(290 286)">
        <rect x="-32" y="-12" width="64" height="24" rx="12" fill={fg}/>
        <text x="0" y="5" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontWeight="700" fontSize="11" fill="#7F0F1A" letterSpacing="0.04em">+2.4K</text>
      </g>
    </g>
  );
}
