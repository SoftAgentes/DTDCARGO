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
 *   - Hidden input con el value canónico (number) para form submission.
 *
 * NO reformatea el input en vivo (evita cursor jumping) · el formato
 * visible vive en el preview de abajo.
 *
 * Regla del estándar de botones del Studio (CLAUDE.md): TODOS los inputs
 * numéricos deben usar este componente para consistencia visual + lectura
 * rápida del operador.
 */

import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { parseNumericExpression } from "@/lib/studio/util/parse-numeric-expression";

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
  /** Callback con el number parseado (o null si está vacío/inválido). */
  onChange?: (value: number | null) => void;
  /** Standard input props. */
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  min?: number;
  max?: number;
  "aria-invalid"?: boolean;
  "aria-label"?: string;
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

  // Si el value controlado cambia desde el padre, sincronizamos.
  useEffect(() => {
    if (!isControlled) return;
    const incoming = value != null ? String(value) : "";
    setRawText((prev) => {
      // Solo sobrescribimos si el number del padre difiere del current parseado.
      const current = parseNumericExpression(prev).value;
      if (current === value) return prev;
      return incoming;
    });
  }, [isControlled, value]);

  // Parse en cada keystroke · barato (regex + opcionalmente Function eval).
  const parsed = useMemo(() => parseNumericExpression(rawText), [rawText]);

  // Validación contra min/max · solo soft (visual) · el form submit
  // valida con HTML5 nativo via hidden input.
  const outOfRange =
    parsed.value != null &&
    ((min != null && parsed.value < min) ||
      (max != null && parsed.value > max));

  const previewText = buildPreview({
    parsed,
    rawText,
    type,
    currency,
    unit: suffixUnit,
    precision: resolvedPrecision,
    outOfRange,
    min,
    max,
  });

  const previewTone: "neutral" | "muted" | "error" = parsed.error
    ? "error"
    : outOfRange
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
    if (onChange) {
      const r = parseNumericExpression(next);
      onChange(r.value);
    }
  };

  // Padding del input según los adornments visibles.
  const paddingLeft = prefixSymbol ? 30 : 12;
  const paddingRight = suffixUnit ? 44 : 12;

  // Hidden input con el value canónico (number) · este es el que va al
  // form submit, no el rawText con la expresión.
  const hiddenValue = parsed.value != null ? String(parsed.value) : "";

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
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          aria-invalid={ariaInvalid || !!parsed.error || outOfRange}
          aria-describedby={previewId}
          aria-label={ariaLabel}
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
        role={parsed.error || outOfRange ? "alert" : undefined}
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
  parsed: ReturnType<typeof parseNumericExpression>;
  rawText: string;
  type: NumericType;
  currency: Currency;
  unit: string;
  precision: number;
  outOfRange: boolean;
  min?: number;
  max?: number;
}

function buildPreview(args: BuildPreviewArgs): ReactNode {
  const { parsed, rawText, type, currency, unit, precision, outOfRange, min, max } = args;

  if (parsed.error) return parsed.error;

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

function formatNumber(n: number, precision: number): string {
  // Convención US: punto decimal + coma para miles · pedido del founder
  // (2026-05-27). El sistema de Preferencias (SDD-0037 futuro) permitirá
  // override por user.
  return n.toLocaleString("en-US", {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}
