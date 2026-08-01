"use client";

/**
 * ConfirmDialog · reemplazo del `window.confirm()` / `window.prompt()` nativo
 * con UI del Studio (tokens, fuentes de marca, accesible). Controlado por el
 * caller vía `open`. Soporta:
 *   - confirmación simple (mensaje + Cancelar/Confirmar)
 *   - confirmación con MOTIVO (reason input · reemplaza window.prompt)
 *   - presión sostenida HTD-01 para una acción R3, siempre con alternativa
 *     accesible de checkbox + click
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

import { useEffect, useId, useRef, useState } from "react";
import { useDialogA11y } from "./drawer/useDialogA11y";

/** Debe permanecer sincronizado con `--dur-hold` en `app/studio/tokens.css`. */
export const HTD_HOLD_DURATION_MS = 1_500;

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
  holdToConfirm = false,
  holdLabel = "Mantén presionado para confirmar",
  holdAlternativeLabel = "Entiendo la consecuencia y prefiero confirmar con un clic",
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
  /** HTD-01: solo para un consumidor R3 clasificado y documentado. */
  holdToConfirm?: boolean;
  holdLabel?: string;
  holdAlternativeLabel?: string;
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
      holdToConfirm={holdToConfirm}
      holdLabel={holdLabel}
      holdAlternativeLabel={holdAlternativeLabel}
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
  holdToConfirm,
  holdLabel,
  holdAlternativeLabel,
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
  holdToConfirm: boolean;
  holdLabel: string;
  holdAlternativeLabel: string;
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
  const holdStatusId = useId();
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSentRef = useRef(false);
  const [holding, setHolding] = useState(false);
  const [holdStatus, setHoldStatus] = useState("");
  const [alternativeChecked, setAlternativeChecked] = useState(false);

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

  function clearHold(status = "") {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setHolding(false);
    if (!requestSentRef.current) setHoldStatus(status);
  }

  useEffect(() => {
    function cancelForInterruption() {
      clearHold("Confirmación cancelada.");
    }
    function cancelWhenHidden() {
      if (document.visibilityState !== "visible") cancelForInterruption();
    }
    window.addEventListener("blur", cancelForInterruption);
    document.addEventListener("visibilitychange", cancelWhenHidden);
    return () => {
      window.removeEventListener("blur", cancelForInterruption);
      document.removeEventListener("visibilitychange", cancelWhenHidden);
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (pending && holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, [pending]);

  useEffect(() => {
    if (error) requestSentRef.current = false;
  }, [error]);

  function reasonValue(): string | null {
    const val = reasonRef.current?.value.trim() ?? "";
    if (reasonRequired && reason && val === "") {
      reasonRef.current?.focus();
      return null;
    }
    return val;
  }

  function confirmOnce() {
    if (pending || requestSentRef.current) return;
    const val = reasonValue();
    if (val === null) return;
    requestSentRef.current = true;
    clearHold();
    onConfirm(val);
  }

  function beginHold() {
    if (!holdToConfirm || alternativeChecked || pending || holding) return;
    if (reasonValue() === null) return;
    setHolding(true);
    setHoldStatus("Presión iniciada. Mantén el control hasta completar.");
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      confirmOnce();
    }, HTD_HOLD_DURATION_MS);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    if (holdToConfirm && !alternativeChecked) {
      confirmRef.current?.focus();
      setHoldStatus("Mantén presionado el botón o usa la alternativa accesible.");
      return;
    }
    confirmOnce();
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

        {holdToConfirm && (
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "var(--s-2)",
              color: "var(--ink)",
              font: "500 12.5px/1.45 var(--f-sans)",
            }}
          >
            <input
              type="checkbox"
              checked={alternativeChecked}
              disabled={pending}
              onChange={(event) => {
                clearHold();
                setAlternativeChecked(event.target.checked);
              }}
              style={{ accentColor: "var(--danger)", marginTop: 2 }}
            />
            <span>{holdAlternativeLabel}</span>
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
            type={holdToConfirm && !alternativeChecked ? "button" : "submit"}
            className={`studio-btn studio-btn-sm ${danger ? "studio-btn-danger" : "studio-btn-primary"}`}
            disabled={pending}
            aria-describedby={holdToConfirm ? holdStatusId : undefined}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              beginHold();
            }}
            onPointerUp={() => clearHold("Confirmación cancelada.")}
            onPointerCancel={() => clearHold("Confirmación cancelada.")}
            onPointerLeave={() => clearHold("Confirmación cancelada.")}
            onKeyDown={(event) => {
              if (event.key !== " " || event.repeat) return;
              event.preventDefault();
              beginHold();
            }}
            onKeyUp={(event) => {
              if (event.key !== " ") return;
              event.preventDefault();
              clearHold("Confirmación cancelada.");
            }}
            onBlur={() => clearHold("Confirmación cancelada.")}
            style={
              holdToConfirm && !alternativeChecked
                ? {
                    position: "relative",
                    overflow: "hidden",
                    isolation: "isolate",
                  }
                : undefined
            }
          >
            {holdToConfirm && !alternativeChecked && (
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: holding ? "100%" : "0%",
                  background: "var(--bg-sidebar)",
                  transition: holding
                    ? "width var(--dur-hold) linear"
                    : "width var(--dur-fast) var(--ease)",
                  zIndex: -1,
                }}
              />
            )}
            {pending
              ? "Procesando…"
              : holdToConfirm && !alternativeChecked
                ? holdLabel
                : confirmLabel}
          </button>
        </div>

        {holdToConfirm && (
          <p
            id={holdStatusId}
            role="status"
            aria-live="polite"
            style={{
              minHeight: "1.45em",
              margin: 0,
              color: "var(--ink-soft)",
              font: "500 11.5px/1.45 var(--f-sans)",
              textAlign: "right",
            }}
          >
            {holdStatus ||
              (alternativeChecked
                ? "La alternativa accesible está activa."
                : "Mantén durante 1,5 segundos. Soltar cancela.")}
          </p>
        )}
      </form>
    </div>
  );
}
