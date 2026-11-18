// @vitest-environment node
/**
 * Tests de las acciones compartidas de Cobranzas para SDD-0068 y SDD-0488 (stub
 * Supabase, sin red ni DB; el posting contable y el admin client van mockeados):
 *
 *  - `identifyPaymentFor` (decisión #6): rechaza recibos ya aplicados / moneda
 *    distinta / saldo insuficiente antes de tocar nada; identifica con la RPC
 *    `identify_collection_receipt` (0467), que escribe recibo y saldo juntos, y
 *    la reclasificación se asienta con la fecha ORIGINAL de recepción.
 *  - `registerUnidentifiedPaymentFor` (decisión #2): el payload insertado
 *    cumple el CHECK sin-ref ⇔ invoice null (invoice_id null + snapshots null
 *    + 'recibido_sin_ref' + fund_class 'third_party') y el asiento va con la
 *    fecha de recepción.
 *  - `registerCollectionFor` (decisión #4): el pagador viaja a la RPC
 *    `register_collection_receipt`; tercero incompleto ⇒ fieldErrors y NO
 *    llama a nada.
 *  - `voidReceiptFor`: una sola RPC `void_collection_receipt` con el motivo.
 *
 * SDD-0488: ninguna de las tres escribe la factura ni el recibo por su cuenta
 * (`updates`/`inserts` vacíos). Lo que la base hace dentro de la RPC —snapshots,
 * received_at intacto, fund_class heredada, saldo, estado— lo prueban el
 * contrato `supabase/tests/0467_cobro_factura_atomico.test.sql` y, con dos
 * sesiones reales, `scripts/qa/cobro-factura-race.mjs`.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
  voidReceiptFor,
} from "../collections-actions";

type Row = Record<string, unknown>;
type Captured = { table: string; payload: Row; filters: Row };
type RpcCall = { fn: string; args: Row };

/**
 * Stub chainable mínimo: select/eq/maybeSingle/single para lecturas,
 * update(...).eq(...) terminal (captura el payload), insert(...).select().single()
 * (captura el payload, devuelve id sintético), rpc (captura la llamada y
 * responde como las RPC de 0467, o con `rpcError`) y auth.getUser.
 */
