import { describe, it, expect } from "vitest";
import { buildViewCsv, reportFilename, rowsToCsv } from "../export-csv";
import { resumirIngreso } from "@/lib/studio/accounting/ingreso-periodo";
import { costingTotals, marginByRoute, marginByClient, costPerCbmByRoute, type CostingRow } from "@/lib/studio/costing/queries";
import { shipmentEconomics } from "@/lib/studio/costing/types";
import { groupByRoute, groupByService, type ReportShipment } from "../types";
import type {
  AgingReport,
  CashflowReport,
  IncomeStatement,
  CombinedReport,
  CommercialByClient,
  OperationalOverview,
  RouteRow,
} from "../types";

const TODAY = new Date("2026-06-04T12:00:00Z");

describe("0572 revisión · CSV conserva completitud de sus agregadores reales", () => {
  const shipment = { id: "s1", code: "SH-1", origin: "CN", destination: "VE", shipment_service: "consolidado_lcl", cbm: 10, client_name: "Acme", created_at: "2026-06-01", arrived_destination_at: null, delivered_at: null } as ReportShipment;

  it.each(["routes", "services"])("operacional %s declara subtotal y omite tasa por CBM incompleta", (rep) => {
    const revenue = new Map([["SH-1", 100]]);
    const missing = new Map([["SH-1", 2]]);
    const csv = buildViewCsv({ category: "op", rep, routes: groupByRoute([shipment], revenue, missing), services: groupByService([shipment], revenue, missing), today: TODAY });
    const [head, row] = csv!.content.split("\r\n").map((line) => line.split(","));
    expect(head).toContain("Revenue USD (subtotal conocido)");
    expect(head.slice(-2)).toEqual(["Estado de conversión", "Facturas sin tasa"]);
    expect(row.slice(-2)).toEqual(["Conversión incompleta", "2"]);
    expect(row[head.indexOf("Revenue USD (subtotal conocido)")]).toBe("100");
    expect(row[head.indexOf("USD/CBM")]).toBe("");
  });

  it.each([0, 1])("ruta con subtotal cero y faltantes=%s conserva el estado y cero conocido", (sinTasa) => {
    const csv = buildViewCsv({ category: "op", rep: "routes", routes: groupByRoute([shipment], new Map([["SH-1", 0]]), new Map([["SH-1", sinTasa]])), today: TODAY });
    const [head, row] = csv!.content.split("\r\n").map((line) => line.split(","));
    expect(row[head.indexOf("Revenue USD (subtotal conocido)")]).toBe("0");
    expect(row[head.indexOf("USD/CBM")]).toBe(sinTasa ? "" : "0");
    expect(row.slice(-2)).toEqual([sinTasa ? "Conversión incompleta" : "Completo", String(sinTasa)]);
  });

  it.each(["rent-route", "margin-client", "cost-cbm"])("mixto %s conserva costos y no certifica margen", (rep) => {
    const rows: CostingRow[] = [{ shipment: { ...shipment, volume_m3: 10 } as unknown as CostingRow["shipment"], costs: null, facturasSinTasa: 2, eco: shipmentEconomics({ revenueUsd: 100, costs: { freight: 20, customs: 0, transport: 0, handling: 0, insurance: 0, commission: 0, other: 0 } }) }];
    const combined: CombinedReport = { totals: costingTotals(rows), byRoute: marginByRoute(rows), byClient: marginByClient(rows), byCbm: costPerCbmByRoute(rows), withCosts: 1, shipments: 1 };
    const csv = buildViewCsv({ category: "mix", rep, combined, today: TODAY });
    const [head, row] = csv!.content.split("\r\n").map((line) => line.split(","));
    expect(head.slice(-2)).toEqual(["Estado de conversión", "Embarques sin tasa"]);
    expect(row.slice(-2)).toEqual(["Conversión incompleta", "1"]);
    if (rep === "cost-cbm") {
      expect(row[head.indexOf("$/CBM costo")]).toBe("2");
      expect(row[head.indexOf("$/CBM ingreso")]).toBe("");
      expect(row[head.indexOf("Margen/CBM USD")]).toBe("");
      expect(row[head.indexOf("Ingreso USD (subtotal conocido)")]).toBe("100");
    } else {
      expect(row[head.indexOf("Ingreso USD (subtotal conocido)")]).toBe("100");
      expect(row[head.indexOf("Costo USD")]).toBe("20");
      expect(row[head.indexOf("Margen USD")]).toBe("");
      expect(row[head.indexOf("Margen %")]).toBe("");
    }
  });

  it("facturado/cobrado exporta solo excluidas en vez de null", () => {
    const cashflow: CashflowReport = { series: [{ month: "2026-06", label: "JUN 26", billed: 0, collected: 0, facturasSinTasa: 1, recibosSinTasa: 1 }], totalBilled: 0, totalCollected: 0, outstanding: 0, overdue: 0, facturasSinTasa: 1, recibosSinTasa: 1 };
    const csv = buildViewCsv({ category: "con", rep: "cashflow", cashflow, today: TODAY });
    expect(csv).not.toBeNull();
    expect(csv!.content).toContain("JUN 26,0,0,Conversión incompleta,1,1");
  });
});

