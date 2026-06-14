/* global React */
/* ── Ciclo del cliente · DTD-Cargo · 3 conceptos de bucle ──────── */

const STEPS = [
  { n: 1, label: 'Cotiza',     sub: 'DDP',          icon: 'calc' },
  { n: 2, label: 'Compra',     sub: 'prealerta',    icon: 'bag'  },
  { n: 3, label: 'Recibimos',  sub: 'en China',     icon: 'box'  },
  { n: 4, label: 'Entregamos', sub: 'a tu puerta',  icon: 'home' },
];

function StepGlyph({ kind, size = 26 }) {
  const c = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const p = { width: size, height: size, viewBox: '0 0 24 24' };
  if (kind === 'calc') return (
    <svg {...p}><rect x="4.5" y="2.5" width="15" height="19" rx="2.2" {...c} /><line x1="8" y1="7" x2="16" y2="7" {...c} /><line x1="8" y1="12" x2="8" y2="12" {...c} /><line x1="12" y1="12" x2="12" y2="12" {...c} /><line x1="16" y1="12" x2="16" y2="12" {...c} /><line x1="8" y1="16" x2="8" y2="16" {...c} /><line x1="12" y1="16" x2="12" y2="16" {...c} /><line x1="16" y1="16" x2="16" y2="16" {...c} /></svg>
  );
  if (kind === 'bag') return (
    <svg {...p}><path d="M6 8h12l-1 12.5H7L6 8z" {...c} /><path d="M9 8a3 3 0 0 1 6 0" {...c} /></svg>
  );
  if (kind === 'box') return (
    <svg {...p}><path d="M3.5 8l8.5-4.5L20.5 8v8L12 20.5 3.5 16V8z" {...c} /><path d="M3.5 8l8.5 4.5L20.5 8" {...c} /><path d="M12 12.5V20.5" {...c} /></svg>
  );
  if (kind === 'home') return (
    <svg {...p}><path d="M4 11l8-6.5 8 6.5" {...c} /><path d="M6.5 9.6V20h11V9.6" {...c} /><rect x="10" y="14" width="4" height="6" {...c} /></svg>
  );
  return null;
}

function LoopIcon({ size = 30 }) {
  const c = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path d="M3.5 9a8.5 8.5 0 0 1 14.8-3.2M20.5 15a8.5 8.5 0 0 1-14.8 3.2" {...c} />
      <path d="M18.5 2.5v3.5h-3.5M5.5 21.5v-3.5h3.5" {...c} />
    </svg>
  );
}

/* Posiciones de los 4 nodos sobre un círculo (frame 640) */
function ringPos(i) {
  const cx = 320, cy = 320, R = 180;
  const a = (-90 + i * 90) * Math.PI / 180;
  return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
}

