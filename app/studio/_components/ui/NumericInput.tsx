"use client";

/**
 * <NumericInput> · Input numérico con expresiones aritméticas + adornment
 * lateral + preview formateado en tiempo real.
 *
 * Casos de uso (Studio):
 *   - PESO (kg): "236" o "233+2" → muestra "= 235 kg" debajo
 *   - CBM (m³): "0.45 + 0.32 + 0.18" → "= 0.95 m³"
 *   - TARIFA (USD): "12323" → "$" izquierda + "= USD 12,323" debajo
 *   - # CAJAS (count): "5+3+7" → "= 15 cajas"
 *
 * Características:
 *   - Acepta expresiones aritméticas: + − × ÷ ( ) → parsea via
 *     parseNumericExpression (whitelist segura).
 *   - Acepta coma O punto decimal (12.5 o 12,5).
 *   - Acepta valores pegados con adornments ($ 1200, 236 kg) · los
 *     limpia automáticamente.
 *   - Adornment lateral fijo (símbolo $ a la izquierda en currency,
 *     unidad "kg" / "m³" a la derecha en weight/volume/count).
 *   - Preview formateado debajo en tiempo real (con separador de miles
 *     · convención US: punto decimal + coma para miles).
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

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
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

interface NumericInputProps {
  /**
   * Tipo del input · determina el adornment y el formato del preview.
   * Default: "decimal".
   */
  type?: NumericType;
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
  currency = "USD",
  unit,
  precision,
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

  const resolvedUnit = unit ?? DEFAULT_UNIT_BY_TYPE[type];
  const resolvedPrecision = precision ?? DEFAULT_PRECISION_BY_TYPE[type];
  const prefixSymbol = type === "currency" ? SYMBOL_BY_CURRENCY[currency] : "";
  const suffixUnit = resolvedUnit;

  const initial =
    (isControlled ? value : defaultValue) != null
      ? String((isControlled ? value : defaultValue) as number)
      : "";
  const [rawText, setRawText] = useState<string>(initial);
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
    const incoming = value != null ? String(value) : "";
    // Sincronización deliberada del texto de edición con una fuente controlada.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRawText((prev) => {
      const current = parseNumericExpressionDetailed(prev);
      if (current.value === value || lastValid?.value === value) return prev;
      return incoming;
    });
  }, [isControlled, lastValid?.value, value]);

  const parsed = useMemo(
    () => parseNumericExpressionDetailed(rawText),
    [rawText],
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
    currency,
    unit: suffixUnit,
    precision: resolvedPrecision,
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
        : "var(--ink-mute)";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setRawText(next);
    const result = parseNumericExpressionDetailed(next);
    const nextOutOfRange =
      result.value != null &&
      ((min != null && result.value < min) ||
        (max != null && result.value > max));

    if (result.status === "empty") {
      setLastValid(null);
      onChange?.(null);
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
    setRawText(parsed.canonical);
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
      : isControlled && value != null
        ? String(value)
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
        aria-live="polite"
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
  currency: Currency;
  unit: string;
  precision: number;
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
    currency,
    unit,
    precision,
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

  // Formato según type.
  const formatted = formatNumber(parsed.value, precision);
  if (type === "currency") {
    return `= ${currency} ${formatted}`;
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

function formatNumber(n: number, precision: number): string {
  // Convención US: punto decimal + coma para miles · pedido del founder
  // (2026-05-27). El sistema de Preferencias (SDD-0037 futuro) permitirá
  // override por user.
  return n.toLocaleString("en-US", {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}
