/**
 * Asiento de venta al emitir una factura (SDD-0040 · §5.4, SDD-0573 · I3).
 *
 * La emisión ya confirmada permanece separada. Este adapter delega una sola
 * vez a la RPC; no decide importes, fecha, cuentas, idempotencia o reintentos.
 * La unidad SQL pendiente debe leer la factura persistida y aplicar sus locks,
 * cierre y auditoría para código, cabecera y todas las líneas. La respuesta no
 * certifica un commit exterior ni exactamente-una-vez.
 *
 * Conserva el resultado público best-effort: el caller decide cómo informar
 * un rechazo, dependencia ausente o estado que no pudo confirmarse.
 */

import { createAdminClient } from "@/lib/db/admin";

/** Cuentas usadas por el asiento de venta (codes del CoA seed, SDD-0040 §5). */
export const SALES_AR_CODE = "1.1.2"; // Cuentas por cobrar clientes (debe)
export const SALES_INCOME_CODE = "4.5"; // Otros ingresos por servicios (haber)
export const SALES_IVA_CODE = "2.1.5"; // IVA por pagar (haber, si IVA ON)

export type InvoicePostingInput = {
  tenantId: string;
  invoiceId: string;
  invoiceCode: string;
  baseAmount: number;
  ivaAmount: number;
  totalAmount: number;
  /** Compatibilidad del caller; no se envía. La fecha procede de issued_at persistido. */
  entryDate?: string;
};

export type InvoicePostingResult = {
  ok: boolean;
  /** entry_code validado de una venta creada o reconocida por la RPC. */
  entryCode?: string;
  /** Resultado estable; un rechazo o unknown no demuestra ausencia de antecedentes. */
  skipped?: string;
  error?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Fecha civil del contrato: sin Date, normalización ni fallback a hoy. */
function isCivilDate(value: unknown): value is string {
  if (typeof value !== "string" || value.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);
  const lastDay = month === 2 ? (leap ? 29 : 28) : ([4, 6, 9, 11].includes(month) ? 30 : 31);
  return day <= lastDay;
}

function postingStateUnknown(): InvoicePostingResult {
  return {
    ok: false,
    skipped: "posting-state-unknown",
    error: "No se pudo confirmar el estado del asiento. Revisa el estado contable de la factura antes de volver a solicitarlo.",
  };
}

/** Sólo el contrato escalar v1 autoriza el resultado; nunca se propagan crudos. */
function readAtomicResult(data: unknown, invoiceId: string): InvoicePostingResult | null {
  if (data === null || typeof data !== "object" || Array.isArray(data)) return null;
  const result = data as Record<string, unknown>;
  if (result.version !== 1 || result.invoice_id !== invoiceId) return null;

  if (result.outcome === "posted" || result.outcome === "already_posted") {
    const expectedReason = result.outcome === "posted" ? "posted" : "entry_already_exists";
    if (
      result.reason !== expectedReason ||
      typeof result.entry_id !== "string" || result.entry_id.length !== 36 || !UUID.test(result.entry_id) ||
      typeof result.entry_code !== "string" || result.entry_code.trim().length === 0 ||
      !isCivilDate(result.entry_date)
    ) return null;
    return result.outcome === "posted"
      ? { ok: true, entryCode: result.entry_code }
      : { ok: true, entryCode: result.entry_code, skipped: "entry-already-exists" };
  }

  // null explícito en los tres campos: omitirlos o usar undefined no certifica no-op.
  if (
    result.outcome !== "not_posted" ||
    result.entry_id !== null || result.entry_code !== null || result.entry_date !== null
  ) return null;

  switch (result.reason) {
    case "zero_total":
      return { ok: true, skipped: "zero-total" };
    case "invoice_unavailable":
      return { ok: false, skipped: "invoice-unavailable", error: "La factura no está disponible para registrar el asiento. Revisa su estado y acceso." };
    case "invoice_not_postable":
      return { ok: false, skipped: "invoice-not-postable", error: "El estado de la factura no permite registrar el asiento. Revisa la factura." };
    case "invalid_issue_date":
      return { ok: false, skipped: "invalid-issue-date", error: "La fecha de emisión de la factura requiere revisión antes de registrar el asiento." };
    case "invalid_amounts":
      return { ok: false, skipped: "invalid-amounts", error: "Los importes de la factura requieren revisión antes de registrar el asiento." };
    case "totals_mismatch":
      return { ok: false, skipped: "totals-mismatch", error: "El total de la factura no coincide con su base e impuesto. Revisa los importes." };
    case "missing_accounts":
      return { ok: false, skipped: "missing-accounts", error: "Las cuentas contables necesarias requieren revisión antes de registrar el asiento." };
    case "period_closed":
      return { ok: false, skipped: "period-closed", error: "El período contable está cerrado para un nuevo asiento. Revisa el cierre sin cambiar la fecha de la factura." };
    case "existing_sale_requires_review":
      return { ok: false, skipped: "existing-sale-requires-review", error: "Los antecedentes contables de la factura requieren revisión antes de continuar." };
    default:
      return null;
  }
}

/**
 * Una sola solicitud sobre la factura persistida. Sólo tenant/factura viajan;
 * invoiceCode/importes/entryDate quedan en el tipo por compatibilidad.
 * No throwea, compensa, repite emisión o reintenta automáticamente.
 */
export async function postInvoiceJournalEntry(
  input: InvoicePostingInput,
): Promise<InvoicePostingResult> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("post_invoice_journal_entry_atomic", {
      p_tenant_id: input.tenantId,
      p_invoice_id: input.invoiceId,
    });
    if (error) {
      if (error.code === "42883" || error.code === "PGRST202") {
        return {
          ok: false,
          skipped: "atomic-posting-unavailable",
          error: "El registro contable no está disponible. Revisa la disponibilidad del servicio antes de volver a solicitar el asiento.",
        };
      }
      return postingStateUnknown();
    }
    return readAtomicResult(data, input.invoiceId) ?? postingStateUnknown();
  } catch {
    // Una excepción puede ocurrir después de un commit: no afirma ausencia ni rollback.
    return postingStateUnknown();
  }
}
