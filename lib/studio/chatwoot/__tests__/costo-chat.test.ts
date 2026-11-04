/**
 * SDD-0585 · paso 2.8 · costo de referencia del chat. Pura: mercado por prefijo,
 * tarifa del tarifario oficial de Meta (USD, vigente desde el 2026-10-01) y cuenta.
 * Teléfonos sintéticos (555).
 */
import { describe, expect, it } from "vitest";

import { estimarCosto, mercadoDe, MERCADO_OTRO } from "../costo-chat";
import { FUENTE_TARIFA, PREFIJOS, TARIFAS } from "../tarifas-meta-2026-10";

describe("tarifario generado (tarifas-meta-2026-10.ts)", () => {
  it("es el de octubre de 2026, con fuente oficial", () => {
    expect(FUENTE_TARIFA.vigenteDesde).toBe("2026-10-01");
    expect(FUENTE_TARIFA.url).toBe("https://developers.facebook.com/docs/whatsapp/pricing");
  });

  it("Resto de Latinoamérica (Venezuela): servicio y utilidad US$0,0113, marketing US$0,074", () => {
    expect(TARIFAS["Rest of Latin America"]).toEqual({ marketing: 0.074, utility: 0.0113, service: 0.0113 });
  });

  it("todo prefijo apunta a un mercado con tarifa, y existe «Other» para lo demás", () => {
    expect(TARIFAS[MERCADO_OTRO]).toBeDefined();
    for (const [, mercado] of PREFIJOS) expect(TARIFAS[mercado], mercado).toBeDefined();
  });

  it("los prefijos van del más largo al más corto (gana el más específico)", () => {
    for (let i = 1; i < PREFIJOS.length; i += 1) {
      expect(PREFIJOS[i - 1][0].length).toBeGreaterThanOrEqual(PREFIJOS[i][0].length);
    }
  });
});

describe("mercadoDe", () => {
  it.each([
    ["+58 412-5550101", "Rest of Latin America"],
    ["+584145550101", "Rest of Latin America"],
    ["+1 787 555 0101", "Rest of Latin America"], // Puerto Rico
    ["+1 809 555 0101", "Rest of Latin America"], // República Dominicana
    ["+1 212 555 0101", "North America"],
    ["+57 300 555 0101", "Colombia"],
    ["+86 138 5550 0101", "Rest of Asia Pacific"],
    ["+7 495 555 0101", "Russia"],
    ["+7 701 555 0101", "Kazakhstan"],
    ["+52 55 5550 0101", "Mexico"],
  ])("%s → %s", (telefono, mercado) => {
    expect(mercadoDe(telefono)).toBe(mercado);
  });

  it("un código que no figura en la tabla es «Other»", () => {
    expect(mercadoDe("+999 5550101")).toBe(MERCADO_OTRO);
  });

  it.each([[null], [""], ["04125550101"], ["+58 41"], ["+1 234 567 890 123 456"]])(
    "sin un E.164 utilizable (%s) no hay mercado",
    (telefono) => {
      expect(mercadoDe(telefono)).toBeNull();
    },
  );
});

describe("estimarCosto", () => {
  it("N mensajes × la tarifa de servicio del mercado, con fecha y fuente", () => {
    expect(estimarCosto({ enviados: 37, completo: true, telefono: "+584125550101" })).toEqual({
      enviados: 37,
      completo: true,
      mercado: "Rest of Latin America",
      tarifa: 0.0113,
      total: 0.4181,
      vigenteDesde: "2026-10-01",
      fuente: "https://developers.facebook.com/docs/whatsapp/pricing",
    });
  });

  it("usa la tarifa de SERVICIO, no la de marketing", () => {
    const c = estimarCosto({ enviados: 10, completo: true, telefono: "+573005550101" })!;
    expect(c.tarifa).toBe(TARIFAS.Colombia.service);
    expect(c.tarifa).not.toBe(TARIFAS.Colombia.marketing);
  });

  it("conserva «completo: false» (el costo es un piso)", () => {
    expect(estimarCosto({ enviados: 1000, completo: false, telefono: "+584125550101" })?.completo).toBe(false);
  });

  it("cero mensajes: US$0", () => {
    expect(estimarCosto({ enviados: 0, completo: true, telefono: "+584125550101" })?.total).toBe(0);
  });

  it("sin teléfono no hay costo, y el resultado nunca lleva el teléfono", () => {
    expect(estimarCosto({ enviados: 5, completo: true, telefono: null })).toBeNull();
    const c = estimarCosto({ enviados: 5, completo: true, telefono: "+584125550101" });
    expect(JSON.stringify(c)).not.toMatch(/555|412/);
  });
});
