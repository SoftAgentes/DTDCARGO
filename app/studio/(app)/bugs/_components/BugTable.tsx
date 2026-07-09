"use client";

/**
 * BugTable · tabla sortable de todos los bugs del tenant. Click row → drawer.
 */

import { useMemo, useState } from "react";
import {
  BUG_CATEGORY_LABELS,
  BUG_CATEGORY_TONES,
  BUG_SEVERITY_LABELS,
  BUG_STATE_LABELS,
  BUG_STATE_TONES,
  type BugReport,
} from "@/lib/studio/bug-types";
import { moduleLabelFromSlug } from "@/lib/studio/bug-module-name";
import { TableFrame, ActionableRow } from "@/app/studio/_components/ui/DataTable";
import type { ReporterProfile } from "@/lib/studio/bug-types";

interface Props {
  bugs: BugReport[];
  reporterMap: Record<string, ReporterProfile>;
  onOpenBug: (id: string) => void;
}

type SortKey = "folio" | "created" | "state" | "category" | "title" | "days";
type SortDir = "asc" | "desc";

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

export function BugTable({ bugs, reporterMap, onOpenBug }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const arr = [...bugs];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "folio":
          cmp = a.folio.localeCompare(b.folio);
          break;
        case "created":
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case "state":
          cmp = a.state.localeCompare(b.state);
          break;
        case "category":
          cmp = a.category.localeCompare(b.category);
          break;
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
        case "days":
          cmp =
            (Date.now() - new Date(a.created_at).getTime()) -
            (Date.now() - new Date(b.created_at).getTime());
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [bugs, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "created" ? "desc" : "asc");
    }
  };

  if (bugs.length === 0) {
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
        Sin reportes que mostrar.
      </div>
    );
  }

  return (
    <TableFrame>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 13,
        }}
      >
        <thead>
          <tr style={{ background: "var(--bg-elevated, #F2F0EC)" }}>
            <Th onClick={() => toggleSort("folio")} active={sortKey === "folio"} dir={sortDir}>
              Folio
            </Th>
            <Th onClick={() => toggleSort("category")} active={sortKey === "category"} dir={sortDir}>
              Tipo
            </Th>
            <Th onClick={() => toggleSort("state")} active={sortKey === "state"} dir={sortDir}>
              Estado
            </Th>
            <Th onClick={() => toggleSort("title")} active={sortKey === "title"} dir={sortDir}>
              Título
            </Th>
            <Th>Módulo</Th>
            <Th>Reporter</Th>
            <Th>Severidad</Th>
            <Th onClick={() => toggleSort("days")} active={sortKey === "days"} dir={sortDir}>
              Días
            </Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((bug) => {
            const catTone = BUG_CATEGORY_TONES[bug.category];
            const stateTone = BUG_STATE_TONES[bug.state];
            const reporter = reporterMap[bug.reporter_id];
            const days = Math.max(
              0,
              Math.floor(
                (Date.now() - new Date(bug.created_at).getTime()) /
                  (24 * 60 * 60 * 1000),
              ),
            );
            return (
              <ActionableRow
                key={bug.id}
                onSelect={() => onOpenBug(bug.id)}
                label={`Ver reporte ${bug.folio}`}
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <Td>
                  <code
                    style={{
                      fontFamily: "var(--font-mono, 'JetBrains Mono')",
                      fontWeight: 700,
                      color: "var(--wine, #7F0F1A)",
                      fontSize: 12,
                    }}
                  >
                    {bug.folio}
                  </code>
                  {bug.duplicate_count > 0 && (
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: 10,
                        padding: "1px 6px",
                        background: "var(--neutral-bg)",
                        color: "var(--ink-soft)",
                        borderRadius: 4,
                        fontWeight: 600,
                      }}
                    >
                      ×{bug.duplicate_count + 1}
                    </span>
                  )}
                </Td>
                <Td>
                  <Pill bg={TONE_BG[catTone]} fg={TONE_FG[catTone]}>
                    {BUG_CATEGORY_LABELS[bug.category]}
                  </Pill>
                </Td>
                <Td>
                  <Pill bg={TONE_BG[stateTone]} fg={TONE_FG[stateTone]}>
                    {BUG_STATE_LABELS[bug.state]}
                  </Pill>
                </Td>
                <Td>
                  <span
                    style={{
                      display: "block",
                      maxWidth: 380,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      color: "var(--ink)",
                    }}
                  >
                    {bug.title}
                  </span>
                </Td>
                <Td>
                  <span style={{ color: "var(--ink-soft)", fontSize: 12 }}>
                    {moduleLabelFromSlug(bug.module)}
                  </span>
                </Td>
                <Td>
                  <span style={{ color: "var(--ink-soft)", fontSize: 12 }}>
                    {reporter ? formatReporterName(reporter) : bug.reporter_id.slice(0, 8)}
                  </span>
                </Td>
                <Td>
                  <span style={{ color: "var(--ink-soft)", fontSize: 12 }}>
                    {bug.severity ? BUG_SEVERITY_LABELS[bug.severity] : "—"}
                  </span>
                </Td>
                <Td>
                  <span
                    style={{
                      fontFamily: "var(--font-mono, 'JetBrains Mono')",
                      color: "var(--ink-soft)",
                      fontSize: 12,
                    }}
                  >
                    {days}d
                  </span>
                </Td>
              </ActionableRow>
            );
          })}
        </tbody>
      </table>
    </TableFrame>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function Th({
  children,
  onClick,
  active = false,
  dir,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  dir?: SortDir;
}) {
  const label = (
    <>
      {children}
      {active && dir && (
        <span style={{ marginLeft: 4, fontSize: 9 }}>
          {dir === "asc" ? "↑" : "↓"}
        </span>
      )}
    </>
  );
  const cellStyle: React.CSSProperties = {
    padding: onClick ? 0 : "10px 12px",
    textAlign: "left",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: active ? "var(--wine)" : "var(--ink-soft)",
    fontWeight: 600,
    whiteSpace: "nowrap",
    userSelect: "none",
  };
  // Columna ordenable → el orden va en un <button> REAL (alcanzable por
  // teclado, WCAG 2.1.1) y el <th> declara aria-sort. Columna no ordenable →
  // th plano.
  if (!onClick) {
    return (
      <th style={cellStyle}>
        {label}
      </th>
    );
  }
  return (
    <th
      style={cellStyle}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={onClick}
        style={{
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          width: "100%",
          margin: 0,
          padding: "10px 12px",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "inherit",
          font: "inherit",
          letterSpacing: "inherit",
          textTransform: "inherit",
        }}
      >
        {label}
      </button>
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td style={{ padding: "10px 12px", verticalAlign: "middle" }}>
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

function formatReporterName(p: ReporterProfile): string {
  const name = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  return name || p.email || p.user_id.slice(0, 8);
}
