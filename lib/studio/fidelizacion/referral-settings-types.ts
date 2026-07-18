/**
 * SDD-0159 — Tipos + validación de la config del programa de referidos.
 * Matchea el schema de `supabase/migrations/0250_referral_settings.sql`.
 *
 * Dos montos editables desde el Studio (Fidelización › Configurar referidos):
 * el crédito al referidor y el descuento al referido. Los defaults = los valores
 * históricos de `REFERRAL_RULES` ($80/$60) → fallback cuando no hay fila en la DB.
 *
 * Sin Zod — validación manual con `validateReferralSettingsInput()`, patrón del
 * resto del Studio (igual que calculator-settings-types.ts).
 */

import { REFERRAL_RULES } from "./types";

/** Lo que el form del Studio manda y la action persiste (camelCase). */
export type ReferralSettingsInput = {
  referrerRewardUsd: number;
  referredRewardUsd: number;
};

/** Fila completa tal como la devuelve `getReferralSettings()`. */
export type ReferralSettings = ReferralSettingsInput & {
  tenant_id: string;
  updated_at: string;
  updated_by: string | null;
};

/** Defaults = los montos históricos de REFERRAL_RULES. Fallback sin fila en DB. */
export const DEFAULT_REFERRAL_SETTINGS: ReferralSettingsInput = {
  referrerRewardUsd: REFERRAL_RULES.referrerReward,
  referredRewardUsd: REFERRAL_RULES.referredReward,
};

/** Estado de la server action (consistente con el resto del Studio). */
export type ReferralSettingsActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof ReferralSettingsInput, string>>;
};

/** Metadatos de cada campo para renderizar el form + validar. */
export type ReferralFieldMeta = {
  key: keyof ReferralSettingsInput;
  label: string;
  hint: string;
  /** Mínimo permitido (inclusive). */
  min: number;
};

export const REFERRAL_SETTINGS_FIELDS: ReferralFieldMeta[] = [
  {
    key: "referrerRewardUsd",
    label: "Crédito al referidor",
    hint: "USD de crédito para el cliente que refiere, cuando su referido hace su primera compra.",
    min: 0,
  },
  {
    key: "referredRewardUsd",
    label: "Descuento al referido",
    hint: "USD de descuento para el nuevo cliente en su primer embarque.",
    min: 0,
  },
];

/**
 * Valida el input parcial del form. Retorna `{input}` si pasa o `{fieldErrors}`.
 * Espeja los CHECKs de la migración (montos finitos y ≥ 0) para fallar en la UI
 * con mensaje amable antes de pegarle a la DB.
 */
export function validateReferralSettingsInput(
  input: Partial<ReferralSettingsInput>,
): {
  input?: ReferralSettingsInput;
  fieldErrors?: ReferralSettingsActionState["fieldErrors"];
} {
  const errors: ReferralSettingsActionState["fieldErrors"] = {};

  for (const f of REFERRAL_SETTINGS_FIELDS) {
    const v = input[f.key];
    if (v == null || !Number.isFinite(v)) {
      errors[f.key] = "Indica un número válido.";
      continue;
    }
    if (v < f.min) {
      errors[f.key] = "No puede ser negativo.";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { fieldErrors: errors };
  }

  return {
    input: {
      referrerRewardUsd: input.referrerRewardUsd!,
      referredRewardUsd: input.referredRewardUsd!,
    },
  };
}
