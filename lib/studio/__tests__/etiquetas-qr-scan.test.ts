import { describe, expect, it } from "vitest";

import { isBoxCode, labelVerifyUrl, parseScannedLabel } from "../etiquetas-qr";

describe("labelVerifyUrl · las dos etiquetas (SDD-0152)", () => {
  it("la del proveedor va SIN código de caja (la caja aún no existe)", () => {
    const url = labelVerifyUrl("DTD-1005", 3, 12);
    expect(url).toContain("/verificar?c=DTD-1005&n=3/12");
    expect(url).not.toContain("&b=");
  });

  it("la del hub lleva el código único de la caja", () => {
    const url = labelVerifyUrl("DTD-1005", 3, 12, "DTD-B-000456");
    expect(url).toContain("&b=DTD-B-000456");
  });

  it("un boxCode vacío o nulo no ensucia la URL", () => {
    expect(labelVerifyUrl("DTD-1005", 1, 1, null)).not.toContain("&b=");
    expect(labelVerifyUrl("DTD-1005", 1, 1, "   ")).not.toContain("&b=");
  });

  it("da la vuelta completa: se imprime → se escanea → se resuelve la caja", () => {
    // Es el contrato que sostiene toda la estiba: si esto se rompe, el operario
    // escanea y el sistema no sabe qué caja es.
    const printed = labelVerifyUrl("DTD-1005", 7, 12, "DTD-B-000456");
    expect(parseScannedLabel(printed)).toEqual({
      kind: "box_code",
      code: "DTD-B-000456",
    });
  });

  it("escapa el markbox en la URL", () => {
    expect(labelVerifyUrl("DTD 1005/A", 1, 1)).toContain("c=DTD%201005%2FA");
  });
});

describe("isBoxCode", () => {
  it("acepta el formato del hub y rechaza el resto", () => {
    expect(isBoxCode("DTD-B-000123")).toBe(true);
    expect(isBoxCode(" dtd-b-000123 ")).toBe(true);
    expect(isBoxCode("DTD-1005")).toBe(false); // markbox
    expect(isBoxCode("DTDU-2026-0042")).toBe(false); // tracking del envío
    expect(isBoxCode("DTD-B-12")).toBe(false); // muy corto
    expect(isBoxCode("")).toBe(false);
  });
});

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
