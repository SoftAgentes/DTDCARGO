/**
 * Página de login del Studio.
 *
 * Form simple email + password. SDD-0004 + refactor visual post-audit.
 *
 * Server action en ./actions.ts hace el signInWithPassword + redirect.
 */

"use client";

import { useActionState, useEffect, useState } from "react";
import { signIn, type SignInState } from "./actions";

const initialState: SignInState = {};

/** Cuántos ms se muestra la contraseña antes de auto-ocultarse */
const REVEAL_PASSWORD_MS = 3000;

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(signIn, initialState);
  const [showPassword, setShowPassword] = useState(false);

  // Auto-ocultar contraseña 3 segundos despues de mostrarla
  useEffect(() => {
    if (!showPassword) return;
    const timer = setTimeout(() => setShowPassword(false), REVEAL_PASSWORD_MS);
    return () => clearTimeout(timer);
  }, [showPassword]);

  return (
    <div className="studio-dark">
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          background: "#16264A",
          borderRadius: 14,
          padding: 40,
          boxShadow: "0 30px 60px -20px rgba(0, 0, 0, 0.4)",
        }}
      >
        <span className="studio-eyebrow-dark">DoorTuDoor · v0.1</span>
        <h1
          className="studio-display"
          style={{
            fontSize: 30,
            color: "#FFFFFF",
            margin: "12px 0 32px",
          }}
        >
          Entrá al <span style={{ color: "#C2747F" }}>Studio</span>.
        </h1>

        <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label htmlFor="email" className="studio-label-dark">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="vos@dtdcargo.com"
              disabled={isPending}
              className="studio-input-dark"
            />
          </div>

          <div>
            <label htmlFor="password" className="studio-label-dark">
              Contraseña
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                disabled={isPending}
                className="studio-input-dark"
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                disabled={isPending}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                title={
                  showPassword ? "Ocultar (se oculta sola en 3s)" : "Mostrar 3 segundos"
                }
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: 0,
                  padding: 6,
                  color: showPassword ? "#C2747F" : "rgba(255, 255, 255, 0.45)",
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                  borderRadius: 4,
                  transition: "color 0.15s",
                }}
              >
                {showPassword ? (
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
                ) : (
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
                )}
              </button>
            </div>
          </div>

          {state.error && (
            <div
              role="alert"
              style={{
                padding: "10px 12px",
                background: "rgba(194, 53, 63, 0.18)",
                border: "1px solid rgba(194, 53, 63, 0.35)",
                borderRadius: 6,
                color: "#FFC2C7",
                font: "500 12.5px/1.4 Archivo, sans-serif",
              }}
            >
              {state.error}
            </div>
          )}

          <button type="submit" disabled={isPending} className="studio-btn studio-btn-primary" style={{ marginTop: 4 }}>
            {isPending ? "INGRESANDO..." : "INGRESAR →"}
          </button>
        </form>

        <div
          style={{
            marginTop: 28,
            paddingTop: 20,
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            font: "500 11.5px/1.5 Archivo, sans-serif",
            color: "rgba(255, 255, 255, 0.45)",
            textAlign: "center",
          }}
        >
          Solo personal autorizado de DTD·CARGO.
          <br />
          ¿Olvidaste tu contraseña?{" "}
          <a
            href="mailto:bigbonnysam@gmail.com"
            style={{ color: "#C2747F", textDecoration: "none" }}
          >
            Escribile a Sam
          </a>
          .
        </div>
      </div>
    </div>
  );
}
