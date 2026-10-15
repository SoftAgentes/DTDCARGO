/**
 * SDD-0522 · Las recepciones eliminadas fuera del listado y de los KPIs del
 * Almacén CN.
 *
 * La RLS de `warehouse_receipts_cn` NO esconde las eliminadas: la 0230 sacó
 * `deleted_at is null` del USING de las policies FOR ALL. El `.is("deleted_at",
 * null)` de la consulta es lo único que las separa.
 *
 * El doble APLICA los filtros (`listados-double.ts`) y el fixture es INFELIZ:
 * la eliminada es la más reciente y cumple cada uno de los demás filtros
 * (mismo estado, mismo mes), así que sólo el `deleted_at` la deja afuera. Cada
 * bloque lleva su «control del doble»: con todo vivo, las dos filas cuentan.
 */
import { describe, expect, it } from "vitest";
import { computeWarehouseKpis, listReceipts } from "../warehouse-cn-queries";
import { dobleListados, todoVivo, type Fila } from "./listados-double";

const hoy = new Date();
const esteMes = (dia: number) =>
  new Date(hoy.getFullYear(), hoy.getMonth(), dia).toISOString().slice(0, 10);

function recepcion(parcial: Fila & { id: string }): Fila {
  return {
    tenant_id: "t1",
    receipt_code: `WR-${parcial.id}`,
    warehouse_id: "wh-1",
    client_markbox: "DTD-0418",
    client_name: "María Fernanda Rojas",
    is_orphan: false,
    boxes: 2,
    total_cbm: 1.5,
    total_weight_kg: 20,
    status: "pendiente_consolidacion",
    shipment_id: null,
    received_at: esteMes(1),
    created_at: `${esteMes(1)}T10:00:00Z`,
    deleted_at: null,
    warehouse: { code: "YIW-A1", hub_code: "YIW", hub_name_es: "Yiwu", hub_name_cn: "义乌" },
    items: [],
    items_count: [{ count: 0 }],
    ...parcial,
  };
}

const TABLAS = {
  warehouse_receipts_cn: [
    recepcion({ id: "viva" }),
    // La eliminada es la más reciente y cumple todo lo demás.
    recepcion({ id: "eliminada", received_at: esteMes(2), created_at: `${esteMes(2)}T10:00:00Z`, deleted_at: "2026-10-15T05:00:00Z" }),
    recepcion({ id: "incidencia-viva", status: "incidencia" }),
    recepcion({ id: "incidencia-eliminada", status: "incidencia", deleted_at: "2026-10-15T05:00:00Z" }),
  ],
};

describe("listReceipts · sin eliminadas", () => {
  it("deja fuera la eliminada aunque sea la más reciente y coincida con el filtro", async () => {
    const { client, filtros } = dobleListados(TABLAS);
    const filas = await listReceipts(client, { status: "pendiente_consolidacion" });
    expect(filas.map((f) => f.id)).toEqual(["viva"]);
    expect(filtros).toContainEqual({ table: "warehouse_receipts_cn", op: "is", col: "deleted_at", val: null });
  });

  it("control del doble: con todo vivo vuelven las dos", async () => {
    const { client } = dobleListados(todoVivo(TABLAS));
    const filas = await listReceipts(client, { status: "pendiente_consolidacion" });
    expect(filas.map((f) => f.id)).toEqual(["eliminada", "viva"]);
  });
});

describe("computeWarehouseKpis · sin eliminadas", () => {
  it("ni el mes, ni las pendientes, ni su CBM, ni las incidencias cuentan eliminadas", async () => {
    const { client } = dobleListados(TABLAS);
    expect(await computeWarehouseKpis(client)).toEqual({
      receiptsThisMonth: 2,
      pendingCount: 1,
      cbmInWarehouse: 1.5,
      incidentsCount: 1,
    });
  });

  it("control del doble: con todo vivo cuentan todas", async () => {
    const { client } = dobleListados(todoVivo(TABLAS));
    expect(await computeWarehouseKpis(client)).toEqual({
      receiptsThisMonth: 4,
      pendingCount: 2,
      cbmInWarehouse: 3,
      incidentsCount: 2,
    });
  });
});
