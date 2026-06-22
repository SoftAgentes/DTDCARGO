/**
 * SDD-0105 · Conciliación bancaria — tests de la lógica PURA del extracto:
 * tira de saldos (balance), KPIs, validador de input y normalización de
 * movimientos.
 *
 * Criterio de aceptación: opening + créditos − débitos vs. closing → diferencia;
 * KPIs (importados / conciliados / pendientes / %); no es posible cargar sin
 * movimientos.
 */

import { describe, it, expect } from "vitest";
import {
  computeStatementBalance,
  computeStatementKpis,
  normalizeStatementLines,
  validateStatementInput,
} from "../bank-statement-types";

describe("SDD-0105 · computeStatementBalance", () => {
  it("cuadra: opening + créditos − débitos == closing → diferencia 0", () => {
    const b = computeStatementBalance(1000, 1300, [
      { direction: "credit", amount: 500 },
      { direction: "debit", amount: 200 },
    ]);
    expect(b.totalCredit).toBe(500);
    expect(b.totalDebit).toBe(200);
    expect(b.expectedClosing).toBe(1300); // 1000 + 500 − 200
    expect(b.difference).toBe(0);
    expect(b.balanced).toBe(true);
  });

  it("detecta descuadre (closing declarado ≠ esperado)", () => {
    const b = computeStatementBalance(1000, 1250, [
      { direction: "credit", amount: 500 },
      { direction: "debit", amount: 200 },
    ]);
    expect(b.expectedClosing).toBe(1300);
    expect(b.difference).toBe(-50); // 1250 − 1300
    expect(b.balanced).toBe(false);
  });

  it("maneja decimales sin drift", () => {
    const b = computeStatementBalance(0, 0.3, [
      { direction: "credit", amount: 0.1 },
      { direction: "credit", amount: 0.2 },
    ]);
    expect(b.totalCredit).toBe(0.3);
    expect(b.expectedClosing).toBe(0.3);
    expect(b.balanced).toBe(true);
  });

  it("ignora montos negativos (toma el signo de direction)", () => {
    const b = computeStatementBalance(100, 150, [
      { direction: "credit", amount: 50 },
      { direction: "debit", amount: -999 }, // negativo → 0
    ]);
    expect(b.totalDebit).toBe(0);
    expect(b.expectedClosing).toBe(150);
    expect(b.balanced).toBe(true);
  });

  it("extracto sin movimientos: esperado == opening", () => {
    const b = computeStatementBalance(800, 800, []);
    expect(b.expectedClosing).toBe(800);
    expect(b.balanced).toBe(true);
  });
});

describe("SDD-0105 · computeStatementKpis", () => {
  it("cuenta importados / conciliados / pendientes / %", () => {
    const k = computeStatementKpis([
      { status: "matched" },
      { status: "matched" },
      { status: "manual" },
      { status: "pending" },
      { status: "ignored" },
    ]);
    expect(k.imported).toBe(5);
    expect(k.reconciled).toBe(3); // matched + manual
    expect(k.pending).toBe(1);
    expect(k.reconciledPct).toBe(60); // 3/5
  });

  it("0 movimientos → 0% (sin división por cero)", () => {
    const k = computeStatementKpis([]);
    expect(k.imported).toBe(0);
    expect(k.reconciledPct).toBe(0);
  });

  it("ignorados no cuentan como pendientes ni conciliados", () => {
    const k = computeStatementKpis([{ status: "ignored" }, { status: "ignored" }]);
    expect(k.reconciled).toBe(0);
    expect(k.pending).toBe(0);
    expect(k.reconciledPct).toBe(0);
  });
});

describe("SDD-0105 · normalizeStatementLines", () => {
  it("descarta líneas sin fecha, sin descripción o con monto <= 0", () => {
    const out = normalizeStatementLines([
      { line_date: "2026-05-01", description: "Pago cliente", direction: "credit", amount: 500 },
      { line_date: "", description: "x", direction: "credit", amount: 10 }, // sin fecha
      { line_date: "2026-05-02", description: "", direction: "debit", amount: 10 }, // sin desc
      { line_date: "2026-05-03", description: "y", direction: "debit", amount: 0 }, // monto 0
      { line_date: "bad", description: "z", direction: "debit", amount: 10 }, // fecha mala
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].description).toBe("Pago cliente");
    expect(out[0].direction).toBe("credit");
  });

  it("default direction = credit si viene cualquier cosa que no sea debit", () => {
    const out = normalizeStatementLines([
      { line_date: "2026-05-01", description: "a", direction: "weird", amount: 1 },
    ]);
    expect(out[0].direction).toBe("credit");
  });

  it("no array → []", () => {
    expect(normalizeStatementLines(null)).toEqual([]);
    expect(normalizeStatementLines("nope")).toEqual([]);
  });
});

describe("SDD-0105 · validateStatementInput", () => {
  const ok = {
    account_id: "acct-banco",
    period_label: "2026-05",
    opening_balance: 1000,
    closing_balance: 1300,
    lines: [
      { line_date: "2026-05-01", description: "Pago", direction: "credit" as const, amount: 500 },
      { line_date: "2026-05-02", description: "Comisión", direction: "debit" as const, amount: 200 },
    ],
  };

  it("acepta un input válido", () => {
    const { input, fieldErrors } = validateStatementInput(ok);
    expect(fieldErrors).toBeUndefined();
    expect(input?.account_id).toBe("acct-banco");
    expect(input?.currency).toBe("USD"); // default
    expect(input?.lines).toHaveLength(2);
  });

  it("exige la cuenta del banco", () => {
    const { fieldErrors } = validateStatementInput({ ...ok, account_id: "" });
    expect(fieldErrors?.account_id).toBeTruthy();
  });

  it("valida el formato del período (YYYY-MM)", () => {
    expect(validateStatementInput({ ...ok, period_label: "2026/05" }).fieldErrors?.period_label).toBeTruthy();
    expect(validateStatementInput({ ...ok, period_label: "" }).fieldErrors?.period_label).toBeTruthy();
  });

  it("exige al menos un movimiento válido", () => {
    const { fieldErrors } = validateStatementInput({ ...ok, lines: [] });
    expect(fieldErrors?.lines).toBeTruthy();
  });
});
