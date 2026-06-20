import { describe, it, expect } from "vitest";

import {
  applyFreightMarkup,
  buildFleteWhatsAppMessage,
  FREIGHT_MARKUP_PCT,
} from "../cotizador-flete";

describe("applyFreightMarkup", () => {
  it("default (0%) → flete crudo (opción A · white-label)", () => {
    expect(applyFreightMarkup(1738)).toBe(1738);
    expect(FREIGHT_MARKUP_PCT).toBe(0);
  });

  it("markup aplica y redondea (opción B)", () => {
    expect(applyFreightMarkup(1000, 15)).toBe(1150);
    expect(applyFreightMarkup(1738, 10)).toBe(1912); // 1911.8 → 1912
  });

  it("0 / negativo / NaN → 0 (no muestra basura)", () => {
    expect(applyFreightMarkup(0)).toBe(0);
    expect(applyFreightMarkup(-5)).toBe(0);
    expect(applyFreightMarkup(Number.NaN)).toBe(0);
  });
});

describe("buildFleteWhatsAppMessage", () => {
  it("incluye ruta, modo y precio cuando hay", () => {
    const msg = buildFleteWhatsAppMessage({
      originName: "Nansha",
      destName: "La Guaira",
      modeLabel: "Marítimo LCL",
      priceUsd: 1738,
    });
    expect(msg).toContain("Nansha → La Guaira");
    expect(msg).toContain("Marítimo LCL");
    expect(msg).toContain("desde US$1,738");
  });

  it("omite la línea de precio si es null o 0", () => {
    const msg = buildFleteWhatsAppMessage({
      originName: "Shekou",
      destName: "Guanta",
      modeLabel: "Marítimo FCL",
      priceUsd: null,
    });
    expect(msg).not.toContain("Estimado web");
    expect(msg).toContain("Shekou → Guanta");
  });
});
