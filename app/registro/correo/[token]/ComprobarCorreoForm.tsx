"use client";

/**
 * Botón del enlace de comprobación (SDD-0646, D-1 opción C). El enlace se gasta
 * con este POST, no al abrir la página, y sólo con la sesión del portal del
 * titular. Al terminar no se ofrece ninguna entrada: quien confirma ya está
 * dentro de su portal.
 */

import { useActionState } from "react";
import {
  COMPROBAR_CORREO_ENTRA_PRIMERO,
  type ComprobarCorreoState,
} from "@/lib/portal/correo-comprobacion";
import { comprobarCorreoAction } from "./actions";

const INITIAL: ComprobarCorreoState = {};

export function ComprobarCorreoForm({
  token,
  markbox,
  conSesion,
}: {
  token: string;
  markbox: string;
  /** ¿Hay una sesión del portal en este navegador? (sólo para el texto; el POST lo vuelve a exigir) */
  conSesion: boolean;
}) {
  const [state, formAction, isPending] = useActionState(comprobarCorreoAction, INITIAL);

  if (state.ok) {
    return (
      <section className="mx-auto max-w-[560px] px-4 py-16 sm:py-24" aria-live="polite">
        <h1
          className="text-[26px] sm:text-[30px] leading-[1.1] text-ink"
          style={{ fontFamily: "var(--font-archivo-black)", letterSpacing: "-0.02em" }}
        >
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
      <h1
        className="text-[26px] sm:text-[30px] leading-[1.1] text-ink"
        style={{ fontFamily: "var(--font-archivo-black)", letterSpacing: "-0.02em" }}
      >
        Comprueba tu correo
      </h1>
      <p className="mt-4 text-[14.5px] text-grey-700 leading-[1.6]">
        Este correo quedó asociado al Shipping Mark{" "}
        <b
          className="text-ink"
          style={{ fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace" }}
        >
          {markbox}
        </b>{" "}
        en el portal de clientes de DTD Cargo.
      </p>
      <p className="mt-3 text-[13.5px] text-grey-700 leading-[1.6]">
        Si no te registraste tú, no lo confirmes y escríbenos.
      </p>
      {conSesion ? (
        <form action={formAction} className="mt-8">
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            disabled={isPending}
            aria-busy={isPending}
            className="inline-flex h-12 items-center rounded-[10px] bg-wine px-6 text-white text-[15px] font-bold disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-2"
          >
            {isPending ? "Comprobando…" : "Sí, este correo es mío"}
          </button>
        </form>
      ) : (
        <p role="status" className="mt-8 text-[14.5px] text-ink leading-[1.6]">
          {COMPROBAR_CORREO_ENTRA_PRIMERO}
        </p>
      )}
      {state.error && (
        <p role="alert" className="mt-4 text-[14px] text-wine leading-[1.6]">
          {state.error}
        </p>
      )}
    </section>
  );
}
