"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPortalVistaAction } from "../actions";
import { NOMBRE_VISTA, type PortalVista } from "@/lib/portal/vista-preferida";
import { BotonGuia } from "../(app)/_simple/BotonGuia";
import { ComparacionVistas } from "../(app)/_simple/ComparacionVistas";

/**
 * SDD-0654 · Selector «Vista simple / Vista Pro» de la barra superior (D-3).
 *
 * Solo existe con `PORTAL_VISTA_SIMPLE=true` (lo decide el layout). Dos botones
 * con `aria-pressed`: la elección se guarda en la base con la RPC de la 0557,
 * así que sigue al cliente entre su teléfono y su computadora (AC-6). Cambia al
 * instante y, si no se pudo guardar (sin la 0557 o sin red), vuelve a la de
 * antes y lo dice. La elección no borra ni mueve datos.
 *
 * Seleccionado en ink (BD-037), no en vino ni en dorado. En teléfono se acorta
 * a un solo botón que abre un panel con las dos vistas, «Comparar» y, en la
 * Vista simple, «Guía»: a 375 px la barra no alcanza para todo (medido en la
 * fase 2). En pantalla ancha, «Comparar» (§6.1, AC-16) va al lado del grupo.
 */
const OPCIONES: readonly PortalVista[] = ["simple", "pro"];

/** Cuánto queda a la vista el aviso de error antes de cerrarse solo. */
export const AVISO_ERROR_MS = 6000;

export function PortalVistaSelector({ vista }: { vista: PortalVista }) {
  const router = useRouter();
  const [actual, setActual] = useState<PortalVista>(vista);
  const [aviso, setAviso] = useState("");
  const [error, setError] = useState("");
  const [comparando, setComparando] = useState(false);
  const [panel, setPanel] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const disparadorRef = useRef<HTMLButtonElement>(null);
  const idPanel = useId();

  // El panel del teléfono se cierra con Escape o tocando fuera.
  useEffect(() => {
    if (!panel) return;
    // Al abrir, el foco entra a la vista elegida; con Escape vuelve al botón.
    panelRef.current?.querySelector<HTMLElement>('[role="group"] [aria-pressed="true"]')?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setPanel(false);
      disparadorRef.current?.focus();
    }
    function onDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setPanel(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [panel]);
  const [pendiente, startTransition] = useTransition();

  // El aviso de error se cierra solo o con Escape: no tapa la barra para siempre.
  // Escape se escucha desde que el aviso está en el DOM: un efecto de layout corre
  // en el mismo commit que lo pinta. Con `useEffect` quedaba un hueco entre el
  // aviso pintado y el listener puesto (el aviso llega dentro de una transición, y
  // sus efectos pasivos se agendan para otra tarea): un Escape en ese hueco se perdía.
  useLayoutEffect(() => {
    if (!error) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setError("");
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [error]);
  // La cuenta de AVISO_ERROR_MS empieza con el aviso ya a la vista.
  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(() => setError(""), AVISO_ERROR_MS);
    return () => window.clearTimeout(t);
  }, [error]);

  function elegir(siguiente: PortalVista) {
    if (siguiente === actual || pendiente) return;
    const anterior = actual;
    setActual(siguiente);
    setAviso("");
    setError("");
    startTransition(async () => {
      const r = await setPortalVistaAction(siguiente).catch(() => ({ ok: false }));
      if (r.ok) {
        setAviso(`Ahora ves la ${NOMBRE_VISTA[siguiente]}.`);
        router.refresh();
      } else {
        setActual(anterior);
        setError("No pudimos cambiar la vista. Intenta de nuevo en un momento.");
      }
    });
  }

  const botones = (enPanel: boolean) =>
    OPCIONES.map((opcion) => {
      const activa = opcion === actual;
      return (
        <button
          key={opcion}
          type="button"
          aria-pressed={activa}
          onClick={() => elegir(opcion)}
          className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full px-3 text-[13px] font-bold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
            enPanel ? "flex-1" : ""
          } ${activa ? "" : "text-grey-700 hover:text-ink"}`}
          style={activa ? { background: "var(--color-ink)", color: "var(--color-paper)" } : undefined}
        >
          {NOMBRE_VISTA[opcion]}
        </button>
      );
    });

  return (
    <div className="relative flex items-center gap-1.5" data-guia="vista">
      {/* Pantalla ancha: las dos vistas a la vista y «Comparar» al lado. */}
      <div className="hidden sm:flex items-center gap-1.5">
        <div
          role="group"
          aria-label="Vista del portal"
          aria-busy={pendiente || undefined}
          className="inline-flex flex-shrink-0 items-center rounded-full border border-grey-200 p-0.5"
        >
          {botones(false)}
        </div>
        <button
          type="button"
          onClick={() => setComparando(true)}
          aria-haspopup="dialog"
          className="inline-flex min-h-[44px] items-center rounded-full px-3 text-[13px] font-bold text-ink underline underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          Comparar
        </button>
      </div>

      {/* Teléfono: la barra no alcanza a 375 px. Un solo botón abre el panel con
          las dos vistas, «Comparar» y, en la Vista simple, «Guía». */}
      <div className="sm:hidden" ref={panelRef}>
        <button
          ref={disparadorRef}
          type="button"
          aria-expanded={panel}
          aria-controls={idPanel}
          onClick={() => setPanel((p) => !p)}
          className="inline-flex min-h-[44px] items-center gap-1 rounded-full border border-grey-200 px-3 text-[13px] font-bold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {actual === "simple" ? "Simple" : "Pro"}
          <span aria-hidden="true">▾</span>
          <span className="sr-only">: cambiar de vista</span>
        </button>
        {panel && (
          <div
            id={idPanel}
            className="absolute right-0 top-[calc(100%+6px)] z-50 flex w-[260px] max-w-[calc(100vw-32px)] flex-col gap-2 rounded-[14px] border border-grey-200 p-2 shadow-sm"
            style={{ background: "var(--color-white)" }}
          >
            <div
              role="group"
              aria-label="Vista del portal"
              aria-busy={pendiente || undefined}
              className="flex items-center gap-1 rounded-full border border-grey-200 p-0.5"
            >
              {botones(true)}
            </div>
            <button
              type="button"
              onClick={() => {
                setPanel(false);
                setComparando(true);
              }}
              aria-haspopup="dialog"
              className="inline-flex min-h-[44px] items-center rounded-full px-3 text-[14px] font-bold text-ink underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              Comparar las dos vistas
            </button>
            {vista === "simple" && <BotonGuia className="inline-flex" onAbrir={() => setPanel(false)} />}
          </div>
        )}
      </div>

      <ComparacionVistas abierto={comparando} onCerrar={() => setComparando(false)} />
      <span role="status" aria-live="polite" className="sr-only">
        {aviso}
      </span>
      {error && (
        <p
          role="alert"
          className="absolute right-0 top-[calc(100%+6px)] z-50 w-[240px] max-w-[calc(100vw-32px)] rounded-md border border-grey-200 px-3 py-2 text-[13px] text-ink shadow-sm"
          style={{ background: "var(--color-white)" }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
