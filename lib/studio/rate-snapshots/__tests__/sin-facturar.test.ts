/**
 * SDD-0574 · «Embarques sin facturar»: la regla pura (qué cuenta como
 * facturado, la pre-factura, la llegada, el orden y el resumen) y la lectura,
 * con un doble de Supabase que filtra de verdad (`eq`, `is`, `in`, `range`) y
 * devuelve copias.
 */
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  clasificarSinFacturar,
  reporteSinFacturar,
  type EnvioReporte,
  type FacturaReporte,
  type RecepcionReporte,
} from "../sin-facturar";

const HOY = new Date("2026-10-20T12:00:00Z");

const rec = (id: string, markbox: string | null, shipment: string | null, received = "2026-10-01"): RecepcionReporte => ({
  id, receipt_code: `WR-${id}`, client_markbox: markbox, received_at: received, status: "consolidado", total_cbm: 2, shipment_id: shipment,
});
const env = (id: string, status: string, arrived: string | null = null): EnvioReporte => ({
  id, code: `C-${id}`, status, arrived_destination_at: arrived,
});
const fac = (id: string, shipment: string, markbox: string, status: string): FacturaReporte => ({
  id, invoice_code: `F-${id}`, shipment_id: shipment, client_markbox: markbox, status,
});

describe("clasificarSinFacturar", () => {
  const envios = [
    env("s1", "in_transit"),
    env("s2", "arrived_destination"),
    env("s3", "in_customs", "2026-10-15T00:00:00Z"),
    env("s4", "cancelled"),
  ];

  it("una factura fiscal viva del mismo envío y Shipping Mark (normalizado) la saca del reporte", () => {
    for (const status of ["emitida", "parcial", "pagada", "vencida"]) {
      const { filas } = clasificarSinFacturar({
        recepciones: [rec("r1", " dtd-0001 ", "s1")],
        envios,
        facturas: [fac("f1", "s1", "DTD-0001", status)],
        tarifas: {},
        hoy: HOY,
      });
      expect(filas, status).toEqual([]);
    }
  });

  it("también normaliza el Shipping Mark de la factura", () => {
    const { filas } = clasificarSinFacturar({
      recepciones: [rec("r1", "DTD-0001", "s1")],
      envios,
      facturas: [fac("f1", "s1", " dtd-0001 ", "emitida")],
      tarifas: {},
      hoy: HOY,
    });
    expect(filas).toEqual([]);
  });

  it("la factura de otro cliente del mismo contenedor no la cubre", () => {
    const { filas } = clasificarSinFacturar({
      recepciones: [rec("r1", "DTD-0001", "s1")],
      envios,
      facturas: [fac("f1", "s1", "DTD-0002", "emitida")],
      tarifas: { r1: { amount_to_invoice: 1700, per_cbm: 850 } },
      hoy: HOY,
    });
    expect(filas.map((f) => f.receiptId)).toEqual(["r1"]);
  });

  it("un borrador es pre-factura (se dice, pero no cubre) y una anulada no cuenta", () => {
    const { filas } = clasificarSinFacturar({
      recepciones: [rec("r1", "DTD-0001", "s1"), rec("r2", "DTD-0002", "s1")],
      envios,
      facturas: [fac("b1", "s1", "DTD-0001", "borrador"), fac("a1", "s1", "DTD-0002", "anulada")],
      tarifas: {},
      hoy: HOY,
    });
    expect(filas.map((f) => [f.receiptId, f.preFactura])).toEqual([["r1", "F-b1"], ["r2", null]]);
  });

  it("estados: llegó (por estado o por fecha de llegada), sin tarifa y en camino", () => {
    const { filas, resumen } = clasificarSinFacturar({
      recepciones: [
        rec("camino", "DTD-0001", "s1"),
        rec("llego", "DTD-0001", "s2"),
        rec("aduana", "DTD-0001", "s3"),
        rec("sinTarifa", "DTD-0001", null),
      ],
      envios,
      facturas: [],
      tarifas: {
        camino: { amount_to_invoice: 1000, per_cbm: 500 },
        llego: { amount_to_invoice: 300.1, per_cbm: 150.05 },
        aduana: { amount_to_invoice: 200.2, per_cbm: 100.1 },
      },
      hoy: HOY,
    });
    expect(filas.map((f) => [f.receiptId, f.estado])).toEqual([
      ["llego", "llego_sin_factura"],
      ["aduana", "llego_sin_factura"],
      ["sinTarifa", "sin_tarifa"],
      ["camino", "en_camino"],
    ]);
    expect(resumen).toEqual({
      llego_sin_factura: { cantidad: 2, aFacturar: 500.3 },
      sin_tarifa: { cantidad: 1, aFacturar: 0 },
      en_camino: { cantidad: 1, aFacturar: 1000 },
    });
  });

  it("días: desde la llegada si llegó con fecha; si no, desde la recepción", () => {
    const { filas } = clasificarSinFacturar({
      recepciones: [rec("aduana", "DTD-0001", "s3", "2026-09-01"), rec("camino", "DTD-0001", "s1", "2026-10-10")],
      envios,
      facturas: [],
      tarifas: {},
      hoy: HOY,
    });
    expect(Object.fromEntries(filas.map((f) => [f.receiptId, f.dias]))).toEqual({ aduana: 5, camino: 10 });
  });

  it("fuera: envío cancelado y recepción sin Shipping Mark", () => {
    const { filas } = clasificarSinFacturar({
      recepciones: [rec("r1", "DTD-0001", "s4"), rec("r2", "  ", "s1"), rec("r3", null, null)],
      envios,
      facturas: [],
      tarifas: {},
      hoy: HOY,
    });
    expect(filas).toEqual([]);
  });

  it("orden: lo más urgente primero y, dentro, lo más viejo", () => {
    const { filas } = clasificarSinFacturar({
      recepciones: [rec("nuevo", "DTD-0001", null, "2026-10-19"), rec("viejo", "DTD-0001", null, "2026-09-01")],
      envios,
      facturas: [],
      tarifas: {},
      hoy: HOY,
    });
    expect(filas.map((f) => f.receiptId)).toEqual(["viejo", "nuevo"]);
  });
});

