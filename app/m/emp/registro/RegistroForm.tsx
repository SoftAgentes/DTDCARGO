"use client";

/**
 * Form de auto-registro del candidato (SDD-0113 Slice A). useActionState contra
 * `submitRegistrationAction`. Mobile-first, tokens del Studio. El sueldo NO se
 * pide (lo fija la empresa al aprobar). Al enviar OK → pantalla de "recibido".
 */

import { useActionState } from "react";
import {
  submitRegistrationAction,
  type RegistroActionState,
} from "../actions";

const INITIAL: RegistroActionState = {};

function Field({
  label,
  name,
  type = "text",
  inputMode,
  required,
  defaultValue,
  placeholder,
  error,
}: {
  label: string;
  name: string;
  type?: string;
  inputMode?: "numeric" | "decimal" | "tel" | "text";
  required?: boolean;
  defaultValue?: string | null;
  placeholder?: string;
  error?: string;
}) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <span className="studio-label" style={{ display: "block", marginBottom: 4 }}>
        {label} {required && <span style={{ color: "var(--danger)" }}>*</span>}
      </span>
      <input
        className="studio-input"
        name={name}
        type={type}
        inputMode={inputMode}
        required={required}
        defaultValue={defaultValue ?? undefined}
        placeholder={placeholder}
        style={{ width: "100%" }}
      />
      {error && (
        <span style={{ font: "500 11.5px/1.3 var(--f-sans)", color: "var(--danger)" }}>{error}</span>
      )}
    </label>
  );
}

export function RegistroForm({
  token,
  cargoSugerido,
  departamentoSugerido,
}: {
  token: string;
  cargoSugerido: string | null;
  departamentoSugerido: string | null;
}) {
  const [state, formAction, isPending] = useActionState(submitRegistrationAction, INITIAL);

  if (state.ok) {
    return (
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          padding: "24px 20px",
          textAlign: "center",
        }}
      >
        <div style={{ font: "800 16px/1.3 var(--f-display)", color: "var(--ink)", marginBottom: 8 }}>
          Solicitud recibida
        </div>
        <p style={{ font: "400 13px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
          Gracias. El administrador de DTD va a revisar tus datos y te da acceso una vez aprobada.
        </p>
      </div>
    );
  }

  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction}>
      <input type="hidden" name="token" value={token} />

      {state.error && (
        <div
          role="alert"
          style={{
            background: "var(--danger-bg)",
            border: "1px solid var(--danger)",
            borderRadius: "var(--r-md)",
            padding: "10px 12px",
            marginBottom: 14,
            font: "500 12.5px/1.4 var(--f-sans)",
            color: "var(--danger)",
          }}
        >
          {state.error}
        </div>
      )}

      <Field label="Nombre completo" name="full_name" required error={fe.full_name} placeholder="Pedro Pérez" />
      <Field label="Cédula" name="national_id" required error={fe.national_id} placeholder="V-12.345.678" />
      <Field label="Correo" name="email" type="email" required error={fe.email} placeholder="tu@correo.com" />
      <Field label="Teléfono" name="phone" type="tel" error={fe.phone} placeholder="+58 412 000 0000" />
      <Field label="Fecha de nacimiento" name="birth_date" type="date" error={fe.birth_date} />
      <Field label="Cargo" name="cargo" defaultValue={cargoSugerido} error={fe.cargo} placeholder="Operario" />
      {departamentoSugerido && (
        <p style={{ font: "400 11.5px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: "-8px 0 14px" }}>
          Área sugerida: {departamentoSugerido}
        </p>
      )}
      <Field label="Banco" name="bank_name" error={fe.bank_name} placeholder="Banesco" />
      <label style={{ display: "block", marginBottom: 14 }}>
        <span className="studio-label" style={{ display: "block", marginBottom: 4 }}>Tipo de cuenta</span>
        <select className="studio-input" name="bank_account_type" defaultValue="" style={{ width: "100%" }}>
          <option value="">—</option>
          <option value="corriente">Corriente</option>
          <option value="ahorro">Ahorro</option>
        </select>
        {fe.bank_account_type && (
          <span style={{ font: "500 11.5px/1.3 var(--f-sans)", color: "var(--danger)" }}>
            {fe.bank_account_type}
          </span>
        )}
      </label>
      <Field label="Número de cuenta" name="bank_account" inputMode="numeric" error={fe.bank_account} placeholder="0134…" />

      <button
        type="submit"
        className="studio-btn studio-btn-primary"
        disabled={isPending}
        style={{ width: "100%", marginTop: 6, justifyContent: "center", opacity: isPending ? 0.7 : 1 }}
      >
        {isPending ? "Enviando…" : "Enviar solicitud"}
      </button>
    </form>
  );
}
