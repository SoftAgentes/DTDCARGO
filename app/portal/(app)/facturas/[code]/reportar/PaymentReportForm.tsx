"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { ArrowIcon } from "@/components/Icon";
import { StatusIcon } from "@/components/StatusIcon";
import {
  PAYMENT_METHODS,
  paymentMethodLabel,
  validatePaymentReportInput,
  PROOF_ALLOWED_MIME,
  PROOF_MAX_BYTES,
  type PaymentReportFieldErrors,
} from "@/lib/portal/payment-report-types";
import {
  reportPaymentAction,
  type PaymentReportFormState,
} from "./actions";
import { PortalFieldError } from "@/app/portal/_components/PortalFieldError";

const initial: PaymentReportFormState = {};

/**
 * Form "Reportar pago" (SDD-0134 · Slice A). Monto + método + fecha + comprobante
 * (+ nota opcional). La validación dura vive en el server (la action responde el
 * error por campo). Identidad estable y archivo conservado entre reintentos. En éxito
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
  const [state, setState] = useState<PaymentReportFormState>(initial);
  const [pending, startTransition] = useTransition();
  const [dirty, setDirty] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const focusErrors = useRef(false);
  const identity = useRef<{ requestId: string; reportId: string } | null>(null);
  const lastSubmission = useRef<FormData | null>(null);

  function errorsFor(data: FormData): PaymentReportFieldErrors {
    const errors = { ...validatePaymentReportInput({
      amount: data.get("amount"), method: data.get("method"),
      paidAt: data.get("paid_at"), note: data.get("note"),
    }, state.uncertain && lastSubmission.current
      ? { kind: "recovery-candidate" } : { kind: "new", businessDay: todayIso }).fieldErrors };
    const file = data.get("proof");
    if (!(file instanceof File) || file.size <= 0) errors.proof = "Adjunta el comprobante de tu pago.";
    else if (!PROOF_ALLOWED_MIME.includes(file.type)) errors.proof = "Formato de comprobante no válido.";
    else if (file.size > PROOF_MAX_BYTES) errors.proof = "El comprobante pesa demasiado (máx 10 MB).";
    return errors;
  }

  function revalidateField(event: FormEvent<HTMLFormElement>, onBlur = false) {
    if (busyRef.current || state.uncertain || !formRef.current) return;
    const field = (event.target as HTMLInputElement).name;
    const key = (field === "paid_at" ? "paidAt" : field) as keyof PaymentReportFieldErrors;
    if (!["amount", "method", "paidAt", "proof", "note"].includes(key)) return;
    if (!onBlur) setDirty(true);
    if (!onBlur && !state.fieldErrors?.[key]) return;
    const currentError = errorsFor(new FormData(formRef.current))[key];
    setState((previous) => {
      const fieldErrors = { ...previous.fieldErrors };
      if (currentError) fieldErrors[key] = currentError;
      else delete fieldErrors[key];
      return { ...previous, fieldErrors };
    });
  }

  useEffect(() => {
    if (pending || !focusErrors.current) return;
    focusErrors.current = false;
    const invalid = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (invalid) invalid.focus();
    else if (state.error) errorRef.current?.focus();
  }, [state, pending]);

  useEffect(() => {
    if (state.ok || (!pending && !dirty)) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const stopNavigation = (event: MouseEvent) => {
      if (pending && event.target instanceof Element && event.target.closest("a[href]")) {
        event.preventDefault(); event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", stopNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", stopNavigation, true);
    };
  }, [pending, dirty, state.ok]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;
    const data = state.uncertain && lastSubmission.current
      ? lastSubmission.current : new FormData(event.currentTarget);
    const fieldErrors = errorsFor(data);
    if (Object.keys(fieldErrors).length) { focusErrors.current = true; setState({ fieldErrors }); return; }
    identity.current ??= { requestId: crypto.randomUUID(), reportId: crypto.randomUUID() };
    const attempt = identity.current;
    data.set("request_id", attempt.requestId);
    data.set("report_id", attempt.reportId);
    lastSubmission.current = data;
    busyRef.current = true;
    setState((previous) => ({ uncertain: previous.uncertain }));
    startTransition(async () => {
      try {
        const result = await reportPaymentAction(invoiceCode, {}, data);
        focusErrors.current = true;
        if (result?.ok === true && !result.error && !result.fieldErrors && result.receipt?.requestId === attempt.requestId
          && result.receipt.reportId === attempt.reportId && result.receipt.status === "reportado"
          && result.receipt.cancelled === false) {
          setState(result);
        } else if (result?.error || result?.fieldErrors) {
          setState((previous) => ({
            error: result.error, fieldErrors: result.fieldErrors,
            uncertain: previous.uncertain || result.uncertain || result.ok === true,
          }));
        } else {
          setState({ error: "No pudimos confirmar el resultado. Reintenta este mismo envío o revisa la factura antes de iniciar otro. Código: PAGO-RESULTADO-INCIERTO.", uncertain: true });
        }
      } catch {
        focusErrors.current = true;
        setState({ error: "Se perdió la respuesta. Conserva este intento y reintenta el mismo envío. Código: PAGO-RESULTADO-INCIERTO.", uncertain: true });
      } finally { busyRef.current = false; }
    });
  }

  if (state.ok) {
    return (
      <div className="card-shadow-static bg-white border border-grey-200 rounded-[18px] p-6 sm:p-8">
        {/* SDD-0603 · T4e (BD-037): franja plana de éxito; el verde, solo en el
            icono (antes, círculo relleno con color en línea). */}
        <div className="portal-aviso rounded-[12px] p-4" data-tono="exito">
          <span className="portal-aviso-icono">
            <StatusIcon tone="success" size={18} />
          </span>
          <div className="portal-aviso-cuerpo">
            <div role="status" className="text-[17px] font-bold text-ink">Reporte registrado.</div>
            <p className="mt-1.5 text-[13.5px] text-grey-700 leading-[1.55]">
              El reporte quedó registrado. Revisa su estado actualizado en la
              factura; reportarlo no confirma por sí solo la recepción del pago.
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
      ref={formRef}
      onSubmit={submit}
      onInput={revalidateField}
      onBlur={(event) => revalidateField(event, true)}
      noValidate
      aria-busy={pending}
      className="card-shadow-static bg-white border border-grey-200 rounded-[18px] p-6 sm:p-8 flex flex-col gap-5"
    >
      {/* Monto */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="amount" className="text-[13px] font-semibold text-ink">
          Monto pagado
        </label>
        <div className="flex items-stretch">
          <span
            className="inline-flex items-center px-3 rounded-l-[10px] border border-r-0 border-grey-700 bg-paper text-[13.5px] font-semibold text-grey-700"
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
            disabled={pending || state.uncertain}
            aria-invalid={state.fieldErrors?.amount ? true : undefined}
          aria-describedby={state.fieldErrors?.amount ? "amount-error" : undefined}
            className="flex-1 min-w-0 rounded-r-[10px] border border-grey-700 px-3 py-2.5 text-[15px] text-ink placeholder:text-grey-700 focus:outline-2 focus:outline-offset-2 focus:outline-ink focus:border-ink"
            placeholder="0.00"
          />
        </div>
        {state.fieldErrors?.amount ? (
          <PortalFieldError id="amount-error">{state.fieldErrors.amount}</PortalFieldError>
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
          disabled={pending || state.uncertain}
          defaultValue=""
          aria-invalid={state.fieldErrors?.method ? true : undefined}
          aria-describedby={state.fieldErrors?.method ? "method-error" : undefined}
          className="rounded-[10px] border border-grey-700 px-3 py-2.5 text-[15px] text-ink bg-white placeholder:text-grey-700 focus:outline-2 focus:outline-offset-2 focus:outline-ink focus:border-ink"
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
          <PortalFieldError id="method-error">{state.fieldErrors.method}</PortalFieldError>
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
          disabled={pending || state.uncertain}
          aria-invalid={state.fieldErrors?.paidAt ? true : undefined}
          aria-describedby={state.fieldErrors?.paidAt ? "paid_at-error" : undefined}
          className="rounded-[10px] border border-grey-700 px-3 py-2.5 text-[15px] text-ink placeholder:text-grey-700 focus:outline-2 focus:outline-offset-2 focus:outline-ink focus:border-ink"
        />
        {state.fieldErrors?.paidAt ? (
          <PortalFieldError id="paid_at-error">{state.fieldErrors.paidAt}</PortalFieldError>
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
          disabled={pending || state.uncertain}
          aria-invalid={state.fieldErrors?.proof ? true : undefined}
          aria-describedby={state.fieldErrors?.proof ? "proof-error" : undefined}
          className="text-[13.5px] text-grey-700 file:min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink file:mr-3 file:rounded-[8px] file:border-0 file:bg-paper file:px-3 file:py-2 file:text-[13px] file:font-semibold file:text-ink hover:file:bg-grey-100"
        />
        <p className="text-[12px] text-grey-500">
          Captura de la transferencia o recibo. PDF, JPG, PNG o WebP (máx 10 MB).
        </p>
        {state.fieldErrors?.proof ? (
          <PortalFieldError id="proof-error">{state.fieldErrors.proof}</PortalFieldError>
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
          disabled={pending || state.uncertain}
          aria-invalid={state.fieldErrors?.note ? true : undefined}
          aria-describedby={state.fieldErrors?.note ? "note-error" : undefined}
          className="rounded-[10px] border border-grey-700 px-3 py-2.5 text-[14.5px] text-ink placeholder:text-grey-700 focus:outline-2 focus:outline-offset-2 focus:outline-ink focus:border-ink resize-y"
          placeholder="Referencia de la transferencia, banco, etc."
        />
        {state.fieldErrors?.note ? (
          <PortalFieldError id="note-error">{state.fieldErrors.note}</PortalFieldError>
        ) : null}
      </div>

      {state.error ? (
        <div ref={errorRef} tabIndex={-1}>
          <PortalFieldError nivel="formulario">{state.error}</PortalFieldError>
        </div>
      ) : null}
      {state.uncertain ? (
        <p className="text-[13px] text-grey-700">Conservamos los datos y el archivo de este intento. El reintento usa exactamente el mismo envío.</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Link
          href={`/portal/facturas/${encodeURIComponent(invoiceCode)}`}
          className="btn btn-ghost"
          aria-disabled={pending}
          onClick={(event) => { if (busyRef.current) event.preventDefault(); }}
        >
          Volver a la factura
        </Link>
        <button type="submit" disabled={pending} aria-busy={pending}
          className="btn btn-primary disabled:opacity-60 disabled:cursor-wait">
          {pending ? "Enviando…" : state.uncertain ? "Reintentar el mismo envío" : "Reportar pago"}
        </button>
      </div>
      {dirty ? <p className="text-[12px] text-grey-700">Al salir de esta página se perderán los datos y el archivo seleccionados de este intento.</p> : null}

      <p className="text-[11.5px] text-grey-500 leading-[1.5]">
        Reportar un pago no lo confirma automáticamente: tu asesor revisa el
        comprobante antes de darlo por recibido.
      </p>
    </form>
  );
}
