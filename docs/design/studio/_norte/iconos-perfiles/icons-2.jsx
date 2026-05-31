/* ── Iconos de Perfil DTD-Cargo · roles 4-7 ─────────────────── */

/* ── 4 · ADMINISTRACIÓN · sello + clipboard ─────────────────── */
function GlyphAdministracion() {
  const fg = ROLE_THEME.administracion.fg;
  const accent = ROLE_THEME.administracion.accent;
  return (
    <g>
      {/* Clipboard back */}
      <rect x="118" y="86" width="164" height="220" rx="10" fill={fg} />
      {/* Clip top */}
      <rect x="170" y="74" width="60" height="22" rx="4" fill="#0F1E3D" />
      <rect x="178" y="68" width="44" height="14" rx="3" fill="#1F3055" />
      {/* Lines on paper */}
      <line className="ad-line" x1="140" y1="138" x2="240" y2="138" stroke="#0F1E3D" strokeOpacity="0.3" strokeWidth="3" strokeLinecap="round"/>
      <line className="ad-line" x1="140" y1="158" x2="260" y2="158" stroke="#0F1E3D" strokeOpacity="0.3" strokeWidth="3" strokeLinecap="round"/>
      <line className="ad-line" x1="140" y1="178" x2="220" y2="178" stroke="#0F1E3D" strokeOpacity="0.3" strokeWidth="3" strokeLinecap="round"/>
      <line className="ad-line" x1="140" y1="198" x2="250" y2="198" stroke="#0F1E3D" strokeOpacity="0.3" strokeWidth="3" strokeLinecap="round"/>
      {/* Stamp · APROBADO */}
      <g className="ad-stamp">
        <g transform="translate(200 250) rotate(-3)">
          <rect x="-70" y="-26" width="140" height="52" rx="4" fill="none" stroke={accent} strokeWidth="4" />
          <rect x="-66" y="-22" width="132" height="44" rx="2" fill="none" stroke={accent} strokeWidth="2" />
          <text textAnchor="middle" y="6" fontFamily="Archivo Black, Archivo, sans-serif" fontSize="22" fontWeight="900" fill={accent} letterSpacing="0.04em">APROBADO</text>
        </g>
      </g>
    </g>
  );
}

/* ── 5 · CONTABILIDAD · calculadora con balance ──────────────── */
function GlyphContabilidad() {
  const fg = ROLE_THEME.contabilidad.fg;
  const accent = ROLE_THEME.contabilidad.accent;
  return (
    <g>
      {/* Calculator body */}
      <rect x="116" y="86" width="168" height="228" rx="14" fill="#0F1E3D" />
      <rect x="120" y="90" width="160" height="220" rx="12" fill="#16264A" />
      {/* Display */}
      <rect x="132" y="100" width="136" height="56" rx="4" fill="#1F3055" />
      <text x="260" y="142" textAnchor="end" fontFamily="JetBrains Mono, monospace" fontSize="34" fontWeight="700" fill="#FBFAF7" letterSpacing="0.02em" className="c-digit">142,800</text>
      {/* Symbol over display */}
      <text x="140" y="120" fontFamily="JetBrains Mono, monospace" fontSize="11" fontWeight="700" fill="#C2747F" letterSpacing="0.1em">USD · BALANCE</text>
      {/* Key grid (4×4) */}
      {(() => {
        const keys = [
          ['7','8','9','÷'],['4','5','6','×'],['1','2','3','−'],['C','0','.','+']
        ];
        const cells = [];
        for (let r=0;r<4;r++) for (let c=0;c<4;c++){
          const x = 132 + c*36;
          const y = 168 + r*30;
          const label = keys[r][c];
          const isEq = false;
          const isOp = c===3;
          cells.push(
            <g key={r+'-'+c} className={'c-key'} style={{ animationDelay: ((r*4+c)*0.04) + 's' }}>
              <rect x={x} y={y} width="28" height="22" rx="3" fill={isOp?accent:'#FBFAF7'} opacity={isOp?0.9:0.96}/>
              <text x={x+14} y={y+15} textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="13" fontWeight="700" fill={isOp?'#FBFAF7':'#0F1E3D'}>{label}</text>
            </g>
          );
        }
        // Equals — wide bottom-right
        cells.push(
          <g key="eq" className="c-equals">
            <rect x="240" y="290" width="28" height="22" rx="3"/>
            <text x="254" y="305" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="14" fontWeight="700" fill="#FBFAF7">=</text>
          </g>
        );
        return cells;
      })()}
    </g>
  );
}

/* ── 6 · COMPRAS · etiqueta + check ──────────────────────────── */
function GlyphCompras() {
  const fg = ROLE_THEME.compras.fg;
  const accent = ROLE_THEME.compras.accent;
  return (
    <g>
      {/* String to tag (vertical from top) */}
      <line x1="200" y1="60" x2="200" y2="118" stroke={fg} strokeWidth="3" strokeLinecap="round"/>
      {/* Tag — hanging */}
      <g className="co-tag">
        {/* Tag body */}
        <path d="M 198 116 L 320 116 L 360 158 L 320 200 L 198 200 L 178 158 Z" fill={fg}/>
        {/* Eyelet hole */}
        <circle cx="198" cy="158" r="9" fill={ROLE_THEME.compras.bg}/>
        <circle cx="198" cy="158" r="4" fill="#FBFAF7"/>
        {/* Tag content */}
        <text x="260" y="148" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="12" fontWeight="700" fill="#7F0F1A" letterSpacing="0.08em">PO-2026</text>
        <text x="260" y="178" textAnchor="middle" fontFamily="Archivo Black, Archivo, sans-serif" fontSize="20" fontWeight="900" fill="#7F0F1A">¥58.400</text>
      </g>
      {/* Check confirmation */}
      <g className="co-check">
        <circle cx="116" cy="252" r="32" fill="#1F8A5B"/>
        <path d="M 102 252 L 114 264 L 132 244" stroke="#FBFAF7" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      </g>
      {/* Subtle barcode / origin label */}
      <g opacity="0.7">
        <text x="200" y="324" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="11" fontWeight="700" fill={fg} letterSpacing="0.18em">YIWU · CN</text>
      </g>
    </g>
  );
}

