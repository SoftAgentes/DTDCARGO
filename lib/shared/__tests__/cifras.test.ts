import { describe, expect, it } from "vitest";
import {
  DECIMALES_POR_MODO,
  MENSAJE_FORMATO,
  parseDinero,
  parseMaquina,
  parseMedida,
  parseNumero,
  parsePorcentaje,
  parseTasa,
  type ModoNumero,
} from "@/lib/shared/cifras";

/**
 * SDD-0687 §2 y §4.2: la tabla de la spec, caso por caso y por modo.
 * Decisiones de Sam: 2 A (CBM y peso con punto o coma), 5 B (tasa hasta 8
 * decimales al teclear) y 6 A («12.50» en dinero se acepta como 12,50).
 */

function valor(texto: string, modo: ModoNumero): number {
  const r = parseNumero(texto, modo);
  if (!r.ok) throw new Error(`«${texto}» en ${modo} se rechazó: ${r.mensaje}`);
  return r.valor;
}

function motivo(texto: string, modo: ModoNumero): string {
  const r = parseNumero(texto, modo);
  if (r.ok) throw new Error(`«${texto}» en ${modo} se aceptó como ${r.valor}`);
  return r.motivo;
}

describe("dinero (§2.1, columna dinero)", () => {
  it.each([
    ["1234,5", 1234.5],
    ["1.234,50", 1234.5],
    ["1.234.567", 1234567],
    ["1.234.567,89", 1234567.89],
    ["12,50", 12.5],
    ["12.5", 12.5], // decisión 6 A
    ["12.50", 12.5], // decisión 6 A
    ["1234", 1234],
    ["0,99", 0.99],
    [",5", 0.5],
    ["  80  ", 80],
  ])("«%s» → %s", (texto, esperado) => {
    expect(valor(texto, "dinero")).toBe(esperado);
  });

  it.each(["1.234", "1,234", "10,000", "10.000", "1.250", "999.999", "36.500"])(
    "«%s» se rechaza y pide aclarar, con punto o con coma",
    (texto) => {
      const r = parseDinero(texto);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.motivo).toBe("ambiguo");
      expect(r.pedirAclarar).toBe(true);
      expect(r.mensaje).toContain(`«${texto}»`);
    },
  );

  it("el mensaje de «1.234» dice qué escribir si son miles", () => {
    const r = parseDinero("1.234");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.mensaje).toContain("1234");
    expect(r.mensaje).toContain("1.234,00");
  });

  it("«1,234.50» (formato de EE. UU.) se rechaza con el formato esperado", () => {
    const r = parseDinero("1,234.50");
    expect(r).toEqual({ ok: false, motivo: "formato", mensaje: MENSAJE_FORMATO, pedirAclarar: false });
  });

  it.each(["1,234,567", "1.23.456", "12.3456,5", "1,2,3,4", "1.234,5,6"])(
    "agrupación inválida «%s» se rechaza",
    (texto) => {
      expect(motivo(texto, "dinero")).toBe("formato");
    },
  );

  it.each(["0.125", "0,125", "1234,567", "12,345678", "1.234,567"])(
    "«%s» trae más de 2 decimales y se rechaza (no se redondea)",
    (texto) => {
      expect(motivo(texto, "dinero")).toBe("decimales");
    },
  );

  it.each(["12,", "1.234,", "12."])("«%s» está incompleto", (texto) => {
    expect(motivo(texto, "dinero")).toBe("incompleto");
  });

  it.each(["", "   "])("vacío «%s» no es un cero", (texto) => {
    expect(motivo(texto, "dinero")).toBe("vacio");
  });

  it.each(["abc", "$100", "1 234,50", "12e3", "--5", "5-"])("«%s» no es una cifra", (texto) => {
    expect(motivo(texto, "dinero")).toBe("formato");
  });
});

