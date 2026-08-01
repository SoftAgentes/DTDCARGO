"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FONT_MONO } from "@/lib/design-tokens";

/**
 * CbmAyuda — el "?" junto al campo *CBM total* de `<CalculadoraForm>`.
 *
 * Responde la duda de entrada ("¿qué es un CBM?") SIN sacar al visitante del
 * formulario: la calculadora es superficie de conversión y mandarlo a /faq en
 * la misma pestaña le bota lo que llevaba escrito. Quien quiere el detalle
 * completo (las tres unidades, el diagrama, pulgadas) sale por el enlace del
 * final, y ese sí abre en pestaña nueva.
 *
 * **Por qué la Popover API nativa y no un div posicionado:** la tarjeta de la
 * calculadora es `overflow-hidden`, así que un popover normal se recortaría
 * contra su borde. `popover="auto"` renderiza en el *top layer* — ignora
 * `overflow` y `z-index` — y además trae gratis el cierre con `Esc` y el cierre
 * al hacer clic afuera.
 *
 * **Lo que se rompió acá una vez (2026-07-31) y por qué el panel usa
 * `.glass-pop`:** el panel llevaba la clase `flex` de Tailwind. Un popover
 * cerrado se oculta con el `display:none` del user-agent, y cualquier clase de
 * display de autor le gana por especificidad — así que el panel quedaba visible
 * SIEMPRE: se veía apenas cargaba la página, la × cambiaba el estado interno
 * pero no lo ocultaba, y Esc y el clic afuera tampoco. La cura no es quitar esa
 * clase y confiar: es que los dos estados (`display:none` cerrado /
 * `display:flex` abierto) vivan juntos en una sola clase del sistema
 * (`.glass-pop`, en `app/globals.css`) donde no se puedan desincronizar.
 *
 * **Por qué vidrio y por qué del denso:** BD-031 permite glass justo acá
 * (superficie flotante sobre navy). Pero este panel flota sobre fondo MIXTO —
 * papel a un lado, la tarjeta navy de la calculadora al otro — y con el
 * `--glass-bg` normal la tinta cae a 4.22:1 sobre navy. Por eso usa
 * `--glass-bg-strong`: medido sobre los tres fondos reales da 12.4–16.5:1 en
 * texto y 7.9–10.5:1 en el acento wine.
 *
 * La posición se calcula a mano (CSS Anchor Positioning todavía no tiene
 * soporte parejo): **arriba** del botón cuando cabe, para no taparle al
 * visitante el campo que vino a llenar; abajo solo cuando allí hay más
 * espacio. Si el navegador no soporta la API, el botón degrada a enlace
 * directo a la FAQ.
 */
const ANCHO = 320;
const MARGEN = 12;
/** Alto de respaldo para la PRIMERA colocación: con el panel cerrado
 *  `offsetHeight` es 0 y no hay nada que medir. Apenas abre se recoloca con la
 *  altura real (evento `toggle`). Va MEDIDO (266px), no estimado a ojo: con un
 *  número bajo el panel elige mal el lado y se abre hacia donde no cabe. */
const ALTO_ESTIMADO = 266;

const clamp = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), Math.max(min, max));

