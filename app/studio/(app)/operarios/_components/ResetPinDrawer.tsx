"use client";

/**
 * ResetPinDrawer — restablece el PIN de un operario de la app del teléfono
 * (SDD-0513).
 *
 * Dos modos:
 *  · «Generar PIN nuevo» (por defecto): lo sortea el SERVIDOR con
 *    crypto.randomInt. Este componente no propone ni conoce ningún PIN antes
 *    de enviar.
 *  · «Escribirlo yo»: el admin escribe un PIN que ya acordó con el operario.
 *
 * El PIN nuevo se muestra UNA vez. Vive solo en el estado de este cajón: al
 * cerrarlo (Listo, la X, Escape o clic afuera) el padre lo desmonta y el valor
 * desaparece; al recargar la página, también. No se copia a localStorage,
 * sessionStorage, la URL ni la consola. «Copiar PIN» lo pone en el portapapeles
 * del sistema solo cuando el admin lo pide.
 */

import { startTransition, useActionState, useState } from "react";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import { SegmentedControl } from "@/app/studio/_components/ui/SegmentedControl";
import { ErrorAlert } from "@/app/studio/_components/ui/ErrorAlert";
import { Icon } from "@/app/studio/_components/icons";
import { StatusIcon } from "@/components/StatusIcon";
import type { OperarioRow } from "@/lib/studio/operario-queries";
import {
  OPERARIO_PIN_LENGTH,
  OPERARIO_PIN_PROBLEM_MESSAGE,
  operarioPinProblem,
} from "@/lib/studio/operario-pin";
import { generateOperarioPinAction, resetOperarioPinAction } from "../actions";

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
}: {
  operario: OperarioRow;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(
    submitReset,
    initialState,
  );
  const [mode, setMode] = useState<PinMode>("generar");
  const [pin, setPin] = useState("");

  if (state.ok && state.pinReveal) {
    return (
      <PinReveal operario={operario} pin={state.pinReveal} onClose={onClose} />
    );
  }

  const manualProblem = mode === "manual" ? operarioPinProblem(pin) : null;
  const canSubmit = mode === "generar" || manualProblem === null;
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
      title={`Restablecer PIN · ${operario.display_name}`}
      subtitle="El PIN actual deja de funcionar en cuanto lo restableces."
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
            Al restablecerlo verás el PIN nuevo una sola vez, para que se lo
            pases al operario.
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

        <ErrorAlert state={state} compact />
      </form>

      <DrawerFooter
        formId="reset-pin-form"
        onClose={onClose}
        isPending={isPending}
        canSubmit={canSubmit}
        submitLabel="Restablecer PIN"
        pendingLabel="Restableciendo…"
      />
    </DrawerShell>
  );
}

// ─────────────────────────────────────────────────────────────
// Revelado único
// ─────────────────────────────────────────────────────────────

type CopyState = "idle" | "copied" | "failed";

function PinReveal({
  operario,
  pin,
  onClose,
}: {
  operario: OperarioRow;
  pin: string;
  onClose: () => void;
}) {
  const [copy, setCopy] = useState<CopyState>("idle");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pin);
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
  };

  return (
    <DrawerShell
      title="PIN restablecido"
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
          <span>Anótalo ahora: no se vuelve a mostrar.</span>
        </div>

        <p
          style={{
            margin: 0,
            padding: "20px 32px",
            background: "var(--bg-elevated)",
            border: "2px dashed var(--wine)",
            borderRadius: "var(--r-md)",
            font: "900 38px/1 var(--f-mono)",
            color: "var(--wine-text)",
            letterSpacing: "0.16em",
          }}
        >
          {pin}
        </p>

        <button
          type="button"
          className="studio-btn studio-btn-ghost studio-btn-sm"
          onClick={handleCopy}
        >
          {copy === "copied" ? Icon.check(14) : Icon.copy(14)}
          {copy === "copied" ? "Copiado" : "Copiar PIN"}
        </button>
        <span
          role="status"
          aria-live="polite"
          style={{
            font: "500 12px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            minHeight: "1.4em",
          }}
        >
          {copy === "copied"
            ? "PIN copiado."
            : copy === "failed"
              ? "No se pudo copiar. Anótalo a mano."
              : ""}
        </span>

        <p
          style={{
            font: "500 12.5px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            textAlign: "center",
            maxWidth: 360,
            margin: 0,
          }}
        >
          El PIN anterior ya no funciona. Pásaselo al operario para que entre a
          la app del teléfono.
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
