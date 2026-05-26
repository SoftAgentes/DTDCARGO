"use client";

/**
 * InvitationsTable · tabla de invitaciones con copy-link y revoke inline.
 * Hasta SDD-0026 Resend Fase 2, los emails NO se mandan automatic — el
 * admin copia el link y se lo manda a mano al invitado.
 * SDD-0024 Fase 2.
 */

import { useActionState, useState } from "react";
import {
  INVITATION_STATUS_LABELS,
  ROLE_LABELS,
  invitationStatus,
  invitationStatusBadgeTone,
  invitationAcceptPath,
  type UserActionState,
  type UserInvitation,
} from "@/lib/studio/user-types";
import { revokeInvitationAction } from "../actions";

const INITIAL: UserActionState = {};
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const TONE_BG: Record<string, string> = {
  success: "var(--success-bg, #E5F4ED)",
  warning: "var(--warning-bg, #FBF1DF)",
  neutral: "var(--neutral-bg, #F2F0EC)",
};

const TONE_FG: Record<string, string> = {
  success: "var(--success, #1F8A5B)",
  warning: "var(--warning, #B8893A)",
  neutral: "var(--ink-soft, #6B6B6B)",
};

interface Props {
  invitations: UserInvitation[];
}

export function InvitationsTable({ invitations }: Props) {
  if (invitations.length === 0) {
    return (
      <div
        style={{
          padding: 32,
          textAlign: "center",
          color: "var(--ink-soft)",
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
        }}
      >
        Sin invitaciones todavía. Click en{" "}
        <strong style={{ color: "var(--ink)" }}>+ Invitar usuario</strong> arriba
        para crear la primera.
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--bg-surface, #FFFFFF)",
        border: "1px solid var(--border, #E8E6E2)",
        borderRadius: 8,
        overflow: "auto",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "var(--bg-elevated, #F2F0EC)" }}>
            <Th>Email</Th>
            <Th>Rol</Th>
            <Th>Estado</Th>
            <Th>Expira</Th>
            <Th>Creada</Th>
            <Th align="right">Acciones</Th>
          </tr>
        </thead>
        <tbody>
          {invitations.map((inv) => (
            <InvitationRow key={inv.id} invitation={inv} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InvitationRow({ invitation }: { invitation: UserInvitation }) {
  const [revState, revAction, revPending] = useActionState(
    revokeInvitationAction,
    INITIAL,
  );
  const [copyStatus, setCopyStatus] = useState<"idle" | "ok" | "err">("idle");

  const status = invitationStatus(invitation);
  const tone = invitationStatusBadgeTone(status);
  const link = `${SITE_URL}${invitationAcceptPath(invitation.token)}`;
  const canRevoke = status === "pending";
  const canCopy = status === "pending";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopyStatus("ok");
      window.setTimeout(() => setCopyStatus("idle"), 2000);
    } catch {
      setCopyStatus("err");
      window.setTimeout(() => setCopyStatus("idle"), 2000);
    }
  };

  return (
    <tr style={{ borderTop: "1px solid var(--border)" }}>
      <Td>
        <span
          style={{
            color: "var(--ink)",
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 12,
          }}
        >
          {invitation.email}
        </span>
      </Td>
      <Td>
        <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>
          {ROLE_LABELS[invitation.role]}
        </span>
      </Td>
      <Td>
        <Pill bg={TONE_BG[tone]} fg={TONE_FG[tone]}>
          {INVITATION_STATUS_LABELS[status]}
        </Pill>
      </Td>
      <Td>
        <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>
          {formatExpiry(invitation.expires_at)}
        </span>
      </Td>
      <Td>
        <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>
          {formatDate(invitation.created_at)}
        </span>
      </Td>
      <Td align="right">
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
          {canCopy && (
            <button
              type="button"
              onClick={copyLink}
              className="studio-btn studio-btn-ghost studio-btn-xs"
              title="Copiar link de invitación al clipboard"
            >
              {copyStatus === "ok"
                ? "✓ Copiado"
                : copyStatus === "err"
                  ? "Error"
                  : "Copiar link"}
            </button>
          )}
          {canRevoke && (
            <form action={revAction} style={{ display: "inline" }}>
              <input type="hidden" name="invitation_id" value={invitation.id} />
              <button
                type="submit"
                disabled={revPending}
                className="studio-btn studio-btn-ghost studio-btn-xs"
                title="Revocar esta invitación"
              >
                {revPending ? "…" : "Revocar"}
              </button>
            </form>
          )}
        </div>
        {revState.error && (
          <div
            style={{
              fontSize: 11,
              color: "var(--danger)",
              marginTop: 4,
              textAlign: "right",
            }}
          >
            {revState.error}
          </div>
        )}
      </Td>
    </tr>
  );
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      style={{
        padding: "10px 12px",
        textAlign: align ?? "left",
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color: "var(--ink-soft)",
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <td
      style={{
        padding: "10px 12px",
        verticalAlign: "middle",
        textAlign: align ?? "left",
      }}
    >
      {children}
    </td>
  );
}

function Pill({
  bg,
  fg,
  children,
}: {
  bg: string;
  fg: string;
  children: React.ReactNode;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 20,
        padding: "0 8px",
        background: bg,
        color: fg,
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function formatExpiry(iso: string): string {
  const date = new Date(iso);
  const diffMs = date.getTime() - Date.now();
  if (diffMs < 0) return "Expirada";
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days === 0) return "Hoy";
  if (days === 1) return "En 1 día";
  return `En ${days} días`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}
