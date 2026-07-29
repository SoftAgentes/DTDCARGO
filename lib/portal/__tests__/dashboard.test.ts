/**
 * Tests del dashboard de Inicio del portal (SDD-0042 · Fase 5.2).
 *
 * Cubre los criterios de la spec §9.3:
 *  - `getDashboardKpis`: las 4 KPIs cuadran dado un set de envíos/facturas stub —
 *    envíos activos (status no terminal), entregados YTD (delivered del año),
 *    facturado (Σ total no-borrador, moneda dominante), saldo (Σ total − paid).
 *  - `getNextArrival`: el próximo envío ACTIVO (degradado: code/ruta/estado/ETA),
 *    null si no hay activo; aislamiento sin markbox.
 *
 * Las KPIs se calculan sobre lo que devuelven `listMyShipments`/`listMyInvoices`
 * (filtradas por markbox). El stub sirve filas distintas por tabla.
 */
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDashboardKpis, getNextArrival } from "../portal-queries";

/**
 * Stub encadenable. `rpc("get_portal_client_markbox")` → markbox. El query builder
 * (`from(table).select().eq().is().order().limit()`) resuelve en `.limit()` con las
 * filas de esa tabla; `getNextArrival` también usa esta cadena (resuelve en limit).
 */
function stub(opts: {
  markbox: string | null;
  shipments?: Record<string, unknown>[];
  invoices?: Record<string, unknown>[];
}): { supabase: SupabaseClient; touched: () => string[] } {
  const touched: string[] = [];
  function builder(rows: Record<string, unknown>[]) {
    const b: Record<string, unknown> = {};
    Object.assign(b, {
      select: () => b,
      eq: () => b,
      neq: () => b,
      is: () => b,
      order: () => b,
      limit: () => Promise.resolve({ data: rows, error: null }),
    });
    return b;
  }
  const supabase = {
    rpc: (fn: string) =>
      fn === "get_portal_client_markbox"
        ? Promise.resolve({ data: opts.markbox, error: null })
        : Promise.resolve({ data: null, error: null }),
    from: (table: string) => {
      touched.push(table);
      if (table === "invoices") return builder(opts.invoices ?? []);
      return builder(opts.shipments ?? []);
    },
  } as unknown as SupabaseClient;
  return { supabase, touched: () => touched };
}

const NOW = new Date("2026-06-02T00:00:00.000Z");

function ship(over: Record<string, unknown>): Record<string, unknown> {
  return {
    id: "s",
    code: "DTD-2026-0001",
    shipment_service: "consolidado_lcl",
    status: "in_transit",
    origin: "Yiwu",
    destination: "Valencia",
    updated_at: "2026-05-20T00:00:00.000Z",
    arrived_destination_at: null,
    created_at: "2026-04-01T00:00:00.000Z",
    ...over,
  };
}

function inv(over: Record<string, unknown>): Record<string, unknown> {
  return {
    id: "i",
    invoice_code: "F-2026-0001",
    status: "emitida",
    currency: "USD",
    total_amount: 100,
    paid_amount: 0,
    issued_at: "2026-05-01",
    due_date: "2026-06-01",
    shipment_code: "DTD-2026-0001",
    ...over,
  };
}

