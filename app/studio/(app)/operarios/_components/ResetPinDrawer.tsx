"use client";

/**
 * ResetPinDrawer — restablece el PIN de un operario de la app del teléfono
 * (SDD-0513) y, con `reactivar`, vuelve a dar de alta a uno de baja con un PIN
 * nuevo (SDD-0515: el toggle ya no reactiva, para que nadie vuelva con un PIN
 * que otro operario activo de su región ya usa).
 *
 * Dos modos:
 *  · «Generar PIN nuevo» (por defecto): lo sortea el SERVIDOR con
 *    crypto.randomInt. Este componente no propone ni conoce ningún PIN antes
 *    de enviar.
 *  · «Escribirlo yo»: el admin escribe un PIN que ya acordó con el operario.
 *
 * Los dos piden un motivo, que va a la auditoría (SDD-0515).
 *
 * El PIN nuevo se muestra en la respuesta. Vive solo en el estado de este
 * cajón: al cerrarlo (Listo, la X, Escape o clic afuera) el padre lo desmonta y
 * el valor desaparece; al recargar la página, también. No se copia a
 * localStorage, sessionStorage, la URL ni la consola. Después, quien tenga
 * permiso puede volver a verlo con «Ver PIN», y eso queda en la auditoría.
 */

import { startTransition, useActionState, useState } from "react";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import { SegmentedControl } from "@/app/studio/_components/ui/SegmentedControl";
import { ErrorAlert } from "@/app/studio/_components/ui/ErrorAlert";
import { StatusIcon } from "@/components/StatusIcon";
import type { OperarioRow } from "@/lib/studio/operario-queries";
import {
  OPERARIO_PIN_LENGTH,
  OPERARIO_PIN_PROBLEM_MESSAGE,
  operarioPinProblem,
} from "@/lib/studio/operario-pin";
import { generateOperarioPinAction, resetOperarioPinAction } from "../actions";
import { MotivoField, motivoListo } from "./MotivoField";
import { PinRevealBlock } from "./PinRevealBlock";

type State = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  pinReveal?: string;
};

type PinMode = "generar" | "manual";

const initialState: State = {};

/** Un solo estado de acción para los dos modos: el formulario dice cuál. */
async function submitReset(prev: State, formData: FormData): Promise<State> {
  return formData.get("pin_mode") === "manual"
    ? resetOperarioPinAction(prev, formData)
    : generateOperarioPinAction(prev, formData);
}

const MODE_OPTIONS = [
  {
    value: "generar" as const,
    label: "Generar PIN nuevo",
    description: "El sistema crea uno difícil de adivinar.",
  },
  {
    value: "manual" as const,
    label: "Escribirlo yo",
    description: "Si ya acordaste uno con el operario.",
  },
];

