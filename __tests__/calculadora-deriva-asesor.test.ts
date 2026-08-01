import { describe, it, expect } from "vitest";
import {
  CIUDADES,
  CIUDADES_DERIVAN_A_ASESOR,
  calcularEnvioLCL,
  entregaTardaMas,
  type Ciudad,
} from "@/lib/calculadora";

/**
 * Cuándo la calculadora NO da un número (SDD-0237).
 *
 * ANTES (SDD-0055): la lista `CIUDADES_DERIVAN_A_ASESOR` era el único
 * mecanismo, y tenía `cumana` y `san-fernando` porque ningún proveedor
 * confirmado les ponía precio.
 *
 * AHORA hay tres caminos distintos, y cada uno le dice al cliente algo
 * distinto. La regla que los une: **nunca inventar un número que no podemos
 * honrar**.
 *
 *   1. Sin cobertura → "no llegamos, pero sí hasta X, y ese tramo cuesta…"
 *   2. Sin tarifa    → "cotizamos a medida, habla con un asesor"
 *   3. Lista manual  → palanca de emergencia, hoy vacía
 */
describe("cuándo la calculadora NO cotiza", () => {
  const carga = { cbmTotal: 1, pesoKg: 400, embalaje: "estandar" as const };

  // ── 1 · Sin cobertura ──────────────────────────────────────────────
  describe("destino sin cobertura", () => {
    it("Güiria no cotiza, pero ofrece Cumaná con su precio", () => {
      const cot = calcularEnvioLCL({ ...carga, ciudadId: "guiria" });

      expect(cot.alerta?.tipo).toBe("ciudad_sin_cobertura");
      expect(cot.total).toBe(0);
      expect(cot.cercana).toEqual({ label: "Cumaná", ventaCbm: 123.6 });
    });

    it("el mensaje dice hasta DÓNDE sí llegamos y que es un estimado", () => {
      const cot = calcularEnvioLCL({ ...carga, ciudadId: "guiria" });
      const msg = cot.alerta?.mensaje ?? "";

      expect(msg).toContain("Güiria");
      expect(msg).toContain("Cumaná");
      expect(msg).toContain("123.60");
      // El último trecho NO está incluido: decirlo es la diferencia entre una
      // venta y un reclamo.
      expect(msg).toContain("no está incluido");
    });

    it("las 9 sin cobertura derivan, y TODAS tienen una vecina que sí cobra", () => {
      const sinCobertura = CIUDADES.filter((c) => c.cubierta === false);
      expect(sinCobertura).toHaveLength(9);

      for (const ciudad of sinCobertura) {
        const cot = calcularEnvioLCL({ ...carga, ciudadId: ciudad.id });
        expect(cot.alerta?.tipo, ciudad.label).toBe("ciudad_sin_cobertura");
        expect(cot.total, ciudad.label).toBe(0);
        expect(cot.cercana?.ventaCbm, `${ciudad.label} sin vecina`).toBeGreaterThan(0);
      }
    });
  });

  // ── 2 · Sin tarifa ─────────────────────────────────────────────────
  describe("destino cubierto pero sin tarifa cargada", () => {
    // Es el caso real cuando la RPC devuelve una ciudad que todavía no tiene
    // fila en carrier_tariffs. No se inventa precio: se deriva.
    const huerfana: Ciudad[] = [
      { id: "pueblo-nuevo", label: "Pueblo Nuevo", km: 0, casco: false, ventaCbm: null, cubierta: true },
    ];

    it("deriva al asesor en vez de cobrar $0", () => {
      const cot = calcularEnvioLCL(
        { ...carga, ciudadId: "pueblo-nuevo" },
        undefined,
        huerfana,
      );
      expect(cot.alerta?.tipo).toBe("ciudad_sin_tarifa");
      expect(cot.total).toBe(0);
    });

    it("PRUEBA DE MUTACIÓN — con tarifa, la misma ciudad SÍ cotiza", () => {
      const conTarifa = huerfana.map((c) => ({ ...c, ventaCbm: 123.6 }));
      const cot = calcularEnvioLCL(
        { ...carga, ciudadId: "pueblo-nuevo" },
        undefined,
        conTarifa,
      );
      // Confirma que lo que dispara la derivación es la AUSENCIA de precio, no
      // otra cosa del camino.
      expect(cot.alerta).toBeUndefined();
      expect(cot.recargoCiudad).toBe(123.6);
    });
  });

  // ── 3 · La palanca manual ──────────────────────────────────────────
  describe("CIUDADES_DERIVAN_A_ASESOR", () => {
    it("está vacía: Cumaná y San Fernando ya tienen precio", () => {
      expect(CIUDADES_DERIVAN_A_ASESOR).toHaveLength(0);
    });

    it("Cumaná y San Fernando cotizan como foráneos", () => {
      for (const id of ["cumana", "san-fernando"]) {
        const cot = calcularEnvioLCL({ ...carga, ciudadId: id, minChargeOverride: 0 });
        expect(cot.alerta, id).toBeUndefined();
        expect(cot.recargoCiudad, id).toBe(123.6);
      }
    });
  });

  // ── El aviso que NO bloquea ────────────────────────────────────────
  describe("destino quincenal", () => {
    it("cotiza igual, pero avisa que el camión no sale todas las semanas", () => {
      const cot = calcularEnvioLCL({ ...carga, ciudadId: "tucupita", minChargeOverride: 0 });

      expect(cot.alerta).toBeUndefined(); // NO bloquea
      expect(cot.recargoCiudad).toBe(176.57); // Remota
      expect(cot.avisoEntrega).toContain("no sale todas las semanas");
    });

    it("un destino semanal no lleva aviso", () => {
      const cot = calcularEnvioLCL({ ...carga, ciudadId: "maracaibo", minChargeOverride: 0 });
      expect(cot.avisoEntrega).toBeNull();
    });

    it("el umbral es 8 días, no 15: lo que salga menos de 1 vez por semana avisa", () => {
      expect(entregaTardaMas(1)).toBe(false);
      expect(entregaTardaMas(7)).toBe(false);
      expect(entregaTardaMas(8)).toBe(false);
      expect(entregaTardaMas(9)).toBe(true);
      expect(entregaTardaMas(15)).toBe(true);
      expect(entregaTardaMas(null)).toBe(false);
    });

    it("son 15 los destinos quincenales que confirmó el transportista", () => {
      expect(CIUDADES.filter((c) => c.frecuenciaDias === 15)).toHaveLength(15);
    });
  });
});
