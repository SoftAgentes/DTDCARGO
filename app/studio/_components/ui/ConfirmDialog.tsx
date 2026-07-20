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
 * focus inicial al input (si reason) o al botón confirmar.
 */

import { useEffect, useRef } from "react";

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
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const reasonRef = useRef<HTMLInputElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    (reason ? reasonRef.current : confirmRef.current)?.focus();
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onCancel();
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, reason, pending, onCancel]);

  if (!open) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const val = reasonRef.current?.value.trim() ?? "";
    if (reasonRequired && reason && val === "") {
      reasonRef.current?.focus();
      return;
    }
    onConfirm(val);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
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
          id="confirm-dialog-title"
          className="studio-display"
          style={{ margin: 0, font: "800 18px/1.2 var(--f-display)", color: "var(--ink)" }}
        >
          {title}
        </h2>

        <p style={{ margin: 0, font: "400 13.5px/1.5 var(--f-sans)", color: "var(--ink-soft)" }}>
          {message}
        </p>

        {reason && (
          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span className="studio-label">{reasonLabel}</span>
            <input
              ref={reasonRef}
              className="studio-input"
              placeholder={reasonPlaceholder}
              disabled={pending}
              style={{ width: "100%" }}
            />
          </label>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          <button
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
