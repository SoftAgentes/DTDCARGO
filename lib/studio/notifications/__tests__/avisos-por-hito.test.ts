/**
 * SDD-0627 · avisos por hito: un `carga_en_camino` por cliente y contenedor,
 * apagado detrás de AVISOS_POR_HITO_LIVE, y un ensayo en seco que sólo cuenta.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ScheduleResult } from "../schedule-client-notifications";

const scheduleMock = vi.fn((...args: unknown[]): Promise<ScheduleResult> => {
  void args;
  return Promise.resolve({ scheduled: 1, skipped: 0 });
});
vi.mock("../schedule-client-notifications", () => ({
  scheduleClientNotifications: (...a: unknown[]) => scheduleMock(...a),
}));

import {
  AVISOS_POR_HITO_LIVE,
  ensayarAvisosCargaEnCamino,
  planAvisosCargaEnCamino,
  programarAvisosCargaEnCamino,
} from "../avisos-por-hito";

type Llamada = { table: string; method: string; args: unknown[] };

/**
 * Doble de admin que REGISTRA cada método encadenado por tabla, para poder
 * afirmar que el ensayo no escribe. Resuelve `{data, error}` por tabla.
 */
function makeAdmin(
  dataByTable: Record<string, unknown>,
  errorByTable: Record<string, unknown> = {},
) {
  const llamadas: Llamada[] = [];
  function from(table: string) {
    const result = {
      data: dataByTable[table] ?? null,
      error: errorByTable[table] ?? null,
    };
    const builder: unknown = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === "then") {
            return (res: (v: unknown) => unknown) => Promise.resolve(result).then(res);
          }
          return (...args: unknown[]) => {
            llamadas.push({ table, method: String(prop), args });
            return builder;
          };
        },
      },
    );
    return builder;
  }
  const fromSpy = vi.fn(from);
  return { admin: { from: fromSpy } as never, llamadas, fromSpy };
}

const ESCRITURAS = new Set(["insert", "update", "upsert", "delete", "rpc"]);

beforeEach(() => scheduleMock.mockClear());

describe("SDD-0627 · planAvisosCargaEnCamino", () => {
  it("un aviso por cliente, anclado a su envío de código menor", () => {
    const plan = planAvisosCargaEnCamino([
      { shipmentId: "s3", shipmentCode: "ENV-30", clientMarkbox: "DTD-1", clientName: null },
      { shipmentId: "s1", shipmentCode: "ENV-10", clientMarkbox: "DTD-1", clientName: null },
      { shipmentId: "s2", shipmentCode: "ENV-20", clientMarkbox: "DTD-2", clientName: null },
      { shipmentId: "s4", shipmentCode: "ENV-40", clientMarkbox: "  ", clientName: null },
      { shipmentId: "s5", shipmentCode: "ENV-50", clientMarkbox: null, clientName: null },
    ]);
    expect(plan.sinMarkbox).toBe(2);
    expect(plan.destinatarios.map((d) => [d.clientMarkbox, d.ancla.shipmentCode, d.envios])).toEqual([
      ["DTD-1", "ENV-10", 2],
      ["DTD-2", "ENV-20", 1],
    ]);
  });
});

describe("SDD-0627 · bandera", () => {
  it("nace APAGADA", () => {
    expect(AVISOS_POR_HITO_LIVE).toBe(false);
  });

  it("apagada: programar no toca la base ni agenda nada", async () => {
    const { admin, fromSpy } = makeAdmin({});
    const r = await programarAvisosCargaEnCamino(admin, "t1", "c1");
    expect(r).toEqual({ apagado: true, programados: 0, destinatarios: 0 });
    expect(fromSpy).not.toHaveBeenCalled();
    expect(scheduleMock).not.toHaveBeenCalled();
  });

  it("encendida: agenda carga_en_camino una vez por cliente, sobre el envío ancla", async () => {
    const { admin } = makeAdmin({
      consolidation_items: [
        { shipment_id: "s1", client_markbox: "DTD-1", client_name: null },
        { shipment_id: "s2", client_markbox: "DTD-1", client_name: null },
        { shipment_id: "s3", client_markbox: "DTD-2", client_name: null },
        { shipment_id: "s9", client_markbox: "DTD-9", client_name: null },
      ],
      // s9 está eliminado: no vuelve en la lectura de vivos.
      shipments: [
        { id: "s1", code: "ENV-1", client_markbox: "DTD-1", client_name: null },
        { id: "s2", code: "ENV-2", client_markbox: "DTD-1", client_name: null },
        { id: "s3", code: "ENV-3", client_markbox: "DTD-2", client_name: null },
      ],
    });
    const r = await programarAvisosCargaEnCamino(admin, "t1", "c1", true);
    expect(r).toEqual({ apagado: false, programados: 2, destinatarios: 2 });
    expect(scheduleMock).toHaveBeenCalledTimes(2);
    const eventos = scheduleMock.mock.calls.map((c) => c[2] as { event: string; ancla: { shipmentId: string } });
    expect(eventos.map((e) => e.event)).toEqual(["carga_en_camino", "carga_en_camino"]);
    expect(eventos.map((e) => e.ancla.shipmentId)).toEqual(["s1", "s3"]);
  });

  it("encendida: si no puede leer los envíos vivos, no avisa a ciegas", async () => {
    const { admin } = makeAdmin(
      { consolidation_items: [{ shipment_id: "s1", client_markbox: "DTD-1", client_name: null }] },
      { shipments: { message: "boom" } },
    );
    const r = await programarAvisosCargaEnCamino(admin, "t1", "c1", true);
    expect(r.programados).toBe(0);
    expect(scheduleMock).not.toHaveBeenCalled();
  });
});

