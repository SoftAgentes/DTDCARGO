/**
 * SDD-0079 · Asiento automático del gasto — tests de la lógica pura
 * (construcción de líneas + mapeo de la contrapartida por método).
 */

import { describe, it, expect } from "vitest";
import {
  buildExpenseLines,
  EXPENSE_METHOD_ACCOUNT_CODE,
} from "../expense-posting";

describe("SDD-0079 · buildExpenseLines", () => {
  it("genera DR cuenta de gasto / CR caja-banco", () => {
    const lines = buildExpenseLines("acct-gasto", "acct-caja", 150);
    expect(lines).toHaveLength(2);
    const dr = lines.find((l) => l.debit > 0)!;
    const cr = lines.find((l) => l.credit > 0)!;
    expect(dr.account_id).toBe("acct-gasto");
    expect(dr.debit).toBe(150);
    expect(dr.credit).toBe(0);
    expect(cr.account_id).toBe("acct-caja");
    expect(cr.credit).toBe(150);
    expect(cr.debit).toBe(0);
  });

  it("siempre balancea (Σ debe == Σ haber)", () => {
    for (const amt of [0.01, 1, 99.99, 1234.56]) {
      const lines = buildExpenseLines("a", "b", amt);
      const debe = lines.reduce((s, l) => s + l.debit, 0);
      const haber = lines.reduce((s, l) => s + l.credit, 0);
      expect(debe).toBeCloseTo(haber, 2);
    }
  });

  it("redondea el monto a 2 decimales", () => {
    const lines = buildExpenseLines("a", "b", 10.005);
    expect(lines[0].debit).toBe(10.01);
    expect(lines[1].credit).toBe(10.01);
  });

  it("cada línea tiene debe XOR haber (nunca ambos > 0)", () => {
    const lines = buildExpenseLines("a", "b", 50);
    for (const l of lines) {
      expect(l.debit > 0 && l.credit > 0).toBe(false);
    }
  });
});

describe("SDD-0079 · contrapartida (haber) por método de pago", () => {
  it("mapea los 4 métodos a una cuenta del plan (seed 0078)", () => {
    expect(EXPENSE_METHOD_ACCOUNT_CODE.cash).toBe("1.1.1.1");
    expect(EXPENSE_METHOD_ACCOUNT_CODE.transfer).toBe("1.1.1.2");
    expect(EXPENSE_METHOD_ACCOUNT_CODE.card).toBe("2.1.2");
    expect(EXPENSE_METHOD_ACCOUNT_CODE.usdt).toBe("1.1.1.3");
  });

  it("cubre exactamente los 4 métodos de ExpenseMethod", () => {
    expect(Object.keys(EXPENSE_METHOD_ACCOUNT_CODE).sort()).toEqual([
      "card",
      "cash",
      "transfer",
      "usdt",
    ]);
  });
});
