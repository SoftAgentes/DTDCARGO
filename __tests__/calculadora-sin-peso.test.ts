import { describe, it, expect } from "vitest";
import {
  DEFAULT_PARAMS,
  calcularEnvioLCL,
  pesoMaxSinRecargo,
  mensajeEstimadoSinPeso,
  avisoCampoPesoVacio,
  whatsappTextFromCotizacion,
  type EnvioInput,
} from "@/lib/calculadora";

/**
 * El estimado SIN peso (SDD-0257).
 *
 * El cliente escribe su CBM, se olvida del peso, y hasta ahora la calculadora no
 * mostraba NADA — ni precio, ni desglose, ni botón. Ahora cotiza igual, y el
 * número que sale es el **piso real** de esa carga.
 *
 * Toda esta suite existe para proteger una sola promesa: **el "Desde $X" no
 * miente**. Es exacto para cualquier carga hasta `pesoMaxSinRecargo()` kg — ni
 * un peso por debajo del techo lo mueve, ni un kg por encima lo deja quieto.
 */

const base = {
  embalaje: "estandar" as const,
  ciudadId: "valencia" as const,
};

describe("pesoMaxSinRecargo — el techo que sostiene el «desde»", () => {
  /**
   * Los tres tramos son tres reglas distintas, y por eso se prueban aparte:
   *
   *  · 5 m³  → manda el recargo por densidad (cbm × 1.000 = 5.000, y 5.000
   *            todavía no llega al tope por envío de 9.000).
   *  · 12 m³ → manda el ANTI-MONOPOLIO. La cuenta ingenua diría 12.000 kg, pero
   *            12.000 kg en 12 m³ son 1.000 kg/m³ y con más de 9.000 kg eso
   *            deriva al asesor. Este es el caso que un techo optimista rompe.
   *  · 30 m³ → manda la densidad de equilibrio (27.000/68 ≈ 397,06 kg/m³): por
   *            encima de 9.000 kg hay que quedarse bajo esa densidad.
   */
  it("5 m³ → 5.000 kg (manda el recargo por densidad)", () => {
    expect(pesoMaxSinRecargo(5, DEFAULT_PARAMS)).toBe(5000);
  });

  it("12 m³ → 9.000 kg, NO 12.000 (manda el anti-monopolio)", () => {
    expect(pesoMaxSinRecargo(12, DEFAULT_PARAMS)).toBe(9000);
  });

  it("30 m³ → 11.911,76 kg (manda la densidad de equilibrio)", () => {
    expect(pesoMaxSinRecargo(30, DEFAULT_PARAMS)).toBeCloseTo(11911.76, 2);
  });

  it("sin CBM no hay techo que dar", () => {
    expect(pesoMaxSinRecargo(0, DEFAULT_PARAMS)).toBe(0);
    expect(pesoMaxSinRecargo(-1, DEFAULT_PARAMS)).toBe(0);
    expect(pesoMaxSinRecargo(NaN, DEFAULT_PARAMS)).toBe(0);
  });
});

