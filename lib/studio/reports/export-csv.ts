/**
 * Export CSV de las vistas de Reportes (SDD-0052 · Slice C) — PURO, server-safe.
 *
 * El Constructor ya exportaba (builder-types). Esto generaliza el export a las
 * vistas "fijas" (Operacionales · Comerciales · Contables · Combinados) con UN
 * dispatcher `buildViewCsv(category, rep, data)` → `{ filename, content }` o
 * `null` cuando no hay nada que exportar (vista vacía o Constructor, que se
 * autogestiona).
 *
 * Sin `"use client"`, sin Supabase, sin lib externa: solo arma strings CSV a
 * partir de los agregados ya calculados. La descarga (Blob/DOM) vive en el
 * cliente (`downloadTextFile`). Reusa `csvCell` (escape) del Constructor.
 *
 * Valores numéricos crudos (sin `$`/`K`/`M`) para que el CSV sea usable en
 * planilla; los strings se escapan. PURO → testeable sin DB ni navegador.
 */

import { csvCell } from "./builder-types";
import type {
  AgingReport,
  CashflowReport,
  CombinedReport,
  CommercialByAgent,
  CommercialByClient,
  IncomeStatement,
  IvaPosition,
  OperationalOverview,
  PipelineReport,
  RepurchaseReport,
  RouteRow,
  ServiceRow,
  CarrierRow,
} from "./types";

/** Un valor de celda admitido (los números van crudos; null/undefined → ""). */
export type CsvValue = string | number | null | undefined;

/** Une encabezados + filas en un CSV (CRLF, cada celda escapada). PURO. */
export function rowsToCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers.map(csvCell).join(",")];
  for (const r of rows) lines.push(r.map(csvCell).join(","));
  return lines.join("\r\n");
}

/** Nombre de archivo del export: kebab + fecha ISO (today inyectable p/ tests). */
export function reportFilename(slug: string, today: Date = new Date()): string {
  const clean = slug
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // diacríticos (acentos combinantes)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `reporte-${clean || "datos"}-${today.toISOString().slice(0, 10)}.csv`;
}

// ── Tabla intermedia (slug + headers + rows) por vista ─────────
type CsvTable = { slug: string; headers: string[]; rows: CsvValue[][] };

/** Datos disponibles para exportar (subconjunto de lo que recibe ReportesClient). */
export type ViewCsvInput = {
  category: string;
  rep: string;
  today?: Date;
  overview?: OperationalOverview;
  routes?: RouteRow[];
  carriers?: CarrierRow[];
  services?: ServiceRow[];
  byClient?: CommercialByClient;
  byAgent?: CommercialByAgent;
  repurchase?: RepurchaseReport;
  pipeline?: PipelineReport;
  income?: IncomeStatement;
  aging?: AgingReport;
  cashflow?: CashflowReport;
  iva?: IvaPosition;
  combined?: CombinedReport;
};

export type ViewCsv = { filename: string; content: string };

const routeLabelOf = (origin: string, destination: string) =>
  `${origin || "—"} → ${destination || "—"}`;

