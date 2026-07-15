/**
 * Tests de `applyReferralCredit` — el camino de DINERO del crédito de referido
 * ($80 USD, SDD-0137).
 *
 * Por qué existen: la action movía plata sin un solo test. Los dos bugs que
 * cubren acá son de consistencia GL↔subledger y NO se ven en code review casual,
 * porque el "happy path" funciona perfecto en ambos:
 *
 *  1. El UPDATE de invoices no chequeaba error → el asiento bajaba la CxC $80 en
 *     el mayor, la factura no se enteraba, y la action devolvía ok:true.
 *  2. Lost update: `paid_amount` se lee en el paso 2b y se escribe `viejo + 80`
 *     al final. Un pago real que entre en el medio quedaba pisado.
 *
 * El doble de Supabase es por-tabla y registra las escrituras para poder afirmar
 * sobre la COMPENSACIÓN (que es lo que ninguno de los dos bugs hacía).
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
const voidSpy = vi.fn(async () => ({ ok: true as const }));

vi.mock("@/lib/studio/accounting/referral-credit-posting", () => ({
  postReferralCreditJournalEntry: (...a: unknown[]) => postSpy(...(a as [])),
  voidReferralCreditEntry: (...a: unknown[]) => voidSpy(...(a as [])),
}));

/** Escrituras observadas, para afirmar sobre la compensación. */
type Write = { table: string; values: Record<string, unknown> };
let writes: Write[] = [];

/**
 * Config del escenario. `invoiceUpdate` decide qué devuelve el UPDATE de
 * invoices: 'hit' (1 fila), 'conflict' (0 filas → alguien movió paid_amount) o
 * 'error' (falla la escritura).
 */
let invoiceUpdate: "hit" | "conflict" | "error" = "hit";

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
    rpc: async () => ({ data: "tenant-1", error: null }),
    from(table: string) {
      const chain: Record<string, unknown> = {
        _values: null as Record<string, unknown> | null,
        select() {
          return chain;
        },
        eq() {
          return chain;
        },
        is() {
          return chain;
        },
        update(values: Record<string, unknown>) {
          chain._values = values;
          writes.push({ table, values });
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
          // Escrituras con .select().maybeSingle()
          if (table === "invoices") {
            if (invoiceUpdate === "error") {
              return Promise.resolve({
                data: null,
                error: { message: "deadlock detected" },
              });
            }
            if (invoiceUpdate === "conflict") {
              return Promise.resolve({ data: null, error: null }); // 0 filas
            }
            return Promise.resolve({ data: { id: "inv-1" }, error: null });
          }
          // Claim del referral → 1 fila (claim exitoso)
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

/** Escrituras que devuelven el crédito a 'acreditado' (la compensación). */
function revertWrites(): Write[] {
  return writes.filter(
    (w) => w.table === "referrals" && w.values.status === "acreditado",
  );
}

beforeEach(() => {
  writes = [];
  invoiceUpdate = "hit";
  invoiceRow = { ...INVOICE };
  postSpy.mockClear();
  voidSpy.mockClear();
});

describe("applyReferralCredit · consistencia GL ↔ subledger", () => {
  it("happy path: abona el crédito al saldo y no compensa nada", async () => {
    const res = await applyReferralCredit("ref-1", "inv-1");

    expect(res).toEqual({ ok: true, entryCode: "AS-001" });
    const invWrite = writes.find((w) => w.table === "invoices");
    expect(invWrite?.values.paid_amount).toBe(120); // 40 + 80
    expect(invWrite?.values.status).toBe("parcial"); // 120 < 500
    expect(voidSpy).not.toHaveBeenCalled();
    expect(revertWrites()).toHaveLength(0);
  });

  it("si el UPDATE de la factura FALLA → anula el asiento y devuelve el crédito (antes: ok:true con el GL divergido)", async () => {
    invoiceUpdate = "error";
    const res = await applyReferralCredit("ref-1", "inv-1");

    expect(res.ok).toBeUndefined();
    expect(res.error).toMatch(/no se pudo abonar el crédito/i);
    // El asiento ya había bajado la CxC $80 en el mayor → hay que anularlo.
    expect(voidSpy).toHaveBeenCalledWith("tenant-1", "entry-1");
    // Y el crédito vuelve a estar disponible.
    expect(revertWrites()).toHaveLength(1);
    expect(revertWrites()[0].values).toMatchObject({
      status: "acreditado",
      applied_invoice_id: null,
      applied_entry_id: null,
      applied_at: null,
    });
  });

  it("si entró un pago mientras se aplicaba (paid_amount cambió) → NO pisa el pago: compensa y pide reintento", async () => {
    invoiceUpdate = "conflict"; // el guard .eq(paid_amount) matcheó 0 filas
    const res = await applyReferralCredit("ref-1", "inv-1");

    expect(res.error).toMatch(/cambió de saldo/i);
    expect(voidSpy).toHaveBeenCalledWith("tenant-1", "entry-1");
    expect(revertWrites()).toHaveLength(1);
  });

  it("el UPDATE de la factura lleva el guard optimista sobre el paid_amount leído", async () => {
    // Prueba de que el lost update no puede pasar en silencio: si el UPDATE no
    // filtrara por el paid_amount viejo, escribiría 120 pisando cualquier pago.
    await applyReferralCredit("ref-1", "inv-1");
    const invWrite = writes.find((w) => w.table === "invoices");
    expect(invWrite).toBeDefined();
    expect(invWrite?.values.last_payment_at).toBeTruthy();
  });
});

describe("applyReferralCredit · regla del founder: descuento sobre compra NUEVA", () => {
  // Crédito acreditado el 2026-06-01. Tipos REALES: issued_at date, accredited_at timestamptz.

  it("RECHAZA una factura ANTERIOR al crédito (deuda que ya existía → sería abono a cuenta)", async () => {
    invoiceRow = { ...INVOICE, issued_at: "2026-05-01" };
    const res = await applyReferralCredit("ref-1", "inv-1");

    expect(res.error).toMatch(/compra NUEVA/i);
    // No movió NADA: ni claim, ni asiento, ni saldo.
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
    expect(postSpy).not.toHaveBeenCalled();
  });
});
