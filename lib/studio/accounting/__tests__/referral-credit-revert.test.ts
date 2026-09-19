/**
 * Tests de la REVERSIÓN del crédito de referido (SDD-0137, huecos B y C).
 *
 * Cubren, con un stub in-memory de createAdminClient (sin red ni DB):
 *  - Fix B: la reversión anula el asiento barriendo por journal_entries.referral_id
 *    AUNQUE referrals.applied_entry_id sea NULL (crash entre claim y linkage) →
 *    no queda asiento huérfano y el crédito no se re-aplica con doble $80.
 *  - Fix C: al revertir se baja invoices.paid_amount en el monto del crédito
 *    (se deshace el abono no-monetario), manteniendo GL↔subledger consistentes.
 *  - Idempotencia: revertir dos veces = no-op (segunda pasada revierte 0).
 *  - SDD-0490: el pagado se baja con guard optimista (pagado y estado leídos),
 *    releyendo ante un conflicto; el estado sigue la regla de la 0467; si no se
 *    puede bajar, el crédito vuelve a 'aplicado' y el asiento sigue vivo.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

type Row = Record<string, unknown>;

// Store mutable compartido entre el stub y las aserciones.
const store: { referrals: Row[]; journal_entries: Row[]; invoices: Row[] } = {
  referrals: [],
  journal_entries: [],
  invoices: [],
};

/**
 * Otro escritor que entra entre la lectura y un UPDATE (SDD-0490): se llama
 * antes de aplicar cada UPDATE, con la tabla, y puede mover el store como lo
 * haría void_collection_receipt al confirmar en otra sesión.
 */
const hooks: { beforeUpdate: ((table: string) => void) | null } = { beforeUpdate: null };
/** UPDATEs de invoices que intentó la reversión (con o sin filas). */
let invoiceUpdates = 0;

function matches(row: Row, filters: Row): boolean {
  return Object.entries(filters).every(([k, v]) => {
    if (v === null) return row[k] == null;
    return row[k] === v;
  });
}

vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => ({
    from(table: keyof typeof store) {
      const filters: Row = {};
      let op: "select" | "update" | "delete" = "select";
      let payload: Row = {};

      // UPDATE con los filtros de la cadena: aplica y devuelve las filas tocadas.
      const applyUpdate = (): Row[] => {
        if (table === "invoices") invoiceUpdates += 1;
        hooks.beforeUpdate?.(table);
        const rows = store[table].filter((r) => matches(r, filters));
        for (const r of rows) Object.assign(r, payload);
        return rows;
      };

      const chain: Row = {
        select() {
          // `.update(...).select("id")` sigue siendo un UPDATE (RETURNING).
          return chain;
        },
        update(p: Row) {
          op = "update";
          payload = p;
          return chain;
        },
        delete() {
          op = "delete";
          return chain;
        },
        eq(col: string, val: unknown) {
          filters[col] = val;
          return chain;
        },
        neq(col: string, val: unknown) {
          // solo se usa en posting; en revert no aparece. Guardamos como marca.
          (filters as Row)[`__neq_${col}`] = val;
          return chain;
        },
        is(col: string, val: unknown) {
          filters[col] = val;
          return chain;
        },
        order() {
          return chain;
        },
        limit() {
          return chain;
        },
        maybeSingle() {
          if (op === "update") {
            const touched = applyUpdate();
            return Promise.resolve({ data: touched[0] ? { ...touched[0] } : null, error: null });
          }
          const found = store[table].find((r) => matches(r, filters)) ?? null;
          return Promise.resolve({ data: found ? { ...found } : null, error: null });
        },
        then(resolve: (v: { data: unknown; error: null }) => unknown) {
          if (op === "update") {
            applyUpdate();
            return Promise.resolve({ data: null, error: null }).then(resolve);
          }
          // Copias, como PostgREST: lo leído no cambia si después se escribe el store.
          const rows = store[table].filter((r) => matches(r, filters)).map((r) => ({ ...r }));
          if (op === "delete") {
            store[table] = store[table].filter((r) => !matches(r, filters));
            return Promise.resolve({ data: null, error: null }).then(resolve);
          }
          return Promise.resolve({ data: rows, error: null }).then(resolve);
        },
      };
      return chain;
    },
  }),
}));

