"use client";

/**
 * BugStats · 4 KPIs + distribución por categoría + top módulos (SDD-0036 Fase 3).
 *
 * V1 sin charts JS · solo cards + listas. Charts opcionales en V2.
 */

import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import {
  BUG_CATEGORY_LABELS,
  BUG_CATEGORY_TONES,
  BUG_STATE_LABELS,
  type BugCategory,
  type BugReport,
  type BugState,
} from "@/lib/studio/bug-types";
import { moduleLabelFromSlug } from "@/lib/studio/bug-module-name";
import type { BugAdminKpis } from "@/lib/studio/bug-queries";

interface Props {
  kpis: BugAdminKpis;
  bugs: BugReport[];
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

export function BugStats({ kpis, bugs }: Props) {
  // Distribución por categoría (en bugs activos)
  const activeBugs = bugs.filter(
    (b) => b.state !== "resuelto" && b.state !== "descartado",
  );
  const byCategory = new Map<BugCategory, number>();
  for (const b of activeBugs) {
    byCategory.set(b.category, (byCategory.get(b.category) ?? 0) + 1);
  }

  // Top módulos
  const byModule = new Map<string, number>();
  for (const b of activeBugs) {
    byModule.set(b.module, (byModule.get(b.module) ?? 0) + 1);
  }
  const topModules = Array.from(byModule.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Distribución por estado
  const byState = new Map<BugState, number>();
  for (const b of bugs) {
    byState.set(b.state, (byState.get(b.state) ?? 0) + 1);
  }

  // Tiempo promedio fix (resueltos)
  const resueltos = bugs.filter((b) => b.state === "resuelto" && b.resolved_at);
  const avgFixHours =
    resueltos.length > 0
      ? resueltos.reduce((s, b) => {
          const ms = new Date(b.resolved_at!).getTime() - new Date(b.created_at).getTime();
          return s + ms / (1000 * 60 * 60);
        }, 0) / resueltos.length
      : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* KPIs row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        <KpiCard
          label="Total bugs"
          value={kpis.totalBugs}
          sub={`${activeBugs.length} activos`}
        />
        <KpiCard
          label="Resueltos semana"
          value={kpis.resueltosSemana}
          sub={resueltos.length > 0 ? `${resueltos.length} resueltos en total` : "—"}
        />
        <KpiCard label="En progreso" value={kpis.enProgreso} sub="Trabajando ahora" />
        <KpiCard
          label="Tiempo promedio fix"
          value={avgFixHours > 0 ? `${avgFixHours.toFixed(1)}h` : "—"}
          sub={resueltos.length > 0 ? `Sobre ${resueltos.length} bugs` : "Aún sin datos"}
        />
      </div>

      {/* Distribución por estado */}
      <section
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: 20,
        }}
      >
        <h3
          className="studio-eyebrow"
          style={{ margin: "0 0 12px", fontSize: 11, color: "var(--ink-soft)" }}
        >
          Por estado
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 12,
          }}
        >
          {(Object.keys(BUG_STATE_LABELS) as BugState[]).map((s) => (
            <StateBlock
              key={s}
              label={BUG_STATE_LABELS[s]}
              count={byState.get(s) ?? 0}
            />
          ))}
        </div>
      </section>

      {/* Two columns: categoría + top modules */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: 16,
        }}
      >
        <section
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 20,
          }}
        >
          <h3
            className="studio-eyebrow"
            style={{ margin: "0 0 12px", fontSize: 11, color: "var(--ink-soft)" }}
          >
            Por tipo (activos)
          </h3>
          {byCategory.size === 0 ? (
            <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 13 }}>
              Sin reportes activos.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(Object.keys(BUG_CATEGORY_LABELS) as BugCategory[])
                .filter((c) => (byCategory.get(c) ?? 0) > 0)
                .map((c) => {
                  const count = byCategory.get(c) ?? 0;
                  const pct = activeBugs.length > 0 ? (count / activeBugs.length) * 100 : 0;
                  const tone = BUG_CATEGORY_TONES[c];
                  return (
                    <CategoryBar
                      key={c}
                      label={BUG_CATEGORY_LABELS[c]}
                      count={count}
                      pct={pct}
                      bg={TONE_BG[tone]}
                      fg={TONE_FG[tone]}
                    />
                  );
                })}
            </div>
          )}
        </section>

        <section
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 20,
          }}
        >
          <h3
            className="studio-eyebrow"
            style={{ margin: "0 0 12px", fontSize: 11, color: "var(--ink-soft)" }}
          >
            Top módulos (activos)
          </h3>
          {topModules.length === 0 ? (
            <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 13 }}>
              Sin reportes activos.
            </p>
          ) : (
            <ol
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {topModules.map(([mod, count], i) => (
                <li
                  key={mod}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    background: i === 0 ? "var(--wine-tint, #FBE9EC)" : "var(--bg-elevated, #F2F0EC)",
                    borderRadius: 6,
                  }}
                >
                  <span style={{ fontSize: 13, color: "var(--ink)" }}>
                    <span
                      style={{
                        marginRight: 8,
                        color: "var(--ink-soft)",
                        fontWeight: 600,
                      }}
                    >
                      {i + 1}.
                    </span>
                    {moduleLabelFromSlug(mod)}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-archivo-black, 'Archivo Black')",
                      fontSize: 14,
                      color: i === 0 ? "var(--wine, #7F0F1A)" : "var(--ink)",
                    }}
                  >
                    {count}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function StateBlock({ label, count }: { label: string; count: number }) {
  return (
    <div
      style={{
        background: "var(--bg-elevated, #F2F0EC)",
        borderRadius: 6,
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <span
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--ink-soft)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--font-archivo-black, 'Archivo Black')",
          fontSize: 22,
          color: "var(--ink)",
          lineHeight: 1,
        }}
      >
        {count}
      </span>
    </div>
  );
}

function CategoryBar({
  label,
  count,
  pct,
  bg,
  fg,
}: {
  label: string;
  count: number;
  pct: number;
  bg: string;
  fg: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
        }}
      >
        <span style={{ color: "var(--ink)", fontWeight: 500 }}>{label}</span>
        <span style={{ color: "var(--ink-soft)" }}>
          {count} ({pct.toFixed(0)}%)
        </span>
      </div>
      <div
        style={{
          height: 8,
          background: "var(--neutral-bg, #F2F0EC)",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: fg,
          }}
        />
      </div>
    </div>
  );
}
