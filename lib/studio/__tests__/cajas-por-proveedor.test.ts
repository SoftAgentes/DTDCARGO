/**
 * SDD-0711 · Cajas y CBM por proveedor de un embarque.
 *
 * El doble de Supabase APLICA los filtros `eq`/`is`/`in`: la recepción eliminada y
 * la no consolidada cumplen todo lo demás, así que solo su filtro las deja fuera.
 */
import { describe, expect, it } from "vitest";
import { agruparCajasPorEnvio, estadoDeCajas } from "../cajas-por-proveedor";
import { leerCajasPorProveedor } from "../cajas-por-proveedor-queries";

type Fila = Record<string, unknown>;

function doble(filas: Fila[], error: { message: string } | null = null) {
  const filtros: { op: string; col: string; val: unknown }[] = [];
  const consulta = {
    select: () => consulta,
    in: (col: string, val: unknown[]) => {
      filtros.push({ op: "in", col, val });
      filas = filas.filter((f) => val.includes(f[col]));
      return consulta;
    },
    eq: (col: string, val: unknown) => {
      filtros.push({ op: "eq", col, val });
      filas = filas.filter((f) => f[col] === val);
      return consulta;
    },
    is: (col: string, val: unknown) => {
      filtros.push({ op: "is", col, val });
      filas = filas.filter((f) => (f[col] ?? null) === val);
      return consulta;
    },
    order: () => consulta,
    range: (d: number, h: number) => Promise.resolve({ data: error ? null : filas.slice(d, h + 1), error }),
  };
  return { client: { from: () => consulta } as never, filtros };
}

const rec = (p: Fila): Fila => ({
  shipment_id: "e1", status: "consolidado", deleted_at: null,
  supplier_name: "Acme", boxes: 2, total_cbm: 0.5, ...p,
});

describe("agruparCajasPorEnvio", () => {
  it("suma por proveedor sin distinguir mayúsculas ni espacios y ordena por cajas", () => {
    const r = agruparCajasPorEnvio([
      { shipmentId: "e1", proveedor: "Acme", cajas: 2, cbm: 0.25 },
      { shipmentId: "e1", proveedor: " acme ", cajas: 3, cbm: 0.5 },
      { shipmentId: "e1", proveedor: "Zeta", cajas: 9, cbm: 1.2 },
      { shipmentId: "e1", proveedor: null, cajas: 1, cbm: 0.1 },
    ]);
    expect(r.e1.totalCajas).toBe(15);
    expect(r.e1.totalCbm).toBeCloseTo(2.05, 5);
    expect(r.e1.proveedores.map((p) => [p.proveedor, p.cajas])).toEqual([
      ["Zeta", 9], ["Acme", 5], [null, 1],
    ]);
    expect(r.e1.proveedores[1].cbm).toBeCloseTo(0.75, 5);
  });

  it("cifras basura valen 0 y los envíos sin recepciones no aparecen", () => {
    const r = agruparCajasPorEnvio([{ shipmentId: "e1", proveedor: "A", cajas: Number.NaN, cbm: -3 }]);
    expect(r.e1.totalCajas).toBe(0);
    expect(r.e1.totalCbm).toBe(0);
    expect(r.e2).toBeUndefined();
  });
});

describe("estadoDeCajas", () => {
  it("distingue listo, sin recepción y no disponible", () => {
    const mapa = agruparCajasPorEnvio([{ shipmentId: "e1", proveedor: "A", cajas: 1, cbm: 0 }]);
    expect(estadoDeCajas(mapa, "e1").estado).toBe("listo");
    expect(estadoDeCajas(mapa, "e2").estado).toBe("sin_recepcion");
    expect(estadoDeCajas(null, "e1").estado).toBe("no_disponible");
    expect(estadoDeCajas(undefined, "e1").estado).toBe("no_disponible");
  });
});

describe("leerCajasPorProveedor", () => {
  it("deja fuera la eliminada y la no consolidada, aunque coincidan en todo lo demás", async () => {
    const { client, filtros } = doble([
      rec({}),
      rec({ boxes: 7, deleted_at: "2026-11-01T00:00:00Z" }),
      rec({ boxes: 5, status: "pendiente_consolidacion" }),
      rec({ shipment_id: "otro", boxes: 4 }),
    ]);
    const r = await leerCajasPorProveedor(client, ["e1"]);
    expect(r?.e1.totalCajas).toBe(2);
    expect(r?.otro).toBeUndefined();
    expect(filtros).toContainEqual({ op: "eq", col: "status", val: "consolidado" });
    expect(filtros).toContainEqual({ op: "is", col: "deleted_at", val: null });
  });

  it("control del doble: sin los filtros contaría las tres", async () => {
    const { client } = doble([rec({}), rec({ boxes: 7 }), rec({ boxes: 5 })]);
    const r = await leerCajasPorProveedor(client, ["e1"]);
    expect(r?.e1.totalCajas).toBe(14);
  });

  it("sin envíos devuelve vacío y no consulta; si falla, null (no «sin recepción»)", async () => {
    expect(await leerCajasPorProveedor(doble([]).client, [])).toEqual({});
    expect(await leerCajasPorProveedor(doble([rec({})], { message: "boom" }).client, ["e1"])).toBeNull();
  });
});
