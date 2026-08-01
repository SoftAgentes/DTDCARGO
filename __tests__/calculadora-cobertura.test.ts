import { describe, it, expect } from "vitest";
import {
  CIUDADES,
  calcularEnvioLCL,
  coberturaDestino,
  mensajeDestinoSinCobertura,
  mensajeDestinoSinTarifa,
  vecinaDeDestino,
  type Ciudad,
} from "@/lib/calculadora";

/**
 * Contrato entre el CLASIFICADOR y el MOTOR (SDD-0237).
 *
 * `coberturaDestino()` existe para que el formulario pueda pintar el estado de
 * un destino sin carga válida — el motor exige CBM y peso antes de llegar a la
 * rama de la tarifa. Eso significa que hay DOS lugares que deciden lo mismo, y
 * este archivo es lo único que impide que se separen en silencio.
 *
 * Se corre sobre los 178 destinos REALES, no sobre fixtures: si mañana alguien
 * le quita la tarifa a Maracaibo o marca una ciudad como sin cobertura, el
 * clasificador tiene que moverse con el motor o esto se pone rojo.
 */

/** Carga válida y sin recargos: aísla el estado del destino de todo lo demás. */
const CARGA = { cbmTotal: 2, pesoKg: 500, embalaje: "estandar" as const };

describe("coberturaDestino ↔ calcularEnvioLCL", () => {
  it("clasifica los 178 destinos reales igual que el motor", () => {
    expect(CIUDADES.length).toBe(178);

    for (const ciudad of CIUDADES) {
      const estado = coberturaDestino(ciudad);
      const cot = calcularEnvioLCL({ ...CARGA, ciudadId: ciudad.id });
      const tipo = cot.alerta?.tipo ?? null;

      if (estado === "cubierta") {
        expect(tipo, `${ciudad.label} debería cotizar sola`).toBeNull();
        expect(cot.total, `${ciudad.label} sin total`).toBeGreaterThan(0);
      } else if (estado === "sin_cobertura") {
        expect(tipo, `${ciudad.label} debería derivar por cobertura`).toBe(
          "ciudad_sin_cobertura",
        );
      } else {
        expect(tipo, `${ciudad.label} debería derivar por tarifa`).toBe(
          "ciudad_sin_tarifa",
        );
      }
    }
  });

  it("cuenta los tres estados como los declara el catálogo", () => {
    const conteo = { cubierta: 0, sin_cobertura: 0, sin_tarifa: 0 };
    for (const ciudad of CIUDADES) conteo[coberturaDestino(ciudad)]++;

    // 178 destinos · 169 cubiertos · 9 sin cobertura (cabecera de
    // lib/data/destinos-nacionales.ts, tarifario de Benito del 31-jul-2026).
    expect(conteo).toEqual({ cubierta: 169, sin_cobertura: 9, sin_tarifa: 0 });
  });

  it("la zona sin costo cotiza aunque no tenga tarifa propia", () => {
    // Las 8 en $0 no necesitan precio de tramo: el cliente paga $0. Si el
    // clasificador las mandara a `sin_tarifa`, el selector marcaría "a medida"
    // ocho ciudades que sí cotizan — incluida la sede.
    const zonaSinCosto: Ciudad = {
      id: "x", label: "X", km: 0, casco: true, ventaCbm: null, cubierta: true,
    };
    expect(coberturaDestino(zonaSinCosto)).toBe("cubierta");
  });

  it("sin cobertura gana sobre la falta de tarifa", () => {
    // Una ciudad sin cobertura tampoco tiene tarifa (`ventaCbm: null`). El
    // orden importa: "no llegamos + te digo hasta dónde sí" vende; "cotizamos
    // a medida" a secas, no.
    const sinCobertura: Ciudad = {
      id: "y", label: "Y", km: 0, casco: false, ventaCbm: null, cubierta: false,
      cercana: null,
    };
    expect(coberturaDestino(sinCobertura)).toBe("sin_cobertura");
  });
});

describe("copy compartido con el motor", () => {
  it("el motor emite exactamente el mensaje del constructor", () => {
    const cariaco = CIUDADES.find((c) => c.id === "cariaco");
    expect(cariaco, "cariaco salió del catálogo").toBeDefined();

    const cot = calcularEnvioLCL({ ...CARGA, ciudadId: "cariaco" });
    expect(cot.alerta?.mensaje).toBe(
      mensajeDestinoSinCobertura(
        cariaco!.label,
        vecinaDeDestino(cariaco!, CIUDADES),
      ),
    );
  });

  it("nombra la vecina y su precio, no un 'no disponible' seco", () => {
    const cot = calcularEnvioLCL({ ...CARGA, ciudadId: "cariaco" });
    expect(cot.alerta?.mensaje).toContain("Cumaná");
    expect(cot.alerta?.mensaje).toContain("$123.60");
    expect(cot.cercana).toEqual({ label: "Cumaná", ventaCbm: 123.6 });
  });

  it("sin tarifa usa el mismo constructor en las dos ramas del motor", () => {
    const huerfana: Ciudad[] = [
      { id: "z", label: "Pueblo Z", km: 0, casco: false, ventaCbm: null, cubierta: true },
    ];
    const cot = calcularEnvioLCL({ ...CARGA, ciudadId: "z" }, undefined, huerfana);
    expect(cot.alerta?.tipo).toBe("ciudad_sin_tarifa");
    expect(cot.alerta?.mensaje).toBe(mensajeDestinoSinTarifa("Pueblo Z"));
  });

  it("sin vecina cae al copy genérico, no a un mensaje roto", () => {
    expect(mensajeDestinoSinCobertura("Nowhere", null)).toContain(
      "buscamos cómo hacerte llegar la carga",
    );
    expect(mensajeDestinoSinCobertura("Nowhere", null)).not.toContain("$");
  });

  it("descarta la vecina sin tarifa (no se anuncia un tramo sin precio)", () => {
    const ciudades: Ciudad[] = [
      { id: "a", label: "A", km: 0, casco: false, ventaCbm: null, cubierta: false, cercana: "b" },
      { id: "b", label: "B", km: 0, casco: false, ventaCbm: null, cubierta: true },
    ];
    expect(vecinaDeDestino(ciudades[0], ciudades)).toBeNull();
  });
});
