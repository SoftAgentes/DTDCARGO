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
 * Desde SDD-0628 pinta con `<Aviso tono="error">`: misma API, mismo
 * `role="alert"`, la franja y el icono salen de `studio.css`.
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
import { Aviso } from "./Aviso";

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
    <Aviso tono="error" compacto={compact}>
      {msg}
    </Aviso>
  );
}
