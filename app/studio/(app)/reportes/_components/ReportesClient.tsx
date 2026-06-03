"use client";

/**
 * Orquestador client del módulo Reportes & Analytics (SDD-0052 · Slice A).
 *
 * Estructura (Norte erp/modules/reports.jsx, anclada a datos reales):
 *  - Nivel 1: chips de categoría. Operacionales ACTIVA; las otras 4
 *    (Comerciales/Contables/Combinados/Constructor) deshabilitadas con rótulo
 *    "Próximamente · Slice B/C".
 *  - Nivel 2: tabs Overview / Rutas / Navieras / Servicios (por URL ?rep=).
 *  - Selector de período en el header (por URL ?period=).
 *
 * Solo primitivas del sistema + tokens var(--*). on-time OMITIDO (sin fuente).
 * Todos los agregados llegan ya calculados desde el server (page.tsx).
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { Badge } from "@/app/studio/_components/ui/Badge";
import {
  PERIOD_OPTIONS,
  type CarrierRow,
  type OperationalOverview,
  type ReportPeriod,
  type RouteRow,
  type ServiceRow,
} from "@/lib/studio/reports/types";
import { VolumeBars, Donut, Progress, type DonutSlice } from "./charts";

type OpReport = "overview" | "routes" | "carriers" | "services";

const OP_TABS: { value: OpReport; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "routes", label: "Por ruta" },
  { value: "carriers", label: "Por naviera" },
  { value: "services", label: "Por servicio" },
];

// Categorías nivel-1. Solo "op" operable en Slice A.
const CATEGORIES: {
  id: string;
  label: string;
  count: number;
  slice: string | null; // null = activa
}[] = [
  { id: "op", label: "Operacionales", count: 4, slice: null },
  { id: "com", label: "Comerciales", count: 2, slice: "Slice B" },
  { id: "con", label: "Contables & financieros", count: 3, slice: "Slice B" },
  { id: "mix", label: "Combinados", count: 3, slice: "Slice B" },
  { id: "build", label: "Constructor", count: 1, slice: "Slice C" },
];

const fmtUsd = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
      ? `$${Math.round(n / 1000)}K`
      : `$${Math.round(n).toLocaleString("en-US")}`;

const fmtNum = (n: number) => Math.round(n).toLocaleString("en-US");

export function ReportesClient({
  period,
  report,
  overview,
  routes,
  carriers,
  services,
}: {
  period: ReportPeriod;
  report: OpReport;
  overview: OperationalOverview;
  routes: RouteRow[];
  carriers: CarrierRow[];
  services: ServiceRow[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const navigate = (next: { period?: ReportPeriod; rep?: OpReport }) => {
    const s = new URLSearchParams(params.toString());
    if (next.period) s.set("period", next.period);
    if (next.rep) {
      if (next.rep === "overview") s.delete("rep");
      else s.set("rep", next.rep);
    }
    const qs = s.toString();
    startTransition(() => {
      router.push(qs ? `/studio/reportes?${qs}` : "/studio/reportes");
    });
  };

  return (
    <div style={{ maxWidth: 1280, opacity: isPending ? 0.6 : 1, transition: "opacity 120ms" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 24,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <div>
          <span className="studio-eyebrow">Analítica</span>
          <h1
            className="studio-display"
            style={{ fontSize: 30, margin: "8px 0 8px", color: "var(--ink)" }}
          >
            Reportes &amp; Analytics.
          </h1>
          <p
            style={{
              font: "400 13px/1.4 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
              maxWidth: "70ch",
            }}
          >
            Performance operativa sobre datos reales del ERP. Embarques, CBM
            movido y revenue facturado, cruzados por ruta, naviera y servicio.
          </p>
        </div>

        {/* Selector de período (navega por URL) */}
        <label
          style={{ display: "flex", flexDirection: "column", gap: 4 }}
          aria-label="Período del reporte"
        >
          <span
            style={{
              font: "700 9.5px/1 var(--f-sans)",
              color: "var(--ink-mute)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            Período
          </span>
          <select
            className="studio-input"
            value={period}
            onChange={(e) => navigate({ period: e.target.value as ReportPeriod })}
            style={{ width: 180 }}
          >
            {PERIOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Nivel 1 · categorías */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {CATEGORIES.map((c) => {
          const active = c.id === "op";
          const disabled = c.slice != null;
          return (
            <button
              key={c.id}
              type="button"
              disabled={disabled}
              title={disabled ? `Próximamente · ${c.slice}` : undefined}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                height: 38,
                padding: "0 16px",
                borderRadius: "var(--r-md)",
                cursor: disabled ? "not-allowed" : "pointer",
                background: active ? "var(--wine)" : "var(--bg-surface)",
                color: active
                  ? "var(--ink-inv)"
                  : disabled
                    ? "var(--ink-mute)"
                    : "var(--ink-soft)",
                border: `1px solid ${active ? "var(--wine)" : "var(--border-strong)"}`,
                font: "600 13px/1 var(--f-sans)",
                opacity: disabled ? 0.65 : 1,
              }}
            >
              {c.label}
              {disabled ? (
                <Badge tone="neutral" size="sm">
                  Pronto
                </Badge>
              ) : (
                <span
                  style={{
                    font: "700 10.5px/1 var(--f-mono)",
                    color: active ? "var(--ink-inv)" : "var(--ink-mute)",
                  }}
                >
                  {c.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Nivel 2 · reporte dentro de Operacionales */}
      <div
        role="tablist"
        style={{
          display: "flex",
          gap: 4,
          borderBottom: "1px solid var(--border)",
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        {OP_TABS.map((t) => {
          const on = t.value === report;
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => navigate({ rep: t.value })}
              style={{
                appearance: "none",
                background: "transparent",
                border: "none",
                borderBottom: `2px solid ${on ? "var(--wine)" : "transparent"}`,
                padding: "8px 14px",
                cursor: "pointer",
                font: `${on ? "700" : "500"} 13px/1 var(--f-sans)`,
                color: on ? "var(--ink)" : "var(--ink-soft)",
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Vistas */}
      {report === "overview" && <OverviewView overview={overview} />}
      {report === "routes" && <RoutesView routes={routes} />}
      {report === "carriers" && <CarriersView carriers={carriers} />}
      {report === "services" && <ServicesView services={services} />}
    </div>
  );
}

// ── Card helper (header eyebrow + cuerpo) ──────────────────────
function Card({
  eyebrow,
  title,
  children,
  style,
}: {
  eyebrow?: string;
  title?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: "18px 20px",
        ...style,
      }}
    >
      {eyebrow && (
        <div
          style={{
            font: "700 10px/1 var(--f-sans)",
            color: "var(--wine)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          {eyebrow}
        </div>
      )}
      {title && (
        <div
          style={{
            font: "900 16px/1.1 var(--f-display)",
            color: "var(--ink)",
            margin: "6px 0 16px",
          }}
        >
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

// ── Overview ───────────────────────────────────────────────────
function OverviewView({ overview }: { overview: OperationalOverview }) {
  const SERVICE_NONE = overview.shipments === 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
        }}
      >
        <KpiCard value={fmtNum(overview.shipments)} label="Embarques" sub="en el período" valueColor="var(--wine)" />
        <KpiCard value={fmtNum(overview.cbm)} label="CBM movido" sub="metros cúbicos" />
        <KpiCard value={fmtUsd(overview.revenueUsd)} label="Revenue" sub="facturado · USD" valueColor="var(--success)" />
        <KpiCard value={fmtNum(overview.active)} label="Activos" sub="en curso ahora" />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(360px, 2fr) minmax(260px, 1fr)",
          gap: 16,
        }}
      >
        <Card eyebrow="Volumen mensual" title="Embarques y CBM por mes">
          <VolumeBars points={overview.monthly} />
        </Card>

        <Card eyebrow="Split por destino">
          {overview.portSplit.length === 0 ? (
            <div style={{ font: "500 12.5px/1.4 var(--f-sans)", color: "var(--ink-mute)" }}>
              Sin embarques en el período.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {overview.portSplit.slice(0, 8).map((r) => (
                <div key={r.port}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ font: "600 12px/1.2 var(--f-sans)", color: "var(--ink)" }}>
                      {r.port}
                    </span>
                    <span style={{ font: "700 12px/1 var(--f-mono)", color: "var(--ink-soft)" }}>
                      {r.count} · {r.pct}%
                    </span>
                  </div>
                  <Progress value={r.pct} tone="var(--wine)" height={8} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card eyebrow="Días de tránsito promedio" title="Por destino (creación → arribo/entrega)">
        {overview.transitByPort.length === 0 ? (
          <div style={{ font: "500 12.5px/1.4 var(--f-sans)", color: "var(--ink-mute)" }}>
            Todavía no hay embarques con arribo o entrega registrados en el período.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 14,
            }}
          >
            {overview.transitByPort.slice(0, 8).map((p) => (
              <div
                key={p.port}
                style={{
                  padding: 16,
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-md)",
                }}
              >
                <div style={{ font: "600 12px/1.2 var(--f-sans)", color: "var(--ink-soft)", marginBottom: 8 }}>
                  {p.port}
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ font: "900 30px/1 var(--f-display)", color: "var(--ink)", letterSpacing: "-0.02em" }}>
                    {p.avgTransit ?? "—"}
                  </span>
                  <span style={{ font: "600 12px/1 var(--f-sans)", color: "var(--ink-soft)" }}>días</span>
                </div>
                <div style={{ marginTop: 6, font: "500 11px/1 var(--f-sans)", color: "var(--ink-mute)" }}>
                  {p.count} {p.count === 1 ? "embarque" : "embarques"}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Nota de honestidad: on-time omitido */}
      {!SERVICE_NONE && (
        <p style={{ font: "500 11.5px/1.5 var(--f-sans)", color: "var(--ink-mute)", margin: 0 }}>
          El indicador on-time se omite en esta versión: aún no hay campo ETA/SLA
          en los embarques. Las métricas mostradas son todas reales (sin mock).
        </p>
      )}
    </div>
  );
}

// ── Rutas ──────────────────────────────────────────────────────
function RoutesView({ routes }: { routes: RouteRow[] }) {
  if (routes.length === 0) {
    return (
      <EmptyState
        eyebrow="Por ruta"
        title="Sin embarques en el período"
        description="Cambiá el período o cargá embarques con origen y destino para ver el detalle por corredor."
      />
    );
  }
  const max = Math.max(1, ...routes.map((r) => r.revenue));

  return (
    <Card eyebrow="Detalle por ruta" style={{ padding: 0 }}>
      <HeaderRow
        cols="1.5fr 70px 80px 70px 1fr 90px"
        labels={["Origen → Destino", "Envíos", "CBM", "Días", "Revenue", "Tarifa"]}
        rightFrom={1}
        rightTo={3}
      />
      {routes.map((r, i) => (
        <div
          key={r.key}
          style={{
            display: "grid",
            gridTemplateColumns: "1.5fr 70px 80px 70px 1fr 90px",
            padding: "14px 18px",
            gap: 14,
            alignItems: "center",
            borderTop: "1px solid var(--border)",
          }}
        >
          <span style={{ font: "700 12.5px/1.3 var(--f-sans)", color: "var(--ink)" }}>
            {r.label}
          </span>
          <span style={{ font: "700 13px/1 var(--f-mono)", textAlign: "right", color: "var(--ink)" }}>
            {r.count}
          </span>
          <span style={{ font: "700 13px/1 var(--f-mono)", textAlign: "right", color: "var(--ink-soft)" }}>
            {fmtNum(r.cbm)}
          </span>
          <span style={{ font: "700 13px/1 var(--f-mono)", textAlign: "right", color: "var(--ink-soft)" }}>
            {r.avgTransit ?? "—"}
          </span>
          <div>
            <span style={{ font: "800 13px/1 var(--f-mono)", color: "var(--ink)" }}>
              {fmtUsd(r.revenue)}
            </span>
            <div style={{ marginTop: 5 }}>
              <Progress value={(r.revenue / max) * 100} tone="var(--wine)" height={3} />
            </div>
          </div>
          <span style={{ font: "700 12px/1 var(--f-mono)", color: "var(--wine)", textAlign: "right" }}>
            ${r.rate}/CBM
          </span>
        </div>
      ))}
    </Card>
  );
}

// ── Navieras ───────────────────────────────────────────────────
function CarriersView({ carriers }: { carriers: CarrierRow[] }) {
  if (carriers.length === 0) {
    return (
      <EmptyState
        eyebrow="Por naviera"
        title="Sin reservas ni itinerarios en el período"
        description="Cuando cargues bookings o sailings en Naviera & Consolidación, vas a ver acá el conteo por naviera. Métrica real, limitada hasta que haya volumen."
      />
    );
  }
  const maxBookings = Math.max(1, ...carriers.map((c) => c.bookings));

  return (
    <Card eyebrow="Performance por naviera" style={{ padding: 0 }}>
      <HeaderRow
        cols="200px 1fr 90px 90px"
        labels={["Naviera", "Volumen", "Bookings", "Itinerarios"]}
        rightFrom={2}
        rightTo={3}
      />
      {carriers.map((c) => (
        <div
          key={c.carrierId ?? c.name}
          style={{
            display: "grid",
            gridTemplateColumns: "200px 1fr 90px 90px",
            gap: 16,
            alignItems: "center",
            padding: "14px 18px",
            borderTop: "1px solid var(--border)",
          }}
        >
          <div style={{ font: "900 14px/1.1 var(--f-display)", color: "var(--ink)" }}>
            {c.name}
          </div>
          <Progress value={(c.bookings / maxBookings) * 100} tone="var(--wine)" height={8} />
          <span style={{ font: "800 14px/1 var(--f-mono)", color: "var(--ink)", textAlign: "right" }}>
            {c.bookings}
          </span>
          <span style={{ font: "700 13px/1 var(--f-mono)", color: "var(--ink-soft)", textAlign: "right" }}>
            {c.sailings}
          </span>
        </div>
      ))}
    </Card>
  );
}

// ── Servicios ──────────────────────────────────────────────────
function ServicesView({ services }: { services: ServiceRow[] }) {
  if (services.length === 0) {
    return (
      <EmptyState
        eyebrow="Por servicio"
        title="Sin embarques en el período"
        description="Cambiá el período o cargá embarques para ver el mix por tipo de servicio."
      />
    );
  }

  // Paleta tokenizada para el donut (sin colores inventados).
  const palette = ["var(--wine)", "var(--wine-soft)", "var(--ink)", "var(--ink-soft)"];
  const donut: DonutSlice[] = services.map((s, i) => ({
    label: s.label,
    value: s.count,
    color: palette[i % palette.length],
  }));
  const maxRev = Math.max(1, ...services.map((s) => s.revenue));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 1fr) minmax(300px, 1fr)", gap: 16 }}>
      <Card eyebrow="Mix de servicios">
        <Donut data={donut} />
      </Card>

      <Card eyebrow="Revenue por servicio">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {services.map((s, i) => (
            <div key={s.service}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ font: "700 13px/1 var(--f-sans)", color: "var(--ink)" }}>{s.label}</span>
                <span style={{ font: "800 14px/1 var(--f-mono)", color: "var(--ink)" }}>
                  {fmtUsd(s.revenue)}
                </span>
              </div>
              <Progress
                value={(s.revenue / maxRev) * 100}
                tone={palette[i % palette.length]}
                height={10}
              />
              <div style={{ marginTop: 5, font: "500 11px/1 var(--f-sans)", color: "var(--ink-mute)" }}>
                {s.count} {s.count === 1 ? "embarque" : "embarques"} · {fmtNum(s.cbm)} CBM
                {s.avgTransit != null ? ` · ${s.avgTransit} días prom.` : ""}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── Header de tabla reusable ───────────────────────────────────
function HeaderRow({
  cols,
  labels,
  rightFrom,
  rightTo,
}: {
  cols: string;
  labels: string[];
  rightFrom?: number;
  rightTo?: number;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: cols,
        padding: "10px 18px",
        gap: 14,
        background: "var(--bg-elevated)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {labels.map((h, i) => {
        const right =
          rightFrom != null && rightTo != null && i >= rightFrom && i <= rightTo;
        return (
          <span
            key={h}
            style={{
              font: "700 10px/1 var(--f-sans)",
              color: "var(--ink-soft)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              textAlign: right ? "right" : "left",
            }}
          >
            {h}
          </span>
        );
      })}
    </div>
  );
}
