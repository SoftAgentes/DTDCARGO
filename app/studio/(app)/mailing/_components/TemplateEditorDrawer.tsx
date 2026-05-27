"use client";

/**
 * TemplateEditorDrawer · edit form para un mail_template (SDD-0026 Fase 3b).
 *
 * Layout: 2 vistas toggleable
 *  - Editor: form (name, subject, body_html, active)
 *  - Preview: iframe con HTML renderizado + sample vars (en vivo, mientras editás)
 *
 * Variables auto-detectadas en server action al guardar (no se editan manual).
 * Botón "Mandar prueba" dispara sendTestTemplateAction con sample data.
 */

import { useActionState, useEffect, useMemo, useState } from "react";
import { DrawerShell } from "@/app/studio/_components/ui/drawer/DrawerShell";
import {
  buildSampleVars,
  renderTemplateClient,
} from "@/lib/studio/mail-sample-vars";
import { extractVariables, type MailTemplate } from "@/lib/studio/mail-types";
import {
  sendTestTemplateAction,
  updateMailTemplateAction,
} from "../actions";
import { INITIAL_MAILING_STATE } from "./mailing-types";

type View = "editor" | "preview";

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

  // Controlled state para que el Preview pueda renderizar el HTML actual
  const [name, setName] = useState(template.name);
  const [subject, setSubject] = useState(template.subject);
  const [bodyHtml, setBodyHtml] = useState(template.body_html);
  const [active, setActive] = useState(template.active);
  const [view, setView] = useState<View>("editor");

  // Variables detectadas en vivo (re-extract on edit)
  const liveVariables = useMemo(
    () => extractVariables(`${subject} ${bodyHtml}`),
    [subject, bodyHtml],
  );

  // Sample vars + rendered HTML (recalcula on edit)
  const sampleVars = useMemo(
    () => buildSampleVars(template.slug, liveVariables),
    [template.slug, liveVariables],
  );
  const renderedSubject = useMemo(
    () => renderTemplateClient(subject, sampleVars),
    [subject, sampleVars],
  );
  const renderedBody = useMemo(
    () => renderTemplateClient(bodyHtml, sampleVars),
    [bodyHtml, sampleVars],
  );

  useEffect(() => {
    if (editState.ok || testState.ok) onMutated();
  }, [editState.ok, testState.ok, onMutated]);

  const pending = editPending || testPending;

  return (
    <DrawerShell
      title={template.name}
      subtitle={template.slug}
      onClose={onClose}
      pending={pending}
      width={760}
    >
      {/* Toggle Editor / Preview */}
      <div
        role="tablist"
        aria-label="Vista template"
        style={{
          padding: "12px 24px 0",
          display: "flex",
          gap: 4,
          background: "var(--bg-surface)",
        }}
      >
        {(["editor", "preview"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            style={{
              padding: "8px 16px",
              border: "none",
              background:
                view === v ? "var(--bg-elevated, #F2F0EC)" : "transparent",
              color: view === v ? "var(--ink)" : "var(--ink-soft)",
              borderRadius: "6px 6px 0 0",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: view === v ? 600 : 500,
              transition: "all var(--dur, 180ms) var(--ease, ease-out)",
            }}
          >
            {v === "editor" ? "Editor" : "Preview"}
          </button>
        ))}
      </div>

      {view === "editor" && (
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
            value={name}
            onChange={setName}
            error={editState.fieldErrors?.name}
            maxLength={120}
            disabled={pending}
          />

          <Field
            label="Subject"
            name="subject"
            value={subject}
            onChange={setSubject}
            error={editState.fieldErrors?.subject}
            maxLength={300}
            disabled={pending}
            hint="Usá {{variables}} · ej: {{customer_name}}, {{quote_code}}."
          />

          <TextareaField
            label="Body HTML"
            name="body_html"
            value={bodyHtml}
            onChange={setBodyHtml}
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
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              disabled={pending}
            />
            Template activo (puede usarse para enviar)
          </label>

          {liveVariables.length > 0 && (
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
                Variables detectadas en vivo ({liveVariables.length})
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {liveVariables.map((v) => (
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

          {editState.error && <ErrorBanner message={editState.error} />}
          {editState.ok && editState.message && (
            <SuccessBanner message={editState.message} />
          )}
        </form>
      )}

      {view === "preview" && (
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div
            style={{
              padding: "10px 12px",
              background: "var(--info-bg, #E5EEF9)",
              border: "1px solid var(--info, #2A6FDB)",
              borderRadius: 6,
              fontSize: 11,
              color: "var(--ink)",
              lineHeight: 1.5,
            }}
          >
            Preview literal del HTML con sample vars · clientes de email (Gmail,
            Outlook) renderizan distinto. Para test real, usá &ldquo;Mandar prueba&rdquo;.
          </div>

          {/* Subject preview */}
          <div
            style={{
              padding: "10px 12px",
              background: "var(--bg-elevated)",
              borderRadius: 6,
            }}
          >
            <div
              style={{
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--ink-soft)",
                marginBottom: 4,
              }}
            >
              Subject renderizado
            </div>
            <div
              style={{
                fontSize: 14,
                color: "var(--ink)",
                fontWeight: 600,
              }}
            >
              {renderedSubject}
            </div>
          </div>

          {/* Body iframe preview */}
          <div
            style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--ink-soft)",
            }}
          >
            Body renderizado
          </div>
          <iframe
            title={`Preview ${template.slug}`}
            srcDoc={renderedBody}
            sandbox="allow-same-origin"
            style={{
              width: "100%",
              height: 480,
              border: "1px solid var(--border)",
              borderRadius: 6,
              background: "var(--bg-surface)",
            }}
          />

          {/* Sample vars usadas */}
          {Object.keys(sampleVars).length > 0 && (
            <details
              style={{
                fontSize: 11,
                color: "var(--ink-soft)",
                background: "var(--bg-elevated)",
                padding: "8px 12px",
                borderRadius: 6,
              }}
            >
              <summary style={{ cursor: "pointer", fontWeight: 500 }}>
                Sample vars usadas ({Object.keys(sampleVars).length})
              </summary>
              <div style={{ marginTop: 8, display: "grid", gap: 4 }}>
                {Object.entries(sampleVars).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", gap: 8 }}>
                    <code
                      style={{
                        fontFamily: "var(--font-mono, 'JetBrains Mono')",
                        color: "var(--wine, #7F0F1A)",
                        minWidth: 160,
                      }}
                    >
                      {`{{${k}}}`}
                    </code>
                    <span style={{ color: "var(--ink)" }}>{v}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

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
        {/* Test send · form separado */}
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
            disabled={pending || view !== "editor"}
            className="studio-btn studio-btn-primary"
            title={view !== "editor" ? "Volvé al Editor para guardar" : undefined}
          >
            {editPending ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </footer>
    </DrawerShell>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-fields (controlled)
// ─────────────────────────────────────────────────────────────

function Field({
  label,
  name,
  value,
  onChange,
  error,
  maxLength,
  disabled,
  hint,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
  value,
  onChange,
  error,
  rows,
  disabled,
  hint,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
