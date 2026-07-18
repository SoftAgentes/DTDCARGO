"use client";

/**
 * Client component del dashboard de despacho.
 * Selector de periodo + KPIs + tabla ranking + barras top ciudades.
 *
 * Alineado a Claude Design v1.7 (despacho-dashboard.jsx):
 *  - KPIs con icons (truck/check/clock/warn/clock) coloreados por tone
 *  - Top ciudades muestra "N tarde" cuando hay paquetes que excedieron SLA
 */

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { Icon } from "@/app/studio/_components/icons";
import type {
  DispatchDashboardPeriod,
  DispatchDashboardStats,
  DispatchRouteRanking,
  DispatchTopCity,
} from "@/lib/studio/dispatch-queries";

const PERIOD_LABELS: Record<DispatchDashboardPeriod, string> = {
  "7d": "Últimos 7 días",
  "30d": "Últimos 30 días",
  "90d": "Últimos 90 días",
};

export function DispatchDashboardClient({
  period,
  stats,
  ranking,
  topCities,
}: {
  period: DispatchDashboardPeriod;
  stats: DispatchDashboardStats;
  ranking: DispatchRouteRanking[];
  topCities: DispatchTopCity[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const changePeriod = (next: DispatchDashboardPeriod) => {
    const sp = new URLSearchParams(params.toString());
    if (next === "7d") sp.delete("period");
    else sp.set("period", next);
    const qs = sp.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  };

  const avgRoute = stats.avgRouteHours;
  const avgRouteLabel = avgRoute != null ? `${avgRoute.toFixed(1)} h` : "—";

  return (
    <>
      {/* Period selector */}
      <div
        style={{
          display: "flex",
          gap: 6,
          marginBottom: 18,
          padding: 4,
          background: "var(--bg-elevated)",
          borderRadius: "var(--r-md)",
          width: "fit-content",
        }}
      >
        {(Object.keys(PERIOD_LABELS) as DispatchDashboardPeriod[]).map((p) => {
          const active = p === period;
          return (
            <button
              key={p}
              type="button"
              onClick={() => changePeriod(p)}
              style={{
                padding: "8px 14px",
                background: active ? "var(--bg-surface)" : "transparent",
                color: active ? "var(--ink)" : "var(--ink-soft)",
                border: 0,
                borderRadius: "var(--r-sm)",
                font: "600 12px/1 var(--f-sans)",
                cursor: "pointer",
                boxShadow: active ? "var(--shadow-xs)" : "none",
              }}
            >
              {PERIOD_LABELS[p]}
            </button>
          );
        })}
      </div>

      {/* 5 KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <Kpi
          label="Total ODs"
          value={String(stats.totalOds)}
          sub="creadas en periodo"
          tone="wine"
          icon={Icon.truck(18)}
        />
        <Kpi
          label="Completadas"
          value={String(stats.completed)}
          sub={stats.totalOds > 0 ? `${Math.round((stats.completed / stats.totalOds) * 100)}% del total` : "—"}
          tone="success"
          icon={Icon.check(18)}
        />
        <Kpi
          label="On-time"
          value={`${stats.ontimePct}%`}
          sub={`${stats.ontime} a tiempo`}
          tone="info"
          icon={Icon.clock(18)}
        />
        <Kpi
          label="Tarde + canceladas"
          value={String(stats.late + stats.cancelled)}
          sub={`${stats.late} tarde · ${stats.cancelled} canceladas`}
          tone="warning"
          icon={Icon.warn(18)}
        />
        <Kpi
          label="Tiempo promedio"
          value={avgRouteLabel}
          sub="por ruta completa"
          tone="neutral"
          icon={Icon.clock(18)}
        />
      </div>

      {/* Ranking + Top cities */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24 }}>
        {/* Ranking rutas */}
        <div
          style={{
            padding: 20,
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
          }}
        >
          <div className="studio-eyebrow" style={{ marginBottom: 14, color: "var(--wine-text)" }}>
            Ranking de rutas · eficiencia
          </div>
          {ranking.length === 0 ? (
            <div style={{ padding: "var(--s-8) 0", textAlign: "center", color: "var(--ink-soft)", font: "500 13px/1.4 var(--f-sans)" }}>
              Sin datos para este periodo.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--bg-elevated)" }}>
                  <th style={thStyle}>Ruta</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>ODs</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>On-time</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((r) => {
                  const tone = r.ontime_pct >= 90 ? "success" : r.ontime_pct >= 75 ? "warning" : "danger";
                  return (
                    <tr key={r.route_id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: 12, font: "600 13px/1.3 var(--f-sans)", color: "var(--ink)" }}>
                        <code style={{ font: "700 11.5px/1 var(--f-mono)", color: "var(--wine-text)", marginRight: 8 }}>
                          {r.route_code}
                        </code>
                        {r.route_name}
                      </td>
                      <td style={{ padding: 12, textAlign: "right", font: "800 14px/1 var(--f-display)", color: "var(--ink)" }}>
                        {r.ods}
                      </td>
                      <td style={{ padding: 12, textAlign: "right" }}>
                        <Badge tone={tone} size="sm">{r.ontime_pct}%</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Top cities */}
        <div
          style={{
            padding: 20,
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
          }}
        >
          <div className="studio-eyebrow" style={{ marginBottom: 14, color: "var(--wine-text)" }}>
            Top ciudades por volumen
          </div>
          {topCities.length === 0 ? (
            <div style={{ padding: "var(--s-8) 0", textAlign: "center", color: "var(--ink-soft)", font: "500 13px/1.4 var(--f-sans)" }}>
              Sin movimientos en el periodo.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {topCities.map((c, i) => {
                const max = Math.max(...topCities.map((x) => x.ods), 1);
                const pct = (c.ods / max) * 100;
                return (
                  <div key={c.city}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ font: "700 12.5px/1 var(--f-sans)", color: "var(--ink)" }}>{c.city}</span>
                      <span style={{ font: "700 12.5px/1 var(--f-mono)", color: "var(--wine-text)" }}>
                        {c.ods} ODs
                      </span>
                    </div>
                    <div
                      style={{
                        height: 6,
                        background: "var(--bg-elevated)",
                        borderRadius: 999,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${pct}%`,
                          background: i === 0 ? "var(--wine)" : "var(--wine-tint)",
                          borderRadius: 999,
                        }}
                      />
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginTop: 4,
                        font: "500 10.5px/1 var(--f-sans)",
                        color: "var(--ink-soft)",
                      }}
                    >
                      <span>{(c.kg / 1000).toFixed(1)} t total</span>
                      {c.late > 0 && (
                        <span style={{ color: "var(--warning)", font: "700 10.5px/1 var(--f-sans)" }}>
                          {c.late} tarde
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "wine" | "success" | "info" | "warning" | "neutral";
  icon?: React.ReactNode;
}) {
  const color: Record<typeof tone, string> = {
    wine: "var(--wine)",
    success: "var(--success)",
    info: "var(--info)",
    warning: "var(--warning)",
    neutral: "var(--ink-soft)",
  };
  const bgTone: Record<typeof tone, string> = {
    wine: "var(--wine-tint)",
    success: "var(--success-bg)",
    info: "var(--info-bg)",
    warning: "var(--warning-bg)",
    neutral: "var(--bg-elevated)",
  };
  return (
    <div
      style={{
        padding: 16,
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div
          style={{
            font: "700 9.5px/1 var(--f-sans)",
            color: "var(--ink-soft)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </div>
        {icon && (
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: "var(--r-sm)",
              background: bgTone[tone],
              color: color[tone],
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {icon}
          </span>
        )}
      </div>
      <div
        style={{
          font: "900 26px/1 var(--f-display)",
          color: color[tone],
          marginTop: 10,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
      <div
        style={{
          font: "500 11px/1.3 var(--f-sans)",
          color: "var(--ink-soft)",
          marginTop: 6,
        }}
      >
        {sub}
      </div>
    </div>
  );
}

const thStyle = {
  padding: "10px 12px",
  textAlign: "left" as const,
  font: "700 10.5px/1 var(--f-sans)",
  color: "var(--ink-soft)",
  letterSpacing: "0.1em",
  textTransform: "uppercase" as const,
};
