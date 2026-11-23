"use client";

/**
 * <NumericInput> · Input numérico con expresiones aritméticas + adornment
 * lateral + preview formateado en tiempo real.
 *
 * Casos de uso (Studio):
 *   - PESO (kg): "236" o "233+2" → muestra "= 235,00 kg" debajo
 *   - CBM (m³): "0,45 + 0,32 + 0,18" → "= 0,95 m³"
 *   - TARIFA (USD): "12.323,50" → "$" izquierda + "= 12.323,50" debajo
 *   - # CAJAS (count): "5+3+7" → "= 15"
 *
 * Características:
 *   - Acepta expresiones aritméticas: + − × ÷ ( ) → parsea via
 *     parseNumericExpression (whitelist segura).
 *   - Cada campo tiene un modo (SDD-0687 §4.2): dinero, tasa, porcentaje o
 *     medida. `currency` es dinero; `weight`, `volume` y `count` son medida;
 *     `decimal` obliga a declarar el modo. En dinero «1.234» y «1,234» se
 *     rechazan y se pide aclarar; «12.50» se acepta como 12,50 (decisión 6 A).
 *     En medida el punto o la coma son decimales (decisión 2 A).
 *   - Acepta valores pegados con adornments ($ 1200, 236 kg) · los
 *     limpia automáticamente.
 *   - Adornment lateral fijo (símbolo $ a la izquierda en currency,
 *     unidad "kg" / "m³" a la derecha en weight/volume/count).
 *   - Debajo, lo que entendió en formato venezolano: punto de miles y coma
 *     decimal («= 1.234,50»). La tasa se ve con 2 a 4 decimales (decisión 5 B).
 *   - Un texto rechazado (ambiguo, con formato de EE. UU. o con más decimales
 *     de los del campo) no deja vivo el valor anterior: emite `null`, para
 *     que nunca se guarde un monto intermedio mil veces menor.
 *   - Hidden input con el decimal canónico para form submission.
 *   - Una expresión incompleta conserva el último valor válido y solo se
 *     presenta como error al confirmar (blur, Tab, Enter o submit).
 *
 * NO reformatea el input en vivo (evita cursor jumping) · el formato
 * visible vive en el preview de abajo.
 *
 * Regla del estándar de botones del Studio (CLAUDE.md): TODOS los inputs
 * numéricos deben usar este componente para consistencia visual + lectura
 * rápida del operador.
 */

import { formatCbm } from "@/lib/shared/cbm";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { DECIMALES_POR_MODO, type ModoNumero } from "@/lib/shared/cifras";
import {
  parseNumericExpressionDetailed,
  type DetailedParseResult,
} from "@/lib/studio/util/parse-numeric-expression";

type NumericType =
  | "currency"
  | "weight"
  | "volume"
  | "count"
  | "decimal";

type Currency = "USD" | "EUR" | "VES";

interface NumericInputBaseProps {
  /** Solo aplica si type=currency. Default: USD. */
  currency?: Currency;
  /**
   * Sufijo de unidad para weight / volume / count. Defaults:
   *   weight  → "kg"
   *   volume  → "m³"
   *   count   → "" (sin sufijo · el contexto lo da el label)
   *   decimal → "" (sin sufijo)
   */
  unit?: string;
  /** Cantidad de decimales para el preview. Defaults: 0 (count) / 2 (otros). */
  precision?: number;
  /**
   * Decimales máximos que acepta al teclear, si difieren de los del modo
   * (dinero 2, tasa 8, porcentaje 2, medida 4). Más decimales se rechazan.
   */
  decimales?: number;
  /** name del form field · el hidden input lo usa. */
  name?: string;
  /** id HTML del input (el preview se asocia via aria-describedby). */
  id?: string;
  /** Valor controlado (number) o uncontrolled (defaultValue). */
  value?: number | null;
  defaultValue?: number | null;
  /**
   * Callback con el number parseado. Una edición incompleta o inválida no
   * emite `null`: conserva el último valor válido. Vaciar sí emite `null`.
   */
  onChange?: (value: number | null) => void;
  /** Standard input props. */
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  min?: number;
  max?: number;
  "aria-invalid"?: boolean;
  "aria-label"?: string;
  /** Una ayuda propia del campo; se suma a la vista previa (SDD-0569). */
  "aria-describedby"?: string;
}

