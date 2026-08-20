/**
 * Ciclo DTD — pieza de marca del hero (Opción C aprobada por el founder).
 * "Cada envío, el mismo ciclo": un loop con 4 estaciones (Cotiza · Compra ·
 * Recibimos · Entregamos) alrededor del centro.
 *
 * SVG a mano (regla del founder: cero libs de gráficos). Responsive por viewBox
 * (width:100% + height:auto) → escala sin JS. Las estaciones viven DENTRO del
 * SVG (no divs posicionados en px), así todo escala junto. La cinta viajera usa
 * SMIL <animateMotion> en unidades de usuario (patrón probado del repo: el
 * offset-path de CSS en <g> escalado caía fuera de la pista). El flujo punteado
 * y el giro del ícono central se animan por CSS y respetan reduced-motion
 * (clases `.cyc-track-flow` / `.cyc-loopicon`); la cinta se oculta en
 * reduced-motion vía `.cyc-belt { display:none }`.
 */

const LOOP =
  "M230,200 H410 A90,90 0 0 1 500,290 V350 A90,90 0 0 1 410,440 H230 A90,90 0 0 1 140,350 V290 A90,90 0 0 1 230,200 Z";

type Station = {
  cx: number;
  cy: number;
  n: string;
  label: string;
  sub: string;
  icon: React.ReactNode;
  /** Estación inferior → el texto va debajo, fuera del loop. */
  bottom?: boolean;
};

const IC = {
  cotiza: (
    <>
      <rect x="4.5" y="2.5" width="15" height="19" rx="2.2" />
      <line x1="8" y1="7" x2="16" y2="7" />
      <line x1="8" y1="16" x2="8" y2="16" />
      <line x1="12" y1="16" x2="12" y2="16" />
      <line x1="16" y1="16" x2="16" y2="16" />
    </>
  ),
  compra: (
    <>
      <path d="M6 8h12l-1 12.5H7L6 8z" />
      <path d="M9 8a3 3 0 0 1 6 0" />
    </>
  ),
  recibe: (
    <>
      <path d="M3.5 8l8.5-4.5L20.5 8v8L12 20.5 3.5 16V8z" />
      <path d="M3.5 8l8.5 4.5L20.5 8" />
      <path d="M12 12.5V20.5" />
    </>
  ),
  entrega: (
    <>
      <path d="M4 11l8-6.5 8 6.5" />
      <path d="M6.5 9.6V20h11V9.6" />
      <rect x="10" y="14" width="4" height="6" />
    </>
  ),
};

const STATIONS: Station[] = [
  { cx: 250, cy: 200, n: "1", label: "Cotiza", sub: "Todo incluido", icon: IC.cotiza },
  { cx: 390, cy: 200, n: "2", label: "Compra", sub: "Prealerta", icon: IC.compra },
  { cx: 390, cy: 440, n: "3", label: "Recibimos", sub: "En China", icon: IC.recibe, bottom: true },
  { cx: 250, cy: 440, n: "4", label: "Entregamos", sub: "A tu puerta", icon: IC.entrega, bottom: true },
];

export function CicloDTD() {
  return (
    <div className="cycle-col">
      <svg
        className="cyc-svg"
        viewBox="0 0 640 640"
        role="img"
        aria-label="Cada envío, el mismo ciclo: cotiza (DDP), compra (prealerta), recibimos en China y entregamos a tu puerta."
      >
        {/* Pista */}
        <path className="cyc-track-bg" d={LOOP} />
        <path className="cyc-track-flow" d={LOOP} />

        {/* Cinta viajera (SMIL · se oculta en reduced-motion) */}
        <g className="cyc-belt">
          <animateMotion dur="12s" repeatCount="indefinite" rotate="auto" path={LOOP} />
          <rect
            x="-22"
            y="-15"
            width="44"
            height="30"
            rx="2"
            fill="var(--wine)"
            stroke="#F2F0EC"
            strokeWidth="1.4"
          />
          <line x1="-11" y1="-13" x2="-11" y2="13" stroke="#F2F0EC" strokeWidth="1" opacity="0.5" />
          <line x1="-2" y1="-13" x2="-2" y2="13" stroke="#F2F0EC" strokeWidth="1" opacity="0.5" />
          <line x1="7" y1="-13" x2="7" y2="13" stroke="#F2F0EC" strokeWidth="1" opacity="0.5" />
        </g>

        {/* Centro. Antes era un <svg x y width height viewBox> anidado — abría su
            propio viewport y el giro (CSS `animation` sobre `.cyc-loopicon`,
            ver globals.css) terminaba orbitando lejísimos de su sitio (bug
            "da vueltas sobre un área que no es"). La causa real: un <g> con
            atributo SVG `transform` (translate+scale) Y una animación CSS que
            también anima la propiedad `transform` en el MISMO elemento — la
            animación CSS reemplaza por completo el atributo SVG (no componen),
            así que el ícono perdía su translate/scale y giraba desde el
            origen del SVG. Fix: el posicionamiento (translate+scale, estático,
            atributo SVG) va en un <g> PADRE; el giro (CSS, clase cyc-loopicon)
            va en un <g> HIJO sin atributo `transform` propio — cada uno en su
            propio elemento, sin pisarse. */}
        <g transform="translate(303 278) scale(1.41667)">
          <g
            className="cyc-loopicon"
            fill="none"
            stroke="var(--wine)"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3.5 9a8.5 8.5 0 0 1 14.8-3.2M20.5 15a8.5 8.5 0 0 1-14.8 3.2" />
            <path d="M18.5 2.5v3.5h-3.5M5.5 21.5v-3.5h3.5" />
          </g>
        </g>
        <text
          x="320"
          y="330"
          textAnchor="middle"
          style={{
            font: "700 12px var(--f-brand)",
            letterSpacing: "2px",
            textTransform: "uppercase",
            fill: "var(--wine)",
          }}
        >
          Cada envío
        </text>
        <text
          x="320"
          y="352"
          textAnchor="middle"
          style={{
            font: "900 21px var(--f-brand-display)",
            letterSpacing: "-0.01em",
            fill: "var(--ink)",
          }}
        >
          el mismo ciclo
        </text>

        {/* Estaciones */}
        {STATIONS.map((s) => (
          <StationNode key={s.n} s={s} />
        ))}
      </svg>
    </div>
  );
}

function StationNode({ s }: { s: Station }) {
  // Texto fuera del loop: arriba en las estaciones superiores, abajo en las inferiores.
  const wordY = s.bottom ? s.cy + 48 : s.cy - 42;
  const subY = s.bottom ? s.cy + 63 : s.cy - 28;
  return (
    <g>
      <circle
        cx={s.cx}
        cy={s.cy}
        r="28"
        fill="var(--wine)"
        stroke="var(--bg-base)"
        strokeWidth="3"
      />
      <svg
        x={s.cx - 13}
        y={s.cy - 13}
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#F2F0EC"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {s.icon}
      </svg>
      <text
        x={s.cx}
        y={wordY}
        textAnchor="middle"
        style={{ font: "800 16px var(--f-brand)", letterSpacing: "-0.01em" }}
      >
        <tspan style={{ fill: "var(--wine)", fontFamily: "var(--f-mono)", fontWeight: 800 }}>
          {s.n}
        </tspan>
        <tspan dx="5" style={{ fill: "var(--ink)" }}>
          {s.label}
        </tspan>
      </text>
      <text
        x={s.cx}
        y={subY}
        textAnchor="middle"
        style={{
          font: "600 9.5px var(--f-brand)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fill: "var(--ink-mute)",
        }}
      >
        {s.sub}
      </text>
    </g>
  );
}
