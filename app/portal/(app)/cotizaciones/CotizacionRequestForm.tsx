"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  requestCotizacionAction,
  type CotizacionRequestState,
} from "./actions";
import { COTIZACION_SERVICES } from "@/lib/portal/cotizacion-request";
import { SERVICE_LABELS } from "@/lib/portal/portal-types";
import { ArrowIcon } from "@/components/Icon";
import { submitKeepingDraft } from "@/lib/shared/submit-keeping-draft";

const INPUT =
  "w-full rounded-[12px] border border-grey-200 bg-white px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors focus:border-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ink)]";
const LABEL = "block text-[12px] font-semibold text-grey-700 mb-1.5";
const ERR = "mt-1 text-[12px] text-[color:var(--color-status-danger)]";

/**
 * Form de "Nueva cotización" del portal. El cliente registrado pide que le coticen
 * un servicio; el asesor responde con el precio. Bajo fricción: sólo servicio +
 * detalle son obligatorios (origen/destino traen default). useActionState +
 * requestCotizacionAction (server). Al éxito muestra el código y enlaza a la lista.
 */
export function CotizacionRequestForm({
  defaultDestination,
}: {
  defaultDestination: string;
}) {
  const [state, formAction, pending] = useActionState<
    CotizacionRequestState,
    FormData
  >(requestCotizacionAction, {});

  if (state.ok && state.createdCode) {
    return (
      <div className="mt-8 card-shadow bg-white border border-grey-200 rounded-[18px] p-8 text-center">
        <div
          className="inline-grid place-items-center h-12 w-12 rounded-full mb-4"
          style={{
            background:
              "color-mix(in srgb, var(--color-status-success) 16%, var(--color-white))",
            color: "var(--color-status-success)",
          }}
          aria-hidden
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 13l4 4L19 7"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h2 className="text-[18px] font-bold text-ink">Pedimos tu cotización.</h2>
        <p className="mt-2 text-[14px] text-grey-700 max-w-[46ch] mx-auto leading-[1.55]">
          Tu asesor ya recibió la solicitud{" "}
          <span
            className="font-bold text-ink"
            style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
          >
            {state.createdCode}
          </span>{" "}
          y te va a enviar el precio. La verás acá apenas la cotice.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href="/portal/cotizaciones" className="btn btn-primary inline-flex">
            Ver mis cotizaciones <ArrowIcon size={15} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} onSubmit={submitKeepingDraft(formAction, pending)} className="mt-8 flex flex-col gap-5 max-w-[640px]">
      {state.error ? (
        <div
          className="rounded-[12px] border px-4 py-3 text-[13px]"
          style={{
            borderColor:
              "color-mix(in srgb, var(--color-status-danger) 35%, transparent)",
            background:
              "color-mix(in srgb, var(--color-status-danger) 8%, var(--color-white))",
            color: "var(--color-status-danger)",
          }}
        >
          {state.error}
        </div>
      ) : null}

      <div>
        <label htmlFor="service" className={LABEL}>
          Tipo de servicio
        </label>
        <select id="service" name="service" className={INPUT} defaultValue="" required>
          <option value="" disabled>
            Elige un servicio…
          </option>
          {COTIZACION_SERVICES.map((s) => {
            const l = SERVICE_LABELS[s];
            return (
              <option key={s} value={s}>
                {l.primary}
                {l.sub ? ` · ${l.sub}` : ""}
              </option>
            );
          })}
        </select>
        {state.fieldErrors?.service ? (
          <p className={ERR}>{state.fieldErrors.service}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="description" className={LABEL}>
          ¿Qué quieres cotizar?
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          required
          className={INPUT}
          placeholder="Cuéntanos qué vas a traer, de qué proveedor, cantidades… lo que sepas."
        />
        {state.fieldErrors?.description ? (
          <p className={ERR}>{state.fieldErrors.description}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="origin" className={LABEL}>
            Origen
          </label>
          <input
            id="origin"
            name="origin"
            className={INPUT}
            defaultValue="China"
            placeholder="China"
          />
        </div>
        <div>
          <label htmlFor="destination" className={LABEL}>
            Destino
          </label>
          <input
            id="destination"
            name="destination"
            className={INPUT}
            defaultValue={defaultDestination}
            placeholder="Tu ciudad en Venezuela"
          />
        </div>
      </div>

      <div>
        <span className={LABEL}>Volumen aproximado (opcional)</span>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <input
            name="cbm"
            inputMode="decimal"
            className={INPUT}
            placeholder="CBM"
            aria-label="Volumen en CBM (opcional)"
          />
          <input
            name="weightKg"
            inputMode="decimal"
            className={INPUT}
            placeholder="Kg"
            aria-label="Peso en kg (opcional)"
          />
          <input
            name="boxes"
            inputMode="numeric"
            className={INPUT}
            placeholder="Cajas"
            aria-label="Cantidad de cajas (opcional)"
          />
        </div>
        <p className="mt-1.5 text-[12px] text-grey-500">
          Si no lo sabes aún, no pasa nada — tu asesor lo ajusta al cotizar.
        </p>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="btn btn-primary inline-flex items-center gap-1.5 disabled:opacity-60"
        >
          {pending ? "Enviando…" : "Pedir cotización"}
          {!pending ? <ArrowIcon size={15} /> : null}
        </button>
        <Link
          href="/portal/cotizaciones"
          className="text-[13px] font-semibold text-grey-500 hover:text-ink transition-colors"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
