"use client";

import { RovingTabList } from "@/app/studio/_components/ui/RovingTabList";

/**
 * BugsAdminClient · orquestador del Bug Tracker admin (SDD-0036 Fase 3).
 *
 * 3 tabs: Kanban · Tabla · Stats. Drawer right side con detalle del bug
 * seleccionado. Filtros en query params via router.replace.
 */

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { BugKanban } from "./BugKanban";
import { BugTable } from "./BugTable";
import { BugStats } from "./BugStats";
import { BugDrawer } from "./BugDrawer";
import {
  BUG_CATEGORY_LABELS,
  BUG_SEVERITY_LABELS,
  BUG_STATE_LABELS,
  type BugAdminFilters,
  type BugAdminTab,
  type BugCategory,
  type BugReport,
  type BugState,
} from "@/lib/studio/bug-types";
import { moduleLabelFromSlug } from "@/lib/studio/bug-module-name";
import type { BugAdminKpis } from "@/lib/studio/bug-queries";
import type { ReporterProfile } from "@/lib/studio/bug-types";
import { csvCell } from "@/lib/studio/export/csv";

interface Props {
  bugs: BugReport[];
  kpis: BugAdminKpis;
  filters: BugAdminFilters;
  reporterMap: Record<string, ReporterProfile>;
  moduleList: string[];
  currentUserId: string;
  staleCount: number;
  staleDays: number;
}

// Keys que persistimos en localStorage para recordar filtros del admin
// entre sesiones. NO incluye `tab` (que se inicializa siempre en Kanban).
const PERSIST_KEYS: Array<"category" | "state" | "module" | "search"> = [
  "category",
  "state",
  "module",
  "search",
];
const STORAGE_KEY = "studio_bugs_filters";

