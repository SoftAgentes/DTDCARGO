// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  parseNumericExpression,
  parseNumericExpressionDetailed,
} from "@/lib/studio/util/parse-numeric-expression";
import { MENSAJE_FORMATO, type ModoNumero } from "@/lib/shared/cifras";

/**
 * Tests del parser seguro de expresiones aritméticas para inputs
 * numéricos del Studio (`<NumericInput>`).
 *
 * Cubre el comportamiento documentado en parse-numeric-expression.ts:
 * - Números simples (punto / coma decimal)
 * - Expresiones aritméticas (+, -, *, /, paréntesis)
 * - Strip de adornos visuales (moneda, unidades, sufijos)
 * - Formato 1.200,50 por literal y por modo (SDD-0687); «1,200,500» se rechaza
 *
 * Los casos de siempre corren en modo medida, el que conserva la regla vieja
 * (punto o coma decimal). Los casos por modo están en «modos (SDD-0687)».
 * - Vacío / solo-decoración → { value: null, error: null }
 * - Caracteres no permitidos → error
 * - Entrada no-string → error
 * - Resultado no finito (división por cero) → error
 * - Whitespace y signos negativos
 *
 * Convención de retorno: ParseResult { value: number|null, error: string|null }.
 *   - OK            → value es number, error es null
 *   - vacío/deco    → value null, error null (NO es un error, es "sin dato")
 *   - inválido      → value null, error es un mensaje string
 */
