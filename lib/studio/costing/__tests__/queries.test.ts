/**
 * Tests de queries de Costing & Margen (SDD-0053 · Slice A).
 *
 * Cubre Acceptance §5 Slice A (queries):
 *  - revenueByShipment EXCLUYE `borrador` (whitelist BILLABLE, no `.neq`),
 *    normaliza USD y mapea por shipment_id y por shipment_code.
 *  - listShipmentCosts coacciona numeric→number y mapea por shipment_id.
 *  - costingRows cruza shipments + costos + revenue (id → fallback code).
 *  - costingTotals: totales + profitable/losing + catTotals (pura).
 *  - marginByRoute: agrupación + orden desc por marginPct + revenue 0 (pura).
 *
 * El stub de SupabaseClient es chainable y enruta por nombre de tabla (estilo
 * fidelizacion/__tests__/queries.test.ts).
 */

import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  costingRows,
  costingTotals,
  costPerCbmByRoute,
  listShipmentCosts,
  marginByClient,
  marginByRoute,
  revenueByShipment,
  NO_CLIENT_LABEL,
  type CostingRow,
} from "../queries";

// ── Stub de SupabaseClient ────────────────────────────────────
function stub(rowsByTable: Record<string, Record<string, unknown>[]>): SupabaseClient {
  return {
    from(table: string) {
      const rows = rowsByTable[table] ?? [];
      const chain: Record<string, unknown> = {
        select() {
          return chain;
        },
        order() {
          return chain;
        },
        limit() {
          return chain;
        },
        eq() {
          return chain;
        },
        then(resolve: (v: { data: unknown; error: null }) => unknown) {
          return Promise.resolve({ data: rows, error: null }).then(resolve);
        },
      };
      return chain;
    },
  } as unknown as SupabaseClient;
}

// ── revenueByShipment ─────────────────────────────────────────
describe("revenueByShipment", () => {
  it("excluye borrador (whitelist), normaliza USD, mapea por id y code", async () => {
    const invoices = [
      // shipment_id S1: emitida USD 5000 → cuenta
      { shipment_id: "S1", shipment_code: "DTDU-1", currency: "USD", total_amount: 5000, fx_rate: null, status: "emitida", issued_at: "2026-02-01", created_at: "2026-02-01" },
      // shipment_id S1: pagada USDT 1000 (1:1) → S1 total 6000
      { shipment_id: "S1", shipment_code: "DTDU-1", currency: "USDT", total_amount: 1000, fx_rate: null, status: "pagada", issued_at: "2026-02-02", created_at: "2026-02-02" },
      // shipment_id S1: BORRADOR 9999 → NO cuenta (clave del test, lección 0052)
      { shipment_id: "S1", shipment_code: "DTDU-1", currency: "USD", total_amount: 9999, fx_rate: null, status: "borrador", issued_at: "2026-02-03", created_at: "2026-02-03" },
      // shipment_id S2: anulada → NO cuenta
      { shipment_id: "S2", shipment_code: "DTDU-2", currency: "USD", total_amount: 4000, fx_rate: null, status: "anulada", issued_at: "2026-02-01", created_at: "2026-02-01" },
      // sin shipment_id pero con code: vencida VES 36500 / fx 36.5 = 1000 → solo byCode
      { shipment_id: null, shipment_code: "DTDU-3", currency: "VES", total_amount: 36500, fx_rate: 36.5, status: "vencida", issued_at: "2026-02-01", created_at: "2026-02-01" },
      // CNY → 0 (omitida)
      { shipment_id: "S4", shipment_code: "DTDU-4", currency: "CNY", total_amount: 7000, fx_rate: null, status: "emitida", issued_at: "2026-02-01", created_at: "2026-02-01" },
    ];
    const { byId, byCode } = await revenueByShipment(stub({ invoices }));

    expect(byId.get("S1")).toBe(6000); // borrador excluido
    expect(byId.has("S2")).toBe(false); // anulada excluida
    expect(byId.has("S4")).toBe(false); // CNY → 0
    expect(byCode.get("DTDU-1")).toBe(6000);
    expect(byCode.get("DTDU-3")).toBe(1000); // VES normalizado
    expect(byId.has("DTDU-3")).toBe(false); // no había shipment_id
  });

  it("respeta el período (issued_at/created_at fallback)", async () => {
    const invoices = [
      { shipment_id: "S1", shipment_code: null, currency: "USD", total_amount: 1000, fx_rate: null, status: "emitida", issued_at: "2026-01-15", created_at: "2026-01-15" },
      { shipment_id: "S1", shipment_code: null, currency: "USD", total_amount: 2000, fx_rate: null, status: "emitida", issued_at: "2026-05-15", created_at: "2026-05-15" },
      // issued_at null → usa created_at de fallback (dentro de rango)
      { shipment_id: "S1", shipment_code: null, currency: "USD", total_amount: 300, fx_rate: null, status: "parcial", issued_at: null, created_at: "2026-02-01" },
    ];
    const { byId } = await revenueByShipment(stub({ invoices }), {
      from: "2026-02-01",
      to: "2026-03-01",
    });
    expect(byId.get("S1")).toBe(300); // solo la de febrero
  });

  it("sin facturas → mapas vacíos", async () => {
    const { byId, byCode } = await revenueByShipment(stub({ invoices: [] }));
    expect(byId.size).toBe(0);
    expect(byCode.size).toBe(0);
  });
});

