/**
 * SDD-0569 · Una CxP en VES o CNY congela la tasa que usó, con su fuente y su
 * fecha (migración 0495). Sin tasa escrita, `createBillFor` toma la vigente al
 * día de emisión; sin ninguna, devuelve el error del campo antes de escribir.
 *
 * El doble corta en el INSERT (devuelve error) para afirmar lo que se manda sin
 * correr el asiento de causación.
 */
import { beforeEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createBillFor } from "../treasury-actions";

let rpcs: { rpc: string; args: Record<string, unknown> }[] = [];
let inserts: Record<string, unknown>[] = [];
let vigente: { data: unknown; error: unknown } = { data: null, error: null };

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
        single: async () => ({ data: null, error: { message: "corte de la prueba" } }),
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

  it("en USDT no hay tasa ni se nombran las columnas de la 0495", async () => {
    await createBillFor(makeClient(), { ...cxp, currency: "USDT", fxRate: null });
    expect(rpcs.map((r) => r.rpc)).toEqual(["next_bill_code"]);
    expect(inserts[0]).not.toHaveProperty("fx_rate_source");
    expect(inserts[0]).not.toHaveProperty("fx_rate_valid_on");
  });
});