/* ── 7 · BIG BOSS · corona sobre monograma DTD ───────────────── */
function GlyphBigBoss() {
  const fg = ROLE_THEME.bigboss.fg;
  const accent = ROLE_THEME.bigboss.accent;
  return (
    <g>
      {/* Premium ring — thin wine outline just inside the clip */}
      <circle cx="200" cy="200" r="192" fill="none" stroke="#7F0F1A" strokeWidth="2" opacity="0.55"/>
      <circle cx="200" cy="200" r="184" fill="none" stroke={accent} strokeWidth="1" opacity="0.4"/>
      {/* Halo / pulse rings */}
      <circle className="bb-halo" cx="200" cy="220" r="120" fill="none" stroke={accent} strokeWidth="3" opacity="0"/>
      {/* Crown — proper silhouette with rounded triangular peaks */}
      <g className="bb-crown">
        <g transform="translate(200 132)">
          {/* Crown body — single closed path with curved peaks */}
          <path
            d="M -82 28
               L -82 2
               C -82 -4 -74 -6 -68 -2
               L -48 16
               L -28 -24
               C -26 -28 -22 -28 -20 -24
               L 0 18
               L 20 -24
               C 22 -28 26 -28 28 -24
               L 48 16
               L 68 -2
               C 74 -6 82 -4 82 2
               L 82 28
               Z"
            fill={accent}
            stroke="#5E0A12"
            strokeWidth="2"
            strokeLinejoin="round"/>
          {/* Band — wider base with subtle inner line */}
          <rect x="-86" y="28" width="172" height="20" rx="3" fill={accent}/>
          <rect x="-86" y="28" width="172" height="3" fill="#5E0A12" opacity="0.5"/>
          {/* Three gems on the peaks */}
          <circle className="bb-gem" cx="-48" cy="6" r="6" fill={fg}/>
          <circle className="bb-gem" cx="0" cy="-10" r="8" fill={fg} style={{ animationDelay: '0.4s' }}/>
          <circle className="bb-gem" cx="48" cy="6" r="6" fill={fg} style={{ animationDelay: '0.8s' }}/>
          {/* Gem on the band */}
          <rect x="-4" y="34" width="8" height="8" rx="1" fill={fg} className="bb-gem" style={{ animationDelay: '1.2s' }}/>
        </g>
      </g>
      {/* DTD monogram below the crown */}
      <g transform="translate(200 252)">
        <text textAnchor="middle" fontFamily="Archivo Black, Archivo, sans-serif" fontWeight="900" fontSize="76" fill={fg} letterSpacing="-0.04em">DTD</text>
        <text textAnchor="middle" y="22" fontFamily="JetBrains Mono, monospace" fontWeight="700" fontSize="10" fill={accent} letterSpacing="0.3em" opacity="0.95">CEO · FOUNDER</text>
      </g>
    </g>
  );
}

Object.assign(window, {
  GlyphAdministracion, GlyphContabilidad, GlyphCompras, GlyphBigBoss, GlyphSubCEO,
});

/* ── 8 · SUB-CEO · briefcase + DTD + badge "II" ──────────────── */
function GlyphSubCEO() {
  const fg = '#FBFAF7';
  const accent = '#C2747F';
  return (
    <g>
      {/* Briefcase body */}
      <g className="sc-case">
        <rect x="98" y="156" width="204" height="148" rx="10" fill={fg}/>
        <rect x="98" y="156" width="204" height="20" rx="10" fill={accent} opacity="0.85"/>
        {/* Handle */}
        <path d="M 160 156 L 160 130 Q 160 116, 174 116 L 226 116 Q 240 116, 240 130 L 240 156"
              stroke={fg} strokeWidth="10" fill="none" strokeLinecap="round"/>
        {/* Center clasp */}
        <rect x="186" y="172" width="28" height="14" rx="2" fill="#0F1E3D" opacity="0.8"/>
        {/* DTD initials on case */}
        <text x="200" y="234" textAnchor="middle" fontFamily="Archivo Black, sans-serif" fontWeight="900" fontSize="38" fill="#0F1E3D" letterSpacing="-0.04em">DTD</text>
        <text x="200" y="262" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontWeight="700" fontSize="10" fill="#7F0F1A" letterSpacing="0.24em">CARGO</text>
        {/* Horizontal seam */}
        <line x1="106" y1="284" x2="294" y2="284" stroke="#0F1E3D" strokeOpacity="0.15" strokeWidth="1.5"/>
      </g>

      {/* "II" badge — second in command */}
      <g className="sc-badge" transform="translate(286 116)">
        <circle r="26" fill="#7F0F1A"/>
        <circle r="26" fill="none" stroke={fg} strokeWidth="3"/>
        <text textAnchor="middle" y="9" fontFamily="Archivo Black, sans-serif" fontWeight="900" fontSize="26" fill={fg} letterSpacing="-0.04em">II</text>
      </g>
    </g>
  );
}
