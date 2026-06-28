/**
 * SDD-0013 · Tests del reduce PURO pickLatestPerShipment (tracking real
 * del ERP móvil). Dada una lista de eventos ORDENADA por occurred_at desc,
 * debe quedarse con el más reciente por shipment.
 */
import { describe, it, expect } from "vitest";
import { pickLatestPerShipment } from "../shipment-queries";
import type { ShipmentStatus } from "../shipment-types";

function ev(shipment_id: string, status: ShipmentStatus, occurred_at: string) {
  return { shipment_id, status, occurred_at };
}

describe("pickLatestPerShipment", () => {
  it("lista vacía → mapa vacío", () => {
    expect(pickLatestPerShipment([]).size).toBe(0);
  });

  it("se queda con el primero que aparece por shipment (input desc = el más reciente)", () => {
    const rows = [
      ev("s1", "in_transit", "2026-06-10T10:00:00Z"), // más reciente de s1
      ev("s1", "shipped", "2026-06-05T10:00:00Z"),
      ev("s1", "in_warehouse", "2026-06-01T10:00:00Z"),
    ];
    const m = pickLatestPerShipment(rows);
    expect(m.size).toBe(1);
    expect(m.get("s1")).toEqual({
      status: "in_transit",
      occurred_at: "2026-06-10T10:00:00Z",
    });
  });

  it("separa varios shipments y conserva el último de cada uno", () => {
    const rows = [
      ev("s1", "in_customs", "2026-06-12T00:00:00Z"),
      ev("s2", "delivered", "2026-06-11T00:00:00Z"),
      ev("s1", "in_transit", "2026-06-08T00:00:00Z"),
      ev("s2", "out_for_delivery", "2026-06-09T00:00:00Z"),
    ];
    const m = pickLatestPerShipment(rows);
    expect(m.size).toBe(2);
    expect(m.get("s1")?.status).toBe("in_customs");
    expect(m.get("s2")?.status).toBe("delivered");
  });

  it("no inventa shipments que no están en el input", () => {
    const m = pickLatestPerShipment([ev("s1", "shipped", "2026-06-01T00:00:00Z")]);
    expect(m.has("s2")).toBe(false);
  });
});
