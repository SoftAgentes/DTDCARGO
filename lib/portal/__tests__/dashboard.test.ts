/**
 * Tests del dashboard de Inicio del portal (SDD-0042 · Fase 5.2).
 *
 * Cubre los criterios de la spec §9.3:
 *  - `getDashboardKpis`: las 4 KPIs cuadran dado un set de envíos/facturas stub —
 *    envíos activos (status no terminal), entregados YTD (delivered del año),
 *    facturado (Σ total no-borrador, moneda dominante), saldo (Σ lo que falta
 *    pagar, recortado a 0 por factura; SDD-0556).
 *  - `getNextArrival`: el próximo envío ACTIVO (degradado: code/ruta/estado/ETA),
 *    null si no hay activo; aislamiento sin markbox.
 *
 * Las KPIs se calculan sobre lo que devuelven `listMyShipments` (filtrada por
 * markbox) y `listMyInvoices` (tenant + markbox del principal, SDD-0462). El stub
 * sirve filas distintas por tabla.
 */
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDashboardKpis, getNextArrival } from "../portal-queries";

/**
 * Stub encadenable. `rpc("get_portal_client_markbox")` → markbox. Con markbox, la
 * sesión es además la de un principal Portal vivo (`auth.getUser()` + vínculo en
 * `client_users`, que resuelve en `.maybeSingle()`), como exige `listMyInvoices`.
 * El query builder (`from(table).select().eq().is().order().limit()`) resuelve en
 * `.limit()` con las filas de esa tabla; `getNextArrival` también usa esta cadena.
 *
 * SDD-0556: las facturas se leen paginadas (`fetchAllPaged` → `.range(from, to)`).
 * El `range` del doble CORTA por offset, como PostgREST: uno que devolviera
 * siempre las mismas filas haría que la lectura no terminara nunca y se
 * declarara incompleta. `invoicesError` simula que la base no responde.
 */
