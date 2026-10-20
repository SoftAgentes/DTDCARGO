/**
 * Tests de los helpers de presentación + la query de tasa de display del
 * módulo Costing & Margen (SDD-0053 · Slice B).
 *
 * Cubre Acceptance §5 Slice B:
 *  - resolveDisplayRate: SDD-0572, sin tasa válida null (el selector de VES se apaga).
 *  - asRankingSort / sortRanking: orden por margen %, margen $ y revenue.
 *  - topAndWorst: top·peores sin solaparse; ignora revenue 0.
 *  - breakdownRows: % sobre costo total (0 si costo 0, sin NaN).
 *  - costPctOfRevenue: clamp 0..100, 0 si revenue 0.
 */

import { describe, it, expect } from "vitest";
import {
  asRankingSort,
  breakdownRows,
  costPctOfRevenue,
  resolveDisplayRate,
  sortRanking,
  topAndWorst,
} from "../ui";
import { shipmentEconomics, type CostAmounts } from "../types";
import type { CostingRow, CostingTotals } from "../queries";
import type { Shipment } from "@/lib/studio/shipment-types";

// ── Builders ──────────────────────────────────────────────────
function ship(id: string, over: Partial<Shipment> = {}): Shipment {
  return {
    id,
    tenant_id: "tn1",
    code: `DTDU-${id}`,
    client_name: `Cliente ${id}`,
    client_markbox: null,
    origin: "YIW",
    destination: "PBL",
    shipment_service: "consolidado_lcl",
    status: "in_transit",
    weight_kg: null,
    volume_m3: null,
    vehicle_category: null,
    vehicle_model: null,
    arrived_destination_at: null,
    delivered_at: null,
    pod_signed_by: null,
    delivery_address: null,
    cancellation_reason: null,
    destination_gps: null,
    notes: null,
    deleted_at: null,
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
    ...over,
  } as Shipment;
}

function row(id: string, revenue: number, cost: number, over: Partial<Shipment> = {}): CostingRow {
  const costs: CostAmounts = {
    freight: cost,
    customs: 0,
    transport: 0,
    handling: 0,
    insurance: 0,
    commission: 0,
    other: 0,
  };
  return {
    shipment: ship(id, over),
    costs: null,
    eco: shipmentEconomics({ revenueUsd: revenue, costs }),
  };
}

// ── resolveDisplayRate ────────────────────────────────────────
describe("resolveDisplayRate", () => {
  it("usa el fx_rate provisto cuando es positivo", () => {
    expect(resolveDisplayRate(40.5)).toBe(40.5);
  });

  // SDD-0572 (decisión 1 de Sam y del Director, 2026-10-20): sin tasa, nunca un
  // valor fijo. Antes caía a 36,45.
  it("sin tasa válida (null / 0 / negativo / NaN) devuelve null", () => {
    expect(resolveDisplayRate(null)).toBeNull();
    expect(resolveDisplayRate(undefined)).toBeNull();
    expect(resolveDisplayRate(0)).toBeNull();
    expect(resolveDisplayRate(-5)).toBeNull();
    expect(resolveDisplayRate(Number.NaN)).toBeNull();
  });
});

// ── asRankingSort / sortRanking ───────────────────────────────
describe("asRankingSort", () => {
  it("default margin-pct-desc para basura", () => {
    expect(asRankingSort("xxx")).toBe("margin-pct-desc");
    expect(asRankingSort(undefined)).toBe("margin-pct-desc");
  });
  it("respeta los valores válidos", () => {
    expect(asRankingSort("revenue-desc")).toBe("revenue-desc");
    expect(asRankingSort("margin-abs-desc")).toBe("margin-abs-desc");
    expect(asRankingSort("margin-pct-asc")).toBe("margin-pct-asc");
  });
});