/**
 * `type` determina el adornment y el formato del preview (default
 * "decimal"). Con "decimal" el modo es obligatorio: puede ser una tasa, un
 * porcentaje, una cantidad o un monto en otra moneda, y no se adivina.
 */
type NumericInputProps = NumericInputBaseProps &
  (
    | { type?: "decimal"; modo: ModoNumero }
    | { type: Exclude<NumericType, "decimal">; modo?: ModoNumero }
  );

const MODO_POR_TYPE: Record<Exclude<NumericType, "decimal">, ModoNumero> = {
  currency: "dinero",
  weight: "medida",
  volume: "medida",
  count: "medida",
};

const SYMBOL_BY_CURRENCY: Record<Currency, string> = {
  USD: "$",
  EUR: "€",
  VES: "Bs.",
};

const DEFAULT_UNIT_BY_TYPE: Record<NumericType, string> = {
  currency: "",
  weight: "kg",
  volume: "m³",
  count: "",
  decimal: "",
};

const DEFAULT_PRECISION_BY_TYPE: Record<NumericType, number> = {
  currency: 2,
  weight: 2,
  volume: 2,
  count: 0,
  decimal: 2,
};

export function NumericInput({
  type = "decimal",
  modo: modoProp,
  currency = "USD",
  unit,
  precision,
  decimales,
  name,
  id,
  value,
  defaultValue,
  onChange,
  placeholder,
  required,
  disabled,
  min,
  max,
  "aria-invalid": ariaInvalid,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
}: NumericInputProps) {
  const isControlled = value !== undefined;
  const autoId = useId();
  const inputId = id ?? `num-${autoId}`;
  const previewId = `${inputId}-preview`;

  const modo: ModoNumero =
    modoProp ?? (type === "decimal" ? "medida" : MODO_POR_TYPE[type]);
  const opciones = useMemo(() => ({ decimales }), [decimales]);
  const resolvedUnit = unit ?? DEFAULT_UNIT_BY_TYPE[type];
  const resolvedPrecision = precision ?? DEFAULT_PRECISION_BY_TYPE[type];
  const prefixSymbol = type === "currency" ? SYMBOL_BY_CURRENCY[currency] : "";
  const suffixUnit = resolvedUnit;

  const initialValue = isControlled ? value : defaultValue;
  const initial = initialValue != null ? canonicalOf(initialValue) : "";
  const [rawText, setRawText] = useState<string>(toEditableText(initial));
  const [hasValidated, setHasValidated] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [lastValid, setLastValid] = useState<{
    value: number;
    canonical: string;
  } | null>(
    initial === ""
      ? null
      : {
          value: Number(initial),
          canonical: initial,
        },
  );

  // Si el value controlado cambia desde el padre, sincronizamos.
  useEffect(() => {
    if (!isControlled) return;
    const incoming = value != null ? toEditableText(canonicalOf(value)) : "";
    // Sincronización deliberada del texto de edición con una fuente controlada.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRawText((prev) => {
      const current = parseNumericExpressionDetailed(prev, modo, opciones);
      if (current.value === value || lastValid?.value === value) return prev;
      return incoming;
    });
  }, [isControlled, lastValid?.value, modo, opciones, value]);

  const parsed = useMemo(
    () => parseNumericExpressionDetailed(rawText, modo, opciones),
    [modo, opciones, rawText],
  );

  // Validación contra min/max · solo soft (visual) · el form submit
  // valida con HTML5 nativo via hidden input.
  const outOfRange =
    parsed.value != null &&
    ((min != null && parsed.value < min) ||
      (max != null && parsed.value > max));
  const localInvalid =
    parsed.status === "invalid" ||
    parsed.status === "incomplete" ||
    outOfRange;
  const showLocalError = hasValidated && localInvalid;

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    if (parsed.status === "invalid" || parsed.status === "incomplete") {
      input.setCustomValidity(parsed.error ?? "Expresión inválida.");
      return;
    }
    if (outOfRange) {
      input.setCustomValidity(buildRangeError(parsed.value, min, max));
      return;
    }
    input.setCustomValidity("");
  }, [max, min, outOfRange, parsed.error, parsed.status, parsed.value]);

  const previewText = buildPreview({
    parsed,
    rawText,
    type,
    modo,
    maxDecimals: decimales ?? DECIMALES_POR_MODO[modo],
    currency,
    unit: suffixUnit,
    precision: resolvedPrecision,
    precisionIsDefault: precision === undefined,
    outOfRange: showLocalError && outOfRange,
    showError: showLocalError,
    min,
    max,
  });

  const previewTone: "neutral" | "muted" | "error" = showLocalError
    ? "error"
    : parsed.value != null
      ? "neutral"
      : "muted";

  const previewColor =
    previewTone === "error"
      ? "var(--danger)"
      : previewTone === "neutral"
        ? "var(--ink-soft)"
        : "var(--ink-soft)";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setRawText(next);
    const result = parseNumericExpressionDetailed(next, modo, opciones);
    const nextOutOfRange =
      result.value != null &&
      ((min != null && result.value < min) ||
        (max != null && result.value > max));

    if (result.status === "empty") {
      setLastValid(null);
      onChange?.(null);
      return;
    }
    if (result.status === "invalid") {
      // SDD-0687: «1.234» en dinero no puede dejar vivo el «1.23» que se
      // tecleó antes; el campo queda sin valor hasta que se aclare.
      if (lastValid !== null) {
        setLastValid(null);
        onChange?.(null);
      }
      return;
    }
    if (
      result.status === "valid" &&
      result.value != null &&
      result.canonical != null &&
      !nextOutOfRange
    ) {
      setLastValid({
        value: result.value,
        canonical: result.canonical,
      });
      onChange?.(result.value);
    }
  };

  const commit = () => {
    setHasValidated(true);
    if (
      parsed.status !== "valid" ||
      parsed.value == null ||
      parsed.canonical == null ||
      outOfRange
    ) {
      return;
    }
    setLastValid({
      value: parsed.value,
      canonical: parsed.canonical,
    });
    setRawText(toEditableText(parsed.canonical));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    commit();
  };

  // Padding del input según los adornments visibles.
  const paddingLeft = prefixSymbol ? 30 : 12;
  const paddingRight = suffixUnit ? 44 : 12;

  // En edición inválida se conserva el valor anterior; la validez HTML del
  // input visible bloquea el submit hasta resolver la expresión.
  const hiddenValue =
    parsed.status === "valid" && !outOfRange
      ? (parsed.canonical ?? "")
      : parsed.status === "invalid"
        ? ""
        : isControlled && value != null
          ? canonicalOf(value)
          : (lastValid?.canonical ?? "");

  return (
    <div style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        {prefixSymbol && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              font: "600 13px/1 var(--f-mono)",
              color: "var(--ink-soft)",
              pointerEvents: "none",
            }}
          >
            {prefixSymbol}
          </span>
        )}
        <input
          ref={inputRef}
          id={inputId}
          // type="text" porque "number" no acepta expresiones · validamos
          // numéricamente en parseNumericExpression.
          type="text"
          inputMode={type === "count" ? "numeric" : "decimal"}
          autoComplete="off"
          className="studio-input"
          style={{
            paddingLeft,
            paddingRight,
            fontFamily: "var(--f-mono)",
            fontWeight: 600,
            letterSpacing: "0.02em",
          }}
          value={rawText}
          onChange={handleChange}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          onInvalid={() => setHasValidated(true)}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          aria-invalid={ariaInvalid || showLocalError}
          aria-describedby={ariaDescribedBy ? `${ariaDescribedBy} ${previewId}` : previewId}
          aria-label={ariaLabel}
          data-numeric-status={parsed.status}
          data-numeric-modo={modo}
        />
        {suffixUnit && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              right: 12,
              top: "50%",
              transform: "translateY(-50%)",
              font: "700 11px/1 var(--f-sans)",
              color: "var(--ink-soft)",
              letterSpacing: "0.04em",
              pointerEvents: "none",
              textTransform: type === "weight" || type === "volume" ? "lowercase" : "none",
            }}
          >
            {suffixUnit}
          </span>
        )}
      </div>
      <div
        id={previewId}
        role={showLocalError ? "alert" : undefined}
        style={{
          minHeight: 18,
          marginTop: 4,
          font: "500 11.5px/1.3 var(--f-mono)",
          color: previewColor,
          letterSpacing: "0.02em",
        }}
      >
        {previewText}
      </div>
      {name && <input type="hidden" name={name} value={hiddenValue} />}
    </div>
  );
}

