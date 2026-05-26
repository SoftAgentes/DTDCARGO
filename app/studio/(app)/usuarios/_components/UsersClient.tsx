"use client";

/**
 * UsersClient · orquestador del módulo Usuarios (SDD-0024 Fase 2).
 *
 * 2 tabs: Miembros (activos + desactivados) / Invitaciones (pendientes,
 * aceptadas, revocadas, expiradas).
 * Filtros (role, status, search).
 * Drawer "Invitar usuario" + acciones inline (cambiar rol, desactivar,
 * reactivar, revocar invitation).
 */

import { useState } from "react";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import { InviteUserDrawer } from "./InviteUserDrawer";
import { MembersTable } from "./MembersTable";
import { InvitationsTable } from "./InvitationsTable";
import type {
  StudioUserRole,
  UserInvitation,
  UserKpis,
  UserMembershipWithProfile,
} from "@/lib/studio/user-types";
import { ROLE_LABELS, STUDIO_USER_ROLES } from "@/lib/studio/user-types";

type Tab = "members" | "invitations";

interface Props {
  members: UserMembershipWithProfile[];
  invitations: UserInvitation[];
  kpis: UserKpis;
  currentUserId: string;
}

export function UsersClient({ members, invitations, kpis, currentUserId }: Props) {
  const [tab, setTab] = useState<Tab>("members");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState<StudioUserRole | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "disabled">(
    "all",
  );
  const [search, setSearch] = useState("");

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
      {/* KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <KpiCard
          label="Miembros totales"
          value={kpis.totalMembers}
          sub={`${kpis.activeMembers} activos`}
        />
        <KpiCard label="Admins" value={kpis.adminsCount} sub="Acceso total" />
        <KpiCard
          label="Invitaciones pendientes"
          value={kpis.pendingInvitations}
          sub="Sin aceptar"
        />
        <KpiCard
          label="Desactivados"
          value={kpis.totalMembers - kpis.activeMembers}
          sub="Sin acceso"
        />
      </div>

      {/* Header con tabs + botón invitar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div
          role="tablist"
          aria-label="Vistas Usuarios"
          style={{
            display: "inline-flex",
            background: "var(--bg-elevated, #F2F0EC)",
            borderRadius: 8,
            padding: 4,
            gap: 2,
          }}
        >
          <TabButton
            active={tab === "members"}
            label={`Miembros (${members.length})`}
            onClick={() => setTab("members")}
          />
          <TabButton
            active={tab === "invitations"}
            label={`Invitaciones (${invitations.length})`}
            onClick={() => setTab("invitations")}
          />
        </div>

        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="studio-btn studio-btn-primary"
        >
          + Invitar usuario
        </button>
      </div>

      {/* Filtros · solo para Miembros */}
      {tab === "members" && (
        <div
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 20,
            flexWrap: "wrap",
            alignItems: "flex-end",
          }}
        >
          <FilterSelect
            label="Rol"
            value={roleFilter}
            onChange={(v) => setRoleFilter(v as StudioUserRole | "all")}
            options={[
              { value: "all", label: "Todos" },
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
      )}

      {/* Body */}
      {tab === "members" ? (
        <MembersTable members={filteredMembers} currentUserId={currentUserId} />
      ) : (
        <InvitationsTable invitations={invitations} />
      )}

      {/* Drawer Invitar */}
      {drawerOpen && (
        <InviteUserDrawer onClose={() => setDrawerOpen(false)} />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function TabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        padding: "8px 16px",
        border: "none",
        background: active ? "var(--bg-surface, #FFFFFF)" : "transparent",
        color: active ? "var(--ink)" : "var(--ink-soft)",
        borderRadius: 6,
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        boxShadow: active ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
        transition: "all var(--dur, 180ms) var(--ease, ease-out)",
      }}
    >
      {label}
    </button>
  );
}

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
        minWidth: 140,
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
          border: "1px solid var(--border, #E8E6E2)",
          borderRadius: 6,
          background: "var(--bg-surface, #FFFFFF)",
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
          border: "1px solid var(--border, #E8E6E2)",
          borderRadius: 6,
          background: "var(--bg-surface, #FFFFFF)",
          color: "var(--ink)",
          fontFamily: "inherit",
          fontSize: 13,
          outline: "none",
        }}
      />
    </label>
  );
}
