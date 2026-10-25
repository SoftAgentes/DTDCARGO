"use client";

/**
 * Footer del detalle: botones "Cancelar envío" y "Eliminar envío" con modales.
 *
 * Doble confirmacion en ambos:
 * - Cancelar: razon obligatoria (>=10 chars) + checkbox de confirmacion explicita.
 * - Eliminar: motivo obligatorio (4 a 1000, SDD-0522) + tipear el codigo exacto
 *   del envio (estilo GitHub). Solo lo ve quien puede eliminar (admin,
 *   `delete_shipments`); la RPC de la 0476 decide si se puede.
 * - SDD-0560: si lo bloquean dependencias vivas, el modal ofrece «Ver los pasos
 *   para eliminarlo», que abre el asistente de borrado.
 *
 * Tooltips de hover en ambos botones del footer principal.
 *
 * Para estados terminales (delivered/cancelled), "Cancelar" no aparece.
 */

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { cancelShipment, deleteShipment } from "../actions";
import { isTerminalStatus } from "@/lib/studio/shipment-actions";
import type { ShipmentStatus } from "@/lib/studio/shipment-types";
import { useDialogA11y } from "@/app/studio/_components/ui/drawer/useDialogA11y";
import { useToast } from "@/app/studio/_components/ui/ToastProvider";
import { AsistenteBorrado } from "@/app/studio/(app)/embarques/_components/AsistenteBorrado";

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
  canDelete = false,
}: {
  shipmentId: string;
  shipmentCode: string;
  status: ShipmentStatus;
  /** SDD-0522: sólo admin (`delete_shipments`). Sin él, «Eliminar envío» no se pinta. */
  canDelete?: boolean;
}) {
  const [modal, setModal] = useState<null | "cancel" | "delete">(null);
  const [reason, setReason] = useState("");
  const [cancelConfirmed, setCancelConfirmed] = useState(false);
  const [deleteTypedCode, setDeleteTypedCode] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  // SDD-0560: el borrado lo bloquean dependencias vivas → se ofrece el asistente.
  const [bloqueado, setBloqueado] = useState(false);
  const [asistente, setAsistente] = useState(false);
  const [isPending, startTransition] = useTransition();

  const terminal = isTerminalStatus(status);
  const deleteReady =
    deleteTypedCode.trim() === shipmentCode && deleteReason.trim().length >= 4;

  // Resetea estados al cerrar el modal
  const closeModal = () => {
    setModal(null);
    setReason("");
    setCancelConfirmed(false);
    setDeleteTypedCode("");
    setDeleteReason("");
    setError(null);
    setBloqueado(false);
  };

  /**
   * SDD-0290 · Antes había un `useEffect` propio sólo para Escape.
   * `useDialogA11y` lo reemplaza y suma focus-trap, foco inicial y restauración
   * (WCAG 2.1.2 / 2.4.3). Dos manejadores de Escape habrían competido.
   *
   * Un solo `panelRef` para los DOS modales: `modal` es `"cancel" | "delete" |
   * null`, así que nunca hay dos abiertos a la vez y el ref siempre apunta al
   * que está montado. `enabled` hace falta porque se renderizan inline dentro
   * de este componente, que vive aunque no haya modal.
   */
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogA11y(panelRef, {
    onClose: closeModal,
    pending: isPending,
    enabled: modal !== null,
  });

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
      setError(`Escribe el código exacto del envío: ${shipmentCode}`);
      return;
    }
    if (deleteReason.trim().length < 4) {
      setError("Indica un motivo de al menos 4 caracteres.");
      return;
    }
    setError(null);
    setBloqueado(false);
    startTransition(async () => {
      // deleteShipment redirige a /studio/tracking cuando el borrado ocurre, así
      // que esta línea sólo devuelve algo si no borró: permiso, motivo, lo que
      // lo bloquea (factura, gasto, aduana…) o una falla. Antes redirigía en los
      // tres casos y el operador se iba creyendo que había borrado (SDD-0497).
      const result = await deleteShipment(shipmentId, deleteReason);
      if (result?.error) {
        setError(result.error);
        setBloqueado(result.bloqueado === true);
      }
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

        {canDelete ? (
          <button
            type="button"
            onClick={() => setModal("delete")}
            className="studio-btn studio-btn-ghost studio-btn-sm"
            title="Lo saca de Embarques, Tracking, el Portal y el calendario. Pide un motivo y el código del envío. Solo se recupera desde la base de datos."
          >
            Eliminar envío
          </button>
        ) : (
          <span />
        )}
      </div>

      {/* Modal cancelar — doble confirmacion (razon + checkbox) */}
      {modal === "cancel" && (
        <div style={MODAL_BACKDROP} onClick={closeModal}>
          <div
            ref={panelRef}
            style={MODAL_BOX}
            tabIndex={-1}
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
            ref={panelRef}
            style={MODAL_BOX}
            tabIndex={-1}
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
              Lo <strong>saca de Embarques, Tracking, el Portal del cliente y
              el calendario</strong>, y cancela sus avisos pendientes. El código
              no se puede volver a usar y solo se recupera desde la base de
              datos. Si tiene una factura, un gasto, aduana u otra dependencia
              viva, no se elimina y te decimos qué lo bloquea.
            </p>

            <label className="studio-label" htmlFor="delete-reason">
              Motivo (obligatorio, sin datos personales)
            </label>
            <textarea
              id="delete-reason"
              className="studio-input"
              rows={2}
              value={deleteReason}
              onChange={(e) => {
                setDeleteReason(e.target.value);
                if (error) setError(null);
              }}
              placeholder="p. ej. Embarque de prueba"
              maxLength={1000}
              autoFocus
              style={{ resize: "vertical", marginBottom: 12 }}
            />

            <label className="studio-label" htmlFor="delete-typed-code">
              Para confirmar, escribe el código del envío:{" "}
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
              autoComplete="off"
              spellCheck={false}
              style={{ marginBottom: 12 }}
            />

            {error && (
              <p
                role="alert"
                style={{
                  color: "var(--danger)",
                  font: "500 12px/1.4 var(--f-sans)",
                  marginBottom: 12,
                }}
              >
                {error}
              </p>
            )}

            {/* SDD-0560: en vez de dejarte trabado, el asistente te dice qué
                resolver y en qué orden. */}
            {error && bloqueado && (
              <div style={{ marginBottom: 12 }}>
                <button
                  type="button"
                  className="studio-btn studio-btn-dark studio-btn-sm"
                  onClick={() => {
                    closeModal();
                    setAsistente(true);
                  }}
                  disabled={isPending}
                >
                  Ver los pasos para eliminarlo
                </button>
              </div>
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
                disabled={isPending || !deleteReady}
                style={{ opacity: isPending || !deleteReady ? 0.6 : 1 }}
              >
                {isPending ? "Eliminando…" : "Confirmar eliminación"}
              </button>
            </div>
          </div>
        </div>
      )}

      {canDelete && asistente && (
        <AsistenteEnTracking
          shipmentId={shipmentId}
          shipmentCode={shipmentCode}
          onClose={() => setAsistente(false)}
        />
      )}
    </>
  );
}

/**
 * SDD-0560 · El asistente desde el detalle. Sólo se monta al abrirlo: el resto
 * del pie no depende del toast ni del router. Al eliminar el embarque, este
 * detalle deja de existir: un aviso y de vuelta al listado, como
 * `deleteShipment`.
 */
function AsistenteEnTracking({
  shipmentId,
  shipmentCode,
  onClose,
}: {
  shipmentId: string;
  shipmentCode: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const router = useRouter();
  return (
    <AsistenteBorrado
      shipmentId={shipmentId}
      shipmentCode={shipmentCode}
      onClose={onClose}
      onEliminado={(hecho) => {
        toast.show({
          eventKey: "shipments:deleted",
          tone: "success",
          message: hecho,
          priority: "normal",
          scope: "module",
          dedupeKey: `shipments:deleted:${shipmentCode}`,
        });
        router.push("/studio/tracking");
      }}
    />
  );
}
