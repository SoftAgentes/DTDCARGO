import { describe, expect, it } from "vitest";

import { labelVerifyUrl, parseScannedLabel } from "../etiquetas-qr";

describe("parseScannedLabel · qué escaneó el operario (SDD-0152)", () => {
  it("reconoce el código del hub pelado", () => {
    expect(parseScannedLabel("DTD-B-000123")).toEqual({
      kind: "box_code",
      code: "DTD-B-000123",
    });
  });

  it("normaliza espacios y minúsculas", () => {
    expect(parseScannedLabel("  dtd-b-000123  ")).toEqual({
      kind: "box_code",
      code: "DTD-B-000123",
    });
  });

  it("reconoce la etiqueta DEL PROVEEDOR y no la confunde con una caja", () => {
    // Es la que hoy imprime /studio/etiquetas: identifica al cliente, no la caja.
    const url = labelVerifyUrl("DTD-1005", 3, 12);
    expect(parseScannedLabel(url)).toEqual({
      kind: "verify_url",
      markbox: "DTD-1005",
      boxIndex: 3,
      totalBoxes: 12,
    });
  });

  it("saca el código de caja de una URL que lo lleve en `b`", () => {
    expect(
      parseScannedLabel("https://dtdcargo.com/verificar?c=DTD-1005&n=3/12&b=DTD-B-000456"),
    ).toEqual({ kind: "box_code", code: "DTD-B-000456" });
  });

  it("tolera la etiqueta del proveedor sin `n`", () => {
    expect(parseScannedLabel("https://dtdcargo.com/verificar?c=DTD-1005")).toEqual({
      kind: "verify_url",
      markbox: "DTD-1005",
      boxIndex: null,
      totalBoxes: null,
    });
  });

  it("un `b` con formato inválido NO se toma como caja (cae al cliente)", () => {
    expect(
      parseScannedLabel("https://dtdcargo.com/verificar?c=DTD-1005&n=1/2&b=DROP-TABLE"),
    ).toMatchObject({ kind: "verify_url", markbox: "DTD-1005" });
  });

  it("un QR ajeno no revienta ni se interpreta", () => {
    expect(parseScannedLabel("https://otra-empresa.com/algo")).toMatchObject({
      kind: "unknown",
    });
    expect(parseScannedLabel("hola mundo")).toMatchObject({ kind: "unknown" });
    expect(parseScannedLabel("")).toMatchObject({ kind: "unknown" });
    expect(parseScannedLabel("http://[malformada")).toMatchObject({ kind: "unknown" });
  });

  it("un código parecido pero de otro formato no pasa por caja", () => {
    // DTDU-* es el tracking del envío end-to-end, NO un bulto.
    expect(parseScannedLabel("DTDU-2026-0042")).toMatchObject({ kind: "unknown" });
    expect(parseScannedLabel("DTD-1005")).toMatchObject({ kind: "unknown" });
    expect(parseScannedLabel("DTD-B-12")).toMatchObject({ kind: "unknown" }); // < 4 dígitos
  });
});
