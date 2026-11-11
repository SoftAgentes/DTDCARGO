/**
 * SDD-0571 · Reglas puras de la tarifa congelada: validación del cajón, errores
 * que se muestran (solo los propios de la 0496, ERR-01), aviso de CBM cambiado y
 * normalización de lo que devuelve PostgREST.
 */
import { describe, expect, it } from "vitest";
import {
  cbmCambio,
  freezeRpcArgs,
  isMissingRateSchema,
  normalizeSnapshot,
  rateErrorKey,
  validateFreezeInput,
} from "../types";

const RECEIPT = "0f0e0d0c-0b0a-4900-8000-000000000001";
const RATE = "0f0e0d0c-0b0a-4900-8000-000000000002";
const QUOTE = "0f0e0d0c-0b0a-4900-8000-000000000003";
const MOTIVO = "Precio negociado por WhatsApp";

describe("validateFreezeInput", () => {
  it("tarifario: solo viaja la fila; los números los pone la base", () => {
    const { input, fieldErrors } = validateFreezeInput({
      receiptId: RECEIPT, source: "tarifario", rateId: RATE, quoteId: QUOTE, perCbm: "999", minCharge: "9",
    });
    expect(fieldErrors).toBeUndefined();
    expect(input).toEqual({
      receiptId: RECEIPT, source: "tarifario", rateId: RATE, quoteId: null, perCbm: null, minCharge: null,
      service: "puerta_a_puerta_DDP", includedKgPerCbm: 500, reason: null,
    });
  });

  it("estimado: exige el estimado y no manda fila ni números", () => {
    expect(validateFreezeInput({ receiptId: RECEIPT, source: "estimado" }).fieldErrors).toEqual({
      quoteId: "warehouse_cn.rate.err.quote_required",
    });
    const { input } = validateFreezeInput({ receiptId: RECEIPT, source: "estimado", quoteId: QUOTE, rateId: RATE });
    expect(input?.quoteId).toBe(QUOTE);
    expect(input?.rateId).toBeNull();
    expect(input?.perCbm).toBeNull();
  });

  it("tarifario sin fila no pasa", () => {
    expect(validateFreezeInput({ receiptId: RECEIPT, source: "tarifario" }).fieldErrors).toEqual({
      rateId: "warehouse_cn.rate.err.rate_required",
    });
  });

  it("a mano: tarifa mayor que 0, mínimo no negativo y motivo", () => {
    expect(validateFreezeInput({ receiptId: RECEIPT, source: "manual", perCbm: "0", reason: MOTIVO }).fieldErrors)
      .toEqual({ perCbm: "warehouse_cn.rate.err.amount_invalid" });
    expect(validateFreezeInput({ receiptId: RECEIPT, source: "manual", perCbm: "800", minCharge: "-1", reason: MOTIVO }).fieldErrors)
      .toEqual({ minCharge: "warehouse_cn.rate.err.amount_invalid" });
    expect(validateFreezeInput({ receiptId: RECEIPT, source: "excel_yiwu", perCbm: "800" }).fieldErrors)
      .toEqual({ reason: "warehouse_cn.rate.err.reason_required" });
    const { input } = validateFreezeInput({ receiptId: RECEIPT, source: "manual", perCbm: "812,5", reason: `  ${MOTIVO}  ` });
    expect(input).toMatchObject({ perCbm: 812.5, minCharge: 0, reason: MOTIVO, rateId: null, quoteId: null });
  });

  it("1.000 kg/m³ exige motivo; otro peso se rechaza", () => {
    expect(validateFreezeInput({ receiptId: RECEIPT, source: "tarifario", rateId: RATE, includedKgPerCbm: 1000 }).fieldErrors)
      .toEqual({ reason: "warehouse_cn.rate.err.reason_required" });
    expect(validateFreezeInput({ receiptId: RECEIPT, source: "tarifario", rateId: RATE, includedKgPerCbm: 800 }).fieldErrors)
      .toEqual({ includedKgPerCbm: "warehouse_cn.rate.err.weight_invalid" });
  });

  it("la vista previa no exige motivo, pero sí lo demás", () => {
    expect(validateFreezeInput({ receiptId: RECEIPT, source: "manual", perCbm: "800" }, { requireReason: false }).input)
      .toMatchObject({ perCbm: 800, reason: null });
    expect(validateFreezeInput({ receiptId: RECEIPT, source: "manual", perCbm: "0" }, { requireReason: false }).fieldErrors)
      .toEqual({ perCbm: "warehouse_cn.rate.err.amount_invalid" });
  });

  it("motivo fuera de largo, fuente, servicio y recepción inválidos", () => {
    expect(validateFreezeInput({ receiptId: RECEIPT, source: "tarifario", rateId: RATE, reason: "corto" }).fieldErrors)
      .toEqual({ reason: "warehouse_cn.rate.err.reason_length" });
    expect(validateFreezeInput({ receiptId: RECEIPT, source: "otra" }).fieldErrors)
      .toEqual({ source: "warehouse_cn.rate.err.source_invalid" });
    expect(validateFreezeInput({ receiptId: RECEIPT, source: "tarifario", rateId: RATE, service: "avion" }).fieldErrors)
      .toEqual({ service: "warehouse_cn.rate.err.service_required" });
    expect(validateFreezeInput({ receiptId: "x", source: "tarifario", rateId: RATE }).fieldErrors)
      .toEqual({ source: "warehouse_cn.rate.err.receipt_invalid" });
  });
});

