"use client";

import { useRef, useState, useTransition } from "react";
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
import { PortalFieldError } from "@/app/portal/_components/PortalFieldError";

import { PortalPaymentConfirm } from "@/app/portal/_components/PortalPaymentConfirm";

/**
 * Panel "Tus reportes de pago" del detalle de factura (SDD-0134). Lista los
 * reportes del cliente con su estado (chip) y permite CANCELAR los que siguen en
 * `reportado` sin cancelación previa, conservando historia y comprobante.
 */
export function InvoicePaymentReports({
  invoiceCode,
  reports,
}: {
  invoiceCode: string;
  reports: PaymentReport[] | null;
}) {
  if (reports === null) return <PortalFieldError nivel="formulario">No pudimos consultar tus reportes de pago. Actualiza la factura antes de iniciar otro envío.</PortalFieldError>;
  if (reports.length === 0) return null;

  return (
    <div className="card-shadow-static bg-white border border-grey-200 rounded-[18px] p-6 sm:p-8">
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
  const [cancelledHere, setCancelledHere] = useState(false);
  const [cancelReason, setCancelReason] = useState<string | null>(null);
  const cancelled = Boolean(report.cancelledAt) || cancelledHere;
  const tone = paymentStatusTone(report.status);
  const color = cancelled ? "var(--color-grey-700)" : INVOICE_TONE_COLOR[tone];
  const cancelable = report.status === "reportado" && !cancelled;

  return (
    <li className="py-4 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-2">
      <div className={cancelable ? "min-w-0 row-span-2" : "min-w-0"}>
        <div
          className="text-[15px] font-bold text-ink"
          style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
        >
          {formatInvoiceAmount(report.amount, report.currency)}
        </div>
        <div className="mt-0.5 text-[12.5px] text-grey-700">
          {paymentMethodLabel(report.method)} · {report.paidAt}
        </div>
        {report.note ? (
          <p className="mt-1 text-[12.5px] text-grey-500 leading-[1.5] [overflow-wrap:anywhere]">Nota del cliente: {report.note}</p>
        ) : null}
        {cancelReason || report.resolutionReason ? <p className="mt-1 text-[12.5px] text-grey-700 [overflow-wrap:anywhere]">Motivo: {cancelReason ?? report.resolutionReason}</p> : null}
      </div>

        <span
          className="justify-self-end inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold"
          style={{
            color: "var(--color-ink)",
            background: `color-mix(in srgb, ${color} 12%, transparent)`,
            border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
          }}
        >
          {cancelled ? "Cancelado" : paymentStatusLabel(report.status)}
        </span>
        {cancelable ? (
          <CancelButton invoiceCode={invoiceCode} report={report} onCancelled={(reason) => { setCancelledHere(true); setCancelReason(reason); }} />
        ) : null}
    </li>
  );
}

function CancelButton({ invoiceCode, report, onCancelled }: {
  invoiceCode: string; report: PaymentReport; onCancelled: (reason: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<PaymentReportFormState>({});
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  const [attempt, setAttempt] = useState<{ requestId: string; reason: string } | null>(null);
  const unknown = "No pudimos confirmar el resultado. Conserva este intento y reintenta la misma cancelación. Código: PAGO-RESULTADO-INCIERTO.";

  function confirm(value: string) {
    if (busy.current) return;
    const reason = state.uncertain && attempt ? attempt.reason : value.replace(/\s+/g, " ").trim();
    if (reason.length < 4 || reason.length > 500) {
      setState({ error: "Escribe un motivo de 4 a 500 caracteres." }); return;
    }
    const current = { requestId: attempt?.requestId ?? crypto.randomUUID(), reason };
    setAttempt(current);
    const data = new FormData();
    data.set("report_id", report.id);
    data.set("request_id", current.requestId);
    data.set("reason", current.reason);
    busy.current = true;
    setState((previous) => ({ uncertain: previous.uncertain }));
    startTransition(async () => {
      try {
        const result = await cancelPaymentReportAction(invoiceCode, {}, data);
        if (result?.ok === true && !result.error && !result.fieldErrors && result.receipt?.requestId === current.requestId
          && result.receipt.reportId === report.id && result.receipt.cancelled === true
          && result.receipt.status === "reportado") {
          setOpen(false); onCancelled(current.reason);
        } else {
          setState((previous) => ({ error: result?.error ?? unknown,
            uncertain: previous.uncertain || result?.uncertain === true || !result?.error || result.ok === true }));
        }
      } catch { setState({ error: unknown, uncertain: true }); }
      finally { busy.current = false; }
    });
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} disabled={pending}
      className="col-start-2 justify-self-end min-h-11 px-2 text-[12px] font-semibold text-status-danger underline focus-visible:outline-2 focus-visible:outline-offset-2">
      Cancelar reporte
    </button>
    {!open && state.error ? <PortalFieldError nivel="formulario" className="col-span-2 min-w-0 [overflow-wrap:anywhere] [&>span]:min-w-0">{state.error}</PortalFieldError> : null}
    <PortalPaymentConfirm open={open} title="Cancelar reporte de pago" danger
      message={"Factura " + invoiceCode + " · " + formatInvoiceAmount(report.amount, report.currency)
        + ". El reporte y su comprobante permanecerán en el historial; no se confirmará este pago."
        + (state.uncertain && attempt ? " Motivo conservado: " + attempt.reason : "")}
      reason={!state.uncertain} reasonRequired reasonLabel="Motivo (obligatorio, de 4 a 500 caracteres)"
      confirmLabel={state.uncertain ? "Reintentar cancelación" : "Cancelar reporte"}
      pending={pending} error={state.error}
      onCancel={() => { if (!busy.current) setOpen(false); }} onConfirm={confirm} />
  </>;
}
