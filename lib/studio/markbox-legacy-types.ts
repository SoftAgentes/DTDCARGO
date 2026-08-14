/**
 * Migración por lote de los códigos del legado (SDD-0258).
 *
 * Quedan fichas con la serie de VENDEDOR (`DTD-A101`, `DTD-j029`…), de una época
 * sin gobernanza de códigos: cada vendedor tenía su letra. El concepto está
 * muerto y se pasan a la serie limpia de la casa.
 */

/** Lo que devuelve la RPC `rename_legacy_markboxes` (migr 0369). */
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

/** Resumen read-only para pintar la pantalla antes de simular nada. */
export type LegacyResumen = {
  pendientes: number;
  /** Cuántas fichas hay por letra de vendedor, para saber qué se está moviendo. */
  porSerie: { serie: string; fichas: number }[];
};

export function parseLoteResult(raw: unknown): LoteLegadoResult | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.simulacro !== "boolean") return null;
  const mapeoRaw = Array.isArray(r.mapeo) ? r.mapeo : [];
  return {
    simulacro: r.simulacro,
    enEsteLote: Number(r.en_este_lote ?? 0),
    renombrados: Number(r.renombrados ?? 0),
    pendientesDespues: Number(r.pendientes_despues ?? 0),
    mapeo: mapeoRaw
      .filter((m): m is Record<string, unknown> => !!m && typeof m === "object")
      .map((m) => ({
        de: String(m.de ?? ""),
        a: String(m.a ?? ""),
        // Tolerante a propósito: una respuesta de antes de la migr 0373 no trae
        // estos campos, y la pantalla tiene que seguir pintando el mapeo.
        nombre: String(m.nombre ?? ""),
        portal: m.portal === true,
      }))
      .filter((m) => m.de !== "" && m.a !== ""),
  };
}

/** Tamaños de lote ofrecidos. Se empieza chico a propósito. */
export const TAMANOS_DE_LOTE = [10, 25, 50, 100] as const;
