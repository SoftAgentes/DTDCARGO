/**
 * Tests de los helpers de documento (SDD-0046 · Slice A).
 *
 * Cubre criterios de Acceptance §Slice A:
 *  - classifyDocument: V/E → persona · J/G → empresa · sin prefijo → persona · null → unknown
 *  - parseCedula: con puntos/guiones/espacios · default V · rechaza RIF empresa / basura
 */

import { describe, it, expect } from "vitest";
import { classifyDocument, parseCedula } from "../document";

describe("classifyDocument", () => {
  it("V- → persona (cédula venezolana)", () => {
    expect(classifyDocument("V-12345678")).toBe("persona");
    expect(classifyDocument("V12345678")).toBe("persona");
  });

  it("E- → persona (cédula de extranjero)", () => {
    expect(classifyDocument("E-9999999")).toBe("persona");
  });

  it("J- → empresa (RIF jurídico)", () => {
    expect(classifyDocument("J-31000000-1")).toBe("empresa");
    expect(classifyDocument("J310000001")).toBe("empresa");
  });

  it("G- → empresa (RIF gubernamental)", () => {
    expect(classifyDocument("G-20000000-0")).toBe("empresa");
  });

  it("sin prefijo de letra pero numérico → persona", () => {
    expect(classifyDocument("12345678")).toBe("persona");
    expect(classifyDocument("12.345.678")).toBe("persona");
  });

  it("null / vacío / solo espacios → unknown", () => {
    expect(classifyDocument(null)).toBe("unknown");
    expect(classifyDocument(undefined)).toBe("unknown");
    expect(classifyDocument("")).toBe("unknown");
    expect(classifyDocument("   ")).toBe("unknown");
  });

  it("prefijo no clasificable (P pasaporte) → unknown", () => {
    expect(classifyDocument("P-123456")).toBe("unknown");
  });

  it("es case-insensitive en el prefijo", () => {
    expect(classifyDocument("v-12345678")).toBe("persona");
    expect(classifyDocument("j-31000000")).toBe("empresa");
  });
});

describe("parseCedula", () => {
  it("separa prefijo + puntos y devuelve número limpio", () => {
    expect(parseCedula("V-12.345.678")).toEqual({
      nationality: "V",
      number: "12345678",
    });
  });

  it("acepta espacios y minúsculas", () => {
    expect(parseCedula("e 9.999.999")).toEqual({
      nationality: "E",
      number: "9999999",
    });
  });

  it("sin prefijo de letra → default nacionalidad V", () => {
    expect(parseCedula("12345678")).toEqual({
      nationality: "V",
      number: "12345678",
    });
  });

  it("acepta guiones internos", () => {
    expect(parseCedula("V-12-345-678")).toEqual({
      nationality: "V",
      number: "12345678",
    });
  });

  it("rechaza un RIF de empresa (J/G)", () => {
    expect(parseCedula("J-31000000-1")).toBeNull();
    expect(parseCedula("G-20000000")).toBeNull();
  });

  it("rechaza otra letra de prefijo (P pasaporte)", () => {
    expect(parseCedula("P-123456")).toBeNull();
  });

  it("rechaza sin dígitos / vacío / null", () => {
    expect(parseCedula("V-")).toBeNull();
    expect(parseCedula("")).toBeNull();
    expect(parseCedula(null)).toBeNull();
    expect(parseCedula("   ")).toBeNull();
  });

  it("rechaza un número absurdamente largo (no es cédula)", () => {
    expect(parseCedula("V-1234567890123")).toBeNull();
  });
});
