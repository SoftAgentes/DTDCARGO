/**
 * SDD-0631 · CxP ligadas en el costeo (puro). Montos inventados.
 * CA4 reparto/tasa/estado · CA5 reemplazo por categoría y una sola cuenta ·
 * CA6 margen por contenedor.
 */
import { describe, expect, it } from "vitest";
import {
  allocateLinkedBills,
  billCategory,
  effectiveCosts,
  marginByContainer,
  splitByWeight,
  type ConsolidationItemRow,
  type ConsolidationRow,
  type LinkedBillRow,
} from "../cxp-ligadas";

const bill = (over: Partial<LinkedBillRow>): LinkedBillRow => ({
  id: "B",
  shipment_id: null,
  consolidation_id: null,
  cost_category: "freight",
  currency: "USD",
  total_amount: 0,
  fx_rate: null,
  status: "pendiente",
  deleted_at: null,
  ...over,
});

const items: ConsolidationItemRow[] = [
  { consolidation_id: "C1", shipment_id: "S1", cbm: 10 },
  { consolidation_id: "C1", shipment_id: "S2", cbm: 30 },
  { consolidation_id: "C1", shipment_id: null, cbm: 5 }, // pieza sin embarque: no recibe costo
  { consolidation_id: "C2", shipment_id: "S3", cbm: 0 }, // contenedor sin CBM medido
];

describe("splitByWeight", () => {
  it("reparte en centavos y la suma es exacta", () => {
    const parts = splitByWeight(100, [1, 1, 1]);
    expect(parts).toEqual([33.33, 33.33, 33.34]);
    expect(parts.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 10);
  });
  it("sin pesos no reparte", () => {
    expect(splitByWeight(100, [0, 0])).toEqual([0, 0]);
  });
});

describe("allocateLinkedBills", () => {
  it("CxP solo de contenedor se reparte por CBM entre sus embarques", () => {
    const a = allocateLinkedBills([bill({ consolidation_id: "C1", total_amount: 4000 })], items);
    expect(a.byShipment.get("S1")?.amounts.freight).toBe(1000);
    expect(a.byShipment.get("S2")?.amounts.freight).toBe(3000);
    expect(a.cxpByContainer.get("C1")).toBe(4000);
    expect(a.unallocatedByContainer.get("C1")).toBeUndefined();
  });

  it("contenedor sin CBM: el costo queda sin repartir en el contenedor", () => {
    const a = allocateLinkedBills([bill({ consolidation_id: "C2", total_amount: 700 })], items);
    expect(a.byShipment.size).toBe(0);
    expect(a.unallocatedByContainer.get("C2")).toBe(700);
  });

  it("CxP con embarque y contenedor va entera al embarque, una sola vez", () => {
    const a = allocateLinkedBills(
      [bill({ consolidation_id: "C1", shipment_id: "S1", total_amount: 500, cost_category: "handling" })],
      items,
    );
    expect(a.byShipment.get("S1")?.amounts).toEqual({ handling: 500 });
    expect(a.byShipment.get("S2")).toBeUndefined();
    expect(a.unallocatedByContainer.size).toBe(0);
    expect(a.cxpByContainer.get("C1")).toBe(500);
  });

  it("convierte a USD con la tasa de la CxP (VES)", () => {
    const a = allocateLinkedBills(
      [bill({ shipment_id: "S1", currency: "VES", total_amount: 3650, fx_rate: 36.5 })],
      items,
    );
    expect(a.byShipment.get("S1")?.total).toBe(100);
  });

  it("sin tasa no suma: se cuenta en el embarque y en el contenedor", () => {
    const a = allocateLinkedBills(
      [
        bill({ shipment_id: "S1", currency: "CNY", total_amount: 700, fx_rate: null }),
        bill({ consolidation_id: "C1", currency: "VES", total_amount: 100, fx_rate: null }),
      ],
      items,
    );
    expect(a.byShipment.get("S1")).toMatchObject({ total: 0, sinTasa: 2, amounts: {} });
    expect(a.byShipment.get("S2")).toMatchObject({ total: 0, sinTasa: 1 });
    expect(a.sinTasaByContainer.get("C1")).toBe(1);
  });

  it("excluye anuladas, borradas y las que no tienen vínculo", () => {
    const a = allocateLinkedBills(
      [
        bill({ shipment_id: "S1", total_amount: 10, status: "anulada" }),
        bill({ shipment_id: "S1", total_amount: 10, deleted_at: "2026-11-01T00:00:00Z" }),
        bill({ total_amount: 10 }),
      ],
      items,
    );
    expect(a.byShipment.size).toBe(0);
  });

  it("cuenta lo causado, no lo pagado: el estado pagada o parcial no cambia el costo", () => {
    const a = allocateLinkedBills(
      [bill({ shipment_id: "S1", total_amount: 250, status: "pagada" }), bill({ shipment_id: "S1", total_amount: 50, status: "parcial" })],
      items,
    );
    expect(a.byShipment.get("S1")?.total).toBe(300);
  });

  it("categoría legada o inválida va a Otros", () => {
    expect(billCategory(null)).toBe("other");
    expect(billCategory("espacio")).toBe("other");
    expect(billCategory("customs")).toBe("customs");
  });
});

