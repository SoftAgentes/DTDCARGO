/**
 * Tipos TypeScript del módulo Tesorería (SDD-0044) — el espejo de Cobranzas.
 * Matchea schema de supabase/migrations/0088_tesoreria.sql
 * (suppliers + supplier_bills + supplier_payments).
 *
 * Donde Cobranzas (SDD-0041) modela el COBRO (payment_receipts + asiento
 * DR Caja / CR Clientes 1.1.2), Tesorería modela el PAGO:
 *  - `Supplier` (proveedor-lite, PRV-NNNN): payee real para atar la CxP.
 *  - `SupplierBill` (CxP, CXP-YYYY-NNNN): la cuenta por pagar + asiento de
 *    causación DR gasto / CR 2.1.1 (ver accounting/bill-posting.ts).
 *  - `SupplierPayment` (orden de pago, OP-YYYY-NNNN): el pago + asiento
 *    DR 2.1.1 / CR caja (ver accounting/supplier-payment-posting.ts).
 *
 * `amount`/`total_amount` están en la moneda de la operación; el asiento se
 * hace en USD funcional (si la moneda no es USD, el equivalente se deriva con
 * fx_rate). El "stage" de la cola de CxP se deriva (ver bill-queries.ts).
 */

import type { InvoiceCurrency } from "../invoice-types";

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ── Proveedor (supplier-lite) ─────────────────────────────────

/** Tipo de proveedor (texto libre acotado, no enum SQL). */
export type SupplierType =
  | "proveedor_cn"
  | "naviera"
  | "agente_aduanal"
  | "servicio"
  | "otro";

export const SUPPLIER_TYPES: SupplierType[] = [
  "proveedor_cn",
  "naviera",
  "agente_aduanal",
  "servicio",
  "otro",
];

export const SUPPLIER_TYPE_OPTIONS: {
  value: SupplierType;
  label: string;
}[] = [
  { value: "proveedor_cn", label: "Proveedor CN" },
  { value: "naviera", label: "Naviera" },
  { value: "agente_aduanal", label: "Agente aduanal" },
  { value: "servicio", label: "Servicio" },
  { value: "otro", label: "Otro" },
];

export function supplierTypeLabel(type: string): string {
  return (
    SUPPLIER_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type
  );
}

/** País del proveedor (texto libre acotado). */
export type SupplierCountry = "CN" | "VE" | "otro";

export const SUPPLIER_COUNTRY_OPTIONS: {
  value: SupplierCountry;
  label: string;
}[] = [
  { value: "CN", label: "China (CN)" },
  { value: "VE", label: "Venezuela (VE)" },
  { value: "otro", label: "Otro" },
];

/** Un proveedor persistido. */
export type Supplier = {
  id: string;
  tenant_id: string;
  supplier_code: string;
  name: string;
  name_cn: string | null;
  type: SupplierType;
  country: string;
  default_currency: InvoiceCurrency;
  payment_channel: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  tax_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

/** Lo que el operador edita en el drawer de proveedor (sin code/id/timestamps). */
export type SupplierInput = {
  name: string;
  nameCn: string | null;
  type: SupplierType;
  country: string;
  defaultCurrency: InvoiceCurrency;
  paymentChannel: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  taxId: string | null;
  notes: string | null;
};

export type SupplierActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof SupplierInput, string>>;
  supplierCode?: string;
};

const VALID_SUPPLIER_TYPES = new Set<string>(SUPPLIER_TYPES);
const VALID_CURRENCIES = new Set<string>(["USD", "VES", "USDT", "CNY"]);

/**
 * Validación manual del input de proveedor (sin zod, patrón del repo).
 *  - name requerido.
 *  - type normaliza a 'proveedor_cn' si desconocido.
 *  - defaultCurrency normaliza a 'USD' si desconocida.
 */
