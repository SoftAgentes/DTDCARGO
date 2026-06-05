import { describe, it, expect } from "vitest";
import {
  CIUDADES,
  calcularEnvioLCL,
  type Ciudad,
} from "@/lib/calculadora";

/**
 * Fase 3 Slice B (SDD-0055) · el 3er arg de calcularEnvioLCL son las CIUDADES
 * (de la DB, calculator_cities). Default = CIUDADES (array hardcoded), por eso
 * todos los tests existentes siguen verdes. Acá probamos:
 *  - ciudades inyectadas ("de la DB") cambian el cálculo
 *  - fallback al array CIUDADES cuando no se inyecta nada
 *  - ciudad ausente en la lista inyectada → alerta ciudad_invalida
 */
describe("calcularEnvioLCL con ciudades inyectadas", () => {
  // "DB" simulada: una sola ciudad fuera del casco, con km distinto al default.
  const dbCities: Ciudad[] = [
    { id: "valencia", label: "Valencia (sede)", km: 0, casco: true },
    { id: "valera", label: "Valera", km: 300, casco: false },
  ];

  it("resuelve la ciudad desde la lista inyectada (no del array global)", () => {
    const cot = calcularEnvioLCL(
      { cbmTotal: 1, pesoKg: 400, embalaje: "estandar", ciudadId: "valera" },
      undefined,
      dbCities,
    );
    expect(cot.ciudad?.id).toBe("valera");
    // 300 km − 200 (threshold default) = 100 km × $1 = $100
    expect(cot.recargoCiudad).toBe(100);
    expect(cot.total).toBe(900);
  });

  it("una ciudad del casco inyectada no cobra recargo por km", () => {
    const cot = calcularEnvioLCL(
      { cbmTotal: 1, pesoKg: 400, embalaje: "estandar", ciudadId: "valencia" },
      undefined,
      dbCities,
    );
    expect(cot.recargoCiudad).toBe(0);
    expect(cot.total).toBe(800);
  });

  it("ciudad que NO está en la lista inyectada → alerta ciudad_invalida", () => {
    // 'caracas' existe en CIUDADES pero NO en dbCities → debe fallar.
    const cot = calcularEnvioLCL(
      { cbmTotal: 1, pesoKg: 400, embalaje: "estandar", ciudadId: "caracas" },
      undefined,
      dbCities,
    );
    expect(cot.alerta?.tipo).toBe("ciudad_invalida");
    expect(cot.total).toBe(0);
  });

  it("sin 3er arg cae al array CIUDADES (cero regresión)", () => {
    const conDefault = calcularEnvioLCL({
      cbmTotal: 1,
      pesoKg: 400,
      embalaje: "estandar",
      ciudadId: "barquisimeto",
    });
    const conCiudadesExplicitas = calcularEnvioLCL(
      { cbmTotal: 1, pesoKg: 400, embalaje: "estandar", ciudadId: "barquisimeto" },
      undefined,
      CIUDADES,
    );
    expect(conDefault).toEqual(conCiudadesExplicitas);
    expect(conDefault.recargoCiudad).toBe(20); // 220 − 200 = 20 km × $1
  });

  it("una lista vacía inyectada hace fallar TODA ciudad (caller debe pasar fallback)", () => {
    const cot = calcularEnvioLCL(
      { cbmTotal: 1, pesoKg: 400, embalaje: "estandar", ciudadId: "valencia" },
      undefined,
      [],
    );
    expect(cot.alerta?.tipo).toBe("ciudad_invalida");
  });
});
