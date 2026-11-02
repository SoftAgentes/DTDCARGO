"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  sendPortalMessageAction,
  type PortalMessageState,
} from "./actions";
import { PortalFieldError } from "@/app/portal/_components/PortalFieldError";
import { useActionKeepingDraft } from "@/lib/shared/use-action-keeping-draft";

const initial: PortalMessageState = {};

/**
 * Caja "enviar mensaje" del portal (SDD-0056 · Fase 1 · canal Portal). El
 * mensaje entra a la bandeja del Studio. Tras enviar OK, limpia el textarea y
 * refresca para ver el hilo actualizado.
 *
 * `prefill`: texto inicial del textarea (ej. cuando el cliente llega desde
 * "Actualizar mis datos" en Mi perfil → abre el chat con la consulta ya escrita).
 */
export function PortalMessageForm({ prefill }: { prefill?: string }) {
  const [state, formProps, pending] = useActionKeepingDraft(
    sendPortalMessageAction,
    initial,
    "No pudimos confirmar si tu mensaje llegó. Sigue aquí. Intenta de nuevo: no se enviará dos veces.",
    { requestId: true },
  );
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <form ref={formRef} {...formProps} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-grey-500">
          Tu mensaje
        </span>
        <textarea
          name="body"
          required
          rows={3}
          maxLength={4000}
          disabled={pending}
          placeholder="Escribe tu consulta o comentario para tu asesor…"
          defaultValue={prefill}
          className="px-3.5 py-3 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink leading-[1.5] resize-y disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
        />
      </label>
      {state.error && <PortalFieldError nivel="formulario">{state.error}</PortalFieldError>}
      {state.replayed && (
        <p role="status" className="text-[13px] text-grey-700 leading-[1.5]">
          Tu mensaje ya había llegado en tu primer envío. Si lo cambiaste después, envía el cambio en
          otro mensaje.
        </p>
      )}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="btn btn-primary disabled:opacity-60 disabled:cursor-wait"
        >
          {pending ? "Enviando…" : "Enviar mensaje"}
        </button>
      </div>
    </form>
  );
}
