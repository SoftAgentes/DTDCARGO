"use client";

/**
 * Botón "Imprimir / Guardar PDF" del comprobante de factura del portal. Calca el
 * PrintButton del recibo de cobranza del Studio (SDD-0068): `window.print()`
 * directo; el `@media print` de la página oculta el cromo del portal y deja sólo
 * el comprobante. El usuario elige "Guardar como PDF" en el diálogo del navegador.
 *
 * <button> crudo justificado: client-side puro (no muta datos, no hay
 * doble-submit posible).
 */
export function PrintButton() {
  return (
    <button
      type="button"
      className="btn btn-primary"
      onClick={() => window.print()}
    >
      Imprimir / Guardar PDF
    </button>
  );
}
