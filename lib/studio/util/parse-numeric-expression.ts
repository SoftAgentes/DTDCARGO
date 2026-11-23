/**
 * Parser decimal seguro para <NumericInput>.
 *
 * La expresión se tokeniza y evalúa sin `eval`/`Function`. Cada literal se
 * representa como entero escalado (`BigInt`), por lo que sumas como 0.1 + 0.2
 * producen exactamente 0.3. La división usa 30 decimales y redondeo half-up.
 *
 * Cada literal se interpreta con `interpretarLiteral` de `lib/shared/cifras`
 * según el modo del campo (SDD-0687 §4.2): en dinero «1.234» se rechaza y se
 * pide aclarar; en medida es 1,234. El resultado tampoco puede traer más
 * decimales que los del campo: no se redondea en silencio.
 */

import {
  decimalesDe,
  decimalesDelCampo,
  interpretarLiteral,
  mensajeDecimales,
  rangoDelModo,
  type ModoNumero,
  type MotivoRechazo,
  type OpcionesNumero,
} from "@/lib/shared/cifras";

export type { ModoNumero } from "@/lib/shared/cifras";

export interface ParseResult {
  value: number | null;
  error: string | null;
}

export type NumericExpressionStatus =
  | "empty"
  | "valid"
  | "incomplete"
  | "invalid";

export interface DetailedParseResult extends ParseResult {
  /** Decimal canónico sin separadores de miles ni exponente. */
  canonical: string | null;
  status: NumericExpressionStatus;
  /** `true` si un operando se puede leer de dos maneras (SDD-0687). */
  pedirAclarar?: boolean;
}

const STRIP_RE = /[$€£¥]|kg|m³|cbm|cajas|usd|eur|ves/gi;
const ALLOWED_RE = /^[0-9.,+\-*/()\s]*$/;
const MAX_EXPRESSION_LENGTH = 200;
const MAX_TOKENS = 100;
const DIVISION_SCALE = 30;

class IncompleteExpressionError extends Error {}
class InvalidExpressionError extends Error {}
class InvalidResultError extends Error {}
class RejectedLiteralError extends Error {
  constructor(
    message: string,
    readonly motivo: MotivoRechazo,
    readonly pedirAclarar: boolean,
  ) {
    super(message);
  }
}

class FixedDecimal {
  private constructor(
    readonly coefficient: bigint,
    readonly scale: number,
  ) {}

  static fromCanonical(value: string): FixedDecimal {
    const negative = value.startsWith("-");
    const unsigned = negative ? value.slice(1) : value;
    const [whole = "0", fraction = ""] = unsigned.split(".");
    const digits = `${whole || "0"}${fraction}`;
    const coefficient = BigInt(digits || "0") * (negative ? -1n : 1n);
    return FixedDecimal.normalized(coefficient, fraction.length);
  }

  private static normalized(coefficient: bigint, scale: number): FixedDecimal {
    let nextCoefficient = coefficient;
    let nextScale = scale;
    while (nextScale > 0 && nextCoefficient % 10n === 0n) {
      nextCoefficient /= 10n;
      nextScale -= 1;
    }
    return new FixedDecimal(nextCoefficient, nextScale);
  }

  negate(): FixedDecimal {
    return new FixedDecimal(-this.coefficient, this.scale);
  }

  add(other: FixedDecimal): FixedDecimal {
    const scale = Math.max(this.scale, other.scale);
    const left = this.coefficient * pow10(scale - this.scale);
    const right = other.coefficient * pow10(scale - other.scale);
    return FixedDecimal.normalized(left + right, scale);
  }

  subtract(other: FixedDecimal): FixedDecimal {
    return this.add(other.negate());
  }

  multiply(other: FixedDecimal): FixedDecimal {
    return FixedDecimal.normalized(
      this.coefficient * other.coefficient,
      this.scale + other.scale,
    );
  }

  divide(other: FixedDecimal): FixedDecimal {
    if (other.coefficient === 0n) throw new InvalidResultError();

    const exponent = other.scale + DIVISION_SCALE - this.scale;
    let numerator = this.coefficient;
    let denominator = other.coefficient;
    if (exponent >= 0) numerator *= pow10(exponent);
    else denominator *= pow10(-exponent);

    let quotient = numerator / denominator;
    const remainder = numerator % denominator;
    if (abs(remainder) * 2n >= abs(denominator)) {
      quotient += sameSign(numerator, denominator) ? 1n : -1n;
    }
    return FixedDecimal.normalized(quotient, DIVISION_SCALE);
  }

  toCanonical(): string {
    const negative = this.coefficient < 0n;
    const digits = abs(this.coefficient).toString().padStart(this.scale + 1, "0");
    if (this.scale === 0) return `${negative ? "-" : ""}${digits}`;
    const split = digits.length - this.scale;
    return `${negative ? "-" : ""}${digits.slice(0, split)}.${digits.slice(split)}`;
  }
}

type Token =
  | { type: "number"; value: FixedDecimal }
  | { type: "operator"; value: "+" | "-" | "*" | "/" }
  | { type: "leftParen" }
  | { type: "rightParen" };

