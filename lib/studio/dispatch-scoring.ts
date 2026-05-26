/**
 * Algoritmo de scoring del Despacho (SDD-0029 §5).
 *
 * Función pura · sin side effects · sin dependencias del DOM o Supabase.
 * Se ejecuta en el server component de /studio/despacho cuando se
 * renderiza la cola, sobre el array de EligiblePackages que vienen de
 * dispatch-queries.listEligiblePackages().
 *
 * Output: score 0-100 + level (critico/alto/medio/bajo).
 *
 * Tests en lib/studio/__tests__/dispatch-scoring.test.ts.
 */

import type { EligiblePackage } from "./dispatch-types";
import type { DispatchRules } from "./dispatch-rules-types";

/**
 * Calcula el score 0-100 de un paquete según las rules del tenant.
 *
 * @param pkg paquete elegible (proyección runtime de warehouse_receipts_cn)
 * @param rules configuración del motor del tenant (dispatch_rules)
 * @returns número 0-100 redondeado
 */
export function scorePackage(
  pkg: EligiblePackage,
  rules: DispatchRules,
): number {
  const w = rules.weights;
  let score = 0;

  // Pago (mutuamente exclusivo · solo uno de full_pay o partial_pay aplica)
  if (pkg.pay === "pagado") score += w.full_pay;
  else if (pkg.pay === "parcial") score += w.partial_pay;
  // 'pendiente' no suma nada

  // FIFO antigüedad (lineal saturado a 21 días)
  const fifoRatio = Math.min(pkg.days_in_warehouse / 21, 1);
  score += fifoRatio * w.fifo;

  // Ciudad principal (Valencia / Caracas / Caracas Metropolitana)
  const cityLower = pkg.city.trim().toLowerCase();
  if (
    cityLower === "valencia" ||
    cityLower.startsWith("caracas")
  ) {
    score += w.valencia;
  }

  // VIP markbox (solo si optional_rules.tier está ON · o whitelist)
  if (rules.optional_rules.tier && pkg.tier && (pkg.tier === "Gold" || pkg.tier === "Platinum")) {
    score += w.vip;
  } else if (rules.vip_markboxes.includes(pkg.markbox)) {
    score += w.vip;
  }

  // Cercanía a ruta del día (solo si optional_rules.routes está ON · 0-5 precalculado)
  if (rules.optional_rules.routes && pkg.route_proximity != null) {
    const proxRatio = Math.max(0, Math.min(pkg.route_proximity / 5, 1));
    score += proxRatio * w.route_proximity;
  }

  return Math.min(100, Math.round(score));
}

export type ScoreLevel = "critico" | "alto" | "medio" | "bajo";

export function scoreLevel(score: number): ScoreLevel {
  if (score >= 80) return "critico";
  if (score >= 65) return "alto";
  if (score >= 45) return "medio";
  return "bajo";
}

export const SCORE_LEVEL_LABELS: Record<ScoreLevel, string> = {
  critico: "Crítico",
  alto: "Alto",
  medio: "Medio",
  bajo: "Bajo",
};

export const SCORE_LEVEL_COLORS: Record<ScoreLevel, string> = {
  critico: "var(--danger)",
  alto: "var(--wine)",
  medio: "var(--warning)",
  bajo: "var(--ink-soft)",
};

/**
 * Aplica la payment_policy del tenant para filtrar la cola visible.
 * - estricto → solo pagados
 * - hold → todos visibles, pero los no-pagados greyed (lo decide la UI)
 * - credito_whitelist → pagados + (no-pagados con markbox en whitelist)
 */
export function applyPaymentPolicy(
  packages: EligiblePackage[],
  rules: DispatchRules,
): EligiblePackage[] {
  switch (rules.payment_policy) {
    case "estricto":
      return packages.filter((p) => p.pay === "pagado");
    case "hold":
      return packages; // todos visibles · UI decide cómo greyed
    case "credito_whitelist":
      return packages.filter(
        (p) =>
          p.pay === "pagado" ||
          rules.whitelist_markboxes.includes(p.markbox),
      );
    default:
      return packages;
  }
}

/**
 * Pipeline completo:
 *  1. Aplica payment_policy
 *  2. Calcula score por paquete (mutando pkg.score)
 *  3. Ordena desc por score, tiebreaker FIFO (más viejo primero)
 */
export function rankPackagesByScore(
  packages: EligiblePackage[],
  rules: DispatchRules,
): EligiblePackage[] {
  const filtered = applyPaymentPolicy(packages, rules);
  const scored = filtered.map((p) => ({
    ...p,
    score: scorePackage(p, rules),
  }));
  return scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.days_in_warehouse - a.days_in_warehouse;
  });
}
