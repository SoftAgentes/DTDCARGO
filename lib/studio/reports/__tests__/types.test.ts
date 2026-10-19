/**
 * Tests de los helpers puros de Reportes & Analytics (SDD-0052 · Slice A).
 *
 * Cubre Acceptance §5:
 *  - periodRange (1M/3M/1A/YTD, incluido borde de año).
 *  - transitDays (delivered / arrived fallback / null / negativo).
 *  - ratePerCbm (cbm 0 → 0).
 *  - groupByRoute / groupByService (agrupación + orden desc por revenue +
 *    desempate por count + revenue join por shipment_code).
 *  - monthlyBuckets (serie continua de meses, conteo + CBM).
 */

import { describe, it, expect } from "vitest";
import {
  asPeriod,
  buildAgingSide,
  classifyAging,
  groupByRoute,
  groupByService,
  incomeStatementRows,
  monthlyBuckets,
  monthlyCashflow,
  periodRange,
  ratePerCbm,
  routeKey,
  routeLabel,
  serviceLabel,
  transitDays,
  vistaDelEstado,
  type ReportShipment,
} from "../types";
import { resumirIngreso } from "@/lib/studio/accounting/ingreso-periodo";
import type { ShipmentService } from "@/lib/shared/shipment-public";

// ── periodRange ───────────────────────────────────────────────
describe("periodRange", () => {
  const today = new Date("2026-06-15T10:00:00Z");

  it("1M = trailing 1 mes", () => {
    expect(periodRange("1M", today)).toEqual({ from: "2026-05-15", to: "2026-06-15" });
  });

  it("3M = trailing 3 meses", () => {
    expect(periodRange("3M", today)).toEqual({ from: "2026-03-15", to: "2026-06-15" });
  });

  it("1A = trailing 12 meses", () => {
    expect(periodRange("1A", today)).toEqual({ from: "2025-06-15", to: "2026-06-15" });
  });

  it("MES = el mes calendario en curso (SDD-0557, la ventana de los otros tres consumidores)", () => {
    expect(periodRange("MES", today)).toEqual({ from: "2026-06-01", to: "2026-06-15" });
    expect(asPeriod("MES")).toBe("MES");
  });

  it("YTD = 1° de enero del año de today", () => {
    expect(periodRange("YTD", today)).toEqual({ from: "2026-01-01", to: "2026-06-15" });
  });

  it("borde de año: 1M en enero retrocede a diciembre del año anterior", () => {
    const enero = new Date("2026-01-10T00:00:00Z");
    expect(periodRange("1M", enero)).toEqual({ from: "2025-12-10", to: "2026-01-10" });
    expect(periodRange("YTD", enero)).toEqual({ from: "2026-01-01", to: "2026-01-10" });
  });

  it("borde de año: 3M en febrero cruza a noviembre del año anterior", () => {
    const feb = new Date("2026-02-05T00:00:00Z");
    expect(periodRange("3M", feb)).toEqual({ from: "2025-11-05", to: "2026-02-05" });
  });

  // Fin de mes: clampear el día al último válido del mes destino (no desbordar).
  it("fin de mes: 31-mar 1M → 28-feb (no desborda a marzo)", () => {
    const mar31 = new Date("2026-03-31T00:00:00Z");
    expect(periodRange("1M", mar31)).toEqual({ from: "2026-02-28", to: "2026-03-31" });
  });

  it("fin de mes: 31-may 1M → 30-abr", () => {
    const may31 = new Date("2026-05-31T00:00:00Z");
    expect(periodRange("1M", may31)).toEqual({ from: "2026-04-30", to: "2026-05-31" });
  });

  it("fin de mes: 31-dic 3M → 30-sep", () => {
    const dic31 = new Date("2026-12-31T00:00:00Z");
    expect(periodRange("3M", dic31)).toEqual({ from: "2026-09-30", to: "2026-12-31" });
  });

  it("año bisiesto: 29-feb-2024 1M → 29-ene-2024 (mes destino tiene el día)", () => {
    const feb29 = new Date("2024-02-29T00:00:00Z");
    expect(periodRange("1M", feb29)).toEqual({ from: "2024-01-29", to: "2024-02-29" });
  });

  it("año bisiesto: 29-feb-2024 1A → 28-feb-2023 (feb no-bisiesto clampea a 28)", () => {
    const feb29 = new Date("2024-02-29T00:00:00Z");
    expect(periodRange("1A", feb29)).toEqual({ from: "2023-02-28", to: "2024-02-29" });
  });
});

