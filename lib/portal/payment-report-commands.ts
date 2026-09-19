/**
 * SDD-0365: transporte exclusivo de los comandos de sesión 0421.
 * El consumidor conserva la identidad del intento; esta frontera nunca genera
 * claves, hace reintentos automáticos ni recurre a escrituras privilegiadas.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { PAYMENT_METHODS, type PaymentReportInput, type PaymentReportStatus } from "./payment-report-types";

type Identity = { requestId: string; reportId: string };
export type PaymentReportCommand =
  | (Identity & { verb: "create"; invoiceId: string; invoiceCode: string; input: PaymentReportInput; proofPath: string })
  | (Identity & { verb: "cancel"; invoiceCode: string; reason: string })
  | (Identity & { verb: "confirm" | "reject"; reason: string });

export type PaymentCommandReceipt = {
  requestId: string;
  reportId: string;
  invoiceId: string;
  invoiceCode: string;
  status: PaymentReportStatus;
  cancelled: boolean;
  auditEventId: string;
  replayed: boolean;
};
export type PaymentReportCommandResult =
  | { ok: true; receipt: PaymentCommandReceipt }
  | { ok: false; error: string; uncertain: boolean };

const UUID_PART = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const UUID = new RegExp("^" + UUID_PART + "$");
const PROOF_PATH = new RegExp("^" + [UUID_PART, UUID_PART, UUID_PART, UUID_PART].join("/") + "\\.(pdf|jpg|png|webp|heic|heif)$");
const RECEIPT_KEYS = ["request_id", "report_id", "invoice_id", "invoice_code", "status", "cancelled", "audit_event_id", "replayed"] as const;
const INPUT_ERROR = "No se envió la operación. Revisa los datos del reporte. Código: PAGO-DATOS.";
const REASON_ERROR = "No se envió la operación. Escribe un motivo de 4 a 500 caracteres. Código: PAGO-MOTIVO.";
const ACCESS_ERROR = "No pudimos acceder al reporte con tu sesión. Actualiza la página o vuelve a entrar. Código: PAGO-ACCESO.";
const UNCERTAIN_ERROR = "No pudimos confirmar el resultado. Conserva este intento y reintenta sin cambiar sus datos, o revisa el reporte antes de iniciar otro. Código: PAGO-RESULTADO-INCIERTO.";

// Sólo pares funcionales exactos de 0421 y 0464. Nunca devolver message/details/hint.
// Los dos de 0464 (SDD-0484) no llegan hasta aplicar esa migración: el mapa va antes.
const REJECTIONS: Record<string, { code: string; error: string }> = {
  PAYMENT_FORBIDDEN: { code: "42501", error: ACCESS_ERROR },
  PAYMENT_NOT_FOUND: { code: "P0002", error: ACCESS_ERROR },
  PAYMENT_INPUT: { code: "22023", error: INPUT_ERROR },
  PAYMENT_REASON: { code: "22023", error: REASON_ERROR },
  PAYMENT_REQUEST_CONFLICT: { code: "23505", error: "Este intento ya corresponde a otros datos. Revisa el reporte antes de iniciar otro. Código: PAGO-CONFLICTO." },
  PAYMENT_STATE: { code: "23514", error: "La operación no se aplicó: el estado cambió o no la permite. Actualiza la factura y revisa el reporte. Código: PAGO-ESTADO." },
  PAYMENT_CURRENCY: { code: "23514", error: "La operación no se aplicó: la moneda no coincide con la factura. Contacta al equipo. Código: PAGO-MONEDA." },
  PAYMENT_PENDING_LIMIT: { code: "23514", error: "No se registró el reporte: hay cinco pendientes en esta factura. Espera su revisión. Código: PAGO-LIMITE." },
  PAYMENT_PROOF: { code: "22023", error: "No se registró el reporte: no pudimos validar su comprobante. Conserva el archivo y reintenta este mismo envío. Código: PAGO-COMPROBANTE." },
  PAYMENT_AUDIT: { code: "23514", error: "La operación no se aplicó porque no pudimos guardar su constancia. Reintenta este mismo intento más tarde. Código: PAGO-CONSTANCIA." },
  PAYMENT_INVOICE_PAID: { code: "23514", error: "La confirmación no se aplicó: la factura ya está pagada. El saldo y el reporte quedan igual; recházalo con su motivo. Código: PAGO-FACTURA-PAGADA." },
  PAYMENT_EXCEEDS_BALANCE: { code: "23514", error: "La confirmación no se aplicó: el monto del reporte supera el saldo pendiente. El saldo y el reporte quedan igual; recházalo con su motivo y pide al cliente el monto correcto. Código: PAGO-EXCEDE-SALDO." },
};

function failure(error: string, uncertain = false): PaymentReportCommandResult {
  return { ok: false, error, uncertain };
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isUuid(value: unknown): value is string {
  return typeof value === "string" && value.length === 36 && UUID.test(value);
}
function isInvoiceCode(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 1 && value.length <= 80
    && !/[\u0000-\u001f\u007f-\u009f]/.test(value);
}
function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
function validCreate(command: Extract<PaymentReportCommand, { verb: "create" }>): boolean {
  const input = command.input;
  if (!isUuid(command.invoiceId) || !isInvoiceCode(command.invoiceCode) || !isRecord(input)) return false;
  if (typeof input.amount !== "number" || !Number.isFinite(input.amount) || input.amount <= 0
    || input.amount > 9_999_999.99 || Number(input.amount.toFixed(2)) !== input.amount) return false;
  if (!PAYMENT_METHODS.includes(input.method) || typeof input.paidAt !== "string"
    || !/^\d{4}-\d{2}-\d{2}$/.test(input.paidAt) || input.paidAt.length !== 10
    || input.paidAt.startsWith("0000-")) return false;
  const paidDate = new Date(input.paidAt + "T00:00:00Z");
  if (Number.isNaN(paidDate.getTime()) || paidDate.toISOString().slice(0, 10) !== input.paidAt
    || input.paidAt > new Date().toISOString().slice(0, 10)) return false;
  if (input.note !== null && (typeof input.note !== "string" || normalizeText(input.note).length > 500)) return false;
  if (typeof command.proofPath !== "string" || /\s/.test(command.proofPath) || !PROOF_PATH.test(command.proofPath)) return false;
  const [, invoiceId, reportId] = command.proofPath.split("/");
  return invoiceId === command.invoiceId && reportId === command.reportId;
}

function decodeReceipt(data: unknown, command: PaymentReportCommand): PaymentCommandReceipt | null {
  if (!isRecord(data) || Object.keys(data).length !== RECEIPT_KEYS.length
    || !RECEIPT_KEYS.every((key) => Object.hasOwn(data, key))) return null;
  if (!isUuid(data.request_id) || data.request_id !== command.requestId
    || !isUuid(data.report_id) || data.report_id !== command.reportId
    || !isUuid(data.invoice_id) || !isUuid(data.audit_event_id)
    || !isInvoiceCode(data.invoice_code) || typeof data.cancelled !== "boolean"
    || typeof data.replayed !== "boolean") return null;
  if ("invoiceCode" in command && data.invoice_code !== command.invoiceCode.trim()) return null;
  if (command.verb === "create" && data.invoice_id !== command.invoiceId) return null;
  const status = command.verb === "confirm" ? "confirmado" : command.verb === "reject" ? "rechazado" : "reportado";
  if (data.status !== status || data.cancelled !== (command.verb === "cancel")) return null;
  return {
    requestId: data.request_id, reportId: data.report_id, invoiceId: data.invoice_id,
    invoiceCode: data.invoice_code, status, cancelled: data.cancelled,
    auditEventId: data.audit_event_id, replayed: data.replayed,
  };
}

/** Usa exclusivamente el cliente de sesión recibido; el SQL vuelve a autorizar. */
export async function runPaymentReportCommand(
  session: SupabaseClient,
  command: PaymentReportCommand,
): Promise<PaymentReportCommandResult> {
  if (!isRecord(command) || !isUuid(command.requestId) || !isUuid(command.reportId)
    || !["create", "cancel", "confirm", "reject"].includes(command.verb)) return failure(INPUT_ERROR);

  let reason = "";
  if (command.verb === "create") {
    if (!validCreate(command)) return failure(INPUT_ERROR);
  } else {
    if (typeof command.reason !== "string") return failure(REASON_ERROR);
    reason = normalizeText(command.reason);
    if (reason.length < 4 || reason.length > 500) return failure(REASON_ERROR);
    if (command.verb === "cancel" && !isInvoiceCode(command.invoiceCode)) return failure(INPUT_ERROR);
  }

  const identity = { p_request_id: command.requestId, p_report_id: command.reportId };
  const name = command.verb === "create" ? "create_portal_payment_report"
    : command.verb === "cancel" ? "cancel_portal_payment_report" : "resolve_payment_report";
  const args = command.verb === "create" ? {
    ...identity, p_invoice_code: command.invoiceCode.trim(), p_amount: command.input.amount,
    p_method: command.input.method, p_paid_at: command.input.paidAt, p_proof_path: command.proofPath,
    p_note: command.input.note === null ? null : normalizeText(command.input.note) || null,
  } : command.verb === "cancel" ? {
    ...identity, p_invoice_code: command.invoiceCode.trim(), p_reason: reason,
  } : {
    ...identity, p_action: command.verb === "confirm" ? "confirmado" : "rechazado", p_reason: reason,
  };

  try {
    const { data, error } = await session.rpc(name, args);
    if (error) {
      const known = typeof error.message === "string" && Object.hasOwn(REJECTIONS, error.message)
        ? REJECTIONS[error.message] : undefined;
      return known && error.code === known.code
        ? failure(known.error) : failure(UNCERTAIN_ERROR, true);
    }
    const receipt = decodeReceipt(data, command);
    return receipt ? { ok: true, receipt } : failure(UNCERTAIN_ERROR, true);
  } catch {
    return failure(UNCERTAIN_ERROR, true);
  }
}
