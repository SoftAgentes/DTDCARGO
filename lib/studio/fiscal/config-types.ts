/**
 * Configuración fiscal per-tenant (SDD-0073 §8) — tipos + validación + defaults.
 *
 * El CORAZÓN del módulo Fiscal/SENIAT: el software NO hardcodea reglas
 * tributarias, las PARAMETRIZA. Esta config (1 row/tenant en `fiscal_settings`)
 * es la fuente única que consumen los Libros de IVA y (cuando se active) la
 * facturación. El código nunca asume "exento"/"16%"/"retiene" — lo deriva de acá.
 *
 * ESTRUCTURA §8 (deep-research SENIAT + 4 principios del founder 2026-06-12):
 *  - Principio #1: master toggle `fiscal_module_enabled` (default FALSE). Con OFF
 *    el módulo es INERTE — no genera libros, no toca IVA, la facturación sigue
 *    normal. DTD hoy = OFF.
 *  - Principio #3: IVA POR FACTURA, no por tenant. `default_invoice_iva_mode` es
 *    el default de facturas nuevas; cada factura lo sobreescribe (invoices.iva_mode).
 *  - Principio #4: cero automatismo fiscal hasta activar.
 *
 * Server-safe (sin "use client", sin Supabase, sin Zod): lo importan tanto el
 * `page.tsx` (server) como `FiscalClient.tsx` (client) sin cruzar la frontera
 * RSC. Validación manual con `validateFiscalSettingsInput()`, patrón del Studio.
 *
 * Defaults (`DEFAULT_FISCAL_SETTINGS`) = el caso DTD hoy (spec §8.2), todos
 * editables por el contador sin deploy. Cero-config arranca usable (módulo OFF).
 */

// ── Enums (espejan los CHECK de la migración 0141) ─────────────

/** Modo de IVA de una factura (o el default del tenant). */
export type InvoiceIvaMode = "sin_iva" | "con_iva" | "exento" | "tasa_cero";
export type PurchaseIvaMode = "derivado" | "capturado";
export type DeclarationPeriod = "mensual";

export const INVOICE_IVA_MODES: InvoiceIvaMode[] = [
  "sin_iva",
  "con_iva",
  "exento",
  "tasa_cero",
];
export const PURCHASE_IVA_MODES: PurchaseIvaMode[] = ["derivado", "capturado"];
export const DECLARATION_PERIODS: DeclarationPeriod[] = ["mensual"];

/** Label legible (es-VE) del modo de IVA de una factura. */
export function invoiceIvaModeLabel(m: InvoiceIvaMode): string {
  switch (m) {
    case "sin_iva":
      return "Sin IVA";
    case "con_iva":
      return "Con IVA (alícuota general)";
    case "exento":
      return "Exento de IVA";
    case "tasa_cero":
      return "Tasa cero (0%)";
  }
}

export function purchaseIvaModeLabel(m: PurchaseIvaMode): string {
  return m === "derivado"
    ? "Derivado del total del documento"
    : "Capturado por compra (campo explícito)";
}

// ── Tipos ──────────────────────────────────────────────────────

/**
 * Subset editable de `fiscal_settings` — lo que el form manda y persiste.
 * Agrupado por §8.2 (A master · B SPE · C alícuotas · D default factura ·
 * E IGTF · F retención · G facturación digital · H período).
 */