describe("rowsToCsv", () => {
  it("une headers + filas con CRLF y celdas escapadas", () => {
    const csv = rowsToCsv(
      ["A", "B"],
      [
        ["x", 1],
        ["y", 2],
      ],
    );
    expect(csv).toBe("A,B\r\nx,1\r\ny,2");
  });

  it("escapa comas, comillas y saltos de línea; null/undefined → vacío", () => {
    const csv = rowsToCsv(
      ["Texto", "N"],
      [["Hola, mundo", null], ['Dijo "hola"', undefined], ["dos\nlíneas", 3]],
    );
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("Texto,N");
    expect(lines[1]).toBe('"Hola, mundo",');
    expect(lines[2]).toBe('"Dijo ""hola""",');
    expect(lines[3]).toBe('"dos\nlíneas",3');
  });

  it("neutraliza CSV formula injection (= + - @) en celdas de texto", () => {
    const csv = rowsToCsv(
      ["Nombre", "Monto"],
      [
        ['=HYPERLINK("http://evil","x")', 100],
        ["+1+1", 50],
        ["@cmd", 0],
        ["-cmd", 0],
      ],
    );
    const lines = csv.split("\r\n");
    // El '=' fuerza comillas (lleva comas) + prefijo ' → tratado como texto.
    expect(lines[1]).toBe('"\'=HYPERLINK(""http://evil"",""x"")",100');
    expect(lines[2]).toBe("'+1+1,50");
    expect(lines[3]).toBe("'@cmd,0");
    expect(lines[4]).toBe("'-cmd,0");
  });

  it("NO prefija números legítimos (incluidos negativos)", () => {
    const csv = rowsToCsv(["A", "B"], [[-100, "-250.5"]]);
    // -100 (number) y "-250.5" (string numérica) quedan intactos: son finitos.
    expect(csv.split("\r\n")[1]).toBe("-100,-250.5");
  });
});

describe("reportFilename", () => {
  it("arma slug kebab sin acentos + fecha ISO", () => {
    expect(reportFilename("Operación · Por Ruta", TODAY)).toBe(
      "reporte-operacion-por-ruta-2026-06-04.csv",
    );
  });

  it("cae a 'datos' si el slug queda vacío", () => {
    expect(reportFilename("···", TODAY)).toBe("reporte-datos-2026-06-04.csv");
  });
});

// ── Fixtures mínimas (solo lo que cada builder lee) ────────────
const route = (over: Partial<RouteRow>): RouteRow => ({
  key: "a||b",
  origin: "Yiwu",
  destination: "Pto Cabello",
  label: "Yiwu → Pto Cabello",
  count: 3,
  cbm: 12.5,
  avgTransit: 41,
  revenue: 9000,
  rate: 720,
  ...over,
});

describe("buildViewCsv · Operacionales · por ruta", () => {
  it("arma filename + content con header y filas", () => {
    const csv = buildViewCsv({
      category: "op",
      rep: "routes",
      routes: [route({}), route({ label: "Ningbo → La Guaira", avgTransit: null })],
      today: TODAY,
    });
    expect(csv).not.toBeNull();
    expect(csv!.filename).toBe("reporte-operacional-por-ruta-2026-06-04.csv");
    const lines = csv!.content.split("\r\n");
    expect(lines[0]).toBe("Origen → Destino,Envíos,CBM,Días prom.,Revenue USD (subtotal conocido),USD/CBM,Estado de conversión,Facturas sin tasa");
    expect(lines[1]).toBe("Yiwu → Pto Cabello,3,12.5,41,9000,720,Completo,0");
    // avgTransit null → celda vacía
    expect(lines[2]).toBe("Ningbo → La Guaira,3,12.5,,9000,720,Completo,0");
  });

  it("rutas vacías → null", () => {
    expect(buildViewCsv({ category: "op", rep: "routes", routes: [], today: TODAY })).toBeNull();
  });
});

