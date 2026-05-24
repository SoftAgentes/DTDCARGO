"use client";

/**
 * Footer del detalle: botones "Cancelar envío" y "Eliminar envío" con modales.
 *
 * Doble confirmacion en ambos:
 * - Cancelar: razon obligatoria (>=10 chars) + checkbox de confirmacion explicita.
 * - Eliminar: tipear el codigo exacto del envio (estilo GitHub) — la fuente
 *   mas confiable de "estoy seguro" para acciones destructivas.
 *
 * Tooltips de hover en ambos botones del footer principal.
 *
 * Para estados terminales (delivered/cancelled), "Cancelar" no aparece.
 */

import { useEffect, useState, useTransition } from "react";
import { cancelShipment, deleteShipment } from "../actions";
import { isTerminalStatus } from "@/lib/studio/shipment-actions";
import type { ShipmentStatus } from "@/lib/studio/shipment-types";

const MODAL_BACKDROP: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 30, 61, 0.55)",
  display: "grid",
  placeItems: "center",
  zIndex: 50,
  padding: 20,
};

const MODAL_BOX: React.CSSProperties = {
  background: "var(--bg-surface)",
  borderRadius: 10,
  border: "1px solid var(--border)",
  padding: 24,
  width: "100%",
  maxWidth: 480,
  boxShadow: "0 12px 40px rgba(15, 30, 61, 0.25)",
};

