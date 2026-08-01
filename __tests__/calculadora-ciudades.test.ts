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
  // "DB" simulada: la de la DB trae un precio DISTINTO al del respaldo, para
  // probar que manda la DB. En el fallback Valera cobra $123,60 (Foráneo).
  const dbCities: Ciudad[] = [
    { id: "valencia", label: "Valencia (sede)", km: 0, casco: true, ventaCbm: null, cubierta: true },
    { id: "valera", label: "Valera", km: 300, casco: false, ventaCbm: 200, cubierta: true },
  ];

  it("resuelve la ciudad y el PRECIO desde la lista inyectada, no del respaldo", () => {
    const cot = calcularEnvioLCL(
      { cbmTotal: 1, pesoKg: 400, embalaje: "estandar", ciudadId: "valera" },
      undefined,
      dbCities,
    );
    expect(cot.ciudad?.id).toBe("valera");
    // La DB dice $200/m³; el respaldo diría $123,60. Manda la DB — que es lo
    // que permite editar precios desde el ERP sin deploy.
    expect(cot.recargoCiudad).toBe(200);
    expect(cot.total).toBe(1000);
  });

  it("ciudad inyectada SIN precio → deriva al asesor, no inventa un número", () => {
    const cot = calcularEnvioLCL(
      { cbmTotal: 1, pesoKg: 400, embalaje: "estandar", ciudadId: "sin-precio" },
      undefined,
      [
        ...dbCities,
        { id: "sin-precio", label: "Pueblo sin tarifa", km: 500, casco: false, ventaCbm: null, cubierta: true },
      ],
    );
    expect(cot.alerta?.tipo).toBe("ciudad_sin_tarifa");
    expect(cot.total).toBe(0);
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
    // Barquisimeto está en la zona sin costo → el cliente no paga entrega.
    expect(conDefault.recargoCiudad).toBe(0);
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
