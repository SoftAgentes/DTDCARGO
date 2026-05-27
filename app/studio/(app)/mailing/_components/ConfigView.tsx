"use client";

/**
 * ConfigView · editor de mail_config del tenant (SDD-0026 Fase 3d).
 *
 * Form para cambiar from_email/name, reply_to, internal_test_email, y
 * toggle test_mode. domain_verified es read-only (lo flippea el setup
 * post-verify DNS, no debería editarse a mano).
 */

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import {
  INITIAL_MAILING_STATE,
  updateMailConfigAction,
} from "../actions";
import type { MailConfigRow } from "./mailing-types";

interface Props {
  config: MailConfigRow | null;
}

export function ConfigView({ config }: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    updateMailConfigAction,
    INITIAL_MAILING_STATE,
  );

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  if (!config) {
    return (
      <EmptyState
        eyebrow="Sin config"
        title="No hay mail_config para este tenant"
        description="Pediles a un dev que corra la migración de seed. La config se crea con un row default por tenant."
      />
    );
  }

  return (
    <div style={{ maxWidth: 720 }}>
      {/* Status banner: domain_verified + test_mode */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <StatusPill
          label="Dominio Resend"
          status={config.domain_verified ? "verified" : "pending"}
          okLabel="Verificado"
          warnLabel="Pendiente verificar"
        />
        <StatusPill
          label="Test mode"
          status={config.test_mode ? "warn" : "ok"}
          okLabel="OFF · emails REALES a clientes"
          warnLabel="ON · todos redirigidos a internal_test_email"
        />
      </div>

      <form
        action={formAction}
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <Field
          label="From email"
          name="from_email"
          type="email"
          defaultValue={config.from_email}
          error={state.fieldErrors?.from_email}
          disabled={pending}
          hint="El From visible en los emails enviados. Ej: noreply@dtdcargo.com. Debe ser de un dominio Resend verificado."
        />

        <Field
          label="From name"
          name="from_name"
          type="text"
          defaultValue={config.from_name}
          error={state.fieldErrors?.from_name}
          disabled={pending}
          hint="Nombre visible junto al From. Ej: DTD-Cargo."
        />

        <Field
          label="Reply-to"
          name="reply_to"
          type="email"
          defaultValue={config.reply_to ?? ""}
          error={state.fieldErrors?.reply_to}
          disabled={pending}
          hint="A dónde llegan las respuestas. Ideal: un inbox real que monitoreás (ej: vzla@dtdcargo.com). Opcional."
        />

        <Field
          label="Internal test email"
          name="internal_test_email"
          type="email"
          defaultValue={config.internal_test_email ?? ""}
          error={state.fieldErrors?.internal_test_email}
          disabled={pending}
          hint="Cuando test_mode está activo, TODOS los emails se redirigen acá (no se mandan al destinatario real). Útil para no spamear clientes mientras se valida el setup."
        />

        <div
          style={{
            padding: "14px 16px",
            background: config.test_mode
              ? "var(--warning-bg, #FBF1DF)"
              : "var(--success-bg, #E5F4ED)",
            border: `1px solid ${
              config.test_mode
                ? "var(--warning, #B8893A)"
                : "var(--success, #1F8A5B)"
            }`,
            borderRadius: 8,
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
              fontSize: 13,
              color: "var(--ink)",
              fontWeight: 600,
            }}
          >
            <input
              type="checkbox"
              name="test_mode"
              defaultChecked={config.test_mode}
              disabled={pending}
            />
            Test mode activo
          </label>
          <p
            style={{
              margin: "8px 0 0 24px",
              fontSize: 12,
              color: "var(--ink-soft)",
              lineHeight: 1.5,
            }}
          >
            {config.test_mode ? (
              <>
                <strong style={{ color: "var(--warning, #B8893A)" }}>
                  ACTIVADO:
                </strong>{" "}
                todos los emails (invitaciones, bug notif, futuros) se redirigen
                a <code>{config.internal_test_email || "(falta configurar)"}</code>.
                Ningún cliente real recibe. Desactivá cuando estés listo para
                producción real.
              </>
            ) : (
              <>
                <strong style={{ color: "var(--success, #1F8A5B)" }}>
                  DESACTIVADO:
                </strong>{" "}
                los emails van al destinatario real. Asegurate que los templates
                están bien y los disparos están testeados antes de habilitar.
              </>
            )}
          </p>
        </div>

        {state.error && (
          <div
            role="alert"
            style={{
              padding: "10px 12px",
              background: "var(--danger-bg, #FCEDED)",
              border: "1px solid var(--danger)",
              borderRadius: 6,
              color: "var(--danger)",
              fontSize: 13,
            }}
          >
            {state.error}
          </div>
        )}
        {state.ok && state.message && (
          <div
            role="status"
            style={{
              padding: "10px 12px",
              background: "var(--success-bg, #E5F4ED)",
              border: "1px solid var(--success)",
              borderRadius: 6,
              color: "var(--success)",
              fontSize: 13,
            }}
          >
            ✓ {state.message}
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            paddingTop: 8,
            borderTop: "1px solid var(--border)",
            marginTop: 8,
          }}
        >
          <button
            type="submit"
            disabled={pending}
            className="studio-btn studio-btn-primary"
          >
            {pending ? "Guardando…" : "Guardar config"}
          </button>
        </div>
      </form>

      <div
        style={{
          marginTop: 12,
          fontSize: 11,
          color: "var(--ink-soft)",
          textAlign: "right",
        }}
      >
        Última actualización:{" "}
        {new Date(config.updated_at).toLocaleString("es-VE")}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function StatusPill({
  label,
  status,
  okLabel,
  warnLabel,
}: {
  label: string;
  status: "verified" | "pending" | "ok" | "warn";
  okLabel: string;
  warnLabel: string;
}) {
  const isOk = status === "verified" || status === "ok";
  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        padding: "10px 14px",
        background: isOk
          ? "var(--success-bg, #E5F4ED)"
          : "var(--warning-bg, #FBF1DF)",
        border: `1px solid ${
          isOk ? "var(--success, #1F8A5B)" : "var(--warning, #B8893A)"
        }`,
        borderRadius: 8,
        gap: 2,
        minWidth: 220,
      }}
    >
      <span
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--ink-soft)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: isOk
            ? "var(--success, #1F8A5B)"
            : "var(--warning, #B8893A)",
        }}
      >
        {isOk ? okLabel : warnLabel}
      </span>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  error,
  disabled,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  error?: string;
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
        type={type}
        defaultValue={defaultValue}
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
        <span style={{ fontSize: 11, color: "var(--ink-soft)", lineHeight: 1.4 }}>
          {hint}
        </span>
      )}
      {error && (
        <span style={{ fontSize: 11, color: "var(--danger)" }}>{error}</span>
      )}
    </label>
  );
}
