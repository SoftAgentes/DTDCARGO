"use client";

/**
 * InviteUserDrawer · form para invitar usuario nuevo.
 * Después del submit exitoso, muestra el link de invitación para copiar
 * al clipboard (hasta SDD-0026 Resend Fase 2 que mande el email automático).
 * SDD-0024 Fase 2.
 */

import { useActionState, useState } from "react";
import { DrawerShell, DrawerFooter } from "@/app/studio/_components/ui/drawer/DrawerShell";
import {
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  STUDIO_USER_ROLES,
  type StudioUserRole,
  type UserActionState,
} from "@/lib/studio/user-types";
import { inviteUserAction } from "../actions";

const INITIAL: UserActionState = {};

interface Props {
  onClose: () => void;
}

export function InviteUserDrawer({ onClose }: Props) {
  const [role, setRole] = useState<StudioUserRole>("operations");
  const [state, formAction, isPending] = useActionState(
    inviteUserAction,
    INITIAL,
  );
  const [copyStatus, setCopyStatus] = useState<"idle" | "ok" | "err">("idle");

  const copyLink = async () => {
    if (!state.invitationLink) return;
    try {
      await navigator.clipboard.writeText(state.invitationLink);
      setCopyStatus("ok");
      window.setTimeout(() => setCopyStatus("idle"), 2000);
    } catch {
      setCopyStatus("err");
      window.setTimeout(() => setCopyStatus("idle"), 2000);
    }
  };

  return (
    <DrawerShell
      title="Invitar usuario"
      subtitle="Vamos a generar un link de invitación que expira en 7 días"
      onClose={onClose}
      pending={isPending}
      width={520}
    >
      {state.ok && state.invitationLink ? (
        <>
          <div
            style={{
              flex: 1,
              overflow: "auto",
              padding: "20px 22px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div
              style={{
                padding: 14,
                background: "var(--success-bg, #E5F4ED)",
                border: "1px solid var(--success, #1F8A5B)",
                borderRadius: 6,
                fontSize: 13,
                color: "var(--ink)",
              }}
            >
              <strong style={{ color: "var(--success, #1F8A5B)" }}>
                Invitación creada
              </strong>
              <p style={{ margin: "4px 0 0", color: "var(--ink-soft)", fontSize: 12 }}>
                Copiá el link y mandáselo a tu invitado por WhatsApp, email o
                como prefieras. Expira en 7 días. (Cuando Resend esté listo,
                el sistema lo manda automático.)
              </p>
            </div>

            <div>
              <span
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--ink-soft)",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Link de invitación
              </span>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "stretch",
                }}
              >
                <input
                  type="text"
                  readOnly
                  value={state.invitationLink}
                  onFocus={(e) => e.target.select()}
                  style={{
                    flex: 1,
                    height: 38,
                    padding: "0 10px",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    background: "var(--bg-elevated)",
                    color: "var(--ink)",
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: 12,
                    outline: "none",
                  }}
                />
                <button
                  type="button"
                  onClick={copyLink}
                  className="studio-btn studio-btn-primary studio-btn-sm"
                  style={{ minWidth: 100 }}
                >
                  {copyStatus === "ok"
                    ? "✓ Copiado"
                    : copyStatus === "err"
                      ? "Error"
                      : "Copiar"}
                </button>
              </div>
            </div>
          </div>
          <footer
            style={{
              padding: "14px 22px",
              borderTop: "1px solid var(--border)",
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              className="studio-btn studio-btn-primary"
              onClick={onClose}
            >
              Cerrar
            </button>
          </footer>
        </>
      ) : (
        <>
          <form
            id="invite-user-form"
            action={formAction}
            style={{
              flex: 1,
              overflow: "auto",
              padding: "20px 22px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <input type="hidden" name="role" value={role} />

            {/* Email */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label
                htmlFor="invite-email"
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--ink-soft)",
                }}
              >
                Email del invitado
              </label>
              <input
                id="invite-email"
                name="email"
                type="email"
                required
                placeholder="maria@dtdcargo.com"
                disabled={isPending}
                style={{
                  width: "100%",
                  height: 38,
                  padding: "0 12px",
                  border: state.fieldErrors?.email
                    ? "1px solid var(--danger, #A8323E)"
                    : "1px solid var(--border)",
                  borderRadius: 6,
                  background: "var(--bg-base)",
                  color: "var(--ink)",
                  fontFamily: "inherit",
                  fontSize: 13,
                  outline: "none",
                }}
              />
              {state.fieldErrors?.email && (
                <span style={{ color: "var(--danger)", fontSize: 12 }}>
                  {state.fieldErrors.email}
                </span>
              )}
            </div>

            {/* Role selector */}
            <fieldset
              style={{
                border: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <legend
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--ink-soft)",
                  marginBottom: 4,
                }}
              >
                Rol
              </legend>
              <div
                role="radiogroup"
                aria-label="Rol del invitado"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                {STUDIO_USER_ROLES.map((r) => (
                  <RoleOption
                    key={r}
                    role={r}
                    active={role === r}
                    onClick={() => setRole(r)}
                  />
                ))}
              </div>
            </fieldset>

            {state.error && (
              <div
                style={{
                  padding: "10px 12px",
                  background: "var(--danger-bg, #FCEDED)",
                  border: "1px solid var(--danger, #A8323E)",
                  borderRadius: 6,
                  color: "var(--danger, #A8323E)",
                  fontSize: 13,
                }}
                role="alert"
              >
                {state.error}
              </div>
            )}
          </form>
          <DrawerFooter
            formId="invite-user-form"
            onClose={onClose}
            isPending={isPending}
            canSubmit={true}
            submitLabel={isPending ? "Generando…" : "Generar link"}
          />
        </>
      )}
    </DrawerShell>
  );
}

function RoleOption({
  role,
  active,
  onClick,
}: {
  role: StudioUserRole;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: "10px 12px",
        border: active
          ? "1px solid var(--wine, #7F0F1A)"
          : "1px solid var(--border)",
        background: active ? "var(--wine-tint, #FBE9EC)" : "var(--bg-surface)",
        borderRadius: 6,
        cursor: "pointer",
        textAlign: "left",
        font: "inherit",
        color: "var(--ink)",
        transition: "all var(--dur, 180ms) var(--ease)",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <span
        style={{
          fontWeight: active ? 700 : 600,
          color: active ? "var(--wine, #7F0F1A)" : "var(--ink)",
          fontSize: 13,
        }}
      >
        {ROLE_LABELS[role]}
      </span>
      <span style={{ color: "var(--ink-soft)", fontSize: 12, lineHeight: 1.4 }}>
        {ROLE_DESCRIPTIONS[role]}
      </span>
    </button>
  );
}
