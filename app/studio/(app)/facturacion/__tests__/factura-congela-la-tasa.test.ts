/**
 * SDD-0569 · Un borrador en VES o CNY congela la tasa que usó, con su fuente y
 * su fecha (`fx_rate`, `fx_rate_source`, `fx_rate_valid_on`, migración 0495).
 *
 * Sin tasa escrita, `updateInvoice` toma la vigente de `fx_rate_on`; sin ninguna,
 * devuelve el error del campo y no escribe. En USD no nombra las columnas nuevas.
 * El doble de Supabase registra el UPDATE y cada RPC.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/studio/rbac-guard", () => ({ moduleEditDenial: vi.fn(async () => null) }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/studio/mail/mail-rule-engine", () => ({ fireMailEvent: vi.fn() }));
vi.mock("@/lib/studio/fiscal/queries", () => ({
  getFiscalSettingsSafe: vi.fn(async () => ({
    fiscal_module_enabled: false,
    default_invoice_iva_mode: "sin_iva",
    iva_rate_general: 16,
  })),
}));

type Write = { table: string; values: Record<string, unknown> };
let writes: Write[] = [];
let rpcs: { rpc: string; args: Record<string, unknown> }[] = [];
let vigente: { data: unknown; error: unknown } = { data: null, error: null };

function makeClient() {
  return {
    rpc: async (rpc: string, args: Record<string, unknown>) => {
      rpcs.push({ rpc, args });
      return vigente;
    },
    from(table: string) {
      const chain = {
        select: () => chain,
        eq: () => chain,
        update(values: Record<string, unknown>) {
          writes.push({ table, values });
          return chain;
        },
        maybeSingle: async () => {
          if (table === "invoices") {
            return { data: { status: "borrador", invoice_code: "F-2026-0569", tenant_id: "t1" }, error: null };
          }
          if (table === "tenants") return { data: { iva_enabled: false }, error: null };
          throw new Error(`lectura inesperada en ${table}`);
        },
        then(resolve: (v: { error: null }) => void) {
          resolve({ error: null });
        },
      };
      return chain;
    },
  };
}

vi.mock("@/lib/db/server", () => ({ createClient: async () => makeClient() }));

const { updateInvoice } = await import("../actions");

function borrador(currency: string, fxRate?: string): FormData {
  const fd = new FormData();
  fd.set("client_markbox", "DTD-1001");
  fd.set("client_name", "Cliente de prueba");
  fd.set("currency", currency);
  if (fxRate !== undefined) fd.set("fx_rate", fxRate);
  fd.set("lines", JSON.stringify([{ desc: "Flete", qty: 1, unitPrice: 718 }]));
  return fd;
}

beforeEach(() => {
  writes = [];
  rpcs = [];
  vigente = { data: null, error: null };
});

describe("updateInvoice · la tasa congelada", () => {
  it("CNY sin tasa escrita: toma la vigente y guarda su fuente y su fecha", async () => {
    vigente = { data: [{ rate: "7.18000000", source: "bcv", valid_on: "2026-10-18" }], error: null };
    expect(await updateInvoice("inv-0569", {}, borrador("CNY"))).toEqual({ ok: true });
    expect(rpcs).toHaveLength(1);
    expect(rpcs[0]).toMatchObject({ rpc: "fx_rate_on", args: { p_tenant_id: "t1", p_currency: "CNY" } });
    const update = writes.find((w) => w.table === "invoices");
    expect(update?.values).toMatchObject({
      currency: "CNY",
      fx_rate: 7.18,
      fx_rate_source: "bcv",
      fx_rate_valid_on: "2026-10-18",
    });
  });

  it("VES con la tasa escrita: es manual, sin consultar la vigente", async () => {
    expect(await updateInvoice("inv-0569", {}, borrador("VES", "40.25"))).toEqual({ ok: true });
    expect(rpcs).toHaveLength(0);
    const update = writes.find((w) => w.table === "invoices");
    expect(update?.values).toMatchObject({ currency: "VES", fx_rate: 40.25, fx_rate_source: "manual" });
    expect(update?.values.fx_rate_valid_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("sin ninguna tasa: el error del campo dice qué hacer y no escribe", async () => {
    vigente = { data: null, error: { code: "22023", message: "FX_RATE_MISSING", hint: "dtd-fx" } };
    const res = await updateInvoice("inv-0569", {}, borrador("CNY"));
    expect(res).toEqual({
      fieldErrors: {
        fx_rate: expect.stringMatching(/^Falta la tasa de yuanes para el \d{4}-\d{2}-\d{2}: escríbela aquí o cárgala en Admin › Tasas\.$/),
      },
    });
    expect(writes).toHaveLength(0);
  });

  it("en USD no hay tasa ni se nombran las columnas de la 0495", async () => {
    expect(await updateInvoice("inv-0569", {}, borrador("USD"))).toEqual({ ok: true });
    expect(rpcs).toHaveLength(0);
    const update = writes.find((w) => w.table === "invoices");
    expect(update?.values).not.toHaveProperty("fx_rate_source");
    expect(update?.values).not.toHaveProperty("fx_rate_valid_on");
  });
});
