// @vitest-environment node
/**
 * Tests del módulo Órdenes de venta (SDD-0072) — capa pura.
 *
 * Cubre los criterios de aceptación de la sección 6 del spec (Fase 1):
 *  - validateSalesOrderInput: exige cliente + servicio + origen/destino; total ≥ 0.
 *  - status lifecycle: canTransition (grafo manual), isAllowedTransition (incl.
 *    motor), isTerminalStatus, isEditableStatus.
 *  - buildSalesOrderFromQuote: snapshot estimado→OV (datos copiados + editables).
 *  - formato del código OV-YYYY-NNNN.
 */

import { describe, it, expect } from "vitest";
import {
  buildSalesOrderFromQuote,
  canTransition,
  formatSalesOrderCode,
  isAllowedTransition,
  isEditableStatus,
  isFromEstimate,
  isSalesOrderStatus,
  isTerminalStatus,
  SALES_ORDER_CODE_RE,
  SALES_ORDER_STATUSES,
  salesOrderServiceLabel,
  salesOrderStatusLabel,
  salesOrderStatusTone,
  validateSalesOrderInput,
} from "../types";

// ── validateSalesOrderInput ────────────────────────────────────

describe("validateSalesOrderInput", () => {
  const valid = {
    clientName: "Importadora Caracas C.A.",
    service: "consolidado_lcl" as const,
    origin: "Yiwu",
    destination: "Valencia",
    totalUsd: 1200,
    subtotalUsd: 1140,
  };

  it("acepta una OV válida", () => {
    const { input, fieldErrors } = validateSalesOrderInput(valid);
    expect(fieldErrors).toBeUndefined();
    expect(input?.clientName).toBe("Importadora Caracas C.A.");
    expect(input?.service).toBe("consolidado_lcl");
    expect(input?.totalUsd).toBe(1200);
    expect(input?.subtotalUsd).toBe(1140);
  });

  it("rechaza sin nombre de cliente", () => {
    const { input, fieldErrors } = validateSalesOrderInput({
      ...valid,
      clientName: "   ",
    });
    expect(input).toBeUndefined();
    expect(fieldErrors?.clientName).toBeTruthy();
  });

  it("rechaza servicio inválido o ausente", () => {
    const r1 = validateSalesOrderInput({ ...valid, service: undefined });
    expect(r1.fieldErrors?.service).toBeTruthy();
    const r2 = validateSalesOrderInput({
      ...valid,
      // @ts-expect-error servicio fuera del enum
      service: "aereo_express",
    });
    expect(r2.fieldErrors?.service).toBeTruthy();
  });

  it("rechaza sin origen / destino", () => {
    expect(
      validateSalesOrderInput({ ...valid, origin: "" }).fieldErrors?.origin,
    ).toBeTruthy();
    expect(
      validateSalesOrderInput({ ...valid, destination: "" }).fieldErrors
        ?.destination,
    ).toBeTruthy();
  });

  it("rechaza total negativo", () => {
    const { fieldErrors } = validateSalesOrderInput({
      ...valid,
      totalUsd: -10,
    });
    expect(fieldErrors?.totalUsd).toBeTruthy();
  });

  it("acepta total 0 (OV a completar luego)", () => {
    const { input, fieldErrors } = validateSalesOrderInput({
      ...valid,
      totalUsd: 0,
      subtotalUsd: 0,
    });
    expect(fieldErrors).toBeUndefined();
    expect(input?.totalUsd).toBe(0);
  });

  it("subtotal inválido/ausente cae al total", () => {
    const { input } = validateSalesOrderInput({
      clientName: "X",
      service: "fcl_directo",
      origin: "Shenzhen",
      destination: "La Guaira",
      totalUsd: 5000,
      // sin subtotalUsd
    });
    expect(input?.subtotalUsd).toBe(5000);
  });

  it("normaliza campos opcionales a null", () => {
    const { input } = validateSalesOrderInput({
      ...valid,
      clientMarkbox: "  ",
      notes: "   ",
    });
    expect(input?.clientMarkbox).toBeNull();
    expect(input?.notes).toBeNull();
  });

  it("redondea totales a 2 decimales", () => {
    const { input } = validateSalesOrderInput({
      ...valid,
      totalUsd: 99.999,
      subtotalUsd: 88.888,
    });
    expect(input?.totalUsd).toBe(100);
    expect(input?.subtotalUsd).toBe(88.89);
  });
});

// ── status lifecycle ───────────────────────────────────────────

