"use client";

/**
 * Botón "Entrar a mi portal" (SDD-0253).
 *
 * Es un `<form>` con server action a propósito: **un POST**. El robot de
 * previsualización de WhatsApp hace GET, así que ve la página y no gasta el
 * código — que es justamente el bug que este SDD cierra. Un `<a href>` con el
 * magic-link volvería a romperlo.
 */

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { abrirPortalAction, type EntrarState } from "../actions";

export function EntrarButton({ code }: { code: string }) {
  const [state, formAction] = useActionState<EntrarState, FormData>(
    abrirPortalAction,
    {},
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="code" value={code} />
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
      // Sin `opacity` mientras carga: atenuar el botón entero aclara el wine a
      // ~#9f5058 y el texto blanco encima cae a ≈4,4:1, debajo de AA. El estado
      // ya se comunica con el label y `aria-busy`.
      style={{ width: "100%" }}
    >
      {pending ? "Abriendo tu portal…" : "Entrar a mi portal"}
    </button>
  );
}