/* ════════ OPCIÓN A · ANILLO DE PROCESO ════════ */
function OptionA() {
  return (
    <div className="cyc-frame">
      <svg className="cyc-svg" viewBox="0 0 640 640" aria-hidden="true">
        <circle className="cyc-ring-bg" cx="320" cy="320" r="180" />
        <circle className="cyc-ring-flow" cx="320" cy="320" r="180" />
      </svg>

      <div className="cyc-spark" style={{ offsetPath: "path('M320,140 A180,180 0 1 1 320,500 A180,180 0 1 1 320,140')" }}></div>

      <div className="cyc-center">
        <span className="cyc-loopicon"><LoopIcon /></span>
        <div className="cyc-eyebrow">Con Confianza</div>
        <div className="cyc-tagline">de China<br/>a tu puerta</div>
      </div>

      {STEPS.map((s, i) => {
        const { x, y } = ringPos(i);
        return (
          <div className="cyc-node" key={s.n} style={{ left: x, top: y }}>
            <span className="cyc-node-num">{s.n}</span>
            <span className="cyc-node-ico"><StepGlyph kind={s.icon} /></span>
            <span className="cyc-node-lbl">{s.label}</span>
            <span className="cyc-node-sub">{s.sub}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ════════ OPCIÓN B · ÓRBITA DEL ISÓLOGO ════════ */
function OptionB() {
  // elipse rx 210 ry 138, centro 320,320
  const cx = 320, cy = 320, rx = 210, ry = 138;
  const chip = (i) => {
    const a = (-90 + i * 90) * Math.PI / 180;
    return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
  };
  return (
    <div className="cyc-frame">
      <svg className="cyc-svg" viewBox="0 0 640 640" aria-hidden="true">
        <ellipse className="cyc-orbit" cx="320" cy="320" rx="210" ry="138" />
      </svg>

      <div className="cyc-comet" style={{ offsetPath: "path('M110,320 A210,138 0 1 1 530,320 A210,138 0 1 1 110,320')" }}></div>

      <div className="cyc-hub">
        <img src="../assets/dtdcargo-isologo-reverse.png" alt="DTD" />
        <div className="cyc-hub-tag">De China<br/>a tu puerta</div>
      </div>

      {STEPS.map((s, i) => {
        const { x, y } = chip(i);
        return (
          <div className="cyc-chip" key={s.n} style={{ left: x, top: y }}>
            <span className="cyc-chip-ico"><StepGlyph kind={s.icon} size={22} /></span>
            <span className="cyc-chip-txt">
              <span className="cyc-chip-lbl"><b>{s.n}</b>{s.label}</span>
              <span className="cyc-chip-sub">{s.sub}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ════════ OPCIÓN C · CINTA EN BUCLE ════════ */
function OptionC({ strength = 0.30, showContainer = true }) {
  const TRACK = 'M230,200 H410 A90,90 0 0 1 500,290 V350 A90,90 0 0 1 410,440 H230 A90,90 0 0 1 140,350 V290 A90,90 0 0 1 230,200 Z';
  const stations = [
    { ...STEPS[0], x: 250, y: 200, place: 'top' },
    { ...STEPS[1], x: 390, y: 200, place: 'top' },
    { ...STEPS[2], x: 390, y: 440, place: 'bot' },
    { ...STEPS[3], x: 250, y: 440, place: 'bot' },
  ];
  return (
    <div className={'cyc-frame' + (showContainer ? ' cyc-frame--container' : '')} style={{ '--bg-strength': strength }}>
      {showContainer && <img className="cyc-bg-container" src="container.svg" alt="" aria-hidden="true" />}
      {showContainer && <div className="cyc-bg-scrim" aria-hidden="true"></div>}
      <svg className="cyc-svg" viewBox="0 0 640 640" aria-hidden="true">
        <path className="cyc-track-bg" d={TRACK} />
        <path className="cyc-track-flow" d={TRACK} />
      </svg>

      <div className="cyc-belt" style={{ offsetPath: `path('${TRACK}')` }}>
        <svg width="44" height="30" viewBox="0 0 44 30" aria-hidden="true">
          <rect x="2" y="4" width="40" height="22" rx="2" fill="var(--wine)" stroke="#F2F0EC" strokeWidth="1.4"/>
          <line x1="11" y1="6" x2="11" y2="24" stroke="#F2F0EC" strokeWidth="1" opacity="0.5"/>
          <line x1="20" y1="6" x2="20" y2="24" stroke="#F2F0EC" strokeWidth="1" opacity="0.5"/>
          <line x1="29" y1="6" x2="29" y2="24" stroke="#F2F0EC" strokeWidth="1" opacity="0.5"/>
        </svg>
      </div>

      <div className="cyc-center cyc-center--track">
        <span className="cyc-loopicon"><LoopIcon size={26} /></span>
        <div className="cyc-eyebrow">Con Confianza</div>
        <div className="cyc-tagline cyc-tagline--sm">de China a tu puerta</div>
      </div>

      {stations.map((s) => (
        <div className={'cyc-stn cyc-stn--' + s.place} key={s.n} style={{ left: s.x, top: s.y }}>
          <span className="cyc-stn-dot"><StepGlyph kind={s.icon} size={20} /></span>
          <span className="cyc-stn-txt">
            <span className="cyc-stn-lbl"><b>{s.n}</b>{s.label}</span>
            <span className="cyc-stn-sub">{s.sub}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { OptionA, OptionB, OptionC });