describe("status lifecycle", () => {
  it("el enum tiene los 5 estados del spec", () => {
    expect(SALES_ORDER_STATUSES).toEqual([
      "confirmada",
      "parcial",
      "facturada",
      "cerrada",
      "cancelada",
    ]);
  });

  it("isSalesOrderStatus discrimina", () => {
    expect(isSalesOrderStatus("confirmada")).toBe(true);
    expect(isSalesOrderStatus("inventado")).toBe(false);
    expect(isSalesOrderStatus(42)).toBe(false);
  });

  it("transiciones manuales permitidas (UI)", () => {
    expect(canTransition("confirmada", "cerrada")).toBe(true);
    expect(canTransition("confirmada", "cancelada")).toBe(true);
    expect(canTransition("parcial", "cerrada")).toBe(true);
    expect(canTransition("parcial", "cancelada")).toBe(true);
    expect(canTransition("facturada", "cerrada")).toBe(true);
  });

  it("parcial/facturada NO se setean por la UI (las pone el motor Fase 2)", () => {
    expect(canTransition("confirmada", "parcial")).toBe(false);
    expect(canTransition("confirmada", "facturada")).toBe(false);
    expect(canTransition("parcial", "facturada")).toBe(false);
    // pero SÍ son válidas en el grafo completo (las usa el motor):
    expect(isAllowedTransition("confirmada", "parcial")).toBe(true);
    expect(isAllowedTransition("confirmada", "facturada")).toBe(true);
    expect(isAllowedTransition("parcial", "facturada")).toBe(true);
  });

  it("transiciones prohibidas (hacia atrás / desde terminal)", () => {
    expect(canTransition("facturada", "confirmada")).toBe(false); // hacia atrás
    expect(isAllowedTransition("facturada", "parcial")).toBe(false); // hacia atrás
    expect(canTransition("cerrada", "confirmada")).toBe(false); // desde terminal
    expect(canTransition("cancelada", "confirmada")).toBe(false);
    expect(isAllowedTransition("cerrada", "facturada")).toBe(false);
  });

  it("estados terminales", () => {
    expect(isTerminalStatus("cerrada")).toBe(true);
    expect(isTerminalStatus("cancelada")).toBe(true);
    expect(isTerminalStatus("confirmada")).toBe(false);
    expect(isTerminalStatus("parcial")).toBe(false);
  });

  it("solo 'confirmada' es editable", () => {
    expect(isEditableStatus("confirmada")).toBe(true);
    expect(isEditableStatus("parcial")).toBe(false);
    expect(isEditableStatus("facturada")).toBe(false);
    expect(isEditableStatus("cerrada")).toBe(false);
  });

  it("labels y tones existen para cada estado", () => {
    for (const s of SALES_ORDER_STATUSES) {
      expect(salesOrderStatusLabel(s)).toBeTruthy();
      expect(salesOrderStatusTone(s)).toBeTruthy();
    }
  });
});

// ── snapshot estimado → OV ─────────────────────────────────────

describe("buildSalesOrderFromQuote", () => {
  const quote = {
    client_markbox: "DTD-5532",
    client_name: "Importadora Caracas C.A.",
    service: "consolidado_lcl" as const,
    origin: "Yiwu",
    destination: "Valencia",
    subtotal_usd: 1140,
    total_usd: 1200,
    notes: "2 paletas",
  };

  it("copia los datos del estimado al snapshot de la OV", () => {
    const input = buildSalesOrderFromQuote(quote);
    expect(input.clientMarkbox).toBe("DTD-5532");
    expect(input.clientName).toBe("Importadora Caracas C.A.");
    expect(input.service).toBe("consolidado_lcl");
    expect(input.origin).toBe("Yiwu");
    expect(input.destination).toBe("Valencia");
    expect(input.subtotalUsd).toBe(1140);
    expect(input.totalUsd).toBe(1200);
    expect(input.notes).toBe("2 paletas");
  });

  it("el snapshot pasa la validación (estimado→OV→input válido)", () => {
    const snapshot = buildSalesOrderFromQuote(quote);
    const { input, fieldErrors } = validateSalesOrderInput(snapshot);
    expect(fieldErrors).toBeUndefined();
    expect(input?.totalUsd).toBe(1200);
  });

  it("normaliza markbox/notes vacíos a null y trimea", () => {
    const input = buildSalesOrderFromQuote({
      ...quote,
      client_markbox: "   ",
      client_name: "  Acme  ",
      notes: "  ",
    });
    expect(input.clientMarkbox).toBeNull();
    expect(input.clientName).toBe("Acme");
    expect(input.notes).toBeNull();
  });

  it("total negativo del estimado se clampa a 0; subtotal inválido cae al total", () => {
    const input = buildSalesOrderFromQuote({
      ...quote,
      total_usd: -50,
      // @ts-expect-error simulamos subtotal nulo del estimado
      subtotal_usd: null,
    });
    expect(input.totalUsd).toBe(0);
    expect(input.subtotalUsd).toBe(0);
  });

  it("redondea a 2 decimales", () => {
    const input = buildSalesOrderFromQuote({
      ...quote,
      total_usd: 99.999,
      subtotal_usd: 88.888,
    });
    expect(input.totalUsd).toBe(100);
    expect(input.subtotalUsd).toBe(88.89);
  });
});

// ── provenance + service label ─────────────────────────────────

describe("isFromEstimate / salesOrderServiceLabel", () => {
  it("isFromEstimate true si hay quote_id", () => {
    expect(isFromEstimate({ quote_id: "q-1" })).toBe(true);
    expect(isFromEstimate({ quote_id: null })).toBe(false);
  });

  it("salesOrderServiceLabel devuelve el label del servicio", () => {
    expect(salesOrderServiceLabel("consolidado_lcl")).toBeTruthy();
    expect(salesOrderServiceLabel("fcl_directo")).toBeTruthy();
  });
});

// ── código ─────────────────────────────────────────────────────

describe("formatSalesOrderCode", () => {
  it("formato OV-YYYY-NNNN con padding 4", () => {
    expect(formatSalesOrderCode(2026, 1)).toBe("OV-2026-0001");
    expect(formatSalesOrderCode(2026, 42)).toBe("OV-2026-0042");
    expect(formatSalesOrderCode(2026, 12345)).toBe("OV-2026-12345");
  });

  it("matchea el patrón SALES_ORDER_CODE_RE", () => {
    expect(SALES_ORDER_CODE_RE.test("OV-2026-0001")).toBe(true);
    expect(SALES_ORDER_CODE_RE.test("OV-2026-1")).toBe(false); // sin padding
    expect(SALES_ORDER_CODE_RE.test("OC-2026-0001")).toBe(false); // es la OC
    expect(SALES_ORDER_CODE_RE.test("EST-2026-0001")).toBe(false);
  });
});
