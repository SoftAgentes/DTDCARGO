"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FONT_MONO } from "@/lib/design-tokens";

/**
 * CbmAyuda — el "?" junto al campo *CBM total* de `<CalculadoraForm>`.
 *
 * Responde la duda de entrada ("¿qué es un CBM?") SIN sacar al visitante del
 * formulario: la calculadora es superficie de conversión y mandarlo a /faq en
 * la misma pestaña le bota lo que llevaba escrito. Quien quiere más detalle
 * (las tres unidades, pulgadas, pies cúbicos) sale por el enlace del final, y
 * ese sí abre en pestaña nueva.
 *
 * **Por qué la Popover API nativa y no un div posicionado:** la tarjeta de la
 * calculadora es `overflow-hidden`, así que un popover normal se recortaría
 * contra su borde. `popover="auto"` renderiza en el *top layer* — ignora
 * `overflow` y `z-index` — y además trae gratis el cierre con `Esc`, el cierre
 * al hacer clic afuera y la devolución del foco al botón.
 *
 * La posición sí se calcula a mano (CSS Anchor Positioning todavía no tiene
 * soporte parejo): junto al campo en escritorio, pegado abajo a todo lo ancho
 * en teléfono. Si el navegador no soporta la API, el botón degrada a enlace
 * directo a la FAQ.
 */
