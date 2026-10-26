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
import { describirIngreso, ESTADOS_DE_INGRESO } from "@/lib/studio/accounting/ingreso-periodo";

/** Tope por request del doble: el `db-max-rows` de Supabase. */
const SERVER_CAP = 1000;

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

  const rpcChain = (rows: Record<string, unknown>[]) => {
    const chain: Record<string, unknown> = {
      order: () => chain,
      range: (desde: number, hasta: number) => {
        const pedido = hasta - desde + 1;
        const trozo = rows.slice(
          desde,
          desde + Math.min(pedido, SERVER_CAP),
        );
        return Promise.resolve({ data: trozo, error: null });
      },
    };
    return chain;
  };

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
    rpc(fn: string) {
      return rpcChain(rowsByTable[fn] ?? []);
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
      shipment_service: "consolidado_lcl", status: "in_transit", volume_m3: 10,
      created_at: "2026-03-01T00:00:00Z", arrived_destination_at: null, delivered_at: null,
    },
    {
      id: "2", code: "A2", origin: "Yiwu", destination: "Pto Cabello",
      shipment_service: "consolidado_lcl", status: "delivered", volume_m3: 5,
      created_at: "2026-04-01T00:00:00Z",
      arrived_destination_at: "2026-05-01T00:00:00Z", delivered_at: "2026-05-10T00:00:00Z",
    },
    {
      id: "3", code: "B1", origin: "Shenzhen", destination: "La Guaira",
      shipment_service: "fcl_directo", status: "draft", volume_m3: 50,
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
        shipment_service: "consolidado_lcl", status: "in_transit", volume_m3: 5,
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
        shipment_service: "consolidado_lcl", status: "in_transit", volume_m3: 10,
        client_name: null,
        created_at: "2026-03-01T00:00:00Z", arrived_destination_at: null, delivered_at: null,
      },
      // Sin cliente (string vacío tras trim) → cuenta.
      {
        id: "2", code: "U2", origin: "Yiwu", destination: "Pto Cabello",
        shipment_service: "consolidado_lcl", status: "in_transit", volume_m3: 2.5,
        client_name: "   ",
        created_at: "2026-03-02T00:00:00Z", arrived_destination_at: null, delivered_at: null,
      },
      // Con cliente → NO cuenta.
      {
        id: "3", code: "C1", origin: "Shenzhen", destination: "La Guaira",
        shipment_service: "fcl_directo", status: "shipped", volume_m3: 40,
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
        shipment_service: "consolidado_lcl", status: "in_transit", volume_m3: 10,
        client_name: "Acme",
        created_at: "2026-03-01T00:00:00Z", arrived_destination_at: null, delivered_at: null,
      },
      {
        id: "2", code: "B1", origin: "Shenzhen", destination: "La Guaira",
        shipment_service: "fcl_directo", status: "shipped", volume_m3: 40,
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
        shipment_service: "consolidado_lcl", status: "in_transit", volume_m3: 10,
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
      shipment_service: "consolidado_lcl", status: "in_transit", volume_m3: 10,
      created_at: "2026-03-01T00:00:00Z", arrived_destination_at: null, delivered_at: null,
    },
    {
      id: "2", code: "B1", origin: "Shenzhen", destination: "La Guaira",
      shipment_service: "fcl_directo", status: "shipped", volume_m3: 40,
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
    expect(rows[0].service).toBe("fcl_directo");
    expect(rows[0].revenue).toBe(9000);
    expect(rows[1].service).toBe("consolidado_lcl");
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
    // La normalización y ventana ya vienen agregadas desde la RPC mínima.
    const billing = [
      { client_markbox: "DTD-1", billed_usd: 320000 },
      { client_markbox: "DTD-2", billed_usd: 12000 },
    ];
    const clients = [
      { id: "1", markbox: "DTD-1", name: "Alfa" },
      { id: "2", markbox: "DTD-2", name: "Beta" },
      { id: "3", markbox: "DTD-3", name: "Gamma" }, // sin facturación
    ];
    const { client } = stub({ studio_client_annual_billing: billing, clients });
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
    const { client } = stub({ studio_client_annual_billing: [], clients: [] });
    const out = await commercialByClient(client, NOW);
    expect(out.totalClients).toBe(0);
    expect(out.ranking).toEqual([]);
    expect(out.totalBilledUsd).toBe(0);
  });
});

