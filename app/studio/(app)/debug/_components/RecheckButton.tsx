"use client";

/**
 * Botón "Re-checkear ahora" para /studio/debug.
 *
 * Dispara la server action `recheckAllAction()` (invalida cache de
 * healthchecks + deploys) y después fuerza `router.refresh()` para
 * re-correr los chequeos en vivo.
 *
 * Loading state mientras dura la transición (spinner + disabled).
 */

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { recheckAllAction } from "../actions";

export function RecheckButton() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleClick = () => {
    startTransition(async () => {
      await recheckAllAction();
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-busy={isPending}
      className="studio-btn studio-btn-ghost studio-btn-sm"
      style={{ minWidth: 160 }}
    >
      {isPending ? (
        <>
          <span
            className="studio-spin"
            aria-hidden
            style={{
              display: "inline-block",
              width: 12,
              height: 12,
              border: "2px solid currentColor",
              borderTopColor: "transparent",
              borderRadius: "50%",
              marginRight: 6,
            }}
          />
          Re-chequeando…
        </>
      ) : (
        <>
          <span aria-hidden style={{ marginRight: 6 }}>↻</span>
          Re-checkear ahora
        </>
      )}
    </button>
  );
}
