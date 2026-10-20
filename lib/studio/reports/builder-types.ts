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
 *    normalizado a USD. Ambos campos existen en `invoices`. SDD-0572: la que no
 *    convierte conserva null y contador por métrica, además de la dimensión Tasa.
 *
 * La query produce filas ya "aplanadas" a esta forma (dims resueltas a labels,
 * métricas a número, filtros a string) → `buildReport` es PURO y testeable sin DB.
 */

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
  metrics: Record<string, number | null>;
  /** Documentos excluidos de cada métrica monetaria, aun si hay subtotal conocido. */
  metricSinTasa?: Record<string, number>;
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
      // SDD-0572: si alguna factura del embarque no convierte (sin tasa).
      { key: "tasa", label: "Tasa" },
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
      { key: "tasa", label: "Tasa" },
    ],
  },
  invoices: {
    id: "invoices",
    label: "Facturas",
    dims: [
      { key: "client", label: "Cliente" },
      { key: "status", label: "Estado" },
      { key: "currency", label: "Moneda" },
      // SDD-0572: la factura sin tasa no suma en USD; con este corte se ve.
      { key: "tasa", label: "Tasa" },
    ],
    metrics: [
      { key: "count", label: "Cantidad", agg: "count" },
      { key: "amount", label: "Monto USD", agg: "sum", money: true },
      { key: "balance", label: "Saldo USD", agg: "sum", money: true },
    ],
    filters: [
      { key: "status", label: "Estado" },
      { key: "currency", label: "Moneda" },
      { key: "tasa", label: "Tasa" },
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
  value: number | null;
  count: number; // cantidad de filas en el grupo
  subtotal: number; // suma conocida; no convierte un desconocido en cero definitivo
  sinTasa: number;
};

export type ReportResult = {
  rows: ReportResultRow[];
  total: number | null; // null si solo desconocido, o promedio monetario incompleto
  subtotal: number;
  sinTasa: number;
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
  type Acc = { sum: number; count: number; known: number; sinTasa: number };
  const groups = new Map<string, Acc>();
  let globalSum = 0;
  let globalCount = 0;
  let globalKnown = 0;
  let globalSinTasa = 0;
  for (const r of filtered) {
    const key = (r.dims[dim.key] ?? "").trim() || EMPTY_GROUP_LABEL;
    const g = groups.get(key) ?? { sum: 0, count: 0, known: 0, sinTasa: 0 };
    const raw = r.metrics[metric.key];
    const known = typeof raw === "number" && Number.isFinite(raw);
    const missing = !isCount && metric.money
      ? Math.max(known ? 0 : 1, finite(r.metricSinTasa?.[metric.key]))
      : 0;
    const v = isCount ? 0 : finite(raw);
    g.sum += v;
    g.count += 1;
    g.known += Number(known);
    g.sinTasa += missing;
    groups.set(key, g);
    globalSum += v;
    globalCount += 1;
    globalKnown += Number(known);
    globalSinTasa += missing;
  }

  // 3. Una suma parcial puede mostrarse como subtotal. Un promedio incompleto
  // o un grupo solo desconocido no tiene valor certificable. Count/CBM no
  // dependen de la conversión del ingreso.
  const valueOf = (g: Acc): number | null => {
    if (isCount) return g.count;
    if (metric.money && g.sinTasa > 0 && (metric.agg === "avg" || g.known === 0)) return null;
    const value = metric.agg === "avg" ? (g.count > 0 ? g.sum / g.count : 0) : g.sum;
    return metric.money || metric.agg === "avg" ? round2(value) : value;
  };
  const resultRows: ReportResultRow[] = [...groups.entries()].map(
    ([label, g]) => {
      return {
        label,
        value: valueOf(g),
        count: g.count,
        subtotal: isCount ? g.count : round2(g.sum),
        sinTasa: g.sinTasa,
      };
    },
  );

  // 4. Orden desc por valor, label como desempate (orden estable y testeable).
  resultRows.sort((a, b) => {
    if (a.sinTasa > 0 || b.sinTasa > 0) return Number(a.sinTasa > 0) - Number(b.sinTasa > 0);
    if (b.value !== a.value) return (b.value ?? 0) - (a.value ?? 0);
    return a.label.localeCompare(b.label);
  });

  // 5. Total.
  const globalValue = valueOf({ sum: globalSum, count: globalCount, known: globalKnown, sinTasa: globalSinTasa });
  // La suma global conserva su redondeo histórico incluso para medidas físicas.
  const total = globalValue === null ? null : round2(globalValue);
  return { rows: resultRows, total, subtotal: isCount ? globalCount : round2(globalSum), sinTasa: globalSinTasa, agg: metric.agg, money: !!metric.money };
}

// ── Export CSV (PURO, sin lib externa) ─────────────────────────

/**
 * Escapa un valor para una celda CSV (comillas, comas, saltos de línea) +
 * neutraliza **CSV formula injection**: una celda de TEXTO que empieza con
 * `= + - @` (o tab/CR) la interpreta Excel/Sheets como fórmula (`=HYPERLINK(...)`,
 * DDE, exfiltración). Si la celda arranca con uno de esos chars y NO es un número
 * válido, le anteponemos `'` para forzar texto. Los números (incluidos negativos
 * como `-100`) quedan intactos: `Number("-100")` es finito → no se prefija.
 */
export function csvCell(value: unknown): string {
  let s = value == null ? "" : String(value);
  if (s !== "" && /^[=+\-@\t\r]/.test(s) && !Number.isFinite(Number(s))) {
    s = `'${s}`;
  }
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

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
  if (result.money) cols.push("Estado de conversión", "Documentos sin tasa", "Subtotal conocido USD");
  const lines: string[] = [cols.map(csvCell).join(",")];
  for (const r of result.rows) {
    const value =
      r.value === null ? "" : result.money
        ? Math.round(r.value)
        : result.agg === "avg"
          ? r.value.toFixed(2)
          : r.value;
    const cells: unknown[] = [r.label, r.count, value];
    if (result.money) cells.push(r.sinTasa > 0 ? "Conversión incompleta" : "Completo", r.sinTasa, r.subtotal);
    lines.push(cells.map(csvCell).join(","));
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
