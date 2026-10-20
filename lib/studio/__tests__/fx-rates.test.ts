/**
 * SDD-0569 · La tasa que congela un documento y la captura con tasa obligatoria.
 *
 * - `tasaDelDocumento`: la tasa escrita es `manual` del día; sin ella, la vigente
 *   de `fx_rate_on`, con su fuente y su fecha; sin ninguna, un error que dice qué
 *   hacer. En USD y USDT no hay tasa ni se llama a la base.
 * - Los validadores: factura en VES o CNY y CxP fuera de USD y USDT exigen tasa.
 * - Admin › Tasas exige la fecha de la tasa.
 *
 * El doble de Supabase registra cada RPC y cada lectura para afirmar qué se pidió.
 */
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tasaDelDocumento, tasaVigente, ultimaTasa } from "../fx-rates";
import { validateInvoiceInput, type InvoiceInput } from "../invoice-types";
import { validateBillInput } from "../treasury/types";
import { fxPairCurrency, validateExchangeRateInput } from "../exchange-rates-types";

type Llamada = { rpc: string; args: Record<string, unknown> } | { from: string; eq: [string, unknown][] };

function doble(respuesta: { data: unknown; error: unknown }) {
  const llamadas: Llamada[] = [];
  const client = {
    rpc: async (rpc: string, args: Record<string, unknown>) => {
      llamadas.push({ rpc, args });
      return respuesta;
    },
    from(table: string) {
      const llamada = { from: table, eq: [] as [string, unknown][] };
      llamadas.push(llamada);
      const chain = {
        select: () => chain,
        eq: (col: string, val: unknown) => {
          llamada.eq.push([col, val]);
          return chain;
        },
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => respuesta,
        then: (resolve: (v: unknown) => void) => resolve(respuesta),
      };
      return chain;
    },
  };
  return { client: client as unknown as SupabaseClient, llamadas };
}

describe("tasaDelDocumento · la tasa que congela una factura o una CxP", () => {
  it("en USD y USDT no hay tasa ni se consulta la base", async () => {
    for (const moneda of ["USD", "USDT"]) {
      const { client, llamadas } = doble({ data: null, error: null });
      const r = await tasaDelDocumento(client, "t1", moneda, 36, "2026-10-20");
      expect(r).toEqual({ ok: true, tasa: { fxRate: null, fxRateSource: null, fxRateValidOn: null } });
      expect(llamadas).toHaveLength(0);
    }
  });

  it("la tasa escrita es manual y del día del documento, sin consultar la vigente", async () => {
    const { client, llamadas } = doble({ data: null, error: null });
    const r = await tasaDelDocumento(client, "t1", "VES", 40.5, "2026-10-20");
    expect(r).toEqual({ ok: true, tasa: { fxRate: 40.5, fxRateSource: "manual", fxRateValidOn: "2026-10-20" } });
    expect(llamadas).toHaveLength(0);
  });

  it("sin tasa escrita toma la vigente de fx_rate_on, con su fuente y su fecha", async () => {
    const { client, llamadas } = doble({
      data: [{ rate: "7.18000000", source: "bcv", valid_on: "2026-10-18" }],
      error: null,
    });
    const r = await tasaDelDocumento(client, "t1", "RMB", null, "2026-10-20");
    expect(r).toEqual({ ok: true, tasa: { fxRate: 7.18, fxRateSource: "bcv", fxRateValidOn: "2026-10-18" } });
    // RMB se pide como CNY, al día del documento y del tenant.
    expect(llamadas).toEqual([
      { rpc: "fx_rate_on", args: { p_tenant_id: "t1", p_currency: "CNY", p_on: "2026-10-20" } },
    ]);
  });

  it("al editar, la tasa igual a la guardada conserva su fuente y su fecha (revisión, hallazgo 3)", async () => {
    const { client, llamadas } = doble({ data: null, error: null });
    const guardada = { fxRate: 7.18, fxRateSource: "bcv" as const, fxRateValidOn: "2026-10-18" };
    expect(await tasaDelDocumento(client, "t1", "CNY", 7.18, "2026-10-20", guardada)).toEqual({ ok: true, tasa: guardada });
    expect(llamadas).toHaveLength(0);
    // Otra tasa escrita sí es manual del día.
    expect(await tasaDelDocumento(client, "t1", "CNY", 7.2, "2026-10-20", guardada)).toEqual({
      ok: true,
      tasa: { fxRate: 7.2, fxRateSource: "manual", fxRateValidOn: "2026-10-20" },
    });
  });

  it("una tasa escrita en 0 o vacía no cuenta: se busca la vigente", async () => {
    const { client, llamadas } = doble({ data: [{ rate: 36.5, source: "manual", valid_on: "2026-10-19" }], error: null });
    const r = await tasaDelDocumento(client, "t1", "VES", 0, "2026-10-20");
    expect(r).toEqual({ ok: true, tasa: { fxRate: 36.5, fxRateSource: "manual", fxRateValidOn: "2026-10-19" } });
    expect(llamadas).toHaveLength(1);
  });

  it("sin ninguna tasa, el error dice qué hacer y no inventa una", async () => {
    const { client } = doble({ data: null, error: { code: "22023", message: "FX_RATE_MISSING", hint: "dtd-fx" } });
    expect(await tasaDelDocumento(client, "t1", "VES", undefined, "2026-10-20")).toEqual({
      ok: false,
      error: "Falta la tasa de bolívares para el 2026-10-20: escríbela aquí o cárgala en Admin › Tasas.",
    });
    expect(await tasaDelDocumento(client, "t1", "CNY", null, "2026-10-20")).toEqual({
      ok: false,
      error: "Falta la tasa de yuanes para el 2026-10-20: escríbela aquí o cárgala en Admin › Tasas.",
    });
  });
});

