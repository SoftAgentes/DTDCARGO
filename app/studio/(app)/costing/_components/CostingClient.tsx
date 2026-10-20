"use client";

/**
 * Orquestador client del módulo Costing & Margen (SDD-0053 · Slice B).
 *
 * Estructura del Norte (erp/modules/costing.jsx), anclada a datos reales y
 * traducida a tokens var(--*) + primitivas del sistema:
 *  - Header con KPIs (revenue/costo/margen/embarques OK) + toggle USD/VES.
 *  - Tabs: Overview · Ranking · Breakdown · Routes (Templates/Forecast = Slice C).
 *  - Cost Editor drawer (guardar costos) abierto desde Ranking o "Editar costos".
 *
 * El toggle USD/VES es DISPLAY-ONLY: convierte cada monto USD con la tasa BCV
 * vigente del catálogo; sin tasa se desactiva VES). Nunca persiste VES. Todos los
 * agregados llegan ya calculados desde el server (page.tsx).
 */

import { useMemo, useState } from "react";
import { KpiCard } from "@/app/studio/_components/ui/KpiCard";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { SegmentedControl } from "@/app/studio/_components/ui/SegmentedControl";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { Icon } from "@/app/studio/_components/icons";
import { SERVICE_LABELS } from "@/lib/studio/shipment-types";
import {
  COST_CATEGORIES,
  fmtMoney,
  marginTone,
  totalCost,
  type DisplayCurrency,
  type RouteCostTemplate,
} from "@/lib/studio/costing/types";
import type {
  CostingRow,
  CostingTotals,
  RouteMarginRow,
} from "@/lib/studio/costing/queries";
import {
  asRankingSort,
  breakdownRows,
  buildCostingCsv,
  costPctOfRevenue,
  FORECAST_BUCKET_LABEL,
  RANKING_SORTS,
  resolveDisplayRate,
  sortRanking,
  topAndWorst,
  type Forecast,
  type ForecastRow,
  type RankingSort,
} from "@/lib/studio/costing/ui";
import { CostEditorDrawer } from "./CostEditorDrawer";
import { TemplateDrawer } from "./TemplateDrawer";

type Tab = "overview" | "ranking" | "breakdown" | "routes" | "templates" | "forecast";

const TABS: { value: Tab; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "ranking", label: "Ranking de embarques" },
  { value: "breakdown", label: "Desglose por categoría" },
  { value: "routes", label: "Margen por ruta" },
  { value: "templates", label: "Templates por ruta" },
  { value: "forecast", label: "Forecast pipeline" },
];

/** Descarga un archivo de texto en el cliente (sin lib externa). */
function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

type TemplateEditorState =
  | { mode: "create" }
  | { mode: "edit"; template: RouteCostTemplate };

