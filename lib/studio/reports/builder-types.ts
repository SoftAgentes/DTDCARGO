/**
 * Constructor de reportes (SDD-0052 · Slice C) — modelo de fuentes + agregación
 * PURA + export CSV.
 *
 * Server-safe (sin `"use client"`, sin Supabase, sin Zod). Lo importan tanto el
 * `page.tsx` (server, para conocer las fuentes/columnas a traer) como
 * `ReportesClient.tsx` (client, para los selectores + la tabla + el export) sin
 * cruzar la frontera RSC.
 *
 * Decisiones ancladas (spec §3.2 · regla "anclar a datos reales, NUNCA fabricar"):
 *  - SOLO 2 fuentes en V1 (Embarques · Facturas), cada dim/métrica anclada a un
 *    campo que EXISTE en la tabla real. NO se inventan costos/márgenes/segmentos.
 *  - Embarques: Revenue USD = join existente por shipment_code (lo enriquece la
 *    query, igual que el resto de Reportes); CBM = volume_m3.
 *  - Facturas: Monto USD = invoiceUsdAmount; Saldo USD = (total − pagado)
 *    normalizado a USD. Ambos campos existen en `invoices`.
 *
 * La query produce filas ya "aplanadas" a esta forma (dims resueltas a labels,
 * métricas a número, filtros a string) → `buildReport` es PURO y testeable sin DB.
 */

import { csvCell } from "@/lib/studio/export/csv";

export { csvCell };

// ── Forma de una fila aplanada para el constructor ─────────────
/**
 * Una fila de fuente lista para agregar. La query resuelve:
 *  - `dims`    → label legible por cada dimensión declarada (key → label).
 *  - `metrics` → valor numérico por cada métrica sumable/promediable.
 *  - `filters` → valor (label) por cada filtro declarado, para filtrar in-memory.
 * `count` siempre es 1 por fila (la métrica "Cantidad" cuenta filas).
 */
export type BuilderRow = {
  dims: Record<string, string>;
  metrics: Record<string, number>;
  filters: Record<string, string>;
};

// ── Descriptores del modelo de fuentes ─────────────────────────

export type AggKind = "count" | "sum" | "avg";

/** Una dimensión por la que se puede agrupar. */
export type SourceDim = { key: string; label: string };

/** Una métrica agregable. `money` = formatear como USD en la UI/CSV. */
export type SourceMetric = {
  key: string;
  label: string;
  agg: AggKind;
  money?: boolean;
};

/** Un filtro disponible (los valores posibles los descubre la query/UI de las filas). */
export type SourceFilter = { key: string; label: string };

/** Una fuente del constructor (id estable + dims/metrics/filters declarados). */
export type ReportSource = {
  id: string;
  label: string;
  dims: SourceDim[];
  metrics: SourceMetric[];
  filters: SourceFilter[];
};

export type ReportSourceId = "shipments" | "invoices";

/**
 * Catálogo de fuentes V1. SOLO embarques + facturas, ancladas a campos reales.
 * Cada `key` de dim/métrica/filtro tiene que existir en las filas que produce
 * `builderRows` (queries.ts) — los tests lo verifican.
 */
export const REPORT_SOURCES: Record<ReportSourceId, ReportSource> = {
  shipments: {
    id: "shipments",
    label: "Embarques",
    dims: [
      { key: "client", label: "Cliente" },
      { key: "route", label: "Ruta" },
      { key: "status", label: "Estado" },
      { key: "service", label: "Servicio" },
    ],
    metrics: [
      { key: "count", label: "Cantidad", agg: "count" },
      { key: "cbm", label: "CBM total", agg: "sum" },
      { key: "cbm", label: "CBM promedio", agg: "avg" },
      { key: "revenue", label: "Revenue USD", agg: "sum", money: true },
    ],
    filters: [
      { key: "status", label: "Estado" },
      { key: "service", label: "Servicio" },
    ],
  },
  invoices: {
    id: "invoices",
    label: "Facturas",
    dims: [
      { key: "client", label: "Cliente" },
      { key: "status", label: "Estado" },
      { key: "currency", label: "Moneda" },
    ],
    metrics: [
      { key: "count", label: "Cantidad", agg: "count" },
      { key: "amount", label: "Monto USD", agg: "sum", money: true },
      { key: "balance", label: "Saldo USD", agg: "sum", money: true },
    ],
    filters: [
      { key: "status", label: "Estado" },
      { key: "currency", label: "Moneda" },
    ],
  },
};

export const REPORT_SOURCE_IDS: ReportSourceId[] = ["shipments", "invoices"];

/** Normaliza un valor crudo (URL/UI) a un ReportSourceId válido (default shipments). */
export function asSourceId(raw: unknown): ReportSourceId {
  return raw === "invoices" ? "invoices" : "shipments";
}