describe("tasaVigente · lo que devuelve la base", () => {
  it("una tasa no finita o no positiva de la base no se usa", async () => {
    for (const rate of ["NaN", 0, -2, null]) {
      const { client } = doble({ data: [{ rate, source: "bcv", valid_on: "2026-10-20" }], error: null });
      expect(await tasaVigente(client, "t1", "VES", "2026-10-20")).toBeNull();
    }
  });

  it("acepta la fila suelta o en arreglo, y nada para USD", async () => {
    const { client } = doble({ data: { rate: 36, source: "operacion", valid_on: "2026-10-01" }, error: null });
    expect(await tasaVigente(client, "t1", "VES", "2026-10-20")).toEqual({
      rate: 36,
      source: "operacion",
      validOn: "2026-10-01",
    });
    const usd = doble({ data: null, error: null });
    expect(await tasaVigente(usd.client, "t1", "USD", "2026-10-20")).toBeNull();
    expect(usd.llamadas).toHaveLength(0);
  });
});

describe("ultimaTasa · la precarga de gastos, Admin y el móvil", () => {
  it("lee fx_rates por moneda, con su fecha de valor y su fuente", async () => {
    const { client, llamadas } = doble({ data: [{ rate: "36.50000000", valid_on: "2026-10-20", source: "manual" }], error: null });
    expect(await ultimaTasa(client, "VES")).toEqual({ rate: 36.5, validOn: "2026-10-20", source: "manual" });
    expect(llamadas).toEqual([{ from: "fx_rates", eq: [["currency", "VES"]] }]);
  });

  it("el último día, con la misma preferencia que fx_rate_on: bcv > manual > operacion (revisión, hallazgo 10)", async () => {
    const mismoDia = doble({
      data: [
        { rate: 37, valid_on: "2026-10-20", source: "operacion" },
        { rate: 36.9, valid_on: "2026-10-20", source: "manual" },
        { rate: 36.8, valid_on: "2026-10-20", source: "bcv" },
      ],
      error: null,
    });
    expect(await ultimaTasa(mismoDia.client, "VES")).toEqual({ rate: 36.8, validOn: "2026-10-20", source: "bcv" });
    // Una del BCV de un día anterior no le gana a la manual del último día.
    const diaAnterior = doble({
      data: [
        { rate: 36.9, valid_on: "2026-10-20", source: "manual" },
        { rate: 36.1, valid_on: "2026-10-19", source: "bcv" },
      ],
      error: null,
    });
    expect(await ultimaTasa(diaAnterior.client, "VES")).toEqual({ rate: 36.9, validOn: "2026-10-20", source: "manual" });
  });

  it("sin la 0495 o sin tasas, null", async () => {
    const sinTabla = doble({ data: null, error: { code: "42P01", message: "relation does not exist" } });
    expect(await ultimaTasa(sinTabla.client, "CNY")).toBeNull();
    const vacia = doble({ data: null, error: null });
    expect(await ultimaTasa(vacia.client, "CNY")).toBeNull();
  });
});

