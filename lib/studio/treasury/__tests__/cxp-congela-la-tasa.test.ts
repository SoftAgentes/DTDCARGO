/**
 * SDD-0569 · Una CxP en VES o CNY congela la tasa que usó, con su fuente y su
 * fecha (migración 0495). Sin tasa escrita, `createBillFor` toma la vigente al
 * día de emisión; sin ninguna, devuelve el error del campo antes de escribir.
 *
 * El doble corta en el INSERT (devuelve error) para afirmar lo que se manda sin
 * correr el asiento de causación.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const asientos: { fxRate: unknown }[] = [];
vi.mock("@/lib/studio/accounting/bill-posting", () => ({
  postBillJournalEntry: vi.fn(async (input: { fxRate: unknown }) => {
    asientos.push(input);
    return { ok: true, entryId: "je-1" };
  }),
  voidBillJournalEntry: vi.fn(),
}));

const { createBillFor } = await import("../treasury-actions");

let rpcs: { rpc: string; args: Record<string, unknown> }[] = [];
let inserts: Record<string, unknown>[] = [];
let vigente: { data: unknown; error: unknown } = { data: null, error: null };
// Lo que devuelve el INSERT: null corta la prueba ahí (sin asiento).
let guardada: { id: string; fx_rate: unknown } | null = null;

function makeClient(): SupabaseClient {
  const client = {
    rpc: async (rpc: string, args: Record<string, unknown>) => {
      rpcs.push({ rpc, args });
      if (rpc === "next_bill_code") return { data: "CXP-2026-0001", error: null };
      return vigente;
    },
    from(table: string) {
      const chain = {
        select: () => chain,
        eq: () => chain,
        insert(values: Record<string, unknown>) {
          inserts.push(values);
          return chain;
        },
        maybeSingle: async () => {
          if (table === "user_tenants") return { data: { tenant_id: "t1" }, error: null };
          if (table === "suppliers") return { data: { id: "s1", name: "Proveedor de prueba" }, error: null };
          throw new Error(`lectura inesperada en ${table}`);
        },
        update: () => chain,
        then: (resolve: (v: { error: null }) => void) => resolve({ error: null }),
        single: async () => (guardada ? { data: guardada, error: null } : { data: null, error: { message: "corte de la prueba" } }),
      };
      return chain;
    },
  };
  return client as unknown as SupabaseClient;
}

const cxp = {
  supplierId: "s1",
  expenseAccountId: "acc-exp",
  totalAmount: 7180,
  issueDate: "2026-10-15",
  dueDate: "2026-11-15",
  concept: "Flete",
  reference: null,
  shipmentId: null,
  notes: null,
};

beforeEach(() => {
  rpcs = [];
  inserts = [];
  vigente = { data: null, error: null };
  guardada = null;
  asientos.length = 0;
});

describe("createBillFor · la tasa congelada", () => {
  it("CNY sin tasa escrita: toma la vigente al día de emisión y guarda su fuente y su fecha", async () => {
    vigente = { data: [{ rate: 7.18, source: "manual", valid_on: "2026-10-14" }], error: null };
    await createBillFor(makeClient(), { ...cxp, currency: "CNY", fxRate: null });
    expect(rpcs[0]).toEqual({
      rpc: "fx_rate_on",
      args: { p_tenant_id: "t1", p_currency: "CNY", p_on: "2026-10-15" },
    });
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      currency: "CNY",
      fx_rate: 7.18,
      fx_rate_source: "manual",
      fx_rate_valid_on: "2026-10-14",
    });
  });

  it("sin ninguna tasa: el error del campo y nada escrito", async () => {
    vigente = { data: null, error: { code: "22023", message: "FX_RATE_MISSING", hint: "dtd-fx" } };
    const res = await createBillFor(makeClient(), { ...cxp, currency: "VES", fxRate: null });
    expect(res).toEqual({
      fieldErrors: {
        fxRate: "Falta la tasa de bolívares para el 2026-10-15: escríbela aquí o cárgala en Admin › Tasas.",
      },
    });
    expect(inserts).toHaveLength(0);
    expect(rpcs.map((r) => r.rpc)).toEqual(["fx_rate_on"]);
  });

  it("el asiento usa la tasa que quedó guardada, no la escrita (revisión, hallazgo 6)", async () => {
    // La base redondea a 8 decimales (numeric(20,8)); el asiento tiene que usar esa.
    guardada = { id: "b1", fx_rate: "7.12345679" };
    expect(await createBillFor(makeClient(), { ...cxp, currency: "CNY", fxRate: 7.123456789 })).toEqual({
      ok: true,
      billCode: "CXP-2026-0001",
    });
    expect(asientos).toHaveLength(1);
    expect(asientos[0].fxRate).toBe(7.12345679);
  });

  it("en USDT no hay tasa ni se nombran las columnas de la 0495", async () => {
    await createBillFor(makeClient(), { ...cxp, currency: "USDT", fxRate: null });
    expect(rpcs.map((r) => r.rpc)).toEqual(["next_bill_code"]);
    expect(inserts[0]).not.toHaveProperty("fx_rate_source");
    expect(inserts[0]).not.toHaveProperty("fx_rate_valid_on");
  });
});