// ── incomeStatement (reusa profitAndLoss 0040, NO recalcula) ───
/**
 * FICCIÓN ORIGINAL SDD-0573/0557, aislada de ingreso-fixture.
 * UUIDs, fechas, cuentas y documentos se definen aquí; no representan datos reales.
 * El doble sólo admite las consultas leídas del contrato actual y aplica cada
 * filtro ANTES de proyectar/paginar. Dos filas por página obligan a continuar.
 */
type FictIncomeTable = "accounts" | "journal_entries" | "journal_lines" | "invoices";
type FictIncomeRows = Record<FictIncomeTable, readonly Record<string, unknown>[]>;
type FictIncomeFilter = { method: "eq" | "is" | "in" | "gte" | "lte"; column: string; value: unknown };
type FictIncomeRead = {
  role: string; table: FictIncomeTable; columns: string; filters: FictIncomeFilter[];
  range: [number, number] | null; returnedIds: string[];
};
const fictIncomeId = (n: number) => "fa573000-0000-4000-8000-" + n.toString(16).padStart(12, "0");
const FICT_INCOME = {
  tenant: fictIncomeId(1), foreignTenant: fictIncomeId(2),
  income: fictIncomeId(10), sales: fictIncomeId(11), other: fictIncomeId(12),
  assets: fictIncomeId(20), receivable: fictIncomeId(21),
  manual: fictIncomeId(400), missingDocument: fictIncomeId(999),
  today: "2025-03-18T12:00:00.000Z",
  range: { from: "2025-03-01", to: "2025-03-18" },
};
const FICT_OFFICIAL_USD = 1000;
const FICT_OFFICIAL_NOMINAL = 200; // 700 VES / 7 + 500 VES / 5; CNY no se convierte.
type FictIncomeDocument = {
  n: number; currency: "USD" | "VES" | "CNY"; base: number; fx: number | null; posting: number;
};