describe("parseNumericExpression", () => {
  // ─────────────────────────────────────────────────────────────────
  // Números simples
  // ─────────────────────────────────────────────────────────────────
  describe("números simples", () => {
    it("parsea un entero", () => {
      expect(parseNumericExpression("236", "medida")).toEqual({ value: 236, error: null });
    });

    it("parsea un decimal con punto", () => {
      expect(parseNumericExpression("12.50", "medida")).toEqual({ value: 12.5, error: null });
    });

    it("parsea un decimal con coma (coma → punto)", () => {
      expect(parseNumericExpression("12,50", "medida")).toEqual({ value: 12.5, error: null });
    });

    it("coma y punto decimal producen el mismo valor", () => {
      const conComa = parseNumericExpression("1,5", "medida");
      const conPunto = parseNumericExpression("1.5", "medida");
      expect(conComa).toEqual({ value: 1.5, error: null });
      expect(conPunto).toEqual({ value: 1.5, error: null });
      expect(conComa.value).toBe(conPunto.value);
    });

    it("parsea el cero", () => {
      expect(parseNumericExpression("0", "medida")).toEqual({ value: 0, error: null });
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Expresiones aritméticas
  // ─────────────────────────────────────────────────────────────────
  describe("expresiones aritméticas", () => {
    it("suma simple: 233+2 → 235", () => {
      expect(parseNumericExpression("233+2", "medida")).toEqual({ value: 235, error: null });
    });

    it("suma de varios decimales: 0.45 + 0.32 + 0.18 → 0.95", () => {
      const r = parseNumericExpression("0.45 + 0.32 + 0.18", "medida");
      expect(r.error).toBeNull();
      expect(r.value).toBeCloseTo(0.95, 10);
    });

    it("resta: 3-1 → 2", () => {
      expect(parseNumericExpression("3-1", "medida")).toEqual({ value: 2, error: null });
    });

    it("multiplicación y paréntesis: 2*(3+4) → 14", () => {
      expect(parseNumericExpression("2*(3+4)", "medida")).toEqual({ value: 14, error: null });
    });

    it("división: 10 / 4 → 2.5", () => {
      expect(parseNumericExpression("10 / 4", "medida")).toEqual({ value: 2.5, error: null });
    });

    it("combina todos los operadores: (10 + 2) / 4 * 3 → 9", () => {
      expect(parseNumericExpression("(10 + 2) / 4 * 3", "medida")).toEqual({
        value: 9,
        error: null,
      });
    });

    it("conserva precisión decimal contable: 0.1 + 0.2 → 0.3", () => {
      const result = parseNumericExpressionDetailed("0.1 + 0.2", "medida");
      expect(result).toEqual({
        value: 0.3,
        canonical: "0.3",
        error: null,
        status: "valid",
      });
    });

    it("redondea división a 30 decimales con estrategia half-up", () => {
      // Con 30 decimales permitidos: la división no se recorta en silencio.
      const result = parseNumericExpressionDetailed("2 / 3", "medida", { decimales: 30 });
      expect(result.canonical).toBe("0.666666666666666666666666666667");
    });

    it("clasifica un operador final como edición incompleta", () => {
      expect(parseNumericExpressionDetailed("10+", "medida")).toEqual({
        value: null,
        canonical: null,
        error: "Completa la operación.",
        status: "incomplete",
      });
      expect(parseNumericExpression("10+", "medida")).toEqual({
        value: null,
        error: "Expresión inválida.",
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Whitespace
  // ─────────────────────────────────────────────────────────────────
  describe("whitespace", () => {
    it("ignora espacios alrededor del número", () => {
      expect(parseNumericExpression("  236  ", "medida")).toEqual({ value: 236, error: null });
    });

    it("ignora espacios entre operandos y operadores", () => {
      expect(parseNumericExpression("233 + 2", "medida")).toEqual({ value: 235, error: null });
    });

    it("tabs y saltos de línea se tratan como whitespace", () => {
      expect(parseNumericExpression("\t236\n", "medida")).toEqual({ value: 236, error: null });
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Signos negativos
  // ─────────────────────────────────────────────────────────────────
  describe("signos negativos", () => {
    it("entero negativo: -5", () => {
      expect(parseNumericExpression("-5", "medida")).toEqual({ value: -5, error: null });
    });

    it("decimal negativo: -5.5", () => {
      expect(parseNumericExpression("-5.5", "medida")).toEqual({ value: -5.5, error: null });
    });

    it("resta con espacios: 3 - 1 → 2", () => {
      expect(parseNumericExpression("3 - 1", "medida")).toEqual({ value: 2, error: null });
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Strip de adornos (moneda, unidades, sufijos)
  // ─────────────────────────────────────────────────────────────────
  describe("strip de adornos visuales", () => {
    it("prefijo de moneda $: '$ 1200' → 1200", () => {
      expect(parseNumericExpression("$ 1200", "medida")).toEqual({ value: 1200, error: null });
    });

    it("sufijo de unidad kg: '236 kg' → 236", () => {
      expect(parseNumericExpression("236 kg", "medida")).toEqual({ value: 236, error: null });
    });

    it("sufijo de unidad m³: '0.45 m³' → 0.45", () => {
      expect(parseNumericExpression("0.45 m³", "medida")).toEqual({ value: 0.45, error: null });
    });

    it("sufijo cbm: '100 cbm' → 100", () => {
      expect(parseNumericExpression("100 cbm", "medida")).toEqual({ value: 100, error: null });
    });

    it("sufijo cajas: '12 cajas' → 12", () => {
      expect(parseNumericExpression("12 cajas", "medida")).toEqual({ value: 12, error: null });
    });

    it("sufijo usd: '5 usd' → 5", () => {
      expect(parseNumericExpression("5 usd", "medida")).toEqual({ value: 5, error: null });
    });

    it("sufijo eur (case-insensitive): '10 EUR' → 10", () => {
      expect(parseNumericExpression("10 EUR", "medida")).toEqual({ value: 10, error: null });
    });

    it("sufijo ves: '7 ves' → 7", () => {
      expect(parseNumericExpression("7 ves", "medida")).toEqual({ value: 7, error: null });
    });

    it("strip funciona aunque no haya espacio: '5usd' → 5", () => {
      expect(parseNumericExpression("5usd", "medida")).toEqual({ value: 5, error: null });
    });

    it("otros símbolos de moneda (€ £ ¥) se filtran", () => {
      expect(parseNumericExpression("€100", "medida")).toEqual({ value: 100, error: null });
      expect(parseNumericExpression("£100", "medida")).toEqual({ value: 100, error: null });
      expect(parseNumericExpression("¥100", "medida")).toEqual({ value: 100, error: null });
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Normalización de formato: europeo vs US
  // ─────────────────────────────────────────────────────────────────
  describe("normalización de miles/decimales", () => {
    it("formato europeo '1.200,50' → 1200.5 (puntos miles, coma decimal)", () => {
      expect(parseNumericExpression("1.200,50", "medida")).toEqual({
        value: 1200.5,
        error: null,
      });
    });

    it("formato US '1,200,500' se rechaza: la coma es el decimal (SDD-0687)", () => {
      expect(parseNumericExpression("1,200,500", "medida")).toEqual({
        value: null,
        error: MENSAJE_FORMATO,
      });
    });

    it("una sola coma sin punto se interpreta como decimal", () => {
      expect(parseNumericExpression("1,5", "medida")).toEqual({ value: 1.5, error: null });
    });

    it("normaliza cada operando europeo por separado", () => {
      expect(parseNumericExpression("1,5 + 2,5", "medida")).toEqual({
        value: 4,
        error: null,
      });
      expect(parseNumericExpression("1.200,50 + 2.300,50", "medida")).toEqual({
        value: 3501,
        error: null,
      });
    });

    it("rechaza agrupaciones de miles ambiguas", () => {
      expect(parseNumericExpression("1,2,3,4", "medida")).toEqual({
        value: null,
        error: MENSAJE_FORMATO,
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Vacío / solo-decoración → { value: null, error: null }
  // (NO es error: representa "sin dato", el caller decide qué hacer)
  // ─────────────────────────────────────────────────────────────────
  describe("vacío y solo-decoración → sin dato (null, null)", () => {
    it("string vacío", () => {
      expect(parseNumericExpression("", "medida")).toEqual({ value: null, error: null });
    });

    it("solo whitespace", () => {
      expect(parseNumericExpression("   ", "medida")).toEqual({ value: null, error: null });
    });

    it("solo símbolo de moneda y espacio", () => {
      expect(parseNumericExpression("$ ", "medida")).toEqual({ value: null, error: null });
    });

    it("solo una unidad sin número", () => {
      expect(parseNumericExpression("kg", "medida")).toEqual({ value: null, error: null });
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Caracteres no permitidos → error (value null, error string)
  // ─────────────────────────────────────────────────────────────────
  describe("caracteres no permitidos → error", () => {
    it("letras arbitrarias", () => {
      const r = parseNumericExpression("abc", "medida");
      expect(r.value).toBeNull();
      expect(r.error).toBe("Solo se permiten números y + − × ÷ ( )");
    });

    it("operador de potencia ^", () => {
      const r = parseNumericExpression("2^3", "medida");
      expect(r.value).toBeNull();
      expect(typeof r.error).toBe("string");
      expect(r.error).toBe("Solo se permiten números y + − × ÷ ( )");
    });

    it("operador de porcentaje %", () => {
      const r = parseNumericExpression("50%", "medida");
      expect(r.value).toBeNull();
      expect(r.error).toBe("Solo se permiten números y + − × ÷ ( )");
    });

    it("notación científica con 'e' se descarta (la e es letra no permitida)", () => {
      const r = parseNumericExpression("2e3", "medida");
      expect(r.value).toBeNull();
      expect(r.error).toBe("Solo se permiten números y + − × ÷ ( )");
    });

    it("una letra suelta en medio de una expresión", () => {
      const r = parseNumericExpression("1 e 3", "medida");
      expect(r.value).toBeNull();
      expect(r.error).toBe("Solo se permiten números y + − × ÷ ( )");
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Sintaxis aritmética inválida → error "Expresión inválida."
  // (pasa el whitelist pero new Function falla al evaluar)
  // ─────────────────────────────────────────────────────────────────
  describe("sintaxis aritmética inválida → error", () => {
    it("paréntesis sin cerrar", () => {
      const r = parseNumericExpression("(2+3", "medida");
      expect(r.value).toBeNull();
      expect(r.error).toBe("Expresión inválida.");
    });

    it("múltiples puntos decimales en un número", () => {
      const r = parseNumericExpression("1.2.3", "medida");
      expect(r.value).toBeNull();
      expect(r.error).toBe(MENSAJE_FORMATO);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Entrada no-string → error "Input inválido."
  // ─────────────────────────────────────────────────────────────────
  describe("entrada no-string → error", () => {
    it("null", () => {
      const r = parseNumericExpression(null as unknown as string, "medida");
      expect(r.value).toBeNull();
      expect(r.error).toBe("Input inválido.");
    });

    it("undefined", () => {
      const r = parseNumericExpression(undefined as unknown as string, "medida");
      expect(r.value).toBeNull();
      expect(r.error).toBe("Input inválido.");
    });

    it("number", () => {
      const r = parseNumericExpression(42 as unknown as string, "medida");
      expect(r.value).toBeNull();
      expect(r.error).toBe("Input inválido.");
    });

    it("objeto", () => {
      const r = parseNumericExpression({} as unknown as string, "medida");
      expect(r.value).toBeNull();
      expect(r.error).toBe("Input inválido.");
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Resultado no finito → error "Resultado no válido."
  // ─────────────────────────────────────────────────────────────────
  describe("resultado no finito → error", () => {
    it("división por cero: 1/0 (Infinity)", () => {
      const r = parseNumericExpression("1/0", "medida");
      expect(r.value).toBeNull();
      expect(r.error).toBe("Resultado no válido.");
    });

    it("cero dividido cero: 0/0 (NaN)", () => {
      const r = parseNumericExpression("0/0", "medida");
      expect(r.value).toBeNull();
      expect(r.error).toBe("Resultado no válido.");
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Invariante de contrato: cuando hay value, error es null y viceversa
  // (salvo el caso "sin dato" donde ambos son null)
  // ─────────────────────────────────────────────────────────────────
  describe("invariante del ParseResult", () => {
    it("si value es un número entonces error es null", () => {
      const r = parseNumericExpression("123.45", "medida");
      expect(typeof r.value).toBe("number");
      expect(r.error).toBeNull();
    });

    it("si error es string entonces value es null", () => {
      const r = parseNumericExpression("abc", "medida");
      expect(typeof r.error).toBe("string");
      expect(r.value).toBeNull();
    });
  });
});

describe("modos (SDD-0687 §2.1): cada operando se lee según el campo", () => {
  function valor(texto: string, modo: ModoNumero) {
    return parseNumericExpressionDetailed(texto, modo).value;
  }

  it.each([
    ["1.234,50", "dinero", 1234.5],
    ["12.50", "dinero", 12.5],
    ["12,50", "dinero", 12.5],
    ["1.234", "medida", 1.234],
    ["1,234", "medida", 1.234],
    ["36,500", "tasa", 36.5],
    ["1.234,50 + 765,50", "dinero", 2000],
    ["$ 1.234,50", "dinero", 1234.5],
    ["-12,50", "dinero", -12.5],
  ] as const)("«%s» en %s → %s", (texto, modo, esperado) => {
    expect(valor(texto, modo)).toBe(esperado);
  });

  it.each([
    ["1.234", "dinero"],
    ["1,234", "dinero"],
    ["10,000", "dinero"],
    ["10.000", "dinero"],
    ["100 + 1.250", "dinero"],
    ["-1.234", "dinero"],
    ["36.500", "tasa"],
  ] as const)("«%s» en %s se rechaza y pide aclarar", (texto, modo) => {
    const r = parseNumericExpressionDetailed(texto, modo);
    expect(r.status).toBe("invalid");
    expect(r.value).toBeNull();
    expect(r.pedirAclarar).toBe(true);
    expect(r.error).toMatch(/se puede leer de dos maneras/);
  });

  it.each(["dinero", "medida", "tasa"] as const)("«1,234.50» se rechaza en %s", (modo) => {
    expect(parseNumericExpressionDetailed("1,234.50", modo)).toMatchObject({
      status: "invalid",
      value: null,
      error: MENSAJE_FORMATO,
    });
  });

  it("un resultado con más decimales que el campo se rechaza, no se redondea", () => {
    const r = parseNumericExpressionDetailed("10 / 3", "dinero");
    expect(r.status).toBe("invalid");
    expect(r.error).toMatch(/más decimales/);
    expect(parseNumericExpressionDetailed("10 / 4", "dinero").value).toBe(2.5);
  });

  it("porcentaje fuera de 0 a 100 se rechaza", () => {
    expect(parseNumericExpressionDetailed("60 + 50", "porcentaje").status).toBe("invalid");
    expect(parseNumericExpressionDetailed("60 + 40", "porcentaje").value).toBe(100);
  });

  it("«12,» sigue siendo edición incompleta, no un rechazo", () => {
    expect(parseNumericExpressionDetailed("12,", "dinero").status).toBe("incomplete");
  });

  it("sin modo es un error de programación", () => {
    expect(() =>
      parseNumericExpressionDetailed("12", undefined as unknown as ModoNumero),
    ).toThrow();
  });
});