export function CostingClient({
  rows,
  totals,
  routes,
  templates,
  forecast,
  vesRate,
}: {
  rows: CostingRow[];
  totals: CostingTotals;
  routes: RouteMarginRow[];
  templates: RouteCostTemplate[];
  forecast: Forecast;
  vesRate: number | null;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [currency, setCurrency] = useState<DisplayCurrency>("USD");
  const [editor, setEditor] = useState<CostingRow | null>(null);
  const [tplEditor, setTplEditor] = useState<TemplateEditorState | null>(null);

  const rate = resolveDisplayRate(vesRate);
  // Formateador de display según el toggle (USD passthrough · VES × tasa).
  // SDD-0572: sin tasa vigente, siempre USD.
  const money = (usd: number) =>
    rate === null ? fmtMoney(usd, "USD", 0) : fmtMoney(usd, currency, rate);

  // SDD-0572: con alguna factura sin tasa el margen está incompleto: ni
  // rentable ni en pérdida, «sin tasa».
  const sinTasa = (r: CostingRow) => (r.facturasSinTasa ?? 0) > 0;
  const profitable = useMemo(
    () => rows.filter((r) => !sinTasa(r) && r.eco.margin > 0).length,
    [rows],
  );
  const losing = useMemo(
    () => rows.filter((r) => !sinTasa(r) && r.eco.margin < 0).length,
    [rows],
  );
  const conSinTasa = useMemo(() => rows.filter(sinTasa).length, [rows]);

  const hasRows = rows.length > 0;
  const exportCsv = () =>
    downloadTextFile(
      `costing-${new Date().toISOString().slice(0, 10)}.csv`,
      buildCostingCsv(sortRanking(rows, "margin-pct-desc")),
      "text/csv;charset=utf-8",
    );

  return (
    <div style={{ maxWidth: 1280 }}>
      <Header
        currency={currency}
        onCurrency={setCurrency}
        rate={rate}
        hasRows={hasRows}
        onEdit={hasRows ? () => setEditor(rows[0]) : undefined}
        onExport={hasRows ? exportCsv : undefined}
      />

      {/* KPIs */}
      {hasRows && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 14,
            marginBottom: 20,
          }}
        >
          <KpiCard
            value={money(totals.revenue)}
            label={totals.sinTasa > 0 ? "Revenue · subtotal convertido" : "Revenue total"}
            sub={totals.sinTasa > 0 ? `${totals.sinTasa} embarque${totals.sinTasa === 1 ? "" : "s"} sin tasa · conversión incompleta` : currency === "USD" ? "facturado · USD canónico" : "facturado · en Bs."}
            valueColor="var(--wine-text)"
          />
          <KpiCard
            value={money(totals.cost)}
            label="Costo total"
            sub={totals.sinTasa > 0 ? "costos conocidos · ingreso incompleto" : `${Math.round(costPctOfRevenue(totals))}% del revenue`}
            valueColor="var(--warning)"
          />
          <KpiCard
            value={totals.sinTasa > 0 ? "—" : money(totals.margin)}
            label="Margen bruto"
            sub={totals.sinTasa > 0 ? "Pendiente · conversión incompleta" : `${totals.avgMarginPct.toFixed(1)}% promedio`}
            valueColor={totals.sinTasa > 0 ? "var(--ink)" : totals.margin < 0 ? "var(--danger)" : "var(--success)"}
          />
          <KpiCard
            value={`${profitable}/${rows.length}`}
            label="Embarques OK"
            sub={
              (losing > 0 ? `${losing} en pérdida` : "ninguno en pérdida")
              + (conSinTasa > 0 ? ` · ${conSinTasa} sin tasa` : "")
            }
            valueColor={conSinTasa > 0 ? "var(--ink)" : losing > 0 ? "var(--danger)" : "var(--success)"}
          />
        </div>
      )}

      {/* Tabs */}
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
        {TABS.map((t) => {
          const on = t.value === tab;
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setTab(t.value)}
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

      {/* Tabs de embarques: empty-state si todavía no hay embarques. */}
      {(tab === "overview" || tab === "ranking" || tab === "breakdown" || tab === "routes") &&
        !hasRows && (
          <EmptyState
            eyebrow="Costing & Margen"
            title="Todavía no hay embarques para costear"
            description="Cuando registres embarques vas a poder cargar sus costos por categoría y ver el margen real contra la facturación. Mientras tanto puedes definir Templates por ruta para prellenar costos."
          />
        )}

      {hasRows && tab === "overview" && (
        <OverviewView rows={rows} totals={totals} money={money} />
      )}
      {hasRows && tab === "ranking" && (
        <RankingView rows={rows} money={money} onEdit={setEditor} />
      )}
      {hasRows && tab === "breakdown" && <BreakdownView totals={totals} money={money} />}
      {hasRows && tab === "routes" && <RoutesView routes={routes} money={money} />}

      {tab === "templates" && (
        <TemplatesView
          templates={templates}
          money={money}
          onNew={() => setTplEditor({ mode: "create" })}
          onEdit={(t) => setTplEditor({ mode: "edit", template: t })}
        />
      )}
      {tab === "forecast" && <ForecastView forecast={forecast} money={money} />}

      {editor && (
        <CostEditorDrawer
          key={editor.shipment.id}
          row={editor}
          onClose={() => setEditor(null)}
        />
      )}

      {tplEditor && (
        <TemplateDrawer
          key={tplEditor.mode === "edit" ? tplEditor.template.id : "new"}
          mode={tplEditor.mode}
          template={tplEditor.mode === "edit" ? tplEditor.template : undefined}
          onClose={() => setTplEditor(null)}
        />
      )}
    </div>
  );
}

