// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  CAJA_MINIMA,
  CONFIG,
  FT3_POR_CBM,
  cajasParaCbm,
  describirVolumenEnCajas,
} from "@/lib/calculadora";

/**
 * El mínimo de carga, dicho en cajas (SDD-0237).
 *
 * El punto de cruce se sigue calculando igual —`piso ÷ tarifa`— y eso NO se
 * toca. Lo único que cambia es cómo se DICE: "0,0625 m³" no le comunica nada a
 * un comerciante. Estos tests fijan que la traducción siga al cálculo en vez de
 * quedar congelada en un texto.
 */

describe("la caja estándar", () => {
  it("mide 0,03 m³ exactos — el label y el volumen no pueden divergir", () => {
    const { largoCm, anchoCm, altoCm, cbm } = CAJA_MINIMA;
    expect((largoCm * anchoCm * altoCm) / 1_000_000).toBeCloseTo(cbm, 10);
    expect(CAJA_MINIMA.label).toBe("40×30×25 cm");
  });

  it("no participa en el pricing", () => {
    // Si algún día la caja entra en un cálculo de precio, este test es el aviso:
    // es una regla de bodega, no un parámetro comercial.
    expect(Object.values(CONFIG)).not.toContain(CAJA_MINIMA.cbm);
  });
});

describe("cajasParaCbm", () => {
  it("redondea HACIA ARRIBA — 2,08 cajas todavía no llegan al volumen", () => {
    expect(cajasParaCbm(0.0625)).toBe(3);
    expect(cajasParaCbm(0.06)).toBe(2);
    expect(cajasParaCbm(0.03)).toBe(1);
    expect(cajasParaCbm(0.031)).toBe(2);
  });

  it("degrada a 0 con entradas basura en vez de tirar", () => {
    expect(cajasParaCbm(0)).toBe(0);
    expect(cajasParaCbm(-1)).toBe(0);
    expect(cajasParaCbm(NaN)).toBe(0);
    expect(cajasParaCbm(Infinity)).toBe(0);
  });
});

describe("describirVolumenEnCajas", () => {
  it("traduce el mínimo real de hoy: 2 cajas", () => {
    // 50 / 850 = 0,0588 m³ → 2 cajas
    const crossover = CONFIG.minimoFacturable / CONFIG.tarifaBaseCBM;
    expect(describirVolumenEnCajas(crossover)).toBe("2 cajas de 40×30×25 cm");
  });

  it("el pie cúbico viene APAGADO por default", () => {
    // No es cosmético: encendido, el aviso pasa de 3 a 4 líneas en 390px dentro
    // de una caja de 141px (medido en el navegador). Si alguien invierte el
    // default, el aviso del mínimo se vuelve un ladrillo en móvil.
    expect(describirVolumenEnCajas(0.0625)).not.toContain("pies cúbicos");
    expect(describirVolumenEnCajas(0.0625, { conPiesCubicos: true })).toBe(
      "3 cajas de 40×30×25 cm (unos 2 pies cúbicos)",
    );
  });

  it("SIGUE al cálculo: si sube la tarifa, bajan las cajas", () => {
    // Es lo que hace que valga la pena derivarlo. Con la tarifa al doble, el
    // mismo piso se alcanza con la mitad de volumen.
    const conTarifaDoble = CONFIG.minimoFacturable / (CONFIG.tarifaBaseCBM * 2);
    expect(cajasParaCbm(conTarifaDoble)).toBe(1);
    expect(describirVolumenEnCajas(conTarifaDoble)).toContain("1 caja");
  });

  it("SIGUE al cálculo: si sube el piso, suben las cajas", () => {
    const conPisoAlto = 380 / CONFIG.tarifaBaseCBM; // el min_charge comercial real
    expect(describirVolumenEnCajas(conPisoAlto)).toBe("15 cajas de 40×30×25 cm");
  });

  it("singulariza: una caja, un pie cúbico", () => {
    expect(describirVolumenEnCajas(0.03)).toBe("1 caja de 40×30×25 cm");
    expect(describirVolumenEnCajas(0.03, { conPiesCubicos: true })).toBe(
      "1 caja de 40×30×25 cm (un pie cúbico)",
    );
  });

  it("omite el pie cúbico cuando redondearía a cero", () => {
    // "unos 0 pies cúbicos" es absurdo; ahí la referencia no aporta.
    const txt = describirVolumenEnCajas(0.005, { conPiesCubicos: true });
    expect(txt).toBe("1 caja de 40×30×25 cm");
    expect(txt).not.toContain("pie");
  });

  it("la conversión a pies cúbicos usa la constante, no un número suelto", () => {
    const cbm = 0.283;
    const esperado = Math.round(cbm * FT3_POR_CBM);
    expect(describirVolumenEnCajas(cbm, { conPiesCubicos: true })).toContain(
      `unos ${esperado} pies cúbicos`,
    );
  });

  it("no menciona metros cúbicos: ese era justo el problema", () => {
    expect(describirVolumenEnCajas(0.0625)).not.toMatch(/m³|metros? cúbicos?/);
  });
});
