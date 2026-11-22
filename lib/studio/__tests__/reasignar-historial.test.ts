import { describe, expect, it } from "vitest";
import {
  EVENTO_CAMBIO_DE_CLIENTE,
  TOPE_HISTORIAL,
  listarCambiosDeCliente,
  parseCambiosDeCliente,
} from "../reasignar-historial";

const T = "33333333-3333-4333-8333-333333333333";
const S = "44444444-4444-4444-8444-444444444444";

/** Constructor de consulta que anota cada filtro: lo que se prueba es la forma de la lectura. */
function lector(respuesta: { data: unknown; error: unknown }) {
  const llamadas: unknown[][] = [];
  const consulta = {
    eq: (c: string, v: string) => (llamadas.push(["eq", c, v]), consulta),
    order: (c: string, o: unknown) => (llamadas.push(["order", c, o]), consulta),
    limit: async (n: number) => (llamadas.push(["limit", n]), respuesta),
  };
  return {
    llamadas,
    crear: () => ({
      from: (tabla: string) => {
        llamadas.push(["from", tabla]);
        return { select: (cols: string) => (llamadas.push(["select", cols]), consulta) };
      },
    }),
  };
}

const fila = (fecha: string, antes: string | null, despues: string, motivo: string | null = "Dueño real") => ({
  occurred_at: fecha,
  actor_id: "u1",
  reason: motivo,
  before_data: antes === null ? null : { client_markbox: antes },
  after_data: { client_markbox: despues },
});

describe("SDD-0645 · historial de cambios de cliente", () => {
  it("lee sólo los eventos de cambio de cliente de ESTE embarque, en el tenant de la sesión, con tope", async () => {
    const l = lector({ data: [fila("2026-11-16T18:00:00Z", "DTD-0000", "DTD-1001")], error: null });
    const cambios = await listarCambiosDeCliente(l.crear, T, S);
    expect(cambios).toEqual([
      { fecha: "2026-11-16T18:00:00Z", actorId: "u1", anterior: "DTD-0000", nuevo: "DTD-1001", motivo: "Dueño real" },
    ]);
    expect(l.llamadas).toEqual([
      ["from", "entity_audit_log"],
      ["select", "occurred_at, actor_id, reason, before_data, after_data"],
      ["eq", "tenant_id", T],
      ["eq", "entity_type", "shipment"],
      ["eq", "entity_id", S],
      ["eq", "event_type", EVENTO_CAMBIO_DE_CLIENTE],
      ["order", "occurred_at", { ascending: false }],
      ["limit", TOPE_HISTORIAL],
    ]);
  });

  it("sin tenant o sin embarque no consulta", async () => {
    const l = lector({ data: [], error: null });
    expect(await listarCambiosDeCliente(l.crear, "", S)).toEqual([]);
    expect(await listarCambiosDeCliente(l.crear, T, "")).toEqual([]);
    expect(l.llamadas).toEqual([]);
  });

  it("un error, o no poder crear el cliente de servicio, deja el detalle sin historial", async () => {
    expect(await listarCambiosDeCliente(lector({ data: null, error: { message: "x" } }).crear, T, S)).toEqual([]);
    expect(await listarCambiosDeCliente(() => { throw new Error("sin variables"); }, T, S)).toEqual([]);
  });

  it("ordena del más reciente al más viejo y descarta filas sin forma", () => {
    expect(
      parseCambiosDeCliente([
        fila("2026-11-16T10:00:00Z", "DTD-0000", "DTD-1001"),
        fila("2026-11-17T10:00:00Z", "DTD-1001", "DTD-1002", "  "),
        { occurred_at: "no-es-fecha", after_data: { client_markbox: "DTD-9" } },
        { occurred_at: "2026-11-18T10:00:00Z", after_data: null },
        null,
      ]).map((c) => [c.anterior, c.nuevo, c.motivo]),
    ).toEqual([
      ["DTD-1001", "DTD-1002", null],
      ["DTD-0000", "DTD-1001", "Dueño real"],
    ]);
    expect(parseCambiosDeCliente("x")).toEqual([]);
  });
});
