/**
 * SDD-0156 · Slice D — fan-out de eventos de máquinas paralelas: una
 * consolidación / recibo agrupa N envíos; cada uno recibe su aviso.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const scheduleMock = vi.fn((...args: unknown[]) => {
  void args;
  return Promise.resolve({ scheduled: 1, skipped: 0 });
});
vi.mock("../schedule-client-notifications", () => ({
  scheduleClientNotifications: (...a: unknown[]) => scheduleMock(...a),
}));

import {
  scheduleConsolidationEvent,
  scheduleReceiptVeReceived,
  notaSinAviso,
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
    const r = await scheduleReceiptInWarehouse(admin, "t-1", [
      "DTD-7",
      "DTD-7",
      "  ",
      null,
    ]);
    expect(r.scheduled).toBe(1); // sólo un Shipping Mark único con envío resoluble
    expect(r.sinDestino).toEqual([]);
    expect(scheduleMock).toHaveBeenCalledTimes(1);
    expect(scheduleMock.mock.calls[0][2]).toMatchObject({
      shipmentId: "s-7",
      event: "status:in_warehouse",
    });
  });

  it("🔴 Shipping Mark sin envío en curso → no programa, PERO lo denuncia", async () => {
    // SDD-0282: antes esto devolvía 0 y se acabó. Un 0 puede significar "no
    // había nadie a quien avisar" o "había un cliente esperando y no se le
    // avisó" — que son opuestos. El caso sin envío abierto es el NORMAL en una
    // primera compra: la caja llega a Yiwu semanas antes de que exista el envío.
    const admin = makeAdmin({ shipments: null });
    const r = await scheduleReceiptInWarehouse(admin, "t-1", ["DTD-404"]);
    expect(r.scheduled).toBe(0);
    expect(r.sinDestino).toEqual(["DTD-404"]);
    expect(scheduleMock).not.toHaveBeenCalled();
  });

  it("sin Shipping Marks no denuncia a nadie (no es lo mismo que no avisar)", async () => {
    const admin = makeAdmin({ shipments: null });
    const r = await scheduleReceiptInWarehouse(admin, "t-1", [null, "  "]);
    expect(r).toEqual({ scheduled: 0, sinDestino: [] });
  });
});

describe("notaSinAviso", () => {
  it("null cuando no hubo nadie sin avisar (no ensucia la bitácora)", () => {
    expect(notaSinAviso([])).toBeNull();
  });

  it("nombra los Shipping Marks y dice qué hacer", () => {
    const nota = notaSinAviso(["DTD-404", "DTD-405"]);
    expect(nota).toContain("DTD-404");
    expect(nota).toContain("DTD-405");
    expect(nota).toContain("no tiene un envío abierto");
    // La nota la lee el operador de oficina: tiene que decirle qué hacer, no
    // sólo qué pasó.
    expect(nota).toContain("escríbele");
  });
});
