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
  montosPorEmbarque,
  sumarCajas,
  sumarMontos,
  type ContenedorDeEmbarques,
  type ContenedoresDeEmbarques,
} from "../embarques-contenedores";
import {
  leerContenedoresDeEmbarques,
  leerMontosDeContenedores,
  leerRecibidasDeContenedores,
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
        not(col: string, op: string, val: null) {
          if (op !== "is" || val !== null) throw new Error("doble: sólo not(col, 'is', null)");
          filas = filas.filter((f) => (f[col] ?? null) !== null);
          return q;
        },
        range(desde: number, hasta: number) {
          filas = filas.slice(desde, hasta + 1);
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

describe("recibidas (SDD-0661)", () => {
  it("por cliente y por contenedor desde recibidasPorContenedor; sin recepción, null", () => {
    const datos: ContenedoresDeEmbarques = {
      contenedores: [cont("c64", 64), cont("c65", 65)],
      porEmbarque: { a1: "c64", b1: "c64", z1: "c65" },
      cajasPorEmbarque: { a1: 10, b1: 7, z1: 3 },
      recibidasPorContenedor: { c64: { "DTD-1001": 9 } },
    };
    const g = agruparPorContenedor(
      [envio("a1", "DTD-1001"), envio("b1", "DTD-1002"), envio("z1", "DTD-1003")],
      datos,
    );
    const g64 = g.find((x) => x.key === "c64")!;
    // Un cliente sin cajas recibidas en un contenedor con recepción: 0, no null.
    expect(g64.clientes.map((c) => [c.clientMarkbox, c.recibidas])).toEqual([
      ["DTD-1001", 9],
      ["DTD-1002", 0],
    ]);
    expect(g64.recibidas).toBe(9);
    const g65 = g.find((x) => x.key === "c65")!;
    expect(g65.recibidas).toBeNull();
    expect(g65.clientes[0].recibidas).toBeNull();
  });
});

describe("monto a cobrar (SDD-0661)", () => {
  it("por embarque: USD por cobrar y cobrado, borradores sí, anuladas no, otra moneda aparte", () => {
    const m = montosPorEmbarque([
      { shipment_id: "s1", currency: "USD", total_amount: "100.10", paid_amount: "40", status: "borrador" },
      { shipment_id: "s2", currency: "USD", total_amount: 50.2, paid_amount: 50.2, status: "pagada" },
      { shipment_id: "s2", currency: "USD", total_amount: 999, paid_amount: 0, status: "anulada" },
      { shipment_id: "s1", currency: "VES", total_amount: 5000, paid_amount: 0, status: "emitida" },
      { shipment_id: "s3", currency: "USD", total_amount: 1, paid_amount: 0, status: "anulada" },
    ]);
    expect(m).toEqual({
      s1: { facturas: 2, porCobrarUsd: 100.1, cobradoUsd: 40, otraMoneda: 1 },
      s2: { facturas: 1, porCobrarUsd: 50.2, cobradoUsd: 50.2, otraMoneda: 0 },
    });
    // s3 sólo tenía una anulada: no aparece → la vista dice «Sin facturar».
    expect(m.s3).toBeUndefined();
    expect(sumarMontos([{ id: "s1" }, { id: "s2" }, { id: "s3" }], m)).toEqual({
      facturas: 3,
      porCobrarUsd: 150.3,
      cobradoUsd: 90.2,
      otraMoneda: 1,
    });
    expect(sumarMontos([{ id: "s3" }], m).facturas).toBe(0);
  });

  it("la lectura filtra borradas y anuladas en la consulta", async () => {
    const { supabase, consultadas } = doble({
      invoices: [
        { shipment_id: "s1", currency: "USD", total_amount: "10.00", paid_amount: "4.00", status: "borrador", deleted_at: null },
        { shipment_id: "s1", currency: "USD", total_amount: "20.00", paid_amount: "0", status: "emitida", deleted_at: "2026-11-01" },
        { shipment_id: "s2", currency: "USD", total_amount: "30.00", paid_amount: "0", status: "anulada", deleted_at: null },
      ],
    });
    const r = await leerMontosDeContenedores(supabase, {
      contenedores: [],
      porEmbarque: { s1: "c64", s2: "c64" },
    });
    expect(consultadas).toEqual(["invoices"]);
    expect(r).toEqual({
      estado: "lista",
      porEmbarque: { s1: { facturas: 1, porCobrarUsd: 10, cobradoUsd: 4, otraMoneda: 0 } },
    });
  });

  it("si la lectura falla, «no disponible»; sin embarques con contenedor, no consulta", async () => {
    const falla = doble({}, "invoices");
    expect(
      await leerMontosDeContenedores(falla.supabase, { contenedores: [], porEmbarque: { s1: "c64" } }),
    ).toEqual({ estado: "no_disponible" });
    const vacio = doble({});
    expect(await leerMontosDeContenedores(vacio.supabase, { contenedores: [], porEmbarque: {} })).toEqual({
      estado: "lista",
      porEmbarque: {},
    });
    expect(vacio.consultadas).toEqual([]);
  });
});

describe("lectura de recibidas (SDD-0661)", () => {
  it("cuenta las cajas escaneadas de la recepción VE del contenedor, por Shipping Mark", async () => {
    const { supabase } = doble({
      warehouse_receipts_ve: [
        { id: "r64", container_code: "ABCU-779255-0", deleted_at: null },
        { id: "r-borrada", container_code: "ABCU7792550", deleted_at: "2026-11-01" },
        { id: "r-otro", container_code: "ZZZU0000000", deleted_at: null },
      ],
      warehouse_receipt_ve_boxes: [
        { id: "b1", receipt_id: "r64", markbox: "DTD-1001", scanned_at: "2026-11-18T10:00:00Z" },
        { id: "b2", receipt_id: "r64", markbox: "DTD-1001 ", scanned_at: "2026-11-18T10:01:00Z" },
        { id: "b3", receipt_id: "r64", markbox: "DTD-1002", scanned_at: null },
        { id: "b4", receipt_id: "r64", markbox: "DTD-1002", scanned_at: "2026-11-18T10:02:00Z" },
        { id: "b5", receipt_id: "r-borrada", markbox: "DTD-1001", scanned_at: "2026-11-18T10:03:00Z" },
        { id: "b6", receipt_id: "r-otro", markbox: "DTD-1001", scanned_at: "2026-11-18T10:04:00Z" },
      ],
    });
    const r = await leerRecibidasDeContenedores(supabase, [
      { ...cont("c64", 64), containerNo: "ABCU7792550" },
      cont("c65", 65),
    ]);
    // El ISO se compara sin guiones; la recepción borrada no cuenta; el 65 no tiene ISO
    // ni recepción y no aparece (la vista dice «—»).
    expect(r).toEqual({ c64: { "DTD-1001": 2, "DTD-1002": 1 } });
  });

  it("sin ISO no consulta; si una lectura falla, null", async () => {
    const vacio = doble({});
    expect(await leerRecibidasDeContenedores(vacio.supabase, [cont("c64", 64)])).toEqual({});
    expect(vacio.consultadas).toEqual([]);
    const falla = doble({ warehouse_receipts_ve: [{ id: "r64", container_code: "ABCU7792550", deleted_at: null }] }, "warehouse_receipt_ve_boxes");
    expect(
      await leerRecibidasDeContenedores(falla.supabase, [{ ...cont("c64", 64), containerNo: "ABCU7792550" }]),
    ).toBeNull();
  });
});
