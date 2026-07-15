/**
 * Tests del asiento del CRÉDITO DE REFERIDO aplicado (SDD-0137).
 *
 * Cubre la parte PURA (sin DB): las 2 líneas balancean DR=CR=monto en ambos
 * modos, la cuenta del DEBE cambia con el modo (6.11 marketing / 4.9 descuento),
 * el HABER es siempre 1.1.2 CxC, y el guard de modo (isReferralCreditMode).
 */

import { describe, it, expect } from "vitest";
import {
  buildReferralCreditLines,
  isReferralCreditMode,
  DEFAULT_REFERRAL_CREDIT_MODE,
  REFERRAL_CREDIT_DEBIT_ACCOUNT_CODE,
  REFERRAL_CREDIT_CREDIT_ACCOUNT_CODE,
} from "../referral-credit-posting";

describe("buildReferralCreditLines · balance e invariantes", () => {
  it("genera 2 líneas que balancean DR = CR = monto (marketing)", () => {
    const lines = buildReferralCreditLines("marketing_expense", "acc-611", "acc-cxc", 80);
    expect(lines).toHaveLength(2);
    const dr = lines.reduce((a, l) => a + l.debit, 0);
    const cr = lines.reduce((a, l) => a + l.credit, 0);
    expect(dr).toBe(80);
    expect(cr).toBe(80);
  });

  it("cada línea cumple debit XOR credit (nunca ambos > 0)", () => {
    const lines = buildReferralCreditLines("commercial_discount", "a", "b", 80);
    for (const l of lines) {
      expect(l.debit > 0 && l.credit > 0).toBe(false);
    }
  });

  it("redondea el monto a 2 decimales", () => {
    const lines = buildReferralCreditLines("marketing_expense", "a", "b", 79.999);
    expect(lines[0].debit).toBe(80);
    expect(lines[1].credit).toBe(80);
  });
});

describe("buildReferralCreditLines · cuentas por modo", () => {
  it("marketing_expense: DR en la cuenta de gasto, CR en la CxC", () => {
    const [dr, cr] = buildReferralCreditLines("marketing_expense", "acc-mkt", "acc-cxc", 80);
    expect(dr).toMatchObject({ account_id: "acc-mkt", debit: 80, credit: 0 });
    expect(cr).toMatchObject({ account_id: "acc-cxc", debit: 0, credit: 80 });
  });

  it("commercial_discount: DR en la cuenta de descuento, CR en la CxC", () => {
    const [dr, cr] = buildReferralCreditLines("commercial_discount", "acc-desc", "acc-cxc", 80);
    expect(dr).toMatchObject({ account_id: "acc-desc", debit: 80, credit: 0 });
    expect(cr).toMatchObject({ account_id: "acc-cxc", debit: 0, credit: 80 });
  });

  it("el HABER (CxC del referidor) es idéntico en ambos modos; solo cambia el DEBE", () => {
    const mkt = buildReferralCreditLines("marketing_expense", "dr-a", "cxc", 80);
    const dsc = buildReferralCreditLines("commercial_discount", "dr-b", "cxc", 80);
    expect(mkt[1]).toEqual(dsc[1]); // misma línea de haber (CxC)
    expect(mkt[0].account_id).not.toBe(dsc[0].account_id); // debe distinto
  });
});

describe("mapeo de códigos de cuenta del plan (seed 0078)", () => {
  it("marketing_expense debita 6.11 (Publicidad y marketing)", () => {
    expect(REFERRAL_CREDIT_DEBIT_ACCOUNT_CODE.marketing_expense).toBe("6.11");
  });

  it("commercial_discount debita 4.9 (Descuentos sobre ventas)", () => {
    expect(REFERRAL_CREDIT_DEBIT_ACCOUNT_CODE.commercial_discount).toBe("4.9");
  });

  it("el haber es siempre 1.1.2 (Cuentas por cobrar clientes)", () => {
    expect(REFERRAL_CREDIT_CREDIT_ACCOUNT_CODE).toBe("1.1.2");
  });
});

describe("isReferralCreditMode / default", () => {
  it("el default es marketing_expense (recomendación §3.3)", () => {
    expect(DEFAULT_REFERRAL_CREDIT_MODE).toBe("marketing_expense");
  });

  it("acepta solo los dos modos válidos", () => {
    expect(isReferralCreditMode("marketing_expense")).toBe(true);
    expect(isReferralCreditMode("commercial_discount")).toBe(true);
    expect(isReferralCreditMode("descuento")).toBe(false);
    expect(isReferralCreditMode(null)).toBe(false);
    expect(isReferralCreditMode(undefined)).toBe(false);
  });
});
