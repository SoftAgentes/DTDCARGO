import { describe, it, expect } from "vitest";
import {
  CONFIG,
  CIUDADES,
  calcularEnvioLCL,
  whatsappTextFromCotizacion,
} from "@/lib/calculadora";

/**
 * Tests del cálculo de cotización LCL DDP.
 *
 * Cubre los casos críticos del pricing model:
 * - Carga normal (densidad <= 500 kg/CBM) → solo CBM × tarifaBase
 * - Excedente de peso (500-600 kg/CBM) → suma recargo
 * - Carga ultradensa (>600 kg/CBM) → alerta + estimado igual
 * - Destinos: Valencia (descuento), Maracay (casco), fuera del casco (km × $)
 * - Embalaje: cartón (0) vs paleta (+$60)
 * - Validación: dimensiones inválidas, ciudad inválida
 */
describe("calcularEnvioLCL", () => {
  // ─────────────────────────────────────────────────────────────────
  // Caso normal: 1 CBM, 400 kg, Valencia, cartón
  // ─────────────────────────────────────────────────────────────────
  it("calcula correctamente una carga normal a Valencia (con descuento sede)", () => {
    const cot = calcularEnvioLCL({
      largoCm: 100,
      anchoCm: 100,
      altoCm: 100, // 100×100×100 = 1 CBM
      pesoKg: 400, // < 500 kg/CBM → sin excedente
      cantidadCajas: 1,
      embalaje: "carton",
      ciudadId: "valencia",
    });

    expect(cot.cbm).toBe(1);
    expect(cot.densidadKgM3).toBe(400);
    expect(cot.precioBase).toBe(800);
    expect(cot.recargoExcedente).toBe(0);
    expect(cot.recargoCiudad).toBe(0); // Valencia es casco
    expect(cot.recargoEmbalaje).toBe(0);
    expect(cot.descuentoSede).toBe(-50);
    expect(cot.total).toBe(750); // 800 - 50
    expect(cot.alerta).toBeUndefined();
  });

  // ─────────────────────────────────────────────────────────────────
  // Excedente de peso: 1 CBM, 600 kg, Caracas
  // densidad = 600 kg/CBM (en el límite)
  // ─────────────────────────────────────────────────────────────────
  it("aplica recargo de excedente cuando supera 500 kg/CBM", () => {
    const cot = calcularEnvioLCL({
      largoCm: 100,
      anchoCm: 100,
      altoCm: 100,
      pesoKg: 600,
      cantidadCajas: 1,
      embalaje: "carton",
      ciudadId: "caracas",
    });

    expect(cot.cbm).toBe(1);
    expect(cot.densidadKgM3).toBe(600);
    expect(cot.precioBase).toBe(800);
    // 100 kg de excedente × $1 = $100
    expect(cot.recargoExcedente).toBe(100);
    expect(cot.recargoCiudad).toBe(0); // Caracas es casco
    expect(cot.total).toBe(900);
    expect(cot.alerta).toBeUndefined();
  });

  // ─────────────────────────────────────────────────────────────────
  // Carga ultradensa: 1 CBM, 800 kg → alerta peso_excedido
  // ─────────────────────────────────────────────────────────────────
  it("muestra alerta cuando la densidad supera 600 kg/CBM", () => {
    const cot = calcularEnvioLCL({
      largoCm: 100,
      anchoCm: 100,
      altoCm: 100,
      pesoKg: 800, // 800 kg/CBM > 600 → alerta
      cantidadCajas: 1,
      embalaje: "carton",
      ciudadId: "caracas",
    });

    expect(cot.alerta).toBeDefined();
    expect(cot.alerta?.tipo).toBe("peso_excedido");
    expect(cot.alerta?.mensaje).toContain("FCL");
  });

  // ─────────────────────────────────────────────────────────────────
  // Recargo por ciudad fuera del casco central
  // Barquisimeto está a 220 km → 20 km fuera del casco × $1 = $20
  // ─────────────────────────────────────────────────────────────────
  it("aplica recargo por km cuando la ciudad está fuera del casco central", () => {
    const cot = calcularEnvioLCL({
      largoCm: 100,
      anchoCm: 100,
      altoCm: 100,
      pesoKg: 400,
      cantidadCajas: 1,
      embalaje: "carton",
      ciudadId: "barquisimeto", // 220 km, fuera del casco (threshold 200)
    });

    expect(cot.recargoCiudad).toBe(20); // 220 - 200 = 20 km × $1
    expect(cot.total).toBe(820); // 800 + 20
  });

  // ─────────────────────────────────────────────────────────────────
  // Recargo por embalaje paleta
  // ─────────────────────────────────────────────────────────────────
  it("aplica recargo de $60 cuando embalaje es paleta o madera", () => {
    const cot = calcularEnvioLCL({
      largoCm: 100,
      anchoCm: 100,
      altoCm: 100,
      pesoKg: 400,
      cantidadCajas: 1,
      embalaje: "paleta",
      ciudadId: "caracas",
    });

    expect(cot.recargoEmbalaje).toBe(60);
    expect(cot.total).toBe(860); // 800 + 60
  });

  // ─────────────────────────────────────────────────────────────────
  // Múltiples cajas
  // ─────────────────────────────────────────────────────────────────
  it("multiplica el volumen por la cantidad de cajas", () => {
    const cot = calcularEnvioLCL({
      largoCm: 50,
      anchoCm: 50,
      altoCm: 50, // 0.125 m³ × 4 = 0.5 CBM
      pesoKg: 200,
      cantidadCajas: 4,
      embalaje: "carton",
      ciudadId: "caracas",
    });

    expect(cot.cbm).toBe(0.5);
    expect(cot.precioBase).toBe(400); // 0.5 × 800
  });

  // ─────────────────────────────────────────────────────────────────
  // Validación: ciudad inválida
  // ─────────────────────────────────────────────────────────────────
  it("retorna alerta cuando la ciudad no existe", () => {
    const cot = calcularEnvioLCL({
      largoCm: 100,
      anchoCm: 100,
      altoCm: 100,
      pesoKg: 400,
      cantidadCajas: 1,
      embalaje: "carton",
      ciudadId: "marte", // no existe
    });

    expect(cot.alerta).toBeDefined();
    expect(cot.alerta?.tipo).toBe("ciudad_invalida");
    expect(cot.total).toBe(0);
  });

  // ─────────────────────────────────────────────────────────────────
  // Validación: dimensiones inválidas
  // ─────────────────────────────────────────────────────────────────
  it("retorna alerta cuando las dimensiones son <= 0", () => {
    const cot = calcularEnvioLCL({
      largoCm: 0,
      anchoCm: 100,
      altoCm: 100,
      pesoKg: 400,
      cantidadCajas: 1,
      embalaje: "carton",
      ciudadId: "valencia",
    });

    expect(cot.alerta?.tipo).toBe("carga_invalida");
    expect(cot.total).toBe(0);
  });

  // ─────────────────────────────────────────────────────────────────
  // Sanity: las ciudades del casco no tienen recargo
  // ─────────────────────────────────────────────────────────────────
  it("las ciudades del casco central nunca tienen recargo por km", () => {
    const ciudadesCasco = CIUDADES.filter((c) => c.casco);
    for (const c of ciudadesCasco) {
      const cot = calcularEnvioLCL({
        largoCm: 100,
        anchoCm: 100,
        altoCm: 100,
        pesoKg: 400,
        cantidadCajas: 1,
        embalaje: "carton",
        ciudadId: c.id,
      });
      expect(cot.recargoCiudad).toBe(0);
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // El CONFIG es la fuente de verdad — los valores devueltos respetan
  // las constantes
  // ─────────────────────────────────────────────────────────────────
  it("respeta CONFIG.tarifaBaseCBM como base del cálculo", () => {
    const cot = calcularEnvioLCL({
      largoCm: 100,
      anchoCm: 100,
      altoCm: 100,
      pesoKg: 100,
      cantidadCajas: 1,
      embalaje: "carton",
      ciudadId: "maracay",
    });
    expect(cot.precioBase).toBe(1 * CONFIG.tarifaBaseCBM);
  });

  // ─────────────────────────────────────────────────────────────────
  // Override de tarifa CBM (el cliente edita la tarifa estándar)
  // ─────────────────────────────────────────────────────────────────
  it("usa tarifaCBMOverride cuando se provee un valor válido", () => {
    const cot = calcularEnvioLCL({
      largoCm: 100,
      anchoCm: 100,
      altoCm: 100,
      pesoKg: 100,
      cantidadCajas: 1,
      embalaje: "carton",
      ciudadId: "maracay",
      tarifaCBMOverride: 650,
    });
    expect(cot.precioBase).toBe(650); // 1 CBM × $650
    expect(cot.total).toBe(650);
  });

  it("ignora tarifaCBMOverride si es 0 o negativo, cae al default", () => {
    const cot = calcularEnvioLCL({
      largoCm: 100,
      anchoCm: 100,
      altoCm: 100,
      pesoKg: 100,
      cantidadCajas: 1,
      embalaje: "carton",
      ciudadId: "maracay",
      tarifaCBMOverride: 0, // inválido
    });
    expect(cot.precioBase).toBe(CONFIG.tarifaBaseCBM); // fallback
  });
});

describe("whatsappTextFromCotizacion", () => {
  it("genera un mensaje con todos los datos relevantes", () => {
    const input = {
      largoCm: 60,
      anchoCm: 40,
      altoCm: 50,
      pesoKg: 100,
      cantidadCajas: 2,
      embalaje: "carton" as const,
      ciudadId: "caracas",
    };
    const cot = calcularEnvioLCL(input);
    const text = whatsappTextFromCotizacion(cot, input);

    expect(text).toContain("DTD Cargo");
    expect(text).toContain("60");
    expect(text).toContain("40");
    expect(text).toContain("50");
    expect(text).toContain("100 kg");
    expect(text).toContain("Caracas");
    expect(text).toContain(`US$${cot.total.toFixed(2)}`);
  });
});
