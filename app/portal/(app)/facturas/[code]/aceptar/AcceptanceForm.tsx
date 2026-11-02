"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CheckIcon, ArrowIcon } from "@/components/Icon";
import type { AcceptanceCopy } from "@/lib/studio/legal/acceptance-copy";
import {
  registerAcceptanceAction,
  type AcceptanceFormState,
} from "./actions";
import { PortalFieldError } from "@/app/portal/_components/PortalFieldError";
import { submitKeepingDraft } from "@/lib/shared/submit-keeping-draft";

const initial: AcceptanceFormState = {};

/**
 * Modal de aceptación (SDD-0054 · Slice C + SDD-0067): copy LITERAL de
 * COPY_LEGAL_UI.md §1 (con el fallback pre-v3 — los textos llegan ya armados
 * por `buildAcceptanceCopy`, fuente única). DOS checkboxes obligatorios con
 * fieldError individual; la validación dura vive en el server (la action
 * responde el error por casilla). El servidor sella accepted_at/ip/user_agent/
 * hash — acá solo se marcan las casillas y se confirma.
 *
 * Anti-doble-submit con el `pending` de useActionState (controles disabled +
 * label en gerundio). En éxito → confirmación con el acuse AC-YYYY-NNNN.
 */
export function AcceptanceForm({
  invoiceCode,
  copy,
}: {
  invoiceCode: string;
  copy: AcceptanceCopy;
}) {
  const action = registerAcceptanceAction.bind(null, invoiceCode);
  const [state, formAction, pending] = useActionState(action, initial);

  if (state.ok) {
    return (
      <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 w-8 h-8 rounded-full grid place-items-center flex-shrink-0"
            style={{
              background: "var(--color-status-success)",
              color: "var(--color-white)",
            }}
          >
            <CheckIcon size={18} />
          </span>
          <div>
            <div className="text-[17px] font-bold text-ink">
              {state.alreadyAccepted
                ? "Ya habías aceptado esta orden."
                : "Aceptación registrada."}
            </div>
            <p className="mt-1.5 text-[13.5px] text-grey-700 leading-[1.55]">
              {state.alreadyAccepted
                ? "Tu aceptación quedó registrada. Tu asesor puede emitir la factura."
                : "Tu aceptación de los términos quedó registrada de forma segura. Tu asesor puede emitir la factura."}
            </p>
            {state.acceptanceCode ? (
              <div className="mt-4">
                <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-grey-500">
                  Acuse de aceptación
                </div>
                <div
                  className="mt-1.5 text-[20px] font-bold text-ink"
                  style={{
                    fontFamily:
                      "var(--font-jetbrains-mono), ui-monospace, monospace",
                  }}
                >
                  {state.acceptanceCode}
                </div>
              </div>
            ) : null}
            <Link
              href="/portal/facturas"
              className="btn btn-ghost mt-6 inline-flex items-center gap-2"
            >
              Volver a mis facturas <ArrowIcon size={15} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      onSubmit={submitKeepingDraft(formAction, pending)}
      className="card-shadow bg-white border border-grey-200 rounded-[18px] p-6 sm:p-8"
    >
      {/* Título + cuerpo del modal (COPY_LEGAL_UI.md §1) */}
      <h2 className="text-[17px] font-bold text-ink">{copy.title}</h2>
      <p className="mt-2 text-[13.5px] text-grey-700 leading-[1.55]">
        {copy.body}
      </p>
      <a
        href="#documentos-legales"
        className="mt-1.5 inline-block text-[13px] font-semibold text-wine-text hover:underline"
      >
        {copy.readLinkLabel}
      </a>

      {/* Checkbox 1 · lectura y aceptación de los documentos */}
      <label className="mt-5 flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          name="accept_docs"
          disabled={pending}
          aria-invalid={state.fieldErrors?.accept_docs ? true : undefined}
          aria-describedby={
            state.fieldErrors?.accept_docs ? "err-accept-docs" : undefined
          }
          className="mt-1 w-[18px] h-[18px] flex-shrink-0 accent-wine"
          style={{ accentColor: "var(--color-wine)" }}
        />
        <span className="text-[14px] text-ink leading-[1.55]">
          {copy.checkbox1}
        </span>
      </label>
      {state.fieldErrors?.accept_docs ? (
        <PortalFieldError id="err-accept-docs" nivel="formulario" className="ml-[30px]">{state.fieldErrors.accept_docs}</PortalFieldError>
      ) : null}

      {/* Checkbox 2 · declaración de comerciante (siempre visible) */}
      <label className="mt-4 flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          name="accept_merchant"
          disabled={pending}
          aria-invalid={state.fieldErrors?.accept_merchant ? true : undefined}
          aria-describedby={
            state.fieldErrors?.accept_merchant
              ? "err-accept-merchant"
              : undefined
          }
          className="mt-1 w-[18px] h-[18px] flex-shrink-0 accent-wine"
          style={{ accentColor: "var(--color-wine)" }}
        />
        <span className="text-[14px] text-ink leading-[1.55]">
          {copy.checkbox2}
        </span>
      </label>
      {state.fieldErrors?.accept_merchant ? (
        <PortalFieldError id="err-accept-merchant" nivel="formulario" className="ml-[30px]">{state.fieldErrors.accept_merchant}</PortalFieldError>
      ) : null}

      {state.error ? (
        <div
          className="mt-4 rounded-[12px] border px-4 py-3 text-[13px] leading-[1.5]"
          style={{
            borderColor: "var(--color-status-danger)",
            color: "var(--color-status-danger)",
            background: "color-mix(in srgb, var(--color-status-danger) 8%, transparent)",
          }}
        >
          {state.error}
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="btn btn-primary disabled:opacity-60 disabled:cursor-wait"
        >
          {pending ? "Registrando…" : copy.submitLabel}
        </button>
        <Link href="/portal/facturas" className="btn btn-ghost">
          {copy.backLabel}
        </Link>
      </div>

      {/* Texto probatorio bajo los botones (§1, literal) */}
      <p className="mt-4 text-[11.5px] text-grey-500 leading-[1.5]">
        {copy.legalFooter}
      </p>
    </form>
  );
}
