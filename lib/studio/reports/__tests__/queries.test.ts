/**
 * Tests de queries de Reportes & Analytics (SDD-0052 · Slice A).
 *
 * Cubre Acceptance §5:
 *  - el rango del período se aplica a `shipments` e `invoices` (gte/lte sobre
 *    created_at).
 *  - el revenue se mapea por shipment_code y se cruza al group-by.
 *  - operationalOverview produce totales + serie mensual + split por destino +
 *    tránsito por destino; on-time NO aparece.
 *  - reportByCarrier agrega bookings/sailings por carrier (desde 0096) y resuelve
 *    el nombre; EmptyState honesto ([]) sin bookings.
 *
 * Stub chainable que enruta por nombre de tabla y registra filtros (gte/lte/eq/
 * is/not/neq/in) por tabla. Cada builder es thenable (await directo) y además
 * resoluble vía `.then` para los `await query` encadenados.
 */

import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  agingReport,
  cashflowReport,
  combinedReport,
  commercialByClient,
  incomeStatement,
  operationalOverview,
  reportByCarrier,
  reportByRoute,
  reportByService,
} from "../queries";

type Recorded = {
  gte: [string, unknown][];
  lte: [string, unknown][];
  eq: [string, unknown][];
  is: [string, unknown][];
  not: [string, unknown, unknown][];
  neq: [string, unknown][];
  in: [string, unknown][];
};

function stub(rowsByTable: Record<string, Record<string, unknown>[]>): {
  client: SupabaseClient;
  calls: Record<string, Recorded>;
} {
  const calls: Record<string, Recorded> = {};

  const client = {
    from(table: string) {
      const rows = rowsByTable[table] ?? [];
      calls[table] = calls[table] ?? {
        gte: [],
        lte: [],
        eq: [],
        is: [],
        not: [],
        neq: [],
        in: [],
      };
      const rec = calls[table];
      const result = { data: rows, error: null };

      const chain: Record<string, unknown> = {
        select: () => chain,
        order: () => chain,
        limit: () => chain,
        gte: (c: string, v: unknown) => (rec.gte.push([c, v]), chain),
        lte: (c: string, v: unknown) => (rec.lte.push([c, v]), chain),
        eq: (c: string, v: unknown) => (rec.eq.push([c, v]), chain),
        is: (c: string, v: unknown) => (rec.is.push([c, v]), chain),
        not: (c: string, op: unknown, v: unknown) => (rec.not.push([c, op, v]), chain),
        neq: (c: string, v: unknown) => (rec.neq.push([c, v]), chain),
        in: (c: string, v: unknown) => (rec.in.push([c, v]), chain),
        then: (resolve: (v: typeof result) => unknown) =>
          Promise.resolve(result).then(resolve),
      };
      return chain;
    },
  } as unknown as SupabaseClient;

  return { client, calls };
}

const TODAY = new Date("2026-06-15T00:00:00Z");

// ── Rango por período ──────────────────────────────────────────
describe("rango del período aplicado a las tablas", () => {
  it("operationalOverview filtra shipments e invoices por created_at del rango 1A", async () => {
    const { client, calls } = stub({ shipments: [], invoices: [] });
    await operationalOverview(client, "1A", TODAY);

    // 1A trailing 12m → from 2025-06-15.
    expect(calls.shipments.gte).toContainEqual(["created_at", "2025-06-15"]);
    expect(calls.shipments.lte[0][0]).toBe("created_at");
    expect(String(calls.shipments.lte[0][1])).toContain("2026-06-15");

    expect(calls.invoices.gte).toContainEqual(["created_at", "2025-06-15"]);
    // invoices: solo BILLABLE (excluye borrador + anulada) + exige shipment_code.
    expect(calls.invoices.in).toContainEqual([
      "status",
      ["emitida", "parcial", "pagada", "vencida"],
    ]);
  });

  it("YTD arranca el 1° de enero", async () => {
    const { client, calls } = stub({ shipments: [], invoices: [] });
    await operationalOverview(client, "YTD", TODAY);
    expect(calls.shipments.gte).toContainEqual(["created_at", "2026-01-01"]);
  });
});

