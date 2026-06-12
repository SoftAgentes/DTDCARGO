/**
 * Helpers PUROS de presentación de la cola de reconciliación
 * (SDD-0059 · Slice B2). Sin DB, sin React — sólo derivan, para que la UI
 * (StatementDetail) y los tests compartan la misma lógica de agrupación.
 *
 * Mapea el `match_status` de una línea a la pestaña de la cola y computa los
 * contadores + el % conciliado de un estado de cuenta.
 */

import type { MatchStatus } from "./types";

/** Pestañas de la cola de reconciliación (espejo de conciliacion.jsx). */
export type ReconcileTab =
  | "revisar"
  | "conciliados"
  | "sin_sugerencia"
  | "discrepancias";

/**
 * A qué pestaña pertenece una línea según su `match_status`:
 *  - match_auto  → "revisar"        (sugerencia auto, espera confirmación).
 *  - match_manual → "conciliados"   (resuelta por el operador).
 *  - discrepancia → "discrepancias" (mismo concepto, monto distinto).
 *  - resto (sin_match / solo_en_estado / solo_en_erp) → "sin_sugerencia".
 */
export function tabForMatchStatus(status: MatchStatus): ReconcileTab {
  switch (status) {
    case "match_auto":
      return "revisar";
    case "match_manual":
      return "conciliados";
    case "discrepancia":
      return "discrepancias";
    case "sin_match":
    case "solo_en_estado":
    case "solo_en_erp":
    default:
      return "sin_sugerencia";
  }
}

export type ReconcileCounts = {
  revisar: number;
  conciliados: number;
  sin_sugerencia: number;
  discrepancias: number;
  total: number;
  /** % conciliado = conciliados / total (0 si no hay líneas). */
  pct: number;
  /** ¿Se puede cerrar el período? (no quedan líneas a revisar). */
  canClose: boolean;
};

/**
 * Cuenta las líneas por pestaña + computa el % conciliado y si se puede cerrar.
 * Ignora líneas soft-deleted. PURO — testeable sin DB.
 */
export function countLines(
  lines: { match_status: MatchStatus; deleted_at?: string | null }[],
): ReconcileCounts {
  const live = lines.filter((l) => l.deleted_at == null);
  const counts: ReconcileCounts = {
    revisar: 0,
    conciliados: 0,
    sin_sugerencia: 0,
    discrepancias: 0,
    total: live.length,
    pct: 0,
    canClose: true,
  };
  for (const l of live) {
    counts[tabForMatchStatus(l.match_status)] += 1;
  }
  counts.pct =
    live.length > 0
      ? Math.round((counts.conciliados / live.length) * 100)
      : 0;
  // Sólo se cierra cuando no quedan sugerencias auto pendientes de confirmar.
  counts.canClose = counts.revisar === 0;
  return counts;
}
