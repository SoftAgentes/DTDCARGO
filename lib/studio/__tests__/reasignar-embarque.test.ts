import { describe, expect, it } from "vitest";
import {
  faltaLaFuncion,
  mensajeErrorReasignar,
  parseReasignarResultado,
  textosBloqueos,
  textosMovidos,
} from "../reasignar-embarque";

describe("SDD-0645 · parseReasignarResultado", () => {
  it("lee la respuesta de la 0551", () => {
    expect(
      parseReasignarResultado({
        outcome: "preview",
        shipment_code: "S-1",
        old_markbox: null,
        new_markbox: "DTD-1001",
        blockers: { reclamo: 1, raro: "x" },
        moved: { shipments: 1, invoices: "2" },
      }),
    ).toEqual({
      outcome: "preview",
      shipmentCode: "S-1",
      oldMarkbox: null,
      newMarkbox: "DTD-1001",
      blockers: { reclamo: 1 },
      moved: { shipments: 1, invoices: 2 },
    });
  });

  it("rechaza lo que no tiene la forma", () => {
    for (const raw of [null, [], "x", { outcome: "otro", shipment_code: "S", new_markbox: "D" },
      { outcome: "preview", shipment_code: "S" }]) {
      expect(parseReasignarResultado(raw)).toBeNull();
    }
  });
});

describe("textos", () => {
  it("cada bloqueo dice qué hacer, en singular y plural", () => {
    expect(textosBloqueos({ factura_emitida: 1 })).toEqual([
      "Tiene 1 factura emitida a nombre del cliente actual. Anúlala primero.",
    ]);
    expect(textosBloqueos({ reclamo: 2, orden_despacho: 0 })).toEqual(["Tiene 2 reclamos abiertos del cliente actual."]);
    expect(textosBloqueos({ factura_varios_embarques: 1, prealerta: 1, orden_despacho: 2 })).toHaveLength(3);
  });

  it("lo que se mueve, sin el embarque mismo y sin ceros", () => {
    expect(textosMovidos({ shipments: 1 })).toEqual([]);
    expect(
      textosMovidos({
        shipments: 1, warehouse_receipts_cn: 2, warehouse_boxes: 6, invoices: 1,
        consolidation_items: 1, shipment_documents: 0, client_notification_schedule: 3,
      }),
    ).toEqual([
      "2 recepciones del Almacén CN (6 cajas)",
      "1 factura en borrador",
      "1 línea de consolidación",
      "3 avisos pendientes",
    ]);
  });

  it("sin voseo en ningún texto", () => {
    const todos = [
      ...textosBloqueos({ factura_emitida: 1, factura_varios_embarques: 1, reclamo: 1, prealerta: 1, orden_despacho: 1 }),
      ...["42501", "P0002", "22023", "40001", "XX"].map((code) => mensajeErrorReasignar({ code, message: "" })),
    ];
    for (const t of todos) expect(t).not.toMatch(/\b(anulá|separá|buscá|elegí|recargá|intentá)\b/i);
  });
});

describe("errores", () => {
  it("sin la función", () => {
    expect(faltaLaFuncion({ code: "PGRST202" })).toBe(true);
    expect(faltaLaFuncion({ code: "42883" })).toBe(true);
    expect(faltaLaFuncion({ code: "42501" })).toBe(false);
    expect(faltaLaFuncion(null)).toBe(false);
  });

  it("traduce cada caso y nunca devuelve el mensaje crudo", () => {
    const m = (code: string, message = "") => mensajeErrorReasignar({ code, message });
    expect(m("42501")).toBe("No tienes permiso para pasar embarques a otro cliente.");
    expect(m("P0002", "pasar embarque: cliente no encontrado")).toBe("No encontramos ese cliente. Búscalo de nuevo.");
    expect(m("P0002", "pasar embarque: embarque no encontrado")).toBe("No encontramos este embarque. Recarga la página.");
    expect(m("22023", "audit: reason debe tener entre 4 y 1000 caracteres")).toBe("Indica un motivo de 4 a 1000 caracteres.");
    expect(m("22023", "pasar embarque: esa ficha fue fusionada; elige la que sobrevivió"))
      .toBe("Esa ficha fue fusionada con otra. Elige la que quedó.");
    expect(m("22023", "pasar embarque: el embarque ya es de ese cliente")).toBe("El embarque ya es de ese cliente.");
    expect(m("XX000", "detalle interno secreto")).toBe("No pudimos pasar el embarque. Intenta de nuevo.");
  });
});