// ── listShipmentCosts ─────────────────────────────────────────
describe("listShipmentCosts", () => {
  it("coacciona numeric (string) → number y mapea por shipment_id", async () => {
    const shipment_costs = [
      { id: "c1", tenant_id: "tn", shipment_id: "S1", freight: "4200", customs: "1800", transport: "1100", handling: "580", insurance: "280", commission: "630", other: "420", notes: null, created_at: "", updated_at: "", deleted_at: null },
    ];
    const map = await listShipmentCosts(stub({ shipment_costs }));
    const c = map.get("S1");
    expect(c?.freight).toBe(4200);
    expect(typeof c?.freight).toBe("number");
    expect(c?.other).toBe(420);
  });

  it("sin filas → map vacío", async () => {
    const map = await listShipmentCosts(stub({ shipment_costs: [] }));
    expect(map.size).toBe(0);
  });
});

// ── costingRows ───────────────────────────────────────────────
describe("costingRows", () => {
  it("cruza shipments + costos + revenue (id, fallback code)", async () => {
    const shipments = [
      // S1 tiene revenue por id + costos
      { id: "S1", tenant_id: "tn", code: "DTDU-1", origin: "YIW", destination: "PBL", shipment_service: "consolidado_lcl", status: "in_transit", deleted_at: null },
      // S2 sin shipment_id en factura → revenue por code; sin costos
      { id: "S2", tenant_id: "tn", code: "DTDU-2", origin: "YIW", destination: "PBL", shipment_service: "consolidado_lcl", status: "delivered", deleted_at: null },
      // S3 borrado → excluido
      { id: "S3", tenant_id: "tn", code: "DTDU-3", origin: "SZX", destination: "LGU", shipment_service: "fcl_directo", status: "draft", deleted_at: "2026-05-01" },
    ];
    const shipment_costs = [
      { id: "c1", tenant_id: "tn", shipment_id: "S1", freight: 1000, customs: 0, transport: 0, handling: 0, insurance: 0, commission: 0, other: 0, notes: null, created_at: "", updated_at: "", deleted_at: null },
    ];
    const invoices = [
      { shipment_id: "S1", shipment_code: "DTDU-1", currency: "USD", total_amount: 5000, fx_rate: null, status: "emitida", issued_at: "2026-02-01", created_at: "2026-02-01" },
      { shipment_id: null, shipment_code: "DTDU-2", currency: "USD", total_amount: 2000, fx_rate: null, status: "pagada", issued_at: "2026-02-01", created_at: "2026-02-01" },
    ];

    const rows = await costingRows(stub({ shipments, shipment_costs, invoices }));

    expect(rows).toHaveLength(2); // S3 borrado fuera
    const s1 = rows.find((r) => r.shipment.id === "S1")!;
    expect(s1.eco.revenue).toBe(5000);
    expect(s1.eco.totalCost).toBe(1000);
    expect(s1.eco.margin).toBe(4000);

    const s2 = rows.find((r) => r.shipment.id === "S2")!;
    expect(s2.eco.revenue).toBe(2000); // resuelto por code
    expect(s2.eco.totalCost).toBe(0); // sin costos
    expect(s2.costs).toBeNull();
  });
});

