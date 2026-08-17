/**
 * Migración por lote de los códigos del legado (SDD-0258).
 *
 * Quedan fichas con la serie de VENDEDOR (`DTD-A101`, `DTD-j029`…), de una época
 * sin gobernanza de códigos. Se pasan al rango `DTD-8xxx`, separado de la serie
 * viva de la casa (`DTD-9xxx`), para que migrar el legado no empuje el
 * correlativo de los clientes reales.
 *
 * ⚠️ ACÁ NO HAY NINGUNA DEFINICIÓN DE "DEL LEGADO", Y ES A PROPÓSITO. La tenía —
 * un patrón en JavaScript, en `markbox-legacy-queries.ts`— y se desincronizó de
 * la base en CUATRO HORAS: la migr 0379 pasó el criterio a «tiene ahora un
 * código de vendedor O TUVO uno» y la pantalla siguió mirando sólo el de hoy,
 * marcando 201 donde la base contaba 361. Un contador que miente en la pantalla
 * desde la que se aprueba una migración masiva.
 *
 * Ahora el conteo, el desglose y el mapeo vienen TODOS de
 * `rename_legacy_markboxes` (migr 0380), que es la misma función que ejecuta.
 */

/** Lo que devuelve la RPC `rename_legacy_markboxes`. */
export type LoteLegadoResult = {
  /** true = no se escribió nada, sólo se calculó el mapeo. */
  simulacro: boolean;
  enEsteLote: number;
  renombrados: number;
  /**
   * ⚠️ En simulacro incluye a los que se acaban de listar, porque nada se tocó.
   * Leerlo como "ya faltan menos" sería un error.
   */
  pendientesDespues: number;
  /** Desglose por letra de vendedor, del mismo predicado que el lote. */
  porSerie: { serie: string; fichas: number }[];
  mapeo: {
    de: string;
    a: string;
    /** Para saber a QUIÉN se le está cambiando el código, no sólo cuál. */
    nombre: string;
    /**
     * Si tiene acceso activo al portal. Ése es el que se entera del cambio:
     * entra y ve un código distinto al que le dimos. Los demás sólo existen
     * en el ERP.
     */
    portal: boolean;
  }[];
};

export type LoteLegadoActionState =
  | { ok: true; result: LoteLegadoResult }
  | { error: string }
  | null;

export function parseLoteResult(raw: unknown): LoteLegadoResult | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.simulacro !== "boolean") return null;

  const mapeoRaw = Array.isArray(r.mapeo) ? r.mapeo : [];
  const serieRaw = Array.isArray(r.por_serie) ? r.por_serie : [];

  return {
    simulacro: r.simulacro,
    enEsteLote: Number(r.en_este_lote ?? 0),
    renombrados: Number(r.renombrados ?? 0),
    pendientesDespues: Number(r.pendientes_despues ?? 0),
    porSerie: serieRaw
      .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
      .map((s) => ({ serie: String(s.serie ?? ""), fichas: Number(s.fichas ?? 0) }))
      .filter((s) => s.serie !== ""),
    mapeo: mapeoRaw
      .filter((m): m is Record<string, unknown> => !!m && typeof m === "object")
      .map((m) => ({
        de: String(m.de ?? ""),
        a: String(m.a ?? ""),
        nombre: String(m.nombre ?? ""),
        portal: m.portal === true,
      }))
      .filter((m) => m.de !== "" && m.a !== ""),
  };
}

/** Tamaños de lote ofrecidos. Se empieza chico a propósito. */
export const TAMANOS_DE_LOTE = [10, 25, 50, 100] as const;
