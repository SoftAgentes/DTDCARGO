/**
 * Tests del Constructor de reportes (SDD-0052 · Slice C).
 *
 * Cubre Acceptance §5 (Slice C):
 *  - `buildReport`: agrupa por dim + agrega (count/sum/avg) correctamente, ordena
 *    desc, total cuadra, sin NaN (avg de 0 filas, sum vacío); filtro aplicado.
 *  - `REPORT_SOURCES`: las dims/métricas/filtros declarados existen (sanity).
 *  - `buildReportCsv`: escapa comas/comillas, headers correctos.
 *  - `builderRows`: stub SupabaseClient → trae la fuente + enriquece revenue
 *    (embarques) y normaliza USD (facturas).
 */

import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  REPORT_SOURCES,
  REPORT_SOURCE_IDS,
  asSourceId,
  buildReport,
  buildReportCsv,
  csvCell,
  reportCsvFilename,
  type BuilderRow,
  type SourceMetric,
} from "../builder-types";
import { builderRows } from "../queries";

// ── Helpers ────────────────────────────────────────────────────
const SRC = REPORT_SOURCES.shipments;
const dimClient = SRC.dims.find((d) => d.key === "client")!;
const dimStatus = SRC.dims.find((d) => d.key === "status")!;
const metCount = SRC.metrics.find((m) => m.agg === "count")!;
const metCbmSum = SRC.metrics.find((m) => m.key === "cbm" && m.agg === "sum")!;
const metCbmAvg = SRC.metrics.find((m) => m.key === "cbm" && m.agg === "avg")!;
const metRevenue = SRC.metrics.find((m) => m.key === "revenue")!;

function row(
  dims: Record<string, string>,
  metrics: Record<string, number> = {},
  filters: Record<string, string> = {},
): BuilderRow {
  return { dims, metrics, filters };
}

// ── REPORT_SOURCES sanity ──────────────────────────────────────
describe("REPORT_SOURCES", () => {
  it("solo expone embarques + facturas (V1 acotado)", () => {
    expect(REPORT_SOURCE_IDS).toEqual(["shipments", "invoices"]);
    expect(Object.keys(REPORT_SOURCES).sort()).toEqual(["invoices", "shipments"]);
  });

  it("cada métrica declara una agregación válida (count/sum/avg)", () => {
    for (const src of Object.values(REPORT_SOURCES)) {
      expect(src.dims.length).toBeGreaterThan(0);
      expect(src.metrics.length).toBeGreaterThan(0);
      for (const m of src.metrics) {
        expect(["count", "sum", "avg"]).toContain(m.agg);
      }
    }
  });

  it("toda dim/filtro de embarques produce una key que builderRows resuelve", () => {
    // Sanity: las keys declaradas en el catálogo son las que la query aplana.
    const dimKeys = SRC.dims.map((d) => d.key).sort();
    expect(dimKeys).toEqual(["client", "route", "service", "status", "tasa"]);
    const filterKeys = SRC.filters.map((f) => f.key).sort();
    expect(filterKeys).toEqual(["service", "status", "tasa"]);
    expect(REPORT_SOURCES.invoices.dims.map((d) => d.key).sort()).toEqual(["client", "currency", "status", "tasa"]);
    expect(REPORT_SOURCES.invoices.filters.map((f) => f.key).sort()).toEqual(["currency", "status", "tasa"]);
  });

  it("asSourceId normaliza valores crudos (default shipments)", () => {
    expect(asSourceId("invoices")).toBe("invoices");
    expect(asSourceId("shipments")).toBe("shipments");
    expect(asSourceId("basura")).toBe("shipments");
    expect(asSourceId(undefined)).toBe("shipments");
  });
});

// ── buildReport · count ────────────────────────────────────────
describe("buildReport · count", () => {
  const rows = [
    row({ client: "Acme", status: "En tránsito" }),
    row({ client: "Acme", status: "Entregado" }),
    row({ client: "Beta", status: "En tránsito" }),
  ];

  it("cuenta filas por dim y ordena desc; total = total de filas", () => {
    const out = buildReport(rows, { dim: dimClient, metric: metCount });
    expect(out.agg).toBe("count");
    expect(out.rows).toEqual([
      { label: "Acme", value: 2, count: 2, subtotal: 2, sinTasa: 0 },
      { label: "Beta", value: 1, count: 1, subtotal: 1, sinTasa: 0 },
    ]);
    expect(out.total).toBe(3);
  });

  it("sin filas → resultado vacío, total 0, sin NaN", () => {
    const out = buildReport([], { dim: dimClient, metric: metCount });
    expect(out.rows).toEqual([]);
    expect(out.total).toBe(0);
    expect(Number.isNaN(out.total)).toBe(false);
  });
});

