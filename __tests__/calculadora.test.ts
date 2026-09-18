import { describe, it, expect } from "vitest";
import {
  CONFIG,
  CIUDADES,
  DEFAULT_PARAMS,
  CONSOLIDADO_CBM_RATE,
  CONSOLIDADO_DESTINO,
  CONSOLIDADO_CBM_MINIMO,
  CONSOLIDADO_BL_COSTO_MAX,
  CONSOLIDADO_MIN_CBM_MENSAJE,
  calcularEnvioLCL,
  cbmFromDimensions,
  cbmFromDimensionsEnUnidad,
  CM_POR_UNIDAD,
  FT3_POR_CBM,
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
 *   pesoIncluidoKg (1.000) por CBM se cobra a recargoExcedenteKg ($2) por kg
 *   (configurable desde el ERP). El recargo es CONTINUO sin tope: `pesoMaxKg`
 *   NO entra al cálculo ni deriva al asesor (founder 2026-07-06); el precio se ve.
 * - Tope ABSOLUTO de peso: > 27.000 kg → deriva al asesor.
 * - Tope de volumen: > 68 CBM → deriva al asesor (FCL).
 * - Destinos: Valencia (descuento), Maracay/Caracas (casco), fuera del casco (km × $)
 * - Embalaje: estándar (0) vs especial (+$50)
 * - Baterías: ×1.3 sobre el flete
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
      pesoKg: 400, // < 1.000 kg/CBM → sin excedente
      embalaje: "estandar",
      ciudadId: "valencia",
    });

    expect(cot.cbm).toBe(1);
    expect(cot.densidadKgM3).toBe(400);
    expect(cot.precioBase).toBe(850);
    expect(cot.recargoExcedente).toBe(0);
    expect(cot.recargoCiudad).toBe(0); // Valencia es casco
    expect(cot.recargoEmbalaje).toBe(0);
    expect(cot.recargoBateria).toBe(0);
    expect(cot.descuentoSede).toBe(0); // sin descuento (regla actualizada)
    expect(cot.total).toBe(850); // sin rebaja
    expect(cot.alerta).toBeUndefined();
  });

  // Densidad reactivada (2026-06-20): 1 CBM @ 1.200 kg → density 1.200 >
  // pesoIncluidoKg (1.000) → recargo (1.200 − 1.000) × $2 = $400. Sin alerta
  // (el precio se ve).
  it("aplica recargo por densidad cuando el peso excede pesoIncluidoKg/CBM", () => {
    const cot = calcularEnvioLCL({
      cbmTotal: 1,
      pesoKg: 1200,
      embalaje: "estandar",
      ciudadId: "caracas",
    });

    expect(cot.cbm).toBe(1);
    expect(cot.densidadKgM3).toBe(1200);
    expect(cot.precioBase).toBe(850);
    expect(cot.recargoExcedente).toBe(400); // (1200 − 1000) × $2
    expect(cot.recargoCiudad).toBe(0); // Caracas es casco
    expect(cot.total).toBe(1250); // 850 + 400
    expect(cot.alerta).toBeUndefined();
  });

  // Carga MUY densa (0,3 CBM @ 1000 kg): recargo sobre lo que excede 1.000 kg/CBM.
  // Sin alerta → el precio se ve, con el recargo por peso sumado.
  it("una carga muy densa (0,3 CBM @ 1000 kg) cobra recargo y NO oculta el precio", () => {
    const cot = calcularEnvioLCL({
      cbmTotal: 0.3,
      pesoKg: 1000, // ~3333 kg/CBM
      embalaje: "estandar",
      ciudadId: "caracas",
    });

    expect(cot.alerta).toBeUndefined();
    expect(cot.precioBase).toBe(255); // 0.3 × 850
    expect(cot.recargoExcedente).toBe(1400); // (1000 − 0.3×1000) × $2 = 1400
    expect(cot.total).toBe(1655); // 255 + 1400
  });

  // 1 CBM @ 1.800 kg: el recargo sigue CONTINUO — ya no deriva al asesor
  // (founder 2026-07-06); el cálculo NO setea alerta.
  it("carga ultra densa: cobra recargo y NO setea alerta (el precio se ve)", () => {
    const cot = calcularEnvioLCL({
      cbmTotal: 1,
      pesoKg: 1800,
      embalaje: "estandar",
      ciudadId: "caracas",
    });

    expect(cot.alerta).toBeUndefined();
    expect(cot.recargoExcedente).toBe(1600); // (1800 − 1000) × $2
    expect(cot.total).toBe(2450); // 850 + 1600
  });

  // Entrega nacional = CBM × precio del tramo (SDD-0237). Ya no hay km en la
  // cuenta: Maracaibo es Foráneo, así que 1 m³ paga $123,60 exactos.
  it("cobra la entrega como CBM × precio del tramo, no por kilómetros", () => {
    const cot = calcularEnvioLCL({
      cbmTotal: 1,
      pesoKg: 400,
      embalaje: "estandar",
      ciudadId: "maracaibo", // Foráneo
    });

    expect(cot.recargoCiudad).toBe(123.6);
    expect(cot.total).toBe(973.6); // 850 + 123,60
  });

  // El caso que motivó todo el cambio: la fórmula por km sobrecobraba +706%.
  it("REGRESIÓN — Puerto Ordaz 0,5 m³ pasó de $570 a $61,80", () => {
    const cot = calcularEnvioLCL({
      cbmTotal: 0.5,
      pesoKg: 100,
      embalaje: "estandar",
      ciudadId: "puerto-ordaz",
      minChargeOverride: 0,
    });

    // Con la fórmula vieja: (770 − 200) × $1 = $570, sin importar el volumen.
    expect(cot.recargoCiudad).toBe(61.8); // 0,5 × $123,60
  });

  // El precio escala con el volumen — que es justo lo que la fórmula por km
  // no hacía (cobraba lo mismo por 0,5 m³ que por 20).
  it("la entrega escala con el CBM", () => {
    const entrega = (cbm: number) =>
      calcularEnvioLCL({
        cbmTotal: cbm,
        pesoKg: 100,
        embalaje: "estandar",
        ciudadId: "maracaibo",
        minChargeOverride: 0,
      }).recargoCiudad;

    expect(entrega(1)).toBe(123.6);
    expect(entrega(2)).toBe(247.2);
    expect(entrega(10)).toBe(1236);
  });

  // Los tres tramos del acuerdo con el transportista.
  it("aplica los tres tramos: Centro, Foráneo y Remota", () => {
    const entrega = (ciudadId: string) =>
      calcularEnvioLCL({
        cbmTotal: 1,
        pesoKg: 100,
        embalaje: "estandar",
        ciudadId,
        minChargeOverride: 0,
      }).recargoCiudad;

    expect(entrega("puerto-cabello")).toBe(105.94); // Centro
    expect(entrega("maracaibo")).toBe(123.6); // Foráneo
    expect(entrega("margarita")).toBe(176.57); // Remota
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
    expect(cot.total).toBe(900); // 850 + 50
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
    expect(cot.precioBase).toBe(425); // 0.5 × 850
  });

  // La opción agrupada "Casco central (Valencia · Maracay · Caracas)" MURIÓ
  // (founder, 1-ago-2026): el cliente escoge SU ciudad y el sistema decide.
  it("la opción agrupada casco-central ya no existe en la lista", () => {
    expect(CIUDADES.find((c) => c.id === "casco-central")).toBeUndefined();
  });

  // Las 8 de la zona sin costo pagan $0 de entrega. No es un descuento: DTD le
  // paga ese tramo al fletero aparte y lo asume como adquisición de clientes.
  it("la zona sin costo son 8 ciudades y todas entregan en $0", () => {
    const sinCosto = CIUDADES.filter((c) => c.casco);
    expect(sinCosto.map((c) => c.id).sort()).toEqual([
      "acarigua", "barquisimeto", "caracas", "guacara",
      "maracay", "naguanagua", "san-diego", "valencia",
    ]);

    for (const ciudad of sinCosto) {
      const cot = calcularEnvioLCL({
        cbmTotal: 5,
        pesoKg: 500,
        embalaje: "estandar",
        ciudadId: ciudad.id,
        minChargeOverride: 0,
      });
      expect(cot.recargoCiudad, `${ciudad.label} debería entregar en $0`).toBe(0);
    }
  });

  // Baterías: multiplican el flete ×1.3
  it("aplica el multiplicador de baterías (×1.3) sobre el flete", () => {
    const cot = calcularEnvioLCL({
      cbmTotal: 1,
      pesoKg: 400,
      embalaje: "estandar",
      ciudadId: "caracas",
      bateria: true,
    });

    // flete antes de batería = 850; con batería = 1105
    expect(cot.recargoBateria).toBe(255);
    expect(cot.total).toBe(1105);
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

  it("27.000 kg exacto NO dispara el límite ABSOLUTO de contenedor (pero sí el tope por envío)", () => {
    const cot = calcularEnvioLCL({
      cbmTotal: 50,
      pesoKg: 27000, // en el límite absoluto del contenedor
      embalaje: "estandar",
      ciudadId: "caracas",
    });
    // No es el tope absoluto (usa `>` estricto)…
    expect(cot.alerta?.tipo).not.toBe("peso_contenedor_excedido");
    // …pero sí supera el tope de peso por envío (9.000) → deriva al asesor.
    expect(cot.alerta?.tipo).toBe("peso_envio_excedido");
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

  // Tope de peso POR ENVÍO (anti-monopolio), density-aware: deriva SOLO si es
  // pesado (> pesoMaxEnvioKg 9.000) Y denso (densidad > equilibrio ~397 kg/m³).
  it("deriva al asesor si el envío es pesado Y denso", () => {
    const cot = calcularEnvioLCL({
      cbmTotal: 20,
      pesoKg: 9001, // > 9.000 · densidad 450 > 397
      embalaje: "estandar",
      ciudadId: "caracas",
    });
    expect(cot.alerta?.tipo).toBe("peso_envio_excedido");
    expect(cot.alerta?.mensaje).toContain("a medida");
    expect(cot.total).toBe(0);
  });

  it("NO deriva un envío pesado pero LIVIANO (densidad < equilibrio)", () => {
    const cot = calcularEnvioLCL({
      cbmTotal: 40,
      pesoKg: 10000, // > 9.000 pero densidad 250 < 397 → no monopoliza el peso
      embalaje: "estandar",
      ciudadId: "caracas",
    });
    expect(cot.alerta).toBeUndefined();
    expect(cot.total).toBeGreaterThan(0);
  });

  it("9.000 kg exacto NO dispara el tope por envío (usa `>` estricto)", () => {
    const cot = calcularEnvioLCL({
      cbmTotal: 20,
      pesoKg: 9000, // en el borde
      embalaje: "estandar",
      ciudadId: "caracas",
    });
    expect(cot.alerta).toBeUndefined();
    expect(cot.total).toBeGreaterThan(0);
  });

  it("el caso 27 CBM / 27.000 kg ahora deriva al asesor (antes cotizaba $22.950)", () => {
    const cot = calcularEnvioLCL({
      cbmTotal: 27,
      pesoKg: 27000,
      embalaje: "estandar",
      ciudadId: "caracas",
    });
    expect(cot.alerta?.tipo).toBe("peso_envio_excedido");
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
      cbmTotal: 0.1, // base = 0.1 × 850 = 85
      pesoKg: 20,
      embalaje: "estandar",
      ciudadId: "caracas",
      minChargeOverride: 380, // mínimo LCL real
    });
    expect(cot.precioBase).toBe(85);
    expect(cot.total).toBe(380); // sube al piso real
    expect(cot.ajusteMinimo).toBe(295); // 380 − 85, para que el desglose cuadre
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
      cbmTotal: 1, // base = 850
      pesoKg: 400,
      embalaje: "estandar",
      ciudadId: "caracas",
      minChargeOverride: 380,
    });
    expect(cot.total).toBe(850); // sin tocar
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
  // el recargo por densidad y son configurables desde el ERP. pesoMaxKg ya no se
  // usa en el calc ni en la UI del recargo (founder 2026-07-06: cobro continuo).
  it("USA params.pesoIncluidoKg como umbral del recargo por densidad", () => {
    const cot = calcularEnvioLCL(
      { cbmTotal: 1, pesoKg: 400, embalaje: "estandar", ciudadId: "caracas" },
      withParams({ pesoIncluidoKg: 300 }), // density 400 > 300 → cobra
    );
    expect(cot.recargoExcedente).toBe(200); // (400 − 300) × $2
    expect(cot.total).toBe(1050); // 850 + 200
  });

  it("USA params.recargoExcedenteKg ($/kg del excedente, configurable en el ERP)", () => {
    const cot = calcularEnvioLCL(
      { cbmTotal: 1, pesoKg: 1600, embalaje: "estandar", ciudadId: "caracas" },
      // $3/kg ≠ el default ($2): si el motor ignorara el param, daría 1.200.
      withParams({ recargoExcedenteKg: 3 }), // (1600 − 1000) × $3
    );
    expect(cot.recargoExcedente).toBe(1800);
    expect(cot.total).toBe(2650);
  });

  it("USA params.pesoMaxEnvioKg como tope para derivar al asesor", () => {
    const bajo = calcularEnvioLCL(
      { cbmTotal: 20, pesoKg: 12000, embalaje: "estandar", ciudadId: "caracas" },
      withParams({ pesoMaxEnvioKg: 15000 }), // 12.000 < 15.000 → cotiza
    );
    expect(bajo.alerta).toBeUndefined();
    expect(bajo.total).toBeGreaterThan(0);

    const alto = calcularEnvioLCL(
      { cbmTotal: 20, pesoKg: 12000, embalaje: "estandar", ciudadId: "caracas" },
      withParams({ pesoMaxEnvioKg: 8000 }), // 12.000 > 8.000 → deriva
    );
    expect(alto.alerta?.tipo).toBe("peso_envio_excedido");
  });

  it("cobro por densidad continuo sin tope (1.300 kg/CBM sí cotiza)", () => {
    const cot = calcularEnvioLCL({
      cbmTotal: 1,
      pesoKg: 1300,
      embalaje: "estandar",
      ciudadId: "caracas",
    });
    // El recargo es sobre pesoIncluidoKg (1.000): (1300 − 1000) × $2 = 600.
    expect(cot.recargoExcedente).toBe(600);
    expect(cot.alerta).toBeUndefined(); // el cálculo nunca setea alerta de densidad
    expect(cot.total).toBe(1450);
  });

  it("usa params.descuentoValencia", () => {
    const cot = calcularEnvioLCL(
      { cbmTotal: 1, pesoKg: 400, embalaje: "estandar", ciudadId: "valencia" },
      withParams({ descuentoValencia: 80 }),
    );
    expect(cot.descuentoSede).toBe(-80);
    expect(cot.total).toBe(770); // 850 − 80
  });

  it("usa params.recargoEmbalajeEspecial", () => {
    const cot = calcularEnvioLCL(
      { cbmTotal: 1, pesoKg: 400, embalaje: "especial", ciudadId: "caracas" },
      withParams({ recargoEmbalajeEspecial: 75 }),
    );
    expect(cot.recargoEmbalaje).toBe(75);
    expect(cot.total).toBe(925);
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
    expect(cot.recargoBateria).toBe(850); // 850 × 2 − 850
    expect(cot.total).toBe(1700);
  });

  // thresholdCascoKm y tarifaKmFueraCasco quedaron LEGACY (SDD-0237): siguen en
  // CalcParams porque la columna vive en calculator_settings, pero ya no mueven
  // ni un centavo. Este test lo congela — si alguien los vuelve a conectar al
  // precio, se pone rojo.
  it("thresholdCascoKm y tarifaKmFueraCasco ya NO afectan el precio", () => {
    const input = {
      cbmTotal: 1,
      pesoKg: 400,
      embalaje: "estandar" as const,
      ciudadId: "maracaibo",
    };
    const normal = calcularEnvioLCL(input);
    const conParamsAbsurdos = calcularEnvioLCL(
      input,
      withParams({ thresholdCascoKm: 0, tarifaKmFueraCasco: 99 }),
    );

    expect(conParamsAbsurdos.recargoCiudad).toBe(normal.recargoCiudad);
    expect(conParamsAbsurdos.recargoCiudad).toBe(123.6);
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

  it("la misma caja da el mismo CBM en las tres unidades", () => {
    // 60 × 40 × 50 cm es la MISMA caja que 0,6 × 0,4 × 0,5 m. Si estas dos
    // divergen, la FAQ y la calculadora empiezan a contradecirse.
    const enCm = cbmFromDimensionsEnUnidad(50, 40, 60, 1, "cm");
    const enM = cbmFromDimensionsEnUnidad(0.5, 0.4, 0.6, 1, "m");
    expect(enCm).toBe(0.12);
    expect(enM).toBe(enCm);
  });

  it("convierte pulgadas a la base de centímetros", () => {
    // 24 × 16 × 20 in = 60,96 × 40,64 × 50,8 cm → 0,12585 m³, que roundCBM
    // sube a 0,126 (redondea hacia arriba, a favor del cobro).
    expect(cbmFromDimensionsEnUnidad(20, 16, 24, 1, "in")).toBe(0.126);
  });

  it("centímetro es la base: su factor es 1 y no altera el número", () => {
    expect(CM_POR_UNIDAD.cm).toBe(1);
    expect(cbmFromDimensionsEnUnidad(40, 30, 60, 10, "cm")).toBe(
      cbmFromDimensions(40, 30, 60, 10),
    );
  });

  it("hereda el rechazo de medidas inválidas", () => {
    expect(cbmFromDimensionsEnUnidad(0, 40, 60, 1, "m")).toBe(0);
    expect(cbmFromDimensionsEnUnidad(50, 40, 60, 0, "in")).toBe(0);
    expect(cbmFromDimensionsEnUnidad(NaN, 40, 60, 1, "cm")).toBe(0);
  });

  it("el separador decimal no cambia el resultado (coma o punto)", () => {
    // El visitante puede escribir en español o en inglés; "0,6" y "0.6" tienen
    // que ser el mismo número. Es el camino real del widget de la FAQ:
    // texto → parseDecimalInput → cbmFromDimensionsEnUnidad.
    const desdeTexto = (a: string, an: string, l: string) =>
      cbmFromDimensionsEnUnidad(
        parseDecimalInput(a),
        parseDecimalInput(an),
        parseDecimalInput(l),
        1,
        "m",
      );
    expect(desdeTexto("0,5", "0,4", "0,6")).toBe(0.12);
    expect(desdeTexto("0.5", "0.4", "0.6")).toBe(0.12);
    expect(desdeTexto("0.5", "0,4", "0.6")).toBe(0.12); // mezclados
  });

  it("FT3_POR_CBM convierte a pies cúbicos", () => {
    expect(FT3_POR_CBM).toBe(35.3147);
    // 1 m³ ≈ 35,31 ft³ — el dato que ve el importador que trabaja en medidas
    // gringas.
    expect(Number((1 * FT3_POR_CBM).toFixed(2))).toBe(35.31);
  });

  it("el CBM derivado alimenta el mismo motor (con recargo por densidad)", () => {
    // 40×30×60×10 = 0,72 CBM → base = 0,72 × 850 = 612. Peso alto → recargo.
    const cbm = cbmFromDimensions(40, 30, 60, 10);
    const cot = calcularEnvioLCL({
      cbmTotal: cbm,
      pesoKg: 5000,
      embalaje: "estandar",
      ciudadId: "caracas",
    });
    expect(cot.cbm).toBe(0.72);
    expect(cot.precioBase).toBe(612);
    expect(cot.recargoExcedente).toBe(8560); // (5000 − 0.72×1000) × $2 = 8560
    expect(cot.total).toBe(9172); // 612 + 8560
  });
});

/**
 * LCL CONSOLIDADO (pestaña B de /tarifas · founder 2026-07-20).
 *
 * Mismo motor, mismos recargos que el puerta a puerta — cambia la tarifa base
 * (580 USD/CBM), que no hay ciudad de destino (llega hasta puerto, con BL
 * propio) y que tiene una PUERTA DE VOLUMEN propia: por debajo de 1 m³ no
 * cotiza y deriva al asesor (el BL propio es un fijo de hasta USD 300 y la
 * carga chica termina abandonada en el almacén fiscal).
 */
describe("LCL Consolidado · tarifa 580/CBM + mismos recargos", () => {
  const base = {
    modo: "consolidado" as const,
    embalaje: "estandar" as const,
    ciudadId: CONSOLIDADO_DESTINO.id,
    tarifaCBMOverride: CONSOLIDADO_CBM_RATE,
  };
  const ciudades = [CONSOLIDADO_DESTINO];

  it("la tarifa base del consolidado es 580 USD/CBM (dato del founder)", () => {
    expect(CONSOLIDADO_CBM_RATE).toBe(580);
  });

  it("precio = CBM × 580, sin recargo de ciudad ni descuento de sede", () => {
    const cot = calcularEnvioLCL(
      { ...base, cbmTotal: 10, pesoKg: 3000 },
      DEFAULT_PARAMS,
      ciudades,
    );
    expect(cot.precioBase).toBe(5800); // 10 × 580
    expect(cot.recargoCiudad).toBe(0); // hasta puerto: sin distancia
    expect(cot.descuentoSede).toBe(0);
    expect(cot.recargoExcedente).toBe(0); // 3000 kg ≤ 10 × 1.000 incl.
    expect(cot.total).toBe(5800);
  });

  it("suma el embalaje especial (+$50), igual que el puerta a puerta", () => {
    const cot = calcularEnvioLCL(
      { ...base, cbmTotal: 10, pesoKg: 3000, embalaje: "especial" },
      DEFAULT_PARAMS,
      ciudades,
    );
    expect(cot.recargoEmbalaje).toBe(DEFAULT_PARAMS.recargoEmbalajeEspecial);
    expect(cot.total).toBe(5850); // 5800 + 50
  });

  it("aplica el multiplicador de baterías sobre el flete (params del ERP)", () => {
    // El multiplicador es configurable (default 1.3, igual que prod). El test
    // usa params explícitos para no depender del valor vigente en la DB.
    const params: CalcParams = { ...DEFAULT_PARAMS, recargoBateriaMult: 1.3 };
    const cot = calcularEnvioLCL(
      { ...base, cbmTotal: 10, pesoKg: 3000, bateria: true },
      params,
      ciudades,
    );
    expect(cot.recargoBateria).toBe(1740); // 5800 × 0,3
    expect(cot.total).toBe(7540); // 5800 × 1,3
  });

  it("cobra el excedente de densidad con la misma regla ($/kg sobre la gracia)", () => {
    const cot = calcularEnvioLCL(
      { ...base, cbmTotal: 2, pesoKg: 2600 },
      DEFAULT_PARAMS,
      ciudades,
    );
    expect(cot.precioBase).toBe(1160); // 2 × 580
    expect(cot.recargoExcedente).toBe(1200); // (2600 − 2×1000) × $2
    expect(cot.total).toBe(2360);
  });

  it("hereda los topes: > 68 CBM y > 27.000 kg derivan al asesor", () => {
    const porVolumen = calcularEnvioLCL(
      { ...base, cbmTotal: 80, pesoKg: 5000 },
      DEFAULT_PARAMS,
      ciudades,
    );
    expect(porVolumen.alerta?.tipo).toBe("contenedor_excedido");
    const porPeso = calcularEnvioLCL(
      { ...base, cbmTotal: 60, pesoKg: 28000 },
      DEFAULT_PARAMS,
      ciudades,
    );
    expect(porPeso.alerta?.tipo).toBe("peso_contenedor_excedido");
  });

  it("la puerta de volumen del consolidado es 1 m³ (regla del founder)", () => {
    expect(CONSOLIDADO_CBM_MINIMO).toBe(1);
    expect(CONSOLIDADO_BL_COSTO_MAX).toBe(300);
  });

  it("0,99 m³ NO cotiza: sin precio, con el mensaje que deriva al asesor", () => {
    const cot = calcularEnvioLCL(
      { ...base, cbmTotal: 0.99, pesoKg: 400 },
      DEFAULT_PARAMS,
      ciudades,
    );
    expect(cot.alerta?.tipo).toBe("volumen_minimo_consolidado");
    expect(cot.alerta?.mensaje).toBe(CONSOLIDADO_MIN_CBM_MENSAJE);
    // No hay precio que mostrar.
    expect(cot.total).toBe(0);
    expect(cot.precioBase).toBe(0);
  });

  it("el mensaje explica el porqué: BL propio, USD 300 y el corte en 1 m³", () => {
    expect(CONSOLIDADO_MIN_CBM_MENSAJE).toContain("BL a tu nombre");
    expect(CONSOLIDADO_MIN_CBM_MENSAJE).toContain("USD 300");
    expect(CONSOLIDADO_MIN_CBM_MENSAJE).toContain("1 m³");
    expect(CONSOLIDADO_MIN_CBM_MENSAJE).toContain("asesor");
  });

  it("1,0 m³ SÍ cotiza (justo en el corte) — 1 × 580 = $580", () => {
    const cot = calcularEnvioLCL(
      { ...base, cbmTotal: 1, pesoKg: 400 },
      DEFAULT_PARAMS,
      ciudades,
    );
    expect(cot.alerta).toBeUndefined();
    expect(cot.precioBase).toBe(580);
    expect(cot.total).toBe(580);
    // Con el corte en 1 m³ el piso en USD nunca llega a activarse.
    expect(cot.ajusteMinimo).toBe(0);
  });

  it("el corte NO aplica en puerta a puerta: 0,99 m³ en `ddp` sigue cotizando", () => {
    const cot = calcularEnvioLCL(
      {
        modo: "ddp",
        embalaje: "estandar",
        ciudadId: "valencia",
        cbmTotal: 0.99,
        pesoKg: 400,
      },
      DEFAULT_PARAMS,
    );
    expect(cot.alerta).toBeUndefined();
    expect(cot.total).toBeGreaterThan(0);
  });

  it("sin `modo` explícito el motor NO corta (default histórico = ddp)", () => {
    const cot = calcularEnvioLCL(
      {
        embalaje: "estandar",
        ciudadId: "valencia",
        cbmTotal: 0.5,
        pesoKg: 200,
      },
      DEFAULT_PARAMS,
    );
    expect(cot.alerta).toBeUndefined();
  });

  it("el destino sintético no tiene recargo por distancia (casco, km 0)", () => {
    expect(CONSOLIDADO_DESTINO.km).toBe(0);
    expect(CONSOLIDADO_DESTINO.casco).toBe(true);
  });
});