// ── Header ─────────────────────────────────────────────────────
function Header({
  currency,
  onCurrency,
  rate,
  hasRows,
  onEdit,
  onExport,
}: {
  currency: DisplayCurrency;
  onCurrency: (c: DisplayCurrency) => void;
  rate: number | null;
  hasRows: boolean;
  onEdit?: () => void;
  onExport?: () => void;
}) {
  return (
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
        <span className="studio-eyebrow">Finanzas</span>
        <h1
          className="studio-display"
          style={{ fontSize: 30, margin: "var(--s-2) 0 var(--s-2)", color: "var(--ink)" }}
        >
          Costing &amp; Margen.
        </h1>
        <p
          style={{
            font: "400 13px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
            maxWidth: "70ch",
          }}
        >
          Rentabilidad real por embarque: desglose de costos vs revenue
          facturado. Identifica los rentables y los que dejan dinero sobre la
          mesa.
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span
            style={{
              font: "700 9.5px/1 var(--f-sans)",
              color: "var(--ink-soft)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            {rate === null ? "Moneda · Sin tasa de bolívares en Admin › Tasas" : `Moneda · BCV ${rate}`}
          </span>
          <SegmentedControl<DisplayCurrency>
            variant="pills"
            ariaLabel="Moneda de display"
            value={rate === null ? "USD" : currency}
            onChange={onCurrency}
            options={[
              { value: "USD", label: "USD" },
              { value: "VES", label: "VES", disabled: rate === null },
            ]}
          />
        </div>
        {hasRows && onExport && (
          <ActionButton
            variant="ghost"
            size="default"
            idleLabel="Exportar CSV"
            idleIcon={Icon.download(14)}
            successLabel={null}
            onAction={async () => {
              onExport();
            }}
          />
        )}
        {hasRows && onEdit && (
          <ActionButton
            variant="primary"
            size="default"
            idleLabel="Editar costos"
            idleIcon={Icon.edit(14)}
            successLabel={null}
            onAction={async () => {
              onEdit();
            }}
          />
        )}
      </div>
    </div>
  );
}

type Money = (usd: number) => string;

// ── Card helper ────────────────────────────────────────────────
function Card({
  eyebrow,
  children,
  style,
}: {
  eyebrow?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
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
            padding: "18px 20px 0",
          }}
        >
          {eyebrow}
        </div>
      )}
      {children}
    </div>
  );
}

// ── Overview ───────────────────────────────────────────────────
function OverviewView({
  rows,
  totals,
  money,
}: {
  rows: CostingRow[];
  totals: CostingTotals;
  money: Money;
}) {
  const { top, worst } = topAndWorst(rows, 3);
  const costPct = Math.round(costPctOfRevenue(totals));
  const marginPctRound = 100 - costPct;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card eyebrow="Composición · Revenue vs Costo" style={{ padding: "0 0 18px" }}>
        <div style={{ padding: "14px 20px 0", display: "flex", flexDirection: "column", gap: 14 }}>
          {totals.sinTasa > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-4)", color: "var(--ink)" }}>
              <span>Subtotal convertido: <strong>{money(totals.revenue)}</strong></span>
              <span>Costo total: <strong>{money(totals.cost)}</strong></span>
            </div>
          ) : <>
          <CompositionBar
            label="Revenue"
            value={money(totals.revenue)}
            pct={100}
            tone="var(--wine)"
          />
          <CompositionBar
            label="Costo total"
            value={money(totals.cost)}
            pct={costPctOfRevenue(totals)}
            tone="var(--warning)"
          />
          <CompositionBar
            label="Margen bruto"
            value={money(totals.margin)}
            pct={Math.max(0, 100 - costPctOfRevenue(totals))}
            tone={totals.margin < 0 ? "var(--danger)" : "var(--success)"}
          />
          </>}
        </div>
        <p
          style={{
            font: "500 12px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: "var(--s-4) var(--s-5) 0",
            paddingTop: 14,
            borderTop: "1px solid var(--border)",
          }}
        >
          {totals.sinTasa > 0 ? "Faltan tasas de facturas para conocer el revenue y el margen completos. Los importes convertidos y los costos se conservan." : <>
          Por cada <strong style={{ color: "var(--ink)" }}>$100</strong>{" "}
          facturados,{" "}
          <strong style={{ color: "var(--warning)" }}>${costPct}</strong> se van
          en costos y{" "}
          <strong style={{ color: "var(--success)" }}>${marginPctRound}</strong>{" "}
          quedan de margen bruto.
          </>}
        </p>
      </Card>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
        }}
      >
        <Card eyebrow="Top 3 más rentables" style={{ padding: "0 0 var(--s-4)" }}>
          <RankList rows={top} money={money} tone="success" emptyLabel="Sin embarques rentables todavía." />
        </Card>
        <Card eyebrow="3 peores márgenes" style={{ padding: "0 0 var(--s-4)" }}>
          <RankList rows={worst} money={money} tone="danger" emptyLabel="Sin embarques en pérdida." />
        </Card>
      </div>
    </div>
  );
}

