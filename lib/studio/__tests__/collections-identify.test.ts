/**
 * Tests de las acciones compartidas de Cobranzas para SDD-0068 (stub Supabase,
 * sin red ni DB; el posting contable y el admin client van mockeados):
 *
 *  - `identifyPaymentFor` (decisión #6): conserva `received_at` ORIGINAL (el
 *    update del recibo NO lo toca y la reclasificación se asienta con esa
 *    fecha), setea invoice_id + snapshots + 'aplicado' + identified_at,
 *    hereda fund_class, sube paid_amount como un cobro normal, y rechaza
 *    recibos ya aplicados / moneda distinta / saldo insuficiente.
 *  - `registerUnidentifiedPaymentFor` (decisión #2): el payload insertado
 *    cumple el CHECK sin-ref ⇔ invoice null (invoice_id null + snapshots null
 *    + 'recibido_sin_ref' + fund_class 'third_party') y el asiento va con la
 *    fecha de recepción.
 *  - `registerCollectionFor` (decisión #4): tercero completo persiste el
 *    pagador y hereda fund_class de la factura; tercero incompleto ⇒
 *    fieldErrors y NO inserta.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const postReceiptMock = vi.fn();
const postUnidentifiedMock = vi.fn();
const postReclassMock = vi.fn();
const voidEntriesMock = vi.fn();

vi.mock("@/lib/studio/accounting/receipt-posting", () => ({
  postReceiptJournalEntry: (...a: unknown[]) => postReceiptMock(...a),
  postUnidentifiedReceiptJournalEntry: (...a: unknown[]) =>
    postUnidentifiedMock(...a),
  postReceiptReclassEntry: (...a: unknown[]) => postReclassMock(...a),
  voidEntriesForReceipt: (...a: unknown[]) => voidEntriesMock(...a),
}));

// Admin client solo lo usa el audit (best-effort) → no-op.
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => ({
    from: () => ({ insert: async () => ({ error: null }) }),
  }),
}));

import {
  identifyPaymentFor,
  registerCollectionFor,
  registerUnidentifiedPaymentFor,
} from "../collections-actions";

type Row = Record<string, unknown>;
type Captured = { table: string; payload: Row; filters: Row };

/**
 * Stub chainable mínimo: select/eq/maybeSingle/single para lecturas,
 * update(...).eq(...) terminal (captura el payload), insert(...).select().single()
 * (captura el payload, devuelve id sintético), rpc y auth.getUser.
 */
function makeStub(opts: {
  receipts?: Row[];
  invoices?: Row[];
  userTenants?: Row[];
  nextReceiptCode?: string;
}) {
  const updates: Captured[] = [];
  const inserts: { table: string; payload: Row }[] = [];
  const tables: Record<string, Row[]> = {
    payment_receipts: opts.receipts ?? [],
    invoices: opts.invoices ?? [],
    user_tenants: opts.userTenants ?? [{ tenant_id: "t1" }],
  };

  function from(table: string) {
    const filters: Row = {};
    let updatePayload: Row | null = null;
    let insertPayload: Row | null = null;
    const match = () =>
      (tables[table] ?? []).find((r) =>
        Object.entries(filters).every(([k, v]) => r[k] === v),
      ) ?? null;

    const chain: Record<string, unknown> = {
      select: () => chain,
      insert: (payload: Row) => {
        insertPayload = payload;
        inserts.push({ table, payload });
        return chain;
      },
      update: (payload: Row) => {
        updatePayload = payload;
        return chain;
      },
      eq: (col: string, val: unknown) => {
        filters[col] = val;
        if (updatePayload) {
          updates.push({ table, payload: updatePayload, filters: { ...filters } });
          return Promise.resolve({ data: null, error: null });
        }
        return chain;
      },
      maybeSingle: () => Promise.resolve({ data: match(), error: null }),
      single: () => {
        if (insertPayload) {
          return Promise.resolve({ data: { id: `${table}-new` }, error: null });
        }
        const row = match();
        return Promise.resolve({
          data: row,
          error: row ? null : { message: "not found" },
        });
      },
    };
    return chain;
  }

  const client = {
    from,
    rpc: async () => ({ data: opts.nextReceiptCode ?? "R-2026-0042", error: null }),
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
  } as unknown as SupabaseClient;

  return { client, updates, inserts };
}

const SIN_REF_RECEIPT: Row = {
  id: "r1",
  tenant_id: "t1",
  receipt_code: "R-2026-0007",
  invoice_id: null,
  amount: 800,
  currency: "USD",
  fx_rate: null,
  received_at: "2026-05-20", // fecha ORIGINAL de recepción de fondos
  application_status: "recibido_sin_ref",
  deleted_at: null,
};

const INVOICE: Row = {
  id: "i1",
  tenant_id: "t1",
  invoice_code: "F-2026-0031",
  client_markbox: "DTD-5452",
  client_name: "Comercial Pérez, C.A.",
  status: "emitida",
  currency: "USD",
  fx_rate: null,
  total_amount: 2000,
  paid_amount: 0,
  fund_class: "third_party",
};

