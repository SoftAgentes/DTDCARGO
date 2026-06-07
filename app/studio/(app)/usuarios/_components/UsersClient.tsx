"use client";

/**
 * UsersClient · módulo Usuarios & Roles (SDD-0024 Fase A — design v1.3.1).
 *
 * Layout siguiendo Claude Design:
 *   1. Card "ROLES Y PERMISOS" grid 3×2 (counts dinámicos + perms description)
 *   2. Toolbar (rol filter + estado filter + search)
 *   3. Tabla de miembros (avatars tonales por rol)
 *   4. Disclosure colapsable "Invitaciones pendientes (N)" abajo
 *   5. Modal "Permisos por rol" (matriz read-only) accesible desde botón en page header
 *
 * Tabs Miembros/Invitaciones eliminadas (design las descarta).
 * KPI cards horizontales eliminadas (counts viven en card de roles ahora).
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { InviteUserDrawer } from "./InviteUserDrawer";
import { MembersTable } from "./MembersTable";
import { InvitationsTable } from "./InvitationsTable";
import {
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  STUDIO_USER_ROLES,
  roleBadgeTone,
  type StudioUserRole,
  type UserInvitation,
  type UserMembershipWithProfile,
} from "@/lib/studio/user-types";

interface Props {
  members: UserMembershipWithProfile[];
  invitations: UserInvitation[];
  currentUserId: string;
}

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

export function UsersClient({ members, invitations, currentUserId }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [permsModalOpen, setPermsModalOpen] = useState(false);
  const [showInvitations, setShowInvitations] = useState(false);
  const [roleFilter, setRoleFilter] = useState<StudioUserRole | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "disabled">(
    "all",
  );
  const [search, setSearch] = useState("");

  // Counts por rol (solo activos)
  const roleCounts = STUDIO_USER_ROLES.reduce<Record<StudioUserRole, number>>(
    (acc, r) => {
      acc[r] = members.filter((m) => m.role === r && !m.disabled_at).length;
      return acc;
    },
    {
      admin: 0,
      commercial: 0,
      operations: 0,
      accounting: 0,
      warehouse: 0,
      support: 0,
    },
  );

  const pendingInvitations = invitations.filter(
    (i) => !i.accepted_at && !i.revoked_at && new Date(i.expires_at) > new Date(),
  );

  // Filtro client-side (volúmenes < 200 usuarios por tenant V1)
  const filteredMembers = members.filter((m) => {
    if (roleFilter !== "all" && m.role !== roleFilter) return false;
    if (statusFilter === "active" && m.disabled_at) return false;
    if (statusFilter === "disabled" && !m.disabled_at) return false;
    if (search) {
      const q = search.trim().toLowerCase();
      const name = `${m.profile?.first_name ?? ""} ${m.profile?.last_name ?? ""}`.toLowerCase();
      if (!name.includes(q) && !m.email.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <>
      {/* ─── Card ROLES Y PERMISOS ─── */}
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
          className="studio-eyebrow"
          style={{
            color: "var(--wine)",
            marginBottom: 14,
          }}
        >
          Roles y permisos
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 12,
          }}
        >
          {STUDIO_USER_ROLES.map((r) => {
            const tone = roleBadgeTone(r);
            return (
              <div
                key={r}
                style={{
                  padding: 14,
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <Pill bg={TONE_BG[tone]} fg={TONE_FG[tone]}>
                    {ROLE_LABELS[r]}
                  </Pill>
                  <span
                    style={{
                      font: "700 12.5px/1 var(--font-mono, 'JetBrains Mono')",
                      color: "var(--ink)",
                    }}
                  >
                    {roleCounts[r]}
                  </span>
                </div>
                <div
                  style={{
                    font: "500 12px/1.4 var(--font-sans, 'Archivo')",
                    color: "var(--ink-soft)",
                  }}
                >
                  {ROLE_DESCRIPTIONS[r]}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── Toolbar: filtros + search ─── */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
          alignItems: "flex-end",
        }}
      >
        <FilterSelect
          label="Rol"
          value={roleFilter}
          onChange={(v) => setRoleFilter(v as StudioUserRole | "all")}
          options={[
            { value: "all", label: "Todos los roles" },
            ...STUDIO_USER_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] })),
          ]}
        />
        <FilterSelect
          label="Estado"
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as "all" | "active" | "disabled")}
          options={[
            { value: "all", label: "Todos" },
            { value: "active", label: "Activos" },
            { value: "disabled", label: "Desactivados" },
          ]}
        />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nombre o email…"
        />
      </div>

      {/* ─── Tabla de miembros ─── */}
      <MembersTable members={filteredMembers} currentUserId={currentUserId} />

      {/* ─── Disclosure: Invitaciones pendientes ─── */}
      <section style={{ marginTop: 28 }}>
        <button
          type="button"
          onClick={() => setShowInvitations((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "transparent",
            border: "none",
            color: "var(--ink)",
            font: "600 13px/1.2 var(--font-sans, 'Archivo')",
            cursor: "pointer",
            padding: "8px 0",
          }}
        >
          <span
            style={{
              display: "inline-block",
              transform: showInvitations ? "rotate(90deg)" : "rotate(0)",
              transition: "transform var(--dur, 180ms)",
              fontSize: 10,
              color: "var(--ink-soft)",
            }}
          >
            ▶
          </span>
          Invitaciones ({invitations.length}
          {pendingInvitations.length > 0 && (
            <>
              {" · "}
              <span style={{ color: "var(--wine)" }}>
                {pendingInvitations.length} pendientes
              </span>
            </>
          )}
          )
        </button>
        {showInvitations && (
          <div style={{ marginTop: 12 }}>
            <InvitationsTable invitations={invitations} />
          </div>
        )}
      </section>

      {/* ─── Drawer Invitar ─── */}
      {drawerOpen && <InviteUserDrawer onClose={() => setDrawerOpen(false)} />}

      {/* ─── Modal Permisos por rol (read-only) ─── */}
      {permsModalOpen && (
        <PermissionsByRoleModal onClose={() => setPermsModalOpen(false)} />
      )}

      {/* Top-right action buttons get rendered into a portal-style fixed div
          via the page header. Acá expongo helpers para que el page header los
          dispare via window events o props. Simplificación: el page header
          ya tiene el botón Invitar; el botón "Permisos por rol" lo agrego
          inline en la card de arriba mejor. Re-implementar el sistema de
          actions del PageHeader es overkill para Fase A. */}
      <PageActionsHelper
        onOpenDrawer={() => setDrawerOpen(true)}
        onOpenPermsModal={() => setPermsModalOpen(true)}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// PageActionsHelper — expone botones globalmente sin tocar layout
// ─────────────────────────────────────────────────────────────

function PageActionsHelper({
  onOpenDrawer,
  onOpenPermsModal,
}: {
  onOpenDrawer: () => void;
  onOpenPermsModal: () => void;
}) {
  // El page server-component renderiza un slot con id="users-page-actions".
  // Acá hidratamos los botones dentro de ese slot con createPortal.
  const [target, setTarget] = useState<Element | null>(null);

  useEffect(() => {
    const el = document.getElementById("users-page-actions");
    if (el) setTarget(el);
  }, []);

  if (!target) return null;

  return createPortal(
    <>
      <button
        type="button"
        onClick={onOpenPermsModal}
        className="studio-btn studio-btn-ghost"
      >
        Permisos por rol
      </button>
      <button
        type="button"
        onClick={onOpenDrawer}
        className="studio-btn studio-btn-primary"
      >
        + Invitar usuario
      </button>
    </>,
    target,
  );
}

// ─────────────────────────────────────────────────────────────
// Modal "Permisos por rol" · read-only matriz
// ─────────────────────────────────────────────────────────────

const MODULES_BY_ROLE: Record<StudioUserRole, string[]> = {
  admin: [
    "Todos los módulos",
    "Gestión usuarios y roles",
    "Facturación y SENIAT",
    "Config del Studio",
  ],
  commercial: [
    "Estimados",
    "Clientes",
    "CRM y leads",
    "Embarques (lectura)",
    "Tarifas (lectura)",
  ],
  operations: [
    "Embarques",
    "Tracking",
    "Almacén CN/VE",
    "Calendario",
    "TMS",
    "SENIAT",
    "Documentos",
  ],
  accounting: [
    "Facturación",
    "Pagos",
    "Reportes financieros",
    "Embarques (lectura)",
  ],
  warehouse: [
    "Almacén asignado (CN o VE)",
    "Recepciones",
    "Despachos",
    "Etiquetas QR",
  ],
  support: [
    "Clientes (lectura)",
    "Tracking (lectura)",
    "Documentos (lectura)",
    "Crear tickets",
  ],
};

function PermissionsByRoleModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Permisos por rol"
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--scrim, rgba(15, 30, 61, 0.5))",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 720,
          maxHeight: "92dvh",
          overflowY: "auto",
          background: "var(--bg-surface)",
          borderRadius: 8,
          boxShadow: "var(--shadow-pop, 0 24px 48px rgba(0,0,0,0.18))",
        }}
      >
        <header
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h2
              className="studio-display"
              style={{
                fontSize: 18,
                margin: 0,
                color: "var(--ink)",
              }}
            >
              Permisos por rol
            </h2>
            <p
              style={{
                font: "500 12px/1.4 var(--font-sans, 'Archivo')",
                color: "var(--ink-soft)",
                margin: "4px 0 0",
              }}
            >
              Resumen del acceso de cada rol a los módulos del Studio. Read-only V1.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="studio-btn studio-btn-ghost studio-btn-xs"
            style={{ color: "var(--ink-soft)" }}
            aria-label="Cerrar"
          >
            Cerrar
          </button>
        </header>

        <div style={{ padding: 22 }}>
          {STUDIO_USER_ROLES.map((r) => {
            const tone = roleBadgeTone(r);
            return (
              <div
                key={r}
                style={{
                  paddingBottom: 16,
                  marginBottom: 16,
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 8,
                  }}
                >
                  <Pill bg={TONE_BG[tone]} fg={TONE_FG[tone]}>
                    {ROLE_LABELS[r]}
                  </Pill>
                  <span
                    style={{
                      font: "500 12px/1.4 var(--font-sans, 'Archivo')",
                      color: "var(--ink-soft)",
                    }}
                  >
                    {ROLE_DESCRIPTIONS[r]}
                  </span>
                </div>
                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 18,
                    font: "500 12.5px/1.6 var(--font-sans, 'Archivo')",
                    color: "var(--ink)",
                  }}
                >
                  {MODULES_BY_ROLE[r].map((mod) => (
                    <li key={mod}>{mod}</li>
                  ))}
                </ul>
              </div>
            );
          })}

          <p
            style={{
              font: "500 11.5px/1.4 var(--font-sans, 'Archivo')",
              color: "var(--ink-mute)",
              margin: 0,
            }}
          >
            La matriz de permisos detallada por módulo/acción llega en
            SDD-0024 Fase B (schema role_permissions). Hoy los permisos
            son fijos por rol y se enforcing a nivel de page redirect +
            server actions.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components reusados (filter select, search, pill)
// ─────────────────────────────────────────────────────────────

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label
      style={{
        display: "inline-flex",
        flexDirection: "column",
        gap: 4,
        minWidth: 160,
      }}
    >
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          height: 36,
          padding: "0 28px 0 10px",
          border: "1px solid var(--border)",
          borderRadius: 6,
          background: "var(--bg-surface)",
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
    </label>
  );
}

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label
      style={{
        display: "inline-flex",
        flexDirection: "column",
        gap: 4,
        minWidth: 240,
        flex: 1,
        maxWidth: 360,
      }}
    >
      <span
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--ink-soft)",
        }}
      >
        Buscar
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          height: 36,
          padding: "0 12px",
          border: "1px solid var(--border)",
          borderRadius: 6,
          background: "var(--bg-surface)",
          color: "var(--ink)",
          fontFamily: "inherit",
          fontSize: 13,
          outline: "none",
        }}
      />
    </label>
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
        height: 22,
        padding: "0 10px",
        background: bg,
        color: fg,
        borderRadius: 4,
        fontSize: 11.5,
        fontWeight: 700,
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}
