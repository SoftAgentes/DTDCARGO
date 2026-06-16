/**
 * Tests del módulo Facturación (SDD-0021) — capa pura `invoice-types`.
 *
 * Cubre los criterios de aceptación de la sección 6 del spec:
 *  - calcInvoiceTotals con IVA on/off
 *  - computeBalance / isOverdue / displayStatus
 *  - validateInvoiceInput (manual, sin zod)
 *  - state-machine guards (isEditable/canEmit/canRegisterPayment/canVoid)
 *  - normalizeLines
 */

import { describe, it, expect } from "vitest";
import {
  calcInvoiceTotals,
  canEmit,
  canRegisterPayment,
  canVoid,
  computeBalance,
  displayStatus,
  isEditable,
  isOverdue,
  normalizeLines,
  resolveInvoiceIva,
  statusBadgeTone,
  validateInvoiceInput,
  type InvoiceInput,
} from "../invoice-types";

describe("calcInvoiceTotals", () => {
  it("aplica IVA cuando ivaOn=true (criterio de aceptación)", () => {
    const r = calcInvoiceTotals({
      lines: [{ qty: 2, unitPrice: 500 }],
      ivaRate: 16,
      ivaOn: true,
    });
    expect(r).toEqual({ base: 1000, iva: 160, total: 1160 });
  });

  it("no aplica IVA cuando ivaOn=false (criterio de aceptación)", () => {
    const r = calcInvoiceTotals({
      lines: [{ qty: 2, unitPrice: 500 }],
      ivaRate: 16,
      ivaOn: false,
    });
    expect(r).toEqual({ base: 1000, iva: 0, total: 1000 });
  });

  it("suma varias líneas para la base", () => {
    const r = calcInvoiceTotals({
      lines: [
        { qty: 1, unitPrice: 1200 },
        { qty: 3, unitPrice: 100 },
        { qty: 2, unitPrice: 50 },
      ],
      ivaRate: 16,
      ivaOn: false,
    });
    // 1200 + 300 + 100 = 1600
    expect(r.base).toBe(1600);
    expect(r.total).toBe(1600);
  });

  it("redondea a 2 decimales (IVA fraccionado)", () => {
    const r = calcInvoiceTotals({
      lines: [{ qty: 1, unitPrice: 99.99 }],
      ivaRate: 16,
      ivaOn: true,
    });
    expect(r.base).toBe(99.99);
    expect(r.iva).toBe(16); // 99.99 * 0.16 = 15.9984 → 16.00
    expect(r.total).toBe(115.99);
  });

  it("base 0 con líneas vacías", () => {
    expect(calcInvoiceTotals({ lines: [], ivaRate: 16, ivaOn: true })).toEqual({
      base: 0,
      iva: 0,
      total: 0,
    });
  });

  it("ignora qty o precio inválidos (NaN → 0)", () => {
    const r = calcInvoiceTotals({
      lines: [
        { qty: Number("x"), unitPrice: 500 },
        { qty: 2, unitPrice: 250 },
      ],
      ivaRate: 16,
      ivaOn: false,
    });
    expect(r.base).toBe(500);
  });
});

describe("computeBalance", () => {
  it("total - pagado", () => {
    expect(computeBalance({ total_amount: 1160, paid_amount: 160 })).toBe(1000);
  });
  it("saldo 0 cuando pagado == total", () => {
    expect(computeBalance({ total_amount: 500, paid_amount: 500 })).toBe(0);
  });
});

describe("isOverdue / displayStatus", () => {
  const today = "2026-06-01";

  it("vencida si due_date < hoy y status no pagada/anulada", () => {
    expect(
      isOverdue({ due_date: "2026-05-01", status: "emitida" }, today),
    ).toBe(true);
  });

  it("no vencida si due_date >= hoy", () => {
    expect(
      isOverdue({ due_date: "2026-07-01", status: "emitida" }, today),
    ).toBe(false);
  });

  it("nunca vencida si está pagada", () => {
    expect(
      isOverdue({ due_date: "2026-01-01", status: "pagada" }, today),
    ).toBe(false);
  });

  it("nunca vencida si está anulada", () => {
    expect(
      isOverdue({ due_date: "2026-01-01", status: "anulada" }, today),
    ).toBe(false);
  });

  it("no vencida sin due_date", () => {
    expect(isOverdue({ due_date: null, status: "emitida" }, today)).toBe(false);
  });

  it("displayStatus deriva 'vencida' visualmente", () => {
    expect(
      displayStatus({ due_date: "2026-05-01", status: "emitida" }, today),
    ).toBe("vencida");
    expect(
      displayStatus({ due_date: "2026-07-01", status: "emitida" }, today),
    ).toBe("emitida");
  });
});

