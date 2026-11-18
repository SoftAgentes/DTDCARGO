/**
 * SDD-0661 · Cajas por cliente y por contenedor (de `consolidation_items.pieces`)
 * y monto a cobrar por contenedor (de `invoices`). Datos inventados.
 *
 * El doble de Supabase SÍ filtra por `.in`, `.is` y `.neq`: uno que no filtra
 * dejaría pasar la prueba sin mirar nada.
 */
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  agruparPorContenedor,
  montosPorContenedor,
  sumarCajas,
  type ContenedorDeEmbarques,
  type ContenedoresDeEmbarques,
} from "../embarques-contenedores";
import {
  leerContenedoresDeEmbarques,
  leerMontosDeContenedores,
} from "../embarques-contenedores-queries";
import type { ShipmentListRow } from "../shipment-queries";

type Fila = Record<string, unknown>;

function doble(tablas: Record<string, Fila[]>, falla?: string) {
  const consultadas: string[] = [];
  const cliente = {
    from(tabla: string) {
      consultadas.push(tabla);
      let filas = [...(tablas[tabla] ?? [])];
      const q = {
        select: () => q,
        in(col: string, vals: string[]) {
          filas = filas.filter((f) => vals.includes(String(f[col])));
          return q;
        },
        is(col: string, val: null) {
          filas = filas.filter((f) => (f[col] ?? null) === val);
          return q;
        },
        neq(col: string, val: unknown) {
          filas = filas.filter((f) => f[col] !== val);
          return q;
        },
        order(col: string, o: { ascending: boolean }) {
          filas.sort((a, b) => String(a[col]).localeCompare(String(b[col])) * (o.ascending ? 1 : -1));
          return q;
        },
        then(res: (r: { data: Fila[] | null; error: unknown }) => unknown) {
          return Promise.resolve(
            falla === tabla ? { data: null, error: { message: "x" } } : { data: filas, error: null },
          ).then(res);
        },
      };
      return q;
    },
  };
  return { supabase: cliente as unknown as SupabaseClient, consultadas };
}

function cont(id: string, numeroDtd: number): ContenedorDeEmbarques {
  return {
    id, ref: `DTD-CONSOL-${id}`, containerNo: null, numeroDtd, status: "zarpado",
    naviera: null, eta: null, createdAt: "2026-10-01T00:00:00Z",
  };
}

function envio(id: string, markbox: string, over: Partial<ShipmentListRow> = {}): ShipmentListRow {
  return {
    id, code: id.toUpperCase(), client_name: `Cliente ${markbox}`, client_markbox: markbox,
    origin: "Yiwu", destination: "La Guaira", shipment_service: "puerta_a_puerta_DDP",
    status: "in_transit", weight_kg: null, volume_m3: 1, created_at: "2026-10-02T10:00:00Z",
    ...over,
  } as ShipmentListRow;
}

