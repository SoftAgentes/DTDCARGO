/**
 * lib/studio/guia/estado-types.ts · Estado de la guía por usuario (SDD-0589, 9.3).
 *
 * Es la forma del `jsonb` de `user_guide_prefs.state` (migración 0517). La valida
 * `validarEstadoGuia` en la acción antes de guardar y al leer, como
 * `validateDashboardConfigInput` en el Dashboard: lo que no está en el catálogo se
 * descarta, así el catálogo cambia sin migrar datos.
 *
 * Solo ids de recorrido y de paso, booleanos y una fecha: sin datos de personas.
 */

import type { GuiaProgreso } from "./almacen";
import { RECORRIDOS } from "./recorridos";
import type { GuiaRecorrido } from "./tipos";

export const VERSION_ESTADO_GUIA = 1;

export interface EstadoGuia {
  v: typeof VERSION_ESTADO_GUIA;
  recorridos: Record<string, GuiaProgreso>;
}

export function estadoGuiaVacio(): EstadoGuia {
  return { v: VERSION_ESTADO_GUIA, recorridos: {} };
}

/** Fecha ISO razonable: se puede leer y no es un texto largo. */
function esFechaIso(valor: unknown): valor is string {
  return typeof valor === "string" && valor.length <= 40 && Number.isFinite(Date.parse(valor));
}

/**
 * Normaliza lo que llegue (del cliente o de la base) a un `EstadoGuia` válido.
 * Nunca lanza. Descarta recorridos fuera del catálogo y pasos que el recorrido ya
 * no tiene; los booleanos que falten valen `false`.
 */
export function validarEstadoGuia(
  entrada: unknown,
  catalogo: readonly GuiaRecorrido[] = RECORRIDOS,
): EstadoGuia {
  const estado = estadoGuiaVacio();
  if (!entrada || typeof entrada !== "object" || Array.isArray(entrada)) return estado;
  const recorridos = (entrada as { recorridos?: unknown }).recorridos;
  if (!recorridos || typeof recorridos !== "object" || Array.isArray(recorridos)) return estado;

  for (const recorrido of catalogo) {
    const crudo = (recorridos as Record<string, unknown>)[recorrido.id];
    if (!crudo || typeof crudo !== "object" || Array.isArray(crudo)) continue;
    const r = crudo as Record<string, unknown>;
    const pasoId =
      typeof r.pasoId === "string" && recorrido.pasos.some((p) => p.id === r.pasoId) ? r.pasoId : null;
    const progreso: GuiaProgreso = {
      pasoId,
      terminado: r.terminado === true,
      noMostrar: r.noMostrar === true,
    };
    if (esFechaIso(r.vistoEn)) progreso.vistoEn = r.vistoEn;
    estado.recorridos[recorrido.id] = progreso;
  }
  return estado;
}
