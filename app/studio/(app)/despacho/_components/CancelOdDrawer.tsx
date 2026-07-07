"use client";

/**
 * CancelOdDrawer — confirmación de cancelación con motivo (SDD-0029).
 * Motivo obligatorio (mín 4 chars).
 */

import { useActionState } from "react";
import { DrawerShell } from "@/app/studio/_components/ui/drawer/DrawerShell";
import { cancelDispatchOrderAction } from "../actions";
import type { DispatchActionState, DispatchOrderRow } from "@/lib/studio/dispatch-types";

const FORM_ID = "cancel-od-form";
const INITIAL_STATE: DispatchActionState = {};

export function CancelOdDrawer({
  od,
  onClose,
}: {
  od: DispatchOrderRow;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(
    cancelDispatchOrderAction,
    INITIAL_STATE,
  );

  if (state?.ok) {
    setTimeout(onClose, 100);
  }

  return (
    <DrawerShell
      title="Cancelar orden de despacho"
      subtitle={`${od.order_code} · ${od.route?.name ?? "Sin ruta"}`}
      onClose={onClose}
      pending={isPending}
      width={520}
    >
      <form
        id={FORM_ID}
        action={formAction}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <input type="hidden" name="od_id" value={od.id} />

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
            name="reason"
            className="studio-input"
            required
            minLength={4}
            maxLength={500}
            rows={4}
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
            Mínimo 4 caracteres. Queda registrado en el audit log para reportes.
          </p>
          {state?.fieldErrors?.reason && (
            <p
              style={{
                font: "600 11.5px/1.3 var(--f-sans)",
                color: "var(--danger)",
                marginTop: 6,
              }}
            >
              {state.fieldErrors.reason}
            </p>
          )}
        </div>

        {state?.error && (
          <div
            style={{
              padding: 12,
              background: "var(--danger-bg)",
              color: "var(--danger)",
              borderRadius: "var(--r-md)",
              font: "600 13px/1.3 var(--f-sans)",
            }}
          >
            {state.error}
          </div>
        )}
      </form>

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
          disabled={isPending}
        >
          Volver
        </button>
        <button
          type="submit"
          form={FORM_ID}
          className="studio-btn studio-btn-danger"
          disabled={isPending}
        >
          {isPending ? "Cancelando…" : "Cancelar OD"}
        </button>
      </footer>
    </DrawerShell>
  );
}
