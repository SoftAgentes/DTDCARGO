/**
 * Tests de `applyReferralCredit` — el camino de DINERO del crédito de referido
 * ($80 USD, SDD-0137).
 *
 * Por qué existen: la action movía plata sin un solo test. Los bugs que cubren
 * son de consistencia GL↔subledger y NO se ven en code review casual, porque el
 * "happy path" funciona perfecto con y sin ellos.
 *
 * SDD-0496: el claim del crédito y el abono a la factura ya NO son dos
 * peticiones de TypeScript con guard optimista, sino UNA llamada a
 * `apply_referral_credit` (migración 0471) que los escribe en la misma
 * transacción, con la factura tomada FOR UPDATE. Por eso acá se afirma que la
 * action NO escribe `invoices` —si volviera a hacerlo, la ventana que la 0471
 * cierra estaría de vuelta— y que un fallo del asiento se compensa con la
 * reversión atómica. La lógica de dinero se prueba contra la función real en
 * `supabase/tests/0471_credito_referido_atomico.test.sql`.
 *
 * El doble de Supabase es por-tabla y registra las escrituras y las RPC.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/studio/rbac-guard", () => ({
  moduleEditDenial: vi.fn(async () => null), // rol con permiso de dinero
}));

const postSpy = vi.fn(async () => ({
  ok: true as const,
  entryId: "entry-1",
  entryCode: "AS-001",
}));
const revertSpy = vi.fn(async () => ({ ok: true as const, reverted: 1 }));

vi.mock("@/lib/studio/accounting/referral-credit-posting", () => ({
  postReferralCreditJournalEntry: (...a: unknown[]) => postSpy(...(a as [])),
  revertReferralCreditsForInvoice: (...a: unknown[]) => revertSpy(...(a as [])),
}));

/** Escrituras observadas, para afirmar sobre la compensación. */
/** `filters`: los `.eq` de la misma cadena (los guards del UPDATE). */
type Write = {
  table: string;
  values: Record<string, unknown>;
  filters: Record<string, unknown>;
};
let writes: Write[] = [];
/** Llamadas a RPC, en orden. */
let rpcCalls: { fn: string; args?: Record<string, unknown> }[] = [];

/**
 * Qué contesta `apply_referral_credit`. `ok` devuelve el jsonb de la función;
 * un string es el código de dominio que la función levanta (PostgREST lo
 * entrega como `error.message`).
 */
let applyOutcome: "ok" | string = "ok";

/** Fila de factura del escenario (los tests de la regla la varían). */
let invoiceRow: Record<string, unknown> = {};

/** Forma REAL de PostgREST: accredited_at es timestamptz. */
const REFERRAL = {
  id: "ref-1",
  referral_code: "REF-001",
  referrer_markbox: "DTD-5452",
  reward_usd: 80,
  status: "acreditado",
  accredited_at: "2026-06-01T09:30:00+00:00",
};
/** Compra NUEVA (posterior al crédito). issued_at con forma `date`, como prod. */
const INVOICE = {
  id: "inv-1",
  invoice_code: "F-100",
  client_markbox: "DTD-5452",
  currency: "USD",
  total_amount: 500,
  paid_amount: 40,
  status: "emitida",
  issued_at: "2026-07-01",
};