describe("negativos", () => {
  it.each([
    ["-12,50", -12.5],
    ["-1.234,50", -1234.5],
    ["- 80", -80],
    ["+12,5", 12.5],
    ["-0", 0],
  ])("«%s» → %s", (texto, esperado) => {
    expect(valor(texto, "dinero")).toBe(esperado);
  });

  it("-0 sale como 0 positivo y canónico «0»", () => {
    const r = parseDinero("-0,00");
    expect(r.ok && r.canonico).toBe("0.00");
    expect(r.ok && Object.is(r.valor, -0)).toBe(false);
  });

  it.each(["-1.234", "-1,234", "-10.000"])("«%s» se pide aclarar igual que sin signo", (texto) => {
    expect(motivo(texto, "dinero")).toBe("ambiguo");
  });

  it("«-36.500» en tasa se pide aclarar", () => {
    expect(motivo("-36.500", "tasa")).toBe("ambiguo");
  });
});

describe("medida: CBM y peso (§2.1, decisión 2 A)", () => {
  it.each([
    ["1234,5", 1234.5],
    ["1.234,50", 1234.5],
    ["1.234", 1.234],
    ["1,234", 1.234],
    ["10,000", 10],
    ["1.234.567", 1234567],
    ["12.5", 12.5],
    ["0.125", 0.125],
    ["0,0012", 0.0012],
  ])("«%s» → %s", (texto, esperado) => {
    expect(valor(texto, "medida")).toBe(esperado);
  });

  it("«1,234.50» se rechaza igual que en dinero", () => {
    expect(motivo("1,234.50", "medida")).toBe("formato");
  });

  it("CBM con más de 4 decimales se rechaza", () => {
    expect(motivo("0,12345", "medida")).toBe("decimales");
  });

  it("un campo puede pedir 3 decimales (CBM del embarque)", () => {
    expect(parseMedida("0,1234", { decimales: 3 }).ok).toBe(false);
    expect(parseMedida("0,123", { decimales: 3 }).ok).toBe(true);
  });
});

describe("tasa (§2.1, modo tasa; decisión 5 B: hasta 8 al teclear)", () => {
  it.each([
    ["36,500", 36.5],
    ["36,51259999", 36.51259999],
    ["36,5", 36.5],
    ["36.5", 36.5],
    ["36.51", 36.51],
    ["36.5125", 36.5125],
    ["1.036,5", 1036.5],
    ["7,24", 7.24],
  ])("«%s» → %s", (texto, esperado) => {
    expect(valor(texto, "tasa")).toBe(esperado);
  });

  it("«36.500» se rechaza y pide aclarar", () => {
    const r = parseTasa("36.500");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toBe("ambiguo");
    expect(r.pedirAclarar).toBe(true);
    expect(r.mensaje).toContain("36,500");
    expect(r.mensaje).toContain("36500");
  });

  it("el noveno decimal se rechaza, igual que hoy", () => {
    expect(motivo("36,512599991", "tasa")).toBe("decimales");
  });

  it("«1,234.50» se rechaza", () => {
    expect(motivo("1,234.50", "tasa")).toBe("formato");
  });
});

describe("porcentaje", () => {
  it.each([
    ["12", 12],
    ["12,5", 12.5],
    ["12.5", 12.5],
    ["0", 0],
    ["100", 100],
  ])("«%s» → %s", (texto, esperado) => {
    expect(valor(texto, "porcentaje")).toBe(esperado);
  });

  it.each([
    ["1,234", "decimales"],
    ["1.234", "decimales"],
    ["12,345", "decimales"],
    ["100,01", "rango"],
    ["-1", "rango"],
    ["1.000", "decimales"],
    ["1.000.000", "formato"],
    ["1.234,5", "formato"],
  ])("«%s» se rechaza por %s", (texto, esperado) => {
    expect(motivo(texto, "porcentaje")).toBe(esperado);
  });

  it("el porcentaje fiscal puede pedir 3 decimales", () => {
    expect(parsePorcentaje("1,125", { decimales: 3 })).toMatchObject({ ok: true, valor: 1.125 });
  });
});

describe("§2.2 reporte de pago del Portal (lo que hoy entra mil veces menor)", () => {
  it.each([
    ["1250,50", 1250.5],
    ["1.250,50", 1250.5],
  ])("«%s» → %s", (texto, esperado) => {
    expect(valor(texto, "dinero")).toBe(esperado);
  });

  it.each(["1.234", "1.250", "10.000"])("«%s» ya no se acepta: se pide aclarar", (texto) => {
    expect(motivo(texto, "dinero")).toBe("ambiguo");
  });
});