// ── costingTotals (pura) ──────────────────────────────────────
function row(p: {
  id: string;
  origin?: string;
  destination?: string;
  revenue: number;
  costs?: Partial<Record<string, number>>;
}): CostingRow {
  const c = {
    freight: 0,
    customs: 0,
    transport: 0,
    handling: 0,
    insurance: 0,
    commission: 0,
    other: 0,
    ...(p.costs ?? {}),
  };
  const totalCost =
    c.freight + c.customs + c.transport + c.handling + c.insurance + c.commission + c.other;
  const margin = p.revenue - totalCost;
  const marginPct = p.revenue > 0 ? (margin / p.revenue) * 100 : 0;
  return {
    shipment: {
      id: p.id,
      origin: p.origin ?? "YIW",
      destination: p.destination ?? "PBL",
    } as CostingRow["shipment"],
    costs: null,
    eco: { ...c, revenue: p.revenue, totalCost, margin, marginPct },
  };
}

describe("costingTotals", () => {
  it("totales + profitable/losing + catTotals", () => {
    const rows = [
      row({ id: "A", revenue: 10000, costs: { freight: 4000, customs: 2000 } }), // margin +4000
      row({ id: "B", revenue: 3000, costs: { freight: 5000 } }), // margin -2000 (pérdida)
      row({ id: "C", revenue: 5000, costs: { transport: 1000, other: 500 } }), // margin +3500
    ];
    const t = costingTotals(rows);

    expect(t.revenue).toBe(18000);
    expect(t.cost).toBe(4000 + 2000 + 5000 + 1000 + 500); // 12500
    expect(t.margin).toBe(18000 - 12500);
    expect(t.profitable).toBe(2);
    expect(t.losing).toBe(1);
    expect(t.avgMarginPct).toBeCloseTo(((18000 - 12500) / 18000) * 100, 6);

    expect(t.catTotals.freight).toBe(9000); // 4000 + 5000
    expect(t.catTotals.customs).toBe(2000);
    expect(t.catTotals.transport).toBe(1000);
    expect(t.catTotals.other).toBe(500);
  });

  it("sin filas → todo en cero, avgMarginPct 0 (sin NaN)", () => {
    const t = costingTotals([]);
    expect(t.revenue).toBe(0);
    expect(t.cost).toBe(0);
    expect(t.margin).toBe(0);
    expect(t.avgMarginPct).toBe(0);
    expect(t.profitable).toBe(0);
    expect(t.losing).toBe(0);
  });
});

// ── marginByRoute (pura) ──────────────────────────────────────
describe("marginByRoute", () => {
  it("agrupa por origin→destination, deriva margen/% y ordena desc por marginPct", () => {
    const rows = [
      // Ruta YIW→PBL: 2 envíos. rev 15000, cost 9000 → margen 6000, 40%
      row({ id: "A", origin: "YIW", destination: "PBL", revenue: 10000, costs: { freight: 6000 } }),
      row({ id: "B", origin: "YIW", destination: "PBL", revenue: 5000, costs: { freight: 3000 } }),
      // Ruta SZX→LGU: 1 envío. rev 4000, cost 3800 → margen 200, 5%
      row({ id: "C", origin: "SZX", destination: "LGU", revenue: 4000, costs: { freight: 3800 } }),
    ];
    const routes = marginByRoute(rows);

    expect(routes).toHaveLength(2);
    // ordenado por marginPct desc → YIW→PBL (40%) primero
    expect(routes[0].origin).toBe("YIW");
    expect(routes[0].destination).toBe("PBL");
    expect(routes[0].count).toBe(2);
    expect(routes[0].revenue).toBe(15000);
    expect(routes[0].cost).toBe(9000);
    expect(routes[0].margin).toBe(6000);
    expect(routes[0].marginPct).toBeCloseTo(40, 6);
    expect(routes[0].tone).toBe("success"); // ≥30

    expect(routes[1].origin).toBe("SZX");
    expect(routes[1].marginPct).toBeCloseTo(5, 6);
    expect(routes[1].tone).toBe("warning"); // ≥0
  });

  it("ruta con revenue 0 → marginPct 0 (sin NaN), tone warning", () => {
    const rows = [row({ id: "Z", origin: "AAA", destination: "BBB", revenue: 0, costs: { freight: 100 } })];
    const routes = marginByRoute(rows);
    expect(routes[0].marginPct).toBe(0);
    expect(Number.isNaN(routes[0].marginPct)).toBe(false);
    expect(routes[0].margin).toBe(-100);
    expect(routes[0].tone).toBe("warning");
  });
});