describe("cajas (SDD-0661)", () => {
  it("la lectura toma pieces de la asignación vigente, no de una vieja", async () => {
    const { supabase } = doble({
      consolidation_items: [
        { shipment_id: "s1", consolidation_id: "c-viejo", created_at: "2026-09-01T00:00:00Z", pieces: 99 },
        { shipment_id: "s1", consolidation_id: "c64", created_at: "2026-09-29T00:00:00Z", pieces: 12 },
        { shipment_id: "s2", consolidation_id: "c64", created_at: "2026-09-29T00:00:00Z", pieces: 3 },
        { shipment_id: "s3", consolidation_id: "c64", created_at: "2026-09-29T00:00:00Z", pieces: null },
      ],
      consolidations: [
        { id: "c64", ref: "R64", status: "zarpado", notes: "contenedor DTD #64", sailing_id: null,
          created_at: "2026-09-29T00:00:00Z", deleted_at: null },
        { id: "c-viejo", ref: "RV", status: "arribado", notes: null, sailing_id: null,
          created_at: "2026-09-01T00:00:00Z", deleted_at: null },
      ],
    });
    const r = await leerContenedoresDeEmbarques(supabase, ["s1", "s2", "s3"]);
    expect(r!.cajasPorEmbarque).toEqual({ s1: 12, s2: 3, s3: 0 });
  });

  it("suma por cliente y por contenedor; «Sin contenedor» no inventa cajas", () => {
    const filas = [
      envio("a1", "DTD-1001"),
      envio("a2", "DTD-1001"),
      envio("b1", "DTD-1002"),
      envio("f1", "DTD-9000", { shipment_service: "fcl_directo" }),
      envio("suelto", "DTD-1003"),
    ];
    const datos: ContenedoresDeEmbarques = {
      contenedores: [cont("c64", 64), cont("c63", 63)],
      porEmbarque: { a1: "c64", a2: "c64", b1: "c64", f1: "c63" },
      cajasPorEmbarque: { a1: 10, a2: 5, b1: 7, f1: 0 },
    };
    const g = agruparPorContenedor(filas, datos);
    const g64 = g.find((x) => x.key === "c64")!;
    expect(g64.clientes.map((c) => [c.clientMarkbox, c.cajas])).toEqual([
      ["DTD-1001", 15],
      ["DTD-1002", 7],
    ]);
    expect(g64.cajas).toBe(22);
    // El FCL del dueño se carga con 0 cajas: suma 0, no «sin dato».
    expect(g.find((x) => x.key === "c63")!.cajas).toBe(0);
    const sin = g.find((x) => x.contenedor === null)!;
    expect(sin.cajas).toBeNull();
    expect(sin.clientes[0].cajas).toBeNull();
  });

  it("con filtro, suma sólo lo que se ve", () => {
    const datos: ContenedoresDeEmbarques = {
      contenedores: [cont("c64", 64)],
      porEmbarque: { a1: "c64", a2: "c64" },
      cajasPorEmbarque: { a1: 10, a2: 5 },
    };
    const todas = [envio("a1", "DTD-1001"), envio("a2", "DTD-1002")];
    const g = agruparPorContenedor([todas[0]], datos, todas);
    expect(g[0].cajas).toBe(10);
  });

  it("sumarCajas: un embarque sin dato suma 0", () => {
    expect(sumarCajas([{ id: "x" }, { id: "y" }], { x: 4 })).toBe(4);
  });
});

describe("monto a cobrar (SDD-0661)", () => {
  const porEmbarque = { s1: "c64", s2: "c64", s3: "c65" };

  it("suma total_amount en USD, cuenta borradores, excluye anuladas y no inventa un 0", () => {
    const m = montosPorContenedor(
      [
        { shipment_id: "s1", currency: "USD", total_amount: "100.10", status: "borrador" },
        { shipment_id: "s2", currency: "USD", total_amount: 50.2, status: "emitida" },
        { shipment_id: "s2", currency: "USD", total_amount: 999, status: "anulada" },
        { shipment_id: "s1", currency: "VES", total_amount: 5000, status: "emitida" },
        { shipment_id: "fuera", currency: "USD", total_amount: 7, status: "emitida" },
        { shipment_id: "s3", currency: "USD", total_amount: 1, status: "anulada" },
      ],
      porEmbarque,
    );
    expect(m).toEqual({ c64: { facturas: 3, totalUsd: 150.3, otraMoneda: 1 } });
    // c65 sólo tenía una anulada: no aparece → la vista dice «sin facturar».
    expect(m.c65).toBeUndefined();
  });

  it("la lectura filtra borradas y anuladas en la consulta", async () => {
    const { supabase, consultadas } = doble({
      invoices: [
        { shipment_id: "s1", currency: "USD", total_amount: "10.00", status: "borrador", deleted_at: null },
        { shipment_id: "s1", currency: "USD", total_amount: "20.00", status: "emitida", deleted_at: "2026-11-01" },
        { shipment_id: "s2", currency: "USD", total_amount: "30.00", status: "anulada", deleted_at: null },
      ],
    });
    const r = await leerMontosDeContenedores(supabase, { contenedores: [], porEmbarque });
    expect(consultadas).toEqual(["invoices"]);
    expect(r).toEqual({ estado: "lista", porContenedor: { c64: { facturas: 1, totalUsd: 10, otraMoneda: 0 } } });
  });

  it("si la lectura falla, «no disponible»; sin embarques con contenedor, no consulta", async () => {
    const falla = doble({}, "invoices");
    expect(await leerMontosDeContenedores(falla.supabase, { contenedores: [], porEmbarque })).toEqual({
      estado: "no_disponible",
    });
    const vacio = doble({});
    expect(await leerMontosDeContenedores(vacio.supabase, { contenedores: [], porEmbarque: {} })).toEqual({
      estado: "lista",
      porContenedor: {},
    });
    expect(vacio.consultadas).toEqual([]);
  });
});
