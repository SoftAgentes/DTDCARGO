"use client";

/**
 * AcceptInvitationForm · form para que el invitado cree su cuenta.
 * SDD-0024 Fase 2.
 *
 * Después del submit exitoso, redirige a /studio/dashboard.
 *
 * UX:
 *  - Min password: 6 chars (suficiente para usuarios internos, no público).
 *  - Show/hide password con auto-hide 3s (mismo patrón del /studio/login).
 *  - Cuando la invitación ya fue aceptada (race condition o user revisita),
 *    el state.error con "ya fue aceptada" se renderiza como pantalla success
 *    grande verde con CTA "Iniciar sesión" en lugar de error rojo + form.
 */

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ROLE_LABELS,
  type StudioUserRole,
  type UserActionState,
} from "@/lib/studio/user-types";
import { acceptInvitationFormAction } from "../actions";

const INITIAL: UserActionState = {};
const REVEAL_PASSWORD_MS = 3000;

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
  const [showPassword, setShowPassword] = useState(false);

  // Auto-ocultar contraseña 3s después de mostrarla
  useEffect(() => {
    if (!showPassword) return;
    const timer = setTimeout(() => setShowPassword(false), REVEAL_PASSWORD_MS);
    return () => clearTimeout(timer);
  }, [showPassword]);

  // Redirect al success (cuenta creada)
  useEffect(() => {
    if (state.ok) {
      const t = window.setTimeout(() => {
        router.push("/studio/dashboard");
      }, 1500);
      return () => window.clearTimeout(t);
    }
  }, [state.ok, router]);

  // Success state: cuenta creada y logueada → redirige a /studio
  if (state.ok) {
    return (
      <SuccessPanel
        title="¡Bienvenido al Studio!"
        message="Tu cuenta fue creada y vinculada al equipo. Te llevamos al dashboard…"
        tone="brand"
      />
    );
  }

  // Caso especial: invitación ya aceptada (race condition o revisit del link)
  // → renderizar como pantalla success con CTA login, no como error rojo + form.
  const alreadyAccepted =
    !!state.error && /ya fue aceptada/i.test(state.error);

  if (alreadyAccepted) {
    return (
      <SuccessPanel
        title="Esta invitación ya fue aceptada"
        message="Tu cuenta ya está activa. Inicia sesión normalmente desde el Studio."
        tone="success"
        ctaHref="/studio/login"
        ctaLabel="Iniciar sesión →"
      />
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

      <FormField label="Password (mín 8 caracteres)" error={state.fieldErrors?.password}>
        <div style={{ position: "relative" }}>
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            required
            minLength={8}
            autoComplete="new-password"
            disabled={isPending}
            style={{ ...inputStyle(!!state.fieldErrors?.password), paddingRight: 40 }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            disabled={isPending}
            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña 3 segundos"}
            title={
              showPassword ? "Ocultar (auto en 3s)" : "Mostrar 3 segundos"
            }
            style={{
              position: "absolute",
              right: 8,
              top: "50%",
              transform: "translateY(-50%)",
              background: "transparent",
              border: 0,
              padding: 8,
              color: showPassword ? "var(--wine, #7F0F1A)" : "var(--ink-soft, #6B6B6B)",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              borderRadius: 4,
              transition: "color 0.15s",
            }}
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
      </FormField>

      {state.error && !alreadyAccepted && (
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

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function SuccessPanel({
  title,
  message,
  tone,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  message: string;
  tone: "brand" | "success";
  ctaHref?: string;
  ctaLabel?: string;
}) {
  const accent =
    tone === "success" ? "var(--success, #1F8A5B)" : "var(--ink, #0F1E3D)";
  const bg =
    tone === "success" ? "var(--success-bg, #E8F5EE)" : "var(--bg-elevated)";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: "20px 20px",
        background: bg,
        border: `1px solid ${accent}`,
        borderRadius: 10,
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <CheckIcon color={accent} />
        <h2
          style={{
            margin: 0,
            fontFamily: "var(--font-archivo-black, 'Archivo Black')",
            fontSize: 20,
            color: accent,
            letterSpacing: "-0.01em",
            lineHeight: 1.2,
          }}
        >
          {title}
        </h2>
      </div>
      <p
        style={{
          margin: 0,
          color: "var(--ink, #0F1E3D)",
          fontSize: 14,
          lineHeight: 1.5,
        }}
      >
        {message}
      </p>
      {ctaHref && ctaLabel && (
        <a
          href={ctaHref}
          className="studio-btn studio-btn-primary"
          style={{ alignSelf: "flex-start", marginTop: 4 }}
        >
          {ctaLabel}
        </a>
      )}
    </div>
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

function EyeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function CheckIcon({ color }: { color: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0, marginTop: 2 }}
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
