"use client";

/**
 * MotivoField — el motivo obligatorio de alta, restablecimiento y «Ver PIN»
 * (SDD-0515).
 *
 * Decisión de Sam: «Lista + «Otro» con texto». Se elige un código de la lista
 * fija (`OPERARIO_MOTIVOS`) y, sólo con «Otro», se escribe el motivo (4 a 200
 * caracteres, sin el PIN). Va a la auditoría junto con quién hizo el cambio.
 * Las reglas son las de la base (`operarioMotivoProblem` es su espejo): no
 * regaña por largo mientras se escribe; sí apenas el texto contiene el PIN, y
 * siempre con el error que devuelva el servidor.
 *
 * Campos del formulario: `motivo` (el código) y `motivo_texto` (sólo con «Otro»).
 */

import { StatusIcon } from "@/components/StatusIcon";
import {
  OPERARIO_MOTIVOS,
  OPERARIO_MOTIVO_MESSAGE,
  OPERARIO_MOTIVO_TEXTO_MAX,
  operarioMotivoProblem,
} from "@/lib/studio/operario-pin";

export type MotivoValue = { codigo: string; texto: string };

export const MOTIVO_VACIO: MotivoValue = { codigo: "", texto: "" };

export function MotivoField({
  id,
  value,
  onChange,
  pin,
  serverError,
  disabled,
  placeholder = "Ej.: lo pidió el supervisor del turno",
}: {
  id: string;
  value: MotivoValue;
  onChange: (value: MotivoValue) => void;
  /** El PIN que se está guardando, si se conoce: no puede ir en el motivo. */
  pin?: string | null;
  serverError?: string;
  disabled?: boolean;
  /** Ejemplo para el texto de «Otro». */
  placeholder?: string;
}) {
  const otro = value.codigo === "otro";
  const problem = operarioMotivoProblem(value.codigo, value.texto, pin);
  const liveError = problem === "contains_pin" ? OPERARIO_MOTIVO_MESSAGE.contains_pin : null;
  const error = serverError ?? liveError;
  const hintId = `${id}-hint`;
  const textoId = `${id}-texto`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
      <div>
        <label htmlFor={id} className="studio-label">
          Motivo <span style={{ color: "var(--wine-text)" }}>*</span>
        </label>
        <select
          id={id}
          name="motivo"
          className="studio-input"
          value={value.codigo}
          onChange={(e) => onChange({ ...value, codigo: e.target.value })}
          disabled={disabled}
          aria-invalid={error && !otro ? true : undefined}
          aria-describedby={hintId}
          required
        >
          <option value="" disabled>
            Elige un motivo
          </option>
          {OPERARIO_MOTIVOS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {otro && (
        <div>
          <label htmlFor={textoId} className="studio-label">
            Escribe el motivo <span style={{ color: "var(--wine-text)" }}>*</span>
          </label>
          <input
            id={textoId}
            name="motivo_texto"
            type="text"
            className="studio-input"
            value={value.texto}
            onChange={(e) => onChange({ ...value, texto: e.target.value })}
            maxLength={OPERARIO_MOTIVO_TEXTO_MAX}
            placeholder={placeholder}
            autoComplete="off"
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={hintId}
            required
          />
        </div>
      )}

      <p
        id={hintId}
        role={error ? "alert" : undefined}
        style={{
          font: "500 11.5px/1.4 var(--f-sans)",
          color: error ? "var(--ink)" : "var(--ink-soft)",
          margin: 0,
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
        ) : otro ? (
          "Entre 4 y 200 caracteres. Queda en la auditoría con tu nombre. No escribas el PIN."
        ) : (
          "Queda en la auditoría con tu nombre."
        )}
      </p>
    </div>
  );
}

/** ¿El motivo ya se puede enviar? Lo usan los cajones para habilitar el botón. */
export function motivoListo(value: MotivoValue, pin?: string | null): boolean {
  return operarioMotivoProblem(value.codigo, value.texto, pin) === null;
}
