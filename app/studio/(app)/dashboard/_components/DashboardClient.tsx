"use client";

/**
 * Orquestador del dashboard configurable (SDD-0114 · Slice B).
 *
 * Estado OPTIMISTA: la config vive en React state, se refleja en pantalla al
 * instante, se cachea en localStorage (write-through) y se sincroniza a la DB con
 * un autosave DEBOUNCED (el drag no spamea la red). La DB manda al cargar: el
 * server ya inyecta `initialConfig` desde `user_dashboard_prefs`, y en mount
 * sobre-escribimos el LS con esa verdad.
 *
 * Los VALORES de los KPIs y la data de los widgets llegan ya resueltos del server
 * (props serializables) para TODO el catálogo accesible → agregar un KPI en el
 * editor lo muestra al instante sin round-trip.
 */

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import { Icon } from "@/app/studio/_components/icons";
import { RecentActivityCard } from "./RecentActivityCard";
import { DashboardEditorDrawer } from "./DashboardEditorDrawer";
import {
  ActiveShipmentsWidget,
  AlertsWidget,
  ChartWidget,
  NominaResumenWidget,
  QuickActionsWidget,
  UpcomingEtaWidget,
  type AlertItem,
  type NominaSummary,
} from "./DashboardWidgets";
import {
  MAX_KPIS,
  TONE_TO_VALUE_COLOR,
  kpiById,
  widgetById,
  type ChartPeriod,
  type KpiCatalogEntry,
  type WidgetCatalogEntry,
} from "@/lib/studio/dashboard/dashboard-catalog";
import type { DashboardConfig } from "@/lib/studio/dashboard/dashboard-types";
import type { KpiValue } from "@/lib/studio/dashboard/dashboard-kpi-queries";
import type { ActiveShipmentPreview, MonthlyVolumePoint } from "@/lib/studio/dashboard/dashboard-widget-queries";
import type { RecentActivityItem } from "@/lib/studio/dashboard-queries";
import {
  resetDashboardConfigAction,
  saveDashboardConfigAction,
  type SaveDashboardState,
} from "../actions";

export type DashboardWidgetData = {
  activeShipments: ActiveShipmentPreview[];
  monthlyVolume: MonthlyVolumePoint[];
  recentActivity: RecentActivityItem[];
  alerts: AlertItem[];
  nomina: NominaSummary;
};

