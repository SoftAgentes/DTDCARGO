// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  buildClaimLines,
  CLAIM_INDEMNITY_ACCOUNT_CODE,
  CLAIM_PAYMENT_METHOD_ACCOUNT_CODE,
} from "../claim-posting";

describe("buildClaimLines (asiento de la indemnización)", () => {
  it("genera 2 líneas que balancean DR = CR = monto", () => {
    const lines = buildClaimLines("acc-siniestro", "acc-banco", 340);
    expect(lines).toHaveLength(2);
    const dr = lines.reduce((a, l) => a + l.debit, 0);
    const cr = lines.reduce((a, l) => a + l.credit, 0);
    expect(dr).toBe(340);
    expect(cr).toBe(340);
  });

  it("DR en la cuenta de siniestros, CR en la cuenta de caja/banco", () => {
    const [dr, cr] = buildClaimLines("acc-sin", "acc-bank", 100);
    expect(dr).toMatchObject({ account_id: "acc-sin", debit: 100, credit: 0 });
    expect(cr).toMatchObject({ account_id: "acc-bank", debit: 0, credit: 100 });
  });

  it("cada línea cumple debit XOR credit (nunca ambos > 0)", () => {
    const lines = buildClaimLines("a", "b", 50);
    for (const l of lines) {
      expect(l.debit > 0 && l.credit > 0).toBe(false);
    }
  });

  it("redondea el monto a 2 decimales", () => {
    const lines = buildClaimLines("a", "b", 99.999);
    expect(lines[0].debit).toBe(100);
    expect(lines[1].credit).toBe(100);
  });
});

describe("mapeo de cuentas", () => {
  it("la cuenta de indemnización es 6.20 (gasto)", () => {
    expect(CLAIM_INDEMNITY_ACCOUNT_CODE).toBe("6.20");
  });

  it("cada método mapea a una cuenta de caja/banco del plan", () => {
    expect(CLAIM_PAYMENT_METHOD_ACCOUNT_CODE.cash).toBe("1.1.1.1");
    expect(CLAIM_PAYMENT_METHOD_ACCOUNT_CODE.transfer).toBe("1.1.1.2");
    expect(CLAIM_PAYMENT_METHOD_ACCOUNT_CODE.usdt).toBe("1.1.1.3");
  });
});
