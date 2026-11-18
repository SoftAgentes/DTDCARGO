/**
 * Helpers de presentación PUROS del módulo Costing & Margen (SDD-0053 · Slice B).
 *
 * Server-safe (sin Supabase, sin React): la UI (`CostingClient`) y los tests los
 * comparten. La page (server) resuelve la tasa de display; el client ordena
 * rankings / arma top·worst / calcula porcentajes de breakdown con estas
 * funciones. Mantiene la lógica fuera del JSX para poder testearla.
 */

import { tasaValida } from "@/lib/shared/fx";
import type { CostingRow, CostingTotals } from "./queries";
import {
  matchTemplate,
  templateKey,
  totalCost,
  type CostCategoryKey,
  type RouteCostTemplate,
} from "./types";
import type { Quote } from "@/lib/studio/quote-types";

// ── Tasa BCV de display (USD↔VES, display-only) ───────────────

/**
 * Resuelve la tasa a usar para el toggle VES (display-only). SDD-0572: la tasa
 * vigente de `fx_rates` (`ultimaTasa("VES")`); sin ella, null y el selector de
 * bolívares se apaga (antes caía a 36,45 fijos). NUNCA persiste.
 */
export function resolveDisplayRate(rawRate: number | null | undefined): number | null {
  return tasaValida(rawRate);
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
    const incompleteA = (a.facturasSinTasa ?? 0) > 0;
    const incompleteB = (b.facturasSinTasa ?? 0) > 0;
    // Un subtotal no compite con un total. Entre incompletos se conserva el
    // orden recibido, independientemente del criterio elegido.
    if (incompleteA || incompleteB) return Number(incompleteA) - Number(incompleteB);
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
 * no hay "margen" significativo para rankear) y conversión completa. PURA.
 */
