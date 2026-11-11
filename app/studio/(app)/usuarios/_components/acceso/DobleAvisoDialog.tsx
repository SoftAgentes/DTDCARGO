"use client";

/**
 * Doble aviso de un módulo sensible (SDD-0622 §5.1 regla 2).
 *
 * Antes de conceder dinero o algo de solo-administrador, la pantalla dice EN
 * CONCRETO lo que la persona podrá hacer (`SENSITIVE_MODULE_EFFECTS`, la misma
 * lista cuya versión queda en la auditoría) y pide motivo y una casilla
 * explícita. La RPC repite la exigencia (`p_confirm_sensitive`): este diálogo
 * es la explicación, no el candado.
 *
 * Accesible: `role="alertdialog"` con título y descripción enlazados, foco
 * inicial en el motivo, Esc cancela (salvo mientras guarda) y Tab no se escapa
 * del diálogo.
 */

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SENSITIVE_MODULE_EFFECTS } from "@/lib/studio/rbac";
import { reasonError } from "@/lib/studio/user-module-grants";

export interface DobleAvisoResultado {
  canEdit: boolean;
  reason: string;
  expiresOn: string | null;
}

export function DobleAvisoDialog({
  open,
  persona,
  moduleId,
  moduleLabel,
  dinero,
  soloVer,
  pending,
  error,
  initialReason = "",
  initialExpiresOn = null,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  /** Nombre corto de quien recibe el acceso. */
  persona: string;
  moduleId: string;
  moduleLabel: string;
  /** Módulo de dinero (cambia la frase de la casilla). */
  dinero: boolean;
  /** El módulo solo se concede para ver (R1 o support). */
  soloVer: boolean;
  pending?: boolean;
  error?: string;
  initialReason?: string;
  initialExpiresOn?: string | null;
  onCancel: () => void;
  onConfirm: (r: DobleAvisoResultado) => void;
}) {
  const titleId = useId();
  const descId = useId();
  const [motivo, setMotivo] = useState(initialReason);
  const [vence, setVence] = useState(initialExpiresOn ?? "");
  const [entiendo, setEntiendo] = useState(false);
  const [intentado, setIntentado] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const motivoRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    motivoRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focos = dialogRef.current.querySelectorAll<HTMLElement>(
        "button:not(:disabled), input:not(:disabled), textarea:not(:disabled)",
      );
      if (focos.length === 0) return;
      const primero = focos[0];
      const ultimo = focos[focos.length - 1];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, pending, onCancel]);

  if (!open || typeof document === "undefined") return null;

  const efectos = SENSITIVE_MODULE_EFFECTS[moduleId] ?? [];
  const errMotivo = reasonError(motivo);
  const puede = !errMotivo && entiendo && !pending;
  const casilla = dinero
    ? `Entiendo que ${persona} podrá ver y mover dinero con este acceso.`
    : `Entiendo que ${persona} verá información reservada al administrador.`;

  function confirmar(canEdit: boolean) {
    setIntentado(true);
    if (errMotivo || !entiendo || pending) return;
    onConfirm({ canEdit, reason: motivo.trim(), expiresOn: vence || null });
  }

  return createPortal(
    <div
      className="perm-dialog-scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pending) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        className="perm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <div className="perm-dialog-head">
          <span className="perm-dialog-icon" aria-hidden>
            !
          </span>
          <div>
            <h2 id={titleId}>
              Dar {moduleLabel} a {persona}
            </h2>
            <p id={descId}>
              Es un módulo sensible. {soloVer ? "Con este acceso" : "Con «Editar»"}, {persona} podrá:
            </p>
          </div>
        </div>

        <div className="perm-dialog-body">
          <ul className="perm-effects" aria-label="Lo que podrá hacer">
            {efectos.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>

          <div>
            <label className="studio-label" htmlFor={`${titleId}-motivo`}>
              Motivo (obligatorio)
            </label>
            <textarea
              id={`${titleId}-motivo`}
              ref={motivoRef}
              className="studio-input"
              rows={2}
              maxLength={500}
              value={motivo}
              disabled={pending}
              placeholder="Ej: cubre las vacaciones de Yolimar del 15 al 29"
              aria-invalid={intentado && !!errMotivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
            {intentado && errMotivo && (
              <p role="alert" style={{ margin: "4px 0 0", font: "600 11.5px/1.4 var(--f-sans)", color: "var(--danger)" }}>
                {errMotivo}
              </p>
            )}
          </div>

          <div>
            <label className="studio-label" htmlFor={`${titleId}-vence`}>
              Vence (opcional)
            </label>
            <input
              id={`${titleId}-vence`}
              type="date"
              className="studio-input"
              value={vence}
              disabled={pending}
              onChange={(e) => setVence(e.target.value)}
            />
          </div>

          <label className="perm-check">
            <input
              type="checkbox"
              checked={entiendo}
              disabled={pending}
              onChange={(e) => setEntiendo(e.target.checked)}
            />
            <span>{casilla}</span>
          </label>

          {error && (
            <p role="alert" style={{ margin: 0, font: "600 12.5px/1.45 var(--f-sans)", color: "var(--danger)" }}>
              {error}
            </p>
          )}
        </div>

        <div className="perm-dialog-foot">
          <button type="button" className="studio-btn studio-btn-ghost studio-btn-sm" disabled={pending} onClick={onCancel}>
            Cancelar
          </button>
          {!soloVer && (
            <button
              type="button"
              className="studio-btn studio-btn-warning studio-btn-sm"
              disabled={!puede}
              onClick={() => confirmar(false)}
            >
              Solo ver
            </button>
          )}
          <button
            type="button"
            className="studio-btn studio-btn-danger studio-btn-sm"
            disabled={!puede}
            aria-busy={pending}
            onClick={() => confirmar(!soloVer)}
          >
            {pending ? "Guardando…" : "Sí, dar acceso"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
