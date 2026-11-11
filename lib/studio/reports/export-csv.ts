import { billingStatus } from "@/lib/shared/annual-billing";
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
import { vistaDelEstado } from "./types";
import {
  describirIngreso,
  causaDelControlI2,
  ETIQUETA_ESTADO_INGRESO,
} from "@/lib/studio/accounting/ingreso-periodo";

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
        headers: ["Origen → Destino", "Envíos", "CBM", "Días prom.", "Revenue USD (subtotal conocido)", "USD/CBM", "Estado de conversión", "Facturas sin tasa"],
        rows: rows.map((r) => [r.label, r.count, r.cbm, r.avgTransit ?? "", r.revenue, (r.facturasSinTasa ?? 0) > 0 ? null : r.rate, (r.facturasSinTasa ?? 0) > 0 ? "Conversión incompleta" : "Completo", r.facturasSinTasa ?? 0]),
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
        headers: ["Servicio", "Envíos", "CBM", "Días prom.", "Revenue USD (subtotal conocido)", "USD/CBM", "Estado de conversión", "Facturas sin tasa"],
        rows: rows.map((s) => [s.label, s.count, s.cbm, s.avgTransit ?? "", s.revenue, (s.facturasSinTasa ?? 0) > 0 ? null : s.rate, (s.facturasSinTasa ?? 0) > 0 ? "Conversión incompleta" : "Completo", s.facturasSinTasa ?? 0]),
      };
    }
    return null;
  }

  // Comerciales · Por cliente / Por agente
  if (category === "com") {
    if (rep === "by-agent") {
      const data = input.byAgent;
      // SDD-0614 S0 (P-9): con la tabla del espejo oculta no hay CSV de Por agente.
      if (!data || data.oculto || !data.hasKommo || data.rows.length === 0) return null;
      return {
        slug: "comercial-por-agente",
        headers: ["Agente", "Estimados", "Ganadas", "Perdidas", "Conversión %", "Clientes", "Subtotal USD 12m atribuido por lead", "Estado", "Facturas sin tasa (clientes únicos del ámbito)"],
        rows: data.rows.map((r) => [
          r.name,
          r.leads,
          r.won,
          r.lost,
          r.convPct,
          r.clients,
          r.billing.subtotalUsd, billingStatus(r.billing), r.billing.sinTasaCount,
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
    const ranked = data.ranking;
    if (ranked.length === 0) return null;
    return {
      slug: "comercial-por-cliente",
      headers: ["#", "Shipping Mark", "Cliente", "Nivel", "Subtotal USD 12m", "Estado", "Facturas sin tasa"],
      rows: ranked.map((r, i) => [r.billing.state === "completo" ? i + 1 : null, r.markbox, r.name, r.tierLabel, r.billing.subtotalUsd, billingStatus(r.billing), r.billing.sinTasaCount]),
    };
  }

  // Contables
  if (category === "con") {
    if (rep === "income") {
      const inc = input.income;
      // SDD-0557: el CSV decide igual que la vista. Con el mayor vacío y
      // facturas en el período, igual exporta la cifra oficial.
      if (!inc || vistaDelEstado(inc) === "vacio") return null;
      const ing = inc.ingreso;
      // El estado del control es el mismo que dice la pantalla: con «no
      // comparable» la diferencia va vacía (B2, E1) y el saldo de 4.5 no va
      // bajo «Monto USD», porque mezcla el nominal en bolívares o yuanes.
      const estado = describirIngreso(ing).estado;
      const filaDelMayor: CsvValue[] =
        ing.controlI2.unidadMayor === "nominal_mixto"
          ? ["En el mayor · cuenta 4.5 · asientos de factura: nominal mixto (no USD)", "", ""]
          : ing.controlI2.unidadMayor === "sin_verificar"
            ? ["En el mayor · cuenta 4.5 · asientos de factura: unidad sin verificar", "", ""]
          : ["En el mayor · cuenta 4.5 · asientos de factura", ing.mayor?.ventas ?? "", ""];
      return {
        slug: "contable-estado-resultados",
        headers: ["Concepto", "Monto USD", "% s/ingresos"],
        rows: [
          ...inc.rows.map((r): CsvValue[] => [
            r.label,
            ing.controlI2.unidadMayor === "usd" ? r.amount : "",
            ing.controlI2.unidadMayor === "usd" ? r.pct ?? "" : "",
          ]),
          [`Ingreso facturado (${ing.sinConvertir > 0 ? "subtotal convertido · " : ""}sin IVA · USD · por emisión)`, ing.facturado.total, ""],
          ["Fondos de terceros incluidos en el facturado", ing.facturado.terceros, ""],
          filaDelMayor,
          ["Ajuste documental por anulaciones", ing.ajusteAnulacionesUsd ?? "", ""],
          ["Base comparada · facturado + ajuste", ing.baseComparacionUsd ?? "", ""],
          [ing.controlI2.contribucionesAjuste > 0 ? "Diferencia base comparada − mayor (4.5)" : "Diferencia facturado − mayor (4.5)", ing.diferenciaUsd ?? "", ""],
          [`Control contra 4.5: ${ETIQUETA_ESTADO_INGRESO[estado]}`, "", ""],
          ...(causaDelControlI2(ing) ? [[`Causa del control: ${causaDelControlI2(ing)}`, "", ""]] : []),
          // Solo las que tienen su asiento de factura vivo (decisión 7).
          ["Facturas del período en bolívares o yuanes con asiento de factura (cantidad)", ing.enOtraMoneda, ""],
          ["Otros ingresos del mayor (4.6 y manuales · también a 4.5)", ing.controlI2.unidadMayor === "usd" ? ing.mayor?.otrosIngresos ?? "" : "", ""],
          ["Facturas sin convertir (bolívares o yuanes sin tasa)", ing.sinConvertir, ""],
        ],
      };
    }
    if (rep === "aging") {
      const ag = input.aging;
      if (!ag || (ag.cxc.total === 0 && ag.cxp.total === 0 && !(ag.cxc.sinTasa || ag.cxp.sinTasa))) return null;
      const side = (lado: string, s: AgingReport["cxc"]): CsvValue[][] =>
        s.buckets.map((b) => [lado, b.label, b.amount, b.count, (s.sinTasa ?? 0) > 0 ? null : b.pct, (s.sinTasa ?? 0) > 0 ? "Conversión incompleta" : "Completo", s.sinTasa ?? 0]);
      return {
        slug: "contable-aging-cxc-cxp",
        headers: ["Lado", "Tramo", "Monto USD (subtotal conocido)", "Documentos", "%", "Estado de conversión", "Documentos sin tasa del lado"],
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
      if (!cf || (cf.totalBilled === 0 && cf.totalCollected === 0 && cf.outstanding === 0 && !(cf.facturasSinTasa || cf.recibosSinTasa))) {
        return null;
      }
      return {
        // SDD-0557: la vista se llama «Facturado contra cobrado»; el slug
        // de la URL (`?rep=cashflow`) no cambia.
        slug: "contable-facturado-contra-cobrado",
        // Con IVA: se compara contra lo cobrado, que también lo lleva.
        headers: ["Mes", "Facturado con IVA USD (subtotal conocido)", "Cobrado USD (subtotal conocido)", "Estado de conversión", "Facturas sin tasa", "Recibos sin tasa"],
        rows: cf.series.map((p) => [p.label, p.billed, p.collected, (p.facturasSinTasa ?? 0) + (p.recibosSinTasa ?? 0) > 0 ? "Conversión incompleta" : "Completo", p.facturasSinTasa ?? 0, p.recibosSinTasa ?? 0]),
      };
    }
    return null;
  }

  // Combinados (rentabilidad real, según el rep activo)
  if (category === "mix") {
    const c = input.combined;
    if (!c || (c.withCosts === 0 && c.totals.sinTasa === 0)) return null;
    if (rep === "margin-client") {
      if (c.byClient.length === 0) return null;
      return {
        slug: "combinado-margen-por-cliente",
        headers: ["Cliente", "Envíos", "Ingreso USD (subtotal conocido)", "Costo USD", "Margen USD", "Margen %", "Estado de conversión", "Embarques sin tasa"],
        rows: c.byClient.map((r) => [r.client, r.count, r.revenue, r.cost, r.sinTasa > 0 ? null : r.margin, r.sinTasa > 0 ? null : r.marginPct, r.sinTasa > 0 ? "Conversión incompleta" : "Completo", r.sinTasa]),
      };
    }
    if (rep === "cost-cbm") {
      const rows = c.byCbm.filter((r) => r.cbm > 0);
      if (rows.length === 0) return null;
      return {
        slug: "combinado-costo-por-cbm",
        headers: ["Ruta", "CBM", "$/CBM ingreso", "$/CBM costo", "Margen/CBM USD", "Ingreso USD (subtotal conocido)", "Estado de conversión", "Embarques sin tasa"],
        rows: rows.map((r) => [
          routeLabelOf(r.origin, r.destination),
          r.cbm,
          r.sinTasa > 0 ? null : r.revenuePerCbm,
          r.costPerCbm,
          r.sinTasa > 0 ? null : r.marginPerCbm,
          r.revenue,
          r.sinTasa > 0 ? "Conversión incompleta" : "Completo",
          r.sinTasa,
        ]),
      };
    }
    // default: rentabilidad por ruta
    if (c.byRoute.length === 0) return null;
    return {
      slug: "combinado-rentabilidad-por-ruta",
      headers: ["Ruta", "Embarques", "Ingreso USD (subtotal conocido)", "Costo USD", "Margen USD", "Margen %", "Estado de conversión", "Embarques sin tasa"],
      rows: c.byRoute.map((r) => [
        routeLabelOf(r.origin, r.destination),
        r.count,
        r.revenue,
        r.cost,
        r.sinTasa > 0 ? null : r.margin,
        r.sinTasa > 0 ? null : r.marginPct,
        r.sinTasa > 0 ? "Conversión incompleta" : "Completo",
        r.sinTasa,
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