describe("statusBadgeTone (mapeo del spec)", () => {
  it("mapea cada estado al tono correcto", () => {
    expect(statusBadgeTone("pagada")).toBe("success");
    expect(statusBadgeTone("emitida")).toBe("info");
    expect(statusBadgeTone("parcial")).toBe("warning");
    expect(statusBadgeTone("vencida")).toBe("danger");
    expect(statusBadgeTone("borrador")).toBe("neutral");
    expect(statusBadgeTone("anulada")).toBe("neutral");
  });
});

describe("state-machine guards", () => {
  it("isEditable solo borrador", () => {
    expect(isEditable("borrador")).toBe(true);
    expect(isEditable("emitida")).toBe(false);
  });
  it("canEmit solo borrador", () => {
    expect(canEmit("borrador")).toBe(true);
    expect(canEmit("pagada")).toBe(false);
  });
  it("canRegisterPayment en emitida/parcial/vencida", () => {
    expect(canRegisterPayment({ status: "emitida" })).toBe(true);
    expect(canRegisterPayment({ status: "parcial" })).toBe(true);
    expect(canRegisterPayment({ status: "vencida" })).toBe(true);
    expect(canRegisterPayment({ status: "borrador" })).toBe(false);
    expect(canRegisterPayment({ status: "pagada" })).toBe(false);
  });
  it("canVoid en todo menos pagada/anulada", () => {
    expect(canVoid("borrador")).toBe(true);
    expect(canVoid("emitida")).toBe(true);
    expect(canVoid("parcial")).toBe(true);
    expect(canVoid("pagada")).toBe(false);
    expect(canVoid("anulada")).toBe(false);
  });
});

describe("normalizeLines", () => {
  it("descarta líneas sin descripción", () => {
    expect(
      normalizeLines([
        { desc: "Flete", qty: 1, unitPrice: 500 },
        { desc: "", qty: 2, unitPrice: 100 },
        { desc: "   ", qty: 1, unitPrice: 50 },
      ]),
    ).toEqual([{ desc: "Flete", qty: 1, unitPrice: 500 }]);
  });
  it("coacciona qty/precio negativos a 0", () => {
    expect(normalizeLines([{ desc: "X", qty: -3, unitPrice: -5 }])).toEqual([
      { desc: "X", qty: 0, unitPrice: 0 },
    ]);
  });
  it("no-array → []", () => {
    expect(normalizeLines(null)).toEqual([]);
    expect(normalizeLines("nope")).toEqual([]);
  });
});

describe("validateInvoiceInput", () => {
  const valid: Partial<InvoiceInput> = {
    client_markbox: "DTD-1001",
    client_name: "Empresa Demo S.A.",
    currency: "USD",
    lines: [{ desc: "Flete LCL", qty: 1, unitPrice: 1200 }],
  };

  it("acepta input válido", () => {
    const r = validateInvoiceInput(valid);
    expect(r.fieldErrors).toBeUndefined();
    expect(r.input?.client_markbox).toBe("DTD-1001");
    expect(r.input?.currency).toBe("USD");
    expect(r.input?.lines).toHaveLength(1);
  });

  it("exige MARKBOX y nombre", () => {
    const r = validateInvoiceInput({ ...valid, client_markbox: "", client_name: "" });
    expect(r.fieldErrors?.client_markbox).toBeDefined();
    expect(r.fieldErrors?.client_name).toBeDefined();
  });

  it("exige al menos una línea con monto > 0", () => {
    const noLines = validateInvoiceInput({ ...valid, lines: [] });
    expect(noLines.fieldErrors?.lines).toBeDefined();

    const zeroLines = validateInvoiceInput({
      ...valid,
      lines: [{ desc: "X", qty: 0, unitPrice: 0 }],
    });
    expect(zeroLines.fieldErrors?.lines).toBeDefined();
  });

  it("rechaza due_date con formato inválido", () => {
    const r = validateInvoiceInput({ ...valid, due_date: "01/05/2026" });
    expect(r.fieldErrors?.due_date).toBeDefined();
  });

  it("VES requiere fx_rate (BCV) > 0", () => {
    const sinFx = validateInvoiceInput({ ...valid, currency: "VES" });
    expect(sinFx.fieldErrors?.fx_rate).toBeDefined();

    const conFx = validateInvoiceInput({ ...valid, currency: "VES", fx_rate: 36.5 });
    expect(conFx.fieldErrors).toBeUndefined();
    expect(conFx.input?.fx_rate).toBe(36.5);
  });

  it("normaliza currency desconocida a USD", () => {
    const r = validateInvoiceInput({
      ...valid,
      currency: "GBP" as InvoiceInput["currency"],
    });
    expect(r.input?.currency).toBe("USD");
  });

  it("trimea campos y descarta líneas vacías", () => {
    const r = validateInvoiceInput({
      client_markbox: "  DTD-2002  ",
      client_name: "  Cliente X  ",
      currency: "USD",
      lines: [
        { desc: " Flete ", qty: 1, unitPrice: 500 },
        { desc: "", qty: 9, unitPrice: 9 },
      ],
    });
    expect(r.input?.client_markbox).toBe("DTD-2002");
    expect(r.input?.client_name).toBe("Cliente X");
    expect(r.input?.lines).toEqual([{ desc: "Flete", qty: 1, unitPrice: 500 }]);
  });
});

