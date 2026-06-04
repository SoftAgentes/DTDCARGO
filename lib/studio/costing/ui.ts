/**
 * Helpers de presentación PUROS del módulo Costing & Margen (SDD-0053 · Slice B).
 *
 * Server-safe (sin Supabase, sin React): la UI (`CostingClient`) y los tests los
 * comparten. La page (server) resuelve la tasa de display; el client ordena
 * rankings / arma top·worst / calcula porcentajes de breakdown con estas
 * funciones. Mantiene la lógica fuera del JSX para poder testearla.
 */

import type { CostingRow, CostingTotals } from "./queries";
import type { CostCategoryKey } from "./types";

// ── Tasa BCV de display (USD↔VES, display-only) ───────────────
/**
 * Fallback de la tasa BCV cuando no hay ninguna factura en VES con fx_rate
 * (todavía no existe la pantalla de Tasas, SDD-0030). Mismo número que el mock
 * del Norte (`costing.jsx`), para no inventar otro.
 */
export const DEFAULT_VES_RATE = 36.45;

/**
 * Resuelve la tasa BCV a usar para el toggle VES (display-only). Toma el
 * `fx_rate` más reciente provisto (el de la última factura en VES), o el
 * fallback si no hay ninguno válido. NUNCA persiste — solo convierte para
 * mostrar (los costos viven en USD canónico).
 */
export function resolveDisplayRate(rawRate: number | null | undefined): number {
  const n = Number(rawRate);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_VES_RATE;
}

// ── Orden del Ranking ─────────────────────────────────────────
export type RankingSort =
  | "margin-pct-desc"
  | "margin-pct-asc"
  | "margin-abs-desc"
  | "revenue-desc";

export const RANKING_SORTS: { value: RankingSort; label: string }[] = [
  { value: "margin-pct-desc", label: "Margen % · mayor primero" },
  { value: "margin-pct-asc", label: "Margen % · menor primero" },
  { value: "margin-abs-desc", label: "Margen $ · mayor primero" },
  { value: "revenue-desc", label: "Revenue · mayor primero" },
];

/** Coacciona un valor crudo a un `RankingSort` válido (default margen % desc). */
export function asRankingSort(raw: unknown): RankingSort {
  return raw === "margin-pct-asc" ||
    raw === "margin-abs-desc" ||
    raw === "revenue-desc"
    ? raw
    : "margin-pct-desc";
}

/** Ordena las filas de costeo según el criterio del Ranking (PURA, no muta). */
export function sortRanking(
  rows: CostingRow[],
  sort: RankingSort,
): CostingRow[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    if (sort === "margin-pct-asc") return a.eco.marginPct - b.eco.marginPct;
    if (sort === "margin-abs-desc") return b.eco.margin - a.eco.margin;
    if (sort === "revenue-desc") return b.eco.revenue - a.eco.revenue;
    // margin-pct-desc (default)
    return b.eco.marginPct - a.eco.marginPct;
  });
  return copy;
}

// ── Top / peores (Overview) ───────────────────────────────────
export type TopWorst = {
  top: CostingRow[];
  worst: CostingRow[];
};

/**
 * Top N más rentables (margen $ desc) y N peores (margen $ asc), sin solaparse
 * cuando hay pocas filas. Solo considera embarques con revenue > 0 (sin revenue
 * no hay "margen" significativo para rankear). PURA.
 */
export function topAndWorst(rows: CostingRow[], n = 3): TopWorst {
  const withRevenue = rows.filter((r) => r.eco.revenue > 0);
  const byMargin = [...withRevenue].sort((a, b) => b.eco.margin - a.eco.margin);
  const top = byMargin.slice(0, n);
  const worst = [...byMargin]
    .reverse()
    .slice(0, n)
    // no repetir un embarque en ambas listas cuando hay < 2n filas
    .filter((r) => !top.includes(r));
  return { top, worst };
}

// ── Breakdown por categoría (Breakdown tab) ───────────────────
export type BreakdownRow = {
  key: CostCategoryKey;
  amount: number;
  /** % sobre el costo total (0 si el costo total es 0, sin NaN). */
  pct: number;
};

/**
 * Desglose por categoría: monto + % sobre el costo total. PURA. Orden = el de
 * `COST_CATEGORY_KEYS` que llega en `catTotals` (no reordena por monto, para que
 * coincida con la leyenda fija del Norte).
 */
export function breakdownRows(totals: CostingTotals): BreakdownRow[] {
  const keys = Object.keys(totals.catTotals) as CostCategoryKey[];
  return keys.map((key) => {
    const amount = totals.catTotals[key];
    const pct = totals.cost > 0 ? (amount / totals.cost) * 100 : 0;
    return { key, amount, pct };
  });
}

// ── Composición Revenue vs Costo (Overview) ───────────────────
/**
 * Porcentaje del revenue que se va en costo (0..100, clamp). 0 si revenue 0.
 * PURA. Para la línea "por cada $100 facturados, $X en costos".
 */
export function costPctOfRevenue(totals: CostingTotals): number {
  if (totals.revenue <= 0) return 0;
  const pct = (totals.cost / totals.revenue) * 100;
  return Math.max(0, Math.min(100, pct));
}
