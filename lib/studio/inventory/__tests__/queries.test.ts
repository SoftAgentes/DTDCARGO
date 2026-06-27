/**
 * Tests de getStockByWarehouse + helpers de derivación (SDD-0081, Slice A).
 *
 * Cubre los criterios de aceptación §7:
 *  - agrupación por Shipping Mark + KPIs (marks distintos · cajas · CBM · kg),
 *  - estado derivado CN (consolidación) correcto según §6.3,
 *  - estado derivado VE (despacho) correcto según §6.4,
 *  - ocupación del próximo contenedor (Σ listo+consolidando / capacidad),
 *  - cola "listo para consolidar".
 *
 * Stub de SupabaseClient keyed por tabla (mismo patrón que naviera/loose-cargo):
 * la cadena ignora filtros (la lógica de derivación vive en el JS de las queries,
 * no en el server) y resuelve a las filas configuradas. Soporta `.maybeSingle()`.
 */

import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getStockByWarehouse,
  deriveCnStatus,
  deriveVeStatus,
  daysBetween,
} from "../queries";
import { kpisFromRows, occupancyFrom, type StockRow } from "../types";

function makeClient(tables: Record<string, unknown[]>): SupabaseClient {
  return {
    from(table: string) {
      const rows = tables[table] ?? [];
      const chain: Record<string, unknown> = {};
      const passthrough = () => chain;
      for (const m of ["eq", "is", "not", "in", "order", "select", "limit"]) {
        chain[m] = () => passthrough();
      }
      chain.maybeSingle = () =>
        Promise.resolve({ data: rows[0] ?? null, error: null });
      chain.then = (resolve: (v: Record<string, unknown>) => unknown) =>
        Promise.resolve({ data: rows, error: null }).then(resolve);
      return chain;
    },
  } as unknown as SupabaseClient;
}

// Fecha de referencia fija para que los "días en bodega" sean determinísticos.
const NOW = new Date("2026-06-26T12:00:00Z");
const daysAgo = (n: number) =>
  new Date(NOW.getTime() - n * 86_400_000).toISOString().slice(0, 10);

describe("daysBetween", () => {
  it("cuenta días enteros, nunca negativo, 0 si falta fecha", () => {
    expect(daysBetween(daysAgo(5), NOW)).toBe(5);
    expect(daysBetween(daysAgo(0), NOW)).toBe(0);
    expect(daysBetween(null, NOW)).toBe(0);
    expect(daysBetween("no-es-fecha", NOW)).toBe(0);
  });
});

describe("deriveCnStatus", () => {
  const map = new Map<string, string>([
    ["ship-consolidando", "consolidando"],
    ["ship-cerrado", "cerrado"],
    ["ship-zarpado", "zarpado"],
  ]);

  it("shipment en contenedor 'consolidando' → consolidando", () => {
    expect(
      deriveCnStatus(
        { status: "pendiente_consolidacion", shipment_id: "ship-consolidando", received_at: daysAgo(10) },
        map, 3, NOW,
      ),
    ).toBe("consolidando");
  });

  it("shipment en contenedor cerrado/zarpado → transito", () => {
    expect(
      deriveCnStatus(
        { status: "consolidado", shipment_id: "ship-cerrado", received_at: daysAgo(10) },
        map, 3, NOW,
      ),
    ).toBe("transito");
    expect(
      deriveCnStatus(
        { status: "consolidado", shipment_id: "ship-zarpado", received_at: daysAgo(10) },
        map, 3, NOW,
      ),
    ).toBe("transito");
  });

  it("pendiente sin shipment con ≥N días → listo", () => {
    expect(
      deriveCnStatus(
        { status: "pendiente_consolidacion", shipment_id: null, received_at: daysAgo(5) },
        map, 3, NOW,
      ),
    ).toBe("listo");
  });

  it("pendiente sin shipment con <N días → recibido", () => {
    expect(
      deriveCnStatus(
        { status: "pendiente_consolidacion", shipment_id: null, received_at: daysAgo(1) },
        map, 3, NOW,
      ),
    ).toBe("recibido");
  });
});

describe("deriveVeStatus", () => {
  it("en_muelle/recibiendo → transito; sellado/incidencia → aduana", () => {
    expect(deriveVeStatus("en_muelle")).toBe("transito");
    expect(deriveVeStatus("recibiendo")).toBe("transito");
    expect(deriveVeStatus("sellado")).toBe("aduana");
    expect(deriveVeStatus("con_incidencia")).toBe("aduana");
    expect(deriveVeStatus("desconocido")).toBe("transito");
  });
});

