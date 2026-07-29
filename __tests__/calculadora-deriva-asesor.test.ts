import { describe, it, expect } from "vitest";
import {
  CIUDADES,
  CIUDADES_DERIVAN_A_ASESOR,
  calcularEnvioLCL,
  type Ciudad,
} from "@/lib/calculadora";

/**
 * Destinos sin tarifa de proveedor confirmada → derivan al asesor en vez de dar
 * un número que no podemos honrar (founder 2026-07-29).
 *
 * Cumaná y San Fernando de Apure existen en `calculator_cities` (migración 0277,
 * tienen landing SEO y km) pero NO tienen zona en `VALENCIA_ZONAS`, así que
 * ninguna tabla de proveedor les pone precio. Es TEMPORAL: al cerrar las
 * negociaciones se saca el slug de la lista.
 *
 * Ver docs/operaciones/transporte-nacional/.
 */
describe("destinos que derivan al asesor", () => {
  const cargaValida = {
    cbmTotal: 2,
    pesoKg: 400,
    embalaje: "estandar" as const,
  };

  it("Cumaná no cotiza: devuelve alerta ciudad_sin_tarifa y total 0", () => {
    const cot = calcularEnvioLCL({ ...cargaValida, ciudadId: "cumana" });
    expect(cot.alerta?.tipo).toBe("ciudad_sin_tarifa");
    expect(cot.total).toBe(0);
    // El mensaje nombra la ciudad — es el texto que la UI pinta y el que viaja
    // al WhatsApp del asesor.
    expect(cot.alerta?.mensaje).toContain("Cumaná");
    expect(cot.alerta?.mensaje).toContain("asesor");
  });

  it("San Fernando de Apure tampoco cotiza", () => {
    const cot = calcularEnvioLCL({ ...cargaValida, ciudadId: "san-fernando" });
    expect(cot.alerta?.tipo).toBe("ciudad_sin_tarifa");
    expect(cot.total).toBe(0);
    expect(cot.alerta?.mensaje).toContain("San Fernando de Apure");
  });

  it("las OTRAS 3 ciudades nuevas de la 0277 SÍ cotizan con precio", () => {
    for (const id of ["maturin", "valera", "acarigua"]) {
      const cot = calcularEnvioLCL({ ...cargaValida, ciudadId: id });
      expect(cot.alerta, `${id} no debería derivar al asesor`).toBeUndefined();
      expect(cot.total, `${id} debería tener total > 0`).toBeGreaterThan(0);
    }
  });

  it("la lista no toca ningún destino histórico (cero regresión)", () => {
    const historicas = CIUDADES.filter(
      (c) => !CIUDADES_DERIVAN_A_ASESOR.includes(c.id),
    );
    for (const c of historicas) {
      const cot = calcularEnvioLCL({ ...cargaValida, ciudadId: c.id });
      expect(cot.alerta, `${c.id} no debería derivar al asesor`).toBeUndefined();
    }
    // Y las 2 que sí derivan están efectivamente en CIUDADES (si alguien las
    // borra del array, este test avisa en vez de pasar en silencio).
    for (const slug of CIUDADES_DERIVAN_A_ASESOR) {
      expect(CIUDADES.some((c) => c.id === slug), `${slug} falta en CIUDADES`).toBe(true);
    }
  });

  it("PRUEBA DE MUTACIÓN — sin la lista, Cumaná cotizaría con precio", () => {
    // Simula la DB SIN el gate: mismos km de la 0277, inyectados como ciudad
    // cualquiera. Si el chequeo dependiera de los km o del label (y no del
    // slug), este caso también derivaría y el test de arriba sería decorado.
    const dbSinGate: Ciudad[] = [
      { id: "cumana-otro-slug", label: "Cumaná", km: 560, casco: false },
    ];
    const cot = calcularEnvioLCL(
      { ...cargaValida, ciudadId: "cumana-otro-slug" },
      undefined,
      dbSinGate,
    );
    expect(cot.alerta).toBeUndefined();
    expect(cot.total).toBeGreaterThan(0);
    // 560 − 200 = 360 km fuera del casco × $1 → confirma que el camino normal
    // de cálculo corrió de verdad.
    expect(cot.recargoCiudad).toBe(360);
  });

  it("el gate es por slug, así que aplica también a ciudades inyectadas de la DB", () => {
    const dbConCumana: Ciudad[] = [
      { id: "cumana", label: "Cumaná (DB)", km: 999, casco: false },
    ];
    const cot = calcularEnvioLCL(
      { ...cargaValida, ciudadId: "cumana" },
      undefined,
      dbConCumana,
    );
    expect(cot.alerta?.tipo).toBe("ciudad_sin_tarifa");
    // Usa el label de la DB, no uno hardcodeado.
    expect(cot.alerta?.mensaje).toContain("Cumaná (DB)");
  });
});
