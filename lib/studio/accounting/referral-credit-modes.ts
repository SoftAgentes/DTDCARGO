/**
 * Modo de reflejo contable del crédito de referido (SDD-0137) — enum, cuentas y
 * labels. SIN dependencias a propósito.
 *
 * Por qué vive separado de `referral-credit-posting.ts`: ese módulo importa
 * `createAdminClient` (service_role). El formulario de config fiscal es un
 * componente CLIENTE y necesita estas constantes en runtime para pintar el
 * selector; si las importara del posting, el bundler arrastraría el admin client
 * —y la service_role key— al navegador. Acá no hay imports, así que cruza la
 * frontera RSC sin traer nada detrás.
 */

/** Modo de reflejo contable del crédito (setting fiscal_settings.referral_credit_mode). */
export type ReferralCreditMode = "marketing_expense" | "commercial_discount";

export const REFERRAL_CREDIT_MODES: ReferralCreditMode[] = [
  "marketing_expense",
  "commercial_discount",
];

export const DEFAULT_REFERRAL_CREDIT_MODE: ReferralCreditMode =
  "marketing_expense";

/** Cuenta del DEBE (contra la que se reconoce el crédito) por modo → code del plan (seed 0078). */
export const REFERRAL_CREDIT_DEBIT_ACCOUNT_CODE: Record<
  ReferralCreditMode,
  string
> = {
  // Gasto de incentivo (recomendación §3.3): Publicidad y marketing.
  marketing_expense: "6.11",
  // Rebaja de precio: Descuentos sobre ventas (cuenta contra-ingreso).
  commercial_discount: "4.9",
};

/** Cuenta del HABER: siempre la CxC de clientes (baja el saldo del referidor). */
export const REFERRAL_CREDIT_CREDIT_ACCOUNT_CODE = "1.1.2";

export function isReferralCreditMode(v: unknown): v is ReferralCreditMode {
  return (
    typeof v === "string" && (REFERRAL_CREDIT_MODES as string[]).includes(v)
  );
}

/** Label del modo para el selector de config fiscal. */
export function referralCreditModeLabel(m: ReferralCreditMode): string {
  return m === "marketing_expense"
    ? "Gasto de marketing (6.11 Publicidad y marketing)"
    : "Descuento comercial (4.9 Descuentos sobre ventas)";
}

/** Qué implica cada modo, para que el contador elija sin adivinar. */
export function referralCreditModeHint(m: ReferralCreditMode): string {
  return m === "marketing_expense"
    ? "El crédito se reconoce como gasto de incentivo. El ingreso por la venta queda intacto y el costo del referido se ve en marketing."
    : "El crédito se reconoce como rebaja de precio (contra-ingreso). Baja el ingreso neto en vez de sumar gasto.";
}