describe("kpisFromRows / occupancyFrom", () => {
  const rows: StockRow[] = [
    { id: "1", warehouse: "CN", markbox: "DTD-5532", clientName: "A", contents: "x", boxes: 5, cbm: 0.42, weightKg: 62, daysInWarehouse: 2, status: "recibido" },
    { id: "2", warehouse: "CN", markbox: "DTD-5532", clientName: "A", contents: "y", boxes: 3, cbm: 0.18, weightKg: 24, daysInWarehouse: 5, status: "listo" },
    { id: "3", warehouse: "CN", markbox: "DTD-5418", clientName: "B", contents: "z", boxes: 18, cbm: 2.1, weightKg: 340, daysInWarehouse: 6, status: "listo" },
  ];

  it("marks distintos + sumas de cajas/CBM/kg", () => {
    const k = kpisFromRows(rows);
    expect(k.marks).toBe(2); // DTD-5532 (x2) + DTD-5418
    expect(k.boxes).toBe(26);
    expect(k.cbm).toBe(2.7);
    expect(k.weightKg).toBe(426);
  });

  it("ocupación con semáforo y clamp a 100", () => {
    expect(occupancyFrom(34, 68).pct).toBe(50);
    expect(occupancyFrom(34, 68).tone).toBe("success");
    expect(occupancyFrom(45, 68).tone).toBe("warning"); // >60%
    expect(occupancyFrom(62, 68).tone).toBe("danger"); // >85%
    expect(occupancyFrom(200, 68).pct).toBe(100); // clamp
    expect(occupancyFrom(10, 0).capacityCbm).toBe(68); // fallback default
  });
});

describe("getStockByWarehouse('CN')", () => {
  it("agrupa por receipt, deriva estado, calcula KPIs + ocupación + cola", async () => {
    const client = makeClient({
      warehouse_receipts_cn: [
        // listo (pendiente, sin ship, 5 días)
        { id: "r1", client_markbox: "DTD-5418", client_name: "El Sol", supplier_name: "Ferretería", boxes: 18, total_cbm: 2.1, total_weight_kg: 340, status: "pendiente_consolidacion", shipment_id: null, received_at: daysAgo(5) },
        // recibido (pendiente, sin ship, 1 día)
        { id: "r2", client_markbox: "DTD-5610", client_name: "Méndez", supplier_name: "Repuestos", boxes: 9, total_cbm: 1.05, total_weight_kg: 180, status: "pendiente_consolidacion", shipment_id: null, received_at: daysAgo(1) },
        // consolidando (shipment en contenedor consolidando)
        { id: "r3", client_markbox: "DTD-5277", client_name: "Aurora", supplier_name: "Textil", boxes: 12, total_cbm: 0.96, total_weight_kg: 120, status: "consolidado", shipment_id: "ship-A", received_at: daysAgo(8) },
        // segunda partida del mismo mark DTD-5418 → no suma marks
        { id: "r4", client_markbox: "DTD-5418", client_name: "El Sol", supplier_name: "Cables", boxes: 2, total_cbm: 0.2, total_weight_kg: 30, status: "pendiente_consolidacion", shipment_id: null, received_at: daysAgo(4) },
      ],
      consolidations: [{ id: "c1", status: "consolidando" }],
      consolidation_items: [{ consolidation_id: "c1", shipment_id: "ship-A" }],
      container_types: [{ code: "40HC", cbm_capacity: 68 }],
    });

    const stock = await getStockByWarehouse(client, "CN", NOW);

    expect(stock.warehouse).toBe("CN");
    expect(stock.rows).toHaveLength(4);

    const byId = Object.fromEntries(stock.rows.map((r) => [r.id, r]));
    expect(byId.r1.status).toBe("listo");
    expect(byId.r2.status).toBe("recibido");
    expect(byId.r3.status).toBe("consolidando");
    expect(byId.r4.status).toBe("listo");
    expect(byId.r1.contents).toBe("Ferretería");
    expect(byId.r1.daysInWarehouse).toBe(5);

    // KPIs: marks distintos = DTD-5418, 5610, 5277 = 3
    expect(stock.kpis.marks).toBe(3);
    expect(stock.kpis.boxes).toBe(18 + 9 + 12 + 2);
    expect(stock.kpis.cbm).toBeCloseTo(2.1 + 1.05 + 0.96 + 0.2, 2);

    // Ocupación = Σ CBM listo (r1+r4) + consolidando (r3) = 2.1 + 0.2 + 0.96 = 3.26
    expect(stock.occupancy).not.toBeNull();
    expect(stock.occupancy!.usedCbm).toBeCloseTo(3.26, 2);
    expect(stock.occupancy!.capacityCbm).toBe(68);

    // Cola listo: r1 + r4 (mismo mark) → 2 filas, 1 mark distinto
    expect(stock.readyQueue).not.toBeNull();
    expect(stock.readyQueue!.rows).toBe(2);
    expect(stock.readyQueue!.marks).toBe(1);
    expect(stock.readyQueue!.cbm).toBeCloseTo(2.3, 2);
  });

  it("usa capacidad default 68 si no hay container_types '40HC'", async () => {
    const client = makeClient({
      warehouse_receipts_cn: [
        { id: "r1", client_markbox: "DTD-1", client_name: "A", supplier_name: "s", boxes: 1, total_cbm: 1, total_weight_kg: 1, status: "pendiente_consolidacion", shipment_id: null, received_at: daysAgo(5) },
      ],
      consolidations: [],
      consolidation_items: [],
      container_types: [],
    });
    const stock = await getStockByWarehouse(client, "CN", NOW);
    expect(stock.occupancy!.capacityCbm).toBe(68);
  });
});

