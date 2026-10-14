// @vitest-environment node
/**
 * SDD-0513 · Generador y validador del PIN de operario.
 *
 * Lo que se afirma es comportamiento, no texto:
 *  - el generador real (crypto.randomInt) nunca produce un PIN que la base
 *    rechazaría, en muchas corridas;
 *  - el sorteo es por RECHAZO: con una fuente controlada, cada valor válido
 *    sale tal cual y cada valor inválido se descarta (no se «corrige»), así
 *    que la distribución sobre los 9.976 PIN válidos queda uniforme;
 *  - pide el rango completo (0, 10000) con máximo exclusivo: con (0, 9999) el
 *    9999 no saldría nunca, pero tampoco el 9998, el 9997…;
 *  - una fuente rota falla cerrado en vez de devolver un PIN débil;
 *  - no toca Math.random.
 *
 * La equivalencia con la función SQL real está en
 * operario-pin.migration.test.ts (PGlite).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OPERARIO_PIN_BLACKLIST,
  OPERARIO_PIN_MAX_DRAWS,
  OPERARIO_PIN_PROBLEM_MESSAGE,
  drawOperarioPin,
  isValidOperarioPin,
  operarioPinProblem,
} from "../operario-pin";
import { generateOperarioPin } from "../operario-pin-generator";

const pad = (n: number) => String(n).padStart(4, "0");

/** Fuente que devuelve una secuencia fija y registra con qué rango la llaman. */
function sequence(values: number[]) {
  const calls: Array<[number, number]> = [];
  let i = 0;
  const fn = (min: number, max: number) => {
    calls.push([min, max]);
    if (i >= values.length) throw new Error("secuencia agotada");
    return values[i++];
  };
  return { fn, calls };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("operarioPinProblem", () => {
  it("acepta 4 dígitos fuera de la lista de comunes", () => {
    for (const pin of ["4827", "0429", "9998", "0001", "7310"]) {
      expect(operarioPinProblem(pin), pin).toBeNull();
    }
  });

  it("rechaza por formato lo que no son exactamente 4 dígitos ASCII", () => {
    for (const pin of ["", "123", "12345", "12a4", " 123", "123 ", "１２３４", "-123", "12.3"]) {
      expect(operarioPinProblem(pin), JSON.stringify(pin)).toBe("format");
    }
  });

  it("rechaza por común los 24 de la lista, y solo esos", () => {
    expect(OPERARIO_PIN_BLACKLIST.size).toBe(24);
    let common = 0;
    for (let n = 0; n < 10_000; n++) {
      if (operarioPinProblem(pad(n)) === "common") common++;
    }
    expect(common).toBe(24);
    for (const pin of OPERARIO_PIN_BLACKLIST) {
      expect(operarioPinProblem(pin), pin).toBe("common");
    }
  });

  it("los mensajes van en tuteo, sin voseo", () => {
    // La base dice «Elegí uno menos predecible» (voseo); el Studio no lo repite.
    const all = Object.values(OPERARIO_PIN_PROBLEM_MESSAGE).join(" ");
    expect(all).not.toMatch(/elegí|usá|tenés|podés|querés|probá|escribí|generá/i);
  });
});

describe("drawOperarioPin (muestreo de rechazo)", () => {
  it("pide el rango completo con máximo exclusivo: (0, 10000)", () => {
    const src = sequence([4827]);
    expect(drawOperarioPin(src.fn)).toBe("4827");
    expect(src.calls).toEqual([[0, 10_000]]);
  });

  it("rellena con ceros a la izquierda", () => {
    expect(drawOperarioPin(sequence([7]).fn)).toBe("0007");
    expect(drawOperarioPin(sequence([42]).fn)).toBe("0042");
  });

  it("descarta los comunes y sigue sorteando hasta uno válido", () => {
    const src = sequence([1234, 0, 1111, 2580, 4827]);
    expect(drawOperarioPin(src.fn)).toBe("4827");
    expect(src.calls).toHaveLength(5);
  });

  it("cada valor válido sale tal cual en el primer sorteo (sin sesgo ni mapeo)", () => {
    for (let n = 0; n < 10_000; n++) {
      const expected = pad(n);
      const src = sequence(isValidOperarioPin(expected) ? [n] : [n, 4827]);
      const got = drawOperarioPin(src.fn);
      if (isValidOperarioPin(expected)) {
        expect(got).toBe(expected);
        expect(src.calls).toHaveLength(1);
      } else {
        expect(got).toBe("4827");
        expect(src.calls).toHaveLength(2);
      }
    }
  });

  it("una fuente rota que solo da comunes falla cerrado tras el tope", () => {
    const calls: number[] = [];
    const stuck = () => {
      calls.push(1);
      return 1234;
    };
    expect(() => drawOperarioPin(stuck)).toThrow(/No se pudo generar un PIN válido/);
    expect(calls).toHaveLength(OPERARIO_PIN_MAX_DRAWS);
  });
});

describe("generateOperarioPin (crypto.randomInt real)", () => {
  it("en 20.000 corridas nunca sale un PIN inválido y no usa Math.random", () => {
    const mathRandom = vi.spyOn(Math, "random");
    const seen = new Set<string>();
    for (let i = 0; i < 20_000; i++) {
      const pin = generateOperarioPin();
      expect(operarioPinProblem(pin), pin).toBeNull();
      seen.add(pin);
    }
    expect(mathRandom).not.toHaveBeenCalled();
    // 20.000 sorteos uniformes sobre 9.976 valores cubren ~86 %; un generador
    // degenerado (constante, o con pocos valores) queda muy por debajo.
    expect(seen.size).toBeGreaterThan(8_000);
  });
});
