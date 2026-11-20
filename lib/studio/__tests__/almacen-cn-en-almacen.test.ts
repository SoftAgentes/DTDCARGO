/**
 * SDD-0682 · «En almacén» con la decisión de Sam del 2026-11-20 («Quedan en
 * almacén»): una recepción consolidada sigue en la bodega hasta que su contenedor
 * zarpa; al zarpar pasa a «En camino» y al llegar sale de las dos vistas. Ninguna
 * sale dos veces y ninguna se pierde.
 *
 * El doble APLICA los filtros (`listados-double.ts`). Ojo: ordena por la última
 * columna de `order`, que en `listReceipts` es `id` descendente; los ids de abajo
 * siguen ese orden.
 */
import { describe, expect, it } from "vitest";
import { leerSalidasDeAlmacen, listReceipts } from "../warehouse-cn-queries";
import {
  contenedorQueManda,
  ESTADOS_EN_CAMINO,
  nombreParaEtiqueta,
  situacionDeRecepcion,
} from "../almacen-cn-contenedores";
import { dobleListados, type Fila } from "./listados-double";

function recepcion(id: string, status: string, shipment_id: string | null): Fila {
  return {
    id,
    tenant_id: "t1",
    receipt_code: `WR-${id}`,
    warehouse_id: "wh-1",
    client_markbox: "DEMO-0001",
    client_name: "Importador de prueba",
    boxes: 1,
    total_cbm: 1,
    total_weight_kg: 10,
    status,
    shipment_id,
    received_at: "2026-11-10",
    created_at: "2026-11-10T10:00:00Z",
    deleted_at: null,
    warehouse: { code: "YIW-A1", hub_code: "YIW", hub_name_es: "Yiwu", hub_name_cn: "义乌" },
    items: [],
    items_count: [{ count: 0 }],
  };
}

function contenedor(id: string, status: string, notes: string | null): Fila {
  return { id, ref: `DEMO-CONSOL-${id}`, status, notes, deleted_at: null };
}

const TABLAS: Record<string, Fila[]> = {
  warehouse_receipts_cn: [
    recepcion("r7", "incidencia", null),
    recepcion("r6", "pendiente_consolidacion", null),
    recepcion("r5", "consolidado", "sh-cerrado"),
    recepcion("r4", "consolidado", "sh-zarpado"),
    recepcion("r3", "consolidado", "sh-arribado"),
    recepcion("r2", "consolidado", null),
    recepcion("r1", "consolidado", "sh-partido"),
    recepcion("r0", "consolidado", "sh-sin-contenedor"),
  ],
  consolidation_items: [
    { shipment_id: "sh-cerrado", consolidation_id: "c-cerrado" },
    { shipment_id: "sh-zarpado", consolidation_id: "c-zarpado" },
    { shipment_id: "sh-arribado", consolidation_id: "c-arribado" },
    // Envío partido: una parte en un contenedor cerrado y otra en uno zarpado.
    { shipment_id: "sh-partido", consolidation_id: "c-cerrado" },
    { shipment_id: "sh-partido", consolidation_id: "c-zarpado" },
  ],
  consolidations: [
    contenedor("c-cerrado", "cerrado", "Carga demo · contenedor DTD #95 · ddp"),
    contenedor("c-zarpado", "zarpado", "Carga demo · contenedor DTD #94 · ddp"),
    contenedor("c-arribado", "arribado", null),
  ],
};

