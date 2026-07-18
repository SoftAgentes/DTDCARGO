"use client";

/**
 * <AddItemDrawer> — alta de un item del No-Olvidar (SDD-0025 Fase 3).
 *
 * El form manda name/url/username/notes_preview/favorite/category + los campos
 * de plaintext de la categoría (password, cvc, secret…). El cifrado ocurre
 * SERVER-SIDE en createItemAction (V1): el plaintext viaja por TLS y se cifra
 * antes de tocar la DB. Patrón DrawerShell HTML5 (form id + submit en footer).
 *
 * Solo tokens var(--*).
 */

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DrawerShell, DrawerFooter } from "@/app/studio/_components/ui/drawer/DrawerShell";
import { ErrorAlert } from "@/app/studio/_components/ui/ErrorAlert";
import { createItemAction } from "../actions";
import {
  categoryDefaultFields,
  categoryLabel,
  NO_OLVIDAR_CATEGORIES,
  type NoOlvidarActionState,
  type NoOlvidarCategory,
} from "@/lib/studio/no-olvidar-types";

const FORM_ID = "no-olvidar-add";

export function AddItemDrawer({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [category, setCategory] = useState<NoOlvidarCategory>("login");
  const [state, formAction, isPending] = useActionState<NoOlvidarActionState, FormData>(
    createItemAction,
    {},
  );

  useEffect(() => {
    if (state.ok) {
      router.refresh();
      onClose();
    }
  }, [state.ok, router, onClose]);

  const fields = categoryDefaultFields(category);

  return (
    <DrawerShell title="Agregar al No-Olvidar" subtitle="El contenido se cifra al guardar" onClose={onClose} pending={isPending}>
      <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px" }}>
        <form id={FORM_ID} action={formAction} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <input type="hidden" name="category" value={category} />

          {/* Selector de categoría */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={labelStyle}>Tipo</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {NO_OLVIDAR_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  style={{
                    padding: "7px 12px",
                    borderRadius: "var(--r-md)",
                    border: `1px solid ${c === category ? "var(--wine)" : "var(--border)"}`,
                    background: c === category ? "var(--wine-tint)" : "var(--bg-surface)",
                    color: c === category ? "var(--wine)" : "var(--ink-soft)",
                    font: "600 12.5px/1 var(--f-sans)",
                    cursor: "pointer",
                  }}
                >
                  {categoryLabel(c)}
                </button>
              ))}
            </div>
          </div>

          <Field label="Nombre" name="name" required placeholder="ej. Gmail del equipo" />

          {fields.map((f) => (
            <Field
              key={f.key}
              label={f.label}
              name={f.key}
              required={f.required}
              type={f.type === "password" ? "password" : "text"}
              textarea={f.type === "textarea"}
              mono={f.type === "password" || f.type === "totp"}
            />
          ))}

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" name="favorite" />
            <span style={{ font: "500 13px/1 var(--f-sans)", color: "var(--ink)" }}>
              Marcar como favorito
            </span>
          </label>

          <ErrorAlert state={state} compact />
        </form>
      </div>

      <DrawerFooter
        formId={FORM_ID}
        onClose={onClose}
        isPending={isPending}
        canSubmit
        submitLabel="Guardar cifrado"
        pendingLabel="Cifrando…"
      />
    </DrawerShell>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  textarea,
  mono,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  textarea?: boolean;
  mono?: boolean;
}) {
  const shared: React.CSSProperties = {
    padding: "9px 11px",
    borderRadius: "var(--r-md)",
    border: "1px solid var(--border)",
    background: "var(--surface-sel)",
    color: "var(--ink)",
    font: `400 14px/1.4 ${mono ? "var(--font-mono)" : "var(--f-sans)"}`,
  };
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span style={labelStyle}>
        {label}
        {required && <span style={{ color: "var(--wine)" }}> *</span>}
      </span>
      {textarea ? (
        <textarea name={name} required={required} rows={3} placeholder={placeholder} style={{ ...shared, resize: "vertical" }} />
      ) : (
        <input name={name} type={type} required={required} placeholder={placeholder} autoComplete="off" style={shared} />
      )}
    </label>
  );
}

const labelStyle: React.CSSProperties = {
  font: "600 12px/1 var(--f-sans)",
  color: "var(--ink-mute)",
};