function makeClient() {
  return {
    rpc: async (fn: string, args?: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      if (fn === "get_user_tenant_id") return { data: "tenant-1", error: null };
      if (fn === "apply_referral_credit") {
        if (applyOutcome !== "ok") return { data: null, error: { message: applyOutcome } };
        return {
          data: {
            referral_id: "ref-1",
            referral_code: "REF-001",
            invoice_id: "inv-1",
            invoice_code: "F-100",
            amount: 80,
            paid_amount: 120,
            total_amount: 500,
            status: "parcial",
            fully_paid: false,
          },
          error: null,
        };
      }
      return { data: null, error: null };
    },
    from(table: string) {
      const filters: Record<string, unknown> = {};
      const chain: Record<string, unknown> = {
        _values: null as Record<string, unknown> | null,
        select() {
          return chain;
        },
        eq(col: string, val: unknown) {
          filters[col] = val;
          return chain;
        },
        is() {
          return chain;
        },
        update(values: Record<string, unknown>) {
          chain._values = values;
          writes.push({ table, values, filters });
          return chain;
        },
        maybeSingle() {
          // Lecturas (sin update previo)
          if (!chain._values) {
            if (table === "referrals") {
              return Promise.resolve({ data: REFERRAL, error: null });
            }
            if (table === "invoices") {
              return Promise.resolve({ data: invoiceRow, error: null });
            }
            return Promise.resolve({ data: null, error: null });
          }
          return Promise.resolve({ data: { id: "ref-1" }, error: null });
        },
        then(resolve: (v: { data: unknown; error: null }) => unknown) {
          return Promise.resolve({ data: null, error: null }).then(resolve);
        },
      };
      return chain;
    },
  };
}

vi.mock("@/lib/db/server", () => ({
  createClient: async () => makeClient(),
}));

const { applyReferralCredit } = await import("../actions");

const applyCall = () => rpcCalls.find((c) => c.fn === "apply_referral_credit");

beforeEach(() => {
  writes = [];
  rpcCalls = [];
  applyOutcome = "ok";
  invoiceRow = { ...INVOICE };
  postSpy.mockClear();
  revertSpy.mockClear();
  revertSpy.mockImplementation(async () => ({ ok: true as const, reverted: 1 }));
});

describe("applyReferralCredit · SDD-0496 (el dinero lo mueve la RPC)", () => {
  it("happy path: llama a la RPC, asienta y linkea el asiento; no compensa nada", async () => {
    const res = await applyReferralCredit("ref-1", "inv-1");

    expect(res).toEqual({ ok: true, entryCode: "AS-001" });
    expect(applyCall()?.args).toEqual({ p_referral_id: "ref-1", p_invoice_id: "inv-1" });
    expect(postSpy).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant-1", invoiceCode: "F-100", amountUsd: 80 }),
    );
    expect(writes).toEqual([
      { table: "referrals", values: { applied_entry_id: "entry-1" }, filters: { id: "ref-1" } },
    ]);
    expect(revertSpy).not.toHaveBeenCalled();
  });

  it("la action ya no escribe invoices: el abono va dentro de la transacción de la RPC", async () => {
    // Si volviera un UPDATE de invoices desde acá, volvería la ventana entre el
    // claim y el abono que la 0471 cerró (SDD-0490, «Riesgo residual»).
    await applyReferralCredit("ref-1", "inv-1");

    expect(writes.filter((w) => w.table === "invoices")).toHaveLength(0);
  });

  it("tampoco reclama el crédito por su cuenta: el claim va dentro de la RPC", async () => {
    await applyReferralCredit("ref-1", "inv-1");

    expect(writes.filter((w) => w.values.status === "aplicado")).toHaveLength(0);
  });

  it("si el asiento FALLA → compensa con la reversión atómica de ese crédito", async () => {
    postSpy.mockImplementationOnce(async () => ({
      ok: false as unknown as true,
      entryId: undefined as unknown as string,
      entryCode: undefined as unknown as string,
      error: "falta la cuenta 6.11 en el plan",
    }));

    const res = await applyReferralCredit("ref-1", "inv-1");

    expect(res.ok).toBeUndefined();
    expect(res.error).toMatch(/No se pudo generar el asiento del crédito/);
    expect(res.error).toMatch(/Se revirtió todo; no se aplicó nada/);
    // La reversión se pide para ESE crédito, no para toda la factura.
    expect(revertSpy).toHaveBeenCalledWith(
      expect.anything(), "tenant-1", "inv-1", "ref-1",
    );
  });

  it("si el asiento falla y la compensación TAMBIÉN, lo dice en vez de callarlo", async () => {
    postSpy.mockImplementationOnce(async () => ({
      ok: false as unknown as true,
      entryId: undefined as unknown as string,
      entryCode: undefined as unknown as string,
      error: "falta la cuenta 6.11 en el plan",
    }));
    revertSpy.mockImplementationOnce(async () => ({
      ok: false as unknown as true,
      reverted: 0,
      error: "la función no existe",
    }));

    const res = await applyReferralCredit("ref-1", "inv-1");

    expect(res.error).toMatch(/no se pudo deshacer la aplicación/);
    expect(res.error).toMatch(/la función no existe/);
    expect(res.error).toMatch(/Revisa el crédito y el saldo de la factura/);
  });
});