describe("asPeriod", () => {
  it("normaliza valores válidos y cae a 1A por default", () => {
    expect(asPeriod("1M")).toBe("1M");
    expect(asPeriod("YTD")).toBe("YTD");
    expect(asPeriod("xx")).toBe("1A");
    expect(asPeriod(undefined)).toBe("1A");
    expect(asPeriod(123)).toBe("1A");
  });
});

// ── transitDays ───────────────────────────────────────────────
describe("transitDays", () => {
  it("usa delivered_at sobre arrived_destination_at", () => {
    const d = transitDays({
      created_at: "2026-01-01T00:00:00Z",
      arrived_destination_at: "2026-02-01T00:00:00Z",
      delivered_at: "2026-02-10T00:00:00Z",
    });
    expect(d).toBe(40); // ene 1 → feb 10
  });

  it("cae a arrived_destination_at cuando no hay delivered_at", () => {
    const d = transitDays({
      created_at: "2026-01-01T00:00:00Z",
      arrived_destination_at: "2026-02-01T00:00:00Z",
      delivered_at: null,
    });
    expect(d).toBe(31);
  });

  it("null si falta el hito de cierre", () => {
    expect(
      transitDays({
        created_at: "2026-01-01T00:00:00Z",
        arrived_destination_at: null,
        delivered_at: null,
      }),
    ).toBeNull();
  });

  it("null si el resultado es negativo (datos inconsistentes)", () => {
    expect(
      transitDays({
        created_at: "2026-03-01T00:00:00Z",
        arrived_destination_at: "2026-02-01T00:00:00Z",
        delivered_at: null,
      }),
    ).toBeNull();
  });
});

// ── ratePerCbm ────────────────────────────────────────────────
describe("ratePerCbm", () => {
  it("revenue / cbm normal", () => {
    expect(ratePerCbm(1000, 2)).toBe(500);
  });
  it("cbm 0 → 0 (sin división por cero)", () => {
    expect(ratePerCbm(1000, 0)).toBe(0);
  });
  it("cbm negativo → 0", () => {
    expect(ratePerCbm(1000, -5)).toBe(0);
  });
});

// ── routeKey / routeLabel / serviceLabel ──────────────────────
describe("routeKey / routeLabel / serviceLabel", () => {
  it("routeKey normaliza espacios y separa con ||", () => {
    expect(routeKey(" Yiwu ", "Pto Cabello")).toBe("Yiwu||Pto Cabello");
    expect(routeKey(null, null)).toBe("||");
  });
  it("routeLabel muestra — para extremos vacíos", () => {
    expect(routeLabel("Yiwu", "Pto Cabello")).toBe("Yiwu → Pto Cabello");
    expect(routeLabel(null, "Maracaibo")).toBe("— → Maracaibo");
  });
  it("serviceLabel reusa SERVICE_LABELS", () => {
    expect(serviceLabel("consolidado_lcl")).toBe("Consolidado LCL");
    expect(serviceLabel("puerta_a_puerta_DDP")).toBe("Puerta a Puerta");
  });
});

// ── factory de shipment ───────────────────────────────────────
function ship(p: Partial<ReportShipment>): ReportShipment {
  return {
    id: p.id ?? crypto.randomUUID(),
    code: p.code ?? "S-2026-0001",
    origin: p.origin ?? "Yiwu",
    destination: p.destination ?? "Pto Cabello",
    shipment_service: (p.shipment_service ?? "consolidado_lcl") as ShipmentService,
    status: p.status ?? "in_transit",
    cbm: p.cbm ?? 1,
    client_name: p.client_name ?? "Cliente Demo",
    created_at: p.created_at ?? "2026-03-01T00:00:00Z",
    arrived_destination_at: p.arrived_destination_at ?? null,
    delivered_at: p.delivered_at ?? null,
    ...p,
  };
}

