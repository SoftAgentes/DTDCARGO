// @vitest-environment node
import { describe, it, expect } from "vitest";
import { combinarDestinos } from "@/lib/public/rates-queries";
import { calcularEnvioLCL, CIUDADES, DEFAULT_PARAMS, type Ciudad } from "@/lib/calculadora";

/**
 * `combinarDestinos` cruza tres fuentes (SDD-0237) y la regla de quién manda en
 * qué no es obvia. Estos tests la congelan.
 *
 * SDD-0504 cambia la precedencia histórica: el catálogo persistido manda
 * también en la inclusión. El fallback no revierte una exclusión guardada.
 */
describe("combinarDestinos", () => {
  it("fallback: Caracas, Valencia y Maracay mantienen el mismo total; Acarigua cobra su tarifa existente", () => {
    const cities = combinarDestinos([], []);
    const quote = (id: string) => calcularEnvioLCL(
      { cbmTotal: 1, pesoKg: 100, embalaje: "estandar", ciudadId: id },
      { ...DEFAULT_PARAMS, descuentoValencia: 0 }, cities,
    );
    for (const id of ["caracas", "valencia", "maracay"]) {
      expect(quote(id).total).toBe(850);
      expect(quote(id).recargoCiudad).toBe(0);
    }
    expect(quote("acarigua").recargoCiudad).toBe(123.6);
    expect(quote("acarigua").total).toBe(973.6);
    expect(cities.filter((c) => c.casco).map((c) => c.id).sort()).toEqual([
      "barquisimeto", "caracas", "guacara", "maracay", "naguanagua", "san-diego", "valencia",
    ]);
  });

  it("toggle persistido cambia el total y conserva precio, mínimo terrestre y fórmula batería/descuento", () => {
    const tariff = [{ citySlug: "valencia", priceUsdCbm: 200, minChargeUsd: 60, dispatchFrequencyDays: 2, transitDays: null }];
    const params = { ...DEFAULT_PARAMS, recargoBateriaMult: 2, descuentoValencia: 5 };
    const input = { cbmTotal: 0.01, pesoKg: 1, embalaje: "estandar" as const, ciudadId: "valencia", bateria: true, minChargeOverride: 50 };
    const included = combinarDestinos([{ id: "valencia", label: "Valencia", km: 0, casco: true }], tariff);
    const excluded = combinarDestinos([{ ...included[0], casco: false }], tariff);
    expect(included[0].ventaCbm).toBe(200);
    expect(excluded[0].ventaCbm).toBe(200);
    expect(calcularEnvioLCL(input, params, included).total).toBe(95);
    const final = calcularEnvioLCL(input, params, excluded);
    expect(final.recargoCiudad).toBe(60);
    expect(final.total).toBe(132);
  });

  it("Acarigua usa la tarifa persistida sin reemplazarla por el fallback", () => {
    const cities = combinarDestinos([{ id: "acarigua", label: "Acarigua", km: 175, casco: false }], [
      { citySlug: "acarigua", priceUsdCbm: 150, minChargeUsd: 180, dispatchFrequencyDays: 3, transitDays: null },
    ]);
    const final = calcularEnvioLCL({ cbmTotal: 1, pesoKg: 100, embalaje: "estandar", ciudadId: "acarigua" }, undefined, cities);
    expect(final.recargoCiudad).toBe(180);
    expect(final.total).toBe(1030);
  });

  it("sin precio confirmado deriva al asesor al quitar la inclusión", () => {
    const city = { id: "nueva-ciudad", label: "Nueva ciudad", km: 0, casco: true };
    const input = { cbmTotal: 1, pesoKg: 100, embalaje: "estandar" as const, ciudadId: city.id };
    expect(calcularEnvioLCL(input, undefined, combinarDestinos([city], [])).total).toBe(850);
    const final = calcularEnvioLCL(input, undefined, combinarDestinos([{ ...city, casco: false }], []));
    expect(final.total).toBe(0);
    expect(final.alerta?.tipo).toBe("ciudad_sin_tarifa");
  });
  /** Lo que hay en producción ANTES de aplicar la migración 0332. */
  const prodViejo: Ciudad[] = [
    { id: "casco-central", label: "Casco central (…)", km: 0, casco: true },
    { id: "valencia", label: "Valencia (sede)", km: 0, casco: true },
    { id: "barquisimeto", label: "Barquisimeto", km: 220, casco: false },
    { id: "acarigua", label: "Acarigua", km: 175, casco: false },
    { id: "maracaibo", label: "Maracaibo", km: 410, casco: false },
  ];

  const entrega = (ciudades: Ciudad[], id: string, cbm = 5) =>
    calcularEnvioLCL(
      { cbmTotal: cbm, pesoKg: 500, embalaje: "estandar", ciudadId: id, minChargeOverride: 0 },
      undefined,
      ciudades,
    );

  describe("inclusión administrada (SDD-0504)", () => {
    it("una exclusión persistida prevalece sobre el fallback incluido", () => {
      const ciudades = combinarDestinos(prodViejo, []);

      expect(entrega(ciudades, "barquisimeto").recargoCiudad).toBe(529.7);
      expect(entrega(ciudades, "acarigua").recargoCiudad).toBe(618);
    });

    it("una ciudad que NO es de la zona sin costo sí cobra", () => {
      const ciudades = combinarDestinos(prodViejo, []);
      // Maracaibo es Foráneo: 5 × $123,60.
      expect(entrega(ciudades, "maracaibo").recargoCiudad).toBe(618);
    });

    it("la opción agrupada vieja no rompe: cobra $0 y no deriva", () => {
      const ciudades = combinarDestinos(prodViejo, []);
      const cot = entrega(ciudades, "casco-central");
      expect(cot.alerta).toBeUndefined();
      expect(cot.recargoCiudad).toBe(0);
    });
  });

  describe("quién manda en qué", () => {
    it("la DB manda en el precio: su tarifa le gana al respaldo del código", () => {
      const ciudades = combinarDestinos(prodViejo, [
        {
          citySlug: "maracaibo",
          priceUsdCbm: 200,
          minChargeUsd: null,
          dispatchFrequencyDays: null,
          transitDays: null,
        },
      ]);
      // El respaldo diría $123,60; manda la DB. Es lo que permite subir una
      // tarifa desde el ERP sin deploy.
      expect(entrega(ciudades, "maracaibo", 1).recargoCiudad).toBe(200);
    });

    it("el código manda en la cobertura: la DB no tiene columna para eso", () => {
      const ciudades = combinarDestinos(
        [{ id: "guiria", label: "Güiria", km: 0, casco: false }],
        [],
      );
      const cot = entrega(ciudades, "guiria");
      expect(cot.alerta?.tipo).toBe("ciudad_sin_cobertura");
    });

    it("sin filas de la DB cae al respaldo completo (178 destinos)", () => {
      expect(combinarDestinos([], [])).toHaveLength(CIUDADES.length);
    });

    it("una ciudad que el código no conoce entra igual, pero sin precio deriva", () => {
      const ciudades = combinarDestinos(
        [{ id: "pueblo-inventado", label: "Pueblo Inventado", km: 0, casco: false }],
        [],
      );
      expect(entrega(ciudades, "pueblo-inventado").alerta?.tipo).toBe("ciudad_sin_tarifa");
    });
  });
});
