"use client";

/**
 * MyProfileEditor · form para que el user logueado edite su propio
 * user_profile (first_name + last_name).
 *
 * Estos campos se usan al renderizar emails enviados desde el Studio:
 * "Hola Sam Maan" en lugar de "Hola hailuway.com@gmail.com". Sin nombre
 * cargado, los helpers caen al email como fallback.
 *
 * Form simple: UPSERT user_profiles WHERE user_id = auth.uid().
 * Pattern useActionState como el resto del módulo Usuarios.
 */

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateMyProfileAction } from "../actions";
import type { UserActionState } from "@/lib/studio/user-types";

const INITIAL: UserActionState = {};

interface Props {
  currentEmail: string;
  currentFirstName: string | null;
  currentLastName: string | null;
}

export function MyProfileEditor({
  currentEmail,
  currentFirstName,
  currentLastName,
}: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    updateMyProfileAction,
    INITIAL,
  );

  // Controlled inputs para detectar cambios y deshabilitar el botón
  // cuando no hay edits pendientes.
  const [firstName, setFirstName] = useState(currentFirstName ?? "");
  const [lastName, setLastName] = useState(currentLastName ?? "");

  const hasChanges =
    firstName.trim() !== (currentFirstName ?? "") ||
    lastName.trim() !== (currentLastName ?? "");

  useEffect(() => {
    if (state.ok) {
      // Refresh para que listMembers tome el nuevo nombre y se vea en
      // la tabla de miembros también.
      router.refresh();
    }
  }, [state.ok, router]);

  const displayName =
    [firstName.trim(), lastName.trim()].filter(Boolean).join(" ").trim() ||
    currentEmail;

  return (
    <section
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: 20,
        marginBottom: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 12,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <span className="studio-eyebrow">Tu perfil</span>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 12,
              color: "var(--ink-soft)",
              maxWidth: "70ch",
            }}
          >
            Estos datos aparecen como saludo y firma en los emails que
            mandás desde el Studio (invitaciones, notificaciones, reglas
            de mailing). Sin nombre cargado, los emails usan tu dirección
            de correo como fallback.
          </p>
        </div>
        <span
          style={{
            fontSize: 11,
            color: "var(--ink-soft)",
            fontFamily: "var(--font-mono, 'JetBrains Mono')",
          }}
        >
          {currentEmail}
        </span>
      </div>

      <form
        action={formAction}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr auto",
          gap: 12,
          alignItems: "end",
        }}
      >
        <Field
          label="Nombre"
          name="first_name"
          value={firstName}
          onChange={setFirstName}
          error={state.fieldErrors?.first_name}
          disabled={pending}
          placeholder="Sam"
        />
        <Field
          label="Apellido"
          name="last_name"
          value={lastName}
          onChange={setLastName}
          error={state.fieldErrors?.last_name}
          disabled={pending}
          placeholder="Maan"
        />
        <button
          type="submit"
          className="studio-btn studio-btn-primary"
          disabled={pending || !hasChanges}
        >
          {pending ? "Guardando…" : "Guardar"}
        </button>
      </form>

      <div
        style={{
          marginTop: 12,
          fontSize: 11,
          color: "var(--ink-soft)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span>
          Preview saludo:{" "}
          <strong style={{ color: "var(--ink)" }}>Hola {displayName}</strong>
        </span>
        {state.ok && !hasChanges && (
          <span style={{ color: "var(--success)" }}>Guardado ✓</span>
        )}
        {state.error && (
          <span style={{ color: "var(--danger)" }}>{state.error}</span>
        )}
      </div>
    </section>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  error,
  disabled,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label
        className="studio-label"
        htmlFor={`profile-${name}`}
        style={{ fontSize: 11 }}
      >
        {label}
      </label>
      <input
        id={`profile-${name}`}
        type="text"
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={80}
        autoComplete="off"
        className="studio-input"
      />
      {error && (
        <span style={{ fontSize: 11, color: "var(--danger)" }}>{error}</span>
      )}
    </div>
  );
}