export function ResetPinDrawer({
  operario,
  onClose,
  reactivar = false,
}: {
  operario: OperarioRow;
  onClose: () => void;
  /** Reactiva a un operario de baja con el PIN nuevo (SDD-0515). */
  reactivar?: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    submitReset,
    initialState,
  );
  const [mode, setMode] = useState<PinMode>("generar");
  const [pin, setPin] = useState("");
  const [motivo, setMotivo] = useState("");

  if (state.ok && state.pinReveal) {
    return (
      <PinReveal
        operario={operario}
        pin={state.pinReveal}
        reactivado={reactivar}
        onClose={onClose}
      />
    );
  }

  const manualProblem = mode === "manual" ? operarioPinProblem(pin) : null;
  const canSubmit =
    (mode === "generar" || manualProblem === null) &&
    motivoListo(motivo, mode === "manual" ? pin : null);
  // Mientras escribe no se regaña por largo; sí se avisa apenas completa un
  // PIN que la base rechazaría por común.
  const liveError =
    pin.length === OPERARIO_PIN_LENGTH && manualProblem === "common"
      ? OPERARIO_PIN_PROBLEM_MESSAGE.common
      : null;
  const pinError = state.fieldErrors?.pin ?? liveError;

  const handleSubmit = (fd: FormData) => {
    startTransition(() => formAction(fd));
  };

  return (
    <DrawerShell
      title={reactivar ? `Reactivar a ${operario.display_name}` : `Restablecer PIN · ${operario.display_name}`}
      subtitle={
        reactivar
          ? "Para volver a entrar necesita un PIN nuevo: el anterior pudo pasar a otro operario."
          : "El PIN actual deja de funcionar en cuanto lo restableces."
      }
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
          gap: "var(--s-4)",
        }}
      >
        <input type="hidden" name="operario_id" value={operario.id} />
        <input type="hidden" name="pin_mode" value={mode} />
        {reactivar && <input type="hidden" name="reactivar" value="1" />}

        <div>
          <span className="studio-label" style={{ display: "block" }}>
            ¿Cómo quieres el PIN nuevo?
          </span>
          <SegmentedControl
            ariaLabel="Cómo quieres el PIN nuevo"
            value={mode}
            onChange={setMode}
            options={MODE_OPTIONS}
            columns={2}
            disabled={isPending}
          />
        </div>

        {mode === "generar" ? (
          <p
            style={{
              font: "500 12.5px/1.5 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
            }}
          >
            {reactivar
              ? "Al reactivarlo verás el PIN nuevo, para que se lo pases al operario."
              : "Al restablecerlo verás el PIN nuevo, para que se lo pases al operario."}
          </p>
        ) : (
          <div>
            <label htmlFor="reset-pin" className="studio-label">
              PIN nuevo <span style={{ color: "var(--wine-text)" }}>*</span>
            </label>
            <input
              id="reset-pin"
              name="pin"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              pattern="[0-9]{4}"
              maxLength={OPERARIO_PIN_LENGTH}
              className="studio-input studio-input-mono"
              value={pin}
              onChange={(e) =>
                setPin(
                  e.target.value.replace(/\D/g, "").slice(0, OPERARIO_PIN_LENGTH),
                )
              }
              aria-invalid={pinError ? true : undefined}
              aria-describedby="reset-pin-hint"
              required
              style={{
                font: "700 18px/1 var(--f-mono)",
                letterSpacing: "0.12em",
              }}
            />
            <p
              id="reset-pin-hint"
              role={pinError ? "alert" : undefined}
              style={{
                font: "500 11.5px/1.4 var(--f-sans)",
                color: pinError ? "var(--ink)" : "var(--ink-soft)",
                margin: "var(--s-1) 0 0",
              }}
            >
              {pinError ? (
                <>
                  <StatusIcon
                    tone="danger"
                    style={{
                      color: "var(--danger-text)",
                      display: "inline",
                      marginRight: "var(--s-1)",
                      verticalAlign: "middle",
                    }}
                  />
                  {pinError}
                </>
              ) : (
                "4 dígitos. No se aceptan los muy comunes, como 1234 o 0000."
              )}
            </p>
          </div>
        )}

        <MotivoField
          id="reset-motivo"
          value={motivo}
          onChange={setMotivo}
          pin={mode === "manual" ? pin : null}
          serverError={state.fieldErrors?.motivo}
          disabled={isPending}
          placeholder={reactivar ? "Ej.: vuelve de vacaciones" : "Ej.: el operario olvidó su PIN"}
        />

        <ErrorAlert state={state} compact />
      </form>

      <DrawerFooter
        formId="reset-pin-form"
        onClose={onClose}
        isPending={isPending}
        canSubmit={canSubmit}
        submitLabel={reactivar ? "Reactivar con PIN nuevo" : "Restablecer PIN"}
        pendingLabel={reactivar ? "Reactivando…" : "Restableciendo…"}
      />
    </DrawerShell>
  );
}

// ─────────────────────────────────────────────────────────────
// Revelado
// ─────────────────────────────────────────────────────────────

function PinReveal({
  operario,
  pin,
  reactivado,
  onClose,
}: {
  operario: OperarioRow;
  pin: string;
  reactivado: boolean;
  onClose: () => void;
}) {
  return (
    <DrawerShell
      title={reactivado ? "Operario reactivado" : "PIN restablecido"}
      subtitle={`PIN nuevo de ${operario.display_name}`}
      onClose={onClose}
      pending={false}
      width={520}
    >
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "24px 22px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--s-4)",
        }}
      >
        {/* Atención (BRAND): acento dorado en borde e ícono, texto neutro. Sobre
            --bg-surface el dorado mide 3,14:1; sobre --warning-bg bajaría a
            ~2,8:1 y el ícono dejaría de cumplir el 3:1. */}
        <div
          style={{
            alignSelf: "stretch",
            display: "flex",
            alignItems: "flex-start",
            gap: "var(--s-2)",
            padding: "var(--s-3) var(--s-4)",
            background: "var(--bg-surface)",
            border: "1px solid var(--warning)",
            borderRadius: "var(--r-md)",
            font: "600 13px/1.4 var(--f-sans)",
            color: "var(--ink)",
          }}
        >
          <StatusIcon
            tone="warning"
            size={16}
            style={{ color: "var(--warning)", marginTop: 1 }}
          />
          <span>Pásaselo al operario. Volver a verlo con «Ver PIN» queda en la auditoría.</span>
        </div>

        <PinRevealBlock pin={pin} />

        <p
          style={{
            font: "500 12.5px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            textAlign: "center",
            maxWidth: 360,
            margin: 0,
          }}
        >
          {reactivado
            ? "Ya puede volver a entrar a la app del teléfono con este PIN."
            : "El PIN anterior ya no funciona. Pásaselo al operario para que entre a la app del teléfono."}
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