function CompositionBar({
  label,
  value,
  pct,
  tone,
}: {
  label: string;
  value: string;
  pct: number;
  tone: string;
}) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ font: "700 12px/1.2 var(--f-sans)", color: "var(--ink)" }}>{label}</span>
        <span style={{ font: "800 13px/1 var(--f-mono)", color: tone }}>{value}</span>
      </div>
      <div style={{ height: 10, background: "var(--bg-elevated)", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${w}%`, height: "100%", background: tone, borderRadius: 999 }} />
      </div>
    </div>
  );
}

function RankList({
  rows,
  money,
  tone,
  emptyLabel,
}: {
  rows: CostingRow[];
  money: Money;
  tone: "success" | "danger";
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return (
      <div style={{ padding: "var(--s-3) var(--s-5)", font: "500 12.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
        {emptyLabel}
      </div>
    );
  }
  return (
    <div style={{ padding: "var(--s-3) var(--s-5) 0", display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.map((r) => {
        const isLoss = r.eco.margin < 0;
        const c = isLoss ? "var(--danger)" : tone === "success" ? "var(--success)" : "var(--warning)";
        return (
          <div
            key={r.shipment.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 110px",
              gap: 10,
              alignItems: "center",
              padding: "8px 10px",
              background: "var(--bg-elevated)",
              borderRadius: "var(--r-sm)",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <code style={{ font: "800 11.5px/1 var(--f-mono)", color: "var(--ink)" }}>
                {r.shipment.code}
              </code>
              <div
                style={{
                  font: "500 11px/1.3 var(--f-sans)",
                  color: "var(--ink-soft)",
                  marginTop: 2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {r.shipment.client_name ?? "—"}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ font: "800 13px/1 var(--f-mono)", color: c }}>{money(r.eco.margin)}</div>
              <div style={{ font: "600 10px/1 var(--f-mono)", color: "var(--ink-soft)", marginTop: 3 }}>
                {r.eco.marginPct.toFixed(0)}%
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Ranking ────────────────────────────────────────────────────
function RankingView({
  rows,
  money,
  onEdit,
}: {
  rows: CostingRow[];
  money: Money;
  onEdit: (row: CostingRow) => void;
}) {
  const [sort, setSort] = useState<RankingSort>("margin-pct-desc");
  const sorted = useMemo(() => sortRanking(rows, sort), [rows, sort]);
  const cols = "140px 1fr 110px 110px 110px 110px 80px";

  return (
    <Card style={{ overflowX: "auto" }}>
      <div
        style={{
          padding: "14px 18px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            font: "700 10px/1 var(--f-sans)",
            color: "var(--wine-text)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          {sorted.length} embarques
        </span>
        <select
          className="studio-input"
          aria-label="Ordenar ranking"
          value={sort}
          onChange={(e) => setSort(asRankingSort(e.target.value))}
          style={{ width: 240 }}
        >
          {RANKING_SORTS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

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
        {["ID", "Cliente · Ruta", "Revenue", "Costo", "Margen", "Margen %", ""].map((h, i) => (
          <span
            key={h || i}
            style={{
              font: "700 10px/1 var(--f-sans)",
              color: "var(--ink-soft)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              textAlign: i >= 2 ? "right" : "left",
            }}
          >
            {h}
          </span>
        ))}
      </div>

      {sorted.map((r) => {
        const incompleto = (r.facturasSinTasa ?? 0) > 0;
        const isLoss = !incompleto && r.eco.margin < 0;
        const tone = marginTone(r.eco.marginPct);
        const routeLabel =
          r.shipment.origin && r.shipment.destination
            ? `${r.shipment.origin} → ${r.shipment.destination}`
            : "—";
        return (
          <div
            key={r.shipment.id}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            style={{
              display: "grid",
              gridTemplateColumns: cols,
              padding: "12px 18px",
              gap: 14,
              alignItems: "center",
              borderTop: "1px solid var(--border)",
              transition: "background var(--dur-fast) var(--ease)",
            }}
          >
            <code style={{ font: "800 12px/1 var(--f-mono)", color: "var(--ink)" }}>
              {r.shipment.code}
            </code>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  font: "600 12.5px/1.2 var(--f-sans)",
                  color: "var(--ink)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {r.shipment.client_name ?? "—"}
              </div>
              <div style={{ font: "500 11px/1.2 var(--f-sans)", color: "var(--ink-soft)", marginTop: 2 }}>
                {routeLabel}
              </div>
            </div>
            <div style={{ color: "var(--ink)", textAlign: "right" }}>
              <span style={{ font: "700 13px/1 var(--f-mono)" }}>{money(r.eco.revenue)}</span>
              {incompleto && <div style={{ font: "500 11px/1.4 var(--f-sans)", color: "var(--ink-soft)", marginTop: "var(--s-1)" }}>Subtotal convertido</div>}
            </div>
            <span style={{ font: "600 12px/1 var(--f-mono)", color: "var(--warning)", textAlign: "right" }}>
              {money(r.eco.totalCost)}
            </span>
            <span
              style={{
                font: "800 13px/1 var(--f-mono)",
                color: incompleto ? "var(--ink)" : isLoss ? "var(--danger)" : "var(--success)",
                textAlign: "right",
              }}
            >
              {incompleto ? "—" : money(r.eco.margin)}
            </span>
            <div style={{ textAlign: "right" }}>
              {incompleto ? (
                <>
                <Badge tone="neutral" size="md">
                  Sin tasa
                </Badge>
                <div style={{ font: "500 11px/1.4 var(--f-sans)", color: "var(--ink-soft)", marginTop: "var(--s-1)" }}>
                  {r.facturasSinTasa} {r.facturasSinTasa === 1 ? "factura sin tasa" : "facturas sin tasa"}
                </div>
                </>
              ) : (
                <Badge tone={tone} size="md">
                  {r.eco.marginPct.toFixed(1)}%
                </Badge>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              <button
                type="button"
                onClick={() => onEdit(r)}
                title="Editar costos"
                aria-label={`Editar costos de ${r.shipment.code}`}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--wine)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-soft)")}
                style={{
                  background: "transparent",
                  border: 0,
                  color: "var(--ink-soft)",
                  cursor: "pointer",
                  padding: 6,
                  display: "inline-flex",
                }}
              >
                {Icon.edit(13)}
              </button>
            </div>
          </div>
        );
      })}
    </Card>
  );
}

// ── Breakdown ──────────────────────────────────────────────────
function BreakdownView({ totals, money }: { totals: CostingTotals; money: Money }) {
  const rows = breakdownRows(totals);
  const labelByKey = Object.fromEntries(COST_CATEGORIES.map((c) => [c.key, c]));

  if (totals.cost === 0) {
    return (
      <EmptyState
        eyebrow="Desglose por categoría"
        title="Sin costos cargados"
        description="Carga los costos de tus embarques desde el Cost Editor para ver el desglose por categoría."
      />
    );
  }

  return (
    <Card eyebrow={`Desglose de costos · ${rows.length} categorías`} style={{ padding: "0 0 var(--s-5)" }}>
      <div style={{ padding: "14px 20px 0", display: "flex", flexDirection: "column", gap: 12 }}>
        {rows.map((r) => {
          const cat = labelByKey[r.key];
          return (
            <div key={r.key}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    aria-hidden
                    style={{ width: 14, height: 14, borderRadius: 3, background: cat.colorToken, flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ font: "700 13px/1.2 var(--f-sans)", color: "var(--ink)" }}>{cat.label}</div>
                    <div style={{ font: "500 11px/1.2 var(--f-sans)", color: "var(--ink-soft)", marginTop: 2 }}>
                      {cat.desc}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ font: "800 14px/1 var(--f-mono)", color: "var(--ink)" }}>{money(r.amount)}</div>
                  <div style={{ font: "700 11px/1 var(--f-mono)", color: "var(--ink-soft)", marginTop: 3 }}>
                    {r.pct.toFixed(1)}% del total
                  </div>
                </div>
              </div>
              <div style={{ height: 10, background: "var(--bg-elevated)", borderRadius: 999, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${Math.max(0, Math.min(100, r.pct))}%`,
                    height: "100%",
                    background: cat.colorToken,
                    borderRadius: 999,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Routes ─────────────────────────────────────────────────────
function RoutesView({ routes, money }: { routes: RouteMarginRow[]; money: Money }) {
  if (routes.length === 0) {
    return (
      <EmptyState
        eyebrow="Margen por ruta"
        title="Sin rutas para agrupar"
        description="Cuando tus embarques tengan origen y destino vas a ver acá el margen agregado por corredor."
      />
    );
  }
  const cols = "1.4fr 70px 110px 110px 110px 110px";

  return (
    <Card eyebrow={`${routes.length} rutas · completas por margen % · incompletas al final`} style={{ overflow: "hidden", padding: "18px 0 0" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: cols,
          padding: "10px 18px",
          gap: 14,
          background: "var(--bg-elevated)",
          borderBottom: "1px solid var(--border)",
          marginTop: 14,
        }}
      >
        {["Ruta", "Envíos", "Revenue", "Costo", "Margen", "Margen %"].map((h, i) => (
          <span
            key={h}
            style={{
              font: "700 10px/1 var(--f-sans)",
              color: "var(--ink-soft)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              textAlign: i >= 1 ? "right" : "left",
            }}
          >
            {h}
          </span>
        ))}
      </div>
      {routes.map((r) => (
        <div
          key={`${r.origin}→${r.destination}`}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          style={{
            display: "grid",
            gridTemplateColumns: cols,
            padding: "14px 18px",
            gap: 14,
            alignItems: "center",
            borderTop: "1px solid var(--border)",
            transition: "background var(--dur-fast) var(--ease)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span style={{ font: "700 13px/1.2 var(--f-sans)", color: "var(--ink)" }}>
              {r.origin || "—"}
            </span>
            <span style={{ color: "var(--wine-text)" }}>→</span>
            <span style={{ font: "700 13px/1.2 var(--f-sans)", color: "var(--ink)" }}>
              {r.destination || "—"}
            </span>
          </div>
          <span style={{ font: "700 13px/1 var(--f-mono)", color: "var(--ink-soft)", textAlign: "right" }}>
            {r.count}
          </span>
          <div style={{ color: "var(--ink)", textAlign: "right" }}>
            <span style={{ font: "700 13px/1 var(--f-mono)" }}>{money(r.revenue)}</span>
            {r.sinTasa > 0 && <div style={{ font: "500 11px/1.4 var(--f-sans)", color: "var(--ink-soft)", marginTop: "var(--s-1)" }}>Subtotal convertido</div>}
          </div>
          <span style={{ font: "600 12px/1 var(--f-mono)", color: "var(--warning)", textAlign: "right" }}>
            {money(r.cost)}
          </span>
          <span
            style={{
              font: "800 13px/1 var(--f-mono)",
              color: r.sinTasa > 0 ? "var(--ink)" : r.margin < 0 ? "var(--danger)" : "var(--success)",
              textAlign: "right",
            }}
          >
            {r.sinTasa > 0 ? "—" : money(r.margin)}
          </span>
          <div style={{ textAlign: "right" }}>
            <Badge tone={r.sinTasa > 0 ? "neutral" : r.tone} size="md">
              {r.sinTasa > 0 ? "Sin tasa" : `${r.marginPct.toFixed(1)}%`}
            </Badge>
            {r.sinTasa > 0 && <div style={{ font: "500 11px/1.4 var(--f-sans)", color: "var(--ink-soft)", marginTop: "var(--s-1)" }}>{r.sinTasa} {r.sinTasa === 1 ? "embarque sin tasa" : "embarques sin tasa"}</div>}
          </div>
        </div>
      ))}
    </Card>
  );
}

// ── Templates por ruta ─────────────────────────────────────────
function serviceLabel(service: RouteCostTemplate["shipment_service"]): string {
  if (!service) return "Cualquier servicio";
  const l = SERVICE_LABELS[service];
  return l.sub ? `${l.primary} (${l.sub})` : l.primary;
}

function TemplatesView({
  templates,
  money,
  onNew,
  onEdit,
}: {
  templates: RouteCostTemplate[];
  money: Money;
  onNew: () => void;
  onEdit: (t: RouteCostTemplate) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card style={{ padding: 18 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
          <span style={{ color: "var(--info)", marginTop: 3, flexShrink: 0 }}>
            {Icon.info(15)}
          </span>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ font: "800 14px/1.2 var(--f-display)", color: "var(--ink)" }}>
              ¿Para qué sirven los templates?
            </div>
            <div
              style={{
                font: "500 12.5px/1.5 var(--f-sans)",
                color: "var(--ink-soft)",
                marginTop: 6,
                maxWidth: "70ch",
              }}
            >
              Define costos default por <strong>ruta + servicio</strong>. Cuando
              registres un embarque nuevo en esa combinación, los costos se
              prellenan automáticamente. Después ajustas si hay diferencias
              específicas.
            </div>
          </div>
          <ActionButton
            variant="primary"
            size="default"
            idleLabel="Nuevo template"
            idleIcon={Icon.plus(13)}
            successLabel={null}
            onAction={async () => {
              onNew();
            }}
          />
        </div>
      </Card>

      {templates.length === 0 ? (
        <EmptyState
          eyebrow="Templates por ruta"
          title="Todavía no hay templates"
          description="Crea un template de costos por ruta para prellenar el costeo de los embarques nuevos de esa combinación."
        />
      ) : (
        <Card style={{ overflow: "hidden" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 90px 90px 90px 90px 90px 90px 90px 100px 44px",
              padding: "10px 18px",
              gap: 8,
              background: "var(--bg-elevated)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            {["Ruta · Servicio", "Flete", "Aduana", "Transp.", "Handling", "Seguro", "Comis.", "Otros", "Costo total", ""].map(
              (h, i) => (
                <span
                  key={h || i}
                  style={{
                    font: "700 10px/1 var(--f-sans)",
                    color: "var(--ink-soft)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    textAlign: i === 0 ? "left" : i === 9 ? "center" : "right",
                  }}
                >
                  {h}
                </span>
              ),
            )}
          </div>
          {templates.map((t) => {
            const total = totalCost(t);
            const routeBits = [t.origin, t.destination].filter(Boolean);
            const route = routeBits.length === 2 ? `${t.origin} → ${t.destination}` : "Cualquier ruta";
            return (
              <div
                key={t.id}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.4fr 90px 90px 90px 90px 90px 90px 90px 100px 44px",
                  padding: "12px 18px",
                  gap: 8,
                  alignItems: "center",
                  borderTop: "1px solid var(--border)",
                  transition: "background var(--dur-fast) var(--ease)",
                  opacity: t.active ? 1 : 0.55,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        font: "700 13px/1.2 var(--f-sans)",
                        color: "var(--ink)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t.name}
                    </span>
                    {!t.active && (
                      <Badge tone="neutral" size="sm">
                        Inactivo
                      </Badge>
                    )}
                  </div>
                  <div style={{ font: "500 11px/1.3 var(--f-sans)", color: "var(--ink-soft)", marginTop: 2 }}>
                    {route} · {serviceLabel(t.shipment_service)}
                  </div>
                </div>
                <TplCell v={money(t.freight)} />
                <TplCell v={money(t.customs)} />
                <TplCell v={money(t.transport)} />
                <TplCell v={money(t.handling)} />
                <TplCell v={money(t.insurance)} />
                <TplCell v={money(t.commission)} />
                <TplCell v={money(t.other)} />
                <span style={{ font: "800 13px/1 var(--f-mono)", color: "var(--wine-text)", textAlign: "right" }}>
                  {money(total)}
                </span>
                <div style={{ textAlign: "center" }}>
                  <button
                    type="button"
                    onClick={() => onEdit(t)}
                    title="Editar template"
                    aria-label={`Editar template ${t.name}`}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--wine)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-soft)")}
                    style={{
                      background: "transparent",
                      border: 0,
                      color: "var(--ink-soft)",
                      cursor: "pointer",
                      padding: 6,
                      display: "inline-flex",
                    }}
                  >
                    {Icon.edit(13)}
                  </button>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

function TplCell({ v }: { v: string }) {
  return (
    <span style={{ font: "600 11.5px/1 var(--f-mono)", color: "var(--ink-soft)", textAlign: "right" }}>
      {v}
    </span>
  );
}

// ── Forecast del pipeline ──────────────────────────────────────
function ForecastView({ forecast, money }: { forecast: Forecast; money: Money }) {
  const { rows, totals } = forecast;

  if (rows.length === 0) {
    return (
      <EmptyState
        eyebrow="Forecast pipeline"
        title="Sin pipeline para proyectar"
        description="Cuando tengas estimados aceptados (pendientes de embarcar) o enviados, vas a ver acá el revenue, costo y margen proyectados del pipeline."
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Resumen proyectado · navy */}
      <div
        style={{
          background: "var(--bg-sidebar)",
          borderRadius: "var(--r-lg)",
          padding: "20px 22px",
        }}
      >
        <div
          style={{
            font: "700 10px/1 var(--f-sans)",
            color: "var(--ink-side-soft)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          Forecast · pipeline en cierre
        </div>
        <div
          style={{
            font: "900 18px/1.1 var(--f-display)",
            color: "var(--ink-side)",
            marginTop: 6,
            marginBottom: 18,
          }}
        >
          Margen proyectado del pipeline
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 16,
          }}
        >
          <ForecastMetric label="Revenue proyectado" value={money(totals.revenue)} color="var(--ink-side)" />
          <ForecastMetric label="Costo proyectado" value={money(totals.cost)} color="var(--warning)" />
          <ForecastMetric
            label="Margen proyectado"
            value={money(totals.margin)}
            color={totals.margin < 0 ? "var(--wine-soft)" : "var(--success)"}
          />
          <ForecastMetric
            label="Margen % estimado"
            value={`${totals.marginPct.toFixed(1)}%`}
            color="var(--ink-side)"
          />
        </div>
        <div
          style={{
            marginTop: 18,
            paddingTop: 14,
            borderTop: "1px solid var(--border-side)",
            font: "500 12px/1.5 var(--f-sans)",
            color: "var(--ink-side-soft)",
          }}
        >
          Sobre {totals.acceptedCount} estimados aceptados pendientes de
          embarcar + {totals.pendingCount} enviados esperando respuesta. El costo
          sale de un template de ruta cuando existe; si no, se estima.
        </div>
      </div>

      {/* Listado de estimados del pipeline */}
      <Card style={{ overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "120px 1fr 110px 110px 110px 96px",
            padding: "10px 18px",
            gap: 12,
            background: "var(--bg-elevated)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {["Estimado", "Cliente · Ruta", "Revenue", "Costo est.", "Margen est.", "Origen"].map((h, i) => (
            <span
              key={h}
              style={{
                font: "700 10px/1 var(--f-sans)",
                color: "var(--ink-soft)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                textAlign: i >= 2 && i <= 4 ? "right" : "left",
              }}
            >
              {h}
            </span>
          ))}
        </div>
        {rows.map((r) => (
          <ForecastRowItem key={r.quote.id} row={r} money={money} />
        ))}
      </Card>
    </div>
  );
}

function ForecastMetric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div
        style={{
          font: "700 10px/1 var(--f-sans)",
          color: "var(--ink-side-soft)",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div style={{ font: "900 22px/1 var(--f-mono)", color, marginTop: 8 }}>{value}</div>
    </div>
  );
}

function ForecastRowItem({ row, money }: { row: ForecastRow; money: Money }) {
  const q = row.quote;
  const route =
    q.origin && q.destination ? `${q.origin} → ${q.destination}` : "—";
  const isLoss = row.margin < 0;
  return (
    <div
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      style={{
        display: "grid",
        gridTemplateColumns: "120px 1fr 110px 110px 110px 96px",
        padding: "12px 18px",
        gap: 12,
        alignItems: "center",
        borderTop: "1px solid var(--border)",
        transition: "background var(--dur-fast) var(--ease)",
      }}
    >
      <div>
        <code style={{ font: "800 11.5px/1 var(--f-mono)", color: "var(--ink)" }}>
          {q.quote_code}
        </code>
        <div style={{ marginTop: 4 }}>
          <Badge tone={row.bucket === "accepted" ? "success" : "info"} size="sm">
            {row.bucket === "accepted" ? "Aceptada" : "Enviada"}
          </Badge>
        </div>
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            font: "600 12.5px/1.2 var(--f-sans)",
            color: "var(--ink)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {q.client_name}
        </div>
        <div
          style={{ font: "500 11px/1.2 var(--f-sans)", color: "var(--ink-soft)", marginTop: 2 }}
          title={FORECAST_BUCKET_LABEL[row.bucket]}
        >
          {serviceLabel(q.service)} · {route}
        </div>
      </div>
      <span style={{ font: "700 13px/1 var(--f-mono)", color: "var(--ink)", textAlign: "right" }}>
        {money(row.revenue)}
      </span>
      <span style={{ font: "600 12px/1 var(--f-mono)", color: "var(--warning)", textAlign: "right" }}>
        {money(row.cost)}
      </span>
      <span
        style={{
          font: "800 13px/1 var(--f-mono)",
          color: isLoss ? "var(--danger)" : "var(--success)",
          textAlign: "right",
        }}
      >
        {money(row.margin)}
      </span>
      <div>
        <Badge tone={row.fromTemplate ? "neutral" : "warning"} size="sm">
          {row.fromTemplate ? "Template" : "Estimado"}
        </Badge>
      </div>
    </div>
  );
}
