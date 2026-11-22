/**
 * Enlaces de la pantalla de Tracking (SDD-0659). Todo el estado vive en la URL:
 *  - `g`  filtro elegido (mar, origen, destino, sin);
 *  - `c`  contenedor abierto;
 *  - `e`  envío resaltado dentro del contenedor (abre «Quién viene adentro»);
 *  - `id` envío elegido cuando no tiene contenedor (y entrada histórica);
 *  - `q`  búsqueda.
 */

import { formatCbm } from "@/lib/shared/cbm";

export type ParametrosDeTracking = {
  g?: string | null;
  c?: string | null;
  e?: string | null;
  id?: string | null;
  q?: string | null;
};

export function hrefDeTracking(p: ParametrosDeTracking): string {
  const sp = new URLSearchParams();
  for (const clave of ["g", "c", "e", "id", "q"] as const) {
    const v = p[clave];
    if (v) sp.set(clave, v);
  }
  const qs = sp.toString();
  return qs ? `/studio/tracking?${qs}` : "/studio/tracking";
}

const FECHA_CORTA: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
};

/**
 * Fecha corta («25 nov»). Las fechas del itinerario son días sin hora: se leen
 * en UTC para que no se corran un día según el huso del servidor.
 */
export function fechaCorta(iso: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  // es-VE devuelve «09-nov.»: se arma a mano para que quede «09 nov».
  const partes = new Intl.DateTimeFormat("es-VE", FECHA_CORTA).formatToParts(new Date(t));
  const de = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${de("day")} ${de("month").replace(/\.$/, "")}`;
}

/** «en 7 días», «hoy», «hace 2 días». null = sin fecha. */
export function textoDeDias(dias: number | null): string {
  if (dias === null) return "—";
  if (dias === 0) return "hoy";
  if (dias > 0) return dias === 1 ? "1 día" : `${dias} días`;
  return dias === -1 ? "hace 1 día" : `hace ${-dias} días`;
}

export function metrosCubicos(n: number): string {
  return formatCbm(n, { unit: true });
}
