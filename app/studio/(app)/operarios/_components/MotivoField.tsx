"use client";

/**
 * MotivoField — el motivo obligatorio de alta y restablecimiento (SDD-0515).
 *
 * Va a la auditoría junto con quién hizo el cambio. Avisa en vivo con las mismas
 * reglas que la base (`operarioMotivoProblem`): entre 4 y 300 caracteres y sin
 * el PIN adentro. Mientras se escribe no regaña por largo; sí apenas el motivo
 * contiene el PIN, y siempre con el error que devuelva el servidor.
 */

import { StatusIcon } from "@/components/StatusIcon";
import {
  OPERARIO_MOTIVO_MAX,
  OPERARIO_MOTIVO_MESSAGE,
  operarioMotivoProblem,
} from "@/lib/studio/operario-pin";

export function MotivoField({
  id,
  value,
  onChange,
  pin,
  serverError,
  disabled,
  placeholder = "Ej.: el operario olvidó su PIN",
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** El PIN que se está guardando, si se conoce: no puede ir en el motivo. */
  pin?: string | null;
  serverError?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  const problem = operarioMotivoProblem(value, pin);
  const liveError = problem === "contains_pin" ? OPERARIO_MOTIVO_MESSAGE.contains_pin : null;
  const error = serverError ?? liveError;
  const hintId = `${id}-hint`;

  return (
    <div>
      <label htmlFor={id} className="studio-label">
        Motivo <span style={{ color: "var(--wine-text)" }}>*</span>
      </label>
      <input
        id={id}
        name="motivo"
        type="text"
        className="studio-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={OPERARIO_MOTIVO_MAX}
        placeholder={placeholder}
        autoComplete="off"
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={hintId}
        required
      />
      <p
        id={hintId}
        role={error ? "alert" : undefined}
        style={{
          font: "500 11.5px/1.4 var(--f-sans)",
          color: error ? "var(--ink)" : "var(--ink-soft)",
          margin: "var(--s-1) 0 0",
        }}
      >
        {error ? (
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
            {error}
          </>
        ) : (
          "Queda en la auditoría con tu nombre. No escribas el PIN."
        )}
      </p>
    </div>
  );
}

/** ¿El motivo ya se puede enviar? Lo usan los cajones para habilitar el botón. */
export function motivoListo(value: string, pin?: string | null): boolean {
  return operarioMotivoProblem(value, pin) === null;
}
