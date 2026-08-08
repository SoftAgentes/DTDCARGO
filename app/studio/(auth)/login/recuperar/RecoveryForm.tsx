"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestStudioRecoveryAction, type RecoveryState } from "./actions";

const initialState: RecoveryState = {};

/**
 * Form de recuperación de acceso (SDD-0252). Mismo look dark del login
 * (`LoginForm.tsx`) para que se sienta la misma pantalla, no un flujo aparte.
 *
 * Respuesta SIEMPRE genérica — el estado "enviado" se muestra exista o no la
 * cuenta, igual que el magic-link del portal. No hay forma de distinguir
 * "no tenías cuenta" de "ya te mandamos el enlace" desde la UI.
 */
export function RecoveryForm() {
  const [state, formAction, isPending] = useActionState(
    requestStudioRecoveryAction,
    initialState,
  );

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
        <span className="studio-eyebrow-dark">DTD Cargo · v0.1</span>

        {state.sent ? (
          <>
            <h1
              className="studio-display"
              style={{ fontSize: 26, color: "#FFFFFF", margin: "12px 0 12px" }}
            >
              Revisa tu correo.
            </h1>
            <p
              style={{
                font: "500 13px/1.6 Archivo, sans-serif",
                color: "rgba(255, 255, 255, 0.65)",
                margin: "0 0 24px",
              }}
            >
              Si ese correo tiene una cuenta activa en el Studio, te mandamos
              un enlace para crear una contraseña nueva. Vence en unos días y
              es de un solo uso — si no llega, revisa spam o pide otro.
            </p>
          </>
        ) : (
          <>
            <h1
              className="studio-display"
              style={{ fontSize: 30, color: "#FFFFFF", margin: "12px 0 12px" }}
            >
              Recupera tu <span style={{ color: "#C2747F" }}>acceso</span>.
            </h1>
            <p
              style={{
                font: "500 13px/1.6 Archivo, sans-serif",
                color: "rgba(255, 255, 255, 0.65)",
                margin: "0 0 28px",
              }}
            >
              Escribe el correo con el que entras al Studio. Te mandamos un
              enlace para crear una contraseña nueva.
            </p>

            <form
              action={formAction}
              style={{ display: "flex", flexDirection: "column", gap: 16 }}
            >
              <div>
                <label htmlFor="email" className="studio-label-dark">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  required
                  placeholder="tu@dtdcargo.com"
                  disabled={isPending}
                  className="studio-input-dark"
                />
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

              <button
                type="submit"
                disabled={isPending}
                className="studio-btn studio-btn-primary"
                style={{ marginTop: 4 }}
              >
                {isPending ? "ENVIANDO..." : "ENVIARME EL ENLACE →"}
              </button>
            </form>
          </>
        )}

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
          <Link href="/studio/login" style={{ color: "#C2747F", textDecoration: "none" }}>
            ← Volver a entrar
          </Link>
        </div>
      </div>
    </div>
  );
}