// ── Revenue join + overview ────────────────────────────────────
describe("operationalOverview", () => {
  const shipments = [
    {
      id: "1", code: "A1", origin: "Yiwu", destination: "Pto Cabello",
      shipment_service: "consolidacion", status: "in_transit", volume_m3: 10,
      created_at: "2026-03-01T00:00:00Z", arrived_destination_at: null, delivered_at: null,
    },
    {
      id: "2", code: "A2", origin: "Yiwu", destination: "Pto Cabello",
      shipment_service: "consolidacion", status: "delivered", volume_m3: 5,
      created_at: "2026-04-01T00:00:00Z",
      arrived_destination_at: "2026-05-01T00:00:00Z", delivered_at: "2026-05-10T00:00:00Z",
    },
    {
      id: "3", code: "B1", origin: "Shenzhen", destination: "La Guaira",
      shipment_service: "reserva_FCL", status: "draft", volume_m3: 50,
      created_at: "2026-04-15T00:00:00Z", arrived_destination_at: null, delivered_at: null,
    },
  ];
  const invoices = [
    { shipment_code: "A1", total_amount: 8000, currency: "USD", fx_rate: null, status: "emitida" },
    { shipment_code: "A2", total_amount: 2000, currency: "USD", fx_rate: null, status: "pagada" },
    // VES con fx → 1000 USD para B1
    { shipment_code: "B1", total_amount: 36500, currency: "VES", fx_rate: 36.5, status: "vencida" },
  ];

  it("totales reales: embarques, CBM, revenue USD-normalizado, activos", async () => {
    const { client } = stub({ shipments, invoices });
    const ov = await operationalOverview(client, "1A", TODAY);

    expect(ov.shipments).toBe(3);
    expect(ov.cbm).toBe(65); // 10 + 5 + 50
    expect(ov.revenueUsd).toBe(11000); // 8000 + 2000 + 1000
    // activos: in_transit cuenta; delivered y draft NO.
    expect(ov.active).toBe(1);
  });

  it("split por destino con % + tránsito por destino (sin on-time)", async () => {
    const { client } = stub({ shipments, invoices });
    const ov = await operationalOverview(client, "1A", TODAY);

    const pto = ov.portSplit.find((p) => p.port === "Pto Cabello");
    expect(pto?.count).toBe(2);
    expect(pto?.pct).toBeCloseTo(66.7, 0);

    // Solo A2 tiene hito de cierre (entregado) → tránsito de Pto Cabello.
    const transit = ov.transitByPort.find((t) => t.port === "Pto Cabello");
    expect(transit?.count).toBe(1);
    expect(transit?.avgTransit).toBe(39); // abr 1 → may 10

    // on-time no existe en el objeto.
    expect("onTime" in ov).toBe(false);
  });

  it("serie mensual cubre el rango", async () => {
    const { client } = stub({ shipments, invoices });
    const ov = await operationalOverview(client, "1A", TODAY);
    // El mes de creación de A1 (2026-03) debe estar presente con count 1.
    const marzo = ov.monthly.find((m) => m.month === "2026-03");
    expect(marzo?.count).toBe(1);
  });

  it("KPI revenue EXCLUYE facturas huérfanas y cuadra con la suma de las filas", async () => {
    // Factura "huérfana": shipment_code que NO matchea ningún embarque del rango.
    // Antes inflaba el KPI (sumaba TODO el mapa) pero no aparecía en ninguna fila.
    const invoicesConHuerfana = [
      ...invoices,
      { shipment_code: "ZZ-NO-EXISTE", total_amount: 99999, currency: "USD", fx_rate: null, status: "emitida" },
    ];

    const ov = await operationalOverview(
      stub({ shipments, invoices: invoicesConHuerfana }).client,
      "1A",
      TODAY,
    );
    const routes = await reportByRoute(
      stub({ shipments, invoices: invoicesConHuerfana }).client,
      "1A",
      TODAY,
    );
    const services = await reportByService(
      stub({ shipments, invoices: invoicesConHuerfana }).client,
      "1A",
      TODAY,
    );

    // KPI = revenue atribuible a los embarques (8000 + 2000 + 1000) — sin la
    // huérfana (99999). El antiguo bug daba 110999.
    expect(ov.revenueUsd).toBe(11000);

    // KPI == Σ revenue de las filas (por construcción, mismo cálculo).
    const sumRoutes = routes.reduce((s, r) => s + r.revenue, 0);
    const sumServices = services.reduce((s, r) => s + r.revenue, 0);
    expect(sumRoutes).toBe(ov.revenueUsd);
    expect(sumServices).toBe(ov.revenueUsd);
  });

  it("KPI == Σ filas al centavo con facturas VES sub-centavo (redondeo total-vs-serie)", async () => {
    // Embarques en rutas Y servicios distintos → cada uno cae en su propia fila.
    const vesShipments = [
      {
        id: "v1", code: "V1", origin: "Yiwu", destination: "Pto Cabello",
        shipment_service: "consolidacion", status: "in_transit", volume_m3: 5,
        created_at: "2026-05-01T00:00:00Z", arrived_destination_at: null, delivered_at: null,
      },
      {
        id: "v2", code: "V2", origin: "Shenzhen", destination: "La Guaira",
        shipment_service: "puerta_a_puerta_DDP", status: "in_transit", volume_m3: 5,
        created_at: "2026-05-01T00:00:00Z", arrived_destination_at: null, delivered_at: null,
      },
    ];
    // VES/fx=3 → 10000/3 = 3333.3333… USD (sub-centavo). Si el KPI sumara crudo y
    // redondeara una vez (6666.67) mientras las filas redondean por grupo
    // (3333.33 + 3333.33 = 6666.66), divergirían 1 centavo. El redondeo del mapa
    // por code los alinea: KPI == Σ filas exacto.
    const vesInvoices = [
      { shipment_code: "V1", total_amount: 10000, currency: "VES", fx_rate: 3, status: "emitida" },
      { shipment_code: "V2", total_amount: 10000, currency: "VES", fx_rate: 3, status: "emitida" },
    ];

    const ov = await operationalOverview(
      stub({ shipments: vesShipments, invoices: vesInvoices }).client, "1A", TODAY,
    );
    const routes = await reportByRoute(
      stub({ shipments: vesShipments, invoices: vesInvoices }).client, "1A", TODAY,
    );
    const services = await reportByService(
      stub({ shipments: vesShipments, invoices: vesInvoices }).client, "1A", TODAY,
    );

    expect(ov.revenueUsd).toBe(6666.66);
    expect(routes.reduce((s, r) => s + r.revenue, 0)).toBe(ov.revenueUsd);
    expect(services.reduce((s, r) => s + r.revenue, 0)).toBe(ov.revenueUsd);
  });
});

