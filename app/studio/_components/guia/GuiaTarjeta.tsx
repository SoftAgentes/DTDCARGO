"use client";

/**
 * GuiaTarjeta · tarjeta pequeña de la guía (SDD-0589, paso 9.2).
 *
 * Presentacional: recibe los textos ya resueltos y la posición. No es un
 * modal: no hay fondo que bloquee ni trampa de foco; la pantalla sigue
 * operable. Es un `role="dialog"` no modal con nombre y descripción, y los
 * controles responden al teclado (Escape cierra; flechas avanzan y retroceden
 * mientras el foco está dentro).
 *
 * TODO: brand-review — componente nuevo construido con tokens existentes;
 * su revisión visual y la prueba con quien atiende son de 9.6.
 */

import {
  forwardRef,
  useEffect,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { Icon } from "../icons";
import { useT } from "@/lib/i18n";
import { Aviso } from "@/app/studio/_components/ui/Aviso";

export interface GuiaTarjetaProps {
  titulo: string;
  que: string;
  antes?: string | null;
  ahora?: string | null;
  n: number;
  total: number;
  /** El paso actual es el último disponible: «Siguiente» pasa a «Terminar». */
  esUltimo: boolean;
  /** Hay un paso disponible antes del actual. */
  puedeAtras: boolean;
  /** El ancla del paso actual desapareció mientras la tarjeta estaba abierta. */
  faltaAncla: boolean;
  top: number;
  left: number;
  /** `prefers-reduced-motion: reduce` — sin desplazamiento, solo opacidad. */
  reducido: boolean;
  onSiguiente: () => void;
  onAnterior: () => void;
  onCerrar: () => void;
  /** Solo en el primer paso de un arranque automático (9.3). */
  onNoMostrar?: () => void;
  /** Solo cuando abrió en un paso guardado (9.3). */
  onDesdeElPrincipio?: () => void;
}

const ID_TITULO = "studio-guia-titulo";
const ID_CUERPO = "studio-guia-cuerpo";

export const GuiaTarjeta = forwardRef<HTMLElement, GuiaTarjetaProps>(
  function GuiaTarjeta(props, ref) {
    const {
      titulo,
      que,
      antes,
      ahora,
      n,
      total,
      esUltimo,
      puedeAtras,
      faltaAncla,
      top,
      left,
      reducido,
      onSiguiente,
      onAnterior,
      onCerrar,
      onNoMostrar,
      onDesdeElPrincipio,
    } = props;
    const t = useT();

    // Entrada: aparece en el cuadro siguiente para que la transición corra.
    const [visible, setVisible] = useState(false);
    useEffect(() => {
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }, []);

    const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCerrar();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onSiguiente();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (puedeAtras) onAnterior();
      }
    };

    const transicion = reducido
      ? "opacity var(--dur-fast) linear"
      : "opacity var(--dur) var(--ease), transform var(--dur) var(--ease), top var(--dur-slow) var(--ease), left var(--dur-slow) var(--ease)";

    const estilo: CSSProperties = {
      position: "fixed",
      top,
      left,
      zIndex: 90, // sobre el topbar (70), debajo de drawers (100), avisos (150) y confirmaciones (200)
      width: "min(360px, calc(100vw - 2 * var(--s-4)))",
      maxHeight: "calc(100vh - 2 * var(--s-4))",
      overflowY: "auto",
      background: "var(--bg-surface)",
      color: "var(--ink)",
      border: "1px solid var(--border-strong)",
      borderRadius: "var(--r-lg)",
      boxShadow: "var(--shadow-pop)",
      padding: "var(--s-4)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--s-3)",
      textAlign: "left",
      opacity: visible ? 1 : 0,
      transform: visible || reducido ? "none" : "translateY(4px)",
      transition: transicion,
      // Sin `outline: none`: si el foco llega por teclado, el navegador
      // marca la tarjeta con su anillo de :focus-visible.
    };

    return (
      <section
        ref={ref}
        role="dialog"
        aria-modal="false"
        aria-labelledby={ID_TITULO}
        aria-describedby={ID_CUERPO}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="studio-guia-tarjeta"
        style={estilo}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--s-2)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-1)", minWidth: 0 }}>
            <span style={{ font: "600 11px/1.2 var(--f-sans)", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-soft)" }}>
              {t("guide.chrome.toggle")} · {t("guide.chrome.step_of", { n, total })}
            </span>
            <h2 id={ID_TITULO} style={{ margin: 0, font: "700 15px/1.25 var(--f-display)", color: "var(--ink)" }}>
              {titulo}
            </h2>
          </div>
          <button
            type="button"
            className="studio-btn studio-btn-ghost"
            aria-label={t("guide.chrome.close_aria")}
            title={t("guide.chrome.close")}
            onClick={onCerrar}
            style={{ width: 32, height: 32, minWidth: 32, padding: 0, flexShrink: 0, justifyContent: "center" }}
          >
            {Icon.close(14)}
          </button>
        </div>

        <div id={ID_CUERPO} style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
          {faltaAncla && (
            <Aviso tono="info" compacto>
              {t("guide.chrome.missing_target")}
            </Aviso>
          )}
          <p style={{ margin: 0, font: "400 14px/1.5 var(--f-sans)", color: "var(--ink)" }}>{que}</p>
          {antes && (
            <div>
              <div style={{ font: "700 11px/1.3 var(--f-sans)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-soft)", marginBottom: "var(--s-1)" }}>
                {t("guide.chrome.label_before")}
              </div>
              <p style={{ margin: 0, font: "400 13px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}>{antes}</p>
            </div>
          )}
          {ahora && (
            <div>
              <div style={{ font: "700 11px/1.3 var(--f-sans)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--wine-text)", marginBottom: "var(--s-1)" }}>
                {t("guide.chrome.label_now")}
              </div>
              <p style={{ margin: 0, font: "400 13px/1.5 var(--f-sans)", color: "var(--ink)" }}>{ahora}</p>
            </div>
          )}
        </div>

        {(onNoMostrar || onDesdeElPrincipio) && (
          // Acciones sobre la guía misma, no sobre datos: botones fantasma pequeños.
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-2)" }}>
            {onDesdeElPrincipio && (
              <button type="button" className="studio-btn studio-btn-ghost studio-btn-sm" onClick={onDesdeElPrincipio}>
                {t("guide.chrome.restart")}
              </button>
            )}
            {onNoMostrar && (
              <button type="button" className="studio-btn studio-btn-ghost studio-btn-sm" onClick={onNoMostrar}>
                {t("guide.chrome.dont_show")}
              </button>
            )}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--s-2)", paddingTop: "var(--s-1)" }}>
          <button
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-sm"
            // aria-disabled en vez de disabled: el botón conserva el foco
            // cuando el usuario retrocede hasta el primer paso con teclado.
            aria-disabled={!puedeAtras}
            onClick={() => {
              if (puedeAtras) onAnterior();
            }}
            style={puedeAtras ? undefined : { opacity: 0.5, cursor: "not-allowed" }}
          >
            {t("guide.chrome.prev")}
          </button>
          <button type="button" className="studio-btn studio-btn-primary studio-btn-sm" onClick={onSiguiente}>
            {esUltimo ? t("guide.chrome.done") : t("guide.chrome.next")}
          </button>
        </div>
      </section>
    );
  },
);
