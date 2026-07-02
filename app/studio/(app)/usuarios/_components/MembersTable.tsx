"use client";

/**
 * MembersTable · tabla de miembros con acciones inline.
 * Acciones por row: cambiar rol (select) · desactivar / reactivar.
 * SDD-0024 Fase 2.
 */

import { useActionState } from "react";
import {
  ROLE_LABELS,
  STUDIO_USER_ROLES,
  WAREHOUSE_SCOPES,
  WAREHOUSE_SCOPE_LABELS,
  formatLastLogin,
  memberStatus,
  memberStatusLabel,
  roleBadgeTone,
  userDisplayName,
  userInitials,
  type StudioUserRole,
  type UserActionState,
  type UserMembershipWithProfile,
} from "@/lib/studio/user-types";
import {
  changeUserRoleAction,
  changeWarehouseScopeAction,
  disableUserAction,
  enableUserAction,
} from "../actions";

/**
 * Roles con lado de almacén asignable (Norte users.jsx: needsScope). Para el
 * resto el scope no aplica (sus módulos no tienen lado geográfico) → "—".
 */
const SCOPED_ROLES: ReadonlySet<StudioUserRole> = new Set([
  "operations",
  "warehouse",
  "support",
]);

const INITIAL: UserActionState = {};

const TONE_BG: Record<string, string> = {
  success: "var(--success-bg, #E5F4ED)",
  warning: "var(--warning-bg, #FBF1DF)",
  danger: "var(--danger-bg, #FCEDED)",
  info: "var(--info-bg, #E5EEF9)",
  wine: "var(--wine-tint, #FBE9EC)",
  neutral: "var(--neutral-bg, #F2F0EC)",
};

const TONE_FG: Record<string, string> = {
  success: "var(--success, #1F8A5B)",
  warning: "var(--warning, #B8893A)",
  danger: "var(--danger, #A8323E)",
  info: "var(--info, #2A6FDB)",
  wine: "var(--wine, #7F0F1A)",
  neutral: "var(--ink-soft, #6B6B6B)",
};

interface Props {
  members: UserMembershipWithProfile[];
  currentUserId: string;
}

