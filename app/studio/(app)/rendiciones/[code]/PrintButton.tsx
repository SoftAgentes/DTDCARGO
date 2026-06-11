"use client";

/**
 * Botón "Imprimir" de la rendición (SDD-0069) — calca el del recibo (0068).
 * `window.print()` directo; el `@media print` de la página oculta el shell del
 * Studio y este mismo botón.
 *
 * <button> crudo justificado: client-side puro (no muta datos, sin doble-submit
 * posible) — ActionButton es para server actions.
 */
export function PrintButton() {
  return (
    <button
      type="button"
      className="studio-btn studio-btn-primary studio-btn-sm"
      onClick={() => window.print()}
    >
      Imprimir
    </button>
  );
}
