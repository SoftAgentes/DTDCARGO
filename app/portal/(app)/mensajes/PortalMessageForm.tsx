"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  sendPortalMessageAction,
  type PortalMessageState,
} from "./actions";

const initial: PortalMessageState = {};

/**
 * Caja "enviar mensaje" del portal (SDD-0056 · Fase 1 · canal Portal). El
 * mensaje entra a la bandeja del Studio. Tras enviar OK, limpia el textarea y
 * refresca para ver el hilo actualizado.
 */
export function PortalMessageForm() {
  const [state, action, pending] = useActionState(sendPortalMessageAction, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-3">
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
          placeholder="Escribí tu consulta o comentario para tu asesor…"
          className="px-3.5 py-3 rounded-[10px] bg-grey-100 border-0 outline-none text-[14.5px] text-ink leading-[1.5] resize-y disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-1"
        />
      </label>
      {state.error && <p className="text-[13px] text-wine leading-[1.4]">{state.error}</p>}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary disabled:opacity-60 disabled:cursor-wait"
        >
          {pending ? "Enviando…" : "Enviar mensaje"}
        </button>
      </div>
    </form>
  );
}
