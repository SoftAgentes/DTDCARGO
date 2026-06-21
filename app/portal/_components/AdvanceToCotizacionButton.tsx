"use client";

import { useActionState } from "react";
import {
  advanceEstimateToCotizacionAction,
  type AdvanceEstimateState,
} from "../(app)/estimados/actions";

/**
 * "Avanzar a cotización" en una fila de estimado (Norte). Form de un solo botón:
 * envía el código del estimado a la server action, que lo formaliza (flip a
 * source='studio') y redirige a /portal/cotizaciones. Sólo se monta para estimados
 * elegibles (ver `canAdvanceEstimate`). Muestra error inline si la action falla.
 */
export function AdvanceToCotizacionButton({ code }: { code: string }) {
  const [state, formAction, pending] = useActionState<
    AdvanceEstimateState,
    FormData
  >(advanceEstimateToCotizacionAction, {});

  return (
    <form
      action={formAction}
      className="flex flex-col items-start sm:items-end gap-1"
    >
      <input type="hidden" name="code" value={code} />
      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary disabled:opacity-60 whitespace-nowrap"
      >
        {pending ? "Avanzando…" : "Avanzar a cotización"}
      </button>
      {state.error ? (
        <p className="text-[12px] text-[color:var(--color-status-danger)] max-w-[220px] text-left sm:text-right">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