beforeEach(() => {
  postReceiptMock.mockReset().mockResolvedValue({ ok: true, entryId: "je-cobro" });
  postUnidentifiedMock.mockReset().mockResolvedValue({ ok: true, entryId: "je-unid" });
  postReclassMock.mockReset().mockResolvedValue({ ok: true, entryId: "je-reclass" });
  voidEntriesMock.mockReset().mockResolvedValue({ ok: true });
});

// ── identifyPaymentFor (decisión #6 · retroactividad) ─────────
describe("identifyPaymentFor", () => {
  it("identifica: setea factura + snapshots + aplicado + identified_at, SIN tocar received_at", async () => {
    const { client, updates } = makeStub({
      receipts: [SIN_REF_RECEIPT],
      invoices: [INVOICE],
    });

    const r = await identifyPaymentFor(client, "r1", "i1");
    expect(r.ok).toBe(true);
    expect(r.receiptCode).toBe("R-2026-0007");
    expect(r.invoiceCode).toBe("F-2026-0031");
    expect(r.fullyPaid).toBe(false); // 800 de 2000

    const receiptUpdate = updates.find((u) => u.table === "payment_receipts")!;
    expect(receiptUpdate.payload.invoice_id).toBe("i1");
    expect(receiptUpdate.payload.client_markbox).toBe("DTD-5452");
    expect(receiptUpdate.payload.client_name).toBe("Comercial Pérez, C.A.");
    expect(receiptUpdate.payload.application_status).toBe("aplicado");
    expect(receiptUpdate.payload.identified_at).toBeTruthy();
    expect(receiptUpdate.payload.fund_class).toBe("third_party"); // hereda
    // La retroactividad: received_at NO se toca (queda la fecha original).
    expect("received_at" in receiptUpdate.payload).toBe(false);
  });

  it("sube paid_amount + status de la factura como un cobro normal", async () => {
    const { client, updates } = makeStub({
      receipts: [SIN_REF_RECEIPT],
      invoices: [INVOICE],
    });
    await identifyPaymentFor(client, "r1", "i1");

    const invUpdate = updates.find((u) => u.table === "invoices")!;
    expect(invUpdate.payload.paid_amount).toBe(800);
    expect(invUpdate.payload.status).toBe("parcial");
    expect(invUpdate.payload.last_payment_at).toBeTruthy();
  });

  it("la reclasificación se asienta con fecha = received_at ORIGINAL", async () => {
    const { client } = makeStub({
      receipts: [SIN_REF_RECEIPT],
      invoices: [INVOICE],
    });
    await identifyPaymentFor(client, "r1", "i1");

    expect(postReclassMock).toHaveBeenCalledTimes(1);
    const arg = postReclassMock.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.entryDate).toBe("2026-05-20"); // retroactiva, NO hoy
    expect(arg.receiptId).toBe("r1");
    expect(arg.amount).toBe(800);
    expect(arg.tenantId).toBe("t1");
  });

  it("salda la factura cuando el monto cubre el saldo (fullyPaid + pagada)", async () => {
    const { client, updates } = makeStub({
      receipts: [{ ...SIN_REF_RECEIPT, amount: 2000 }],
      invoices: [INVOICE],
    });
    const r = await identifyPaymentFor(client, "r1", "i1");
    expect(r.fullyPaid).toBe(true);
    const invUpdate = updates.find((u) => u.table === "invoices")!;
    expect(invUpdate.payload.status).toBe("pagada");
  });

  it("rechaza un recibo que NO está recibido_sin_ref", async () => {
    const { client, updates } = makeStub({
      receipts: [{ ...SIN_REF_RECEIPT, application_status: "aplicado", invoice_id: "i9" }],
      invoices: [INVOICE],
    });
    const r = await identifyPaymentFor(client, "r1", "i1");
    expect(r.error).toBeDefined();
    expect(updates).toHaveLength(0);
    expect(postReclassMock).not.toHaveBeenCalled();
  });

  it("rechaza moneda distinta entre pago y factura", async () => {
    const { client, updates } = makeStub({
      receipts: [{ ...SIN_REF_RECEIPT, currency: "VES", fx_rate: 36 }],
      invoices: [INVOICE],
    });
    const r = await identifyPaymentFor(client, "r1", "i1");
    expect(r.error).toMatch(/moneda/i);
    expect(updates).toHaveLength(0);
  });

  it("rechaza factura con saldo insuficiente (saldo < monto)", async () => {
    const { client, updates } = makeStub({
      receipts: [{ ...SIN_REF_RECEIPT, amount: 800 }],
      invoices: [{ ...INVOICE, total_amount: 1000, paid_amount: 500 }], // saldo 500
    });
    const r = await identifyPaymentFor(client, "r1", "i1");
    expect(r.error).toMatch(/saldo/i);
    expect(updates).toHaveLength(0);
  });

  it("rechaza facturas no cobrables (borrador/anulada/pagada)", async () => {
    for (const status of ["borrador", "anulada", "pagada"]) {
      const { client } = makeStub({
        receipts: [SIN_REF_RECEIPT],
        invoices: [{ ...INVOICE, status }],
      });
      const r = await identifyPaymentFor(client, "r1", "i1");
      expect(r.error).toBeDefined();
    }
  });
});

