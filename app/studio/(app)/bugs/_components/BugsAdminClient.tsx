"use client";

/**
 * BugsAdminClient · orquestador del Bug Tracker admin (SDD-0036 Fase 3).
 *
 * 3 tabs: Kanban · Tabla · Stats. Drawer right side con detalle del bug
 * seleccionado. Filtros en query params via router.replace.
 */

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { BugKanban } from "./BugKanban";
import { BugTable } from "./BugTable";
import { BugStats } from "./BugStats";
import { BugDrawer } from "./BugDrawer";
import {
  BUG_CATEGORY_LABELS,
  BUG_STATE_LABELS,
  type BugAdminFilters,
  type BugAdminTab,
  type BugCategory,
  type BugReport,
  type BugState,
} from "@/lib/studio/bug-types";
import type { BugAdminKpis } from "@/lib/studio/bug-queries";
import type { ReporterProfile } from "../page";

interface Props {
  bugs: BugReport[];
  kpis: BugAdminKpis;
  filters: BugAdminFilters;
  reporterMap: Record<string, ReporterProfile>;
  moduleList: string[];
  currentUserId: string;
}

export function BugsAdminClient({
  bugs,
  kpis,
  filters,
  reporterMap,
  moduleList,
  currentUserId,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const [openBugId, setOpenBugId] = useState<string | null>(null);
  const openBug = openBugId ? bugs.find((b) => b.id === openBugId) ?? null : null;

  const setQp = (key: string, value: string | null) => {
    const sp = new URLSearchParams(params.toString());
    if (!value || value === "all") sp.delete(key);
    else sp.set(key, value);
    startTransition(() => {
      router.replace(sp.toString() ? `${pathname}?${sp.toString()}` : pathname, {
        scroll: false,
      });
    });
  };

  const changeTab = (tab: BugAdminTab) => setQp("tab", tab === "kanban" ? null : tab);

  const refresh = () => router.refresh();

  return (
    <>
      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Vistas Bug Tracker"
        style={{
          display: "inline-flex",
          background: "var(--bg-elevated, #F2F0EC)",
          borderRadius: 8,
          padding: 4,
          marginBottom: 16,
          gap: 2,
        }}
      >
        {(["kanban", "tabla", "stats"] as const).map((tab) => (
          <TabButton
            key={tab}
            active={filters.tab === tab}
            label={tab === "kanban" ? "Kanban" : tab === "tabla" ? "Tabla" : "Stats"}
            onClick={() => changeTab(tab)}
          />
        ))}
      </div>

      {/* Filters */}
      {filters.tab !== "stats" && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 20,
            alignItems: "center",
          }}
        >
          <FilterSelect
            label="Tipo"
            value={filters.category ?? "all"}
            onChange={(v) => setQp("category", v)}
            options={[
              { value: "all", label: "Todos" },
              ...(Object.entries(BUG_CATEGORY_LABELS) as [BugCategory, string][]).map(
                ([v, l]) => ({ value: v, label: l }),
              ),
            ]}
          />
          {filters.tab === "tabla" && (
            <FilterSelect
              label="Estado"
              value={filters.state ?? "all"}
              onChange={(v) => setQp("state", v)}
              options={[
                { value: "all", label: "Todos" },
                ...(Object.entries(BUG_STATE_LABELS) as [BugState, string][]).map(
                  ([v, l]) => ({ value: v, label: l }),
                ),
              ]}
            />
          )}
          {moduleList.length > 0 && (
            <FilterSelect
              label="Módulo"
              value={filters.module ?? "all"}
              onChange={(v) => setQp("module", v)}
              options={[
                { value: "all", label: "Todos" },
                ...moduleList.map((m) => ({ value: m, label: m })),
              ]}
            />
          )}
          <SearchInput
            value={filters.search ?? ""}
            onChange={(v) => setQp("q", v)}
            placeholder="Buscar por folio, título…"
          />
        </div>
      )}

      {/* Body */}
      {filters.tab === "stats" ? (
        <BugStats kpis={kpis} bugs={bugs} />
      ) : filters.tab === "tabla" ? (
        <BugTable
          bugs={bugs}
          reporterMap={reporterMap}
          onOpenBug={setOpenBugId}
        />
      ) : (
        <BugKanban
          bugs={bugs}
          reporterMap={reporterMap}
          onOpenBug={setOpenBugId}
        />
      )}

      {/* Drawer */}
      {openBug && (
        <BugDrawer
          bug={openBug}
          reporter={reporterMap[openBug.reporter_id] ?? null}
          currentUserId={currentUserId}
          onClose={() => setOpenBugId(null)}
          onMutated={() => {
            refresh();
          }}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components: tab button, filter select, search input
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
  onChange: (value: string) => void;
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