// ── buildReport · sum ──────────────────────────────────────────
describe("buildReport · sum", () => {
  const rows = [
    row({ client: "Acme" }, { cbm: 10, revenue: 8000 }),
    row({ client: "Acme" }, { cbm: 5, revenue: 2000 }),
    row({ client: "Beta" }, { cbm: 40, revenue: 9000 }),
  ];

  it("suma la métrica por grupo, ordena desc por valor, total = Σ", () => {
    const out = buildReport(rows, { dim: dimClient, metric: metCbmSum });
    expect(out.rows[0]).toEqual({ label: "Beta", value: 40, count: 1, subtotal: 40, sinTasa: 0 });
    expect(out.rows[1]).toEqual({ label: "Acme", value: 15, count: 2, subtotal: 15, sinTasa: 0 });
    expect(out.total).toBe(55);
  });

  it("money sum (revenue) se redondea a 2 decimales y marca money", () => {
    const out = buildReport(rows, { dim: dimClient, metric: metRevenue });
    expect(out.money).toBe(true);
    // Acme = 8000 + 2000 = 10000 > Beta 9000 → Acme primero.
    expect(out.rows[0]).toEqual({ label: "Acme", value: 10000, count: 2, subtotal: 10000, sinTasa: 0 });
    expect(out.rows[1]).toEqual({ label: "Beta", value: 9000, count: 1, subtotal: 9000, sinTasa: 0 });
    expect(out.total).toBe(19000);
  });

  it("sum de filas sin la métrica → 0 (sin NaN)", () => {
    const out = buildReport([row({ client: "X" })], {
      dim: dimClient,
      metric: metCbmSum,
    });
    expect(out.rows[0].value).toBe(0);
    expect(out.total).toBe(0);
  });
});

// ── buildReport · avg ──────────────────────────────────────────
describe("buildReport · avg", () => {
  const rows = [
    row({ client: "Acme" }, { cbm: 10 }),
    row({ client: "Acme" }, { cbm: 20 }),
    row({ client: "Beta" }, { cbm: 5 }),
  ];

  it("promedia por grupo (no promedio de promedios); total = promedio global", () => {
    const out = buildReport(rows, { dim: dimClient, metric: metCbmAvg });
    const byLabel = Object.fromEntries(out.rows.map((r) => [r.label, r.value]));
    expect(byLabel.Acme).toBe(15); // (10 + 20) / 2
    expect(byLabel.Beta).toBe(5);
    // promedio global sobre las 3 filas = 35/3 = 11.67
    expect(out.total).toBeCloseTo(11.67, 2);
  });

  it("avg de 0 filas → 0 (sin NaN/Infinity)", () => {
    const out = buildReport([], { dim: dimClient, metric: metCbmAvg });
    expect(out.total).toBe(0);
    expect(Number.isFinite(out.total)).toBe(true);
  });
});

// ── buildReport · filtro ───────────────────────────────────────
describe("buildReport · filtro", () => {
  const rows = [
    row({ client: "Acme", status: "En tránsito" }, { cbm: 10 }, { status: "En tránsito" }),
    row({ client: "Acme", status: "Entregado" }, { cbm: 5 }, { status: "Entregado" }),
    row({ client: "Beta", status: "En tránsito" }, { cbm: 40 }, { status: "En tránsito" }),
  ];

  it("aplica el filtro por valor exacto antes de agregar", () => {
    const out = buildReport(rows, {
      dim: dimClient,
      metric: metCbmSum,
      filter: { key: "status", value: "En tránsito" },
    });
    // Solo Acme(10) + Beta(40).
    expect(out.rows).toEqual([
      { label: "Beta", value: 40, count: 1, subtotal: 40, sinTasa: 0 },
      { label: "Acme", value: 10, count: 1, subtotal: 10, sinTasa: 0 },
    ]);
    expect(out.total).toBe(50);
  });

  it("filtro 'all' (o vacío) no filtra", () => {
    const all = buildReport(rows, {
      dim: dimStatus,
      metric: metCount,
      filter: { key: "status", value: "all" },
    });
    expect(all.total).toBe(3);
  });
});

