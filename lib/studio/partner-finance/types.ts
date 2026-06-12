/**
 * Tipos + helpers puros del módulo Financiero con el Socio China
 * (SDD-0059 · Slice A). Matchea el schema de
 * supabase/migrations/0114_financiero_china.sql.
 *
 * Cinco entidades:
 *  - `PartnerLedgerEntry`  · cuenta corriente bilateral (USD+RMB, saldo neto
 *                            corriente se DERIVA acá, no se persiste).
 *  - `SupplierCharge`      · cargo facturado por el socio (estado
 *                            vigente/disputado/corregido/cancelado).
 *  - `SupplierCreditNote`  · corrección vinculada (descuenta del bruto).
 *  - `CurrencyConversion`  · conversión de divisa con spread + comisión.
 *  - `SupplierClaimOffset` · cruce contable (máquina de estados).
 *
 * Sin server actions / UI acá (eso es Slice B/C). Helpers PUROS + validadores
 * manuales (no Zod, patrón del repo). Montos `numeric` llegan de Supabase como
 * string → se coercen a number en las queries.
 */

// ── Tonos de badge (set del sistema) ──────────────────────────
export type BadgeTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "wine"
  | "neutral";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function round4(n: number): number {
  return Math.round((n + Number.EPSILON) * 1e4) / 1e4;
}
/** Coacciona un valor crudo a número finito (default 0). */
export function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Monedas del dominio (incluye RMB, que invoice_currency no) ║
// ╚═══════════════════════════════════════════════════════════╝
export type PartnerCurrency = "USD" | "USDT" | "RMB" | "VES";

export const PARTNER_CURRENCIES: PartnerCurrency[] = [
  "USD",
  "USDT",
  "RMB",
  "VES",
];

