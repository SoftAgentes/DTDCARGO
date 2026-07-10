"use client";

/**
 * <TwoFactorGate> — gate de desbloqueo del No-Olvidar (SDD-0025 §4.5).
 *
 * Pide el código TOTP (+ master password si el user la configuró) y llama a
 * unlockNoOlvidarAction. Al desbloquear, redirige a `nextPath`. Muestra el
 * countdown de lockout si el server reporta bloqueo por intentos fallidos.
 *
 * Solo tokens var(--*).
 */

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { unlockNoOlvidarAction } from "../actions";
import { ErrorAlert } from "@/app/studio/_components/ui/ErrorAlert";
import type { NoOlvidarActionState } from "@/lib/studio/no-olvidar-types";

interface TwoFactorGateProps {
  hasMasterPassword: boolean;
  nextPath: string;
}

export function TwoFactorGate({ hasMasterPassword, nextPath }: TwoFactorGateProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<NoOlvidarActionState, FormData>(
    unlockNoOlvidarAction,
    {},
  );

  useEffect(() => {
    if (state.ok) router.replace(nextPath);
  }, [state.ok, nextPath, router]);

  return (
    <div style={{ maxWidth: 380, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)" }}>Desbloquear No-Olvidar</h1>
        <p style={{ fontSize: 13, color: "var(--ink-mute)" }}>
          Ingresá el código de tu app de autenticación
          {hasMasterPassword ? " y tu master password" : ""}.
        </p>
      </div>

      <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-mute)" }}>Código 2FA</span>
          <input
            name="totp_code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            pattern="\d{6}"
            required
            autoFocus
            placeholder="000000"
            style={{ ...inputStyle, letterSpacing: 6, textAlign: "center", fontFamily: "var(--font-mono)" }}
          />
        </label>

        {hasMasterPassword && (
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-mute)" }}>Master password</span>
            <input name="master_password" type="password" required style={inputStyle} />
          </label>
        )}

        <ErrorAlert state={state} compact />

        <button type="submit" disabled={isPending} style={submitStyle(isPending)}>
          {isPending ? "Verificando…" : "Desbloquear"}
        </button>
      </form>

      <p style={{ fontSize: 12, color: "var(--ink-mute)", textAlign: "center" }}>
        ¿Perdiste el acceso?{" "}
        <a href="/studio/no-olvidar/recovery" style={{ color: "var(--wine)", fontWeight: 600 }}>
          Solicitar recovery
        </a>
      </p>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface-sel)",
  color: "var(--ink)",
  fontSize: 15,
};

function submitStyle(pending: boolean): React.CSSProperties {
  return {
    padding: "10px 16px",
    borderRadius: 8,
    border: "none",
    background: pending ? "var(--wine-soft)" : "var(--wine)",
    color: "var(--color-on-accent)",
    fontWeight: 700,
    fontSize: 14,
    cursor: pending ? "default" : "pointer",
  };
}
