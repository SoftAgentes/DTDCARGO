"use client";

/**
 * BugKanban · 5 columnas (nuevo · triaje · espera · progreso · resuelto)
 * con cards mini que abren el drawer al click. Sin drag-and-drop V1
 * (avance de estado vía drawer · Acciones).
 */

import {
  BUG_CATEGORY_LABELS,
  BUG_CATEGORY_TONES,
  BUG_KANBAN_STATES,
  BUG_STATE_LABELS,
  BUG_STATE_PROGRESS_PCT,
  BUG_STATE_TONES,
  type BugReport,
} from "@/lib/studio/bug-types";
import { moduleLabelFromSlug } from "@/lib/studio/bug-module-name";
import type { ReporterProfile } from "../page";

interface Props {
  bugs: BugReport[];
  reporterMap: Record<string, ReporterProfile>;
  onOpenBug: (id: string) => void;
}

export function BugKanban({ bugs, reporterMap, onOpenBug }: Props) {
  const byState = BUG_KANBAN_STATES.map((state) => ({
    state,
    bugs: bugs.filter((b) => b.state === state),
  }));

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${BUG_KANBAN_STATES.length}, minmax(220px, 1fr))`,
        gap: 12,
        overflowX: "auto",
        paddingBottom: 12,
      }}
    >
      {byState.map(({ state, bugs: col }) => (
        <KanbanColumn key={state} state={state} count={col.length}>
          {col.length === 0 ? (
            <div
              style={{
                padding: 16,
                color: "var(--ink-soft)",
                fontSize: 12,
                textAlign: "center",
                border: "1px dashed var(--border)",
                borderRadius: 6,
              }}
            >
              Sin reportes
            </div>
          ) : (
            col.map((bug) => (
              <KanbanCard
                key={bug.id}
                bug={bug}
                reporter={reporterMap[bug.reporter_id] ?? null}
                onClick={() => onOpenBug(bug.id)}
              />
            ))
          )}
        </KanbanColumn>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Column
// ─────────────────────────────────────────────────────────────

const TONE_BG_MAP: Record<string, string> = {
  success: "var(--success-bg, #E5F4ED)",
  warning: "var(--warning-bg, #FBF1DF)",
  danger: "var(--danger-bg, #FCEDED)",
  info: "var(--info-bg, #E5EEF9)",
  wine: "var(--wine-tint, #FBE9EC)",
  neutral: "var(--neutral-bg, #F2F0EC)",
};

const TONE_FG_MAP: Record<string, string> = {
  success: "var(--success, #1F8A5B)",
  warning: "var(--warning, #B8893A)",
  danger: "var(--danger, #A8323E)",
  info: "var(--info, #2A6FDB)",
  wine: "var(--wine, #7F0F1A)",
  neutral: "var(--ink-soft, #6B6B6B)",
};

function KanbanColumn({
  state,
  count,
  children,
}: {
  state: keyof typeof BUG_STATE_LABELS;
  count: number;
  children: React.ReactNode;
}) {
  const tone = BUG_STATE_TONES[state];
  return (
    <section
      style={{
        background: "var(--bg-elevated, #F2F0EC)",
        borderRadius: 8,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        minWidth: 0,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "4px 4px 8px",
          borderBottom: "1px solid var(--border, #E8E6E2)",
          marginBottom: 4,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: TONE_FG_MAP[tone],
            }}
          />
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--ink)",
            }}
          >
            {BUG_STATE_LABELS[state]}
          </span>
        </div>
        <span
          style={{
            fontSize: 11,
            fontFamily: "var(--font-mono, 'JetBrains Mono')",
            color: "var(--ink-soft)",
            background: "var(--bg-surface, #FFFFFF)",
            padding: "2px 8px",
            borderRadius: 999,
            border: "1px solid var(--border, #E8E6E2)",
          }}
        >
          {count}
        </span>
      </header>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {children}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Card mini
// ─────────────────────────────────────────────────────────────

function KanbanCard({
  bug,
  reporter,
  onClick,
}: {
  bug: BugReport;
  reporter: ReporterProfile | null;
  onClick: () => void;
}) {
  const catTone = BUG_CATEGORY_TONES[bug.category];
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "var(--bg-surface, #FFFFFF)",
        border: "1px solid var(--border, #E8E6E2)",
        borderRadius: 6,
        padding: "10px 12px",
        textAlign: "left",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        font: "inherit",
        color: "var(--ink)",
        transition: "border-color var(--dur, 180ms) var(--ease, ease-out)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--wine, #7F0F1A)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border, #E8E6E2)";
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 8,
        }}
      >
        <code
          style={{
            fontFamily: "var(--font-mono, 'JetBrains Mono')",
            fontWeight: 700,
            fontSize: 11,
            color: "var(--wine, #7F0F1A)",
          }}
        >
          {bug.folio}
        </code>
        {bug.duplicate_count > 0 && (
          <span
            style={{
              fontSize: 10,
              padding: "1px 6px",
              borderRadius: 4,
              background: "var(--neutral-bg, #F2F0EC)",
              color: "var(--ink-soft)",
              fontWeight: 600,
            }}
          >
            ×{bug.duplicate_count + 1}
          </span>
        )}
      </div>
      <h4
        style={{
          margin: 0,
          fontSize: 13,
          lineHeight: 1.3,
          fontWeight: 600,
          color: "var(--ink)",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {bug.title}
      </h4>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span
          style={{
            fontSize: 10,
            padding: "1px 6px",
            background: TONE_BG_MAP[catTone],
            color: TONE_FG_MAP[catTone],
            borderRadius: 3,
            fontWeight: 600,
          }}
        >
          {BUG_CATEGORY_LABELS[bug.category]}
        </span>
        <span
          style={{
            fontSize: 10,
            color: "var(--ink-soft)",
          }}
          title={moduleLabelFromSlug(bug.module)}
        >
          {moduleLabelFromSlug(bug.module)}
        </span>
      </div>
      {reporter && (
        <span
          style={{
            fontSize: 10,
            color: "var(--ink-soft)",
            paddingTop: 4,
            borderTop: "1px dashed var(--border, #E8E6E2)",
            marginTop: 2,
          }}
        >
          {formatReporterName(reporter)} · {formatRelativeDate(bug.created_at)}
        </span>
      )}
    </button>
  );
}

function formatReporterName(p: ReporterProfile): string {
  const name = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  return name || p.email || p.user_id.slice(0, 8);
}

function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}