function fictIncomeRows(documents: readonly FictIncomeDocument[], manual: { account: string; amount: number }): FictIncomeRows {
  const tenant_id = FICT_INCOME.tenant;
  const account = (id: string, code: string, type: string, parent_id: string | null, is_postable: boolean) =>
    ({ id, tenant_id, code, type, parent_id, is_postable, name: "FICT_CUENTA_" + code,
      qbo_type: null, subtype: null, notes: "FICTICIO", created_at: FICT_INCOME.today, updated_at: FICT_INCOME.today });
  const accounts = [
    account(FICT_INCOME.income, "4", "I", null, false),
    account(FICT_INCOME.sales, "4.5", "I", FICT_INCOME.income, true),
    account(FICT_INCOME.other, "4.6", "I", FICT_INCOME.income, true),
    account(FICT_INCOME.assets, "1", "A", null, false),
    account(FICT_INCOME.receivable, "1.1", "A", FICT_INCOME.assets, true),
    { ...account(fictIncomeId(90), "4", "I", null, false), tenant_id: FICT_INCOME.foreignTenant },
  ];
  const invoice = (id: string, currency: string, base_amount: number, fx_rate: number | null) =>
    ({ id, tenant_id, currency, base_amount, fx_rate, status: "emitida", issued_at: "2025-03-07",
      fund_class: "local_revenue", deleted_at: null });
  const invoices: Record<string, unknown>[] = documents.map(d =>
    invoice(fictIncomeId(d.n), d.currency, d.base, d.fx));
  // Distractores FICTICIOS: cada filtro tiene consecuencias observables.
  invoices.push(
    { ...invoice(fictIncomeId(800), "USD", 777, null), issued_at: "2025-02-28" },
    { ...invoice(fictIncomeId(801), "USD", 555, null), issued_at: "2025-03-19" },
    { ...invoice(fictIncomeId(802), "USD", 333, null), status: "borrador" },
    { ...invoice(fictIncomeId(803), "USD", 222, null), deleted_at: FICT_INCOME.today },
    { ...invoice(fictIncomeId(804), "USD", 111, null), status: "anulada" },
    { ...invoice(fictIncomeId(805), "USD", 99999, null), tenant_id: FICT_INCOME.foreignTenant },
  );
  const journal_entries: Record<string, unknown>[] = [];
  const journal_lines: Record<string, unknown>[] = [];
  const post = (n: number, invoice_id: string | null, source: string, amount: number, account_id: string,
    entry_date = "2025-03-07", scope = tenant_id) => {
    const entry_id = fictIncomeId(n);
    journal_entries.push({ id: entry_id, tenant_id: scope, status: "asentado", source,
      deleted_at: null, invoice_id, entry_date, reverses_entry_id: null, memo: "FICT_ASIENTO" });
    journal_lines.push(
      { id: fictIncomeId(n * 10), tenant_id: scope, entry_id, account_id, debit: 0, credit: amount },
      { id: fictIncomeId(n * 10 + 1), tenant_id: scope, entry_id, account_id: FICT_INCOME.receivable, debit: amount, credit: 0 },
    );
  };
  for (const d of documents) post(d.n + 100, fictIncomeId(d.n), "invoice", d.posting, FICT_INCOME.sales);
  post(400, null, "manual", manual.amount, manual.account);
  post(600, fictIncomeId(800), "invoice", 777, FICT_INCOME.sales, "2025-02-28");
  post(601, fictIncomeId(801), "invoice", 555, FICT_INCOME.sales, "2025-03-19");
  post(602, fictIncomeId(805), "invoice", 99999, FICT_INCOME.sales, "2025-03-07", FICT_INCOME.foreignTenant);
  return { accounts, journal_entries, journal_lines, invoices };
}

// Los tres universos completos y sus expectativas existen antes de los callbacks.
const FICT_USD_INCOME = fictIncomeRows(
  [{ n: 100, currency: "USD", base: FICT_OFFICIAL_USD, fx: null, posting: 600 }],
  { account: FICT_INCOME.sales, amount: 300 },
);
const FICT_NOMINAL_INCOME = fictIncomeRows(
  [{ n: 110, currency: "VES", base: 700, fx: 7, posting: 700 },
    { n: 111, currency: "VES", base: 500, fx: 5, posting: 500 },
    { n: 112, currency: "CNY", base: 300, fx: null, posting: 300 }],
  { account: FICT_INCOME.other, amount: 200 },
);
const FICT_INCOMPLETE_INCOME: FictIncomeRows = {
  ...FICT_USD_INCOME,
  // Cabecera huérfana explícita: el documento referido no está en este universo.
  // No se finge un error ni un [] genérico: la consulta por id no puede hallarlo.
  journal_entries: FICT_USD_INCOME.journal_entries.map(row =>
    row.id === fictIncomeId(200) ? { ...row, invoice_id: FICT_INCOME.missingDocument } : { ...row }),
};

