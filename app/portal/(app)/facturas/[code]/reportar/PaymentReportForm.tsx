"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CheckIcon, ArrowIcon } from "@/components/Icon";
import {
  PAYMENT_METHODS,
  paymentMethodLabel,
} from "@/lib/portal/payment-report-types";
import {
  reportPaymentAction,
  type PaymentReportFormState,
} from "./actions";

const initial: PaymentReportFormState = {};

/**
 * Form "Reportar pago" (SDD-0134 · Slice A). Monto + método + fecha + comprobante
 * (+ nota opcional). La validación dura vive en el server (la action responde el
 * error por campo). Anti-doble-submit con el `pending` de useActionState. En éxito
 * → confirmación. El comprobante es obligatorio.
 */
export function PaymentReportForm({
  invoiceCode,
  currency,
  todayIso,
}: {
  invoiceCode: string;
  currency: string;
  /** YYYY-MM-DD para el max del date picker (coherente con el server). */
  todayIso: string;
}) {
  const action = reportPaymentAction.bind(null, invoiceCode);
  const [state, formAction, pending] = useActionState(action, initial);

  if (state.ok) {
    return (
      <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 w-8 h-8 rounded-full grid place-items-center flex-shrink-0"
            style={{ background: "var(--color-status-success)", color: "var(--color-white)" }}
          >
            <CheckIcon size={18} />
          </span>
          <div>
            <div className="text-[17px] font-bold text-ink">Reporte enviado.</div>
            <p className="mt-1.5 text-[13.5px] text-grey-700 leading-[1.55]">
              Tu asesor va a revisar el comprobante y confirmar el pago. Vas a ver
              el estado en la factura como <b>“pago reportado”</b> hasta que lo
              confirme.
            </p>
            <Link
              href={`/portal/facturas/${encodeURIComponent(invoiceCode)}`}
              className="btn btn-ghost mt-6 inline-flex items-center gap-2"
            >
              Volver a la factura <ArrowIcon size={15} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="card-shadow bg-white border border-grey-200 rounded-[18px] p-6 sm:p-8 flex flex-col gap-5"
    >
      {/* Monto */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="amount" className="text-[13px] font-semibold text-ink">
          Monto pagado
        </label>
        <div className="flex items-stretch">
          <span
            className="inline-flex items-center px-3 rounded-l-[10px] border border-r-0 border-grey-300 bg-paper text-[13.5px] font-semibold text-grey-600"
            style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
          >
            {currency}
          </span>
          <input
            id="amount"
            name="amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            required
            disabled={pending}
            aria-invalid={state.fieldErrors?.amount ? true : undefined}
            className="flex-1 min-w-0 rounded-r-[10px] border border-grey-300 px-3 py-2.5 text-[15px] text-ink focus:outline-none focus:border-wine"
            placeholder="0.00"
          />
        </div>
        {state.fieldErrors?.amount ? (
          <p role="alert" className="text-[12.5px] text-wine">
            {state.fieldErrors.amount}
          </p>
        ) : null}
      </div>

      {/* Método */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="method" className="text-[13px] font-semibold text-ink">
          ¿Cómo pagaste?
        </label>
        <select
          id="method"
          name="method"
          required
          disabled={pending}
          defaultValue=""
          aria-invalid={state.fieldErrors?.method ? true : undefined}
          className="rounded-[10px] border border-grey-300 px-3 py-2.5 text-[15px] text-ink bg-white focus:outline-none focus:border-wine"
        >
          <option value="" disabled>
            Elige un método…
          </option>
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {paymentMethodLabel(m)}
            </option>
          ))}
        </select>
        {state.fieldErrors?.method ? (
          <p role="alert" className="text-[12.5px] text-wine">
            {state.fieldErrors.method}
          </p>
        ) : null}
      </div>

      {/* Fecha del pago */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="paid_at" className="text-[13px] font-semibold text-ink">
          Fecha del pago
        </label>
        <input
          id="paid_at"
          name="paid_at"
          type="date"
          required
          max={todayIso}
          disabled={pending}
          aria-invalid={state.fieldErrors?.paidAt ? true : undefined}
          className="rounded-[10px] border border-grey-300 px-3 py-2.5 text-[15px] text-ink focus:outline-none focus:border-wine"
        />
        {state.fieldErrors?.paidAt ? (
          <p role="alert" className="text-[12.5px] text-wine">
            {state.fieldErrors.paidAt}
          </p>
        ) : null}
      </div>

      {/* Comprobante */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="proof" className="text-[13px] font-semibold text-ink">
          Comprobante
        </label>
        <input
          id="proof"
          name="proof"
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"
          required
          disabled={pending}
          aria-invalid={state.fieldErrors?.proof ? true : undefined}
          className="text-[13.5px] text-grey-700 file:mr-3 file:rounded-[8px] file:border-0 file:bg-paper file:px-3 file:py-2 file:text-[13px] file:font-semibold file:text-ink hover:file:bg-grey-100"
        />
        <p className="text-[12px] text-grey-500">
          Captura de la transferencia o recibo. PDF, JPG, PNG o WebP (máx 10 MB).
        </p>
        {state.fieldErrors?.proof ? (
          <p role="alert" className="text-[12.5px] text-wine">
            {state.fieldErrors.proof}
          </p>
        ) : null}
      </div>

      {/* Nota opcional */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="note" className="text-[13px] font-semibold text-ink">
          Nota <span className="font-normal text-grey-500">(opcional)</span>
        </label>
        <textarea
          id="note"
          name="note"
          rows={3}
          maxLength={500}
          disabled={pending}
          aria-invalid={state.fieldErrors?.note ? true : undefined}
          className="rounded-[10px] border border-grey-300 px-3 py-2.5 text-[14.5px] text-ink focus:outline-none focus:border-wine resize-y"
          placeholder="Referencia de la transferencia, banco, etc."
        />
        {state.fieldErrors?.note ? (
          <p role="alert" className="text-[12.5px] text-wine">
            {state.fieldErrors.note}
          </p>
        ) : null}
      </div>

      {state.error ? (
        <div
          className="rounded-[12px] border px-4 py-3 text-[13px] leading-[1.5]"
          style={{
            borderColor: "var(--color-status-danger)",
            color: "var(--color-status-danger)",
            background: "color-mix(in srgb, var(--color-status-danger) 8%, transparent)",
          }}
        >
          {state.error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary disabled:opacity-60 disabled:cursor-wait"
        >
          {pending ? "Enviando…" : "Reportar pago"}
        </button>
        <Link
          href={`/portal/facturas/${encodeURIComponent(invoiceCode)}`}
          className="btn btn-ghost"
        >
          Cancelar
        </Link>
      </div>

      <p className="text-[11.5px] text-grey-500 leading-[1.5]">
        Reportar un pago no lo confirma automáticamente: tu asesor revisa el
        comprobante antes de darlo por recibido.
      </p>
    </form>
  );
}
