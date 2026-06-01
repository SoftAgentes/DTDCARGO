/**
 * Tipos TypeScript del módulo Cobranzas (SDD-0041).
 * Matchea schema de supabase/migrations/0079_cobranzas.sql
 * (payment_receipts + collection_activities).
 *
 * El recibo de pago (`PaymentReceipt`) es el ledger del cobro: un recibo por
 * cobro sobre una factura. `amount` está en la moneda de la factura; el asiento
 * del cobro se hace en USD funcional (ver accounting/receipt-posting.ts).
 *
 * La gestión de cobranza (`CollectionActivity`) es un log liviano: contacto,
 * promesa, nota, recordatorio. El "stage" de la cola CxC se deriva (ver
 * payment-queries.ts), no se persiste como una máquina de estados.
 */

import type { InvoiceCurrency } from "./invoice-types";

/** Método de pago del recibo (texto libre acotado, no enum SQL). */
export type PaymentMethod =
  | "efectivo"
  | "transferencia"
  | "zelle"
  | "pago_movil"
  | "usdt"
  | "otro";

export const PAYMENT_METHODS: PaymentMethod[] = [
  "efectivo",
  "transferencia",
  "zelle",
  "pago_movil",
  "usdt",
  "otro",
];

export const PAYMENT_METHOD_OPTIONS: {
  value: PaymentMethod;
  label: string;
}[] = [
  { value: "transferencia", label: "Transferencia" },
  { value: "zelle", label: "Zelle" },
  { value: "pago_movil", label: "Pago móvil" },
  { value: "usdt", label: "USDT" },
  { value: "efectivo", label: "Efectivo" },
  { value: "otro", label: "Otro" },
];

export function paymentMethodLabel(method: string): string {
  return (
    PAYMENT_METHOD_OPTIONS.find((o) => o.value === method)?.label ?? method
  );
}

/** Un recibo de pago persistido. */
export type PaymentReceipt = {
  id: string;
  tenant_id: string;
  receipt_code: string;
  invoice_id: string;
  client_markbox: string;
  client_name: string;
  amount: number;
  currency: InvoiceCurrency;
  fx_rate: number | null;
  method: string;
  cash_account_id: string;
  reference: string | null;
  received_at: string; // YYYY-MM-DD
  journal_entry_id: string | null;
  notes: string | null;
  created_at: string;
  deleted_at: string | null;
};

/** Tipo de gestión de cobranza. */
export type CollectionKind = "contacto" | "promesa" | "nota" | "recordatorio";

export const COLLECTION_KINDS: CollectionKind[] = [
  "contacto",
  "promesa",
  "nota",
  "recordatorio",
];

export const COLLECTION_KIND_LABEL: Record<CollectionKind, string> = {
  contacto: "Contacto",
  promesa: "Promesa de pago",
  nota: "Nota",
  recordatorio: "Recordatorio enviado",
};

export function collectionKindLabel(kind: string): string {
  return COLLECTION_KIND_LABEL[kind as CollectionKind] ?? kind;
}

/** Una gestión de cobranza persistida. */
export type CollectionActivity = {
  id: string;
  tenant_id: string;
  invoice_id: string;
  kind: CollectionKind;
  promised_amount: number | null;
  promised_date: string | null; // YYYY-MM-DD
  next_followup: string | null; // YYYY-MM-DD
  body: string | null;
  created_at: string;
  created_by: string | null;
};

/**
 * Stage derivado de la cola CxC. NO se persiste — se deriva del saldo, el
 * vencimiento y las gestiones (`derivedStage` en payment-queries.ts).
 */
export type ReceivableStage =
  | "al-dia"
  | "vencido"
  | "contactado"
  | "promesa"
  | "pagado";

export const COB_STAGES: Record<
  ReceivableStage,
  { label: string; tone: "success" | "danger" | "warning" | "info" | "neutral" }
> = {
  "al-dia": { label: "Al día", tone: "success" },
  vencido: { label: "Vencido", tone: "danger" },
  contactado: { label: "Contactado", tone: "warning" },
  promesa: { label: "Promesa de pago", tone: "info" },
  pagado: { label: "Pagado", tone: "success" },
};

export function stageLabel(stage: ReceivableStage): string {
  return COB_STAGES[stage]?.label ?? stage;
}