function stub(opts: {
  markbox: string | null;
  shipments?: Record<string, unknown>[];
  invoices?: Record<string, unknown>[];
  invoicesError?: boolean;
}): { supabase: SupabaseClient; touched: () => string[] } {
  const touched: string[] = [];
  const membership = opts.markbox
    ? {
        client_id: "client-1",
        tenant_id: "tenant-1",
        clients: {
          id: "client-1",
          tenant_id: "tenant-1",
          markbox: opts.markbox,
          name: "Cliente demo",
          email: null,
          phone: null,
          address: null,
          rif: null,
          doc_kind: null,
          city: null,
          state: null,
          deleted_at: null,
        },
      }
    : null;
  function builder(rows: Record<string, unknown>[], failing = false) {
    const b: Record<string, unknown> = {};
    Object.assign(b, {
      select: () => b,
      eq: () => b,
      neq: () => b,
      is: () => b,
      order: () => b,
      limit: () => Promise.resolve({ data: rows, error: null }),
      range: (from: number, to: number) =>
        Promise.resolve(
          failing
            ? { data: null, error: { message: "synthetic_db_detail" } }
            : { data: rows.slice(from, to + 1), error: null },
        ),
      maybeSingle: () => Promise.resolve({ data: membership, error: null }),
    });
    return b;
  }
  const supabase = {
    auth: {
      getUser: () =>
        Promise.resolve({
          data: { user: opts.markbox ? { id: "user-1" } : null },
          error: null,
        }),
    },
    rpc: (fn: string) =>
      fn === "get_portal_client_markbox"
        ? Promise.resolve({ data: opts.markbox, error: null })
        : Promise.resolve({ data: null, error: null }),
    from: (table: string) => {
      touched.push(table);
      if (table === "invoices") return builder(opts.invoices ?? [], opts.invoicesError);
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

  it("monedas mixtas → reporta la dominante (mayor saldo por pagar) y marca mixedCurrencies", async () => {
    const invoices = [
      inv({ id: "i1", currency: "USD", total_amount: 300, paid_amount: 0 }),
      inv({ id: "i2", currency: "VES", total_amount: 2000, paid_amount: 0 }),
      inv({ id: "i3", currency: "USD", total_amount: 100, paid_amount: 0 }),
    ];
    const kpis = await getDashboardKpis(
      stub({ markbox: "DTD-1007", invoices }).supabase,
      NOW,
    );
    // VES domina porque es la que más debe (2000 > 400). Antes el comentario
    // decía «mayor total»: con todo sin pagar da lo mismo (SDD-0556 cambió la
    // razón, no este resultado; el caso de abajo es el que cambia).
    expect(kpis.currency).toBe("VES");
    expect(kpis.invoicedTotal).toBe(2000);
    expect(kpis.mixedCurrencies).toBe(true);
  });

  it("SDD-0556 · con deuda en USD y una factura VES pagada, Inicio habla en USD y no dice «al día»", async () => {
    // Antes ganaba VES por su total nominal (2000 > 400): «Saldo pendiente
    // VES 0.00 · al día» con 1 factura pendiente en USD.
    const invoices = [
      inv({ id: "i1", currency: "USD", total_amount: 400, paid_amount: 100 }),
      inv({ id: "i2", currency: "VES", total_amount: 2000, paid_amount: 2000 }),
    ];
    const kpis = await getDashboardKpis(
      stub({ markbox: "DTD-1007", invoices }).supabase,
      NOW,
    );
    expect(kpis.currency).toBe("USD");
    expect(kpis.outstandingBalance).toBe(300);
    expect(kpis.pendingInvoiceCount).toBe(1);
    expect(kpis.mixedCurrencies).toBe(true);
  });

  it("sin markbox del portal → KPIs en cero (las listas cortan sin consultar)", async () => {
    const kpis = await getDashboardKpis(stub({ markbox: null }).supabase, NOW);
    expect(kpis.activeShipments).toBe(0);
    expect(kpis.invoicedTotal).toBe(0);
    expect(kpis.currency).toBe("USD");
    expect(kpis.invoicesAvailable).toBe(true);
  });

  it("SDD-0556 · las anuladas no suman: ni facturado, ni saldo, ni facturas pendientes", async () => {
    // Antes: invoicedTotal 11999, outstandingBalance 11299 y 3 pendientes.
    const invoices = [
      inv({ id: "i1", total_amount: 1000, paid_amount: 400 }),
      inv({ id: "i2", status: "anulada", total_amount: 9999, paid_amount: 0 }),
      inv({ id: "i3", status: "anulada", total_amount: 1000, paid_amount: 300 }),
    ];
    const kpis = await getDashboardKpis(
      stub({ markbox: "DTD-1007", invoices }).supabase,
      NOW,
    );
    expect(kpis.invoicesAvailable).toBe(true);
    expect(kpis.invoicedTotal).toBe(1000);
    expect(kpis.outstandingBalance).toBe(600);
    expect(kpis.pendingInvoiceCount).toBe(1);
    expect(kpis.currency).toBe("USD");
  });

  it("SDD-0556 · el saldo pendiente es lo que falta pagar: un sobrepago no le resta a otra factura", async () => {
    // El recorte por factura es lo que ya hacía Inicio (y lo que muestran
    // Facturas y Finanzas ahora): 1000/1200 no deja «−200» que se coma los 500.
    const invoices = [
      inv({ id: "i1", total_amount: 1000, paid_amount: 1200 }),
      inv({ id: "i2", total_amount: 500, paid_amount: 0 }),
    ];
    const kpis = await getDashboardKpis(
      stub({ markbox: "DTD-1007", invoices }).supabase,
      NOW,
    );
    expect(kpis.outstandingBalance).toBe(500);
    expect(kpis.pendingInvoiceCount).toBe(1);
  });

  it("SDD-0556 · una anulada en otra moneda no decide la moneda dominante", async () => {
    const invoices = [
      inv({ id: "i1", currency: "USD", total_amount: 500, paid_amount: 0 }),
      inv({ id: "i2", currency: "VES", status: "anulada", total_amount: 99999, paid_amount: 0 }),
    ];
    const kpis = await getDashboardKpis(
      stub({ markbox: "DTD-1007", invoices }).supabase,
      NOW,
    );
    expect(kpis.currency).toBe("USD");
    expect(kpis.mixedCurrencies).toBe(false);
    expect(kpis.invoicedTotal).toBe(500);
  });

  it("SDD-0556 · si las facturas no se pueden leer, Inicio no se cae y no dice «al día»", async () => {
    const shipments = [ship({ id: "s1", status: "in_transit" })];
    const kpis = await getDashboardKpis(
      stub({
        markbox: "DTD-1007",
        shipments,
        invoices: [inv({ id: "i1", total_amount: 1000 })],
        invoicesError: true,
      }).supabase,
      NOW,
    );
    // Los envíos siguen; los KPIs de facturas quedan marcados como no
    // disponibles (la tarjeta dice «No disponible», nunca un 0 «al día»).
    expect(kpis.activeShipments).toBe(1);
    expect(kpis.invoicesAvailable).toBe(false);
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