// ── groupByRoute ──────────────────────────────────────────────
describe("groupByRoute", () => {
  it("agrupa por origen→destino, cruza revenue por code y ordena desc por revenue", () => {
    const shipments = [
      ship({ code: "A1", origin: "Yiwu", destination: "Pto Cabello", cbm: 10 }),
      ship({ code: "A2", origin: "Yiwu", destination: "Pto Cabello", cbm: 5 }),
      ship({ code: "B1", origin: "Shenzhen", destination: "La Guaira", cbm: 4 }),
    ];
    const revenue = new Map<string, number>([
      ["A1", 8000],
      ["A2", 2000],
      ["B1", 9000],
    ]);
    const rows = groupByRoute(shipments, revenue);

    // Yiwu agrupa A1+A2 = 10000 de revenue → va primero pese a que B1 (9000)
    // tiene una sola ruta con monto unitario mayor.
    expect(rows[0].label).toBe("Yiwu → Pto Cabello");
    expect(rows[0].revenue).toBe(10000);
    expect(rows[0].count).toBe(2);
    expect(rows[0].cbm).toBe(15); // 10 + 5
    expect(rows[0].rate).toBe(Math.round(10000 / 15)); // USD/CBM
    // La Guaira queda segunda (9000).
    expect(rows[1].label).toBe("Shenzhen → La Guaira");
    expect(rows[1].revenue).toBe(9000);
    expect(rows[1].count).toBe(1);
  });

  it("desempata por count cuando el revenue es igual", () => {
    const shipments = [
      ship({ code: "X1", origin: "A", destination: "Z", cbm: 1 }),
      ship({ code: "Y1", origin: "B", destination: "Z", cbm: 1 }),
      ship({ code: "Y2", origin: "B", destination: "Z", cbm: 1 }),
    ];
    const revenue = new Map<string, number>([
      ["X1", 1000],
      ["Y1", 500],
      ["Y2", 500],
    ]);
    const rows = groupByRoute(shipments, revenue);
    // Ambas rutas suman 1000 de revenue → gana B→Z por tener 2 embarques.
    expect(rows[0].label).toBe("B → Z");
    expect(rows[0].count).toBe(2);
    expect(rows[1].label).toBe("A → Z");
  });

  it("avgTransit null si ningún embarque del grupo es medible", () => {
    const shipments = [ship({ code: "N1", arrived_destination_at: null, delivered_at: null })];
    const rows = groupByRoute(shipments, new Map());
    expect(rows[0].avgTransit).toBeNull();
    expect(rows[0].revenue).toBe(0); // sin entrada en el mapa → 0
  });
});

// ── groupByService ────────────────────────────────────────────
describe("groupByService", () => {
  it("agrupa por servicio + revenue join + orden desc", () => {
    const shipments = [
      ship({ code: "S1", shipment_service: "consolidado_lcl", cbm: 2 }),
      ship({ code: "S2", shipment_service: "consolidado_lcl", cbm: 3 }),
      ship({ code: "F1", shipment_service: "fcl_directo", cbm: 50 }),
    ];
    const revenue = new Map<string, number>([
      ["S1", 1000],
      ["S2", 1000],
      ["F1", 5000],
    ]);
    const rows = groupByService(shipments, revenue);

    expect(rows[0].service).toBe("fcl_directo");
    expect(rows[0].revenue).toBe(5000);
    expect(rows[1].service).toBe("consolidado_lcl");
    expect(rows[1].revenue).toBe(2000);
    expect(rows[1].count).toBe(2);
    expect(rows[1].cbm).toBe(5);
    expect(rows[1].label).toBe("Consolidado LCL");
  });
});

