"use client";

import { useEffect, useState } from "react";

/**
 * Ciclo del Cliente — la "cinta en bucle" del hero (reemplaza el contenedor
 * estático + el badge). Handoff Norte 2026-06-13 · v3.7 (Opción C, sin fondo).
 *
 * Diseño portado de `Hero Web · Ciclo DTD.html` a tokens del sitio público
 * (Archivo, no Sora/Nunito que son capa-sistema). Estructura:
 *   - SVG (viewBox 640×640): pista base + pista de flujo (animada) + el
 *     contenedor que viaja por la pista. El contenedor usa **SMIL animateMotion**
 *     (en unidades de usuario → va SOBRE la pista y escala con el viewBox; el CSS
 *     `offset-path` en un <g> SVG usa px de CSS y NO coincide con la pista escalada).
 *   - Overlay HTML: 4 estaciones + centro, posicionados en % y dimensionados en
 *     `cqw` (container-query units) → todo escala fluido con el ancho del bloque.
 *
 * Animación / reduced-motion: las CSS (flujo de la pista, giro del centro) se
 * gatean con `prefers-reduced-motion: no-preference` en globals.css. El
 * contenedor (SMIL, no gateable por CSS) se controla acá: solo se monta el
 * `animateMotion` si el usuario NO pidió reducir movimiento. En reduced-motion /
 * SSR queda en una pose canónica estática sobre el tramo recto superior. Por eso
 * es client component (lee matchMedia); el SSR igual rinde TODO el texto.
 *
 * Accesibilidad: las etiquetas de paso y el centro van como TEXTO real; los
 * adornos (pista, contenedor, íconos) van `aria-hidden`.
 *
 * Regla de marca (CLAUDE.md): Compra/Orden/Prealerta son el MISMO registro →
 * "Prealerta" es subtítulo de "Compra", NO un 5º paso.
 */

// OJO: este path se usa para la pista (id="cyc-track") y para la animación del
// contenedor (mpath → #cyc-track). Fuente única, no se repite en CSS.
const TRACK_D =
  "M230,200 H410 A90,90 0 0 1 500,290 V350 A90,90 0 0 1 410,440 H230 A90,90 0 0 1 140,350 V290 A90,90 0 0 1 230,200 Z";

// Centro del bucle (Opción B, founder 2026-06-13): habla del ciclo en sí
// ("cada envío, el mismo ciclo") en vez de repetir el H1. Punto único para variantes.
const CENTER = { eyebrow: "Cada envío", tagline: "el mismo ciclo" };

type Station = {
  n: string;
  label: string;
  sub: string;
  pos: "top" | "bot";
  left: string;
  top: string;
  icon: React.ReactNode;
};

// Íconos outline (stroke 1.7) — heredan el color del dot (grey-100 sobre wine).
const ico = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const STATIONS: Station[] = [
  {
    n: "1",
    label: "Cotiza",
    sub: "Todo incluido",
    pos: "top",
    left: "39.06%",
    top: "31.25%",
    icon: (
      <svg viewBox="0 0 24 24" {...ico}>
        <rect x="4.5" y="2.5" width="15" height="19" rx="2.2" />
        <line x1="8" y1="7" x2="16" y2="7" />
        <line x1="8" y1="16" x2="8.01" y2="16" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
        <line x1="16" y1="16" x2="16.01" y2="16" />
      </svg>
    ),
  },
  {
    n: "2",
    label: "Compra",
    sub: "Prealerta",
    pos: "top",
    left: "60.94%",
    top: "31.25%",
    icon: (
      <svg viewBox="0 0 24 24" {...ico}>
        <path d="M6 8h12l-1 12.5H7L6 8z" />
        <path d="M9 8a3 3 0 0 1 6 0" />
      </svg>
    ),
  },
  {
    n: "3",
    label: "Recibimos",
    sub: "En China",
    pos: "bot",
    left: "60.94%",
    top: "68.75%",
    icon: (
      <svg viewBox="0 0 24 24" {...ico}>
        <path d="M3.5 8l8.5-4.5L20.5 8v8L12 20.5 3.5 16V8z" />
        <path d="M3.5 8l8.5 4.5L20.5 8" />
        <path d="M12 12.5V20.5" />
      </svg>
    ),
  },
  {
    n: "4",
    label: "Entregamos",
    sub: "A tu puerta",
    pos: "bot",
    left: "39.06%",
    top: "68.75%",
    icon: (
      <svg viewBox="0 0 24 24" {...ico}>
        <path d="M4 11l8-6.5 8 6.5" />
        <path d="M6.5 9.6V20h11V9.6" />
        <rect x="10" y="14" width="4" height="6" />
      </svg>
    ),
  },
];

const cqClamp = (min: number, cqw: number, max: number) =>
  `clamp(${min}px, ${cqw}cqw, ${max}px)`;

const DOT = cqClamp(40, 8.75, 56);
const DOT_ICON = cqClamp(16, 3.44, 22);

