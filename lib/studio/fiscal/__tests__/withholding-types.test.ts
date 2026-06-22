/**
 * Tests de withholding-types (SDD-0104 · Slice B).
 *
 * Cubre Acceptance §4.3:
 *  - computeWithholdingAmount = base × pct / 100, redondeo 2 dec.
 *  - validateWithholdingInput: voucher requerido, tipo iva/islr, period YYYY-MM,
 *    base/amount ≥0, pct 0–100, amount ≤ base, op_date válida.
 *  - labels es-VE.
 */

import { describe, it, expect } from "vitest";
import {
  computeWithholdingAmount,
  validateWithholdingInput,
  withholdingTypeLabel,
  withholdingTypeShort,
  type WithholdingInput,
} from "../withholding-types";

function base(over: Partial<WithholdingInput> = {}): Partial<WithholdingInput> {
  return {
    withholdingType: "iva",
    voucherNumber: "20260600001234",
    period: "2026-06",
    opDate: "2026-06-15",
    supplierId: null,
    supplierName: "Proveedor X",
    rif: "J-12345678-9",
    sourceBillId: null,
    sourceDoc: "FAC-998",
    base: 160,
    pct: 75,
    amount: 120,
    currency: "USD",
    notes: null,
    ...over,
  };
}

// ── computeWithholdingAmount ───────────────────────────────────
describe("computeWithholdingAmount", () => {
  it("base × pct / 100", () => {
    expect(computeWithholdingAmount(160, 75)).toBe(120);
    expect(computeWithholdingAmount(1000, 3)).toBe(30);
    expect(computeWithholdingAmount(100, 0)).toBe(0);
  });
  it("redondea a 2 decimales", () => {
    expect(computeWithholdingAmount(33.33, 75)).toBe(25);
    expect(computeWithholdingAmount(99.99, 16)).toBe(16);
    expect(computeWithholdingAmount(123.456, 10)).toBe(12.35);
  });
  it("entradas no finitas → 0 (no NaN)", () => {
    expect(computeWithholdingAmount(NaN, 75)).toBe(0);
    expect(computeWithholdingAmount(100, NaN)).toBe(0);
  });
});

// ── labels ─────────────────────────────────────────────────────
describe("labels", () => {
  it("tipo largo y corto", () => {
    expect(withholdingTypeLabel("iva")).toBe("Retención de IVA");
    expect(withholdingTypeLabel("islr")).toBe("Retención de ISLR");
    expect(withholdingTypeShort("iva")).toBe("IVA");
    expect(withholdingTypeShort("islr")).toBe("ISLR");
  });
});

// ── validateWithholdingInput ───────────────────────────────────
describe("validateWithholdingInput · happy path", () => {
  it("acepta un input válido y normaliza opcionales", () => {
    const { input, fieldErrors } = validateWithholdingInput(base());
    expect(fieldErrors).toBeUndefined();
    expect(input).toBeDefined();
    expect(input!.withholdingType).toBe("iva");
    expect(input!.voucherNumber).toBe("20260600001234");
    expect(input!.base).toBe(160);
    expect(input!.amount).toBe(120);
  });

  it("currency vacía → default USD; rif/notes vacíos → null", () => {
    const { input } = validateWithholdingInput(
      base({ currency: "  ", rif: "  ", notes: "  ", sourceDoc: "  " }),
    );
    expect(input!.currency).toBe("USD");
    expect(input!.rif).toBeNull();
    expect(input!.notes).toBeNull();
    expect(input!.sourceDoc).toBeNull();
  });
});

describe("validateWithholdingInput · errores", () => {
  it("voucher requerido", () => {
    const { fieldErrors } = validateWithholdingInput(base({ voucherNumber: "  " }));
    expect(fieldErrors?.voucherNumber).toBeTruthy();
  });
  it("tipo inválido", () => {
    const { fieldErrors } = validateWithholdingInput(
      base({ withholdingType: "otro" as WithholdingInput["withholdingType"] }),
    );
    expect(fieldErrors?.withholdingType).toBeTruthy();
  });
  it("period no YYYY-MM", () => {
    expect(validateWithholdingInput(base({ period: "2026-13" })).fieldErrors?.period).toBeTruthy();
    expect(validateWithholdingInput(base({ period: "junio" })).fieldErrors?.period).toBeTruthy();
  });
  it("op_date inválida", () => {
    expect(validateWithholdingInput(base({ opDate: "2026-02-30" })).fieldErrors?.opDate).toBeTruthy();
    expect(validateWithholdingInput(base({ opDate: "ayer" })).fieldErrors?.opDate).toBeTruthy();
  });
  it("supplierName requerido", () => {
    expect(validateWithholdingInput(base({ supplierName: " " })).fieldErrors?.supplierName).toBeTruthy();
  });
  it("base negativa", () => {
    expect(validateWithholdingInput(base({ base: -1 })).fieldErrors?.base).toBeTruthy();
  });
  it("pct fuera de 0–100", () => {
    expect(validateWithholdingInput(base({ pct: -5 })).fieldErrors?.pct).toBeTruthy();
    expect(validateWithholdingInput(base({ pct: 150 })).fieldErrors?.pct).toBeTruthy();
  });
  it("amount > base → error (invariante del CHECK 0166)", () => {
    const { fieldErrors } = validateWithholdingInput(base({ base: 100, amount: 200 }));
    expect(fieldErrors?.amount).toBeTruthy();
  });
  it("amount negativo", () => {
    expect(validateWithholdingInput(base({ amount: -1 })).fieldErrors?.amount).toBeTruthy();
  });
});
