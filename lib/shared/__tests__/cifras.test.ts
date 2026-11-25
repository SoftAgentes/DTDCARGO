import { describe, expect, it } from "vitest";
import {
  DECIMALES_POR_MODO, MENSAJE_FORMATO, MODOS_NUMERO,
  parseDinero, parseMaquina, parseMedida, parseNumero, parsePorcentaje, parseTasa,
  type ModoNumero,
} from "@/lib/shared/cifras";

// SDD-0687 opción A: tabla de entrada humana, independiente de la salida.
describe.each(MODOS_NUMERO)("entrada humana: %s", (modo) => {
  it.each(["12.5", "12,5", "12.50", "12,50"])("%s es decimal", (texto) => {
    expect(parseNumero(texto, modo)).toMatchObject({ ok: true, valor: 12.5 });
  });

  it.each(["1.234,50", "1,234.50", "1.234.567", "1,234,567", "1.234.567,89", "1.23.456", "12.3456,5", "1,2,3,4", "1.234,", "1.234,5,6"])(
    "rechaza miles antiguos o separadores repetidos: %s", (texto) => {
      expect(parseNumero(texto, modo)).toEqual({
        ok: false, motivo: "formato", mensaje: MENSAJE_FORMATO, pedirAclarar: false,
      });
      expect(MENSAJE_FORMATO).toBe("Escribe el número sin puntos de miles");
    },
  );

  it.each(["12,", "12.", ".", ","])("%s es edición incompleta", (texto) => {
    expect(parseNumero(texto, modo)).toMatchObject({ ok: false, motivo: "incompleto" });
  });

  it.each(["", "   "])("vacío %s no es cero", (texto) => {
    expect(parseNumero(texto, modo)).toMatchObject({ ok: false, motivo: "vacio" });
  });

  it.each(["0", "0,00", "0.00", "+0"])("cero válido: %s", (texto) => {
    expect(parseNumero(texto, modo)).toMatchObject({ ok: true, valor: 0 });
  });

  it.each(["abc", "$100", "1 234,50", "12e3", "--5", "5-"])("rechaza caracteres: %s", (texto) => {
    expect(parseNumero(texto, modo)).toMatchObject({ ok: false, motivo: "formato" });
  });

  it("respeta la precisión declarada, incluidos ceros finales", () => {
    const limite = DECIMALES_POR_MODO[modo];
    for (const separador of [".", ","]) {
      expect(parseNumero(`1${separador}${"2".repeat(limite)}`, modo).ok).toBe(true);
      expect(parseNumero(`1${separador}${"0".repeat(limite + 1)}`, modo))
        .toMatchObject({ ok: false, motivo: "decimales" });
    }
  });
});

describe("denominaciones, signo y precisión del dominio", () => {
  it.each(["1.234", "1,234", "10,000", "10.000", "1.250", "999.999", "36.500", "0.125"])(
    "%s es decimal, con rechazo por precisión en dinero de dos decimales", (texto) => {
      expect(parseDinero(texto)).toMatchObject({ ok: false, motivo: "decimales", pedirAclarar: false });
      expect(parseDinero(texto, { decimales: 4 })).toMatchObject({
        ok: true, valor: Number(texto.replace(",", ".")),
      });
    },
  );
  it.each([parseTasa, parseMedida])("los wrappers aceptan 0.366, 36.500 y 1.250", (parse) => {
    expect(parse("0.366")).toMatchObject({ ok: true, valor: 0.366 });
    expect(parse("36.500")).toMatchObject({ ok: true, valor: 36.5 });
    expect(parse("1.250")).toMatchObject({ ok: true, valor: 1.25 });
  });
  it("dinero y porcentaje permiten precisión especial sin adivinar miles", () => {
    for (const parse of [parseDinero, parsePorcentaje]) {
      expect(parse("1.234", { decimales: 3 })).toMatchObject({ ok: true, valor: 1.234 });
      expect(parse("1,234", { decimales: 3 })).toMatchObject({ ok: true, valor: 1.234 });
    }
    expect(parseMedida("0,1234", { decimales: 3 })).toMatchObject({ ok: false, motivo: "decimales" });
    expect(parseMedida("12", { decimales: 0 })).toMatchObject({ ok: true, valor: 12 });
    expect(parseMedida("12.0", { decimales: 0 })).toMatchObject({ ok: false, motivo: "decimales" });
  });
  it.each(["dinero", "tasa", "medida"] as const)("negativo permitido en %s; decide cada campo", (modo) => {
    expect(parseNumero("-12.50", modo)).toMatchObject({ ok: true, valor: -12.5 });
    expect(parseNumero("- 80", modo)).toMatchObject({ ok: true, valor: -80 });
  });
  it("normaliza -0 sin perder los decimales canónicos", () => {
    const r = parseDinero("-0,00");
    expect(r).toMatchObject({ ok: true, valor: 0, canonico: "0.00" });
    expect(r.ok && Object.is(r.valor, -0)).toBe(false);
  });
  it.each(["-1", "100.01", "100,01"])("porcentaje fuera de rango: %s", (texto) => {
    expect(parsePorcentaje(texto)).toMatchObject({ ok: false, motivo: "rango" });
  });
  it("cero y cien son porcentajes válidos", () => {
    expect(parsePorcentaje("0")).toMatchObject({ ok: true, valor: 0 });
    expect(parsePorcentaje("100")).toMatchObject({ ok: true, valor: 100 });
  });
  it("ft³ sigue disponible con cuatro decimales", () => {
    for (const texto of ["3.498", "3,498", "3.4985", "3,4985"]) {
      expect(parseDinero(texto, { decimales: 4 })).toMatchObject({ ok: true, valor: Number(texto.replace(",", ".")) });
    }
  });
});