describe("captura con tasa obligatoria", () => {
  const factura: Partial<InvoiceInput> = {
    client_markbox: "DTD-1001",
    client_name: "Cliente de prueba",
    lines: [{ desc: "Flete", qty: 1, unitPrice: 100 }],
  };

  it("la factura en CNY exige tasa, como la de VES; en USD y USDT no", () => {
    expect(validateInvoiceInput({ ...factura, currency: "CNY" }).fieldErrors?.fx_rate).toBe(
      "Indica la tasa para facturar en yuanes.",
    );
    expect(validateInvoiceInput({ ...factura, currency: "VES", fx_rate: null }).fieldErrors?.fx_rate).toBe(
      "Indica la tasa BCV para facturar en bolívares.",
    );
    expect(validateInvoiceInput({ ...factura, currency: "CNY", fx_rate: 7.18 }).input?.fx_rate).toBe(7.18);
    expect(validateInvoiceInput({ ...factura, currency: "USD" }).fieldErrors).toBeUndefined();
    expect(validateInvoiceInput({ ...factura, currency: "USDT" }).fieldErrors).toBeUndefined();
  });

  const cxp = {
    supplierId: "s1",
    expenseAccountId: "acc-exp",
    totalAmount: 1200,
    issueDate: "2026-10-01",
    dueDate: "2026-11-01",
    concept: "Flete",
    reference: null,
    shipmentId: null,
    notes: null,
  };

  it("la CxP en VES o CNY exige tasa; en USD y USDT no", () => {
    expect(validateBillInput({ ...cxp, currency: "VES", fxRate: null }).fieldErrors?.fxRate).toBe(
      "Indica la tasa para registrar la cuenta por pagar en bolívares.",
    );
    expect(validateBillInput({ ...cxp, currency: "CNY", fxRate: 0 }).fieldErrors?.fxRate).toBe(
      "Indica la tasa para registrar la cuenta por pagar en yuanes.",
    );
    expect(validateBillInput({ ...cxp, currency: "CNY", fxRate: 7.2 }).input?.fxRate).toBe(7.2);
    expect(validateBillInput({ ...cxp, currency: "USD", fxRate: null }).fieldErrors).toBeUndefined();
    expect(validateBillInput({ ...cxp, currency: "USDT", fxRate: null }).fieldErrors).toBeUndefined();
  });
});

describe("Admin › Tasas · validación", () => {
  function fd(campos: Record<string, string>): FormData {
    const f = new FormData();
    for (const [k, v] of Object.entries(campos)) f.set(k, v);
    return f;
  }

  it("exige la fecha de la tasa y guarda la nota recortada", () => {
    expect(validateExchangeRateInput(fd({ pair: "VES/USD", rate: "36.5" })).error).toBe("Indica la fecha de la tasa.");
    expect(
      validateExchangeRateInput(fd({ pair: "VES/USD", rate: "36.5", valid_on: "2026-10-20", note: "  BCV del día " })),
    ).toEqual({ input: { pair: "VES/USD", rate: 36.5, validOn: "2026-10-20", note: "BCV del día" } });
    expect(validateExchangeRateInput(fd({ pair: "CNY/USD", rate: "7.18", valid_on: "2026-10-20" })).input?.note).toBeNull();
  });

  it("rechaza una tasa con más de 8 decimales, como la RPC (revisión, hallazgo 14)", () => {
    expect(validateExchangeRateInput(fd({ pair: "VES/USD", rate: "36.123456789", valid_on: "2026-10-20" })).error).toBe(
      "La tasa admite hasta 8 decimales.",
    );
    expect(validateExchangeRateInput(fd({ pair: "VES/USD", rate: "36.12345678", valid_on: "2026-10-20" })).input?.rate).toBe(
      36.12345678,
    );
  });

  it("rechaza una nota de más de 500 caracteres", () => {
    const r = validateExchangeRateInput(fd({ pair: "VES/USD", rate: "36.5", valid_on: "2026-10-20", note: "x".repeat(501) }));
    expect(r.error).toBe("La nota no puede pasar de 500 caracteres.");
  });

  it("cada par registra su moneda", () => {
    expect(fxPairCurrency("VES/USD")).toBe("VES");
    expect(fxPairCurrency("CNY/USD")).toBe("CNY");
  });
});