// ── Chips "sin asignar": unassigned + orphanRevenueUsd ─────────
describe("operationalOverview · indicadores sin asignar", () => {
  it("unassigned cuenta embarques sin client_name (null o vacío); con cliente NO cuenta", async () => {
    const shipments = [
      // Sin cliente (null) → cuenta.
      {
        id: "1", code: "U1", origin: "Yiwu", destination: "Pto Cabello",
        shipment_service: "consolidacion", status: "in_transit", volume_m3: 10,
        client_name: null,
        created_at: "2026-03-01T00:00:00Z", arrived_destination_at: null, delivered_at: null,
      },
      // Sin cliente (string vacío tras trim) → cuenta.
      {
        id: "2", code: "U2", origin: "Yiwu", destination: "Pto Cabello",
        shipment_service: "consolidacion", status: "in_transit", volume_m3: 2.5,
        client_name: "   ",
        created_at: "2026-03-02T00:00:00Z", arrived_destination_at: null, delivered_at: null,
      },
      // Con cliente → NO cuenta.
      {
        id: "3", code: "C1", origin: "Shenzhen", destination: "La Guaira",
        shipment_service: "reserva_FCL", status: "shipped", volume_m3: 40,
        client_name: "Acme SA",
        created_at: "2026-03-03T00:00:00Z", arrived_destination_at: null, delivered_at: null,
      },
    ];
    const ov = await operationalOverview(stub({ shipments, invoices: [] }).client, "1A", TODAY);

    expect(ov.unassigned.count).toBe(2);
    expect(ov.unassigned.cbm).toBe(12.5); // 10 + 2.5
  });

  it("orphanRevenueUsd = monto huérfano; revenueUsd lo EXCLUYE y sigue = Σ filas", async () => {
    const shipments = [
      {
        id: "1", code: "A1", origin: "Yiwu", destination: "Pto Cabello",
        shipment_service: "consolidacion", status: "in_transit", volume_m3: 10,
        client_name: "Acme",
        created_at: "2026-03-01T00:00:00Z", arrived_destination_at: null, delivered_at: null,
      },
      {
        id: "2", code: "B1", origin: "Shenzhen", destination: "La Guaira",
        shipment_service: "reserva_FCL", status: "shipped", volume_m3: 40,
        client_name: "Beta",
        created_at: "2026-03-02T00:00:00Z", arrived_destination_at: null, delivered_at: null,
      },
    ];
    const invoices = [
      { shipment_code: "A1", total_amount: 3000, currency: "USD", fx_rate: null, status: "emitida" },
      { shipment_code: "B1", total_amount: 9000, currency: "USD", fx_rate: null, status: "emitida" },
      // Huérfana: code que NO matchea ningún embarque del rango.
      { shipment_code: "ZZ-NO-EXISTE", total_amount: 1500, currency: "USD", fx_rate: null, status: "emitida" },
    ];

    const ov = await operationalOverview(stub({ shipments, invoices }).client, "1A", TODAY);
    const routes = await reportByRoute(stub({ shipments, invoices }).client, "1A", TODAY);

    // KPI = revenue atribuible a embarques del rango (3000 + 9000), excluye la huérfana.
    expect(ov.revenueUsd).toBe(12000);
    // El huérfano = la factura sin embarque del rango.
    expect(ov.orphanRevenueUsd).toBe(1500);
    // Invariante intacto: KPI = Σ filas.
    expect(routes.reduce((s, r) => s + r.revenue, 0)).toBe(ov.revenueUsd);
  });

  it("sin huérfanas ni embarques sin cliente → ambos indicadores en 0", async () => {
    const shipments = [
      {
        id: "1", code: "A1", origin: "Yiwu", destination: "Pto Cabello",
        shipment_service: "consolidacion", status: "in_transit", volume_m3: 10,
        client_name: "Acme",
        created_at: "2026-03-01T00:00:00Z", arrived_destination_at: null, delivered_at: null,
      },
    ];
    const invoices = [
      { shipment_code: "A1", total_amount: 3000, currency: "USD", fx_rate: null, status: "emitida" },
    ];
    const ov = await operationalOverview(stub({ shipments, invoices }).client, "1A", TODAY);

    expect(ov.orphanRevenueUsd).toBe(0);
    expect(ov.unassigned.count).toBe(0);
    expect(ov.unassigned.cbm).toBe(0);
  });
});