import {
  REVERT_PAID_MAX_ATTEMPTS,
  invoiceStatusAfterPaidDecrease,
  revertReferralCreditsForInvoice,
} from "../referral-credit-posting";

beforeEach(() => {
  hooks.beforeUpdate = null;
  invoiceUpdates = 0;
  store.referrals = [
    {
      id: "r1",
      tenant_id: "t1",
      applied_invoice_id: "inv1",
      applied_entry_id: null, // ← crash entre claim y linkage: link NUNCA se seteó
      reward_usd: 80,
      status: "aplicado",
      deleted_at: null,
    },
  ];
  store.journal_entries = [
    {
      id: "e1",
      tenant_id: "t1",
      referral_id: "r1", // ← pero el asiento vive con referral_id seteado
      source: "referral_credit",
      status: "asentado",
      deleted_at: null,
      invoice_id: "inv1",
    },
  ];
  store.invoices = [
    { id: "inv1", tenant_id: "t1", total_amount: 100, paid_amount: 80, status: "pagada" },
  ];
});

describe("revertReferralCreditsForInvoice · Fix B (barre por referral_id)", () => {
  it("anula el asiento aunque applied_entry_id sea NULL (no queda huérfano)", async () => {
    const res = await revertReferralCreditsForInvoice("t1", "inv1");
    expect(res.ok).toBe(true);
    expect(res.reverted).toBe(1);

    // El asiento se anuló pese a que el crédito nunca linkeó applied_entry_id.
    const entry = store.journal_entries.find((e) => e.id === "e1")!;
    expect(entry.status).toBe("anulado"); // no huérfano
  });

  it("Fix C: baja el paid_amount de la factura en el monto del crédito", async () => {
    await revertReferralCreditsForInvoice("t1", "inv1");
    const inv = store.invoices.find((i) => i.id === "inv1")!;
    expect(inv.paid_amount).toBe(0); // 80 − 80 (se deshace el abono no-monetario)
  });

  it("devuelve el crédito a 'acreditado' y limpia el rastro", async () => {
    await revertReferralCreditsForInvoice("t1", "inv1");
    const ref = store.referrals.find((r) => r.id === "r1")!;
    expect(ref.status).toBe("acreditado");
    expect(ref.applied_invoice_id).toBeNull();
    expect(ref.applied_entry_id).toBeNull();
    expect(ref.applied_at).toBeNull();
  });

  it("es idempotente: revertir dos veces no re-anula ni re-descuenta (2ª pasada = 0)", async () => {
    const first = await revertReferralCreditsForInvoice("t1", "inv1");
    expect(first.reverted).toBe(1);

    const second = await revertReferralCreditsForInvoice("t1", "inv1");
    expect(second.reverted).toBe(0); // ya no hay créditos 'aplicado' a esta factura

    // El saldo no se descontó dos veces (sigue en 0, no negativo).
    const inv = store.invoices.find((i) => i.id === "inv1")!;
    expect(inv.paid_amount).toBe(0);
  });
});

/**
 * SDD-0490. La reversión corre después de anular la factura (voidInvoice). Con
 * la factura anulada, el único otro escritor de su pagado es
 * void_collection_receipt (0467), que baja el pagado al anular un recibo. El
 * escenario de la spec: pagado 380 = recibo 300 + crédito 80. Si el recibo se
 * anula entre la lectura y el UPDATE de la reversión, lo correcto es 0; sin
 * guard quedaba 300.
 */