/** Arma la tabla CSV de la vista activa, o null si no hay nada que exportar. */
function tableFor(input: ViewCsvInput): CsvTable | null {
  const { category, rep } = input;

  // Operacionales
  if (category === "op") {
    if (rep === "overview") {
      const ov = input.overview;
      if (!ov || ov.shipments === 0) return null;
      return {
        slug: "operacional-volumen-mensual",
        headers: ["Mes", "Embarques", "CBM"],
        rows: ov.monthly.map((p) => [p.label, p.count, p.cbm]),
      };
    }
    if (rep === "routes") {
      const rows = input.routes ?? [];
      if (rows.length === 0) return null;
      return {
        slug: "operacional-por-ruta",
        headers: ["Origen → Destino", "Envíos", "CBM", "Días prom.", "Revenue USD", "USD/CBM"],
        rows: rows.map((r) => [r.label, r.count, r.cbm, r.avgTransit ?? "", r.revenue, r.rate]),
      };
    }
    if (rep === "carriers") {
      const rows = input.carriers ?? [];
      if (rows.length === 0) return null;
      return {
        slug: "operacional-por-naviera",
        headers: ["Naviera", "Bookings", "Itinerarios"],
        rows: rows.map((c) => [c.name, c.bookings, c.sailings]),
      };
    }
    if (rep === "services") {
      const rows = input.services ?? [];
      if (rows.length === 0) return null;
      return {
        slug: "operacional-por-servicio",
        headers: ["Servicio", "Envíos", "CBM", "Días prom.", "Revenue USD", "USD/CBM"],
        rows: rows.map((s) => [s.label, s.count, s.cbm, s.avgTransit ?? "", s.revenue, s.rate]),
      };
    }
    return null;
  }

  // Comerciales · Por cliente / Por agente
  if (category === "com") {
    if (rep === "by-agent") {
      const data = input.byAgent;
      if (!data || !data.hasKommo || data.rows.length === 0) return null;
      return {
        slug: "comercial-por-agente",
        headers: ["Agente", "Estimados", "Ganadas", "Perdidas", "Conversión %", "Clientes", "Revenue USD 12m"],
        rows: data.rows.map((r) => [
          r.name,
          r.leads,
          r.won,
          r.lost,
          r.convPct,
          r.clients,
          r.revenueUsd,
        ]),
      };
    }
    if (rep === "repurchase") {
      const rp = input.repurchase;
      if (!rp || rp.rows.length === 0) return null;
      return {
        slug: "comercial-recompra",
        headers: ["Cliente", "Shipping Mark", "Último embarque", "Días sin comprar", "Estado"],
        rows: rp.rows.map((r) => [
          r.name,
          r.markbox,
          r.lastCode,
          r.daysSince,
          r.bucket === "overdue" ? "Vencida" : "Ventana",
        ]),
      };
    }
    if (rep === "pipeline") {
      const pl = input.pipeline;
      if (!pl || pl.byStatus.every((s) => s.count === 0)) return null;
      return {
        slug: "comercial-pipeline",
        headers: ["Estado", "Abierto", "Cantidad", "CBM", "USD"],
        rows: pl.byStatus.map((s) => [
          s.label,
          s.open ? "sí" : "no",
          s.count,
          s.cbm,
          s.usd,
        ]),
      };
    }
    const data = input.byClient;
    if (!data) return null;
    const ranked = data.ranking.filter((r) => r.billedUsd > 0);
    if (ranked.length === 0) return null;
    return {
      slug: "comercial-por-cliente",
      headers: ["#", "Shipping Mark", "Cliente", "Nivel", "Facturado USD 12m"],
      rows: ranked.map((r, i) => [i + 1, r.markbox, r.name, r.tierLabel, r.billedUsd]),
    };
  }

  // Contables
  if (category === "con") {
    if (rep === "income") {
      const inc = input.income;
      if (!inc || (inc.income === 0 && inc.netIncome === 0)) return null;
      return {
        slug: "contable-estado-resultados",
        headers: ["Concepto", "Monto USD", "% s/ingresos"],
        rows: inc.rows.map((r) => [r.label, r.amount, r.pct ?? ""]),
      };
    }
    if (rep === "aging") {
      const ag = input.aging;
      if (!ag || (ag.cxc.total === 0 && ag.cxp.total === 0)) return null;
      const side = (lado: string, s: AgingReport["cxc"]): CsvValue[][] =>
        s.buckets.map((b) => [lado, b.label, b.amount, b.count, b.pct]);
      return {
        slug: "contable-aging-cxc-cxp",
        headers: ["Lado", "Tramo", "Monto USD", "Documentos", "%"],
        rows: [...side("CxC", ag.cxc), ...side("CxP", ag.cxp)],
      };
    }
    if (rep === "iva") {
      const iva = input.iva;
      if (!iva || (iva.salesRows === 0 && iva.purchaseRows === 0)) return null;
      return {
        slug: "contable-posicion-iva",
        headers: ["Concepto", "Monto"],
        rows: [
          ["Débito fiscal (IVA ventas)", iva.debito],
          ["Crédito fiscal (IVA compras)", iva.credito],
          ["Cuota tributaria", iva.cuota],
          ["Retenciones soportadas", iva.retenciones],
          ["IVA a pagar", iva.aPagar],
          ["Excedente a favor", iva.excedente],
          ["Base gravada", iva.baseGravada],
          ["Base no gravada", iva.baseNoGravada],
          ["Facturas de venta", iva.salesRows],
          ["Compras", iva.purchaseRows],
        ],
      };
    }
    if (rep === "cashflow") {
      const cf = input.cashflow;
      if (!cf || (cf.totalBilled === 0 && cf.totalCollected === 0 && cf.outstanding === 0)) {
        return null;
      }
      return {
        slug: "contable-cashflow",
        headers: ["Mes", "Facturado USD", "Cobrado USD"],
        rows: cf.series.map((p) => [p.label, p.billed, p.collected]),
      };
    }
    return null;
  }

  // Combinados (rentabilidad real, según el rep activo)
  if (category === "mix") {
    const c = input.combined;
    if (!c || c.withCosts === 0) return null;
    if (rep === "margin-client") {
      if (c.byClient.length === 0) return null;
      return {
        slug: "combinado-margen-por-cliente",
        headers: ["Cliente", "Envíos", "Ingreso USD", "Costo USD", "Margen USD", "Margen %"],
        rows: c.byClient.map((r) => [r.client, r.count, r.revenue, r.cost, r.margin, r.marginPct]),
      };
    }
    if (rep === "cost-cbm") {
      const rows = c.byCbm.filter((r) => r.cbm > 0);
      if (rows.length === 0) return null;
      return {
        slug: "combinado-costo-por-cbm",
        headers: ["Ruta", "CBM", "$/CBM ingreso", "$/CBM costo", "Margen/CBM USD"],
        rows: rows.map((r) => [
          routeLabelOf(r.origin, r.destination),
          r.cbm,
          r.revenuePerCbm,
          r.costPerCbm,
          r.marginPerCbm,
        ]),
      };
    }
    // default: rentabilidad por ruta
    if (c.byRoute.length === 0) return null;
    return {
      slug: "combinado-rentabilidad-por-ruta",
      headers: ["Ruta", "Embarques", "Ingreso USD", "Costo USD", "Margen USD", "Margen %"],
      rows: c.byRoute.map((r) => [
        routeLabelOf(r.origin, r.destination),
        r.count,
        r.revenue,
        r.cost,
        r.margin,
        r.marginPct,
      ]),
    };
  }

  // Constructor (build) → se autogestiona dentro de BuilderView. Nada acá.
  return null;
}

/**
 * Dispatcher: arma el CSV de la vista activa (filename + content) o null si no
 * hay nada que exportar. Lo llama ReportesClient para habilitar/disparar el
 * botón "Exportar CSV" del header. PURO.
 */
export function buildViewCsv(input: ViewCsvInput): ViewCsv | null {
  const table = tableFor(input);
  if (!table) return null;
  return {
    filename: reportFilename(table.slug, input.today),
    content: rowsToCsv(table.headers, table.rows),
  };
}
