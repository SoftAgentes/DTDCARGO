/**
 * SDD-0682 · «En almacén» con la decisión de Sam del 2026-11-20 («Quedan en
 * almacén»): una recepción consolidada sigue en la bodega hasta que su contenedor
 * zarpa; al zarpar pasa a «En camino» y al llegar sale de las dos vistas. Ninguna
 * sale dos veces y ninguna se pierde.
 *
 * El contenedor de una recepción es el VIGENTE de su envío, con la regla del
 * proyecto (SDD-0643 §3.2, SDD-0661, Portal): si hay más de una línea en
 * `consolidation_items`, gana la más reciente en un contenedor vivo. Dos líneas
 * del mismo envío = se movió de contenedor.
 *
 * El doble APLICA los filtros y ordena como PostgREST (`listados-double.ts`):
 * aquí todas las recepciones tienen la misma fecha, así que decide el desempate
 * por `id` descendente de `listReceipts`.
 */
import { describe, expect, it } from "vitest";
import { leerSalidasDeAlmacen, listReceipts } from "../warehouse-cn-queries";
import {
  ESTADOS_EN_CAMINO,
  lineaVigentePorEnvio,
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

function contenedor(id: string, status: string, notes: string | null, deleted_at: string | null = null): Fila {
  return { id, ref: `DEMO-CONSOL-${id}`, status, notes, deleted_at };
}

let n = 0;
function linea(shipment_id: string, consolidation_id: string, created_at: string): Fila {
  n += 1;
  return { id: `i-${String(n).padStart(2, "0")}`, shipment_id, consolidation_id, created_at };
}

const VIEJA = "2026-11-01T00:00:00Z";
const NUEVA = "2026-11-08T00:00:00Z";

const TABLAS: Record<string, Fila[]> = {
  warehouse_receipts_cn: [
    recepcion("r9", "incidencia", null),
    recepcion("r8", "pendiente_consolidacion", null),
    recepcion("r7", "consolidado", "sh-cerrado"),
    recepcion("r6", "consolidado", "sh-zarpado"),
    recepcion("r5", "consolidado", "sh-arribado"),
    recepcion("r4", "consolidado", null),
    recepcion("r3", "consolidado", "sh-arribado-a-consolidando"),
    recepcion("r2", "consolidado", "sh-zarpado-a-consolidando"),
    recepcion("r1", "consolidado", "sh-zarpado-a-arribado"),
    recepcion("r0", "consolidado", "sh-a-borrado"),
    recepcion("q0", "consolidado", "sh-sin-contenedor"),
    recepcion("p0", "consolidado", "sh-partido"),
  ],
  consolidation_items: [
    linea("sh-cerrado", "c-cerrado", VIEJA),
    linea("sh-zarpado", "c-zarpado", VIEJA),
    linea("sh-arribado", "c-arribado", VIEJA),
    // Envíos movidos de contenedor: la línea más reciente manda.
    linea("sh-arribado-a-consolidando", "c-arribado", VIEJA),
    linea("sh-arribado-a-consolidando", "c-consolidando", NUEVA),
    linea("sh-zarpado-a-consolidando", "c-zarpado", VIEJA),
    linea("sh-zarpado-a-consolidando", "c-consolidando", NUEVA),
    linea("sh-zarpado-a-arribado", "c-zarpado", VIEJA),
    linea("sh-zarpado-a-arribado", "c-arribado", NUEVA),
    // La más reciente está en un contenedor eliminado: manda la viva.
    linea("sh-a-borrado", "c-cerrado", VIEJA),
    linea("sh-a-borrado", "c-borrado", NUEVA),
    // Envío partido (SDD-0563/0673): la línea nueva va en el MISMO contenedor.
    linea("sh-partido", "c-zarpado", VIEJA),
    linea("sh-partido", "c-zarpado", NUEVA),
  ],
  consolidations: [
    contenedor("c-cerrado", "cerrado", "Carga demo · contenedor DTD #95 · ddp"),
    contenedor("c-consolidando", "consolidando", "Carga demo · contenedor DTD #97 · ddp"),
    contenedor("c-zarpado", "zarpado", "Carga demo · contenedor DTD #94 · ddp"),
    contenedor("c-arribado", "arribado", null),
    contenedor("c-borrado", "zarpado", "Carga demo · contenedor DTD #99 · ddp", "2026-11-09T00:00:00Z"),
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

  it("contenedor vigente: la línea más reciente en un contenedor vivo, no la más avanzada", () => {
    const l = (id: string, shipmentId: string, consolidationId: string, createdAt: string) => ({
      id,
      shipmentId,
      consolidationId,
      createdAt,
    });
    const vivos = new Set(["A", "B"]);
    // A zarpado (vieja) y B consolidando (nueva): manda B aunque A esté más avanzado.
    expect(lineaVigentePorEnvio([l("1", "s", "A", VIEJA), l("2", "s", "B", NUEVA)], vivos).get("s")).toBe("B");
    // El orden de lectura no importa.
    expect(lineaVigentePorEnvio([l("2", "s", "B", NUEVA), l("1", "s", "A", VIEJA)], vivos).get("s")).toBe("B");
    // La más reciente en un contenedor eliminado no cuenta.
    expect(lineaVigentePorEnvio([l("1", "s", "A", VIEJA), l("2", "s", "X", NUEVA)], vivos).get("s")).toBe("A");
    // Sin línea viva, el envío no tiene contenedor.
    expect(lineaVigentePorEnvio([l("1", "s", "X", VIEJA)], vivos).has("s")).toBe(false);
    // Empate de fecha: decide el id mayor.
    expect(lineaVigentePorEnvio([l("2", "s", "B", VIEJA), l("1", "s", "A", VIEJA)], vivos).get("s")).toBe("B");
  });

  it("la etiqueta usa el número DTD y, si no hay, la referencia", () => {
    expect(nombreParaEtiqueta({ numeroDtd: 64, ref: "DTD-CONSOL-0004" })).toBe("DTD #64");
    expect(nombreParaEtiqueta({ numeroDtd: null, ref: "DTD-CONSOL-0004" })).toBe("DTD-CONSOL-0004");
  });
});

describe("leerSalidasDeAlmacen (SDD-0682)", () => {
  it("saca lo zarpado y lo arribado por el contenedor vigente; el aviso cuenta solo lo de «En camino»", async () => {
    const { client, filtros } = dobleListados(TABLAS);
    const s = await leerSalidasDeAlmacen(client, { status: "en_almacen" });
    // r6 zarpado, p0 partido dentro del zarpado, r5 arribado, r1 movido de zarpado a arribado.
    expect([...s.fuera].sort()).toEqual(["p0", "r1", "r5", "r6"]);
    // Solo r6 y p0 se ven en «En camino». r1 ya llegó: no descuadra el aviso.
    expect(s.enCamino).toBe(2);
    expect(Object.fromEntries(s.sinZarpar)).toEqual({
      r7: { numeroDtd: 95, ref: "DEMO-CONSOL-c-cerrado" },
      // Movidos a un contenedor que se llena: siguen en la bodega, con el contenedor NUEVO.
      r3: { numeroDtd: 97, ref: "DEMO-CONSOL-c-consolidando" },
      r2: { numeroDtd: 97, ref: "DEMO-CONSOL-c-consolidando" },
      // La línea nueva está en un contenedor eliminado: manda la viva.
      r0: { numeroDtd: 95, ref: "DEMO-CONSOL-c-cerrado" },
    });
    // Solo lee consolidadas vivas y contenedores vivos, en orden estable.
    expect(filtros).toContainEqual({ table: "warehouse_receipts_cn", op: "eq", col: "status", val: "consolidado" });
    expect(filtros).toContainEqual({ table: "consolidations", op: "is", col: "deleted_at", val: null });
  });
});

describe("listReceipts · «En almacén» (SDD-0682)", () => {
  it("trae lo pendiente, las incidencias y lo consolidado que no zarpó; nada sale dos veces", async () => {
    const { client } = dobleListados(TABLAS);
    const filas = await listReceipts(client, { status: "en_almacen" });
    expect(filas.map((f) => f.id)).toEqual(["r9", "r8", "r7", "r4", "r3", "r2", "r0", "q0"]);
    expect(filas.find((f) => f.id === "r2")?.contenedor_sin_zarpar).toEqual({
      numeroDtd: 97,
      ref: "DEMO-CONSOL-c-consolidando",
    });
    expect(filas.find((f) => f.id === "r4")?.contenedor_sin_zarpar).toBeNull();
    expect(filas.find((f) => f.id === "q0")?.contenedor_sin_zarpar).toBeNull();
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
    expect(filas.map((f) => f.id)).toEqual(["r7", "r6", "r5", "r4", "r3", "r2", "r1", "r0", "q0", "p0"]);
    expect(filas.every((f) => f.contenedor_sin_zarpar == null)).toBe(true);
  });
});