function makeStub(opts: {
  receipts?: Row[];
  invoices?: Row[];
  userTenants?: Row[];
  nextReceiptCode?: string;
  rpcError?: string;
  /** SDD-0601: el código que acompaña a `rpcError`. Por defecto, 23514. */
  rpcErrorCode?: string;
  /** SDD-0601: lo que devuelve postgrest-js si el pedido no recibe respuesta. */
  rpcSinRespuesta?: boolean;
  /** SDD-0601: una respuesta 200 sin recibo. */
  rpcSinRecibo?: boolean;
}) {
  const updates: Captured[] = [];
  const inserts: { table: string; payload: Row }[] = [];
  const rpcCalls: RpcCall[] = [];
  const tables: Record<string, Row[]> = {
    payment_receipts: opts.receipts ?? [],
    invoices: opts.invoices ?? [],
    user_tenants: opts.userTenants ?? [{ tenant_id: "t1" }],
  };
  const byId = (table: string, id: unknown) =>
    (tables[table] ?? []).find((r) => r.id === id) ?? null;

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

  // Respuesta de cada RPC con la forma del jsonb de 0467.
  function rpcResult(fn: string, args: Row): Row | string {
    if (fn === "next_receipt_code") return opts.nextReceiptCode ?? "R-2026-0042";
    if (fn === "register_collection_receipt") {
      const inv = byId("invoices", args.p_invoice_id)!;
      const paid = Number(inv.paid_amount) + Number(args.p_amount);
      return {
        receipt_id: "payment_receipts-new", receipt_code: opts.nextReceiptCode ?? "R-2026-0042",
        tenant_id: inv.tenant_id, invoice_id: inv.id, invoice_code: inv.invoice_code,
        currency: inv.currency, fx_rate: inv.fx_rate, amount: args.p_amount, paid_amount: paid,
        total_amount: inv.total_amount, status: paid >= Number(inv.total_amount) ? "pagada" : "parcial",
        fully_paid: paid >= Number(inv.total_amount),
      };
    }
    if (fn === "identify_collection_receipt") {
      const rec = byId("payment_receipts", args.p_receipt_id)!;
      const inv = byId("invoices", args.p_invoice_id)!;
      const paid = Number(inv.paid_amount) + Number(rec.amount);
      return {
        receipt_id: rec.id, receipt_code: rec.receipt_code, tenant_id: rec.tenant_id,
        invoice_id: inv.id, invoice_code: inv.invoice_code, amount: rec.amount, currency: rec.currency,
        fx_rate: rec.fx_rate, received_at: rec.received_at, paid_amount: paid,
        total_amount: inv.total_amount, status: paid >= Number(inv.total_amount) ? "pagada" : "parcial",
        fully_paid: paid >= Number(inv.total_amount),
      };
    }
    if (fn === "void_collection_receipt") {
      const rec = byId("payment_receipts", args.p_receipt_id)!;
      return {
        receipt_id: rec.id, receipt_code: rec.receipt_code, tenant_id: rec.tenant_id,
        invoice_id: rec.invoice_id, paid_amount: null, status: null,
      };
    }
    throw new Error("RPC inesperada: " + fn);
  }

  const client = {
    from,
    rpc: async (fn: string, args: Row) => {
      rpcCalls.push({ fn, args });
      if (opts.rpcSinRespuesta) {
        return { data: null, error: { message: "TypeError: fetch failed", details: "", hint: "", code: "" }, status: 0 };
      }
      if (opts.rpcSinRecibo) return { data: null, error: null, status: 200 };
      if (opts.rpcError) {
        return { data: null, error: { message: opts.rpcError, code: opts.rpcErrorCode ?? "23514" }, status: 400 };
      }
      return { data: rpcResult(fn, args), error: null, status: 200 };
    },
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
  } as unknown as SupabaseClient;

  return { client, updates, inserts, rpcCalls };
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
  it("identifica con UNA RPC: recibo y factura, sin escribir nada por su cuenta", async () => {
    const { client, updates, inserts, rpcCalls } = makeStub({
      receipts: [SIN_REF_RECEIPT],
      invoices: [INVOICE],
    });

    const r = await identifyPaymentFor(client, "r1", "i1");
    expect(r.ok).toBe(true);
    expect(r.receiptCode).toBe("R-2026-0007");
    expect(r.invoiceCode).toBe("F-2026-0031");
    expect(r.fullyPaid).toBe(false); // 800 de 2000

    expect(rpcCalls).toEqual([
      { fn: "identify_collection_receipt", args: { p_receipt_id: "r1", p_invoice_id: "i1" } },
    ]);
    // SDD-0488: el recibo y el saldo los escribe la RPC en una transacción.
    expect(updates).toHaveLength(0);
    expect(inserts).toHaveLength(0);
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

  it("salda la factura cuando el monto cubre el saldo (fullyPaid de la RPC)", async () => {
    const { client } = makeStub({
      receipts: [{ ...SIN_REF_RECEIPT, amount: 2000 }],
      invoices: [INVOICE],
    });
    const r = await identifyPaymentFor(client, "r1", "i1");
    expect(r.fullyPaid).toBe(true);
  });

  it("rechaza un recibo que NO está recibido_sin_ref", async () => {
    const { client, updates, rpcCalls } = makeStub({
      receipts: [{ ...SIN_REF_RECEIPT, application_status: "aplicado", invoice_id: "i9" }],
      invoices: [INVOICE],
    });
    const r = await identifyPaymentFor(client, "r1", "i1");
    expect(r.error).toBeDefined();
    expect(updates).toHaveLength(0);
    expect(rpcCalls).toHaveLength(0);
    expect(postReclassMock).not.toHaveBeenCalled();
  });

  it("rechaza moneda distinta entre pago y factura", async () => {
    const { client, rpcCalls } = makeStub({
      receipts: [{ ...SIN_REF_RECEIPT, currency: "VES", fx_rate: 36 }],
      invoices: [INVOICE],
    });
    const r = await identifyPaymentFor(client, "r1", "i1");
    expect(r.error).toMatch(/moneda/i);
    expect(rpcCalls).toHaveLength(0);
  });

  it("rechaza factura con saldo insuficiente (saldo < monto)", async () => {
    const { client, rpcCalls } = makeStub({
      receipts: [{ ...SIN_REF_RECEIPT, amount: 800 }],
      invoices: [{ ...INVOICE, total_amount: 1000, paid_amount: 500 }], // saldo 500
    });
    const r = await identifyPaymentFor(client, "r1", "i1");
    expect(r.error).toMatch(/saldo/i);
    expect(rpcCalls).toHaveLength(0);
  });

  // SDD-0488: regla estricta de Sam (igual que la 0464). Antes pasaba 0,01 de más.
  it("rechaza un centavo por encima del saldo", async () => {
    const { client, rpcCalls } = makeStub({
      receipts: [{ ...SIN_REF_RECEIPT, amount: 500.01 }],
      invoices: [{ ...INVOICE, total_amount: 1000, paid_amount: 500 }],
    });
    const r = await identifyPaymentFor(client, "r1", "i1");
    expect(r.error).toMatch(/saldo/i);
    expect(rpcCalls).toHaveLength(0);
  });

  it("rechaza facturas no cobrables (borrador/anulada/pagada)", async () => {
    for (const status of ["borrador", "anulada", "pagada"]) {
      const { client, rpcCalls } = makeStub({
        receipts: [SIN_REF_RECEIPT],
        invoices: [{ ...INVOICE, status }],
      });
      const r = await identifyPaymentFor(client, "r1", "i1");
      expect(r.error).toBeDefined();
      expect(rpcCalls).toHaveLength(0);
    }
  });

  it("traduce el rechazo de la RPC (otro la aplicó antes) y no reclasifica", async () => {
    const { client } = makeStub({
      receipts: [SIN_REF_RECEIPT],
      invoices: [INVOICE],
      rpcError: "PAYMENT_RECEIPT_APPLIED",
    });
    const r = await identifyPaymentFor(client, "r1", "i1");
    expect(r.error).toBe("Este pago ya fue identificado y aplicado.");
    expect(postReclassMock).not.toHaveBeenCalled();
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

// ── registerCollectionFor · pagador + RPC atómica ─────────────
describe("registerCollectionFor · SDD-0068 + SDD-0488", () => {
  const payload = {
    amount: 500,
    cashAccountId: "acc-bank",
    method: "transferencia" as const,
    receivedAt: "2026-06-01",
    reference: null,
    notes: null,
  };

  it("manda el pagador tercero a la RPC y no escribe nada por su cuenta", async () => {
    const { client, inserts, updates, rpcCalls } = makeStub({
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
    expect(r.receiptCode).toBe("R-2026-0042");

    expect(rpcCalls).toEqual([{
      fn: "register_collection_receipt",
      args: {
        p_invoice_id: "i1",
        p_amount: 500,
        p_cash_account_id: "acc-bank",
        p_method: "transferencia",
        p_received_at: "2026-06-01",
        p_reference: null,
        p_notes: null,
        p_payer_kind: "tercero",
        p_payer_name: "María Pérez",
        p_payer_relation: "familiar",
        p_licit_declared: true,
      },
    }]);
    // SDD-0488: el recibo y el saldo los escribe la RPC en una transacción.
    expect(inserts).toHaveLength(0);
    expect(updates.filter((u) => u.table === "invoices")).toHaveLength(0);
  });

  it("tercero incompleto ⇒ fieldErrors y NO llama a la RPC (criterio de aceptación)", async () => {
    const { client, inserts, rpcCalls } = makeStub({ invoices: [INVOICE] });
    const r = await registerCollectionFor(client, "i1", {
      ...payload,
      payerKind: "tercero", // sin nombre/relación/licitud
    });
    expect(r.fieldErrors?.payerName).toBeDefined();
    expect(r.fieldErrors?.payerRelation).toBeDefined();
    expect(r.fieldErrors?.licitDeclared).toBeDefined();
    expect(inserts).toHaveLength(0);
    expect(rpcCalls).toHaveLength(0);
  });

  it("cobro del propio cliente: payer default en la RPC", async () => {
    const { client, rpcCalls } = makeStub({ invoices: [INVOICE] });
    const r = await registerCollectionFor(client, "i1", payload);
    expect(r.ok).toBe(true);
    const args = rpcCalls[0].args;
    expect(args.p_payer_kind).toBe("cliente");
    expect(args.p_payer_name).toBeNull();
    expect(args.p_payer_relation).toBeNull();
    expect(args.p_licit_declared).toBe(false);
  });

  it("asienta con el recibo que devolvió la RPC y guarda el journal_entry_id", async () => {
    const { client, updates } = makeStub({ invoices: [INVOICE] });
    const r = await registerCollectionFor(client, "i1", payload);
    expect(r.fullyPaid).toBe(false); // 500 de 2000

    expect(postReceiptMock).toHaveBeenCalledTimes(1);
    const arg = postReceiptMock.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.receiptId).toBe("payment_receipts-new");
    expect(arg.receiptCode).toBe("R-2026-0042");
    expect(arg.tenantId).toBe("t1");
    expect(arg.amount).toBe(500);
    expect(arg.entryDate).toBe("2026-06-01");
    expect(updates).toEqual([{
      table: "payment_receipts",
      payload: { journal_entry_id: "je-cobro" },
      filters: { id: "payment_receipts-new" },
    }]);
  });

  it("cobro por el saldo completo ⇒ fullyPaid", async () => {
    const { client } = makeStub({ invoices: [INVOICE] });
    const r = await registerCollectionFor(client, "i1", { ...payload, amount: 2000 });
    expect(r.fullyPaid).toBe(true);
  });

  // SDD-0488: regla estricta. Un centavo sobre el saldo ya no pasa.
  it("un centavo sobre el saldo ⇒ fieldError y NO llama a la RPC", async () => {
    const { client, rpcCalls } = makeStub({ invoices: [{ ...INVOICE, paid_amount: 1500 }] });
    const r = await registerCollectionFor(client, "i1", { ...payload, amount: 500.01 });
    expect(r.fieldErrors?.amount).toBeDefined();
    expect(rpcCalls).toHaveLength(0);
  });

  it("carrera perdida (otro cobro cambió el saldo) ⇒ mensaje, sin asiento ni texto crudo", async () => {
    for (const [code, message] of [
      ["PAYMENT_EXCEEDS_BALANCE", /supera el saldo vigente/],
      ["PAYMENT_INVOICE_PAID", /ya está pagada/],
      ["PAYMENT_STATE", /emitidas o parciales/],
      ["PAYMENT_FORBIDDEN", /rol/],
      ["error interno cualquiera", /^No se registró el cobro y la factura .+ sigue igual: el sistema lo rechazó/],
    ] as const) {
      postReceiptMock.mockClear();
      const { client } = makeStub({ invoices: [INVOICE], rpcError: code });
      const r = await registerCollectionFor(client, "i1", payload);
      expect(r.ok).toBeUndefined();
      expect(r.error).toMatch(message);
      expect(r.error).not.toContain(code === "error interno cualquiera" ? code : "PAYMENT_");
      expect(postReceiptMock).not.toHaveBeenCalled();
    }
  });

  // SDD-0601: quien cobra sabe por qué no entró, qué pasó con la factura y a quién acudir.
  describe("aviso del cobro no registrado · SDD-0601", () => {
    const CODIGO = String(INVOICE.invoice_code);
    const VENTA = `No se registró el cobro y la factura ${CODIGO} sigue igual: su asiento de venta tiene un problema. Intentarlo otra vez no lo arregla. Avísale a un administrador con el número de factura.`;
    const OTRO_MOTIVO = `No se registró el cobro y la factura ${CODIGO} sigue igual: el sistema lo rechazó por un motivo que no reconoce. Avísale a un administrador con el número de factura.`;
    const SIN_RESPUESTA = `No se pudo confirmar si el cobro entró: se perdió la comunicación con el sistema. Recarga la página y revisa la factura ${CODIGO} antes de intentarlo otra vez. Si sigue fallando, avísale a un administrador.`;
    const MOTIVOS_DE_VENTA = [
      "La venta original requiere revisión.",
      "La relación contable de la factura requiere revisión.",
      "Estado de factura y par contable incompatibles.",
    ];

    it.each(MOTIVOS_DE_VENTA)("motivo de la 0497 «%s» ⇒ dice que es el asiento de venta y que reintentar no sirve", async (motivo) => {
      postReceiptMock.mockClear();
      const { client } = makeStub({ invoices: [INVOICE], rpcError: motivo });
      const r = await registerCollectionFor(client, "i1", payload);
      expect(r.error).toBe(VENTA);
      expect(postReceiptMock).not.toHaveBeenCalled();
    });

    // Se comparan enteros: si la 0497 cambia un texto, el aviso caería sin ruido en «otro motivo».
    it.each(MOTIVOS_DE_VENTA)("«%s» es el texto exacto de la 0497", (motivo) => {
      const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/0497_reverso_al_anular_factura.sql"), "utf8");
      expect(sql).toContain(`raise exception '${motivo}'`);
    });

    it("la base rechaza por un motivo sin traducir ⇒ afirma que no entró, sin el texto de la base", async () => {
      const crudo = 'new row for relation "payment_receipts" violates check constraint "x"';
      const { client } = makeStub({ invoices: [INVOICE], rpcError: crudo });
      const r = await registerCollectionFor(client, "i1", payload);
      expect(r.error).toBe(OTRO_MOTIVO);
      expect(r.error).not.toContain("payment_receipts");
    });

    it("un error de PostgREST también es un rechazo: el pedido no corrió", async () => {
      const { client } = makeStub({ invoices: [INVOICE], rpcError: "Could not find the function", rpcErrorCode: "PGRST202" });
      const r = await registerCollectionFor(client, "i1", payload);
      expect(r.error).toBe(OTRO_MOTIVO);
    });

    it("sin respuesta ⇒ NO afirma que la factura sigue igual: el cobro pudo haber entrado", async () => {
      postReceiptMock.mockClear();
      const { client } = makeStub({ invoices: [INVOICE], rpcSinRespuesta: true });
      const r = await registerCollectionFor(client, "i1", payload);
      expect(r.error).toBe(SIN_RESPUESTA);
      expect(r.error).not.toContain("sigue igual");
      expect(r.error).not.toContain("fetch failed");
      expect(postReceiptMock).not.toHaveBeenCalled();
    });

    it("un 200 sin recibo ⇒ tampoco afirma que no entró", async () => {
      const { client } = makeStub({ invoices: [INVOICE], rpcSinRecibo: true });
      const r = await registerCollectionFor(client, "i1", payload);
      expect(r.error).toBe(SIN_RESPUESTA);
    });

    it("los rechazos con su propio mensaje no pasan por el aviso ni por el registro", async () => {
      const errorDeConsola = vi.spyOn(console, "error").mockImplementation(() => {});
      const { client } = makeStub({ invoices: [INVOICE], rpcError: "PAYMENT_FORBIDDEN", rpcErrorCode: "42501" });
      const r = await registerCollectionFor(client, "i1", payload);
      expect(r.error).toBe("Tu rol no puede registrar ni anular cobros.");
      expect(errorDeConsola).not.toHaveBeenCalled();
      errorDeConsola.mockRestore();
    });

    it("queda rastro en el servidor con la factura y el código, nunca con el texto de la base", async () => {
      const errorDeConsola = vi.spyOn(console, "error").mockImplementation(() => {});
      const { client } = makeStub({ invoices: [INVOICE], rpcError: "dato sensible de la base", rpcErrorCode: "23505" });
      await registerCollectionFor(client, "i1", payload);
      expect(errorDeConsola).toHaveBeenCalledTimes(1);
      const linea = errorDeConsola.mock.calls[0].join(" ");
      expect(linea).toContain(CODIGO);
      expect(linea).toContain("23505");
      expect(linea).not.toContain("dato sensible");
      errorDeConsola.mockRestore();
    });
  });
});

// ── voidReceiptFor · anulación atómica (SDD-0488) ─────────────
describe("voidReceiptFor · SDD-0488", () => {
  const APPLIED: Row = {
    ...SIN_REF_RECEIPT,
    invoice_id: "i1",
    application_status: "aplicado",
  };

  it("anula con UNA RPC (motivo validado) y después anula los asientos del recibo", async () => {
    const { client, updates, rpcCalls } = makeStub({ receipts: [APPLIED], invoices: [INVOICE] });
    const r = await voidReceiptFor(client, "r1", "  Pago devuelto al cliente  ");
    expect(r).toEqual({ ok: true });
    expect(rpcCalls).toEqual([{
      fn: "void_collection_receipt",
      args: { p_receipt_id: "r1", p_reason: "Pago devuelto al cliente" },
    }]);
    expect(updates).toHaveLength(0);
    expect(voidEntriesMock).toHaveBeenCalledWith("r1");
  });

  it("motivo inválido ⇒ error sin llamar a la RPC", async () => {
    const { client, rpcCalls } = makeStub({ receipts: [APPLIED], invoices: [INVOICE] });
    const r = await voidReceiptFor(client, "r1", "no");
    expect(r.error).toBeDefined();
    expect(rpcCalls).toHaveLength(0);
    expect(voidEntriesMock).not.toHaveBeenCalled();
  });

  it("recibo ya anulado ⇒ mensaje, sin tocar asientos", async () => {
    const { client } = makeStub({
      receipts: [APPLIED],
      invoices: [INVOICE],
      rpcError: "PAYMENT_RECEIPT_VOIDED",
    });
    const r = await voidReceiptFor(client, "r1", "Pago devuelto al cliente");
    expect(r.error).toBe("Este recibo ya está anulado.");
    expect(voidEntriesMock).not.toHaveBeenCalled();
  });
});
