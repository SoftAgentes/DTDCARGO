/**
 * SDD-0674 · EXC-0674 — «Embarques sin facturar» (0574) reconoce las facturas de «Facturar» en
 * Embarques por el vínculo factura ↔ envío ↔ cliente real (`exc0674_envios_cubiertos`, migr 0564).
 *  - Con aliado raíz, la factura lleva el Shipping Mark del aliado y apunta solo al primer embarque. Sin
 *    el vínculo, los embarques seguirían en el reporte; con él, salen todos.
 *  - Una factura anulada vuelve a dejar sus embarques en el reporte.
 *  - Sin la 0564 (la vista no existe), el reporte queda como antes y completo. Otro error se lanza.
 * Datos inventados.
 */
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { reporteSinFacturar } from "../sin-facturar";

const HOY = new Date("2026-12-20T12:00:00Z");

type Fila = Record<string, unknown>;

function doble(tablas: Record<string, Fila[]>, errores: Record<string, { code: string; message: string }> = {}): SupabaseClient {
  return {
    from: (tabla: string) => {
      const filtros: ((r: Fila) => boolean)[] = [];
      let desde = 0;
      let hasta = Infinity;
      const c: Record<string, unknown> = {};
      c.select = () => c;
      c.eq = (col: string, v: unknown) => (filtros.push((r) => r[col] === v), c);
      c.is = (col: string, v: null) => (filtros.push((r) => (r[col] ?? null) === v), c);
      c.in = (col: string, vs: unknown[]) => (filtros.push((r) => vs.includes(r[col])), c);
      c.order = () => c;
      c.range = (a: number, b: number) => ((desde = a), (hasta = b), c);
      c.then = (ok: (v: unknown) => unknown) =>
        ok(errores[tabla]
          ? { data: null, error: errores[tabla] }
          : { data: (tablas[tabla] ?? []).filter((r) => filtros.every((f) => f(r))).slice(desde, hasta + 1), error: null });
      return c;
    },
  } as unknown as SupabaseClient;
}

const rec = (id: string, shipment: string): Fila => ({
  id, receipt_code: `WR-${id}`, client_markbox: "AR-S-0001", received_at: "2026-11-01", status: "consolidado",
  total_cbm: 1, shipment_id: shipment, deleted_at: null, is_orphan: false,
});

function base(estadoFactura: string): Record<string, Fila[]> {
  return {
    warehouse_receipts_cn: [rec("r1", "s1"), rec("r2", "s2"), rec("r3", "s3")],
    shipments: ["s1", "s2", "s3"].map((id) => ({ id, code: `AR-S-0001-${id}`, status: "arrived_destination", arrived_destination_at: "2026-12-10" })),
    // La factura de la regla: Shipping Mark del aliado raíz y solo el primer embarque.
    invoices: [{ id: "f1", invoice_code: "F-2026-0101", shipment_id: "s1", client_markbox: "AR", status: estadoFactura, deleted_at: null }],
    exc0674_envios_cubiertos: ["s1", "s2", "s3"].map((s) => ({
      invoice_id: "f1", invoice_code: "F-2026-0101", shipment_id: s, client_markbox: "AR-S-0001", status: estadoFactura,
    })),
  };
}

describe("reporteSinFacturar · facturas de la EXC-0674", () => {
  it("los tres embarques cubiertos salen del reporte, aunque la factura lleve el Shipping Mark del aliado", async () => {
    const r = await reporteSinFacturar(doble(base("emitida")), HOY);
    expect(r.filas).toEqual([]);
    expect(r.completo).toBe(true);
  });

  it("sin el vínculo (el mismo caso sin la 0564) los tres seguirían en el reporte", async () => {
    const t = base("emitida");
    delete t.exc0674_envios_cubiertos;
    const r = await reporteSinFacturar(
      doble(t, { exc0674_envios_cubiertos: { code: "PGRST205", message: "Could not find the table 'public.exc0674_envios_cubiertos' in the schema cache" } }),
      HOY,
    );
    expect(r.filas.map((f) => f.receiptId).sort()).toEqual(["r1", "r2", "r3"]);
    expect(r.completo).toBe(true);
  });

  it("una factura anulada deja otra vez sus embarques en el reporte", async () => {
    const r = await reporteSinFacturar(doble(base("anulada")), HOY);
    expect(r.filas.map((f) => f.receiptId).sort()).toEqual(["r1", "r2", "r3"]);
  });

  it("un error que no es «no existe» se lanza, como las demás lecturas", async () => {
    await expect(
      reporteSinFacturar(doble(base("emitida"), { exc0674_envios_cubiertos: { code: "57014", message: "canceling statement due to statement timeout" } }), HOY),
    ).rejects.toMatchObject({ message: "canceling statement due to statement timeout" });
  });
});
