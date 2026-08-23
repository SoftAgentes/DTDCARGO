"use client";

/**
 * Botón "Entrar a mi portal" del enlace por correo (SDD-0278).
 *
 * Es un `<form>` con server action a propósito: **un POST**. Los escáneres de
 * correo hacen GET, así que ven la página y no gastan el token — que es el bug
 * que este SDD cierra. Un `<a href>` con el enlace crudo lo rompería otra vez.
 *
 * Calcado de `app/entrar/[code]/_components/EntrarButton.tsx`, incluida la razón
 * de por qué el botón NO se atenúa mientras carga (atenuar el wine aclara el
 * fondo y el texto blanco cae por debajo de AA).
 */

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { abrirConEnlaceAction, type AbrirState } from "../actions";

export function AbrirButton({
  tokenHash,
  type,
}: {
  tokenHash: string;
  type: string;
}) {
  const [state, formAction] = useActionState<AbrirState, FormData>(
    abrirConEnlaceAction,
    {},
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="token_hash" value={tokenHash} />
      <input type="hidden" name="type" value={type} />
      <Submit />
      {state.error && (
        <p
          role="alert"
          style={{
            font: "500 13px/1.5 var(--font-archivo)",
            color: "var(--color-status-danger)",
            margin: "12px 0 0",
          }}
        >
          {state.error}
        </p>
      )}
    </form>
  );
}

/**
 * Separado para poder usar `useFormStatus`, que sólo lee el estado del form si
 * vive en un componente hijo del `<form>`.
 */
function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="btn btn-primary"
      disabled={pending}
      aria-busy={pending}
      style={{ width: "100%" }}
    >
      {pending ? "Abriendo tu portal…" : "Entrar a mi portal"}
    </button>
  );
}