// ── Agregación PURA ────────────────────────────────────────────

/** Una fila del resultado agregado (label de grupo + valor de la métrica + #filas). */
export type ReportResultRow = {
  label: string;
  value: number;
  count: number; // cantidad de filas en el grupo
};

export type ReportResult = {
  rows: ReportResultRow[];
  total: number; // suma de los valores (para count/sum) o promedio global (avg)
  agg: AggKind;
  money: boolean;
};

export type BuildReportOptions = {
  /** Dimensión por la que agrupar (debe existir en `source.dims`). */
  dim: SourceDim;
  /** Métrica a agregar (debe existir en `source.metrics`). */
  metric: SourceMetric;
  /** Filtro activo (opcional). `value` = "all" o vacío → sin filtrar. */
  filter?: { key: string; value: string } | null;
};

function finite(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round((finite(n) + Number.EPSILON) * 100) / 100;
}

const EMPTY_GROUP_LABEL = "—";

/**
 * Agrega filas por dimensión y aplica la métrica. PURO — sin NaN/Infinity.
 *
 *  - `count`: cuenta filas por grupo (value = #filas).
 *  - `sum`:   suma `row.metrics[metric.key]` por grupo.
 *  - `avg`:   promedio de `row.metrics[metric.key]` por grupo (0 si grupo vacío).
 *
 * Ordena las filas desc por valor (label como desempate estable). `total`:
 *  - count/sum → suma de los valores de los grupos.
 *  - avg       → promedio global sobre TODAS las filas consideradas (no promedio
 *                de promedios), 0 si no hay filas.
 */
export function buildReport(
  rows: BuilderRow[],
  opts: BuildReportOptions,
): ReportResult {
  const { dim, metric, filter } = opts;
  const isCount = metric.agg === "count";

  // 1. Filtro in-memory (label exacto; "all"/vacío = sin filtro).
  const filtered =
    filter && filter.value && filter.value !== "all"
      ? rows.filter((r) => (r.filters[filter.key] ?? "") === filter.value)
      : rows;

  // 2. Agrupar por dimensión.
  const groups = new Map<string, { sum: number; count: number }>();
  let globalSum = 0;
  let globalCount = 0;
  for (const r of filtered) {
    const key = (r.dims[dim.key] ?? "").trim() || EMPTY_GROUP_LABEL;
    const g = groups.get(key) ?? { sum: 0, count: 0 };
    const v = isCount ? 0 : finite(r.metrics[metric.key]);
    g.sum += v;
    g.count += 1;
    groups.set(key, g);
    globalSum += v;
    globalCount += 1;
  }

  // 3. Valor por grupo según la agregación.
  const resultRows: ReportResultRow[] = [...groups.entries()].map(
    ([label, g]) => {
      let value: number;
      if (isCount) value = g.count;
      else if (metric.agg === "avg") value = g.count > 0 ? g.sum / g.count : 0;
      else value = g.sum; // sum
      return {
        label,
        value: metric.money || metric.agg === "avg" ? round2(value) : value,
        count: g.count,
      };
    },
  );

  // 4. Orden desc por valor, label como desempate (orden estable y testeable).
  resultRows.sort((a, b) => {
    if (b.value !== a.value) return b.value - a.value;
    return a.label.localeCompare(b.label);
  });

  // 5. Total.
  let total: number;
  if (isCount) total = globalCount;
  else if (metric.agg === "avg")
    total = globalCount > 0 ? round2(globalSum / globalCount) : 0;
  else total = round2(globalSum);

  return { rows: resultRows, total, agg: metric.agg, money: !!metric.money };
}

// ── Export CSV (PURO, sin lib externa) ─────────────────────────

/**
 * Arma el contenido CSV de un resultado del constructor. Encabezados =
 * `[dimLabel, "Registros", metricLabel]`. Los valores money/avg se redondean
 * (2 decimales avg, entero money) para que el CSV sea estable. PURO.
 */
export function buildReportCsv(
  result: ReportResult,
  headers: { dim: string; metric: string },
): string {
  const cols = [headers.dim, "Registros", headers.metric];
  const lines: string[] = [cols.map(csvCell).join(",")];
  for (const r of result.rows) {
    const value =
      result.money
        ? Math.round(r.value)
        : result.agg === "avg"
          ? r.value.toFixed(2)
          : r.value;
    lines.push([r.label, r.count, value].map(csvCell).join(","));
  }
  return lines.join("\r\n");
}

/** Nombre de archivo del export (kebab, sin acentos, con fecha ISO). */
export function reportCsvFilename(
  sourceId: ReportSourceId,
  dimLabel: string,
  today: Date = new Date(),
): string {
  const slug = dimLabel
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // diacríticos (acentos combinantes)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `reporte-${sourceId}-${slug}-${today.toISOString().slice(0, 10)}.csv`;
}
