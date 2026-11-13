/**
 * SDD-0631 · Ligar la CxP a contenedor/embarque desde Tesorería (CA3).
 *
 * - `validateBillCostLink` y `validateBillInput`: categoría obligatoria con
 *   vínculo; sin vínculo, todo en null.
 * - `createBillFor`: sin vínculo NO nombra las columnas de la 0536 (la base
 *   vieja sigue sirviendo); con vínculo las manda; embarque fuera del
 *   contenedor se rechaza antes de escribir.
 * - `linkBillCostFor`: anulada, embarque fuera, rol sin escritura (RLS da cero
 *   filas) y base sin la 0536 tienen su mensaje.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/studio/accounting/bill-posting", () => ({
  postBillJournalEntry: vi.fn(async () => ({ ok: true, entryId: "je-1" })),
  voidBillJournalEntry: vi.fn(),
}));

const { createBillFor, linkBillCostFor, COST_LINK_UNAVAILABLE } = await import("../treasury-actions");
const { validateBillCostLink, validateBillInput } = await import("../types");

type State = {
  inserts: Record<string, unknown>[];
  updates: Record<string, unknown>[];
  bill: { id: string; status: string; deleted_at: string | null } | null;
  itemFound: boolean;
  updateResult: { data: unknown; error: { message: string } | null };
  insertError: { message: string } | null;
  neqs: string[];
};
let st: State;

function makeClient(): SupabaseClient {
  return {
    rpc: async (rpc: string) =>
      rpc === "next_bill_code" ? { data: "CXP-2026-0099", error: null } : { data: null, error: null },
    from(table: string) {
      let mode: "read" | "insert" | "update" = "read";
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        neq(col: string, v: unknown) {
          st.neqs.push(`${table}.${col}<>${String(v)}`);
          return chain;
        },
        insert(values: Record<string, unknown>) {
          mode = "insert";
          st.inserts.push(values);
          return chain;
        },
        update(values: Record<string, unknown>) {
          mode = "update";
          st.updates.push(values);
          return chain;
        },
        limit: async () => ({ data: st.itemFound ? [{ id: "i1" }] : [], error: null }),
        maybeSingle: async () => {
          if (table === "user_tenants") return { data: { tenant_id: "t1" }, error: null };
          if (table === "suppliers") return { data: { id: "s1", name: "Aliado de espacio de prueba" }, error: null };
          if (table === "supplier_bills") return { data: st.bill, error: null };
          throw new Error(`lectura inesperada en ${table}`);
        },
        single: async () =>
          st.insertError ? { data: null, error: st.insertError } : { data: { id: "b-new", fx_rate: null }, error: null },
        then: (resolve: (v: unknown) => void) =>
          resolve(mode === "update" && table === "supplier_bills" && st.updates.length > 0 && !("journal_entry_id" in st.updates.at(-1)!)
            ? st.updateResult
            : { error: null }),
      };
      return chain;
    },
  } as unknown as SupabaseClient;
}

const cxp = {
  supplierId: "s1",
  expenseAccountId: "acc-exp",
  currency: "USD" as const,
  fxRate: null,
  totalAmount: 1234.5,
  issueDate: "2026-11-10",
  dueDate: "2026-12-10",
  concept: "Espacio en contenedor (prueba)",
  reference: null,
  shipmentId: null,
  notes: null,
};

beforeEach(() => {
  st = {
    inserts: [],
    updates: [],
    bill: { id: "b1", status: "pendiente", deleted_at: null },
    itemFound: true,
    updateResult: { data: [{ id: "b1" }], error: null },
    insertError: null,
    neqs: [],
  };
});

describe("validateBillCostLink", () => {
  it("sin vínculo: todo null y sin error", () => {
    expect(validateBillCostLink({})).toEqual({
      link: { consolidationId: null, shipmentId: null, costCategory: null },
    });
  });
  it("con contenedor exige categoría", () => {
    expect(validateBillCostLink({ consolidationId: "c1" }).error).toMatch(/qué costo cubre/);
    expect(validateBillCostLink({ consolidationId: "c1", costCategory: "espacio" }).error).toMatch(/desconocida/);
  });
  it("embarque sin contenedor está permitido (costo directo)", () => {
    expect(validateBillCostLink({ shipmentId: "s9", costCategory: "customs" }).link).toEqual({
      consolidationId: null,
      shipmentId: "s9",
      costCategory: "customs",
    });
  });
  it("validateBillInput devuelve el vínculo normalizado o el error del campo", () => {
    expect(validateBillInput({ ...cxp, consolidationId: " c1 ", costCategory: "freight" }).input).toMatchObject({
      consolidationId: "c1",
      shipmentId: null,
      costCategory: "freight",
    });
    expect(validateBillInput({ ...cxp, consolidationId: "c1" }).fieldErrors?.costCategory).toBeTruthy();
  });
});

describe("createBillFor con vínculo", () => {
  it("sin vínculo no nombra las columnas de la 0536", async () => {
    expect(await createBillFor(makeClient(), cxp)).toMatchObject({ ok: true });
    expect(st.inserts[0]).not.toHaveProperty("consolidation_id");
    expect(st.inserts[0]).not.toHaveProperty("cost_category");
    expect(st.inserts[0].shipment_id).toBeNull();
  });

  it("con contenedor y embarque los manda con la categoría", async () => {
    const r = await createBillFor(makeClient(), {
      ...cxp,
      consolidationId: "c1",
      shipmentId: "s1",
      costCategory: "freight",
    });
    expect(r).toMatchObject({ ok: true });
    expect(st.inserts[0]).toMatchObject({ consolidation_id: "c1", shipment_id: "s1", cost_category: "freight" });
  });

  it("embarque fuera del contenedor: error de campo y no escribe", async () => {
    st.itemFound = false;
    const r = await createBillFor(makeClient(), {
      ...cxp,
      consolidationId: "c1",
      shipmentId: "s2",
      costCategory: "freight",
    });
    expect(r.fieldErrors?.shipmentId).toMatch(/no está asignado/);
    expect(st.inserts).toHaveLength(0);
  });

  it("base sin la 0536: mensaje claro", async () => {
    st.insertError = { message: 'column "consolidation_id" of relation "supplier_bills" does not exist' };
    const r = await createBillFor(makeClient(), { ...cxp, consolidationId: "c1", costCategory: "freight" });
    expect(r.error).toBe(COST_LINK_UNAVAILABLE);
  });
});

describe("linkBillCostFor", () => {
  it("liga una CxP existente (el caso de la deuda ya registrada)", async () => {
    expect(await linkBillCostFor(makeClient(), "b1", { consolidationId: "c1", costCategory: "freight" })).toEqual({ ok: true });
    expect(st.updates[0]).toEqual({ consolidation_id: "c1", shipment_id: null, cost_category: "freight" });
    // La escritura misma excluye una anulada (la lectura previa no bloquea).
    expect(st.neqs).toContain("supplier_bills.status<>anulada");
  });

  it("quitar el vínculo pone todo en null", async () => {
    expect(await linkBillCostFor(makeClient(), "b1", {})).toEqual({ ok: true });
    expect(st.updates[0]).toEqual({ consolidation_id: null, shipment_id: null, cost_category: null });
  });

  it("una anulada no se liga", async () => {
    st.bill = { id: "b1", status: "anulada", deleted_at: null };
    expect((await linkBillCostFor(makeClient(), "b1", { consolidationId: "c1", costCategory: "freight" })).error).toMatch(/anulada/);
    expect(st.updates).toHaveLength(0);
  });

  it("embarque fuera del contenedor no escribe", async () => {
    st.itemFound = false;
    const r = await linkBillCostFor(makeClient(), "b1", { consolidationId: "c1", shipmentId: "s2", costCategory: "freight" });
    expect(r.error).toMatch(/no está asignado/);
    expect(st.updates).toHaveLength(0);
  });

  it("RLS sin escritura devuelve cero filas: se dice, no se celebra", async () => {
    st.updateResult = { data: [], error: null };
    expect((await linkBillCostFor(makeClient(), "b1", { consolidationId: "c1", costCategory: "freight" })).error).toMatch(/rol/);
  });

  it("base sin la 0536", async () => {
    st.updateResult = { data: null, error: { message: "Could not find the 'cost_category' column of 'supplier_bills' in the schema cache" } };
    expect((await linkBillCostFor(makeClient(), "b1", { consolidationId: "c1", costCategory: "freight" })).error).toBe(COST_LINK_UNAVAILABLE);
  });
});

// ── Degradación sin la 0536 (pending-migration-symbols) ─────────
const { listCostLinkData } = await import("../cost-link-queries");

function linkDataClient(billsError: string | null): SupabaseClient {
  return {
    from(table: string) {
      const chain: Record<string, unknown> = {
        select: () => chain,
        is: () => chain,
        or: () => chain,
        not: () => chain,
        order: () => chain,
        limit: async () => ({
          data: table === "consolidations" ? [{ id: "c1", ref: "DTD-CONSOL-9001", status: "zarpado", container_type: null }] : [],
          error: null,
        }),
        range: async () => {
          if (table === "supplier_bills" && billsError) return { data: null, error: { message: billsError } };
          if (table === "consolidation_items") return { data: [], error: null };
          return { data: [], error: null };
        },
      };
      return chain;
    },
  } as unknown as SupabaseClient;
}

describe("listCostLinkData sin la 0536", () => {
  it("columna inexistente: available=false, contenedores listos y sin vínculos", async () => {
    const d = await listCostLinkData(linkDataClient("column supplier_bills.consolidation_id does not exist"));
    expect(d.available).toBe(false);
    expect(d.links).toEqual({});
    expect(d.containers.map((c) => c.ref)).toEqual(["DTD-CONSOL-9001"]);
  });
  it("caché de PostgREST sin la columna: mismo degradado", async () => {
    const d = await listCostLinkData(linkDataClient("Could not find the 'cost_category' column of 'supplier_bills' in the schema cache"));
    expect(d.available).toBe(false);
  });
  it("otro error no se disfraza de base vieja", async () => {
    await expect(listCostLinkData(linkDataClient("permission denied for table supplier_bills"))).rejects.toThrow(/permission denied/);
  });
  it("con la 0536: available=true", async () => {
    expect((await listCostLinkData(linkDataClient(null))).available).toBe(true);
  });
});
