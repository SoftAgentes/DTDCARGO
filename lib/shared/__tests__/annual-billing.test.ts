import { describe, expect, it } from "vitest";
import { BILLING_UNAVAILABLE, BILLING_ZERO, billingNumber, centsUsd, compareAnnualBilling, decodeAnnualBilling, formatAnnualUsd, sumAnnualBilling, usdCents, type AnnualBilling } from "../annual-billing";

const wire = (subtotal_usd: unknown = "100.00", sin_tasa_count: unknown = 0, conversion_state: unknown = "completo") => ({ subtotal_usd, sin_tasa_count, conversion_state });
describe("annual billing · decodificación y precisión exacta", () => {
  it.each(["0.00", "-50.01", "900719925474099312345.67", "-900719925474099312345.67"])("conserva decimal %s sin pasar por Number", (text) => {
    expect(decodeAnnualBilling(wire(text))).toEqual({ subtotalUsd: text, sinTasaCount: 0, state: "completo" });
    expect(centsUsd(usdCents(text))).toBe(text);
  });
  it.each([null, {}, [], wire(0), wire("01.00"), wire("-0.00"), wire("1"), wire("1e3"), wire("NaN"), wire("Infinity"), wire("1.234"), wire("0.00", -1), wire("0.00", 0.5), wire("0.00", "1x"), wire("0.00", "9007199254740992"), wire("0.00", 1), wire("0.00", 0, "sin_tasa"), wire("0.00", 0, "datos_invalidos"), wire(null), wire(null, 0, "otro")])("rechaza shape/invariante %#", (row) => {
    expect(() => decodeAnnualBilling(row)).toThrow("Facturación anual no disponible");
  });
  it("Portal exige versión2 y el contador texto es exacto", () => {
    expect(() => decodeAnnualBilling(wire(), true)).toThrow();
    expect(() => decodeAnnualBilling({ ...wire(), version: 1 }, true)).toThrow();
    expect(decodeAnnualBilling({ ...wire("0.00", "2", "sin_tasa"), version: 2 }, true)).toEqual({ state: "sin_tasa", subtotalUsd: "0.00", sinTasaCount: 2 });
    expect(decodeAnnualBilling(wire(null, 2, "datos_invalidos"))).toEqual({ state: "datos_invalidos", subtotalUsd: null, sinTasaCount: 2 });
  });
  it("puente numérico solo para totales completos con ida/vuelta de centavos", () => {
    expect(billingNumber(BILLING_ZERO)).toBe(0);
    expect(billingNumber(decodeAnnualBilling(wire("-50.01")))).toBe(-50.01);
    expect(billingNumber(decodeAnnualBilling(wire("90071992547409.91")))).toBeNull();
    expect(billingNumber(decodeAnnualBilling(wire("100.00", 1, "sin_tasa")))).toBeNull();
    expect(billingNumber(BILLING_UNAVAILABLE)).toBeNull();
  });
  it("agrega céntimos y conserva atribución, deduplica contador dentro del ámbito", () => {
    const partial: AnnualBilling = { state: "sin_tasa", subtotalUsd: "900719925474099312345.67", sinTasaCount: 2 };
    const result = sumAnnualBilling([{ key: "A", billing: partial }, { key: "A", billing: partial }, { key: "B", billing: decodeAnnualBilling(wire("-0.01")) }]);
    expect(result).toEqual({ state: "sin_tasa", subtotalUsd: "1801439850948198624691.33", sinTasaCount: 2 });
    expect(formatAnnualUsd(result.subtotalUsd)).toBe("$1,801,439,850,948,198,624,691.33");
    expect(formatAnnualUsd("-0.01")).toBe("−$0.01");
    expect(formatAnnualUsd(null)).toBe("—");
  });
  it("inválido/null no pasa a cero y error no pasa a falta de tasa", () => {
    expect(sumAnnualBilling([{ key: "A", billing: decodeAnnualBilling(wire(null, 1, "datos_invalidos")) }, { key: "B", billing: BILLING_ZERO }])).toEqual({ state: "datos_invalidos", subtotalUsd: null, sinTasaCount: 1 });
    expect(sumAnnualBilling([{ key: "A", billing: BILLING_UNAVAILABLE }])).toEqual(BILLING_UNAVAILABLE);
    expect(sumAnnualBilling([{ key: "A", billing: BILLING_ZERO }, { key: "A", billing: decodeAnnualBilling(wire()) }])).toEqual(BILLING_UNAVAILABLE);
  });
  it("orden exacto completo primero; pendientes estables", () => {
    const states = [decodeAnnualBilling(wire("100.00", 1, "sin_tasa")), BILLING_ZERO, decodeAnnualBilling(wire("900719925474099312345.68")), decodeAnnualBilling(wire("900719925474099312345.67")), BILLING_UNAVAILABLE];
    expect([...states].sort(compareAnnualBilling)).toEqual([states[2], states[3], states[1], states[0], states[4]]);
  });
});
