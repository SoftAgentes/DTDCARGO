/**
 * Enlace a la guía interactiva de compra en Alibaba (SDD-0099,
 * `public/guias/comprar-en-alibaba.html`).
 *
 * Vive en `lib/` (util puro, sin dominio) porque lo importan los dos mundos: la
 * tarjeta `GuiaAlibabaCard` (server) y el widget `AlibabaCursoGuide` (client).
 *
 * ⚠️ La sanitización del mark tiene que ser IDÉNTICA a la de la guía
 * (`const URL_MARK` en el HTML). Si se separan, el cliente ve un Shipping Mark
 * distinto del suyo y su caja llega a Yiwu sin poder identificarse. La fija
 * `components/__tests__/guia-alibaba-card.test.ts`.
 */

export const GUIA_ALIBABA_PATH = "/guias/comprar-en-alibaba.html";

/** Sólo A-Z, 0-9 y guion, con el prefijo `DTD-`. Espejo de la guía. */
function normalizarMark(raw: string): string {
  const limpio = raw.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  if (!limpio) return "";
  return limpio.startsWith("DTD-") ? limpio : `DTD-${limpio}`;
}

export function guiaAlibabaHref(markbox?: string, name?: string): string {
  const qs = new URLSearchParams();
  const mark = markbox ? normalizarMark(markbox) : "";
  if (mark) qs.set("mark", mark);
  if (name?.trim()) qs.set("name", name.trim().slice(0, 40));
  const q = qs.toString();
  return `${GUIA_ALIBABA_PATH}${q ? `?${q}` : ""}`;
}