describe("buildViewCsv · Operacionales · overview", () => {
  const overview = (shipments: number): OperationalOverview => ({
    shipments,
    cbm: 10,
    revenueUsd: 100,
    active: 1,
    monthly: [
      { month: "2026-05", label: "MAY 26", count: 2, cbm: 5 },
      { month: "2026-06", label: "JUN 26", count: 1, cbm: 5 },
    ],
    portSplit: [],
    transitByPort: [],
    orphanRevenueUsd: 0,
    unassigned: { count: 0, cbm: 0 },
  });

  it("exporta la serie mensual cuando hay embarques", () => {
    const csv = buildViewCsv({ category: "op", rep: "overview", overview: overview(3), today: TODAY });
    const lines = csv!.content.split("\r\n");
    expect(lines[0]).toBe("Mes,Embarques,CBM");
    expect(lines[1]).toBe("MAY 26,2,5");
  });

  it("sin embarques (shipments 0) → null", () => {
    expect(buildViewCsv({ category: "op", rep: "overview", overview: overview(0), today: TODAY })).toBeNull();
  });
});

describe("buildViewCsv · Comerciales · por cliente", () => {
  it("filtra billed>0, numera y omite los sin facturación", () => {
    const data: CommercialByClient = {
      ranking: [
        { markbox: "DTD-0001", name: "Acme", billedUsd: 5000, tierId: "gold", tierLabel: "Oro", tierTone: "warning" },
        { markbox: "DTD-0002", name: "Zeta", billedUsd: 0, tierId: "base", tierLabel: "Base", tierTone: "neutral" },
      ],
      tierDist: [],
      totalClients: 2,
      totalBilledUsd: 5000,
    };
    const csv = buildViewCsv({ category: "com", rep: "by-client", byClient: data, today: TODAY });
    const lines = csv!.content.split("\r\n");
    expect(lines[0]).toBe("#,Shipping Mark,Cliente,Nivel,Facturado USD 12m");
    expect(lines[1]).toBe("1,DTD-0001,Acme,Oro,5000");
    expect(lines).toHaveLength(2); // Zeta (billed 0) excluido
  });
});

describe("buildViewCsv · Contables · aging", () => {
  it("combina CxC + CxP en una columna 'Lado'", () => {
    const side = (total: number): AgingReport["cxc"] => ({
      total,
      overdue: 0,
      buckets: [
        { id: "current", label: "Corriente", amount: total, count: 1, pct: 100 },
        { id: "b1_30", label: "1–30 días", amount: 0, count: 0, pct: 0 },
        { id: "b31_60", label: "31–60 días", amount: 0, count: 0, pct: 0 },
        { id: "b60_plus", label: "60+ días", amount: 0, count: 0, pct: 0 },
      ],
    });
    const aging: AgingReport = { cxc: side(1000), cxp: side(500) };
    const csv = buildViewCsv({ category: "con", rep: "aging", aging, today: TODAY });
    const lines = csv!.content.split("\r\n");
    expect(lines[0]).toBe("Lado,Tramo,Monto USD (subtotal conocido),Documentos,%,Estado de conversión,Documentos sin tasa del lado");
    expect(lines[1]).toBe("CxC,Corriente,1000,1,100,Completo,0");
    expect(lines[5]).toBe("CxP,Corriente,500,1,100,Completo,0");
    expect(lines).toHaveLength(9); // header + 4 CxC + 4 CxP
  });

  it("ambos lados en 0 → null", () => {
    const empty: AgingReport["cxc"] = { total: 0, overdue: 0, buckets: [] };
    expect(
      buildViewCsv({ category: "con", rep: "aging", aging: { cxc: empty, cxp: empty }, today: TODAY }),
    ).toBeNull();
  });
});