export function DashboardClient({
  initialConfig,
  defaultConfig,
  kpiValues,
  accessibleKpis,
  accessibleWidgets,
  widgetData,
  userId,
}: {
  initialConfig: DashboardConfig;
  defaultConfig: DashboardConfig;
  kpiValues: Record<string, KpiValue>;
  accessibleKpis: KpiCatalogEntry[];
  accessibleWidgets: WidgetCatalogEntry[];
  widgetData: DashboardWidgetData;
  userId: string;
}) {
  const [config, setConfig] = useState<DashboardConfig>(initialConfig);
  const [editorOpen, setEditorOpen] = useState(false);

  const [saveState, saveAction] = useActionState<SaveDashboardState, FormData>(
    saveDashboardConfigAction,
    {},
  );
  const [, resetAction] = useActionState<SaveDashboardState, FormData>(
    resetDashboardConfigAction,
    {},
  );

  const storageKey = `dtd_dashboard_config_v1:${userId}`;
  const mounted = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  // Mount: la DB manda → el LS se alinea con lo que vino del server.
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(initialConfig));
    } catch {
      /* LS lleno / modo privado → seguimos, la DB es la verdad */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cambios: write-through a LS + autosave debounced a DB.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(config));
    } catch {
      /* noop */
    }
    setSaveStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const fd = new FormData();
      fd.set("config", JSON.stringify(config));
      saveAction(fd);
    }, 650);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  useEffect(() => {
    // Sincroniza el resultado del autosave (sistema externo: la Server Action)
    // con el indicador de UI. Es exactamente el caso que el effect permite.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saveState.savedAt) setSaveStatus("saved");
  }, [saveState.savedAt]);

  const toggleKpi = useCallback((id: string) => {
    setConfig((prev) => {
      if (prev.kpis.includes(id)) return { ...prev, kpis: prev.kpis.filter((k) => k !== id) };
      if (prev.kpis.length >= MAX_KPIS) return prev;
      return { ...prev, kpis: [...prev.kpis, id] };
    });
  }, []);

  const moveKpi = useCallback((from: number, to: number) => {
    setConfig((prev) => {
      const next = [...prev.kpis];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return { ...prev, kpis: next };
    });
  }, []);

  const toggleWidget = useCallback((id: string) => {
    setConfig((prev) => ({
      ...prev,
      widgets: prev.widgets.includes(id)
        ? prev.widgets.filter((w) => w !== id)
        : [...prev.widgets, id],
    }));
  }, []);

  const setChartPeriod = useCallback((p: ChartPeriod) => {
    setConfig((prev) => ({ ...prev, chartPeriod: p }));
  }, []);

  const resetToDefaults = useCallback(() => {
    setConfig(defaultConfig);
    try {
      localStorage.setItem(storageKey, JSON.stringify(defaultConfig));
    } catch {
      /* noop */
    }
    resetAction(new FormData());
    setSaveStatus("saved");
  }, [defaultConfig, resetAction, storageKey]);

  // ── Deriva render ──────────────────────────────────────────
  const visibleKpis = config.kpis.map((id) => kpiById(id)).filter((m): m is KpiCatalogEntry => !!m);
  const accessibleWidgetIds = new Set(accessibleWidgets.map((w) => w.id));
  const activeWidgets = config.widgets.filter((id) => accessibleWidgetIds.has(id));
  const leftWidgets = activeWidgets.filter((id) => widgetById(id)?.side === "left");
  const rightWidgets = activeWidgets.filter((id) => widgetById(id)?.side === "right");
  const hasLeft = leftWidgets.length > 0;
  const hasRight = rightWidgets.length > 0;
  const nothing = visibleKpis.length === 0 && activeWidgets.length === 0;

  const renderWidget = (id: string) => {
    switch (id) {
      case "chart":
        return (
          <ChartWidget
            key={id}
            data={widgetData.monthlyVolume}
            period={config.chartPeriod}
            onPeriodChange={setChartPeriod}
          />
        );
      case "activeShipments":
        return <ActiveShipmentsWidget key={id} items={widgetData.activeShipments} />;
      case "upcomingEta":
        return <UpcomingEtaWidget key={id} items={widgetData.activeShipments} />;
      case "alerts":
        return <AlertsWidget key={id} alerts={widgetData.alerts} />;
      case "recentActivity":
        return <RecentActivityCard key={id} items={widgetData.recentActivity} />;
      case "quickActions":
        return <QuickActionsWidget key={id} />;
      case "nominaResumen":
        return <NominaResumenWidget key={id} summary={widgetData.nomina} />;
      default:
        return null;
    }
  };

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
        <div className="studio-eyebrow">Tu dashboard</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            aria-live="polite"
            style={{ font: "500 11.5px/1 var(--f-sans)", color: "var(--ink-mute)", minWidth: 64, textAlign: "right" }}
          >
            {saveState.error
              ? "No se guardó"
              : saveStatus === "saving"
                ? "Guardando…"
                : saveStatus === "saved"
                  ? "Guardado ✓"
                  : ""}
          </span>
          <button type="button" className="studio-btn studio-btn-dark studio-btn-sm" onClick={() => setEditorOpen(true)}>
            {Icon.cog(14)} Configurar
          </button>
        </div>
      </div>

      {nothing ? (
        <div
          style={{
            border: "2px dashed var(--border-strong)",
            borderRadius: "var(--r-lg)",
            padding: "40px 24px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            alignItems: "center",
          }}
        >
          <div className="studio-display" style={{ fontSize: 18, color: "var(--ink)" }}>
            Tu dashboard está vacío
          </div>
          <p style={{ font: "400 13px/1.5 var(--f-sans)", color: "var(--ink-soft)", maxWidth: "44ch", margin: 0 }}>
            Activá los KPIs y widgets que quieras ver desde el configurador.
          </p>
          <button type="button" className="studio-btn studio-btn-primary studio-btn-sm" onClick={() => setEditorOpen(true)}>
            {Icon.cog(14)} Configurar dashboard
          </button>
        </div>
      ) : (
        <>
          {/* KPI grid */}
          {visibleKpis.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 14,
                marginBottom: hasLeft || hasRight ? 20 : 0,
              }}
            >
              {visibleKpis.map((meta) => {
                const v = kpiValues[meta.id];
                const value = v?.value ?? "—";
                const tone = v?.tone ?? meta.tone;
                return (
                  <KpiCard
                    key={meta.id}
                    value={value}
                    label={meta.label}
                    valueColor={value === "—" ? "var(--ink-mute)" : TONE_TO_VALUE_COLOR[tone]}
                    sub={meta.status === "wip" ? "Próximamente" : v?.sub}
                  />
                );
              })}
            </div>
          )}

          {/* Widgets */}
          {(hasLeft || hasRight) && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: hasLeft && hasRight ? "minmax(0, 2fr) minmax(0, 1fr)" : "minmax(0, 1fr)",
                gap: 16,
                alignItems: "start",
              }}
            >
              {hasLeft && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>{leftWidgets.map(renderWidget)}</div>
              )}
              {hasRight && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>{rightWidgets.map(renderWidget)}</div>
              )}
            </div>
          )}
        </>
      )}

      <DashboardEditorDrawer
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        config={config}
        accessibleKpis={accessibleKpis}
        accessibleWidgets={accessibleWidgets}
        onToggleKpi={toggleKpi}
        onMoveKpi={moveKpi}
        onToggleWidget={toggleWidget}
        onReset={resetToDefaults}
      />
    </div>
  );
}