export function stageTone(
  stage: ReceivableStage,
): "success" | "danger" | "warning" | "info" | "neutral" {
  return COB_STAGES[stage]?.tone ?? "neutral";
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Patrón del receipt_code: R-YYYY-NNNN (mismo que produce la SQL
 * `next_receipt_code`). Padding mínimo 4 dígitos; se extiende si pasa de 9999.
 */
export const RECEIPT_CODE_RE = /^R-\d{4}-\d{4,}$/;

/** Formatea un receipt_code. Espejo en TS de la SQL (para test sin DB). */
export function formatReceiptCode(year: number, seq: number): string {
  const padded = String(seq).padStart(4, "0");
  return `R-${year}-${padded}`;
}

// ── Input + validación del cobro ──────────────────────────────

/** Lo que se registra al cobrar (sin code/id/timestamps). */
export type PaymentInput = {
  amount: number;
  cashAccountId: string;
  method: PaymentMethod;
  receivedAt: string; // YYYY-MM-DD
  reference: string | null;
  notes: string | null;
};

export type PaymentActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof PaymentInput, string>>;
  /** receipt_code generado, para trazabilidad/toast. */
  receiptCode?: string;
};

const VALID_METHODS = new Set<string>(PAYMENT_METHODS);

/**
 * Validación manual del input del cobro (sin zod, patrón del repo).
 *
 * Reglas (criterios de aceptación §6):
 *  - amount > 0 y ≤ saldo (`balance`).
 *  - cuenta de caja/banco requerida (`cashAccountId`).
 *  - receivedAt con formato YYYY-MM-DD.
 *
 * `balance` es el saldo pendiente de la factura (lo pasa el caller).
 */
export function validatePaymentInput(
  input: Partial<PaymentInput>,
  balance: number,
): {
  input?: PaymentInput;
  fieldErrors?: PaymentActionState["fieldErrors"];
} {
  const errors: PaymentActionState["fieldErrors"] = {};

  const amount = round2(Number(input.amount) || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = "El monto del cobro debe ser mayor a cero.";
  } else if (amount > round2(balance) + 0.01) {
    errors.amount = `El cobro no puede superar el saldo ($${round2(balance).toFixed(2)}).`;
  }

  const cashAccountId = (input.cashAccountId ?? "").trim();
  if (!cashAccountId) {
    errors.cashAccountId = "Elegí la cuenta de caja o banco que recibió el pago.";
  }

  const method: PaymentMethod = VALID_METHODS.has(input.method ?? "")
    ? (input.method as PaymentMethod)
    : "transferencia";

  const receivedAt = (input.receivedAt ?? "").trim();
  if (receivedAt && !/^\d{4}-\d{2}-\d{2}$/.test(receivedAt)) {
    errors.receivedAt = "Fecha de cobro inválida (YYYY-MM-DD).";
  }

  if (Object.keys(errors).length > 0) {
    return { fieldErrors: errors };
  }

  return {
    input: {
      amount,
      cashAccountId,
      method,
      receivedAt: receivedAt || new Date().toISOString().slice(0, 10),
      reference: input.reference?.trim() || null,
      notes: input.notes?.trim() || null,
    },
  };
}

// ── Input + validación de la gestión ──────────────────────────

export type ActivityInput = {
  kind: CollectionKind;
  promisedAmount: number | null;
  promisedDate: string | null; // YYYY-MM-DD
  nextFollowup: string | null; // YYYY-MM-DD
  body: string | null;
};

export type ActivityActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof ActivityInput, string>>;
};

const VALID_KINDS = new Set<string>(COLLECTION_KINDS);

/**
 * Validación manual de la gestión de cobranza.
 *  - kind válido.
 *  - si kind='promesa' → promisedDate requerida (formato YYYY-MM-DD).
 *  - fechas con formato válido cuando vienen.
 */
export function validateActivityInput(input: Partial<ActivityInput>): {
  input?: ActivityInput;
  fieldErrors?: ActivityActionState["fieldErrors"];
} {
  const errors: ActivityActionState["fieldErrors"] = {};

  const kind: CollectionKind = VALID_KINDS.has(input.kind ?? "")
    ? (input.kind as CollectionKind)
    : "nota";

  const dateOk = (s: string | null | undefined): boolean =>
    !s || /^\d{4}-\d{2}-\d{2}$/.test(s);

  const promisedDate = input.promisedDate?.trim() || null;
  const nextFollowup = input.nextFollowup?.trim() || null;

  if (!dateOk(promisedDate)) {
    errors.promisedDate = "Fecha de promesa inválida (YYYY-MM-DD).";
  }
  if (!dateOk(nextFollowup)) {
    errors.nextFollowup = "Fecha de seguimiento inválida (YYYY-MM-DD).";
  }
  if (kind === "promesa" && !promisedDate) {
    errors.promisedDate = "Indicá la fecha comprometida de la promesa.";
  }

  const promisedAmount =
    input.promisedAmount != null && Number.isFinite(Number(input.promisedAmount))
      ? round2(Number(input.promisedAmount))
      : null;

  if (Object.keys(errors).length > 0) {
    return { fieldErrors: errors };
  }

  return {
    input: {
      kind,
      promisedAmount: promisedAmount != null && promisedAmount > 0 ? promisedAmount : null,
      promisedDate,
      nextFollowup,
      body: input.body?.trim() || null,
    },
  };
}