describe("la cotización sale sin peso", () => {
  it("12 m³ sin peso da precio, se marca `sinPeso` y no lleva alerta", () => {
    const cot = calcularEnvioLCL({ ...base, cbmTotal: 12 });

    expect(cot.alerta).toBeUndefined();
    expect(cot.total).toBeGreaterThan(0);
    expect(cot.sinPeso).toBe(true);
    expect(cot.pesoMaxSinRecargoKg).toBe(9000);
    // Sin peso NO se estima densidad ni se cobra excedente: el total es el piso.
    expect(cot.recargoExcedente).toBe(0);
    expect(cot.densidadKgM3).toBe(0);
  });

  it("`0`, `null` y `undefined` son el mismo caso: no lo indicó", () => {
    const sinCampo = calcularEnvioLCL({ ...base, cbmTotal: 12 });
    const cero = calcularEnvioLCL({ ...base, cbmTotal: 12, pesoKg: 0 });
    const nulo = calcularEnvioLCL({ ...base, cbmTotal: 12, pesoKg: null });

    for (const cot of [cero, nulo]) {
      expect(cot.sinPeso).toBe(true);
      expect(cot.total).toBe(sinCampo.total);
    }
  });

  it("con peso real, `sinPeso` es false y el techo no se publica", () => {
    const cot = calcularEnvioLCL({ ...base, cbmTotal: 12, pesoKg: 4000 });

    expect(cot.sinPeso).toBe(false);
    expect(cot.pesoMaxSinRecargoKg).toBe(0);
  });

  it("el CBM SÍ sigue siendo obligatorio", () => {
    const cot = calcularEnvioLCL({ ...base, cbmTotal: 0, pesoKg: 400 });

    expect(cot.alerta?.tipo).toBe("carga_invalida");
    expect(cot.total).toBe(0);
    // Y el mensaje ya no puede pedir el peso: dejó de ser obligatorio.
    expect(cot.alerta?.mensaje).not.toContain("peso");
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════
 *  LA PRUEBA DE FONDO — que el "Desde $X" sea verdad
 * ═══════════════════════════════════════════════════════════════════
 *
 * No alcanza con ver que sale un número. Hay que probar las DOS mitades, o el
 * verde no dice nada:
 *
 *  1. Hasta el techo, el precio sin peso es EXACTAMENTE el mismo que con peso.
 *  2. Un kilo por encima del techo, YA cambia — o suma recargo, o deriva al
 *     asesor. Si no cambiara, el techo estaría de adorno y la mitad 1 pasaría
 *     igual con un techo inventado.
 */
describe("el «desde» no miente", () => {
  const tramos = [
    { cbm: 5, nombre: "recargo por densidad" },
    { cbm: 12, nombre: "anti-monopolio" },
    { cbm: 30, nombre: "densidad de equilibrio" },
  ];

  for (const { cbm, nombre } of tramos) {
    it(`${cbm} m³ (${nombre}): justo en el techo, el precio es idéntico al de sin peso`, () => {
      const techo = pesoMaxSinRecargo(cbm, DEFAULT_PARAMS);
      const sinPeso = calcularEnvioLCL({ ...base, cbmTotal: cbm });
      const enElTecho = calcularEnvioLCL({
        ...base,
        cbmTotal: cbm,
        pesoKg: techo,
      });

      expect(enElTecho.alerta).toBeUndefined();
      expect(enElTecho.recargoExcedente).toBe(0);
      expect(enElTecho.total).toBe(sinPeso.total);
    });

    it(`${cbm} m³ (${nombre}): un kilo MÁS y el precio ya no es el mismo`, () => {
      const techo = pesoMaxSinRecargo(cbm, DEFAULT_PARAMS);
      const sinPeso = calcularEnvioLCL({ ...base, cbmTotal: cbm });
      const pasado = calcularEnvioLCL({
        ...base,
        cbmTotal: cbm,
        pesoKg: techo + 1,
      });

      // O deriva al asesor, o cobra más. Lo que no puede es quedarse igual.
      const cambio = !!pasado.alerta || pasado.total !== sinPeso.total;
      expect(cambio).toBe(true);
    });
  }
});

describe("los topes que dependen del peso siguen vivos", () => {
  it("con peso enorme deriva al asesor, sin peso no", () => {
    const conPeso = calcularEnvioLCL({
      ...base,
      cbmTotal: 30,
      pesoKg: 28000,
    });
    const sinPeso = calcularEnvioLCL({ ...base, cbmTotal: 30 });

    expect(conPeso.alerta?.tipo).toBe("peso_contenedor_excedido");
    expect(sinPeso.alerta).toBeUndefined();
  });

  it("las alertas que NO dependen del peso siguen saltando sin él", () => {
    // Más que un contenedor: es cuestión de volumen, el peso no lo salva.
    const excedido = calcularEnvioLCL({ ...base, cbmTotal: 100 });
    expect(excedido.alerta?.tipo).toBe("contenedor_excedido");

    // Carga especial: deriva al asesor con o sin peso.
    const especial = calcularEnvioLCL({
      ...base,
      cbmTotal: 12,
      cargaEspecial: true,
    });
    expect(especial.alerta?.tipo).toBe("carga_especial");

    // En estado de alerta no hay "desde" que explicar.
    expect(excedido.sinPeso).toBe(false);
    expect(especial.sinPeso).toBe(false);
  });

  it("el consolidado sigue exigiendo su 1 m³, con peso o sin él", () => {
    const cot = calcularEnvioLCL({
      ...base,
      modo: "consolidado",
      cbmTotal: 0.5,
    });

    expect(cot.alerta?.tipo).toBe("volumen_minimo_consolidado");
  });

  it("el consolidado sobre 1 m³ sí cotiza sin peso", () => {
    const cot = calcularEnvioLCL({ ...base, modo: "consolidado", cbmTotal: 2 });

    expect(cot.alerta).toBeUndefined();
    expect(cot.sinPeso).toBe(true);
    expect(cot.total).toBeGreaterThan(0);
  });
});

describe("el copy sale del motor, no de la UI", () => {
  it("el techo se dice en kilos con separador de miles", () => {
    expect(mensajeEstimadoSinPeso(9000)).toContain("9.000 kg");
    expect(avisoCampoPesoVacio(9000)).toContain("9.000 kg");
    expect(mensajeEstimadoSinPeso(11911.76)).toContain("11.912 kg");
  });

  it("los dos textos son distintos: uno empuja, el otro explica", () => {
    // Van a diez centímetros en la misma pantalla; repetir la frase completa se
    // lee como un error de la página, no como énfasis.
    expect(avisoCampoPesoVacio(9000)).not.toBe(mensajeEstimadoSinPeso(9000));
    expect(avisoCampoPesoVacio(9000).length).toBeLessThan(
      mensajeEstimadoSinPeso(9000).length,
    );
  });
});

describe("lo que le llega al asesor por WhatsApp", () => {
  const input: EnvioInput = { ...base, cbmTotal: 12 };

  it("dice «sin indicar», nunca «0 kg»", () => {
    const cot = calcularEnvioLCL(input);
    const texto = whatsappTextFromCotizacion(cot, input);

    expect(texto).toContain("Peso total: sin indicar");
    // El renglón COMPLETO, no el fragmento "0 kg": ese vive dentro de "9.000 kg"
    // del techo y hacía fallar la prueba por una coincidencia que no era el bug.
    // Lo que se corrige es que el asesor leyera "Peso total: 0 kg" y lo tomara
    // por un peso medido.
    expect(texto).not.toContain("Peso total: 0 kg");
  });

  it("el estimado viaja como «desde» y con el techo adentro", () => {
    const cot = calcularEnvioLCL(input);
    const texto = whatsappTextFromCotizacion(cot, input);

    expect(texto).toContain("desde US$");
    expect(texto).toContain("9.000 kg");
  });

  it("con peso, el mensaje no cambia respecto de antes", () => {
    const conPeso: EnvioInput = { ...input, pesoKg: 4800 };
    const texto = whatsappTextFromCotizacion(
      calcularEnvioLCL(conPeso),
      conPeso,
    );

    expect(texto).toContain("Peso total: 4800 kg");
    expect(texto).not.toContain("desde US$");
    expect(texto).not.toContain("sin indicar");
  });
});