function fictIncomeStub(rowsByTable: FictIncomeRows): {
  client: SupabaseClient; calls: Record<string, Recorded>; reads: FictIncomeRead[];
} {
  const calls: Record<string, Recorded> = {};
  const reads: FictIncomeRead[] = [];
  const fullAccounts = "id,tenant_id,code,name,type,parent_id,qbo_type,subtype,is_postable,notes,created_at,updated_at";
  const headers = "id,tenant_id,status,source,deleted_at,invoice_id,entry_date,reverses_entry_id";
  const official = "id,status,issued_at,currency,fx_rate,base_amount,fund_class,deleted_at";
  const rules: { table: FictIncomeTable; columns: string; filters: string[]; role: string }[] = [
    { table: "accounts", columns: fullAccounts, filters: [], role: "FICT_catalog" },
    { table: "accounts", columns: "id,tenant_id,code,type,parent_id", filters: ["in:id"], role: "FICT_ancestry" },
    { table: "journal_entries", columns: "id", filters: ["eq:status", "is:deleted_at", "gte:entry_date", "lte:entry_date"], role: "FICT_balance_entries" },
    { table: "journal_entries", columns: "id,status,source,deleted_at,invoice_id", filters: ["eq:status", "is:deleted_at", "in:source", "gte:entry_date", "lte:entry_date"], role: "FICT_sales_entries" },
    { table: "journal_entries", columns: headers, filters: ["in:source", "gte:entry_date", "lte:entry_date"], role: "FICT_candidates" },
    { table: "journal_entries", columns: headers, filters: ["in:invoice_id", "in:source"], role: "FICT_document_entries" },
    { table: "journal_entries", columns: headers, filters: ["in:id"], role: "FICT_original_links" },
    { table: "journal_entries", columns: headers, filters: ["in:reverses_entry_id"], role: "FICT_reverse_links" },
    { table: "journal_lines", columns: "id,account_id,debit,credit", filters: ["in:entry_id"], role: "FICT_balance_lines" },
    { table: "journal_lines", columns: "id,entry_id,account_id,debit,credit", filters: ["in:entry_id"], role: "FICT_evidence_lines" },
    { table: "invoices", columns: official, filters: ["is:deleted_at", "in:status", "gte:issued_at", "lte:issued_at"], role: "FICT_official" },
    { table: "invoices", columns: "id,tenant_id,status,issued_at,currency,fx_rate,base_amount,fund_class,deleted_at", filters: ["in:id"], role: "FICT_document_metadata" },
  ];
  const signature = (keys: string[]) => [...keys].sort().join("|");
  const client = {
    from(name: string) {
      if (!Object.prototype.hasOwnProperty.call(rowsByTable, name)) throw new Error("FICT unexpected table: " + name);
      const table = name as FictIncomeTable;
      const rec = calls[table] ??= { gte: [], lte: [], eq: [], is: [], not: [], neq: [], in: [] };
      const filters: FictIncomeFilter[] = [];
      let columns: string[] = [];
      let order: { column: string; ascending: boolean } | null = null;
      let range: [number, number] | null = null;
      let limit: number | null = null;
      const filter = (method: FictIncomeFilter["method"], column: string, value: unknown): Record<string, unknown> => {
        filters.push({ method, column, value });
        rec[method].push([column, value]);
        return chain;
      };
      const execute = () => {
        const cols = columns.join(",");
        const keys = filters.filter(f => f.column !== "tenant_id").map(f => f.method + ":" + f.column);
        const rule = rules.find(r => r.table === table && r.columns === cols && signature(r.filters) === signature(keys));
        if (!rule) throw new Error("FICT unexpected query: " + table + "/" + cols + "/" + signature(keys));
        if (rule.role === "FICT_catalog") {
          if (limit !== 1000 || range !== null || order !== null) throw new Error("FICT catalog contract changed");
        } else if (limit !== null || range === null || order?.column !== "id" || order.ascending !== true) {
          throw new Error("FICT expected stable order and real range: " + rule.role);
        }
        for (const f of filters) {
          if (f.column === "source" && (f.method !== "in" || JSON.stringify(f.value) !== '["invoice","invoice_reversal"]')) throw new Error("FICT unexpected source scope");
          if (f.column === "status" && f.method === "eq" && f.value !== "asentado") throw new Error("FICT unexpected posting status");
          if (f.column === "status" && f.method === "in" && JSON.stringify(f.value) !== '["emitida","parcial","pagada","vencida","anulada"]') throw new Error("FICT unexpected invoice states");
          if (f.method === "gte" && f.value !== FICT_INCOME.range.from) throw new Error("FICT unexpected start date");
          if (f.method === "lte" && f.value !== FICT_INCOME.range.to) throw new Error("FICT unexpected end date");
        }
        // Sesión/RLS FICTICIA más TODOS los filtros reales del builder.
        let rows = rowsByTable[table].filter(row => row.tenant_id === FICT_INCOME.tenant);
        rows = rows.filter(row => filters.every(f => {
          if (!(f.column in row)) throw new Error("FICT absent filter column: " + f.column);
          const value = row[f.column];
          if (f.method === "eq" || f.method === "is") return value === f.value;
          if (f.method === "in") {
            if (!Array.isArray(f.value)) throw new Error("FICT in requires an array");
            return f.value.includes(value);
          }
          if (typeof value !== "string" || typeof f.value !== "string") throw new Error("FICT date filter requires strings");
          return f.method === "gte" ? value >= f.value : value <= f.value;
        }));
        if (order !== null) rows = [...rows].sort((a, b) => String(a.id).localeCompare(String(b.id)));
        const page = range === null ? rows.slice(0, limit ?? rows.length)
          : rows.slice(range[0], range[0] + Math.min(range[1] - range[0] + 1, 2));
        reads.push({ role: rule.role, table, columns: cols, filters: filters.map(f => ({ ...f })),
          range: range === null ? null : [...range], returnedIds: page.map(row => String(row.id)) });
        const data = page.map(row => Object.fromEntries(columns.map(column => {
          if (!(column in row)) throw new Error("FICT absent projected column: " + column);
          return [column, row[column]];
        })));
        return { data, error: null };
      };
      const chain: Record<string, unknown> = {
        select: (value: string) => { columns = value.split(",").map(c => c.trim()); return chain; },
        eq: (c: string, v: unknown) => filter("eq", c, v),
        is: (c: string, v: unknown) => filter("is", c, v),
        in: (c: string, v: readonly unknown[]) => filter("in", c, [...v]),
        gte: (c: string, v: unknown) => filter("gte", c, v),
        lte: (c: string, v: unknown) => filter("lte", c, v),
        order: (column: string, opts: { ascending: boolean }) => { order = { column, ascending: opts.ascending }; return chain; },
        limit: (n: number) => { limit = n; return chain; },
        range: (from: number, to: number) => {
          if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < from) throw new Error("FICT invalid page range");
          range = [from, to]; return Promise.resolve(execute());
        },
        then: (resolve: (result: { data: Record<string, unknown>[]; error: null }) => unknown) => Promise.resolve(execute()).then(resolve),
      };
      return chain;
    },
    rpc() { throw new Error("FICT read-only income double forbids RPC"); },
  } as unknown as SupabaseClient; // Doble deliberadamente acotado; nunca cliente real.
  return { client, calls, reads };
}

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

  it("SDD-0557 · trae la cifra oficial del MISMO período; con bolívares o yuanes, el control no es comparable", async () => {
    const { client, calls, reads } = fictIncomeStub(FICT_NOMINAL_INCOME);
    const out = await incomeStatement(client, "MES", new Date(FICT_INCOME.today));
    expect(out.range).toEqual(FICT_INCOME.range);
    expect(out.ingreso.facturado.total).toBe(FICT_OFFICIAL_NOMINAL);
    expect(out.ingreso.mayor).toEqual({ ventas: 1500, ventasConMovimiento: true, ingresos: out.income, otrosIngresos: 200 });
    expect(out.income).toBe(1700);
    expect(out.ingreso.enOtraMoneda).toBe(3);
    expect(out.ingreso.diferenciaUsd).toBeNull();
    expect(out.ingreso.controlI2).toMatchObject({ verificacion: "completa", unidadMayor: "nominal_mixto", incidencias: [] });
    expect(describirIngreso(out.ingreso).estado).toBe("no_comparable");
    expect(calls.invoices.gte).toContainEqual(["issued_at", "2025-03-01"]);
    expect(calls.invoices.lte).toContainEqual(["issued_at", "2025-03-18"]);
    expect(calls.invoices.in).toContainEqual(["status", [...ESTADOS_DE_INGRESO, "anulada"]]);
    expect(calls.invoices.is).toContainEqual(["deleted_at", null]);
    // Se conservan origen, reversos y exclusión del manual, no un eq obsoleto.
    expect(calls.journal_entries.in).toContainEqual(["source", ["invoice", "invoice_reversal"]]);
    const candidates = reads.filter(r => r.role === "FICT_candidates");
    expect(candidates.map(r => r.range?.[0])).toEqual([0, 2, 3]);
    expect(candidates.flatMap(r => r.returnedIds)).toEqual([210, 211, 212].map(fictIncomeId));
    expect(candidates.flatMap(r => r.returnedIds)).not.toContain(FICT_INCOME.manual);
    expect(reads.filter(r => r.role === "FICT_evidence_lines").some(r => r.range?.[0] === 4)).toBe(true);
    expect(reads.some(r => r.role === "FICT_ancestry" && r.returnedIds.includes(FICT_INCOME.income))).toBe(true);
  });

  it("SDD-0557 · solo USD: el control contra la 4.5 de los asientos de factura; un manual a 4.5 no es diferencia", async () => {
    const { client, reads } = fictIncomeStub(FICT_USD_INCOME);
    const out = await incomeStatement(client, "MES", new Date(FICT_INCOME.today));
    expect(out.ingreso.facturado.total).toBe(FICT_OFFICIAL_USD);
    expect(out.ingreso.mayor).toEqual({ ventas: 600, ventasConMovimiento: true, ingresos: 900, otrosIngresos: 300 });
    expect(out.ingreso.diferenciaUsd).toBe(400);
    expect(out.ingreso.controlI2).toMatchObject({ verificacion: "completa", unidadMayor: "usd", incidencias: [] });
    const balances = reads.filter(r => r.role === "FICT_balance_entries").flatMap(r => r.returnedIds);
    const sales = reads.filter(r => r.role === "FICT_sales_entries").flatMap(r => r.returnedIds);
    expect(balances).toContain(FICT_INCOME.manual);
    expect(sales).toEqual([fictIncomeId(200)]);
    expect(sales).not.toContain(FICT_INCOME.manual);
    const metadata = reads.filter(r => r.role === "FICT_document_metadata").flatMap(r => r.returnedIds);
    expect(metadata).toContain(fictIncomeId(100));
    expect(reads.filter(r => r.role === "FICT_official").flatMap(r => r.returnedIds))
      .toEqual([100, 804].map(fictIncomeId));
  });

  it("SDD-0573 · evidencia documental incompleta conserva el subtotal y exige revisión", async () => {
    const { client, reads } = fictIncomeStub(FICT_INCOMPLETE_INCOME);
    const out = await incomeStatement(client, "MES", new Date(FICT_INCOME.today));
    expect(out.ingreso.facturado.total).toBe(FICT_OFFICIAL_USD);
    expect(out.ingreso.mayor).toEqual({ ventas: 600, ventasConMovimiento: true, ingresos: 900, otrosIngresos: 300 });
    expect(out.ingreso.diferenciaUsd).toBeNull();
    expect(out.ingreso.baseComparacionUsd).toBeNull();
    expect(out.ingreso.controlI2.verificacion).toBe("requiere_revision");
    expect(out.ingreso.controlI2.unidadMayor).toBe("sin_verificar");
    expect(out.ingreso.controlI2.incidencias).toContainEqual({ codigo: "documento_no_disponible", cantidad: 1 });
    expect(describirIngreso(out.ingreso).estado).toBe("requiere_revision");
    expect(reads.filter(r => r.role === "FICT_document_metadata").flatMap(r => r.returnedIds))
      .not.toContain(FICT_INCOME.missingDocument);
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