describe("buildViewCsv · Combinados", () => {
  const combined = (over: Partial<CombinedReport>): CombinedReport => ({
    totals: { revenue: 0, cost: 0, margin: 0, avgMarginPct: 0, profitable: 0, losing: 0, sinTasa: 0, catTotals: {} as never },
    byRoute: [
      { origin: "Yiwu", destination: "Pto Cabello", count: 2, revenue: 8000, cost: 5000, margin: 3000, marginPct: 37, tone: "good" as never, sinTasa: 0 },
    ],
    byClient: [
      { client: "Acme", count: 2, revenue: 8000, cost: 5000, margin: 3000, marginPct: 37, tone: "good" as never, sinTasa: 0 },
    ],
    byCbm: [],
    withCosts: 2,
    shipments: 2,
    ...over,
  });

  it("rep default = rentabilidad por ruta", () => {
    const csv = buildViewCsv({ category: "mix", rep: "rent-route", combined: combined({}), today: TODAY });
    expect(csv!.filename).toBe("reporte-combinado-rentabilidad-por-ruta-2026-06-04.csv");
    const lines = csv!.content.split("\r\n");
    expect(lines[0]).toBe("Ruta,Embarques,Ingreso USD (subtotal conocido),Costo USD,Margen USD,Margen %,Estado de conversión,Embarques sin tasa");
    expect(lines[1]).toBe("Yiwu → Pto Cabello,2,8000,5000,3000,37,Completo,0");
  });

  it("rep margin-client usa byClient", () => {
    const csv = buildViewCsv({ category: "mix", rep: "margin-client", combined: combined({}), today: TODAY });
    expect(csv!.filename).toBe("reporte-combinado-margen-por-cliente-2026-06-04.csv");
    expect(csv!.content.split("\r\n")[1]).toBe("Acme,2,8000,5000,3000,37,Completo,0");
  });

  it("sin costos cargados (withCosts 0) → null", () => {
    expect(buildViewCsv({ category: "mix", rep: "rent-route", combined: combined({ withCosts: 0 }), today: TODAY })).toBeNull();
  });
});

describe("buildViewCsv · Constructor (build) se autogestiona → null", () => {
  it("devuelve null para category build", () => {
    expect(buildViewCsv({ category: "build", rep: "", today: TODAY })).toBeNull();
  });
});