describe("effectiveCosts", () => {
  const manual = { freight: 900, customs: 200, transport: 50, handling: 0, insurance: 0, commission: 0, other: 10 };

  it("la CxP reemplaza la categoría que cubre; las demás quedan como a mano", () => {
    const c = effectiveCosts(manual, { amounts: { freight: 1000 }, total: 1000, bills: 1, sinTasa: 0 });
    expect(c.freight).toBe(1000); // no 1900: sin doble conteo
    expect(c.customs).toBe(200);
    expect(c.other).toBe(10);
  });

  it("sin CxP es exactamente shipment_costs; sin nada, ceros", () => {
    expect(effectiveCosts(manual, undefined)).toEqual(manual);
    expect(effectiveCosts(null, undefined).freight).toBe(0);
  });
});

describe("marginByContainer", () => {
  const cons: ConsolidationRow[] = [
    { id: "C1", ref: "DTD-CONSOL-0001", status: "zarpado", container_type: "40HC", deleted_at: null },
    { id: "C2", ref: "DTD-CONSOL-0002", status: "consolidando", container_type: null, deleted_at: null },
    { id: "C9", ref: "DTD-CONSOL-0009", status: "cerrado", container_type: null, deleted_at: "2026-11-01" },
  ];
  const rows = [
    { shipmentId: "S1", revenue: 2000, totalCost: 1000, sinTasa: 0 },
    { shipmentId: "S2", revenue: 5000, totalCost: 3000, sinTasa: 0 },
    { shipmentId: "S3", revenue: 800, totalCost: 0, sinTasa: 0 },
  ];

  it("suma revenue y costo de sus embarques más lo sin repartir; omite borrados", () => {
    const out = marginByContainer(rows, cons, items, {
      unallocatedByContainer: new Map([["C2", 700]]),
      cxpByContainer: new Map([["C1", 4000], ["C2", 700]]),
      sinTasaByContainer: new Map(),
    });
    expect(out.map((c) => c.id)).toEqual(["C2", "C1"]);
    const c1 = out.find((c) => c.id === "C1")!;
    expect(c1).toMatchObject({ shipments: 2, cbm: 45, revenue: 7000, cost: 4000, margin: 3000, cxpCost: 4000 });
    const c2 = out.find((c) => c.id === "C2")!;
    expect(c2).toMatchObject({ shipments: 1, revenue: 800, cost: 700, unallocated: 700, margin: 100 });
  });

  it("un embarque repartido en dos contenedores aporta su fracción de CBM", () => {
    const split: ConsolidationItemRow[] = [
      { consolidation_id: "C1", shipment_id: "S1", cbm: 3 },
      { consolidation_id: "C2", shipment_id: "S1", cbm: 1 },
    ];
    const out = marginByContainer([rows[0]], cons, split, {
      unallocatedByContainer: new Map(),
      cxpByContainer: new Map(),
      sinTasaByContainer: new Map(),
    });
    expect(out.find((c) => c.id === "C1")).toMatchObject({ revenue: 1500, cost: 750 });
    expect(out.find((c) => c.id === "C2")).toMatchObject({ revenue: 500, cost: 250 });
  });

  it("embarque sin tasa marca el contenedor y lo manda al final", () => {
    const out = marginByContainer(
      [{ ...rows[0], sinTasa: 1 }, rows[1]],
      cons,
      items,
      { unallocatedByContainer: new Map(), cxpByContainer: new Map(), sinTasaByContainer: new Map() },
    );
    expect(out.at(-1)).toMatchObject({ id: "C1", sinTasa: 1 });
  });
});