// ── registerUnidentifiedPaymentFor (decisión #2) ──────────────
describe("registerUnidentifiedPaymentFor", () => {
  const input = {
    amount: 800,
    currency: "USD" as const,
    fxRate: null,
    cashAccountId: "acc-bank",
    method: "zelle" as const,
    receivedAt: "2026-06-05",
    reference: "ZELLE-991",
    notes: null,
  };

  it("inserta el recibo cumpliendo el CHECK sin-ref ⇔ invoice null", async () => {
    const { client, inserts } = makeStub({ nextReceiptCode: "R-2026-0099" });
    const r = await registerUnidentifiedPaymentFor(client, input);
    expect(r.ok).toBe(true);
    expect(r.receiptCode).toBe("R-2026-0099");

    const ins = inserts.find((i) => i.table === "payment_receipts")!;
    // Lógica del CHECK (0122): recibido_sin_ref ⇔ invoice_id IS NULL.
    expect(ins.payload.application_status).toBe("recibido_sin_ref");
    expect(ins.payload.invoice_id).toBeNull();
    // Snapshots de cliente NULL hasta identificar.
    expect(ins.payload.client_markbox).toBeNull();
    expect(ins.payload.client_name).toBeNull();
    // third_party hasta identificar (luego hereda de la factura).
    expect(ins.payload.fund_class).toBe("third_party");
    expect(ins.payload.received_at).toBe("2026-06-05");
  });

  it("asienta DR caja / CR puente con la fecha de recepción", async () => {
    const { client } = makeStub({});
    await registerUnidentifiedPaymentFor(client, input);
    expect(postUnidentifiedMock).toHaveBeenCalledTimes(1);
    const arg = postUnidentifiedMock.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.entryDate).toBe("2026-06-05");
    expect(arg.cashAccountId).toBe("acc-bank");
    expect(arg.amount).toBe(800);
  });

  it("input inválido ⇒ fieldErrors y NO inserta", async () => {
    const { client, inserts } = makeStub({});
    const r = await registerUnidentifiedPaymentFor(client, {
      ...input,
      amount: 0,
    });
    expect(r.fieldErrors?.amount).toBeDefined();
    expect(inserts).toHaveLength(0);
    expect(postUnidentifiedMock).not.toHaveBeenCalled();
  });
});

// ── registerCollectionFor · pagador + fund_class heredada ─────
describe("registerCollectionFor · SDD-0068", () => {
  const payload = {
    amount: 500,
    cashAccountId: "acc-bank",
    method: "transferencia" as const,
    receivedAt: "2026-06-01",
    reference: null,
    notes: null,
  };

  it("persiste el pagador tercero + hereda fund_class de la factura", async () => {
    const { client, inserts } = makeStub({
      invoices: [{ ...INVOICE, fund_class: "local_revenue" }],
    });
    const r = await registerCollectionFor(client, "i1", {
      ...payload,
      payerKind: "tercero",
      payerName: "María Pérez",
      payerRelation: "familiar",
      licitDeclared: true,
    });
    expect(r.ok).toBe(true);

    const ins = inserts.find((i) => i.table === "payment_receipts")!;
    expect(ins.payload.payer_kind).toBe("tercero");
    expect(ins.payload.payer_name).toBe("María Pérez");
    expect(ins.payload.payer_relation).toBe("familiar");
    expect(ins.payload.licit_declared).toBe(true);
    expect(ins.payload.application_status).toBe("aplicado");
    expect(ins.payload.fund_class).toBe("local_revenue"); // hereda de la factura
    // Cobro normal: SIEMPRE atado a la factura (lado opuesto del CHECK).
    expect(ins.payload.invoice_id).toBe("i1");
    expect(ins.payload.client_markbox).toBe("DTD-5452");
  });

  it("tercero incompleto ⇒ fieldErrors y NO inserta (criterio de aceptación)", async () => {
    const { client, inserts } = makeStub({ invoices: [INVOICE] });
    const r = await registerCollectionFor(client, "i1", {
      ...payload,
      payerKind: "tercero", // sin nombre/relación/licitud
    });
    expect(r.fieldErrors?.payerName).toBeDefined();
    expect(r.fieldErrors?.payerRelation).toBeDefined();
    expect(r.fieldErrors?.licitDeclared).toBeDefined();
    expect(inserts).toHaveLength(0);
  });

  it("cobro del propio cliente: payer default + fund_class third_party de la factura", async () => {
    const { client, inserts } = makeStub({ invoices: [INVOICE] });
    const r = await registerCollectionFor(client, "i1", payload);
    expect(r.ok).toBe(true);
    const ins = inserts.find((i) => i.table === "payment_receipts")!;
    expect(ins.payload.payer_kind).toBe("cliente");
    expect(ins.payload.payer_name).toBeNull();
    expect(ins.payload.licit_declared).toBe(false);
    expect(ins.payload.fund_class).toBe("third_party");
  });
});