describe("sortRanking", () => {
  // A: rev 10000 cost 5000 → margin 5000, pct 50
  // B: rev 4000  cost 3800 → margin 200,  pct 5
  // C: rev 2000  cost 3000 → margin -1000, pct -50
  const rows = [row("A", 10000, 5000), row("B", 4000, 3800), row("C", 2000, 3000)];

  it("margin-pct-desc", () => {
    expect(sortRanking(rows, "margin-pct-desc").map((r) => r.shipment.id)).toEqual(["A", "B", "C"]);
  });
  it("margin-pct-asc", () => {
    expect(sortRanking(rows, "margin-pct-asc").map((r) => r.shipment.id)).toEqual(["C", "B", "A"]);
  });
  it("margin-abs-desc", () => {
    expect(sortRanking(rows, "margin-abs-desc").map((r) => r.shipment.id)).toEqual(["A", "B", "C"]);
  });
  it("revenue-desc", () => {
    expect(sortRanking(rows, "revenue-desc").map((r) => r.shipment.id)).toEqual(["A", "B", "C"]);
  });
  it("no muta el array original", () => {
    const copy = [...rows];
    sortRanking(rows, "margin-pct-asc");
    expect(rows).toEqual(copy);
  });
});

// ── topAndWorst ───────────────────────────────────────────────
describe("topAndWorst", () => {
  it("top = más rentables, worst = peores, sin solaparse", () => {
    const rows = [
      row("A", 10000, 5000), // margin 5000
      row("B", 8000, 7000), // margin 1000
      row("C", 6000, 6500), // margin -500
      row("D", 4000, 5000), // margin -1000
    ];
    const { top, worst } = topAndWorst(rows, 2);
    expect(top.map((r) => r.shipment.id)).toEqual(["A", "B"]);
    expect(worst.map((r) => r.shipment.id)).toEqual(["D", "C"]);
  });

  it("ignora embarques con revenue 0", () => {
    const rows = [row("A", 10000, 5000), row("Z", 0, 3000)];
    const { top, worst } = topAndWorst(rows, 3);
    const ids = [...top, ...worst].map((r) => r.shipment.id);
    expect(ids).not.toContain("Z");
  });

  it("no repite un embarque en top y worst con pocas filas", () => {
    const rows = [row("A", 10000, 5000), row("B", 8000, 7000)];
    const { top, worst } = topAndWorst(rows, 3);
    const overlap = top.filter((t) => worst.includes(t));
    expect(overlap).toHaveLength(0);
  });
});

// ── breakdownRows / costPctOfRevenue ──────────────────────────
function totals(over: Partial<CostingTotals> = {}): CostingTotals {
  return {
    revenue: 0,
    cost: 0,
    margin: 0,
    avgMarginPct: 0,
    profitable: 0,
    losing: 0,
    catTotals: {
      freight: 0,
      customs: 0,
      transport: 0,
      handling: 0,
      insurance: 0,
      commission: 0,
      other: 0,
    },
    ...over,
  };
}

describe("breakdownRows", () => {
  it("% sobre el costo total, en orden de categorías", () => {
    const t = totals({
      cost: 1000,
      catTotals: {
        freight: 500,
        customs: 250,
        transport: 100,
        handling: 50,
        insurance: 50,
        commission: 30,
        other: 20,
      },
    });
    const rows = breakdownRows(t);
    expect(rows.map((r) => r.key)).toEqual([
      "freight",
      "customs",
      "transport",
      "handling",
      "insurance",
      "commission",
      "other",
    ]);
    expect(rows[0]).toMatchObject({ key: "freight", amount: 500, pct: 50 });
    expect(rows[1].pct).toBe(25);
  });

  it("costo total 0 → todos los pct 0 (sin NaN)", () => {
    const rows = breakdownRows(totals({ cost: 0 }));
    for (const r of rows) {
      expect(r.pct).toBe(0);
      expect(Number.isNaN(r.pct)).toBe(false);
    }
  });
});

describe("costPctOfRevenue", () => {
  it("cost/revenue × 100", () => {
    expect(costPctOfRevenue(totals({ revenue: 1000, cost: 700 }))).toBe(70);
  });
  it("revenue 0 → 0 (sin NaN)", () => {
    expect(costPctOfRevenue(totals({ revenue: 0, cost: 500 }))).toBe(0);
  });
  it("clamp a 100 cuando el costo supera el revenue", () => {
    expect(costPctOfRevenue(totals({ revenue: 1000, cost: 2000 }))).toBe(100);
  });
});
