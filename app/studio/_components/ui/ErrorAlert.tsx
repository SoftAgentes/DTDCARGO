"use client";

/**
 * ErrorAlert · banner de error estándar del Studio.
 *
 * Toma un ActionState (con errorCode preferido o error legacy string) y lo
 * resuelve a mensaje traducido vía `resolveErrorMessage(t, state)`. Devuelve
 * null si no hay error → se puede dejar montado sin condicional externo.
 *
 * Reemplaza el patrón copy-pasteado `(() => { const msg = resolveErrorMessage
 * (t, state); if (!msg) return null; return <div role="alert">...} )()` que
 * estaba duplicado en BugReportModal, NewReceiptDrawer e InviteUserDrawer.
 *
 * Uso:
 *   <ErrorAlert state={state} />
 *   <ErrorAlert state={res} compact />   // padding/fuente reducidos (en drawers densos)
 */

import {
  resolveErrorMessage,
  useT,
  type ActionStateWithError,
} from "@/lib/i18n";

interface ErrorAlertProps {
  /** ActionState de un useActionState / respuesta de server action. */
  state: ActionStateWithError | null | undefined;
  /** Padding + fuente reducidos para drawers/menus densos. */
  compact?: boolean;
}

export function ErrorAlert({ state, compact = false }: ErrorAlertProps) {
  const t = useT();
  const msg = resolveErrorMessage(t, state);
  if (!msg) return null;

  return (
    <div
      role="alert"
      style={{
        padding: compact ? "8px 10px" : "10px 12px",
        background: "var(--danger-bg)",
        border: "1px solid var(--danger)",
        borderRadius: "var(--r-sm, 6px)",
        color: "var(--danger)",
        font: `500 ${compact ? "11.5px" : "12.5px"}/1.4 var(--f-sans)`,
        margin: 0,
      }}
    >
      {msg}
    </div>
  );
}
