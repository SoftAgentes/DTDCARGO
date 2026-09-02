"use client";

import { RovingTabList } from "@/app/studio/_components/ui/RovingTabList";

/**
 * Orquestador client del módulo Reportes & Analytics (SDD-0052 · Slices A+B).
 *
 * Estructura (Norte erp/modules/reports.jsx, anclada a datos reales):
 *  - Nivel 1: chips de categoría. Operacionales · Comerciales · Contables &
 *    financieros ACTIVAS; Combinados + Constructor deshabilitadas ("Pronto" ·
 *    Slice C). Navega por URL ?cat=.
 *  - Nivel 2: tabs por categoría (por URL ?rep=).
 *  - Selector de período en el header (por URL ?period=).
 *
 * Solo primitivas del sistema + tokens var(--*). Nunca se fabrica costo/margen
 * (regla §3.2): lo que no tiene fuente real va a EmptyState honesto u omitido.
 * Todos los agregados llegan ya calculados desde el server (page.tsx).
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useTransition } from "react";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { Badge, type BadgeTone } from "@/app/studio/_components/ui/Badge";
import { Avatar, type AvatarColor } from "@/app/studio/_components/ui/Avatar";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { downloadTextFile } from "@/app/studio/_components/ui/download";
import { Icon } from "@/app/studio/_components/icons";
import { buildViewCsv } from "@/lib/studio/reports/export-csv";
import {
  PERIOD_OPTIONS,
  type AgingReport,
  type AgingSide,
  type CarrierRow,
  type CashflowReport,
  type ClientMarginRow,
  type CombinedReport,
  type CommercialByAgent,
  type CommercialByClient,
  type IncomeStatement,
  type IvaPosition,
  type OperationalOverview,
  type PipelineReport,
  type RepurchaseReport,
  type ReportPeriod,
  type RouteCbmRow,
  type RouteMarginRow,
  type RouteRow,
  type ServiceRow,
} from "@/lib/studio/reports/types";
import {
  type BuilderRow,
  type ReportSourceId,
} from "@/lib/studio/reports/builder-types";
import { VolumeBars, Donut, Progress, HeaderRow, type DonutSlice } from "./charts";
import { BuilderView } from "./BuilderView";
import { fmtUsd, fmtUsdCompact } from "@/lib/money";

type Category = "op" | "com" | "con" | "build" | "mix";

// Tabs nivel-2 por categoría (value = ?rep=).
const TABS_BY_CATEGORY: Record<Category, { value: string; label: string }[]> = {
  op: [
    { value: "overview", label: "Overview" },
    { value: "routes", label: "Por ruta" },
    { value: "carriers", label: "Por naviera" },
    { value: "services", label: "Por servicio" },
  ],
  com: [
    { value: "by-client", label: "Por cliente" },
    { value: "by-agent", label: "Por agente" },
    { value: "repurchase", label: "Recompra" },
    { value: "pipeline", label: "Pipeline" },
  ],
  con: [
    { value: "income", label: "Estado de resultados" },
    { value: "aging", label: "Aging CxC/CxP" },
    { value: "iva", label: "Posición IVA" },
    { value: "cashflow", label: "Cashflow" },
  ],
  // El Constructor no tiene nivel-2 (la fuente/dim/métrica se eligen dentro).
  build: [],
  mix: [
    { value: "rent-route", label: "Rentabilidad por ruta" },
    { value: "margin-client", label: "Margen por cliente" },
    { value: "cost-cbm", label: "Costo por CBM" },
  ],
};

// Categorías nivel-1. op/com/con/build/mix operables (Slices A+B+C); todo activo.
const CATEGORIES: {
  id: string;
  label: string;
  count: number;
  slice: string | null; // null = activa
}[] = [
  { id: "op", label: "Operacionales", count: 4, slice: null },
  { id: "com", label: "Comerciales", count: 4, slice: null },
  { id: "con", label: "Contables & financieros", count: 4, slice: null },
  { id: "build", label: "Constructor", count: 2, slice: null },
  { id: "mix", label: "Combinados", count: 3, slice: null },
];

const fmtNum = (n: number) => Math.round(n).toLocaleString("en-US");

// Resuelve el rep activo dentro de la categoría (default = primer tab).
// El Constructor no tiene tabs nivel-2 → "" (la vista no depende del rep).
function resolveRep(category: Category, raw: string | undefined): string {
  const tabs = TABS_BY_CATEGORY[category];
  if (tabs.length === 0) return "";
  return tabs.some((t) => t.value === raw) ? (raw as string) : tabs[0].value;
}

export function ReportesClient({
  period,
  category,
  rep,
  overview,
  routes,
  carriers,
  services,
  byClient,
  byAgent,
  repurchase,
  pipeline,
  income,
  aging,
  cashflow,
  iva,
  builderSource,
  builderData,
  combined,
}: {
  period: ReportPeriod;
  category: Category;
  rep?: string;
  // Operacionales (Slice A)
  overview?: OperationalOverview;
  routes?: RouteRow[];
  carriers?: CarrierRow[];
  services?: ServiceRow[];
  // Comerciales (Slice B + paridad Norte)
  byClient?: CommercialByClient;
  byAgent?: CommercialByAgent;
  repurchase?: RepurchaseReport;
  pipeline?: PipelineReport;
  // Contables (Slice B + paridad Norte)
  income?: IncomeStatement;
  aging?: AgingReport;
  cashflow?: CashflowReport;
  iva?: IvaPosition;
  // Constructor (Slice C)
  builderSource?: ReportSourceId;
  builderData?: BuilderRow[];
  // Combinados (Slice C)
  combined?: CombinedReport;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const activeRep = resolveRep(category, rep);

  const navigate = (next: {
    period?: ReportPeriod;
    cat?: Category;
    rep?: string;
    src?: ReportSourceId;
  }) => {
    const s = new URLSearchParams(params.toString());
    if (next.period) s.set("period", next.period);
    if (next.cat) {
      s.set("cat", next.cat);
      s.delete("rep"); // al cambiar de categoría, default = primer tab
      s.delete("src"); // y reseteamos la fuente del constructor
    }
    if (next.rep) {
      const tabs = TABS_BY_CATEGORY[next.cat ?? category];
      if (tabs.length > 0 && next.rep === tabs[0].value) s.delete("rep");
      else s.set("rep", next.rep);
    }
    if (next.src) {
      if (next.src === "shipments") s.delete("src"); // default
      else s.set("src", next.src);
    }
    const qs = s.toString();
    startTransition(() => {
      router.push(qs ? `/studio/reportes?${qs}` : "/studio/reportes");
    });
  };

  const tabs = TABS_BY_CATEGORY[category];

  // El selector de período es INERTE en las vistas que NO filtran por rango:
  //  - Comerciales · Por cliente → ranking trailing 12 meses (a hoy).
  //  - Contables · Aging → posición a hoy (saldos vivos).
  // En esas vistas mostramos un rótulo fijo en vez de un select que no hace nada.
  const inertReason =
    category === "com"
      ? activeRep === "pipeline"
        ? null // el pipeline SÍ filtra estimados por período
        : activeRep === "repurchase"
          ? "a hoy" // recompra = snapshot por embarque a hoy
          : "trailing 12m"
      : category === "con" && activeRep === "aging"
        ? "a hoy"
        : null;

  // CSV de la vista activa (op/com/con/mix). null = nada que exportar (vista
  // vacía). El Constructor (build) se autogestiona dentro de BuilderView.
  const viewCsv = useMemo(
    () =>
      buildViewCsv({
        category,
        rep: activeRep,
        overview,
        routes,
        carriers,
        services,
        byClient,
        byAgent,
        repurchase,
        pipeline,
        income,
        aging,
        cashflow,
        iva,
        combined,
      }),
    [
      category,
      activeRep,
      overview,
      routes,
      carriers,
      services,
      byClient,
      byAgent,
      repurchase,
      pipeline,
      income,
      aging,
      cashflow,
      iva,
      combined,
    ],
  );

  return (
    <div style={{ maxWidth: 1280, opacity: isPending ? 0.6 : 1, transition: "opacity var(--dur-fast) var(--ease)" }}>
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
            style={{ fontSize: 30, margin: "var(--s-2) 0 var(--s-2)", color: "var(--ink)" }}
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
            Performance del ERP sobre datos reales. Operación, comercial y
            finanzas cruzados — facturado, cobrado, aging y rentabilidad
            facturada, sin estimaciones inventadas.
          </p>
        </div>

        {/* Export CSV de la vista activa + selector de período */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
          {category !== "build" && (
            <ActionButton
              variant="ghost"
              size="sm"
              idleLabel="Exportar CSV"
              idleIcon={Icon.download(14)}
              successLabel="Descargado"
              successIcon={Icon.check(14)}
              disabled={!viewCsv}
              title={
                viewCsv
                  ? "Exportar la vista activa a CSV"
                  : "No hay datos para exportar en esta vista"
              }
              onAction={async () => {
                if (!viewCsv) {
                  return { error: "No hay datos para exportar en esta vista." };
                }
                downloadTextFile(viewCsv.filename, viewCsv.content);
              }}
            />
          )}
          {/* Selector de período (navega por URL). Inerte → rótulo fijo. */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span
            style={{
              font: "700 9.5px/1 var(--f-sans)",
              color: "var(--ink-soft)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            Período
          </span>
          {inertReason ? (
            <div
              title="Esta vista no filtra por período"
              style={{
                width: 180,
                height: 38,
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "0 var(--s-3)",
                borderRadius: "var(--r-md)",
                border: "1px dashed var(--border-strong)",
                background: "var(--bg-elevated)",
                font: "600 12.5px/1 var(--f-sans)",
                color: "var(--ink-soft)",
              }}
            >
              <span>· {inertReason}</span>
            </div>
          ) : (
            <select
              className="studio-input"
              aria-label="Período del reporte"
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
          )}
          </div>
        </div>
      </div>

      {/* Nivel 1 · categorías */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {CATEGORIES.map((c) => {
          const active = c.id === category;
          const disabled = c.slice != null;
          return (
            <button
              key={c.id}
              type="button"
              disabled={disabled}
              title={disabled ? `Próximamente · ${c.slice}` : undefined}
              onClick={() =>
                !disabled && !active && navigate({ cat: c.id as Category })
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                height: 38,
                padding: "0 var(--s-4)",
                borderRadius: "var(--r-md)",
                cursor: disabled ? "not-allowed" : active ? "default" : "pointer",
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

      {/* Nivel 2 · reporte dentro de la categoría (el Constructor no tiene tabs) */}
      {tabs.length > 0 && (
      <RovingTabList
        aria-label="Reportes de la categoría"
        style={{
          display: "flex",
          gap: 4,
          borderBottom: "1px solid var(--border)",
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        {tabs.map((t) => {
          const on = t.value === activeRep;
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
      </RovingTabList>
      )}

      {/* Vistas · Operacionales (Slice A) */}
      {category === "op" && activeRep === "overview" && overview && (
        <OverviewView overview={overview} />
      )}
      {category === "op" && activeRep === "routes" && routes && (
        <RoutesView routes={routes} />
      )}
      {category === "op" && activeRep === "carriers" && carriers && (
        <CarriersView carriers={carriers} />
      )}
      {category === "op" && activeRep === "services" && services && (
        <ServicesView services={services} />
      )}

      {/* Vistas · Comerciales (Slice B + paridad Norte) */}
      {category === "com" && activeRep === "by-client" && byClient && (
        <ByClientView data={byClient} />
      )}
      {category === "com" && activeRep === "by-agent" && byAgent && (
        <ByAgentView data={byAgent} />
      )}
      {category === "com" && activeRep === "repurchase" && repurchase && (
        <RepurchaseView data={repurchase} />
      )}
      {category === "com" && activeRep === "pipeline" && pipeline && (
        <PipelineView data={pipeline} />
      )}

      {/* Vistas · Contables & financieros (Slice B + paridad Norte) */}
      {category === "con" && activeRep === "income" && income && (
        <IncomeStatementView income={income} />
      )}
      {category === "con" && activeRep === "aging" && aging && (
        <AgingView aging={aging} />
      )}
      {category === "con" && activeRep === "iva" && iva && (
        <IvaView iva={iva} />
      )}
      {category === "con" && activeRep === "cashflow" && cashflow && (
        <CashflowView cashflow={cashflow} />
      )}

      {/* Vista · Constructor (Slice C) · key=source → remonta y resetea los
          selectores (dim/métrica/filtro) al cambiar de fuente, sin efecto. */}
      {category === "build" && builderSource && builderData && (
        <BuilderView
          key={builderSource}
          source={builderSource}
          rows={builderData}
          period={period}
          onSource={(src) => navigate({ src })}
        />
      )}

      {/* Vistas · Combinados (Slice C) · rentabilidad REAL desde Costing */}
      {category === "mix" && combined && (
        <CombinedView combined={combined} rep={activeRep} />
      )}
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
            color: "var(--wine-text)",
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
  // Chips informativos de "sin asignar": nada queda oculto pero el KPI de revenue
  // (= revenue atribuible a embarques del rango) sigue limpio. Solo se muestran
  // cuando hay algo que reportar (no ensuciar la vista limpia).
  const showUnassigned = overview.unassigned.count > 0;
  const showOrphan = overview.orphanRevenueUsd > 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
        }}
      >
        <KpiCard value={fmtNum(overview.shipments)} label="Embarques" sub="en el período" valueColor="var(--wine-text)" />
        <KpiCard value={fmtNum(overview.cbm)} label="CBM movido" sub="metros cúbicos" />
        <KpiCard value={fmtUsdCompact(overview.revenueUsd)} label="Revenue" sub="facturado · USD" valueColor="var(--success)" />
        <KpiCard value={fmtNum(overview.active)} label="Activos" sub="en curso ahora" />
      </div>

      {(showUnassigned || showOrphan) && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: -10 }}>
          {showUnassigned && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 12px",
                borderRadius: "var(--r-md)",
                border: "1px solid var(--border)",
                background: "var(--bg-surface)",
                font: "500 12px/1 var(--f-sans)",
                color: "var(--ink-soft)",
              }}
            >
              Sin cliente asignado · {fmtNum(overview.unassigned.count)}{" "}
              {overview.unassigned.count === 1 ? "embarque" : "embarques"} ·{" "}
              {fmtNum(overview.unassigned.cbm)} CBM
            </span>
          )}
          {showOrphan && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 12px",
                borderRadius: "var(--r-md)",
                border: "1px solid var(--border)",
                background: "var(--bg-surface)",
                font: "500 12px/1 var(--f-sans)",
                color: "var(--ink-soft)",
              }}
            >
              Facturado sin embarque del período ·{" "}
              <strong style={{ font: "700 12px/1 var(--f-mono)", color: "var(--ink)" }}>
                {fmtUsdCompact(overview.orphanRevenueUsd)}
              </strong>
            </span>
          )}
        </div>
      )}

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
            <div style={{ font: "500 12.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
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
          <div style={{ font: "500 12.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
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
                <div style={{ marginTop: 6, font: "500 11px/1 var(--f-sans)", color: "var(--ink-soft)" }}>
                  {p.count} {p.count === 1 ? "embarque" : "embarques"}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Nota de honestidad: on-time omitido */}
      {!SERVICE_NONE && (
        <p style={{ font: "500 11.5px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
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
        description="Cambia el período o carga embarques con origen y destino para ver el detalle por corredor."
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
      {routes.map((r) => (
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
              {fmtUsdCompact(r.revenue)}
            </span>
            <div style={{ marginTop: 5 }}>
              <Progress value={(r.revenue / max) * 100} tone="var(--wine)" height={3} />
            </div>
          </div>
          <span style={{ font: "700 12px/1 var(--f-mono)", color: "var(--wine-text)", textAlign: "right" }}>
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
        description="Cambia el período o carga embarques para ver el mix por tipo de servicio."
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
                  {fmtUsdCompact(s.revenue)}
                </span>
              </div>
              <Progress
                value={(s.revenue / maxRev) * 100}
                tone={palette[i % palette.length]}
                height={10}
              />
              <div style={{ marginTop: 5, font: "500 11px/1 var(--f-sans)", color: "var(--ink-soft)" }}>
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

// ═══════════════════════════════════════════════════════════════
// Slice B — Comerciales · Por cliente
// ═══════════════════════════════════════════════════════════════
function ByClientView({ data }: { data: CommercialByClient }) {
  if (data.totalClients === 0) {
    return (
      <EmptyState
        eyebrow="Por cliente"
        title="Todavía no hay clientes"
        description="Cuando registres clientes y emitas facturas, vas a ver acá el ranking por facturación y la distribución por nivel."
      />
    );
  }

  const ranked = data.ranking.filter((r) => r.billedUsd > 0);
  const maxBilled = Math.max(1, ...ranked.map((r) => r.billedUsd));
  const top = ranked.slice(0, 15);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
        }}
      >
        <KpiCard value={fmtNum(data.totalClients)} label="Clientes" sub="en cartera" valueColor="var(--wine-text)" />
        <KpiCard value={fmtNum(ranked.length)} label="Con facturación" sub="últimos 12 meses" />
        <KpiCard value={fmtUsdCompact(data.totalBilledUsd)} label="Facturado" sub="trailing 12m · USD" valueColor="var(--success)" />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(360px, 2fr) minmax(240px, 1fr)",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* Ranking */}
        <Card eyebrow="Ranking por facturación" style={{ padding: 0 }}>
          {ranked.length === 0 ? (
            <div style={{ padding: "18px 20px", font: "500 12.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
              Hay clientes pero ninguno con facturación en los últimos 12 meses.
            </div>
          ) : (
            <>
              <HeaderRow
                cols="40px 1fr 90px 1fr"
                labels={["#", "Cliente", "Nivel", "Facturado 12m"]}
                rightFrom={3}
                rightTo={3}
              />
              {top.map((r, i) => (
                <div
                  key={r.markbox || r.name || i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "40px 1fr 90px 1fr",
                    gap: 14,
                    alignItems: "center",
                    padding: "12px 18px",
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <span style={{ font: "700 12px/1 var(--f-mono)", color: "var(--ink-soft)" }}>
                    {i + 1}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ font: "700 13px/1.2 var(--f-sans)", color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.name || "Sin nombre"}
                    </div>
                    {r.markbox && (
                      <div style={{ font: "600 10.5px/1.2 var(--f-mono)", color: "var(--ink-soft)" }}>
                        {r.markbox}
                      </div>
                    )}
                  </div>
                  <div>
                    <Badge tone={r.tierTone as BadgeTone} size="sm">
                      {r.tierLabel}
                    </Badge>
                  </div>
                  <div>
                    <span style={{ font: "800 13px/1 var(--f-mono)", color: "var(--ink)" }}>
                      {fmtUsdCompact(r.billedUsd)}
                    </span>
                    <div style={{ marginTop: 5 }}>
                      <Progress value={(r.billedUsd / maxBilled) * 100} tone="var(--wine)" height={3} />
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </Card>

        {/* Distribución por tier */}
        <Card eyebrow="Distribución por nivel">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {data.tierDist.map((t) => (
              <div key={t.tierId}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <Badge tone={t.tone as BadgeTone} size="sm">
                    {t.label}
                  </Badge>
                  <span style={{ font: "700 12px/1 var(--f-mono)", color: "var(--ink-soft)" }}>
                    {t.count} · {t.pct}%
                  </span>
                </div>
                <Progress value={t.pct} tone="var(--wine)" height={8} />
              </div>
            ))}
          </div>
          <p style={{ font: "500 11px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: "14px 0 0" }}>
            El nivel se deriva de la facturación de los últimos 12 meses
            (USD-normalizada). Sin segmentación ni atribución de agente: esas
            métricas no tienen fuente real todavía.
          </p>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Paridad Norte — Comerciales · Por agente
// ═══════════════════════════════════════════════════════════════
//
// Espejo Kommo (leads por asesor + estado) cruzado con la facturación real del
// ERP. El "revenue" es plata real (trailing 12m) de los clientes convertidos por
// el asesor — no el price de Kommo ni un mock. NPS/tickets del Norte se omiten
// (sin fuente real).
const AGENT_AVATAR_COLORS: AvatarColor[] = ["wine", "info", "success", "warning", "neutral"];

function agentInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function ByAgentView({ data }: { data: CommercialByAgent }) {
  if (!data.hasKommo || data.rows.length === 0) {
    return (
      <EmptyState
        eyebrow="Por agente"
        title="Sin datos de asesores todavía"
        description="El desempeño por agente lee el espejo del CRM (leads por asesor) cruzado con la facturación real del ERP. Cuando el CRM esté sincronizado con leads asignados, vas a ver acá estimados, conversión y revenue por asesor."
      />
    );
  }

  const rows = data.rows;
  const maxRev = Math.max(1, ...rows.map((r) => r.revenueUsd));
  const t = data.totals;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* KPIs de equipo */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
        }}
      >
        <KpiCard value={fmtNum(t.leads)} label="Estimados" sub="leads asignados" valueColor="var(--wine-text)" />
        <KpiCard value={fmtNum(t.won)} label="Ganadas" sub={`${t.convPct}% conv. promedio`} valueColor="var(--success)" />
        <KpiCard value={fmtNum(t.clients)} label="Convertidos" sub="a cliente del ERP" />
        <KpiCard value={fmtUsdCompact(t.revenueUsd)} label="Revenue equipo" sub="facturado 12m · USD" valueColor="var(--success)" />
      </div>

      <Card eyebrow="Performance por agente" style={{ padding: 0 }}>
        <HeaderRow
          cols="44px 1fr 70px 70px 70px 1.2fr"
          labels={["", "Agente", "Estim.", "Ganadas", "Conv.", "Revenue"]}
          rightFrom={2}
          rightTo={4}
        />
        {rows.map((r, i) => (
          <div
            key={r.agentId ?? `none-${i}`}
            style={{
              display: "grid",
              gridTemplateColumns: "44px 1fr 70px 70px 70px 1.2fr",
              padding: "14px 18px",
              gap: 14,
              alignItems: "center",
              borderTop: "1px solid var(--border)",
            }}
          >
            <Avatar
              initials={agentInitials(r.name)}
              color={AGENT_AVATAR_COLORS[i % AGENT_AVATAR_COLORS.length]}
              size={38}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ font: "700 13px/1.2 var(--f-sans)", color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.name}
              </div>
              <div style={{ font: "500 11px/1 var(--f-sans)", color: "var(--ink-soft)", marginTop: 3 }}>
                {fmtNum(r.clients)} {r.clients === 1 ? "cliente" : "clientes"} · {fmtNum(r.lost)} {r.lost === 1 ? "perdida" : "perdidas"}
              </div>
            </div>
            <span style={{ font: "700 13px/1 var(--f-mono)", textAlign: "right", color: "var(--ink)" }}>
              {fmtNum(r.leads)}
            </span>
            <span style={{ font: "700 13px/1 var(--f-mono)", textAlign: "right", color: "var(--ink)" }}>
              {fmtNum(r.won)}
            </span>
            <span
              style={{
                font: "700 13px/1 var(--f-mono)",
                textAlign: "right",
                color: r.convPct >= 40 ? "var(--success)" : r.convPct > 0 ? "var(--warning)" : "var(--ink-mute)",
              }}
            >
              {r.convPct}%
            </span>
            <div>
              <span style={{ font: "800 13px/1 var(--f-mono)", color: "var(--ink)" }}>
                {fmtUsdCompact(r.revenueUsd)}
              </span>
              <div style={{ marginTop: 5 }}>
                <Progress value={(r.revenueUsd / maxRev) * 100} tone="var(--wine)" height={3} />
              </div>
            </div>
          </div>
        ))}
      </Card>

      <p style={{ font: "500 11.5px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
        Estimados = leads asignados al asesor en el CRM; ganadas/perdidas por los
        estados de cierre del CRM. El revenue es facturación real del ERP
        (últimos 12 meses, USD) de los leads que se convirtieron en cliente —{" "}
        <strong style={{ color: "var(--ink-soft)", fontWeight: 700 }}>no el valor estimado del CRM</strong>.
        NPS y satisfacción se omiten: no hay fuente real todavía.
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// F1-T07 — Comerciales · Recompra (la fuga #1)
// ═══════════════════════════════════════════════════════════════
//
// Clientes cuyo último embarque quedó atrás sin uno nuevo. Medida POR EMBARQUE
// (decisión founder 19-jul): días desde el último cierre (entregado/arribado). Los
// que tienen un embarque en curso no cuentan como fuga.
function RepurchaseView({ data }: { data: RepurchaseReport }) {
  const toneFor = (b: "window" | "overdue"): BadgeTone =>
    b === "overdue" ? "danger" : "warning";
  const labelFor = (b: "window" | "overdue"): string =>
    b === "overdue" ? "Vencida" : "Ventana";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
        }}
      >
        <KpiCard value={fmtNum(data.overdueCount)} label={`Vencidos (≥${data.overdueDays}d)`} sub="recompra perdida" valueColor="var(--danger)" />
        <KpiCard value={fmtNum(data.windowCount)} label={`En ventana (${data.windowDays}–${data.overdueDays}d)`} sub="contactar ya" valueColor="var(--wine-text)" />
        <KpiCard value={fmtNum(data.activeCount)} label="En curso" sub="con embarque activo" valueColor="var(--success)" />
        <KpiCard value={fmtNum(data.totalWithHistory)} label="Con historial" sub="al menos 1 embarque" />
      </div>

      {data.rows.length === 0 ? (
        <EmptyState
          eyebrow="Recompra"
          title="Nadie en ventana ni vencido"
          description={`Ningún cliente cerrado lleva ${data.windowDays}+ días sin un embarque nuevo. Cuando la operación arranque, acá van a aparecer los clientes a recontactar antes de que se enfríen.`}
        />
      ) : (
        <Card eyebrow="A recontactar" title={`Sin comprar hace ${data.windowDays}+ días`} style={{ padding: 0 }}>
          <HeaderRow
            cols="1fr 130px 90px 90px"
            labels={["Cliente", "Último embarque", "Días", "Estado"]}
            rightFrom={2}
            rightTo={2}
          />
          {data.rows.slice(0, 50).map((r, i) => (
            <div
              key={r.markbox || r.name || i}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 130px 90px 90px",
                gap: 14,
                alignItems: "center",
                padding: "12px 18px",
                borderTop: "1px solid var(--border)",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ font: "700 13px/1.2 var(--f-sans)", color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.name}
                </div>
                {r.markbox && (
                  <div style={{ font: "600 10.5px/1.2 var(--f-mono)", color: "var(--ink-soft)" }}>
                    {r.markbox}
                  </div>
                )}
              </div>
              <span style={{ font: "600 12px/1 var(--f-mono)", color: "var(--ink-soft)" }}>
                {r.lastCode || "—"}
              </span>
              <span
                style={{
                  font: "800 13px/1 var(--f-mono)",
                  textAlign: "right",
                  color: r.bucket === "overdue" ? "var(--danger)" : "var(--wine-text)",
                }}
              >
                {fmtNum(r.daysSince)}
              </span>
              <div>
                <Badge tone={toneFor(r.bucket)} size="sm">
                  {labelFor(r.bucket)}
                </Badge>
              </div>
            </div>
          ))}
        </Card>
      )}

      <p style={{ font: "500 11.5px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
        Recompra medida <strong style={{ color: "var(--ink-soft)", fontWeight: 700 }}>por embarque</strong>:
        días desde el último embarque cerrado (entregado/arribado) de cada cliente. Quien tiene un
        embarque en curso no cuenta como fuga. Ventana = {data.windowDays}–{data.overdueDays} días;
        vencida = {data.overdueDays}+ días. Las facturas serán la 2ª fuente cuando el financiero
        arranque.
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// F1-T07 — Comerciales · Pipeline de estimados
// ═══════════════════════════════════════════════════════════════
//
// CBM/USD de estimados vivos (draft+sent) del período vs la meta de 133 CBM/mes
// (2 contenedores). El desglose por estado muestra la actividad comercial del rango.
function PipelineView({ data }: { data: PipelineReport }) {
  const empty = data.byStatus.every((s) => s.count === 0);
  if (empty) {
    return (
      <EmptyState
        eyebrow="Pipeline"
        title="Sin estimados en el período"
        description="Cuando el asesor empiece a cargar estimados en el cotizador, acá vas a ver el CBM y USD en pipeline por estado, y qué tan cerca está de la meta de 133 CBM/mes."
      />
    );
  }
  const maxUsd = Math.max(1, ...data.byStatus.map((s) => s.usd));
  const pct = Math.min(100, data.pctOfTarget);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
        }}
      >
        <KpiCard value={fmtNum(data.openCbm)} label="CBM en pipeline" sub={`${fmtNum(data.openCount)} estimados abiertos`} valueColor="var(--wine-text)" />
        <KpiCard value={fmtUsdCompact(data.openUsd)} label="USD en pipeline" sub="borrador + enviadas" />
        <KpiCard
          value={`${data.pctOfTarget}%`}
          label="De la meta"
          sub={`${fmtNum(data.avgMonthlyOpenCbm)} vs ${data.monthlyTargetCbm} CBM/mes`}
          valueColor={data.pctOfTarget >= 100 ? "var(--success)" : "var(--wine-text)"}
        />
        <KpiCard value={fmtUsdCompact(data.wonUsd)} label="Aceptado" sub={`${fmtNum(data.wonCount)} en el período`} valueColor="var(--success)" />
      </div>

      <Card eyebrow="Avance vs meta" title={`${fmtNum(data.avgMonthlyOpenCbm)} de ${data.monthlyTargetCbm} CBM/mes`}>
        <Progress value={pct} tone={data.pctOfTarget >= 100 ? "var(--success)" : "var(--wine)"} height={12} />
        <p style={{ font: "500 11.5px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: "12px 0 0" }}>
          Pipeline abierto de {fmtNum(data.avgMonthlyOpenCbm)} CBM/mes en promedio sobre {data.months}{" "}
          {data.months === 1 ? "mes" : "meses"} del período, contra la meta de {data.monthlyTargetCbm}{" "}
          CBM/mes (2 contenedores). Solo cuentan estimados en borrador o enviados (todavía abiertos).
        </p>
      </Card>

      <Card eyebrow="Por estado del estimado" style={{ padding: 0 }}>
        <HeaderRow
          cols="1fr 80px 90px 1fr"
          labels={["Estado", "Cantidad", "CBM", "USD"]}
          rightFrom={1}
          rightTo={2}
        />
        {data.byStatus.map((s) => (
          <div
            key={s.status}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 80px 90px 1fr",
              gap: 14,
              alignItems: "center",
              padding: "12px 18px",
              borderTop: "1px solid var(--border)",
              opacity: s.count === 0 ? 0.5 : 1,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Badge tone={s.tone as BadgeTone} size="sm">
                {s.label}
              </Badge>
              {s.open && (
                <span style={{ font: "600 10px/1 var(--f-sans)", color: "var(--wine-text)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  abierto
                </span>
              )}
            </div>
            <span style={{ font: "700 13px/1 var(--f-mono)", textAlign: "right", color: "var(--ink)" }}>
              {fmtNum(s.count)}
            </span>
            <span style={{ font: "700 13px/1 var(--f-mono)", textAlign: "right", color: "var(--ink-soft)" }}>
              {fmtNum(s.cbm)}
            </span>
            <div>
              <span style={{ font: "800 13px/1 var(--f-mono)", color: "var(--ink)" }}>{fmtUsdCompact(s.usd)}</span>
              <div style={{ marginTop: 5 }}>
                <Progress value={(s.usd / maxUsd) * 100} tone="var(--wine)" height={3} />
              </div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Slice B — Contables · Estado de resultados
// ═══════════════════════════════════════════════════════════════
function IncomeStatementView({ income }: { income: IncomeStatement }) {
  const empty = income.income === 0 && income.netIncome === 0;
  if (empty) {
    return (
      <EmptyState
        eyebrow="Estado de resultados"
        title="Sin movimiento contable en el período"
        description="Cuando haya asientos asentados (ingresos, costos y gastos) en el rango, vas a ver acá el estado de resultados gerencial en USD."
      />
    );
  }

  return (
    <Card eyebrow="Estado de resultados" title="Gerencial · USD funcional" style={{ maxWidth: 680, padding: 0 }}>
      <div style={{ padding: "0 0 var(--s-2)" }}>
        {income.rows.map((row) => (
          <div
            key={row.label}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 130px 70px",
              gap: 12,
              alignItems: "center",
              padding: "13px 20px",
              borderTop: "1px solid var(--border)",
              background: row.emphasis ? "var(--bg-elevated)" : "transparent",
            }}
          >
            <span
              style={{
                font: `${row.emphasis ? "800" : "500"} 13px/1.2 var(--f-sans)`,
                color: row.emphasis ? "var(--ink)" : "var(--ink-soft)",
              }}
            >
              {row.label}
            </span>
            <span
              style={{
                font: `${row.emphasis ? "900" : "700"} 14px/1 var(--f-mono)`,
                color:
                  row.amount < 0
                    ? "var(--danger)"
                    : row.emphasis
                      ? "var(--ink)"
                      : "var(--ink-soft)",
                textAlign: "right",
              }}
            >
              {fmtUsd(row.amount)}
            </span>
            <span style={{ font: "600 11.5px/1 var(--f-mono)", color: "var(--ink-soft)", textAlign: "right" }}>
              {row.pct != null ? `${row.pct}%` : "—"}
            </span>
          </div>
        ))}
      </div>
      <p style={{ font: "500 11px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: "var(--s-2) var(--s-5) var(--s-4)" }}>
        Cálculo reusado de Contabilidad sobre los saldos del período
        ({income.range.from} → {income.range.to}). Reporte gerencial, no fiscal.
      </p>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// Slice B — Contables · Aging CxC/CxP
// ═══════════════════════════════════════════════════════════════
function AgingView({ aging }: { aging: AgingReport }) {
  const empty = aging.cxc.total === 0 && aging.cxp.total === 0;
  if (empty) {
    return (
      <EmptyState
        eyebrow="Aging CxC/CxP"
        title="Sin saldos por cobrar ni por pagar"
        description="Cuando haya facturas con saldo (CxC) o cuentas por pagar abiertas (CxP), vas a ver acá la antigüedad de saldos por tramo."
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 16 }}>
        <AgingSideCard
          eyebrow="Cuentas por cobrar"
          title="Antigüedad de CxC"
          side={aging.cxc}
          emptyLabel="Sin saldos por cobrar."
        />
        <AgingSideCard
          eyebrow="Cuentas por pagar"
          title="Antigüedad de CxP"
          side={aging.cxp}
          emptyLabel="Sin saldos por pagar."
        />
      </div>
      <p style={{ font: "500 11.5px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
        Saldos normalizados a USD (VES por fx del documento).{" "}
        <strong style={{ color: "var(--ink-soft)", fontWeight: 700 }}>CNY no incluido en V1.</strong>{" "}
        Vencido por días (≥1 día desde el vencimiento); Cobranzas pondera además
        las promesas de pago vigentes, por eso su vencido puede ser menor.
      </p>
    </div>
  );
}

function AgingSideCard({
  eyebrow,
  title,
  side,
  emptyLabel,
}: {
  eyebrow: string;
  title: string;
  side: AgingSide;
  emptyLabel: string;
}) {
  // Tono por tramo: escala semántica del sistema (corriente neutro → atención →
  // alarma), no un color por tramo inventado.
  const tones: Record<string, string> = {
    current: "var(--ink-soft)",
    b1_30: "var(--info)",
    b31_60: "var(--warning)",
    b60_plus: "var(--danger)",
  };

  return (
    <Card eyebrow={eyebrow} title={title}>
      {side.total === 0 ? (
        <div style={{ font: "500 12.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
          {emptyLabel}
        </div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
            <div>
              <div style={{ font: "900 26px/1 var(--f-display)", color: "var(--ink)", letterSpacing: "-0.02em" }}>
                {fmtUsd(side.total)}
              </div>
              <div style={{ font: "600 11px/1 var(--f-sans)", color: "var(--ink-soft)", marginTop: 4 }}>
                Total
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  font: "800 18px/1 var(--f-mono)",
                  color: side.overdue > 0 ? "var(--danger)" : "var(--ink-soft)",
                }}
              >
                {fmtUsd(side.overdue)}
              </div>
              <div style={{ font: "600 11px/1 var(--f-sans)", color: "var(--ink-soft)", marginTop: 4 }}>
                Vencido
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {side.buckets.map((b) => (
              <div key={b.id}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ font: "600 12px/1.2 var(--f-sans)", color: "var(--ink)" }}>
                    {b.label}
                  </span>
                  <span style={{ font: "700 12px/1 var(--f-mono)", color: "var(--ink-soft)" }}>
                    {fmtUsd(b.amount)} · {b.pct}%
                  </span>
                </div>
                <Progress value={b.pct} tone={tones[b.id]} height={8} />
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// Paridad Norte — Contables · Posición de IVA (débito − crédito)
// ═══════════════════════════════════════════════════════════════
//
// Débito = IVA en ventas real (facturas clasificadas por la config fiscal SDD-0073);
// crédito = IVA en compras (V1: 0, supplier_bills no discrimina IVA). Con el módulo
// fiscal OFF (DTD hoy) el débito es 0 (ventas exentas): la vista lo dice sin fingir.
function IvaView({ iva }: { iva: IvaPosition }) {
  const noOps = iva.salesRows === 0 && iva.purchaseRows === 0;
  if (noOps) {
    return (
      <EmptyState
        eyebrow="Posición IVA"
        title="Sin operaciones en el período"
        description="Cuando haya facturas de venta emitidas o compras registradas en el rango, vas a ver acá el débito y crédito fiscal, la cuota tributaria y el IVA a pagar o el excedente a favor."
      />
    );
  }

  const aPagar = iva.aPagar > 0;
  const outcomeValue = aPagar ? iva.aPagar : iva.excedente;
  const mixedCurrency = iva.currencies.length > 1;
  const noCredit = iva.purchaseRows > 0 && iva.purchaseRowsWithIva === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* KPIs de la declaración */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
        }}
      >
        <KpiCard value={fmtUsd(iva.debito)} label="Débito fiscal" sub="IVA en ventas" valueColor="var(--success)" />
        <KpiCard value={fmtUsd(iva.credito)} label="Crédito fiscal" sub="IVA en compras" valueColor="var(--warning)" />
        <KpiCard value={fmtUsd(iva.cuota)} label="Cuota tributaria" sub="débito − crédito" />
        <KpiCard
          value={fmtUsd(outcomeValue)}
          label={aPagar ? "IVA a pagar" : "Excedente a favor"}
          sub={aPagar ? "luego de retenciones" : "crédito trasladable"}
          valueColor={aPagar ? "var(--wine-text)" : "var(--success)"}
        />
      </div>

      <Card eyebrow="Posición ante el SENIAT" title="Resumen del período" style={{ maxWidth: 720 }}>
        <p style={{ font: "500 12.5px/1.6 var(--f-sans)", color: "var(--ink)", margin: "0 0 var(--s-3)" }}>
          En el período <strong style={{ fontWeight: 700 }}>{iva.range.from} → {iva.range.to}</strong> el
          débito fiscal (IVA cobrado en ventas) es{" "}
          <strong style={{ fontWeight: 700 }}>{fmtUsd(iva.debito)}</strong> y el crédito fiscal
          (IVA soportado en compras) es <strong style={{ fontWeight: 700 }}>{fmtUsd(iva.credito)}</strong>.
          La cuota tributaria resultante es <strong style={{ fontWeight: 700 }}>{fmtUsd(iva.cuota)}</strong>
          {aPagar
            ? <>, con <strong style={{ fontWeight: 700 }}>{fmtUsd(iva.aPagar)}</strong> a pagar.</>
            : <>, con <strong style={{ fontWeight: 700 }}>{fmtUsd(iva.excedente)}</strong> de excedente a favor.</>}
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 12,
            marginBottom: 4,
          }}
        >
          <MiniStat label="Base gravada" value={fmtUsd(iva.baseGravada)} />
          <MiniStat label="Base no gravada" value={fmtUsd(iva.baseNoGravada)} sub="exenta + tasa cero" />
          <MiniStat label="Facturas de venta" value={fmtNum(iva.salesRows)} />
          <MiniStat label="Compras" value={fmtNum(iva.purchaseRows)} />
        </div>

        <a
          href="/studio/fiscal"
          className="studio-btn studio-btn-ghost studio-btn-sm"
          style={{ marginTop: 14, display: "inline-flex" }}
        >
          Ver libros fiscales completos
        </a>
      </Card>

      {/* Notas honestas: nada se finge */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {!iva.enabled && (
          <p style={{ font: "500 11.5px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
            El módulo fiscal está <strong style={{ color: "var(--ink-soft)", fontWeight: 700 }}>desactivado</strong>:
            las ventas se registran exentas, por eso el débito fiscal es 0. Cuando se
            active el IVA por factura (SDD-0073), este reporte reflejará el débito real.
          </p>
        )}
        {noCredit && (
          <p style={{ font: "500 11.5px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
            El crédito fiscal es 0 aproximado: las compras todavía no discriminan el IVA
            soportado (va al costo). Cuando se capture por compra, aparecerá acá — no se
            estima.
          </p>
        )}
        {mixedCurrency && (
          <p style={{ font: "500 11.5px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
            Hay más de una moneda en el período ({iva.currencies.join(", ")}). V1 no
            normaliza con tasa de cambio: los totales mezclan monedas — consulta los
            Libros fiscales para el detalle por moneda.
          </p>
        )}
        <p style={{ font: "500 11.5px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
          Retenciones de IVA soportadas asumidas en 0 (V1 sin comprobantes). Reporte
          gerencial acumulado del período seleccionado — la declaración oficial es
          mensual y se presenta desde <span style={{ font: "600 11.5px/1 var(--f-mono)" }}>/studio/fiscal</span>.
        </p>
      </div>
    </div>
  );
}

// Mini-stat inline (label + valor mono) para el resumen de IVA.
function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      style={{
        padding: "12px 14px",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        background: "var(--bg-elevated)",
      }}
    >
      <div style={{ font: "600 10.5px/1 var(--f-sans)", color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {label}
      </div>
      <div style={{ font: "800 15px/1 var(--f-mono)", color: "var(--ink)", marginTop: 7 }}>
        {value}
      </div>
      {sub && (
        <div style={{ font: "500 10.5px/1 var(--f-sans)", color: "var(--ink-soft)", marginTop: 5 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Slice B — Contables · Cashflow facturado vs cobrado
// ═══════════════════════════════════════════════════════════════
function CashflowView({ cashflow }: { cashflow: CashflowReport }) {
  const hasData =
    cashflow.totalBilled > 0 ||
    cashflow.totalCollected > 0 ||
    cashflow.outstanding > 0;
  if (!hasData) {
    return (
      <EmptyState
        eyebrow="Cashflow"
        title="Sin facturación ni cobros en el período"
        description="Cuando emitas facturas y registres cobros, vas a ver acá la serie mensual de facturado vs cobrado y el saldo por cobrar."
      />
    );
  }

  const pendiente = Math.max(0, cashflow.totalBilled - cashflow.totalCollected);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
        }}
      >
        <KpiCard value={fmtUsdCompact(cashflow.totalBilled)} label="Facturado" sub="en el período" valueColor="var(--wine-text)" />
        <KpiCard value={fmtUsdCompact(cashflow.totalCollected)} label="Cobrado" sub="en el período" valueColor="var(--success)" />
        <KpiCard value={fmtUsdCompact(cashflow.outstanding)} label="Por cobrar" sub="saldo vivo total" />
        <KpiCard value={fmtUsdCompact(cashflow.overdue)} label="Vencido" sub="saldo vivo" valueColor="var(--danger)" />
      </div>

      <Card eyebrow="Facturado vs cobrado" title="Serie mensual · USD">
        <CashflowChart series={cashflow.series} />
      </Card>

      <p style={{ font: "500 11.5px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
        Facturado y cobrado del período se normalizan a USD (VES por fx de la
        factura/recibo). <strong style={{ color: "var(--ink-soft)", fontWeight: 700 }}>CNY no incluido en V1.</strong>{" "}
        Por cobrar y vencido son saldos vivos totales (no del rango). Diferencia
        facturado − cobrado del período: {fmtUsdCompact(pendiente)}.
      </p>
    </div>
  );
}

// Gráfico de barras agrupadas (facturado vs cobrado) tokenizado, sin libs.
function CashflowChart({ series }: { series: CashflowReport["series"] }) {
  if (series.length === 0) {
    return (
      <div style={{ font: "500 12.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
        Sin movimientos en el período.
      </div>
    );
  }
  const W = 760;
  const H = 220;
  const pad = 32;
  const plotH = H - 40;
  const max = Math.max(
    1,
    ...series.map((p) => Math.max(p.billed, p.collected)),
  );
  const gw = (W - pad * 2) / series.length;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} role="img" aria-label="Facturado vs cobrado por mes">
        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
          <line
            key={i}
            x1={pad}
            x2={W - pad}
            y1={H - 24 - p * plotH}
            y2={H - 24 - p * plotH}
            stroke="var(--border)"
            strokeWidth="1"
            strokeDasharray={i === 0 ? "0" : "2 4"}
          />
        ))}
        {series.map((p, i) => {
          const bh = (p.billed / max) * plotH;
          const ch = (p.collected / max) * plotH;
          const x = pad + i * gw;
          const bw = gw * 0.32;
          return (
            <g key={p.month}>
              <rect x={x + gw * 0.14} y={H - 24 - bh} width={bw} height={Math.max(0, bh)} fill="var(--wine)" rx="2" />
              <rect x={x + gw * 0.14 + bw + 3} y={H - 24 - ch} width={bw} height={Math.max(0, ch)} fill="var(--success)" rx="2" />
              <text x={x + gw / 2} y={H - 8} fontFamily="var(--f-sans)" fontSize="9" fontWeight="600" fill="var(--ink-soft)" textAnchor="middle">
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", gap: 18, marginTop: 8 }}>
        <LegendDot color="var(--wine)" label="Facturado" />
        <LegendDot color="var(--success)" label="Cobrado" />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
      <span style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
      <span style={{ font: "600 11.5px/1 var(--f-sans)", color: "var(--ink-soft)" }}>{label}</span>
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════
// Slice C — Combinados · rentabilidad REAL (revenue real − costo real)
// ═══════════════════════════════════════════════════════════════
//
// COSTO REAL desde `shipment_costs` (Costing 0053), NUNCA fabricado. Si ningún
// embarque del período tiene costos cargados → EmptyState honesto que enlaza a
// /studio/costing (no se muestran tablas de margen donde el costo es 0 en todo).

const fmtPct = (n: number) => `${n >= 0 ? "" : "−"}${Math.abs(Math.round(n))}%`;

// Color del monto de margen: binario verde/rojo, consistente con Costing
// (los 4 tonos de marginTone quedan solo en el Badge de margen %).
const marginColor = (margin: number) =>
  margin < 0 ? "var(--danger)" : "var(--success)";

function CombinedView({
  combined,
  rep,
}: {
  combined: CombinedReport;
  rep: string;
}) {
  // Sin costos cargados en el período → EmptyState honesto (regla §3.2).
  if (combined.withCosts === 0) {
    return (
      <EmptyState
        eyebrow="Combinados"
        title="Sin costos cargados en el período"
        description="La rentabilidad real cruza el revenue facturado con el costo directo por embarque. Carga costos por embarque en /studio/costing para ver margen por ruta, por cliente y por CBM. No se estima ni se inventa el costo."
      />
    );
  }

  if (rep === "margin-client") {
    return <MarginClientView combined={combined} />;
  }
  if (rep === "cost-cbm") {
    return <CostCbmView combined={combined} />;
  }
  return <RentRouteView combined={combined} />;
}

// KPIs compartidos por las vistas de Combinados (totales reales de Costing).
function CombinedKpis({ combined }: { combined: CombinedReport }) {
  const t = combined.totals;
  const coveragePct =
    combined.shipments > 0
      ? Math.round((combined.withCosts / combined.shipments) * 100)
      : 0;
  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
        }}
      >
        <KpiCard value={fmtUsdCompact(t.revenue)} label="Ingreso" sub="facturado · USD" valueColor="var(--success)" />
        <KpiCard value={fmtUsdCompact(t.cost)} label="Costo directo" sub={`${t.revenue > 0 ? Math.round((t.cost / t.revenue) * 100) : 0}% sobre ingreso`} valueColor="var(--warning)" />
        <KpiCard value={fmtUsd(t.margin)} label="Margen bruto" sub={`${fmtPct(t.avgMarginPct)} margen`} valueColor="var(--wine-text)" />
        <KpiCard value={fmtNum(combined.withCosts)} label="Con costos" sub={`${coveragePct}% de ${fmtNum(combined.shipments)} embarques`} />
      </div>
      {combined.withCosts < combined.shipments && (
        <p style={{ font: "500 11.5px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
          {fmtNum(combined.shipments - combined.withCosts)} embarque
          {combined.shipments - combined.withCosts === 1 ? "" : "s"} del período
          sin costos cargados cuentan como costo 0 (margen = ingreso completo).
          Cárgalos en /studio/costing para una rentabilidad fiel. Costo real, sin
          estimaciones.
        </p>
      )}
    </>
  );
}

// Tabla de margen (ruta o cliente) tokenizada: ingreso / costo / margen / %.
function MarginTable({
  label0,
  rows,
}: {
  label0: string;
  rows: {
    key: string;
    name: string;
    sub: string;
    count: number;
    revenue: number;
    cost: number;
    margin: number;
    marginPct: number;
    tone: RouteMarginRow["tone"];
  }[];
}) {
  return (
    <Card eyebrow="Rentabilidad · revenue real − costo real" style={{ padding: 0 }}>
      <HeaderRow
        cols="1.6fr 110px 110px 120px 70px"
        labels={[label0, "Ingreso", "Costo dir.", "Margen", "%"]}
        rightFrom={1}
        rightTo={4}
      />
      {rows.map((r) => (
        <div
          key={r.key}
          style={{
            display: "grid",
            gridTemplateColumns: "1.6fr 110px 110px 120px 70px",
            padding: "13px 18px",
            gap: 14,
            alignItems: "center",
            borderTop: "1px solid var(--border)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ font: "700 12.5px/1.2 var(--f-sans)", color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {r.name}
            </div>
            {r.sub && (
              <div style={{ font: "500 10.5px/1.2 var(--f-mono)", color: "var(--ink-soft)", marginTop: 2 }}>
                {r.sub}
              </div>
            )}
          </div>
          <span style={{ font: "700 12px/1 var(--f-mono)", textAlign: "right", color: "var(--ink)" }}>
            {fmtUsdCompact(r.revenue)}
          </span>
          <span style={{ font: "700 12px/1 var(--f-mono)", textAlign: "right", color: "var(--ink-soft)" }}>
            {fmtUsdCompact(r.cost)}
          </span>
          <span style={{ font: "800 13px/1 var(--f-mono)", textAlign: "right", color: marginColor(r.margin) }}>
            {fmtUsd(r.margin)}
          </span>
          <span style={{ textAlign: "right" }}>
            <Badge tone={r.tone as BadgeTone} size="sm">
              {fmtPct(r.marginPct)}
            </Badge>
          </span>
        </div>
      ))}
    </Card>
  );
}

// ── Combinados · Rentabilidad por ruta ─────────────────────────
function RentRouteView({ combined }: { combined: CombinedReport }) {
  const rows = combined.byRoute.map((r: RouteMarginRow) => ({
    key: `${r.origin}→${r.destination}`,
    name: `${r.origin || "—"} → ${r.destination || "—"}`,
    sub: `${r.count} embarque${r.count === 1 ? "" : "s"}`,
    count: r.count,
    revenue: r.revenue,
    cost: r.cost,
    margin: r.margin,
    marginPct: r.marginPct,
    tone: r.tone,
  }));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <CombinedKpis combined={combined} />
      {rows.length === 0 ? (
        <EmptyState
          eyebrow="Rentabilidad por ruta"
          title="Sin rutas para el período"
          description="Cambia el período o carga embarques con origen y destino para ver el margen por corredor."
        />
      ) : (
        <MarginTable label0="Ruta CN → VE" rows={rows} />
      )}
    </div>
  );
}

// ── Combinados · Margen por cliente ────────────────────────────
function MarginClientView({ combined }: { combined: CombinedReport }) {
  const rows = combined.byClient.map((r: ClientMarginRow) => ({
    key: r.client,
    name: r.client,
    sub: `${r.count} envío${r.count === 1 ? "" : "s"}`,
    count: r.count,
    revenue: r.revenue,
    cost: r.cost,
    margin: r.margin,
    marginPct: r.marginPct,
    tone: r.tone,
  }));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <CombinedKpis combined={combined} />
      {rows.length === 0 ? (
        <EmptyState
          eyebrow="Margen por cliente"
          title="Sin clientes para el período"
          description="Cuando haya embarques con costos cargados, vas a ver acá el margen agregado por cliente."
        />
      ) : (
        <MarginTable label0="Cliente" rows={rows} />
      )}
    </div>
  );
}

// ── Combinados · Costo por CBM ─────────────────────────────────
function CostCbmView({ combined }: { combined: CombinedReport }) {
  const rows = combined.byCbm;
  if (rows.length === 0 || rows.every((r) => r.cbm <= 0)) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <CombinedKpis combined={combined} />
        <EmptyState
          eyebrow="Costo por CBM"
          title="Sin CBM registrado en el período"
          description="El rendimiento por CBM necesita el volumen (m³) de los embarques. Carga el volumen y los costos por embarque para ver el costo y margen por metro cúbico."
        />
      </div>
    );
  }

  const maxMargin = Math.max(1, ...rows.map((r) => r.marginPerCbm));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <CombinedKpis combined={combined} />
      <Card eyebrow="Rendimiento por CBM · ingreso y costo por metro cúbico" style={{ padding: 0 }}>
        <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid var(--border)" }}>
          <p style={{ font: "500 12px/1.4 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
            Cuánto rinde cada CBM por ruta — clave para el pricing de carga
            consolidada. Costo real por embarque, sin estimaciones.
          </p>
        </div>
        <HeaderRow
          cols="1.5fr 90px 110px 110px 1fr"
          labels={["Ruta", "CBM", "$/CBM ing.", "$/CBM costo", "Margen / CBM"]}
          rightFrom={1}
          rightTo={3}
        />
        {rows.map((r: RouteCbmRow) => {
          const m = r.marginPerCbm;
          return (
            <div
              key={`${r.origin}→${r.destination}`}
              style={{
                display: "grid",
                gridTemplateColumns: "1.5fr 90px 110px 110px 1fr",
                padding: "13px 18px",
                gap: 14,
                alignItems: "center",
                borderTop: "1px solid var(--border)",
              }}
            >
              <span style={{ font: "600 12.5px/1.3 var(--f-sans)", color: "var(--ink)" }}>
                {r.origin || "—"} → {r.destination || "—"}
              </span>
              <span style={{ font: "600 12px/1 var(--f-mono)", textAlign: "right", color: "var(--ink-soft)" }}>
                {r.cbm.toFixed(1)}
              </span>
              <span style={{ font: "700 12px/1 var(--f-mono)", textAlign: "right", color: "var(--ink)" }}>
                {fmtUsdCompact(r.revenuePerCbm)}
              </span>
              <span style={{ font: "600 12px/1 var(--f-mono)", textAlign: "right", color: "var(--ink-soft)" }}>
                {fmtUsdCompact(r.costPerCbm)}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <Progress
                    value={(Math.max(0, m) / maxMargin) * 100}
                    tone={m < 0 ? "var(--danger)" : "var(--wine)"}
                    height={8}
                  />
                </div>
                <span
                  style={{
                    font: "800 12px/1 var(--f-mono)",
                    color: m < 0 ? "var(--danger)" : "var(--success)",
                    minWidth: 56,
                    textAlign: "right",
                  }}
                >
                  {fmtUsd(m)}
                </span>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

// ── Header de tabla reusable ───────────────────────────────────
