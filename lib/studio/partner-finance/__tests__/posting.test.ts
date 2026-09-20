// @vitest-environment node
/**
 * Tests de los line-builders puros de posting (SDD-0059 · Slice A).
 * Cubre §6: asiento balanceado DR=CR por cada evento del dominio.
 */

import { describe, it, expect } from "vitest";
import {
  buildChargeLines,
  buildConversionLines,
  buildClaimOffsetLines,
  lineTotals,
  PARTNER_AC_CODE,
  FOREX_REVENUE_CODE,
  FACTORY_COGS_CODE,
} from "../posting";

describe("códigos de cuenta del plan (§5)", () => {
  it("son las altas sembradas en 0110", () => {
    expect(PARTNER_AC_CODE).toBe("2.1.7");
    expect(FOREX_REVENUE_CODE).toBe("4.6");
    expect(FACTORY_COGS_CODE).toBe("5.10");
  });
});

describe("buildChargeLines (DR costo / CR cuenta corriente)", () => {
  it("balancea Σ debe == Σ haber == monto", () => {
    const lines = buildChargeLines("acc-cogs", "acc-partner", 1300);
    expect(lines).toHaveLength(2);
    const t = lineTotals(lines);
    expect(t.balanced).toBe(true);
    expect(t.debit).toBe(1300);
    expect(t.credit).toBe(1300);
  });
  it("el debe es la cuenta de costo, el haber la cuenta corriente", () => {
    const lines = buildChargeLines("acc-cogs", "acc-partner", 500);
    const debit = lines.find((l) => l.debit > 0)!;
    const credit = lines.find((l) => l.credit > 0)!;
    expect(debit.account_id).toBe("acc-cogs");
    expect(credit.account_id).toBe("acc-partner");
  });
  it("usa el net_amount (no el bruto) — el caller pasa el neto", () => {
    // El builder es agnóstico: si el caller pasa 1300 (=net), balancea en 1300.
    const lines = buildChargeLines("a", "b", 1300);
    expect(lineTotals(lines).debit).toBe(1300);
  });
});

describe("buildConversionLines (DR cuenta corriente / CR ingreso forex)", () => {
  it("balancea sobre la comisión captada (revenue)", () => {
    const lines = buildConversionLines("acc-partner", "acc-forex", 50);
    const t = lineTotals(lines);
    expect(t.balanced).toBe(true);
    expect(t.debit).toBe(50);
    const credit = lines.find((l) => l.credit > 0)!;
    expect(credit.account_id).toBe("acc-forex"); // el revenue va al haber
  });
});

describe("buildClaimOffsetLines (DR cuenta corriente / CR reversa costo)", () => {
  it("neutraliza margen — balancea sobre el monto del cruce", () => {
    const lines = buildClaimOffsetLines("acc-partner", "acc-cogs", 300);
    const t = lineTotals(lines);
    expect(t.balanced).toBe(true);
    expect(t.debit).toBe(300);
    const debit = lines.find((l) => l.debit > 0)!;
    const credit = lines.find((l) => l.credit > 0)!;
    expect(debit.account_id).toBe("acc-partner");
    expect(credit.account_id).toBe("acc-cogs");
  });
});

describe("lineTotals", () => {
  it("detecta un set desbalanceado", () => {
    const t = lineTotals([
      { account_id: "a", debit: 100, credit: 0, line_memo: "" },
      { account_id: "b", debit: 0, credit: 90, line_memo: "" },
    ]);
    expect(t.balanced).toBe(false);
    expect(t.debit).toBe(100);
    expect(t.credit).toBe(90);
  });
  it("redondea a 2 decimales sin drift", () => {
    const lines = buildChargeLines("a", "b", 0.1 + 0.2);
    const t = lineTotals(lines);
    expect(t.debit).toBe(0.3);
    expect(t.balanced).toBe(true);
  });
});
