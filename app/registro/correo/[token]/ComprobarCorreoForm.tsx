"use client";

/**
 * Botón del enlace de comprobación (SDD-0646, D-1 opción C). El enlace se gasta
 * con este POST, no al abrir la página, y sólo con la sesión del portal del
 * titular. Antes de confirmar, el titular ve el correo completo y lo revisa; si
 * no es el suyo, «No es mi correo» no confirma nada y le dice cómo corregirlo.
 * Al terminar no se ofrece ninguna entrada: quien confirma ya está dentro de
 * su portal.
 */

import { useActionState, useState } from "react";
import {
  COMPROBAR_CORREO_ENTRA_PRIMERO,
  COMPROBAR_CORREO_NO_ES_MIO,
  type ComprobarCorreoState,
} from "@/lib/portal/correo-comprobacion";
import { comprobarCorreoAction } from "./actions";

const INITIAL: ComprobarCorreoState = {};
const MONO = { fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" } as const;
const TITULO = { fontFamily: "var(--font-archivo-black)", letterSpacing: "-0.02em" } as const;

export function ComprobarCorreoForm({
  token,
  markbox,
  correo,
}: {
  token: string;
  markbox: string;
  /** El correo por comprobar. Sólo llega si la sesión es la del titular (lo decide la base). */
  correo: string | null;
}) {
  const [state, formAction, isPending] = useActionState(comprobarCorreoAction, INITIAL);
  const [noEsMio, setNoEsMio] = useState(false);

  if (state.ok) {
    return (
      <section className="mx-auto max-w-[560px] px-4 py-16 sm:py-24" aria-live="polite">
        <h1 className="text-[26px] sm:text-[30px] leading-[1.1] text-ink" style={TITULO}>
          Tu correo quedó comprobado
        </h1>
        <p className="mt-4 text-[14.5px] text-grey-700 leading-[1.6]">
          Listo. Ya puedes cerrar esta página.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-[560px] px-4 py-16 sm:py-24">
      <h1 className="text-[26px] sm:text-[30px] leading-[1.1] text-ink" style={TITULO}>
        Comprueba tu correo
      </h1>
      <p className="mt-4 text-[14.5px] text-grey-700 leading-[1.6]">
        Este enlace es para el correo de tu cuenta del Shipping Mark{" "}
        <b className="text-ink" style={MONO}>
          {markbox}
        </b>{" "}
        en el portal de clientes de DTD Cargo.
      </p>
      {correo ? (
        noEsMio ? (
          <p role="status" className="mt-8 text-[14.5px] text-ink leading-[1.6]">
            {COMPROBAR_CORREO_NO_ES_MIO}
          </p>
        ) : (
          <>
            <p className="mt-6 text-[14.5px] text-ink leading-[1.6] font-bold">¿Es este tu correo?</p>
            <p
              className="mt-2 rounded-[10px] border border-grey-200 bg-white px-4 py-3 text-[16px] text-ink break-all"
              style={MONO}
            >
              {correo}
            </p>
            <p className="mt-2 text-[13.5px] text-grey-700 leading-[1.6]">
              Revísalo letra por letra antes de confirmarlo.
            </p>
            <form action={formAction} className="mt-8 flex flex-wrap items-center gap-3">
              <input type="hidden" name="token" value={token} />
              <button
                type="submit"
                disabled={isPending}
                aria-busy={isPending}
                className="inline-flex h-12 items-center rounded-[10px] bg-accion px-6 text-on-accion text-[15px] font-bold disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-accion focus-visible:ring-offset-2"
              >
                {isPending ? "Comprobando…" : "Sí, este correo es mío"}
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => setNoEsMio(true)}
                className="inline-flex h-12 items-center rounded-[10px] border border-grey-300 bg-white px-6 text-ink text-[15px] font-bold hover:bg-grey-100 disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-accion focus-visible:ring-offset-2"
              >
                No es mi correo
              </button>
            </form>
          </>
        )
      ) : (
        <p role="status" className="mt-8 text-[14.5px] text-ink leading-[1.6]">
          {COMPROBAR_CORREO_ENTRA_PRIMERO}
        </p>
      )}
      {state.error && (
        <p role="alert" className="mt-4 text-[14px] text-status-danger leading-[1.6]">
          {state.error}
        </p>
      )}
    </section>
  );
}
