/**
 * Sección "Cómo funciona" del Shipping Mark — flujo de 8 pasos + beneficios.
 *
 * Rebuild al mockup Cloud Design "Shipping Mark · DTD-Cargo.html" (sección
 * `.sm-steps`): encabezado de sección + grilla de 8 pasos con icono propio +
 * banda de beneficios con la frase de cierre. Los CTAs ya NO viven acá (el
 * mockup los mueve al hero y al CTA final de la página).
 *
 * Copy grounded en el packing list oficial (入仓单) y en el mockup — sin
 * métricas inventadas. Server component, contenido en DOM (crawleable).
 * Estilos: `.sm-*` en app/globals.css, bajo el scope `.sm-surface` de la página.
 *
 * El nombre de cara al cliente es "Shipping Mark" (= 唛头, el término
 * internacional); el identificador interno sigue siendo DTD-NNNN.
 */
import type { ReactNode } from "react";

type Paso = { n: string; title: string; copy: string; icon: ReactNode };

const S = {
  fill: "none" as const,
  stroke: "currentColor" as const,
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
  "aria-hidden": true,
};

const PASOS: Paso[] = [
  {
    n: "01",
    title: "Te registras gratis",
    copy: "Al darte de alta recibes tu Shipping Mark al instante: tu código único DTD-NNNN.",
    icon: (
      <svg {...S}>
        <rect x="4.5" y="2.5" width="15" height="19" rx="2.2" />
        <line x1="8" y1="7" x2="16" y2="7" />
        <line x1="8" y1="11" x2="16" y2="11" />
        <line x1="8" y1="15" x2="13" y2="15" />
      </svg>
    ),
  },
  {
    n: "02",
    title: "Se lo pasas a tu proveedor",
    copy: "Le compartes tu Shipping Mark a tu proveedor en China cuando le haces el pedido.",
    icon: (
      <svg {...S}>
        <circle cx="12" cy="8.5" r="3.5" />
        <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
      </svg>
    ),
  },
  {
    n: "03",
    title: "Lo marca en cada bulto",
    copy: "Tu proveedor escribe tu Shipping Mark en cada caja, cartón o embalaje antes de despachar.",
    icon: (
      <svg {...S}>
        <path d="M3.5 8l8.5-4.5L20.5 8v8L12 20.5 3.5 16V8z" />
        <path d="M3.5 8l8.5 4.5L20.5 8" />
        <path d="M12 12.5V20.5" />
        <path d="M7.7 6.2l8.6 4.6" />
      </svg>
    ),
  },
  {
    n: "04",
    title: "Llega a nuestra bodega",
    copy: "La mercancía llega a nuestra bodega propia en Yiwu, ya identificada con tu marca.",
    icon: (
      <svg {...S}>
        <path d="M3.5 10L12 4l8.5 6" />
        <path d="M5 9.5V20h14V9.5" />
        <line x1="9.5" y1="20" x2="9.5" y2="14.5" />
        <line x1="14.5" y1="20" x2="14.5" y2="14.5" />
      </svg>
    ),
  },
  {
    n: "05",
    title: "La identificamos y revisamos",
    copy: "Por tu Shipping Mark sabemos que la caja es tuya, la asociamos a tu cuenta y la inspeccionamos.",
    icon: (
      <svg {...S} strokeWidth={1.9}>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <line x1="19" y1="19" x2="15.2" y2="15.2" />
      </svg>
    ),
  },
  {
    n: "06",
    title: "Consolidamos y rastreas",
    copy: "Se consolida con el resto de tu carga y empieza a verse en tu tracking, etapa por etapa.",
    icon: (
      <svg {...S}>
        <rect x="3" y="10" width="7" height="7" rx="1" />
        <rect x="11" y="10" width="7" height="7" rx="1" />
        <rect x="7" y="3.5" width="7" height="6" rx="1" />
      </svg>
    ),
  },
  {
    n: "07",
    title: "Pasa la aduana en Venezuela",
    copy: "Tu Shipping Mark identifica cuál carga es la tuya en la gestión aduanal, con aranceles e impuestos ya incluidos en tu cotización.",
    icon: (
      <svg {...S}>
        <path d="M12 3l7 3v6c0 4.5-3.2 7-7 9-3.8-2-7-4.5-7-9V6z" />
        <path d="M9 12l2.2 2.2L15.5 10" />
      </svg>
    ),
  },
  {
    n: "08",
    title: "La recibes en tu puerta",
    copy: "Llega puerta a puerta a tu dirección en Venezuela — identificada de principio a fin.",
    icon: (
      <svg {...S}>
        <path d="M4 11l8-6.5 8 6.5" />
        <path d="M6.5 9.6V20h11V9.6" />
        <rect x="10" y="14" width="4" height="6" />
      </svg>
    ),
  },
];

const BENEFICIOS = [
  "Evita que tu carga se mezcle con la de otros importadores",
  "Acelera la recepción en bodega",
  "Trazabilidad de cada caja, de origen a destino",
  "Menos errores y menos pérdidas",
];

export function ShippingMark() {
  return (
    <section className="sm-steps" id="como-funciona">
      <div className="wrap">
        <div className="sec-head">
          <div className="eyebrow-s">
            <span className="rule" aria-hidden />
            Cómo funciona
          </div>
          <h2 className="h2">
            Del proveedor a tu puerta,{" "}
            <span className="accent">en ocho pasos.</span>
          </h2>
          <p className="sec-sub">
            Un mismo código te acompaña en cada etapa del viaje — desde que te
            registras hasta que la carga llega a tu dirección en Venezuela.
          </p>
        </div>

        <ol className="sm-steps-grid">
          {PASOS.map((p) => (
            <li key={p.n} className="sm-step">
              <span className="sm-step-n" aria-hidden>
                {p.n}
              </span>
              <div className="sm-step-ic">{p.icon}</div>
              <h3>{p.title}</h3>
              <p>{p.copy}</p>
            </li>
          ))}
        </ol>

        <div className="sm-bene">
          <ul className="sm-bene-grid">
            {BENEFICIOS.map((b) => (
              <li key={b}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                {b}
              </li>
            ))}
          </ul>
          <p className="sm-bene-tag">
            Tu Shipping Mark le da identidad a tu mercancía antes de que empiece
            el viaje.
          </p>
        </div>
      </div>
    </section>
  );
}
