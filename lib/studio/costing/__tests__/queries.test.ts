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
import { costingCsvRow, COSTING_CSV_HEADERS } from "../ui";
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

/** Tope por request del doble: el `db-max-rows` de Supabase. */
const SERVER_CAP = 1000;

// ── Stub de SupabaseClient ────────────────────────────────────
function stub(
  rowsByTable: Record<string, Record<string, unknown>[]>,
  options: { serverCap?: number; errorTable?: string } = {},
): SupabaseClient {
  return {
    from(table: string) {
      // `is(col, null)` se APLICA sobre las filas, como PostgREST (SDD-0465):
      // si un lector deja de pedir `deleted_at is null`, la fila borrada del
      // fixture entra al resultado y la aserción lo delata.
      let rows = rowsByTable[table] ?? [];
      const chain: Record<string, unknown> = {
        select() {
          return chain;
        },
        is(col: string, val: unknown) {
          if (val === null) rows = rows.filter((r) => r[col] == null);
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
        // Terminal paginado: corta en SERVER_CAP por request igual que
        // PostgREST. Un doble más generoso que el servidor deja pasar código
        // que trunca en producción.
        range(desde: number, hasta: number) {
          if (options.errorTable === table) return Promise.resolve({ data: null, error: { message: "lectura interrumpida" } });
          const pedido = hasta - desde + 1;
          const trozo = rows.slice(desde, desde + Math.min(pedido, options.serverCap ?? SERVER_CAP));
          return Promise.resolve({ data: trozo, error: null });
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
      // SDD-0572 (decisión 1 de Sam; el Director, 2026-10-20): sin tasa no se convierte, null; nunca 0. CNY sin tasa → no suma; se cuenta en sinTasa.
      { shipment_id: "S4", shipment_code: "DTDU-4", currency: "CNY", total_amount: 7000, fx_rate: null, status: "emitida", issued_at: "2026-02-01", created_at: "2026-02-01" },
    ];
    const { byId, byCode, sinTasaById, sinTasaByCode } = await revenueByShipment(stub({ invoices }));

    expect(byId.get("S1")).toBe(6000); // borrador excluido
    expect(byId.has("S2")).toBe(false); // anulada excluida
    expect(byId.has("S4")).toBe(false); // CNY sin tasa no suma
    expect(sinTasaById?.get("S4")).toBe(1);
    expect(sinTasaByCode?.get("DTDU-4")).toBe(1);
    expect(sinTasaById?.has("S1")).toBe(false);
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

  it("SDD-0465 · una factura BORRADA no es ingreso del embarque", async () => {
    const invoices = [
      // viva → cuenta
      { shipment_id: "S1", shipment_code: "DTDU-1", currency: "USD", total_amount: 5000, fx_rate: null, status: "emitida", issued_at: "2026-02-01", created_at: "2026-02-01", deleted_at: null },
      // emitida y del mismo embarque, pero con deleted_at → NO cuenta
      { shipment_id: "S1", shipment_code: "DTDU-1", currency: "USD", total_amount: 7000, fx_rate: null, status: "emitida", issued_at: "2026-02-02", created_at: "2026-02-02", deleted_at: "2026-03-01T00:00:00Z" },
      // borrada y única de su embarque → el embarque queda sin ingreso
      { shipment_id: "S9", shipment_code: "DTDU-9", currency: "USD", total_amount: 900, fx_rate: null, status: "pagada", issued_at: "2026-02-01", created_at: "2026-02-01", deleted_at: "2026-03-01T00:00:00Z" },
    ];
    const { byId, byCode } = await revenueByShipment(stub({ invoices }));

    expect(byId.get("S1")).toBe(5000);
    expect(byCode.get("DTDU-1")).toBe(5000);
    expect(byId.has("S9")).toBe(false);
    expect(byCode.has("DTDU-9")).toBe(false);
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
  it.each(["DTDU-1", null])("0572 revisión · combina FK con code %s y otra factura solo-code en páginas distintas", async (codeForFk) => {
    const shipments = [{ id: "S1", code: "DTDU-1", origin: "CN", destination: "VE", deleted_at: null }];
    const base = { status: "emitida", issued_at: "2026-02-01", fx_rate: null, deleted_at: null };
    const invoices = [
      { ...base, id: "i-known", shipment_id: "S1", shipment_code: "DTDU-1", currency: "USD", total_amount: 100 },
      { ...base, id: "i-fk", shipment_id: "S1", shipment_code: codeForFk, currency: "CNY", total_amount: 700 },
      { ...base, id: "i-code", shipment_id: null, shipment_code: "DTDU-1", currency: "VES", total_amount: 3600 },
    ];
    const rows = await costingRows(stub({ shipments, invoices }, { serverCap: 1 }));
    expect(rows).toHaveLength(1);
    expect(rows[0].eco.revenue).toBe(100); // no cambia la selección histórica del subtotal
    expect.soft(rows[0].facturasSinTasa).toBe(2); // i-fk cuenta una vez, i-code es otra factura
    const csv = Object.fromEntries(COSTING_CSV_HEADERS.map((header, index) => [header, costingCsvRow(rows[0])[index]]));
    expect(csv).toMatchObject({ "Facturas sin tasa": 2, "Margen USD": "", "Margen %": "", "Estado de conversión": "Subtotal parcial" });
  });

  it("0572 revisión · el code no reasigna una factura cuyo FK pertenece a otro embarque", async () => {
    const shipments = [
      { id: "S1", code: "DTDU-1", deleted_at: null },
      { id: "S2", code: "DTDU-2", deleted_at: null },
    ];
    const invoices = [{ id: "i-owner", shipment_id: "S2", shipment_code: "DTDU-1", currency: "CNY", total_amount: 700, fx_rate: null, status: "emitida", issued_at: "2026-02-01" }];
    const rows = await costingRows(stub({ shipments, invoices }, { serverCap: 1 }));
    expect(rows.find((r) => r.shipment.id === "S1")?.facturasSinTasa).toBe(0);
    expect(rows.find((r) => r.shipment.id === "S2")?.facturasSinTasa).toBe(1);
  });

  it.each(["S1", null])("0572 · segunda página por id %s o code: contador sin duplicar", async (shipmentId) => {
    const shipments = [{ id: "S1", code: "DTDU-1", origin: "YIW", destination: "PBL", deleted_at: null }];
    const base = { shipment_id: shipmentId, shipment_code: "DTDU-1", status: "emitida", issued_at: "2026-02-01", fx_rate: null, deleted_at: null };
    const invoices = [
      { ...base, id: "i1", currency: "USD", total_amount: 100 },
      { ...base, id: "i2", currency: "CNY", total_amount: 700 },
    ];
    const rows = await costingRows(stub({ shipments, invoices }, { serverCap: 1 }));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ eco: { revenue: 100 }, facturasSinTasa: 1 });
    expect(costingTotals(rows)).toMatchObject({ revenue: 100, sinTasa: 1, profitable: 0, losing: 0 });
    expect(marginByRoute(rows)[0]).toMatchObject({ revenue: 100, sinTasa: 1 });
  });

  it.each(["shipment_costs", "invoices", "shipments"])("0572 · rechaza lectura truncada de %s", async (table) => {
    // 60 páginas no vacías alcanzan el límite real de fetchAllPaged. El tope
    // del doble es uno: no reemplaza el lector ni fabrica complete=false.
    const many = Array.from({ length: 61 }, (_, n) => ({ id: String(n), deleted_at: null }));
    await expect(costingRows(stub({ [table]: many }, { serverCap: 1 }))).rejects.toThrow(/tope/i);
  });

  it("0572 · error de lectura rechaza, no devuelve cero ni solo un aviso de tasa", async () => {
    await expect(costingRows(stub({}, { errorTable: "invoices" }))).rejects.toThrow("lectura interrumpida");
  });
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

describe("0572 · completitud de totales y rutas", () => {
  it("una ruta parcial conserva costos/subtotal y cuenta embarques incompletos", () => {
    const partial = { ...row({ id: "P", origin: "CN", destination: "VE", revenue: 100, costs: { freight: 10 } }), facturasSinTasa: 2 };
    const complete = row({ id: "A", origin: "CN", destination: "VE", revenue: 50, costs: { freight: 5 } });
    const other = row({ id: "B", origin: "CN", destination: "US", revenue: 10, costs: { freight: 20 } });
    expect(costingTotals([partial, complete, other])).toMatchObject({ revenue: 160, cost: 35, sinTasa: 1, profitable: 1, losing: 1 });
    const routes = marginByRoute([partial, complete, other]);
    expect(routes.map((r) => r.destination)).toEqual(["US", "VE"]);
    expect(routes[0]).toMatchObject({ sinTasa: 0 });
    expect(routes[1]).toMatchObject({ revenue: 150, cost: 15, count: 2, sinTasa: 1 });
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
  it("0572 revisión · propaga incompletitud al cliente, conserva costos y ordena completos primero", () => {
    const partial = { ...crow({ id: "P", client: "Parcial", revenue: 100, costs: { freight: 10 } }), facturasSinTasa: 2 };
    const complete = crow({ id: "C", client: "Completo", revenue: 20, costs: { freight: 30 } });
    const out = marginByClient([partial, complete]);
    expect(out.map((r) => r.client)).toEqual(["Completo", "Parcial"]);
    expect(out[1]).toMatchObject({ revenue: 100, cost: 10, sinTasa: 1 });
    expect(out[0]).toMatchObject({ revenue: 20, cost: 30, sinTasa: 0 });
  });
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
  it("0572 revisión · costo/CBM sigue conocido aunque falte conversión del ingreso", () => {
    const row = { ...crow({ id: "P", revenue: 100, cbm: 10, costs: { freight: 20 } }), facturasSinTasa: 2 };
    expect(costPerCbmByRoute([row])[0]).toMatchObject({ revenue: 100, cost: 20, cbm: 10, costPerCbm: 2, sinTasa: 1 });
  });
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
