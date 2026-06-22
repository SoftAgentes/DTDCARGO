/**
 * SDD-0105 · Posteo de depreciación — tests de la lógica PURA (construcción de
 * líneas + fin de mes). La idempotencia real (cerrojo por (asset, period)) la
 * cubre el índice único de la DB + la guard app-side; acá se prueba que el
 * asiento balancea por construcción y que el período → fecha es correcto.
 */

import { describe, it, expect } from "vitest";
import {
  buildDepreciationLines,
  endOfMonth,
} from "../depreciation-posting";

describe("SDD-0105 · buildDepreciationLines", () => {
  it("genera DR 6.17 gasto / CR 1.2.9 acumulada", () => {
    const lines = buildDepreciationLines("acct-6.17", "acct-1.2.9", 1000);
    expect(lines).toHaveLength(2);
    const dr = lines.find((l) => l.debit > 0)!;
    const cr = lines.find((l) => l.credit > 0)!;
    expect(dr.account_id).toBe("acct-6.17");
    expect(dr.debit).toBe(1000);
    expect(dr.credit).toBe(0);
    expect(cr.account_id).toBe("acct-1.2.9");
    expect(cr.credit).toBe(1000);
    expect(cr.debit).toBe(0);
  });

  it("siempre balancea (Σ debe == Σ haber == cuota)", () => {
    for (const amt of [0.01, 333.33, 1000, 4521.78]) {
      const lines = buildDepreciationLines("a", "b", amt);
      const debe = lines.reduce((s, l) => s + l.debit, 0);
      const haber = lines.reduce((s, l) => s + l.credit, 0);
      expect(debe).toBeCloseTo(haber, 2);
    }
  });

  it("cada línea tiene debe XOR haber (nunca ambos > 0)", () => {
    const lines = buildDepreciationLines("a", "b", 800);
    for (const l of lines) {
      expect(l.debit > 0 && l.credit > 0).toBe(false);
    }
  });

  it("redondea la cuota a 2 decimales", () => {
    const lines = buildDepreciationLines("a", "b", 333.335);
    expect(lines[0].debit).toBe(333.34);
    expect(lines[1].credit).toBe(333.34);
  });
});

describe("SDD-0105 · endOfMonth (period → fecha del asiento)", () => {
  it("devuelve el último día del mes del período YYYY-MM", () => {
    expect(endOfMonth("2026-05")).toBe("2026-05-31");
    expect(endOfMonth("2026-02")).toBe("2026-02-28"); // 2026 no bisiesto
    expect(endOfMonth("2024-02")).toBe("2024-02-29"); // bisiesto
    expect(endOfMonth("2026-04")).toBe("2026-04-30");
    expect(endOfMonth("2026-12")).toBe("2026-12-31");
  });

  it("devuelve el input crudo si el período está mal formado", () => {
    expect(endOfMonth("2026")).toBe("2026");
    expect(endOfMonth("mayo")).toBe("mayo");
  });
});
