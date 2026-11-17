"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * SDD-0654 fase 2 · Diálogo de la Vista simple (guía y comparación).
 *
 * Modal accesible y chico, sin dependencias del Studio: `role="dialog"` con
 * `aria-modal`, el foco entra al abrir y no sale con Tab (trampa), Escape
 * cierra, y al cerrar el foco vuelve a quien lo abrió (AC-15). Sin animación:
 * la Vista simple es tranquila (§6.3) y así respeta `prefers-reduced-motion`.
 */
const ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialogo({
  abierto,
  titulo,
  onCerrar,
  children,
  ancho = "md",
  posicion = "centro",
  etiquetaCerrar = "Cerrar",
}: {
  abierto: boolean;
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
  ancho?: "md" | "lg";
  /** «abajo» deja ver el bloque resaltado por la guía. */
  posicion?: "centro" | "abajo";
  etiquetaCerrar?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const idTitulo = useId();
  const cerrarRef = useRef(onCerrar);
  useEffect(() => {
    cerrarRef.current = onCerrar;
  }, [onCerrar]);

  useEffect(() => {
    if (!abierto) return;
    const previo = document.activeElement as HTMLElement | null;
    const caja = ref.current;
    const primero = caja?.querySelector<HTMLElement>(ENFOCABLES);
    (primero ?? caja)?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        cerrarRef.current();
        return;
      }
      if (e.key !== "Tab" || !caja) return;
      const items = Array.from(caja.querySelectorAll<HTMLElement>(ENFOCABLES));
      if (items.length === 0) {
        e.preventDefault();
        caja.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const activo = document.activeElement;
      if (e.shiftKey && (activo === first || !caja.contains(activo))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (activo === last || !caja.contains(activo))) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (previo && document.contains(previo)) previo.focus();
    };
  }, [abierto]);

  if (!abierto) return null;

  return (
    <div
      className={`fixed inset-0 z-[60] flex justify-center p-4 ${posicion === "abajo" ? "items-end" : "items-center"}`}
      style={{ background: posicion === "abajo" ? "transparent" : "color-mix(in srgb, var(--color-ink) 40%, transparent)" }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        className={`vs-dialogo w-full ${ancho === "lg" ? "max-w-[860px]" : "max-w-[440px]"} max-h-[calc(100vh-32px)] overflow-y-auto rounded-[16px] p-5 sm:p-6 text-ink outline-none`}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={idTitulo} className="text-[18px] font-extrabold leading-tight">
            {titulo}
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            className="inline-flex min-h-[44px] min-w-[44px] flex-shrink-0 items-center justify-center rounded-full border border-grey-200 px-3 text-[14px] font-bold hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            {etiquetaCerrar}
          </button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}
