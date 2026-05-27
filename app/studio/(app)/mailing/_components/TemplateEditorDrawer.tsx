"use client";

/**
 * TemplateEditorDrawer · edit form para un mail_template (SDD-0026 Fase 3b).
 *
 * Form fields: name, subject, body_html (textarea grande), active.
 * Variables se auto-detectan en server action al guardar (no hay form
 * para listarlas, solo display informativo).
 *
 * Botón "Mandar prueba" dispara sendTestTemplateAction que rellena vars
 * con sample data y manda al email del admin logueado (vía sendEmail
 * + test_mode redirect).
 */

import { useActionState, useEffect, useState } from "react";
import { DrawerShell } from "@/app/studio/_components/ui/drawer/DrawerShell";
import {
  INITIAL_MAILING_STATE,
  sendTestTemplateAction,
  updateMailTemplateAction,
} from "../actions";
import type { MailTemplate } from "@/lib/studio/mail-types";

interface Props {
  template: MailTemplate;
  onClose: () => void;
  onMutated: () => void;
}

export function TemplateEditorDrawer({ template, onClose, onMutated }: Props) {
  const [editState, editAction, editPending] = useActionState(
    updateMailTemplateAction,
    INITIAL_MAILING_STATE,
  );
  const [testState, testAction, testPending] = useActionState(
    sendTestTemplateAction,
    INITIAL_MAILING_STATE,
  );

  useEffect(() => {
    if (editState.ok || testState.ok) {
      onMutated();
    }
  }, [editState.ok, testState.ok, onMutated]);

  const pending = editPending || testPending;

  return (
    <DrawerShell
      title={template.name}
      subtitle={template.slug}
      onClose={onClose}
      pending={pending}
      width={720}
    >
      <form
        id="tpl-edit-form"
        action={editAction}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <input type="hidden" name="id" value={template.id} />

        <Field
          label="Nombre"
          name="name"
          defaultValue={template.name}
          error={editState.fieldErrors?.name}
          maxLength={120}
          disabled={pending}
        />

        <Field
          label="Subject"
          name="subject"
          defaultValue={template.subject}
          error={editState.fieldErrors?.subject}
          maxLength={300}
          disabled={pending}
          hint={`Usá {{variables}} · ej: {{customer_name}}, {{quote_code}}.`}
        />

        <TextareaField
          label="Body HTML"
          name="body_html"
          defaultValue={template.body_html}
          error={editState.fieldErrors?.body_html}
          rows={18}
          disabled={pending}
          hint="HTML del cuerpo. Las variables {{var}} se sustituyen al enviar."
        />

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
            fontSize: 13,
            color: "var(--ink)",
          }}
        >
          <input
            type="checkbox"
            name="active"
            defaultChecked={template.active}
            disabled={pending}
          />
          Template activo (puede usarse para enviar)
        </label>

        {template.variables.length > 0 && (
          <div
            style={{
              padding: "10px 12px",
              background: "var(--bg-elevated, #F2F0EC)",
              borderRadius: 6,
              fontSize: 12,
            }}
          >
            <div
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--ink-soft)",
                marginBottom: 6,
              }}
            >
              Variables detectadas ({template.variables.length})
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {template.variables.map((v) => (
                <code
                  key={v}
                  style={{
                    fontFamily: "var(--font-mono, 'JetBrains Mono')",
                    fontSize: 11,
                    padding: "2px 6px",
                    background: "var(--bg-surface)",
                    color: "var(--ink-soft)",
                    border: "1px solid var(--border)",
                    borderRadius: 4,
                  }}
                >
                  {`{{${v}}}`}
                </code>
              ))}
            </div>
          </div>
        )}

        {editState.error && (
          <ErrorBanner message={editState.error} />
        )}
        {editState.ok && editState.message && (
          <SuccessBanner message={editState.message} />
        )}
      </form>

      <footer
        style={{
          padding: "16px 24px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          gap: 8,
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        {/* Test send · form separado pero del mismo drawer */}
        <form action={testAction}>
          <input type="hidden" name="template_id" value={template.id} />
          <button
            type="submit"
            disabled={pending}
            className="studio-btn studio-btn-ghost studio-btn-sm"
            title="Manda este template con sample vars al email del admin (vía test_mode redirect)"
          >
            {testPending ? "Enviando…" : "Mandar prueba"}
          </button>
          {testState.error && (
            <span
              style={{
                marginLeft: 12,
                color: "var(--danger)",
                fontSize: 12,
              }}
            >
              {testState.error}
            </span>
          )}
          {testState.ok && testState.message && (
            <span
              style={{
                marginLeft: 12,
                color: "var(--success)",
                fontSize: 12,
              }}
            >
              ✓ {testState.message}
            </span>
          )}
        </form>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="studio-btn studio-btn-ghost"
          >
            Cerrar
          </button>
          <button
            type="submit"
            form="tpl-edit-form"
            disabled={pending}
            className="studio-btn studio-btn-primary"
          >
            {editPending ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </footer>
    </DrawerShell>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-fields
// ─────────────────────────────────────────────────────────────

function Field({
  label,
  name,
  defaultValue,
  error,
  maxLength,
  disabled,
  hint,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  error?: string;
  maxLength?: number;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
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
      <input
        name={name}
        type="text"
        defaultValue={defaultValue}
        maxLength={maxLength}
        disabled={disabled}
        style={{
          height: 38,
          padding: "0 12px",
          border: `1px solid ${error ? "var(--danger)" : "var(--border)"}`,
          borderRadius: 6,
          background: "var(--bg-base)",
          color: "var(--ink)",
          fontFamily: "inherit",
          fontSize: 13,
          outline: "none",
        }}
      />
      {hint && !error && (
        <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>{hint}</span>
      )}
      {error && (
        <span style={{ fontSize: 11, color: "var(--danger)" }}>{error}</span>
      )}
    </label>
  );
}

function TextareaField({
  label,
  name,
  defaultValue,
  error,
  rows,
  disabled,
  hint,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  error?: string;
  rows?: number;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
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
      <textarea
        name={name}
        defaultValue={defaultValue}
        rows={rows ?? 8}
        disabled={disabled}
        style={{
          padding: "10px 12px",
          border: `1px solid ${error ? "var(--danger)" : "var(--border)"}`,
          borderRadius: 6,
          background: "var(--bg-base)",
          color: "var(--ink)",
          fontFamily: "var(--font-mono, 'JetBrains Mono'), monospace",
          fontSize: 12,
          lineHeight: 1.5,
          outline: "none",
          resize: "vertical",
        }}
      />
      {hint && !error && (
        <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>{hint}</span>
      )}
      {error && (
        <span style={{ fontSize: 11, color: "var(--danger)" }}>{error}</span>
      )}
    </label>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
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
      {message}
    </div>
  );
}

function SuccessBanner({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        background: "var(--success-bg, #E5F4ED)",
        border: "1px solid var(--success, #1F8A5B)",
        borderRadius: 6,
        color: "var(--success, #1F8A5B)",
        fontSize: 13,
      }}
    >
      ✓ {message}
    </div>
  );
}
