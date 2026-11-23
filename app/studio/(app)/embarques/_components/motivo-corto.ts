/**
 * SDD-0710 · Versión de una línea del motivo por el que un embarque no se
 * puede eliminar. El texto completo sale de `shipmentDeleteBlockReason` y no
 * cambia (lo usan la acción de servidor y la API); aquí sólo se quita el
 * envoltorio para que la fila no ocupe dos líneas:
 *
 *   «No se puede eliminar: tiene 1 factura sin anular (Facturación). Primero
 *    anula, elimina o desvincula eso en su módulo.»
 *   → «No se elimina: tiene 1 factura sin anular (Facturación)»
 *
 * El «qué hacer» lo da el enlace «Ver los pasos» que va a su lado.
 */
const PREFIJO = /^No se puede eliminar:\s*/;
const SUFIJO = /\s*Primero anula, elimina o desvincula eso en su módulo\.?\s*$/;

export function motivoCorto(motivo: string): string {
  const sinSufijo = motivo.replace(SUFIJO, "").replace(/\.\s*$/, "");
  if (!PREFIJO.test(sinSufijo)) return sinSufijo;
  return `No se elimina: ${sinSufijo.replace(PREFIJO, "")}`;
}
