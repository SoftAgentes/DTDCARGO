"use client";

/**
 * Footer del detalle: botones "Cancelar envío" y "Eliminar envío" con modales.
 *
 * - Cancelar: modal pide razon obligatoria (>=10 chars), llama cancelShipment().
 * - Eliminar: modal de confirmacion simple, llama deleteShipment() → redirect.
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
  background: "#FFFFFF",
  borderRadius: 10,
  border: "1px solid #E8E6E2",
  padding: 24,
  width: "100%",
  maxWidth: 480,
  boxShadow: "0 12px 40px rgba(15, 30, 61, 0.25)",
};

export function FooterActions({
  shipmentId,
  status,
}: {
  shipmentId: string;
  status: ShipmentStatus;
}) {
  const [modal, setModal] = useState<null | "cancel" | "delete">(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const terminal = isTerminalStatus(status);

  // Cerrar modales con Escape (WCAG 2.1 Keyboard accessibility)
  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) {
        setModal(null);
        setReason("");
        setError(null);
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
        setModal(null);
        setReason("");
      }
    });
  };

  const handleDelete = () => {
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
          borderTop: "1px solid #E8E6E2",
        }}
      >
        {!terminal ? (
          <button
            type="button"
            onClick={() => setModal("cancel")}
            className="studio-btn studio-btn-ghost"
            style={{ color: "var(--studio-red)", borderColor: "var(--studio-red)" }}
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
        >
          Eliminar envío
        </button>
      </div>

      {/* Modal cancelar */}
      {modal === "cancel" && (
        <div style={MODAL_BACKDROP} onClick={() => setModal(null)}>
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
              style={{ fontSize: 20, color: "#0F1E3D", marginBottom: 10 }}
            >
              Cancelar envío
            </h3>
            <p
              style={{
                font: "500 13px/1.5 Archivo, sans-serif",
                color: "#6B6B6B",
                margin: "0 0 16px",
              }}
            >
              Esto marca el envío como <strong>cancelado</strong>. La razón queda
              en el timeline y en el preview del cliente.
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

            {error && (
              <p
                style={{
                  color: "#C2353F",
                  font: "500 12px/1.4 Archivo, sans-serif",
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
                onClick={() => {
                  setModal(null);
                  setReason("");
                  setError(null);
                }}
                disabled={isPending}
              >
                Volver
              </button>
              <button
                type="button"
                className="studio-btn studio-btn-danger studio-btn-sm"
                onClick={handleCancel}
                disabled={isPending || reason.trim().length < 10}
                style={{
                  opacity:
                    isPending || reason.trim().length < 10 ? 0.6 : 1,
                }}
              >
                {isPending ? "Cancelando…" : "Confirmar cancelación"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal eliminar */}
      {modal === "delete" && (
        <div style={MODAL_BACKDROP} onClick={() => setModal(null)}>
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
              style={{ fontSize: 20, color: "#0F1E3D", marginBottom: 10 }}
            >
              Eliminar envío
            </h3>
            <p
              style={{
                font: "500 13px/1.5 Archivo, sans-serif",
                color: "#6B6B6B",
                margin: "0 0 18px",
              }}
            >
              Esto <strong>oculta el envío</strong> de la lista (soft delete).
              Sus eventos también se ocultan. Podés recuperarlo desde Supabase
              si hace falta. No se borra de la base.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                className="studio-btn studio-btn-ghost studio-btn-sm"
                onClick={() => setModal(null)}
                disabled={isPending}
              >
                Volver
              </button>
              <button
                type="button"
                className="studio-btn studio-btn-danger studio-btn-sm"
                onClick={handleDelete}
                disabled={isPending}
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
