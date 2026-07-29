import { describe, it, expect } from "vitest";
import {
  prealertaStage,
  shipmentStage,
  buildAlertItems,
  countByStage,
  filterByStage,
  type AlertItem,
} from "@/lib/portal/alertas";
import type { Prealerta } from "@/lib/studio/prealertas/types";
import type { PortalShipmentRow } from "@/lib/portal/portal-types";

function prealerta(over: Partial<Prealerta> = {}): Prealerta {
  return {
    id: "pa-1",
    tenant_id: "t-1",
    client_markbox: "DTD-5452",
    supplier_id: null,
    code: "DTD-5452-1-1",
    description: "",
    tracking_cn: null,
    client_note: null,
    boxes: 3,
    est_value_usd: null,
    status: "anunciada",
    received_at: null,
    shipment_id: null,
    share_token: null,
    sales_order_id: null,
    deleted_at: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...over,
  };
}

function shipment(over: Partial<PortalShipmentRow> = {}): PortalShipmentRow {
  return {
    id: "sh-1",
    code: "E-2026-944",
    service: "consolidado_lcl",
    status: "in_transit",
    origin: "Yiwu, China",
    destination: "Valencia, Venezuela",
    updatedAt: "2026-07-02T00:00:00.000Z",
    ...over,
  };
}

describe("prealertaStage", () => {
  it("mapea estados a etapas del hub", () => {
    expect(prealertaStage("anunciada")).toBe("prealerta");
    expect(prealertaStage("en_camino")).toBe("alerta");
    expect(prealertaStage("recibida")).toBe("alerta");
    expect(prealertaStage("consolidada")).toBe("alerta");
    expect(prealertaStage("cancelada")).toBeNull();
  });
});

describe("buildAlertItems", () => {
  it("mezcla prealertas (primero) y envíos (después)", () => {
    const items = buildAlertItems(
      [prealerta({ id: "pa-1", status: "anunciada" })],
      [shipment({ id: "sh-1" })],
      {},
    );
    expect(items.map((i) => i.stage)).toEqual(["prealerta", "envio"]);
  });

  it("excluye canceladas y las que ya graduaron a envío (shipment_id)", () => {
    const items = buildAlertItems(
      [
        prealerta({ id: "a", status: "cancelada" }),
        prealerta({ id: "b", status: "recibida", shipment_id: "sh-9" }),
        prealerta({ id: "c", status: "anunciada" }),
      ],
      [],
      {},
    );
    expect(items).toHaveLength(1);
    expect(items[0].prealertaId).toBe("c");
  });

  it("resuelve el nombre del proveedor y arma la meta", () => {
    const [item] = buildAlertItems(
      [prealerta({ supplier_id: "s-1", boxes: 1, description: "Textiles" })],
      [],
      { "s-1": "Guangzhou Textile Co" },
    );
    expect(item.title).toBe("Guangzhou Textile Co");
    expect(item.meta).toBe("1 caja · Textiles");
  });

  it("prealerta anunciada sin descripción cae al hint de packing", () => {
    const [item] = buildAlertItems([prealerta({ description: "" })], [], {});
    expect(item.meta).toContain("esperando packing");
  });

  it("el envío expone shipmentId y la ciudad de origen", () => {
    const [item] = buildAlertItems([], [shipment({ id: "sh-7", origin: "Ningbo, China" })], {});
    expect(item.shipmentId).toBe("sh-7");
    expect(item.title).toBe("Ningbo");
    expect(item.prealertaId).toBeNull();
  });

  it("ordena los pedidos por fecha desc", () => {
    const items = buildAlertItems(
      [
        prealerta({ id: "old", created_at: "2026-06-01T00:00:00.000Z" }),
        prealerta({ id: "new", created_at: "2026-07-01T00:00:00.000Z" }),
      ],
      [],
      {},
    );
    expect(items.map((i) => i.prealertaId)).toEqual(["new", "old"]);
  });
});

describe("countByStage / filterByStage", () => {
  const items: AlertItem[] = buildAlertItems(
    [
      prealerta({ id: "a", status: "anunciada" }),
      prealerta({ id: "b", status: "en_camino" }),
      prealerta({ id: "c", status: "recibida" }),
    ],
    [shipment({ id: "s1" }), shipment({ id: "s2" })],
    {},
  );

  it("cuenta por etapa", () => {
    expect(countByStage(items)).toEqual({
      todas: 5,
      prealerta: 1,
      alerta: 2,
      envio: 2,
      bodegave: 0,
      recibido: 0,
    });
  });

  it("filtra por etapa; todas devuelve todo", () => {
    expect(filterByStage(items, "todas")).toHaveLength(5);
    expect(filterByStage(items, "alerta")).toHaveLength(2);
    expect(filterByStage(items, "envio")).toHaveLength(2);
  });
});

/**
 * Las 2 etapas que faltaban del Norte (SDD-0170): "En casa" (ya en Venezuela) y
 * "Recibiste" (en tu puerta). El corte es geográfico sobre el flow canónico.
 */
describe("shipmentStage", () => {
  it("deja en 'envio' todo lo que viene en camino", () => {
    for (const s of [
      "draft",
      "in_warehouse",
      "consolidating",
      "shipped",
      "in_transit",
      "in_customs",
    ] as const) {
      expect(shipmentStage(s)).toBe("envio");
    }
  });

  it("pasa a 'bodegave' desde que la carga toca Venezuela", () => {
    // Incluye el reparto y la última milla: ya no viene en camino, ya está acá.
    for (const s of [
      "arrived_destination",
      "delayed_warehouse",
      "out_for_delivery",
      "last_mile",
    ] as const) {
      expect(shipmentStage(s)).toBe("bodegave");
    }
  });

  it("'delivered' es la única que llega a 'recibido'", () => {
    expect(shipmentStage("delivered")).toBe("recibido");
  });

  it("'exception' se queda en 'envio' (es transversal, no un paso del flow)", () => {
    expect(shipmentStage("exception")).toBe("envio");
  });

  it("'cancelled' no se muestra", () => {
    expect(shipmentStage("cancelled")).toBeNull();
  });

  it("un envío cancelado no entra en el hub", () => {
    const out = buildAlertItems([], [shipment({ id: "s1", status: "cancelled" })], {});
    expect(out).toHaveLength(0);
  });

  it("los envíos se reparten en su etapa real, no todos en 'envio'", () => {
    const out = buildAlertItems(
      [],
      [
        shipment({ id: "s1", status: "in_transit" }),
        shipment({ id: "s2", status: "arrived_destination" }),
        shipment({ id: "s3", status: "delivered" }),
      ],
      {},
    );
    expect(out.map((i) => i.stage).sort()).toEqual(["bodegave", "envio", "recibido"]);
  });
});
