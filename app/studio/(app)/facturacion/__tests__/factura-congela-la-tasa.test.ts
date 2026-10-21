/**
 * SDD-0569 · Una factura en VES o CNY congela la tasa que usó, con su fuente y
 * su fecha (`fx_rate`, `fx_rate_source`, `fx_rate_valid_on`, migración 0495).
 *
 * - `updateInvoice`: intención explícita del campo (conservar/manual/catálogo),
 *   sin inferir por igualdad. Cambiar moneda limpia la procedencia anterior.
 * - `emitInvoice`: solo conserva un override documental explícito; la fuente
 *   manual del catálogo se vuelve a resolver. VES automática exige fecha exacta.
 * - `duplicateInvoice` (hallazgo 4): la copia resuelve su tasa con
 *   `tasaDelDocumento`, no hereda la del original; sin tasa, no consume
 *   correlativo.
 *
 * El doble aplica los filtros al escribir y permite intercalar acciones después
 * de la lectura. Así detecta una operación que informa éxito sin afectar filas.
 * Devuelve solo la proyección solicitada: el aviso debe usar la tasa guardada,
 * no la anterior del borrador ni una columna que el UPDATE no devolvió.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireMailEvent } from "@/lib/studio/mail/mail-rule-engine";

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
let antesDeEscribir: (() => Promise<void>) | null = null;
let despuesDeAutorizar: (() => void) | null = null;

function fila() {
  return {
    id: "inv-0569", tenant_id: "t1", status: "borrador",
    invoice_code: "F-2026-0569", client_markbox: "DTD-1001",
    client_name: "Cliente de prueba", shipment_id: null, shipment_code: null,
    due_date: null, base_amount: 718, iva_amount: 0, total_amount: 718,
    lines: [{ desc: "Flete", qty: 1, unitPrice: 718 }], notes: null,
    currency: "CNY", fx_rate: null, fx_rate_source: null, fx_rate_valid_on: null,
    fx_rate_is_override: false, write_version: 0, deleted_at: null,
    ...guardada,
  } as Record<string, unknown>;
}

function makeClient() {
  return {
    auth: { getUser: async () => { despuesDeAutorizar?.(); return { data: { user: { id: "u1" } }, error: null }; } },
    rpc: async (rpc: string, args: Record<string, unknown>) => {
      rpcs.push({ rpc, args });
      if (rpc === "next_invoice_code") return { data: "F-2026-0570", error: null };
      return vigente;
    },
    from(table: string) {
      const filtros: [string, unknown][] = [];
      let cambio: Write | null = null;
      let columnas: string | null = null;
      const proyectar = (row: Record<string, unknown>) => {
        if (columnas == null) return null;
        if (columnas === "*") return { ...row };
        return Object.fromEntries(columnas.split(",").map((columna) => {
          const key = columna.trim();
          return [key, row[key]];
        }));
      };
      const ejecutar = async () => {
        if (!cambio) {
          if (table === "invoices") return { data: proyectar(fila()), error: null };
          if (table === "tenants") return { data: proyectar({ iva_enabled: false }), error: null };
          if (table === "user_tenants") return { data: proyectar({ tenant_id: "t1" }), error: null };
          throw new Error(`lectura inesperada en ${table}`);
        }
        const intercalar = antesDeEscribir;
        antesDeEscribir = null;
        if (intercalar) await intercalar();
        const actual = fila();
        if (cambio.kind === "update" && filtros.some(([key, value]) => actual[key] !== value)) {
          return { data: null, error: null };
        }
        writes.push(cambio);
        guardada = { ...actual, ...cambio.values, write_version: Number(actual.write_version) + 1 };
        return { data: proyectar(guardada), error: null };
      };
      const chain = {
        select: (seleccion = "*") => { columnas = seleccion; return chain; },
        eq: (key: string, value: unknown) => { filtros.push([key, value]); return chain; },
        is: (key: string, value: unknown) => { filtros.push([key, value]); return chain; },
        update(values: Record<string, unknown>) {
          cambio = { table, kind: "update", values };
          return chain;
        },
        insert(values: Record<string, unknown>) {
          cambio = { table, kind: "insert", values };
          return chain;
        },
        maybeSingle: ejecutar,
        single: ejecutar,
        then: (resolve: (v: unknown) => unknown) => ejecutar().then(resolve),
      };
      return chain;
    },
  };
}

vi.mock("@/lib/db/server", () => ({ createClient: async () => { despuesDeAutorizar?.(); return makeClient(); } }));

const { createInvoice, updateInvoice, emitInvoice, duplicateInvoice } = await import("../actions");

function borrador(currency: string, fxRate?: string, intent?: "preserve" | "manual" | "catalog"): FormData {
  const fd = new FormData();
  fd.set("client_markbox", "DTD-1001");
  fd.set("client_name", "Cliente de prueba");
  fd.set("currency", currency);
  if (fxRate !== undefined) fd.set("fx_rate", fxRate);
  if (intent) fd.set("fx_rate_intent", intent);
  fd.set("lines", JSON.stringify([{ desc: "Flete", qty: 1, unitPrice: 718 }]));
  return fd;
}

const hoy = () => new Date().toISOString().slice(0, 10);
const escritura = (kind: "update" | "insert") => writes.find((w) => w.table === "invoices" && w.kind === kind);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-20T12:00:00Z"));
  writes = [];
  rpcs = [];
  asientos.length = 0;
  vigente = { data: null, error: null };
  guardada = {};
  antesDeEscribir = null;
  despuesDeAutorizar = null;
  vi.mocked(fireMailEvent).mockClear();
});
afterEach(() => vi.useRealTimers());

describe("C1 · ancla anterior a los awaits de factura", () => {
  it.each(["create", "emit", "update", "duplicate"] as const)("%s conserva el día de inicio aunque la sesión cruce medianoche Caracas", async operation => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-21T03:59:59.999Z"));
    despuesDeAutorizar = () => vi.setSystemTime(new Date("2026-10-21T04:00:00Z"));
    guardada = { currency: "VES" };
    vigente = { data: [{ rate: 40, source: "manual", valid_on: "2026-10-20" }], error: null };
    const form = borrador("VES");
    form.set("emit_on_create", "true");
    const result = operation === "create" ? await createInvoice({}, form)
      : operation === "emit" ? await emitInvoice("inv-0569")
      : operation === "update" ? await updateInvoice("inv-0569", {}, form)
      : await duplicateInvoice("inv-0569");
    expect(result).toMatchObject({ ok: true });
    expect(rpcs.find(r => r.rpc === "fx_rate_on")?.args.p_on).toBe("2026-10-20");
    if (operation === "create" || operation === "emit") {
      expect(writes[0].values.issued_at).toBe("2026-10-20");
      expect(asientos[0]).toMatchObject({ entryDate: "2026-10-20" });
    }
  });
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
    expect(await updateInvoice("inv-0569", {}, borrador("CNY", "7.18", "preserve"))).toEqual({ ok: true });
    expect(rpcs).toHaveLength(0);
    expect(escritura("update")?.values).toMatchObject({
      fx_rate: 7.18,
      fx_rate_source: "bcv",
      fx_rate_valid_on: "2026-10-18",
      fx_rate_is_override: false,
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
    guardada = { currency: "VES", fx_rate: 40.25, fx_rate_source: "manual", fx_rate_valid_on: "2026-10-15", fx_rate_is_override: true };
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

describe("regresiones de revisión · intención y concurrencia", () => {
  it("VES automática no emite con una tasa anterior aunque sea la última vigente", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-20T15:00:00Z"));
    guardada = { currency: "VES", fx_rate: 36, fx_rate_source: "manual", fx_rate_valid_on: "2026-10-19" };
    vigente = { data: [{ rate: 36, source: "manual", valid_on: "2026-10-19" }], error: null };
    expect(await emitInvoice("inv-0569")).toEqual({ error: expect.stringMatching(/falta la tasa de bolívares para el 2026-10-20/) });
    expect(writes).toHaveLength(0);
    expect(asientos).toHaveLength(0);
    expect(fireMailEvent).not.toHaveBeenCalled();
  });

  it("crear-y-emitir VES automática exige tasa del día antes de consumir correlativo", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-20T15:00:00Z"));
    vigente = { data: [{ rate: 36, source: "bcv", valid_on: "2026-10-19" }], error: null };
    const fd = borrador("VES");
    fd.set("emit_on_create", "true");
    expect(await createInvoice({}, fd)).toEqual({ fieldErrors: { fx_rate: expect.stringMatching(/falta la tasa de bolívares para el 2026-10-20/i) } });
    expect(rpcs.map((call) => call.rpc)).toEqual(["fx_rate_on"]);
    expect(writes).toHaveLength(0);
    expect(asientos).toHaveLength(0);
  });

  it("la exigencia de fecha exacta no se extiende a CNY", async () => {
    guardada = { currency: "CNY" };
    vigente = { data: [{ rate: 7.2, source: "manual", valid_on: "2026-10-19" }], error: null };
    expect(await emitInvoice("inv-0569")).toEqual({ ok: true });
    expect(guardada).toMatchObject({ fx_rate: 7.2, fx_rate_valid_on: "2026-10-19", fx_rate_is_override: false });
  });

  it("un borrador creado con catálogo manual el 19 se emite con la tasa del 20", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-19T15:00:00Z"));
    vigente = { data: [{ rate: 36, source: "manual", valid_on: hoy() }], error: null };
    expect(await createInvoice({}, borrador("VES"))).toEqual({ ok: true, createdCode: "F-2026-0570" });
    expect(guardada).toMatchObject({ fx_rate: 36, fx_rate_source: "manual", fx_rate_is_override: false });
    vi.setSystemTime(new Date("2026-10-20T15:00:00Z"));
    vigente = { data: [{ rate: 40, source: "manual", valid_on: hoy() }], error: null };
    expect(await emitInvoice("inv-0569")).toEqual({ ok: true });
    expect(guardada).toMatchObject({ status: "emitida", fx_rate: 40, fx_rate_valid_on: hoy(), fx_rate_is_override: false });
    expect(fireMailEvent).toHaveBeenCalledTimes(1);
    expect(fireMailEvent).toHaveBeenCalledWith(expect.anything(), "t1", expect.objectContaining({
      event: "invoice_emitted", vars: expect.objectContaining({ bcv_rate: "40" }),
    }));
  });

  it("un borrador creado con override expreso conserva su tasa y fecha al día siguiente", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-19T15:00:00Z"));
    expect(await createInvoice({}, borrador("VES", "36", "manual"))).toMatchObject({ ok: true });
    expect(guardada).toMatchObject({ fx_rate: 36, fx_rate_is_override: true, fx_rate_valid_on: "2026-10-19" });
    vi.setSystemTime(new Date("2026-10-20T15:00:00Z"));
    vigente = { data: [{ rate: 40, source: "manual", valid_on: hoy() }], error: null };
    expect(await emitInvoice("inv-0569")).toEqual({ ok: true });
    expect(guardada).toMatchObject({ fx_rate: 36, fx_rate_valid_on: "2026-10-19", fx_rate_is_override: true });
    expect(rpcs.map((call) => call.rpc)).toEqual(["next_invoice_code"]);
    expect(fireMailEvent).toHaveBeenCalledTimes(1);
    expect(fireMailEvent).toHaveBeenCalledWith(expect.anything(), "t1", expect.objectContaining({
      event: "invoice_emitted", vars: expect.objectContaining({ bcv_rate: "36" }),
    }));
  });

  it("un borrador VES sin tasa avisa con la tasa que se guardó al emitir", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-20T15:00:00Z"));
    guardada = { currency: "VES", fx_rate: null, fx_rate_source: null, fx_rate_valid_on: null };
    vigente = { data: [{ rate: 40, source: "bcv", valid_on: hoy() }], error: null };
    expect(await emitInvoice("inv-0569")).toEqual({ ok: true });
    expect(guardada).toMatchObject({ status: "emitida", fx_rate: 40, fx_rate_valid_on: hoy() });
    expect(fireMailEvent).toHaveBeenCalledTimes(1);
    expect(fireMailEvent).toHaveBeenCalledWith(expect.anything(), "t1", expect.objectContaining({
      event: "invoice_emitted", vars: expect.objectContaining({ bcv_rate: "40" }),
    }));
  });

  it("escribir explícitamente la misma cifra del catálogo crea override persistido", async () => {
    guardada = { currency: "VES", fx_rate: 36, fx_rate_source: "manual", fx_rate_valid_on: "2026-10-19" };
    expect(await updateInvoice("inv-0569", {}, borrador("VES", "36", "manual"))).toEqual({ ok: true });
    expect(guardada).toMatchObject({ fx_rate: 36, fx_rate_is_override: true, fx_rate_valid_on: hoy() });
    vigente = { data: [{ rate: 40, source: "bcv", valid_on: hoy() }], error: null };
    expect(await emitInvoice("inv-0569")).toEqual({ ok: true });
    expect(guardada.fx_rate).toBe(36);
    expect(rpcs).toHaveLength(0);
  });

  it("duplicar hoy con catálogo manual y emitir mañana vuelve a resolver", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-19T15:00:00Z"));
    guardada = { currency: "VES", fx_rate: 30, fx_rate_is_override: true };
    vigente = { data: [{ rate: 36, source: "manual", valid_on: hoy() }], error: null };
    expect(await duplicateInvoice("inv-0569")).toMatchObject({ ok: true });
    expect(guardada).toMatchObject({ fx_rate: 36, fx_rate_is_override: false });
    vi.setSystemTime(new Date("2026-10-20T15:00:00Z"));
    vigente = { data: [{ rate: 40, source: "bcv", valid_on: hoy() }], error: null };
    expect(await emitInvoice("inv-0569")).toEqual({ ok: true });
    expect(guardada.fx_rate).toBe(40);
  });

  it.each([
    ["moneda", { currency: "CNY", fx_rate: 7.2 }],
    ["importe y destinatario", { total_amount: 999, base_amount: 999, client_markbox: "DTD-2002" }],
  ] as const)("si cambia %s entre lectura y emisión, no emite ni asienta ni avisa", async (_name, cambio) => {
    guardada = { currency: "VES", fx_rate: 36 };
    vigente = { data: [{ rate: 40, source: "bcv", valid_on: hoy() }], error: null };
    antesDeEscribir = async () => { guardada = { ...guardada, ...cambio, write_version: 1 }; };
    expect(await emitInvoice("inv-0569")).toEqual({ error: expect.stringMatching(/cambió.*recarga/i) });
    expect(fila().status).toBe("borrador");
    expect(writes).toHaveLength(0);
    expect(asientos).toHaveLength(0);
    expect(fireMailEvent).not.toHaveBeenCalled();
  });

  it("una edición que termina antes de emitir obliga a recargar la emisión", async () => {
    guardada = { currency: "VES", fx_rate: 36 };
    vigente = { data: [{ rate: 40, source: "bcv", valid_on: hoy() }], error: null };
    antesDeEscribir = async () => {
      expect(await updateInvoice("inv-0569", {}, borrador("CNY", "7.2"))).toEqual({ ok: true });
    };
    expect(await emitInvoice("inv-0569")).toEqual({ error: expect.stringMatching(/cambió.*recarga/i) });
    expect(guardada).toMatchObject({ currency: "CNY", fx_rate: 7.2, status: "borrador" });
    expect(asientos).toHaveLength(0);
    expect(fireMailEvent).not.toHaveBeenCalled();
  });

  it("una edición concurrente de datos sin cambiar moneda impide sobrescribirlos", async () => {
    guardada = { currency: "VES", fx_rate: 36 };
    antesDeEscribir = async () => {
      guardada = { ...guardada, client_name: "Cambio concurrente", total_amount: 999, write_version: 1 };
    };
    expect(await updateInvoice("inv-0569", {}, borrador("VES", "40"))).toEqual({
      error: expect.stringMatching(/cambió.*recarga/i),
    });
    expect(guardada).toMatchObject({ client_name: "Cambio concurrente", total_amount: 999 });
    expect(writes).toHaveLength(0);
  });

  it("una emisión que termina antes de guardar impide editar la factura emitida", async () => {
    guardada = { currency: "VES", fx_rate: 36 };
    vigente = { data: [{ rate: 40, source: "bcv", valid_on: hoy() }], error: null };
    antesDeEscribir = async () => { expect(await emitInvoice("inv-0569")).toEqual({ ok: true }); };
    expect(await updateInvoice("inv-0569", {}, borrador("CNY", "7.2"))).toEqual({
      error: expect.stringMatching(/cambió.*recarga/i),
    });
    expect(guardada).toMatchObject({ status: "emitida", currency: "VES", fx_rate: 40 });
    expect(asientos).toHaveLength(1);
    expect(fireMailEvent).toHaveBeenCalledTimes(1);
  });

  it.each(["0.000000001", "0.000000004999999"])("una tasa %s que se guardaría en cero no crea ni consume correlativo", async (rate) => {
    vigente = { data: [{ rate: 40, source: "bcv", valid_on: hoy() }], error: null };
    expect(await createInvoice({}, borrador("VES", rate))).toEqual({
      fieldErrors: { fx_rate: expect.stringMatching(/8 decimales/) },
    });
    expect(writes).toHaveLength(0);
    expect(rpcs).toHaveLength(0);
    expect(asientos).toHaveLength(0);
  });

  it.each([["0.000000005", 0.00000001], ["0.000000015", 0.00000002]] as const)(
    "la factura captura %s como %s antes de persistir",
    async (rate, normalized) => {
      expect(await createInvoice({}, borrador("VES", rate))).toMatchObject({ ok: true });
      expect(escritura("insert")?.values).toMatchObject({ fx_rate: normalized, fx_rate_is_override: true });
    },
  );
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