export function validateSupplierInput(input: Partial<SupplierInput>): {
  input?: SupplierInput;
  fieldErrors?: SupplierActionState["fieldErrors"];
} {
  const errors: SupplierActionState["fieldErrors"] = {};

  const name = (input.name ?? "").trim();
  if (!name) errors.name = "Indicá el nombre del proveedor.";

  const type: SupplierType = VALID_SUPPLIER_TYPES.has(input.type ?? "")
    ? (input.type as SupplierType)
    : "proveedor_cn";

  const defaultCurrency: InvoiceCurrency = VALID_CURRENCIES.has(
    input.defaultCurrency ?? "",
  )
    ? (input.defaultCurrency as InvoiceCurrency)
    : "USD";

  const country = (input.country ?? "").trim() || "CN";

  if (Object.keys(errors).length > 0) {
    return { fieldErrors: errors };
  }

  return {
    input: {
      name,
      nameCn: input.nameCn?.trim() || null,
      type,
      country,
      defaultCurrency,
      paymentChannel: input.paymentChannel?.trim() || null,
      contactName: input.contactName?.trim() || null,
      contactPhone: input.contactPhone?.trim() || null,
      contactEmail: input.contactEmail?.trim() || null,
      taxId: input.taxId?.trim() || null,
      notes: input.notes?.trim() || null,
    },
  };
}

// ── Cuenta por pagar (CxP) ────────────────────────────────────

/** Estado persistido de la CxP. */
export type BillStatus = "pendiente" | "parcial" | "pagada" | "anulada";

export const BILL_STATUSES: BillStatus[] = [
  "pendiente",
  "parcial",
  "pagada",
  "anulada",
];

export const BILL_STATUS_META: Record<
  BillStatus,
  { label: string; tone: "success" | "danger" | "warning" | "info" | "neutral" }
> = {
  pendiente: { label: "Pendiente", tone: "warning" },
  parcial: { label: "Parcial", tone: "info" },
  pagada: { label: "Pagada", tone: "success" },
  anulada: { label: "Anulada", tone: "neutral" },
};

export function billStatusLabel(status: string): string {
  return BILL_STATUS_META[status as BillStatus]?.label ?? status;
}

export function billStatusTone(
  status: string,
): "success" | "danger" | "warning" | "info" | "neutral" {
  return BILL_STATUS_META[status as BillStatus]?.tone ?? "neutral";
}

/** Una cuenta por pagar persistida. */
export type SupplierBill = {
  id: string;
  tenant_id: string;
  bill_code: string;
  supplier_id: string;
  supplier_name: string;
  concept: string | null;
  expense_account_id: string;
  currency: InvoiceCurrency;
  fx_rate: number | null;
  total_amount: number;
  paid_amount: number;
  status: BillStatus;
  issue_date: string; // YYYY-MM-DD
  due_date: string; // YYYY-MM-DD
  reference: string | null;
  shipment_id: string | null;
  journal_entry_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

/** Saldo pendiente de una CxP (total − pagado, no negativo). */
export function billBalance(
  bill: Pick<SupplierBill, "total_amount" | "paid_amount">,
): number {
  return round2(Math.max(0, Number(bill.total_amount) - Number(bill.paid_amount)));
}

/** Lo que el operador edita al crear una CxP (sin code/status/timestamps). */
export type BillInput = {
  supplierId: string;
  concept: string | null;
  expenseAccountId: string;
  currency: InvoiceCurrency;
  fxRate: number | null;
  totalAmount: number;
  issueDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  reference: string | null;
  shipmentId: string | null;
  notes: string | null;
};

export type BillActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof BillInput, string>>;
  billCode?: string;
};

/**
 * Validación manual del input de CxP (sin zod, patrón del repo).
 *
 * Reglas (criterios de aceptación §6):
 *  - totalAmount > 0.
 *  - proveedor (supplierId) requerido.
 *  - cuenta de gasto (expenseAccountId) requerida.
 *  - vencimiento (dueDate) requerido, formato YYYY-MM-DD.
 *  - issueDate / dueDate con formato válido cuando vienen.
 */
