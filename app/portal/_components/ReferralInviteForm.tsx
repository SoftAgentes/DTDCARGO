"use client";

import { useActionState, useState } from "react";
import { CheckIcon } from "@/components/Icon";
import {
  inviteReferralAction,
  type InviteReferralState,
} from "../(app)/referidos/actions";
import { PortalFieldError } from "@/app/portal/_components/PortalFieldError";

const initial: InviteReferralState = {};

/**
 * "Invita por correo" — el cliente del portal invita a un nuevo importador por
 * correo. Crea el referido en estado 'invitado' y dispara el correo (server
 * action). Marca del portal (paper/wine, clases del sitio). El invitado nuevo
 * aparece abajo en "Tus referidos" con badge Invitado.
 *
 * Nota honesta: invitar NO acredita crédito — el bono llega cuando el referido
 * hace su primera compra (acreditación automática · Próximamente). Ese copy vive
 * en la tarjeta de créditos y en "Cómo funciona" de la página.
 */
export function ReferralInviteForm() {
  const [state, action, pending] = useActionState(inviteReferralAction, initial);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [handledState, setHandledState] = useState(state);
  if (handledState !== state) {
    setHandledState(state);
    if (state.ok) {
      setEmail("");
      setName("");
    }
  }

  return (
    <div className="mt-5 card-shadow bg-white border border-grey-200 rounded-[18px] p-6 sm:p-7">
      <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-wine-text">
        Invita por correo
      </div>
      <h2 className="mt-1.5 text-[18px] font-bold text-ink leading-tight">
        ¿Conoces a alguien que importa de China?
      </h2>
      <p className="mt-2 text-[13.5px] text-grey-700 leading-[1.55] max-w-[62ch]">
        Le mandamos tu invitación con tu código. Cuando haga su primera compra con
        nosotros, ganas tu crédito — automático (próximamente).
      </p>

      {state.ok && state.invitedEmail && (
        <div
          className="mt-4 rounded-[10px] bg-paper border-l-[3px] px-4 py-3 flex items-start gap-2.5"
          style={{ borderColor: "var(--color-status-success)" }}
        >
          <span
            className="mt-0.5 flex-shrink-0"
            style={{ color: "var(--color-status-success)" }}
          >
            <CheckIcon size={16} />
          </span>
          <p className="text-[13px] text-grey-700 leading-[1.5]">
            Invitación enviada a <strong className="text-ink">{state.invitedEmail}</strong>.
            Aparece abajo como <strong className="text-ink">Invitado</strong>.
          </p>
        </div>
      )}

      <form action={action} className="mt-4 flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-semibold tracking-[0.1em] uppercase text-grey-500">
              Correo del invitado
            </span>
            <input
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="importador@ejemplo.com"
              autoComplete="off"
              className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
            />
            {state.fieldErrors?.email && (
              <PortalFieldError>{state.fieldErrors.email}</PortalFieldError>
            )}
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-semibold tracking-[0.1em] uppercase text-grey-500">
              Nombre (opcional)
            </span>
            <input
              type="text"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Carlos Pérez"
              autoComplete="off"
              className="h-12 px-3.5 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
            />
            {state.fieldErrors?.name && (
              <PortalFieldError>{state.fieldErrors.name}</PortalFieldError>
            )}
          </label>
        </div>

        {state.error && (
          <PortalFieldError nivel="formulario">{state.error}</PortalFieldError>
        )}

        <div>
          <button
            type="submit"
            disabled={pending || !email.trim()}
            aria-busy={pending}
            className="btn btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {pending ? "Enviando…" : "Enviar invitación"}
          </button>
        </div>
      </form>
    </div>
  );
}
