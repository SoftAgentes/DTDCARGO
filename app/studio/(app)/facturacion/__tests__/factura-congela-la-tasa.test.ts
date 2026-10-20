/**
 * SDD-0569 · Una factura en VES o CNY congela la tasa que usó, con su fuente y
 * su fecha (`fx_rate`, `fx_rate_source`, `fx_rate_valid_on`, migración 0495).
 *
 * - `updateInvoice`: sin tasa escrita, toma la vigente de `fx_rate_on`; la tasa
 *   igual a la guardada conserva su fuente y su fecha; sin ninguna, devuelve el
 *   error del campo y no escribe; al pasar a USD o USDT, las tres van a null.
 * - `emitInvoice` (revisión de seguridad, hallazgo 4): en VES o CNY exige tasa, y
 *   si no es `manual` la vuelve a resolver al día de emisión (decisión 1 de Sam:
 *   «la tasa BCV del día de emisión»). Sin tasa, no emite ni asienta.
 * - `duplicateInvoice` (hallazgo 4): la copia resuelve su tasa con
 *   `tasaDelDocumento`, no hereda la del original; sin tasa, no consume
 *   correlativo.
 *
 * El doble de Supabase registra cada UPDATE, INSERT y RPC.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/studio/rbac-guard", () => ({ moduleEditDenial: vi.fn(async () => null) }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/studio/mail/mail-rule-engine", () => ({ fireMailEvent: vi.fn() }));
const asientos: unknown[] = [];
vi.mock("@/lib/studio/accounting/invoice-posting", () => ({
  postInvoiceJournalEntry: vi.fn(async (input: unknown) => {
    asientos.push(input);
    return { ok: true };
  }),
}));
vi.mock("@/lib/studio/fiscal/queries", () => ({
  getFiscalSettingsSafe: vi.fn(async () => ({
    fiscal_module_enabled: false,
    default_invoice_iva_mode: "sin_iva",
    iva_rate_general: 16,
  })),
}));

type Write = { table: string; kind: "update" | "insert"; values: Record<string, unknown> };
let writes: Write[] = [];
let rpcs: { rpc: string; args: Record<string, unknown> }[] = [];
let vigente: { data: unknown; error: unknown } = { data: null, error: null };
let guardada: Record<string, unknown> = {};

function makeClient() {
  return {
    rpc: async (rpc: string, args: Record<string, unknown>) => {
      rpcs.push({ rpc, args });
      if (rpc === "next_invoice_code") return { data: "F-2026-0570", error: null };
      return vigente;
    },
    from(table: string) {
      const chain = {
        select: () => chain,
        eq: () => chain,
        is: () => chain,
        update(values: Record<string, unknown>) {
          writes.push({ table, kind: "update", values });
          return chain;
        },
        insert(values: Record<string, unknown>) {
          writes.push({ table, kind: "insert", values });
          return chain;
        },
        maybeSingle: async () => {
          if (table === "invoices") {
            return {
              data: {
                id: "inv-0569",
                tenant_id: "t1",
                status: "borrador",
                invoice_code: "F-2026-0569",
                client_markbox: "DTD-1001",
                client_name: "Cliente de prueba",
                shipment_id: null,
                shipment_code: null,
                due_date: null,
                base_amount: 718,
                iva_amount: 0,
                total_amount: 718,
                lines: [{ desc: "Flete", qty: 1, unitPrice: 718 }],
                notes: null,
                currency: "CNY",
                fx_rate: null,
                fx_rate_source: null,
                fx_rate_valid_on: null,
                ...guardada,
              },
              error: null,
            };
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

const { updateInvoice, emitInvoice, duplicateInvoice } = await import("../actions");

function borrador(currency: string, fxRate?: string): FormData {
  const fd = new FormData();
  fd.set("client_markbox", "DTD-1001");
  fd.set("client_name", "Cliente de prueba");
  fd.set("currency", currency);
  if (fxRate !== undefined) fd.set("fx_rate", fxRate);
  fd.set("lines", JSON.stringify([{ desc: "Flete", qty: 1, unitPrice: 718 }]));
  return fd;
}

const hoy = () => new Date().toISOString().slice(0, 10);
const escritura = (kind: "update" | "insert") => writes.find((w) => w.table === "invoices" && w.kind === kind);

beforeEach(() => {
  writes = [];
  rpcs = [];
  asientos.length = 0;
  vigente = { data: null, error: null };
  guardada = {};
});

describe("updateInvoice · la tasa congelada", () => {
  it("CNY sin tasa escrita: toma la vigente y guarda su fuente y su fecha", async () => {
    vigente = { data: [{ rate: "7.18000000", source: "bcv", valid_on: "2026-10-18" }], error: null };
    expect(await updateInvoice("inv-0569", {}, borrador("CNY"))).toEqual({ ok: true });
    expect(rpcs).toHaveLength(1);
    expect(rpcs[0]).toMatchObject({ rpc: "fx_rate_on", args: { p_tenant_id: "t1", p_currency: "CNY" } });
    expect(escritura("update")?.values).toMatchObject({
      currency: "CNY",
      fx_rate: 7.18,
      fx_rate_source: "bcv",
      fx_rate_valid_on: "2026-10-18",
    });
  });

  it("VES con otra tasa escrita: es manual del día, sin consultar la vigente", async () => {
    guardada = { currency: "VES", fx_rate: 36.5, fx_rate_source: "bcv", fx_rate_valid_on: "2026-10-18" };
    expect(await updateInvoice("inv-0569", {}, borrador("VES", "40.25"))).toEqual({ ok: true });
    expect(rpcs).toHaveLength(0);
    expect(escritura("update")?.values).toMatchObject({
      currency: "VES",
      fx_rate: 40.25,
      fx_rate_source: "manual",
      fx_rate_valid_on: hoy(),
    });
  });

  it("guardar sin tocar la tasa conserva su fuente y su fecha (revisión, hallazgo 3)", async () => {
    guardada = { currency: "CNY", fx_rate: 7.18, fx_rate_source: "bcv", fx_rate_valid_on: "2026-10-18" };
    expect(await updateInvoice("inv-0569", {}, borrador("CNY", "7.18"))).toEqual({ ok: true });
    expect(rpcs).toHaveLength(0);
    expect(escritura("update")?.values).toMatchObject({
      fx_rate: 7.18,
      fx_rate_source: "bcv",
      fx_rate_valid_on: "2026-10-18",
    });
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

  it("al pasar a USD, la tasa, su fuente y su fecha van a null (revisión, hallazgo 3)", async () => {
    guardada = { currency: "CNY", fx_rate: 7.18, fx_rate_source: "bcv", fx_rate_valid_on: "2026-10-18" };
    // El formulario trae la tasa vieja en el campo oculto.
    expect(await updateInvoice("inv-0569", {}, borrador("USD", "7.18"))).toEqual({ ok: true });
    expect(rpcs).toHaveLength(0);
    expect(escritura("update")?.values).toMatchObject({
      currency: "USD",
      fx_rate: null,
      fx_rate_source: null,
      fx_rate_valid_on: null,
    });
  });
});

describe("emitInvoice · la tasa del día de emisión (revisión, hallazgo 4)", () => {
  it("con una tasa que no es manual, la vuelve a resolver al día de emisión", async () => {
    guardada = { currency: "CNY", fx_rate: 7.18, fx_rate_source: "bcv", fx_rate_valid_on: "2026-10-01" };
    vigente = { data: [{ rate: 7.2, source: "bcv", valid_on: hoy() }], error: null };
    expect(await emitInvoice("inv-0569")).toEqual({ ok: true });
    expect(rpcs).toEqual([{ rpc: "fx_rate_on", args: { p_tenant_id: "t1", p_currency: "CNY", p_on: hoy() } }]);
    expect(escritura("update")?.values).toMatchObject({
      status: "emitida",
      fx_rate: 7.2,
      fx_rate_source: "bcv",
      fx_rate_valid_on: hoy(),
    });
  });

  it("con una tasa manual, la conserva", async () => {
    guardada = { currency: "VES", fx_rate: 40.25, fx_rate_source: "manual", fx_rate_valid_on: "2026-10-15" };
    expect(await emitInvoice("inv-0569")).toEqual({ ok: true });
    expect(rpcs).toHaveLength(0);
    expect(escritura("update")?.values).toMatchObject({ status: "emitida" });
    expect(escritura("update")?.values).not.toHaveProperty("fx_rate");
  });

  it("sin tasa vigente, no emite ni asienta", async () => {
    guardada = { currency: "CNY", fx_rate: null, fx_rate_source: null, fx_rate_valid_on: null };
    vigente = { data: null, error: { code: "22023", message: "FX_RATE_MISSING", hint: "dtd-fx" } };
    const res = await emitInvoice("inv-0569");
    expect(res.error).toMatch(/^No se puede emitir: falta la tasa de yuanes para el \d{4}-\d{2}-\d{2}\. Cárgala en Admin › Tasas o escríbela en el borrador\.$/);
    expect(writes).toHaveLength(0);
    expect(asientos).toHaveLength(0);
  });

  it("en USD no busca tasa", async () => {
    guardada = { currency: "USD" };
    expect(await emitInvoice("inv-0569")).toEqual({ ok: true });
    expect(rpcs).toHaveLength(0);
    expect(escritura("update")?.values).not.toHaveProperty("fx_rate");
  });
});

describe("duplicateInvoice · la copia resuelve su tasa (revisión, hallazgo 4)", () => {
  it("toma la vigente de hoy, no la del original", async () => {
    guardada = { currency: "CNY", fx_rate: 7.0, fx_rate_source: "manual", fx_rate_valid_on: "2026-09-01" };
    vigente = { data: [{ rate: 7.2, source: "bcv", valid_on: "2026-10-19" }], error: null };
    expect(await duplicateInvoice("inv-0569")).toEqual({ ok: true, code: "F-2026-0570" });
    expect(rpcs[0]).toEqual({ rpc: "fx_rate_on", args: { p_tenant_id: "t1", p_currency: "CNY", p_on: hoy() } });
    expect(escritura("insert")?.values).toMatchObject({
      currency: "CNY",
      fx_rate: 7.2,
      fx_rate_source: "bcv",
      fx_rate_valid_on: "2026-10-19",
      status: "borrador",
    });
  });

  it("sin tasa, no duplica ni consume correlativo", async () => {
    guardada = { currency: "VES", fx_rate: 36, fx_rate_source: "manual", fx_rate_valid_on: "2026-09-01" };
    vigente = { data: null, error: { code: "22023", message: "FX_RATE_MISSING", hint: "dtd-fx" } };
    const res = await duplicateInvoice("inv-0569");
    expect(res.error).toMatch(/^Falta la tasa de bolívares para el /);
    expect(rpcs.map((r) => r.rpc)).toEqual(["fx_rate_on"]);
    expect(writes).toHaveLength(0);
  });

  it("en USD copia sin tasa", async () => {
    guardada = { currency: "USD", fx_rate: null };
    expect(await duplicateInvoice("inv-0569")).toEqual({ ok: true, code: "F-2026-0570" });
    expect(rpcs.map((r) => r.rpc)).toEqual(["next_invoice_code"]);
    expect(escritura("insert")?.values).toMatchObject({ currency: "USD", fx_rate: null });
  });
});
