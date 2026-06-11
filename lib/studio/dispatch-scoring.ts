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
 * Breakdown del score por regla · para Preview Live del editor de reglas.
 * Devuelve cada componente que sumó al total (label + pts) · útil para mostrar
 * cómo se compone el score en UI didáctica.
 */
export type ScoreLine = {
  key: string;
  label: string;
  pts: number;
  muted?: boolean;
};

export function scoreBreakdown(
  pkg: EligiblePackage,
  rules: DispatchRules,
): { total: number; lines: ScoreLine[] } {
  const w = rules.weights;
  const lines: ScoreLine[] = [];
  let total = 0;

  const cityLower = pkg.city.trim().toLowerCase();
  if (cityLower === "valencia" || cityLower.startsWith("caracas")) {
    lines.push({ key: "valencia", label: `Ciudad principal · ${pkg.city}`, pts: w.valencia });
    total += w.valencia;
  }

  if (pkg.pay === "pagado") {
    lines.push({ key: "full_pay", label: "Pagado 100%", pts: w.full_pay });
    total += w.full_pay;
  } else if (pkg.pay === "parcial") {
    lines.push({ key: "partial_pay", label: "Abono parcial", pts: w.partial_pay });
    total += w.partial_pay;
  } else {
    lines.push({ key: "no_pay", label: "Sin pago", pts: 0, muted: true });
  }

  const fifoRatio = Math.min(pkg.days_in_warehouse / 21, 1);
  const fifoPts = Math.round(fifoRatio * w.fifo);
  lines.push({
    key: "fifo",
    label: `FIFO antigüedad · ${pkg.days_in_warehouse}d`,
    pts: fifoPts,
  });
  total += fifoPts;

  if (rules.optional_rules.tier && pkg.tier && (pkg.tier === "Gold" || pkg.tier === "Platinum")) {
    lines.push({ key: "vip", label: `Cliente ${pkg.tier}`, pts: w.vip });
    total += w.vip;
  } else if (rules.vip_markboxes.includes(pkg.markbox)) {
    lines.push({ key: "vip", label: `VIP Shipping Mark manual`, pts: w.vip });
    total += w.vip;
  }

  if (rules.optional_rules.routes && pkg.route_proximity != null) {
    const proxRatio = Math.max(0, Math.min(pkg.route_proximity / 5, 1));
    const proxPts = Math.round(proxRatio * w.route_proximity);
    lines.push({
      key: "route",
      label: `Cercanía ruta · ${pkg.route_proximity}/5`,
      pts: proxPts,
    });
    total += proxPts;
  }

  return { total: Math.min(100, total), lines };
}

export type PolicyEvalState = "ok" | "blocked" | "credit-ok";

export function evaluatePolicy(
  pkg: EligiblePackage,
  rules: DispatchRules,
): { state: PolicyEvalState; reason: string } {
  if (pkg.pay === "pagado") return { state: "ok", reason: "Pago saldado · sin restricción." };
  if (rules.payment_policy === "estricto") {
    return {
      state: "blocked",
      reason: `Política estricta · ${pkg.pay === "parcial" ? "abono parcial" : "pago pendiente"} bloqueado.`,
    };
  }
  if (rules.payment_policy === "hold") {
    return {
      state: "ok",
      reason: rules.hold_until
        ? `Hold activo hasta ${rules.hold_until} · entra a la cola con score normal.`
        : "Hold sin fecha · entra a la cola.",
    };
  }
  if (rules.payment_policy === "credito_whitelist") {
    if (rules.whitelist_markboxes.includes(pkg.markbox)) {
      return { state: "credit-ok", reason: "Cliente con crédito aprobado · excepción permitida." };
    }
    return {
      state: "blocked",
      reason: `${pkg.markbox} no está en whitelist · pago pendiente bloqueado.`,
    };
  }
  return { state: "ok", reason: "" };
}

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
