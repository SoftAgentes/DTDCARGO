// @vitest-environment node
/** C1: handlers y delegados reales; sólo sesión, almacenamiento y poster son E/S sintética.
 * No prueba transacciones SQL ni RLS: la fixture valida argumentos y cardinalidad,
 * y el contrato 0499/HTTP comprueba esos límites por separado. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isCalendarDate } from "@/lib/shared/fechas-caracas";
const io = vi.hoisted(() => ({ client: vi.fn(), guard: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/db/server", () => ({ createClient: io.client }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: io.client }));
vi.mock("@/lib/studio/rbac-guard", () => ({ moduleEditDenial: io.guard, moduleViewDenial: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/studio/accounting/receipt-posting", () => ({ postReceiptJournalEntry: io.post, postUnidentifiedReceiptJournalEntry: io.post, postReceiptReclassEntry: vi.fn(), voidEntriesForReceipt: vi.fn() }));
vi.mock("@/lib/studio/accounting/bill-posting", () => ({ postBillJournalEntry: io.post, voidBillJournalEntry: vi.fn() }));
vi.mock("@/lib/studio/accounting/supplier-payment-posting", () => ({ postSupplierPaymentJournalEntry: io.post, voidSupplierPaymentJournalEntry: vi.fn() }));
import { registerCollection, registerUnidentifiedPayment } from "@/app/studio/(app)/cobranzas/actions";
import { createBill, registerPayment as payBill } from "@/app/studio/(app)/tesoreria/actions";
import { registerPayment as collectInvoice } from "@/app/studio/(app)/facturacion/actions";
import { registerCollectionFor } from "@/lib/studio/collections-actions";
import { createBillFor, registerPaymentFor } from "@/lib/studio/treasury/treasury-actions";

type Row = Record<string, unknown>;
type Phase = "session" | "guard" | "read";
function setup(cross: Phase, denied = false) {
  const writes: { table: string; values: Row }[] = [], calls: { name: string; args: Row }[] = [], reads: string[] = [];
  const jump = (phase: Phase) => { if (cross === phase) vi.setSystemTime(new Date("2026-10-21T04:00:00Z")); };
  const invoice = { id: "i1", tenant_id: "t1", invoice_code: "F-C1", status: "emitida", currency: "USD", fx_rate: null, total_amount: 100.25, paid_amount: 0, client_markbox: "SINTETICO", client_name: "Cliente ficticio", fund_class: "own" };
  const bill = { id: "b1", tenant_id: "t1", bill_code: "CXP-C1", status: "pendiente", currency: "USD", fx_rate: null, total_amount: 100.25, paid_amount: 0 };
  const tables: Record<string, Row[]> = { invoices: [invoice], supplier_bills: [bill], user_tenants: [{ tenant_id: "t1" }], suppliers: [{ id: "s1", name: "Proveedor ficticio" }] };
  const client = {
    from(table: string) {
      const filters: [string, unknown][] = []; let columns = "*", insert: Row | null = null;
      const execute = () => {
        if (insert) { writes.push({ table, values: insert }); return { data: { id: table + "-new", ...insert }, error: null }; }
        reads.push(table); jump("read");
        const matches = (tables[table] ?? []).filter(row => filters.every(([key, value]) => row[key] === value));
        if (matches.length !== 1) return { data: null, error: { code: "PGRST116" } };
        const row = matches[0];
        return { data: columns === "*" ? row : Object.fromEntries(columns.split(",").map(c => [c.trim(), row[c.trim()]])), error: null };
      };
      const q = { select: (value: string) => { columns = value; return q; }, eq: (key: string, value: unknown) => { filters.push([key, value]); return q; },
        insert: (value: Row) => { insert = value; return q; }, single: async () => execute(), maybeSingle: async () => execute(),
      };
      return q;
    },
    async rpc(name: string, args: Row) {
      calls.push({ name, args });
      if (name === "next_receipt_code" || name === "next_bill_code") {
        if (args.p_tenant_id !== "t1") throw Error("synthetic foreign tenant");
        return { data: name === "next_receipt_code" ? "R-C1" : "CXP-C1", error: null };
      }
      const collection = name === "register_collection_receipt";
      if (!collection && name !== "register_supplier_payment_order") throw Error("unexpected RPC " + name);
      const target = collection ? invoice : bill;
      const day = collection ? args.p_received_at : args.p_paid_at;
      if (args[collection ? "p_invoice_id" : "p_bill_id"] !== target.id || !isCalendarDate(day)
          || Number(args.p_amount) <= 0 || Number(args.p_amount) > target.total_amount || args.p_cash_account_id !== "cash") {
        return { data: null, error: { message: "PAYMENT_INPUT" } };
      }
      writes.push({ table: collection ? "payment_receipts" : "supplier_payments", values: { day, amount: args.p_amount } });
      return { data: { receipt_id: "r1", receipt_code: "R-C1", payment_id: "p1", payment_code: "OP-C1", tenant_id: "t1", currency: "USD", fx_rate: null, fully_paid: false }, error: null };
    },
  } as unknown as SupabaseClient;
  io.client.mockImplementation(async () => { jump("session"); return client; });
  io.guard.mockImplementation(async () => { jump("guard"); return denied ? "Acceso denegado" : null; });
  return { client, writes, calls, reads };
}
const payment = { amount: 10.25, cashAccountId: "cash", method: "transferencia", currency: "USD" };
const billInput = { supplierId: "s1", expenseAccountId: "cost", totalAmount: 10.25, dueDate: "2026-11-20", currency: "USD" };
const operations = [
  { name: "factura/cobro", field: "receivedAt", payload: payment, run: (p: Row | null) => collectInvoice("i1", p as Parameters<typeof collectInvoice>[1]) },
  { name: "cobranzas/cobro", field: "receivedAt", payload: payment, run: (p: Row | null) => registerCollection("i1", p as Parameters<typeof registerCollection>[1]) },
  { name: "cobranzas/sin identificar", field: "receivedAt", payload: payment, run: (p: Row | null) => registerUnidentifiedPayment(p as Parameters<typeof registerUnidentifiedPayment>[0]) },
  { name: "tesorería/alta", field: "issueDate", payload: billInput, run: (p: Row | null) => createBill(p as Parameters<typeof createBill>[0]) },
  { name: "tesorería/pago", field: "paidAt", payload: payment, run: (p: Row | null) => payBill("b1", p as Parameters<typeof payBill>[1]) },
];
beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-21T03:59:59.999Z")); io.post.mockImplementation(async (input: Row) => ({ ok: isCalendarDate(input.entryDate) })); });
afterEach(() => vi.useRealTimers());

describe.each(operations)("C1 · $name", operation => {
  it.each(["session", "guard", "read"] as const)("fecha omitida se captura antes de %s", async phase => {
    const state = setup(phase); const input = Object.freeze({ ...operation.payload });
    expect(await operation.run(input)).toMatchObject({ ok: true });
    expect(io.post).toHaveBeenCalledWith(expect.objectContaining({ entryDate: "2026-10-20" }));
    expect(state.writes).toHaveLength(1); expect(input).not.toHaveProperty(operation.field);
    const stored = state.writes[0].values;
    expect(stored.day ?? stored.received_at ?? stored.issue_date).toBe("2026-10-20");
    expect(stored.amount ?? stored.total_amount).toBe(10.25);
  });
  it("fecha explícita conserva sus bytes aunque cambie el día", async () => {
    setup("session"); const input: Readonly<Row> = Object.freeze({ ...operation.payload, [operation.field]: "2024-02-29" });
    expect(await operation.run(input)).toMatchObject({ ok: true });
    expect(io.post).toHaveBeenCalledWith(expect.objectContaining({ entryDate: "2024-02-29" }));
    expect(input[operation.field]).toBe("2024-02-29");
  });
  it.each(["", null, "2026-02-30"])("fecha explícita inválida %j no se convierte en hoy", async value => {
    const state = setup("session");
    expect(await operation.run({ ...operation.payload, [operation.field]: value })).toMatchObject({ error: expect.any(String) });
    expect(io.post).not.toHaveBeenCalled(); expect(state.calls).toEqual([]); expect(state.writes).toEqual([]);
  });
  it.each([null, {}])("denegación precede a todo efecto incluso con payload %j", async input => {
    const state = setup("session", true);
    expect(await operation.run(input)).toEqual({ error: "Acceso denegado" });
    expect(state.reads).toEqual([]); expect(state.calls).toEqual([]); expect(state.writes).toEqual([]); expect(io.post).not.toHaveBeenCalled();
  });
});

it("C1 · el delegado de cobro también captura antes de su propia lectura", async () => {
  const state = setup("read");
  expect(await registerCollectionFor(state.client, "i1", { amount: 10.25, cashAccountId: "cash", method: "transferencia" })).toMatchObject({ ok: true });
  expect(state.calls[0].args.p_received_at).toBe("2026-10-20");
  expect(io.post).toHaveBeenCalledWith(expect.objectContaining({ entryDate: "2026-10-20" }));
});
it("C1 · delegados CxP/pago conservan la captura antes de leer", async () => {
  let state = setup("read");
  expect(await createBillFor(state.client, { ...billInput, currency: "USD" })).toMatchObject({ ok: true });
  expect(state.writes[0].values.issue_date).toBe("2026-10-20");
  vi.setSystemTime(new Date("2026-10-21T03:59:59.999Z")); state = setup("read");
  expect(await registerPaymentFor(state.client, "b1", { amount: 10.25, cashAccountId: "cash" })).toMatchObject({ ok: true });
  expect(state.calls[0].args.p_paid_at).toBe("2026-10-20");
});