// ── La lectura ────────────────────────────────────────────────────────────────

type Fila = Record<string, unknown>;

function doble(tablas: Record<string, Fila[]>, faltan: string[] = []): SupabaseClient {
  return {
    from: (tabla: string) => {
      const filtros: ((r: Fila) => boolean)[] = [];
      let desde = 0;
      let hasta = Infinity;
      const c: Record<string, unknown> = {};
      const filas = () => (tablas[tabla] ?? []).filter((r) => filtros.every((f) => f(r))).slice(desde, hasta + 1).map((r) => ({ ...r }));
      c.select = () => c;
      c.eq = (col: string, v: unknown) => (filtros.push((r) => r[col] === v), c);
      c.is = (col: string, v: null) => (filtros.push((r) => (r[col] ?? null) === v), c);
      c.in = (col: string, vs: unknown[]) => (filtros.push((r) => vs.includes(r[col])), c);
      c.order = () => c;
      c.range = (a: number, b: number) => ((desde = a), (hasta = b), c);
      c.then = (ok: (v: unknown) => unknown) =>
        ok(faltan.includes(tabla)
          ? { data: null, error: { code: "42P01", message: "no existe" } }
          : { data: filas(), error: null });
      return c;
    },
  } as unknown as SupabaseClient;
}

describe("reporteSinFacturar (lectura)", () => {
  const tablas = (): Record<string, Fila[]> => ({
    warehouse_receipts_cn: [
      { ...rec("r1", "DTD-0001", "s1"), deleted_at: null, is_orphan: false },
      { ...rec("r2", "DTD-0002", "s1"), deleted_at: null, is_orphan: false },
      { ...rec("borrada", "DTD-0003", "s1"), deleted_at: "2026-10-02", is_orphan: false },
      { ...rec("huerfana", "DTD-0004", "s1"), deleted_at: null, is_orphan: true },
    ],
    shipments: [{ ...env("s1", "arrived_destination") }, { ...env("otro", "in_transit") }],
    invoices: [
      { ...fac("f1", "s1", "DTD-0001", "emitida"), deleted_at: null },
      { ...fac("f-borrada", "s1", "DTD-0002", "emitida"), deleted_at: "2026-10-05" },
    ],
    shipment_rate_snapshots: [
      { id: "t2", receipt_id: "r2", superseded_at: null, per_cbm: "850.00", amount_to_invoice: "1700.00", min_charge: "0", cbm: "2", included_kg_per_cbm: 500 },
      { id: "t2-vieja", receipt_id: "r2", superseded_at: "2026-10-01", per_cbm: "1.00", amount_to_invoice: "2.00", min_charge: "0", cbm: "2", included_kg_per_cbm: 500 },
    ],
  });

  it("filtra borradas, huérfanas, facturas borradas y tarifas reemplazadas", async () => {
    const r = await reporteSinFacturar(doble(tablas()), HOY);
    expect(r.completo).toBe(true);
    expect(r.tarifasDisponibles).toBe(true);
    expect(r.filas.map((f) => [f.receiptId, f.estado, f.aFacturar])).toEqual([["r2", "llego_sin_factura", 1700]]);
  });

  it("sin la 0496 lo dice y no se rompe", async () => {
    const r = await reporteSinFacturar(doble(tablas(), ["shipment_rate_snapshots"]), HOY);
    expect(r.tarifasDisponibles).toBe(false);
    expect(r.filas.map((f) => [f.receiptId, f.aFacturar])).toEqual([["r2", null]]);
  });
});
