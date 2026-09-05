/**
 * Tests del slice "Mis facturas" del Portal del Cliente (SDD-0042 · Fase 3).
 *
 * Cubre:
 *  - Helpers puros de display: `formatInvoiceAmount`, el mapa `INVOICE_TONE_COLOR`
 *    (vía `invoiceStatusTone`) y la derivación visual de "vencida"
 *    (`invoiceDisplayStatus`, reusada del Studio).
 *  - AISLAMIENTO de las queries: `listMyInvoices`/`getMyInvoice` resuelven el
 *    markbox del portal PRIMERO y filtran EXPLÍCITO por `client_markbox` — sin
 *    markbox (principal no-cliente) cortan SIN tocar la tabla. El MISMO hardening
 *    se aplicó a `listMyShipments` (defensa contra el principal team+portal,
 *    donde la policy "by tenant" es permissive OR y, sola, mostraría todo el
 *    tenant en el portal).
 */
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatInvoiceAmount,
  invoiceDisplayStatus,
  invoiceStatusTone,
  INVOICE_TONE_COLOR,
} from "../portal-types";
import { listMyInvoices, getMyInvoice, listMyShipments } from "../portal-queries";

/**
 * Stub encadenable de SupabaseClient. `rpc("get_portal_client_markbox")` →
 * `{ data: markbox }`. El query builder (`from().select().eq()...`) registra los
 * `.eq(col, val)` y la tabla tocada, y resuelve en `.limit()` (listas) o
 * `.maybeSingle()` (detalle).
 */
function stub(opts: {
  markbox: string | null;
  rows?: Record<string, unknown>[];
  row?: Record<string, unknown> | null;
}) {
  const eqCalls: [string, unknown][] = [];
  let touchedTable: string | null = null;
  const builder: Record<string, unknown> = {};
  Object.assign(builder, {
    select: () => builder,
    eq: (col: string, val: unknown) => {
      eqCalls.push([col, val]);
      return builder;
    },
    neq: () => builder,
    is: () => builder,
    order: () => builder,
    limit: () => Promise.resolve({ data: opts.rows ?? [], error: null }),
    maybeSingle: () => Promise.resolve({ data: opts.row ?? null, error: null }),
  });
  const supabase = {
    rpc: (fn: string) =>
      fn === "get_portal_client_markbox"
        ? Promise.resolve({ data: opts.markbox, error: null })
        : Promise.resolve({ data: null, error: null }),
    from: (table: string) => {
      touchedTable = table;
      return builder;
    },
  } as unknown as SupabaseClient;
  return { supabase, eqCalls, touchedTable: () => touchedTable };
}

describe("formatInvoiceAmount", () => {
  it("formatea con código de moneda + miles + 2 decimales", () => {
    expect(formatInvoiceAmount(1250, "USD")).toBe("USD 1,250.00");
    expect(formatInvoiceAmount(1234567.5, "VES")).toBe("VES 1,234,567.50");
    expect(formatInvoiceAmount(0, "USDT")).toBe("USDT 0.00");
  });
  it("monto no finito → 0.00", () => {
    expect(formatInvoiceAmount(Number.NaN, "CNY")).toBe("CNY 0.00");
  });
});

describe("badge de estado de factura", () => {
  it("ningún tono usa wine (wine es sólo para CTAs)", () => {
    for (const c of Object.values(INVOICE_TONE_COLOR)) {
      expect(c.toUpperCase()).not.toBe("#7F0F1A");
    }
  });
  it("mapea tono → token de estado de marca", () => {
    expect(INVOICE_TONE_COLOR[invoiceStatusTone("pagada")]).toBe("#1F8A5B");
    expect(INVOICE_TONE_COLOR[invoiceStatusTone("emitida")]).toBe("#0F1E3D");
    expect(INVOICE_TONE_COLOR[invoiceStatusTone("parcial")]).toBe("#0F1E3D");
  });
  it("invoiceDisplayStatus deriva 'vencida' sin tocar el status crudo", () => {
    const past = "2020-01-01";
    expect(
      invoiceDisplayStatus({ status: "emitida", due_date: past }, "2026-01-01"),
    ).toBe("vencida");
    expect(
      invoiceDisplayStatus({ status: "pagada", due_date: past }, "2026-01-01"),
    ).toBe("pagada"); // pagada nunca vence
    expect(
      invoiceDisplayStatus({ status: "emitida", due_date: null }, "2026-01-01"),
    ).toBe("emitida"); // sin due_date no vence
  });
});