// ── marginByClient (pura) · Reportes Combinados ───────────────
/** Row con client_name + volume_m3 (las vistas de cliente/CBM los necesitan). */
function crow(p: {
  id: string;
  client?: string | null;
  origin?: string;
  destination?: string;
  cbm?: number | null;
  revenue: number;
  costs?: Partial<Record<string, number>>;
}): CostingRow {
  const c = {
    freight: 0,
    customs: 0,
    transport: 0,
    handling: 0,
    insurance: 0,
    commission: 0,
    other: 0,
    ...(p.costs ?? {}),
  };
  const totalCost =
    c.freight + c.customs + c.transport + c.handling + c.insurance + c.commission + c.other;
  const margin = p.revenue - totalCost;
  const marginPct = p.revenue > 0 ? (margin / p.revenue) * 100 : 0;
  return {
    shipment: {
      id: p.id,
      client_name: p.client === undefined ? "Acme" : p.client,
      origin: p.origin ?? "YIW",
      destination: p.destination ?? "PBL",
      volume_m3: p.cbm === undefined ? 10 : p.cbm,
    } as CostingRow["shipment"],
    costs: null,
    eco: { ...c, revenue: p.revenue, totalCost, margin, marginPct },
  };
}

describe("marginByClient", () => {
  it("agrupa por client_name, agrega revenue/cost/margin, ordena desc por margen", () => {
    const rows = [
      // Globex: 2 envíos → rev 9000, cost 4000 → margen 5000
      crow({ id: "A", client: "Globex", revenue: 6000, costs: { freight: 2500 } }),
      crow({ id: "B", client: "Globex", revenue: 3000, costs: { freight: 1500 } }),
      // Acme: 1 envío → rev 12000, cost 3000 → margen 9000
      crow({ id: "C", client: "Acme", revenue: 12000, costs: { freight: 3000 } }),
    ];
    const out = marginByClient(rows);

    expect(out).toHaveLength(2);
    // ordenado desc por margen absoluto → Acme (9000) primero
    expect(out[0].client).toBe("Acme");
    expect(out[0].count).toBe(1);
    expect(out[0].revenue).toBe(12000);
    expect(out[0].cost).toBe(3000);
    expect(out[0].margin).toBe(9000);
    expect(out[0].marginPct).toBeCloseTo(75, 6);
    expect(out[0].tone).toBe("success");

    expect(out[1].client).toBe("Globex");
    expect(out[1].revenue).toBe(9000);
    expect(out[1].cost).toBe(4000);
    expect(out[1].margin).toBe(5000);
  });

  it("embarques sin cliente → 'Sin cliente asignado' agrupados", () => {
    const rows = [
      crow({ id: "A", client: null, revenue: 1000, costs: { freight: 200 } }),
      crow({ id: "B", client: "", revenue: 500, costs: { freight: 100 } }),
      crow({ id: "C", client: "   ", revenue: 300, costs: {} }),
    ];
    const out = marginByClient(rows);
    expect(out).toHaveLength(1);
    expect(out[0].client).toBe(NO_CLIENT_LABEL);
    expect(out[0].count).toBe(3);
    expect(out[0].revenue).toBe(1800);
    expect(out[0].cost).toBe(300);
    expect(out[0].margin).toBe(1500);
  });

  it("cliente con revenue 0 → marginPct 0 (sin NaN), tone warning si margen 0", () => {
    const rows = [crow({ id: "Z", client: "Zin", revenue: 0, costs: {} })];
    const out = marginByClient(rows);
    expect(out[0].marginPct).toBe(0);
    expect(Number.isNaN(out[0].marginPct)).toBe(false);
    expect(out[0].margin).toBe(0);
    expect(out[0].tone).toBe("warning"); // ≥0
  });

  it("revenue 0 con costo → margen negativo, tone danger", () => {
    const rows = [crow({ id: "Z", client: "Zin", revenue: 0, costs: { freight: 50 } })];
    const out = marginByClient(rows);
    expect(out[0].marginPct).toBe(0); // sin revenue → % no se calcula (0, no NaN)
    expect(out[0].margin).toBe(-50);
  });
});