describe("dinero con tres o más decimales (precio por ft³; revisión de la #790, H1)", () => {
  it.each([
    ["3,498", 3.498],
    ["3,4985", 3.4985],
    ["1.234,498", 1234.498],
    ["0.125", 0.125],
  ])("«%s» con decimales 4 → %s (la coma siempre es decimal)", (texto, esperado) => {
    expect(parseDinero(texto, { decimales: 4 })).toMatchObject({ ok: true, valor: esperado });
  });

  it.each(["3.498", "1.250", "1.000", "690.505", "36.500"])(
    "«%s» con decimales 4 sigue pidiendo aclarar: el punto no se adivina",
    (texto) => {
      const r = parseDinero(texto, { decimales: 4 });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.motivo).toBe("ambiguo");
        expect(r.pedirAclarar).toBe(true);
      }
    },
  );

  it("con 2 decimales (el dinero de siempre) la coma de tres cifras sigue ambigua", () => {
    expect(parseDinero("3,498").ok).toBe(false);
    expect(parseDinero("3,498", { decimales: 2 }).ok).toBe(false);
  });

  it("la tasa no cambia: 36.500 sigue pidiéndose aclarar aunque admita 8", () => {
    expect(parseTasa("36.500").ok).toBe(false);
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

// ─────────────────────────────────────────────────────────────────
// Propiedades (§6): con valores generados, no solo ejemplos.
// ─────────────────────────────────────────────────────────────────

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

const VE = new Intl.NumberFormat("es-VE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: "always",
});

describe("propiedad: ida y vuelta en dinero", () => {
  it("mostrar 1.234,50 y volver a leerlo da el mismo monto (2.000 montos)", () => {
    const azar = generador(687);
    for (let i = 0; i < 2000; i++) {
      const centavos = Math.floor(azar() * 10 ** (1 + Math.floor(azar() * 11)));
      const monto = centavos === 0 ? 0 : (azar() < 0.1 ? -centavos : centavos) / 100;
      const mostrado = VE.format(monto);
      const r = parseDinero(mostrado);
      expect(r.ok, `«${mostrado}»`).toBe(true);
      if (r.ok) expect(r.valor).toBe(monto);
    }
  });

  it("el texto que deja el campo al confirmar (coma sin miles) se vuelve a leer igual", () => {
    const azar = generador(2026);
    for (let i = 0; i < 2000; i++) {
      const monto = Math.floor(azar() * 1e9) / 100;
      const editable = String(monto).replace(".", ",");
      expect(valor(editable, "dinero")).toBe(monto);
    }
  });

  it("en tasa, cualquier valor de hasta 8 decimales con coma se lee igual", () => {
    const azar = generador(5);
    for (let i = 0; i < 1000; i++) {
      const tasa = Number((azar() * 1000).toFixed(Math.floor(azar() * 9)));
      const editable = String(tasa).replace(".", ",");
      expect(valor(editable, "tasa")).toBe(tasa);
    }
  });
});

describe("propiedad: un separador único con tres cifras nunca se adivina en dinero", () => {
  it("para todo «d{1,3}[.,]ddd» con entero distinto de cero", () => {
    const azar = generador(1234);
    for (let i = 0; i < 2000; i++) {
      const entero = String(1 + Math.floor(azar() * 999));
      const fraccion = String(Math.floor(azar() * 1000)).padStart(3, "0");
      const separador = azar() < 0.5 ? "." : ",";
      const texto = `${entero}${separador}${fraccion}`;
      expect(motivo(texto, "dinero"), texto).toBe("ambiguo");
      if (separador === ".") expect(motivo(texto, "tasa"), texto).toBe("ambiguo");
      else expect(valor(texto, "tasa")).toBe(Number(`${entero}.${fraccion}`));
      expect(valor(texto, "medida")).toBe(Number(`${entero}.${fraccion}`));
    }
  });
});
