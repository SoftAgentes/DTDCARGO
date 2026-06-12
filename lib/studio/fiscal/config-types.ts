/**
 * Configuración fiscal per-tenant (SDD-0073) — tipos + validación + defaults.
 *
 * El CORAZÓN del módulo Fiscal/SENIAT: el software NO hardcodea reglas
 * tributarias, las parametriza. Esta config (1 row/tenant en `fiscal_settings`)
 * es la fuente única que consumen los Libros de IVA. El código nunca asume
 * "exento"/"16%"/"retiene" — lo deriva de acá.
 *
 * Server-safe (sin "use client", sin Supabase, sin Zod): lo importan tanto el
 * `page.tsx` (server) como `FiscalClient.tsx` (client) sin cruzar la frontera
 * RSC. Validación manual con `validateFiscalSettingsInput()`, patrón del Studio.
 *
 * Defaults (`DEFAULT_FISCAL_SETTINGS`) = el caso DTD hoy (spec §5), todos
 * editables: servicio exento (transporte de carga), agente de retención sí,
 * alícuota 16%, periodicidad mensual. Cero-config arranca usable.
 */

// ── Enums (espejan los CHECK de la migración) ──────────────────

export type ServiceIvaTreatment = "exento" | "gravado" | "tasa_cero" | "mixto";
export type PurchaseIvaMode = "derivado" | "capturado";
export type DeclarationPeriod = "mensual";

export const SERVICE_IVA_TREATMENTS: ServiceIvaTreatment[] = [
  "exento",
  "gravado",
  "tasa_cero",
  "mixto",
];
export const PURCHASE_IVA_MODES: PurchaseIvaMode[] = ["derivado", "capturado"];
export const DECLARATION_PERIODS: DeclarationPeriod[] = ["mensual"];

/** Label legible (es-VE) de la calificación tributaria del servicio. */
export function serviceIvaTreatmentLabel(t: ServiceIvaTreatment): string {
  switch (t) {
    case "exento":
      return "Exento de IVA";
    case "gravado":
      return "Gravado (alícuota general)";
    case "tasa_cero":
      return "Tasa cero (0%)";
    case "mixto":
      return "Mixto (gravadas + exentas)";
  }
}

export function purchaseIvaModeLabel(m: PurchaseIvaMode): string {
  return m === "derivado"
    ? "Derivado del total del documento"
    : "Capturado por compra (campo explícito)";
}

// ── Tipos ──────────────────────────────────────────────────────

/** Subset editable de `fiscal_settings` — lo que el form manda y persiste. */
export interface FiscalSettingsInput {
  service_iva_treatment: ServiceIvaTreatment;
  iva_rate: number;
  is_special_taxpayer: boolean;
  is_iva_withholding_agent: boolean;
  iva_withholding_pct: number;
  purchase_iva_mode: PurchaseIvaMode;
  declaration_period: DeclarationPeriod;
}

/** Fila completa tal como la devuelve `getFiscalSettings()`. */
export interface FiscalSettings extends FiscalSettingsInput {
  tenant_id: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

/** Estado de la server action (consistente con el resto del Studio). */
export type FiscalSettingsActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof FiscalSettingsInput, string>>;
};

// ── Defaults (spec §5 · el caso DTD hoy, editables) ────────────

/** Defaults de la config = arranque sin row. Cero-config usable. */
export const DEFAULT_FISCAL_SETTINGS: FiscalSettingsInput = {
  service_iva_treatment: "exento",
  iva_rate: 16,
  is_special_taxpayer: false,
  is_iva_withholding_agent: true,
  iva_withholding_pct: 75,
  purchase_iva_mode: "derivado",
  declaration_period: "mensual",
};

// ── Validación (sin Zod) ───────────────────────────────────────

function isTreatment(v: unknown): v is ServiceIvaTreatment {
  return (
    typeof v === "string" &&
    (SERVICE_IVA_TREATMENTS as string[]).includes(v)
  );
}
function isPurchaseMode(v: unknown): v is PurchaseIvaMode {
  return typeof v === "string" && (PURCHASE_IVA_MODES as string[]).includes(v);
}
function isPeriod(v: unknown): v is DeclarationPeriod {
  return typeof v === "string" && (DECLARATION_PERIODS as string[]).includes(v);
}

/**
 * Valida el input parcial del form. Retorna `{input}` si pasa o `{fieldErrors}`.
 * Espeja los CHECK de la migración (rangos 0–100, enums) para fallar en la UI
 * con mensaje amable antes de pegarle a la DB.
 */
export function validateFiscalSettingsInput(
  input: Partial<FiscalSettingsInput>,
): {
  input?: FiscalSettingsInput;
  fieldErrors?: FiscalSettingsActionState["fieldErrors"];
} {
  const errors: FiscalSettingsActionState["fieldErrors"] = {};

  if (!isTreatment(input.service_iva_treatment)) {
    errors.service_iva_treatment = "Elige una calificación válida.";
  }
  if (!isPurchaseMode(input.purchase_iva_mode)) {
    errors.purchase_iva_mode = "Elige un modo válido.";
  }
  if (!isPeriod(input.declaration_period)) {
    errors.declaration_period = "Periodicidad inválida.";
  }

  const rate = input.iva_rate;
  if (rate == null || !Number.isFinite(rate)) {
    errors.iva_rate = "Indica una alícuota válida.";
  } else if (rate < 0 || rate > 100) {
    errors.iva_rate = "La alícuota debe estar entre 0 y 100.";
  }

  const wh = input.iva_withholding_pct;
  if (wh == null || !Number.isFinite(wh)) {
    errors.iva_withholding_pct = "Indica un porcentaje válido.";
  } else if (wh < 0 || wh > 100) {
    errors.iva_withholding_pct = "El porcentaje debe estar entre 0 y 100.";
  }

  if (typeof input.is_special_taxpayer !== "boolean") {
    errors.is_special_taxpayer = "Valor inválido.";
  }
  if (typeof input.is_iva_withholding_agent !== "boolean") {
    errors.is_iva_withholding_agent = "Valor inválido.";
  }

  if (Object.keys(errors).length > 0) return { fieldErrors: errors };

  return {
    input: {
      service_iva_treatment: input.service_iva_treatment as ServiceIvaTreatment,
      iva_rate: input.iva_rate as number,
      is_special_taxpayer: input.is_special_taxpayer as boolean,
      is_iva_withholding_agent: input.is_iva_withholding_agent as boolean,
      iva_withholding_pct: input.iva_withholding_pct as number,
      purchase_iva_mode: input.purchase_iva_mode as PurchaseIvaMode,
      declaration_period: input.declaration_period as DeclarationPeriod,
    },
  };
}
