// @vitest-environment node
/**
 * SDD-0231 · tarifario terrestre — conversión, validación y avisos.
 *
 * Lo que se protege acá son las tres cosas que, si se rompen, cobran mal o le
 * mienten al cliente: la conversión ft³→CBM, que la venta NO se derive del
 * costo, y el aviso de los destinos que salen cada 15 días.
 */
import { describe, expect, it } from "vitest";
import {
  FT3_POR_CBM,
  avisoDeDemora,
  cbmAFt3,
  ft3ACbm,
  margenPorCbm,
  margenTone,
  parseMonto,
  tardaMasDeLoNormal,
  validateCarrierInput,
  validateTariffInput,
} from "../freight-carriers/types";

function fd(pares: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(pares)) f.append(k, v);
  return f;
}

describe("conversión de unidades", () => {
  it("reproduce la tabla de Benito tal como quedó negociada", () => {
    // Los tres números que el founder aprobó, convertidos desde pie cúbico.
    expect(ft3ACbm(3.0)).toBe(105.94); // Centro
    expect(ft3ACbm(3.5)).toBe(123.6); // Foráneo
    expect(ft3ACbm(5.0)).toBe(176.57); // Remota
  });

  it("el factor es el estándar de la industria", () => {
    expect(FT3_POR_CBM).toBe(35.3147);
  });

  it("ida y vuelta no se desvía más de un centavo", () => {
    for (const ft3 of [3, 3.5, 5, 1.25, 8.75]) {
      expect(Math.abs(cbmAFt3(ft3ACbm(ft3)) - ft3)).toBeLessThan(0.001);
    }
  });
});

describe("aviso de destinos que salen poco", () => {
  it("avisa en los quincenales", () => {
    expect(tardaMasDeLoNormal(15)).toBe(true);
    expect(avisoDeDemora("Guasipati", 15)).toMatch(/no sale todas las semanas/i);
    expect(avisoDeDemora("Guasipati", 15)).toMatch(/hasta una semana más/i);
  });

  it("no avisa en los semanales ni en los diarios", () => {
    expect(tardaMasDeLoNormal(7)).toBe(false);
    expect(tardaMasDeLoNormal(1)).toBe(false);
    expect(avisoDeDemora("Maracay", 7)).toBeNull();
  });

  it("sin dato de frecuencia no inventa un aviso", () => {
    expect(tardaMasDeLoNormal(null)).toBe(false);
    expect(avisoDeDemora("Cualquiera", null)).toBeNull();
  });

  it("el umbral es 8 días: lo que sale menos de una vez por semana avisa", () => {
    expect(tardaMasDeLoNormal(8)).toBe(false);
    expect(tardaMasDeLoNormal(9)).toBe(true);
  });
});

describe("montos escritos como se escriben en Venezuela", () => {
  it("acepta coma decimal", () => {
    expect(parseMonto("123,60")).toBe(123.6);
    expect(parseMonto("105,94")).toBe(105.94);
  });

  it("acepta punto decimal y espacios sueltos", () => {
    expect(parseMonto("123.60")).toBe(123.6);
    expect(parseMonto(" 80 ")).toBe(80);
  });

  it("vacío es null, no cero — un precio sin cargar no es un precio de $0", () => {
    expect(parseMonto("")).toBeNull();
    expect(parseMonto("   ")).toBeNull();
  });

  it("basura es null", () => {
    expect(parseMonto("como sea")).toBeNull();
  });
});

describe("validateCarrierInput", () => {
  it("exige el nombre", () => {
    const r = validateCarrierInput(fd({ name: "  " }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.name).toMatch(/nombre/i);
  });

  it("acepta a Benito con su razón social y RIF", () => {
    const r = validateCarrierInput(
      fd({
        name: "Benito",
        legalName: "BENITO TRANSPORTE EXPRESS, C.A",
        taxId: "J-50266334-7",
        isDefault: "on",
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.name).toBe("Benito");
      expect(r.value.isDefault).toBe(true);
      expect(r.value.active).toBe(true);
    }
  });

  it("los opcionales vacíos quedan en null, no en cadena vacía", () => {
    const r = validateCarrierInput(fd({ name: "GAG", legalName: "", taxId: "" }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.legalName).toBeNull();
      expect(r.value.taxId).toBeNull();
    }
  });
});

describe("validateTariffInput", () => {
  const base = { carrierId: "c1", citySlug: "puerto-ordaz", costUsdCbm: "80" };

  it("acepta el precio de venta en pie cúbico y lo convierte", () => {
    const r = validateTariffInput(fd({ ...base, priceUsdFt3: "3,5" }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.priceUsdCbm).toBe(123.6);
      expect(r.value.priceUsdFt3).toBe(3.5);
    }
  });

  it("si viene el precio en CBM, ese manda", () => {
    const r = validateTariffInput(fd({ ...base, priceUsdCbm: "123,60" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.priceUsdCbm).toBe(123.6);
  });

  it("sin ningún precio de venta, no pasa", () => {
    const r = validateTariffInput(fd(base));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.priceUsdCbm).toMatch(/precio de venta/i);
  });

  it("sin costo, no pasa: hay que saber qué nos cobran", () => {
    const r = validateTariffInput(
      fd({ carrierId: "c1", citySlug: "x", priceUsdCbm: "100" }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.costUsdCbm).toBeTruthy();
  });

  it("rechaza una vigencia que termina antes de empezar", () => {
    const r = validateTariffInput(
      fd({ ...base, priceUsdCbm: "100", validFrom: "2026-08-01", validTo: "2026-07-01" }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.validTo).toMatch(/antes de empezar/i);
  });

  it("la frecuencia son días enteros positivos", () => {
    const r = validateTariffInput(
      fd({ ...base, priceUsdCbm: "100", dispatchFrequencyDays: "0" }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.dispatchFrequencyDays).toBeTruthy();
  });
});

describe("margen", () => {
  it("es una RESTA, no un porcentaje — la venta no se deriva del costo", () => {
    expect(margenPorCbm({ costUsdCbm: 70, priceUsdCbm: 105.94 })).toBe(35.94);
    expect(margenPorCbm({ costUsdCbm: 80, priceUsdCbm: 123.6 })).toBe(43.6);
    expect(margenPorCbm({ costUsdCbm: 80, priceUsdCbm: 176.57 })).toBe(96.57);
  });

  it("marca en rojo cuando le ponemos de nuestro bolsillo", () => {
    // Las 8 ciudades del casco: el cliente paga $0 y DTD asume el costo.
    expect(margenPorCbm({ costUsdCbm: 70, priceUsdCbm: 0 })).toBe(-70);
    expect(margenTone(-70)).toBe("negative");
    expect(margenTone(0)).toBe("neutral");
    expect(margenTone(35.94)).toBe("positive");
  });
});
