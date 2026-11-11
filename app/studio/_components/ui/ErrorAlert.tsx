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

import { StatusIcon } from "@/components/StatusIcon";
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
        padding: compact ? "var(--s-2) var(--s-3)" : "var(--s-3) var(--s-4)",
        background: "var(--danger-bg)",
        borderRadius: "var(--r-md)",
        color: "var(--ink)",
        font: `500 ${compact ? "13px" : "14px"}/1.45 var(--f-sans)`,
        margin: 0,
      }}
    >
      <StatusIcon tone="danger" style={{ color: "var(--danger-text)", display: "inline", marginRight: "var(--s-2)", verticalAlign: "middle" }} />
      {msg}
    </div>
  );
}
