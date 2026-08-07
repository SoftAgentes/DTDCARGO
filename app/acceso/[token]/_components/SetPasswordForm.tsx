"use client";

/**
 * Formulario de "crea tu contraseña" del enlace de acceso (SDD-0250).
 *
 * Server action (no `updateUser` desde el navegador): quien llega acá NO tiene
 * sesión, así que la clave la fija el servidor con el admin client contra el
 * `user_id` que guarda el token. Esa es la diferencia con el tab Contraseña del
 * ProfileModal, que sí corre en el cliente porque ahí ya hay sesión.
 */

import { useActionState, useState } from "react";
import {
  MIN_PASSWORD_LENGTH,
  validateNewPassword,
} from "@/lib/studio/access-token";
import {
  setPasswordWithAccessToken,
  type SetPasswordState,
} from "../actions";

const INICIAL: SetPasswordState = {};

export function SetPasswordForm({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
  const [state, formAction, isPending] = useActionState(
    setPasswordWithAccessToken,
    INICIAL,
  );
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");

  // Mismo validador que usa la action: una sola regla, sin que el cliente y el
  // servidor puedan discrepar.
  const problemaLocal =
    password || repeat ? validateNewPassword(password, repeat) : null;
  const puedeEnviar = !problemaLocal && !isPending;

  return (
    <form
      action={formAction}
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      <input type="hidden" name="token" value={token} />

      {email && (
        <p
          style={{
            font: "500 13px/1.5 var(--f-sans, Archivo, sans-serif)",
            color: "var(--ink-soft, #6B6B6B)",
            margin: 0,
          }}
        >
          Para la cuenta <strong style={{ color: "var(--ink, #0F1E3D)" }}>{email}</strong>.
          La eliges tú — nadie más la ve.
        </p>
      )}

      <div>
        <label htmlFor="password" className="studio-label">
          Nueva contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          disabled={isPending}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="studio-input"
        />
        <p
          style={{
            font: "500 11.5px/1.4 var(--f-sans, Archivo, sans-serif)",
            color: "var(--ink-soft, #6B6B6B)",
            margin: "6px 0 0",
          }}
        >
          Mínimo {MIN_PASSWORD_LENGTH} caracteres. Mezcla mayúsculas, minúsculas,
          números y símbolos.
        </p>
      </div>

      <div>
        <label htmlFor="repeat" className="studio-label">
          Repite la contraseña
        </label>
        <input
          id="repeat"
          name="repeat"
          type="password"
          autoComplete="new-password"
          required
          disabled={isPending}
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
          className="studio-input"
        />
      </div>

      {(problemaLocal || state.error) && (
        <p
          role="alert"
          style={{
            font: "600 12.5px/1.45 var(--f-sans, Archivo, sans-serif)",
            color: "var(--danger, #A8323E)",
            margin: 0,
          }}
        >
          {problemaLocal ?? state.error}
        </p>
      )}

      <button
        type="submit"
        className="studio-btn studio-btn-primary"
        disabled={!puedeEnviar}
        aria-busy={isPending}
        style={{ marginTop: 4 }}
      >
        {isPending ? "Guardando…" : "Guardar y entrar"}
      </button>

      <p
        style={{
          font: "500 11.5px/1.5 var(--f-sans, Archivo, sans-serif)",
          color: "var(--ink-soft, #6B6B6B)",
          margin: "8px 0 0",
          textAlign: "center",
        }}
      >
        Después puedes cambiarla cuando quieras desde el menú de tu usuario,
        arriba a la derecha.
      </p>
    </form>
  );
}
