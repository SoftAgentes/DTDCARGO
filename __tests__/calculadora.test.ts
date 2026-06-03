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
 * Modelo: el cliente ingresa CBM total + peso (no dimensiones).
 * - Carga normal (densidad <= 500 kg/CBM) → solo CBM × tarifaBase
 * - Excedente de peso (500-600 kg/CBM) → suma recargo
 * - Carga ultradensa (>600 kg/CBM) → alerta + estimado igual
 * - Destinos: Valencia (descuento), Maracay/Caracas (casco), fuera del casco (km × $)
 * - Embalaje: estándar (0) vs especial (+$50)
 * - Baterías: ×1.5 sobre el flete
 * - Carga especial/peligrosa → no cotiza, deriva al asesor
 * - Validación: carga inválida (CBM/peso <= 0), ciudad inválida
 */
describe("calcularEnvioLCL", () => {
  // Caso normal: 1 CBM, 400 kg, Valencia, estándar (con descuento sede)
  it("calcula correctamente una carga normal a Valencia (con descuento sede)", () => {
    const cot = calcularEnvioLCL({
      cbmTotal: 1,
      pesoKg: 400, // < 500 kg/CBM → sin excedente
      embalaje: "estandar",
      ciudadId: "valencia",
    });

    expect(cot.cbm).toBe(1);
    expect(cot.densidadKgM3).toBe(400);
    expect(cot.precioBase).toBe(800);
    expect(cot.recargoExcedente).toBe(0);
    expect(cot.recargoCiudad).toBe(0); // Valencia es casco
    expect(cot.recargoEmbalaje).toBe(0);
    expect(cot.recargoBateria).toBe(0);
    expect(cot.descuentoSede).toBe(-50);
    expect(cot.total).toBe(750); // 800 - 50
    expect(cot.alerta).toBeUndefined();
  });

  // Excedente de peso: 1 CBM, 600 kg, Caracas (densidad = 600 kg/CBM, en el límite)
  it("aplica recargo de excedente cuando supera 500 kg/CBM", () => {
    const cot = calcularEnvioLCL({
      cbmTotal: 1,
      pesoKg: 600,
      embalaje: "estandar",
      ciudadId: "caracas",
    });

    expect(cot.cbm).toBe(1);
    expect(cot.densidadKgM3).toBe(600);
    expect(cot.precioBase).toBe(800);
    expect(cot.recargoExcedente).toBe(100); // 100 kg × $1
    expect(cot.recargoCiudad).toBe(0); // Caracas es casco
    expect(cot.total).toBe(900);
    expect(cot.alerta).toBeUndefined();
  });

  // Carga ultradensa: 1 CBM, 800 kg → alerta peso_excedido
  it("muestra alerta cuando la densidad supera 600 kg/CBM", () => {
    const cot = calcularEnvioLCL({
      cbmTotal: 1,
      pesoKg: 800, // 800 kg/CBM > 600 → alerta
      embalaje: "estandar",
      ciudadId: "caracas",
    });

    expect(cot.alerta).toBeDefined();
    expect(cot.alerta?.tipo).toBe("peso_excedido");
    expect(cot.alerta?.mensaje).toContain("FCL");
  });

  // Recargo por ciudad fuera del casco: Barquisimeto 220 km → 20 km × $1 = $20
  it("aplica recargo por km cuando la ciudad está fuera del casco central", () => {
    const cot = calcularEnvioLCL({
      cbmTotal: 1,
      pesoKg: 400,
      embalaje: "estandar",
      ciudadId: "barquisimeto", // 220 km, fuera del casco (threshold 200)
    });

    expect(cot.recargoCiudad).toBe(20); // 220 - 200 = 20 km × $1
    expect(cot.total).toBe(820); // 800 + 20
  });

  // Recargo por embalaje especial (+$50)
  it("aplica recargo de $50 cuando embalaje es especial (madera/paleta)", () => {
    const cot = calcularEnvioLCL({
      cbmTotal: 1,
      pesoKg: 400,
      embalaje: "especial",
      ciudadId: "caracas",
    });

    expect(cot.recargoEmbalaje).toBe(50);
    expect(cot.total).toBe(850); // 800 + 50
  });

  // CBM total fraccionario
  it("calcula con CBM total fraccionario", () => {
    const cot = calcularEnvioLCL({
      cbmTotal: 0.5,
      pesoKg: 200,
      embalaje: "estandar",
      ciudadId: "caracas",
    });

    expect(cot.cbm).toBe(0.5);
    expect(cot.precioBase).toBe(400); // 0.5 × 800
  });

  // Destino "Casco central" (agrupado): sin recargo y SIN descuento Valencia
  it("casco-central no tiene recargo por km ni descuento de sede", () => {
    const cot = calcularEnvioLCL({
      cbmTotal: 1,
      pesoKg: 400,
      embalaje: "estandar",
      ciudadId: "casco-central",
    });

    expect(cot.recargoCiudad).toBe(0);
    expect(cot.descuentoSede).toBe(0); // no es "valencia" explícita
    expect(cot.total).toBe(800);
  });

  // Baterías: multiplican el flete ×1.5
  it("aplica el multiplicador de baterías (×1.5) sobre el flete", () => {
    const cot = calcularEnvioLCL({
      cbmTotal: 1,
      pesoKg: 400,
      embalaje: "estandar",
      ciudadId: "caracas",
      bateria: true,
    });

    // flete antes de batería = 800; con batería = 1200
    expect(cot.recargoBateria).toBe(400);
    expect(cot.total).toBe(1200);
  });

  // Carga especial / peligrosa → no cotiza, deriva al asesor
  it("deriva al asesor cuando la carga es especial/peligrosa", () => {
    const cot = calcularEnvioLCL({
      cbmTotal: 1,
      pesoKg: 400,
      embalaje: "estandar",
      ciudadId: "caracas",
      cargaEspecial: true,
    });

    expect(cot.alerta?.tipo).toBe("carga_especial");
    expect(cot.total).toBe(0);
  });

  // Validación: ciudad inválida
  it("retorna alerta cuando la ciudad no existe", () => {
    const cot = calcularEnvioLCL({
      cbmTotal: 1,
      pesoKg: 400,
      embalaje: "estandar",
      ciudadId: "marte", // no existe
    });

    expect(cot.alerta).toBeDefined();
    expect(cot.alerta?.tipo).toBe("ciudad_invalida");
    expect(cot.total).toBe(0);
  });

  // Validación: CBM o peso <= 0
  it("retorna alerta cuando el CBM total o el peso son <= 0", () => {
    const cot = calcularEnvioLCL({
      cbmTotal: 0,
      pesoKg: 400,
      embalaje: "estandar",
      ciudadId: "valencia",
    });

    expect(cot.alerta?.tipo).toBe("carga_invalida");
    expect(cot.total).toBe(0);
  });

  // Sanity: las ciudades del casco no tienen recargo por km
  it("las ciudades del casco central nunca tienen recargo por km", () => {
    const ciudadesCasco = CIUDADES.filter((c) => c.casco);
    for (const c of ciudadesCasco) {
      const cot = calcularEnvioLCL({
        cbmTotal: 1,
        pesoKg: 400,
        embalaje: "estandar",
        ciudadId: c.id,
      });
      expect(cot.recargoCiudad).toBe(0);
    }
  });

  // CONFIG es la fuente de verdad
  it("respeta CONFIG.tarifaBaseCBM como base del cálculo", () => {
    const cot = calcularEnvioLCL({
      cbmTotal: 1,
      pesoKg: 100,
      embalaje: "estandar",
      ciudadId: "maracay",
    });
    expect(cot.precioBase).toBe(1 * CONFIG.tarifaBaseCBM);
  });

  // Override de tarifa CBM
  it("usa tarifaCBMOverride cuando se provee un valor válido", () => {
    const cot = calcularEnvioLCL({
      cbmTotal: 1,
      pesoKg: 100,
      embalaje: "estandar",
      ciudadId: "maracay",
      tarifaCBMOverride: 650,
    });
    expect(cot.precioBase).toBe(650); // 1 CBM × $650
    expect(cot.total).toBe(650);
  });

  it("ignora tarifaCBMOverride si es 0 o negativo, cae al default", () => {
    const cot = calcularEnvioLCL({
      cbmTotal: 1,
      pesoKg: 100,
      embalaje: "estandar",
      ciudadId: "maracay",
      tarifaCBMOverride: 0, // inválido
    });
    expect(cot.precioBase).toBe(CONFIG.tarifaBaseCBM); // fallback
  });

  // ── Piso mínimo: minChargeOverride (mínimo LCL real) vs CONFIG.minimoFacturable ──

  it("aplica minChargeOverride como piso cuando el total queda por debajo", () => {
    const cot = calcularEnvioLCL({
      cbmTotal: 0.1, // base = 0.1 × 800 = 80
      pesoKg: 20,
      embalaje: "estandar",
      ciudadId: "caracas",
      minChargeOverride: 380, // mínimo LCL real
    });
    expect(cot.precioBase).toBe(80);
    expect(cot.total).toBe(380); // sube al piso real
    expect(cot.ajusteMinimo).toBe(300); // 380 − 80, para que el desglose cuadre
    // El desglose reconcilia: Σ ítems + ajusteMinimo = total.
    const suma =
      cot.precioBase +
      cot.recargoExcedente +
      cot.recargoCiudad +
      cot.recargoEmbalaje +
      cot.recargoBateria +
      cot.descuentoSede +
      cot.ajusteMinimo;
    expect(suma).toBeCloseTo(cot.total, 2);
  });

  it("cae a CONFIG.minimoFacturable cuando NO hay minChargeOverride", () => {
    const cot = calcularEnvioLCL({
      cbmTotal: 0.01, // base = 8
      pesoKg: 2,
      embalaje: "estandar",
      ciudadId: "caracas",
    });
    expect(cot.total).toBe(CONFIG.minimoFacturable); // 50
  });

  it("minChargeOverride no muerde cuando el total ya lo supera", () => {
    const cot = calcularEnvioLCL({
      cbmTotal: 1, // base = 800
      pesoKg: 400,
      embalaje: "estandar",
      ciudadId: "caracas",
      minChargeOverride: 380,
    });
    expect(cot.total).toBe(800); // sin tocar
    expect(cot.ajusteMinimo).toBe(0); // el piso no muerde → sin ajuste
  });

  it("ignora minChargeOverride si es 0 o negativo, cae al piso de CONFIG", () => {
    const cot = calcularEnvioLCL({
      cbmTotal: 0.01, // base = 8
      pesoKg: 2,
      embalaje: "estandar",
      ciudadId: "caracas",
      minChargeOverride: 0, // inválido
    });
    expect(cot.total).toBe(CONFIG.minimoFacturable); // 50
  });
});

describe("whatsappTextFromCotizacion", () => {
  it("genera un mensaje con todos los datos relevantes", () => {
    const input = {
      cbmTotal: 2,
      pesoKg: 100,
      embalaje: "estandar" as const,
      ciudadId: "caracas",
    };
    const cot = calcularEnvioLCL(input);
    const text = whatsappTextFromCotizacion(cot, input);

    expect(text).toContain("DTD Cargo");
    expect(text).toContain("2 m³");
    expect(text).toContain("100 kg");
    expect(text).toContain("Caracas");
    expect(text).toContain(`US$${cot.total.toFixed(2)}`);
  });
});