export interface FiscalSettingsInput {
  // A · master
  fiscal_module_enabled: boolean;
  // B · contribuyente especial
  is_special_taxpayer: boolean;
  // C · alícuotas (configurables, el Ejecutivo las mueve en banda)
  iva_rate_general: number;
  iva_rate_reduced: number;
  iva_rate_export: number;
  iva_rate_luxury_surcharge: number;
  // D · default de IVA de facturas nuevas (cada factura lo sobreescribe)
  default_invoice_iva_mode: InvoiceIvaMode;
  // E · IGTF (sobre cobros en divisa)
  igtf_enabled: boolean;
  igtf_rate_fx: number;
  igtf_is_perception_agent: boolean;
  // F · retención de IVA (solo si SPE · a confirmar contador)
  iva_withholding_agent: boolean;
  iva_withholding_pct: number;
  // G · facturación digital (proveedor homologado asigna el nº de control)
  digital_invoicing_enabled: boolean;
  homologated_provider: string | null;
  // H · período + fuente del IVA de compras
  declaration_period: DeclarationPeriod;
  purchase_iva_mode: PurchaseIvaMode;
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

// ── Defaults (spec §8.2 · el caso DTD hoy, editables) ──────────

/**
 * Defaults de la config = arranque sin row. Cero-config usable con el módulo
 * OFF (DTD hoy). Valores §8.2: módulo OFF, no SPE, alícuotas 16/8/0/15,
 * facturas sin_iva, IGTF off, retención off, facturación digital off, mensual.
 */
export const DEFAULT_FISCAL_SETTINGS: FiscalSettingsInput = {
  fiscal_module_enabled: false,
  is_special_taxpayer: false,
  iva_rate_general: 16,
  iva_rate_reduced: 8,
  iva_rate_export: 0,
  iva_rate_luxury_surcharge: 15,
  default_invoice_iva_mode: "sin_iva",
  igtf_enabled: false,
  igtf_rate_fx: 3,
  igtf_is_perception_agent: false,
  iva_withholding_agent: false,
  iva_withholding_pct: 75,
  digital_invoicing_enabled: false,
  homologated_provider: null,
  declaration_period: "mensual",
  purchase_iva_mode: "derivado",
};

/** ¿El módulo fiscal está activo? Helper único (principio #1). */
export function isFiscalModuleEnabled(settings: FiscalSettings): boolean {
  return settings.fiscal_module_enabled === true;
}

// ── Validación (sin Zod) ───────────────────────────────────────

function isInvoiceIvaMode(v: unknown): v is InvoiceIvaMode {
  return typeof v === "string" && (INVOICE_IVA_MODES as string[]).includes(v);
}
function isPurchaseMode(v: unknown): v is PurchaseIvaMode {
  return typeof v === "string" && (PURCHASE_IVA_MODES as string[]).includes(v);
}
function isPeriod(v: unknown): v is DeclarationPeriod {
  return typeof v === "string" && (DECLARATION_PERIODS as string[]).includes(v);
}

/** Valida un % en [0,100] sobre `key`; agrega error si falla. */
function checkPct(
  errors: NonNullable<FiscalSettingsActionState["fieldErrors"]>,
  key: keyof FiscalSettingsInput,
  value: number | undefined,
  label: string,
): void {
  if (value == null || !Number.isFinite(value)) {
    errors[key] = `Indica ${label} válida.`;
  } else if (value < 0 || value > 100) {
    errors[key] = `${label} debe estar entre 0 y 100.`;
  }
}

function checkBool(
  errors: NonNullable<FiscalSettingsActionState["fieldErrors"]>,
  key: keyof FiscalSettingsInput,
  value: unknown,
): void {
  if (typeof value !== "boolean") errors[key] = "Valor inválido.";
}

/**
 * Valida el input parcial del form. Retorna `{input}` si pasa o `{fieldErrors}`.
 * Espeja los CHECK de la migración 0141 (rangos 0–100, enums) para fallar en la
 * UI con mensaje amable antes de pegarle a la DB.
 */
export function validateFiscalSettingsInput(
  input: Partial<FiscalSettingsInput>,
): {
  input?: FiscalSettingsInput;
  fieldErrors?: FiscalSettingsActionState["fieldErrors"];
} {
  const errors: FiscalSettingsActionState["fieldErrors"] = {};

  // Booleans
  checkBool(errors, "fiscal_module_enabled", input.fiscal_module_enabled);
  checkBool(errors, "is_special_taxpayer", input.is_special_taxpayer);
  checkBool(errors, "igtf_enabled", input.igtf_enabled);
  checkBool(errors, "igtf_is_perception_agent", input.igtf_is_perception_agent);
  checkBool(errors, "iva_withholding_agent", input.iva_withholding_agent);
  checkBool(
    errors,
    "digital_invoicing_enabled",
    input.digital_invoicing_enabled,
  );

  // Enums
  if (!isInvoiceIvaMode(input.default_invoice_iva_mode)) {
    errors.default_invoice_iva_mode = "Elige un modo de IVA válido.";
  }
  if (!isPurchaseMode(input.purchase_iva_mode)) {
    errors.purchase_iva_mode = "Elige un modo válido.";
  }
  if (!isPeriod(input.declaration_period)) {
    errors.declaration_period = "Periodicidad inválida.";
  }

  // Rates (% en [0,100])
  checkPct(errors, "iva_rate_general", input.iva_rate_general, "la alícuota general");
  checkPct(errors, "iva_rate_reduced", input.iva_rate_reduced, "la alícuota reducida");
  checkPct(errors, "iva_rate_export", input.iva_rate_export, "la alícuota de exportación");
  checkPct(
    errors,
    "iva_rate_luxury_surcharge",
    input.iva_rate_luxury_surcharge,
    "el recargo suntuario",
  );
  checkPct(errors, "igtf_rate_fx", input.igtf_rate_fx, "la tasa de IGTF");
  checkPct(errors, "iva_withholding_pct", input.iva_withholding_pct, "el % de retención");

  if (Object.keys(errors).length > 0) return { fieldErrors: errors };

  const provider = input.homologated_provider?.trim();
  return {
    input: {
      fiscal_module_enabled: input.fiscal_module_enabled as boolean,
      is_special_taxpayer: input.is_special_taxpayer as boolean,
      iva_rate_general: input.iva_rate_general as number,
      iva_rate_reduced: input.iva_rate_reduced as number,
      iva_rate_export: input.iva_rate_export as number,
      iva_rate_luxury_surcharge: input.iva_rate_luxury_surcharge as number,
      default_invoice_iva_mode: input.default_invoice_iva_mode as InvoiceIvaMode,
      igtf_enabled: input.igtf_enabled as boolean,
      igtf_rate_fx: input.igtf_rate_fx as number,
      igtf_is_perception_agent: input.igtf_is_perception_agent as boolean,
      iva_withholding_agent: input.iva_withholding_agent as boolean,
      iva_withholding_pct: input.iva_withholding_pct as number,
      digital_invoicing_enabled: input.digital_invoicing_enabled as boolean,
      homologated_provider: provider ? provider : null,
      declaration_period: input.declaration_period as DeclarationPeriod,
      purchase_iva_mode: input.purchase_iva_mode as PurchaseIvaMode,
    },
  };
}
