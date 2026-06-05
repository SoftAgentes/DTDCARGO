import { describe, it, expect } from "vitest";
import { buildViewCsv, reportFilename, rowsToCsv } from "../export-csv";
import type {
  AgingReport,
  CombinedReport,
  CommercialByClient,
  OperationalOverview,
  RouteRow,
} from "../types";

const TODAY = new Date("2026-06-04T12:00:00Z");

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
    expect(lines[0]).toBe("Origen → Destino,Envíos,CBM,Días prom.,Revenue USD,USD/CBM");
    expect(lines[1]).toBe("Yiwu → Pto Cabello,3,12.5,41,9000,720");
    // avgTransit null → celda vacía
    expect(lines[2]).toBe("Ningbo → La Guaira,3,12.5,,9000,720");
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
    expect(lines[0]).toBe("#,MARKBOX,Cliente,Nivel,Facturado USD 12m");
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
    expect(lines[0]).toBe("Lado,Tramo,Monto USD,Documentos,%");
    expect(lines[1]).toBe("CxC,Corriente,1000,1,100");
    expect(lines[5]).toBe("CxP,Corriente,500,1,100");
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
    totals: { revenue: 0, cost: 0, margin: 0, avgMarginPct: 0, profitable: 0, losing: 0, catTotals: {} as never },
    byRoute: [
      { origin: "Yiwu", destination: "Pto Cabello", count: 2, revenue: 8000, cost: 5000, margin: 3000, marginPct: 37, tone: "good" as never },
    ],
    byClient: [
      { client: "Acme", count: 2, revenue: 8000, cost: 5000, margin: 3000, marginPct: 37, tone: "good" as never },
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
    expect(lines[0]).toBe("Ruta,Embarques,Ingreso USD,Costo USD,Margen USD,Margen %");
    expect(lines[1]).toBe("Yiwu → Pto Cabello,2,8000,5000,3000,37");
  });

  it("rep margin-client usa byClient", () => {
    const csv = buildViewCsv({ category: "mix", rep: "margin-client", combined: combined({}), today: TODAY });
    expect(csv!.filename).toBe("reporte-combinado-margen-por-cliente-2026-06-04.csv");
    expect(csv!.content.split("\r\n")[1]).toBe("Acme,2,8000,5000,3000,37");
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