describe("getDashboardKpis — las 4 KPIs", () => {
  it("cuenta activos, entregados YTD, facturado y saldo en la moneda dominante", async () => {
    const shipments = [
      ship({ id: "s1", status: "in_transit" }), // activo
      ship({ id: "s2", status: "in_warehouse" }), // activo
      ship({
        id: "s3",
        status: "delivered",
        updated_at: "2026-03-10T00:00:00.000Z",
      }), // entregado este año
      ship({
        id: "s4",
        status: "delivered",
        updated_at: "2025-12-10T00:00:00.000Z",
      }), // entregado año pasado → no YTD
      ship({ id: "s5", status: "arrived_destination" }), // terminal (no activo)
      ship({ id: "s6", status: "cancelled" }), // terminal (no activo)
    ];
    const invoices = [
      inv({ id: "i1", total_amount: 1000, paid_amount: 400 }), // saldo 600
      inv({ id: "i2", total_amount: 500, paid_amount: 500 }), // saldo 0
    ];

    const kpis = await getDashboardKpis(
      stub({ markbox: "DTD-1007", shipments, invoices }).supabase,
      NOW,
    );

    expect(kpis.activeShipments).toBe(2);
    expect(kpis.deliveredYtd).toBe(1);
    expect(kpis.invoicedTotal).toBe(1500);
    expect(kpis.outstandingBalance).toBe(600);
    expect(kpis.pendingInvoiceCount).toBe(1);
    expect(kpis.currency).toBe("USD");
    expect(kpis.mixedCurrencies).toBe(false);
  });

  it("sin facturas → montos en 0 y moneda default USD", async () => {
    const kpis = await getDashboardKpis(
      stub({ markbox: "DTD-1007", shipments: [], invoices: [] }).supabase,
      NOW,
    );
    expect(kpis.activeShipments).toBe(0);
    expect(kpis.invoicedTotal).toBe(0);
    expect(kpis.outstandingBalance).toBe(0);
    expect(kpis.pendingInvoiceCount).toBe(0);
    expect(kpis.currency).toBe("USD");
  });

  it("monedas mixtas → reporta la dominante (mayor total) y marca mixedCurrencies", async () => {
    const invoices = [
      inv({ id: "i1", currency: "USD", total_amount: 300, paid_amount: 0 }),
      inv({ id: "i2", currency: "VES", total_amount: 2000, paid_amount: 0 }),
      inv({ id: "i3", currency: "USD", total_amount: 100, paid_amount: 0 }),
    ];
    const kpis = await getDashboardKpis(
      stub({ markbox: "DTD-1007", invoices }).supabase,
      NOW,
    );
    // VES domina (2000 > 400).
    expect(kpis.currency).toBe("VES");
    expect(kpis.invoicedTotal).toBe(2000);
    expect(kpis.mixedCurrencies).toBe(true);
  });

  it("sin markbox del portal → KPIs en cero (las listas cortan sin consultar)", async () => {
    const kpis = await getDashboardKpis(stub({ markbox: null }).supabase, NOW);
    expect(kpis.activeShipments).toBe(0);
    expect(kpis.invoicedTotal).toBe(0);
    expect(kpis.currency).toBe("USD");
  });
});

describe("getNextArrival — próximo arribo (degradado)", () => {
  it("devuelve el primer envío ACTIVO con ETA estimada", async () => {
    const shipments = [
      ship({
        id: "s1",
        code: "DTD-2026-0009",
        status: "in_transit",
        service: "consolidado_lcl",
        created_at: "2026-05-01T00:00:00.000Z",
      }),
    ];
    const arrival = await getNextArrival(
      stub({ markbox: "DTD-1007", shipments }).supabase,
    );
    expect(arrival).not.toBeNull();
    expect(arrival?.code).toBe("DTD-2026-0009");
    expect(arrival?.status).toBe("in_transit");
    expect(arrival?.origin).toBe("Yiwu");
    // ETA estimada presente (consolidación = 45 días sobre createdAt).
    expect(arrival?.etaIso).not.toBeNull();
  });

  it("salta los terminales y toma el primer activo", async () => {
    const shipments = [
      ship({ id: "s1", status: "delivered" }), // terminal → skip
      ship({ id: "s2", status: "cancelled" }), // terminal → skip
      ship({ id: "s3", code: "DTD-ACT", status: "in_warehouse" }), // activo
    ];
    const arrival = await getNextArrival(
      stub({ markbox: "DTD-1007", shipments }).supabase,
    );
    expect(arrival?.code).toBe("DTD-ACT");
  });

  it("sin envíos activos → null (el card se oculta)", async () => {
    const shipments = [
      ship({ id: "s1", status: "delivered" }),
      ship({ id: "s2", status: "arrived_destination" }),
    ];
    const arrival = await getNextArrival(
      stub({ markbox: "DTD-1007", shipments }).supabase,
    );
    expect(arrival).toBeNull();
  });

  it("sin markbox del portal → null", async () => {
    const arrival = await getNextArrival(stub({ markbox: null }).supabase);
    expect(arrival).toBeNull();
  });
});