describe("freezeRpcArgs", () => {
  it("nombra los parámetros de la RPC", () => {
    const { input } = validateFreezeInput({ receiptId: RECEIPT, source: "tarifario", rateId: RATE });
    expect(freezeRpcArgs(input!, true)).toEqual({
      p_receipt_id: RECEIPT, p_source: "tarifario", p_rate_id: RATE, p_quote_id: null, p_per_cbm: null,
      p_min_charge: null, p_service: "puerta_a_puerta_DDP", p_included_kg_per_cbm: 500, p_reason: null, p_dry_run: true,
    });
  });
});

describe("rateErrorKey (ERR-01: solo los errores propios)", () => {
  it("traduce un error de la 0496 por su código", () => {
    expect(rateErrorKey({ message: "TARIFA_YA_CONGELADA: la recepción ya tiene tarifa", hint: "dtd-tarifa" }))
      .toBe("warehouse_cn.rate.err.already_frozen");
    expect(rateErrorKey({ message: "TARIFA_FILA_OTRA_LISTA: esa tarifa…", hint: "dtd-tarifa" }))
      .toBe("warehouse_cn.rate.err.rate_other_book");
  });
  it("sin el hint, el mismo texto no se traduce", () => {
    expect(rateErrorKey({ message: "TARIFA_YA_CONGELADA: x", hint: null })).toBeNull();
    expect(rateErrorKey({ message: "permission denied for table x", hint: "otro" })).toBeNull();
  });
  it("con el hint y un código desconocido, tampoco", () => {
    expect(rateErrorKey({ message: "TARIFA_NUEVA: x", hint: "dtd-tarifa" })).toBeNull();
  });
});

describe("isMissingRateSchema", () => {
  it("reconoce tabla o RPC ausentes, y nada más", () => {
    for (const code of ["42P01", "42883", "PGRST202", "PGRST205"]) expect(isMissingRateSchema({ code })).toBe(true);
    expect(isMissingRateSchema({ code: "42501" })).toBe(false);
    expect(isMissingRateSchema(null)).toBe(false);
  });
});

describe("cbmCambio", () => {
  it("medio litro de tolerancia", () => {
    expect(cbmCambio({ cbm: 2.5 }, 2.5)).toBe(false);
    expect(cbmCambio({ cbm: 2.5 }, 2.5004)).toBe(false);
    expect(cbmCambio({ cbm: 2.5 }, 2.5005)).toBe(true);
    expect(cbmCambio({ cbm: 2.5 }, 2.4)).toBe(true);
    expect(cbmCambio({ cbm: 2.5 }, null)).toBe(true);
  });
});

describe("normalizeSnapshot", () => {
  it("los numeric de PostgREST llegan como texto y se vuelven número", () => {
    const s = normalizeSnapshot({
      id: "a", per_cbm: "765.00", min_charge: "50.00", cbm: "3.333", weight_kg: null,
      amount_to_invoice: "2549.75", excess_weight_kg: "333.50", discount_pct: "10.00", included_kg_per_cbm: 1000,
    });
    expect(s).toMatchObject({
      per_cbm: 765, min_charge: 50, cbm: 3.333, weight_kg: null, amount_to_invoice: 2549.75,
      excess_weight_kg: 333.5, discount_pct: 10, included_kg_per_cbm: 1000,
    });
    expect(normalizeSnapshot({ included_kg_per_cbm: "500" }).included_kg_per_cbm).toBe(500);
  });
});
