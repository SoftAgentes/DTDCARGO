"use client";

/**
 * Botón "Imprimir" del recibo de cobranza (SDD-0068) — calca el PrintButton
 * del expediente legal (SDD-0067). `window.print()` directo; el `@media print`
 * de la página oculta el shell del Studio y este mismo botón.
 *
 * <button> crudo justificado: client-side puro (no muta datos, no hay
 * doble-submit posible) — ActionButton es para server actions.
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
