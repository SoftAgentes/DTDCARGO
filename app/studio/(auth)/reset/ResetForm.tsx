/**
 * Form de "crea tu contraseña" (SDD-0250).
 *
 * Client-side vía `supabase.auth.updateUser({ password })` sobre la sesión de
 * recuperación que abrió `/studio/reset/confirmar` — mismo mecanismo que el tab
 * Contraseña del ProfileModal, y el mismo mínimo de 12 caracteres, para que la
 * regla sea una sola en todo el Studio.
 *
 * Visualmente hermano de LoginForm: es la misma puerta de entrada.
 */

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient as createBrowserSupabase } from "@/lib/db/client";

const MIN_LENGTH = 12;

export function ResetForm({ email }: { email: string }) {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const tooShort = pw.length > 0 && pw.length < MIN_LENGTH;
  const mismatch = pw2.length > 0 && pw !== pw2;
  const canSubmit = pw.length >= MIN_LENGTH && pw === pw2 && !pending && !done;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    startTransition(async () => {
      const supabase = createBrowserSupabase();
      const { error: updateErr } = await supabase.auth.updateUser({
        password: pw,
      });
      if (updateErr) {
        setError(
          updateErr.message.toLowerCase().includes("same")
            ? "Esa es la contraseña que ya tenías. Elige una distinta."
            : "No se pudo guardar la contraseña. Pide un enlace nuevo e intenta otra vez.",
        );
        return;
      }
      setDone(true);
      router.push("/studio/resumen");
    });
  };

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
        <span className="studio-eyebrow-dark">DTD Cargo · Studio</span>
        <h1
          className="studio-display"
          style={{ fontSize: 30, color: "#FFFFFF", margin: "12px 0 8px" }}
        >
          Crea tu <span style={{ color: "#C2747F" }}>contraseña</span>.
        </h1>
        {email && (
          <p
            style={{
              font: "500 12.5px/1.5 Archivo, sans-serif",
              color: "rgba(255, 255, 255, 0.55)",
              margin: "0 0 28px",
            }}
          >
            Para la cuenta <strong style={{ color: "#FFFFFF" }}>{email}</strong>.
            La eliges tú — nadie más la ve.
          </p>
        )}

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <div>
            <label htmlFor="pw" className="studio-label-dark">
              Nueva contraseña
            </label>
            <input
              id="pw"
              name="new_password"
              type="password"
              autoComplete="new-password"
              required
              disabled={pending || done}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              className="studio-input-dark"
            />
            <p
              style={{
                font: "500 11.5px/1.4 Archivo, sans-serif",
                color: tooShort ? "#FFC2C7" : "rgba(255, 255, 255, 0.45)",
                margin: "6px 0 0",
              }}
            >
              Mínimo {MIN_LENGTH} caracteres. Mezcla mayúsculas, minúsculas,
              números y símbolos.
            </p>
          </div>

          <div>
            <label htmlFor="pw2" className="studio-label-dark">
              Repite la contraseña
            </label>
            <input
              id="pw2"
              name="repeat_password"
              type="password"
              autoComplete="new-password"
              required
              disabled={pending || done}
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              className="studio-input-dark"
            />
            {mismatch && (
              <p
                style={{
                  font: "500 11.5px/1.4 Archivo, sans-serif",
                  color: "#FFC2C7",
                  margin: "6px 0 0",
                }}
              >
                Las contraseñas no coinciden.
              </p>
            )}
          </div>

          {error && (
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
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="studio-btn studio-btn-primary"
            style={{ marginTop: 4 }}
            aria-busy={pending}
          >
            {pending
              ? "GUARDANDO..."
              : done
                ? "LISTO →"
                : "GUARDAR Y ENTRAR →"}
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
          Después puedes cambiarla cuando quieras desde el menú de tu usuario,
          arriba a la derecha.
        </div>
      </div>
    </div>
  );
}
