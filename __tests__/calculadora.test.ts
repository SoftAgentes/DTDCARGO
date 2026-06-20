import { describe, it, expect } from "vitest";
import {
  CONFIG,
  CIUDADES,
  DEFAULT_PARAMS,
  calcularEnvioLCL,
  cbmFromDimensions,
  whatsappTextFromCotizacion,
  sanitizeDecimalText,
  parseDecimalInput,
  type CalcParams,
} from "@/lib/calculadora";

/**
 * Tests del cálculo de cotización LCL DDP.
 *
 * Modelo (densidad reactivada · founder 2026-06-20): el cliente ingresa CBM + peso.
 * - Precio = CBM × tarifaBase + recargo por DENSIDAD: el peso que excede
 *   pesoIncluidoKg (500) por CBM se cobra a recargoExcedenteKg ($1) por kg
 *   (configurable desde el ERP). Sobre pesoMaxKg (600) por CBM la UI avisa
 *   "demasiado denso → FCL"; el cálculo NO setea alerta (el precio igual se ve).
 * - Tope ABSOLUTO de peso: > 27.000 kg → deriva al asesor.
 * - Tope de volumen: > 68 CBM → deriva al asesor (FCL).
 * - Destinos: Valencia (descuento), Maracay/Caracas (casco), fuera del casco (km × $)
 * - Embalaje: estándar (0) vs especial (+$50)
 * - Baterías: ×1.5 sobre el flete
 * - Carga especial/peligrosa → no cotiza, deriva al asesor
 * - Validación: carga inválida (CBM/peso <= 0), ciudad inválida
 */
