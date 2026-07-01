"use client";

import { useActionState } from "react";
import {
  paymentStatusLabel,
  paymentStatusTone,
  paymentMethodLabel,
  type PaymentReport,
} from "@/lib/portal/payment-report-types";
import { formatInvoiceAmount, INVOICE_TONE_COLOR } from "@/lib/portal/portal-types";
import {
  cancelPaymentReportAction,
  type PaymentReportFormState,
} from "../reportar/actions";

const initial: PaymentReportFormState = {};

/**
 * Panel "Tus reportes de pago" del detalle de factura (SDD-0134). Lista los
 * reportes del cliente con su estado (chip) y permite CANCELAR los que siguen en
 * `reportado` (soft-delete server-side). Datos vienen del server (RLS por markbox).
 */
export function InvoicePaymentReports({
  invoiceCode,
  reports,
}: {
  invoiceCode: string;
  reports: PaymentReport[];
}) {
  if (reports.length === 0) return null;

  return (
    <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-6 sm:p-8">
      <h2 className="text-[12px] font-bold tracking-[0.12em] uppercase text-grey-500">
        Tus reportes de pago
      </h2>
      <ul className="mt-5 flex flex-col divide-y divide-grey-200">
        {reports.map((r) => (
          <ReportRow key={r.id} invoiceCode={invoiceCode} report={r} />
        ))}
      </ul>
    </div>
  );
}

function ReportRow({
  invoiceCode,
  report,
}: {
  invoiceCode: string;
  report: PaymentReport;
}) {
  const tone = paymentStatusTone(report.status);
  const color = INVOICE_TONE_COLOR[tone];
  const cancelable = report.status === "reportado";

  return (
    <li className="py-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div
          className="text-[15px] font-bold text-ink"
          style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
        >
          {formatInvoiceAmount(report.amount, report.currency)}
        </div>
        <div className="mt-0.5 text-[12.5px] text-grey-600">
          {paymentMethodLabel(report.method)} · {report.paidAt}
        </div>
        {report.note ? (
          <p className="mt-1 text-[12.5px] text-grey-500 leading-[1.5]">{report.note}</p>
        ) : null}
      </div>

      <div className="flex flex-col items-end gap-2 flex-shrink-0">
        <span
          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold"
          style={{
            color,
            background: `color-mix(in srgb, ${color} 12%, transparent)`,
            border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
          }}
        >
          {paymentStatusLabel(report.status)}
        </span>
        {cancelable ? (
          <CancelButton invoiceCode={invoiceCode} reportId={report.id} />
        ) : null}
      </div>
    </li>
  );
}

function CancelButton({
  invoiceCode,
  reportId,
}: {
  invoiceCode: string;
  reportId: string;
}) {
  const action = cancelPaymentReportAction.bind(null, invoiceCode);
  const [state, formAction, pending] = useActionState(action, initial);

  if (state.ok) {
    return <span className="text-[11.5px] text-grey-500">Cancelado</span>;
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="report_id" value={reportId} />
      <button
        type="submit"
        disabled={pending}
        className="text-[11.5px] font-semibold text-grey-500 hover:text-wine disabled:opacity-60 disabled:cursor-wait underline"
      >
        {pending ? "Cancelando…" : "Cancelar reporte"}
      </button>
      {state.error ? (
        <p role="alert" className="mt-1 text-[11px] text-wine">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
