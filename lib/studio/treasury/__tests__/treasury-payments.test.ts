// @vitest-environment node
/**
 * Tests de las acciones de pago de Tesorería para SDD-0489 (stub Supabase, sin
 * red ni DB; el posting contable va mockeado):
 *
 *  - `registerPaymentFor`: valida contra el saldo leído (regla estricta, la de
 *    Cobranzas) y registra con UNA RPC `register_supplier_payment_order` (0468),
 *    que escribe la orden, el pagado y el status de la CxP juntos. Después
 *    asienta con lo que devolvió la RPC y guarda el journal_entry_id.
 *  - `voidPaymentFor`: una sola RPC `void_supplier_payment_order` con el
 *    motivo; anula el asiento que la RPC devuelve.
 *
 * Ninguna de las dos escribe la CxP ni la orden por su cuenta (salvo el
 * journal_entry_id del asiento). Lo que la base hace dentro de la RPC —saldo,
 * estado, código OP-, herencia de moneda, CxP anulada que no revive— lo prueban
 * el contrato `supabase/tests/0468_pago_proveedor_atomico.test.sql` y, con dos
 * sesiones reales, `supabase/tests/0468_pago_proveedor_carrera.test.sql`.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const postPaymentMock = vi.fn();
const voidPaymentEntryMock = vi.fn();

vi.mock("@/lib/studio/accounting/supplier-payment-posting", () => ({
  postSupplierPaymentJournalEntry: (...a: unknown[]) => postPaymentMock(...a),
  voidSupplierPaymentJournalEntry: (...a: unknown[]) => voidPaymentEntryMock(...a),
}));

vi.mock("@/lib/studio/accounting/bill-posting", () => ({
  postBillJournalEntry: vi.fn(),
  voidBillJournalEntry: vi.fn(),
}));

import { registerPaymentFor, voidPaymentFor } from "../treasury-actions";

type Row = Record<string, unknown>;
type Captured = { table: string; payload: Row; filters: Row };
type RpcCall = { fn: string; args: Row };

/**
 * Stub chainable mínimo: select/eq/maybeSingle para lecturas, update(...).eq(...)
 * terminal (captura el payload), insert (lo captura) y rpc (captura la llamada y
 * responde como las RPC de 0468, o con `rpcError`).
 */