// ── reportByRoute / reportByService usan revenue join ──────────
describe("reportByRoute / reportByService", () => {
  const shipments = [
    {
      id: "1", code: "A1", origin: "Yiwu", destination: "Pto Cabello",
      shipment_service: "consolidacion", status: "in_transit", volume_m3: 10,
      created_at: "2026-03-01T00:00:00Z", arrived_destination_at: null, delivered_at: null,
    },
    {
      id: "2", code: "B1", origin: "Shenzhen", destination: "La Guaira",
      shipment_service: "reserva_FCL", status: "shipped", volume_m3: 40,
      created_at: "2026-03-02T00:00:00Z", arrived_destination_at: null, delivered_at: null,
    },
  ];
  const invoices = [
    { shipment_code: "A1", total_amount: 3000, currency: "USD", fx_rate: null, status: "emitida" },
    { shipment_code: "B1", total_amount: 9000, currency: "USD", fx_rate: null, status: "emitida" },
  ];

  it("reportByRoute mapea revenue por shipment_code y ordena desc", async () => {
    const { client } = stub({ shipments, invoices });
    const rows = await reportByRoute(client, "1A", TODAY);
    expect(rows[0].label).toBe("Shenzhen → La Guaira");
    expect(rows[0].revenue).toBe(9000);
    expect(rows[1].revenue).toBe(3000);
  });

  it("reportByService agrupa por servicio con su revenue", async () => {
    const { client } = stub({ shipments, invoices });
    const rows = await reportByService(client, "1A", TODAY);
    expect(rows[0].service).toBe("reserva_FCL");
    expect(rows[0].revenue).toBe(9000);
    expect(rows[1].service).toBe("consolidacion");
    expect(rows[1].revenue).toBe(3000);
  });
});