describe("SDD-0627 · ensayo en seco", () => {
  const datos = {
    consolidation_items: [
      { shipment_id: "s1", client_markbox: "DTD-1", client_name: "N1" },
      { shipment_id: "s2", client_markbox: "DTD-1", client_name: "N1" },
      { shipment_id: "s3", client_markbox: "DTD-2", client_name: "N2" },
      { shipment_id: "s4", client_markbox: null, client_name: null },
    ],
    shipments: [
      { id: "s1", code: "ENV-1", client_markbox: "DTD-1", client_name: "N1" },
      { id: "s2", code: "ENV-2", client_markbox: "DTD-1", client_name: "N1" },
      { id: "s3", code: "ENV-3", client_markbox: "DTD-2", client_name: "N2" },
      { id: "s4", code: "ENV-4", client_markbox: null, client_name: null },
    ],
  };

  it("cuenta destinatarios sin escribir ni agendar, con la bandera apagada", async () => {
    const { admin, llamadas } = makeAdmin({
      ...datos,
      client_notification_rules: { channel: "both" },
    });
    const e = await ensayarAvisosCargaEnCamino(admin, "t1", "c1");
    expect(e).toEqual({
      evento: "carga_en_camino",
      encendido: false,
      leido: true,
      envios: 4,
      destinatarios: 2,
      sinMarkbox: 1,
      regla: "both",
      saldrian: 2,
    });
    expect(llamadas.filter((l) => ESCRITURAS.has(l.method))).toEqual([]);
    expect(scheduleMock).not.toHaveBeenCalled();
  });

  it("no devuelve Shipping Marks ni nombres: sólo números y estados", async () => {
    const { admin } = makeAdmin({ ...datos, client_notification_rules: { channel: "email" } });
    const e = await ensayarAvisosCargaEnCamino(admin, "t1", "c1");
    const texto = JSON.stringify(e);
    expect(texto).not.toMatch(/DTD-|N1|N2|ENV-/);
  });

  it("sin regla o con regla apagada: saldrían 0", async () => {
    const sin = await ensayarAvisosCargaEnCamino(makeAdmin(datos).admin, "t1", "c1");
    expect(sin.regla).toBe("sin_regla");
    expect(sin.saldrian).toBe(0);
    const apagada = await ensayarAvisosCargaEnCamino(
      makeAdmin({ ...datos, client_notification_rules: { channel: "none" } }).admin,
      "t1",
      "c1",
    );
    expect(apagada.regla).toBe("apagada");
    expect(apagada.saldrian).toBe(0);
  });

  it("filtra por tenant y contenedor al leer los envíos", async () => {
    const { admin, llamadas } = makeAdmin({ ...datos, client_notification_rules: null });
    await ensayarAvisosCargaEnCamino(admin, "t1", "c1");
    const eqItems = llamadas.filter((l) => l.table === "consolidation_items" && l.method === "eq");
    expect(eqItems.map((l) => l.args)).toEqual([
      ["tenant_id", "t1"],
      ["consolidation_id", "c1"],
    ]);
    const eqShip = llamadas.filter((l) => l.table === "shipments" && l.method === "eq");
    expect(eqShip.map((l) => l.args)).toEqual([["tenant_id", "t1"]]);
  });

  it("si falla la lectura, lo dice (leido: false) en vez de contar 0 como verdad", async () => {
    const { admin } = makeAdmin({}, { consolidation_items: { message: "boom" } });
    const e = await ensayarAvisosCargaEnCamino(admin, "t1", "c1");
    expect(e.leido).toBe(false);
  });
});