describe("revertReferralCreditsForInvoice · SDD-0490 (guard, reintento y estado)", () => {
  const invoice = () => store.invoices.find((i) => i.id === "inv1")!;
  const referral = () => store.referrals.find((r) => r.id === "r1")!;
  const entry = () => store.journal_entries.find((e) => e.id === "e1")!;

  beforeEach(() => {
    store.invoices = [
      { id: "inv1", tenant_id: "t1", total_amount: 1000, paid_amount: 380, status: "anulada" },
    ];
    Object.assign(referral(), {
      applied_entry_id: "e1",
      applied_at: "2026-09-01T12:00:00+00:00",
    });
  });

  it("un recibo se anula entre la lectura y el UPDATE: relee y deja 0, no 300", async () => {
    let fired = false;
    hooks.beforeUpdate = (table) => {
      if (table !== "invoices" || fired) return;
      fired = true;
      invoice().paid_amount = 80; // void_collection_receipt: 380 − 300
    };

    const res = await revertReferralCreditsForInvoice("t1", "inv1");

    expect(res).toEqual({ ok: true, reverted: 1 });
    expect(invoice().paid_amount).toBe(0);
    expect(invoice().status).toBe("anulada");
    expect(invoiceUpdates).toBe(2); // el primero matcheó 0 filas; el segundo, releído
    expect(referral().status).toBe("acreditado");
    expect(entry().status).toBe("anulado");
  });

  it("una factura anulada conserva su estado (regla de la 0467)", async () => {
    await revertReferralCreditsForInvoice("t1", "inv1");
    expect(invoice()).toMatchObject({ paid_amount: 300, status: "anulada" });
  });

  it("no deja «pagada» con saldo pendiente: recalcula el estado con la regla de la 0467", async () => {
    // Una aplicación en vuelo pudo revivir la factura anulada (el caso que el
    // guard de estado de applyReferralCredit ahora corta).
    store.invoices = [
      { id: "inv1", tenant_id: "t1", total_amount: 80, paid_amount: 80, status: "pagada" },
    ];
    await revertReferralCreditsForInvoice("t1", "inv1");
    expect(invoice()).toMatchObject({ paid_amount: 0, status: "emitida" });

    expect(invoiceStatusAfterPaidDecrease("pagada", 20)).toBe("parcial");
    expect(invoiceStatusAfterPaidDecrease("pagada", 0)).toBe("emitida");
    expect(invoiceStatusAfterPaidDecrease("parcial", 0)).toBe("emitida");
    expect(invoiceStatusAfterPaidDecrease("anulada", 0)).toBe("anulada");
    expect(invoiceStatusAfterPaidDecrease("borrador", 0)).toBe("borrador");
  });

  it("si la factura se anula entre la lectura y el UPDATE, el guard de estado no la revive", async () => {
    store.invoices = [
      { id: "inv1", tenant_id: "t1", total_amount: 1000, paid_amount: 380, status: "parcial" },
    ];
    let fired = false;
    hooks.beforeUpdate = (table) => {
      if (table !== "invoices" || fired) return;
      fired = true;
      invoice().status = "anulada"; // anular no toca el pagado
    };

    const res = await revertReferralCreditsForInvoice("t1", "inv1");

    expect(res.ok).toBe(true);
    expect(invoice()).toMatchObject({ paid_amount: 300, status: "anulada" });
    expect(invoiceUpdates).toBe(2);
  });

  it(`conflicto persistente: tras ${REVERT_PAID_MAX_ATTEMPTS} intentos compensa y no toca el asiento`, async () => {
    hooks.beforeUpdate = (table) => {
      if (table === "invoices") invoice().paid_amount = Number(invoice().paid_amount) - 1;
    };

    const res = await revertReferralCreditsForInvoice("t1", "inv1");

    expect(res.ok).toBe(false);
    expect(res.reverted).toBe(0);
    expect(res.error).toMatch(/cambió de saldo o de estado/);
    expect(invoiceUpdates).toBe(REVERT_PAID_MAX_ATTEMPTS);
    // Nada quedó a medias: el crédito vuelve a 'aplicado' con su rastro...
    expect(referral()).toMatchObject({
      status: "aplicado",
      applied_invoice_id: "inv1",
      applied_entry_id: "e1",
      applied_at: "2026-09-01T12:00:00+00:00",
    });
    // ...y su asiento sigue asentado: el mayor y la factura no divergen.
    expect(entry().status).toBe("asentado");
    // Sólo movió el pagado el otro escritor (una baja de 1 por intento).
    expect(invoice().paid_amount).toBe(380 - REVERT_PAID_MAX_ATTEMPTS);
  });

  it("si otra reversión ya devolvió el crédito, no baja el pagado otra vez", async () => {
    hooks.beforeUpdate = (table) => {
      // Entre la lectura de créditos y el claim, otra reversión lo reclamó.
      if (table === "referrals" && referral().status === "aplicado") {
        referral().status = "acreditado";
      }
    };

    const res = await revertReferralCreditsForInvoice("t1", "inv1");

    expect(res).toEqual({ ok: true, reverted: 0 });
    expect(invoice().paid_amount).toBe(380);
    expect(invoiceUpdates).toBe(0);
  });
});
