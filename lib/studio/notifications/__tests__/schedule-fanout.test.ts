/**
 * SDD-0156 · Slice D — fan-out de eventos de máquinas paralelas: una
 * consolidación / recibo agrupa N envíos; cada uno recibe su aviso.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ScheduleResult } from "../schedule-client-notifications";

// El tipo de retorno se declara EXPLÍCITO: sin él, vi.fn lo infiere de la
// implementación inicial (`{scheduled, skipped}`) y un `mockResolvedValueOnce`
// con `faltaMigracion` no compila. Vitest transpila sin chequear tipos, así que
// el test corría verde y el rojo aparecía recién en el gate.
const scheduleMock = vi.fn((...args: unknown[]): Promise<ScheduleResult> => {
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
      ancla: { kind: "shipment", shipmentId: "s-1", shipmentCode: "ENV-1" },
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

describe("scheduleReceiptVeReceived · «tu carga llegó a Venezuela»", () => {
  it("resuelve envío por Shipping Mark y programa received_ve (deduplica marks)", async () => {
    const admin = makeAdmin({
      shipments: {
        id: "s-9",
        code: "ENV-9",
        client_markbox: "DTD-9",
        client_name: "Caro",
      },
    });
    const r = await scheduleReceiptVeReceived(admin, "t-1", [
      "DTD-9",
      "DTD-9",
      "  ",
      null,
    ]);
    expect(r.scheduled).toBe(1); // sólo un Shipping Mark único con envío resoluble
    expect(r.sinDestino).toEqual([]);
    expect(scheduleMock).toHaveBeenCalledTimes(1);
    expect(scheduleMock.mock.calls[0][2]).toMatchObject({
      ancla: { kind: "shipment", shipmentId: "s-9", shipmentCode: "ENV-9" },
      event: "received_ve",
    });
  });

  it("🔴 sin envío en curso NO mal-notifica, pero TAMPOCO se calla (SDD-0311)", async () => {
    // El caso que se perdía. Antes esto devolvía `0` y era indistinguible de
    // «no había a quién avisar»: el recibo del contenedor se creaba, la
    // pantalla decía que todo salió bien, y ese cliente se quedaba esperando
    // una llamada que nadie sabía que había que hacer.
    const admin = makeAdmin({ shipments: null });
    const r = await scheduleReceiptVeReceived(admin, "t-1", ["DTD-404"]);
    expect(r.scheduled).toBe(0);
    expect(r.sinDestino).toEqual(["DTD-404"]);
    expect(scheduleMock).not.toHaveBeenCalled();
  });

  it("el que sí tiene envío se avisa igual: uno sin destino no arrastra al otro", async () => {
    // Un solo Shipping Mark irresoluble no puede dejar mudo al contenedor
    // entero. El mock resuelve el MISMO envío para cualquier mark, así que se
    // usa un único mark con envío y otro sin — en dos llamadas separadas — para
    // afirmar que las dos listas se llenan de forma independiente.
    const conEnvio = await scheduleReceiptVeReceived(
      makeAdmin({
        shipments: { id: "s-1", code: "ENV-1", client_markbox: "DTD-1", client_name: "Ana" },
      }),
      "t-1",
      ["DTD-1"],
    );
    const sinEnvio = await scheduleReceiptVeReceived(makeAdmin({ shipments: null }), "t-1", [
      "DTD-404",
    ]);
    expect(conEnvio.scheduled).toBe(1);
    expect(conEnvio.sinDestino).toEqual([]);
    expect(sinEnvio.scheduled).toBe(0);
    expect(sinEnvio.sinDestino).toEqual(["DTD-404"]);
  });

  it("lista vacía o sólo basura → nada que avisar y nadie sin avisar", async () => {
    const r = await scheduleReceiptVeReceived(makeAdmin({}), "t-1", ["", "  ", null, undefined]);
    expect(r).toEqual({ scheduled: 0, sinDestino: [] });
    expect(scheduleMock).not.toHaveBeenCalled();
  });

  it("la misma nota de bitácora sirve para el arribo, no sólo para China", () => {
    // `notaSinAviso` nació con SDD-0282 para la recepción en Yiwu. El texto es
    // genérico a propósito: quien se queda sin aviso necesita lo mismo en los
    // dos lados — saber a quién escribirle a mano.
    const nota = notaSinAviso(["DTD-404"]);
    expect(nota).toContain("DTD-404");
    expect(nota).toContain("escríbele");
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
      { markbox: "DTD-7" },
      { markbox: "DTD-7" },
      { markbox: "  " },
      { markbox: null },
    ]);
    expect(r.scheduled).toBe(1); // sólo un Shipping Mark único con envío resoluble
    expect(r.sinDestino).toEqual([]);
    expect(scheduleMock).toHaveBeenCalledTimes(1);
    expect(scheduleMock.mock.calls[0][2]).toMatchObject({
      ancla: { kind: "shipment", shipmentId: "s-7", shipmentCode: "ENV-7" },
      event: "status:in_warehouse",
    });
  });

  it("🔴 Shipping Mark sin envío en curso → no programa, PERO lo denuncia", async () => {
    // SDD-0282: antes esto devolvía 0 y se acabó. Un 0 puede significar "no
    // había nadie a quien avisar" o "había un cliente esperando y no se le
    // avisó" — que son opuestos. El caso sin envío abierto es el NORMAL en una
    // primera compra: la caja llega a Yiwu semanas antes de que exista el envío.
    const admin = makeAdmin({ shipments: null });
    const r = await scheduleReceiptInWarehouse(admin, "t-1", [
      { markbox: "DTD-404" },
    ]);
    expect(r.scheduled).toBe(0);
    expect(r.sinDestino).toEqual(["DTD-404"]);
    expect(scheduleMock).not.toHaveBeenCalled();
  });

  it("sin Shipping Marks no denuncia a nadie (no es lo mismo que no avisar)", async () => {
    const admin = makeAdmin({ shipments: null });
    const r = await scheduleReceiptInWarehouse(admin, "t-1", [
      { markbox: null },
      { markbox: "  " },
    ]);
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

describe("scheduleReceiptInWarehouse · el aviso cae en la COMPRA (SDD-0283)", () => {
  it("🔴 sin envío abierto PERO con compra → programa anclado a la compra", () => {
    // Éste es el caso que se perdía: primera compra, la caja llega a Yiwu y el
    // envío todavía no existe porque nace al consolidar.
    const admin = makeAdmin({ shipments: null });
    return scheduleReceiptInWarehouse(admin, "t-1", [
      { markbox: "DTD-9", prealertaId: "p-9", prealertaCode: "DTD-9-1-1" },
    ]).then((r) => {
      expect(r.scheduled).toBe(1);
      expect(r.sinDestino).toEqual([]);
      expect(scheduleMock.mock.calls[0][2]).toMatchObject({
        ancla: { kind: "prealerta", prealertaId: "p-9", prealertaCode: "DTD-9-1-1" },
        // MISMO evento que por envío: significa lo mismo cuelgue de donde
        // cuelgue, y así el tenant no tiene que configurar una regla nueva.
        event: "status:in_warehouse",
      });
    });
  });

  it("con envío abierto NO usa la compra (el envío manda)", () => {
    const admin = makeAdmin({
      shipments: { id: "s-3", code: "ENV-3", client_markbox: "DTD-9", client_name: "Li" },
    });
    return scheduleReceiptInWarehouse(admin, "t-1", [
      { markbox: "DTD-9", prealertaId: "p-9", prealertaCode: "DTD-9-1-1" },
    ]).then(() => {
      expect(scheduleMock.mock.calls[0][2]).toMatchObject({
        ancla: { kind: "shipment", shipmentId: "s-3" },
      });
    });
  });

  it("🔴 si falta la migración 0389, el cliente SIGUE contando como sin avisar", () => {
    // El motor devuelve faltaMigracion y 0 programados. Si esto no cayera en
    // `sinDestino`, la nota de la bitácora desaparecería justo en el entorno
    // donde el aviso NO se está mandando — el peor momento para callarse.
    scheduleMock.mockResolvedValueOnce({
      scheduled: 0,
      skipped: 1,
      faltaMigracion: true,
    });
    const admin = makeAdmin({ shipments: null });
    return scheduleReceiptInWarehouse(admin, "t-1", [
      { markbox: "DTD-9", prealertaId: "p-9", prealertaCode: "DTD-9-1-1" },
    ]).then((r) => {
      expect(r.scheduled).toBe(0);
      expect(r.sinDestino).toEqual(["DTD-9"]);
    });
  });

  it("sin envío y sin compra → sin destino (no se inventa a quién avisar)", () => {
    const admin = makeAdmin({ shipments: null });
    return scheduleReceiptInWarehouse(admin, "t-1", [{ markbox: "DTD-404" }]).then(
      (r) => {
        expect(r.sinDestino).toEqual(["DTD-404"]);
        expect(scheduleMock).not.toHaveBeenCalled();
      },
    );
  });

  it("al deduplicar por Shipping Mark se queda con la entrada que SÍ trae compra", () => {
    const admin = makeAdmin({ shipments: null });
    return scheduleReceiptInWarehouse(admin, "t-1", [
      { markbox: "DTD-9" },
      { markbox: "DTD-9", prealertaId: "p-9", prealertaCode: "DTD-9-1-1" },
    ]).then((r) => {
      expect(r.scheduled).toBe(1);
      expect(scheduleMock).toHaveBeenCalledTimes(1);
    });
  });
});