describe("resolveInvoiceIva (SDD-0073 §8 · gateado por el módulo fiscal)", () => {
  const base = {
    defaultMode: "sin_iva" as const,
    ivaRateGeneral: 16,
  };

  // ── Módulo OFF: comportamiento ACTUAL (toggle de tenant), iva_mode ignorado ──
  it("módulo OFF + tenant IVA ON → grava al 16% e ignora iva_mode (modo null)", () => {
    const r = resolveInvoiceIva({
      ...base,
      fiscalModuleEnabled: false,
      ivaMode: "con_iva", // se ignora con el módulo off
      tenantIvaOn: true,
    });
    expect(r).toEqual({ ivaOn: true, ivaRate: 16, ivaMode: null });
  });

  it("módulo OFF + tenant IVA OFF → sin IVA (igual que hoy)", () => {
    const r = resolveInvoiceIva({
      ...base,
      fiscalModuleEnabled: false,
      ivaMode: "con_iva",
      tenantIvaOn: false,
    });
    expect(r).toEqual({ ivaOn: false, ivaRate: 0, ivaMode: null });
  });

  // ── Módulo ON: el IVA lo decide el iva_mode de la factura ──
  it("módulo ON + con_iva → grava a la alícuota general y persiste el modo", () => {
    const r = resolveInvoiceIva({
      ...base,
      fiscalModuleEnabled: true,
      ivaMode: "con_iva",
      ivaRateGeneral: 16,
      tenantIvaOn: false, // irrelevante con el módulo on
    });
    expect(r).toEqual({ ivaOn: true, ivaRate: 16, ivaMode: "con_iva" });
  });

  it("módulo ON + sin_iva → IVA 0 aunque el tenant lo tenga prendido", () => {
    const r = resolveInvoiceIva({
      ...base,
      fiscalModuleEnabled: true,
      ivaMode: "sin_iva",
      tenantIvaOn: true,
    });
    expect(r).toEqual({ ivaOn: false, ivaRate: 0, ivaMode: "sin_iva" });
  });

  it("módulo ON + exento/tasa_cero → sin débito fiscal", () => {
    for (const mode of ["exento", "tasa_cero"] as const) {
      const r = resolveInvoiceIva({
        ...base,
        fiscalModuleEnabled: true,
        ivaMode: mode,
        tenantIvaOn: true,
      });
      expect(r.ivaOn).toBe(false);
      expect(r.ivaRate).toBe(0);
      expect(r.ivaMode).toBe(mode);
    }
  });

  it("módulo ON sin iva_mode propio → cae al default del tenant", () => {
    const r = resolveInvoiceIva({
      fiscalModuleEnabled: true,
      ivaMode: null,
      defaultMode: "con_iva",
      ivaRateGeneral: 8,
      tenantIvaOn: false,
    });
    expect(r).toEqual({ ivaOn: true, ivaRate: 8, ivaMode: "con_iva" });
  });
});
