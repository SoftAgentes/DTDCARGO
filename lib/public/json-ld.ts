/** Serializa JSON-LD sin permitir que contenido controlado cierre el script. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
