/**
 * parseNumericExpression · Parser seguro de expresiones aritméticas
 * básicas para inputs numéricos del Studio (`<NumericInput>`).
 *
 * Acepta:
 *   - Números simples: "236", "12.50", "12,50" (coma o punto decimal)
 *   - Expresiones con +, -, *, /, paréntesis: "233+2", "0.45 + 0.32 + 0.18"
 *   - Espacios en blanco
 *   - Símbolos de prefijo de moneda y sufijos de unidad (se filtran):
 *     "$ 1200", "236 kg", "0.45 m³"
 *
 * NO acepta:
 *   - Letras (excepto la "e" de notación científica · descartada)
 *   - Operadores avanzados (^, %, etc.)
 *   - Llamadas a funciones (Math.foo, eval, etc.)
 *   - Strings vacíos · devuelve { value: null, error: null }
 *
 * Cómo es seguro sin usar eval crudo:
 *   1. Whitelist regex estricto: solo `0-9 . + - * / ( ) espacio`.
 *      Si el input contiene CUALQUIER otro carácter, retorna error.
 *   2. Después de la whitelist, evalúa con `new Function('return ' + expr)`.
 *      Como ya pasamos por la regex, no puede contener llamadas, accesos
 *      a propiedades, ni nada más allá de aritmética básica.
 *   3. Resultado debe ser un número finito · NaN, Infinity, etc. devuelven
 *      error.
 *
 * Convención decimal:
 *   - Input acepta tanto coma `12,50` como punto `12.50`.
 *   - Internamente convierte coma a punto antes de evaluar.
 *   - Output siempre es number nativo · el formato visual lo decide
 *     el componente caller.
 */

export interface ParseResult {
  /** Número resuelto · null si el input está vacío. */
  value: number | null;
  /** Mensaje de error si la expresión es inválida · null si OK. */
  error: string | null;
}

const STRIP_RE = /[$€£¥\s]|kg|m³|cbm|cajas|usd|eur|ves/gi;
const ALLOWED_RE = /^[0-9.,+\-*/()\s]*$/;

export function parseNumericExpression(raw: string): ParseResult {
  if (typeof raw !== "string") {
    return { value: null, error: "Input inválido." };
  }
  const trimmed = raw.trim();
  if (trimmed === "") return { value: null, error: null };

  // 1. Limpiar adornments visuales que el operador puede pegar (símbolos
  // de moneda, unidades). Lo hacemos antes del whitelist para que el
  // usuario pueda copiar/pegar valores formateados sin frustrarse.
  const stripped = trimmed.replace(STRIP_RE, "");

  // 2. Si quedó vacío después de strip · era solo decoración.
  if (stripped === "") return { value: null, error: null };

  // 3. Convertir coma decimal a punto. Convención: el LAST separador
  // determina el decimal. Si hay puntos Y comas (formato "1.200,50"
  // mezclado europeo), tratamos los puntos previos como thousand
  // separators y la última coma como decimal.
  const normalized = normalizeDecimal(stripped);

  // 4. Whitelist · solo aritmética básica permitida.
  if (!ALLOWED_RE.test(normalized)) {
    return { value: null, error: "Solo se permiten números y + − × ÷ ( )" };
  }

  // 5. Si solo hay dígitos / punto · evitamos `new Function` y parseamos
  // directo · más rápido y elimina riesgo de edge cases.
  if (/^-?\d+(?:\.\d+)?$/.test(normalized)) {
    const n = Number(normalized);
    if (!Number.isFinite(n)) {
      return { value: null, error: "Número fuera de rango." };
    }
    return { value: n, error: null };
  }

  // 6. Expresión aritmética · evaluar con Function (seguro post-whitelist).
  // Detectamos errores de sintaxis y resultados no finitos.
  let result: unknown;
  try {
    // eslint-disable-next-line no-new-func
    result = new Function(`"use strict"; return (${normalized});`)();
  } catch {
    return { value: null, error: "Expresión inválida." };
  }
  if (typeof result !== "number" || !Number.isFinite(result)) {
    return { value: null, error: "Resultado no válido." };
  }
  return { value: result, error: null };
}

/**
 * Normaliza coma decimal a punto. Estrategia:
 *   - Si NO hay comas → tal cual (puntos son decimales o thousand
 *     separators según ALLOWED_RE permite).
 *   - Si hay 1 sola coma y NO hay puntos → la coma es decimal.
 *   - Si hay comas Y puntos → asumimos formato europeo "1.200,50"
 *     · puntos son thousands (los eliminamos) y la coma final es decimal.
 *   - Si hay múltiples comas (formato "1,200,500") → asumimos formato US
 *     · comas son thousands (las eliminamos), no hay decimal.
 */
function normalizeDecimal(s: string): string {
  const commas = (s.match(/,/g) || []).length;
  const dots = (s.match(/\./g) || []).length;
  if (commas === 0) return s;
  if (commas === 1 && dots === 0) {
    // Una coma sola · es decimal.
    return s.replace(",", ".");
  }
  if (commas >= 1 && dots >= 1) {
    // Formato europeo "1.200,50" · puntos son thousands, coma decimal.
    return s.replace(/\./g, "").replace(",", ".");
  }
  // Múltiples comas sin puntos · formato US "1,200,500" · todas thousands.
  return s.replace(/,/g, "");
}
