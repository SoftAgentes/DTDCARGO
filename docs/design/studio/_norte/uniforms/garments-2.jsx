/* global React, window */
/* ── DTD-Cargo · Prendas planas v2 · parte 2 (camisa, chaleco, gorra) ── */
const v2 = window.UNIv2;
const gshade2 = v2._gshade, glight2 = v2._glight, topOutline2 = v2._topOutline, GShade2 = v2._GShade;

function Shirt({ fill, side }) {
  side = side || 'front';
  const stroke = gshade2(fill, glight2(fill) ? -40 : -46);
  const seam = glight2(fill) ? gshade2(fill, -22) : gshade2(fill, 34);
  const collarFill = gshade2(fill, glight2(fill) ? -10 : 14);
  return (
    <g>
      <path d={topOutline2({ side, sleeve: 'long' })} fill={fill} stroke={stroke} strokeWidth="2.6" strokeLinejoin="round" />
      <GShade2 fill={fill} />
      {side === 'front' ? (
        <g>
          {/* placket completo + botones */}
          <path d="M194,104 L194,340 M206,104 L206,340" fill="none" stroke={seam} strokeWidth="1.5" opacity="0.65" />
          {[126, 162, 198, 234, 270, 306].map((y) => <circle key={y} cx="200" cy={y} r="2.6" fill="none" stroke={seam} strokeWidth="1.3" />)}
          {/* bolsillo pecho (lado del que mira: derecha) */}
          <path d="M238,150 L274,150 L274,186 L256,198 L238,186 Z" fill="none" stroke={seam} strokeWidth="1.5" opacity="0.7" />
          {/* cuello formal */}
          <path d="M168,90 L200,118 L232,90 L220,78 L200,94 L180,78 Z" fill={collarFill} stroke={stroke} strokeWidth="2.4" strokeLinejoin="round" />
          {/* puños */}
          <path d="M320,300 L356,300" stroke={seam} strokeWidth="1.6" opacity="0.6" />
          <path d="M44,300 L80,300" stroke={seam} strokeWidth="1.6" opacity="0.6" />
        </g>
      ) : (
        <g>
          {/* canesú */}
          <path d="M104,176 Q200,196 296,176" fill="none" stroke={seam} strokeWidth="1.5" opacity="0.5" />
          <path d="M168,90 C168,104 232,104 232,90 L224,80 C224,90 176,90 176,80 Z" fill={collarFill} stroke={stroke} strokeWidth="2.2" strokeLinejoin="round" />
        </g>
      )}
    </g>
  );
}

function Vest({ fill, side }) {
  side = side || 'front';
  const stroke = gshade2(fill, glight2(fill) ? -40 : -46);
  const seam = glight2(fill) ? gshade2(fill, -22) : gshade2(fill, 34);
  const collarFill = gshade2(fill, glight2(fill) ? -10 : 14);
  // cuerpo sin mangas: hombros angostos, sisas escarbadas
  const body = `M158,96 L242,96 L286,108 L298,150 L292,176 L296,344 Q200,354 104,344 L108,176 L102,150 L114,108 Z`;
  return (
    <g>
      <path d={body} fill={fill} stroke={stroke} strokeWidth="2.6" strokeLinejoin="round" />
      <GShade2 fill={fill} />
      {/* sisas */}
      <path d="M114,108 C146,124 156,150 156,184 L156,344" fill="none" stroke={seam} strokeWidth="1.6" opacity="0.55" />
      <path d="M286,108 C254,124 244,150 244,184 L244,344" fill="none" stroke={seam} strokeWidth="1.6" opacity="0.55" />
      {/* cuello alto */}
      <path d="M158,96 L200,118 L242,96 L232,86 L200,100 L168,86 Z" fill={collarFill} stroke={stroke} strokeWidth="2.2" strokeLinejoin="round" />
      {side === 'front' && (
        <g>
          {/* cierre central */}
          <path d="M200,118 L200,338" fill="none" stroke={seam} strokeWidth="2" />
          <path d="M196,132 L196,330 M204,132 L204,330" fill="none" stroke={seam} strokeWidth="0.9" strokeDasharray="2 3" opacity="0.55" />
          {/* bolsillos cargo */}
          <rect x="120" y="250" width="48" height="54" rx="3" fill="none" stroke={seam} strokeWidth="1.5" opacity="0.65" />
          <rect x="232" y="250" width="48" height="54" rx="3" fill="none" stroke={seam} strokeWidth="1.5" opacity="0.65" />
        </g>
      )}
    </g>
  );
}

function Cap({ fill }) {
  const stroke = gshade2(fill, glight2(fill) ? -40 : -46);
  const seam = glight2(fill) ? gshade2(fill, -22) : gshade2(fill, 34);
  return (
    <g>
      {/* copa */}
      <path d="M104,232 C104,132 196,96 276,122 C310,134 320,178 320,210 L320,232 Z"
        fill={fill} stroke={stroke} strokeWidth="2.6" strokeLinejoin="round" />
      {/* gajos */}
      <path d="M188,112 C182,160 182,200 184,232" fill="none" stroke={seam} strokeWidth="1.4" strokeDasharray="3 3" opacity="0.5" />
      <path d="M252,118 C260,164 262,200 262,232" fill="none" stroke={seam} strokeWidth="1.4" strokeDasharray="3 3" opacity="0.5" />
      {/* botón */}
      <circle cx="150" cy="116" r="6" fill={fill} stroke={stroke} strokeWidth="1.8" />
      {/* visera */}
      <path d="M104,232 C76,236 50,250 38,270 C58,282 96,284 134,276 C122,258 112,242 104,232 Z"
        fill={gshade2(fill, -8)} stroke={stroke} strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M52,262 C72,272 102,274 124,268" fill="none" stroke={seam} strokeWidth="1.2" strokeDasharray="2 3" opacity="0.5" />
      {/* banda */}
      <path d="M104,232 L320,232 L320,248 L104,248 Z" fill={fill} stroke={stroke} strokeWidth="1.8" />
    </g>
  );
}

Object.assign(window.UNIv2, { Shirt, Vest, Cap });