export function isPartnerCurrency(v: unknown): v is PartnerCurrency {
  return (
    typeof v === "string" && (PARTNER_CURRENCIES as string[]).includes(v)
  );
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ supplier_bills.bill_kind (PP/CA/full)                     ║
// ╚═══════════════════════════════════════════════════════════╝
export type BillKind = "pp" | "ca" | "full";

export const BILL_KINDS: BillKind[] = ["pp", "ca", "full"];

export const BILL_KIND_META: Record<
  BillKind,
  { label: string; label_cn: string; tone: BadgeTone }
> = {
  pp: { label: "Depósito (PP)", label_cn: "订金", tone: "warning" },
  ca: { label: "Balance (CA)", label_cn: "余额", tone: "info" },
  full: { label: "CxP completa", label_cn: "", tone: "neutral" },
};

export function billKindLabel(kind: string): string {
  return BILL_KIND_META[kind as BillKind]?.label ?? kind;
}
export function billKindTone(kind: string): BadgeTone {
  return BILL_KIND_META[kind as BillKind]?.tone ?? "neutral";
}
export function isBillKind(v: unknown): v is BillKind {
  return typeof v === "string" && (BILL_KINDS as string[]).includes(v);
}

/**
 * PP/CA exigen shipment_id (validación en lib, NO constraint — la spec §3 lo
 * deja explícito: NOT NULL rompería filas viejas). `full` no lo exige.
 */
export function billKindRequiresShipment(kind: string): boolean {
  return kind === "pp" || kind === "ca";
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ partner_ledger_entries · tipos + dirección               ║
// ╚═══════════════════════════════════════════════════════════╝
export type LedgerDirection = "debe" | "haber";

export const LEDGER_DIRECTIONS: LedgerDirection[] = ["debe", "haber"];

export function isLedgerDirection(v: unknown): v is LedgerDirection {
  return v === "debe" || v === "haber";
}

export type LedgerEntryType =
  | "costo_contenedor"
  | "pago_fabrica_pp"
  | "pago_fabrica_ca"
  | "conversion_divisa"
  | "bl_courier"
  | "inspeccion_qc"
  | "registro_marca"
  | "hospitalidad"
  | "pago_aliado"
  | "nota_credito"
  | "ajuste"
  | "otro";

export const LEDGER_ENTRY_TYPES: LedgerEntryType[] = [
  "costo_contenedor",
  "pago_fabrica_pp",
  "pago_fabrica_ca",
  "conversion_divisa",
  "bl_courier",
  "inspeccion_qc",
  "registro_marca",
  "hospitalidad",
  "pago_aliado",
  "nota_credito",
  "ajuste",
  "otro",
];

export const LEDGER_ENTRY_TYPE_LABELS: Record<LedgerEntryType, string> = {
  costo_contenedor: "Costo de contenedor",
  pago_fabrica_pp: "Pago a fábrica (depósito)",
  pago_fabrica_ca: "Pago a fábrica (balance)",
  conversion_divisa: "Conversión de divisa",
  bl_courier: "BL / courier",
  inspeccion_qc: "Inspección / QC",
  registro_marca: "Registro de marca",
  hospitalidad: "Hospitalidad",
  pago_aliado: "Pago a aliado",
  nota_credito: "Nota de crédito",
  ajuste: "Ajuste",
  otro: "Otro",
};

export function isLedgerEntryType(v: unknown): v is LedgerEntryType {
  return (
    typeof v === "string" &&
    (LEDGER_ENTRY_TYPES as string[]).includes(v)
  );
}

export function ledgerEntryTypeLabel(t: string): string {
  return LEDGER_ENTRY_TYPE_LABELS[t as LedgerEntryType] ?? t;
}

/** Fila persistida de partner_ledger_entries. */
export type PartnerLedgerEntry = {
  id: string;
  tenant_id: string;
  supplier_id: string;
  entry_code: string;
  entry_type: LedgerEntryType;
  direction: LedgerDirection;
  amount_usd: number;
  amount_rmb: number;
  fx_rate: number | null;
  currency_paid: PartnerCurrency;
  container_id: string | null;
  shipment_id: string | null;
  charge_id: string | null;
  occurred_on: string;
  description: string | null;
  description_cn: string | null;
  journal_entry_id: string | null;
  created_at: string;
  deleted_at: string | null;
};

// ╔═══════════════════════════════════════════════════════════╗
// ║ supplier_charges · estado + transición                    ║
// ╚═══════════════════════════════════════════════════════════╝
export type ChargeStatus =
  | "vigente"
  | "disputado"
  | "corregido"
  | "cancelado";

export const CHARGE_STATUSES: ChargeStatus[] = [
  "vigente",
  "disputado",
  "corregido",
  "cancelado",
];

export const CHARGE_STATUS_META: Record<
  ChargeStatus,
  { label: string; tone: BadgeTone }
> = {
  vigente: { label: "Vigente", tone: "info" },
  disputado: { label: "Disputado", tone: "warning" },
  corregido: { label: "Corregido", tone: "success" },
  cancelado: { label: "Cancelado", tone: "neutral" },
};

export function chargeStatusLabel(s: string): string {
  return CHARGE_STATUS_META[s as ChargeStatus]?.label ?? s;
}
export function chargeStatusTone(s: string): BadgeTone {
  return CHARGE_STATUS_META[s as ChargeStatus]?.tone ?? "neutral";
}
export function isChargeStatus(v: unknown): v is ChargeStatus {
  return typeof v === "string" && (CHARGE_STATUSES as string[]).includes(v);
}

/**
 * Transiciones válidas del estado de un cargo (§4.3):
 *   vigente   → disputado | cancelado
 *   disputado → corregido | cancelado | vigente (revertir disputa)
 *   corregido, cancelado → terminales (no salen).
 */
export const CHARGE_TRANSITIONS: Record<ChargeStatus, ChargeStatus[]> = {
  vigente: ["disputado", "cancelado"],
  disputado: ["corregido", "cancelado", "vigente"],
  corregido: [],
  cancelado: [],
};

/** ¿Es válido pasar el cargo de `from` a `to`? */
export function canTransitionCharge(
  from: ChargeStatus,
  to: ChargeStatus,
): boolean {
  if (from === to) return false;
  return CHARGE_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Fila persistida de supplier_charges (sin net_amount — se deriva). */
export type SupplierCharge = {
  id: string;
  tenant_id: string;
  supplier_id: string;
  container_id: string | null;
  description: string;
  description_cn: string | null;
  amount: number;
  currency: PartnerCurrency;
  fx_rate: number | null;
  charged_on: string;
  status: ChargeStatus;
  reconciled: boolean;
  statement_line_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

/** Cargo + su net_amount derivado (amount − Σ notas de crédito aplicadas). */
export type SupplierChargeWithNet = SupplierCharge & {
  credited: number;
  net_amount: number;
};

// ╔═══════════════════════════════════════════════════════════╗
// ║ supplier_credit_notes                                     ║
// ╚═══════════════════════════════════════════════════════════╝
export type SupplierCreditNote = {
  id: string;
  tenant_id: string;
  charge_id: string;
  reason: string;
  amount: number;
  currency: PartnerCurrency;
  fx_rate: number | null;
  issued_on: string;
  document_id: string | null;
  created_at: string;
  deleted_at: string | null;
};

/**
 * Deriva el net_amount de un cargo: bruto menos la suma de notas de crédito
 * VIVAS (deleted_at null). Clamp a 0 (una corrección nunca deja el cargo en
 * negativo). PURO — testeable sin DB.
 */
export function deriveNetAmount(
  amount: number,
  creditNotes: { amount: number; deleted_at?: string | null }[],
): { credited: number; net_amount: number } {
  const gross = num(amount);
  const credited = round2(
    creditNotes
      .filter((n) => n.deleted_at == null)
      .reduce((acc, n) => acc + num(n.amount), 0),
  );
  const net = round2(Math.max(0, gross - credited));
  return { credited, net_amount: net };
}

/**
 * Guard del pago: NUNCA se paga el bruto si hay nota de crédito aplicada
 * (§4.3). Devuelve el monto pagable = net_amount. PURO.
 */
export function payableAmount(charge: {
  amount: number;
  net_amount?: number;
  credited?: number;
}): number {
  if (typeof charge.net_amount === "number") return round2(charge.net_amount);
  if (typeof charge.credited === "number") {
    return round2(Math.max(0, num(charge.amount) - num(charge.credited)));
  }
  return round2(num(charge.amount));
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ currency_conversions · spread + comisión                  ║
// ╚═══════════════════════════════════════════════════════════╝
export type ConversionFromCurrency = "USD" | "USDT" | "VES";
export type ConversionToCurrency = "RMB" | "USD";

export const CONVERSION_FROM_CURRENCIES: ConversionFromCurrency[] = [
  "USD",
  "USDT",
  "VES",
];
export const CONVERSION_TO_CURRENCIES: ConversionToCurrency[] = ["RMB", "USD"];

export function isConversionFromCurrency(
  v: unknown,
): v is ConversionFromCurrency {
  return (
    typeof v === "string" &&
    (CONVERSION_FROM_CURRENCIES as string[]).includes(v)
  );
}
export function isConversionToCurrency(v: unknown): v is ConversionToCurrency {
  return (
    typeof v === "string" &&
    (CONVERSION_TO_CURRENCIES as string[]).includes(v)
  );
}

export type CurrencyConversion = {
  id: string;
  tenant_id: string;
  from_currency: ConversionFromCurrency;
  to_currency: ConversionToCurrency;
  from_amount: number;
  to_amount: number;
  effective_rate: number;
  market_rate: number | null;
  spread_pct: number | null;
  commission_amount: number;
  shipment_id: string | null;
  client_id: string | null;
  converted_on: string;
  journal_entry_id: string | null;
  notes: string | null;
  created_at: string;
  deleted_at: string | null;
};

/**
 * Computa el spread forex de una conversión. PURO — testeable sin DB.
 *
 * - `effective_rate` = tasa real de la operación (to/from).
 * - `market_rate`    = tasa de referencia (si no hay, spread = 0 y la comisión
 *   se toma del parámetro explícito `commissionAmount` si vino).
 *
 * spread_pct = (effective − market) / market × 100. La comisión captada (en la
 * moneda `from`) = from_amount × |spread_pct| / 100, salvo que el operador
 * provea un `commissionAmount` explícito (override). El spread es REVENUE.
 */
export function computeConversionSpread(args: {
  fromAmount: number;
  effectiveRate: number;
  marketRate?: number | null;
  commissionAmount?: number | null;
}): { spread_pct: number | null; commission_amount: number } {
  const fromAmount = num(args.fromAmount);
  const eff = num(args.effectiveRate);
  const mkt = args.marketRate == null ? null : num(args.marketRate);

  let spreadPct: number | null = null;
  if (mkt != null && mkt > 0) {
    spreadPct = round4(((eff - mkt) / mkt) * 100);
  }

  // Override explícito de comisión gana; si no, se deriva del spread.
  let commission: number;
  if (args.commissionAmount != null && Number.isFinite(args.commissionAmount)) {
    commission = round2(Math.abs(num(args.commissionAmount)));
  } else if (spreadPct != null) {
    commission = round2((fromAmount * Math.abs(spreadPct)) / 100);
  } else {
    commission = 0;
  }

  return { spread_pct: spreadPct, commission_amount: commission };
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ supplier_claim_offsets · máquina de estados               ║
// ╚═══════════════════════════════════════════════════════════╝
export type ClaimOffsetStatus =
  | "reclamado"
  | "reconocido_proveedor"
  | "pagado_en_china"
  | "aplicado_a_cliente"
  | "cerrado";

export const CLAIM_OFFSET_STATUSES: ClaimOffsetStatus[] = [
  "reclamado",
  "reconocido_proveedor",
  "pagado_en_china",
  "aplicado_a_cliente",
  "cerrado",
];

export const CLAIM_OFFSET_STATUS_META: Record<
  ClaimOffsetStatus,
  { label: string; tone: BadgeTone }
> = {
  reclamado: { label: "Reclamado", tone: "warning" },
  reconocido_proveedor: { label: "Reconocido por proveedor", tone: "info" },
  pagado_en_china: { label: "Pagado en China", tone: "info" },
  aplicado_a_cliente: { label: "Aplicado al cliente", tone: "success" },
  cerrado: { label: "Cerrado", tone: "neutral" },
};

export function claimOffsetStatusLabel(s: string): string {
  return CLAIM_OFFSET_STATUS_META[s as ClaimOffsetStatus]?.label ?? s;
}
export function claimOffsetStatusTone(s: string): BadgeTone {
  return CLAIM_OFFSET_STATUS_META[s as ClaimOffsetStatus]?.tone ?? "neutral";
}
export function isClaimOffsetStatus(v: unknown): v is ClaimOffsetStatus {
  return (
    typeof v === "string" &&
    (CLAIM_OFFSET_STATUSES as string[]).includes(v)
  );
}

/**
 * La máquina avanza linealmente (§4.4). Cada estado sólo va al siguiente; no
 * hay saltos ni retrocesos. `cerrado` es terminal.
 */
export const CLAIM_OFFSET_NEXT: Record<
  ClaimOffsetStatus,
  ClaimOffsetStatus | null
> = {
  reclamado: "reconocido_proveedor",
  reconocido_proveedor: "pagado_en_china",
  pagado_en_china: "aplicado_a_cliente",
  aplicado_a_cliente: "cerrado",
  cerrado: null,
};

export function canTransitionClaimOffset(
  from: ClaimOffsetStatus,
  to: ClaimOffsetStatus,
): boolean {
  return CLAIM_OFFSET_NEXT[from] === to;
}

/** La fecha-hito que corresponde a cada transición de estado. */
export const CLAIM_OFFSET_STAGE_DATE_FIELD: Partial<
  Record<ClaimOffsetStatus, keyof SupplierClaimOffset>
> = {
  reconocido_proveedor: "recognized_on",
  pagado_en_china: "received_in_china_on",
  aplicado_a_cliente: "applied_to_client_on",
};

export type SupplierClaimOffset = {
  id: string;
  tenant_id: string;
  shipment_id: string | null;
  client_id: string | null;
  supplier_id: string | null;
  amount_usd: number;
  claimed_on: string;
  recognized_on: string | null;
  received_in_china_on: string | null;
  applied_to_client_on: string | null;
  evidence_document_id: string | null;
  status: ClaimOffsetStatus;
  client_invoice_id: string | null;
  created_at: string;
  deleted_at: string | null;
};

// ╔═══════════════════════════════════════════════════════════╗
// ║ Saldo neto bilateral (derivado)                           ║
// ╚═══════════════════════════════════════════════════════════╝
/**
 * Saldo neto corriente del socio en USD y RMB. Convención: `debe` resta
 * (le pagamos / nos retiene = baja lo que le debemos), `haber` suma (nos
 * cargan / le debemos más). El SIGNO indica la posición (positivo = le
 * debemos; negativo = nos debe / nos retiene), espejo de la cuenta contable.
 */
export type PartnerBalance = {
  net_usd: number;
  net_rmb: number;
  entry_count: number;
};

/**
 * Computa el saldo neto bilateral de un set de entries. PURO — testeable sin
 * DB. Ignora las entries soft-deleted. `haber` − `debe` por moneda.
 */
export function computePartnerBalance(
  entries: {
    direction: LedgerDirection;
    amount_usd: number;
    amount_rmb: number;
    deleted_at?: string | null;
  }[],
): PartnerBalance {
  let usd = 0;
  let rmb = 0;
  let count = 0;
  for (const e of entries) {
    if (e.deleted_at != null) continue;
    const sign = e.direction === "haber" ? 1 : -1;
    usd += sign * num(e.amount_usd);
    rmb += sign * num(e.amount_rmb);
    count += 1;
  }
  return { net_usd: round2(usd), net_rmb: round2(rmb), entry_count: count };
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Validadores manuales (sin Zod, patrón del repo)           ║
// ╚═══════════════════════════════════════════════════════════╝
export type ValidationResult<T> =
  | { ok: true; input: T }
  | { ok: false; fieldErrors: Record<string, string> };

// ── Ledger entry ──────────────────────────────────────────────
export type LedgerEntryInput = {
  supplier_id: string;
  entry_type: LedgerEntryType;
  direction: LedgerDirection;
  amount_usd: number;
  amount_rmb: number;
  fx_rate: number | null;
  currency_paid: PartnerCurrency;
  container_id: string | null;
  shipment_id: string | null;
  charge_id: string | null;
  occurred_on: string | null;
  description: string | null;
  description_cn: string | null;
};

export function validateLedgerEntryInput(
  raw: Partial<Record<string, unknown>>,
): ValidationResult<LedgerEntryInput> {
  const errors: Record<string, string> = {};

  const supplierId = String(raw.supplier_id ?? "").trim();
  if (!supplierId) errors.supplier_id = "Indica el socio (proveedor).";

  const entryType = String(raw.entry_type ?? "").trim();
  if (!isLedgerEntryType(entryType)) errors.entry_type = "Tipo inválido.";

  const direction = String(raw.direction ?? "").trim();
  if (!isLedgerDirection(direction)) errors.direction = "Dirección inválida.";

  const amountUsd = Number(raw.amount_usd ?? 0);
  if (!Number.isFinite(amountUsd) || amountUsd < 0) {
    errors.amount_usd = "Monto USD inválido.";
  }
  const amountRmb = Number(raw.amount_rmb ?? 0);
  if (!Number.isFinite(amountRmb) || amountRmb < 0) {
    errors.amount_rmb = "Monto RMB inválido.";
  }
  if (
    !errors.amount_usd &&
    !errors.amount_rmb &&
    amountUsd === 0 &&
    amountRmb === 0
  ) {
    errors.amount_usd = "El movimiento debe tener monto en USD o RMB.";
  }

  const currencyPaid = String(raw.currency_paid ?? "USD").trim();
  if (!isPartnerCurrency(currencyPaid)) {
    errors.currency_paid = "Moneda inválida.";
  }

  let fxRate: number | null = null;
  if (raw.fx_rate != null && String(raw.fx_rate).trim() !== "") {
    const fx = Number(raw.fx_rate);
    if (!Number.isFinite(fx) || fx <= 0) errors.fx_rate = "Tasa inválida.";
    else fxRate = fx;
  }

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };

  return {
    ok: true,
    input: {
      supplier_id: supplierId,
      entry_type: entryType as LedgerEntryType,
      direction: direction as LedgerDirection,
      amount_usd: round2(amountUsd),
      amount_rmb: round2(amountRmb),
      fx_rate: fxRate,
      currency_paid: currencyPaid as PartnerCurrency,
      container_id: strOrNull(raw.container_id),
      shipment_id: strOrNull(raw.shipment_id),
      charge_id: strOrNull(raw.charge_id),
      occurred_on: strOrNull(raw.occurred_on),
      description: strOrNull(raw.description),
      description_cn: strOrNull(raw.description_cn),
    },
  };
}

// ── Charge ────────────────────────────────────────────────────
export type ChargeInput = {
  supplier_id: string;
  container_id: string | null;
  description: string;
  description_cn: string | null;
  amount: number;
  currency: PartnerCurrency;
  fx_rate: number | null;
  charged_on: string | null;
  status: ChargeStatus;
};

export function validateChargeInput(
  raw: Partial<Record<string, unknown>>,
): ValidationResult<ChargeInput> {
  const errors: Record<string, string> = {};

  const supplierId = String(raw.supplier_id ?? "").trim();
  if (!supplierId) errors.supplier_id = "Indica el socio (proveedor).";

  const description = String(raw.description ?? "").trim();
  if (!description) errors.description = "Descripción requerida.";

  const amount = Number(raw.amount ?? NaN);
  if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = "El monto debe ser mayor a 0.";
  }

  const currency = String(raw.currency ?? "USD").trim();
  if (!isPartnerCurrency(currency)) errors.currency = "Moneda inválida.";

  let status: ChargeStatus = "vigente";
  if (raw.status != null && String(raw.status).trim() !== "") {
    const s = String(raw.status).trim();
    if (!isChargeStatus(s)) errors.status = "Estado inválido.";
    else status = s as ChargeStatus;
  }

  let fxRate: number | null = null;
  if (raw.fx_rate != null && String(raw.fx_rate).trim() !== "") {
    const fx = Number(raw.fx_rate);
    if (!Number.isFinite(fx) || fx <= 0) errors.fx_rate = "Tasa inválida.";
    else fxRate = fx;
  }

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };

  return {
    ok: true,
    input: {
      supplier_id: supplierId,
      container_id: strOrNull(raw.container_id),
      description,
      description_cn: strOrNull(raw.description_cn),
      amount: round2(amount),
      currency: currency as PartnerCurrency,
      fx_rate: fxRate,
      charged_on: strOrNull(raw.charged_on),
      status,
    },
  };
}

// ── Credit note ───────────────────────────────────────────────
export type CreditNoteInput = {
  charge_id: string;
  reason: string;
  amount: number;
  currency: PartnerCurrency;
  fx_rate: number | null;
  issued_on: string | null;
  document_id: string | null;
};

export function validateCreditNoteInput(
  raw: Partial<Record<string, unknown>>,
): ValidationResult<CreditNoteInput> {
  const errors: Record<string, string> = {};

  const chargeId = String(raw.charge_id ?? "").trim();
  if (!chargeId) errors.charge_id = "Indica el cargo a corregir.";

  const reason = String(raw.reason ?? "").trim();
  if (!reason) errors.reason = "Motivo requerido.";

  const amount = Number(raw.amount ?? NaN);
  if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = "El monto debe ser mayor a 0.";
  }

  const currency = String(raw.currency ?? "USD").trim();
  if (!isPartnerCurrency(currency)) errors.currency = "Moneda inválida.";

  let fxRate: number | null = null;
  if (raw.fx_rate != null && String(raw.fx_rate).trim() !== "") {
    const fx = Number(raw.fx_rate);
    if (!Number.isFinite(fx) || fx <= 0) errors.fx_rate = "Tasa inválida.";
    else fxRate = fx;
  }

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };

  return {
    ok: true,
    input: {
      charge_id: chargeId,
      reason,
      amount: round2(amount),
      currency: currency as PartnerCurrency,
      fx_rate: fxRate,
      issued_on: strOrNull(raw.issued_on),
      document_id: strOrNull(raw.document_id),
    },
  };
}

// ── Conversion ────────────────────────────────────────────────
export type ConversionInput = {
  from_currency: ConversionFromCurrency;
  to_currency: ConversionToCurrency;
  from_amount: number;
  to_amount: number;
  effective_rate: number;
  market_rate: number | null;
  commission_amount: number | null;
  shipment_id: string | null;
  client_id: string | null;
  converted_on: string | null;
  notes: string | null;
};

export function validateConversionInput(
  raw: Partial<Record<string, unknown>>,
): ValidationResult<ConversionInput> {
  const errors: Record<string, string> = {};

  const from = String(raw.from_currency ?? "").trim();
  if (!isConversionFromCurrency(from)) {
    errors.from_currency = "Moneda origen inválida.";
  }
  const to = String(raw.to_currency ?? "").trim();
  if (!isConversionToCurrency(to)) errors.to_currency = "Moneda destino inválida.";

  const fromAmount = Number(raw.from_amount ?? NaN);
  if (!Number.isFinite(fromAmount) || fromAmount <= 0) {
    errors.from_amount = "Monto origen debe ser mayor a 0.";
  }
  const toAmount = Number(raw.to_amount ?? NaN);
  if (!Number.isFinite(toAmount) || toAmount <= 0) {
    errors.to_amount = "Monto destino debe ser mayor a 0.";
  }

  // effective_rate puede venir explícito o derivarse de to/from.
  let effectiveRate = Number(raw.effective_rate ?? NaN);
  if (
    (!Number.isFinite(effectiveRate) || effectiveRate <= 0) &&
    Number.isFinite(fromAmount) &&
    fromAmount > 0 &&
    Number.isFinite(toAmount)
  ) {
    effectiveRate = toAmount / fromAmount;
  }
  if (!Number.isFinite(effectiveRate) || effectiveRate <= 0) {
    errors.effective_rate = "Tasa efectiva inválida.";
  }

  let marketRate: number | null = null;
  if (raw.market_rate != null && String(raw.market_rate).trim() !== "") {
    const m = Number(raw.market_rate);
    if (!Number.isFinite(m) || m <= 0) errors.market_rate = "Tasa de referencia inválida.";
    else marketRate = m;
  }

  let commission: number | null = null;
  if (
    raw.commission_amount != null &&
    String(raw.commission_amount).trim() !== ""
  ) {
    const c = Number(raw.commission_amount);
    if (!Number.isFinite(c) || c < 0) errors.commission_amount = "Comisión inválida.";
    else commission = c;
  }

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };

  return {
    ok: true,
    input: {
      from_currency: from as ConversionFromCurrency,
      to_currency: to as ConversionToCurrency,
      from_amount: round2(fromAmount),
      to_amount: round2(toAmount),
      effective_rate: round4(effectiveRate),
      market_rate: marketRate,
      commission_amount: commission,
      shipment_id: strOrNull(raw.shipment_id),
      client_id: strOrNull(raw.client_id),
      converted_on: strOrNull(raw.converted_on),
      notes: strOrNull(raw.notes),
    },
  };
}

// ── Claim offset ──────────────────────────────────────────────
export type ClaimOffsetInput = {
  shipment_id: string | null;
  client_id: string | null;
  supplier_id: string | null;
  amount_usd: number;
  claimed_on: string | null;
  evidence_document_id: string | null;
};

export function validateClaimOffsetInput(
  raw: Partial<Record<string, unknown>>,
): ValidationResult<ClaimOffsetInput> {
  const errors: Record<string, string> = {};

  const amount = Number(raw.amount_usd ?? NaN);
  if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount_usd = "El monto del reclamo debe ser mayor a 0.";
  }

  // Al menos cliente o embarque para que el cruce tenga sentido contable.
  const clientId = strOrNull(raw.client_id);
  const shipmentId = strOrNull(raw.shipment_id);
  if (!clientId && !shipmentId) {
    errors.client_id = "Indica el cliente o el embarque del reclamo.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };

  return {
    ok: true,
    input: {
      shipment_id: shipmentId,
      client_id: clientId,
      supplier_id: strOrNull(raw.supplier_id),
      amount_usd: round2(amount),
      claimed_on: strOrNull(raw.claimed_on),
      evidence_document_id: strOrNull(raw.evidence_document_id),
    },
  };
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ partner_statements + lines (SDD-0059 · Slice B1)          ║
// ╚═══════════════════════════════════════════════════════════╝
// Estado de cuenta del socio China importado para un período + sus líneas,
// cada una con su match_status (lo propone el motor de match en
// reconciliation.ts; lo resuelve el operador en Slice B2).

export type StatementStatus = "importado" | "reconciliando" | "cerrado";

export const STATEMENT_STATUSES: StatementStatus[] = [
  "importado",
  "reconciliando",
  "cerrado",
];

export const STATEMENT_STATUS_META: Record<
  StatementStatus,
  { label: string; tone: BadgeTone }
> = {
  importado: { label: "Importado", tone: "info" },
  reconciliando: { label: "Reconciliando", tone: "warning" },
  cerrado: { label: "Cerrado", tone: "success" },
};

export function statementStatusLabel(s: string): string {
  return STATEMENT_STATUS_META[s as StatementStatus]?.label ?? s;
}
export function statementStatusTone(s: string): BadgeTone {
  return STATEMENT_STATUS_META[s as StatementStatus]?.tone ?? "neutral";
}
export function isStatementStatus(v: unknown): v is StatementStatus {
  return (
    typeof v === "string" && (STATEMENT_STATUSES as string[]).includes(v)
  );
}

// ── match_status de una línea ─────────────────────────────────
export type MatchStatus =
  | "sin_match"
  | "match_auto"
  | "match_manual"
  | "discrepancia"
  | "solo_en_estado"
  | "solo_en_erp";

export const MATCH_STATUSES: MatchStatus[] = [
  "sin_match",
  "match_auto",
  "match_manual",
  "discrepancia",
  "solo_en_estado",
  "solo_en_erp",
];

export const MATCH_STATUS_META: Record<
  MatchStatus,
  { label: string; tone: BadgeTone }
> = {
  sin_match: { label: "Sin match", tone: "neutral" },
  match_auto: { label: "Match automático", tone: "success" },
  match_manual: { label: "Match manual", tone: "info" },
  discrepancia: { label: "Discrepancia", tone: "danger" },
  solo_en_estado: { label: "Solo en el estado", tone: "warning" },
  solo_en_erp: { label: "Solo en el ERP", tone: "warning" },
};

export function matchStatusLabel(s: string): string {
  return MATCH_STATUS_META[s as MatchStatus]?.label ?? s;
}
export function matchStatusTone(s: string): BadgeTone {
  return MATCH_STATUS_META[s as MatchStatus]?.tone ?? "neutral";
}
export function isMatchStatus(v: unknown): v is MatchStatus {
  return typeof v === "string" && (MATCH_STATUSES as string[]).includes(v);
}

// ── confianza del match ───────────────────────────────────────
export type MatchConfidence = "alta" | "media" | "baja";

export const MATCH_CONFIDENCES: MatchConfidence[] = ["alta", "media", "baja"];

export const MATCH_CONFIDENCE_META: Record<
  MatchConfidence,
  { label: string; tone: BadgeTone }
> = {
  alta: { label: "Alta", tone: "success" },
  media: { label: "Media", tone: "warning" },
  baja: { label: "Baja", tone: "danger" },
};

export function matchConfidenceLabel(c: string): string {
  return MATCH_CONFIDENCE_META[c as MatchConfidence]?.label ?? c;
}
export function matchConfidenceTone(c: string): BadgeTone {
  return MATCH_CONFIDENCE_META[c as MatchConfidence]?.tone ?? "neutral";
}
export function isMatchConfidence(v: unknown): v is MatchConfidence {
  return typeof v === "string" && (MATCH_CONFIDENCES as string[]).includes(v);
}

/** Fila persistida de partner_statements. */
export type PartnerStatement = {
  id: string;
  tenant_id: string;
  supplier_id: string;
  period_label: string;
  imported_at: string;
  source_file_document_id: string | null;
  total_usd: number;
  total_rmb: number;
  status: StatementStatus;
  created_at: string;
  deleted_at: string | null;
};

/** Fila persistida de partner_statement_lines. */
export type PartnerStatementLine = {
  id: string;
  tenant_id: string;
  statement_id: string;
  raw_description: string;
  raw_description_cn: string | null;
  amount: number;
  currency: PartnerCurrency;
  line_date: string | null;
  match_status: MatchStatus;
  matched_charge_id: string | null;
  matched_ledger_entry_id: string | null;
  match_confidence: MatchConfidence | null;
  note: string | null;
  created_at: string;
  deleted_at: string | null;
};

/** Estado de cuenta + sus líneas (getStatementWithLines). */
export type PartnerStatementWithLines = PartnerStatement & {
  lines: PartnerStatementLine[];
};

// ── Validadores de import ─────────────────────────────────────
export type StatementInput = {
  supplier_id: string;
  period_label: string;
  source_file_document_id: string | null;
  total_usd: number;
  total_rmb: number;
};

export function validateStatementInput(
  raw: Partial<Record<string, unknown>>,
): ValidationResult<StatementInput> {
  const errors: Record<string, string> = {};

  const supplierId = String(raw.supplier_id ?? "").trim();
  if (!supplierId) errors.supplier_id = "Indica el socio (proveedor).";

  const periodLabel = String(raw.period_label ?? "").trim();
  if (!periodLabel) errors.period_label = "Indica el período del estado.";

  const totalUsd = Number(raw.total_usd ?? 0);
  if (!Number.isFinite(totalUsd) || totalUsd < 0) {
    errors.total_usd = "Total USD inválido.";
  }
  const totalRmb = Number(raw.total_rmb ?? 0);
  if (!Number.isFinite(totalRmb) || totalRmb < 0) {
    errors.total_rmb = "Total RMB inválido.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };

  return {
    ok: true,
    input: {
      supplier_id: supplierId,
      period_label: periodLabel,
      source_file_document_id: strOrNull(raw.source_file_document_id),
      total_usd: round2(totalUsd),
      total_rmb: round2(totalRmb),
    },
  };
}

export type StatementLineInput = {
  raw_description: string;
  raw_description_cn: string | null;
  amount: number;
  currency: PartnerCurrency;
  line_date: string | null;
};

export function validateStatementLineInput(
  raw: Partial<Record<string, unknown>>,
): ValidationResult<StatementLineInput> {
  const errors: Record<string, string> = {};

  const description = String(raw.raw_description ?? "").trim();
  if (!description) errors.raw_description = "La línea necesita descripción.";

  const amount = Number(raw.amount ?? NaN);
  if (!Number.isFinite(amount)) {
    errors.amount = "Monto de la línea inválido.";
  }

  const currency = String(raw.currency ?? "USD").trim();
  if (!isPartnerCurrency(currency)) errors.currency = "Moneda inválida.";

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };

  return {
    ok: true,
    input: {
      raw_description: description,
      raw_description_cn: strOrNull(raw.raw_description_cn),
      amount: round2(amount),
      currency: currency as PartnerCurrency,
      line_date: strOrNull(raw.line_date),
    },
  };
}

// ── helper local ──────────────────────────────────────────────
function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}