export function CbmAyuda() {
  const id = useId().replace(/:/g, "");
  const popId = `cbm-ayuda-${id}`;
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  /** Espeja el estado real del popover para `aria-expanded`. El cierre puede
   *  venir del propio navegador (Esc o clic afuera), no solo del botón. */
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    const pop = popRef.current;
    const btn = btnRef.current;
    if (!pop || !btn) return;

    function colocar() {
      if (!pop || !btn) return;

      if (window.matchMedia("(max-width: 640px)").matches) {
        // En teléfono no puede ser una hoja inferior fija: si el campo queda
        // cerca del borde inferior, la hoja lo tapa. Se mide el campo completo
        // y se usa el lado que tenga más espacio, limitando la altura al
        // viewport cuando ninguno de los dos lados alcanza.
        const boton = btn.getBoundingClientRect();
        const input = btn.closest("label")?.querySelector("input");
        const campo = input?.getBoundingClientRect();
        const bordeArriba = campo?.top ?? boton.top;
        const bordeAbajo = campo?.bottom ?? boton.bottom;
        const alto = pop.offsetHeight || ALTO_ESTIMADO;
        const espacioArriba = Math.max(0, bordeArriba - 16);
        const espacioAbajo = Math.max(
          0,
          window.innerHeight - bordeAbajo - 16,
        );
        const usarArriba =
          espacioArriba >= alto || espacioArriba >= espacioAbajo;
        const espacioDisponible = usarArriba ? espacioArriba : espacioAbajo;

        pop.style.left = "8px";
        pop.style.right = "8px";
        pop.style.width = "auto";
        pop.style.maxHeight = `${espacioDisponible}px`;
        pop.style.overflowY = "auto";
        pop.style.removeProperty("--caret-x");

        if (usarArriba) {
          pop.style.bottom = `${window.innerHeight - bordeArriba + 8}px`;
          pop.style.top = "auto";
          pop.dataset.lado = "arriba";
        } else {
          pop.style.top = `${bordeAbajo + 8}px`;
          pop.style.bottom = "auto";
          pop.dataset.lado = "abajo";
        }
        return;
      }

      const r = btn.getBoundingClientRect();
      const alto = pop.offsetHeight || ALTO_ESTIMADO;
      const left = clamp(
        r.left - 20,
        MARGEN,
        window.innerWidth - ANCHO - MARGEN,
      );

      pop.style.left = `${left}px`;
      pop.style.right = "auto";
      pop.style.width = `${ANCHO}px`;
      pop.style.maxHeight = "";
      pop.style.overflowY = "";

      // Se prefiere ARRIBA: el campo de CBM está JUSTO debajo del botón, así
      // que abrir hacia abajo le tapa al visitante exactamente lo que vino a
      // llenar. Solo baja si arriba no cabe.
      if (r.top > alto + 16) {
        pop.style.bottom = `${window.innerHeight - r.top + 10}px`;
        pop.style.top = "auto";
        pop.dataset.lado = "arriba";
      } else {
        pop.style.top = `${r.bottom + 10}px`;
        pop.style.bottom = "auto";
        pop.dataset.lado = "abajo";
      }

      // El caret apunta al botón que abrió el panel; sin eso el panel se lee
      // como algo que apareció suelto en la pantalla.
      pop.style.setProperty(
        "--caret-x",
        `${clamp(r.left + r.width / 2 - left - 6, 14, ANCHO - 26)}px`,
      );
    }

    function alAlternar(e: Event) {
      const abre = (e as ToggleEvent).newState === "open";
      if (abre) colocar();
      setAbierto(abre);
    }

    // Ya abierto: recién acá se puede MEDIR el panel, así que se recoloca con
    // la altura real (el `beforetoggle` corre con el panel aún sin renderizar).
    // Y al cerrar se devuelve el foco al botón: la Popover API solo lo hace
    // sola cuando la abre un `popovertarget`, y acá se abre a mano.
    function trasAlternar(e: Event) {
      if ((e as ToggleEvent).newState === "open") {
        colocar();
        return;
      }
      // Solo si nadie más tomó el foco — si el visitante cerró haciendo clic
      // en otro control, robárselo sería peor.
      if (document.activeElement === document.body) btn?.focus();
    }

    pop.addEventListener("beforetoggle", alAlternar);
    pop.addEventListener("toggle", trasAlternar);
    window.addEventListener("resize", colocar);

    // La posición es `fixed`: si la página se mueve, el panel se queda quieto y
    // deja de apuntar al botón. Lo SIGUE en vez de cerrarse — cerrar ante
    // cualquier scroll se siente como que el panel se cierra solo, y el
    // navegador scrollea por su cuenta (al enfocar, al hacer clic). Solo se
    // cierra si el botón se fue de la pantalla: ahí ya no hay a qué apuntar.
    let pendiente = false;
    const alScroll = () => {
      if (pendiente || !pop.matches(":popover-open")) return;
      pendiente = true;
      requestAnimationFrame(() => {
        pendiente = false;
        if (!pop.matches(":popover-open") || !btn) return;
        const r = btn.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) pop.hidePopover();
        else colocar();
      });
    };
    window.addEventListener("scroll", alScroll, { passive: true });

    return () => {
      pop.removeEventListener("beforetoggle", alAlternar);
      pop.removeEventListener("toggle", trasAlternar);
      window.removeEventListener("resize", colocar);
      window.removeEventListener("scroll", alScroll);
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
        title="¿Qué es el CBM?"
        // El fallback es #D59FA7 (= --color-wine-on-dark, el token canónico de
        // wine sobre las bandas navy de la web pública). Antes era #E8748A: un
        // rosa que no existe en la paleta y que solo se veía si el token no
        // resolvía.
        className="relative inline-flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full border text-[11px] font-bold leading-none transition-colors before:absolute before:left-1/2 before:top-1/2 before:h-[44px] before:w-[44px] before:-translate-x-1/2 before:-translate-y-1/2 before:content-[''] hover:bg-[var(--wine-on-dark,#D59FA7)] hover:text-[var(--color-ink,#0F1E3D)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        style={{
          fontFamily: FONT_MONO,
          borderColor: "var(--wine-on-dark, #D59FA7)",
          color: "var(--wine-on-dark, #D59FA7)",
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
        // `glass-pop` trae el par display:none / display:flex, la animación de
        // entrada y el caret. NUNCA agregar acá una clase de display suelta.
        className="glass-pop fixed m-0 flex-col gap-3 rounded-[14px] p-4 backdrop:bg-transparent"
        style={{
          maxWidth: "calc(100vw - 16px)",
          background: "var(--glass-bg-strong)",
          border: "1px solid var(--glass-border)",
          color: "var(--glass-ink)",
          backdropFilter: "var(--glass-blur)",
          // Respaldo obligatorio de BD-031: sin esto Safari no esmerila.
          WebkitBackdropFilter: "var(--glass-blur)",
          boxShadow: "var(--glass-hi), var(--glass-shadow)",
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="m-0 text-[15px] font-bold">¿Qué es el CBM?</h3>
          {/* 44×44 reales de área táctil (el ícono es chico, el blanco no).
              La × anterior medía 19×18 al 60% de opacidad: se perdía. */}
          <button
            type="button"
            popoverTarget={popId}
            popoverTargetAction="hide"
            aria-label="Cerrar"
            className="-m-3 flex h-[44px] w-[44px] flex-shrink-0 items-center justify-center rounded-full text-[20px] leading-none opacity-70 transition hover:bg-black/5 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px]"
            style={{ color: "var(--glass-ink)" }}
          >
            ×
          </button>
        </div>

        <p className="m-0 text-[13.5px] leading-[1.55]">
          Es el <strong>metro cúbico</strong>: el espacio que ocupa tu carga en
          el contenedor. Se cobra por el espacio que ocupa, no por lo que pesa.
        </p>

        <div
          className="rounded-[10px] px-3 py-2.5 text-center text-[13px] font-bold tabular-nums"
          style={{
            fontFamily: FONT_MONO,
            background: "var(--glass-inset)",
            color: "var(--color-wine)",
          }}
        >
          Largo × Ancho × Alto ÷ 1.000.000
        </div>

        <p className="m-0 text-[12.5px] leading-[1.5] opacity-75">
          Con las medidas en centímetros, que es como vienen del proveedor.
        </p>

        <a
          href="/faq#cbm"
          target="_blank"
          rel="noopener noreferrer"
          className="self-start border-b pb-px text-[13px] font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px]"
          style={{ color: "var(--color-wine)" }}
        >
          Ver la explicación completa →
        </a>
      </div>
    </>
  );
}