export function MembersTable({ members, currentUserId }: Props) {
  if (members.length === 0) {
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
        Sin miembros que mostrar.
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
            <Th>Usuario</Th>
            <Th>Email</Th>
            <Th>Rol</Th>
            <Th>Almacén</Th>
            <Th>Estado</Th>
            <Th>Último login</Th>
            <Th align="right">Acciones</Th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <MemberRow
              key={m.user_id}
              member={m}
              isSelf={m.user_id === currentUserId}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Row (con server actions por row)
// ─────────────────────────────────────────────────────────────

function MemberRow({
  member,
  isSelf,
}: {
  member: UserMembershipWithProfile;
  isSelf: boolean;
}) {
  const [roleState, roleAction, rolePending] = useActionState(
    changeUserRoleAction,
    INITIAL,
  );
  const [disableState, disableAction, disablePending] = useActionState(
    disableUserAction,
    INITIAL,
  );
  const [enableState, enableAction, enablePending] = useActionState(
    enableUserAction,
    INITIAL,
  );
  const [scopeState, scopeAction, scopePending] = useActionState(
    changeWarehouseScopeAction,
    INITIAL,
  );

  const status = memberStatus(member);
  const tone = roleBadgeTone(member.role);
  const statusTone = status === "active" ? "success" : "neutral";
  const anyPending = rolePending || disablePending || enablePending || scopePending;
  const lastError =
    roleState.error || disableState.error || enableState.error || scopeState.error;
  const memberScope = member.warehouse_scope ?? "all";

  return (
    <tr style={{ borderTop: "1px solid var(--border)" }}>
      <Td>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar
            initials={userInitials(member.profile, member.email)}
            tone={tone}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontWeight: 600, color: "var(--ink)" }}>
              {userDisplayName(member.profile, member.email)}
            </span>
            {isSelf && (
              <span style={{ fontSize: 10, color: "var(--ink-soft)" }}>
                (tú)
              </span>
            )}
          </div>
        </div>
      </Td>

      <Td>
        <span
          style={{
            color: "var(--ink-soft)",
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 12,
          }}
        >
          {member.email}
        </span>
      </Td>

      <Td>
        <form
          action={roleAction}
          style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
        >
          <input type="hidden" name="target_user_id" value={member.user_id} />
          <Pill bg={TONE_BG[tone]} fg={TONE_FG[tone]}>
            {ROLE_LABELS[member.role]}
          </Pill>
          <select
            name="new_role"
            defaultValue={member.role}
            disabled={anyPending}
            aria-label="Rol asignado"
            onChange={(e) => {
              // Auto-submit al cambiar
              const f = e.target.form;
              if (f && e.target.value !== member.role) f.requestSubmit();
            }}
            style={{
              height: 28,
              padding: "0 8px",
              border: "1px solid var(--border)",
              borderRadius: 4,
              background: "var(--bg-surface)",
              color: "var(--ink)",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {STUDIO_USER_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </form>
      </Td>

      <Td>
        {member.role === "admin" ? (
          <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>Todos</span>
        ) : SCOPED_ROLES.has(member.role) ? (
          <form action={scopeAction} style={{ display: "inline-flex" }}>
            <input type="hidden" name="target_user_id" value={member.user_id} />
            <select
              name="new_scope"
              defaultValue={memberScope}
              disabled={anyPending}
              aria-label="Almacén asignado"
              title="Lado de la operación que ve este usuario (módulos de almacén)"
              onChange={(e) => {
                const f = e.target.form;
                if (f && e.target.value !== memberScope) f.requestSubmit();
              }}
              style={{
                height: 28,
                padding: "0 8px",
                border: "1px solid var(--border)",
                borderRadius: 4,
                background: "var(--bg-surface)",
                color: "var(--ink)",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {WAREHOUSE_SCOPES.map((s) => (
                <option key={s} value={s}>
                  {WAREHOUSE_SCOPE_LABELS[s]}
                </option>
              ))}
            </select>
          </form>
        ) : (
          <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>—</span>
        )}
      </Td>

      <Td>
        <Pill bg={TONE_BG[statusTone]} fg={TONE_FG[statusTone]}>
          {memberStatusLabel(status)}
        </Pill>
      </Td>

      <Td>
        <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>
          {formatLastLogin(member.last_login_at)}
        </span>
      </Td>

      <Td align="right">
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
          {status === "active" ? (
            <form action={disableAction} style={{ display: "inline" }}>
              <input type="hidden" name="target_user_id" value={member.user_id} />
              <button
                type="submit"
                disabled={anyPending}
                className="studio-btn studio-btn-ghost studio-btn-xs"
                title="Desactivar este usuario"
              >
                {disablePending ? "…" : "Desactivar"}
              </button>
            </form>
          ) : (
            <form action={enableAction} style={{ display: "inline" }}>
              <input type="hidden" name="target_user_id" value={member.user_id} />
              <button
                type="submit"
                disabled={anyPending}
                className="studio-btn studio-btn-ghost studio-btn-xs"
                title="Reactivar este usuario"
              >
                {enablePending ? "…" : "Reactivar"}
              </button>
            </form>
          )}
        </div>
        {lastError && (
          <div
            style={{
              fontSize: 11,
              color: "var(--danger)",
              marginTop: 4,
              textAlign: "right",
            }}
          >
            {lastError}
          </div>
        )}
      </Td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

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

function Avatar({
  initials,
  tone = "wine",
}: {
  initials: string;
  tone?: string;
}) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        background: TONE_BG[tone] ?? TONE_BG.wine,
        color: TONE_FG[tone] ?? TONE_FG.wine,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 11,
        fontWeight: 700,
        fontFamily: "var(--font-archivo-black, 'Archivo Black')",
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}