export function CicloCliente() {
  // El contenedor viaja solo si el usuario NO pidió reducir movimiento. SSR e
  // inicial = false (pose estática) → sin mismatch de hidratación; tras montar,
  // se prende si corresponde.
  const [motionOk, setMotionOk] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: no-preference)");
    const sync = () => setMotionOk(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    <div
      style={{
        position: "relative",
        width: "min(100%, 560px)",
        aspectRatio: "1 / 1",
        marginInline: "auto",
        containerType: "inline-size",
        color: "var(--color-ink)",
      }}
    >
      {/* Pista + contenedor viajero (escalan con el viewBox) */}
      <svg
        viewBox="0 0 640 640"
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}
      >
        <path
          id="cyc-track"
          d={TRACK_D}
          fill="none"
          stroke="color-mix(in srgb, var(--color-ink) 9%, transparent)"
          strokeWidth={16}
        />
        <path
          className="cyc-flow"
          d={TRACK_D}
          fill="none"
          stroke="var(--color-wine)"
          strokeWidth={2.5}
          strokeDasharray="6 14"
          strokeLinecap="round"
          style={{ opacity: 0.85 }}
        />
        {/* Contenedor: dibujado centrado en el origen. Con movimiento → animateMotion
            lo lleva sobre la pista (rotate auto); sin movimiento → pose estática en
            (290,200), sobre el tramo recto superior. */}
        <g
          aria-hidden="true"
          transform={motionOk ? undefined : "translate(290 200)"}
          style={{ filter: "drop-shadow(0 4px 8px color-mix(in srgb, var(--color-ink) 30%, transparent))" }}
        >
          <rect x={-20} y={-11} width={40} height={22} rx={2} fill="var(--color-wine)" stroke="var(--color-grey-100)" strokeWidth={1.4} />
          <line x1={-11} y1={-9} x2={-11} y2={9} stroke="var(--color-grey-100)" strokeWidth={1} opacity={0.5} />
          <line x1={-2} y1={-9} x2={-2} y2={9} stroke="var(--color-grey-100)" strokeWidth={1} opacity={0.5} />
          <line x1={7} y1={-9} x2={7} y2={9} stroke="var(--color-grey-100)" strokeWidth={1} opacity={0.5} />
          {motionOk && (
            <animateMotion dur="12s" repeatCount="indefinite" rotate="auto">
              <mpath href="#cyc-track" />
            </animateMotion>
          )}
        </g>
      </svg>

      {/* Centro */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: cqClamp(4, 0.94, 6),
          textAlign: "center",
          width: "32%",
        }}
      >
        <svg
          className="cyc-spin"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-wine)"
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ width: cqClamp(22, 4.69, 30), height: cqClamp(22, 4.69, 30) }}
        >
          <path d="M3.5 9a8.5 8.5 0 0 1 14.8-3.2M20.5 15a8.5 8.5 0 0 1-14.8 3.2" />
          <path d="M18.5 2.5v3.5h-3.5M5.5 21.5v-3.5h3.5" />
        </svg>
        <span
          style={{
            fontFamily: "var(--font-archivo)",
            fontWeight: 700,
            fontSize: cqClamp(10, 1.875, 12),
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--color-wine)",
          }}
        >
          {CENTER.eyebrow}
        </span>
        <span
          style={{
            fontFamily: "var(--font-archivo)",
            fontWeight: 700,
            fontSize: cqClamp(15, 3.44, 22),
            lineHeight: 1.12,
            letterSpacing: "-0.01em",
            color: "var(--color-ink)",
          }}
        >
          {CENTER.tagline}
        </span>
      </div>

      {/* Estaciones */}
      {STATIONS.map((s) => (
        <div
          key={s.n}
          style={{
            position: "absolute",
            left: s.left,
            top: s.top,
            transform: "translate(-50%, -50%)",
            display: "flex",
            flexDirection: s.pos === "bot" ? "column-reverse" : "column",
            alignItems: "center",
            gap: cqClamp(4, 1.25, 8),
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: DOT,
              height: DOT,
              borderRadius: "999px",
              background: "var(--color-wine)",
              color: "var(--color-grey-100)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "3px solid var(--color-white)",
              boxShadow: "0 8px 18px color-mix(in srgb, var(--color-wine) 28%, transparent)",
              flex: "0 0 auto",
            }}
          >
            <span style={{ width: DOT_ICON, height: DOT_ICON, display: "inline-flex" }}>
              {s.icon}
            </span>
          </span>
          <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
            <span
              style={{
                fontFamily: "var(--font-archivo)",
                fontWeight: 700,
                fontSize: cqClamp(13, 2.5, 16),
                color: "var(--color-ink)",
                display: "flex",
                alignItems: "baseline",
                gap: "6px",
                whiteSpace: "nowrap",
              }}
            >
              <b style={{ fontWeight: 800, fontSize: cqClamp(10, 1.875, 12), color: "var(--color-wine)" }}>
                {s.n}
              </b>
              {s.label}
            </span>
            <span
              style={{
                fontFamily: "var(--font-archivo)",
                fontWeight: 600,
                fontSize: cqClamp(9, 1.56, 10),
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--color-grey-500)",
                whiteSpace: "nowrap",
              }}
            >
              {s.sub}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
