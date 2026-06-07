/**
 * Tests de la lógica nueva de Costing & Margen (SDD-0053 · Slice C).
 *
 * Cubre Acceptance §5 Slice C:
 *  - Forecast math: buildForecast / estimateQuoteCost (bucketing aceptada/enviada,
 *    costo desde template que matchea vs estimación %, totales + orden).
 *  - Export CSV: csvCell (escape), costingCsvRow, buildCostingCsv (header + filas).
 *  - Auto-prefill: prefillShipmentCostsFromTemplate aplica matchTemplate, respeta
 *    el unique (ignoreDuplicates), no lanza ante errores (best-effort).
 */

import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildCostingCsv,
  buildForecast,
  costingCsvRow,
  COSTING_CSV_HEADERS,
  csvCell,
  DEFAULT_FORECAST_MARGIN_PCT,
  estimateQuoteCost,
} from "../ui";
import { prefillShipmentCostsFromTemplate } from "../queries";
import { shipmentEconomics } from "../types";
import type { CostingRow } from "../queries";
import type { RouteCostTemplate } from "../types";
import type { Quote, QuoteStatus } from "@/lib/studio/quote-types";
import type { ShipmentService } from "@/lib/studio/shipment-types";

// ── Builders ──────────────────────────────────────────────────
function tpl(over: Partial<RouteCostTemplate> = {}): RouteCostTemplate {
  return {
    id: "t1",
    tenant_id: "tn",
    name: "YIW → PBL · LCL",
    origin: "YIW",
    destination: "PBL",
    shipment_service: "consolidacion",
    freight: 4000,
    customs: 2000,
    transport: 1000,
    handling: 500,
    insurance: 300,
    commission: 200,
    other: 0,
    active: true,
    notes: null,
    created_at: "",
    updated_at: "",
    deleted_at: null,
    ...over,
  };
}

function quote(over: Partial<Quote> = {}): Quote {
  return {
    id: "q1",
    tenant_id: "tn",
    quote_code: "DTD-Q-0001",
    client_markbox: "DTD-0001",
    client_name: "Cliente",
    service: "consolidacion" as ShipmentService,
    origin: "YIW",
    destination: "PBL",
    cbm: 10,
    weight_kg: null,
    boxes: null,
    packaging: "carton",
    rate_per_cbm: null,
    flat_rate: null,
    rate_used_id: null,
    subtotal_usd: 0,
    packaging_cost: 0,
    total_usd: 10000,
    status: "accepted" as QuoteStatus,
    valid_until: "2026-12-31",
    sent_at: null,
    accepted_at: null,
    converted_to_shipment_id: null,
    notes: null,
    prospect_name: null,
    prospect_email: null,
    prospect_whatsapp: null,
    nota: null,
    source: "studio",
    created_at: "2026-06-01",
    updated_at: "2026-06-01",
    deleted_at: null,
    ...over,
  };
}

// ── estimateQuoteCost ─────────────────────────────────────────
describe("estimateQuoteCost", () => {
  it("usa el costo del template que matchea (suma de las 7 categorías)", () => {
    const q = quote({ total_usd: 10000 });
    const r = estimateQuoteCost(q, [tpl()]);
    expect(r.fromTemplate).toBe(true);
    expect(r.templateName).toBe("YIW → PBL · LCL");
    // 4000+2000+1000+500+300+200+0
    expect(r.cost).toBe(8000);
  });

  it("sin template → estima costo = revenue × (1 − margen default)", () => {
    const q = quote({ total_usd: 10000, destination: "ZZZ" });
    const r = estimateQuoteCost(q, [tpl()]);
    expect(r.fromTemplate).toBe(false);
    expect(r.templateName).toBeNull();
    expect(r.cost).toBeCloseTo(10000 * (1 - DEFAULT_FORECAST_MARGIN_PCT / 100), 6); // 7800
  });

  it("ignora templates inactivos o borrados (no matchea)", () => {
    const q = quote();
    const inactive = estimateQuoteCost(q, [tpl({ active: false })]);
    expect(inactive.fromTemplate).toBe(false);
    const deleted = estimateQuoteCost(q, [tpl({ deleted_at: "2026-05-01" })]);
    expect(deleted.fromTemplate).toBe(false);
  });
});