describe("regla de dónde va una recepción (SDD-0682)", () => {
  it("«En camino» es solo `zarpado`", () => {
    expect([...ESTADOS_EN_CAMINO]).toEqual(["zarpado"]);
  });

  it("lo no consolidado y lo consolidado sin contenedor o sin zarpar sigue en la bodega", () => {
    expect(situacionDeRecepcion("pendiente_consolidacion", { status: "zarpado", numeroDtd: 1, ref: null })).toBe("almacen");
    expect(situacionDeRecepcion("consolidado", null)).toBe("almacen");
    expect(situacionDeRecepcion("consolidado", { status: "consolidando", numeroDtd: 1, ref: null })).toBe("almacen");
    expect(situacionDeRecepcion("consolidado", { status: "cerrado", numeroDtd: 1, ref: null })).toBe("almacen");
    expect(situacionDeRecepcion("consolidado", { status: "zarpado", numeroDtd: 1, ref: null })).toBe("camino");
    expect(situacionDeRecepcion("consolidado", { status: "arribado", numeroDtd: 1, ref: null })).toBe("llego");
  });

  it("con el envío partido manda el contenedor más avanzado", () => {
    const cerrado = { status: "cerrado", numeroDtd: 95, ref: null };
    const zarpado = { status: "zarpado", numeroDtd: 94, ref: null };
    expect(contenedorQueManda([cerrado, zarpado])).toBe(zarpado);
    expect(contenedorQueManda([])).toBeNull();
  });

  it("la etiqueta usa el número DTD y, si no hay, la referencia", () => {
    expect(nombreParaEtiqueta({ numeroDtd: 64, ref: "DTD-CONSOL-0004" })).toBe("DTD #64");
    expect(nombreParaEtiqueta({ numeroDtd: null, ref: "DTD-CONSOL-0004" })).toBe("DTD-CONSOL-0004");
  });
});

describe("leerSalidasDeAlmacen (SDD-0682)", () => {
  it("saca lo zarpado y lo arribado; cuenta para el aviso solo lo que está en «En camino»", async () => {
    const { client, filtros } = dobleListados(TABLAS);
    const s = await leerSalidasDeAlmacen(client, { status: "en_almacen" });
    expect([...s.fuera].sort()).toEqual(["r1", "r3", "r4"]);
    expect(s.enCamino).toBe(2);
    expect([...s.sinZarpar.keys()]).toEqual(["r5"]);
    expect(s.sinZarpar.get("r5")).toEqual({ numeroDtd: 95, ref: "DEMO-CONSOL-c-cerrado" });
    // Solo lee consolidadas vivas y contenedores vivos.
    expect(filtros).toContainEqual({ table: "warehouse_receipts_cn", op: "eq", col: "status", val: "consolidado" });
    expect(filtros).toContainEqual({ table: "consolidations", op: "is", col: "deleted_at", val: null });
  });
});

describe("listReceipts · «En almacén» (SDD-0682)", () => {
  it("trae lo pendiente, las incidencias y lo consolidado que no zarpó; nada sale dos veces", async () => {
    const { client } = dobleListados(TABLAS);
    const filas = await listReceipts(client, { status: "en_almacen" });
    expect(filas.map((f) => f.id)).toEqual(["r7", "r6", "r5", "r2", "r0"]);
    expect(filas.find((f) => f.id === "r5")?.contenedor_sin_zarpar).toEqual({
      numeroDtd: 95,
      ref: "DEMO-CONSOL-c-cerrado",
    });
    expect(filas.find((f) => f.id === "r2")?.contenedor_sin_zarpar).toBeNull();
  });

  it("muchas recepciones de un contenedor zarpado no tapan a las que siguen en la bodega", async () => {
    const zarpadas = Array.from({ length: 250 }, (_, i) =>
      recepcion(`z-${String(i).padStart(3, "0")}`, "consolidado", "sh-zarpado"),
    );
    const { client } = dobleListados({
      ...TABLAS,
      warehouse_receipts_cn: [...zarpadas, recepcion("a-pendiente", "pendiente_consolidacion", null)],
    });
    const filas = await listReceipts(client, { status: "en_almacen" });
    expect(filas.map((f) => f.id)).toEqual(["a-pendiente"]);
  });

  it("con otro estado elegido no se calcula ni se etiqueta nada", async () => {
    const { client } = dobleListados(TABLAS);
    const filas = await listReceipts(client, { status: "consolidado" });
    expect(filas.map((f) => f.id)).toEqual(["r5", "r4", "r3", "r2", "r1", "r0"]);
    expect(filas.every((f) => f.contenedor_sin_zarpar == null)).toBe(true);
  });
});