export function BugsAdminClient({
  bugs,
  kpis,
  filters,
  reporterMap,
  moduleList,
  currentUserId,
  staleCount,
  staleDays,
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

  // ─── F6.2 Filtros persistidos en localStorage ───────────────
  // Hydrate at mount: si NO hay query params explícitos y hay filtros
  // guardados, re-aplicarlos (silent push a URL). Esto trae al admin a
  // su última vista al volver al Studio.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    const hasExplicitParams = params.toString().length > 0;
    if (hasExplicitParams) {
      // Ya vienen params en la URL · persistirlos para próxima vez
      try {
        const persisted: Record<string, string> = {};
        for (const k of PERSIST_KEYS) {
          const v = params.get(k);
          if (v) persisted[k] = v;
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
      } catch {
        // localStorage disabled / quota · ignorar
      }
      return;
    }

    // No params · intentar hidratar desde localStorage
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const persisted = JSON.parse(raw) as Record<string, string>;
      const sp = new URLSearchParams();
      for (const k of PERSIST_KEYS) {
        const v = persisted[k];
        if (v && v !== "all") sp.set(k, v);
      }
      if (sp.toString().length > 0) {
        router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
      }
    } catch {
      // localStorage disabled · ignorar
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── F6.3 Export CSV de la tabla actual filtrada ────────────
  const exportCsv = () => {
    const rows = bugsToCsvRows(bugs, reporterMap);
    const csv = rowsToCsv(rows);
    const ts = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dtd-bugs-${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ─── F6.1 Banner bugs estancados ────────────────────────────
  const onClickStaleBanner = () => {
    // Cambia a tabla con estado=progreso (los más críticos estancados)
    const sp = new URLSearchParams(params.toString());
    sp.set("tab", "tabla");
    sp.set("state", "progreso");
    startTransition(() => {
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    });
  };

  return (
    <>
      {/* F6.1 · Banner bugs estancados (si hay) */}
      {staleCount > 0 && (
        <button
          type="button"
          onClick={onClickStaleBanner}
          style={{
            display: "flex",
            width: "100%",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "10px 16px",
            marginBottom: 16,
            background: "var(--warning-bg, #FBF1DF)",
            border: "1px solid var(--warning, #B8893A)",
            borderRadius: 8,
            cursor: "pointer",
            textAlign: "left",
            font: "inherit",
            color: "var(--ink)",
            transition: "background var(--dur, 180ms) var(--ease, ease-out)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--warning, #B8893A)";
            e.currentTarget.style.color = "var(--ink-inv, #FBFAF7)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--warning-bg, #FBF1DF)";
            e.currentTarget.style.color = "var(--ink)";
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ClockIcon size={18} />
            <span style={{ fontSize: 13 }}>
              <strong
                style={{
                  fontFamily: "var(--font-archivo-black, 'Archivo Black')",
                  fontSize: 14,
                }}
              >
                {staleCount}
              </strong>{" "}
              {staleCount === 1 ? "bug está estancado" : "bugs están estancados"} hace
              más de {staleDays} días en triaje / espera / progreso.
            </span>
          </span>
          <span
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              fontWeight: 600,
            }}
          >
            Ver en tabla →
          </span>
        </button>
      )}

      {/* Tabs + Export CSV */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <RovingTabList
          aria-label="Vistas Bug Tracker"
          style={{
            display: "inline-flex",
            background: "var(--bg-elevated, #F2F0EC)",
            borderRadius: 8,
            padding: 4,
            gap: 2,
          }}
        >
          {(["kanban", "tabla", "cerrados", "stats"] as const).map((tab) => (
            <TabButton
              key={tab}
              active={filters.tab === tab}
              label={
                tab === "kanban"
                  ? "Kanban"
                  : tab === "tabla"
                    ? "Tabla"
                    : tab === "cerrados"
                      ? "Cerrados"
                      : "Stats"
              }
              onClick={() => changeTab(tab)}
            />
          ))}
        </RovingTabList>

        {/* F6.3 Export CSV (disabled si no hay bugs) */}
        <button
          type="button"
          onClick={exportCsv}
          disabled={bugs.length === 0}
          className="studio-btn studio-btn-ghost studio-btn-sm"
          title={
            bugs.length === 0
              ? "Sin bugs para exportar"
              : `Exportar ${bugs.length} bug(s) como CSV`
          }
        >
          Exportar CSV ({bugs.length})
        </button>
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
          {filters.tab === "cerrados" && (
            <FilterSelect
              label="Estado"
              value={filters.state ?? "all"}
              onChange={(v) => setQp("state", v)}
              options={[
                { value: "all", label: "Todos (resueltos + descartados)" },
                { value: "resuelto", label: BUG_STATE_LABELS.resuelto },
                { value: "descartado", label: BUG_STATE_LABELS.descartado },
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
      ) : filters.tab === "tabla" || filters.tab === "cerrados" ? (
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
        transition:
          "background-color var(--dur, 180ms) var(--ease, ease-out), color var(--dur, 180ms) var(--ease, ease-out), box-shadow var(--dur, 180ms) var(--ease, ease-out)",
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

// ─────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────

function ClockIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// CSV export helpers (F6.3)
// ─────────────────────────────────────────────────────────────

type CsvRow = {
  folio: string;
  categoria: string;
  severidad: string;
  estado: string;
  progreso_pct: number;
  titulo: string;
  modulo: string;
  reporter: string;
  url: string;
  dias_abierto: number;
  taken_at: string;
  resolved_at: string;
  duplicate_count: number;
  commit_url: string;
};

function bugsToCsvRows(
  bugs: BugReport[],
  reporterMap: Record<string, ReporterProfile>,
): CsvRow[] {
  const now = Date.now();
  return bugs.map((b) => {
    const reporter = reporterMap[b.reporter_id];
    const reporterName = reporter
      ? [reporter.first_name, reporter.last_name].filter(Boolean).join(" ") ||
        reporter.email ||
        b.reporter_id.slice(0, 8)
      : b.reporter_id.slice(0, 8);
    const days = Math.max(
      0,
      Math.floor((now - new Date(b.created_at).getTime()) / (24 * 60 * 60 * 1000)),
    );
    return {
      folio: b.folio,
      categoria: BUG_CATEGORY_LABELS[b.category],
      severidad: b.severity ? BUG_SEVERITY_LABELS[b.severity] : "",
      estado: BUG_STATE_LABELS[b.state],
      progreso_pct: b.progress_pct,
      titulo: b.title,
      modulo: moduleLabelFromSlug(b.module),
      reporter: reporterName,
      url: b.url ?? "",
      dias_abierto: days,
      taken_at: b.taken_at ?? "",
      resolved_at: b.resolved_at ?? "",
      duplicate_count: b.duplicate_count,
      commit_url: b.commit_url ?? "",
    };
  });
}

function rowsToCsv(rows: CsvRow[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]) as Array<keyof CsvRow>;
  const lines: string[] = [];
  lines.push(headers.join(","));
  for (const row of rows) {
    lines.push(headers.map((h) => csvCell(row[h])).join(","));
  }
  // BOM para Excel detecte UTF-8 (Sam abre con Excel español)
  return "﻿" + lines.join("\r\n");
}
