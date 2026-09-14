/**
 * Tipos + validador del "Reportar pago" del portal (SDD-0134).
 *
 * El cliente reporta un pago sobre una factura (monto/método/fecha/comprobante) y
 * el asesor lo confirma/rechaza. NO es una pasarela — solo mete el reporte + la
 * evidencia al sistema (baja fricción, deja rastro). Modelo de datos en la migr
 * 0195; RLS portal self por markbox.
 *
 * Sin Zod (convención del Studio): `validatePaymentReportInput()` propio.
 */
import type { InvoiceCurrency } from "@/lib/studio/invoice-types";
import type { InvoiceBadgeTone } from "@/lib/portal/portal-types";

// ── Enums (espejo de los enums SQL de la migr 0195) ──
export type PaymentReportMethod =
  | "transferencia"
  | "pago_movil"
  | "zelle"
  | "binance"
  | "otro";

export type PaymentReportStatus = "reportado" | "confirmado" | "rechazado";

/** Métodos habilitados en el form (decisión founder 2026-07-01). Orden = UI. */
export const PAYMENT_METHODS: readonly PaymentReportMethod[] = [
  "transferencia",
  "pago_movil",
  "zelle",
  "binance",
  "otro",
] as const;

/** Label de cara al cliente por método. */
export const PAYMENT_METHOD_LABELS: Record<PaymentReportMethod, string> = {
  transferencia: "Transferencia",
  pago_movil: "Pago móvil",
  zelle: "Zelle",
  binance: "Binance / USDT",
  otro: "Otro",
};

export function paymentMethodLabel(m: PaymentReportMethod): string {
  return PAYMENT_METHOD_LABELS[m] ?? m;
}

/** Label del estado del reporte (cliente + asesor). */
export const PAYMENT_STATUS_LABELS: Record<PaymentReportStatus, string> = {
  reportado: "Pago reportado",
  confirmado: "Pago confirmado",
  rechazado: "Reporte rechazado",
};

export function paymentStatusLabel(s: PaymentReportStatus): string {
  return PAYMENT_STATUS_LABELS[s] ?? s;
}

/** Tono del badge del estado del reporte (reusa la paleta de facturas). */
export function paymentStatusTone(s: PaymentReportStatus): InvoiceBadgeTone {
  switch (s) {
    case "reportado":
      return "warning"; // pendiente de que el asesor lo revise
    case "confirmado":
      return "success";
    case "rechazado":
      return "danger";
  }
}

/** Un reporte de pago (fila para portal + Studio). */
export type PaymentReport = {
  id: string;
  invoiceId: string;
  invoiceCode: string;
  clientMarkbox: string;
  amount: number;
  currency: InvoiceCurrency;
  method: PaymentReportMethod;
  /** YYYY-MM-DD (fecha del pago según el cliente). */
  paidAt: string;
  /** Path del comprobante en el bucket privado; null si "otro" sin evidencia. */
  proofPath: string | null;
  status: PaymentReportStatus;
  note: string | null;
  confirmedBy: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  resolutionReason: string | null;
  createdAt: string;
};

// ─────────────────────────────────────────────────────────────
// Reglas + validación del input del form
// ─────────────────────────────────────────────────────────────

/** Máximo de reportes `reportado` pendientes por factura (anti-abuso). */
export const MAX_PENDING_REPORTS_PER_INVOICE = 5;

/** Comprobante: 10 MB, PDF + imágenes (espeja el bucket de la migr 0195). */
export const PROOF_MAX_BYTES = 10 * 1024 * 1024;
export const PROOF_ALLOWED_MIME: readonly string[] = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export type PaymentReportFieldErrors = {
  amount?: string;
  method?: string;
  paidAt?: string;
  proof?: string;
  note?: string;
};

/** Input ya validado y normalizado, listo para insertar. */
export type PaymentReportInput = {
  amount: number;
  method: PaymentReportMethod;
  /** YYYY-MM-DD. */
  paidAt: string;
  note: string | null;
};

function isMethod(v: string): v is PaymentReportMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(v);
}

/** ¿String YYYY-MM-DD que representa una fecha real? */
function isIsoDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || v.length !== 10 || v.startsWith("0000-")) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/**
 * Valida + normaliza el input del form de "Reportar pago". No incluye el archivo
 * (eso lo valida la action contra PROOF_*). Devuelve `input` o `fieldErrors`.
 *
 * @param todayIso  fecha de hoy (YYYY-MM-DD) inyectada por el caller (server), para
 *                  no permitir fechas futuras y mantener la función pura/testeable.
 */
export function validatePaymentReportInput(
  raw: { amount?: unknown; method?: unknown; paidAt?: unknown; note?: unknown },
  todayIso: string,
): { input?: PaymentReportInput; fieldErrors?: PaymentReportFieldErrors } {
  const fieldErrors: PaymentReportFieldErrors = {};

  // Monto: número > 0, máx 2 decimales, tope sano.
  const amount = Number(String(raw.amount ?? "").replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) {
    fieldErrors.amount = "Escribe el monto que pagaste (mayor a 0).";
  } else if (amount > 9_999_999.99) {
    fieldErrors.amount = "Ese monto es demasiado alto. Revisa la cifra.";
  } else if (Number(amount.toFixed(2)) !== amount) {
    fieldErrors.amount = "El monto puede tener máximo 2 decimales.";
  }

  // Método.
  const method = String(raw.method ?? "").trim();
  if (!method) {
    fieldErrors.method = "Elige cómo pagaste.";
  } else if (!isMethod(method)) {
    fieldErrors.method = "Método de pago no válido.";
  }

  // Fecha del pago: real y no futura; no se inventa un límite de antigüedad.
  const paidAt = String(raw.paidAt ?? "").trim();
  if (!paidAt) {
    fieldErrors.paidAt = "Indica la fecha del pago.";
  } else if (!isIsoDate(paidAt)) {
    fieldErrors.paidAt = "Fecha no válida.";
  } else if (paidAt > todayIso) {
    fieldErrors.paidAt = "La fecha del pago no puede ser futura.";
  }

  // Nota: opcional, tope 500.
  const noteRaw = String(raw.note ?? "").trim();
  if (noteRaw.length > 500) {
    fieldErrors.note = "La nota es muy larga (máximo 500 caracteres).";
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  return {
    input: {
      amount: Math.round(amount * 100) / 100,
      method: method as PaymentReportMethod,
      paidAt,
      note: noteRaw ? noteRaw : null,
    },
  };
}