// ── buildReportCsv + csvCell ───────────────────────────────────
describe("buildReportCsv", () => {
  it("headers = [dim, Registros, metric] y una fila por grupo", () => {
    const result = buildReport(
      [row({ client: "Acme" }), row({ client: "Beta" })],
      { dim: dimClient, metric: metCount },
    );
    const csv = buildReportCsv(result, { dim: "Cliente", metric: "Cantidad" });
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("Cliente,Registros,Cantidad");
    expect(lines[1]).toBe("Acme,1,1");
    expect(lines[2]).toBe("Beta,1,1");
  });

  it("money se exporta entero; avg con 2 decimales", () => {
    const money = buildReport([row({ client: "X" }, { revenue: 1234.56 })], {
      dim: dimClient,
      metric: metRevenue,
    });
    const csvMoney = buildReportCsv(money, { dim: "Cliente", metric: "Revenue USD" });
    // Contrato Director: conserva el entero histórico y añade el subtotal con centavos.
    expect(csvMoney.split("\r\n")[1]).toBe("X,1,1235,Completo,0,1234.56");

    const avg = buildReport(
      [row({ client: "X" }, { cbm: 10 }), row({ client: "X" }, { cbm: 5 })],
      { dim: dimClient, metric: metCbmAvg },
    );
    const csvAvg = buildReportCsv(avg, { dim: "Cliente", metric: "CBM promedio" });
    expect(csvAvg.split("\r\n")[1]).toBe("X,2,7.50");
  });

  it("csvCell escapa comas, comillas y saltos de línea", () => {
    expect(csvCell("simple")).toBe("simple");
    expect(csvCell("Yiwu, China")).toBe('"Yiwu, China"');
    expect(csvCell('dice "hola"')).toBe('"dice ""hola"""');
    expect(csvCell("línea\nsalto")).toBe('"línea\nsalto"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(42)).toBe("42");
  });

  it("una etiqueta con coma se exporta entre comillas en la fila", () => {
    const result = buildReport([row({ route: "Yiwu, CN → La Guaira" })], {
      dim: SRC.dims.find((d) => d.key === "route")!,
      metric: metCount,
    });
    const csv = buildReportCsv(result, { dim: "Ruta", metric: "Cantidad" });
    expect(csv.split("\r\n")[1]).toBe('"Yiwu, CN → La Guaira",1,1');
  });

  it("reportCsvFilename: kebab, sin acentos, con fecha", () => {
    const name = reportCsvFilename(
      "shipments",
      "Revenue USD-Cliente",
      new Date("2026-06-04T00:00:00Z"),
    );
    expect(name).toBe("reporte-shipments-revenue-usd-cliente-2026-06-04.csv");
  });
});

// ── builderRows (query · stub Supabase) ────────────────────────
/** Tope por request del doble: el `db-max-rows` de Supabase. */
const SERVER_CAP = 1000;

type Recorded = { gte: [string, unknown][]; lte: [string, unknown][]; neq: [string, unknown][]; is: [string, unknown][] };
function stub(rowsByTable: Record<string, Record<string, unknown>[]>): {
  client: SupabaseClient;
  calls: Record<string, Recorded>;
} {
  const calls: Record<string, Recorded> = {};
  const client = {
    from(table: string) {
      const rows = rowsByTable[table] ?? [];
      calls[table] = calls[table] ?? { gte: [], lte: [], neq: [], is: [] };
      const rec = calls[table];
      const result = { data: rows, error: null };
      const chain: Record<string, unknown> = {
        select: () => chain,
        order: () => chain,
        limit: () => chain,
        // Corta en SERVER_CAP por request igual que PostgREST: si el doble es
        // más generoso que el servidor, el test sale verde con código que en
        // producción trunca — que es exactamente cómo este bug sobrevivió.
        range: (desde: number, hasta: number) => {
          const pedido = hasta - desde + 1;
          const trozo = Array.isArray(rows)
            ? rows.slice(desde, desde + Math.min(pedido, SERVER_CAP))
            : [];
          return {
            ...chain,
            then: (resolve: (v: { data: unknown; error: null }) => unknown) =>
              Promise.resolve({ data: trozo, error: null }).then(resolve),
          };
        },
        not: () => chain,
        in: () => chain,
        eq: () => chain,
        gte: (c: string, v: unknown) => (rec.gte.push([c, v]), chain),
        lte: (c: string, v: unknown) => (rec.lte.push([c, v]), chain),
        neq: (c: string, v: unknown) => (rec.neq.push([c, v]), chain),
        is: (c: string, v: unknown) => (rec.is.push([c, v]), chain),
        then: (resolve: (v: typeof result) => unknown) =>
          Promise.resolve(result).then(resolve),
      };
      return chain;
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

const TODAY = new Date("2026-06-15T00:00:00Z");

describe("builderRows · embarques", () => {
  const shipments = [
    {
      id: "1", code: "A1", origin: "Yiwu", destination: "Pto Cabello",
      shipment_service: "consolidado_lcl", status: "in_transit", volume_m3: 10,
      client_name: "Acme", created_at: "2026-03-01T00:00:00Z",
      arrived_destination_at: null, delivered_at: null,
    },
    {
      id: "2", code: "B1", origin: "Shenzhen", destination: "La Guaira",
      shipment_service: "fcl_directo", status: "shipped", volume_m3: 40,
      client_name: null, created_at: "2026-03-02T00:00:00Z",
      arrived_destination_at: null, delivered_at: null,
    },
  ];
  const invoices = [
    { shipment_code: "A1", total_amount: 8000, currency: "USD", fx_rate: null, status: "emitida" },
  ];

  it("aplana cada embarque a dims (labels) + métricas, enriqueciendo revenue", async () => {
    const { client } = stub({ shipments, invoices });
    const rows = await builderRows(client, "shipments", "1A", TODAY);

    expect(rows).toHaveLength(2);
    const a1 = rows[0];
    expect(a1.dims.client).toBe("Acme");
    expect(a1.dims.route).toBe("Yiwu → Pto Cabello");
    expect(a1.dims.status).toBe("En tránsito"); // label, no el enum crudo
    expect(a1.dims.service).toBe("Consolidado LCL");
    expect(a1.dims.tasa).toBe("Todas con tasa");
    expect(a1.metrics.cbm).toBe(10);
    expect(a1.metrics.revenue).toBe(8000); // del join por shipment_code

    // Sin factura → revenue 0; sin cliente → "Sin asignar".
    const b1 = rows[1];
    expect(b1.metrics.revenue).toBe(0);
    expect(b1.dims.client).toBe("Sin asignar");

    // Filtros usan el mismo label que la dim.
    expect(a1.filters.status).toBe("En tránsito");
    expect(a1.filters.service).toBe("Consolidado LCL");
    expect(a1.filters.tasa).toBe(a1.dims.tasa);
  });

  it("agregar sobre las filas crudas reproduce el revenue por cliente", async () => {
    const { client } = stub({ shipments, invoices });
    const rows = await builderRows(client, "shipments", "1A", TODAY);
    const out = buildReport(rows, { dim: dimClient, metric: metRevenue });
    const byClient = Object.fromEntries(out.rows.map((r) => [r.label, r.value]));
    expect(byClient["Acme"]).toBe(8000);
    expect(byClient["Sin asignar"]).toBe(0);
  });

  it("aplica el rango del período a shipments e invoices", async () => {
    const { client, calls } = stub({ shipments: [], invoices: [] });
    await builderRows(client, "shipments", "1A", TODAY);
    expect(calls.shipments.gte).toContainEqual(["created_at", "2025-06-15"]);
    expect(calls.invoices.gte).toContainEqual(["created_at", "2025-06-15"]);
  });
});

describe("builderRows · facturas", () => {
  const invoices = [
    {
      client_name: "Acme", currency: "USD", fx_rate: null,
      total_amount: 5000, paid_amount: 2000, status: "parcial",
      issued_at: "2026-05-10", created_at: "2026-05-10",
    },
    {
      // VES normalizada: total 73000 / 36.5 = 2000 USD; pagado 0 → saldo 2000.
      client_name: "Beta", currency: "VES", fx_rate: 36.5,
      total_amount: 73000, paid_amount: 0, status: "emitida",
      issued_at: "2026-05-20", created_at: "2026-05-20",
    },
    {
      // Anulada → excluida (.neq status anulada).
      client_name: "Gamma", currency: "USD", fx_rate: null,
      total_amount: 9999, paid_amount: 0, status: "anulada",
      issued_at: "2026-05-25", created_at: "2026-05-25",
    },
    {
      // Fuera de rango (issued_at < range.from) → excluida in-memory.
      client_name: "Delta", currency: "USD", fx_rate: null,
      total_amount: 1234, paid_amount: 0, status: "emitida",
      issued_at: "2025-01-01", created_at: "2025-01-01",
    },
  ];

  it("aplana facturas a dims (cliente/estado/moneda) + métricas USD-normalizadas", async () => {
    const { client, calls } = stub({ invoices });
    const rows = await builderRows(client, "invoices", "1A", TODAY);

    // anulada + fuera de rango excluidas → solo Acme y Beta.
    expect(rows).toHaveLength(2);
    expect(calls.invoices.neq).toContainEqual(["status", "anulada"]);

    const acme = rows.find((r) => r.dims.client === "Acme")!;
    expect(acme.dims.status).toBe("Parcial");
    expect(acme.dims.currency).toBe("USD · Dólar");
    expect(acme.dims.tasa).toBe("Con tasa");
    expect(acme.filters.tasa).toBe(acme.dims.tasa);
    expect(acme.metrics.amount).toBe(5000);
    expect(acme.metrics.balance).toBe(3000); // 5000 - 2000

    const beta = rows.find((r) => r.dims.client === "Beta")!;
    expect(beta.metrics.amount).toBe(2000); // 73000 / 36.5
    expect(beta.metrics.balance).toBe(2000); // saldo completo normalizado
  });

  it("Saldo USD por estado (sum) suma correctamente", async () => {
    const { client } = stub({ invoices });
    const rows = await builderRows(client, "invoices", "1A", TODAY);
    const metBalance = REPORT_SOURCES.invoices.metrics.find(
      (m): m is SourceMetric => m.key === "balance",
    )!;
    const out = buildReport(rows, {
      dim: REPORT_SOURCES.invoices.dims.find((d) => d.key === "currency")!,
      metric: metBalance,
    });
    const byCurrency = Object.fromEntries(out.rows.map((r) => [r.label, r.value]));
    expect(byCurrency["USD · Dólar"]).toBe(3000);
    expect(byCurrency["VES · Bolívar"]).toBe(2000);
    expect(out.total).toBe(5000);
  });
});

describe("0572 revisión · completitud del Constructor por métrica y grupo", () => {
  const invoice = { client_name: "Cliente", currency: "USD", fx_rate: null, total_amount: 100, paid_amount: 0, status: "emitida", issued_at: "2026-05-10", created_at: "2026-05-10" };
  const money: SourceMetric = { key: "amount", label: "Monto USD", agg: "sum", money: true };
  const dim = REPORT_SOURCES.invoices.dims.find((d) => d.key === "client")!;

  it.each([
    { name: "parcial", invoices: [invoice, { ...invoice, currency: "CNY", total_amount: 700 }], total: 100, subtotal: 100, sinTasa: 1 },
    { name: "solo excluidas", invoices: [{ ...invoice, currency: "CNY", total_amount: 700 }], total: null, subtotal: 0, sinTasa: 1 },
    { name: "cero conocido", invoices: [{ ...invoice, total_amount: 0 }], total: 0, subtotal: 0, sinTasa: 0 },
  ])("$name no se convierte en cero definitivo al agrupar por Cliente", async ({ invoices, total, subtotal, sinTasa }) => {
    const { client } = stub({ invoices });
    const rows = await builderRows(client, "invoices", "1A", TODAY);
    const out = buildReport(rows, { dim, metric: money });
    expect(out).toMatchObject({ total, subtotal, sinTasa, rows: [{ label: "Cliente", value: total, subtotal, sinTasa, count: invoices.length }] });
    const csv = buildReportCsv(out, { dim: "Cliente", metric: "Monto USD" });
    expect(csv).toContain("Estado de conversión,Documentos sin tasa,Subtotal conocido USD");
    expect(csv).toContain(sinTasa ? ",Conversión incompleta,1," : ",Completo,0,");
    if (total === null) expect(csv.split("\r\n")[1].split(",")[2]).toBe("");
  });

  it("promedio monetario incompleto no se certifica; cantidad sigue contando documentos y filtro conserva significado", async () => {
    const { client } = stub({ invoices: [invoice, { ...invoice, currency: "CNY", total_amount: 700 }] });
    const rows = await builderRows(client, "invoices", "1A", TODAY);
    expect(rows[1]).toMatchObject({ dims: { tasa: "Sin tasa" }, filters: { tasa: "Sin tasa" } });
    const average = buildReport(rows, { dim, metric: { ...money, agg: "avg" } });
    expect(average).toMatchObject({ total: null, subtotal: 100, sinTasa: 1, rows: [{ value: null, subtotal: 100, count: 2 }] });
    expect(buildReportCsv(average, { dim: "Cliente", metric: "Promedio USD" })).toContain("Cliente,2,,Conversión incompleta,1,100");
    expect(buildReport(rows, { dim, metric: { key: "count", label: "Cantidad", agg: "count" } })).toMatchObject({ total: 2, sinTasa: 0 });
    expect(buildReport(rows, { dim, metric: money, filter: { key: "tasa", value: "Con tasa" } })).toMatchObject({ total: 100, sinTasa: 0 });
    expect(buildReport(rows, { dim: REPORT_SOURCES.invoices.dims.find((d) => d.key === "status")!, metric: money })).toMatchObject({ total: 100, sinTasa: 1, rows: [{ value: 100, sinTasa: 1, count: 2 }] });
  });

  it("embarque parcial conserva revenue conocido y CBM calculable, incluso agrupando por Cliente", async () => {
    const shipments = [{ id: "s1", code: "A1", client_name: "Cliente", volume_m3: 10, created_at: "2026-03-01" }];
    const invoices = [{ ...invoice, id: "i1", shipment_code: "A1" }, { ...invoice, id: "i2", shipment_code: "A1", currency: "CNY", total_amount: 700 }];
    const { client } = stub({ shipments, invoices });
    const rows = await builderRows(client, "shipments", "1A", TODAY);
    expect(rows[0]).toMatchObject({ dims: { tasa: "Alguna sin tasa" }, filters: { tasa: "Alguna sin tasa" }, metrics: { revenue: 100, cbm: 10 } });
    expect(buildReport(rows, { dim: dimClient, metric: metRevenue })).toMatchObject({ total: 100, sinTasa: 1, rows: [{ value: 100, sinTasa: 1 }] });
    expect(buildReport(rows, { dim: dimClient, metric: metCbmAvg })).toMatchObject({ total: 10, sinTasa: 0 });
  });

  it.each([false, true])("embarque con solo factura sin tasa y cero conocido=%s conserva la distinción", async (withKnownZero) => {
    const shipments = [{ id: "s1", code: "A1", client_name: "Cliente", volume_m3: 10, created_at: "2026-03-01" }];
    const invoices = [{ ...invoice, id: "i2", shipment_code: "A1", currency: "CNY", total_amount: 700 }, ...(withKnownZero ? [{ ...invoice, id: "i1", shipment_code: "A1", total_amount: 0 }] : [])];
    const { client } = stub({ shipments, invoices });
    const rows = await builderRows(client, "shipments", "1A", TODAY);
    expect(buildReport(rows, { dim: dimClient, metric: metRevenue })).toMatchObject({ total: withKnownZero ? 0 : null, subtotal: 0, sinTasa: 1 });
    expect(buildReport(rows, { dim: dimClient, metric: metCbmSum })).toMatchObject({ total: 10, sinTasa: 0 });
  });

  it("conserva el total CBM redondeado a dos decimales y las filas físicas sin redondeo de suma", () => {
    const rows: BuilderRow[] = [
      { dims: { client: "A" }, metrics: { cbm: 0.1234 }, filters: {} },
      { dims: { client: "B" }, metrics: { cbm: 0.2345 }, filters: {} },
    ];
    const out = buildReport(rows, { dim: dimClient, metric: metCbmSum });
    expect(out).toMatchObject({ total: 0.36, sinTasa: 0 });
    expect(out.rows.map((row) => row.value)).toEqual([0.2345, 0.1234]);
    expect(buildReport(rows, { dim: dimClient, metric: { key: "count", label: "Cantidad", agg: "count" } })).toMatchObject({ total: 2, sinTasa: 0 });
  });
});