// ── buildForecast ─────────────────────────────────────────────
describe("buildForecast", () => {
  it("bucketea aceptadas (no convertidas) y enviadas; excluye el resto", () => {
    const quotes = [
      quote({ id: "A", status: "accepted", converted_to_shipment_id: null }),
      quote({ id: "B", status: "sent" }),
      // aceptada YA convertida → fuera del pipeline
      quote({ id: "C", status: "accepted", converted_to_shipment_id: "SHIP-1" }),
      quote({ id: "D", status: "draft" }),
      quote({ id: "E", status: "rejected" }),
      quote({ id: "F", status: "expired" }),
    ];
    const { rows, totals } = buildForecast(quotes, []);
    const ids = rows.map((r) => r.quote.id);
    expect(ids).toContain("A");
    expect(ids).toContain("B");
    expect(ids).not.toContain("C");
    expect(ids).not.toContain("D");
    expect(ids).not.toContain("E");
    expect(ids).not.toContain("F");
    expect(totals.acceptedCount).toBe(1);
    expect(totals.pendingCount).toBe(1);
  });

  it("ordena aceptadas primero, luego por revenue desc", () => {
    const quotes = [
      quote({ id: "sent-big", status: "sent", total_usd: 99999 }),
      quote({ id: "acc-small", status: "accepted", total_usd: 100 }),
      quote({ id: "acc-big", status: "accepted", total_usd: 5000 }),
    ];
    const { rows } = buildForecast(quotes, []);
    expect(rows.map((r) => r.quote.id)).toEqual(["acc-big", "acc-small", "sent-big"]);
  });

  it("totaliza revenue/costo/margen proyectados (template + estimación)", () => {
    const quotes = [
      // matchea template → costo 8000, margen 2000
      quote({ id: "A", status: "accepted", total_usd: 10000 }),
      // sin match → costo 5000×0.78=3900, margen 1100
      quote({ id: "B", status: "sent", total_usd: 5000, destination: "ZZZ" }),
    ];
    const { totals } = buildForecast(quotes, [tpl()]);
    expect(totals.revenue).toBe(15000);
    expect(totals.cost).toBeCloseTo(8000 + 3900, 6);
    expect(totals.margin).toBeCloseTo(15000 - (8000 + 3900), 6);
    expect(totals.marginPct).toBeCloseTo((totals.margin / 15000) * 100, 6);
  });

  it("revenue 0 → marginPct 0 (sin NaN/Infinity)", () => {
    const { totals } = buildForecast([quote({ total_usd: 0 })], []);
    expect(totals.revenue).toBe(0);
    expect(totals.marginPct).toBe(0);
    expect(Number.isFinite(totals.marginPct)).toBe(true);
  });

  it("sin cotizaciones en pipeline → forecast vacío", () => {
    const { rows, totals } = buildForecast([], [tpl()]);
    expect(rows).toHaveLength(0);
    expect(totals.revenue).toBe(0);
    expect(totals.margin).toBe(0);
  });

  it("marca fromTemplate por fila según haya match o no", () => {
    const quotes = [
      quote({ id: "match", status: "accepted" }),
      quote({ id: "nomatch", status: "sent", destination: "ZZZ" }),
    ];
    const { rows } = buildForecast(quotes, [tpl()]);
    const byId = Object.fromEntries(rows.map((r) => [r.quote.id, r]));
    expect(byId.match.fromTemplate).toBe(true);
    expect(byId.nomatch.fromTemplate).toBe(false);
  });
});

// ── Export CSV ────────────────────────────────────────────────
function costingRow(over: {
  code?: string;
  client_name?: string | null;
  origin?: string | null;
  destination?: string | null;
  service?: ShipmentService;
  revenue: number;
  costs?: Partial<Record<string, number>>;
}): CostingRow {
  const eco = shipmentEconomics({
    revenueUsd: over.revenue,
    costs: over.costs ?? {},
  });
  return {
    shipment: {
      id: "S1",
      code: over.code ?? "DTDU-1",
      client_name: "client_name" in over ? over.client_name : "Cliente",
      origin: over.origin ?? "YIW",
      destination: over.destination ?? "PBL",
      shipment_service: over.service ?? "consolidacion",
    } as CostingRow["shipment"],
    costs: null,
    eco,
  };
}

describe("csvCell", () => {
  it("escapa comas, comillas y saltos de línea", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('he said "hi"')).toBe('"he said ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(1234.5)).toBe("1234.5");
  });
});

describe("costingCsvRow", () => {
  it("emite codigo, cliente, ruta, servicio, revenue, 7 costos, total, margen, %", () => {
    const row = costingRow({
      code: "DTDU-9",
      client_name: "ACME",
      origin: "YIW",
      destination: "PBL",
      revenue: 10000,
      costs: { freight: 4000, customs: 2000 },
    });
    const cells = costingCsvRow(row);
    expect(cells[0]).toBe("DTDU-9");
    expect(cells[1]).toBe("ACME");
    expect(cells[2]).toBe("YIW");
    expect(cells[3]).toBe("PBL");
    expect(cells[4]).toBe("consolidacion");
    expect(cells[5]).toBe(10000); // revenue
    expect(cells[6]).toBe(4000); // freight
    expect(cells[7]).toBe(2000); // customs
    expect(cells[13]).toBe(6000); // total cost
    expect(cells[14]).toBe(4000); // margin
    expect(cells[15]).toBe(40); // margin %
  });

  it("cliente null → celda vacía (no rompe)", () => {
    const row = costingRow({ client_name: null, revenue: 1000 });
    expect(costingCsvRow(row)[1]).toBe("");
  });
});

