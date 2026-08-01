/**
 * Serializa datos estructurados para insertarlos dentro de un `<script>`.
 * Escapar `<` impide que contenido controlado cierre la etiqueta JSON-LD.
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