// ── reportByCarrier (bookings/sailings 0096) ───────────────────
describe("reportByCarrier", () => {
  it("agrega bookings + sailings por carrier y resuelve el nombre", async () => {
    const bookings = [
      { carrier_id: "c1" },
      { carrier_id: "c1" },
      { carrier_id: "c2" },
    ];
    const sailings = [{ carrier_id: "c1" }, { carrier_id: "c2" }];
    const carriers = [
      { id: "c1", name: "COSCO" },
      { id: "c2", name: "MSC" },
    ];
    const { client } = stub({ bookings, sailings, carriers });
    const rows = await reportByCarrier(client, "1A", TODAY);

    expect(rows[0].name).toBe("COSCO"); // 2 bookings
    expect(rows[0].bookings).toBe(2);
    expect(rows[0].sailings).toBe(1);
    expect(rows[1].name).toBe("MSC");
    expect(rows[1].bookings).toBe(1);
  });

  it("carrier_id null agrupa como 'Sin naviera asignada'", async () => {
    const bookings = [{ carrier_id: null }];
    const { client } = stub({ bookings, sailings: [], carriers: [] });
    const rows = await reportByCarrier(client, "1A", TODAY);
    expect(rows[0].carrierId).toBeNull();
    expect(rows[0].name).toBe("Sin naviera asignada");
    expect(rows[0].bookings).toBe(1);
  });

  it("EmptyState honesto: sin bookings ni sailings → []", async () => {
    const { client } = stub({ bookings: [], sailings: [], carriers: [] });
    const rows = await reportByCarrier(client, "1A", TODAY);
    expect(rows).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════
// Slice B — Comerciales (Por cliente) + Contables/financieros
// ═══════════════════════════════════════════════════════════════

// Fecha de referencia para el trailing-12m de clientsWithTier.
const NOW = new Date("2026-06-15T00:00:00Z");

// ── commercialByClient (reusa clientsWithTier 0051) ────────────
describe("commercialByClient", () => {
  it("rankea por facturación USD-normalizada (desc) + tier derivado + distribución", async () => {
    // clientsWithTier lee invoices (facturación trailing-12m) + clients.
    const invoices = [
      // Cliente Platinum (>= 300k): facturación grande dentro de los 12m.
      { client_markbox: "DTD-1", currency: "USD", total_amount: 320000, fx_rate: null, status: "pagada", issued_at: "2026-05-01", created_at: "2026-05-01" },
      // Cliente Bronze (< 50k).
      { client_markbox: "DTD-2", currency: "USD", total_amount: 10000, fx_rate: null, status: "emitida", issued_at: "2026-04-01", created_at: "2026-04-01" },
      // VES normalizada a USD: 73000 / 36.5 = 2000 (no mueve el tier de DTD-2).
      { client_markbox: "DTD-2", currency: "VES", total_amount: 73000, fx_rate: 36.5, status: "emitida", issued_at: "2026-04-10", created_at: "2026-04-10" },
      // Factura vieja (fuera de los 12m) → no cuenta.
      { client_markbox: "DTD-1", currency: "USD", total_amount: 999999, fx_rate: null, status: "pagada", issued_at: "2024-01-01", created_at: "2024-01-01" },
    ];
    const clients = [
      { id: "1", markbox: "DTD-1", name: "Alfa" },
      { id: "2", markbox: "DTD-2", name: "Beta" },
      { id: "3", markbox: "DTD-3", name: "Gamma" }, // sin facturación
    ];
    const { client } = stub({ invoices, clients });
    const out = await commercialByClient(client, NOW);

    expect(out.totalClients).toBe(3);
    // Ranking: Alfa (320k) primero, Beta (12k) segundo, Gamma (0) tercero.
    expect(out.ranking[0].name).toBe("Alfa");
    expect(out.ranking[0].billedUsd).toBe(320000);
    expect(out.ranking[0].tierLabel).toBe("Platinum");
    expect(out.ranking[1].name).toBe("Beta");
    expect(out.ranking[1].billedUsd).toBe(12000); // 10000 + 2000 (VES norm)
    expect(out.ranking[1].tierLabel).toBe("Bronze");
    expect(out.ranking[2].billedUsd).toBe(0);
    // Distribución: 1 platinum + 2 bronze.
    const dist = Object.fromEntries(out.tierDist.map((d) => [d.tierId, d.count]));
    expect(dist.platinum).toBe(1);
    expect(dist.bronze).toBe(2);
    expect(out.totalBilledUsd).toBe(332000);
  });

  it("sin clientes → ranking vacío, totales en 0", async () => {
    const { client } = stub({ invoices: [], clients: [] });
    const out = await commercialByClient(client, NOW);
    expect(out.totalClients).toBe(0);
    expect(out.ranking).toEqual([]);
    expect(out.totalBilledUsd).toBe(0);
  });
});

// ── incomeStatement (reusa profitAndLoss 0040, NO recalcula) ───
describe("incomeStatement", () => {
  it("aplica el rango del período a journal_entries y formatea las filas del P&L", async () => {
    // Cuentas raíz por tipo (I ingresos, CGS costo, G gasto) + sub-cuentas.
    const accounts = [
      { id: "i", code: "4", type: "I", parent_id: null, is_postable: false },
      { id: "i1", code: "4.1", type: "I", parent_id: "i", is_postable: true },
      { id: "c", code: "5", type: "CGS", parent_id: null, is_postable: false },
      { id: "c1", code: "5.1", type: "CGS", parent_id: "c", is_postable: true },
      { id: "g", code: "6", type: "G", parent_id: null, is_postable: false },
      { id: "g1", code: "6.1", type: "G", parent_id: "g", is_postable: true },
    ];
    const journal_entries = [{ id: "e1" }];
    const journal_lines = [
      // Ingreso 10000 (crédito en cuenta I → saldo natural acreedor).
      { account_id: "i1", debit: 0, credit: 10000 },
      // Costo 4000 (débito en cuenta CGS).
      { account_id: "c1", debit: 4000, credit: 0 },
      // Gasto 2000 (débito en cuenta G).
      { account_id: "g1", debit: 2000, credit: 0 },
    ];
    const { client, calls } = stub({ accounts, journal_entries, journal_lines });
    const out = await incomeStatement(client, "YTD", NOW);

    // El rango YTD (1° enero) se aplica a entry_date de journal_entries.
    expect(calls.journal_entries.gte).toContainEqual(["entry_date", "2026-01-01"]);
    expect(calls.journal_entries.lte).toContainEqual(["entry_date", "2026-06-15"]);

    // P&L: ingresos 10000, cgs 4000, bruta 6000, gastos 2000, neta 4000.
    expect(out.income).toBe(10000);
    expect(out.netIncome).toBe(4000);
    const byLabel = Object.fromEntries(out.rows.map((r) => [r.label, r]));
    expect(byLabel["Utilidad bruta"].amount).toBe(6000);
    expect(byLabel["Costo de ventas"].pct).toBe(40);
    expect(byLabel["Utilidad neta"].amount).toBe(4000);
  });

  it("sin movimiento contable → income/netIncome 0 (EmptyState honesto)", async () => {
    const accounts = [
      { id: "i", code: "4", type: "I", parent_id: null, is_postable: false },
    ];
    const { client } = stub({ accounts, journal_entries: [], journal_lines: [] });
    const out = await incomeStatement(client, "1A", NOW);
    expect(out.income).toBe(0);
    expect(out.netIncome).toBe(0);
  });
});

// ── agingReport (reusa receivablesQueue 0041 + payablesQueue 0044) ──
describe("agingReport", () => {
  const TODAY_STR = "2026-06-15";

  it("clasifica CxC y CxP en buckets por días vencido", async () => {
    // CxC: facturas con saldo (total - paid > 0), no anuladas.
    const invoices = [
      // Corriente: vence en el futuro.
      { id: "v1", status: "emitida", total_amount: 1000, paid_amount: 0, due_date: "2026-07-01", currency: "USD" },
      // 1-30 vencido (10 días).
      { id: "v2", status: "emitida", total_amount: 500, paid_amount: 0, due_date: "2026-06-05", currency: "USD" },
      // 60+ vencido (~75 días).
      { id: "v3", status: "vencida", total_amount: 300, paid_amount: 0, due_date: "2026-04-01", currency: "USD" },
      // Pagada (sin saldo) → no entra.
      { id: "v4", status: "pagada", total_amount: 900, paid_amount: 900, due_date: "2026-01-01", currency: "USD" },
    ];
    // CxP (supplier_bills): saldo > 0, no anuladas.
    const supplier_bills = [
      { id: "b1", supplier_id: "s1", status: "por_vencer", total_amount: 800, paid_amount: 0, due_date: "2026-08-01", issue_date: "2026-06-01", currency: "USD" },
      { id: "b2", supplier_id: "s2", status: "vencida", total_amount: 200, paid_amount: 0, due_date: "2026-05-01", issue_date: "2026-04-01", currency: "USD" }, // ~45 días → 31-60
    ];
    const { client } = stub({
      invoices,
      collection_activities: [],
      supplier_bills,
      supplier_payments: [],
    });
    const out = await agingReport(client, TODAY_STR);

    // CxC: total 1800 (1000 + 500 + 300), vencido 800 (500 + 300).
    expect(out.cxc.total).toBe(1800);
    expect(out.cxc.overdue).toBe(800);
    const cxc = Object.fromEntries(out.cxc.buckets.map((b) => [b.id, b.amount]));
    expect(cxc.current).toBe(1000);
    expect(cxc.b1_30).toBe(500);
    expect(cxc.b60_plus).toBe(300);

    // CxP: total 1000 (800 + 200), vencido 200.
    expect(out.cxp.total).toBe(1000);
    expect(out.cxp.overdue).toBe(200);
    const cxp = Object.fromEntries(out.cxp.buckets.map((b) => [b.id, b.amount]));
    expect(cxp.current).toBe(800);
    expect(cxp.b31_60).toBe(200);
  });

  it("sin saldos → buckets en 0 (EmptyState honesto)", async () => {
    const { client } = stub({
      invoices: [],
      collection_activities: [],
      supplier_bills: [],
      supplier_payments: [],
    });
    const out = await agingReport(client, TODAY_STR);
    expect(out.cxc.total).toBe(0);
    expect(out.cxp.total).toBe(0);
  });
});

// ── cashflowReport (facturado vs cobrado, USD-norm) ────────────
describe("cashflowReport", () => {
  it("serie mensual facturado (invoices) vs cobrado (payment_receipts), USD-norm", async () => {
    const invoices = [
      // Facturado: USD + VES normalizado.
      { total_amount: 5000, currency: "USD", fx_rate: null, status: "emitida", issued_at: "2026-05-10", created_at: "2026-05-10", due_date: "2026-06-10", paid_amount: 0 },
      { total_amount: 73000, currency: "VES", fx_rate: 36.5, status: "pagada", issued_at: "2026-05-20", created_at: "2026-05-20", due_date: "2026-06-20", paid_amount: 0 },
      // Borrador → excluida del facturado.
      { total_amount: 9999, currency: "USD", fx_rate: null, status: "borrador", issued_at: "2026-05-25", created_at: "2026-05-25", due_date: null, paid_amount: 0 },
      // Fuera del rango 1A (issued_at < range.from) → excluida: verifica el filtro de
      // rango IN-MEMORY por issued_at (antes lo cubría la aserción del filtro SQL).
      { total_amount: 8000, currency: "USD", fx_rate: null, status: "emitida", issued_at: "2025-01-10", created_at: "2025-01-10", due_date: null, paid_amount: 0 },
    ];
    const payment_receipts = [
      { amount: 3000, currency: "USD", fx_rate: null, received_at: "2026-05-15" },
      { amount: 36500, currency: "VES", fx_rate: 36.5, received_at: "2026-05-28" }, // 1000 USD
    ];
    const { client, calls } = stub({ invoices, payment_receipts });
    const out = await cashflowReport(client, "1A", TODAY);

    // Rango 1A: payment_receipts filtra por received_at en SQL; invoices NO filtra
    // por fecha en SQL — el rango se aplica in-memory por issued_at??created_at (ver
    // totalBilled), para no perder filas con issued_at∈rango pero created_at∉.
    expect(calls.invoices.gte ?? []).not.toContainEqual(["created_at", "2025-06-15"]);
    expect(calls.payment_receipts.gte).toContainEqual(["received_at", "2025-06-15"]);
    // payment_receipts NO excluye anuladas; invoices sí excluye anulada/borrador.
    expect(calls.invoices.neq).toContainEqual(["status", "borrador"]);

    // Facturado del período = 5000 + 2000 (VES norm) = 7000. La factura USD 8000 de
    // 2025-01 (fuera de rango) NO suma → prueba la exclusión in-memory por issued_at.
    expect(out.totalBilled).toBe(7000);
    // Cobrado = 3000 + 1000 = 4000.
    expect(out.totalCollected).toBe(4000);

    const mayo = out.series.find((p) => p.month === "2026-05");
    expect(mayo?.billed).toBe(7000);
    expect(mayo?.collected).toBe(4000);
  });

  it("sin facturas ni cobros → totales 0 + serie continua", async () => {
    const { client } = stub({ invoices: [], payment_receipts: [] });
    const out = await cashflowReport(client, "3M", TODAY);
    expect(out.totalBilled).toBe(0);
    expect(out.totalCollected).toBe(0);
    // 3M trailing → 3-4 meses en la serie.
    expect(out.series.length).toBeGreaterThanOrEqual(3);
  });
});

// ═══════════════════════════════════════════════════════════════
// Slice C — Combinados (rentabilidad REAL · combinedReport)
// ═══════════════════════════════════════════════════════════════
describe("combinedReport (Combinados · rentabilidad real)", () => {
  it("compone costingRows del período: revenue real, costo real de shipment_costs, sin fabricar", async () => {
    const { client } = stub({
      shipments: [
        { id: "s1", code: "SH-1", client_name: "Acme", origin: "YIW", destination: "PBL", volume_m3: 10, deleted_at: null },
        { id: "s2", code: "SH-2", client_name: "Globex", origin: "YIW", destination: "PBL", volume_m3: 5, deleted_at: null },
        // s3 sin costos cargados → costo 0
        { id: "s3", code: "SH-3", client_name: "Acme", origin: "SZX", destination: "LGU", volume_m3: 8, deleted_at: null },
      ],
      shipment_costs: [
        { shipment_id: "s1", freight: 4000, customs: 0, transport: 0, handling: 0, insurance: 0, commission: 0, other: 0 },
        { shipment_id: "s2", freight: 2000, customs: 0, transport: 0, handling: 0, insurance: 0, commission: 0, other: 0 },
      ],
      invoices: [
        // En rango (1A trailing a 2026-06-15): revenue real por shipment_id.
        { shipment_id: "s1", shipment_code: "SH-1", currency: "USD", total_amount: 10000, fx_rate: null, status: "pagada", issued_at: "2026-05-01", created_at: "2026-05-01" },
        { shipment_id: "s2", shipment_code: "SH-2", currency: "USD", total_amount: 6000, fx_rate: null, status: "emitida", issued_at: "2026-05-01", created_at: "2026-05-01" },
        { shipment_id: "s3", shipment_code: "SH-3", currency: "USD", total_amount: 4000, fx_rate: null, status: "pagada", issued_at: "2026-05-01", created_at: "2026-05-01" },
        // BORRADOR → excluido del revenue (whitelist BILLABLE).
        { shipment_id: "s1", shipment_code: "SH-1", currency: "USD", total_amount: 9999, fx_rate: null, status: "borrador", issued_at: "2026-05-01", created_at: "2026-05-01" },
      ],
    });

    const out = await combinedReport(client, "1A", TODAY);

    // 3 embarques vivos; 2 con costos cargados.
    expect(out.shipments).toBe(3);
    expect(out.withCosts).toBe(2);

    // Totales reales: revenue 20000, cost 6000 (borrador NO suma).
    expect(out.totals.revenue).toBe(20000);
    expect(out.totals.cost).toBe(6000);
    expect(out.totals.margin).toBe(14000);

    // Margen por cliente: Acme = s1+s3 (rev 14000, cost 4000), Globex = s2.
    const acme = out.byClient.find((c) => c.client === "Acme");
    expect(acme?.revenue).toBe(14000);
    expect(acme?.cost).toBe(4000);
    expect(acme?.margin).toBe(10000);

    // Margen por ruta: YIW→PBL agrega s1+s2.
    const yiw = out.byRoute.find((r) => r.origin === "YIW" && r.destination === "PBL");
    expect(yiw?.count).toBe(2);
    expect(yiw?.revenue).toBe(16000);
    expect(yiw?.cost).toBe(6000);

    // Costo por CBM: YIW→PBL cbm 15, cost 6000 → 400/CBM.
    const yiwCbm = out.byCbm.find((r) => r.origin === "YIW" && r.destination === "PBL");
    expect(yiwCbm?.cbm).toBe(15);
    expect(yiwCbm?.costPerCbm).toBeCloseTo(400, 6);
  });

  it("revenue fuera del período NO entra (el rango se pasa a costingRows)", async () => {
    const { client } = stub({
      shipments: [
        { id: "s1", code: "SH-1", client_name: "Acme", origin: "YIW", destination: "PBL", volume_m3: 10, deleted_at: null },
      ],
      shipment_costs: [
        { shipment_id: "s1", freight: 1000, customs: 0, transport: 0, handling: 0, insurance: 0, commission: 0, other: 0 },
      ],
      invoices: [
        // Fuera del rango 1M (a 2026-06-15 → desde ~2026-05-15): emitida en 2026-01.
        { shipment_id: "s1", shipment_code: "SH-1", currency: "USD", total_amount: 8000, fx_rate: null, status: "pagada", issued_at: "2026-01-01", created_at: "2026-01-01" },
      ],
    });

    const out = await combinedReport(client, "1M", TODAY);
    // El revenue de enero queda fuera del período 1M → revenue 0, costo 1000.
    expect(out.totals.revenue).toBe(0);
    expect(out.totals.cost).toBe(1000);
    expect(out.totals.margin).toBe(-1000);
  });

  it("sin costos cargados → withCosts 0 (la UI muestra EmptyState honesto)", async () => {
    const { client } = stub({
      shipments: [
        { id: "s1", code: "SH-1", client_name: "Acme", origin: "YIW", destination: "PBL", volume_m3: 10, deleted_at: null },
      ],
      shipment_costs: [],
      invoices: [
        { shipment_id: "s1", shipment_code: "SH-1", currency: "USD", total_amount: 5000, fx_rate: null, status: "pagada", issued_at: "2026-05-01", created_at: "2026-05-01" },
      ],
    });

    const out = await combinedReport(client, "1A", TODAY);
    expect(out.withCosts).toBe(0);
    expect(out.shipments).toBe(1);
    // El costo es 0 pero el revenue real sí entra (margen = ingreso completo).
    expect(out.totals.cost).toBe(0);
    expect(out.totals.revenue).toBe(5000);
  });
});
