import { describe, it, expect } from "vitest";
import {
  validateLoanInput,
  validateLoanInstallmentInput,
  loanBalance,
  sumInstallments,
  loanIsSettled,
  computeLoanKpis,
  loanStatusLabel,
  loanStatusTone,
  isLoanStatus,
  type LoanStatus,
} from "./loan-types";

describe("validateLoanInput", () => {
  const base = { employee_id: "emp-1", principal_usd: "300", installment_usd: "25" };

  it("acepta input válido", () => {
    const { input, fieldErrors } = validateLoanInput({
      ...base,
      installments_total: "12",
      granted_on: "2026-04-15",
      concept: "Adelanto personal",
    });
    expect(fieldErrors).toBeUndefined();
    expect(input!.principal_usd).toBe(300);
    expect(input!.installment_usd).toBe(25);
    expect(input!.installments_total).toBe(12);
    expect(input!.granted_on).toBe("2026-04-15");
    expect(input!.concept).toBe("Adelanto personal");
  });

  it("exige empleado", () => {
    expect(validateLoanInput({ ...base, employee_id: "" }).fieldErrors?.employee_id).toBeTruthy();
  });

  it("exige principal > 0", () => {
    expect(validateLoanInput({ ...base, principal_usd: "0" }).fieldErrors?.principal_usd).toBeTruthy();
    expect(validateLoanInput({ ...base, principal_usd: "-5" }).fieldErrors?.principal_usd).toBeTruthy();
  });

  it("rechaza cuota negativa", () => {
    expect(validateLoanInput({ ...base, installment_usd: "-1" }).fieldErrors?.installment_usd).toBeTruthy();
  });

  it("rechaza cuota mayor al principal", () => {
    expect(
      validateLoanInput({ ...base, principal_usd: "100", installment_usd: "150" }).fieldErrors?.installment_usd,
    ).toBeTruthy();
  });

  it("cuota igual al principal es válida (pago de una sola vez)", () => {
    const { fieldErrors } = validateLoanInput({ ...base, principal_usd: "100", installment_usd: "100" });
    expect(fieldErrors?.installment_usd).toBeUndefined();
  });

  it("exige installments_total entero ≥ 1", () => {
    expect(validateLoanInput({ ...base, installments_total: "0" }).fieldErrors?.installments_total).toBeTruthy();
    expect(validateLoanInput({ ...base, installments_total: "1.5" }).fieldErrors?.installments_total).toBeTruthy();
  });

  it("installments_total default a 1 si falta", () => {
    const { input } = validateLoanInput(base);
    expect(input!.installments_total).toBe(1);
  });

  it("rechaza fecha inválida pero default a hoy si falta", () => {
    expect(validateLoanInput({ ...base, granted_on: "15-04-2026" }).fieldErrors?.granted_on).toBeTruthy();
    const { input } = validateLoanInput({ ...base, granted_on: "" });
    expect(input!.granted_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("validateLoanInstallmentInput", () => {
  const base = { loan_id: "loan-1", amount_usd: "25", paid_on: "2026-05-15" };

  it("acepta cuota válida", () => {
    const { input, fieldErrors } = validateLoanInstallmentInput(base);
    expect(fieldErrors).toBeUndefined();
    expect(input!.amount_usd).toBe(25);
    expect(input!.paid_on).toBe("2026-05-15");
  });

  it("exige préstamo y monto > 0", () => {
    expect(validateLoanInstallmentInput({ ...base, loan_id: "" }).fieldErrors?.loan_id).toBeTruthy();
    expect(validateLoanInstallmentInput({ ...base, amount_usd: "0" }).fieldErrors?.amount_usd).toBeTruthy();
    expect(validateLoanInstallmentInput({ ...base, amount_usd: "-1" }).fieldErrors?.amount_usd).toBeTruthy();
  });

  it("rechaza fecha inválida pero default a hoy si falta", () => {
    expect(validateLoanInstallmentInput({ ...base, paid_on: "15-05-2026" }).fieldErrors?.paid_on).toBeTruthy();
    const { input } = validateLoanInstallmentInput({ ...base, paid_on: "" });
    expect(input!.paid_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("saldo derivado (principal − Σ cuotas)", () => {
  it("suma las cuotas coercionando numeric (string|number)", () => {
    expect(sumInstallments([{ amount_usd: "25" }, { amount_usd: 25 }, { amount_usd: "15" }])).toBe(65);
    expect(sumInstallments([])).toBe(0);
  });

  it("saldo = principal − cuotas", () => {
    expect(loanBalance("300", [{ amount_usd: "25" }, { amount_usd: "25" }])).toBe(250);
    expect(loanBalance(150, [{ amount_usd: 15 }])).toBe(135);
  });

  it("saldo nunca negativo (sobrepago)", () => {
    expect(loanBalance("100", [{ amount_usd: "60" }, { amount_usd: "60" }])).toBe(0);
  });

  it("loanIsSettled cuando el saldo llega a 0", () => {
    expect(loanIsSettled("100", [{ amount_usd: "100" }])).toBe(true);
    expect(loanIsSettled("100", [{ amount_usd: "50" }])).toBe(false);
  });
});

describe("computeLoanKpis", () => {
  it("cuenta activos y suma saldos vivos de activos", () => {
    const loans: { status: LoanStatus; balance_usd: number }[] = [
      { status: "activo", balance_usd: 250 },
      { status: "activo", balance_usd: 135 },
      { status: "pagado", balance_usd: 0 },
      { status: "cancelado", balance_usd: 50 },
    ];
    const k = computeLoanKpis(loans);
    expect(k.active_count).toBe(2);
    expect(k.total_count).toBe(4);
    expect(k.outstanding_usd).toBe(385);
  });
});

describe("helpers de estado del préstamo", () => {
  it("label/tone/guard", () => {
    expect(loanStatusLabel("activo")).toBe("Activo");
    expect(loanStatusLabel("pagado")).toBe("Pagado");
    expect(loanStatusTone("cancelado")).toBe("warning");
    expect(loanStatusTone("activo")).toBe("success");
    expect(isLoanStatus("activo")).toBe(true);
    expect(isLoanStatus("saldado")).toBe(false);
  });
});