// ── SDD-0557 · Estado de resultados con la cifra oficial ──────
describe("buildViewCsv · Estado de resultados (SDD-0557)", () => {
  const rango = { from: "2026-06-01", to: "2026-06-04" };
  const MAYOR_VACIO = { ventas: 0, ventasConMovimiento: false, ingresos: 0, facturasConAsiento: new Set<string>() };
  const ingreso = (base: number, currency = "USD", mayor = MAYOR_VACIO) =>
    resumirIngreso(
      base ? [{ id: "f1", status: "emitida", issued_at: "2026-06-02", currency, fx_rate: currency === "VES" ? 36.5 : null, base_amount: base }] : [],
      rango,
      mayor,
    );
  const income = (over: Partial<IncomeStatement>): IncomeStatement => ({
    rows: [],
    income: 0,
    netIncome: 0,
    range: rango,
    ingreso: ingreso(0),
    ...over,
  });

  it("0572 · exporta subtotal, estado, contador y diferencia vacía con una CNY sin tasa", () => {
    const usd = { id: "u1", status: "emitida", issued_at: "2026-06-02", currency: "USD", fx_rate: null, base_amount: 1000 };
    const cny = { ...usd, id: "c1", currency: "CNY", base_amount: 700 };
    const i = resumirIngreso([usd, cny], rango, { ventas: 1000, ventasConMovimiento: true, ingresos: 1000, facturasConAsiento: new Set(["u1"]) });
    const csv = buildViewCsv({ category: "con", rep: "income", income: income({ ingreso: i }), today: TODAY });
    const lines = csv!.content.split("\r\n");
    expect(lines).toContain("Ingreso facturado (subtotal convertido · sin IVA · USD · por emisión),1000,");
    expect(lines).toContain("Diferencia facturado − mayor (4.5),,");
    expect(lines).toContain("Control contra 4.5: Conversión incompleta,,");
    expect(lines).toContain("Facturas sin convertir (bolívares o yuanes sin tasa),1,");
    expect(csv!.content).not.toContain("Control contra 4.5: Cuadra");
  });

  it("0572 · CNY con tasa sí suma y no se describe como yuanes excluidos", () => {
    const i = resumirIngreso([{ id: "c1", status: "emitida", issued_at: "2026-06-02", currency: "CNY", fx_rate: 7, base_amount: 700 }], rango, MAYOR_VACIO);
    const csv = buildViewCsv({ category: "con", rep: "income", income: income({ ingreso: i }), today: TODAY });
    expect(csv!.content).toContain("Ingreso facturado (sin IVA · USD · por emisión),100,");
    expect(csv!.content).toContain("Facturas sin convertir (bolívares o yuanes sin tasa),0,");
  });

  it("mayor en 0 con facturado: igual exporta, con las filas de control al final", () => {
    const csv = buildViewCsv({ category: "con", rep: "income", income: income({ ingreso: ingreso(2000) }), today: TODAY });
    expect(csv).not.toBeNull();
    const lines = csv!.content.split("\r\n");
    expect(lines[0]).toBe("Concepto,Monto USD,% s/ingresos");
    expect(lines).toContain("Ingreso facturado (sin IVA · USD · por emisión),2000,");
    expect(lines).toContain("En el mayor · cuenta 4.5 · asientos de factura,0,");
    expect(lines).toContain("Diferencia facturado − mayor (4.5),2000,");
    expect(lines).toContain("Control contra 4.5: El mayor tiene menos,,");
    expect(lines).toContain("Facturas del período en bolívares o yuanes con asiento de factura (cantidad),0,");
    expect(lines).toContain("Otros ingresos del mayor (4.6 y manuales · también a 4.5),0,");
  });

  it("con una factura en bolívares y asientos de factura en 4.5: diferencia vacía, «No comparable» y 4.5 fuera de «Monto USD»", () => {
    // La factura en bolívares con su asiento de factura vivo (decisión 7).
    const conAsiento = { ventas: 36500, ventasConMovimiento: true, ingresos: 36500, facturasConAsiento: new Set(["f1"]) };
    const csv = buildViewCsv({ category: "con", rep: "income", income: income({ ingreso: ingreso(36500, "VES", conAsiento) }), today: TODAY });
    const lines = csv!.content.split("\r\n");
    expect(lines).toContain("Diferencia facturado − mayor (4.5),,");
    expect(lines).toContain("Control contra 4.5: No comparable,,");
    expect(lines).toContain("Facturas del período en bolívares o yuanes con asiento de factura (cantidad),1,");
    // El nominal mixto no va bajo «Monto USD»: la fila lo dice y la celda va vacía.
    expect(lines).toContain("En el mayor · cuenta 4.5 · asientos de factura: nominal mixto (no USD),,");
    expect(lines.some((l) => l.includes("36500") && l.startsWith("En el mayor"))).toBe(false);
  });

  it("con una factura en bolívares y 4.5 vacía (B3): el mayor tiene menos por todo lo facturado", () => {
    const csv = buildViewCsv({ category: "con", rep: "income", income: income({ ingreso: ingreso(36500, "VES") }), today: TODAY });
    const lines = csv!.content.split("\r\n");
    expect(lines).toContain("En el mayor · cuenta 4.5 · asientos de factura,0,");
    expect(lines).toContain("Diferencia facturado − mayor (4.5),1000,");
    expect(lines).toContain("Control contra 4.5: El mayor tiene menos,,");
    // Sin asiento no cuenta (decisión 7): ya falta en 4.5.
    expect(lines).toContain("Facturas del período en bolívares o yuanes con asiento de factura (cantidad),0,");
  });

  it("todo en 0 → null", () => {
    expect(buildViewCsv({ category: "con", rep: "income", income: income({}), today: TODAY })).toBeNull();
  });

  it("Facturado contra cobrado: el archivo ya no se llama cashflow", () => {
    const cashflow: CashflowReport = {
      series: [{ month: "2026-06", label: "JUN 26", billed: 100, collected: 50 }],
      totalBilled: 100,
      totalCollected: 50,
      outstanding: 50,
      overdue: 0,
    };
    const csv = buildViewCsv({ category: "con", rep: "cashflow", cashflow, today: TODAY });
    expect(csv!.filename).toBe("reporte-contable-facturado-contra-cobrado-2026-06-04.csv");
    // El facturado de esta vista lleva IVA (se compara con lo cobrado).
    expect(csv!.content.split("\r\n")[0]).toBe("Mes,Facturado con IVA USD (subtotal conocido),Cobrado USD (subtotal conocido),Estado de conversión,Facturas sin tasa,Recibos sin tasa");
  });
});
