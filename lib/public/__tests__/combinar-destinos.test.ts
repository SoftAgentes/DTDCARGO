// @vitest-environment node
import { describe, it, expect } from "vitest";
import { combinarDestinos } from "@/lib/public/rates-queries";
import { calcularEnvioLCL, CIUDADES, type Ciudad } from "@/lib/calculadora";

/**
 * `combinarDestinos` cruza tres fuentes (SDD-0237) y la regla de quién manda en
 * qué no es obvia. Estos tests la congelan.
 *
 * El caso que motivó el archivo es el de la VENTANA DE DESPLIEGUE: el código
 * sale a producción antes de que se aplique la migración que siembra los datos.
 * En esa ventana `calculator_cities` todavía tiene las 19 filas viejas y cero
 * tarifas — y si el cruce se hace mal, el cliente paga de más en silencio.
 */
describe("combinarDestinos", () => {
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

  describe("la ventana entre el deploy y la migración", () => {
    // REGRESIÓN REAL: sin este OR, Barquisimeto cobraba $529,70 y Acarigua
    // $618 por 5 m³ — donde el founder decidió cobrar $0.
    it("la zona sin costo cobra $0 aunque la DB todavía diga casco = false", () => {
      const ciudades = combinarDestinos(prodViejo, []);

      expect(entrega(ciudades, "barquisimeto").recargoCiudad).toBe(0);
      expect(entrega(ciudades, "acarigua").recargoCiudad).toBe(0);
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