describe("getStockByWarehouse('VE')", () => {
  it("agrupa cajas por (receipt × markbox), deriva despacho, sin ocupación", async () => {
    const client = makeClient({
      warehouse_receipts_ve: [
        { id: "wr1", receipt_code: "WR-VE-2026-0001", container_code: "MSCU-1234567", status: "sellado", eta: daysAgo(3), started_at: daysAgo(3), created_at: daysAgo(3) },
        { id: "wr2", receipt_code: "WR-VE-2026-0002", container_code: "TCLU-7654321", status: "recibiendo", eta: daysAgo(1), started_at: daysAgo(1), created_at: daysAgo(1) },
      ],
      warehouse_receipt_ve_boxes: [
        // wr1 · DTD-5044 (2 cajas)
        { id: "b1", receipt_id: "wr1", markbox: "DTD-5044", client_name: "Bazar", cbm: 1.7, weight_kg: 260 },
        { id: "b2", receipt_id: "wr1", markbox: "DTD-5044", client_name: "Bazar", cbm: 1.7, weight_kg: 260 },
        // wr1 · DTD-4980 (1 caja)
        { id: "b3", receipt_id: "wr1", markbox: "DTD-4980", client_name: "Mega", cbm: 0.74, weight_kg: 140 },
        // wr2 · DTD-5119 (1 caja)
        { id: "b4", receipt_id: "wr2", markbox: "DTD-5119", client_name: "JK", cbm: 2.8, weight_kg: 410 },
      ],
    });

    const stock = await getStockByWarehouse(client, "VE", NOW);

    expect(stock.warehouse).toBe("VE");
    expect(stock.occupancy).toBeNull();
    expect(stock.readyQueue).toBeNull();

    // 3 filas: (wr1,5044) agrega 2 cajas, (wr1,4980), (wr2,5119)
    expect(stock.rows).toHaveLength(3);
    const r5044 = stock.rows.find((r) => r.markbox === "DTD-5044")!;
    expect(r5044.boxes).toBe(2);
    expect(r5044.cbm).toBeCloseTo(3.4, 3);
    expect(r5044.weightKg).toBeCloseTo(520, 2);
    expect(r5044.status).toBe("aduana"); // wr1 sellado
    expect(r5044.contents).toBe("MSCU-1234567");

    const r5119 = stock.rows.find((r) => r.markbox === "DTD-5119")!;
    expect(r5119.status).toBe("transito"); // wr2 recibiendo

    // KPIs: 3 marks distintos, 4 cajas
    expect(stock.kpis.marks).toBe(3);
    expect(stock.kpis.boxes).toBe(4);
    expect(stock.kpis.cbm).toBeCloseTo(1.7 + 1.7 + 0.74 + 2.8, 2);
  });

  it("bodega VE vacía → rows vacío, KPIs en cero", async () => {
    const client = makeClient({ warehouse_receipts_ve: [], warehouse_receipt_ve_boxes: [] });
    const stock = await getStockByWarehouse(client, "VE", NOW);
    expect(stock.rows).toEqual([]);
    expect(stock.kpis.marks).toBe(0);
    expect(stock.kpis.boxes).toBe(0);
  });
});