// ── monthlyBuckets ────────────────────────────────────────────
describe("monthlyBuckets", () => {
  it("serie continua de meses entre from y to (incluye meses vacíos)", () => {
    const rows = [
      ship({ created_at: "2026-01-10T00:00:00Z", cbm: 2 }),
      ship({ created_at: "2026-01-20T00:00:00Z", cbm: 3 }),
      ship({ created_at: "2026-03-05T00:00:00Z", cbm: 1 }),
    ];
    const buckets = monthlyBuckets(rows, { from: "2026-01-01", to: "2026-03-31" });

    expect(buckets.map((b) => b.month)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(buckets[0].count).toBe(2);
    expect(buckets[0].cbm).toBe(5);
    expect(buckets[1].count).toBe(0); // febrero vacío pero presente
    expect(buckets[1].cbm).toBe(0);
    expect(buckets[2].count).toBe(1);
    expect(buckets[0].label).toBe("ENE 26");
  });

  it("ignora embarques fuera del rango de meses", () => {
    const rows = [
      ship({ created_at: "2025-12-31T00:00:00Z", cbm: 9 }), // fuera
      ship({ created_at: "2026-02-15T00:00:00Z", cbm: 4 }),
    ];
    const buckets = monthlyBuckets(rows, { from: "2026-02-01", to: "2026-02-28" });
    expect(buckets).toHaveLength(1);
    expect(buckets[0].count).toBe(1);
    expect(buckets[0].cbm).toBe(4);
  });

  it("rango invertido → []", () => {
    expect(monthlyBuckets([], { from: "2026-05-01", to: "2026-01-01" })).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════
// Slice B — helpers puros (aging, income statement rows, cashflow)
// ═══════════════════════════════════════════════════════════════

// ── classifyAging ─────────────────────────────────────────────
describe("classifyAging (bordes 0/30/60)", () => {
  it("≤0 días (o null) → corriente", () => {
    expect(classifyAging(0)).toBe("current");
    expect(classifyAging(-5)).toBe("current");
    expect(classifyAging(null)).toBe("current");
  });
  it("1–30 → b1_30 (bordes inclusivos)", () => {
    expect(classifyAging(1)).toBe("b1_30");
    expect(classifyAging(30)).toBe("b1_30");
  });
  it("31–60 → b31_60 (bordes inclusivos)", () => {
    expect(classifyAging(31)).toBe("b31_60");
    expect(classifyAging(60)).toBe("b31_60");
  });
  it("61+ → b60_plus", () => {
    expect(classifyAging(61)).toBe("b60_plus");
    expect(classifyAging(400)).toBe("b60_plus");
  });
});

// ── buildAgingSide ────────────────────────────────────────────
describe("buildAgingSide", () => {
  it("suma saldos por bucket, total y vencido (todo lo no-corriente)", () => {
    const side = buildAgingSide([
      { balance: 100, daysOverdue: -3 }, // corriente
      { balance: 200, daysOverdue: 10 }, // 1-30
      { balance: 50, daysOverdue: 45 }, // 31-60
      { balance: 300, daysOverdue: 90 }, // 60+
      { balance: 0, daysOverdue: 5 }, // saldo 0 → ignorado
    ]);
    expect(side.total).toBe(650);
    expect(side.overdue).toBe(550); // 200 + 50 + 300
    const byId = Object.fromEntries(side.buckets.map((b) => [b.id, b]));
    expect(byId.current.amount).toBe(100);
    expect(byId.current.count).toBe(1);
    expect(byId.b1_30.amount).toBe(200);
    expect(byId.b31_60.amount).toBe(50);
    expect(byId.b60_plus.amount).toBe(300);
    // % sobre el total
    expect(byId.current.pct).toBeCloseTo(15.4, 0);
  });

  it("vacío → total 0, buckets en 0, pct 0", () => {
    const side = buildAgingSide([]);
    expect(side.total).toBe(0);
    expect(side.overdue).toBe(0);
    expect(side.buckets).toHaveLength(4);
    expect(side.buckets.every((b) => b.amount === 0 && b.pct === 0)).toBe(true);
  });

  it("saldo sin due_date (daysOverdue null) cuenta como corriente", () => {
    const side = buildAgingSide([{ balance: 120, daysOverdue: null }]);
    const current = side.buckets.find((b) => b.id === "current")!;
    expect(current.amount).toBe(120);
    expect(side.overdue).toBe(0);
  });
});

// ── incomeStatementRows ───────────────────────────────────────
describe("incomeStatementRows", () => {
  it("arma 5 filas con % sobre ingresos sin recalcular el P&L", () => {
    const rows = incomeStatementRows({
      income: 10000,
      cogs: 4000,
      grossProfit: 6000,
      expenses: 2000,
      netIncome: 4000,
    });
    expect(rows.map((r) => r.label)).toEqual([
      "Ingresos",
      "Costo de ventas",
      "Utilidad bruta",
      "Gastos operativos",
      "Utilidad neta",
    ]);
    expect(rows[0].pct).toBe(100);
    expect(rows[1].pct).toBe(40); // cogs / income
    expect(rows[2].amount).toBe(6000);
    expect(rows[2].emphasis).toBe(true); // utilidad bruta resaltada
    expect(rows[4].pct).toBe(40); // netIncome / income
    expect(rows[4].emphasis).toBe(true);
  });

  it("ingresos 0 → pct null en todas las filas (sin división por cero)", () => {
    const rows = incomeStatementRows({
      income: 0,
      cogs: 0,
      grossProfit: 0,
      expenses: 0,
      netIncome: 0,
    });
    expect(rows.every((r) => r.pct === null)).toBe(true);
  });
});

// ── monthlyCashflow ───────────────────────────────────────────
describe("monthlyCashflow", () => {
  it("serie continua facturado vs cobrado por mes (USD ya normalizado)", () => {
    const billed = [
      { dateIso: "2026-01-10", usd: 1000 },
      { dateIso: "2026-01-20", usd: 500 },
      { dateIso: "2026-03-05T00:00:00Z", usd: 800 },
    ];
    const collected = [
      { dateIso: "2026-01-25", usd: 700 },
      { dateIso: "2026-03-10", usd: 800 },
    ];
    const series = monthlyCashflow(billed, collected, {
      from: "2026-01-01",
      to: "2026-03-31",
    });
    expect(series.map((p) => p.month)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(series[0].billed).toBe(1500);
    expect(series[0].collected).toBe(700);
    expect(series[1].billed).toBe(0); // febrero vacío pero presente
    expect(series[1].collected).toBe(0);
    expect(series[2].billed).toBe(800);
    expect(series[2].collected).toBe(800);
    expect(series[0].label).toBe("ENE 26");
  });

  it("ignora items sin fecha y meses fuera del rango", () => {
    const series = monthlyCashflow(
      [
        { dateIso: null, usd: 999 }, // sin fecha → ignorado
        { dateIso: "2025-12-31", usd: 999 }, // fuera del rango
        { dateIso: "2026-02-15", usd: 400 },
      ],
      [],
      { from: "2026-02-01", to: "2026-02-28" },
    );
    expect(series).toHaveLength(1);
    expect(series[0].billed).toBe(400);
    expect(series[0].collected).toBe(0);
  });
});

// ── vistaDelEstado (SDD-0557) ─────────────────────────────────
describe("vistaDelEstado", () => {
  const rango = { from: "2025-03-01", to: "2025-03-18" };
  const ingreso = (base: number, extra: Record<string, unknown> = {}) =>
    resumirIngreso(
      base === 0 && !extra.currency
        ? []
        : [{ id: "f1", status: "emitida", issued_at: "2025-03-05", currency: "USD", fx_rate: null, base_amount: base, ...extra }],
      rango,
      { ventas: 0, ventasConMovimiento: false, ingresos: 0, facturasConAsiento: new Set<string>() },
    );

  it("mayor vacío y sin facturas → vacío", () => {
    expect(vistaDelEstado({ income: 0, netIncome: 0, ingreso: ingreso(0) })).toBe("vacio");
  });

  it("mayor vacío pero con facturado → solo la cifra oficial (el caso de hoy, B3)", () => {
    expect(vistaDelEstado({ income: 0, netIncome: 0, ingreso: ingreso(2000) })).toBe("solo-facturado");
  });

  it("mayor vacío con facturas que no se pudieron convertir → tampoco es vacío", () => {
    expect(vistaDelEstado({ income: 0, netIncome: 0, ingreso: ingreso(0, { currency: "CNY", base_amount: 50 }) })).toBe(
      "solo-facturado",
    );
  });

  it("con movimiento en el mayor → completo", () => {
    expect(vistaDelEstado({ income: 1000, netIncome: 400, ingreso: ingreso(2000) })).toBe("completo");
    expect(vistaDelEstado({ income: 0, netIncome: -300, ingreso: ingreso(0) })).toBe("completo");
  });
});