describe("applyReferralCredit · los códigos de la RPC llegan en castellano", () => {
  const CASOS: [string, RegExp][] = [
    ["REFERRAL_CREDIT_STATE", /ya fue aplicado \(o cambió de estado\)/],
    ["REFERRAL_CREDIT_INVOICE_STATE", /cambió de estado mientras lo aplicabas/],
    ["REFERRAL_CREDIT_EXCEEDS_BALANCE", /entró un pago mientras lo aplicabas/],
    ["REFERRAL_CREDIT_OLD_INVOICE", /compra NUEVA/],
    ["REFERRAL_CREDIT_OTHER_CLIENT", /no es del cliente que refiere/],
    ["REFERRAL_CREDIT_CURRENCY", /USD o USDT/],
    ["REFERRAL_CREDIT_FORBIDDEN", /No tienes permiso/],
  ];
  for (const [codigo, esperado] of CASOS) {
    it(`${codigo} → mensaje de la carrera, y no se asienta nada`, async () => {
      applyOutcome = codigo;

      const res = await applyReferralCredit("ref-1", "inv-1");

      expect(res.ok).toBeUndefined();
      expect(res.error).toMatch(esperado);
      expect(postSpy).not.toHaveBeenCalled();
      expect(revertSpy).not.toHaveBeenCalled();
    });
  }

  it("un código desconocido se muestra tal cual en vez de esconderse", async () => {
    applyOutcome = "deadlock detected";

    const res = await applyReferralCredit("ref-1", "inv-1");

    expect(res.error).toBe("No se pudo aplicar el crédito: deadlock detected");
  });
});

describe("applyReferralCredit · regla del founder: descuento sobre compra NUEVA", () => {
  // Crédito acreditado el 2026-06-01. Tipos REALES: issued_at date, accredited_at timestamptz.
  // La 0471 revalida la regla bajo el lock; estos gates son para el mensaje.

  it("RECHAZA una factura ANTERIOR al crédito (deuda que ya existía → sería abono a cuenta)", async () => {
    invoiceRow = { ...INVOICE, issued_at: "2026-05-01" };
    const res = await applyReferralCredit("ref-1", "inv-1");

    expect(res.error).toMatch(/compra NUEVA/i);
    // No movió NADA: ni RPC, ni asiento, ni saldo.
    expect(applyCall()).toBeUndefined();
    expect(postSpy).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });

  it("ACEPTA el MISMO DÍA de la acreditación (comparar los crudos como string lo rechazaba)", async () => {
    invoiceRow = { ...INVOICE, issued_at: "2026-06-01" }; // acreditado 2026-06-01T09:30
    const res = await applyReferralCredit("ref-1", "inv-1");

    expect(res.ok).toBe(true);
    expect(postSpy).toHaveBeenCalled();
  });

  it("RECHAZA sin fecha de emisión (no se puede probar que sea posterior → fail-closed)", async () => {
    invoiceRow = { ...INVOICE, issued_at: null };
    const res = await applyReferralCredit("ref-1", "inv-1");

    expect(res.error).toMatch(/compra NUEVA/i);
    expect(applyCall()).toBeUndefined();
    expect(postSpy).not.toHaveBeenCalled();
  });

  it("RECHAZA un saldo menor que el crédito antes de llamar a la RPC", async () => {
    invoiceRow = { ...INVOICE, paid_amount: 460 }; // saldo 40 < 80
    const res = await applyReferralCredit("ref-1", "inv-1");

    expect(res.error).toMatch(/saldo de la factura/i);
    expect(applyCall()).toBeUndefined();
  });
});
