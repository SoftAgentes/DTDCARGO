"use client";

/**
 * AcceptInvitationForm · form para que el invitado cree su cuenta.
 * SDD-0024 Fase 2.
 *
 * Después del submit exitoso, redirige a /studio/dashboard.
 */

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ROLE_LABELS,
  type StudioUserRole,
  type UserActionState,
} from "@/lib/studio/user-types";
import { acceptInvitationFormAction } from "../actions";

const INITIAL: UserActionState = {};

interface Props {
  token: string;
  email: string;
  role: StudioUserRole;
}

export function AcceptInvitationForm({ token, email, role }: Props) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    acceptInvitationFormAction,
    INITIAL,
  );

  // Redirect al success
  useEffect(() => {
    if (state.ok) {
      const t = window.setTimeout(() => {
        router.push("/studio/dashboard");
      }, 1500);
      return () => window.clearTimeout(t);
    }
  }, [state.ok, router]);

  if (state.ok) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h2
          style={{
            margin: 0,
            fontSize: 16,
            color: "var(--success, #1F8A5B)",
            fontWeight: 600,
          }}
        >
          ¡Bienvenido al Studio!
        </h2>
        <p style={{ margin: 0, color: "var(--ink-soft, #6B6B6B)", fontSize: 14 }}>
          Tu cuenta fue creada y vinculada al equipo. Te llevamos al dashboard…
        </p>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
    >
      <input type="hidden" name="token" value={token} />

      {/* Info pre-llenada */}
      <div
        style={{
          padding: "10px 12px",
          background: "var(--bg-elevated, #F2F0EC)",
          borderRadius: 6,
          fontSize: 12,
          color: "var(--ink-soft)",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <div>
          <strong style={{ color: "var(--ink)" }}>Email:</strong> {email}
        </div>
        <div>
          <strong style={{ color: "var(--ink)" }}>Rol asignado:</strong>{" "}
          {ROLE_LABELS[role]}
        </div>
      </div>

      <FormField label="Nombre" error={state.fieldErrors?.first_name}>
        <input
          name="first_name"
          type="text"
          placeholder="María"
          maxLength={60}
          disabled={isPending}
          style={inputStyle(!!state.fieldErrors?.first_name)}
        />
      </FormField>

      <FormField label="Apellido" error={state.fieldErrors?.last_name}>
        <input
          name="last_name"
          type="text"
          placeholder="Pérez"
          maxLength={60}
          disabled={isPending}
          style={inputStyle(!!state.fieldErrors?.last_name)}
        />
      </FormField>

      <FormField label="Password (mín 10 caracteres)" error={state.fieldErrors?.password}>
        <input
          name="password"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          disabled={isPending}
          style={inputStyle(!!state.fieldErrors?.password)}
        />
      </FormField>

      {state.error && (
        <div
          role="alert"
          style={{
            padding: "10px 12px",
            background: "var(--danger-bg, #FCEDED)",
            border: "1px solid var(--danger, #A8323E)",
            borderRadius: 6,
            color: "var(--danger, #A8323E)",
            fontSize: 13,
          }}
        >
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="studio-btn studio-btn-primary"
        style={{ marginTop: 4 }}
      >
        {isPending ? "Creando cuenta…" : "Aceptar invitación y crear cuenta"}
      </button>
    </form>
  );
}

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--ink-soft)",
        }}
      >
        {label}
      </span>
      {children}
      {error && (
        <span style={{ color: "var(--danger)", fontSize: 12 }}>{error}</span>
      )}
    </label>
  );
}

function inputStyle(hasError: boolean): React.CSSProperties {
  return {
    width: "100%",
    height: 38,
    padding: "0 12px",
    border: hasError
      ? "1px solid var(--danger, #A8323E)"
      : "1px solid var(--border, #E8E6E2)",
    borderRadius: 6,
    background: "var(--bg-base)",
    color: "var(--ink)",
    fontFamily: "inherit",
    fontSize: 13,
    outline: "none",
  };
}