describe("parseMaquina: el valor oculto que sale del campo (no es lo que teclea una persona)", () => {
  it.each([
    ["3.498", 3.498],
    ["3.4985", 3.4985],
    ["123.6", 123.6],
    ["1250", 1250],
    ["-0.5", -0.5],
    ["0", 0],
  ])("«%s» → %s", (texto, esperado) => {
    expect(parseMaquina(texto, "dinero", { decimales: 4 })).toMatchObject({ ok: true, valor: esperado, canonico: texto });
  });

  it.each(["", "3,498", "1.234,5", "1,234.50", "abc", "01.5", "3.", ".5", "1e3", "3.49851"])(
    "«%s» no es un decimal de máquina o excede los 4 decimales",
    (texto) => {
      expect(parseMaquina(texto, "dinero", { decimales: 4 }).ok).toBe(false);
    },
  );

  it("respeta los decimales del campo y el rango del modo", () => {
    expect(parseMaquina("3.498", "dinero").ok).toBe(false);
    expect(parseMaquina("100.5", "porcentaje").ok).toBe(false);
  });

  it("cualquier valor que el campo deja oculto se vuelve a leer igual", () => {
    const azar = generador(790);
    for (let i = 0; i < 1000; i++) {
      const v = Number((azar() * 10000).toFixed(Math.floor(azar() * 5)));
      const r = parseMaquina(String(v), "dinero", { decimales: 4 });
      expect(r.ok, String(v)).toBe(true);
      if (r.ok) expect(r.valor).toBe(v);
    }
  });
});

describe("el modo es obligatorio (§4.2: sin modo por defecto)", () => {
  it("un modo desconocido es un error de programación", () => {
    expect(() => parseNumero("12", "monto" as ModoNumero)).toThrow(/Modo de cifra desconocido/);
    expect(() => parseNumero("12", undefined as unknown as ModoNumero)).toThrow();
  });

  it("los decimales por modo son los de la spec", () => {
    expect(DECIMALES_POR_MODO).toEqual({ dinero: 2, tasa: 8, porcentaje: 2, medida: 4 });
  });

  it("decimales propios no válidos se rechazan", () => {
    expect(() => parseNumero("12", "dinero", { decimales: -1 })).toThrow();
    expect(() => parseNumero("12", "dinero", { decimales: 1.5 })).toThrow();
  });

  it("una entrada que no es texto no revienta", () => {
    expect(parseNumero(42 as unknown as string, "dinero").ok).toBe(false);
    expect(parseNumero(null as unknown as string, "dinero").ok).toBe(false);
  });
});

/** Generador determinista (mulberry32) para que un fallo se pueda repetir. */
function generador(semilla: number) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}


describe("propiedad: texto editable sin agrupación", () => {
  it("lee 2.000 montos con punto y con coma sin cambiar su valor", () => {
    const azar = generador(687);
    for (let i = 0; i < 2000; i++) {
      const monto = Math.floor(azar() * 1e9) / 100 * (azar() < 0.1 ? -1 : 1);
      for (const editable of [String(monto), String(monto).replace(".", ",")]) {
        expect(parseDinero(editable)).toMatchObject({ ok: true, valor: monto });
      }
    }
  });
  it("cada separador único con tres cifras es decimal si cabe en el campo", () => {
    const azar = generador(1234);
    for (let i = 0; i < 1000; i++) {
      const entero = String(1 + Math.floor(azar() * 99));
      const fraccion = String(Math.floor(azar() * 1000)).padStart(3, "0");
      for (const separador of [".", ","]) {
        const texto = `${entero}${separador}${fraccion}`;
        const esperado = Number(`${entero}.${fraccion}`);
        for (const modo of MODOS_NUMERO) {
          expect(parseNumero(texto, modo, { decimales: 3 })).toMatchObject({ ok: true, valor: esperado });
        }
        expect(parseDinero(texto)).toMatchObject({ ok: false, motivo: "decimales" });
      }
    }
  });
});
