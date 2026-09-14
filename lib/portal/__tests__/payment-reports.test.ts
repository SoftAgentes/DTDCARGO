/**
 * Tests de "Reportar pago" del portal (SDD-0134).
 *
 * Cubre:
 *  - Validador puro `validatePaymentReportInput` (monto/método/fecha/nota) — la
 *    frontera dura de negocio (no futuros, 2 decimales, método del enum).
 *  - `validateProofFile` / `hasProofFile` — MIME + tamaño del comprobante.
 *  - AISLAMIENTO de las queries: `listMyInvoiceReports` resuelve el markbox del
 *    portal PRIMERO y filtra EXPLÍCITO por `client_markbox` + `invoice_code`; sin
 *    markbox (principal no-cliente) corta SIN tocar la tabla. `countPendingReports`
 *    filtra por tenant + invoice + status.
 *  - Mapper + labels/tonos + tope de pendientes.
 */
import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  validatePaymentReportInput,
  paymentMethodLabel,
  paymentStatusLabel,
  paymentStatusTone,
  MAX_PENDING_REPORTS_PER_INVOICE,
} from "../payment-report-types";
import {
  validateProofFile,
  hasProofFile,
} from "../payment-proof";
import {
  mapPaymentReportRow,
  listMyInvoiceReports,
  listInvoiceReports,
  countPendingReports,
  isAtPendingLimit,
} from "../payment-report-queries";

vi.mock("../portal-queries", () => ({
  getPortalClientPrincipal: async (supabase: SupabaseClient) => {
    const { data } = await supabase.rpc("get_portal_client_markbox");
    if (!data) return null;
    return {
      userId: "portal-user",
      tenantId: "tenant-1",
      client: { markbox: String(data) },
    };
  },
}));

const TODAY = "2026-07-01";

