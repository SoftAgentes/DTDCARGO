/**
 * Tipos TypeScript del módulo Facturación (SDD-0021).
 * Matchea schema de supabase/migrations/0077_invoices.sql.
 *
 * IVA es un toggle de tenant (`tenants.iva_enabled`). Con OFF, `iva_rate=0` y
 * `base_amount = total_amount`. Con ON, `iva_rate=16` y `total = base * 1.16`.
 */

export type InvoiceStatus =
  | "borrador"
  | "emitida"
  | "parcial"
  | "pagada"
  | "vencida"
  | "anulada";

export type InvoiceCurrency = "USD" | "VES" | "USDT" | "CNY";

/** Una línea de la factura. `desc` + cantidad × precio unitario. */
export type InvoiceLine = {
  desc: string;
  qty: number;
  unitPrice: number;
};

export type Invoice = {
  id: string;
  tenant_id: string;
  invoice_code: string;
  client_markbox: string;
  client_name: string;
  shipment_id: string | null;
  shipment_code: string | null;
  currency: InvoiceCurrency;
  fx_rate: number | null;
  iva_rate: number;
  base_amount: number;
  iva_amount: number;
  total_amount: number;
  status: InvoiceStatus;
  issued_at: string | null; // YYYY-MM-DD
  due_date: string | null; // YYYY-MM-DD
  paid_amount: number;
  last_payment_at: string | null;
  lines: InvoiceLine[];
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

/** Lo que el operador edita (sin code, status, timestamps, montos calculados). */
export type InvoiceInput = {
  client_markbox: string;
  client_name: string;
  shipment_id: string | null;
  shipment_code: string | null;
  currency: InvoiceCurrency;
  fx_rate: number | null;
  due_date: string | null;
  lines: InvoiceLine[];
  notes: string | null;
};

export const INVOICE_CURRENCY_OPTIONS: {
  value: InvoiceCurrency;
  label: string;
}[] = [
  { value: "USD", label: "USD · Dólar" },
  { value: "VES", label: "VES · Bolívar" },
  { value: "USDT", label: "USDT · Tether" },
  { value: "CNY", label: "CNY · Yuan" },
];

export const INVOICE_STATUS_OPTIONS: {
  value: InvoiceStatus;
  label: string;
}[] = [
  { value: "borrador", label: "Borrador" },
  { value: "emitida", label: "Emitida" },
  { value: "parcial", label: "Parcial" },
  { value: "pagada", label: "Pagada" },
  { value: "vencida", label: "Vencida" },
  { value: "anulada", label: "Anulada" },
];

/** Tasa de IVA estándar venezolano cuando el toggle está ON. */
export const IVA_RATE_DEFAULT = 16;

export function statusLabel(status: InvoiceStatus): string {
  switch (status) {
    case "borrador":
      return "Borrador";
    case "emitida":
      return "Emitida";
    case "parcial":
      return "Parcial";
    case "pagada":
      return "Pagada";
    case "vencida":
      return "Vencida";
    case "anulada":
      return "Anulada";
  }
}

export function statusBadgeTone(
  status: InvoiceStatus,
): "neutral" | "info" | "success" | "danger" | "warning" {
  switch (status) {
    case "pagada":
      return "success";
    case "emitida":
      return "info";
    case "parcial":
      return "warning";
    case "vencida":
      return "danger";
    case "borrador":
    case "anulada":
      return "neutral";
  }
}

export function currencyLabel(c: InvoiceCurrency): string {
  return INVOICE_CURRENCY_OPTIONS.find((o) => o.value === c)?.label ?? c;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Calcula base / IVA / total de una factura a partir de sus líneas.
 * Función PURA — se usa client-side (total en vivo mientras el operador
 * tipea) y server-side (recálculo defensivo al persistir). UI y BD muestran
 * el mismo número.
 *
 * - base = Σ (qty * unitPrice) de las líneas
 * - si ivaOn: iva = base * ivaRate/100, total = base + iva
 * - si !ivaOn: iva = 0, total = base
 */
export function calcInvoiceTotals(input: {
  lines: { qty: number; unitPrice: number }[];
  ivaRate: number;
  ivaOn: boolean;
}): { base: number; iva: number; total: number } {
  const base = round2(
    (input.lines ?? []).reduce((sum, l) => {
      const qty = Number(l.qty) || 0;
      const price = Number(l.unitPrice) || 0;
      return sum + qty * price;
    }, 0),
  );

  if (!input.ivaOn) {
    return { base, iva: 0, total: base };
  }

  const rate = Number(input.ivaRate) || 0;
  const iva = round2(base * (rate / 100));
  const total = round2(base + iva);
  return { base, iva, total };
}

/** Saldo pendiente de una factura. */
export function computeBalance(
  inv: Pick<Invoice, "total_amount" | "paid_amount">,
): number {
  return round2(Number(inv.total_amount) - Number(inv.paid_amount));
}

/**
 * ¿La factura está vencida? Derivado visual (no se persiste):
 * `due_date < today` y status no es pagada ni anulada.
 */
export function isOverdue(
  inv: Pick<Invoice, "due_date" | "status">,
  today: string = new Date().toISOString().slice(0, 10),
): boolean {
  if (!inv.due_date) return false;
  if (inv.status === "pagada" || inv.status === "anulada") return false;
  return inv.due_date < today;
}

/** El status efectivo para mostrar (deriva `vencida` visualmente). */
export function displayStatus(
  inv: Pick<Invoice, "due_date" | "status">,
  today?: string,
): InvoiceStatus {
  return isOverdue(inv, today) ? "vencida" : inv.status;
}

/** ¿El status permite "Editar"? Solo borrador. */
export function isEditable(status: InvoiceStatus): boolean {
  return status === "borrador";
}

/** ¿El status permite "Registrar pago"? */
export function canRegisterPayment(inv: Pick<Invoice, "status">): boolean {
  return (
    inv.status === "emitida" ||
    inv.status === "parcial" ||
    inv.status === "vencida"
  );
}

/** ¿El status permite "Emitir"? Solo borrador. */
export function canEmit(status: InvoiceStatus): boolean {
  return status === "borrador";
}

/** ¿El status permite "Anular"? Cualquiera menos pagada/anulada. */
export function canVoid(status: InvoiceStatus): boolean {
  return status !== "pagada" && status !== "anulada";
}

export type InvoiceActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<keyof InvoiceInput | "lines", string>>;
  /** En createInvoice el server devuelve el code generado para redirect. */
  createdCode?: string;
};

const VALID_CURRENCIES: InvoiceCurrency[] = ["USD", "VES", "USDT", "CNY"];

/**
 * Normaliza líneas crudas (del client o del JSON) a InvoiceLine[] válidas.
 * Descarta líneas sin descripción. qty/unitPrice negativos → 0.
 */
export function normalizeLines(raw: unknown): InvoiceLine[] {
  if (!Array.isArray(raw)) return [];
  const out: InvoiceLine[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const desc = String(r.desc ?? "").trim();
    if (!desc) continue;
    const qty = Math.max(0, Number(r.qty) || 0);
    const unitPrice = Math.max(0, Number(r.unitPrice) || 0);
    out.push({ desc, qty, unitPrice });
  }
  return out;
}

/** Validación manual (sin zod, patrón del repo). */
export function validateInvoiceInput(input: Partial<InvoiceInput>): {
  input?: InvoiceInput;
  fieldErrors?: InvoiceActionState["fieldErrors"];
} {
  const errors: InvoiceActionState["fieldErrors"] = {};

  if (!input.client_markbox?.trim())
    errors.client_markbox = "Indicá el Shipping Mark del cliente.";
  if (!input.client_name?.trim())
    errors.client_name = "Indicá el nombre del cliente.";

  const currency =
    input.currency && VALID_CURRENCIES.includes(input.currency)
      ? input.currency
      : "USD";

  const lines = normalizeLines(input.lines);
  if (lines.length === 0) {
    errors.lines = "Agrega al menos una línea con descripción y monto.";
  } else if (
    lines.every((l) => l.qty * l.unitPrice <= 0)
  ) {
    errors.lines = "El total de las líneas debe ser mayor a cero.";
  }

  if (input.due_date && !/^\d{4}-\d{2}-\d{2}$/.test(input.due_date)) {
    errors.due_date = "Fecha de vencimiento inválida (YYYY-MM-DD).";
  }

  // VES requiere fx_rate (BCV) para que el monto tenga sentido fiscal.
  if (currency === "VES") {
    const fx = Number(input.fx_rate);
    if (!Number.isFinite(fx) || fx <= 0) {
      errors.fx_rate = "Indicá la tasa BCV para facturar en bolívares.";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { fieldErrors: errors };
  }

  return {
    input: {
      client_markbox: input.client_markbox!.trim(),
      client_name: input.client_name!.trim(),
      shipment_id: input.shipment_id?.trim() || null,
      shipment_code: input.shipment_code?.trim() || null,
      currency,
      fx_rate:
        input.fx_rate != null && Number.isFinite(Number(input.fx_rate))
          ? Number(input.fx_rate)
          : null,
      due_date: input.due_date?.trim() || null,
      lines,
      notes: input.notes?.trim() || null,
    },
  };
}