describe("calcularEnvioLCL", () => {
  // Caso normal: 1 CBM, 400 kg, Valencia, estándar.
  // Regla actualizada 2026-06-04: Valencia ya NO tiene descuento de sede
  // (descuentoValencia default = 0). El mecanismo sigue (configurable), pero
  // por default Valencia cobra igual que el resto del casco.
  it("calcula una carga normal a Valencia sin descuento de sede (default 0)", () => {
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
    expect(cot.descuentoSede).toBe(0); // sin descuento (regla actualizada)
    expect(cot.total).toBe(800); // sin rebaja
    expect(cot.alerta).toBeUndefined();
  });

  // Densidad reactivada (2026-06-20): 1 CBM @ 600 kg → density 600 > pesoIncluidoKg
  // (500) → recargo (600 − 500) × $1 = $100. 600 no supera pesoMaxKg (600) → sin
  // aviso "demasiado denso" y sin alerta (el precio se ve).
  it("aplica recargo por densidad cuando el peso excede pesoIncluidoKg/CBM", () => {
    const cot = calcularEnvioLCL({
      cbmTotal: 1,
      pesoKg: 600,
      embalaje: "estandar",
      ciudadId: "caracas",
    });

    expect(cot.cbm).toBe(1);
    expect(cot.densidadKgM3).toBe(600);
    expect(cot.precioBase).toBe(800);
    expect(cot.recargoExcedente).toBe(100); // (600 − 500) × $1
    expect(cot.recargoCiudad).toBe(0); // Caracas es casco
    expect(cot.total).toBe(900); // 800 + 100
    expect(cot.alerta).toBeUndefined();
  });

  // Carga MUY densa (0,3 CBM @ 1000 kg): recargo sobre lo que excede 500 kg/CBM.
  // Sin alerta → el precio se ve (la UI muestra el aviso "demasiado denso").
  it("una carga muy densa (0,3 CBM @ 1000 kg) cobra recargo y NO oculta el precio", () => {
    const cot = calcularEnvioLCL({
      cbmTotal: 0.3,
      pesoKg: 1000, // ~3333 kg/CBM
      embalaje: "estandar",
      ciudadId: "caracas",
    });

    expect(cot.alerta).toBeUndefined();
    expect(cot.precioBase).toBe(240); // 0.3 × 800
    expect(cot.recargoExcedente).toBe(850); // (1000 − 0.3×500) × $1 = 850
    expect(cot.total).toBe(1090); // 240 + 850
  });

  // 1 CBM @ 800 kg (density 800 > pesoMaxKg 600): la UI avisa "demasiado denso →
  // FCL", pero el cálculo NO setea alerta → el precio se ve, con el recargo.
  it("carga ultra densa: cobra recargo y NO setea alerta (el precio se ve)", () => {
    const cot = calcularEnvioLCL({
      cbmTotal: 1,
      pesoKg: 800,
      embalaje: "estandar",
      ciudadId: "caracas",
    });

    expect(cot.alerta).toBeUndefined();
    expect(cot.recargoExcedente).toBe(300); // (800 − 500) × $1
    expect(cot.total).toBe(1100); // 800 + 300
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

  // Límite de contenedor por CBM: > 68 m³ → más que un contenedor, deriva al asesor
  it("deriva al asesor cuando el CBM total supera 68", () => {
    const cot = calcularEnvioLCL({
      cbmTotal: 70, // > 68
      pesoKg: 5000,
      embalaje: "estandar",
      ciudadId: "caracas",
    });
    expect(cot.alerta?.tipo).toBe("contenedor_excedido");
    expect(cot.alerta?.mensaje).toContain("más que un contenedor");
    expect(cot.total).toBe(0);
  });

  it("68 CBM exacto NO dispara el límite de contenedor", () => {
    const cot = calcularEnvioLCL({
      cbmTotal: 68, // en el límite, válido
      pesoKg: 5000,
      embalaje: "estandar",
      ciudadId: "caracas",
    });
    expect(cot.alerta?.tipo).not.toBe("contenedor_excedido");
    expect(cot.total).toBeGreaterThan(0);
  });

  // Límite de contenedor por peso: > 27.000 kg → deriva al asesor
  it("deriva al asesor cuando el peso supera 27.000 kg", () => {
    const cot = calcularEnvioLCL({
      cbmTotal: 50, // dentro de límite de CBM
      pesoKg: 27001, // > 27.000
      embalaje: "estandar",
      ciudadId: "caracas",
    });
    expect(cot.alerta?.tipo).toBe("peso_contenedor_excedido");
    expect(cot.alerta?.mensaje).toContain("peso permitido por contenedor");
    expect(cot.total).toBe(0);
  });

  it("27.000 kg exacto NO dispara el límite de peso de contenedor", () => {
    const cot = calcularEnvioLCL({
      cbmTotal: 50,
      pesoKg: 27000, // en el límite, válido
      embalaje: "estandar",
      ciudadId: "caracas",
    });
    expect(cot.alerta?.tipo).not.toBe("peso_contenedor_excedido");
  });

  it("el límite de CBM prima sobre el de peso si ambos exceden", () => {
    const cot = calcularEnvioLCL({
      cbmTotal: 80, // > 68
      pesoKg: 30000, // > 27.000
      embalaje: "estandar",
      ciudadId: "caracas",
    });
    expect(cot.alerta?.tipo).toBe("contenedor_excedido");
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

// ── Fase 3 Slice A · reglas configurables vía CalcParams ──────────────
// El 2º arg de calcularEnvioLCL son las reglas escalares reales (de
// /studio/tarifas › Parámetros). Default = DEFAULT_PARAMS (= CONFIG), por eso
// todos los tests de arriba siguen pasando sin tocarse.
describe("calcularEnvioLCL con params configurables", () => {
  const withParams = (over: Partial<CalcParams>): CalcParams => ({
    ...DEFAULT_PARAMS,
    ...over,
  });

  it("DEFAULT_PARAMS reproduce exactamente el comportamiento de CONFIG", () => {
    const input = {
      cbmTotal: 1,
      pesoKg: 600,
      embalaje: "especial" as const,
      ciudadId: "barquisimeto",
      bateria: true,
    };
    const sinParams = calcularEnvioLCL(input);
    const conDefault = calcularEnvioLCL(input, DEFAULT_PARAMS);
    expect(conDefault).toEqual(sinParams);
  });

  // Densidad reactivada (2026-06-20): pesoIncluidoKg + recargoExcedenteKg definen
  // el recargo por densidad y son configurables desde el ERP. pesoMaxKg solo
  // alimenta el aviso "demasiado denso" de la UI (no entra al cálculo del recargo).
  it("USA params.pesoIncluidoKg como umbral del recargo por densidad", () => {
    const cot = calcularEnvioLCL(
      { cbmTotal: 1, pesoKg: 400, embalaje: "estandar", ciudadId: "caracas" },
      withParams({ pesoIncluidoKg: 300 }), // density 400 > 300 → cobra
    );
    expect(cot.recargoExcedente).toBe(100); // (400 − 300) × $1
    expect(cot.total).toBe(900); // 800 + 100
  });

  it("USA params.recargoExcedenteKg ($/kg del excedente, configurable en el ERP)", () => {
    const cot = calcularEnvioLCL(
      { cbmTotal: 1, pesoKg: 600, embalaje: "estandar", ciudadId: "caracas" },
      withParams({ recargoExcedenteKg: 2 }), // (600 − 500) × $2
    );
    expect(cot.recargoExcedente).toBe(200);
    expect(cot.total).toBe(1000);
  });

  it("pesoMaxKg no entra al cálculo del recargo (solo al aviso de la UI)", () => {
    const cot = calcularEnvioLCL(
      { cbmTotal: 1, pesoKg: 650, embalaje: "estandar", ciudadId: "caracas" },
      withParams({ pesoMaxKg: 700 }),
    );
    // El recargo es sobre pesoIncluidoKg (500): (650 − 500) × $1 = 150.
    expect(cot.recargoExcedente).toBe(150);
    expect(cot.alerta).toBeUndefined(); // el cálculo nunca setea alerta de densidad
    expect(cot.total).toBe(950);
  });

  it("usa params.descuentoValencia", () => {
    const cot = calcularEnvioLCL(
      { cbmTotal: 1, pesoKg: 400, embalaje: "estandar", ciudadId: "valencia" },
      withParams({ descuentoValencia: 80 }),
    );
    expect(cot.descuentoSede).toBe(-80);
    expect(cot.total).toBe(720); // 800 − 80
  });

  it("usa params.recargoEmbalajeEspecial", () => {
    const cot = calcularEnvioLCL(
      { cbmTotal: 1, pesoKg: 400, embalaje: "especial", ciudadId: "caracas" },
      withParams({ recargoEmbalajeEspecial: 75 }),
    );
    expect(cot.recargoEmbalaje).toBe(75);
    expect(cot.total).toBe(875);
  });

  it("usa params.recargoBateriaMult", () => {
    const cot = calcularEnvioLCL(
      {
        cbmTotal: 1,
        pesoKg: 400,
        embalaje: "estandar",
        ciudadId: "caracas",
        bateria: true,
      },
      withParams({ recargoBateriaMult: 2 }),
    );
    expect(cot.recargoBateria).toBe(800); // 800 × 2 − 800
    expect(cot.total).toBe(1600);
  });

  it("usa params.thresholdCascoKm y tarifaKmFueraCasco", () => {
    // Casco a 100 km, $2/km → Barquisimeto (220) paga (220 − 100) × 2.
    const cot = calcularEnvioLCL(
      { cbmTotal: 1, pesoKg: 400, embalaje: "estandar", ciudadId: "barquisimeto" },
      withParams({ thresholdCascoKm: 100, tarifaKmFueraCasco: 2 }),
    );
    expect(cot.recargoCiudad).toBe(240); // 120 km × $2
    expect(cot.total).toBe(1040);
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

    expect(text).toContain("calculadora");
    expect(text).toContain("Esto es lo que estoy calculando");
    expect(text).toContain("2 m³");
    expect(text).toContain("100 kg");
    expect(text).toContain("Caracas");
    expect(text).toContain(`US$${cot.total.toFixed(2)}`);
  });

  it("para una carga que deriva al asesor, el mensaje pide cotización a medida (sin precio)", () => {
    const input = {
      cbmTotal: 70, // supera el contenedor → alerta
      pesoKg: 5000,
      embalaje: "estandar" as const,
      ciudadId: "caracas",
    };
    const cot = calcularEnvioLCL(input);
    const text = whatsappTextFromCotizacion(cot, input);
    expect(text).toContain("necesito asesoría");
    expect(text).toContain("cotización a medida");
    expect(text).toContain("70 m³"); // los datos calculados igual viajan
    expect(text).not.toContain("Estimado web"); // no muestra un precio inválido
  });
});

// ── Entrada decimal de los campos del form (coma o punto) ─────────────
// Regresión: la calculadora "solo tomaba enteros". Causa: el input numérico
// controlado comía el separador decimal y rechazaba la coma (es-VE).
describe("sanitizeDecimalText", () => {
  it("deja pasar dígitos y un separador decimal mientras se tipea", () => {
    expect(sanitizeDecimalText("2")).toBe("2");
    expect(sanitizeDecimalText("2,")).toBe("2,"); // coma intermedia preservada
    expect(sanitizeDecimalText("2.")).toBe("2.");
    expect(sanitizeDecimalText("2,5")).toBe("2,5");
    expect(sanitizeDecimalText("2.5")).toBe("2.5");
  });

  it("descarta separadores extra (deja solo el primero)", () => {
    expect(sanitizeDecimalText("1.2.3")).toBe("1.23");
    expect(sanitizeDecimalText("1,2,3")).toBe("1,23");
    expect(sanitizeDecimalText("2,5.5")).toBe("2,55");
  });

  it("ignora letras y símbolos", () => {
    expect(sanitizeDecimalText("ab12,5x")).toBe("12,5");
    expect(sanitizeDecimalText("$ 800")).toBe("800");
    expect(sanitizeDecimalText("")).toBe("");
  });
});

describe("parseDecimalInput", () => {
  it("acepta coma como separador decimal (es-VE)", () => {
    expect(parseDecimalInput("2,5")).toBe(2.5);
    expect(parseDecimalInput("0,75")).toBe(0.75);
    expect(parseDecimalInput("450,25")).toBe(450.25);
  });

  it("acepta punto como separador decimal", () => {
    expect(parseDecimalInput("2.5")).toBe(2.5);
    expect(parseDecimalInput("800")).toBe(800);
  });

  it("tolera un separador final a mitad de tipeo", () => {
    expect(parseDecimalInput("2,")).toBe(2);
    expect(parseDecimalInput("2.")).toBe(2);
  });

  it("devuelve NaN cuando no hay número (el llamador decide el fallback)", () => {
    expect(parseDecimalInput("")).toBeNaN();
    expect(parseDecimalInput(",")).toBeNaN();
    expect(parseDecimalInput("abc")).toBeNaN();
  });
});

// ── CBM a partir de medidas (panel "¿No sabes tu CBM?") ───────────────
// CBM por caja = (alto × ancho × largo) / 1.000.000 ; total × cantidad.
describe("cbmFromDimensions", () => {
  it("calcula el caso de la spec: 40×30×60 cm × 10 cajas → 0,72 CBM", () => {
    // 40×30×60 = 72.000 cm³ → 0,072 m³/caja × 10 = 0,72 m³.
    expect(cbmFromDimensions(40, 30, 60, 10)).toBe(0.72);
  });

  it("con 1 caja devuelve el CBM de una sola caja", () => {
    expect(cbmFromDimensions(40, 30, 60, 1)).toBe(0.072);
    expect(cbmFromDimensions(100, 100, 100, 1)).toBe(1); // 1 m³
  });

  it("escala linealmente con la cantidad de cajas", () => {
    expect(cbmFromDimensions(50, 50, 50, 4)).toBe(0.5); // 0,125 × 4
  });

  it("devuelve 0 si cualquier medida o la cantidad es inválida", () => {
    expect(cbmFromDimensions(0, 30, 60, 10)).toBe(0); // alto 0
    expect(cbmFromDimensions(40, 0, 60, 10)).toBe(0); // ancho 0
    expect(cbmFromDimensions(40, 30, 0, 10)).toBe(0); // largo 0
    expect(cbmFromDimensions(40, 30, 60, 0)).toBe(0); // cajas 0
    expect(cbmFromDimensions(-40, 30, 60, 10)).toBe(0); // negativo
    expect(cbmFromDimensions(NaN, 30, 60, 10)).toBe(0); // NaN
    expect(cbmFromDimensions(40, 30, 60, Number.POSITIVE_INFINITY)).toBe(0); // no finito
  });

  it("el CBM derivado alimenta el mismo motor (con recargo por densidad)", () => {
    // 40×30×60×10 = 0,72 CBM → base = 0,72 × 800 = 576. Peso alto → recargo.
    const cbm = cbmFromDimensions(40, 30, 60, 10);
    const cot = calcularEnvioLCL({
      cbmTotal: cbm,
      pesoKg: 5000,
      embalaje: "estandar",
      ciudadId: "caracas",
    });
    expect(cot.cbm).toBe(0.72);
    expect(cot.precioBase).toBe(576);
    expect(cot.recargoExcedente).toBe(4640); // (5000 − 0.72×500) × $1 = 4640
    expect(cot.total).toBe(5216); // 576 + 4640
  });
});