const INV_ROW = {
  id: "inv-1",
  invoice_code: "F-2026-0001",
  client_name: "Demo Pyme C.A.",
  status: "emitida",
  currency: "USD",
  fx_rate: null,
  iva_rate: 0,
  base_amount: 100,
  iva_amount: 0,
  total_amount: 100,
  paid_amount: 40,
  issued_at: "2026-05-01",
  due_date: "2026-06-01",
  lines: [{ desc: "Flete LCL", qty: 1, unitPrice: 100 }],
  notes: null,
  shipment_id: null,
  shipment_code: "DTD-2026-0401",
  created_at: "2026-05-01T00:00:00.000Z",
};

describe("aislamiento — listMyInvoices / getMyInvoice", () => {
  it("sin markbox del portal → [] SIN consultar invoices", async () => {
    const { supabase, touchedTable } = stub({ markbox: null });
    expect(await listMyInvoices(supabase)).toEqual([]);
    expect(touchedTable()).toBeNull();
  });

  it("con markbox → filtra EXPLÍCITO por client_markbox y mapea la fila", async () => {
    const { supabase, eqCalls } = stub({ markbox: "DTD-1004", rows: [INV_ROW] });
    const rows = await listMyInvoices(supabase);
    expect(eqCalls).toContainEqual(["client_markbox", "DTD-1004"]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      code: "F-2026-0001",
      status: "emitida",
      currency: "USD",
      total: 100,
      paid: 40,
      shipmentCode: "DTD-2026-0401",
    });
  });

  it("getMyInvoice sin markbox → null SIN consultar", async () => {
    const { supabase, touchedTable } = stub({ markbox: null });
    expect(await getMyInvoice(supabase, "F-2026-0001")).toBeNull();
    expect(touchedTable()).toBeNull();
  });

  it("getMyInvoice filtra por invoice_code + client_markbox y mapea el detalle", async () => {
    const { supabase, eqCalls } = stub({ markbox: "DTD-1004", row: INV_ROW });
    const inv = await getMyInvoice(supabase, "F-2026-0001");
    expect(eqCalls).toContainEqual(["invoice_code", "F-2026-0001"]);
    expect(eqCalls).toContainEqual(["client_markbox", "DTD-1004"]);
    expect(inv?.base).toBe(100);
    expect(inv?.lines).toHaveLength(1);
    expect(inv?.clientName).toBe("Demo Pyme C.A.");
  });
});

describe("aislamiento — listMyShipments endurecido", () => {
  it("sin markbox → [] SIN consultar shipments", async () => {
    const { supabase, touchedTable } = stub({ markbox: null });
    expect(await listMyShipments(supabase)).toEqual([]);
    expect(touchedTable()).toBeNull();
  });

  it("con markbox → filtra EXPLÍCITO por client_markbox", async () => {
    const SROW = {
      id: "s-1",
      code: "DTD-2026-0401",
      shipment_service: "consolidado_lcl",
      status: "in_transit",
      origin: "Yiwu",
      destination: "Valencia",
      updated_at: "2026-05-20T00:00:00.000Z",
    };
    const { supabase, eqCalls } = stub({ markbox: "DTD-1004", rows: [SROW] });
    const rows = await listMyShipments(supabase);
    expect(eqCalls).toContainEqual(["client_markbox", "DTD-1004"]);
    expect(rows[0]?.code).toBe("DTD-2026-0401");
  });
});
