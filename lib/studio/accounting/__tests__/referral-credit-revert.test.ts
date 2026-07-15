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
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

type Row = Record<string, unknown>;

// Store mutable compartido entre el stub y las aserciones.
const store: { referrals: Row[]; journal_entries: Row[]; invoices: Row[] } = {
  referrals: [],
  journal_entries: [],
  invoices: [],
};

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

      const chain: Row = {
        select() {
          op = "select";
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
          const found = store[table].find((r) => matches(r, filters)) ?? null;
          return Promise.resolve({ data: found, error: null });
        },
        then(resolve: (v: { data: unknown; error: null }) => unknown) {
          const rows = store[table].filter((r) => matches(r, filters));
          if (op === "update") {
            for (const r of rows) Object.assign(r, payload);
            return Promise.resolve({ data: null, error: null }).then(resolve);
          }
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

import { revertReferralCreditsForInvoice } from "../referral-credit-posting";

beforeEach(() => {
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
