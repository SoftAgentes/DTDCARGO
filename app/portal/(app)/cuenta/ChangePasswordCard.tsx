"use client";

import { useActionState, useState } from "react";
import { CheckIcon } from "@/components/Icon";
import {
  changePortalPasswordAction,
  type ChangePasswordState,
} from "../../actions";

const initial: ChangePasswordState = {};

/**
 * Cambio de contraseña OPCIONAL del portal (SDD-0042 Fase 6 · slice 10.2). No es
 * forzado — la contraseña inicial (cédula/RIF) sigue válida. Colapsado por
 * defecto; el cliente lo abre si quiere cambiarla.
 */
export function ChangePasswordCard() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(changePortalPasswordAction, initial);

  return (
    <div className="mt-8 pt-6 border-t border-grey-200">
      <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-grey-500">
        Contraseña
      </div>

      {state.ok ? (
        <p className="mt-2 inline-flex items-center gap-2 text-[13.5px] font-semibold text-ink">
          <span
            className="w-5 h-5 rounded-full grid place-items-center"
            style={{ background: "var(--color-status-success)", color: "#fff" }}
          >
            <CheckIcon size={13} />
          </span>
          Contraseña actualizada.
        </p>
      ) : !open ? (
        <div className="mt-2">
          <p className="text-[13.5px] text-grey-700 leading-[1.55]">
            Tu contraseña es tu cédula o RIF. Puedes cambiarla cuando quieras —
            no es obligatorio.
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="btn btn-ghost mt-3"
          >
            Cambiar contraseña
          </button>
        </div>
      ) : (
        <form action={action} className="mt-3 flex flex-col gap-3 max-w-[360px]">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-grey-500">
              Nueva contraseña
            </span>
            <input
              type="password"
              name="password"
              required
              autoComplete="new-password"
              minLength={8}
              placeholder="Mínimo 8 caracteres"
              disabled={pending}
              className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-grey-500">
              Repetí la contraseña
            </span>
            <input
              type="password"
              name="confirm"
              required
              autoComplete="new-password"
              minLength={8}
              disabled={pending}
              className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
            />
          </label>
          {state.error && <p className="text-[13px] text-wine leading-[1.4]">{state.error}</p>}
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="btn btn-ghost disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="btn btn-primary disabled:opacity-60 disabled:cursor-wait"
            >
              {pending ? "Guardando…" : "Guardar contraseña"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