function makeStub(opts: { bills?: Row[]; payments?: Row[]; rpcError?: string; afterRead?: () => void }) {
  const updates: Captured[] = [];
  const inserts: { table: string; payload: Row }[] = [];
  const rpcCalls: RpcCall[] = [];
  const tables: Record<string, Row[]> = {
    supplier_bills: opts.bills ?? [],
    supplier_payments: opts.payments ?? [],
  };
  const byId = (table: string, id: unknown) =>
    (tables[table] ?? []).find((r) => r.id === id) ?? null;

  function from(table: string) {
    const filters: Row = {};
    let updatePayload: Row | null = null;
    const match = () =>
      (tables[table] ?? []).find((r) =>
        Object.entries(filters).every(([k, v]) => r[k] === v),
      ) ?? null;

    const chain: Record<string, unknown> = {
      select: () => chain,
      insert: (payload: Row) => {
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
      maybeSingle: () => { opts.afterRead?.(); return Promise.resolve({ data: match(), error: null }); },
    };
    return chain;
  }

  // Respuesta de cada RPC con la forma del jsonb de 0468.
  function rpcResult(fn: string, args: Row): Row {
    if (fn === "register_supplier_payment_order") {
      const bill = byId("supplier_bills", args.p_bill_id)!;
      const paid = Number(bill.paid_amount) + Number(args.p_amount);
      return {
        payment_id: "supplier_payments-new", payment_code: "OP-2026-0042",
        tenant_id: bill.tenant_id, bill_id: bill.id, bill_code: bill.bill_code,
        currency: bill.currency, fx_rate: bill.fx_rate, amount: args.p_amount, paid_amount: paid,
        total_amount: bill.total_amount, status: paid >= Number(bill.total_amount) ? "pagada" : "parcial",
        fully_paid: paid >= Number(bill.total_amount),
      };
    }
    if (fn === "void_supplier_payment_order") {
      const payment = byId("supplier_payments", args.p_payment_id)!;
      const bill = byId("supplier_bills", payment.bill_id)!;
      const paid = Math.max(0, Number(bill.paid_amount) - Number(payment.amount));
      return {
        payment_id: payment.id, payment_code: payment.payment_code, tenant_id: payment.tenant_id,
        bill_id: bill.id, bill_code: bill.bill_code, journal_entry_id: payment.journal_entry_id,
        paid_amount: paid, total_amount: bill.total_amount, status: paid <= 0 ? "pendiente" : "parcial",
      };
    }
    throw new Error("RPC inesperada: " + fn);
  }

  const client = {
    from,
    rpc: async (fn: string, args: Row) => {
      rpcCalls.push({ fn, args });
      if (opts.rpcError) return { data: null, error: { message: opts.rpcError, code: "23514" } };
      return { data: rpcResult(fn, args), error: null };
    },
  } as unknown as SupabaseClient;

  return { client, updates, inserts, rpcCalls };
}

const BILL: Row = {
  id: "b1",
  tenant_id: "t1",
  bill_code: "CXP-2026-0031",
  status: "parcial",
  currency: "VES",
  fx_rate: 36.5,
  total_amount: 2000,
  paid_amount: 600,
};

const PAYMENT: Row = {
  id: "p1",
  tenant_id: "t1",
  payment_code: "OP-2026-0007",
  bill_id: "b1",
  amount: 600,
  journal_entry_id: "je-pago",
};

beforeEach(() => {
  postPaymentMock.mockReset().mockResolvedValue({ ok: true, entryId: "je-nuevo" });
  voidPaymentEntryMock.mockReset().mockResolvedValue({ ok: true });
});
afterEach(() => vi.useRealTimers());

it("C1: captura paidAt omitida antes de leer CxP y conserva la misma fecha en RPC/asiento", async () => {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-21T03:59:59.999Z"));
  const state = makeStub({ bills: [BILL], afterRead: () => vi.setSystemTime(new Date("2026-10-21T04:00:00Z")) });
  expect(await registerPaymentFor(state.client, "b1", { amount: 10.25, cashAccountId: "cash", method: "zelle" })).toMatchObject({ ok: true });
  expect(state.rpcCalls[0].args.p_paid_at).toBe("2026-10-20");
  expect(postPaymentMock).toHaveBeenCalledWith(expect.objectContaining({ entryDate: "2026-10-20", amount: 10.25 }));
});

// ── registerPaymentFor · RPC atómica (SDD-0489) ───────────────
describe("registerPaymentFor · SDD-0489", () => {
  const payload = {
    amount: 500,
    cashAccountId: "acc-bank",
    method: "zelle" as const,
    paidAt: "2026-06-01",
    reference: "ZELLE-77",
    notes: null,
  };

  it("registra con UNA RPC y no escribe la CxP ni la orden por su cuenta", async () => {
    const { client, inserts, updates, rpcCalls } = makeStub({ bills: [BILL] });
    const r = await registerPaymentFor(client, "b1", payload);
    expect(r).toEqual({ ok: true, paymentCode: "OP-2026-0042", fullyPaid: false });

    expect(rpcCalls).toEqual([{
      fn: "register_supplier_payment_order",
      args: {
        p_bill_id: "b1",
        p_amount: 500,
        p_cash_account_id: "acc-bank",
        p_method: "zelle",
        p_paid_at: "2026-06-01",
        p_reference: "ZELLE-77",
        p_notes: null,
      },
    }]);
    expect(inserts).toHaveLength(0);
    expect(updates.filter((u) => u.table === "supplier_bills")).toHaveLength(0);
  });

  it("asienta con la orden que devolvió la RPC (moneda y fx de la CxP) y guarda el journal_entry_id", async () => {
    const { client, updates } = makeStub({ bills: [BILL] });
    await registerPaymentFor(client, "b1", payload);

    expect(postPaymentMock).toHaveBeenCalledTimes(1);
    expect(postPaymentMock.mock.calls[0][0]).toEqual({
      tenantId: "t1",
      paymentId: "supplier_payments-new",
      paymentCode: "OP-2026-0042",
      cashAccountId: "acc-bank",
      amount: 500,
      currency: "VES",
      fxRate: 36.5,
      entryDate: "2026-06-01",
    });
    expect(updates).toEqual([{
      table: "supplier_payments",
      payload: { journal_entry_id: "je-nuevo" },
      filters: { id: "supplier_payments-new" },
    }]);
  });

  it("pago por el saldo completo ⇒ fullyPaid de la RPC", async () => {
    const { client } = makeStub({ bills: [BILL] });
    const r = await registerPaymentFor(client, "b1", { ...payload, amount: 1400 });
    expect(r.fullyPaid).toBe(true);
  });

  it("un centavo sobre el saldo ⇒ fieldError y NO llama a la RPC", async () => {
    const { client, rpcCalls } = makeStub({ bills: [BILL] });
    const r = await registerPaymentFor(client, "b1", { ...payload, amount: 1400.01 });
    expect(r.fieldErrors?.amount).toBeDefined();
    expect(rpcCalls).toHaveLength(0);
  });

  it("CxP anulada o pagada ⇒ mensaje sin llamar a la RPC", async () => {
    for (const status of ["anulada", "pagada"]) {
      const { client, rpcCalls } = makeStub({ bills: [{ ...BILL, status }] });
      const r = await registerPaymentFor(client, "b1", payload);
      expect(r.error).toBe("Solo se pueden registrar pagos en CxP pendientes o parciales.");
      expect(rpcCalls).toHaveLength(0);
    }
  });

  it("CxP inexistente ⇒ mensaje sin llamar a la RPC", async () => {
    const { client, rpcCalls } = makeStub({ bills: [] });
    const r = await registerPaymentFor(client, "b1", payload);
    expect(r.error).toBe("CxP no encontrada.");
    expect(rpcCalls).toHaveLength(0);
  });

  it("carrera perdida (otro pago cambió el saldo) ⇒ mensaje, sin asiento ni texto crudo", async () => {
    for (const [code, message] of [
      ["PAYMENT_EXCEEDS_BALANCE", /supera el saldo vigente/],
      ["PAYMENT_BILL_PAID", /ya está pagada/],
      ["PAYMENT_STATE", /pendientes o parciales/],
      ["PAYMENT_FORBIDDEN", /rol/],
      ["error interno cualquiera", /^No se pudo registrar el pago\.$/],
    ] as const) {
      postPaymentMock.mockClear();
      const { client, updates } = makeStub({ bills: [BILL], rpcError: code });
      const r = await registerPaymentFor(client, "b1", payload);
      expect(r.ok).toBeUndefined();
      expect(r.error).toMatch(message);
      expect(r.error).not.toContain(code === "error interno cualquiera" ? code : "PAYMENT_");
      expect(postPaymentMock).not.toHaveBeenCalled();
      expect(updates).toHaveLength(0);
    }
  });
});

// ── voidPaymentFor · anulación atómica (SDD-0489) ─────────────
describe("voidPaymentFor · SDD-0489", () => {
  it("anula con UNA RPC (motivo validado) y después anula el asiento que devolvió", async () => {
    const { client, updates, rpcCalls } = makeStub({ bills: [BILL], payments: [PAYMENT] });
    const r = await voidPaymentFor(client, "p1", "  Pago devuelto por el proveedor  ");
    expect(r).toEqual({ ok: true });
    expect(rpcCalls).toEqual([{
      fn: "void_supplier_payment_order",
      args: { p_payment_id: "p1", p_reason: "Pago devuelto por el proveedor" },
    }]);
    expect(updates).toHaveLength(0);
    expect(voidPaymentEntryMock).toHaveBeenCalledWith("je-pago");
  });

  it("orden sin asiento ⇒ no anula ninguno", async () => {
    const { client } = makeStub({ bills: [BILL], payments: [{ ...PAYMENT, journal_entry_id: null }] });
    const r = await voidPaymentFor(client, "p1", "Pago devuelto por el proveedor");
    expect(r).toEqual({ ok: true });
    expect(voidPaymentEntryMock).not.toHaveBeenCalled();
  });

  it("motivo inválido ⇒ error sin llamar a la RPC", async () => {
    const { client, rpcCalls } = makeStub({ bills: [BILL], payments: [PAYMENT] });
    const r = await voidPaymentFor(client, "p1", "no");
    expect(r.error).toBeDefined();
    expect(rpcCalls).toHaveLength(0);
    expect(voidPaymentEntryMock).not.toHaveBeenCalled();
  });

  it("rechazo de la RPC ⇒ mensaje, sin tocar el asiento ni mostrar el código", async () => {
    for (const [code, message] of [
      ["PAYMENT_ORDER_VOIDED", "Esta orden ya está anulada."],
      ["PAYMENT_ORDER_NOT_FOUND", "Orden de pago no encontrada."],
      ["PAYMENT_FORBIDDEN", "Tu rol no puede registrar ni anular pagos a proveedores."],
      ["error interno cualquiera", "No se pudo anular la orden de pago."],
    ] as const) {
      voidPaymentEntryMock.mockClear();
      const { client } = makeStub({ bills: [BILL], payments: [PAYMENT], rpcError: code });
      const r = await voidPaymentFor(client, "p1", "Pago devuelto por el proveedor");
      expect(r.error).toBe(message);
      expect(voidPaymentEntryMock).not.toHaveBeenCalled();
    }
  });
});
