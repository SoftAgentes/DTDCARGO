/**
 * BugCard · card resumen de un bug en "Mis reportes" (SDD-0036 Fase 2).
 *
 * Server component (sin interactivity). Se envuelve en <Link> desde la page.
 */

import {
  BUG_CATEGORY_LABELS,
  BUG_CATEGORY_TONES,
  BUG_STATE_LABELS,
  BUG_STATE_TONES,
  BUG_SEVERITY_LABELS,
  type BugReport,
} from "@/lib/studio/bug-types";
import { moduleLabelFromSlug } from "@/lib/studio/bug-module-name";

interface BugCardProps {
  bug: BugReport;
}

export function BugCard({ bug }: BugCardProps) {
  const catTone = BUG_CATEGORY_TONES[bug.category];
  const stateTone = BUG_STATE_TONES[bug.state];

  return (
    <article
      style={{
        background: "var(--bg-surface, #FFFFFF)",
        border: "1px solid var(--border, #E8E6E2)",
        borderRadius: "var(--r-lg, 12px)",
        padding: "var(--s-4, 16px) var(--s-5, 20px)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--s-3, 12px)",
        transition: "border-color var(--dur, 180ms) var(--ease, ease-out), box-shadow var(--dur, 180ms) var(--ease, ease-out)",
        cursor: "pointer",
        minHeight: 220,
      }}
      onMouseEnter={undefined}
    >
      {/* Top row: folio + state badge */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "var(--s-2, 8px)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-1)" }}>
          <code
            style={{
              fontFamily: "var(--font-mono, 'JetBrains Mono')",
              fontWeight: 700,
              fontSize: 13,
              color: "var(--wine, #7F0F1A)",
            }}
          >
            {bug.folio}
          </code>
          <span
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--ink-soft)",
            }}
          >
            {moduleLabelFromSlug(bug.module)}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-1)", alignItems: "flex-end" }}>
          <MiniBadge tone={stateTone}>{BUG_STATE_LABELS[bug.state]}</MiniBadge>
          {bug.duplicate_count > 0 && (
            <MiniBadge tone="neutral">×{bug.duplicate_count + 1}</MiniBadge>
          )}
        </div>
      </div>

      {/* Title */}
      <h3
        style={{
          margin: 0,
          fontSize: 15,
          lineHeight: 1.35,
          color: "var(--ink)",
          fontWeight: 600,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {bug.title}
      </h3>

      {/* Description preview */}
      <p
        style={{
          margin: 0,
          fontSize: 13,
          lineHeight: 1.45,
          color: "var(--ink-soft)",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {bug.description}
      </p>

      {/* Progress bar */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11,
            color: "var(--ink-soft)",
          }}
        >
          <span
            style={{
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Progreso
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono, 'JetBrains Mono')",
              fontWeight: 700,
            }}
          >
            {bug.progress_pct}%
          </span>
        </div>
        <div
          style={{
            height: 6,
            background: "var(--neutral-bg, #F2F0EC)",
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${bug.progress_pct}%`,
              height: "100%",
              background:
                bug.state === "resuelto"
                  ? "var(--success, #1F8A5B)"
                  : bug.state === "descartado"
                    ? "var(--ink-soft, #6B6B6B)"
                    : "var(--wine, #7F0F1A)",
              transition: "width var(--dur, 180ms) var(--ease, ease-out)",
            }}
          />
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "var(--s-2, 8px)",
          paddingTop: "var(--s-2, 8px)",
          borderTop: "1px solid var(--border, #E8E6E2)",
          marginTop: "auto",
        }}
      >
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <MiniBadge tone={catTone}>{BUG_CATEGORY_LABELS[bug.category]}</MiniBadge>
          {bug.severity && (
            <span
              style={{
                fontSize: 11,
                color: "var(--ink-soft)",
              }}
            >
              {BUG_SEVERITY_LABELS[bug.severity]}
            </span>
          )}
        </div>
        <span
          style={{
            fontSize: 11,
            color: "var(--ink-soft)",
          }}
          title={new Date(bug.created_at).toLocaleString("es-VE")}
        >
          {formatRelativeDate(bug.created_at)}
        </span>
      </div>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

const TONE_COLORS: Record<string, { bg: string; fg: string }> = {
  success: { bg: "var(--success-bg, #E5F4ED)", fg: "var(--success, #1F8A5B)" },
  warning: { bg: "var(--warning-bg, #FBF1DF)", fg: "var(--warning, #B8893A)" },
  danger: { bg: "var(--danger-bg, #FCEDED)", fg: "var(--danger, #A8323E)" },
  info: { bg: "var(--info-bg, #E5EEF9)", fg: "var(--info, #2A6FDB)" },
  wine: { bg: "var(--wine-tint, #FBE9EC)", fg: "var(--wine, #7F0F1A)" },
  neutral: { bg: "var(--neutral-bg, #F2F0EC)", fg: "var(--ink-soft, #6B6B6B)" },
};

function MiniBadge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: keyof typeof TONE_COLORS;
}) {
  const c = TONE_COLORS[tone] ?? TONE_COLORS.neutral;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 20,
        padding: "0 8px",
        background: c.bg,
        color: c.fg,
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1,
      }}
    >
      {children}
    </span>
  );
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d} d`;
  return date.toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}