export function FooterActions({
  shipmentId,
  shipmentCode,
  status,
}: {
  shipmentId: string;
  shipmentCode: string;
  status: ShipmentStatus;
}) {
  const [modal, setModal] = useState<null | "cancel" | "delete">(null);
  const [reason, setReason] = useState("");
  const [cancelConfirmed, setCancelConfirmed] = useState(false);
  const [deleteTypedCode, setDeleteTypedCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const terminal = isTerminalStatus(status);

  // Resetea estados al cerrar el modal
  const closeModal = () => {
    setModal(null);
    setReason("");
    setCancelConfirmed(false);
    setDeleteTypedCode("");
    setError(null);
  };

  // Cerrar modales con Escape (WCAG 2.1 Keyboard accessibility)
  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) {
        closeModal();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modal, isPending]);

  const handleCancel = () => {
    setError(null);
    startTransition(async () => {
      const result = await cancelShipment(shipmentId, reason);
      if (result.error) {
        setError(result.error);
      } else {
        closeModal();
      }
    });
  };

  const handleDelete = () => {
    // Doble verificacion: tipeo del code debe ser exacto
    if (deleteTypedCode.trim() !== shipmentCode) {
      setError(`Tipeá el código exacto del envío: ${shipmentCode}`);
      return;
    }
    setError(null);
    startTransition(async () => {
      await deleteShipment(shipmentId);
      // deleteShipment redirige a /studio/tracking
    });
  };

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 14,
          paddingTop: 24,
          marginTop: 24,
          borderTop: "1px solid var(--border)",
        }}
      >
        {!terminal ? (
          <button
            type="button"
            onClick={() => setModal("cancel")}
            className="studio-btn studio-btn-ghost"
            style={{ color: "var(--studio-red)", borderColor: "var(--studio-red)" }}
            title="Marca el envío como cancelado con razón obligatoria. El envío queda en el sistema con histórico, no se borra. Aparece en la lista con estado «Cancelado»."
          >
            Cancelar envío
          </button>
        ) : (
          <span />
        )}

        <button
          type="button"
          onClick={() => setModal("delete")}
          className="studio-btn studio-btn-ghost studio-btn-sm"
          title="Oculta el envío y sus eventos del listado (soft delete). No se borra de la base de datos — puede recuperarse desde Supabase si hace falta. Pedirá tipear el código del envío para confirmar."
        >
          Eliminar envío
        </button>
      </div>

      {/* Modal cancelar — doble confirmacion (razon + checkbox) */}
      {modal === "cancel" && (
        <div style={MODAL_BACKDROP} onClick={closeModal}>
          <div
            style={MODAL_BOX}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-modal-title"
          >
            <h3
              id="cancel-modal-title"
              className="studio-display"
              style={{ fontSize: 20, color: "var(--ink)", marginBottom: 10 }}
            >
              Cancelar envío {shipmentCode}
            </h3>
            <p
              style={{
                font: "500 13px/1.5 var(--f-sans)",
                color: "var(--ink-soft)",
                margin: "0 0 16px",
              }}
            >
              Esto marca el envío como <strong>cancelado</strong>. La razón queda
              en el timeline y en el preview del cliente. El envío sigue visible
              en la lista.
            </p>

            <label className="studio-label" htmlFor="cancel-reason">
              Razón (mínimo 10 caracteres) *
            </label>
            <textarea
              id="cancel-reason"
              className="studio-input"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="p. ej. ‘Cliente no respondió al cobro de aduana en 30 días’"
              autoFocus
              style={{ resize: "vertical", marginBottom: 12 }}
            />

            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "10px 12px",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                marginBottom: 12,
                cursor: "pointer",
                font: "500 12.5px/1.45 var(--f-sans)",
                color: "var(--ink)",
              }}
            >
              <input
                type="checkbox"
                checked={cancelConfirmed}
                onChange={(e) => setCancelConfirmed(e.target.checked)}
                style={{ marginTop: 2, flexShrink: 0, accentColor: "var(--danger)" }}
              />
              <span>
                Entiendo que esto cambia el estado del envío a <strong>cancelado</strong>{" "}
                y queda registrado en el timeline.
              </span>
            </label>

            {error && (
              <p
                style={{
                  color: "var(--danger)",
                  font: "500 12px/1.4 var(--f-sans)",
                  marginBottom: 12,
                }}
              >
                {error}
              </p>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                className="studio-btn studio-btn-ghost studio-btn-sm"
                onClick={closeModal}
                disabled={isPending}
              >
                Volver
              </button>
              <button
                type="button"
                className="studio-btn studio-btn-danger studio-btn-sm"
                onClick={handleCancel}
                disabled={
                  isPending || reason.trim().length < 10 || !cancelConfirmed
                }
                style={{
                  opacity:
                    isPending || reason.trim().length < 10 || !cancelConfirmed
                      ? 0.6
                      : 1,
                }}
              >
                {isPending ? "Cancelando…" : "Confirmar cancelación"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal eliminar — doble confirmacion (tipeo del code exacto) */}
      {modal === "delete" && (
        <div style={MODAL_BACKDROP} onClick={closeModal}>
          <div
            style={MODAL_BOX}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
          >
            <h3
              id="delete-modal-title"
              className="studio-display"
              style={{ fontSize: 20, color: "var(--ink)", marginBottom: 10 }}
            >
              Eliminar envío {shipmentCode}
            </h3>
            <p
              style={{
                font: "500 13px/1.5 var(--f-sans)",
                color: "var(--ink-soft)",
                margin: "0 0 16px",
              }}
            >
              Esto <strong>oculta el envío</strong> y todos sus eventos del
              listado (soft delete). No se borra de la base — puede recuperarse
              desde Supabase si hace falta.
            </p>

            <label className="studio-label" htmlFor="delete-typed-code">
              Para confirmar, tipeá el código del envío:{" "}
              <span
                style={{
                  font: "700 11.5px/1 var(--f-mono)",
                  color: "var(--ink)",
                  letterSpacing: "0.02em",
                }}
              >
                {shipmentCode}
              </span>
            </label>
            <input
              id="delete-typed-code"
              type="text"
              className="studio-input studio-input-mono"
              value={deleteTypedCode}
              onChange={(e) => {
                setDeleteTypedCode(e.target.value);
                if (error) setError(null);
              }}
              placeholder={shipmentCode}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              style={{ marginBottom: 12 }}
            />

            {error && (
              <p
                style={{
                  color: "var(--danger)",
                  font: "500 12px/1.4 var(--f-sans)",
                  marginBottom: 12,
                }}
              >
                {error}
              </p>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                className="studio-btn studio-btn-ghost studio-btn-sm"
                onClick={closeModal}
                disabled={isPending}
              >
                Volver
              </button>
              <button
                type="button"
                className="studio-btn studio-btn-danger studio-btn-sm"
                onClick={handleDelete}
                disabled={
                  isPending || deleteTypedCode.trim() !== shipmentCode
                }
                style={{
                  opacity:
                    isPending || deleteTypedCode.trim() !== shipmentCode
                      ? 0.6
                      : 1,
                }}
              >
                {isPending ? "Eliminando…" : "Confirmar eliminación"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