export function topAndWorst(rows: CostingRow[], n = 3): TopWorst {
  const withRevenue = rows.filter((r) => r.eco.revenue > 0 && (r.facturasSinTasa ?? 0) === 0);
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

// ── Forecast del pipeline (Forecast tab · Slice C) ────────────
/**
 * Margen estimado por defecto (fracción del revenue) cuando NO hay un template
 * que matchee la ruta+servicio del estimado. El Norte (`ForecastSection`)
 * asume ~22% de margen (costo = revenue × 0.78). Lo replicamos: si no podemos
 * estimar el costo real desde un template, usamos este factor.
 */
export const DEFAULT_FORECAST_MARGIN_PCT = 22;

/** ¿El estimado todavía está en el pipeline (cuenta para el forecast)? */
export type ForecastBucket = "accepted" | "pending";

/**
 * Etiqueta del estado del pipeline para el forecast:
 *  - `accepted` = aceptado, pendiente de embarcar (alta confianza).
 *  - `pending`  = enviado, esperando respuesta (pipeline abierto).
 */
export const FORECAST_BUCKET_LABEL: Record<ForecastBucket, string> = {
  accepted: "Aceptado · pendiente de embarcar",
  pending: "Enviado · esperando respuesta",
};

export type ForecastRow = {
  quote: Quote;
  bucket: ForecastBucket;
  revenue: number;
  /** Costo estimado: del template que matchea, o revenue × (1 − margen default). */
  cost: number;
  margin: number;
  marginPct: number;
  /** true si el costo salió de un template real (no de la estimación %). */
  fromTemplate: boolean;
  /** Nombre del template usado (para mostrar la fuente del estimado). */
  templateName: string | null;
};

export type ForecastTotals = {
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number;
  acceptedCount: number;
  pendingCount: number;
};

export type Forecast = {
  rows: ForecastRow[];
  totals: ForecastTotals;
};

function finite(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Bucket de un estimado para el forecast (null = no entra al pipeline). */
function quoteBucket(q: Quote): ForecastBucket | null {
  // Aceptada y todavía no convertida en embarque → pendiente de embarcar.
  if (q.status === "accepted" && !q.converted_to_shipment_id) return "accepted";
  // Enviada (esperando respuesta) → pipeline abierto.
  if (q.status === "sent") return "pending";
  return null;
}

/**
 * Estima el costo de un estimado. Si hay un template que matchea su
 * `origin + destination + service`, usa la suma de las 7 categorías del template.
 * Si no, estima con el margen default (costo = revenue × (1 − margen/100)).
 * PURA.
 */
export function estimateQuoteCost(
  q: Quote,
  templates: RouteCostTemplate[],
): { cost: number; fromTemplate: boolean; templateName: string | null } {
  const tpl = matchTemplate(templates, {
    origin: q.origin,
    destination: q.destination,
    shipment_service: q.service,
  });
  if (tpl) {
    return { cost: totalCost(tpl), fromTemplate: true, templateName: tpl.name };
  }
  const revenue = finite(q.total_usd);
  const cost = revenue * (1 - DEFAULT_FORECAST_MARGIN_PCT / 100);
  return { cost, fromTemplate: false, templateName: null };
}

/**
 * Proyección de margen sobre el pipeline (estimados aceptados pendientes de
 * embarcar + enviados esperando respuesta). Cruza cada estimado con los
 * templates de costo por ruta para estimar su costo; cae al margen default si
 * no hay template. PURA. Espejo de `ForecastSection` del Norte, anclado a los
 * estimados reales (`quotes`) en vez del mock.
 */
export function buildForecast(
  quotes: Quote[],
  templates: RouteCostTemplate[],
): Forecast {
  const rows: ForecastRow[] = [];

  for (const q of quotes) {
    const bucket = quoteBucket(q);
    if (!bucket) continue;

    const revenue = finite(q.total_usd);
    const { cost, fromTemplate, templateName } = estimateQuoteCost(q, templates);
    const margin = revenue - cost;
    const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;

    rows.push({
      quote: q,
      bucket,
      revenue,
      cost,
      margin,
      marginPct,
      fromTemplate,
      templateName,
    });
  }

  // Orden: aceptadas primero (más confianza), luego por revenue desc.
  rows.sort((a, b) => {
    if (a.bucket !== b.bucket) return a.bucket === "accepted" ? -1 : 1;
    return b.revenue - a.revenue;
  });

  let revenue = 0;
  let cost = 0;
  let acceptedCount = 0;
  let pendingCount = 0;
  for (const r of rows) {
    revenue += r.revenue;
    cost += r.cost;
    if (r.bucket === "accepted") acceptedCount += 1;
    else pendingCount += 1;
  }
  const margin = revenue - cost;
  const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;

  return {
    rows,
    totals: { revenue, cost, margin, marginPct, acceptedCount, pendingCount },
  };
}

// ── Export CSV del Ranking de costeo (Slice C) ────────────────
/** Escapa un valor para una celda CSV (comillas, comas, saltos de línea). */
export function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Encabezados del CSV exportado (USD canónico, 1 columna por categoría). */
export const COSTING_CSV_HEADERS = [
  "Codigo",
  "Cliente",
  "Origen",
  "Destino",
  "Servicio",
  "Revenue USD",
  "Flete",
  "Aduana",
  "Transporte",
  "Handling",
  "Seguro",
  "Comision",
  "Otros",
  "Costo total USD",
  "Margen USD",
  "Margen %",
  "Estado de conversión",
  "Facturas sin tasa",
] as const;

/** Redondea a 2 decimales (números de plata estables en el CSV). */
function round2(n: number): number {
  return Math.round(finite(n) * 100) / 100;
}

/** Una fila CSV (array de celdas crudas, sin escapar) desde una CostingRow. */
export function costingCsvRow(row: CostingRow): (string | number)[] {
  const e = row.eco;
  const s = row.shipment;
  const sinTasa = row.facturasSinTasa ?? 0;
  return [
    s.code ?? "",
    s.client_name ?? "",
    s.origin ?? "",
    s.destination ?? "",
    s.shipment_service ?? "",
    round2(e.revenue),
    round2(e.freight),
    round2(e.customs),
    round2(e.transport),
    round2(e.handling),
    round2(e.insurance),
    round2(e.commission),
    round2(e.other),
    round2(e.totalCost),
    sinTasa > 0 ? "" : round2(e.margin),
    sinTasa > 0 ? "" : round2(e.marginPct),
    sinTasa > 0 ? "Subtotal parcial" : "Completo",
    sinTasa,
  ];
}

/**
 * Arma el contenido CSV completo del Ranking de costeo (todas las columnas en
 * USD canónico — el toggle VES es solo display y no aplica al export). PURA, sin
 * lib externa. Las filas se exportan en el orden recibido.
 */
export function buildCostingCsv(rows: CostingRow[]): string {
  const lines: string[] = [];
  lines.push(COSTING_CSV_HEADERS.map(csvCell).join(","));
  for (const row of rows) {
    lines.push(costingCsvRow(row).map(csvCell).join(","));
  }
  return lines.join("\r\n");
}

// Re-export del helper de match para que el hook de auto-prefill (tracking) y
// los tests compartan exactamente la misma lógica que la UI/forecast.
export { matchTemplate, templateKey };