describe("buildCostingCsv", () => {
  it("primera línea = headers; una línea por fila; CRLF", () => {
    const rows = [
      costingRow({ code: "A", revenue: 1000, costs: { freight: 500 } }),
      costingRow({ code: "B", revenue: 2000, costs: { customs: 100 } }),
    ];
    const csv = buildCostingCsv(rows);
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(3); // header + 2 filas
    expect(lines[0]).toBe(COSTING_CSV_HEADERS.join(","));
    expect(lines[1].startsWith("A,")).toBe(true);
    expect(lines[2].startsWith("B,")).toBe(true);
  });

  it("escapa un cliente con coma en el nombre", () => {
    const csv = buildCostingCsv([
      costingRow({ client_name: "ACME, C.A.", revenue: 1000 }),
    ]);
    expect(csv).toContain('"ACME, C.A."');
  });

  it("sin filas → solo el header", () => {
    const csv = buildCostingCsv([]);
    expect(csv).toBe(COSTING_CSV_HEADERS.join(","));
  });
});

// ── Auto-prefill ──────────────────────────────────────────────
/** Stub Supabase: route_cost_templates devuelve `templates`; captura el upsert. */
function prefillStub(
  templates: Record<string, unknown>[],
  opts: { upsertError?: boolean } = {},
): { client: SupabaseClient; captured: { row?: unknown; options?: unknown } } {
  const captured: { row?: unknown; options?: unknown } = {};
  const client = {
    from(table: string) {
      if (table === "route_cost_templates") {
        const chain: Record<string, unknown> = {
          select: () => chain,
          order: () => chain,
          limit: () => chain,
          then: (resolve: (v: { data: unknown; error: null }) => unknown) =>
            Promise.resolve({ data: templates, error: null }).then(resolve),
        };
        return chain;
      }
      if (table === "shipment_costs") {
        return {
          upsert: (row: unknown, options: unknown) => {
            captured.row = row;
            captured.options = options;
            return Promise.resolve({
              error: opts.upsertError ? { message: "boom" } : null,
            });
          },
        };
      }
      throw new Error(`tabla inesperada: ${table}`);
    },
  } as unknown as SupabaseClient;
  return { client, captured };
}

describe("prefillShipmentCostsFromTemplate", () => {
  it("matchea el template y arma el upsert con sus 7 montos + ignoreDuplicates", async () => {
    const { client, captured } = prefillStub([tpl() as unknown as Record<string, unknown>]);
    const res = await prefillShipmentCostsFromTemplate(client, "tn", {
      id: "SHIP-1",
      origin: "YIW",
      destination: "PBL",
      shipment_service: "consolidacion",
    });
    expect(res).toEqual({ prefilled: true, templateId: "t1" });
    const row = captured.row as Record<string, unknown>;
    expect(row.tenant_id).toBe("tn");
    expect(row.shipment_id).toBe("SHIP-1");
    expect(row.freight).toBe(4000);
    expect(row.customs).toBe(2000);
    expect(captured.options).toMatchObject({
      onConflict: "tenant_id,shipment_id",
      ignoreDuplicates: true,
    });
  });

  it("sin template que matchee → no inserta, devuelve no-template", async () => {
    const { client, captured } = prefillStub([tpl() as unknown as Record<string, unknown>]);
    const res = await prefillShipmentCostsFromTemplate(client, "tn", {
      id: "SHIP-2",
      origin: "ZZZ",
      destination: "QQQ",
      shipment_service: "consolidacion",
    });
    expect(res).toEqual({ prefilled: false, reason: "no-template" });
    expect(captured.row).toBeUndefined();
  });

  it("error en el upsert → best-effort, devuelve error sin lanzar", async () => {
    const { client } = prefillStub([tpl() as unknown as Record<string, unknown>], {
      upsertError: true,
    });
    const res = await prefillShipmentCostsFromTemplate(client, "tn", {
      id: "SHIP-3",
      origin: "YIW",
      destination: "PBL",
      shipment_service: "consolidacion",
    });
    expect(res).toEqual({ prefilled: false, reason: "error" });
  });

  it("templates inactivos/borrados no matchean (no prellena)", async () => {
    const { client } = prefillStub([
      tpl({ active: false }) as unknown as Record<string, unknown>,
    ]);
    const res = await prefillShipmentCostsFromTemplate(client, "tn", {
      id: "SHIP-4",
      origin: "YIW",
      destination: "PBL",
      shipment_service: "consolidacion",
    });
    expect(res).toEqual({ prefilled: false, reason: "no-template" });
  });
});
