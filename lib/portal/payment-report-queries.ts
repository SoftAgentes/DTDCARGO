/**
 * Queries de los reportes de pago (SDD-0134).
 *
 * Portal (por markbox, RLS self) + Studio/admin (por tenant+factura). Funciones
 * puras que reciben un SupabaseClient (el caller elige sesión vs admin). Filtran
 * SIEMPRE explícito (defensa en profundidad, como el resto del portal).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PaymentReport,
  PaymentReportMethod,
  PaymentReportStatus,
} from "@/lib/portal/payment-report-types";
import type { InvoiceCurrency } from "@/lib/studio/invoice-types";
import { MAX_PENDING_REPORTS_PER_INVOICE } from "@/lib/portal/payment-report-types";
import { getPortalClientPrincipal } from "@/lib/portal/portal-queries";

const REPORT_COLS =
  "id, invoice_id, invoice_code, client_markbox, amount, currency, method, paid_at, proof_path, status, note, confirmed_by, confirmed_at, cancelled_at, cancelled_by, resolution_reason, created_at";

type ReportRow = {
  id: string;
  invoice_id: string;
  invoice_code: string;
  client_markbox: string;
  amount: number | string;
  currency: string;
  method: string;
  paid_at: string;
  proof_path: string | null;
  status: string;
  note: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  resolution_reason: string | null;
  created_at: string;
};

/** Mapea una fila cruda de `payment_reports` al modelo de presentación. */
export function mapPaymentReportRow(row: ReportRow): PaymentReport {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    invoiceCode: row.invoice_code,
    clientMarkbox: row.client_markbox,
    amount: Number(row.amount ?? 0),
    currency: row.currency as InvoiceCurrency,
    method: row.method as PaymentReportMethod,
    paidAt: row.paid_at,
    proofPath: row.proof_path,
    status: row.status as PaymentReportStatus,
    note: row.note,
    confirmedBy: row.confirmed_by,
    confirmedAt: row.confirmed_at,
    cancelledAt: row.cancelled_at,
    cancelledBy: row.cancelled_by,
    resolutionReason: row.resolution_reason,
    createdAt: row.created_at,
  };
}

/**
 * Reportes de pago de UNA factura del cliente logueado (portal), recientes
 * primero. Filtra por invoice_code + markbox (RLS self + filtro explícito).
 */
export async function listMyInvoiceReports(
  supabase: SupabaseClient,
  invoiceCode: string,
): Promise<PaymentReport[] | null> {
  try {
    const principal = await getPortalClientPrincipal(supabase);
    if (!principal) return null;

    const { data, error } = await supabase
      .from("payment_reports")
      .select(REPORT_COLS)
      .eq("invoice_code", invoiceCode)
      .eq("tenant_id", principal.tenantId)
      .eq("client_markbox", principal.client.markbox)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error || !Array.isArray(data)) return null;
    return (data as ReportRow[]).map(mapPaymentReportRow);
  } catch {
    return null;
  }
}

/**
 * Reportes de pago de una factura para el Studio (equipo). Requiere client con
 * scope de tenant (sesión del asesor o admin scopeado). Filtra explícito por
 * tenant + invoice.
 */
export async function listInvoiceReports(
  client: SupabaseClient,
  args: { tenantId: string; invoiceId: string },
): Promise<PaymentReport[] | null> {
  try {
    const { data, error } = await client
      .from("payment_reports")
      .select(REPORT_COLS)
      .eq("tenant_id", args.tenantId)
      .eq("invoice_id", args.invoiceId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error || !Array.isArray(data)) return null;
    return (data as ReportRow[]).map(mapPaymentReportRow);
  } catch {
    return null;
  }
}

/**
 * ¿Cuántos reportes `reportado` pendientes tiene la factura? (anti-abuso). Usar
 * con admin client server-side antes de insertar. null significa desconocido,
 * nunca cero: el caller debe detener el alta antes de subir el comprobante.
 */
export async function countPendingReports(
  client: SupabaseClient,
  args: { tenantId: string; invoiceId: string },
): Promise<number | null> {
  try {
    const { count, error } = await client
      .from("payment_reports")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", args.tenantId)
      .eq("invoice_id", args.invoiceId)
      .eq("status", "reportado")
      .is("cancelled_at", null)
      .is("deleted_at", null);

    if (error || typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) {
      return null;
    }
    return count;
  } catch {
    return null;
  }
}

/** ¿La factura alcanzó el tope de reportes pendientes? */
export function isAtPendingLimit(pendingCount: number): boolean {
  return pendingCount >= MAX_PENDING_REPORTS_PER_INVOICE;
}

/** UN reporte por id, scopeado por tenant (Studio/admin). */
export async function getReportById(
  client: SupabaseClient,
  args: { tenantId: string; reportId: string },
): Promise<PaymentReport | null> {
  const { data, error } = await client
    .from("payment_reports")
    .select(REPORT_COLS)
    .eq("tenant_id", args.tenantId)
    .eq("id", args.reportId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) return null;
  return mapPaymentReportRow(data as ReportRow);
}
