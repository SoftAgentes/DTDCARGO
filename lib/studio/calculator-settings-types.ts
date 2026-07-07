/**
 * Tipos + validación del módulo Parámetros del calculador (Fase 3 Slice A).
 * Matchea schema de supabase/migrations/0103_calculator_settings.sql.
 *
 * Estas son las REGLAS escalares del calculador público LCL DDP. La tarifa
 * base (per_cbm) y el piso (min_charge) NO viven acá — siguen en rates.is_public
 * (Fase 2). Acá solo: peso incluido, $/kg excedente, descuento Valencia,
 * multiplicador baterías, km del casco, $/km, recargo de embalaje especial.
 *
 * Sin Zod — validación manual con `validateCalculatorSettingsInput()`, igual
 * que el resto del Studio.
 */

import { DEFAULT_PARAMS, type CalcParams } from "@/lib/calculadora";

/**
 * Subset editable de la fila `calculator_settings` (camelCase = CalcParams).
 * Es exactamente lo que el form del Studio manda y la action persiste.
 */
export type CalculatorSettingsInput = CalcParams;

/** Fila completa tal como la devuelve `getCalculatorSettings()`. */
export type CalculatorSettings = CalcParams & {
  tenant_id: string;
  updated_at: string;
  updated_by: string | null;
};

/** Defaults para poblar el form cuando el tenant aún no guardó config. */
export const DEFAULT_CALCULATOR_SETTINGS: CalculatorSettingsInput = {
  ...DEFAULT_PARAMS,
};

/** Estado de la server action (consistente con el resto del Studio). */
export type CalculatorSettingsActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof CalculatorSettingsInput, string>>;
};

/**
 * Metadatos de cada campo para renderizar el form genérico + validar.
 * `kind` define adornment del NumericInput; `min` el piso permitido.
 */
export type CalcFieldMeta = {
  key: keyof CalculatorSettingsInput;
  label: string;
  hint: string;
  kind: "weight" | "currency" | "decimal";
  /** Sufijo extra para el preview (ej. "/kg", "/km", "×"). Cosmético. */
  unit?: string;
  /** Decimales del preview del NumericInput. Default por tipo si se omite. */
  precision?: number;
  /** Mínimo permitido (inclusive). */
  min: number;
};

/**
 * Orden + metadatos de los 8 parámetros. Agrupados para el layout del panel.
 */
export const CALC_FIELDS: CalcFieldMeta[] = [
  {
    key: "pesoIncluidoKg",
    label: "Gracia de peso incluida",
    hint: "Densidad incluida sin recargo (kg por m³). Hasta acá no se cobra excedente.",
    kind: "weight",
    precision: 0,
    min: 0.01,
  },
  {
    key: "recargoExcedenteKg",
    label: "Recargo por kg de excedente",
    hint: "USD por cada kg por encima de la gracia. Se auto-cotiza, no deriva al asesor.",
    kind: "currency",
    unit: "/kg",
    min: 0,
  },
  {
    key: "pesoMaxEnvioKg",
    label: "Peso máximo por envío",
    hint: "Sobre este peso la calculadora deriva al asesor en vez de cotizar (evita que un solo envío monopolice el peso del contenedor).",
    kind: "weight",
    precision: 0,
    min: 0.01,
  },
  {
    key: "descuentoValencia",
    label: "Descuento entrega en Valencia",
    hint: "USD que se descuentan cuando el destino es Valencia (la sede).",
    kind: "currency",
    min: 0,
  },
  {
    key: "recargoEmbalajeEspecial",
    label: "Recargo embalaje especial",
    hint: "USD por embalaje en madera o paleta. Se cobra una sola vez.",
    kind: "currency",
    min: 0,
  },
  {
    key: "recargoBateriaMult",
    label: "Multiplicador por baterías",
    hint: "Multiplica el flete cuando la carga lleva baterías. 1.5 = +50%. Debe ser ≥ 1.",
    kind: "decimal",
    unit: "×",
    min: 1,
  },
  {
    key: "thresholdCascoKm",
    label: "Radio del casco central",
    hint: "Km hasta donde la entrega es flat (sin recargo por distancia).",
    kind: "decimal",
    unit: "km",
    precision: 0,
    min: 0,
  },
  {
    key: "tarifaKmFueraCasco",
    label: "Tarifa por km fuera del casco",
    hint: "USD por km cuando el destino está fuera del casco central.",
    kind: "currency",
    unit: "/km",
    min: 0,
  },
  {
    key: "cbmMaxContenedor",
    label: "CBM máximo (un contenedor)",
    hint: "CBM total máximo que estima la calculadora. Sobre esto deriva al asesor (FCL).",
    kind: "decimal",
    unit: "m³",
    precision: 0,
    min: 0.01,
  },
  {
    key: "pesoMaxContenedorKg",
    label: "Peso máximo (un contenedor)",
    hint: "Peso total máximo que estima la calculadora. Sobre esto deriva al asesor.",
    kind: "weight",
    precision: 0,
    min: 0.01,
  },
];

/**
 * Valida el input parcial del form. Retorna `{input}` si pasa o `{fieldErrors}`.
 * Espeja los CHECKs de la migración (positivos, peso_max ≥ incluido, mult ≥ 1)
 * para fallar en la UI con mensaje amable antes de pegarle a la DB.
 */
export function validateCalculatorSettingsInput(
  input: Partial<CalculatorSettingsInput>,
): {
  input?: CalculatorSettingsInput;
  fieldErrors?: CalculatorSettingsActionState["fieldErrors"];
} {
  const errors: CalculatorSettingsActionState["fieldErrors"] = {};

  // Cada campo debe ser un número finito y respetar su mínimo.
  for (const f of CALC_FIELDS) {
    const v = input[f.key];
    if (v == null || !Number.isFinite(v)) {
      errors[f.key] = "Indica un número válido.";
      continue;
    }
    if (v < f.min) {
      errors[f.key] =
        f.min === 0
          ? "No puede ser negativo."
          : `Debe ser mayor o igual a ${f.min}.`;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { fieldErrors: errors };
  }

  return {
    input: {
      pesoIncluidoKg: input.pesoIncluidoKg!,
      recargoExcedenteKg: input.recargoExcedenteKg!,
      pesoMaxEnvioKg: input.pesoMaxEnvioKg!,
      descuentoValencia: input.descuentoValencia!,
      recargoEmbalajeEspecial: input.recargoEmbalajeEspecial!,
      recargoBateriaMult: input.recargoBateriaMult!,
      thresholdCascoKm: input.thresholdCascoKm!,
      tarifaKmFueraCasco: input.tarifaKmFueraCasco!,
      cbmMaxContenedor: input.cbmMaxContenedor!,
      pesoMaxContenedorKg: input.pesoMaxContenedorKg!,
    },
  };
}
