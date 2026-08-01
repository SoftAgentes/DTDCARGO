"use client";

/**
 * CancelOdDrawer — motivo + confirmación R3 gobernada (SDD-0234).
 */

import { useState } from "react";
import { DrawerShell } from "@/app/studio/_components/ui/drawer/DrawerShell";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import { cancelDispatchOrderAction } from "../actions";
import type { DispatchOrderRow } from "@/lib/studio/dispatch-types";

export function CancelOdDrawer({
  od,
  onClose,
}: {
  od: DispatchOrderRow;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [requestRef, setRequestRef] = useState("");
  const [error, setError] = useState<string>();

  const openConfirmation = () => {
    const normalized = reason.trim();
    if (normalized.length < 4 || normalized.length > 500) {
      setError("El motivo debe tener entre 4 y 500 caracteres.");
      return;
    }
    setRequestRef(`dispatch-order-cancellation:${od.id}:${crypto.randomUUID()}`);
    setError(undefined);
    setConfirming(true);
  };

  const cancelOrder = async () => {
    if (pending) return;
    setPending(true);
    setError(undefined);
    try {
      const result = await cancelDispatchOrderAction({
        orderId: od.id,
        from: od.status as "creada" | "cargando" | "lista" | "en_ruta",
        reason,
        requestRef,
      });
      if (!result.ok) {
        setError(
          result.error ??
            Object.values(result.fieldErrors ?? {})[0] ??
            "No se pudo cancelar la OD.",
        );
        return;
      }
      setConfirming(false);
      onClose();
    } catch {
      setError("No se pudo cancelar la OD. Conservamos la referencia para reintentar.");
    } finally {
      setPending(false);
    }
  };

  return (
    <DrawerShell
      title="Cancelar orden de despacho"
      subtitle={`${od.order_code} · ${od.route?.name ?? "Sin ruta"}`}
      onClose={onClose}
      pending={pending}
      width={520}
    >
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div
          style={{
            padding: 14,
            background: "var(--warning-bg)",
            border: "1px solid var(--warning)",
            borderRadius: "var(--r-md)",
            font: "500 12.5px/1.5 var(--f-sans)",
            color: "var(--ink)",
          }}
        >
          Esta OD pasa a estado <strong>cancelada</strong> (terminal). Los paquetes
          quedan disponibles en la cola para asignar a una OD nueva. Esta acción no se
          puede revertir.
        </div>

        <div>
          <label className="studio-label" htmlFor="reason-input">
            Motivo de la cancelación
          </label>
          <textarea
            id="reason-input"
            className="studio-input"
            required
            minLength={4}
            maxLength={500}
            rows={4}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setError(undefined);
            }}
            placeholder="Ej: cliente pidió postergar entrega 48h por permisos sanitarios pendientes."
            style={{ marginTop: 6, resize: "vertical" }}
          />
          <p
            style={{
              font: "500 11px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              marginTop: 6,
            }}
          >
            Entre 4 y 500 caracteres. Queda registrado con actor y estado en AUD-01.
          </p>
        </div>

        {error && !confirming && (
          <div
            role="alert"
            style={{
              padding: 12,
              background: "var(--danger-bg)",
              color: "var(--danger)",
              borderRadius: "var(--r-md)",
              font: "600 13px/1.3 var(--f-sans)",
            }}
          >
            {error}
          </div>
        )}
      </div>

      <footer
        style={{
          padding: "14px 22px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          justifyContent: "flex-end",
          gap: 10,
          background: "var(--bg-surface)",
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          className="studio-btn studio-btn-ghost"
          onClick={onClose}
          disabled={pending}
        >
          Volver
        </button>
        <button
          type="button"
          className="studio-btn studio-btn-danger"
          disabled={pending || reason.trim().length < 4}
          onClick={openConfirmation}
        >
          Revisar cancelación
        </button>
      </footer>

      <ConfirmDialog
        open={confirming}
        danger
        holdToConfirm
        initialFocus="safe"
        title="Confirmar cancelación terminal"
        message={`${od.order_code} está ${od.status}. Al cancelar, la OD queda terminal y sus paquetes vuelven a estar disponibles para una OD nueva. Motivo: ${reason.trim()}`}
        confirmLabel="Cancelar OD"
        holdLabel="Mantén para cancelar"
        pending={pending}
        error={confirming ? error : undefined}
        onCancel={() => {
          if (pending) return;
          setConfirming(false);
          setError(undefined);
        }}
        onConfirm={cancelOrder}
      />
    </DrawerShell>
  );
}