// ── costPerCbmByRoute (pura) · Reportes Combinados ────────────
describe("costPerCbmByRoute", () => {
  it("agrupa por ruta, deriva $/CBM ingreso y costo, ordena desc por revenuePerCbm", () => {
    const rows = [
      // YIW→PBL: 2 envíos, cbm 10+5=15, rev 15000, cost 9000
      //   → costPerCbm 600, revenuePerCbm 1000, marginPerCbm 400
      crow({ id: "A", origin: "YIW", destination: "PBL", cbm: 10, revenue: 10000, costs: { freight: 6000 } }),
      crow({ id: "B", origin: "YIW", destination: "PBL", cbm: 5, revenue: 5000, costs: { freight: 3000 } }),
      // SZX→LGU: 1 envío, cbm 20, rev 4000, cost 2000
      //   → costPerCbm 100, revenuePerCbm 200, marginPerCbm 100
      crow({ id: "C", origin: "SZX", destination: "LGU", cbm: 20, revenue: 4000, costs: { freight: 2000 } }),
    ];
    const out = costPerCbmByRoute(rows);

    expect(out).toHaveLength(2);
    // ordenado desc por revenuePerCbm → YIW→PBL (1000) primero
    expect(out[0].origin).toBe("YIW");
    expect(out[0].cbm).toBe(15);
    expect(out[0].costPerCbm).toBeCloseTo(600, 6);
    expect(out[0].revenuePerCbm).toBeCloseTo(1000, 6);
    expect(out[0].marginPerCbm).toBeCloseTo(400, 6);

    expect(out[1].origin).toBe("SZX");
    expect(out[1].costPerCbm).toBeCloseTo(100, 6);
    expect(out[1].revenuePerCbm).toBeCloseTo(200, 6);
  });

  it("CBM 0 → costPerCbm/revenuePerCbm 0 (sin Infinity/NaN)", () => {
    const rows = [
      crow({ id: "A", origin: "X", destination: "Y", cbm: 0, revenue: 5000, costs: { freight: 1000 } }),
    ];
    const out = costPerCbmByRoute(rows);
    expect(out[0].cbm).toBe(0);
    expect(out[0].costPerCbm).toBe(0);
    expect(out[0].revenuePerCbm).toBe(0);
    expect(out[0].marginPerCbm).toBe(0);
    expect(Number.isFinite(out[0].costPerCbm)).toBe(true);
    expect(Number.isNaN(out[0].revenuePerCbm)).toBe(false);
  });

  it("volume_m3 null/negativo → CBM tratado como 0 (sin Infinity)", () => {
    const rows = [
      crow({ id: "A", origin: "X", destination: "Y", cbm: null, revenue: 5000, costs: { freight: 1000 } }),
      crow({ id: "B", origin: "X", destination: "Y", cbm: -3, revenue: 0, costs: {} }),
    ];
    const out = costPerCbmByRoute(rows);
    expect(out[0].cbm).toBe(0);
    expect(out[0].costPerCbm).toBe(0);
    expect(out[0].revenuePerCbm).toBe(0);
  });
});
