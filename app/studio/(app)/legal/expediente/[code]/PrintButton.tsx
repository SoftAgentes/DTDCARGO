"use client";

/**
 * Botón "Imprimir" de la vista imprimible del expediente de defensa (SDD-0070).
 * Copia literal del de `evidencia/[code]` (SDD-0067). `window.print()` directo
 * (patrón Etiquetas / Reportes). El CSS `@media print` de la página oculta el
 * shell del Studio y este mismo botón.
 *
 * <button> crudo justificado: es client-side puro (no muta datos, no hay
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
