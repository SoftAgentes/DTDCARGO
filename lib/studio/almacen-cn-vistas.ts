/**
 * Vistas de Almacén China (SDD-0682). PURO.
 *
 *  - `almacen`: lo que está físicamente en la bodega (la vista por defecto).
 *  - `camino`: lo que ya salió de la bodega, en contenedores.
 *
 * La vista va en la URL como `?vista=camino`; sin parámetro, o con un valor que
 * no existe, es `almacen`.
 */

export type VistaCn = "almacen" | "camino";

export function vistaDeUrl(crudo: string | string[] | undefined): VistaCn {
  const v = Array.isArray(crudo) ? crudo[0] : crudo;
  return v === "camino" ? "camino" : "almacen";
}

/** Parámetros de la URL que solo tienen sentido en «En almacén». */
const PARAMS_DE_ALMACEN = ["vista", "q", "hub", "wh", "status", "view"];

/**
 * URL de una vista conservando el resto de parámetros (p. ej. `lang`). Al
 * cambiar de vista se sueltan los filtros de recepciones.
 */
export function hrefDeVista(
  pathname: string,
  params: Record<string, string | string[] | undefined>,
  vista: VistaCn,
): string {
  const sp = new URLSearchParams();
  for (const [k, raw] of Object.entries(params)) {
    if (PARAMS_DE_ALMACEN.includes(k)) continue;
    const v = Array.isArray(raw) ? raw[0] : raw;
    if (v) sp.set(k, v);
  }
  if (vista === "camino") sp.set("vista", "camino");
  const qs = sp.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/** Texto del contador de días a la ETA: `null` días = sin ETA (no se inventa). */
export type TextoDias =
  | { tipo: "sin_eta" }
  | { tipo: "hoy" }
  | { tipo: "faltan"; dias: number }
  | { tipo: "vencida"; dias: number };

export function textoDeDias(dias: number | null): TextoDias {
  if (dias === null) return { tipo: "sin_eta" };
  if (dias === 0) return { tipo: "hoy" };
  return dias > 0 ? { tipo: "faltan", dias } : { tipo: "vencida", dias: -dias };
}