export function validateBillInput(input: Partial<BillInput>): {
  input?: BillInput;
  fieldErrors?: BillActionState["fieldErrors"];
} {
  const errors: BillActionState["fieldErrors"] = {};

  const totalAmount = round2(Number(input.totalAmount) || 0);
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    errors.totalAmount = "El monto de la CxP debe ser mayor a cero.";
  }

  const supplierId = (input.supplierId ?? "").trim();
  if (!supplierId) errors.supplierId = "Elige el proveedor.";

  const expenseAccountId = (input.expenseAccountId ?? "").trim();
  if (!expenseAccountId) {
    errors.expenseAccountId = "Elige la cuenta de costo o gasto a imputar.";
  }

  const dateOk = (s: string | null | undefined): boolean =>
    !s || /^\d{4}-\d{2}-\d{2}$/.test(s);

  const issueDate = (input.issueDate ?? "").trim();
  if (issueDate && !dateOk(issueDate)) {
    errors.issueDate = "Fecha de emisión inválida (YYYY-MM-DD).";
  }

  const dueDate = (input.dueDate ?? "").trim();
  if (!dueDate) {
    errors.dueDate = "Indicá la fecha de vencimiento.";
  } else if (!dateOk(dueDate)) {
    errors.dueDate = "Fecha de vencimiento inválida (YYYY-MM-DD).";
  }

  const currency: InvoiceCurrency = VALID_CURRENCIES.has(input.currency ?? "")
    ? (input.currency as InvoiceCurrency)
    : "USD";

  if (Object.keys(errors).length > 0) {
    return { fieldErrors: errors };
  }

  const fxRate =
    input.fxRate != null && Number.isFinite(Number(input.fxRate)) && Number(input.fxRate) > 0
      ? Number(input.fxRate)
      : null;

  return {
    input: {
      supplierId,
      concept: input.concept?.trim() || null,
      expenseAccountId,
      currency,
      fxRate,
      totalAmount,
      issueDate: issueDate || new Date().toISOString().slice(0, 10),
      dueDate,
      reference: input.reference?.trim() || null,
      shipmentId: input.shipmentId?.trim() || null,
      notes: input.notes?.trim() || null,
    },
  };
}

// ── Orden de pago ─────────────────────────────────────────────

/** Método de pago de la orden (texto libre acotado, no enum SQL). */
export type PaymentMethod =
  | "transferencia"
  | "efectivo"
  | "zelle"
  | "usdt"
  | "alipay"
  | "remesa_china"
  | "otro";

export const PAYMENT_METHODS: PaymentMethod[] = [
  "transferencia",
  "efectivo",
  "zelle",
  "usdt",
  "alipay",
  "remesa_china",
  "otro",
];

export const PAYMENT_METHOD_OPTIONS: {
  value: PaymentMethod;
  label: string;
}[] = [
  { value: "transferencia", label: "Transferencia" },
  { value: "efectivo", label: "Efectivo" },
  { value: "zelle", label: "Zelle" },
  { value: "usdt", label: "USDT" },
  { value: "alipay", label: "Alipay" },
  { value: "remesa_china", label: "Remesa a China" },
  { value: "otro", label: "Otro" },
];

export function paymentMethodLabel(method: string): string {
  return (
    PAYMENT_METHOD_OPTIONS.find((o) => o.value === method)?.label ?? method
  );
}

/** ¿Es una remesa a China? (usdt/remesa_china/alipay o moneda CNY/USDT). */
export function isChinaRemittance(method: string, currency: string): boolean {
  return (
    method === "usdt" ||
    method === "remesa_china" ||
    method === "alipay" ||
    currency === "CNY" ||
    currency === "USDT"
  );
}

/** Una orden de pago persistida. */
export type SupplierPayment = {
  id: string;
  tenant_id: string;
  payment_code: string;
  bill_id: string;
  supplier_id: string;
  supplier_name: string;
  amount: number;
  currency: InvoiceCurrency;
  fx_rate: number | null;
  method: string;
  cash_account_id: string;
  reference: string | null;
  paid_at: string; // YYYY-MM-DD
  journal_entry_id: string | null;
  notes: string | null;
  created_at: string;
  deleted_at: string | null;
};