export function CbmAyuda() {
  const id = useId().replace(/:/g, "");
  const popId = `cbm-ayuda-${id}`;
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  /** Espeja el estado real del popover para `aria-expanded`. El cierre puede
   *  venir del propio navegador (Esc o clic afuera), no solo del botón. */
  const [abierto, setAbierto] = useState(false);

  // Coloca el panel: en teléfono como hoja inferior, en escritorio junto al
  // campo, y siempre dentro de la ventana (nunca cortado contra un borde).
  useEffect(() => {
    const pop = popRef.current;
    const btn = btnRef.current;
    if (!pop || !btn) return;

    function colocar() {
      if (!pop || !btn) return;
      const movil = window.matchMedia("(max-width: 640px)").matches;
      if (movil) {
        pop.style.left = "8px";
        pop.style.right = "8px";
        pop.style.bottom = "8px";
        pop.style.top = "auto";
        pop.style.width = "auto";
        return;
      }
      const r = btn.getBoundingClientRect();
      const ancho = 330;
      const margen = 12;
      const left = Math.min(
        Math.max(margen, r.left - 8),
        window.innerWidth - ancho - margen,
      );
      // Si abajo no cabe, se voltea hacia arriba.
      const cabeAbajo = window.innerHeight - r.bottom > 340;
      pop.style.left = `${left}px`;
      pop.style.right = "auto";
      pop.style.width = `${ancho}px`;
      if (cabeAbajo) {
        pop.style.top = `${r.bottom + 10}px`;
        pop.style.bottom = "auto";
      } else {
        pop.style.top = "auto";
        pop.style.bottom = `${window.innerHeight - r.top + 10}px`;
      }
    }

    function alAlternar(e: Event) {
      const abre = (e as ToggleEvent).newState === "open";
      if (abre) colocar();
      setAbierto(abre);
    }

    pop.addEventListener("beforetoggle", alAlternar);
    window.addEventListener("resize", colocar);
    return () => {
      pop.removeEventListener("beforetoggle", alAlternar);
      window.removeEventListener("resize", colocar);
    };
  }, []);

  /**
   * El popover se abre a mano en vez de con `popovertarget` porque el
   * `<label>` de BigInput envuelve el botón: sin `preventDefault` el clic
   * también enfoca el input de CBM, y `preventDefault` cancelaría la apertura
   * automática que hace `popovertarget` (es su acción por defecto). Así se
   * consiguen las dos cosas.
   */
  function alHacerClic(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    const pop = popRef.current;
    if (!pop || typeof pop.togglePopover !== "function") {
      // Navegador sin Popover API: la ayuda no se pierde, se va a la FAQ.
      window.open("/faq#cbm", "_blank", "noopener");
      return;
    }
    pop.togglePopover();
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={alHacerClic}
        aria-expanded={abierto}
        aria-controls={popId}
        aria-label="¿Qué es el CBM?"
        className="relative inline-flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full border text-[11px] font-bold leading-none transition-colors before:absolute before:left-1/2 before:top-1/2 before:h-[44px] before:w-[44px] before:-translate-x-1/2 before:-translate-y-1/2 before:content-[''] hover:bg-[var(--wine-on-dark,#E8748A)] hover:text-[#10203c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        style={{
          fontFamily: FONT_MONO,
          borderColor: "var(--wine-on-dark, #E8748A)",
          color: "var(--wine-on-dark, #E8748A)",
        }}
      >
        ?
      </button>

      <div
        ref={popRef}
        id={popId}
        popover="auto"
        role="dialog"
        aria-label="¿Qué es el CBM?"
        className="fixed m-0 flex flex-col gap-3 rounded-[14px] p-4 backdrop:bg-transparent"
        style={{
          background: "#1d2c4b",
          border: "1px solid rgba(255,255,255,0.16)",
          boxShadow: "0 18px 44px rgba(0,0,0,0.45)",
          maxWidth: "calc(100vw - 16px)",
        }}
      >
        <div className="flex items-start justify-between gap-2.5">
          <h3 className="m-0 text-[15px] font-bold text-white">
            ¿Qué es el CBM?
          </h3>
          <button
            type="button"
            popoverTarget={popId}
            popoverTargetAction="hide"
            aria-label="Cerrar"
            className="rounded-[4px] px-1 text-[18px] leading-none text-white/60 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            ×
          </button>
        </div>

        <p className="m-0 text-[13.5px] leading-[1.55] text-white/85">
          Es el <strong className="text-white">metro cúbico</strong>: el espacio
          que ocupa tu carga en el contenedor. Se cobra por el espacio que ocupa,
          no por lo que pesa.
        </p>

        <div className="rounded-[10px] bg-black/20 p-1.5">
          <svg
            viewBox="0 0 300 150"
            className="block h-auto w-full"
            role="img"
            aria-label="Caja con sus tres medidas: largo, ancho y alto."
          >
            <defs>
              <marker
                id={`p-${id}`}
                viewBox="0 0 10 10"
                refX="5"
                refY="5"
                markerWidth="4.5"
                markerHeight="4.5"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--wine-on-dark, #E8748A)" />
              </marker>
            </defs>
            <path d="M 60 62 L 96 34 L 196 34 L 160 62 Z" fill="var(--wine-on-dark, #E8748A)" fillOpacity="0.16" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M 160 62 L 196 34 L 196 92 L 160 120 Z" fill="var(--wine-on-dark, #E8748A)" fillOpacity="0.26" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M 60 62 L 160 62 L 160 120 L 60 120 Z" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M 48 62 L 48 120" stroke="var(--wine-on-dark, #E8748A)" strokeWidth="1.3" fill="none" markerStart={`url(#p-${id})`} markerEnd={`url(#p-${id})`} />
            <text x="42" y="95" textAnchor="end" fill="var(--wine-on-dark, #E8748A)" style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700 }}>Alto</text>
            <path d="M 60 133 L 160 133" stroke="var(--wine-on-dark, #E8748A)" strokeWidth="1.3" fill="none" markerStart={`url(#p-${id})`} markerEnd={`url(#p-${id})`} />
            <text x="110" y="148" textAnchor="middle" fill="var(--wine-on-dark, #E8748A)" style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700 }}>Largo</text>
            <path d="M 172 127 L 208 99" stroke="var(--wine-on-dark, #E8748A)" strokeWidth="1.3" fill="none" markerStart={`url(#p-${id})`} markerEnd={`url(#p-${id})`} />
            <text x="216" y="118" textAnchor="start" fill="var(--wine-on-dark, #E8748A)" style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700 }}>Ancho</text>
          </svg>
        </div>

        <div
          className="rounded-[8px] bg-black/20 px-2 py-2.5 text-center text-[12.5px] font-bold tabular-nums"
          style={{ fontFamily: FONT_MONO, color: "var(--wine-on-dark, #E8748A)" }}
        >
          Largo × Ancho × Alto ÷ 1.000.000
        </div>
        <p className="m-0 text-[12.5px] leading-[1.5] text-white/60">
          Con las medidas en centímetros, que es como vienen del proveedor.
        </p>

        <a
          href="/faq#cbm"
          target="_blank"
          rel="noopener noreferrer"
          className="self-start border-b pb-px text-[13px] font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-white"
          style={{ color: "var(--wine-on-dark, #E8748A)" }}
        >
          Ver la explicación completa →
        </a>
      </div>
    </>
  );
}