interface BuildPreviewArgs {
  parsed: DetailedParseResult;
  rawText: string;
  type: NumericType;
  modo: ModoNumero;
  maxDecimals: number;
  currency: Currency;
  unit: string;
  precision: number;
  precisionIsDefault: boolean;
  outOfRange: boolean;
  showError: boolean;
  min?: number;
  max?: number;
}

function buildPreview(args: BuildPreviewArgs): ReactNode {
  const {
    parsed,
    rawText,
    type,
    modo,
    maxDecimals,
    unit,
    precision,
    precisionIsDefault,
    outOfRange,
    showError,
    min,
    max,
  } = args;

  if (parsed.error) return showError ? parsed.error : " ";

  if (parsed.value == null) {
    // Vacío o solo decoración.
    if (rawText.trim() === "") return " "; // nbsp · mantiene altura
    return " ";
  }

  if (outOfRange) {
    if (min != null && parsed.value < min) {
      return `Mínimo ${formatNumber(min, precision)}`;
    }
    if (max != null && parsed.value > max) {
      return `Máximo ${formatNumber(max, precision)}`;
    }
  }

  // Lo entendido, en formato venezolano (SDD-0687).
  // CBM: hasta 4 decimales sin ceros de relleno (lib/shared/cbm).
  // Tasa: de 2 a 4 decimales (decisión 5 B).
  // Medida: nunca esconde un decimal tecleado (decisión 2 A: «= 1,234»).
  const formatted =
    type === "volume" && precisionIsDefault
      ? formatCbm(parsed.value, { locale: "es-VE" })
      : modo === "tasa" && precisionIsDefault
        ? formatNumber(parsed.value, 2, 4)
        : modo === "medida"
          ? formatNumber(parsed.value, precision, Math.max(precision, maxDecimals))
          : formatNumber(parsed.value, precision);
  if (type === "currency") {
    return `= ${formatted}`;
  }
  if (unit) {
    return `= ${formatted} ${unit}`;
  }
  return `= ${formatted}`;
}

