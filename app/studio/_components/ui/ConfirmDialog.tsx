"use client";

/**
 * ConfirmDialog · reemplazo del `window.confirm()` / `window.prompt()` nativo
 * con UI del Studio (tokens, fuentes de marca, accesible). Controlado por el
 * caller vía `open`. Soporta:
 *   - confirmación simple (mensaje + Cancelar/Confirmar)
 *   - confirmación con MOTIVO (reason input · reemplaza window.prompt)
 *
 * Patrón de uso:
 *   const [open, setOpen] = useState(false);
 *   <button onClick={() => setOpen(true)}>Anular</button>
 *   <ConfirmDialog
 *     open={open} danger reason
 *     title="Anular comprobante" message="¿Seguro? Queda en historial."
 *     confirmLabel="Anular" pending={pending}
 *     onCancel={() => setOpen(false)}
 *     onConfirm={(motivo) => { setOpen(false); doAction(motivo); }}
 *   />
 *
 * Accesibilidad: role=dialog, aria-modal, Esc cierra, click afuera cierra,
 * focus trap y restauración. En destructivos, el foco inicial es Cancelar.
 */

import { useId, useRef } from "react";
import { useDialogA11y } from "./drawer/useDialogA11y";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger = false,
  pending = false,
  reason = false,
  reasonLabel = "Motivo (opcional)",
  reasonPlaceholder = "",
  reasonRequired = false,
  error,
  initialFocus,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Botón confirmar en rojo (acciones destructivas). */
  danger?: boolean;
  pending?: boolean;
  /** Muestra un input de motivo; onConfirm recibe el texto (o "" si vacío). */
  reason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  reasonRequired?: boolean;
  /** Error devuelto por la acción; permanece visible dentro del diálogo. */
  error?: string;
  /** Default: Cancelar en destructivos; motivo/confirmar en el resto. */
  initialFocus?: "safe" | "confirm" | "reason";
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  if (!open) return null;

  return (
    <OpenConfirmDialog
      title={title}
      message={message}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      danger={danger}
      pending={pending}
      reason={reason}
      reasonLabel={reasonLabel}
      reasonPlaceholder={reasonPlaceholder}
      reasonRequired={reasonRequired}
      error={error}
      initialFocus={initialFocus}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}

function OpenConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger,
  pending,
  reason,
  reasonLabel,
  reasonPlaceholder,
  reasonRequired,
  error,
  initialFocus,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  danger: boolean;
  pending: boolean;
  reason: boolean;
  reasonLabel: string;
  reasonPlaceholder: string;
  reasonRequired: boolean;
  error?: string;
  initialFocus?: "safe" | "confirm" | "reason";
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const panelRef = useRef<HTMLFormElement | null>(null);
  const reasonRef = useRef<HTMLInputElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const reasonId = useId();
  const errorId = useId();

  const resolvedInitialFocus =
    initialFocus === "safe" || (initialFocus === undefined && danger)
      ? cancelRef
      : initialFocus === "reason" ||
          (initialFocus === undefined && reason && !danger)
        ? reasonRef
        : confirmRef;

  useDialogA11y(panelRef, {
    onClose: onCancel,
    pending,
    initialFocusRef: resolvedInitialFocus,
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    const val = reasonRef.current?.value.trim() ?? "";
    if (reasonRequired && reason && val === "") {
      reasonRef.current?.focus();
      return;
    }
    onConfirm(val);
  }

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onCancel();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--scrim, rgba(15, 30, 61, 0.45))",
        // Frost del fondo (BD-031) — el panel de confirmación queda opaco encima.
        backdropFilter: "var(--scrim-blur)",
        WebkitBackdropFilter: "var(--scrim-blur)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <form
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={error ? `${descriptionId} ${errorId}` : descriptionId}
        tabIndex={-1}
        onSubmit={submit}
        style={{
          background: "var(--bg-surface)",
          color: "var(--ink)",
          width: "100%",
          maxWidth: 440,
          borderRadius: "var(--r-lg)",
          border: "1px solid var(--border)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
          padding: 22,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <h2
          id={titleId}
          className="studio-display"
          style={{ margin: 0, font: "800 18px/1.2 var(--f-display)", color: "var(--ink)" }}
        >
          {title}
        </h2>

        <p id={descriptionId} style={{ margin: 0, font: "400 13.5px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}>
          {message}
        </p>

        {reason && (
          <label htmlFor={reasonId} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span className="studio-label">{reasonLabel}</span>
            <input
              id={reasonId}
              ref={reasonRef}
              className="studio-input"
              placeholder={reasonPlaceholder}
              disabled={pending}
              required={reasonRequired}
              style={{ width: "100%" }}
            />
          </label>
        )}

        {error && (
          <div
            id={errorId}
            role="alert"
            style={{
              padding: "var(--s-2) var(--s-3)",
              border: "1px solid var(--danger)",
              borderRadius: "var(--r-sm)",
              background: "var(--danger-bg)",
              color: "var(--danger)",
              font: "500 12.5px/1.45 var(--f-sans)",
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          <button
            ref={cancelRef}
            type="button"
            className="studio-btn studio-btn-ghost studio-btn-sm"
            onClick={onCancel}
            disabled={pending}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="submit"
            className={`studio-btn studio-btn-sm ${danger ? "studio-btn-danger" : "studio-btn-primary"}`}
            disabled={pending}
          >
            {pending ? "Procesando…" : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
