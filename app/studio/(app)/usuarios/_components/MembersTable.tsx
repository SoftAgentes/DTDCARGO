"use client";

/**
 * MembersTable · tabla de miembros con acciones inline.
 * Acciones por row: cambiar rol (select) · desactivar / reactivar.
 * SDD-0024 Fase 2.
 */

import { useActionState, useState } from "react";
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
  sendAccessLinkAction,
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
  /** Abre la ficha de la persona (SDD-0250). */
  onOpenDetail?: (member: UserMembershipWithProfile) => void;
}

export function MembersTable({ members, currentUserId, onOpenDetail }: Props) {
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
            <Th align="right" sticky>
              Acciones
            </Th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <MemberRow
              key={m.user_id}
              member={m}
              isSelf={m.user_id === currentUserId}
              onOpenDetail={onOpenDetail}
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
  onOpenDetail,
}: {
  member: UserMembershipWithProfile;
  isSelf: boolean;
  onOpenDetail?: (member: UserMembershipWithProfile) => void;
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
  const [accessState, accessAction, accessPending] = useActionState(
    sendAccessLinkAction,
    INITIAL,
  );
  const [copied, setCopied] = useState(false);

  const status = memberStatus(member);
  const tone = roleBadgeTone(member.role);
  const statusTone = status === "active" ? "success" : "neutral";
  const anyPending =
    rolePending || disablePending || enablePending || scopePending || accessPending;
  const lastError =
    roleState.error ||
    disableState.error ||
    enableState.error ||
    scopeState.error ||
    accessState.error;
  const memberScope = member.warehouse_scope ?? "all";
  // Quien nunca entró no tiene forma de saber su clave: el alta del 3-jul les
  // puso una que nadie les pasó. Señalarlo evita que el admin tenga que
  // deducirlo de la columna "Último login".
  const neverLoggedIn = !member.last_login_at;

  return (
    <tr style={{ borderTop: "1px solid var(--border)" }}>
      <Td>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar
            initials={userInitials(member.profile, member.email)}
            tone={tone}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {/* Sólo el nombre abre la ficha, no la fila entera: la fila tiene
                selects y formularios que se comerían el clic. */}
            {onOpenDetail ? (
              <button
                type="button"
                onClick={() => onOpenDetail(member)}
                title="Ver la ficha de esta persona"
                style={{
                  background: "transparent",
                  border: 0,
                  padding: 0,
                  textAlign: "left",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                  fontFamily: "inherit",
                  color: "var(--ink)",
                  textDecoration: "underline",
                  textDecorationColor: "var(--border)",
                  textUnderlineOffset: 3,
                }}
              >
                {userDisplayName(member.profile, member.email)}
              </button>
            ) : (
              <span style={{ fontWeight: 600, color: "var(--ink)" }}>
                {userDisplayName(member.profile, member.email)}
              </span>
            )}
            {member.profile?.position_label && (
              <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>
                {member.profile.position_label}
              </span>
            )}
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
              padding: "0 var(--s-2)",
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
          <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>Todos</span>
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
                padding: "0 var(--s-2)",
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

      <Td align="right" sticky>
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
          {status === "active" && (
            <form action={accessAction} style={{ display: "inline" }}>
              <input type="hidden" name="target_user_id" value={member.user_id} />
              <button
                type="submit"
                disabled={anyPending}
                className={`studio-btn studio-btn-xs ${
                  neverLoggedIn ? "studio-btn-primary" : "studio-btn-ghost"
                }`}
                title="Le manda por correo un enlace para que cree su contraseña"
              >
                {accessPending ? "…" : "Enviar acceso"}
              </button>
            </form>
          )}
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
        {/* Rastro persistente (no un toast): el admin necesita PODER COPIAR el
            enlace si el correo no llega, así que se queda en pantalla. */}
        {accessState.ok && accessState.accessLink && (
          <div
            style={{
              marginTop: 6,
              padding: "6px 8px",
              background: "var(--success-bg, #E5F4ED)",
              borderRadius: 4,
              textAlign: "left",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--success, #1F8A5B)",
                marginBottom: 4,
              }}
            >
              Enlace enviado a {member.email}
            </div>
            <button
              type="button"
              className="studio-btn studio-btn-ghost studio-btn-xs"
              onClick={() => {
                void navigator.clipboard
                  .writeText(accessState.accessLink as string)
                  .then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2500);
                  });
              }}
              title="Por si el correo no llega — pásaselo por un canal privado"
            >
              {copied ? "Copiado" : "Copiar enlace"}
            </button>
          </div>
        )}
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

/**
 * `sticky` fija la columna al borde derecho mientras la tabla scrollea en
 * horizontal. La tabla tiene 7 columnas y el contenedor `overflow: auto`: en
 * pantallas angostas la columna de Acciones quedaba FUERA DE VISTA, y con ella
 * los únicos botones de la fila — se reportó como "no puedo desactivar a este
 * usuario" (2026-08-06). El fondo es obligatorio: sin él, el contenido de las
 * otras columnas se ve por debajo al pasar.
 */
function Th({
  children,
  align,
  sticky,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  sticky?: boolean;
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
        ...(sticky
          ? {
              position: "sticky" as const,
              right: 0,
              background: "var(--bg-elevated, #F2F0EC)",
              borderLeft: "1px solid var(--border, #E8E6E2)",
            }
          : null),
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  sticky,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  sticky?: boolean;
}) {
  return (
    <td
      style={{
        padding: "10px 12px",
        verticalAlign: "middle",
        textAlign: align ?? "left",
        ...(sticky
          ? {
              position: "sticky" as const,
              right: 0,
              background: "var(--bg-surface, #FFFFFF)",
              borderLeft: "1px solid var(--border, #E8E6E2)",
            }
          : null),
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
        padding: "0 var(--s-2)",
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