/** Lo que se registra al pagar (sin code/id/timestamps). */
export type SupplierPaymentInput = {
  amount: number;
  cashAccountId: string;
  method: PaymentMethod;
  paidAt: string; // YYYY-MM-DD
  reference: string | null;
  notes: string | null;
};

export type SupplierPaymentActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof SupplierPaymentInput, string>>;
  /** payment_code generado, para trazabilidad/toast. */
  paymentCode?: string;
};

const VALID_METHODS = new Set<string>(PAYMENT_METHODS);

/**
 * Validación manual del input del pago (sin zod, patrón del repo).
 *
 * Reglas (criterios de aceptación §6):
 *  - amount > 0 y ≤ saldo (`balance`).
 *  - cuenta de caja/banco requerida (`cashAccountId`).
 *  - paidAt con formato YYYY-MM-DD.
 *
 * `balance` es el saldo pendiente de la CxP (lo pasa el caller).
 */
export function validatePaymentInput(
  input: Partial<SupplierPaymentInput>,
  balance: number,
): {
  input?: SupplierPaymentInput;
  fieldErrors?: SupplierPaymentActionState["fieldErrors"];
} {
  const errors: SupplierPaymentActionState["fieldErrors"] = {};

  const amount = round2(Number(input.amount) || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = "El monto del pago debe ser mayor a cero.";
  } else if (amount > round2(balance) + 0.01) {
    errors.amount = `El pago no puede superar el saldo ($${round2(balance).toFixed(2)}).`;
  }

  const cashAccountId = (input.cashAccountId ?? "").trim();
  if (!cashAccountId) {
    errors.cashAccountId = "Elige la cuenta de caja o banco que paga.";
  }

  const method: PaymentMethod = VALID_METHODS.has(input.method ?? "")
    ? (input.method as PaymentMethod)
    : "transferencia";

  const paidAt = (input.paidAt ?? "").trim();
  if (paidAt && !/^\d{4}-\d{2}-\d{2}$/.test(paidAt)) {
    errors.paidAt = "Fecha de pago inválida (YYYY-MM-DD).";
  }

  if (Object.keys(errors).length > 0) {
    return { fieldErrors: errors };
  }

  return {
    input: {
      amount,
      cashAccountId,
      method,
      paidAt: paidAt || new Date().toISOString().slice(0, 10),
      reference: input.reference?.trim() || null,
      notes: input.notes?.trim() || null,
    },
  };
}

// ── Códigos correlativos (espejos en TS para test sin DB) ─────

/** Patrón del supplier_code: PRV-NNNN (mínimo 4 dígitos). */
export const SUPPLIER_CODE_RE = /^PRV-\d{4,}$/;

/** Patrón del bill_code: CXP-YYYY-NNNN (mínimo 4 dígitos). */
export const BILL_CODE_RE = /^CXP-\d{4}-\d{4,}$/;

/** Patrón del payment_code: OP-YYYY-NNNN (mínimo 4 dígitos). */
export const PAYMENT_CODE_RE = /^OP-\d{4}-\d{4,}$/;

/** Formatea un supplier_code. Espejo en TS de la SQL next_supplier_code. */
export function formatSupplierCode(seq: number): string {
  return `PRV-${String(seq).padStart(4, "0")}`;
}

/** Formatea un bill_code. Espejo en TS de la SQL next_bill_code. */
export function formatBillCode(year: number, seq: number): string {
  return `CXP-${year}-${String(seq).padStart(4, "0")}`;
}

/** Formatea un payment_code. Espejo en TS de la SQL next_payment_order_code. */
export function formatPaymentOrderCode(year: number, seq: number): string {
  return `OP-${year}-${String(seq).padStart(4, "0")}`;
}