// ── Stub encadenable de SupabaseClient (calca invoices.test.ts) ──
function stub(opts: {
  markbox: string | null;
  rows?: Record<string, unknown>[];
  count?: number;
  queryError?: boolean;
  queryThrow?: boolean;
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
    // Las listas resuelven en `.order()`; el count en `.select({head:true})`
    // → devolvemos el thenable en ambos puntos.
    order: () => opts.queryThrow
      ? Promise.reject(new Error("synthetic_private_transport_detail"))
      : Promise.resolve({ data: opts.queryError ? null : opts.rows ?? [],
        error: opts.queryError ? { code: "57014", message: "synthetic_private_db_detail" } : null }),
    then: undefined,
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

// count usa un builder que resuelve directo (head:true) — stub aparte.
function countStub(count: number) {
  const eqCalls: [string, unknown][] = [];
  const isCalls: [string, unknown][] = [];
  const builder: Record<string, unknown> = {};
  Object.assign(builder, {
    select: () => builder,
    eq: (col: string, val: unknown) => {
      eqCalls.push([col, val]);
      return builder;
    },
    is: (col: string, value: unknown) => { isCalls.push([col, value]); return builder; },
    then: (resolve: (value: { count: number; error: null }) => unknown) =>
      Promise.resolve({ count, error: null }).then(resolve),
  });
  const supabase = {
    from: () => builder,
  } as unknown as SupabaseClient;
  return { supabase, eqCalls, isCalls };
}

describe("validatePaymentReportInput", () => {
  const base = { amount: "150.50", method: "transferencia", paidAt: "2026-06-30", note: "" };

  it("acepta un input válido y normaliza", () => {
    const { input, fieldErrors } = validatePaymentReportInput(base, TODAY);
    expect(fieldErrors).toBeUndefined();
    expect(input).toEqual({
      amount: 150.5,
      method: "transferencia",
      paidAt: "2026-06-30",
      note: null,
    });
  });

  it("acepta coma decimal en el monto", () => {
    const { input } = validatePaymentReportInput({ ...base, amount: "99,90" }, TODAY);
    expect(input?.amount).toBe(99.9);
  });

  it.each(["1.10", "0.29"])("acepta %s sin falso rechazo por coma flotante", (amount) => {
    const result = validatePaymentReportInput({ ...base, amount }, TODAY);
    expect(result.fieldErrors).toBeUndefined();
    expect(result.input?.amount).toBe(Number(amount));
  });

  it("rechaza el año 0000 antes de transportar una fecha incompatible con PostgreSQL", () => {
    const result = validatePaymentReportInput({ ...base, paidAt: "0000-01-01" }, TODAY);
    expect(result.input).toBeUndefined();
    expect(result.fieldErrors?.paidAt).toMatch(/\S/);
  });

  it("rechaza monto <= 0", () => {
    const { fieldErrors } = validatePaymentReportInput({ ...base, amount: "0" }, TODAY);
    expect(fieldErrors?.amount).toBeTruthy();
  });

  it("rechaza más de 2 decimales", () => {
    const { fieldErrors } = validatePaymentReportInput({ ...base, amount: "10.999" }, TODAY);
    expect(fieldErrors?.amount).toBeTruthy();
  });

  it("rechaza método fuera del enum", () => {
    const { fieldErrors } = validatePaymentReportInput({ ...base, method: "cheque" }, TODAY);
    expect(fieldErrors?.method).toBeTruthy();
  });

  it("rechaza fecha futura", () => {
    const { fieldErrors } = validatePaymentReportInput({ ...base, paidAt: "2026-07-02" }, TODAY);
    expect(fieldErrors?.paidAt).toBeTruthy();
  });

  it("rechaza fecha no válida", () => {
    const { fieldErrors } = validatePaymentReportInput({ ...base, paidAt: "2026-13-40" }, TODAY);
    expect(fieldErrors?.paidAt).toBeTruthy();
  });

  it("rechaza nota > 500", () => {
    const { fieldErrors } = validatePaymentReportInput(
      { ...base, note: "x".repeat(501) },
      TODAY,
    );
    expect(fieldErrors?.note).toBeTruthy();
  });
});

describe("validateProofFile / hasProofFile", () => {
  it("acepta un PDF pequeño", () => {
    const f = new File([new Uint8Array([1, 2, 3])], "recibo.pdf", { type: "application/pdf" });
    const res = validateProofFile(f);
    expect(res.ok).toBe(true);
  });

  it("rechaza MIME no permitido", () => {
    const f = new File([new Uint8Array([1])], "x.exe", { type: "application/x-msdownload" });
    const res = validateProofFile(f);
    expect(res.ok).toBe(false);
  });

  it("rechaza archivo demasiado grande", () => {
    const big = new File([new Uint8Array(11 * 1024 * 1024)], "big.png", { type: "image/png" });
    const res = validateProofFile(big);
    expect(res.ok).toBe(false);
  });

  it("hasProofFile distingue vacío de presente", () => {
    expect(hasProofFile(null)).toBe(false);
    expect(hasProofFile(new File([], "x.pdf", { type: "application/pdf" }))).toBe(false);
    expect(
      hasProofFile(new File([new Uint8Array([1])], "x.pdf", { type: "application/pdf" })),
    ).toBe(true);
  });
});

describe("listMyInvoiceReports · aislamiento por markbox", () => {
  it("filtra por invoice_code + client_markbox del cliente", async () => {
    const { supabase, eqCalls, touchedTable } = stub({
      markbox: "DTD-0007",
      rows: [],
    });
    await listMyInvoiceReports(supabase, "F-2026-0001");
    expect(touchedTable()).toBe("payment_reports");
    expect(eqCalls).toContainEqual(["invoice_code", "F-2026-0001"]);
    expect(eqCalls).toContainEqual(["tenant_id", "tenant-1"]);
    expect(eqCalls).toContainEqual(["client_markbox", "DTD-0007"]);
  });

  it("sin markbox (principal no-cliente) → null sin tocar la tabla", async () => {
    const { supabase, touchedTable } = stub({ markbox: null });
    const res = await listMyInvoiceReports(supabase, "F-2026-0001");
    expect(res).toBeNull();
    expect(touchedTable()).toBeNull();
  });
});

describe.each([
  { label: "Portal", list: (client: SupabaseClient) => listMyInvoiceReports(client, "F-2026-0001") },
  { label: "Studio", list: (client: SupabaseClient) => listInvoiceReports(client, { tenantId: "t1", invoiceId: "inv1" }) },
])("listas de reportes · $label", ({ list }) => {
  it("devuelve null ante error DB, no una lista vacía válida", async () => {
    const { supabase } = stub({ markbox: "DTD-0007", queryError: true });
    await expect(list(supabase)).resolves.toBeNull();
  });

  it("devuelve null ante rechazo de transporte, sin propagar detalles", async () => {
    const { supabase } = stub({ markbox: "DTD-0007", queryThrow: true });
    await expect(list(supabase)).resolves.toBeNull();
  });

  it("conserva [] para una lectura exitosa sin reportes", async () => {
    const { supabase } = stub({ markbox: "DTD-0007", rows: [] });
    await expect(list(supabase)).resolves.toEqual([]);
  });
});

describe("countPendingReports", () => {
  it("filtra por tenant + invoice + status reportado", async () => {
    const { supabase, eqCalls, isCalls } = countStub(3);
    const n = await countPendingReports(supabase, {
      tenantId: "t1",
      invoiceId: "inv1",
    });
    expect(n).toBe(3);
    expect(eqCalls).toContainEqual(["tenant_id", "t1"]);
    expect(eqCalls).toContainEqual(["invoice_id", "inv1"]);
    expect(eqCalls).toContainEqual(["status", "reportado"]);
    expect(isCalls).toContainEqual(["cancelled_at", null]);
    expect(isCalls).toContainEqual(["deleted_at", null]);
  });
});

describe("mapPaymentReportRow", () => {
  it("mapea la fila cruda al modelo", () => {
    const r = mapPaymentReportRow({
      id: "r1",
      invoice_id: "inv1",
      invoice_code: "F-2026-0001",
      client_markbox: "DTD-0007",
      amount: "150.50",
      currency: "USD",
      method: "zelle",
      paid_at: "2026-06-30",
      proof_path: "t/inv/r/x.pdf",
      status: "reportado",
      note: null,
      confirmed_by: null,
      confirmed_at: null,
      cancelled_at: "2026-07-01T12:00:00Z",
      cancelled_by: "44000000-0000-4000-8000-000000000004",
      resolution_reason: "Motivo preservado separado de la nota",
      created_at: "2026-07-01T00:00:00Z",
    });
    expect(r.amount).toBe(150.5);
    expect(r.method).toBe("zelle");
    expect(r.status).toBe("reportado");
    expect(r.proofPath).toBe("t/inv/r/x.pdf");
    expect(r).toMatchObject({
      cancelledAt: "2026-07-01T12:00:00Z",
      cancelledBy: "44000000-0000-4000-8000-000000000004",
      resolutionReason: "Motivo preservado separado de la nota",
    });
  });
});

describe("labels / tonos / tope", () => {
  it("labels de método y estado", () => {
    expect(paymentMethodLabel("pago_movil")).toBe("Pago móvil");
    expect(paymentMethodLabel("binance")).toBe("Binance / USDT");
    expect(paymentStatusLabel("confirmado")).toBe("Pago confirmado");
  });
  it("tonos por estado", () => {
    expect(paymentStatusTone("reportado")).toBe("warning");
    expect(paymentStatusTone("confirmado")).toBe("success");
    expect(paymentStatusTone("rechazado")).toBe("danger");
  });
  it("tope de pendientes", () => {
    expect(isAtPendingLimit(MAX_PENDING_REPORTS_PER_INVOICE)).toBe(true);
    expect(isAtPendingLimit(MAX_PENDING_REPORTS_PER_INVOICE - 1)).toBe(false);
  });
});