class ExpressionParser {
  private index = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): FixedDecimal {
    if (this.tokens.length === 0) throw new IncompleteExpressionError();
    const value = this.parseExpression();
    if (this.index < this.tokens.length) throw new InvalidExpressionError();
    return value;
  }

  private parseExpression(): FixedDecimal {
    let value = this.parseTerm();
    while (this.matchOperator("+") || this.matchOperator("-")) {
      const operator = (this.tokens[this.index - 1] as Extract<Token, { type: "operator" }>).value;
      const right = this.parseTerm();
      value = operator === "+" ? value.add(right) : value.subtract(right);
    }
    return value;
  }

  private parseTerm(): FixedDecimal {
    let value = this.parseUnary();
    while (this.matchOperator("*") || this.matchOperator("/")) {
      const operator = (this.tokens[this.index - 1] as Extract<Token, { type: "operator" }>).value;
      const right = this.parseUnary();
      value = operator === "*" ? value.multiply(right) : value.divide(right);
    }
    return value;
  }

  private parseUnary(): FixedDecimal {
    if (this.matchOperator("+")) return this.parseUnary();
    if (this.matchOperator("-")) return this.parseUnary().negate();
    return this.parsePrimary();
  }

  private parsePrimary(): FixedDecimal {
    const token = this.tokens[this.index];
    if (!token) throw new IncompleteExpressionError();
    if (token.type === "number") {
      this.index += 1;
      return token.value;
    }
    if (token.type === "leftParen") {
      this.index += 1;
      const value = this.parseExpression();
      const closing = this.tokens[this.index];
      if (!closing) throw new IncompleteExpressionError();
      if (closing.type !== "rightParen") throw new InvalidExpressionError();
      this.index += 1;
      return value;
    }
    throw new InvalidExpressionError();
  }

  private matchOperator(value: "+" | "-" | "*" | "/"): boolean {
    const token = this.tokens[this.index];
    if (token?.type !== "operator" || token.value !== value) return false;
    this.index += 1;
    return true;
  }
}

export function parseNumericExpressionDetailed(
  raw: string,
  modo: ModoNumero,
  opciones: OpcionesNumero = {},
): DetailedParseResult {
  const decimales = decimalesDelCampo(modo, opciones);
  if (typeof raw !== "string") {
    return invalid("Input inválido.");
  }

  const trimmed = raw.trim();
  if (trimmed === "") return empty();
  if (trimmed.length > MAX_EXPRESSION_LENGTH) {
    return invalid("La operación es demasiado larga.");
  }

  const stripped = trimmed.replace(STRIP_RE, "");
  if (stripped.trim() === "") return empty();
  if (!ALLOWED_RE.test(stripped)) {
    return invalid("Solo se permiten números y + − × ÷ ( )");
  }

  try {
    const tokens = tokenize(stripped, modo, decimales);
    if (tokens.length > MAX_TOKENS) {
      return invalid("La operación es demasiado larga.");
    }
    const result = new ExpressionParser(tokens).parse();
    const canonical = result.toCanonical();
    const value = Number(canonical);
    if (!Number.isFinite(value)) return invalid("Número fuera de rango.");
    if (decimalesDe(canonical) > decimales) {
      return invalid(
        `El resultado tiene más decimales de los que lleva el campo. ${mensajeDecimales(modo, decimales)}`,
      );
    }
    const fueraDeRango = rangoDelModo(modo, value);
    if (fueraDeRango) return invalid(fueraDeRango);
    return { value, canonical, error: null, status: "valid" };
  } catch (error) {
    if (error instanceof IncompleteExpressionError) {
      return {
        value: null,
        canonical: null,
        error: "Completa la operación.",
        status: "incomplete",
      };
    }
    if (error instanceof InvalidResultError) {
      return invalid("Resultado no válido.");
    }
    if (error instanceof RejectedLiteralError) {
      return { ...invalid(error.message), pedirAclarar: error.pedirAclarar };
    }
    return invalid("Expresión inválida.");
  }
}

/**
 * API histórica: conserva el shape y el mensaje de sintaxis anterior.
 * <NumericInput> usa la variante detallada para distinguir edición incompleta.
 */
export function parseNumericExpression(
  raw: string,
  modo: ModoNumero,
  opciones: OpcionesNumero = {},
): ParseResult {
  const result = parseNumericExpressionDetailed(raw, modo, opciones);
  return {
    value: result.value,
    error:
      result.status === "incomplete" ? "Expresión inválida." : result.error,
  };
}

function tokenize(input: string, modo: ModoNumero, decimales: number): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < input.length) {
    const char = input[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (/[0-9.,]/.test(char)) {
      const start = index;
      while (index < input.length && /[0-9.,]/.test(input[index])) index += 1;
      const literal = interpretarLiteral(input.slice(start, index), modo, { decimales });
      if (!literal.ok) {
        if (literal.motivo === "incompleto") throw new IncompleteExpressionError();
        throw new RejectedLiteralError(literal.mensaje, literal.motivo, literal.pedirAclarar);
      }
      tokens.push({ type: "number", value: FixedDecimal.fromCanonical(literal.canonico) });
      continue;
    }
    if (char === "+" || char === "-" || char === "*" || char === "/") {
      tokens.push({ type: "operator", value: char });
      index += 1;
      continue;
    }
    if (char === "(") {
      tokens.push({ type: "leftParen" });
      index += 1;
      continue;
    }
    if (char === ")") {
      tokens.push({ type: "rightParen" });
      index += 1;
      continue;
    }
    throw new InvalidExpressionError();
  }
  return tokens;
}

function empty(): DetailedParseResult {
  return {
    value: null,
    canonical: null,
    error: null,
    status: "empty",
  };
}

function invalid(error: string): DetailedParseResult {
  return {
    value: null,
    canonical: null,
    error,
    status: "invalid",
  };
}

function pow10(exponent: number): bigint {
  return 10n ** BigInt(exponent);
}

function abs(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function sameSign(left: bigint, right: bigint): boolean {
  return (left < 0n) === (right < 0n);
}
