"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CheckIcon, ArrowIcon } from "@/components/Icon";
import {
  registerAcceptanceAction,
  type AcceptanceFormState,
} from "./actions";

const initial: AcceptanceFormState = {};

/**
 * Casilla de aceptación + botón de confirmación (SDD-0054 · Slice C).
 *
 * El servidor sella accepted_at/ip/hash — acá solo se marca la casilla y se
 * confirma. Anti-doble-submit con el `pending` de useActionState (botón disabled
 * + label en gerundio). En éxito → confirmación con el acuse AC-YYYY-NNNN.
 */
export function AcceptanceForm({ invoiceCode }: { invoiceCode: string }) {
  const action = registerAcceptanceAction.bind(null, invoiceCode);
  const [state, formAction, pending] = useActionState(action, initial);

  if (state.ok) {
    return (
      <div className="card-shadow bg-white border border-grey-200 rounded-[18px] p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 w-8 h-8 rounded-full grid place-items-center flex-shrink-0"
            style={{ background: "var(--color-status-success)", color: "#fff" }}
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
      className="card-shadow bg-white border border-grey-200 rounded-[18px] p-6 sm:p-8"
    >
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          name="accept"
          required
          disabled={pending}
          className="mt-1 w-[18px] h-[18px] flex-shrink-0 accent-wine"
          style={{ accentColor: "var(--color-wine)" }}
        />
        <span className="text-[14px] text-ink leading-[1.55]">
          Acepto los Términos y Condiciones y las Condiciones del Operador en sus
          versiones vigentes, y confirmo el monto y la medida de esta orden.
        </span>
      </label>

      {state.fieldError ? (
        <p className="mt-3 text-[13px] text-wine leading-[1.4]">
          {state.fieldError}
        </p>
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
          className="btn btn-primary disabled:opacity-60 disabled:cursor-wait"
        >
          {pending ? "Registrando…" : "Aceptar y confirmar"}
        </button>
        <Link href="/portal/facturas" className="btn btn-ghost">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
