"use client";

/**
 * ResetPinDrawer — cambia el PIN de un operario existente.
 * Muestra el PIN nuevo UNA vez al admin después del submit.
 */

import { startTransition, useActionState, useState } from "react";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import type { OperarioRow } from "@/lib/studio/operario-queries";
import { resetOperarioPinAction } from "../actions";

type State = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  pinReveal?: string;
};

const initialState: State = {};

function randomPin(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
}

export function ResetPinDrawer({
  operario,
  onClose,
}: {
  operario: OperarioRow;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(
    resetOperarioPinAction,
    initialState,
  );
  const [pin, setPin] = useState(() => randomPin());
  const canSubmit = /^\d{4}$/.test(pin);

  if (state.ok && state.pinReveal) {
    return (
      <DrawerShell
        title="PIN reseteado"
        subtitle={`Nuevo PIN de ${operario.display_name}`}
        onClose={onClose}
        pending={false}
        width={520}
      >
        <div
          style={{
            flex: 1,
            padding: "32px 22px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              padding: "20px 32px",
              background: "var(--bg-elevated)",
              border: "2px dashed var(--wine)",
              borderRadius: "var(--r-md)",
              font: "900 38px/1 var(--f-mono)",
              color: "var(--wine)",
              letterSpacing: "0.16em",
            }}
          >
            {state.pinReveal}
          </div>
          <p
            style={{
              font: "500 12px/1.5 var(--f-sans)",
              color: "var(--ink-mute)",
              textAlign: "center",
              maxWidth: 360,
              margin: 0,
            }}
          >
            El PIN viejo dejó de funcionar. Pasale este al operario.
          </p>
        </div>
        <footer
          style={{
            padding: "14px 22px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "flex-end",
            background: "var(--bg-surface)",
          }}
        >
          <button
            type="button"
            className="studio-btn studio-btn-primary"
            onClick={onClose}
          >
            Listo
          </button>
        </footer>
      </DrawerShell>
    );
  }

  const handleSubmit = (fd: FormData) => {
    startTransition(() => formAction(fd));
  };

  return (
    <DrawerShell
      title={`Reset PIN · ${operario.display_name}`}
      subtitle="El PIN actual deja de funcionar al guardar"
      onClose={onClose}
      pending={isPending}
      width={520}
    >
      <form
        id="reset-pin-form"
        action={handleSubmit}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <input type="hidden" name="operario_id" value={operario.id} />

        <div>
          <label htmlFor="reset-pin" className="studio-label">
            Nuevo PIN <span style={{ color: "var(--wine)" }}>*</span>
            <button
              type="button"
              onClick={() => setPin(randomPin())}
              className="studio-btn studio-btn-ghost studio-btn-xs"
              style={{ marginLeft: 8 }}
            >
              ↻ Generar otro
            </button>
          </label>
          <input
            id="reset-pin"
            name="pin"
            type="text"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            className="studio-input studio-input-mono"
            value={pin}
            onChange={(e) =>
              setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
            }
            placeholder="0000"
            required
            style={{ font: "700 18px/1 var(--f-mono)", letterSpacing: "0.12em" }}
          />
          {state.fieldErrors?.pin && (
            <p
              style={{
                font: "500 11px/1.3 var(--f-sans)",
                color: "var(--danger)",
                margin: "4px 0 0",
              }}
            >
              {state.fieldErrors.pin}
            </p>
          )}
        </div>

        {state.error && (
          <p
            role="alert"
            style={{
              font: "500 12px/1.4 var(--f-sans)",
              color: "var(--danger)",
              padding: "10px 12px",
              background: "var(--danger-bg, rgba(168,50,62,0.08))",
              border: "1px solid var(--danger)",
              borderRadius: "var(--r-sm)",
              margin: 0,
            }}
          >
            {state.error}
          </p>
        )}
      </form>

      <DrawerFooter
        formId="reset-pin-form"
        onClose={onClose}
        isPending={isPending}
        canSubmit={canSubmit}
        submitLabel="Resetear PIN"
      />
    </DrawerShell>
  );
}
