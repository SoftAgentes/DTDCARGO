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

/**
 * Columnas de la tabla de «En camino». Vive aquí (sin "use client") porque la usan
 * el encabezado, que se pinta en el servidor, y la fila, que es cliente.
 * ETA y días toman el ancho de su texto y no se parten: si un texto crece, se ve,
 * en vez de re-maquetar la fila (/ui-check).
 */
export const COLUMNAS_CAMINO =
  "minmax(170px,1.3fr) minmax(120px,1fr) minmax(110px,max-content) minmax(110px,max-content) minmax(140px,1fr) minmax(190px,1fr)";

/** Valores que acepta el selector de estado; `""` es «En almacén». */
const VALORES_DEL_SELECTOR = ["all", "pendiente_consolidacion", "consolidado", "incidencia"];

/**
 * Valor del selector de estado a partir de `?status=`. Un valor que no existe se
 * lee como «En almacén» (`""`), igual que `parseReceiptFiltersFromSearchParams`
 * en el servidor: el selector nunca queda sin una opción elegida.
 */
export function statusDelSelector(crudo: string | null | undefined): string {
  return crudo && VALORES_DEL_SELECTOR.includes(crudo) ? crudo : "";
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
