// @vitest-environment node
/**
 * Tests de listLooseCargo (SDD-0047, Slice A) con un stub de SupabaseClient.
 *
 * Cubre el criterio de aceptación §5 Slice A:
 *  "listLooseCargo devuelve embarques LCL recibidos en CN sin contenedor".
 *
 * Verifica la derivación (§4.3):
 *  1. solo embarques con recepción CN cerrada (warehouse_receipts_cn consolidado),
 *  2. menos los ya asignados a un contenedor (consolidation_items),
 *  3. intersección con shipments shipment_service='consolidado_lcl'.
 */

import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listLooseCargo } from "../queries";

/**
 * Stub keyed por tabla. La cadena ignora filtros (eq/is/in/not/order/select/
 * limit) y resuelve a las filas configuradas. Suficiente porque la lógica de
 * filtrado real (status consolidado, shipment_service, excluir asignados) vive
 * en cómo se configuran las filas + en el JS de listLooseCargo (no en el server).
 *
 * Para el caso (3) sí respetamos `.in("id", ...)` para confirmar que la query
 * solo pide los candidatos correctos.
 */
/** Tope por request del doble: el `db-max-rows` de Supabase. */
const SERVER_CAP = 1000;

function makeClient(
  tables: Record<string, unknown[]>,
  capture?: { inIds?: string[] },
): SupabaseClient {
  return {
    from(table: string) {
      const rows = tables[table] ?? [];
      const chain: Record<string, unknown> = {};
      const passthrough = () => chain;
      for (const m of ["eq", "is", "not", "order", "select", "limit"]) {
        chain[m] = () => passthrough();
      }
      chain.in = (_col: string, ids: string[]) => {
        if (capture && table === "shipments") capture.inIds = ids;
        return passthrough();
      };
      // Terminal paginado, cortando en SERVER_CAP por request igual que
      // PostgREST. Sin esto el doble sería más generoso que el servidor y el
      // test saldría verde con código que en producción trunca.
      chain.range = (desde: number, hasta: number) => {
        const pedido = hasta - desde + 1;
        const trozo = rows.slice(desde, desde + Math.min(pedido, SERVER_CAP));
        return Promise.resolve({ data: trozo, error: null });
      };
      chain.then = (resolve: (v: Record<string, unknown>) => unknown) =>
        Promise.resolve({ data: rows, error: null }).then(resolve);
      return chain;
    },
  } as unknown as SupabaseClient;
}

describe("listLooseCargo — carga suelta derivada", () => {
  it("devuelve embarques consolidado_lcl recibidos en CN sin contenedor", async () => {
    const capture: { inIds?: string[] } = {};
    const client = makeClient(
      {
        // (1) 3 embarques con recepción CN cerrada (consolidado).
        warehouse_receipts_cn: [
          { shipment_id: "s1" },
          { shipment_id: "s2" },
          { shipment_id: "s3" },
          { shipment_id: "s1" }, // duplicado (otra caja del mismo embarque) → dedup
        ],
        // (2) s2 ya está asignado a un contenedor.
        consolidation_items: [{ shipment_id: "s2" }],
        // (3) shipments consolidado_lcl entre los candidatos (s1, s3).
        // El stub no aplica .in, así que devolvemos solo los que corresponden.
        shipments: [
          {
            id: "s1",
            code: "DTDU-419032",
            client_name: "Imp. Pereira",
            client_markbox: "DTD-5418",
            weight_kg: 3400,
            volume_m3: 8.2,
            shipment_service: "consolidado_lcl",
          },
          {
            id: "s3",
            code: "DTDU-472816",
            client_name: "Salazar Trading",
            client_markbox: "DTD-5321",
            weight_kg: 2200,
            volume_m3: 5.1,
            shipment_service: "consolidado_lcl",
          },
        ],
      },
      capture,
    );

    const loose = await listLooseCargo(client);

    // candidatos = recibidos (s1,s2,s3 dedup) menos asignados (s2) = s1, s3.
    expect(capture.inIds?.sort()).toEqual(["s1", "s3"]);
    expect(loose).toHaveLength(2);
    expect(loose.map((l) => l.shipment_id).sort()).toEqual(["s1", "s3"]);

    const s1 = loose.find((l) => l.shipment_id === "s1")!;
    expect(s1.code).toBe("DTDU-419032");
    expect(s1.client_markbox).toBe("DTD-5418");
    expect(s1.cbm).toBe(8.2);
    expect(s1.weight_kg).toBe(3400);
  });

  it("sin recepciones cerradas → lista vacía (no consulta shipments)", async () => {
    const capture: { inIds?: string[] } = {};
    const client = makeClient(
      {
        warehouse_receipts_cn: [],
        consolidation_items: [],
        shipments: [{ id: "s9" }],
      },
      capture,
    );
    const loose = await listLooseCargo(client);
    expect(loose).toEqual([]);
    expect(capture.inIds).toBeUndefined(); // short-circuit antes de shipments
  });

  it("todos los recibidos ya asignados → lista vacía", async () => {
    const capture: { inIds?: string[] } = {};
    const client = makeClient(
      {
        warehouse_receipts_cn: [{ shipment_id: "s1" }, { shipment_id: "s2" }],
        consolidation_items: [{ shipment_id: "s1" }, { shipment_id: "s2" }],
        shipments: [],
      },
      capture,
    );
    const loose = await listLooseCargo(client);
    expect(loose).toEqual([]);
    expect(capture.inIds).toBeUndefined(); // short-circuit: candidatos vacíos
  });
});
