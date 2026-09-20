// @vitest-environment node
/**
 * Tests del asiento del CRÉDITO DE REFERIDO aplicado (SDD-0137).
 *
 * Cubre la parte PURA (sin DB): las 2 líneas balancean DR = CR = monto, cada línea
 * cumple debit XOR credit, y las cuentas son las correctas del plan (seed 0078).
 *
 * Ya NO hay "modos": la clasificación es FIJA (gasto de incentivo, 6.11) — la que
 * la spec 0137 §3.3 registra como decisión del founder.
 * El setting `fiscal_settings.referral_credit_mode` se descartó — el módulo Fiscal
 * está apagado, lleva su propio libro y nada se ata a él (founder 2026-07-15).
 */

import { describe, it, expect } from "vitest";
import {
  buildReferralCreditLines,
  REFERRAL_CREDIT_DEBIT_ACCOUNT_CODE,
  REFERRAL_CREDIT_CREDIT_ACCOUNT_CODE,
} from "../referral-credit-posting";

describe("buildReferralCreditLines · balance e invariantes", () => {
  it("genera 2 líneas que balancean DR = CR = monto", () => {
    const lines = buildReferralCreditLines("acc-49", "acc-cxc", 80);
    expect(lines).toHaveLength(2);
    const dr = lines.reduce((a, l) => a + l.debit, 0);
    const cr = lines.reduce((a, l) => a + l.credit, 0);
    expect(dr).toBe(80);
    expect(cr).toBe(80);
  });

  it("cada línea cumple debit XOR credit (nunca ambos > 0)", () => {
    const lines = buildReferralCreditLines("a", "b", 80);
    for (const l of lines) {
      expect(l.debit > 0 && l.credit > 0).toBe(false);
    }
  });

  it("redondea el monto a 2 decimales", () => {
    const lines = buildReferralCreditLines("a", "b", 79.999);
    expect(lines[0].debit).toBe(80);
    expect(lines[1].credit).toBe(80);
  });

  it("DR en la cuenta de gasto, CR en la CxC del referidor", () => {
    const [dr, cr] = buildReferralCreditLines("acc-gasto", "acc-cxc", 80);
    expect(dr).toMatchObject({ account_id: "acc-gasto", debit: 80, credit: 0 });
    expect(cr).toMatchObject({ account_id: "acc-cxc", debit: 0, credit: 80 });
  });

  it("la glosa del debe no usa jerga fiscal", () => {
    const [dr] = buildReferralCreditLines("a", "b", 80);
    expect(dr.line_memo).toMatch(/premio de referido/i);
    // El premio del referido NO es un crédito fiscal (en VE eso es el IVA
    // soportado). Nada de este flujo toca impuestos.
    expect(dr.line_memo).not.toMatch(/fiscal|iva/i);
  });
});

describe("códigos de cuenta del plan (seed 0078)", () => {
  it("el DEBE es 6.11 Publicidad y marketing — clasificación FIJA, sin setting", () => {
    // spec 0137 §3.3: el premio es GASTO DE INCENTIVO, no rebaja de precio. Se quitó
    // el setting que lo hacía configurable, NO se cambió la cuenta. Si algún día pasa
    // a 4.9 (contra-ingreso), hay que actualizar spec.md §3.2/§3.3 y el criterio :231
    // — y asumir que el costo del programa desaparece de Gastos.
    expect(REFERRAL_CREDIT_DEBIT_ACCOUNT_CODE).toBe("6.11");
  });

  it("el HABER es 1.1.2 Cuentas por cobrar clientes", () => {
    expect(REFERRAL_CREDIT_CREDIT_ACCOUNT_CODE).toBe("1.1.2");
  });
});
