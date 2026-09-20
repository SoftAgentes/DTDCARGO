// @vitest-environment node
/**
 * Tests de navieraKpis (SDD-0047, Slice B) con un stub de SupabaseClient.
 *
 * Cubre el criterio de aceptación §5 Slice B:
 *  "Cerrar contenedor + atar a sailing; KPI del dashboard refleja el conteo".
 *
 * navieraKpis alimenta los KPIs del Dashboard (SDD-0014):
 *  - consolidating  · count de consolidations status='consolidando'
 *  - looseCbm/Count · suma de CBM de la carga suelta derivada (listLooseCargo)
 *  - openSailings   · count de sailings status in (abierto, cutoff)
 */

import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { navieraKpis } from "../queries";

/**
 * Stub keyed por tabla. Cada tabla resuelve a `{ data, count }` configurados.
 * Los métodos de la cadena (select/eq/in/is/not/order/limit) son passthrough; la
 * promesa final entrega data+count. Sirve tanto para los `count head:true` de
 * KPIs como para las lecturas de filas de listLooseCargo.
 */
/** Tope por request del doble: el `db-max-rows` de Supabase. */
const SERVER_CAP = 1000;

function makeClient(
  tables: Record<string, { data?: unknown[]; count?: number }>,
): SupabaseClient {
  return {
    from(table: string) {
      const entry = tables[table] ?? {};
      const chain: Record<string, unknown> = {};
      const passthrough = () => chain;
      for (const m of ["select", "eq", "in", "is", "not", "order", "limit"]) {
        chain[m] = () => passthrough();
      }
      // Terminal paginado: corta en SERVER_CAP por request igual que PostgREST.
      // Si el doble fuera más generoso que el servidor, el KPI saldría verde en
      // el test y truncado en producción.
      chain.range = (desde: number, hasta: number) => {
        const filas = entry.data ?? [];
        const pedido = hasta - desde + 1;
        const trozo = filas.slice(desde, desde + Math.min(pedido, SERVER_CAP));
        return Promise.resolve({ data: trozo, count: entry.count ?? 0, error: null });
      };
      chain.then = (resolve: (v: Record<string, unknown>) => unknown) =>
        Promise.resolve({
          data: entry.data ?? [],
          count: entry.count ?? 0,
          error: null,
        }).then(resolve);
      return chain;
    },
  } as unknown as SupabaseClient;
}

describe("navieraKpis — KPIs del dashboard", () => {
  it("agrega contenedores consolidando + CBM suelto + salidas abiertas", async () => {
    const client = makeClient({
      consolidations: { count: 2 },
      // (1) carga suelta: 2 embarques recibidos, ninguno asignado.
      warehouse_receipts_cn: { data: [{ shipment_id: "s1" }, { shipment_id: "s2" }] },
      consolidation_items: { data: [] },
      shipments: {
        data: [
          { id: "s1", code: "DTDU-1", volume_m3: 8.2, weight_kg: 3000, shipment_service: "consolidado_lcl" },
          { id: "s2", code: "DTDU-2", volume_m3: 5.1, weight_kg: 2000, shipment_service: "consolidado_lcl" },
        ],
      },
      sailings: { count: 3 },
    });

    const kpis = await navieraKpis(client);
    expect(kpis.consolidating).toBe(2);
    expect(kpis.openSailings).toBe(3);
    expect(kpis.looseCount).toBe(2);
    expect(kpis.looseCbm).toBeCloseTo(13.3, 6); // 8.2 + 5.1
  });

  it("sin datos → todo en cero", async () => {
    const client = makeClient({
      consolidations: { count: 0 },
      warehouse_receipts_cn: { data: [] },
      consolidation_items: { data: [] },
      shipments: { data: [] },
      sailings: { count: 0 },
    });
    const kpis = await navieraKpis(client);
    expect(kpis).toEqual({
      consolidating: 0,
      looseCbm: 0,
      looseCount: 0,
      openSailings: 0,
    });
  });

  it("redondea el CBM suelto a 1 decimal", async () => {
    const client = makeClient({
      consolidations: { count: 1 },
      warehouse_receipts_cn: { data: [{ shipment_id: "s1" }] },
      consolidation_items: { data: [] },
      shipments: {
        data: [{ id: "s1", code: "DTDU-1", volume_m3: 3.333, weight_kg: 1000, shipment_service: "consolidado_lcl" }],
      },
      sailings: { count: 1 },
    });
    const kpis = await navieraKpis(client);
    expect(kpis.looseCbm).toBe(3.3);
  });
});