function buildRangeError(
  value: number | null,
  min?: number,
  max?: number,
): string {
  if (value != null && min != null && value < min) return `Mínimo ${min}.`;
  if (value != null && max != null && value > max) return `Máximo ${max}.`;
  return "Valor fuera de rango.";
}

function formatNumber(n: number, minDecimals: number, maxDecimals = minDecimals): string {
  // Formato venezolano: punto de miles y coma decimal (Sam, 2026-11-20,
  // SDD-0687). Fijo, sin depender del idioma del equipo; `useGrouping`
  // explícito para que 1234 también lleve punto.
  return new Intl.NumberFormat("es-VE", {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
    useGrouping: "always",
  }).format(n === 0 ? 0 : n);
}

/** Decimal de máquina sin exponente: 1e-7 → "0.0000001". */
function canonicalOf(n: number): string {
  const text = String(n);
  if (!/e/i.test(text)) return text;
  return n.toFixed(20).replace(/\.?0+$/, "");
}

/**
 * Texto que se deja en el campo al confirmar o al recibir un valor: el
 * decimal con coma y sin miles («1234,5»). Así se vuelve a leer igual en
 * todos los modos: «36.512» en tasa se pediría aclarar; «36,512» no.
 */
function toEditableText(canonical: string): string {
  return canonical.replace(".", ",");
}
