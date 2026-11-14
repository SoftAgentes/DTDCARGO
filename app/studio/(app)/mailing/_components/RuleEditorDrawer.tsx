"use client";

/**
 * RuleEditorDrawer · crear/editar mail_rule (SDD-0026 Fase 3c).
 *
 * Form fields: event (select), template_id (select), recipient_kind (select),
 * recipient_value (input, solo si kind=custom), active (checkbox).
 *
 * En modo edit, también ofrece Delete con confirm.
 */

import { useActionState, useEffect, useState, useTransition } from "react";
import { DrawerShell } from "@/app/studio/_components/ui/drawer/DrawerShell";
import { ConfirmDialog } from "@/app/studio/_components/ui/ConfirmDialog";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import {
  createMailRuleAction,
  deleteMailRuleAction,
  updateMailRuleAction,
} from "../actions";
import { INITIAL_MAILING_STATE } from "./mailing-types";
import {
  MAIL_RULE_EVENTS,
  RULE_EVENT_LABELS,
  type MailRecipientKind,
  type MailRuleWithTemplate,
  type MailTemplate,
} from "@/lib/studio/mail-types";

type Mode = "create" | "edit";

interface Props {
  mode: Mode;
  rule?: MailRuleWithTemplate;
  templates: MailTemplate[];
  onClose: () => void;
  onMutated: () => void;
}

const RECIPIENT_KINDS: Array<{ value: MailRecipientKind; label: string }> = [
  { value: "client", label: "Cliente del evento (resolver dinámico)" },
  { value: "internal", label: "Email interno (mail_config.internal_test_email)" },
  { value: "custom", label: "Email custom (especificar abajo)" },
];

export function RuleEditorDrawer({
  mode,
  rule,
  templates,
  onClose,
  onMutated,
}: Props) {
  const action = mode === "create" ? createMailRuleAction : updateMailRuleAction;
  const [state, formAction, pending] = useActionState(
    action,
    INITIAL_MAILING_STATE,
  );
  const [deleteState, deleteFormAction, deletePending] = useActionState(
    deleteMailRuleAction,
    INITIAL_MAILING_STATE,
  );

  const [recipientKind, setRecipientKind] = useState<MailRecipientKind>(
    rule?.recipient_kind ?? "internal",
  );
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [, startDeleteTransition] = useTransition();

  useEffect(() => {
    if (state.ok || deleteState.ok) {
      onMutated();
      onClose();
    }
  }, [state.ok, deleteState.ok, onMutated, onClose]);

  const isPending = pending || deletePending;

  return (
    <DrawerShell
      title={mode === "create" ? "Nueva regla" : "Editar regla"}
      subtitle={mode === "edit" ? `Disparos: ${rule?.trigger_count ?? 0}` : undefined}
      onClose={onClose}
      pending={isPending}
      width={580}
    >
      <form
        id="rule-form"
        action={formAction}
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {mode === "edit" && rule && (
          <input type="hidden" name="id" value={rule.id} />
        )}

        <SelectField
          label="Evento que dispara"
          name="event"
          defaultValue={rule?.event ?? MAIL_RULE_EVENTS[0]}
          error={state.fieldErrors?.event}
          disabled={isPending}
          options={MAIL_RULE_EVENTS.map((e) => ({
            value: e,
            label: RULE_EVENT_LABELS[e],
          }))}
        />

        <SelectField
          label="Template a enviar"
          name="template_id"
          defaultValue={rule?.template_id ?? ""}
          error={state.fieldErrors?.template_id}
          disabled={isPending}
          options={[
            { value: "", label: "— Elige template —" },
            ...templates
              .filter((t) => t.active)
              .map((t) => ({ value: t.id, label: `${t.name} (${t.slug})` })),
          ]}
        />

        <SelectField
          label="Destinatario"
          name="recipient_kind"
          defaultValue={recipientKind}
          error={state.fieldErrors?.recipient_kind}
          disabled={isPending}
          options={RECIPIENT_KINDS}
          onChange={(v) => setRecipientKind(v as MailRecipientKind)}
        />

        {recipientKind === "custom" && (
          <Field
            label="Email custom"
            name="recipient_value"
            type="email"
            defaultValue={rule?.recipient_value ?? ""}
            error={state.fieldErrors?.recipient_value}
            disabled={isPending}
            placeholder="ej: alertas@dtdcargo.com"
          />
        )}

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
            defaultChecked={rule?.active ?? true}
            disabled={isPending}
          />
          Regla activa (se dispara al evento)
        </label>

        {state.error && (
          <Aviso tono="error" compacto>
            {state.error}
          </Aviso>
        )}
        {deleteState.error && (
          <Aviso tono="error" compacto>
            {deleteState.error}
          </Aviso>
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
        {mode === "edit" && rule ? (
          <div>
            <button
              type="button"
              disabled={isPending}
              className="studio-btn studio-btn-danger studio-btn-sm"
              onClick={() => setDeleteConfirmOpen(true)}
            >
              {deletePending ? "Borrando…" : "Borrar regla"}
            </button>
          </div>
        ) : (
          <div />
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="studio-btn studio-btn-ghost"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="rule-form"
            disabled={isPending}
            className="studio-btn studio-btn-primary"
          >
            {pending
              ? mode === "create"
                ? "Creando…"
                : "Guardando…"
              : mode === "create"
                ? "Crear regla"
                : "Guardar cambios"}
          </button>
        </div>
      </footer>
      {mode === "edit" && rule && (
        <ConfirmDialog
          open={deleteConfirmOpen}
          danger
          pending={deletePending}
          title="Borrar regla de correo"
          message="La regla se eliminará definitivamente y dejará de disparar correos."
          confirmLabel="Borrar regla"
          error={deleteState.error}
          onCancel={() => setDeleteConfirmOpen(false)}
          onConfirm={() => {
            const data = new FormData();
            data.set("id", rule.id);
            startDeleteTransition(() => deleteFormAction(data));
          }}
        />
      )}
    </DrawerShell>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-fields
// ─────────────────────────────────────────────────────────────

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  error,
  disabled,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
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
        type={type}
        defaultValue={defaultValue}
        disabled={disabled}
        placeholder={placeholder}
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
      {error && (
        <span style={{ fontSize: 11, color: "var(--danger)" }}>{error}</span>
      )}
    </label>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  error,
  disabled,
  options,
  onChange,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  error?: string;
  disabled?: boolean;
  options: Array<{ value: string; label: string }>;
  onChange?: (value: string) => void;
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
      <select
        name={name}
        defaultValue={defaultValue}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
        style={{
          height: 38,
          padding: "0 12px",
          border: `1px solid ${error ? "var(--danger)" : "var(--border)"}`,
          borderRadius: 6,
          background: "var(--bg-base)",
          color: "var(--ink)",
          fontFamily: "inherit",
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <span style={{ fontSize: 11, color: "var(--danger)" }}>{error}</span>
      )}
    </label>
  );
}
