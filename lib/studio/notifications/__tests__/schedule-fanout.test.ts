/**
 * SDD-0156 · Slice D — fan-out de eventos de máquinas paralelas: una
 * consolidación / recibo agrupa N envíos; cada uno recibe su aviso.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const scheduleMock = vi.fn((..._a: unknown[]) =>
  Promise.resolve({ scheduled: 1, skipped: 0 }),
);
vi.mock("../schedule-client-notifications", () => ({
  scheduleClientNotifications: (...a: unknown[]) => scheduleMock(...a),
}));

import {
  scheduleConsolidationEvent,
  scheduleReceiptVeReceived,
  scheduleReceiptInWarehouse,
} from "../schedule-fanout";

/**
 * Admin mock: cada `from(table)` devuelve un builder-proxy thenable que, al
 * await-earse, resuelve `{ data: dataByTable[table] }`. Los métodos de cadena
 * (select/eq/in/not/order/limit/maybeSingle) devuelven el mismo builder.
 */
function makeAdmin(dataByTable: Record<string, unknown>) {
  function from(table: string) {
    const result = { data: dataByTable[table] ?? null, error: null };
    const builder: unknown = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === "then") {
            return (res: (v: unknown) => unknown) =>
              Promise.resolve(result).then(res);
          }
          return () => builder;
        },
      },
    );
    return builder;
  }
  return { from } as never;
}

beforeEach(() => scheduleMock.mockClear());

describe("scheduleConsolidationEvent", () => {
  it("programa el evento para cada envío de la consolidación", async () => {
    const admin = makeAdmin({
      consolidation_items: [
        { shipment_id: "s-1", client_markbox: "DTD-1", client_name: "Ana" },
        { shipment_id: "s-2", client_markbox: "DTD-2", client_name: "Beto" },
      ],
      shipments: [
        { id: "s-1", code: "ENV-1", client_markbox: "DTD-1", client_name: "Ana" },
        { id: "s-2", code: "ENV-2", client_markbox: "DTD-2", client_name: "Beto" },
      ],
    });
    const n = await scheduleConsolidationEvent(admin, "t-1", "con-1", "consolidated");
    expect(n).toBe(2);
    expect(scheduleMock).toHaveBeenCalledTimes(2);
    expect(scheduleMock.mock.calls[0][2]).toMatchObject({
      shipmentId: "s-1",
      shipmentCode: "ENV-1",
      event: "consolidated",
    });
  });

  it("consolidación sin items → 0, no llama al scheduler", async () => {
    const admin = makeAdmin({ consolidation_items: [] });
    const n = await scheduleConsolidationEvent(admin, "t-1", "con-x", "eta_set");
    expect(n).toBe(0);
    expect(scheduleMock).not.toHaveBeenCalled();
  });
});

describe("scheduleReceiptVeReceived", () => {
  it("resuelve envío por Shipping Mark y programa received_ve (deduplica marks)", async () => {
    const admin = makeAdmin({
      shipments: {
        id: "s-9",
        code: "ENV-9",
        client_markbox: "DTD-9",
        client_name: "Caro",
      },
    });
    const n = await scheduleReceiptVeReceived(admin, "t-1", [
      "DTD-9",
      "DTD-9",
      "  ",
      null,
    ]);
    expect(n).toBe(1); // sólo un Shipping Mark único con envío resoluble
    expect(scheduleMock).toHaveBeenCalledTimes(1);
    expect(scheduleMock.mock.calls[0][2]).toMatchObject({
      shipmentId: "s-9",
      event: "received_ve",
    });
  });

  it("Shipping Mark sin envío en curso → no programa (no mal-notifica)", async () => {
    const admin = makeAdmin({ shipments: null });
    const n = await scheduleReceiptVeReceived(admin, "t-1", ["DTD-404"]);
    expect(n).toBe(0);
    expect(scheduleMock).not.toHaveBeenCalled();
  });
});

describe("scheduleReceiptInWarehouse", () => {
  it("resuelve envío por Shipping Mark y programa status:in_warehouse (deduplica marks)", async () => {
    const admin = makeAdmin({
      shipments: {
        id: "s-7",
        code: "ENV-7",
        client_markbox: "DTD-7",
        client_name: "Wei",
      },
    });
    const n = await scheduleReceiptInWarehouse(admin, "t-1", [
      "DTD-7",
      "DTD-7",
      "  ",
      null,
    ]);
    expect(n).toBe(1); // sólo un Shipping Mark único con envío resoluble
    expect(scheduleMock).toHaveBeenCalledTimes(1);
    expect(scheduleMock.mock.calls[0][2]).toMatchObject({
      shipmentId: "s-7",
      event: "status:in_warehouse",
    });
  });

  it("Shipping Mark sin envío en curso → no programa (no mal-notifica)", async () => {
    const admin = makeAdmin({ shipments: null });
    const n = await scheduleReceiptInWarehouse(admin, "t-1", ["DTD-404"]);
    expect(n).toBe(0);
    expect(scheduleMock).not.toHaveBeenCalled();
  });
});
